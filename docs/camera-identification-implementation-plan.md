# Camera Identification Implementation Plan

## Overview

**Feature:** Players defeat enemies → rare chance to earn custom item/material tickets → use tickets to take photos → AI creates unique game assets

**Primary Use Case:** Combat rewards (rare drops)
**Implementation:** Option B (Single Endpoint, Blocking)

---

## Complete User Journey

### Combat Loot Integration (Primary Flow)

```
Player defeats enemy in combat
    ↓
Loot generation (combat/loot.ts)
    ├─ Standard loot (gold, materials, items)
    └─ RARE: Custom Item Ticket OR Custom Material Ticket (5% drop rate)
    ↓
Victory screen shows loot
    ├─ Gold: +150
    ├─ Materials: Fire Essence x1, Wood x2
    └─ 🎫 Custom Item Ticket x1  ← SPECIAL CARD
    ↓
Player taps "Custom Item Ticket" card
    ↓
Opens camera interface
    ↓
Takes photo of real-world object
    ↓
[Camera Upload & Identification Flow - see below]
    ↓
New unique item/material added to inventory
    ↓
Ticket consumed (quantity decreased by 1)
```

### Camera Upload & Identification Flow

```
User uploads photo (via ticket redemption)
    ↓
Upload to R2 (uploads/user-photos/)
    ↓
AI Vision Identification (OpenAI GPT-4.1)
    ├─ Classify: item vs material
    ├─ Generate name + description
    ├─ Determine category (if item)
    ├─ Generate stats/modifiers
    └─ Assign rarity (if item)
    ↓
Create Database Records
    ├─ If material: INSERT into materials table
    └─ If item: INSERT into itemtypes + items tables
    ↓
Generate Game Asset (Replicate + R2)
    ├─ Use AI description as prompt
    ├─ Generate with nano-banana model (~20s)
    └─ Upload to R2 (items/ or materials/)
    ↓
Save Identification Record (audit trail)
    ↓
Deduct ticket from player balance
    ↓
Return Complete Item/Material to Client
```

**Total Estimated Time:** 18-30 seconds (blocking)

---

## Ticket System Design

### Currency-Based Tickets

**Why Currency System?**
- Tickets are consumable and stackable (like gold)
- Natural fit for existing `currencies` and `usercurrencybalances` tables
- Easy balance checks: "Do you have a ticket?"
- Integrates cleanly with combat reward system
- No clutter in item inventory

**New Currency Types:**

| Code | Display Name | Description | Drop Rate | Premium |
|------|-------------|-------------|-----------|---------|
| CUSTOM_ITEM_TICKET | Custom Item Ticket | Allows creation of unique item from photo | 5% from combat | false |
| CUSTOM_MATERIAL_TICKET | Custom Material Ticket | Allows creation of unique material from photo | 5% from combat | false |

### Drop Mechanics

**Enemy Loot Integration:**
- Add new lootable_type: `'currency'` (extends existing 'material', 'item_type')
- Add entries to `enemyloot` table for each enemy type
- Drop weights: 5 (compared to materials ~50-100, makes it rare)
- Not guaranteed: `guaranteed = false`
- Only one ticket type per combat victory (not both)

**Example Loot Table Entry:**
```sql
INSERT INTO enemyloot (enemy_type_id, lootable_type, lootable_id, drop_weight, guaranteed)
VALUES
  ('{goblin_id}', 'currency', '{CUSTOM_ITEM_TICKET_id}', 5, false),
  ('{goblin_id}', 'currency', '{CUSTOM_MATERIAL_TICKET_id}', 5, false);
```

### Player Balance Tracking

Uses existing `usercurrencybalances` table:
```sql
SELECT quantity FROM usercurrencybalances
WHERE user_id = '{userId}' AND currency_code = 'CUSTOM_ITEM_TICKET';
```

Redemption decrements balance:
```sql
UPDATE usercurrencybalances
SET quantity = quantity - 1
WHERE user_id = '{userId}' AND currency_code = 'CUSTOM_ITEM_TICKET';
```

---

## API Specification

### Primary Endpoint: Redeem Ticket

**POST /api/v1/camera/redeem-ticket**

**Authentication:** Required (Bearer token)

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `image` (file) - Max size: 10MB, types: `image/*`
  - `ticket_type` (string) - `"item"` or `"material"`

**Pre-flight Validation:**
1. Check user has ticket balance: `usercurrencybalances.quantity >= 1`
2. Reject with 400 if insufficient tickets

