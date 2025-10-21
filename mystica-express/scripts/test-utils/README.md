# Test Utilities

Bash scripts for managing test accounts and validating backend functionality.

## Prerequisites

```bash
# Required
- jq (JSON processor): brew install jq
- curl (usually pre-installed)
- bash 4+ (macOS default works)

# Environment variables in .env or .env.local
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
API_BASE_URL=http://localhost:3000/api/v1  # Optional, defaults to localhost

# Optional (for direct DB seeding)
DB_PASSWORD=...  # Your Supabase database password
```

## Quick Start

### 1. Create Admin Account

```bash
# Basic creation
./scripts/test-utils/create-admin-account.sh

# With automatic data seeding
./scripts/test-utils/create-admin-account.sh --seed-items

# Custom credentials
ADMIN_EMAIL=test@example.com ADMIN_SITE_PWD=mypassword \
  ./scripts/test-utils/create-admin-account.sh
```

**What it does:**
- Registers account via `/auth/register` endpoint
- Initializes profile via `/profile/init` endpoint
- Saves credentials to `.env.test`
- Optionally seeds test data (with `--seed-items`)

**Output:**
```
=== Account Creation Complete ===
User ID: 123e4567-e89b-12d3-a456-426614174000
Access Token: eyJhbGciOiJIUzI1NiIs...
Credentials saved to scripts/test-utils/.env.test
```

---

### 2. Seed Test Data

```bash
./scripts/test-utils/seed-test-data.sh
```

**What it creates:**
- **5000 gold** in UserCurrencyBalances
- **6 level-1 items** (one for each main equipment slot)
- **5 stacks of materials** (iron, wood, leather, crystal, flame - 5 each)
- **8 equipment slots** initialized (all empty)
- **Vanity level** set to 0

**Requirements:**
- Admin account must exist (run `create-admin-account.sh` first)
- Database connection (via `DB_PASSWORD` or Supabase API)

---

### 3. Delete Admin Account

```bash
./scripts/test-utils/delete-admin-account.sh

# Custom email
ADMIN_EMAIL=test@example.com ./scripts/test-utils/delete-admin-account.sh
```

**What it does:**
- Finds user by email using Supabase Auth Admin API
- Deletes user and all associated data (CASCADE)
- Cleans up `.env.test` file

**Note:** Requires `SUPABASE_SERVICE_ROLE_KEY` in environment.

---

### 4. Reset Admin Account

```bash
./scripts/test-utils/reset-admin-account.sh
```

**What it does:**
1. Deletes existing account
2. Waits 2 seconds for propagation
3. Creates fresh account
4. Seeds test data

**Use case:** Quick reset between test runs.

---

### 5. Test F-06 Item Upgrade

```bash
./scripts/test-utils/test-f06-upgrade.sh
```

**What it tests:**
1. Fetches user's inventory
2. Gets first item details
3. Checks upgrade cost (`GET /items/:id/upgrade-cost`)
4. Performs upgrade (`POST /items/:id/upgrade`)
5. Verifies new level

**Expected output:**
```
=== F-06 Test Passed ===
Summary:
  - Initial level: 1
  - Upgrade cost: 100 gold
  - Final level: 2
```

**Requirements:**
- Admin account with items (run with `--seed-items` or `seed-test-data.sh`)
- Backend server running on `http://localhost:3000`

---

## Workflows

### Full Setup from Scratch

```bash
# Start backend
cd mystica-express
pnpm dev

# In another terminal
cd mystica-express
./scripts/test-utils/create-admin-account.sh --seed-items
./scripts/test-utils/test-f06-upgrade.sh
```

---

### Reset Between Tests

```bash
./scripts/test-utils/reset-admin-account.sh
./scripts/test-utils/test-f06-upgrade.sh
```

---

### Manual Testing with Saved Credentials

```bash
# Load credentials
source ./scripts/test-utils/.env.test

# Use in curl
curl -X GET "$API_BASE_URL/inventory" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN"

# Or use variables in other scripts
echo "User ID: $ADMIN_USER_ID"
```

---

## Files Created

