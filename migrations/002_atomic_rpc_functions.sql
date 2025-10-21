-- Migration: 002_atomic_rpc_functions.sql
-- Description: Atomic transaction RPC functions for repository layer
-- Created: 2025-10-21

-- =============================================================================
-- MATERIAL OPERATIONS
-- =============================================================================

-- Apply material to item (atomic: decrement stack → create instance → link to item)
CREATE OR REPLACE FUNCTION apply_material_to_item(
    p_user_id UUID,
    p_item_id UUID,
    p_material_id UUID,
    p_style_id VARCHAR(50),
    p_slot_index INTEGER
) RETURNS JSON AS $$
DECLARE
    v_stack_quantity INTEGER;
    v_instance_id UUID;
    v_item_owner UUID;
    v_existing_instance_id UUID;
    v_is_styled BOOLEAN := FALSE;
BEGIN
    -- Validate item ownership
    SELECT user_id INTO v_item_owner FROM Items WHERE id = p_item_id;
    IF v_item_owner IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'ITEM_NOT_FOUND',
            'error_message', 'Item not found'
        );
    END IF;

    IF v_item_owner != p_user_id THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'UNAUTHORIZED',
            'error_message', 'Item not owned by user'
        );
    END IF;

    -- Validate slot index (0-2)
    IF p_slot_index < 0 OR p_slot_index > 2 THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'INVALID_SLOT',
            'error_message', 'Slot index must be between 0 and 2'
        );
    END IF;

    -- Check if slot is already occupied
    SELECT material_instance_id INTO v_existing_instance_id
    FROM ItemMaterials
    WHERE item_id = p_item_id AND slot_index = p_slot_index;

    IF v_existing_instance_id IS NOT NULL THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'SLOT_OCCUPIED',
            'error_message', 'Material slot is already occupied'
        );
    END IF;

    -- Check material stack availability
    SELECT quantity INTO v_stack_quantity
    FROM MaterialStacks
    WHERE user_id = p_user_id
      AND material_id = p_material_id
      AND style_id = p_style_id;

    IF v_stack_quantity IS NULL OR v_stack_quantity < 1 THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'INSUFFICIENT_MATERIALS',
            'error_message', 'Insufficient material quantity in stack'
        );
    END IF;

    -- Decrement material stack
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
    INSERT INTO MaterialInstances (user_id, material_id, style_id)
    VALUES (p_user_id, p_material_id, p_style_id)
    RETURNING id INTO v_instance_id;

    -- Link instance to item
    INSERT INTO ItemMaterials (item_id, material_instance_id, slot_index)
    VALUES (p_item_id, v_instance_id, p_slot_index);

    -- Check if item should be marked as styled (any material with style_id != 'normal')
    SELECT EXISTS(
        SELECT 1 FROM ItemMaterials im
        JOIN MaterialInstances mi ON im.material_instance_id = mi.id
        WHERE im.item_id = p_item_id AND mi.style_id != 'normal'
    ) INTO v_is_styled;

    -- Update item styled status
    UPDATE Items
    SET is_styled = v_is_styled
    WHERE id = p_item_id;

    RETURN json_build_object(
        'success', true,
        'instance_id', v_instance_id,
        'is_styled', v_is_styled
    );
END;
$$ LANGUAGE plpgsql;

-- Remove material from item (atomic: unlink → delete instance → increment stack)
CREATE OR REPLACE FUNCTION remove_material_from_item(
    p_item_id UUID,
    p_slot_index INTEGER
) RETURNS JSON AS $$
DECLARE
    v_instance_id UUID;
    v_material_id UUID;
    v_style_id VARCHAR(50);
    v_user_id UUID;
    v_is_styled BOOLEAN := FALSE;
    v_existing_quantity INTEGER;
