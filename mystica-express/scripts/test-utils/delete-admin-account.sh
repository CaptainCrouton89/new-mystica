#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
ADMIN_EMAIL="${ADMIN_EMAIL:-thelabcook@protonmail.com}"

# Load Supabase credentials from environment
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  if [ -f "$(dirname "$0")/../../.env" ]; then
    export $(grep -v '^#' "$(dirname "$0")/../../.env" | xargs)
  elif [ -f "$(dirname "$0")/../../.env.local" ]; then
    export $(grep -v '^#' "$(dirname "$0")/../../.env.local" | xargs)
  else
    echo -e "${RED}✗ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY${NC}"
    echo "Set these in .env or .env.local"
    exit 1
  fi
fi

echo -e "${YELLOW}=== Deleting Admin Account ===${NC}"
echo "Email: $ADMIN_EMAIL"
echo ""

# Get user by email using Supabase Auth Admin API
echo -e "${YELLOW}[1/2] Finding user...${NC}"
USER_RESPONSE=$(curl -s -X GET "$SUPABASE_URL/auth/v1/admin/users" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY")

USER_ID=$(echo "$USER_RESPONSE" | jq -r ".users[] | select(.email == \"$ADMIN_EMAIL\") | .id")

if [ -z "$USER_ID" ] || [ "$USER_ID" == "null" ]; then
  echo -e "${YELLOW}⚠ User not found (may already be deleted)${NC}"
  exit 0
fi

echo "Found user: $USER_ID"
echo ""

# Delete user using Supabase Auth Admin API
echo -e "${YELLOW}[2/2] Deleting user...${NC}"
DELETE_RESPONSE=$(curl -s -X DELETE "$SUPABASE_URL/auth/v1/admin/users/$USER_ID" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY")

if echo "$DELETE_RESPONSE" | grep -q "error"; then
  echo -e "${RED}✗ Failed to delete user${NC}"
  echo "Response: $DELETE_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ User deleted successfully${NC}"
echo ""

# Clean up credentials file
if [ -f "$(dirname "$0")/.env.test" ]; then
  rm "$(dirname "$0")/.env.test"
  echo -e "${GREEN}✓ Cleaned up .env.test${NC}"
fi

echo -e "${GREEN}=== Account Deletion Complete ===${NC}"
