#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(dirname "$0")"

# Load admin credentials
if [ -f "$SCRIPT_DIR/.env.test" ]; then
  source "$SCRIPT_DIR/.env.test"
else
  echo -e "${RED}✗ Admin account not found. Run create-admin-account.sh first.${NC}"
  exit 1
fi

# Load Supabase connection details
if [ -z "$SUPABASE_URL" ]; then
  if [ -f "$SCRIPT_DIR/../../.env" ]; then
    set -a
    source "$SCRIPT_DIR/../../.env"
    set +a
  elif [ -f "$SCRIPT_DIR/../../.env.local" ]; then
    set -a
    source "$SCRIPT_DIR/../../.env.local"
    set +a
  fi
fi

# Extract database connection details from SUPABASE_URL
DB_HOST=$(echo "$SUPABASE_URL" | sed -E 's|https?://([^/]+).*|\1|')
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"

# Check if we have password (needed for direct psql)
if [ -z "$DB_PASSWORD" ]; then
  # Try to get from service role key (not ideal, but works for local dev)
  echo -e "${YELLOW}⚠ DB_PASSWORD not set. Using Supabase API for data seeding.${NC}"
  USE_API=true
else
  USE_API=false
fi

echo -e "${YELLOW}=== Seeding Test Data ===${NC}"
echo "User ID: $ADMIN_USER_ID"
echo ""

# Create SQL seed script with placeholder
SEED_SQL_TEMPLATE=$(cat <<'EOSQL'
-- Seed Test Data for Admin Account
-- User ID: USER_ID_PLACEHOLDER

BEGIN;

-- 1. Set up currency balance (5000 gold to start)
INSERT INTO UserCurrencyBalances (user_id, currency_code, balance)
VALUES ('USER_ID_PLACEHOLDER', 'GOLD', 5000)
ON CONFLICT (user_id, currency_code)
DO UPDATE SET balance = 5000;

-- 2. Create 6 starter items (one for each main slot)
-- Get item type IDs for basic items
WITH item_types AS (
  SELECT id, name, category, base_stats
  FROM ItemTypes
  WHERE name IN ('Basic Sword', 'Wooden Shield', 'Leather Cap', 'Cloth Armor', 'Leather Boots', 'Jade Ring')
  LIMIT 6
)
INSERT INTO Items (user_id, item_type_id, level, is_styled, current_stats)
SELECT
  'USER_ID_PLACEHOLDER'::uuid,
  it.id,
  1 as level,
  false as is_styled,
  jsonb_build_object(
    'atkPower', (it.base_stats->>'atkPower')::numeric * 10,
    'atkAccuracy', (it.base_stats->>'atkAccuracy')::numeric * 10,
    'defPower', (it.base_stats->>'defPower')::numeric * 10,
    'defAccuracy', (it.base_stats->>'defAccuracy')::numeric * 10
  ) as current_stats
FROM item_types it
ON CONFLICT DO NOTHING;

-- 3. Give user some basic materials (5 of each common material)
INSERT INTO MaterialStacks (user_id, material_id, style_id, quantity)
SELECT
  'USER_ID_PLACEHOLDER'::uuid,
  m.id,
  'normal'::text,
  5 as quantity
FROM Materials m
WHERE m.id IN ('iron', 'wood', 'leather', 'crystal', 'flame')
ON CONFLICT (user_id, material_id, style_id)
DO UPDATE SET quantity = MaterialStacks.quantity + 5;

-- 4. Initialize UserEquipment slots (all empty for now)
INSERT INTO UserEquipment (user_id, slot)
SELECT 'USER_ID_PLACEHOLDER'::uuid, slot
FROM (VALUES
  ('weapon'),
  ('offhand'),
  ('head'),
  ('armor'),
  ('feet'),
  ('accessory_1'),
  ('accessory_2'),
  ('pet')
) AS slots(slot)
ON CONFLICT (user_id, slot) DO NOTHING;

-- 5. Update user's vanity level (should be 0 with no equipped items)
UPDATE Users
SET vanity_level = 0,
    avg_item_level = 1.0
WHERE id = 'USER_ID_PLACEHOLDER';

COMMIT;

-- Display summary
SELECT
  'Gold Balance' as item,
  balance::text as value
FROM UserCurrencyBalances
WHERE user_id = 'USER_ID_PLACEHOLDER' AND currency_code = 'GOLD'
UNION ALL
SELECT
  'Items Owned' as item,
  COUNT(*)::text as value
FROM Items
WHERE user_id = 'USER_ID_PLACEHOLDER'
UNION ALL
SELECT
  'Material Stacks' as item,
  COUNT(*)::text as value
FROM MaterialStacks
WHERE user_id = 'USER_ID_PLACEHOLDER';
EOSQL
)

# Replace placeholder with actual user ID
SEED_SQL="${SEED_SQL_TEMPLATE//USER_ID_PLACEHOLDER/$ADMIN_USER_ID}"

# Execute SQL based on available connection method
if [ "$USE_API" = true ]; then
  echo -e "${YELLOW}[1/1] Seeding via Supabase API...${NC}"

  # For API seeding, we need to break it into smaller operations
  # This is a simplified version - full implementation would use the API endpoints
  echo -e "${RED}✗ API-based seeding not yet implemented${NC}"
  echo "Please set DB_PASSWORD to use direct psql seeding"
  exit 1
else
  echo -e "${YELLOW}[1/1] Seeding via direct database connection...${NC}"

  # Use psql to execute seed script
  echo "$SEED_SQL" | PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -q

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Data seeded successfully${NC}"
  else
    echo -e "${RED}✗ Failed to seed data${NC}"
    exit 1
  fi
fi

echo ""
echo -e "${GREEN}=== Test Data Seeded ===${NC}"
echo "Summary:"
echo "  - 5000 gold"
echo "  - 6 level-1 items"
echo "  - 5 stacks of common materials (5 each)"
echo "  - 8 equipment slots initialized"
