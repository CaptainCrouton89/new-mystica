-- Migration: Initial Schema
-- Description: Creates all tables, enums, functions, views, and indexes for Mystica game database
-- Author: Generated from docs/data-plan.yaml
-- Date: 2025-10-20

-- =======================
-- DROP EXISTING OBJECTS
-- =======================

-- Drop views first (they depend on tables/functions)
DROP VIEW IF EXISTS v_loot_pool_material_weights CASCADE;
DROP VIEW IF EXISTS v_material_tiers CASCADE;
DROP VIEW IF EXISTS v_player_powerlevel CASCADE;
DROP VIEW IF EXISTS v_enemy_realized_stats CASCADE;
DROP VIEW IF EXISTS v_player_equipped_stats CASCADE;
DROP VIEW IF EXISTS v_item_total_stats CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS fn_expected_mul_quick CASCADE;
DROP FUNCTION IF EXISTS fn_weapon_bands_adjusted CASCADE;
DROP FUNCTION IF EXISTS fn_acc_scale CASCADE;
DROP FUNCTION IF EXISTS combat_rating CASCADE;
DROP FUNCTION IF EXISTS effective_hp CASCADE;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS CombatLogEvents CASCADE;
DROP TABLE IF EXISTS AnalyticsEvents CASCADE;
DROP TABLE IF EXISTS EnemyChatterLog CASCADE;
DROP TABLE IF EXISTS CombatChatterLog CASCADE;
DROP TABLE IF EXISTS CombatSessions CASCADE;
DROP TABLE IF EXISTS LootPoolTierWeights CASCADE;
DROP TABLE IF EXISTS MaterialStrengthTiers CASCADE;
DROP TABLE IF EXISTS LootPoolEntries CASCADE;
DROP TABLE IF EXISTS LootPools CASCADE;
DROP TABLE IF EXISTS EnemyPoolMembers CASCADE;
DROP TABLE IF EXISTS EnemyPools CASCADE;
DROP TABLE IF EXISTS Locations CASCADE;
DROP TABLE IF EXISTS PlayerCombatHistory CASCADE;
DROP TABLE IF EXISTS EnemyTypes CASCADE;
DROP TABLE IF EXISTS PetPersonalities CASCADE;
DROP TABLE IF EXISTS ItemImageCache CASCADE;
DROP TABLE IF EXISTS ItemHistory CASCADE;
DROP TABLE IF EXISTS Pets CASCADE;
DROP TABLE IF EXISTS ItemMaterials CASCADE;
DROP TABLE IF EXISTS MaterialStacks CASCADE;
DROP TABLE IF EXISTS MaterialInstances CASCADE;
DROP TABLE IF EXISTS Materials CASCADE;
DROP TABLE IF EXISTS LoadoutSlots CASCADE;
DROP TABLE IF EXISTS Loadouts CASCADE;
DROP TABLE IF EXISTS UserEquipment CASCADE;
DROP TABLE IF EXISTS UserUnlockedItemTypes CASCADE;
DROP TABLE IF EXISTS Weapons CASCADE;
DROP TABLE IF EXISTS Items CASCADE;
DROP TABLE IF EXISTS ItemTypes CASCADE;
DROP TABLE IF EXISTS Tiers CASCADE;
DROP TABLE IF EXISTS StyleDefinitions CASCADE;
DROP TABLE IF EXISTS RarityDefinitions CASCADE;
DROP TABLE IF EXISTS EquipmentSlots CASCADE;
DROP TABLE IF EXISTS DeviceTokens CASCADE;
DROP TABLE IF EXISTS PlayerProgression CASCADE;
DROP TABLE IF EXISTS EconomyTransactions CASCADE;
DROP TABLE IF EXISTS UserCurrencyBalances CASCADE;
DROP TABLE IF EXISTS Currencies CASCADE;
DROP TABLE IF EXISTS Users CASCADE;

-- Drop enums
DROP TYPE IF EXISTS hit_band CASCADE;
DROP TYPE IF EXISTS weapon_pattern CASCADE;
DROP TYPE IF EXISTS actor CASCADE;
DROP TYPE IF EXISTS combat_result CASCADE;
DROP TYPE IF EXISTS rarity CASCADE;

-- =======================
-- CREATE ENUMS
-- =======================

CREATE TYPE rarity AS ENUM ('common', 'uncommon', 'rare', 'epic', 'legendary');
CREATE TYPE combat_result AS ENUM ('victory', 'defeat', 'escape', 'abandoned');
CREATE TYPE actor AS ENUM ('player', 'enemy', 'system');
CREATE TYPE weapon_pattern AS ENUM ('single_arc', 'dual_arcs', 'pulsing_arc', 'roulette', 'sawtooth');
CREATE TYPE hit_band AS ENUM ('injure', 'miss', 'graze', 'normal', 'crit');

-- =======================
-- CREATE CORE TABLES
-- =======================

-- Users (extends Supabase Auth)
CREATE TABLE Users (
    id UUID PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login TIMESTAMP,
    vanity_level INT NOT NULL DEFAULT 0,
    gold_balance INT NOT NULL DEFAULT 500, -- DEPRECATED: use UserCurrencyBalances
    avg_item_level DECIMAL,
    CONSTRAINT positive_vanity_level CHECK (vanity_level >= 0)
);

