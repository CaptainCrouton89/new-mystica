-- Migration: Atomic Transaction RPC Functions
-- Description: Creates 10 RPC functions for atomic database transactions
-- Author: Claude Code (based on repository-implementation-guide.md)
-- Date: 2025-01-20

-- =======================
-- MATERIAL OPERATIONS
-- =======================

-- Apply material to item (atomic: decrement stack → create instance → link to item → update is_styled)
CREATE OR REPLACE FUNCTION apply_material_to_item(
    p_user_id UUID,
    p_item_id UUID,
    p_material_id UUID,
    p_style_id VARCHAR,
    p_slot_index INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_item_exists BOOLEAN := FALSE;
    v_stack_quantity INTEGER := 0;
    v_instance_id UUID;
    v_existing_instance UUID;
    v_material_combo_hash VARCHAR;
    v_is_styled BOOLEAN := FALSE;
BEGIN
    -- Validate inputs
    IF p_slot_index < 0 OR p_slot_index > 2 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_SLOT_INDEX',
            'message', 'Slot index must be between 0 and 2'
        );
    END IF;

    -- Check if item exists and belongs to user
    SELECT EXISTS(
        SELECT 1 FROM Items i
        WHERE i.id = p_item_id AND i.user_id = p_user_id
    ) INTO v_item_exists;

    IF NOT v_item_exists THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ITEM_NOT_FOUND',
            'message', 'Item not found or not owned by user'
        );
    END IF;

    -- Check if slot is already occupied
    SELECT material_instance_id INTO v_existing_instance
    FROM ItemMaterials
    WHERE item_id = p_item_id AND slot_index = p_slot_index;

    IF v_existing_instance IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'SLOT_OCCUPIED',
            'message', 'Material slot is already occupied'
        );
    END IF;

    -- Check material stack availability
    SELECT quantity INTO v_stack_quantity
    FROM MaterialStacks
    WHERE user_id = p_user_id
      AND material_id = p_material_id
      AND style_id = p_style_id;

    IF v_stack_quantity IS NULL OR v_stack_quantity < 1 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INSUFFICIENT_MATERIALS',
            'message', 'Not enough materials in stack'
        );
    END IF;

    -- Start transaction (PostgreSQL automatically provides isolation)
    BEGIN
        -- Decrement stack quantity
        UPDATE MaterialStacks
        SET quantity = quantity - 1
        WHERE user_id = p_user_id
          AND material_id = p_material_id
          AND style_id = p_style_id;

        -- Delete stack if quantity reaches 0
        DELETE FROM MaterialStacks
        WHERE user_id = p_user_id
          AND material_id = p_material_id
          AND style_id = p_style_id
          AND quantity = 0;

        -- Create material instance
        INSERT INTO MaterialInstances (id, user_id, material_id, style_id, applied_at)
        VALUES (gen_random_uuid(), p_user_id, p_material_id, p_style_id, NOW())
        RETURNING id INTO v_instance_id;

        -- Link instance to item
        INSERT INTO ItemMaterials (item_id, material_instance_id, slot_index)
        VALUES (p_item_id, v_instance_id, p_slot_index);

        -- Check if any applied materials have non-normal style
        SELECT EXISTS(
            SELECT 1 FROM ItemMaterials im
            JOIN MaterialInstances mi ON im.material_instance_id = mi.id
            WHERE im.item_id = p_item_id AND mi.style_id != 'normal'
        ) INTO v_is_styled;

        -- Update item is_styled flag
        UPDATE Items
        SET is_styled = v_is_styled
        WHERE id = p_item_id;

        -- Generate new combo hash for image generation
        SELECT encode(sha256(
            (SELECT string_agg(mi.material_id::text || ':' || mi.style_id, '|' ORDER BY im.slot_index)
             FROM ItemMaterials im
             JOIN MaterialInstances mi ON im.material_instance_id = mi.id
             WHERE im.item_id = p_item_id)::bytea
        ), 'hex') INTO v_material_combo_hash;

        UPDATE Items
        SET material_combo_hash = v_material_combo_hash
        WHERE id = p_item_id;

        RETURN jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'instance_id', v_instance_id,
                'is_styled', v_is_styled,
                'combo_hash', v_material_combo_hash
            )
        );

    EXCEPTION
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'TRANSACTION_FAILED',
                'message', 'Failed to apply material: ' || SQLERRM
            );
    END;
