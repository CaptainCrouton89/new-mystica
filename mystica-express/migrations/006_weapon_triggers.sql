-- Migration 006: Weapon Auto-Creation Triggers
-- Creates trigger to automatically create Weapons row when weapon item is created
-- Also includes helper functions for weapon validation and management

-- Function to auto-create weapon row when weapon item is inserted
CREATE OR REPLACE FUNCTION fn_auto_create_weapon()
RETURNS TRIGGER AS $$
DECLARE
    weapon_item_type RECORD;
BEGIN
    -- Check if this is a weapon item by looking up the item type
    SELECT it.category
    INTO weapon_item_type
    FROM ItemTypes it
    WHERE it.id = NEW.item_type_id;

    -- If this is a weapon item, create corresponding weapon row
    IF weapon_item_type.category = 'weapon' THEN
        INSERT INTO Weapons (
            item_id,
            pattern,
            spin_deg_per_s,
            deg_injure,
            deg_miss,
            deg_graze,
            deg_normal,
            deg_crit
        ) VALUES (
            NEW.id,
            'single_arc',  -- MVP0 default pattern
            360.0,         -- Default spin speed
            5.0,           -- Default degrees
            45.0,
            60.0,
            200.0,
            50.0
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create weapon rows
DROP TRIGGER IF EXISTS trigger_auto_create_weapon ON Items;
CREATE TRIGGER trigger_auto_create_weapon
    AFTER INSERT ON Items
    FOR EACH ROW
    EXECUTE FUNCTION fn_auto_create_weapon();

-- Function to validate weapon degree constraints
CREATE OR REPLACE FUNCTION fn_validate_weapon_degrees()
RETURNS TRIGGER AS $$
BEGIN
    -- Check that total degrees don't exceed 360
    IF (NEW.deg_injure + NEW.deg_miss + NEW.deg_graze + NEW.deg_normal + NEW.deg_crit) > 360.0 THEN
        RAISE EXCEPTION 'Total weapon degrees cannot exceed 360. Current total: %',
            (NEW.deg_injure + NEW.deg_miss + NEW.deg_graze + NEW.deg_normal + NEW.deg_crit);
    END IF;

    -- Check that all degrees are non-negative
    IF NEW.deg_injure < 0 OR NEW.deg_miss < 0 OR NEW.deg_graze < 0 OR
       NEW.deg_normal < 0 OR NEW.deg_crit < 0 THEN
        RAISE EXCEPTION 'All weapon degrees must be non-negative';
    END IF;

    -- Check that spin speed is positive
    IF NEW.spin_deg_per_s <= 0 THEN
        RAISE EXCEPTION 'Weapon spin speed must be greater than 0';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate weapon constraints on insert/update
DROP TRIGGER IF EXISTS trigger_validate_weapon_degrees ON Weapons;
CREATE TRIGGER trigger_validate_weapon_degrees
    BEFORE INSERT OR UPDATE ON Weapons
    FOR EACH ROW
    EXECUTE FUNCTION fn_validate_weapon_degrees();

-- Function to enforce MVP0 pattern constraints
CREATE OR REPLACE FUNCTION fn_validate_weapon_pattern()
RETURNS TRIGGER AS $$
BEGIN
    -- MVP0 constraint: Only single_arc pattern allowed
    IF NEW.pattern != 'single_arc' THEN
        RAISE EXCEPTION 'MVP0 only supports single_arc weapon pattern. Attempted: %', NEW.pattern;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate MVP0 pattern constraints
DROP TRIGGER IF EXISTS trigger_validate_weapon_pattern ON Weapons;
CREATE TRIGGER trigger_validate_weapon_pattern
    BEFORE INSERT OR UPDATE ON Weapons
    FOR EACH ROW
    EXECUTE FUNCTION fn_validate_weapon_pattern();

-- Function to cascade delete weapon when item is deleted
CREATE OR REPLACE FUNCTION fn_cascade_delete_weapon()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete weapon row if it exists (should be handled by FK cascade, but explicit is safer)
    DELETE FROM Weapons WHERE item_id = OLD.id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure weapon cleanup on item deletion
DROP TRIGGER IF EXISTS trigger_cascade_delete_weapon ON Items;
CREATE TRIGGER trigger_cascade_delete_weapon
    BEFORE DELETE ON Items
    FOR EACH ROW
    EXECUTE FUNCTION fn_cascade_delete_weapon();

-- Add comments for documentation
COMMENT ON FUNCTION fn_auto_create_weapon() IS 'Automatically creates Weapons row when weapon item is inserted';
COMMENT ON FUNCTION fn_validate_weapon_degrees() IS 'Validates weapon degree constraints (sum <= 360, non-negative, positive spin)';
COMMENT ON FUNCTION fn_validate_weapon_pattern() IS 'Enforces MVP0 constraint allowing only single_arc pattern';
COMMENT ON FUNCTION fn_cascade_delete_weapon() IS 'Ensures weapon rows are cleaned up when items are deleted';

COMMENT ON TRIGGER trigger_auto_create_weapon ON Items IS 'Auto-creates weapon row for weapon category items';
COMMENT ON TRIGGER trigger_validate_weapon_degrees ON Weapons IS 'Validates degree sum and constraints on weapon modifications';
COMMENT ON TRIGGER trigger_validate_weapon_pattern ON Weapons IS 'Enforces MVP0 single_arc pattern constraint';
COMMENT ON TRIGGER trigger_cascade_delete_weapon ON Items IS 'Cleans up weapon rows when items are deleted';