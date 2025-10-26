# Database Migrations

This directory contains SQL migration files for the image generation pipeline.

## Running Migrations

### Via Supabase Dashboard
1. Go to https://supabase.com/dashboard/project/kofvwxutsmxdszycvluc
2. Navigate to SQL Editor
3. Copy and paste the migration file contents
4. Execute the query

### Via psql (Command Line)
```bash
# Set password
export PGPASSWORD="ZRT*ghb2cjk2bha5gmw"

# Run migration
psql -h db.kofvwxutsmxdszycvluc.supabase.co \
  -U postgres \
  -d postgres \
  -f migrations/add-image-url-to-materials.sql

psql -h db.kofvwxutsmxdszycvluc.supabase.co \
  -U postgres \
  -d postgres \
  -f migrations/add-image-url-to-enemytypes.sql
```

## Migration Files

| File | Description | Status |
|------|-------------|--------|
| `add-image-url-to-materials.sql` | Adds `image_url` column to `materials` table | Pending |
| `add-image-url-to-enemytypes.sql` | Adds `image_url` column to `enemytypes` table | Pending |

## Verification

After running migrations, verify with:

```sql
-- Check materials
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'materials' AND column_name = 'image_url';

-- Check enemytypes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'enemytypes' AND column_name = 'image_url';
```
