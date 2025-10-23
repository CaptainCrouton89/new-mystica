-- Migration: Fix Item Categories and Add Equipment Slot Constraint
-- Ensures all ItemTypes have correct categories that map to valid equipment slots

-- First, let's see what categories exist (for documentation)
-- Valid categories: weapon, offhand, head, armor, feet, accessory, pet

-- Fix any incorrect categories based on item names
-- These updates ensure category matches the intended equipment slot

-- Weapons: should have category 'weapon'
UPDATE ItemTypes
SET category = 'weapon'
WHERE name ILIKE '%sword%'
   OR name ILIKE '%staff%'
   OR name ILIKE '%bow%'
   OR name ILIKE '%wand%'
   OR name ILIKE '%axe%'
   OR name ILIKE '%mace%'
   OR name ILIKE '%dagger%'
AND category != 'weapon';

-- Offhand: should have category 'offhand'
UPDATE ItemTypes
SET category = 'offhand'
WHERE (name ILIKE '%shield%' OR name ILIKE '%tome%')
AND category != 'offhand';

-- Head: should have category 'head'
UPDATE ItemTypes
SET category = 'head'
WHERE (name ILIKE '%helm%' OR name ILIKE '%crown%' OR name ILIKE '%hat%' OR name ILIKE '%cap%')
AND category != 'head';

-- Armor: should have category 'armor'
UPDATE ItemTypes
SET category = 'armor'
WHERE (name ILIKE '%armor%' OR name ILIKE '%chestplate%' OR name ILIKE '%robe%' OR name ILIKE '%chainmail%' OR name ILIKE '%tunic%')
AND category != 'armor';

-- Feet: should have category 'feet'
UPDATE ItemTypes
SET category = 'feet'
WHERE (name ILIKE '%boot%' OR name ILIKE '%sandal%' OR name ILIKE '%shoe%' OR name ILIKE '%greaves%')
AND category != 'feet';

-- Accessories: should have category 'accessory'
UPDATE ItemTypes
SET category = 'accessory'
WHERE (name ILIKE '%ring%' OR name ILIKE '%amulet%' OR name ILIKE '%bracelet%' OR name ILIKE '%necklace%' OR name ILIKE '%pendant%')
AND category != 'accessory';

-- Pets: should have category 'pet'
UPDATE ItemTypes
SET category = 'pet'
WHERE (name ILIKE '%pet%' OR name ILIKE '%companion%' OR name ILIKE '%familiar%')
AND category != 'pet';

-- Add a CHECK constraint to ensure only valid categories can be inserted
-- This prevents future data integrity issues
ALTER TABLE ItemTypes
DROP CONSTRAINT IF EXISTS valid_category_constraint;

ALTER TABLE ItemTypes
ADD CONSTRAINT valid_category_constraint
CHECK (category IN ('weapon', 'offhand', 'head', 'armor', 'feet', 'accessory', 'pet'));

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT valid_category_constraint ON ItemTypes IS
'Ensures item category maps to a valid equipment slot. Categories must match equipment slots defined in the system.';

-- Log the results
DO $$
DECLARE
  weapon_count INT;
  offhand_count INT;
  head_count INT;
  armor_count INT;
  feet_count INT;
  accessory_count INT;
  pet_count INT;
BEGIN
  SELECT COUNT(*) INTO weapon_count FROM ItemTypes WHERE category = 'weapon';
  SELECT COUNT(*) INTO offhand_count FROM ItemTypes WHERE category = 'offhand';
  SELECT COUNT(*) INTO head_count FROM ItemTypes WHERE category = 'head';
  SELECT COUNT(*) INTO armor_count FROM ItemTypes WHERE category = 'armor';
  SELECT COUNT(*) INTO feet_count FROM ItemTypes WHERE category = 'feet';
  SELECT COUNT(*) INTO accessory_count FROM ItemTypes WHERE category = 'accessory';
  SELECT COUNT(*) INTO pet_count FROM ItemTypes WHERE category = 'pet';

  RAISE NOTICE 'Category distribution after migration:';
  RAISE NOTICE '  weapon: %', weapon_count;
  RAISE NOTICE '  offhand: %', offhand_count;
  RAISE NOTICE '  head: %', head_count;
  RAISE NOTICE '  armor: %', armor_count;
  RAISE NOTICE '  feet: %', feet_count;
  RAISE NOTICE '  accessory: %', accessory_count;
  RAISE NOTICE '  pet: %', pet_count;
END $$;