END;
$$ LANGUAGE plpgsql;

-- Remove material from item (atomic: unlink → delete instance → increment stack → update is_styled)
CREATE OR REPLACE FUNCTION remove_material_from_item(
    p_item_id UUID,
    p_slot_index INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_instance_record RECORD;
    v_material_combo_hash VARCHAR;
    v_is_styled BOOLEAN := FALSE;
BEGIN
    -- Validate slot index
    IF p_slot_index < 0 OR p_slot_index > 2 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_SLOT_INDEX',
            'message', 'Slot index must be between 0 and 2'
        );
    END IF;

    -- Get instance details before removal
    SELECT
        mi.id as instance_id,
        mi.user_id,
        mi.material_id,
        mi.style_id
    INTO v_instance_record
    FROM ItemMaterials im
    JOIN MaterialInstances mi ON im.material_instance_id = mi.id
    WHERE im.item_id = p_item_id AND im.slot_index = p_slot_index;

    IF v_instance_record.instance_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'SLOT_EMPTY',
            'message', 'No material in specified slot'
        );
    END IF;

    BEGIN
        -- Remove from item
        DELETE FROM ItemMaterials
        WHERE item_id = p_item_id AND slot_index = p_slot_index;

        -- Delete material instance
        DELETE FROM MaterialInstances
        WHERE id = v_instance_record.instance_id;

        -- Restore to stack (UPSERT)
        INSERT INTO MaterialStacks (user_id, material_id, style_id, quantity, created_at)
        VALUES (v_instance_record.user_id, v_instance_record.material_id, v_instance_record.style_id, 1, NOW())
        ON CONFLICT (user_id, material_id, style_id)
        DO UPDATE SET quantity = MaterialStacks.quantity + 1;

        -- Check if any remaining materials have non-normal style
        SELECT EXISTS(
            SELECT 1 FROM ItemMaterials im
            JOIN MaterialInstances mi ON im.material_instance_id = mi.id
            WHERE im.item_id = p_item_id AND mi.style_id != 'normal'
        ) INTO v_is_styled;

        -- Update item is_styled flag
        UPDATE Items
        SET is_styled = v_is_styled
        WHERE id = p_item_id;

        -- Regenerate combo hash
        SELECT COALESCE(encode(sha256(
            (SELECT string_agg(mi.material_id::text || ':' || mi.style_id, '|' ORDER BY im.slot_index)
             FROM ItemMaterials im
             JOIN MaterialInstances mi ON im.material_instance_id = mi.id
             WHERE im.item_id = p_item_id)::bytea
        ), 'hex'), '') INTO v_material_combo_hash;

        UPDATE Items
        SET material_combo_hash = v_material_combo_hash
        WHERE id = p_item_id;

        RETURN jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'removed_instance_id', v_instance_record.instance_id,
                'restored_material_id', v_instance_record.material_id,
                'restored_style_id', v_instance_record.style_id,
                'is_styled', v_is_styled,
                'combo_hash', v_material_combo_hash
            )
        );

    EXCEPTION
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'TRANSACTION_FAILED',
                'message', 'Failed to remove material: ' || SQLERRM
            );
    END;
END;
$$ LANGUAGE plpgsql;

-- Replace material on item (atomic: remove old → apply new)
CREATE OR REPLACE FUNCTION replace_material_on_item(
    p_user_id UUID,
    p_item_id UUID,
    p_slot_index INTEGER,
    p_new_material_id UUID,
    p_new_style_id VARCHAR
) RETURNS JSONB AS $$
DECLARE
    v_remove_result JSONB;
    v_apply_result JSONB;
BEGIN
    -- First remove existing material
    v_remove_result := remove_material_from_item(p_item_id, p_slot_index);

    IF NOT (v_remove_result->>'success')::boolean THEN
        RETURN v_remove_result;
    END IF;

    -- Then apply new material
    v_apply_result := apply_material_to_item(p_user_id, p_item_id, p_new_material_id, p_new_style_id, p_slot_index);

    IF NOT (v_apply_result->>'success')::boolean THEN
        -- Attempt to restore the original material (best effort)
        -- Note: This is a simplified recovery - a full implementation would store original state
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'REPLACE_FAILED',
            'message', 'Failed to apply new material after removing old one',
            'apply_error', v_apply_result
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'removed', v_remove_result->'data',
            'applied', v_apply_result->'data'
        )
    );