BEGIN
    -- Validate slot index
    IF p_slot_index < 0 OR p_slot_index > 2 THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'INVALID_SLOT',
            'error_message', 'Slot index must be between 0 and 2'
        );
    END IF;

    -- Get material instance in slot
    SELECT material_instance_id INTO v_instance_id
    FROM ItemMaterials
    WHERE item_id = p_item_id AND slot_index = p_slot_index;

    IF v_instance_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'SLOT_EMPTY',
            'error_message', 'No material in specified slot'
        );
    END IF;

    -- Get instance details
    SELECT user_id, material_id, style_id
    INTO v_user_id, v_material_id, v_style_id
    FROM MaterialInstances
    WHERE id = v_instance_id;

    -- Remove from item
    DELETE FROM ItemMaterials
    WHERE item_id = p_item_id AND slot_index = p_slot_index;

    -- Delete material instance
    DELETE FROM MaterialInstances WHERE id = v_instance_id;

    -- Restore to material stack (increment or create)
    SELECT quantity INTO v_existing_quantity
    FROM MaterialStacks
    WHERE user_id = v_user_id
      AND material_id = v_material_id
      AND style_id = v_style_id;

    IF v_existing_quantity IS NOT NULL THEN
        -- Increment existing stack
        UPDATE MaterialStacks
        SET quantity = quantity + 1
        WHERE user_id = v_user_id
          AND material_id = v_material_id
          AND style_id = v_style_id;
    ELSE
        -- Create new stack
        INSERT INTO MaterialStacks (user_id, material_id, style_id, quantity)
        VALUES (v_user_id, v_material_id, v_style_id, 1);
    END IF;

    -- Update item styled status
    SELECT EXISTS(
        SELECT 1 FROM ItemMaterials im
        JOIN MaterialInstances mi ON im.material_instance_id = mi.id
        WHERE im.item_id = p_item_id AND mi.style_id != 'normal'
    ) INTO v_is_styled;

    UPDATE Items
    SET is_styled = v_is_styled
    WHERE id = p_item_id;

    RETURN json_build_object(
        'success', true,
        'material_id', v_material_id,
        'style_id', v_style_id,
        'is_styled', v_is_styled
    );
END;
$$ LANGUAGE plpgsql;

-- Replace material on item (atomic: remove old → apply new)
CREATE OR REPLACE FUNCTION replace_material_on_item(
    p_user_id UUID,
    p_item_id UUID,
    p_slot_index INTEGER,
    p_new_material_id UUID,
    p_new_style_id VARCHAR(50)
) RETURNS JSON AS $$
DECLARE
    v_remove_result JSON;
    v_apply_result JSON;
BEGIN
    -- Remove existing material
    SELECT remove_material_from_item(p_item_id, p_slot_index) INTO v_remove_result;

    -- Check if removal failed
    IF NOT (v_remove_result->>'success')::BOOLEAN THEN
        RETURN v_remove_result;
    END IF;

    -- Apply new material
    SELECT apply_material_to_item(p_user_id, p_item_id, p_new_material_id, p_new_style_id, p_slot_index)
    INTO v_apply_result;

    -- If apply failed, try to restore old material (best effort)
    IF NOT (v_apply_result->>'success')::BOOLEAN THEN
        -- Note: We can't perfectly restore because we don't know the old material details
        -- The remove operation has already incremented the stack
        RETURN json_build_object(
            'success', false,
            'error_code', 'REPLACE_FAILED',
            'error_message', 'Failed to apply new material after removing old material',
            'apply_error', v_apply_result
        );
    END IF;

    RETURN json_build_object(
        'success', true,
        'removed', v_remove_result,
        'applied', v_apply_result
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PROFILE/CURRENCY OPERATIONS
-- =============================================================================

-- Deduct currency with transaction logging (atomic: check balance → deduct → log)
CREATE OR REPLACE FUNCTION deduct_currency_with_logging(
    p_user_id UUID,
    p_currency_code VARCHAR(10),
    p_amount INTEGER,
    p_source_type VARCHAR(50),
    p_source_id UUID,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSON AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    -- Validate inputs
    IF p_amount <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'INVALID_AMOUNT',
            'error_message', 'Amount must be positive'
        );
    END IF;

    IF p_currency_code NOT IN ('GOLD', 'GEMS') THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'INVALID_CURRENCY',
            'error_message', 'Currency code must be GOLD or GEMS'
        );
    END IF;

    -- Get current balance
    SELECT balance INTO v_current_balance
    FROM UserCurrencyBalances
    WHERE user_id = p_user_id AND currency_code = p_currency_code;

    -- If no balance record exists, treat as 0
    IF v_current_balance IS NULL THEN
        v_current_balance := 0;
    END IF;

    -- Check sufficient funds
    IF v_current_balance < p_amount THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'INSUFFICIENT_FUNDS',
            'error_message', format('Insufficient %s balance. Required: %s, Available: %s',
                                   p_currency_code, p_amount, v_current_balance),
            'required', p_amount,
            'available', v_current_balance
        );
    END IF;

    v_new_balance := v_current_balance - p_amount;

    -- Update balance (upsert)
    INSERT INTO UserCurrencyBalances (user_id, currency_code, balance)
    VALUES (p_user_id, p_currency_code, v_new_balance)
    ON CONFLICT (user_id, currency_code)
    DO UPDATE SET balance = v_new_balance;

    -- Log transaction
    INSERT INTO EconomyTransactions (
        user_id, currency_code, amount, transaction_type,
        source_type, source_id, metadata
    ) VALUES (
        p_user_id, p_currency_code, -p_amount, 'debit',
        p_source_type, p_source_id, p_metadata
    ) RETURNING id INTO v_transaction_id;

    RETURN json_build_object(
        'success', true,
        'previous_balance', v_current_balance,
        'new_balance', v_new_balance,
        'amount_deducted', p_amount,
        'transaction_id', v_transaction_id
    );