### `.env.test`
Temporary file storing admin credentials:
```bash
ADMIN_USER_ID=123e4567-e89b-12d3-a456-426614174000
ADMIN_EMAIL=thelabcook@protonmail.com
ADMIN_PASSWORD=q1jV2445xLvUQ4aXQ
ADMIN_ACCESS_TOKEN=eyJhbGci...
API_BASE_URL=http://localhost:3000/api/v1
```

**Location:** `scripts/test-utils/.env.test`
**Lifecycle:** Created by `create-admin-account.sh`, deleted by `delete-admin-account.sh`
**Git:** Ignored (already in `.gitignore`)

---

## Environment Variables

### Required
| Variable | Source | Purpose |
|----------|--------|---------|
| `SUPABASE_URL` | `.env` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` | Admin API access (for deletion) |

### Optional
| Variable | Default | Purpose |
|----------|---------|---------|
| `ADMIN_EMAIL` | `thelabcook@protonmail.com` | Test account email |
| `ADMIN_SITE_PWD` | `q1jV2445xLvUQ4aXQ` | Test account password |
| `API_BASE_URL` | `http://localhost:3000/api/v1` | Backend API endpoint |
| `DB_PASSWORD` | - | Direct database access (for seeding) |

---

## Troubleshooting

### "User not found" when creating account
- Account may already exist. Run `delete-admin-account.sh` first, or:
```bash
./scripts/test-utils/reset-admin-account.sh
```

### "Cannot afford upgrade"
- Run seeding script:
```bash
./scripts/test-utils/seed-test-data.sh
```

### "Connection refused" errors
- Ensure backend is running:
```bash
cd mystica-express && pnpm dev
```

### "DB_PASSWORD not set" when seeding
- Option 1: Set in `.env`:
  ```bash
  DB_PASSWORD=your_db_password
  ```
- Option 2: Get from Supabase dashboard → Database → Connection string

### jq command not found
```bash
brew install jq
```

---

## Advanced Usage

### Custom API Endpoint

```bash
API_BASE_URL=https://staging-api.mystica.app/api/v1 \
  ./scripts/test-utils/create-admin-account.sh
```

### Multiple Test Accounts

```bash
ADMIN_EMAIL=test1@example.com ./scripts/test-utils/create-admin-account.sh
ADMIN_EMAIL=test2@example.com ./scripts/test-utils/create-admin-account.sh
```

**Note:** `.env.test` will be overwritten. Save tokens manually if needed.

### Direct SQL Seeding (Faster)

```bash
# Set database password first
export DB_PASSWORD=your_password

# Then seed will use direct psql connection
./scripts/test-utils/seed-test-data.sh
```

---

## Script Dependencies

```
create-admin-account.sh
  └─ (optional) seed-test-data.sh

reset-admin-account.sh
  ├─ delete-admin-account.sh
  ├─ create-admin-account.sh
  └─ seed-test-data.sh

test-f06-upgrade.sh
  └─ requires .env.test (from create-admin-account.sh)
```

---

## Security Notes

⚠️ **These scripts are for LOCAL TESTING ONLY**

- Never commit `.env.test` (already gitignored)
- Never use admin credentials in production
- Service role key has full database access - keep secure
- Default password `q1jV2445xLvUQ4aXQ` is intentionally weak for testing

---

## Examples

### Complete F-06 Validation Workflow

```bash
#!/bin/bash
# Full F-06 test suite

# 1. Reset environment
./scripts/test-utils/reset-admin-account.sh

# 2. Verify initial state
source ./scripts/test-utils/.env.test
curl "$API_BASE_URL/inventory" -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" | jq '.'

# 3. Run upgrade test
./scripts/test-utils/test-f06-upgrade.sh

# 4. Verify multiple upgrades
for i in {1..5}; do
  echo "=== Upgrade $i ==="
  ./scripts/test-utils/test-f06-upgrade.sh
done

# 5. Check final state
curl "$API_BASE_URL/profile" -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" | jq '.'
```

---

## Future Enhancements

- [ ] Support API-based seeding (no DB password required)
- [ ] Add test scripts for other features (F-04, F-02, etc.)
- [ ] Generate test reports with timestamps
- [ ] Support for multiple concurrent test accounts
- [ ] Automated cleanup (delete accounts older than X days)

---

**Created:** 2025-01-21
**Last Updated:** 2025-01-21
**Maintainer:** Development Team
