/**
 * Import Monsters from Character Animator
 *
 * This script imports monsters from character-animator/characters_200.csv into the database.
 * - Parses CSV with monster descriptions and filenames
 * - Generates AI metadata (personality, dialogue, stats) via OpenAI
 * - Uploads base image and sprite sheets to R2
 * - Inserts records into enemytypes table
 *
 * Usage:
 *   pnpm import-monsters --batch                    # Import all monsters
 *   pnpm import-monsters "filename1" "filename2"    # Import specific monsters
 *   pnpm import-monsters --batch --dry-run          # Test without DB/R2 writes
 *
 * Environment Variables Required:
 *   OPENAI_API_KEY          - For AI metadata generation
 *   CLOUDFLARE_ACCOUNT_ID   - For R2 uploads
 *   R2_ACCESS_KEY_ID        - For R2 uploads
 *   R2_SECRET_ACCESS_KEY    - For R2 uploads
 *   R2_BUCKET_NAME          - R2 bucket name
 *   R2_PUBLIC_URL           - R2 public URL base
 *   SUPABASE_URL            - Database connection
 *   SUPABASE_SERVICE_ROLE_KEY - Admin database access
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parse/sync';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { uploadMonsterAssets, MonsterAssetPaths } from './r2-service.js';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.local'), override: true });

// Validate required environment variables
const REQUIRED_ENV_VARS = [
  'OPENAI_API_KEY',
  'CLOUDFLARE_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Lazy Supabase client getter
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    validateEnv();
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

// ============================================================================
// Types & Schemas
// ============================================================================

interface MonsterCSVRow {
  description: string;
  filename: string;
}

interface MonsterMetadata {
  name: string;
  description: string;
  tier_id: number;
  base_hp: number;
  atk_power_normalized: number;
  atk_accuracy_normalized: number;
  def_power_normalized: number;
  def_accuracy_normalized: number;
  ai_personality_traits: Record<string, any>;
  dialogue_tone: string;
  dialogue_guidelines: string;
}

const MonsterAIMetadataSchema = z.object({
  name: z.string().describe('Human-readable monster name (e.g., "Sci-Fi Alien Warrior")'),
  personality_traits: z.object({
    aggression: z.number().min(1).max(10),
    intelligence: z.number().min(1).max(10),
    cunning: z.number().min(1).max(10),
    hostility: z.number().min(1).max(10)
  }).describe('Personality trait scores 1-10'),
  dialogue_tone: z.string().describe('Dialogue tone (e.g., "menacing", "sarcastic", "robotic")'),
  dialogue_guidelines: z.string().describe('Short description of speech patterns and style'),
  base_hp: z.number().min(80).max(200).describe('Base hit points'),
  atk_power: z.number().min(0).max(1).describe('Attack power normalized (0.0-1.0)'),
  atk_accuracy: z.number().min(0).max(1).describe('Attack accuracy normalized (0.0-1.0)'),
  def_power: z.number().min(0).max(1).describe('Defense power normalized (0.0-1.0)'),
  def_accuracy: z.number().min(0).max(1).describe('Defense accuracy normalized (0.0-1.0)')
});

const MONSTER_AI_GENERATION_PROMPT = `You are generating game metadata for enemy monsters in a mobile RPG.

Given a visual description of a monster, generate:
1. A human-readable name (capitalize properly, 2-4 words)
2. Personality traits (aggression, intelligence, cunning, hostility) as scores 1-10
3. Dialogue tone (1-2 words: menacing, sarcastic, robotic, playful, etc.)
4. Dialogue guidelines (1 sentence describing how this monster speaks)
5. Combat stats:
   - base_hp: 80-200 (integer)
   - atk_power, atk_accuracy, def_power, def_accuracy: 0.0-1.0 (normalized decimals)

CRITICAL: The four normalized stats (atk_power, atk_accuracy, def_power, def_accuracy) must sum to EXACTLY 1.0.
This is a budget allocation - you have 1.0 total points to distribute across the four stats.

Guidelines for distribution:
- Balanced monster: 0.25, 0.25, 0.25, 0.25 (equal distribution)
- Glass cannon: atk_power 0.4, atk_accuracy 0.4, def_power 0.1, def_accuracy 0.1
- Tank: def_power 0.4, def_accuracy 0.4, atk_power 0.1, atk_accuracy 0.1
- Precision striker: atk_accuracy 0.5, atk_power 0.3, def_power 0.1, def_accuracy 0.1
- Aggressive brawler: atk_power 0.5, atk_accuracy 0.2, def_power 0.2, def_accuracy 0.1

Balance stats based on the monster's description:
- Powerful/large creatures: Higher HP and atk_power (0.7-0.9)
- Fast/agile creatures: Higher atk_accuracy (0.7-0.9)
- Armored/tank creatures: Higher def_power and def_accuracy (0.7-0.9)
- Intelligent creatures: Higher intelligence, potentially varied tactics
- Aggressive creatures: Higher aggression and atk_power

Examples:
- "a menacing alien warrior" → High aggression (8-9), atk_power: 0.8, atk_accuracy: 0.6, menacing tone
- "a robotic assassin" → High cunning (8-10), atk_power: 0.6, atk_accuracy: 0.85, cold/robotic tone
- "a clockwork automaton" → Moderate intelligence (5-7), balanced stats around 0.5-0.6, mechanical tone
- "a terrifying zombie" → High aggression (9-10), low intelligence (2-3), atk_power: 0.7, def_power: 0.4, guttural/moaning tone

Return structured JSON matching the schema.`;

// ============================================================================
// CSV Parsing
// ============================================================================

function parseMonsterCSV(csvPath: string): MonsterCSVRow[] {
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = csv.parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((row: any) => ({
    description: row.description,
    filename: row.filename
  }));
}

// ============================================================================
// AI Metadata Generation
// ============================================================================

async function generateMonsterMetadata(
  description: string,
  filename: string
): Promise<MonsterMetadata> {
  console.log(`🤖 Generating AI metadata for: ${filename}`);

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: MonsterAIMetadataSchema,
    system: MONSTER_AI_GENERATION_PROMPT,
    prompt: `Monster description: "${description}"\nFilename: ${filename}`
  });

  // Determine tier based on filename category (simple heuristic)
  const tier_id = determineTier(filename, description);

  // Normalize stats to ensure they sum to exactly 1.0 (database constraint)
  const rawSum = object.atk_power + object.atk_accuracy + object.def_power + object.def_accuracy;
  const normalizedStats = {
    atk_power_normalized: object.atk_power / rawSum,
    atk_accuracy_normalized: object.atk_accuracy / rawSum,
    def_power_normalized: object.def_power / rawSum,
    def_accuracy_normalized: object.def_accuracy / rawSum
  };

  return {
    name: object.name,
    description,
    tier_id,
    base_hp: object.base_hp,
    ...normalizedStats,
    ai_personality_traits: object.personality_traits,
    dialogue_tone: object.dialogue_tone,
    dialogue_guidelines: object.dialogue_guidelines
  };
}

function determineTier(filename: string, description: string): number {
  // Simple tier assignment based on keywords
  const desc = description.toLowerCase();

  // Tier 1: Common/weak enemies
  if (desc.includes('small') || desc.includes('weak') || desc.includes('common')) {
    return 1;
  }

  // Tier 4: Boss-like enemies
  if (desc.includes('massive') || desc.includes('ancient') || desc.includes('legendary') ||
      desc.includes('lord') || desc.includes('king') || desc.includes('queen')) {
    return 4;
  }

  // Tier 3: Elite enemies
  if (desc.includes('elite') || desc.includes('captain') || desc.includes('commander') ||
      desc.includes('powerful')) {
    return 3;
  }

  // Tier 2: Default for most enemies
  return 2;
}

// ============================================================================
// Monster Import
// ============================================================================

interface ImportOptions {
  dryRun?: boolean;
  skipExisting?: boolean;
  csvPath?: string;
  spritesBasePath?: string;
}

async function importMonster(
  csvRow: MonsterCSVRow,
  options: ImportOptions = {}
): Promise<{ success: boolean; error?: string }> {
  const { filename, description } = csvRow;

  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 Importing monster: ${filename}`);
    console.log(`${'='.repeat(60)}`);

    // Step 1: Generate AI metadata
    const metadata = await generateMonsterMetadata(description, filename);
    console.log(`✅ Generated metadata:`, {
      name: metadata.name,
      tier: metadata.tier_id,
      hp: metadata.base_hp,
      personality: metadata.ai_personality_traits
    });

    // Check if monster already exists (by name)
    if (options.skipExisting) {
      const { data: existing } = await getSupabase()
        .from('enemytypes')
        .select('id, name')
        .eq('name', metadata.name)
        .single();

      if (existing) {
        console.log(`⏭️  Monster already exists: ${existing.name} (${existing.id})`);
        return { success: true };
      }
    }

    // Step 2: Insert into database FIRST to get UUID
    let monsterId: string;

    if (!options.dryRun) {
      console.log(`💾 Inserting into database...`);

      const { data, error } = await getSupabase()
        .from('enemytypes')
        .insert({
          name: metadata.name,
          tier_id: metadata.tier_id,
          base_hp: metadata.base_hp,
          atk_power_normalized: metadata.atk_power_normalized,
          atk_accuracy_normalized: metadata.atk_accuracy_normalized,
          def_power_normalized: metadata.def_power_normalized,
          def_accuracy_normalized: metadata.def_accuracy_normalized,
          ai_personality_traits: metadata.ai_personality_traits,
          dialogue_tone: metadata.dialogue_tone,
          dialogue_guidelines: metadata.dialogue_guidelines
        })
        .select('id, name')
        .single();

      if (error) {
        throw error;
      }

      monsterId = data.id;
      console.log(`✅ Monster created in database: ${data.name} (${data.id})`);
    } else {
      monsterId = 'dry-run-uuid';
      console.log(`🔍 [DRY RUN] Would insert monster: ${metadata.name}`);
    }

    // Step 3: Upload assets to R2 using UUID
    const spritePath = path.join(
      options.spritesBasePath || path.join(__dirname, 'character-animator', 'character-animations', 'character-sprites'),
      `${filename}-greenscreen`
    );

    if (!fs.existsSync(spritePath)) {
      throw new Error(`Sprite directory not found: ${spritePath}`);
    }

    let assetUrls: MonsterAssetPaths | null = null;
    if (!options.dryRun) {
      console.log(`📤 Uploading assets to R2 with UUID: ${monsterId}...`);
      assetUrls = await uploadMonsterAssets(monsterId, spritePath);
      console.log(`✅ Assets uploaded:`, {
        base: assetUrls.base_url,
        sprite_count: Object.keys(assetUrls.sprites).length
      });
    } else {
      console.log(`🔍 [DRY RUN] Would upload assets from: ${spritePath} with UUID: ${monsterId}`);
    }

    return { success: true };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Failed to import ${filename}: ${errorMsg}`);
    console.error('Full error:', error);
    return { success: false, error: errorMsg };
  }
}

// ============================================================================
// Batch Import
// ============================================================================

async function importBatch(
  monsters: MonsterCSVRow[],
  options: ImportOptions = {}
): Promise<void> {
  console.log(`\n🚀 Starting batch import for ${monsters.length} monsters...\n`);

  const results = {
    successful: [] as string[],
    failed: [] as { filename: string; error: string }[]
  };

  let totalCost = 0;

  for (let i = 0; i < monsters.length; i++) {
    const monster = monsters[i];
    console.log(`\n[${i + 1}/${monsters.length}] Processing: ${monster.filename}`);

    const result = await importMonster(monster, options);

    if (result.success) {
      results.successful.push(monster.filename);
    } else {
      results.failed.push({
        filename: monster.filename,
        error: result.error || 'Unknown error'
      });
    }

    // Estimate cost (GPT-4o-mini: ~$0.00015 per generation)
    totalCost += 0.00015;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('BATCH IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`\n✅ Successful: ${results.successful.length}/${monsters.length}`);

  if (results.failed.length > 0) {
    console.log(`\n❌ Failed: ${results.failed.length}/${monsters.length}`);
    results.failed.forEach(failure => {
      console.log(`   • ${failure.filename}: ${failure.error}`);
    });
  }

  console.log(`\n💰 Estimated cost: $${totalCost.toFixed(4)} (OpenAI GPT-4o-mini)`);
  console.log('\n' + '='.repeat(60));
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Import Monsters from Character Animator

Usage:
  pnpm import-monsters --batch [options]              # Import all monsters
  pnpm import-monsters "filename1" "filename2"        # Import specific monsters
  pnpm import-monsters --batch --dry-run              # Test without DB/R2 writes

Options:
  --batch                    Batch mode: import all monsters from CSV
  --csv <path>               Path to CSV file (default: ./character-animator/characters_200.csv)
  --sprites <path>           Path to sprites base directory (default: ./character-animator/character-animations/character-sprites)
  --dry-run                  Don't upload to R2 or write to database
  --skip-existing            Skip monsters that already exist in database
  -h, --help                 Show this help message

Environment Variables Required:
  OPENAI_API_KEY, CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL,
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Examples:
  # Import all monsters (default paths)
  pnpm import-monsters --batch

  # Import with custom paths
  pnpm import-monsters --batch --csv /path/to/monsters.csv --sprites /path/to/sprites

  # Test import without writes
  pnpm import-monsters --batch --dry-run

  # Import specific monsters
  pnpm import-monsters "scifi_alien_warrior_001" "horror_zombie_016"

  # Import with custom sprite path
  pnpm import-monsters "scifi_alien_warrior_001" --sprites /custom/path/sprites
`);
    process.exit(0);
  }

  // Validate environment
  validateEnv();

  // Parse options
  const options: ImportOptions = {
    dryRun: args.includes('--dry-run'),
    skipExisting: args.includes('--skip-existing')
  };

  // Parse CSV path
  const csvIndex = args.findIndex(arg => arg === '--csv');
  if (csvIndex !== -1 && args[csvIndex + 1]) {
    options.csvPath = path.resolve(args[csvIndex + 1]);
  } else {
    options.csvPath = path.join(__dirname, 'character-animator', 'characters_200.csv');
  }

  // Parse sprites base path
  const spritesIndex = args.findIndex(arg => arg === '--sprites');
  if (spritesIndex !== -1 && args[spritesIndex + 1]) {
    options.spritesBasePath = path.resolve(args[spritesIndex + 1]);
  } else {
    options.spritesBasePath = path.join(__dirname, 'character-animator', 'character-animations', 'character-sprites');
  }

  const batchMode = args.includes('--batch');

  // Parse CSV
  if (!fs.existsSync(options.csvPath)) {
    console.error(`❌ CSV file not found: ${options.csvPath}`);
    process.exit(1);
  }

  // Validate sprites base path
  if (!fs.existsSync(options.spritesBasePath)) {
    console.error(`❌ Sprites directory not found: ${options.spritesBasePath}`);
    process.exit(1);
  }

  const allMonsters = parseMonsterCSV(options.csvPath);
  console.log(`📋 Loaded ${allMonsters.length} monsters from CSV: ${options.csvPath}`);
  console.log(`📁 Sprites base path: ${options.spritesBasePath}`);

  if (batchMode) {
    await importBatch(allMonsters, options);
  } else {
    // Import specific monsters - filter out option flags and their values
    const filenames = args.filter((arg, index) => {
      if (arg.startsWith('--')) return false;
      if (index > 0 && args[index - 1].startsWith('--')) return false;
      return true;
    });

    if (filenames.length === 0) {
      console.error('❌ No monster filenames provided');
      console.error('Usage: pnpm import-monsters "filename1" "filename2"');
      process.exit(1);
    }

    const monstersToImport = allMonsters.filter(m =>
      filenames.includes(m.filename)
    );

    if (monstersToImport.length === 0) {
      console.error(`❌ No monsters found matching: ${filenames.join(', ')}`);
      process.exit(1);
    }

    console.log(`📦 Importing ${monstersToImport.length} monster(s)...`);

    for (const monster of monstersToImport) {
      await importMonster(monster, options);
    }
  }
}

// Run CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await main().catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  })();
}

export { importMonster, importBatch, generateMonsterMetadata };