**Request Example:**
```bash
curl -X POST https://api.mystica.com/api/v1/camera/redeem-ticket \
  -H "Authorization: Bearer {token}" \
  -F "image=@sword_photo.jpg" \
  -F "ticket_type=item"
```

**Response (Material):**
```json
{
  "success": true,
  "result_type": "material",
  "material": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Dragon Scale",
    "description": "Iridescent crimson scale with metallic sheen and sharp edges",
    "stat_modifiers": {
      "atkPower": 5,
      "atkAccuracy": 3,
      "defPower": 8,
      "defAccuracy": 2
    },
    "base_drop_weight": 10,
    "image_url": "https://pub-xxx.r2.dev/materials/dragon_scale_1735123456.png",
    "quantity": 1
  },
  "identification": {
    "id": "uuid",
    "uploaded_image_url": "https://pub-xxx.r2.dev/uploads/user-photos/user123/1735123456.jpg",
    "ai_reasoning": "Identified as material due to texture and substance-like appearance"
  },
  "ticket": {
    "type": "CUSTOM_MATERIAL_TICKET",
    "consumed": 1,
    "remaining_balance": 0
  }
}
```

**Response (Item):**
```json
{
  "success": true,
  "result_type": "item",
  "item": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "item_type_id": "770e8400-e29b-41d4-a716-446655440000",
    "name": "Fire Sword",
    "base_type": "Fire Sword",
    "category": "weapon",
    "rarity": "rare",
    "level": 1,
    "description": "Ancient blade wreathed in eternal flames, forged in dragon fire",
    "base_stats": {
      "atkPower": 45,
      "atkAccuracy": 35,
      "defPower": 10,
      "defAccuracy": 5
    },
    "current_stats": {
      "atkPower": 45,
      "atkAccuracy": 35,
      "defPower": 10,
      "defAccuracy": 5
    },
    "materials": [],
    "image_url": "https://pub-xxx.r2.dev/items/fire_sword_1735123456.png",
    "is_equipped": false,
    "equipped_slot": null
  },
  "identification": {
    "id": "uuid",
    "uploaded_image_url": "https://pub-xxx.r2.dev/uploads/user-photos/user123/1735123456.jpg",
    "ai_reasoning": "Identified as rare weapon due to flame motif, ornate hilt, and sword shape"
  },
  "ticket": {
    "type": "CUSTOM_ITEM_TICKET",
    "consumed": 1,
    "remaining_balance": 2
  }
}
```

**Error Response - Insufficient Tickets (400):**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_TICKETS",
    "message": "You don't have any Custom Item Tickets. Defeat enemies in combat to earn tickets!",
    "details": {
      "required": 1,
      "current_balance": 0,
      "ticket_type": "CUSTOM_ITEM_TICKET"
    }
  }
}
```

**Error Response - Identification Failed (400):**
```json
{
  "success": false,
  "error": {
    "code": "IDENTIFICATION_FAILED",
    "message": "Could not identify item or material from image. Please try a clearer photo."
  }
}
```

**Error Response - Type Mismatch (400):**
```json
{
  "success": false,
  "error": {
    "code": "TYPE_MISMATCH",
    "message": "AI identified this as a material, but you used an item ticket. Please use a material ticket instead.",
    "details": {
      "ticket_type_used": "item",
      "ai_identified_type": "material"
    }
  }
}
```

**Timeout:** 60 seconds

### Helper Endpoint: Check Ticket Balance

**GET /api/v1/camera/tickets**

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "success": true,
  "tickets": {
    "CUSTOM_ITEM_TICKET": 3,
    "CUSTOM_MATERIAL_TICKET": 1
  }
}
```

---

## AI Identification Schema

### Extended Identification Object

The AI will return structured data conforming to this schema:

```typescript
{
  // Common fields
  name: string;              // e.g., "Dragon Scale", "Fire Sword"
  type: 'item' | 'material';
  description: string;       // 10-500 chars, game-ready description
  ai_reasoning?: string;     // Optional debug info

  // Item-specific fields (required if type='item')
  category?: 'weapon' | 'sword' | 'axe' | 'staff' | 'bow' |
             'shield' | 'offhand' |
             'helmet' | 'head' |
             'armor' | 'chestplate' |
             'boots' | 'feet' |
             'ring' | 'necklace' | 'accessory' |
             'pet';
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  base_stats?: {
    atkPower: number;        // 0-200
    atkAccuracy: number;     // 0-200
    defPower: number;        // 0-200
    defAccuracy: number;     // 0-200
  };

  // Material-specific fields (required if type='material')
  stat_modifiers?: {
    atkPower: number;        // -50 to +50
    atkAccuracy: number;     // -50 to +50
    defPower: number;        // -50 to +50
    defAccuracy: number;     // -50 to +50
  };
}
```

