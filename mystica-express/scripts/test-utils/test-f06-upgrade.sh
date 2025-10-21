#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(dirname "$0")"

# Load admin credentials
if [ -f "$SCRIPT_DIR/.env.test" ]; then
  source "$SCRIPT_DIR/.env.test"
else
  echo -e "${RED}✗ Admin account not found. Run create-admin-account.sh first.${NC}"
  exit 1
fi

echo -e "${BLUE}=== Testing F-06: Item Upgrade System ===${NC}"
echo "User ID: $ADMIN_USER_ID"
echo "API: $API_BASE_URL"
echo ""

# Get first item owned by user
echo -e "${YELLOW}[1/5] Fetching user's inventory...${NC}"
INVENTORY_RESPONSE=$(curl -s -X GET "$API_BASE_URL/inventory" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN")

ITEM_ID=$(echo "$INVENTORY_RESPONSE" | jq -r '.items[0].id // empty')

if [ -z "$ITEM_ID" ] || [ "$ITEM_ID" == "null" ]; then
  echo -e "${RED}✗ No items found. Run seed-test-data.sh first.${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Found item: $ITEM_ID${NC}"
echo ""

# Get item details
echo -e "${YELLOW}[2/5] Getting item details...${NC}"
ITEM_RESPONSE=$(curl -s -X GET "$API_BASE_URL/items/$ITEM_ID" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN")

echo "$ITEM_RESPONSE" | jq '.'
CURRENT_LEVEL=$(echo "$ITEM_RESPONSE" | jq -r '.level // 1')
echo -e "${GREEN}✓ Current level: $CURRENT_LEVEL${NC}"
echo ""

# Get upgrade cost
echo -e "${YELLOW}[3/5] Checking upgrade cost...${NC}"
COST_RESPONSE=$(curl -s -X GET "$API_BASE_URL/items/$ITEM_ID/upgrade-cost" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN")

echo "$COST_RESPONSE" | jq '.'

GOLD_COST=$(echo "$COST_RESPONSE" | jq -r '.gold_cost // 0')
CAN_AFFORD=$(echo "$COST_RESPONSE" | jq -r '.can_afford // false')

if [ "$CAN_AFFORD" != "true" ]; then
  echo -e "${RED}✗ Cannot afford upgrade (need $GOLD_COST gold)${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Can afford upgrade: $GOLD_COST gold${NC}"
echo ""

# Perform upgrade
echo -e "${YELLOW}[4/5] Upgrading item...${NC}"
UPGRADE_RESPONSE=$(curl -s -X POST "$API_BASE_URL/items/$ITEM_ID/upgrade" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json")

echo "$UPGRADE_RESPONSE" | jq '.'

SUCCESS=$(echo "$UPGRADE_RESPONSE" | jq -r '.success // false')
NEW_LEVEL=$(echo "$UPGRADE_RESPONSE" | jq -r '.new_level // 0')

if [ "$SUCCESS" != "true" ]; then
  echo -e "${RED}✗ Upgrade failed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Item upgraded to level $NEW_LEVEL${NC}"
echo ""

# Verify upgrade
echo -e "${YELLOW}[5/5] Verifying upgrade...${NC}"
VERIFY_RESPONSE=$(curl -s -X GET "$API_BASE_URL/items/$ITEM_ID" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN")

VERIFIED_LEVEL=$(echo "$VERIFY_RESPONSE" | jq -r '.level // 0')

if [ "$VERIFIED_LEVEL" -eq "$NEW_LEVEL" ]; then
  echo -e "${GREEN}✓ Upgrade verified: Level $VERIFIED_LEVEL${NC}"
else
  echo -e "${RED}✗ Verification failed: Expected $NEW_LEVEL, got $VERIFIED_LEVEL${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}=== F-06 Test Passed ===${NC}"
echo "Summary:"
echo "  - Initial level: $CURRENT_LEVEL"
echo "  - Upgrade cost: $GOLD_COST gold"
echo "  - Final level: $VERIFIED_LEVEL"
