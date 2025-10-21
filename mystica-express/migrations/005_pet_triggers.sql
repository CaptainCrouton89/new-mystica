-- Migration: Pet Auto-Creation Triggers
-- Description: Creates triggers to automatically create Pet rows when pet items are created
-- Date: 2024-01-15

-- =======================
-- PET AUTO-CREATION TRIGGERS
-- =======================

-- Function: Create pet record when pet item is created
CREATE OR REPLACE FUNCTION fn_auto_create_pet()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create pet record if the item is of category 'pet'
    IF EXISTS (
        SELECT 1 FROM ItemTypes
        WHERE id = NEW.item_type_id
        AND category = 'pet'
    ) THEN
        -- Insert into Pets table with default values
        INSERT INTO Pets (
            item_id,
            personality_id,
            custom_name,
            chatter_history
        ) VALUES (
            NEW.id,
            NULL,  -- No personality assigned initially
            NULL,  -- No custom name initially
            NULL   -- No chatter history initially
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_auto_create_pet() IS 'Auto-creates Pet record when item with category=pet is created';

-- Trigger: Auto-create pet on item insert
DROP TRIGGER IF EXISTS trigger_auto_create_pet ON Items;
CREATE TRIGGER trigger_auto_create_pet
    AFTER INSERT ON Items
    FOR EACH ROW
    EXECUTE FUNCTION fn_auto_create_pet();

COMMENT ON TRIGGER trigger_auto_create_pet ON Items IS 'Automatically creates Pet record for items with category=pet';

-- =======================
-- PET VALIDATION FUNCTIONS
-- =======================

-- Function: Validate pet item category constraint
CREATE OR REPLACE FUNCTION fn_check_pet_item_category()
RETURNS TRIGGER AS $$
BEGIN
    -- Check that the item_id references an item with category='pet'
    IF NOT EXISTS (
        SELECT 1
        FROM Items i
        JOIN ItemTypes it ON i.item_type_id = it.id
        WHERE i.id = NEW.item_id
        AND it.category = 'pet'
    ) THEN
        RAISE EXCEPTION 'Item with ID % is not a pet category item', NEW.item_id
            USING ERRCODE = '23514',  -- check_violation
                  HINT = 'Only items with category=pet can have pet records';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_check_pet_item_category() IS 'Validates that pet item_id references a pet category item';

-- Trigger: Validate pet item category on insert/update
DROP TRIGGER IF EXISTS trigger_check_pet_item_category ON Pets;
CREATE TRIGGER trigger_check_pet_item_category
    BEFORE INSERT OR UPDATE OF item_id ON Pets
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_pet_item_category();

COMMENT ON TRIGGER trigger_check_pet_item_category ON Pets IS 'Validates pet item category constraint';

-- =======================
-- PET CHATTER HISTORY FUNCTIONS
-- =======================

-- Function: Add message to pet chatter history
CREATE OR REPLACE FUNCTION fn_add_pet_chatter_message(
    p_item_id UUID,
    p_message_text TEXT,
    p_message_type TEXT DEFAULT 'dialogue',
    p_max_messages INT DEFAULT 50
) RETURNS JSONB AS $$
DECLARE
    current_history JSONB;
    new_message JSONB;
    updated_history JSONB;
    message_count INT;
BEGIN
    -- Get current chatter history
    SELECT chatter_history INTO current_history
    FROM Pets
    WHERE item_id = p_item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pet with item_id % not found', p_item_id;
    END IF;

    -- Initialize empty array if null
    IF current_history IS NULL THEN
        current_history = '[]'::JSONB;
    END IF;

    -- Create new message object
    new_message = jsonb_build_object(
        'text', p_message_text,
        'type', p_message_type,
        'timestamp', EXTRACT(EPOCH FROM NOW())::BIGINT
    );

    -- Append new message
    updated_history = current_history || new_message;

    -- Get message count
    message_count = jsonb_array_length(updated_history);

    -- Truncate if exceeds max messages (keep most recent)
    IF message_count > p_max_messages THEN
        updated_history = jsonb_agg(value ORDER BY ordinality)
        FROM jsonb_array_elements(updated_history) WITH ORDINALITY
        WHERE ordinality > (message_count - p_max_messages);
    END IF;

    -- Update pet record
    UPDATE Pets
    SET chatter_history = updated_history
    WHERE item_id = p_item_id;

    RETURN updated_history;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_add_pet_chatter_message IS 'Adds message to pet chatter history with automatic truncation';

-- Function: Clear old chatter messages beyond size limit
CREATE OR REPLACE FUNCTION fn_truncate_pet_chatter_history(
    p_item_id UUID,
    p_max_size_kb INT DEFAULT 50
) RETURNS BOOLEAN AS $$
DECLARE
    current_history JSONB;
    history_size INT;
    max_size_bytes INT;
    truncated_history JSONB;
    message_count INT;
    keep_count INT;
BEGIN
    -- Convert KB to bytes
    max_size_bytes = p_max_size_kb * 1024;

    -- Get current history
    SELECT chatter_history INTO current_history
    FROM Pets
    WHERE item_id = p_item_id;

    IF NOT FOUND OR current_history IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check current size
    history_size = LENGTH(current_history::TEXT);

    IF history_size <= max_size_bytes THEN
        RETURN FALSE; -- No truncation needed
    END IF;

    -- Get message count
    message_count = jsonb_array_length(current_history);

    -- Start with half the messages and iteratively reduce
    keep_count = message_count / 2;

    WHILE keep_count > 0 LOOP
        -- Create truncated history (keep most recent messages)
        SELECT jsonb_agg(value ORDER BY ordinality)
        INTO truncated_history
        FROM jsonb_array_elements(current_history) WITH ORDINALITY
        WHERE ordinality > (message_count - keep_count);

        -- Check if truncated size is acceptable
        IF LENGTH(truncated_history::TEXT) <= max_size_bytes THEN
            EXIT;
        END IF;

        -- Reduce by 25%
        keep_count = keep_count * 3 / 4;
    END LOOP;

    -- Update with truncated history
    UPDATE Pets
    SET chatter_history = COALESCE(truncated_history, '[]'::JSONB)
    WHERE item_id = p_item_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_truncate_pet_chatter_history IS 'Truncates pet chatter history when it exceeds size limit';

-- =======================
-- PET CLEANUP FUNCTIONS
-- =======================

-- Function: Clean up orphaned pet records
CREATE OR REPLACE FUNCTION fn_cleanup_orphaned_pets()
RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    -- Delete pet records where the referenced item no longer exists
    -- or the item is no longer a pet category
    WITH orphaned_pets AS (
        DELETE FROM Pets p
        WHERE NOT EXISTS (
            SELECT 1
            FROM Items i
            JOIN ItemTypes it ON i.item_type_id = it.id
            WHERE i.id = p.item_id
            AND it.category = 'pet'
        )
        RETURNING p.item_id
    )
    SELECT COUNT(*) INTO deleted_count FROM orphaned_pets;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_cleanup_orphaned_pets IS 'Removes pet records for items that are no longer pets';

-- =======================
-- MAINTENANCE PROCEDURES
-- =======================

-- Function: Maintenance procedure for pet data
CREATE OR REPLACE FUNCTION fn_maintain_pet_data()
RETURNS TABLE (
    operation TEXT,
    affected_count INT,
    details TEXT
) AS $$
DECLARE
    truncated_count INT := 0;
    cleaned_count INT;
    pet_record RECORD;
BEGIN
    -- Clean up orphaned pets
    SELECT fn_cleanup_orphaned_pets() INTO cleaned_count;

    RETURN QUERY SELECT
        'cleanup_orphaned'::TEXT,
        cleaned_count,
        FORMAT('Removed %s orphaned pet records', cleaned_count);

    -- Truncate oversized chatter histories
    FOR pet_record IN
        SELECT item_id
        FROM Pets
        WHERE chatter_history IS NOT NULL
        AND LENGTH(chatter_history::TEXT) > 51200  -- 50KB
    LOOP
        IF fn_truncate_pet_chatter_history(pet_record.item_id, 50) THEN
            truncated_count := truncated_count + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT
        'truncate_chatter'::TEXT,
        truncated_count,
        FORMAT('Truncated chatter history for %s pets', truncated_count);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_maintain_pet_data IS 'Maintenance procedure for pet data cleanup and optimization';

-- =======================
-- INDEXES FOR PERFORMANCE
-- =======================

-- Index for personality lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pets_personality_id
ON Pets(personality_id)
WHERE personality_id IS NOT NULL;

-- Index for chatter history size checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pets_chatter_history_size
ON Pets(LENGTH(chatter_history::TEXT))
WHERE chatter_history IS NOT NULL;

-- =======================
-- MIGRATION COMPLETION
-- =======================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 005_pet_triggers.sql completed successfully';
    RAISE NOTICE 'Created triggers: trigger_auto_create_pet, trigger_check_pet_item_category';
    RAISE NOTICE 'Created functions: fn_auto_create_pet, fn_check_pet_item_category, fn_add_pet_chatter_message, fn_truncate_pet_chatter_history, fn_cleanup_orphaned_pets, fn_maintain_pet_data';
    RAISE NOTICE 'Created indexes: idx_pets_personality_id, idx_pets_chatter_history_size';
END $$;