### AI Prompt Guidelines

**Classification Bias:**
- Prefer `material` classification for textures, substances, essences
- Use `item` only for complete standalone objects

**Stats Generation Strategy:**

**Items (base_stats at level 1):**
- Common: total stats ~40-60 across 4 stats
- Uncommon: ~60-80
- Rare: ~80-100
- Epic: ~100-120
- Legendary: ~120-150

**Materials (stat_modifiers):**
- Common material: +2 to +5 per stat
- Uncommon: +5 to +10
- Rare: +10 to +15 per stat

**Category Determination:**
- Analyze visual cues (blade shape → sword, protective gear → armor)
- Default to generic category if ambiguous (weapon, armor, accessory)
- Map specific types to generic slots (sword → weapon, helmet → head)

### Category Normalization

```typescript
const CATEGORY_MAPPING = {
  // Weapons
  'sword': 'weapon',
  'axe': 'weapon',
  'staff': 'weapon',
  'bow': 'weapon',
  'dagger': 'weapon',
  'mace': 'weapon',
  'spear': 'weapon',

  // Shields
  'shield': 'offhand',

  // Headgear
  'helmet': 'head',
  'hat': 'head',
  'crown': 'head',

  // Body armor
  'chestplate': 'armor',
  'robe': 'armor',
  'tunic': 'armor',

  // Footwear
  'boots': 'feet',
  'shoes': 'feet',
  'sandals': 'feet',

  // Accessories
  'ring': 'accessory',
  'necklace': 'accessory',
  'amulet': 'accessory',
  'bracelet': 'accessory'
} as const;
```

---

## Database Schema

### New Table: camera_identifications

```sql
CREATE TABLE camera_identifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,

  -- Original upload
  uploaded_image_url TEXT NOT NULL,

  -- AI identification results
  identified_type TEXT NOT NULL CHECK (identified_type IN ('item', 'material')),
  identified_name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  ai_generated_stats JSONB,  -- base_stats or stat_modifiers
  rarity TEXT,
  ai_reasoning TEXT,

  -- Created database records
  created_material_id UUID REFERENCES materials(id),
  created_item_type_id UUID REFERENCES itemtypes(id),
  created_item_id UUID REFERENCES items(id),

  -- Generated asset
  generated_asset_url TEXT,

  -- Status tracking
  status TEXT DEFAULT 'complete' CHECK (status IN ('pending', 'complete', 'failed')),
  error_message TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_camera_identifications_user ON camera_identifications(user_id);
CREATE INDEX idx_camera_identifications_created_at ON camera_identifications(created_at DESC);
```

### New Currency Records

**Add to currencies table:**
```sql
INSERT INTO currencies (code, display_name, description, is_premium)
VALUES
  ('CUSTOM_ITEM_TICKET', 'Custom Item Ticket', 'Rare drop from combat. Create a unique item from a photo.', false),
  ('CUSTOM_MATERIAL_TICKET', 'Custom Material Ticket', 'Rare drop from combat. Create a unique material from a photo.', false);
```

### Enemy Loot Table Extensions

**Extend enemyloot.lootable_type CHECK constraint:**
```sql
ALTER TABLE enemyloot
DROP CONSTRAINT enemyloot_lootable_type_check;

ALTER TABLE enemyloot
ADD CONSTRAINT enemyloot_lootable_type_check
CHECK (lootable_type IN ('material', 'item_type', 'currency'));
```

**Add ticket drops to all enemy types:**
```sql
-- Get currency IDs
SELECT id FROM currencies WHERE code = 'CUSTOM_ITEM_TICKET';
SELECT id FROM currencies WHERE code = 'CUSTOM_MATERIAL_TICKET';

-- Add to each enemy type
INSERT INTO enemyloot (enemy_type_id, lootable_type, lootable_id, drop_weight, guaranteed)
SELECT
  et.id as enemy_type_id,
  'currency' as lootable_type,
  c.id as lootable_id,
  5 as drop_weight,
  false as guaranteed
FROM enemytypes et
CROSS JOIN (
  SELECT id FROM currencies WHERE code IN ('CUSTOM_ITEM_TICKET', 'CUSTOM_MATERIAL_TICKET')
) c;
```