END;
$$ LANGUAGE plpgsql;

-- Add currency with transaction logging (atomic: add → log)
CREATE OR REPLACE FUNCTION add_currency_with_logging(
    p_user_id UUID,
    p_currency_code VARCHAR(10),
    p_amount INTEGER,
    p_source_type VARCHAR(50),
    p_source_id UUID,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSON AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    -- Validate inputs
    IF p_amount <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'INVALID_AMOUNT',
            'error_message', 'Amount must be positive'
        );
    END IF;

    IF p_currency_code NOT IN ('GOLD', 'GEMS') THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'INVALID_CURRENCY',
            'error_message', 'Currency code must be GOLD or GEMS'
        );
    END IF;

    -- Get current balance
    SELECT balance INTO v_current_balance
    FROM UserCurrencyBalances
    WHERE user_id = p_user_id AND currency_code = p_currency_code;

    -- If no balance record exists, treat as 0
    IF v_current_balance IS NULL THEN
        v_current_balance := 0;
    END IF;

    v_new_balance := v_current_balance + p_amount;

    -- Update balance (upsert)
    INSERT INTO UserCurrencyBalances (user_id, currency_code, balance)
    VALUES (p_user_id, p_currency_code, v_new_balance)
    ON CONFLICT (user_id, currency_code)
    DO UPDATE SET balance = v_new_balance;

    -- Log transaction
    INSERT INTO EconomyTransactions (
        user_id, currency_code, amount, transaction_type,
        source_type, source_id, metadata
    ) VALUES (
        p_user_id, p_currency_code, p_amount, 'credit',
        p_source_type, p_source_id, p_metadata
    ) RETURNING id INTO v_transaction_id;

    RETURN json_build_object(
        'success', true,
        'previous_balance', v_current_balance,
        'new_balance', v_new_balance,
        'amount_added', p_amount,
        'transaction_id', v_transaction_id
    );
END;
$$ LANGUAGE plpgsql;

-- Add XP and handle level up (atomic: add XP → check level → update progression)
CREATE OR REPLACE FUNCTION add_xp_and_level_up(
    p_user_id UUID,
    p_xp_amount INTEGER
) RETURNS JSON AS $$
DECLARE
    v_current_xp INTEGER;
    v_current_level INTEGER;
    v_new_xp INTEGER;
    v_new_level INTEGER;
    v_xp_to_next INTEGER;
    v_leveled_up BOOLEAN := FALSE;
    v_progression_exists BOOLEAN;
