-- Migration: 002_profile_init_function.sql
-- Description: Add stored procedure for atomic user profile initialization

-- Create function for profile initialization
CREATE OR REPLACE FUNCTION public.init_profile(
    p_user_id uuid,
    p_email text
) RETURNS TABLE(
    id uuid,
    email character varying,
    vanity_level integer,
    avg_item_level numeric,
    created_at timestamp
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_starter_item_type itemtypes%ROWTYPE;
    v_starter_item_id uuid;
    v_slot_name varchar;
BEGIN
    -- Check if user already exists (idempotency)
    IF EXISTS (SELECT 1 FROM users WHERE users.id = p_user_id) THEN
        RAISE EXCEPTION 'conflict:already_initialized';
    END IF;

    -- Get random common weapon for starter item
    SELECT it.* INTO v_starter_item_type
    FROM itemtypes it
    WHERE it.category = 'weapon' AND it.rarity = 'common'
    ORDER BY random()
    LIMIT 1;

    -- Check if common weapons exist
    IF v_starter_item_type.id IS NULL THEN
        RAISE EXCEPTION 'not_found:common_weapon_missing';
    END IF;

    -- Generate UUID for starter item
    v_starter_item_id := gen_random_uuid();

    -- Insert user profile
    INSERT INTO users (
        id,
        email,
        vanity_level,
        avg_item_level
    ) VALUES (
        p_user_id,
        p_email,
        1,    -- vanity_level starts at 1
        1     -- avg_item_level starts at 1
    );

    -- Insert currency balances (GOLD starts at 0)
    INSERT INTO usercurrencybalances (
        user_id,
        currency_code,
        balance,
        updated_at
    ) VALUES (
        p_user_id,
        'GOLD',
        0,
        now()
    );

    -- Insert GEMS currency balance (starts at 0)
    INSERT INTO usercurrencybalances (
        user_id,
        currency_code,
        balance,
        updated_at
    ) VALUES (
        p_user_id,
        'GEMS',
        0,
        now()
    );

    -- Insert starter weapon item
    INSERT INTO items (
        id,
        item_type_id,
        user_id,
        level,
        is_styled,
        current_stats,
        material_combo_hash,
        generated_image_url,
        image_generation_status
    ) VALUES (
        v_starter_item_id,
        v_starter_item_type.id,
        p_user_id,
        1,                                  -- level 1
        false,                             -- not styled
        v_starter_item_type.base_stats_normalized, -- copy base stats to current_stats
        NULL,                              -- no material combo hash
        NULL,                              -- no custom image
        NULL                               -- no image generation status
    );

    -- Insert empty equipment slots (8 slots total)
    FOR v_slot_name IN SELECT slot_name FROM equipmentslots ORDER BY sort_order LOOP
        INSERT INTO userequipment (
            user_id,
            slot_name,
            item_id,
            equipped_at
        ) VALUES (
            p_user_id,
            v_slot_name,
            NULL,  -- all slots start empty
            NULL
        );
    END LOOP;

    -- Return the created user profile
    RETURN QUERY
    SELECT
        u.id,
        u.email,
        u.vanity_level,
        u.avg_item_level,
        u.created_at
    FROM users u
    WHERE u.id = p_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.init_profile(uuid, text) TO authenticated;