**Result:** Each enemy type will have 2 new loot entries (item ticket + material ticket), each with 5% drop weight.

### Modifications to Existing Tables

**materials table:**
- No schema changes needed
- Will INSERT new materials via MaterialRepository

**itemtypes table:**
- No schema changes needed
- Will INSERT new item types via ItemTypeRepository

**items table:**
- No schema changes needed
- Will INSERT new items via ItemRepository

---

## Combat Service Integration

### Loot Generation Changes

**Location:** `mystica-express/src/services/combat/loot.ts`

**Current System:**
- `generateLoot()` queries `enemyloot` table
- Filters by `lootable_type` ('material' or 'item_type')
- Uses weighted random selection

**Required Changes:**

1. **Add currency loot support:**
```typescript
// Add after materialLootEntries and itemLootEntries
const currencyLootEntries: EnemyLootEntry[] = enemyLootEntries.filter(
  entry => entry.lootable_type === 'currency' && entry.lootable_id
);

// Select random currency drops (tickets)
const selectedCurrencyLoots = currencyLootEntries.length > 0
  ? selectRandomLoot(currencyLootEntries, 'normal').slice(0, 1)  // Max 1 ticket per combat
  : [];
```

2. **Return currency in loot result:**
```typescript
return {
  currencies: {
    gold: Math.floor(10 * combatLevel * enemyTier.gold_multiplier),
    tickets: currencyDetails  // NEW: Array of {currency_code, quantity}
  },
  materials: materialDetails,
  items: itemDetails,
  experience: Math.floor(20 * combatLevel * enemyTier.xp_multiplier)
};
```

### Rewards Application Changes

**Location:** `mystica-express/src/services/combat/rewards.ts`

**Required Changes:**

1. **Apply ticket rewards:**
```typescript
// After applying gold
if (rewards.currencies?.tickets) {
  for (const ticket of rewards.currencies.tickets) {
    await profileRepository.addCurrency(
      userId,
      ticket.currency_code,
      ticket.quantity,
      'combat_victory',
      sessionId,
      { sessionId, combatType: 'victory', ticketType: ticket.currency_code }
    );
    logger.debug('✅ Ticket awarded', {
      userId,
      ticketType: ticket.currency_code,
      quantity: ticket.quantity
    });
  }
}
```

2. **Return ticket info in result:**
```typescript
return {
  createdItems,
  awardedTickets: rewards.currencies?.tickets || []  // NEW
};
```

---

## Service Architecture

### CameraIdentificationService

**Location:** `mystica-express/src/services/CameraIdentificationService.ts`

**Dependencies:**
```typescript
class CameraIdentificationService {
  private imageGenerationService: ImageGenerationService;
  private itemRepository: ItemRepository;
  private itemTypeRepository: ItemTypeRepository;
  private materialRepository: MaterialRepository;
  private profileRepository: ProfileRepository;  // NEW: for ticket validation
  private r2Client: S3Client;
  private openai: OpenAI;
}
```

**Public API:**
```typescript
async redeemTicket(
  userId: string,
  imageBuffer: Buffer,
  ticketType: 'item' | 'material'
): Promise<CameraIdentificationResult>

async getTicketBalances(
  userId: string
): Promise<{ CUSTOM_ITEM_TICKET: number; CUSTOM_MATERIAL_TICKET: number }>
```

**Private Methods:**

```typescript
// Step 0: Validate ticket balance (NEW)
private async validateAndDeductTicket(
  userId: string,
  ticketType: 'item' | 'material'
): Promise<{ currencyCode: string; remainingBalance: number }>
// Checks balance, throws BusinessLogicError if insufficient
// Deducts 1 ticket if sufficient
// Returns currency code and new balance

// Step 1: Upload original photo to R2
private async uploadUserPhoto(
  userId: string,
  buffer: Buffer
): Promise<string>
// Returns: https://r2.../uploads/user-photos/{userId}/{timestamp}.jpg

// Step 2: AI identification using OpenAI GPT-4.1 vision
private async identifyFromImage(
  imageUrl: string
): Promise<ExtendedIdentification>
// Uses generateObject with ExtendedIdentificationSchema

// Step 3a: Create new material (if type='material')
private async createNewMaterial(
  identification: ExtendedIdentification
): Promise<Material>
// INSERT into materials table

// Step 3b: Create new item_type + item instance (if type='item')
private async createNewItemType(
  identification: ExtendedIdentification
): Promise<ItemType>
// INSERT into itemtypes table

private async createItemInstance(
  userId: string,
  itemTypeId: string
): Promise<Item>
// INSERT into items table at level 1

// Step 4: Generate game asset using ImageGenerationService
private async generateAsset(
  identification: ExtendedIdentification
): Promise<string>
// Uses Replicate nano-banana model, uploads to R2
// Returns: https://r2.../items/{name}_{timestamp}.png

// Step 5: Save identification record for audit trail
private async saveIdentificationRecord(
  data: IdentificationRecord
): Promise<void>
// INSERT into camera_identifications table

// Helper: Build AI system prompt
private buildIdentificationSystemPrompt(): string
// Returns comprehensive prompt with examples and guidelines
```