BEGIN
    -- Validate input
    IF p_xp_amount <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'INVALID_XP_AMOUNT',
            'error_message', 'XP amount must be positive'
        );
    END IF;

    -- Check if progression record exists
    SELECT EXISTS(SELECT 1 FROM PlayerProgression WHERE user_id = p_user_id) INTO v_progression_exists;

    IF v_progression_exists THEN
        -- Get current progression
        SELECT total_experience, current_level
        INTO v_current_xp, v_current_level
        FROM PlayerProgression
        WHERE user_id = p_user_id;
    ELSE
        -- Create initial progression record
        INSERT INTO PlayerProgression (user_id, current_level, total_experience, xp_to_next_level)
        VALUES (p_user_id, 1, 0, 100);

        v_current_xp := 0;
        v_current_level := 1;
    END IF;

    v_new_xp := v_current_xp + p_xp_amount;
    v_new_level := v_current_level;

    -- Simple level calculation: level = floor(sqrt(total_xp / 100)) + 1
    -- This gives roughly: Level 1=0-99 XP, Level 2=100-399 XP, Level 3=400-899 XP, etc.
    v_new_level := FLOOR(SQRT(v_new_xp::FLOAT / 100)) + 1;

    -- Calculate XP needed for next level
    -- Next level threshold = (level^2 * 100)
    v_xp_to_next := (v_new_level * v_new_level * 100) - v_new_xp;

    -- Check if leveled up
    IF v_new_level > v_current_level THEN
        v_leveled_up := TRUE;
    END IF;

    -- Update progression
    UPDATE PlayerProgression
    SET
        total_experience = v_new_xp,
        current_level = v_new_level,
        xp_to_next_level = v_xp_to_next,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN json_build_object(
        'success', true,
        'previous_xp', v_current_xp,
        'previous_level', v_current_level,
        'new_xp', v_new_xp,
        'new_level', v_new_level,
        'xp_added', p_xp_amount,
        'xp_to_next_level', v_xp_to_next,
        'leveled_up', v_leveled_up
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ITEM OPERATIONS
-- =============================================================================

-- Process item upgrade (atomic: check gold → deduct → update item → log)
CREATE OR REPLACE FUNCTION process_item_upgrade(
    p_user_id UUID,
    p_item_id UUID,
    p_gold_cost INTEGER,
    p_new_level INTEGER,
    p_new_stats JSONB
) RETURNS JSON AS $$
DECLARE
    v_item_owner UUID;
    v_current_level INTEGER;
    v_deduct_result JSON;
    v_transaction_id UUID;
BEGIN
    -- Validate item ownership
    SELECT user_id, level INTO v_item_owner, v_current_level
    FROM Items
    WHERE id = p_item_id;

    IF v_item_owner IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'ITEM_NOT_FOUND',
            'error_message', 'Item not found'
        );
    END IF;

    IF v_item_owner != p_user_id THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'UNAUTHORIZED',
            'error_message', 'Item not owned by user'
        );
    END IF;

    -- Validate level progression
    IF p_new_level <= v_current_level THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'INVALID_LEVEL',
            'error_message', 'New level must be higher than current level',
            'current_level', v_current_level,
            'requested_level', p_new_level
        );
    END IF;

    -- Deduct gold cost
    SELECT deduct_currency_with_logging(
        p_user_id,
        'GOLD',
        p_gold_cost,
        'item_upgrade',
        p_item_id,
        json_build_object('from_level', v_current_level, 'to_level', p_new_level)::jsonb
    ) INTO v_deduct_result;

    -- Check if deduction failed
    IF NOT (v_deduct_result->>'success')::BOOLEAN THEN
        RETURN v_deduct_result; -- Return the deduction error
    END IF;

    v_transaction_id := (v_deduct_result->>'transaction_id')::UUID;

    -- Update item
    UPDATE Items
    SET
        level = p_new_level,
        current_stats = p_new_stats,
        updated_at = NOW()
    WHERE id = p_item_id;

    -- Log item history
    INSERT INTO ItemHistory (item_id, event_type, event_data)
    VALUES (
        p_item_id,
        'upgrade',
        json_build_object(
            'from_level', v_current_level,
            'to_level', p_new_level,
            'gold_cost', p_gold_cost,
            'transaction_id', v_transaction_id,
            'new_stats', p_new_stats
        )::jsonb
    );

    RETURN json_build_object(
        'success', true,
        'previous_level', v_current_level,
        'new_level', p_new_level,
        'gold_cost', p_gold_cost,
        'new_stats', p_new_stats,
        'transaction_id', v_transaction_id
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- EQUIPMENT OPERATIONS
-- =============================================================================

-- Equip item (atomic: validate → update equipment slot)
CREATE OR REPLACE FUNCTION equip_item(
    p_user_id UUID,
    p_item_id UUID,
    p_slot_name VARCHAR(50)
) RETURNS JSON AS $$
DECLARE
    v_item_owner UUID;
    v_item_category VARCHAR(50);
    v_previous_item_id UUID;
    v_slot_exists BOOLEAN;
BEGIN
    -- Validate slot exists
    SELECT EXISTS(SELECT 1 FROM EquipmentSlots WHERE slot_name = p_slot_name) INTO v_slot_exists;

    IF NOT v_slot_exists THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'INVALID_SLOT',
            'error_message', 'Equipment slot does not exist'
        );
    END IF;

    -- Validate item ownership and get category
    SELECT i.user_id, it.category
    INTO v_item_owner, v_item_category
    FROM Items i
    JOIN ItemTypes it ON i.item_type_id = it.id
    WHERE i.id = p_item_id;

    IF v_item_owner IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'ITEM_NOT_FOUND',
            'error_message', 'Item not found'
        );
    END IF;

    IF v_item_owner != p_user_id THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'UNAUTHORIZED',
            'error_message', 'Item not owned by user'
        );
    END IF;

    -- Basic slot-category validation (expand as needed)
    IF (p_slot_name = 'weapon' AND v_item_category != 'weapon') OR
       (p_slot_name = 'armor' AND v_item_category != 'armor') OR
       (p_slot_name = 'head' AND v_item_category != 'helmet') OR
       (p_slot_name = 'feet' AND v_item_category != 'boots') OR
       (p_slot_name = 'pet' AND v_item_category != 'pet') THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'INCOMPATIBLE_ITEM',
            'error_message', format('Item category %s cannot be equipped in %s slot', v_item_category, p_slot_name)
        );
    END IF;

    -- Get currently equipped item in slot
    SELECT item_id INTO v_previous_item_id
    FROM UserEquipment
    WHERE user_id = p_user_id AND slot_name = p_slot_name;

    -- Update equipment slot (upsert)
    INSERT INTO UserEquipment (user_id, slot_name, item_id)
    VALUES (p_user_id, p_slot_name, p_item_id)
    ON CONFLICT (user_id, slot_name)
    DO UPDATE SET item_id = p_item_id;

    RETURN json_build_object(
        'success', true,
        'slot_name', p_slot_name,
        'equipped_item_id', p_item_id,
        'previous_item_id', v_previous_item_id,
        'item_category', v_item_category
    );