CREATE INDEX idx_users_id_last_login ON Users(id, last_login);

COMMENT ON TABLE Users IS 'Player accounts linked to Supabase Auth';
COMMENT ON COLUMN Users.gold_balance IS 'DEPRECATED - use UserCurrencyBalances instead';

-- Currencies
CREATE TABLE Currencies (
    code VARCHAR PRIMARY KEY CHECK (code IN ('GOLD', 'GEMS')),
    display_name VARCHAR NOT NULL,
    description TEXT,
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    icon_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE Currencies IS 'Enumeration of available currency types';

-- UserCurrencyBalances
CREATE TABLE UserCurrencyBalances (
    user_id UUID NOT NULL,
    currency_code VARCHAR NOT NULL,
    balance INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, currency_code),
    CONSTRAINT fk_user_currency_balances_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_currency_balances_currency FOREIGN KEY (currency_code) REFERENCES Currencies(code) ON DELETE RESTRICT
);

CREATE INDEX idx_user_currency_balances_user_id ON UserCurrencyBalances(user_id);

-- EconomyTransactions
CREATE TABLE EconomyTransactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    transaction_type VARCHAR NOT NULL CHECK (transaction_type IN ('source', 'sink')),
    currency VARCHAR NOT NULL CHECK (currency IN ('GOLD', 'GEMS')),
    amount INT NOT NULL,
    balance_after INT NOT NULL,
    source_type VARCHAR NOT NULL,
    source_id UUID,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_economy_transactions_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE INDEX idx_economy_transactions_user_id_created_at ON EconomyTransactions(user_id, created_at DESC);
CREATE INDEX idx_economy_transactions_currency_type_created_at ON EconomyTransactions(currency, transaction_type, created_at DESC);
CREATE INDEX idx_economy_transactions_source_type_created_at ON EconomyTransactions(source_type, created_at DESC);

COMMENT ON TABLE EconomyTransactions IS 'Audit ledger for all currency changes';