---

## Controller & Routes

### CameraController

**Location:** `mystica-express/src/controllers/CameraController.ts`

```typescript
export class CameraController {
  createFromPhoto = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const imageBuffer = req.file!.buffer;

      const result = await cameraIdentificationService.createFromPhoto(
        userId,
        imageBuffer
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
```

### Routes

**Location:** `mystica-express/src/routes/camera.ts`

```typescript
import { Router } from 'express';
import { CameraController } from '../controllers/CameraController.js';
import { authenticate } from '../middleware/auth.js';
import { uploadImage } from '../middleware/upload.js';

const router = Router();
const controller = new CameraController();

router.post(
  '/create-from-photo',
  authenticate,
  uploadImage,
  controller.createFromPhoto
);

export default router;
```

**Register in index.ts:**
```typescript
import cameraRoutes from './camera';
router.use('/camera', cameraRoutes);
```

---

## Middleware

### Upload Middleware

**Location:** `mystica-express/src/middleware/upload.ts`

```typescript
import multer from 'multer';
import { ValidationError } from '../utils/errors.js';

const storage = multer.memoryStorage();

export const uploadImage = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024  // 10MB max
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new ValidationError('Only image files are allowed'));
      return;
    }
    cb(null, true);
  }
}).single('image');
```

---

## R2 Configuration Updates

**Location:** `mystica-express/src/config/r2.ts`

**Add directories:**
```typescript
export const R2_CONFIG = {
  BUCKET_NAME: env.R2_BUCKET_NAME,
  PUBLIC_URL: env.R2_PUBLIC_URL,
  DIRECTORIES: {
    ITEMS: 'items',
    MATERIALS: 'materials',
    IMAGE_REFS: 'image-refs',
    MONSTERS: 'monsters',
    UPLOADS: 'uploads/user-photos',           // NEW
    IDENTIFICATIONS: 'uploads/identifications' // NEW
  } as const,
} as const;
```

**Add helper functions:**
```typescript
export const buildR2Key = {
  // ... existing

  userPhoto: (userId: string, timestamp: number, ext: string): string =>
    `${R2_CONFIG.DIRECTORIES.UPLOADS}/${userId}/${timestamp}.${ext}`,

  identification: (timestamp: number): string =>
    `${R2_CONFIG.DIRECTORIES.IDENTIFICATIONS}/${timestamp}.json`
} as const;
```

---

## Type Definitions

### Zod Schemas

**Location:** `mystica-express/src/types/schemas.ts`

```typescript
export const ExtendedIdentificationSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(['item', 'material']),
  description: z.string().min(10).max(500),

  // Item-specific
  category: z.enum([
    'weapon', 'sword', 'axe', 'staff', 'bow',
    'shield', 'offhand',
    'helmet', 'head',
    'armor', 'chestplate',
    'boots', 'feet',
    'ring', 'necklace', 'accessory',
    'pet'
  ]).optional(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']).optional(),
  base_stats: z.object({
    atkPower: z.number().int().min(0).max(200),
    atkAccuracy: z.number().int().min(0).max(200),
    defPower: z.number().int().min(0).max(200),
    defAccuracy: z.number().int().min(0).max(200)
  }).optional(),

  // Material-specific
  stat_modifiers: z.object({
    atkPower: z.number().int().min(-50).max(50),
    atkAccuracy: z.number().int().min(-50).max(50),
    defPower: z.number().int().min(-50).max(50),
    defAccuracy: z.number().int().min(-50).max(50)
  }).optional(),

  ai_reasoning: z.string().optional()
}).refine(
  data => data.type === 'item'
    ? (data.category && data.rarity && data.base_stats)
    : true,
  { message: "Items must have category, rarity, and base_stats" }
).refine(
  data => data.type === 'material' ? data.stat_modifiers : true,
  { message: "Materials must have stat_modifiers" }
);

export type ExtendedIdentification = z.infer<typeof ExtendedIdentificationSchema>;
```

