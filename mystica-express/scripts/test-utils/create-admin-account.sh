#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Parse options
SEED_ITEMS=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --seed-items)
      SEED_ITEMS=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# Configuration
ADMIN_EMAIL="${ADMIN_EMAIL:-thelabcook@protonmail.com}"
ADMIN_SITE_PWD="${ADMIN_SITE_PWD:-q1jV2445xLvUQ4aXQ}"
API_BASE_URL="${API_BASE_URL:-http://localhost:3000/api/v1}"

echo -e "${YELLOW}=== Creating Admin Account ===${NC}"
echo "Email: $ADMIN_EMAIL"
echo "API: $API_BASE_URL"
echo ""

# Load environment for service role key
if [ -f ".env.local" ]; then
  source .env.local
fi

# Register account using Supabase Admin API with auto-confirm
echo -e "${YELLOW}[1/3] Registering account with auto-confirm...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "https://kofvwxutsmxdszycvluc.supabase.co/auth/v1/admin/users" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_SITE_PWD\",
    \"email_confirm\": true
  }")

echo "Response: $REGISTER_RESPONSE"

# Extract user_id from response
USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.id // empty')

if [ -z "$USER_ID" ] || [ "$USER_ID" == "null" ]; then
  echo -e "${RED}✗ Failed to register account${NC}"

  # Check if account already exists
  if echo "$REGISTER_RESPONSE" | grep -q "already registered\|already exists\|email_exists\|User already registered"; then
    echo -e "${YELLOW}⚠ Account already exists${NC}"
  else
    echo "Error: $REGISTER_RESPONSE"
    exit 1
  fi
else
  echo -e "${GREEN}✓ Account created successfully (email auto-confirmed)${NC}"
fi

# Login to get access token
echo -e "${YELLOW}Logging in to get access token...${NC}"
sleep 2  # Brief pause to ensure user is fully created

LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_SITE_PWD\"
  }")

if [ -z "$USER_ID" ]; then
  USER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.user.id // empty')
fi
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.session.access_token // empty')

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" == "null" ]; then
  echo -e "${RED}✗ Failed to login${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Logged in successfully${NC}"
echo "User ID: $USER_ID"
echo ""

# Initialize profile
echo -e "${YELLOW}[2/3] Initializing profile...${NC}"
PROFILE_RESPONSE=$(curl -s -X POST "$API_BASE_URL/profile/init" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response: $PROFILE_RESPONSE"

# Check if profile init was successful or already exists
if echo "$PROFILE_RESPONSE" | grep -q "error"; then
  if echo "$PROFILE_RESPONSE" | grep -q "already exists\|already initialized"; then
    echo -e "${YELLOW}⚠ Profile already initialized${NC}"
  elif echo "$PROFILE_RESPONSE" | grep -q "NOT_IMPLEMENTED"; then
    echo -e "${YELLOW}⚠ ProfileService not implemented yet - skipping${NC}"
  else
    echo -e "${RED}✗ Failed to initialize profile${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}✓ Profile initialized${NC}"
fi

echo ""

# Save credentials to .env.test
echo -e "${YELLOW}[3/3] Saving credentials...${NC}"
cat > "$(dirname "$0")/.env.test" <<EOF
# Test Admin Account
ADMIN_USER_ID=$USER_ID
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_SITE_PWD
ADMIN_ACCESS_TOKEN=$ACCESS_TOKEN
API_BASE_URL=$API_BASE_URL

# Usage in scripts:
# source \$(dirname "\$0")/.env.test
EOF

echo -e "${GREEN}✓ Credentials saved to scripts/test-utils/.env.test${NC}"
echo ""
echo -e "${GREEN}=== Account Creation Complete ===${NC}"
echo "User ID: $USER_ID"
echo "Access Token: ${ACCESS_TOKEN:0:20}..."
echo ""

# Seed items if requested
if [ "$SEED_ITEMS" = true ]; then
  echo -e "${YELLOW}=== Seeding Test Data ===${NC}"
  SCRIPT_DIR="$(dirname "$0")"
  bash "$SCRIPT_DIR/seed-test-data.sh"
fi
