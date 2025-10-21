# Item Upgrade System Database Schema Investigation

## Executive Summary

Investigation of `mystica-express/migrations/001_initial_schema.sql` reveals the complete database structure for implementing item upgrade functionality. The schema supports level-based upgrades with proper currency tracking, stat calculations, and audit trails.

## Items Table Structure

**Table: Items** (lines 256-273)
```sql
CREATE TABLE Items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    item_type_id UUID NOT NULL,
    level INT NOT NULL DEFAULT 1 CHECK (level >= 1),  -- UPGRADE TARGET
    is_styled BOOLEAN NOT NULL DEFAULT FALSE,
    current_stats JSON,                                -- COMPUTED STATS
    material_combo_hash TEXT,
    generated_image_url TEXT,
    image_generation_status TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_items_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT fk_items_item_type FOREIGN KEY (item_type_id) REFERENCES ItemTypes(id) ON DELETE RESTRICT
);
```

**Key Upgrade Columns:**
- `level`: INT, starts at 1, no upper limit constraint
- `current_stats`: JSON field for computed final stats
- Constraint: `level >= 1` enforced at database level

## Currency System Structure

**DEPRECATED: Users.gold_balance** (lines 88-96)
```sql
CREATE TABLE Users (
    -- ...
    gold_balance INT NOT NULL DEFAULT 500, -- DEPRECATED: use UserCurrencyBalances
    -- ...
);
```

**ACTIVE: UserCurrencyBalances** (lines 117-127)
```sql
CREATE TABLE UserCurrencyBalances (
    user_id UUID NOT NULL,
    currency_code VARCHAR NOT NULL,
    balance INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, currency_code),
    CONSTRAINT fk_user_currency_balances_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_currency_balances_currency FOREIGN KEY (currency_code) REFERENCES Currencies(code) ON DELETE RESTRICT
);
```

**Currencies** (lines 105-114)
```sql
CREATE TABLE Currencies (
    code VARCHAR PRIMARY KEY CHECK (code IN ('GOLD', 'GEMS')),
    display_name VARCHAR NOT NULL,
    description TEXT,
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    icon_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Transaction Audit: EconomyTransactions** (lines 130-148)
```sql
CREATE TABLE EconomyTransactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    transaction_type VARCHAR NOT NULL CHECK (transaction_type IN ('source', 'sink')),
    currency VARCHAR NOT NULL CHECK (currency IN ('GOLD', 'GEMS')),
    amount INT NOT NULL,
    balance_after INT NOT NULL,
    source_type VARCHAR NOT NULL,
    source_id UUID,  -- Can reference Items.id for upgrades
    metadata JSONB,  -- Can store upgrade details (old_level, new_level)
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Vanity Level System

**Users.vanity_level** (lines 88-96)
```sql
CREATE TABLE Users (
    -- ...
    vanity_level INT NOT NULL DEFAULT 0,
    avg_item_level DECIMAL,  -- Computed field for vanity calculation
    CONSTRAINT positive_vanity_level CHECK (vanity_level >= 0)
);
```

**No automatic triggers found** - vanity_level calculation must be implemented in application code.

## Stat Calculation System

**ItemTypes Base Stats** (lines 233-253)
```sql
CREATE TABLE ItemTypes (
    -- ...
    base_stats_normalized JSON NOT NULL,  -- Sum must equal 1.0
    rarity rarity NOT NULL,
    -- ...
    CONSTRAINT check_base_stats_sum CHECK (
        (base_stats_normalized->>'atkPower')::numeric +
        (base_stats_normalized->>'atkAccuracy')::numeric +
        (base_stats_normalized->>'defPower')::numeric +
        (base_stats_normalized->>'defAccuracy')::numeric = 1.0
    )
);
```

**RarityDefinitions** (lines 193-202)
```sql
CREATE TABLE RarityDefinitions (
    rarity rarity PRIMARY KEY,
    stat_multiplier NUMERIC(6,3) NOT NULL CHECK (stat_multiplier > 0),
    -- ...
);
```

**Stat Calculation View** (lines 846-866)
```sql
CREATE OR REPLACE VIEW v_item_total_stats AS
SELECT
    i.id,
    -- Final stat formula: base_normalized × rarity_multiplier × level × 10
    (it.base_stats_normalized->>'atkPower')::numeric * rd.stat_multiplier * i.level * 10 AS atk_power,
    (it.base_stats_normalized->>'atkAccuracy')::numeric * rd.stat_multiplier * i.level * 10 AS atk_accuracy,
    (it.base_stats_normalized->>'defPower')::numeric * rd.stat_multiplier * i.level * 10 AS def_power,
    (it.base_stats_normalized->>'defAccuracy')::numeric * rd.stat_multiplier * i.level * 10 AS def_accuracy
FROM Items i
JOIN ItemTypes it ON i.item_type_id = it.id
JOIN RarityDefinitions rd ON it.rarity = rd.rarity;
```

## Item History Audit Trail

