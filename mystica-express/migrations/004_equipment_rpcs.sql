-- Migration: Equipment RPC Functions
-- Date: 2025-01-21
-- Description: Adds RPC functions for atomic equipment operations
--              Based on requirements from repository-implementation-guide.md:198-205

-- =============================================
-- RPC FUNCTIONS FOR EQUIPMENT OPERATIONS
-- =============================================

-- Function: Equip item with validation and stat recalculation
CREATE OR REPLACE FUNCTION equip_item(
    p_user_id UUID,
    p_item_id UUID,
    p_slot_name VARCHAR
) RETURNS JSON AS $$
DECLARE
    v_item_category VARCHAR;
    v_allowed_categories VARCHAR[];
    v_result JSON;
BEGIN
    -- Validate slot name
    IF p_slot_name NOT IN ('weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet') THEN
        RAISE EXCEPTION 'Invalid slot name: %. Must be one of: weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet', p_slot_name;
    END IF;

    -- Get item category and verify ownership
    SELECT it.category INTO v_item_category
    FROM Items i
    JOIN ItemTypes it ON i.item_type_id = it.id
    WHERE i.id = p_item_id AND i.user_id = p_user_id;

    IF v_item_category IS NULL THEN
        RAISE EXCEPTION 'Item % not found or not owned by user %', p_item_id, p_user_id;
    END IF;

    -- Define allowed categories for each slot
    CASE p_slot_name
        WHEN 'weapon' THEN v_allowed_categories := ARRAY['weapon'];
        WHEN 'offhand' THEN v_allowed_categories := ARRAY['weapon', 'shield'];
        WHEN 'head' THEN v_allowed_categories := ARRAY['head', 'helmet'];
        WHEN 'armor' THEN v_allowed_categories := ARRAY['armor', 'chestpiece'];
        WHEN 'feet' THEN v_allowed_categories := ARRAY['feet', 'boots'];
        WHEN 'accessory_1' THEN v_allowed_categories := ARRAY['accessory', 'ring', 'necklace'];
        WHEN 'accessory_2' THEN v_allowed_categories := ARRAY['accessory', 'ring', 'necklace'];
        WHEN 'pet' THEN v_allowed_categories := ARRAY['pet', 'companion'];
    END CASE;

    -- Validate category compatibility
    IF NOT (v_item_category = ANY(v_allowed_categories)) THEN
        RAISE EXCEPTION 'Item category % is not compatible with slot %', v_item_category, p_slot_name;
    END IF;

    -- Upsert equipment record (atomic)
    INSERT INTO UserEquipment (user_id, slot_name, item_id, equipped_at)
    VALUES (p_user_id, p_slot_name, p_item_id, NOW())
    ON CONFLICT (user_id, slot_name)
    DO UPDATE SET
        item_id = EXCLUDED.item_id,
        equipped_at = EXCLUDED.equipped_at;

    -- Return success result
    v_result := json_build_object(
        'success', true,
        'user_id', p_user_id,
        'slot_name', p_slot_name,
        'item_id', p_item_id,
        'equipped_at', NOW()
    );

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        -- Return error result
        v_result := json_build_object(
            'success', false,
            'error', SQLERRM,
            'error_code', SQLSTATE
        );
        RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: Activate loadout (bulk equipment update)
CREATE OR REPLACE FUNCTION activate_loadout(
    p_user_id UUID,
    p_loadout_id UUID
) RETURNS JSON AS $$
DECLARE
    v_loadout_exists BOOLEAN;
    v_slot_record RECORD;
    v_result JSON;
    v_updated_slots INT := 0;
BEGIN
    -- Verify loadout exists and belongs to user
    SELECT EXISTS(
        SELECT 1 FROM Loadouts
        WHERE id = p_loadout_id AND user_id = p_user_id
    ) INTO v_loadout_exists;

    IF NOT v_loadout_exists THEN
        RAISE EXCEPTION 'Loadout % not found or not owned by user %', p_loadout_id, p_user_id;
    END IF;

    -- Copy all loadout slots to user equipment (bulk update)
    FOR v_slot_record IN
        SELECT slot_name, item_id
        FROM LoadoutSlots
        WHERE loadout_id = p_loadout_id
    LOOP
        -- Validate item ownership if item_id is not null
        IF v_slot_record.item_id IS NOT NULL THEN
            IF NOT EXISTS(
                SELECT 1 FROM Items
                WHERE id = v_slot_record.item_id AND user_id = p_user_id
            ) THEN
                RAISE EXCEPTION 'Item % in loadout not owned by user %', v_slot_record.item_id, p_user_id;
            END IF;
        END IF;

        -- Upsert equipment record
        INSERT INTO UserEquipment (user_id, slot_name, item_id, equipped_at)
        VALUES (p_user_id, v_slot_record.slot_name, v_slot_record.item_id,
                CASE WHEN v_slot_record.item_id IS NOT NULL THEN NOW() ELSE NULL END)
        ON CONFLICT (user_id, slot_name)
        DO UPDATE SET
            item_id = EXCLUDED.item_id,
            equipped_at = EXCLUDED.equipped_at;

        v_updated_slots := v_updated_slots + 1;
    END LOOP;

    -- Set this loadout as active (deactivate others)
    UPDATE Loadouts SET is_active = FALSE WHERE user_id = p_user_id;
    UPDATE Loadouts SET is_active = TRUE WHERE id = p_loadout_id;

    -- Return success result
    v_result := json_build_object(
        'success', true,
        'user_id', p_user_id,
        'loadout_id', p_loadout_id,
        'updated_slots', v_updated_slots,
        'activated_at', NOW()
    );

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        -- Return error result
        v_result := json_build_object(
            'success', false,
            'error', SQLERRM,
            'error_code', SQLSTATE
        );
        RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: Unequip all items (for loadout clearing)
