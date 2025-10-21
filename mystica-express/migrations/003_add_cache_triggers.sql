-- Migration: Add Database Triggers for Cache Maintenance
-- Date: 2025-01-21
-- Description: Adds trigger functions and triggers to maintain cached data consistency
--              Based on requirements from data-plan.yaml:1214-1220

-- =============================================
-- TRIGGER FUNCTIONS
-- =============================================

-- Function: Recalculate user's vanity level and avg item level
CREATE OR REPLACE FUNCTION fn_update_user_stats() RETURNS TRIGGER AS $$
BEGIN
    UPDATE Users SET
        vanity_level = COALESCE((
            SELECT SUM(i.level)
            FROM UserEquipment ue
            JOIN Items i ON ue.item_id = i.id
            WHERE ue.user_id = COALESCE(NEW.user_id, OLD.user_id)
              AND ue.item_id IS NOT NULL
        ), 0),
        avg_item_level = (
            SELECT AVG(i.level)
            FROM UserEquipment ue
            JOIN Items i ON ue.item_id = i.id
            WHERE ue.user_id = COALESCE(NEW.user_id, OLD.user_id)
              AND ue.item_id IS NOT NULL
        )
    WHERE id = COALESCE(NEW.user_id, OLD.user_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function: Update item material combo hash and styled flag
CREATE OR REPLACE FUNCTION fn_update_item_material_data() RETURNS TRIGGER AS $$
DECLARE
    target_item_id UUID;
    material_ids UUID[];
    style_ids UUID[];
    combo_hash_val TEXT;
    has_styled_material BOOLEAN;
BEGIN
    -- Get item_id from the trigger context
    target_item_id := COALESCE(NEW.item_id, OLD.item_id);

    -- Get sorted arrays of material_ids and style_ids for this item
    SELECT
        array_agg(mi.material_id ORDER BY mi.material_id),
        array_agg(mi.style_id ORDER BY mi.material_id)
    INTO material_ids, style_ids
    FROM ItemMaterials im
    JOIN MaterialInstances mi ON im.material_instance_id = mi.id
    WHERE im.item_id = target_item_id;

    -- Compute deterministic hash from sorted arrays
    combo_hash_val := md5(array_to_string(material_ids, ',') || '|' || array_to_string(style_ids, ','));

    -- Check if any material has non-normal style
    SELECT EXISTS(
        SELECT 1
        FROM ItemMaterials im
        JOIN MaterialInstances mi ON im.material_instance_id = mi.id
        JOIN StyleDefinitions sd ON mi.style_id = sd.id
        WHERE im.item_id = target_item_id
          AND sd.style_name != 'normal'
    ) INTO has_styled_material;

    -- Update item with new hash and styled flag
    UPDATE Items SET
        material_combo_hash = combo_hash_val,
        is_styled = COALESCE(has_styled_material, FALSE)
    WHERE id = target_item_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function: Set image generation status to pending when combo hash changes
CREATE OR REPLACE FUNCTION fn_set_image_generation_pending() RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger if material_combo_hash actually changed
    IF OLD.material_combo_hash IS DISTINCT FROM NEW.material_combo_hash THEN
        NEW.image_generation_status := 'pending';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Recalculate item current_stats (if cached)
CREATE OR REPLACE FUNCTION fn_update_item_stats() RETURNS TRIGGER AS $$
DECLARE
    target_item_id UUID;
    base_stats JSON;
    material_modifiers JSON;
    final_stats JSON;
BEGIN
    -- Get item_id from context - for Items table updates, use NEW.id or OLD.id
    target_item_id := COALESCE(NEW.id, OLD.id);

    -- Only proceed if Items.current_stats is used for caching (vs computed in views)
    -- This is a placeholder - actual implementation depends on whether current_stats is cached
    -- If using v_item_total_stats view, this trigger may be unnecessary

    -- TODO: Implement stats recalculation if current_stats field is used for caching
    -- For now, set to NULL to force recomputation via views
    UPDATE Items SET current_stats = NULL WHERE id = target_item_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function: Update user stats when item level changes (for equipped items)
CREATE OR REPLACE FUNCTION fn_update_user_stats_for_item_level() RETURNS TRIGGER AS $$
DECLARE
    affected_user_id UUID;
BEGIN
    -- Find user who has this item equipped
    SELECT user_id INTO affected_user_id
    FROM UserEquipment
    WHERE item_id = NEW.id
      AND item_id IS NOT NULL
    LIMIT 1;

    -- If item is equipped, update that user's stats
    IF affected_user_id IS NOT NULL THEN
        UPDATE Users SET
            vanity_level = COALESCE((
                SELECT SUM(i.level)
                FROM UserEquipment ue
                JOIN Items i ON ue.item_id = i.id
                WHERE ue.user_id = affected_user_id
                  AND ue.item_id IS NOT NULL
            ), 0),
            avg_item_level = (
                SELECT AVG(i.level)
                FROM UserEquipment ue
                JOIN Items i ON ue.item_id = i.id
                WHERE ue.user_id = affected_user_id
                  AND ue.item_id IS NOT NULL
            )
        WHERE id = affected_user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- 1. UserEquipment changes → recalculate user stats
CREATE TRIGGER tg_user_equipment_stats_update
    AFTER INSERT OR UPDATE OR DELETE ON UserEquipment
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_user_stats();

-- 2. Items.level changes → recalculate user stats (if equipped)
CREATE TRIGGER tg_items_level_user_stats_update
    AFTER UPDATE OF level ON Items
    FOR EACH ROW
    WHEN (OLD.level IS DISTINCT FROM NEW.level)
    EXECUTE FUNCTION fn_update_user_stats_for_item_level();

-- 3. ItemMaterials changes → update item material data
CREATE TRIGGER tg_item_materials_combo_update
    AFTER INSERT OR UPDATE OR DELETE ON ItemMaterials
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_item_material_data();

-- 4. Items.level changes → recalculate item stats (if cached)
CREATE TRIGGER tg_items_level_stats_update
    AFTER UPDATE OF level ON Items
    FOR EACH ROW
    WHEN (OLD.level IS DISTINCT FROM NEW.level)
    EXECUTE FUNCTION fn_update_item_stats();

-- 5. Items.material_combo_hash changes → set image generation pending
CREATE TRIGGER tg_items_combo_hash_image_pending
    BEFORE UPDATE OF material_combo_hash ON Items
    FOR EACH ROW
    WHEN (OLD.material_combo_hash IS DISTINCT FROM NEW.material_combo_hash)
    EXECUTE FUNCTION fn_set_image_generation_pending();