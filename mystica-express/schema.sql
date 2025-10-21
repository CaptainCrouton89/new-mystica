-- =========================================================
-- INIT: Extensions
-- =========================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- =========================================================
-- INIT: Enums
-- =========================================================
DO $$ BEGIN
  CREATE TYPE equip_slot AS ENUM (
    'weapon','offhand','head','chest','legs','hands','feet','ring','amulet'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rarity AS ENUM ('Common','Uncommon','Rare','Epic','Legendary','Shiny');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE combat_result AS ENUM ('WIN','LOSS','ESCAPE','ABORTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE actor AS ENUM ('PLAYER','ENEMY','SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE weapon_pattern AS ENUM ('single_arc','dual_arcs','pulsing_arc','roulette','sawtooth');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE hit_band AS ENUM ('INJURE','MISS','GRAZE','NORMAL','CRIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- BALANCE: Tiers (additive) & Rarity (multiplicative)
-- =========================================================
CREATE TABLE IF NOT EXISTS tiers (
  id            SERIAL PRIMARY KEY,
  tier_num      INT UNIQUE NOT NULL CHECK (tier_num >= 1),
  enemy_atk_add INT NOT NULL DEFAULT 6,    -- per (tier_num-1)
  enemy_def_add INT NOT NULL DEFAULT 5,
  enemy_hp_add  INT NOT NULL DEFAULT 30
);

CREATE TABLE IF NOT EXISTS rarity_defs (
  rarity          rarity PRIMARY KEY,
  stat_multiplier NUMERIC(6,3) NOT NULL CHECK (stat_multiplier > 0),
  base_drop_rate  NUMERIC(7,5) NOT NULL CHECK (base_drop_rate >= 0 AND base_drop_rate <= 1)
);

INSERT INTO rarity_defs (rarity, stat_multiplier, base_drop_rate) VALUES
  ('Common',     1.00, 0.60000),
  ('Uncommon',   1.06, 0.25000),
  ('Rare',       1.13, 0.10000),
  ('Epic',       1.22, 0.04000),
  ('Legendary',  1.35, 0.01000),
  ('Shiny',      1.50, 0.00200)
ON CONFLICT (rarity) DO NOTHING;

-- =========================================================
-- CATALOG: Materials (never drop)
-- =========================================================
CREATE TABLE IF NOT EXISTS materials (
  id      SERIAL PRIMARY KEY,
  name    TEXT UNIQUE NOT NULL,
  tier_id INT REFERENCES tiers(id) ON DELETE SET NULL
);

-- =========================================================
-- ITEMS (instances) & WEAPONS
-- =========================================================
CREATE TABLE IF NOT EXISTS items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  slot          equip_slot,               -- NULL => not equipable
  rarity        rarity NOT NULL DEFAULT 'Common',
  level         INT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 4), -- 1 fresh; 2..4 after upgrades

  -- Base stats (pre-rarity multiplier)
  base_atk      INT NOT NULL DEFAULT 0,
  base_def      INT NOT NULL DEFAULT 0,
  base_hp       INT NOT NULL DEFAULT 0,
  base_acc      INT NOT NULL DEFAULT 0,   -- accuracy

  bind_on_pickup BOOLEAN NOT NULL DEFAULT FALSE,
  is_unique      BOOLEAN NOT NULL DEFAULT FALSE,
  retired        BOOLEAN NOT NULL DEFAULT FALSE, -- not used by upgrades now, but kept for safety

  -- Loot controls (materials never drop; items can if enabled)
  drop_enabled   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_items_slot       ON items(slot);
CREATE INDEX IF NOT EXISTS idx_items_rarity     ON items(rarity);
CREATE INDEX IF NOT EXISTS idx_items_droppable  ON items(drop_enabled);

-- Per-weapon timing pattern + bands
CREATE TABLE IF NOT EXISTS weapons (
  item_id UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  pattern weapon_pattern NOT NULL,
  spin_deg_per_s NUMERIC(7,3) NOT NULL DEFAULT 360.0 CHECK (spin_deg_per_s > 0),

  deg_injure NUMERIC(6,2) NOT NULL DEFAULT 5.0  CHECK (deg_injure >= 0),
  deg_miss   NUMERIC(6,2) NOT NULL DEFAULT 45.0 CHECK (deg_miss   >= 0),
  deg_graze  NUMERIC(6,2) NOT NULL DEFAULT 60.0 CHECK (deg_graze  >= 0),
  deg_normal NUMERIC(6,2) NOT NULL DEFAULT 200.0 CHECK (deg_normal>= 0),
  deg_crit   NUMERIC(6,2) NOT NULL DEFAULT 50.0 CHECK (deg_crit   >= 0),

  CONSTRAINT weapons_chk_total_degrees CHECK (
    (deg_injure + deg_miss + deg_graze + deg_normal + deg_crit) <= 360.0
  )
);

-- =========================================================
-- ENEMIES (PvM) with ADDITIVE tiering
-- =========================================================
CREATE TABLE IF NOT EXISTS enemies (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  tier_id   INT NOT NULL REFERENCES tiers(id) ON DELETE RESTRICT,

  -- Baselines before tier adds
  base_atk  INT NOT NULL DEFAULT 10,
  base_def  INT NOT NULL DEFAULT 10,
  base_hp   INT NOT NULL DEFAULT 120,

  -- Small offsets to differentiate individuals
  atk_offset INT NOT NULL DEFAULT 0,
  def_offset INT NOT NULL DEFAULT 0,
  hp_offset  INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_enemies_tier ON enemies(tier_id);

-- =========================================================
-- PLAYERS / GOLD / BASE STATS / INVENTORY / LOADOUTS
-- =========================================================
CREATE TABLE IF NOT EXISTS players (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  handle             TEXT UNIQUE NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_loadout_id UUID,
  gold_balance       INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS player_base_stats (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  base_atk  INT NOT NULL DEFAULT 12,
  base_def  INT NOT NULL DEFAULT 8,
  base_hp   INT NOT NULL DEFAULT 100
);

-- Player materials (stacked; upgrades consume qty here)
CREATE TABLE IF NOT EXISTS player_materials (
  player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  material_id INT NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  qty        INT NOT NULL CHECK (qty >= 0),
  PRIMARY KEY (player_id, material_id)
);

-- Player items (stack counts for non-equipables)
CREATE TABLE IF NOT EXISTS player_inventory (
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  item_id   UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  qty       INT  NOT NULL CHECK (qty >= 0),
  bound     BOOLEAN NOT NULL DEFAULT FALSE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, item_id)
);

-- Named equipment loadouts
CREATE TABLE IF NOT EXISTS equipment_loadouts (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  UNIQUE (player_id, name)
);

ALTER TABLE players
  ADD CONSTRAINT IF NOT EXISTS fk_players_current_loadout
  FOREIGN KEY (current_loadout_id) REFERENCES equipment_loadouts(id)
  ON DELETE SET NULL;

-- Slot → Item mapping per loadout
CREATE TABLE IF NOT EXISTS equipment_slots_map (
  loadout_id UUID NOT NULL REFERENCES equipment_loadouts(id) ON DELETE CASCADE,
  slot       equip_slot NOT NULL,
  item_id    UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  PRIMARY KEY (loadout_id, slot)
);

-- =========================================================
-- GEO / LOCATION-AWARE ENEMY & LOOT POOLS (items only)
-- =========================================================
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  geo  GEOGRAPHY(POINT, 4326) NOT NULL,   -- lon/lat
  location_type TEXT,
  state_code TEXT,
  country_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_locations_geo  ON locations USING GIST (geo);
CREATE INDEX IF NOT EXISTS idx_locations_type ON locations (location_type);

CREATE TABLE IF NOT EXISTS enemy_pools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  combat_level INT NOT NULL CHECK (combat_level >= 1),
  filter_type TEXT NOT NULL CHECK (filter_type IN ('universal','location_type','state','country','bbox')),
  filter_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enemy_pool_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enemy_pool_id UUID NOT NULL REFERENCES enemy_pools(id) ON DELETE CASCADE,
  enemy_id INT NOT NULL REFERENCES enemies(id) ON DELETE RESTRICT,
  spawn_weight INT NOT NULL DEFAULT 100 CHECK (spawn_weight > 0),
  UNIQUE (enemy_pool_id, enemy_id)
);

CREATE TABLE IF NOT EXISTS loot_pools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  combat_level INT NOT NULL CHECK (combat_level >= 1),
  filter_type TEXT NOT NULL CHECK (filter_type IN ('universal','location_type','state','country','bbox')),
  filter_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items only (materials never drop)
CREATE TABLE IF NOT EXISTS loot_pool_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loot_pool_id UUID NOT NULL REFERENCES loot_pools(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  drop_weight  INT NOT NULL DEFAULT 100 CHECK (drop_weight > 0)
);
CREATE INDEX IF NOT EXISTS idx_loot_entries_pool ON loot_pool_entries(loot_pool_id);

-- =========================================================
-- COMBAT LOGGING (normalized)
-- =========================================================
CREATE TABLE IF NOT EXISTS combats (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  enemy_id      INT  NOT NULL REFERENCES enemies(id) ON DELETE RESTRICT,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  result        combat_result,
  player_rating NUMERIC,
  enemy_rating  NUMERIC,
  win_prob_est  NUMERIC,
  notes         TEXT
);
CREATE INDEX IF NOT EXISTS idx_combats_player ON combats(player_id);
CREATE INDEX IF NOT EXISTS idx_combats_enemy  ON combats(enemy_id);

CREATE TABLE IF NOT EXISTS combat_log_events (
  combat_id   UUID NOT NULL REFERENCES combats(id) ON DELETE CASCADE,
  seq         INT  NOT NULL,
  ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor       actor NOT NULL,
  event_type  TEXT NOT NULL,
  value_i     INT,
  payload     JSONB,
  PRIMARY KEY (combat_id, seq)
);

-- =========================================================
-- FUNCTIONS: balance math & timing model helpers
-- =========================================================
CREATE OR REPLACE FUNCTION effective_hp(hp NUMERIC, defense NUMERIC, def_k NUMERIC DEFAULT 75.0)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT hp * (1.0 + defense / NULLIF(defense + def_k, 0))
$$;

CREATE OR REPLACE FUNCTION combat_rating(atk NUMERIC, defense NUMERIC, hp NUMERIC,
                                         alpha_atk NUMERIC DEFAULT 0.55,
                                         alpha_ehp NUMERIC DEFAULT 0.45)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  WITH ehp AS (SELECT effective_hp(hp, defense) AS v)
  SELECT POWER(GREATEST(atk, 1e-6), alpha_atk)
       * POWER((SELECT v FROM ehp), alpha_ehp)
$$;

CREATE OR REPLACE FUNCTION fn_acc_scale(acc NUMERIC, k_acc NUMERIC DEFAULT 80, s_max NUMERIC DEFAULT 0.40)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT 1.0 + s_max * (acc / NULLIF(acc + k_acc, 0))
$$;

CREATE OR REPLACE FUNCTION fn_weapon_bands_adjusted(
  w_id UUID, player_acc NUMERIC
) RETURNS TABLE(
  deg_injure NUMERIC, deg_miss NUMERIC, deg_graze NUMERIC, deg_normal NUMERIC, deg_crit NUMERIC
) LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s NUMERIC;
       bi NUMERIC; bm NUMERIC; bg NUMERIC; bn NUMERIC; bc NUMERIC;
       sumpos NUMERIC; sumpost NUMERIC;
BEGIN
  SELECT fn_acc_scale(player_acc) INTO s;

  SELECT deg_injure, deg_miss, deg_graze, deg_normal, deg_crit
    INTO bi, bm, bg, bn, bc
  FROM weapons WHERE item_id = w_id;

  IF bi IS NULL THEN
    bi := 5; bm := 45; bg := 60; bn := 200; bc := 50;
  END IF;

  bi := GREATEST(bi / s, 2.0);
  bm := GREATEST(bm / s, 2.0);
  bg := bg * s;
  bn := bn * s;
  bc := bc * s;

  sumpos := bg + bn + bc;
  IF (bi + bm + sumpos) > 360 THEN
    sumpost := LEAST(sumpos, (bg + bn + bc) - ((bi + bm + sumpos) - 360));
    IF sumpost <= 0 THEN
      bg := 2; bn := 2; bc := 2;
    ELSE
      bg := bg * (sumpost / sumpos);
      bn := bn * (sumpost / sumpos);
      bc := bc * (sumpost / sumpos);
    END IF;
  END IF;

  RETURN QUERY SELECT bi, bm, bg, bn, bc;
END $$;

CREATE OR REPLACE FUNCTION fn_expected_mul_quick(
  w_id UUID, player_acc NUMERIC,
  mul_injure NUMERIC DEFAULT -0.5,
  mul_miss   NUMERIC DEFAULT 0.0,
  mul_graze  NUMERIC DEFAULT 0.6,
  mul_normal NUMERIC DEFAULT 1.0,
  mul_crit   NUMERIC DEFAULT 1.6
) RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  WITH bands AS (
    SELECT * FROM fn_weapon_bands_adjusted(w_id, player_acc)
  )
  SELECT
    (deg_injure/360.0)*mul_injure +
    (deg_miss  /360.0)*mul_miss   +
    (deg_graze /360.0)*mul_graze  +
    (deg_normal/360.0)*mul_normal +
    (deg_crit  /360.0)*mul_crit
  FROM bands;
$$;

-- =========================================================
-- VIEWS: item totals, player stats, enemy realized (additive tiers), power level
-- =========================================================
CREATE OR REPLACE VIEW v_item_total_stats AS
SELECT
  it.id, it.name, it.slot, it.rarity, it.level, it.drop_enabled,
  (it.base_atk * rd.stat_multiplier)::NUMERIC AS atk_total,
  (it.base_def * rd.stat_multiplier)::NUMERIC AS def_total,
  (it.base_hp  * rd.stat_multiplier)::NUMERIC AS hp_total,
  (it.base_acc * rd.stat_multiplier)::NUMERIC AS acc_total
FROM items it
JOIN rarity_defs rd ON rd.rarity = it.rarity
WHERE it.retired = FALSE;

CREATE OR REPLACE VIEW v_player_equipped_stats AS
WITH eq AS (
  SELECT p.id AS player_id, p.current_loadout_id, esm.item_id
  FROM players p
  JOIN equipment_slots_map esm ON esm.loadout_id = p.current_loadout_id
),
sum_items AS (
  SELECT e.player_id,
         COALESCE(SUM(v.atk_total),0) AS atk_items,
         COALESCE(SUM(v.def_total),0) AS def_items,
         COALESCE(SUM(v.hp_total ),0) AS hp_items,
         COALESCE(SUM(v.acc_total),0) AS acc_items
  FROM eq e
  JOIN v_item_total_stats v ON v.id = e.item_id
  GROUP BY e.player_id
)
SELECT
  p.id AS player_id,
  (pbs.base_atk + si.atk_items)::NUMERIC AS atk,
  (pbs.base_def + si.def_items)::NUMERIC AS def,
  (pbs.base_hp  + si.hp_items )::NUMERIC AS hp,
  (0           + si.acc_items )::NUMERIC AS acc,
  combat_rating((pbs.base_atk + si.atk_items),
                (pbs.base_def + si.def_items),
                (pbs.base_hp  + si.hp_items)) AS combat_rating
FROM players p
JOIN player_base_stats pbs ON pbs.player_id = p.id
LEFT JOIN sum_items si ON si.player_id = p.id;

CREATE OR REPLACE VIEW v_enemy_realized_stats AS
SELECT
  e.id,
  e.name,
  t.tier_num,
  (e.base_atk + e.atk_offset + (t.enemy_atk_add * (t.tier_num - 1)))::NUMERIC AS atk,
  (e.base_def + e.def_offset + (t.enemy_def_add * (t.tier_num - 1)))::NUMERIC AS def,
  (e.base_hp  + e.hp_offset  + (t.enemy_hp_add  * (t.tier_num - 1)))::NUMERIC AS hp,
  combat_rating(
     (e.base_atk + e.atk_offset + (t.enemy_atk_add * (t.tier_num - 1))),
     (e.base_def + e.def_offset + (t.enemy_def_add * (t.tier_num - 1))),
     (e.base_hp  + e.hp_offset  + (t.enemy_hp_add  * (t.tier_num - 1)))
  ) AS combat_rating
FROM enemies e
JOIN tiers t ON t.id = e.tier_id;

CREATE OR REPLACE VIEW v_player_powerlevel AS
WITH pes AS (
  SELECT * FROM v_player_equipped_stats
),
joined AS (
  SELECT p.player_id, p.atk, p.def, p.hp, p.acc, esm.item_id AS weapon_item_id
  FROM pes p
  JOIN players pl ON pl.id = p.player_id
  JOIN equipment_slots_map esm ON esm.loadout_id = pl.current_loadout_id AND esm.slot = 'weapon'
)
SELECT
  j.player_id,
  j.atk, j.def, j.hp, j.acc, j.weapon_item_id,
  fn_expected_mul_quick(j.weapon_item_id, j.acc) AS expected_mul,
  combat_rating(j.atk * GREATEST(fn_expected_mul_quick(j.weapon_item_id, j.acc), 0.2),
                j.def, j.hp) AS power_level
FROM joined j;

-- =========================================================
-- COMMENTED EXAMPLES
-- =========================================================
-- -- Upgrade flow (app-side):
-- -- 1) assert item.level < 4 and player_materials.qty(material_id) >= 1
-- -- 2) decrement player_materials.qty by 1
-- -- 3) mutate items row IN PLACE (increase level; adjust base_[atk/def/hp/acc])
-- -- 4) done (no lineage/history kept)

-- -- Loot candidates (items only):
-- -- SELECT le.item_id, le.drop_weight
-- -- FROM loot_pool_entries le
-- -- JOIN loot_pools lp ON lp.id = le.loot_pool_id
-- -- WHERE lp.combat_level = :cl
-- --   AND (lp.filter_type = 'universal'
-- --        OR (lp.filter_type = 'location_type' AND lp.filter_value = :loc_type)
-- --        OR (lp.filter_type = 'state' AND lp.filter_value = :state)
-- --        OR (lp.filter_type = 'country' AND lp.filter_value = :country));