**ItemHistory** (lines 421-433)
```sql
CREATE TABLE ItemHistory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL,
    user_id UUID NOT NULL,
    event_type VARCHAR NOT NULL,  -- Can be 'upgrade'
    event_data JSONB,             -- Store old_level, new_level, cost
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_item_history_item FOREIGN KEY (item_id) REFERENCES Items(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_history_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);
```

## Equipment Integration

**UserEquipment** (lines 307-321)
```sql
CREATE TABLE UserEquipment (
    user_id UUID NOT NULL,
    slot_name VARCHAR NOT NULL,
    item_id UUID,  -- References Items.id
    equipped_at TIMESTAMP,
    PRIMARY KEY (user_id, slot_name),
    -- Foreign keys ensure referential integrity
);
```

**Player Stats Aggregation** (lines 869-886)
```sql
CREATE OR REPLACE VIEW v_player_equipped_stats AS
SELECT
    u.id AS player_id,
    COALESCE(SUM(vits.atk_power), 0) AS atk,
    COALESCE(SUM(vits.def_power), 0) AS def,
    COALESCE(SUM(vits.atk_power + vits.def_power), 0) AS hp,
    COALESCE(SUM(vits.atk_accuracy + vits.def_accuracy), 0) AS acc
FROM Users u
LEFT JOIN UserEquipment ue ON u.id = ue.user_id
LEFT JOIN v_item_total_stats vits ON ue.item_id = vits.id
GROUP BY u.id;
```

## Constraints and Validations

### Database-Level Constraints
1. **Level validation**: `level >= 1` (no upper limit)
2. **Currency balance**: `balance >= 0` (prevents negative balances)
3. **Vanity level**: `vanity_level >= 0`
4. **Base stats sum**: Must equal 1.0 in ItemTypes
5. **Transaction types**: Must be 'source' or 'sink'
6. **Currency codes**: Must be 'GOLD' or 'GEMS'

### Missing Constraints (Application-Level Required)
1. **Maximum item level**: No database constraint on level upper bound
2. **Upgrade cost calculation**: Must be implemented in business logic
3. **Vanity level calculation**: No triggers, requires manual computation
4. **Level-based unlock gates**: Not enforced at database level

## Indexes for Performance

**Relevant indexes for upgrade operations:**
```sql
CREATE INDEX idx_items_user_id_level ON Items(user_id, level DESC);
CREATE INDEX idx_user_currency_balances_user_id ON UserCurrencyBalances(user_id);
CREATE INDEX idx_economy_transactions_user_id_created_at ON EconomyTransactions(user_id, created_at DESC);
CREATE INDEX idx_item_history_item_id_created_at ON ItemHistory(item_id, created_at DESC);
```

## SQL Operations for Upgrade Endpoints

### 1. Check Item Ownership & Current Level
```sql
SELECT i.id, i.level, it.name, it.rarity
FROM Items i
JOIN ItemTypes it ON i.item_type_id = it.id
WHERE i.id = $1 AND i.user_id = $2;
```

### 2. Check Currency Balance
```sql
SELECT balance
FROM UserCurrencyBalances
WHERE user_id = $1 AND currency_code = 'GOLD';
```

### 3. Upgrade Transaction (Atomic)
```sql
BEGIN;

-- Deduct currency
UPDATE UserCurrencyBalances
SET balance = balance - $cost, updated_at = NOW()
WHERE user_id = $user_id AND currency_code = 'GOLD' AND balance >= $cost;

-- Upgrade item level
UPDATE Items
SET level = level + 1, current_stats = $new_stats
WHERE id = $item_id AND user_id = $user_id;

-- Record transaction
INSERT INTO EconomyTransactions (user_id, transaction_type, currency, amount, balance_after, source_type, source_id, metadata)
VALUES ($user_id, 'sink', 'GOLD', $cost, $new_balance, 'item_upgrade', $item_id, $metadata);

-- Record item history
INSERT INTO ItemHistory (item_id, user_id, event_type, event_data)
VALUES ($item_id, $user_id, 'upgrade', $event_data);

COMMIT;
```

### 4. Update Vanity Level (Separate Operation)
```sql
-- Calculate average item level for user
WITH user_avg AS (
  SELECT AVG(level) as avg_level
  FROM Items
  WHERE user_id = $user_id
)
UPDATE Users
SET avg_item_level = (SELECT avg_level FROM user_avg),
    vanity_level = FLOOR((SELECT avg_level FROM user_avg))
WHERE id = $user_id;
```

## Implementation Recommendations

1. **Use transactions** for atomic upgrade operations
2. **Leverage existing views** (`v_item_total_stats`) for stat calculations
3. **Always record** in `EconomyTransactions` and `ItemHistory` for audit trails
4. **Validate business rules** in application code (max level, unlock requirements)
5. **Update vanity level** separately after successful upgrades
6. **Check currency balance** before attempting deduction to provide user feedback
7. **Use prepared statements** with the existing indexes for optimal performance

## Related Documentation

- **Feature Spec**: `docs/feature-specs/F-05-item-upgrades.yaml`
- **API Contracts**: `docs/api-contracts.yaml` (upgrade endpoints)
- **System Design**: `docs/system-design.yaml` (stat calculation formulas)