END;
$$ LANGUAGE plpgsql;

-- Activate loadout (atomic: copy loadout slots → user equipment)
CREATE OR REPLACE FUNCTION activate_loadout(
    p_user_id UUID,
    p_loadout_id UUID
) RETURNS JSON AS $$
DECLARE
    v_loadout_owner UUID;
    v_loadout_name VARCHAR(100);
    v_slot_record RECORD;
    v_slots_copied INTEGER := 0;
    v_invalid_items TEXT[] := '{}';
BEGIN
    -- Validate loadout ownership
    SELECT user_id, name INTO v_loadout_owner, v_loadout_name
    FROM Loadouts
    WHERE id = p_loadout_id;

    IF v_loadout_owner IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'LOADOUT_NOT_FOUND',
            'error_message', 'Loadout not found'
        );
    END IF;

    IF v_loadout_owner != p_user_id THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'UNAUTHORIZED',
            'error_message', 'Loadout not owned by user'
        );
    END IF;

    -- Deactivate all user's loadouts
    UPDATE Loadouts
    SET is_active = false
    WHERE user_id = p_user_id;

    -- Activate target loadout
    UPDATE Loadouts
    SET is_active = true
    WHERE id = p_loadout_id;

    -- Copy loadout slots to user equipment
    FOR v_slot_record IN
        SELECT ls.slot_name, ls.item_id
        FROM LoadoutSlots ls
        WHERE ls.loadout_id = p_loadout_id
    LOOP
        -- Validate item still exists and is owned by user (items could be deleted/traded)
        IF v_slot_record.item_id IS NOT NULL THEN
            IF NOT EXISTS(
                SELECT 1 FROM Items
                WHERE id = v_slot_record.item_id AND user_id = p_user_id
            ) THEN
                -- Item no longer exists or not owned - skip this slot
                v_invalid_items := array_append(v_invalid_items, v_slot_record.slot_name);
                CONTINUE;
            END IF;
        END IF;

        -- Update equipment slot
        INSERT INTO UserEquipment (user_id, slot_name, item_id)
        VALUES (p_user_id, v_slot_record.slot_name, v_slot_record.item_id)
        ON CONFLICT (user_id, slot_name)
        DO UPDATE SET item_id = v_slot_record.item_id;

        v_slots_copied := v_slots_copied + 1;
    END LOOP;

    RETURN json_build_object(
        'success', true,
        'loadout_id', p_loadout_id,
        'loadout_name', v_loadout_name,
        'slots_copied', v_slots_copied,
        'invalid_items', v_invalid_items
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMBAT OPERATIONS
-- =============================================================================

-- Update combat history (atomic: upsert player history with streak tracking)
CREATE OR REPLACE FUNCTION update_combat_history(
    p_user_id UUID,
    p_location_id UUID,
    p_result VARCHAR(20)
) RETURNS JSON AS $$
DECLARE
    v_history_exists BOOLEAN;
    v_current_streak INTEGER;
    v_longest_streak INTEGER;
    v_new_streak INTEGER;
    v_total_attempts INTEGER;
    v_victories INTEGER;
    v_defeats INTEGER;
BEGIN
    -- Validate result
    IF p_result NOT IN ('victory', 'defeat') THEN
        RETURN json_build_object(
            'success', false,
            'error_code', 'INVALID_RESULT',
            'error_message', 'Result must be either victory or defeat'
        );
    END IF;

    -- Check if history record exists
    SELECT EXISTS(
        SELECT 1 FROM PlayerCombatHistory
        WHERE user_id = p_user_id AND location_id = p_location_id
    ) INTO v_history_exists;

    IF v_history_exists THEN
        -- Get current stats
        SELECT current_streak, longest_streak, total_attempts, victories, defeats
        INTO v_current_streak, v_longest_streak, v_total_attempts, v_victories, v_defeats
        FROM PlayerCombatHistory
        WHERE user_id = p_user_id AND location_id = p_location_id;

        -- Calculate new streak
        IF p_result = 'victory' THEN
            v_new_streak := v_current_streak + 1;
            v_victories := v_victories + 1;
        ELSE
            v_new_streak := 0; -- Reset streak on defeat
            v_defeats := v_defeats + 1;
        END IF;

        -- Update longest streak if needed
        IF v_new_streak > v_longest_streak THEN
            v_longest_streak := v_new_streak;
        END IF;

        v_total_attempts := v_total_attempts + 1;

        -- Update existing record
        UPDATE PlayerCombatHistory
        SET
            total_attempts = v_total_attempts,
            victories = v_victories,
            defeats = v_defeats,
            current_streak = v_new_streak,
            longest_streak = v_longest_streak,
            last_attempt = NOW(),
            updated_at = NOW()
        WHERE user_id = p_user_id AND location_id = p_location_id;

    ELSE
        -- Create new history record
        IF p_result = 'victory' THEN
            v_new_streak := 1;
            v_longest_streak := 1;
            v_victories := 1;
            v_defeats := 0;
        ELSE
            v_new_streak := 0;
            v_longest_streak := 0;
            v_victories := 0;
            v_defeats := 1;
        END IF;

        v_total_attempts := 1;

        INSERT INTO PlayerCombatHistory (
            user_id, location_id, total_attempts, victories, defeats,
            current_streak, longest_streak, last_attempt
        ) VALUES (
            p_user_id, p_location_id, v_total_attempts, v_victories, v_defeats,
            v_new_streak, v_longest_streak, NOW()
        );
    END IF;

    RETURN json_build_object(
        'success', true,
        'result', p_result,
        'total_attempts', v_total_attempts,
        'victories', v_victories,
        'defeats', v_defeats,
        'current_streak', v_new_streak,
        'longest_streak', v_longest_streak
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- GRANTS (Allow public access to RPC functions)
-- =============================================================================

GRANT EXECUTE ON FUNCTION apply_material_to_item(UUID, UUID, UUID, VARCHAR, INTEGER) TO PUBLIC;
GRANT EXECUTE ON FUNCTION remove_material_from_item(UUID, INTEGER) TO PUBLIC;
GRANT EXECUTE ON FUNCTION replace_material_on_item(UUID, UUID, INTEGER, UUID, VARCHAR) TO PUBLIC;
GRANT EXECUTE ON FUNCTION deduct_currency_with_logging(UUID, VARCHAR, INTEGER, VARCHAR, UUID, JSONB) TO PUBLIC;
GRANT EXECUTE ON FUNCTION add_currency_with_logging(UUID, VARCHAR, INTEGER, VARCHAR, UUID, JSONB) TO PUBLIC;
GRANT EXECUTE ON FUNCTION add_xp_and_level_up(UUID, INTEGER) TO PUBLIC;
GRANT EXECUTE ON FUNCTION process_item_upgrade(UUID, UUID, INTEGER, INTEGER, JSONB) TO PUBLIC;
GRANT EXECUTE ON FUNCTION equip_item(UUID, UUID, VARCHAR) TO PUBLIC;
GRANT EXECUTE ON FUNCTION activate_loadout(UUID, UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION update_combat_history(UUID, UUID, VARCHAR) TO PUBLIC;