# Database Migrations

This directory contains SQL migration files for the New Mystica backend.

## Applying Migrations

### Option 1: Using psql (Recommended)

```bash
# Load environment variables
source .env.local

# Apply migration
psql "$SUPABASE_URL" -c "$(cat migrations/002_profile_init_function.sql)"
```

### Option 2: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `002_profile_init_function.sql`
4. Execute the query

### Option 3: Using supabase CLI (if project is linked)

```bash
# If you have a linked project
supabase db push

# Or reset and apply all migrations
supabase db reset
```

## Migration Status

- ✅ `001_initial_schema.sql` - Applied (core schema)
- ❌ `002_profile_init_function.sql` - **Needs to be applied**

## Migration: 002_profile_init_function.sql

This migration adds the `init_profile()` stored procedure that:

1. Creates a new user profile with default values
2. Sets up initial currency balances (0 gold, 0 gems)
3. Creates one random common weapon for the starter inventory
4. Initializes empty equipment slots (8 slots total)
5. Ensures idempotency (prevents duplicate profiles)

**Required before using POST /api/v1/profile/init endpoint.**