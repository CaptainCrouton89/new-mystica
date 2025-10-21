-- Migration: Fix RPC functions to use correct column names
-- Description: Updates RPC functions to use 'currency' instead of 'currency_code'
-- Author: Claude Code
-- Date: 2025-01-20

-- Fix add_currency_with_logging function
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

        -- Log transaction (fix column name from currency_code to currency)
        INSERT INTO EconomyTransactions (
            id, user_id, currency, amount, transaction_type,
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

-- Fix deduct_currency_with_logging function
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

        -- Log transaction (fix column name from currency_code to currency)
        INSERT INTO EconomyTransactions (
            id, user_id, currency, amount, transaction_type,
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

-- Fix add_xp_and_level_up function (table name issue)
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

    -- Get current progression (fix table name casing)
    SELECT total_xp, current_level, xp_to_next_level
    INTO v_current_xp, v_current_level, v_xp_to_next
    FROM playerprogression
    WHERE user_id = p_user_id;

    IF v_current_xp IS NULL THEN
        -- Initialize progression
        INSERT INTO playerprogression (user_id, total_xp, current_level, xp_to_next_level, created_at)
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
        UPDATE playerprogression
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