### API Types

**Location:** `mystica-express/src/types/api.types.ts`

```typescript
export interface CameraIdentificationResult {
  success: true;
  result_type: 'item' | 'material';
  material?: MaterialStackDetailed;
  item?: PlayerItem;
  identification: {
    id: string;
    uploaded_image_url: string;
    ai_reasoning?: string;
  };
}

export interface IdentificationRecord {
  user_id: string;
  uploaded_image_url: string;
  identified_type: 'item' | 'material';
  identified_name: string;
  category?: string;
  description: string;
  ai_generated_stats: Record<string, number>;
  rarity?: string;
  ai_reasoning?: string;
  created_material_id?: string;
  created_item_type_id?: string;
  created_item_id?: string;
  generated_asset_url?: string;
  status: 'pending' | 'complete' | 'failed';
  error_message?: string;
}
```

---

## Error Handling

### Error Types

| Failure Point | HTTP Code | Error Code | Message |
|--------------|-----------|------------|---------|
| File upload failed | 500 | UPLOAD_FAILED | "Failed to upload image to storage" |
| Invalid file type | 400 | INVALID_FILE_TYPE | "Only image files are allowed" |
| File too large | 400 | FILE_TOO_LARGE | "Image must be smaller than 10MB" |
| AI identification failed | 400 | IDENTIFICATION_FAILED | "Could not identify item or material from image" |
| Invalid AI stats | 400 | INVALID_STATS | "Generated stats are out of balance" |
| DB creation failed | 500 | DATABASE_ERROR | "Failed to create item/material record" |
| Asset generation failed | 500 | GENERATION_FAILED | "Failed to generate game asset" |

### Fallback Strategy

**If AI identification fails:**
- Return 400 error, do not create database records

**If stats are invalid (out of range):**
- Use sensible defaults based on rarity tier
- Log warning for review

**If asset generation fails:**
- Still create DB records
- Use placeholder image URL
- Save error in identification record
- Log error for async retry

**All identifications saved:**
- Record saved to `camera_identifications` regardless of success/failure
- Enables debugging and audit trail

---

## Performance Considerations

### Timing Breakdown

| Step | Estimated Time |
|------|---------------|
| Upload photo to R2 | ~500ms |
| AI vision identification | ~2-4s |
| Create database records | ~200ms |
| Generate asset (Replicate) | ~15-25s |
| Upload asset to R2 | ~500ms |
| **Total** | **18-30 seconds** |

### Client Requirements

**Frontend must:**
- Show loading state with progress indication
- Set request timeout to 60s minimum
- Handle timeout gracefully
- Show step-by-step progress if possible:
  - "Analyzing image..."
  - "Generating stats..."
  - "Creating game asset..."
  - "Complete!"

**Backend considerations:**
- Express timeout: 60s
- Railway timeout: 120s (configured in railway.toml)
- No background jobs needed (blocking is acceptable for MVP)

---

## Integration with Existing Systems

### ImageGenerationService

**Reuse existing methods:**
- `uploadToR2(buffer, filename)` - Upload generated assets
- `generateWithReplicate(options)` - Generate from prompt
- `buildReplicatePrompt(name, description)` - Prompt construction

**New integration point:**
```typescript
const assetUrl = await imageGenerationService.generateImage(
  itemTypeId,
  [] // No materials for camera-generated items initially
);
```

### MaterialService

**Extension needed:**
- Add `createMaterial(data)` to MaterialRepository
- No changes to existing material application logic

### ItemService

**Extension needed:**
- Add `createItemType(data)` to ItemTypeRepository
- Reuse existing `createItem(userId, itemTypeId, level)`

### StatsService

**Validation helper:**
```typescript
// Verify AI-generated stats are balanced
validateStatsForRarity(stats: Stats, rarity: Rarity): boolean
```

---

## Testing Strategy

### Manual Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Real sword photo | image/jpeg | Item created, category=weapon, rarity appropriate, stats balanced |
| Wood texture photo | image/png | Material created, stat_modifiers appropriate |
| Random object photo | image/jpeg | Material created (material bias) |
| Armor photo | image/jpeg | Item created, category=armor |
| Non-image file | application/pdf | 400 error: "Only image files allowed" |
| Oversized image | 15MB jpeg | 400 error: "File too large" |
| Corrupted image | invalid jpeg | 400 error: "Identification failed" |

