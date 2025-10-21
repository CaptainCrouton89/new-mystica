-- Material Transaction RPC Functions
--
-- This migration adds PostgreSQL RPC functions for atomic material operations:
-- 1. apply_material_to_item - Atomically decrement stack, create instance, link to item, update item.is_styled
-- 2. remove_material_from_item - Atomically unlink from item, delete instance, increment stack, update item.is_styled
-- 3. replace_material_on_item - Atomically remove old and apply new material
--
-- These functions ensure data consistency for complex material operations that span multiple tables.

-- ============================================================================
-- 1. apply_material_to_item
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_material_to_item(
  p_user_id UUID,
  p_item_id UUID,
  p_material_id UUID,
  p_style_id UUID,
  p_slot_index INTEGER
) RETURNS TABLE(
  instance_id UUID,
  new_stack_quantity INTEGER,
  item_is_styled BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_quantity INTEGER;
  v_new_quantity INTEGER;
  v_instance_id UUID;
  v_item_is_styled BOOLEAN;
  v_has_styled_materials BOOLEAN;
BEGIN
  -- Validate inputs
  IF p_slot_index < 0 OR p_slot_index > 2 THEN
    RAISE EXCEPTION 'Slot index must be between 0 and 2, got: %', p_slot_index;
  END IF;

  -- Check if slot is already occupied
  IF EXISTS (
    SELECT 1 FROM itemmaterials
    WHERE item_id = p_item_id AND slot_index = p_slot_index
  ) THEN
    RAISE EXCEPTION 'Slot % is already occupied on item %', p_slot_index, p_item_id;
  END IF;

  -- Get current stack quantity with row lock
  SELECT quantity INTO v_current_quantity
  FROM materialstacks
  WHERE user_id = p_user_id
    AND material_id = p_material_id
    AND style_id = p_style_id
  FOR UPDATE;

  -- Check if stack exists and has sufficient quantity
  IF v_current_quantity IS NULL THEN
    RAISE EXCEPTION 'Material stack not found: user_id=%, material_id=%, style_id=%',
      p_user_id, p_material_id, p_style_id;
  END IF;

  IF v_current_quantity < 1 THEN
    RAISE EXCEPTION 'Insufficient materials: have %, need 1', v_current_quantity;
  END IF;

  -- Calculate new quantity
  v_new_quantity := v_current_quantity - 1;

  -- Update or delete stack
  IF v_new_quantity = 0 THEN
    DELETE FROM materialstacks
    WHERE user_id = p_user_id
      AND material_id = p_material_id
      AND style_id = p_style_id;
  ELSE
    UPDATE materialstacks
    SET quantity = v_new_quantity, updated_at = NOW()
    WHERE user_id = p_user_id
      AND material_id = p_material_id
      AND style_id = p_style_id;
  END IF;

  -- Create material instance
  INSERT INTO materialinstances (user_id, material_id, style_id)
  VALUES (p_user_id, p_material_id, p_style_id)
  RETURNING id INTO v_instance_id;

  -- Link instance to item
  INSERT INTO itemmaterials (item_id, material_instance_id, slot_index)
  VALUES (p_item_id, v_instance_id, p_slot_index);

  -- Check if item now has styled materials
  SELECT EXISTS (
    SELECT 1
    FROM itemmaterials im
    JOIN materialinstances mi ON im.material_instance_id = mi.id
    WHERE im.item_id = p_item_id AND mi.style_id != 'normal'
  ) INTO v_has_styled_materials;

  -- Update item is_styled flag
  UPDATE items
  SET is_styled = v_has_styled_materials
  WHERE id = p_item_id;

  -- Return results
  RETURN QUERY SELECT v_instance_id, v_new_quantity, v_has_styled_materials;
END;
$$;

COMMENT ON FUNCTION apply_material_to_item IS 'Atomically apply material to item: decrement stack → create instance → link to item → update item.is_styled';

-- ============================================================================
-- 2. remove_material_from_item
-- ============================================================================

CREATE OR REPLACE FUNCTION remove_material_from_item(
  p_item_id UUID,
  p_slot_index INTEGER
) RETURNS TABLE(
  removed_instance_id UUID,
  material_id UUID,
  style_id UUID,
  user_id UUID,
  new_stack_quantity INTEGER,
  item_is_styled BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_instance_id UUID;
  v_material_id UUID;
  v_style_id UUID;
  v_user_id UUID;
  v_current_quantity INTEGER;
  v_new_quantity INTEGER;
  v_item_is_styled BOOLEAN;
  v_has_styled_materials BOOLEAN;
BEGIN
  -- Validate inputs
  IF p_slot_index < 0 OR p_slot_index > 2 THEN
    RAISE EXCEPTION 'Slot index must be between 0 and 2, got: %', p_slot_index;
  END IF;

  -- Get the applied material instance
  SELECT im.material_instance_id, mi.material_id, mi.style_id, mi.user_id
  INTO v_instance_id, v_material_id, v_style_id, v_user_id
  FROM itemmaterials im
  JOIN materialinstances mi ON im.material_instance_id = mi.id
  WHERE im.item_id = p_item_id AND im.slot_index = p_slot_index;

  -- Check if material is applied to this slot
  IF v_instance_id IS NULL THEN
    RAISE EXCEPTION 'No material applied to slot % on item %', p_slot_index, p_item_id;
  END IF;

  -- Remove from item
  DELETE FROM itemmaterials
  WHERE item_id = p_item_id AND slot_index = p_slot_index;

  -- Delete material instance
  DELETE FROM materialinstances
  WHERE id = v_instance_id;

  -- Get current stack quantity or initialize to 0
  SELECT COALESCE(quantity, 0) INTO v_current_quantity
  FROM materialstacks
  WHERE user_id = v_user_id
    AND material_id = v_material_id
    AND style_id = v_style_id;

  -- Calculate new quantity
  v_new_quantity := v_current_quantity + 1;

  -- Update or create stack
  INSERT INTO materialstacks (user_id, material_id, style_id, quantity)
  VALUES (v_user_id, v_material_id, v_style_id, v_new_quantity)
  ON CONFLICT (user_id, material_id, style_id)
  DO UPDATE SET
    quantity = materialstacks.quantity + 1,
    updated_at = NOW();

  -- Check if item still has styled materials
  SELECT EXISTS (
    SELECT 1
    FROM itemmaterials im
    JOIN materialinstances mi ON im.material_instance_id = mi.id
    WHERE im.item_id = p_item_id AND mi.style_id != 'normal'
  ) INTO v_has_styled_materials;

  -- Update item is_styled flag
  UPDATE items
  SET is_styled = v_has_styled_materials
  WHERE id = p_item_id;

  -- Return results
  RETURN QUERY SELECT v_instance_id, v_material_id, v_style_id, v_user_id, v_new_quantity, v_has_styled_materials;
END;
$$;

COMMENT ON FUNCTION remove_material_from_item IS 'Atomically remove material from item: unlink → delete instance → increment stack → update item.is_styled';

-- ============================================================================
-- 3. replace_material_on_item
-- ============================================================================

CREATE OR REPLACE FUNCTION replace_material_on_item(
  p_user_id UUID,
  p_item_id UUID,
  p_slot_index INTEGER,
  p_new_material_id UUID,
  p_new_style_id UUID
) RETURNS TABLE(
  old_instance_id UUID,
  old_material_id UUID,
  old_style_id UUID,
  old_stack_quantity INTEGER,
  new_instance_id UUID,
  new_stack_quantity INTEGER,
  item_is_styled BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_instance_id UUID;
  v_old_material_id UUID;
  v_old_style_id UUID;
  v_old_user_id UUID;
  v_old_current_quantity INTEGER;
  v_old_new_quantity INTEGER;

  v_new_current_quantity INTEGER;
  v_new_new_quantity INTEGER;
  v_new_instance_id UUID;

  v_item_is_styled BOOLEAN;
  v_has_styled_materials BOOLEAN;
BEGIN
  -- Validate inputs
  IF p_slot_index < 0 OR p_slot_index > 2 THEN
    RAISE EXCEPTION 'Slot index must be between 0 and 2, got: %', p_slot_index;
  END IF;

  -- ========================================
  -- REMOVE OLD MATERIAL
  -- ========================================

  -- Get the current applied material instance
  SELECT im.material_instance_id, mi.material_id, mi.style_id, mi.user_id
  INTO v_old_instance_id, v_old_material_id, v_old_style_id, v_old_user_id
  FROM itemmaterials im
  JOIN materialinstances mi ON im.material_instance_id = mi.id
  WHERE im.item_id = p_item_id AND im.slot_index = p_slot_index;

  -- Check if material is applied to this slot
  IF v_old_instance_id IS NULL THEN
    RAISE EXCEPTION 'No material applied to slot % on item %', p_slot_index, p_item_id;
  END IF;

  -- Verify ownership
  IF v_old_user_id != p_user_id THEN
    RAISE EXCEPTION 'User % does not own the item or material instance', p_user_id;
  END IF;

  -- Remove from item
  DELETE FROM itemmaterials
  WHERE item_id = p_item_id AND slot_index = p_slot_index;

  -- Delete old material instance
  DELETE FROM materialinstances
  WHERE id = v_old_instance_id;

  -- Restore old material to stack
  SELECT COALESCE(quantity, 0) INTO v_old_current_quantity
  FROM materialstacks
  WHERE user_id = v_old_user_id
    AND material_id = v_old_material_id
    AND style_id = v_old_style_id;

  v_old_new_quantity := v_old_current_quantity + 1;

  INSERT INTO materialstacks (user_id, material_id, style_id, quantity)
  VALUES (v_old_user_id, v_old_material_id, v_old_style_id, v_old_new_quantity)
  ON CONFLICT (user_id, material_id, style_id)
  DO UPDATE SET
    quantity = materialstacks.quantity + 1,
    updated_at = NOW();

  -- ========================================
  -- APPLY NEW MATERIAL
  -- ========================================

  -- Get new material stack quantity with row lock
  SELECT quantity INTO v_new_current_quantity
  FROM materialstacks
  WHERE user_id = p_user_id
    AND material_id = p_new_material_id
    AND style_id = p_new_style_id
  FOR UPDATE;

  -- Check if new stack exists and has sufficient quantity
  IF v_new_current_quantity IS NULL THEN
    RAISE EXCEPTION 'New material stack not found: user_id=%, material_id=%, style_id=%',
      p_user_id, p_new_material_id, p_new_style_id;
  END IF;

  IF v_new_current_quantity < 1 THEN
    RAISE EXCEPTION 'Insufficient new materials: have %, need 1', v_new_current_quantity;
  END IF;

  -- Calculate new quantity
  v_new_new_quantity := v_new_current_quantity - 1;

  -- Update or delete new material stack
  IF v_new_new_quantity = 0 THEN
    DELETE FROM materialstacks
    WHERE user_id = p_user_id
      AND material_id = p_new_material_id
      AND style_id = p_new_style_id;
  ELSE
    UPDATE materialstacks
    SET quantity = v_new_new_quantity, updated_at = NOW()
    WHERE user_id = p_user_id
      AND material_id = p_new_material_id
      AND style_id = p_new_style_id;
  END IF;

  -- Create new material instance
  INSERT INTO materialinstances (user_id, material_id, style_id)
  VALUES (p_user_id, p_new_material_id, p_new_style_id)
  RETURNING id INTO v_new_instance_id;

  -- Link new instance to item
  INSERT INTO itemmaterials (item_id, material_instance_id, slot_index)
  VALUES (p_item_id, v_new_instance_id, p_slot_index);

  -- Check if item now has styled materials
  SELECT EXISTS (
    SELECT 1
    FROM itemmaterials im
    JOIN materialinstances mi ON im.material_instance_id = mi.id
    WHERE im.item_id = p_item_id AND mi.style_id != 'normal'
  ) INTO v_has_styled_materials;

  -- Update item is_styled flag
  UPDATE items
  SET is_styled = v_has_styled_materials
  WHERE id = p_item_id;

  -- Return results
  RETURN QUERY SELECT
    v_old_instance_id,
    v_old_material_id,
    v_old_style_id,
    v_old_new_quantity,
    v_new_instance_id,
    v_new_new_quantity,
    v_has_styled_materials;
END;
$$;

COMMENT ON FUNCTION replace_material_on_item IS 'Atomically replace material on item: remove old → apply new (combines both operations)';

-- ============================================================================
-- Indexes and Permissions
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION apply_material_to_item TO authenticated;
GRANT EXECUTE ON FUNCTION remove_material_from_item TO authenticated;
GRANT EXECUTE ON FUNCTION replace_material_on_item TO authenticated;

-- Additional indexes for performance (if not already present)
CREATE INDEX IF NOT EXISTS idx_itemmaterials_item_id_slot_index ON itemmaterials(item_id, slot_index);
CREATE INDEX IF NOT EXISTS idx_materialstacks_user_material_style ON materialstacks(user_id, material_id, style_id);
CREATE INDEX IF NOT EXISTS idx_materialinstances_user_material ON materialinstances(user_id, material_id);

-- ============================================================================
-- Migration Validation
-- ============================================================================

-- Test data validation (removed in production)
DO $$
BEGIN
  -- Verify functions were created successfully
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'apply_material_to_item') THEN
    RAISE EXCEPTION 'Function apply_material_to_item was not created successfully';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'remove_material_from_item') THEN
    RAISE EXCEPTION 'Function remove_material_from_item was not created successfully';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'replace_material_on_item') THEN
    RAISE EXCEPTION 'Function replace_material_on_item was not created successfully';
  END IF;

  RAISE NOTICE 'Material transaction RPC functions created successfully';
END $$;