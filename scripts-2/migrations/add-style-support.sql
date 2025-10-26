-- Migration: Add style support to materials, itemtypes, and locations
-- Purpose: Enable multi-style asset generation and storage
-- Run this before using seed-generate.ts and seed-upload.ts

-- 1. Insert chibi style definition if not exists
INSERT INTO styledefinitions (display_name, spawn_rate, description, visual_modifier, style_name)
VALUES ('Chibi', 0.01, 'Cute anime chibi style with large eyes and small proportions', 'chibi_anime', 'chibi')
ON CONFLICT DO NOTHING;

-- 2. Add style_id and image_url columns to materials
-- Note: image_url is optional - client can construct URLs using convention
ALTER TABLE materials
ADD COLUMN IF NOT EXISTS style_id UUID REFERENCES styledefinitions(id),
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Set default style to 'Normal' (rubberhose) for existing materials
UPDATE materials
SET style_id = (SELECT id FROM styledefinitions WHERE style_name = 'normal')
WHERE style_id IS NULL;

-- 3. Add style_id column to itemtypes
-- itemtypes already has base_image_url column
ALTER TABLE itemtypes
ADD COLUMN IF NOT EXISTS style_id UUID REFERENCES styledefinitions(id);

-- Set default style to 'Normal' (rubberhose) for existing items
UPDATE itemtypes
SET style_id = (SELECT id FROM styledefinitions WHERE style_name = 'normal')
WHERE style_id IS NULL;

-- 4. Add style_id column to locations
-- locations already has image_url column
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS style_id UUID REFERENCES styledefinitions(id);

-- Set default style to 'Normal' (rubberhose) for existing locations
UPDATE locations
SET style_id = (SELECT id FROM styledefinitions WHERE style_name = 'normal')
WHERE style_id IS NULL;

-- 5. Get the chibi style_id for reference
DO $$
DECLARE
  chibi_id UUID;
BEGIN
  SELECT id INTO chibi_id FROM styledefinitions WHERE style_name = 'chibi';
  RAISE NOTICE 'Chibi style_id: %', chibi_id;
  RAISE NOTICE 'Update seed-config.ts with this UUID for PLACEHOLDER_CHIBI_STYLE_ID';
END $$;

-- Verification queries
SELECT 'Materials with style_id' AS check_name, COUNT(*) AS count FROM materials WHERE style_id IS NOT NULL;
SELECT 'ItemTypes with style_id' AS check_name, COUNT(*) AS count FROM itemtypes WHERE style_id IS NOT NULL;
SELECT 'Locations with style_id' AS check_name, COUNT(*) AS count FROM locations WHERE style_id IS NOT NULL;
SELECT 'Style Definitions' AS check_name, display_name, style_name, id FROM styledefinitions ORDER BY display_name;
