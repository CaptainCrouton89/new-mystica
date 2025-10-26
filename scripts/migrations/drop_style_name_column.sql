-- Migration: Drop redundant style_name column from styledefinitions
-- Date: 2025-10-25
-- Reason: style_name is redundant - we use id for joins and display_name for humans
--
-- This migration removes the style_name column which was a legacy internal identifier.
-- The id column serves as the unique identifier, and display_name is the human-readable label.

-- Drop the unique constraint on style_name first
ALTER TABLE public.styledefinitions
DROP CONSTRAINT IF EXISTS styledefinitions_style_name_key;

-- Drop the style_name column
ALTER TABLE public.styledefinitions
DROP COLUMN IF EXISTS style_name;

-- Verify the change
COMMENT ON TABLE public.styledefinitions IS 'Art style variants for materials and enemies. Uses id for joins and display_name for UI.';
