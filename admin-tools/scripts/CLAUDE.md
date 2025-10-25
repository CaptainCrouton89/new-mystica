# admin-tools/scripts CLAUDE.md

Admin utility scripts for material and item generation, primarily used for seeding the database and R2 storage.

## Key Files

- **generate-material.ts** - Material data generation (names, descriptions, types)
- **generate-item.ts** - Item generation with image synthesis via Replicate API

## Important Patterns

### API Integration
- Uses Replicate API for image generation (`google/nano-banana`, `bytedance/seedream-4`)
- Uses OpenAI for descriptions and fallbacks
- R2 storage via `wrangler` CLI (authenticated globally, no env vars needed)

### Database Access
- Connects to remote Supabase (kofvwxutsmxdszycvluc)
- Uses generated types from `pnpm supabase:types` in parent
- All inserts should be transactional and validated

### Configuration
- Environment: Node.js scripts, run from `admin-tools/scripts/`
- Dependencies managed via pnpm (NOT npm/yarn)
- TypeScript compilation via tsconfig.json

### Error Handling
- Scripts should throw early on validation errors
- No silent failures or fallbacks for API errors
- Log all R2 upload operations for audit trail

## When Working Here

**Before editing:**
1. Check parent [docs/ai-docs/ai-pipeline.md](../../docs/ai-docs/ai-pipeline.md) for image generation patterns
2. Verify database schema in [docs/ai-docs/database.md](../../docs/ai-docs/database.md)
3. Test scripts locally before deploying

**Type Safety:**
- Never use `any` type - import from Supabase types or define interfaces
- Validate API responses with Zod or runtime checks
- Check R2 response status before returning

**Testing:**
- Scripts should support `--dry-run` flag when possible
- Log generated data to stdout before database writes
- Use test materials/items for validation