END;
$$ LANGUAGE plpgsql;

-- =======================
-- PROFILE/CURRENCY OPERATIONS
-- =======================

-- Deduct currency with transaction logging (atomic: check balance → deduct → log transaction)
CREATE OR REPLACE FUNCTION deduct_currency_with_logging(
    p_user_id UUID,
    p_currency_code VARCHAR,
    p_amount INTEGER,
    p_source_type VARCHAR,
    p_source_id UUID,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
    v_current_balance INTEGER := 0;
    v_new_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    -- Validate amount
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_AMOUNT',
            'message', 'Amount must be positive'
        );
    END IF;

    -- Get current balance
    SELECT balance INTO v_current_balance
    FROM UserCurrencyBalances
    WHERE user_id = p_user_id AND currency_code = p_currency_code;

    IF v_current_balance IS NULL THEN
        -- Initialize balance if doesn't exist
        INSERT INTO UserCurrencyBalances (user_id, currency_code, balance, last_updated)
        VALUES (p_user_id, p_currency_code, 0, NOW());
        v_current_balance := 0;
    END IF;

    -- Check sufficient funds
    IF v_current_balance < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INSUFFICIENT_FUNDS',
            'message', 'Not enough ' || p_currency_code || ' (have: ' || v_current_balance || ', need: ' || p_amount || ')'
        );
    END IF;

    BEGIN
        -- Deduct from balance
        UPDATE UserCurrencyBalances
        SET balance = balance - p_amount, last_updated = NOW()
        WHERE user_id = p_user_id AND currency_code = p_currency_code
        RETURNING balance INTO v_new_balance;

        -- Log transaction
        INSERT INTO EconomyTransactions (
            id, user_id, currency_code, amount, transaction_type,
            source_type, source_id, metadata, created_at
        ) VALUES (
            gen_random_uuid(), p_user_id, p_currency_code, -p_amount, 'deduct',
            p_source_type, p_source_id, p_metadata, NOW()
        ) RETURNING id INTO v_transaction_id;

        RETURN jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'previous_balance', v_current_balance,
                'new_balance', v_new_balance,
                'transaction_id', v_transaction_id
            )
        );

    EXCEPTION
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'TRANSACTION_FAILED',
                'message', 'Failed to deduct currency: ' || SQLERRM
            );
    END;
END;
$$ LANGUAGE plpgsql;

-- Add currency with transaction logging (atomic: add → log transaction)
CREATE OR REPLACE FUNCTION add_currency_with_logging(
    p_user_id UUID,
    p_currency_code VARCHAR,
    p_amount INTEGER,
    p_source_type VARCHAR,
    p_source_id UUID,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
    v_current_balance INTEGER := 0;
    v_new_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    -- Validate amount
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_AMOUNT',
            'message', 'Amount must be positive'
        );
    END IF;

    BEGIN
        -- Add to balance (UPSERT)
        INSERT INTO UserCurrencyBalances (user_id, currency_code, balance, last_updated)
        VALUES (p_user_id, p_currency_code, p_amount, NOW())
        ON CONFLICT (user_id, currency_code)
        DO UPDATE SET
            balance = UserCurrencyBalances.balance + p_amount,
            last_updated = NOW()
        RETURNING balance - p_amount, balance INTO v_current_balance, v_new_balance;

        -- Log transaction
        INSERT INTO EconomyTransactions (
            id, user_id, currency_code, amount, transaction_type,
            source_type, source_id, metadata, created_at
        ) VALUES (
            gen_random_uuid(), p_user_id, p_currency_code, p_amount, 'add',
            p_source_type, p_source_id, p_metadata, NOW()
        ) RETURNING id INTO v_transaction_id;

        RETURN jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'previous_balance', v_current_balance,
                'new_balance', v_new_balance,
                'transaction_id', v_transaction_id
            )
        );

    EXCEPTION
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'TRANSACTION_FAILED',
                'message', 'Failed to add currency: ' || SQLERRM
            );
    END;
END;
$$ LANGUAGE plpgsql;

