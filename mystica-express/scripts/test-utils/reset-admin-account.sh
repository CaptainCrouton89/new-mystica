#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(dirname "$0")"

echo -e "${YELLOW}=== Resetting Admin Account ===${NC}"
echo ""

# Delete existing account
echo -e "${YELLOW}Step 1: Deleting existing account...${NC}"
bash "$SCRIPT_DIR/delete-admin-account.sh"
echo ""

# Wait a moment for deletion to propagate
sleep 2

# Create new account
echo -e "${YELLOW}Step 2: Creating fresh account...${NC}"
bash "$SCRIPT_DIR/create-admin-account.sh"
echo ""

# Seed data
echo -e "${YELLOW}Step 3: Seeding test data...${NC}"
bash "$SCRIPT_DIR/seed-test-data.sh"
echo ""

echo -e "${GREEN}=== Admin Account Reset Complete ===${NC}"