-- PlayerProgression
CREATE TABLE PlayerProgression (
    user_id UUID PRIMARY KEY,
    xp INT NOT NULL DEFAULT 0 CHECK (xp >= 0),
    level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
    xp_to_next_level INT NOT NULL,
    last_level_up_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_player_progression_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE INDEX idx_player_progression_level_xp ON PlayerProgression(level DESC, xp DESC);

COMMENT ON TABLE PlayerProgression IS 'Account-level progression separate from item levels';

-- DeviceTokens
CREATE TABLE DeviceTokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    platform VARCHAR NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    token TEXT UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_device_tokens_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE INDEX idx_device_tokens_user_id_is_active ON DeviceTokens(user_id, is_active);

COMMENT ON TABLE DeviceTokens IS 'Push notification device registration';

-- EquipmentSlots (seed data)
CREATE TABLE EquipmentSlots (
    slot_name VARCHAR PRIMARY KEY CHECK (slot_name IN ('weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet')),
    display_name VARCHAR NOT NULL,
    sort_order INT NOT NULL,
    description TEXT
);

COMMENT ON TABLE EquipmentSlots IS 'Seed data: 8 equipment slots';

-- RarityDefinitions (seed data)
CREATE TABLE RarityDefinitions (
    rarity rarity PRIMARY KEY,
    stat_multiplier NUMERIC(6,3) NOT NULL CHECK (stat_multiplier > 0),
    base_drop_rate NUMERIC(7,5) NOT NULL CHECK (base_drop_rate >= 0 AND base_drop_rate <= 1),
    display_name VARCHAR NOT NULL,
    color_hex VARCHAR,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE RarityDefinitions IS 'Centralized rarity multipliers for items only';

-- StyleDefinitions (seed data)
CREATE TABLE StyleDefinitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    style_name VARCHAR UNIQUE NOT NULL,
    display_name VARCHAR NOT NULL,
    spawn_rate NUMERIC(7,5) NOT NULL CHECK (spawn_rate >= 0 AND spawn_rate <= 1),
    description TEXT,
    visual_modifier TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE StyleDefinitions IS 'Art style variants for materials and enemies';

-- Tiers (seed data)
CREATE TABLE Tiers (
    id SERIAL PRIMARY KEY,
    tier_num INT UNIQUE NOT NULL CHECK (tier_num >= 1),
    enemy_atk_add INT NOT NULL DEFAULT 6,
    enemy_def_add INT NOT NULL DEFAULT 5,
    enemy_hp_add INT NOT NULL DEFAULT 30,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tiers_tier_num ON Tiers(tier_num);

COMMENT ON TABLE Tiers IS 'Additive tier progression for enemy scaling';

-- ItemTypes (seed data)
CREATE TABLE ItemTypes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    category VARCHAR NOT NULL CHECK (category IN ('weapon', 'offhand', 'head', 'armor', 'feet', 'accessory', 'pet')),
    base_stats_normalized JSON NOT NULL,
    rarity rarity NOT NULL,
    description TEXT,
    appearance_data JSON,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_item_types_rarity FOREIGN KEY (rarity) REFERENCES RarityDefinitions(rarity) ON DELETE RESTRICT,
    CONSTRAINT check_base_stats_sum CHECK (
        (base_stats_normalized->>'atkPower')::numeric +
        (base_stats_normalized->>'atkAccuracy')::numeric +
        (base_stats_normalized->>'defPower')::numeric +
        (base_stats_normalized->>'defAccuracy')::numeric = 1.0
    )
);

CREATE INDEX idx_item_types_category_rarity ON ItemTypes(category, rarity);

COMMENT ON TABLE ItemTypes IS 'Seed data: ~26 items across 8 slots';

-- Items (player-owned instances)
CREATE TABLE Items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    item_type_id UUID NOT NULL,
    level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
    is_styled BOOLEAN NOT NULL DEFAULT FALSE,
    current_stats JSON,
    material_combo_hash TEXT,
    generated_image_url TEXT,
    image_generation_status TEXT CHECK (image_generation_status IN ('pending', 'generating', 'complete', 'failed')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_items_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT fk_items_item_type FOREIGN KEY (item_type_id) REFERENCES ItemTypes(id) ON DELETE RESTRICT
);

CREATE INDEX idx_items_user_id_item_type_id ON Items(user_id, item_type_id);
CREATE INDEX idx_items_user_id_level ON Items(user_id, level DESC);
CREATE INDEX idx_items_material_combo_hash ON Items(material_combo_hash) WHERE material_combo_hash IS NOT NULL;

-- Weapons (extends Items where category=weapon)
CREATE TABLE Weapons (
    item_id UUID PRIMARY KEY,
    pattern weapon_pattern NOT NULL,
    spin_deg_per_s NUMERIC(7,3) NOT NULL DEFAULT 360.0 CHECK (spin_deg_per_s > 0),
    deg_injure NUMERIC(6,2) NOT NULL DEFAULT 5.0 CHECK (deg_injure >= 0),
    deg_miss NUMERIC(6,2) NOT NULL DEFAULT 45.0 CHECK (deg_miss >= 0),
    deg_graze NUMERIC(6,2) NOT NULL DEFAULT 60.0 CHECK (deg_graze >= 0),
    deg_normal NUMERIC(6,2) NOT NULL DEFAULT 200.0 CHECK (deg_normal >= 0),
    deg_crit NUMERIC(6,2) NOT NULL DEFAULT 50.0 CHECK (deg_crit >= 0),
    CONSTRAINT fk_weapons_item FOREIGN KEY (item_id) REFERENCES Items(id) ON DELETE CASCADE,
    CONSTRAINT check_weapon_total_degrees CHECK (
        (deg_injure + deg_miss + deg_graze + deg_normal + deg_crit) <= 360.0
    )
);

CREATE INDEX idx_weapons_item_id ON Weapons(item_id);

COMMENT ON TABLE Weapons IS 'Timing-based combat mechanics for weapon items';

-- UserUnlockedItemTypes
CREATE TABLE UserUnlockedItemTypes (
    user_id UUID NOT NULL,
    item_type_id UUID NOT NULL,
    unlocked_at TIMESTAMP NOT NULL DEFAULT NOW(),
    unlock_source VARCHAR NOT NULL,
    PRIMARY KEY (user_id, item_type_id),
    CONSTRAINT fk_user_unlocked_item_types_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_unlocked_item_types_item_type FOREIGN KEY (item_type_id) REFERENCES ItemTypes(id) ON DELETE RESTRICT
);

-- UserEquipment (normalized equipment state)
CREATE TABLE UserEquipment (
    user_id UUID NOT NULL,
    slot_name VARCHAR NOT NULL,
    item_id UUID,
    equipped_at TIMESTAMP,
    PRIMARY KEY (user_id, slot_name),
    CONSTRAINT fk_user_equipment_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_equipment_slot FOREIGN KEY (slot_name) REFERENCES EquipmentSlots(slot_name) ON DELETE RESTRICT,
    CONSTRAINT fk_user_equipment_item FOREIGN KEY (item_id) REFERENCES Items(id) ON DELETE SET NULL
);

CREATE INDEX idx_user_equipment_user_id_slot_name ON UserEquipment(user_id, slot_name);
CREATE INDEX idx_user_equipment_item_id ON UserEquipment(item_id) WHERE item_id IS NOT NULL;

COMMENT ON TABLE UserEquipment IS 'SINGLE SOURCE OF TRUTH for equipped items';

-- Loadouts
CREATE TABLE Loadouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_loadouts_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT unique_loadout_name UNIQUE (user_id, name)
);

CREATE UNIQUE INDEX idx_loadouts_user_id_is_active ON Loadouts(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_loadouts_user_id_is_active_general ON Loadouts(user_id, is_active);

-- LoadoutSlots
CREATE TABLE LoadoutSlots (
    loadout_id UUID NOT NULL,
    slot_name VARCHAR NOT NULL,
    item_id UUID,
    PRIMARY KEY (loadout_id, slot_name),
    CONSTRAINT fk_loadout_slots_loadout FOREIGN KEY (loadout_id) REFERENCES Loadouts(id) ON DELETE CASCADE,
    CONSTRAINT fk_loadout_slots_slot FOREIGN KEY (slot_name) REFERENCES EquipmentSlots(slot_name) ON DELETE RESTRICT,
    CONSTRAINT fk_loadout_slots_item FOREIGN KEY (item_id) REFERENCES Items(id) ON DELETE SET NULL
);

CREATE INDEX idx_loadout_slots_loadout_id_slot_name ON LoadoutSlots(loadout_id, slot_name);

-- Materials (seed data)
CREATE TABLE Materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    stat_modifiers JSON NOT NULL,
    base_drop_weight INT NOT NULL DEFAULT 100,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT check_material_stat_modifiers_sum CHECK (
        (stat_modifiers->>'atkPower')::numeric +
        (stat_modifiers->>'atkAccuracy')::numeric +
        (stat_modifiers->>'defPower')::numeric +
        (stat_modifiers->>'defAccuracy')::numeric = 0
    )
);

COMMENT ON TABLE Materials IS 'Seed data: ~20 materials with zero-sum stat modifiers';

-- MaterialInstances
CREATE TABLE MaterialInstances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    material_id UUID NOT NULL,
    style_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_material_instances_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT fk_material_instances_material FOREIGN KEY (material_id) REFERENCES Materials(id) ON DELETE RESTRICT,
    CONSTRAINT fk_material_instances_style FOREIGN KEY (style_id) REFERENCES StyleDefinitions(id) ON DELETE RESTRICT
);