### Verification Checklist

**Stats validation:**
- [ ] Total stats match rarity tier guidelines
- [ ] No negative stats for items
- [ ] Material modifiers within acceptable range

**Category mapping:**
- [ ] Specific categories normalized to equipment slots
- [ ] AI category choices make visual sense

**Asset quality:**
- [ ] Generated images match game art style
- [ ] Images have transparent backgrounds
- [ ] Resolution appropriate (512x512 or higher)

**Database integrity:**
- [ ] Identification records saved for all attempts
- [ ] Foreign keys correctly linked
- [ ] No orphaned records

**Error handling:**
- [ ] Graceful fallbacks for all failure points
- [ ] Clear error messages for users
- [ ] Errors logged for debugging

---

## Implementation Checklist

### Phase 1: Combat Integration & Database Setup
**Goal:** Enable tickets as combat loot rewards

- [ ] **Database Migrations:**
  - [ ] Add CUSTOM_ITEM_TICKET and CUSTOM_MATERIAL_TICKET to `currencies` table
  - [ ] Modify enemyloot CHECK constraint to allow 'currency' lootable_type
  - [ ] Add ticket drops to all enemy types in `enemyloot` (drop_weight: 5)
  - [ ] Create `camera_identifications` table for audit trail

- [ ] **Combat Service Updates:**
  - [ ] Update `combat/loot.ts` to support currency loot filtering
  - [ ] Add currency details fetching in loot generation
  - [ ] Update return type to include `currencies.tickets`
  - [ ] Update `combat/rewards.ts` to apply ticket rewards via ProfileRepository
  - [ ] Update combat response types to include awarded tickets

- [ ] **Testing Combat Integration:**
  - [ ] Defeat enemy → verify ticket appears in loot (rare, ~5%)
  - [ ] Check ticket balance via economy endpoint
  - [ ] Verify ticket tracked in usercurrencybalances

### Phase 2: Dependencies & Infrastructure
- [ ] Add multer to package.json (`pnpm add multer @types/multer`)
- [ ] Update R2 config with UPLOADS and IDENTIFICATIONS directories
- [ ] Verify OPENAI_API_KEY exists in environment (for vision API)

### Phase 3: Middleware & Types
- [ ] Create `src/middleware/upload.ts` with multer configuration
- [ ] Add ExtendedIdentificationSchema to `src/types/schemas.ts`
- [ ] Add RedeemTicketSchema (includes ticket_type validation)
- [ ] Add CameraIdentificationResult to `src/types/api.types.ts`
- [ ] Add ticket balance types

### Phase 4: Service Layer
- [ ] **Create `src/services/CameraIdentificationService.ts`:**
  - [ ] Implement `validateAndDeductTicket()` - check balance & deduct
  - [ ] Implement `getTicketBalances()` - query user currency balances
  - [ ] Implement `uploadUserPhoto()` - upload to R2
  - [ ] Implement `identifyFromImage()` - OpenAI GPT-4.1 vision
  - [ ] Implement `createNewMaterial()` - insert to materials table
  - [ ] Implement `createNewItemType()` - insert to itemtypes table
  - [ ] Implement `createItemInstance()` - insert to items table
  - [ ] Implement `generateAsset()` - call ImageGenerationService
  - [ ] Implement `saveIdentificationRecord()` - audit trail
  - [ ] Implement main `redeemTicket()` orchestrator

### Phase 5: Repository Extensions
- [ ] Add `createMaterial(data)` to MaterialRepository
- [ ] Add `createItemType(data)` to ItemTypeRepository
- [ ] Create CameraIdentificationRepository for audit trail
- [ ] Add ticket balance queries to ProfileRepository (or use existing)

### Phase 6: Controller & Routes
- [ ] **Create `src/controllers/CameraController.ts`:**
  - [ ] `redeemTicket` - POST /camera/redeem-ticket
  - [ ] `getTicketBalances` - GET /camera/tickets
- [ ] Create `src/routes/camera.ts`
- [ ] Register camera routes in `src/routes/index.ts`

### Phase 7: Testing & Validation
**Combat Flow:**
- [ ] Defeat enemy → earn ticket → verify balance increases