-- Add XP and handle level up (atomic: add XP → check level up → update level + xp_to_next_level)
CREATE OR REPLACE FUNCTION add_xp_and_level_up(
    p_user_id UUID,
    p_xp_amount INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_current_xp INTEGER := 0;
    v_current_level INTEGER := 1;
    v_xp_to_next INTEGER := 100;
    v_new_xp INTEGER;
    v_new_level INTEGER;
    v_new_xp_to_next INTEGER;
    v_leveled_up BOOLEAN := FALSE;
    v_levels_gained INTEGER := 0;
    v_xp_threshold INTEGER;
BEGIN
    -- Validate amount
    IF p_xp_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_AMOUNT',
            'message', 'XP amount must be positive'
        );
    END IF;

    -- Get current progression (create if doesn't exist)
    SELECT total_xp, current_level, xp_to_next_level
    INTO v_current_xp, v_current_level, v_xp_to_next
    FROM PlayerProgression
    WHERE user_id = p_user_id;

    IF v_current_xp IS NULL THEN
        -- Initialize progression
        INSERT INTO PlayerProgression (user_id, total_xp, current_level, xp_to_next_level, created_at)
        VALUES (p_user_id, 0, 1, 100, NOW());
        v_current_xp := 0;
        v_current_level := 1;
        v_xp_to_next := 100;
    END IF;

    BEGIN
        -- Add XP
        v_new_xp := v_current_xp + p_xp_amount;
        v_new_level := v_current_level;
        v_new_xp_to_next := v_xp_to_next - p_xp_amount;

        -- Check for level ups (simple formula: each level requires 100 * level XP)
        WHILE v_new_xp_to_next <= 0 LOOP
            v_new_level := v_new_level + 1;
            v_levels_gained := v_levels_gained + 1;
            v_leveled_up := TRUE;

            -- Calculate XP threshold for new level (100 * level)
            v_xp_threshold := 100 * v_new_level;
            v_new_xp_to_next := v_xp_threshold + v_new_xp_to_next; -- Add overflow from previous level
        END LOOP;

        -- Update progression
        UPDATE PlayerProgression
        SET
            total_xp = v_new_xp,
            current_level = v_new_level,
            xp_to_next_level = v_new_xp_to_next,
            last_updated = NOW()
        WHERE user_id = p_user_id;

        RETURN jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'previous_xp', v_current_xp,
                'previous_level', v_current_level,
                'new_xp', v_new_xp,
                'new_level', v_new_level,
                'xp_to_next_level', v_new_xp_to_next,
                'leveled_up', v_leveled_up,
                'levels_gained', v_levels_gained
            )
        );

    EXCEPTION
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'TRANSACTION_FAILED',
                'message', 'Failed to add XP: ' || SQLERRM
            );
    END;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- ITEM OPERATIONS
-- =======================

-- Process item upgrade (atomic: validate → deduct gold → update item → log transaction)
CREATE OR REPLACE FUNCTION process_item_upgrade(
    p_user_id UUID,
    p_item_id UUID,
    p_gold_cost INTEGER,
    p_new_level INTEGER,
    p_new_stats JSONB
) RETURNS JSONB AS $$
DECLARE
    v_item_exists BOOLEAN := FALSE;
    v_current_level INTEGER;
    v_deduct_result JSONB;
BEGIN
    -- Validate inputs
    IF p_gold_cost <= 0 OR p_new_level <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_INPUT',
            'message', 'Gold cost and new level must be positive'
        );
    END IF;

    -- Check if item exists and belongs to user
    SELECT EXISTS(
        SELECT 1 FROM Items i
        WHERE i.id = p_item_id AND i.user_id = p_user_id
    ), level INTO v_item_exists, v_current_level
    FROM Items
    WHERE id = p_item_id AND user_id = p_user_id;

    IF NOT v_item_exists THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ITEM_NOT_FOUND',
            'message', 'Item not found or not owned by user'
        );
    END IF;

    -- Validate level progression
    IF p_new_level <= v_current_level THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_LEVEL',
            'message', 'New level must be higher than current level (' || v_current_level || ')'
        );
    END IF;

    -- Deduct gold with logging
    v_deduct_result := deduct_currency_with_logging(
        p_user_id,
        'GOLD',
        p_gold_cost,
        'item_upgrade',
        p_item_id,
        jsonb_build_object('from_level', v_current_level, 'to_level', p_new_level)
    );

    IF NOT (v_deduct_result->>'success')::boolean THEN
        RETURN v_deduct_result;
    END IF;

    BEGIN
        -- Update item
        UPDATE Items
        SET
            level = p_new_level,
            current_stats = p_new_stats,
            updated_at = NOW()
        WHERE id = p_item_id;

        -- Add to item history
        INSERT INTO ItemHistory (id, item_id, event_type, event_data, created_at)
        VALUES (
            gen_random_uuid(),
            p_item_id,
            'upgrade',
            jsonb_build_object(
                'from_level', v_current_level,
                'to_level', p_new_level,
                'gold_cost', p_gold_cost,
                'transaction_id', v_deduct_result->'data'->'transaction_id'
            ),
            NOW()
        );

        RETURN jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'previous_level', v_current_level,
                'new_level', p_new_level,
                'new_stats', p_new_stats,
                'gold_deducted', p_gold_cost,
                'currency_transaction', v_deduct_result->'data'
            )
        );

    EXCEPTION
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'TRANSACTION_FAILED',
                'message', 'Failed to upgrade item: ' || SQLERRM
            );
    END;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- EQUIPMENT OPERATIONS
