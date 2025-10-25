-- Migration: Add enemy_type_styles junction table for weighted style selection
-- Purpose: Allow each enemy type to have multiple style options with spawn weights
-- Created: 2025-10-24

-- Step 1: Create the junction table
CREATE TABLE IF NOT EXISTS public.enemy_type_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enemy_type_id UUID NOT NULL REFERENCES public.enemy_types(id) ON DELETE CASCADE,
  style_id UUID NOT NULL REFERENCES public.style_definitions(id) ON DELETE RESTRICT,
  weight_multiplier NUMERIC NOT NULL DEFAULT 1.0 CHECK (weight_multiplier > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(enemy_type_id, style_id)
);

-- Step 2: Add comments for clarity
COMMENT ON TABLE public.enemy_type_styles IS 'Junction table mapping enemy types to multiple possible style definitions with weighted selection probabilities';
COMMENT ON COLUMN public.enemy_type_styles.weight_multiplier IS 'Weight for this style during random selection. Higher values = higher probability of selection. Normalized during selection logic.';

-- Step 3: Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_enemy_type_styles_enemy_type_id ON public.enemy_type_styles(enemy_type_id);
CREATE INDEX IF NOT EXISTS idx_enemy_type_styles_style_id ON public.enemy_type_styles(style_id);

-- Step 4: Migrate existing data from style_id column to junction table
-- This preserves all existing enemy-style relationships with weight 1.0
INSERT INTO public.enemy_type_styles (enemy_type_id, style_id, weight_multiplier)
SELECT id, style_id, 1.0
FROM public.enemy_types
WHERE style_id IS NOT NULL
ON CONFLICT (enemy_type_id, style_id) DO NOTHING;

-- Step 5: Drop the old style_id column from enemy_types
-- NOTE: This step is commented out initially for safety.
-- Uncomment after verifying the data migration was successful.
-- ALTER TABLE public.enemy_types DROP COLUMN style_id;

-- Verification query (run after migration):
-- SELECT et.id, et.name, COUNT(ets.style_id) as style_count
-- FROM public.enemy_types et
-- LEFT JOIN public.enemy_type_styles ets ON et.id = ets.enemy_type_id
-- GROUP BY et.id, et.name
-- ORDER BY style_count DESC;