**Camera Redemption:**
- [ ] Redeem without ticket → 400 error (insufficient)
- [ ] Redeem item ticket with sword photo → creates item
- [ ] Redeem material ticket with wood texture → creates material
- [ ] Type mismatch (item ticket + AI detects material) → 400 error
- [ ] Verify ticket balance decrements after redemption

**Stats & Assets:**
- [ ] Verify stats balance across rarity tiers
- [ ] Verify asset generation produces game-ready images
- [ ] Verify identification records saved

**Error Handling:**
- [ ] Invalid file type → 400
- [ ] Oversized file → 400
- [ ] Corrupted image → 400
- [ ] Timeout handling → graceful failure

### Phase 8: Frontend Integration (iOS/SwiftUI)
- [ ] Victory screen shows ticket cards with special styling
- [ ] Tapping ticket card opens camera interface
- [ ] Camera upload with loading states (18-30s)
- [ ] Success screen shows created item/material
- [ ] Balance display in inventory/profile

### Phase 9: Documentation & Polish
- [ ] Update API documentation with new endpoints
- [ ] Document ticket drop rates and probabilities
- [ ] Add AI prompt engineering guidelines
- [ ] Add example requests/responses to README
- [ ] Update CLAUDE.md in backend with camera service details

---

## Future Enhancements (Out of Scope for MVP)

**Async Processing:**
- Background job queue for asset generation
- Webhook/polling for completion status
- Progress updates via WebSocket

**User Confirmation:**
- Two-step process with preview
- Allow editing AI-generated name/description
- Manual category override

**Advanced Features:**
- Multiple photos for better identification
- Style transfer from reference images
- User-trained custom models
- Batch upload support

**Quality Improvements:**
- Confidence scoring from AI
- Manual review queue for low confidence
- Community voting on AI identifications
- Feedback loop for AI improvement

---

## Summary

### What This Feature Provides

**For Players:**
- Rare, exciting combat rewards (tickets feel special)
- Creative expression (turn real-world objects into game assets)
- Unique items/materials no other player has
- Personalized gameplay experience

**For Game:**
- User-generated content without moderation burden (AI validates)
- Increased combat engagement (players hunt for tickets)
- Viral potential (players share their creations)
- Reduced asset production costs (players generate content)

### Technical Highlights

**Currency-Based Tickets:**
- Leverages existing infrastructure (currencies, usercurrencybalances)
- Minimal new tables (only camera_identifications for audit)
- Clean integration with combat reward system

**AI-Powered Generation:**
- OpenAI GPT-4.1 vision for identification
- AI generates balanced stats appropriate to rarity
- Replicate nano-banana for consistent game art style
- ~25 second blocking flow (acceptable for special feature)

**Combat Integration:**
- 5% drop rate (rare but obtainable)
- Two ticket types (item vs material)
- Max 1 ticket per combat (maintains rarity)
- Works with existing enemy loot tables

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| AI generates inappropriate content | Material bias reduces object variety; descriptions filtered |
| AI generates unbalanced stats | Stats validation; rarity-based guidelines; can manually adjust |
| Users abuse system (spam photos) | Ticket gating; rate limiting; audit trail in camera_identifications |
| Long blocking requests (30s) | Loading states; clear progress indication; timeout handling |
| AI costs escalate | Monitor usage; adjust drop rates; implement daily limits if needed |
| Asset quality inconsistent | Style prompt engineering; reference images; manual review queue if needed |

### Success Metrics

**Engagement:**
- % of tickets redeemed (target: >80%)
- Time from ticket drop to redemption (target: <24 hours)
- Player retention after first custom item (target: +20%)

**Quality:**
- AI identification accuracy (target: >90%)
- Stats balance (manual review sample)
- Asset generation success rate (target: >95%)

**Economics:**
- Average cost per custom item (AI + generation)
- Ticket drop rate effectiveness (engagement vs scarcity)

---

## Reference Implementation

Based on: `/Users/silasrhyneer/Code/new-mystica/scripts/identify-and-generate-from-image.ts`

**Key differences from script:**
- **Script:** CLI tool with local file paths → **Backend:** HTTP API with database persistence
- **Script:** Uses file system for storage → **Backend:** Uses Supabase + R2
- **Script:** Returns JSON to stdout → **Backend:** Returns structured API response with database IDs
- **Script:** Stats not generated → **Backend:** AI generates balanced stats based on rarity
- **Script:** No ticket system → **Backend:** Ticket-gated via combat rewards
- **Script:** Manual invocation → **Backend:** User-initiated via victory screen