CREATE OR REPLACE FUNCTION clear_all_equipment(
    p_user_id UUID
) RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_cleared_count INT;
BEGIN
    -- Update all equipment slots to NULL
    UPDATE UserEquipment
    SET item_id = NULL, equipped_at = NULL
    WHERE user_id = p_user_id AND item_id IS NOT NULL;

    GET DIAGNOSTICS v_cleared_count = ROW_COUNT;

    -- Return success result
    v_result := json_build_object(
        'success', true,
        'user_id', p_user_id,
        'cleared_slots', v_cleared_count,
        'cleared_at', NOW()
    );

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        -- Return error result
        v_result := json_build_object(
            'success', false,
            'error', SQLERRM,
            'error_code', SQLSTATE
        );
        RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: Swap items between two slots (atomic)
CREATE OR REPLACE FUNCTION swap_equipment_slots(
    p_user_id UUID,
    p_slot_name_1 VARCHAR,
    p_slot_name_2 VARCHAR
) RETURNS JSON AS $$
DECLARE
    v_item_id_1 UUID;
    v_item_id_2 UUID;
    v_equipped_at_1 TIMESTAMP;
    v_equipped_at_2 TIMESTAMP;
    v_result JSON;
BEGIN
    -- Validate slot names
    IF p_slot_name_1 NOT IN ('weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet') THEN
        RAISE EXCEPTION 'Invalid slot name: %', p_slot_name_1;
    END IF;
    IF p_slot_name_2 NOT IN ('weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet') THEN
        RAISE EXCEPTION 'Invalid slot name: %', p_slot_name_2;
    END IF;

    -- Get current items in both slots
    SELECT item_id, equipped_at INTO v_item_id_1, v_equipped_at_1
    FROM UserEquipment
    WHERE user_id = p_user_id AND slot_name = p_slot_name_1;

    SELECT item_id, equipped_at INTO v_item_id_2, v_equipped_at_2
    FROM UserEquipment
    WHERE user_id = p_user_id AND slot_name = p_slot_name_2;

    -- Perform atomic swap
    UPDATE UserEquipment
    SET item_id = v_item_id_2, equipped_at = v_equipped_at_2
    WHERE user_id = p_user_id AND slot_name = p_slot_name_1;

    UPDATE UserEquipment
    SET item_id = v_item_id_1, equipped_at = v_equipped_at_1
    WHERE user_id = p_user_id AND slot_name = p_slot_name_2;

    -- Return success result
    v_result := json_build_object(
        'success', true,
        'user_id', p_user_id,
        'slot_1', p_slot_name_1,
        'slot_2', p_slot_name_2,
        'swapped_at', NOW()
    );

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        -- Return error result
        v_result := json_build_object(
            'success', false,
            'error', SQLERRM,
            'error_code', SQLSTATE
        );
        RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: Get user equipment summary (optimized query)
CREATE OR REPLACE FUNCTION get_user_equipment_summary(
    p_user_id UUID
) RETURNS TABLE (
    slot_name VARCHAR,
    item_id UUID,
    item_name VARCHAR,
    item_level INT,
    item_category VARCHAR,
    is_styled BOOLEAN,
    equipped_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ue.slot_name,
        ue.item_id,
        it.name AS item_name,
        i.level AS item_level,
        it.category AS item_category,
        i.is_styled,
        ue.equipped_at
    FROM UserEquipment ue
    LEFT JOIN Items i ON ue.item_id = i.id
    LEFT JOIN ItemTypes it ON i.item_type_id = it.id
    WHERE ue.user_id = p_user_id
    ORDER BY
        CASE ue.slot_name
            WHEN 'weapon' THEN 1
            WHEN 'offhand' THEN 2
            WHEN 'head' THEN 3
            WHEN 'armor' THEN 4
            WHEN 'feet' THEN 5
            WHEN 'accessory_1' THEN 6
            WHEN 'accessory_2' THEN 7
            WHEN 'pet' THEN 8
        END;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION equip_item(UUID, UUID, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION activate_loadout(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION clear_all_equipment(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION swap_equipment_slots(UUID, VARCHAR, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_equipment_summary(UUID) TO service_role;

-- Add comments for documentation
COMMENT ON FUNCTION equip_item(UUID, UUID, VARCHAR) IS 'Atomically equip item with validation and auto-stat recalculation';
COMMENT ON FUNCTION activate_loadout(UUID, UUID) IS 'Bulk update user equipment from loadout configuration';
COMMENT ON FUNCTION clear_all_equipment(UUID) IS 'Unequip all items for user';
COMMENT ON FUNCTION swap_equipment_slots(UUID, VARCHAR, VARCHAR) IS 'Atomically swap items between two equipment slots';
COMMENT ON FUNCTION get_user_equipment_summary(UUID) IS 'Optimized query for user equipment state with item details';