CREATE INDEX idx_material_instances_user_id_material_id ON MaterialInstances(user_id, material_id);
CREATE INDEX idx_material_instances_user_id_style_id ON MaterialInstances(user_id, style_id);

COMMENT ON TABLE MaterialInstances IS 'Individual material instances when applied to items';

-- MaterialStacks
CREATE TABLE MaterialStacks (
    user_id UUID NOT NULL,
    material_id UUID NOT NULL,
    style_id UUID NOT NULL,
    quantity INT NOT NULL CHECK (quantity >= 0),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, material_id, style_id),
    CONSTRAINT fk_material_stacks_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT fk_material_stacks_material FOREIGN KEY (material_id) REFERENCES Materials(id) ON DELETE RESTRICT,
    CONSTRAINT fk_material_stacks_style FOREIGN KEY (style_id) REFERENCES StyleDefinitions(id) ON DELETE RESTRICT
);

CREATE INDEX idx_material_stacks_user_id_style_id ON MaterialStacks(user_id, style_id);

COMMENT ON TABLE MaterialStacks IS 'Stackable material inventory';

-- ItemMaterials (junction table)
CREATE TABLE ItemMaterials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL,
    material_instance_id UUID NOT NULL UNIQUE,
    slot_index SMALLINT NOT NULL CHECK (slot_index BETWEEN 0 AND 2),
    applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_item_materials_item FOREIGN KEY (item_id) REFERENCES Items(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_materials_material_instance FOREIGN KEY (material_instance_id) REFERENCES MaterialInstances(id) ON DELETE CASCADE,
    CONSTRAINT unique_item_slot UNIQUE (item_id, slot_index)
);

CREATE INDEX idx_item_materials_item_id ON ItemMaterials(item_id);
CREATE INDEX idx_item_materials_material_instance_id ON ItemMaterials(material_instance_id);

COMMENT ON TABLE ItemMaterials IS 'SINGLE SOURCE OF TRUTH for materials applied to items';

-- ItemHistory
CREATE TABLE ItemHistory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL,
    user_id UUID NOT NULL,
    event_type VARCHAR NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_item_history_item FOREIGN KEY (item_id) REFERENCES Items(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_history_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE INDEX idx_item_history_item_id_created_at ON ItemHistory(item_id, created_at DESC);
CREATE INDEX idx_item_history_user_id_event_type_created_at ON ItemHistory(user_id, event_type, created_at DESC);

-- ItemImageCache
CREATE TABLE ItemImageCache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type_id UUID NOT NULL,
    combo_hash TEXT NOT NULL,
    image_url TEXT NOT NULL,
    craft_count INT NOT NULL DEFAULT 1,
    provider VARCHAR,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_item_image_cache_item_type FOREIGN KEY (item_type_id) REFERENCES ItemTypes(id) ON DELETE CASCADE,
    CONSTRAINT unique_item_type_combo UNIQUE (item_type_id, combo_hash)
);

CREATE INDEX idx_item_image_cache_combo_hash ON ItemImageCache(combo_hash);
CREATE INDEX idx_item_image_cache_item_type_id_craft_count ON ItemImageCache(item_type_id, craft_count DESC);

COMMENT ON TABLE ItemImageCache IS 'Global cache for item+material combo images';

-- PetPersonalities (seed data)
CREATE TABLE PetPersonalities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personality_type VARCHAR UNIQUE NOT NULL,
    display_name VARCHAR NOT NULL,
    description TEXT,
    traits JSON,
    base_dialogue_style TEXT,
    example_phrases JSON,
    verbosity VARCHAR
);

-- Pets (extends Items where category=pet)
CREATE TABLE Pets (
    item_id UUID PRIMARY KEY,
    personality_id UUID,
    custom_name VARCHAR,
    chatter_history JSONB,
    CONSTRAINT fk_pets_item FOREIGN KEY (item_id) REFERENCES Items(id) ON DELETE CASCADE,
    CONSTRAINT fk_pets_personality FOREIGN KEY (personality_id) REFERENCES PetPersonalities(id) ON DELETE SET NULL
);

CREATE INDEX idx_pets_item_id_personality_id ON Pets(item_id, personality_id);

-- Locations
CREATE TABLE Locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR,
    lat DECIMAL NOT NULL,
    lng DECIMAL NOT NULL,
    location_type VARCHAR,
    state_code VARCHAR,
    country_code VARCHAR,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_locations_lat_lng ON Locations(lat, lng);