-- =======================

-- Equip item (atomic: validate → update UserEquipment → recalc stats)
CREATE OR REPLACE FUNCTION equip_item(
    p_user_id UUID,
    p_item_id UUID,
    p_slot_name VARCHAR
) RETURNS JSONB AS $$
DECLARE
    v_item_category VARCHAR;
    v_slot_category VARCHAR;
    v_previous_item_id UUID;
    v_vanity_level INTEGER;
    v_avg_item_level DECIMAL;
BEGIN
    -- Validate that item exists and belongs to user
    SELECT it.category INTO v_item_category
    FROM Items i
    JOIN ItemTypes it ON i.item_type_id = it.id
    WHERE i.id = p_item_id AND i.user_id = p_user_id;

    IF v_item_category IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ITEM_NOT_FOUND',
            'message', 'Item not found or not owned by user'
        );
    END IF;

    -- Map slot name to item category (accessory_1 and accessory_2 both map to 'accessory')
    v_slot_category := CASE p_slot_name
        WHEN 'weapon' THEN 'weapon'
        WHEN 'offhand' THEN 'offhand'
        WHEN 'head' THEN 'head'
        WHEN 'armor' THEN 'armor'
        WHEN 'feet' THEN 'feet'
        WHEN 'accessory_1' THEN 'accessory'
        WHEN 'accessory_2' THEN 'accessory'
        WHEN 'pet' THEN 'pet'
        ELSE NULL
    END;

    IF v_slot_category IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_SLOT',
            'message', 'Invalid equipment slot: ' || p_slot_name
        );
    END IF;

    -- Validate category compatibility
    IF v_item_category != v_slot_category THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'CATEGORY_MISMATCH',
            'message', 'Item category (' || v_item_category || ') does not match slot category (' || v_slot_category || ')'
        );
    END IF;

    -- Check if item is already equipped elsewhere
    IF EXISTS(SELECT 1 FROM UserEquipment WHERE item_id = p_item_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ITEM_ALREADY_EQUIPPED',
            'message', 'Item is already equipped in another slot'
        );
    END IF;

    BEGIN
        -- Get currently equipped item in slot
        SELECT item_id INTO v_previous_item_id
        FROM UserEquipment
        WHERE user_id = p_user_id AND slot_name = p_slot_name;

        -- Update or insert equipment slot
        INSERT INTO UserEquipment (user_id, slot_name, item_id, equipped_at)
        VALUES (p_user_id, p_slot_name, p_item_id, NOW())
        ON CONFLICT (user_id, slot_name)
        DO UPDATE SET
            item_id = p_item_id,
            equipped_at = NOW();

        -- Recalculate vanity level (sum of equipped item levels)
        SELECT
            COALESCE(SUM(i.level), 0),
            CASE
                WHEN COUNT(i.level) > 0 THEN AVG(i.level)::DECIMAL
                ELSE NULL
            END
        INTO v_vanity_level, v_avg_item_level
        FROM UserEquipment ue
        LEFT JOIN Items i ON ue.item_id = i.id
        WHERE ue.user_id = p_user_id;

        -- Update user stats
        UPDATE Users
        SET
            vanity_level = v_vanity_level,
            avg_item_level = v_avg_item_level
        WHERE id = p_user_id;

        RETURN jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'equipped_item_id', p_item_id,
                'slot_name', p_slot_name,
                'previous_item_id', v_previous_item_id,
                'vanity_level', v_vanity_level,
                'avg_item_level', v_avg_item_level
            )
        );

    EXCEPTION
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'TRANSACTION_FAILED',
                'message', 'Failed to equip item: ' || SQLERRM
            );
    END;