CREATE INDEX idx_locations_location_type ON Locations(location_type);

-- EnemyTypes (seed data)
CREATE TABLE EnemyTypes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    tier_id INT NOT NULL,
    style_id UUID NOT NULL,
    base_atk INT NOT NULL DEFAULT 10,
    base_def INT NOT NULL DEFAULT 10,
    base_hp INT NOT NULL DEFAULT 120,
    atk_offset INT NOT NULL DEFAULT 0,
    def_offset INT NOT NULL DEFAULT 0,
    hp_offset INT NOT NULL DEFAULT 0,
    ai_personality_traits JSON,
    dialogue_tone VARCHAR,
    base_dialogue_prompt TEXT,
    example_taunts JSON,
    verbosity VARCHAR,
    appearance_data JSON,
    CONSTRAINT fk_enemy_types_tier FOREIGN KEY (tier_id) REFERENCES Tiers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_enemy_types_style FOREIGN KEY (style_id) REFERENCES StyleDefinitions(id) ON DELETE RESTRICT
);

CREATE INDEX idx_enemy_types_name ON EnemyTypes(name);
CREATE INDEX idx_enemy_types_tier_id ON EnemyTypes(tier_id);
CREATE INDEX idx_enemy_types_style_id ON EnemyTypes(style_id);

-- PlayerCombatHistory
CREATE TABLE PlayerCombatHistory (
    user_id UUID NOT NULL,
    location_id UUID NOT NULL,
    total_attempts INT NOT NULL DEFAULT 0,
    victories INT NOT NULL DEFAULT 0,
    defeats INT NOT NULL DEFAULT 0,
    current_streak INT NOT NULL DEFAULT 0,
    longest_streak INT NOT NULL DEFAULT 0,
    last_attempt TIMESTAMP,
    PRIMARY KEY (user_id, location_id),
    CONSTRAINT fk_player_combat_history_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT fk_player_combat_history_location FOREIGN KEY (location_id) REFERENCES Locations(id) ON DELETE CASCADE
);

-- EnemyPools
CREATE TABLE EnemyPools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR UNIQUE NOT NULL,
    combat_level INT NOT NULL,
    filter_type VARCHAR NOT NULL,
    filter_value VARCHAR,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_enemy_pools_combat_level_filter_type ON EnemyPools(combat_level, filter_type);

-- EnemyPoolMembers
CREATE TABLE EnemyPoolMembers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enemy_pool_id UUID NOT NULL,
    enemy_type_id UUID NOT NULL,
    spawn_weight INT NOT NULL DEFAULT 100,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_enemy_pool_members_pool FOREIGN KEY (enemy_pool_id) REFERENCES EnemyPools(id) ON DELETE CASCADE,
    CONSTRAINT fk_enemy_pool_members_enemy_type FOREIGN KEY (enemy_type_id) REFERENCES EnemyTypes(id) ON DELETE RESTRICT,
    CONSTRAINT unique_pool_enemy UNIQUE (enemy_pool_id, enemy_type_id)
);

CREATE INDEX idx_enemy_pool_members_enemy_pool_id ON EnemyPoolMembers(enemy_pool_id);

-- LootPools
CREATE TABLE LootPools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR UNIQUE NOT NULL,
    combat_level INT NOT NULL,
    filter_type VARCHAR NOT NULL,
    filter_value VARCHAR,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loot_pools_combat_level_filter_type ON LootPools(combat_level, filter_type);

-- LootPoolEntries
CREATE TABLE LootPoolEntries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loot_pool_id UUID NOT NULL,
    lootable_type VARCHAR NOT NULL CHECK (lootable_type IN ('material', 'item_type')),
    lootable_id UUID NOT NULL,
    drop_weight INT NOT NULL DEFAULT 100,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_loot_pool_entries_pool FOREIGN KEY (loot_pool_id) REFERENCES LootPools(id) ON DELETE CASCADE
);

CREATE INDEX idx_loot_pool_entries_loot_pool_id ON LootPoolEntries(loot_pool_id);
CREATE INDEX idx_loot_pool_entries_lootable_type_id ON LootPoolEntries(lootable_type, lootable_id);

-- MaterialStrengthTiers
CREATE TABLE MaterialStrengthTiers (
    tier_name TEXT PRIMARY KEY,
    min_abs_sum NUMERIC NOT NULL CHECK (min_abs_sum >= 0),
    max_abs_sum NUMERIC NOT NULL CHECK (max_abs_sum > min_abs_sum),
    display_name VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE MaterialStrengthTiers IS 'Derived tier definitions for material rarity system';

-- LootPoolTierWeights
CREATE TABLE LootPoolTierWeights (
    loot_pool_id UUID NOT NULL,
    tier_name TEXT NOT NULL,
    weight_multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.000,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (loot_pool_id, tier_name),
    CONSTRAINT fk_loot_pool_tier_weights_pool FOREIGN KEY (loot_pool_id) REFERENCES LootPools(id) ON DELETE CASCADE,
    CONSTRAINT fk_loot_pool_tier_weights_tier FOREIGN KEY (tier_name) REFERENCES MaterialStrengthTiers(tier_name) ON DELETE RESTRICT
);

CREATE INDEX idx_loot_pool_tier_weights_loot_pool_id ON LootPoolTierWeights(loot_pool_id);

-- CombatSessions (stored in Redis with 15min TTL for active sessions)
CREATE TABLE CombatSessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    location_id UUID NOT NULL,
    combat_level INT NOT NULL,
    enemy_type_id UUID NOT NULL,
    applied_enemy_pools JSON,
    applied_loot_pools JSON,
    player_equipped_items_snapshot JSON,
    player_rating NUMERIC,
    enemy_rating NUMERIC,
    win_prob_est NUMERIC,
    combat_log JSON,
    outcome combat_result,
    rewards JSON,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_combat_sessions_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT fk_combat_sessions_location FOREIGN KEY (location_id) REFERENCES Locations(id) ON DELETE RESTRICT,
    CONSTRAINT fk_combat_sessions_enemy_type FOREIGN KEY (enemy_type_id) REFERENCES EnemyTypes(id) ON DELETE RESTRICT
);