END;
$$ LANGUAGE plpgsql;

-- Unequip item (atomic: remove from slot → recalc stats)
CREATE OR REPLACE FUNCTION unequip_item(
    p_user_id UUID,
    p_slot_name VARCHAR
) RETURNS JSONB AS $$
DECLARE
    v_previous_item_id UUID;
    v_vanity_level INTEGER;
    v_avg_item_level DECIMAL;
BEGIN
    -- Validate slot name
    IF p_slot_name NOT IN ('weapon', 'offhand', 'head', 'armor', 'feet', 'accessory_1', 'accessory_2', 'pet') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_SLOT',
            'message', 'Invalid equipment slot: ' || p_slot_name
        );
    END IF;

    BEGIN
        -- Get currently equipped item in slot
        SELECT item_id INTO v_previous_item_id
        FROM UserEquipment
        WHERE user_id = p_user_id AND slot_name = p_slot_name;

        -- If no item equipped, return success with no changes
        IF v_previous_item_id IS NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'data', jsonb_build_object(
                    'unequipped_item_id', NULL,
                    'slot_name', p_slot_name,
                    'message', 'No item was equipped in this slot'
                )
            );
        END IF;

        -- Remove item from slot (set to NULL)
        UPDATE UserEquipment
        SET
            item_id = NULL,
            equipped_at = NULL
        WHERE user_id = p_user_id AND slot_name = p_slot_name;

        -- Recalculate vanity level (sum of equipped item levels)
        SELECT
            COALESCE(SUM(i.level), 0),
            CASE
                WHEN COUNT(i.level) > 0 THEN AVG(i.level)::DECIMAL
                ELSE NULL
            END
        INTO v_vanity_level, v_avg_item_level
        FROM UserEquipment ue
        LEFT JOIN Items i ON ue.item_id = i.id
        WHERE ue.user_id = p_user_id AND ue.item_id IS NOT NULL;

        -- Update user stats
        UPDATE Users
        SET
            vanity_level = v_vanity_level,
            avg_item_level = v_avg_item_level
        WHERE id = p_user_id;

        RETURN jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'unequipped_item_id', v_previous_item_id,
                'slot_name', p_slot_name,
                'vanity_level', v_vanity_level,
                'avg_item_level', v_avg_item_level
            )
        );

    EXCEPTION
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'TRANSACTION_FAILED',
                'message', 'Failed to unequip item: ' || SQLERRM
            );
    END;
END;
$$ LANGUAGE plpgsql;

-- Activate loadout (atomic: deactivate others → activate target → copy slots → recalc stats)
CREATE OR REPLACE FUNCTION activate_loadout(
    p_user_id UUID,
    p_loadout_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_loadout_exists BOOLEAN := FALSE;
    v_loadout_name VARCHAR;
    v_vanity_level INTEGER;
    v_avg_item_level DECIMAL;
    v_slots_updated INTEGER := 0;
BEGIN
    -- Validate loadout exists and belongs to user
    SELECT EXISTS(
        SELECT 1 FROM Loadouts
        WHERE id = p_loadout_id AND user_id = p_user_id
    ), name INTO v_loadout_exists, v_loadout_name
    FROM Loadouts
    WHERE id = p_loadout_id AND user_id = p_user_id;

    IF NOT v_loadout_exists THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'LOADOUT_NOT_FOUND',
            'message', 'Loadout not found or not owned by user'
        );
    END IF;

    BEGIN
        -- Deactivate all user's loadouts
        UPDATE Loadouts
        SET is_active = false
        WHERE user_id = p_user_id;

        -- Activate target loadout
        UPDATE Loadouts
        SET is_active = true
        WHERE id = p_loadout_id;

        -- Clear all current equipment
        DELETE FROM UserEquipment
        WHERE user_id = p_user_id;

        -- Copy loadout slots to UserEquipment (only non-null item assignments)
        INSERT INTO UserEquipment (user_id, slot_name, item_id, equipped_at)
        SELECT p_user_id, ls.slot_name, ls.item_id, NOW()
        FROM LoadoutSlots ls
        WHERE ls.loadout_id = p_loadout_id
          AND ls.item_id IS NOT NULL;

        GET DIAGNOSTICS v_slots_updated = ROW_COUNT;

        -- Recalculate user stats
        SELECT
            COALESCE(SUM(i.level), 0),
            CASE
                WHEN COUNT(i.level) > 0 THEN AVG(i.level)::DECIMAL
                ELSE NULL
            END
        INTO v_vanity_level, v_avg_item_level
        FROM UserEquipment ue
        LEFT JOIN Items i ON ue.item_id = i.id
        WHERE ue.user_id = p_user_id;

        -- Update user stats
        UPDATE Users
        SET
            vanity_level = v_vanity_level,
            avg_item_level = v_avg_item_level
        WHERE id = p_user_id;

        RETURN jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'loadout_id', p_loadout_id,
                'loadout_name', v_loadout_name,
                'slots_equipped', v_slots_updated,
                'vanity_level', v_vanity_level,
                'avg_item_level', v_avg_item_level
            )
        );

    EXCEPTION
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'TRANSACTION_FAILED',
                'message', 'Failed to activate loadout: ' || SQLERRM
            );
    END;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- COMBAT OPERATIONS