-- =======================
-- ANALYTICS TABLES
-- =======================

-- CombatChatterLog
CREATE TABLE CombatChatterLog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    pet_item_id UUID NOT NULL,
    event_type VARCHAR NOT NULL,
    combat_context JSON,
    generated_dialogue TEXT,
    personality_type VARCHAR,
    generation_time_ms INT,
    was_ai_generated BOOLEAN,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_combat_chatter_log_session FOREIGN KEY (session_id) REFERENCES CombatSessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_combat_chatter_log_pet FOREIGN KEY (pet_item_id) REFERENCES Items(id) ON DELETE CASCADE
);

CREATE INDEX idx_combat_chatter_log_session_id_timestamp ON CombatChatterLog(session_id, timestamp);
CREATE INDEX idx_combat_chatter_log_personality_type_event_type ON CombatChatterLog(personality_type, event_type);

-- EnemyChatterLog
CREATE TABLE EnemyChatterLog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    enemy_type_id UUID NOT NULL,
    event_type VARCHAR NOT NULL,
    combat_context JSON,
    player_metadata JSON,
    generated_dialogue TEXT,
    dialogue_tone VARCHAR,
    generation_time_ms INT,
    was_ai_generated BOOLEAN,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_enemy_chatter_log_session FOREIGN KEY (session_id) REFERENCES CombatSessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_enemy_chatter_log_enemy_type FOREIGN KEY (enemy_type_id) REFERENCES EnemyTypes(id) ON DELETE CASCADE
);

CREATE INDEX idx_enemy_chatter_log_session_id_timestamp ON EnemyChatterLog(session_id, timestamp);
CREATE INDEX idx_enemy_chatter_log_enemy_type_id_event_type ON EnemyChatterLog(enemy_type_id, event_type);

-- AnalyticsEvents
CREATE TABLE AnalyticsEvents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    event_name VARCHAR NOT NULL,
    properties JSONB,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_analytics_events_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE INDEX idx_analytics_events_event_name_timestamp ON AnalyticsEvents(event_name, timestamp);