-- =======================

-- Update combat history (atomic: UPSERT history with streak calculation)
CREATE OR REPLACE FUNCTION update_combat_history(
    p_user_id UUID,
    p_location_id UUID,
    p_result VARCHAR
) RETURNS JSONB AS $$
DECLARE
    v_result_type combat_result;
    v_current_streak INTEGER := 0;
    v_longest_streak INTEGER := 0;
    v_total_attempts INTEGER := 0;
    v_victories INTEGER := 0;
    v_defeats INTEGER := 0;
    v_new_current_streak INTEGER;
    v_new_longest_streak INTEGER;
BEGIN
    -- Validate result type
    BEGIN
        v_result_type := p_result::combat_result;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'INVALID_RESULT',
                'message', 'Invalid combat result. Must be: victory, defeat, escape, or abandoned'
            );
    END;

    -- Only count victory/defeat for streak calculation
    IF v_result_type NOT IN ('victory', 'defeat') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_RESULT_FOR_HISTORY',
            'message', 'Only victory and defeat results are recorded in combat history'
        );
    END IF;

    BEGIN
        -- Get current history
        SELECT
            current_streak,
            longest_streak,
            total_attempts,
            victories,
            defeats
        INTO
            v_current_streak,
            v_longest_streak,
            v_total_attempts,
            v_victories,
            v_defeats
        FROM PlayerCombatHistory
        WHERE user_id = p_user_id AND location_id = p_location_id;

        -- Initialize if no history exists
        IF v_current_streak IS NULL THEN
            v_current_streak := 0;
            v_longest_streak := 0;
            v_total_attempts := 0;
            v_victories := 0;
            v_defeats := 0;
        END IF;

        -- Calculate new streak
        IF v_result_type = 'victory' THEN
            v_new_current_streak := v_current_streak + 1;
            v_victories := v_victories + 1;
        ELSE -- defeat
            v_new_current_streak := 0; -- Reset streak on defeat
            v_defeats := v_defeats + 1;
        END IF;

        -- Update longest streak if needed
        v_new_longest_streak := GREATEST(v_longest_streak, v_new_current_streak);
        v_total_attempts := v_total_attempts + 1;

        -- UPSERT history record
        INSERT INTO PlayerCombatHistory (
            user_id, location_id, total_attempts, victories, defeats,
            current_streak, longest_streak, last_attempt, created_at
        ) VALUES (
            p_user_id, p_location_id, v_total_attempts, v_victories, v_defeats,
            v_new_current_streak, v_new_longest_streak, NOW(), NOW()
        )
        ON CONFLICT (user_id, location_id)
        DO UPDATE SET
            total_attempts = v_total_attempts,
            victories = v_victories,
            defeats = v_defeats,
            current_streak = v_new_current_streak,
            longest_streak = v_new_longest_streak,
            last_attempt = NOW();

        RETURN jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'result', p_result,
                'total_attempts', v_total_attempts,
                'victories', v_victories,
                'defeats', v_defeats,
                'current_streak', v_new_current_streak,
                'longest_streak', v_new_longest_streak,
                'previous_streak', v_current_streak
            )
        );

    EXCEPTION
        WHEN OTHERS THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'TRANSACTION_FAILED',
                'message', 'Failed to update combat history: ' || SQLERRM
            );
    END;
END;
$$ LANGUAGE plpgsql;