-- CombatLogEvents
CREATE TABLE CombatLogEvents (
    id UUID DEFAULT gen_random_uuid(),
    combat_id UUID NOT NULL,
    seq INT NOT NULL,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor actor NOT NULL,
    event_type TEXT NOT NULL,
    value_i INT,
    payload JSONB,
    PRIMARY KEY (combat_id, seq),
    CONSTRAINT fk_combat_log_events_combat FOREIGN KEY (combat_id) REFERENCES CombatSessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_combat_log_events_combat_id_seq ON CombatLogEvents(combat_id, seq);
CREATE INDEX idx_combat_log_events_actor_event_type ON CombatLogEvents(actor, event_type);

COMMENT ON TABLE CombatLogEvents IS 'Normalized turn-by-turn combat event log';

-- =======================
-- CREATE FUNCTIONS
-- =======================

-- effective_hp: Calculates effective HP accounting for diminishing returns on defense
CREATE OR REPLACE FUNCTION effective_hp(
    hp NUMERIC,
    defense NUMERIC,
    def_k NUMERIC DEFAULT 75.0
) RETURNS NUMERIC AS $$
BEGIN
    RETURN hp * (1.0 + defense / (defense + def_k));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION effective_hp IS 'Calculates effective HP with diminishing defense returns';

-- combat_rating: Power-law combat power formula for Elo-style matchmaking
CREATE OR REPLACE FUNCTION combat_rating(
    atk NUMERIC,
    defense NUMERIC,
    hp NUMERIC,
    alpha_atk NUMERIC DEFAULT 0.55,
    alpha_ehp NUMERIC DEFAULT 0.45
) RETURNS NUMERIC AS $$
DECLARE
    ehp NUMERIC;
BEGIN
    ehp := effective_hp(hp, defense);
    RETURN POWER(atk, alpha_atk) * POWER(ehp, alpha_ehp);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION combat_rating IS 'Power-law combat rating for matchmaking';

-- fn_acc_scale: Accuracy scaling multiplier for weapon timing bands
CREATE OR REPLACE FUNCTION fn_acc_scale(
    acc NUMERIC,
    k_acc NUMERIC DEFAULT 80,
    s_max NUMERIC DEFAULT 0.40
) RETURNS NUMERIC AS $$
BEGIN
    RETURN 1.0 + s_max * (acc / (acc + k_acc));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION fn_acc_scale IS 'Accuracy scaling multiplier with diminishing returns';

-- fn_weapon_bands_adjusted: Adjusts weapon hit bands based on player accuracy
CREATE OR REPLACE FUNCTION fn_weapon_bands_adjusted(
    w_id UUID,
    player_acc NUMERIC
) RETURNS TABLE(
    deg_injure NUMERIC,
    deg_miss NUMERIC,
    deg_graze NUMERIC,
    deg_normal NUMERIC,
    deg_crit NUMERIC
) AS $$
DECLARE
    acc_scale NUMERIC;
    w RECORD;
    total_deg NUMERIC;
    shrink_pool NUMERIC;
    expand_pool NUMERIC;
BEGIN
    -- Get weapon data
    SELECT * INTO w FROM Weapons WHERE item_id = w_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Weapon not found: %', w_id;
    END IF;

    -- Calculate accuracy scale
    acc_scale := fn_acc_scale(player_acc);

    -- Shrink bad bands (injure, miss)
    deg_injure := GREATEST(w.deg_injure / acc_scale, 2.0);
    deg_miss := GREATEST(w.deg_miss / acc_scale, 2.0);

    -- Calculate available degrees to redistribute
    shrink_pool := (w.deg_injure + w.deg_miss) - (deg_injure + deg_miss);

    -- Expand good bands proportionally
    expand_pool := w.deg_graze + w.deg_normal + w.deg_crit;
    deg_graze := w.deg_graze + shrink_pool * (w.deg_graze / expand_pool);
    deg_normal := w.deg_normal + shrink_pool * (w.deg_normal / expand_pool);
    deg_crit := w.deg_crit + shrink_pool * (w.deg_crit / expand_pool);

    -- Ensure total doesn't exceed 360
    total_deg := deg_injure + deg_miss + deg_graze + deg_normal + deg_crit;
    IF total_deg > 360.0 THEN
        deg_injure := deg_injure * (360.0 / total_deg);
        deg_miss := deg_miss * (360.0 / total_deg);
        deg_graze := deg_graze * (360.0 / total_deg);
        deg_normal := deg_normal * (360.0 / total_deg);
        deg_crit := deg_crit * (360.0 / total_deg);
    END IF;

    RETURN QUERY SELECT deg_injure, deg_miss, deg_graze, deg_normal, deg_crit;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION fn_weapon_bands_adjusted IS 'Adjusts weapon hit bands based on player accuracy';

-- fn_expected_mul_quick: Calculates expected damage multiplier for weapon
CREATE OR REPLACE FUNCTION fn_expected_mul_quick(
    w_id UUID,
    player_acc NUMERIC,
    mul_injure NUMERIC DEFAULT -0.5,
    mul_miss NUMERIC DEFAULT 0.0,
    mul_graze NUMERIC DEFAULT 0.6,
    mul_normal NUMERIC DEFAULT 1.0,
    mul_crit NUMERIC DEFAULT 1.6
) RETURNS NUMERIC AS $$
DECLARE
    bands RECORD;
    total_deg NUMERIC := 360.0;
BEGIN
    -- Get adjusted bands
    SELECT * INTO bands FROM fn_weapon_bands_adjusted(w_id, player_acc);

    -- Calculate weighted average
    RETURN (
        (bands.deg_injure / total_deg) * mul_injure +
        (bands.deg_miss / total_deg) * mul_miss +
        (bands.deg_graze / total_deg) * mul_graze +
        (bands.deg_normal / total_deg) * mul_normal +
        (bands.deg_crit / total_deg) * mul_crit
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION fn_expected_mul_quick IS 'Calculates expected damage multiplier for weapon';

-- =======================
-- CREATE VIEWS
-- =======================

-- v_item_total_stats: Computes final item stats with rarity multiplier
CREATE OR REPLACE VIEW v_item_total_stats AS
SELECT
    i.id,
    it.name,
    it.category AS slot,
    it.rarity,
    i.level,
    i.is_styled,
    (it.base_stats_normalized->>'atkPower')::numeric * rd.stat_multiplier * i.level * 10 AS atk_power,
    (it.base_stats_normalized->>'atkAccuracy')::numeric * rd.stat_multiplier * i.level * 10 AS atk_accuracy,
    (it.base_stats_normalized->>'defPower')::numeric * rd.stat_multiplier * i.level * 10 AS def_power,
    (it.base_stats_normalized->>'defAccuracy')::numeric * rd.stat_multiplier * i.level * 10 AS def_accuracy,
    ((it.base_stats_normalized->>'atkPower')::numeric +
     (it.base_stats_normalized->>'atkAccuracy')::numeric +
     (it.base_stats_normalized->>'defPower')::numeric +
     (it.base_stats_normalized->>'defAccuracy')::numeric) * rd.stat_multiplier * i.level * 10 AS total_stats
FROM Items i
JOIN ItemTypes it ON i.item_type_id = it.id
JOIN RarityDefinitions rd ON it.rarity = rd.rarity;

COMMENT ON VIEW v_item_total_stats IS 'Final item stats with rarity multiplier applied';

-- v_player_equipped_stats: Aggregates all equipped item stats for each player
CREATE OR REPLACE VIEW v_player_equipped_stats AS
SELECT
    u.id AS player_id,
    COALESCE(SUM(vits.atk_power), 0) AS atk,
    COALESCE(SUM(vits.def_power), 0) AS def,
    COALESCE(SUM(vits.atk_power + vits.def_power), 0) AS hp,
    COALESCE(SUM(vits.atk_accuracy + vits.def_accuracy), 0) AS acc,
    combat_rating(
        COALESCE(SUM(vits.atk_power), 0),
        COALESCE(SUM(vits.def_power), 0),
        COALESCE(SUM(vits.atk_power + vits.def_power), 0)
    ) AS combat_rating
FROM Users u
LEFT JOIN UserEquipment ue ON u.id = ue.user_id
LEFT JOIN v_item_total_stats vits ON ue.item_id = vits.id
GROUP BY u.id;

COMMENT ON VIEW v_player_equipped_stats IS 'Aggregated player stats from equipped items';

-- v_enemy_realized_stats: Computes final enemy stats with additive tier scaling
CREATE OR REPLACE VIEW v_enemy_realized_stats AS
SELECT
    et.id,
    et.name,
    t.tier_num,
    et.base_atk + et.atk_offset + (t.enemy_atk_add * (t.tier_num - 1)) AS atk,
    et.base_def + et.def_offset + (t.enemy_def_add * (t.tier_num - 1)) AS def,
    et.base_hp + et.hp_offset + (t.enemy_hp_add * (t.tier_num - 1)) AS hp,
    combat_rating(
        et.base_atk + et.atk_offset + (t.enemy_atk_add * (t.tier_num - 1)),
        et.base_def + et.def_offset + (t.enemy_def_add * (t.tier_num - 1)),
        et.base_hp + et.hp_offset + (t.enemy_hp_add * (t.tier_num - 1))
    ) AS combat_rating
FROM EnemyTypes et
JOIN Tiers t ON et.tier_id = t.id;

COMMENT ON VIEW v_enemy_realized_stats IS 'Final enemy stats with additive tier scaling';

-- v_player_powerlevel: Computes player power accounting for weapon timing effectiveness
CREATE OR REPLACE VIEW v_player_powerlevel AS
SELECT
    pes.player_id,
    pes.atk,
    pes.def,
    pes.hp,
    pes.acc,
    ue.item_id AS weapon_item_id,
    COALESCE(fn_expected_mul_quick(ue.item_id, pes.acc), 1.0) AS expected_mul,
    combat_rating(
        pes.atk * GREATEST(COALESCE(fn_expected_mul_quick(ue.item_id, pes.acc), 1.0), 0.2),
        pes.def,
        pes.hp
    ) AS power_level
FROM v_player_equipped_stats pes
LEFT JOIN UserEquipment ue ON pes.player_id = ue.user_id AND ue.slot_name = 'weapon';

COMMENT ON VIEW v_player_powerlevel IS 'Player power accounting for weapon timing effectiveness';

-- v_material_tiers: Computes material tier classification from stat_modifiers
CREATE OR REPLACE VIEW v_material_tiers AS
SELECT
    m.id AS material_id,
    ABS((m.stat_modifiers->>'atkPower')::numeric) +
    ABS((m.stat_modifiers->>'atkAccuracy')::numeric) +
    ABS((m.stat_modifiers->>'defPower')::numeric) +
    ABS((m.stat_modifiers->>'defAccuracy')::numeric) AS abs_sum,
    mst.tier_name
FROM Materials m
JOIN MaterialStrengthTiers mst ON
    ABS((m.stat_modifiers->>'atkPower')::numeric) +
    ABS((m.stat_modifiers->>'atkAccuracy')::numeric) +
    ABS((m.stat_modifiers->>'defPower')::numeric) +
    ABS((m.stat_modifiers->>'defAccuracy')::numeric) >= mst.min_abs_sum
    AND ABS((m.stat_modifiers->>'atkPower')::numeric) +
    ABS((m.stat_modifiers->>'atkAccuracy')::numeric) +
    ABS((m.stat_modifiers->>'defPower')::numeric) +
    ABS((m.stat_modifiers->>'defAccuracy')::numeric) < mst.max_abs_sum;

COMMENT ON VIEW v_material_tiers IS 'Material tier classification from stat_modifiers absolute sum';

-- v_loot_pool_material_weights: Computes final drop weights per material per pool
CREATE OR REPLACE VIEW v_loot_pool_material_weights AS
SELECT
    lp.id AS loot_pool_id,
    m.id AS material_id,
    COALESCE(
        lpe.drop_weight,
        GREATEST(
            ROUND(m.base_drop_weight * COALESCE(lptw.weight_multiplier, 1.0)),
            0
        )
    ) AS final_weight
FROM LootPools lp
CROSS JOIN Materials m
LEFT JOIN v_material_tiers vmt ON m.id = vmt.material_id
LEFT JOIN LootPoolTierWeights lptw ON lp.id = lptw.loot_pool_id AND vmt.tier_name = lptw.tier_name
LEFT JOIN LootPoolEntries lpe ON lp.id = lpe.loot_pool_id
    AND lpe.lootable_type = 'material'
    AND lpe.lootable_id = m.id;

COMMENT ON VIEW v_loot_pool_material_weights IS 'Final drop weights combining base_drop_weight × tier_multiplier with explicit overrides';

-- =======================
-- COMMENTS
-- =======================

COMMENT ON DATABASE postgres IS 'Mystica game database';
