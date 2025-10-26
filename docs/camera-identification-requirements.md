# Camera Identification Feature Requirements

**Last Updated:** 2025-10-26
**Status:** Requirements Definition
**Feature ID:** TBD

---

## Overview

Players who defeat enemies have a 5% chance to receive an **ephemeral camera opportunity** during the victory screen. This allows them to take a photo of a real-world object and instantly create a custom item or material with AI-generated stats and artwork.

**Key Characteristics:**
- **Ephemeral:** Not a persistent ticket/currency - use it immediately or lose it
- **AI-driven categorization:** AI analyzes photo and decides if it becomes an item or material
- **Blocking flow:** Player waits 18-30 seconds while AI processes photo (intentional anticipation)
- **One-time opportunity:** Cannot be saved, deferred, or retried on failure
- **Immediate modal:** Opportunity appears as full-screen modal, not mixed with regular loot

---

## User Flow

### Victory Screen Flow (5% Trigger)

```
Combat Ends
    ↓
Victory rewards calculated
    ↓
5% chance triggers camera opportunity
    ↓
╔═════════════════════════════════════════╗
║  📸 CAMERA OPPORTUNITY!                 ║  ← Modal expands from center
║                                         ║     (exciting animation)
║  Capture something from your world      ║
║  and transform it into a magical        ║
║  item or material!                      ║
║                                         ║
║  ┌─────────────────┐  ┌──────────────┐ ║
║  │  📷 Capture     │  │  ✕ Skip      │ ║
║  └─────────────────┘  └──────────────┘ ║
╚═════════════════════════════════════════╝

If player taps "Capture":
    → Open camera interface

If player taps "Skip" or dismisses modal:
    → Opportunity lost forever
    → Show normal victory screen with loot
```

**Player Actions:**
1. ✅ **Tap "Capture"** → Opens camera interface
2. ❌ **Tap "Skip" or dismiss** → Opportunity lost, show normal victory screen

### Camera Capture Flow

```
Player taps "Capture" button
    ↓
Camera interface opens (iOS native camera)
    ↓
Player takes photo
    ↓
[BLOCKING] Exciting loading screen (18-30s)
    "Channeling magical energy..."
    "Analyzing your discovery..."
    (Anticipation is intentional)
    ↓
AI Pipeline Processing:
    ├─ Upload photo to R2
    ├─ OpenAI GPT-4.1 Vision analyzes photo
    ├─ AI decides: item or material?
    ├─ Generates name, description, rarity, stat distribution
    ├─ Nano-banana generates game asset artwork
    └─ Creates item/material in database
    ↓
Success modal appears:
    ╔═══════════════════════════════════╗
    ║  ✨ Created: Obsidian Dagger     ║
    ║                                   ║
    ║  [Generated artwork preview]      ║
    ║                                   ║
    ║  Rarity: Rare                     ║
    ║  Attack: 85 | Weight: 1.2kg       ║
    ║                                   ║
    ║  Added to your inventory!         ║
    ╚═══════════════════════════════════╝
    ↓
Player dismisses → Normal victory screen with other loot
```

**Error Handling:**
- Upload fails → Opportunity lost, show error message
- AI identification fails → Opportunity lost, show error message
- Asset generation fails → Opportunity lost, show error message
- Connection timeout → Opportunity lost, show error message

*Note: All failures consume the opportunity (ephemeral design)*

---

## Technical Requirements

### 1. Combat Loot System Integration

**Trigger:**
- 5% chance per enemy defeat (applied after all other loot calculations)
- AI decides whether photo becomes item or material (no pre-assignment)

**Loot Data Structure:**
```typescript
interface CameraOpportunity {
  type: 'camera_opportunity';
  triggered: boolean;
  // No other metadata needed - ephemeral, AI decides type from photo
}
```

**Implementation:**
```typescript
// In combat/loot.ts
const hasCameraOpportunity = Math.random() < 0.05;

return {
  materials: [...],
  items: [...],
  gold: ...,
  xp: ...,
  cameraOpportunity: hasCameraOpportunity
};
```

---

### 2. API Specification

#### **POST /api/v1/camera/create-from-photo**

Creates item or material from uploaded photo during active camera opportunity.

**Request:**
```typescript
{
  photo: File;                      // Multipart file upload (max 10MB, jpg/png)
}
```

**Response (Success - 201):**
```typescript
{
  success: true,
  created_type: 'item' | 'material',
  item?: {
    item_id: string;
    item_type_id: string;
    name: string;
    description: string;
    image_url: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    stats: ItemStats;
    category: string;
  },
  material?: {
    material_id: string;
    name: string;
    description: string;
    image_url: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    stats: MaterialStats;
  },
  processing_time_ms: number;
}
```

**Response (Error - 400/500):**
```typescript
{
  success: false,
  error: string;
  error_code:
    | 'UPLOAD_FAILED'             // Photo upload to R2 failed
    | 'IDENTIFICATION_FAILED'     // AI couldn't identify object
    | 'GENERATION_FAILED'         // Asset generation failed
    | 'INVALID_FILE'              // File too large, wrong format, corrupted
}
```

**Validation Rules:**
- Photo must be jpg/png, max 10MB

---

### 3. AI Processing Pipeline

#### Step 1: Photo Upload
```typescript
// Upload to R2: uploads/user-photos/{user_id}/{timestamp}.jpg
const photoUrl = await uploadToR2(photoBuffer, 'uploads/user-photos');
```

#### Step 2: OpenAI GPT-4.1 Vision Identification
```typescript
const identificationSchema = z.object({
  type: z.enum(['item', 'material']),
  name: z.string(),
  description: z.string(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
  category: z.string(), // For items: 'sword', 'staff', 'armor', etc. For materials: 'metal', 'herb', 'gem', etc.
  stat_distribution: z.object({
    // Four core stats that add up to 1.0 (or 0 if no stats)
    physical: z.number().min(0).max(1),
    magical: z.number().min(0).max(1),
    defense: z.number().min(0).max(1),
    utility: z.number().min(0).max(1)
  })
});

const { object } = await generateObject({
  model: openai('gpt-4.1'),
  schema: identificationSchema,
  system: `You are a mystical appraiser for a fantasy RPG game.
           Analyze the photo and decide if it should become a game ITEM or MATERIAL.

           Items: Weapons, armor, tools, consumables (things used directly)
           Materials: Raw resources for crafting (metals, herbs, gems, wood, etc.)

           Generate a fantasy name, compelling description, and stat distribution.
           Stat distribution MUST add up to 1.0 (or all zeros if no stats).
           The four core stats are: physical, magical, defense, utility.
           Rarity should match the visual appeal and uniqueness of the object.`,
  messages: [{
    role: 'user',
    content: [
      { type: 'image', image: photoUrl },
      { type: 'text', text: 'Transform this into a magical game asset' }
    ]
  }]
});

// AI naturally decides type - no forcing or retries needed
```

#### Step 3: Stat Generation Guidelines

**Rarity Tiers:**
| Rarity    | Stat Range | Drop Weight |
|-----------|------------|-------------|
| Common    | 40-60      | 60%         |
| Uncommon  | 60-80      | 25%         |
| Rare      | 80-100     | 10%         |
| Epic      | 100-120    | 4%          |
| Legendary | 120-150    | 1%          |

**Item Stats Example:**
```typescript
{
  attack?: number,
  defense?: number,
  magic_power?: number,
  durability: number,
  weight: number
}
```

**Material Stats Example:**
```typescript
{
  quality: number,
  potency?: number,
  stability?: number,
  rarity_modifier: number
}
```

#### Step 4: Asset Generation (Nano-Banana)
```typescript
const prompt = buildGameAssetPrompt(object.name, object.description, object.type);
const assetUrl = await generateWithReplicate('google/nano-banana', prompt);
const finalUrl = await uploadToR2(assetUrl, `${object.type}s/custom`);
```

#### Step 5: Database Creation

**For Items:**
```sql
-- Create new item_type if it doesn't exist
INSERT INTO item_types (name, description, category_id, image_url, base_stats, rarity_id)
VALUES (...);

-- Create user's item instance
INSERT INTO items (user_id, item_type_id, current_stats, source)
VALUES (user_id, new_item_type_id, generated_stats, 'camera_capture');
```

**For Materials:**
```sql
-- Create new material if it doesn't exist
INSERT INTO materials (name, description, image_url, stats, rarity_id)
VALUES (...);

-- Add to user's material inventory
INSERT INTO user_material_inventory (user_id, material_id, quantity)
VALUES (user_id, new_material_id, 1)
ON CONFLICT (user_id, material_id) DO UPDATE SET quantity = quantity + 1;
```

---

### 4. Combat Service Changes

**File: `src/services/combat/loot.ts`**

```typescript
export async function selectEnemyLoot(
  enemyTypeId: string
): Promise<LootResult> {
  // ... existing material/item selection logic ...

  // NEW: Camera opportunity check (5% chance)
  const hasCameraOpportunity = Math.random() < 0.05;

  return {
    materials: selectedMaterials,
    items: selectedItems,
    cameraOpportunity: hasCameraOpportunity
  };
}
```


---

## Frontend Integration Requirements

### Victory Screen Updates

**SwiftUI View:**
```swift
struct VictoryScreenView: View {
  let loot: LootResult
  @State private var showingCameraModal = false
  @State private var showingVictoryScreen = false
  @State private var createdAsset: CameraAsset?

  var body: some View {
    ZStack {
      // Background: Normal victory screen (hidden until camera flow completes)
      if showingVictoryScreen {
        NormalVictoryView(loot: loot, cameraAsset: createdAsset)
          .transition(.opacity)
      }

      // Foreground: Camera opportunity modal (appears immediately if triggered)
      if loot.cameraOpportunity && !showingVictoryScreen {
        CameraOpportunityModal(
          onCapture: { asset in
            createdAsset = asset
            showingVictoryScreen = true
          },
          onSkip: {
            showingVictoryScreen = true
          }
        )
        .transition(.scale.combined(with: .opacity))
        .zIndex(100)
      }
    }
    .onAppear {
      // If no camera opportunity, show victory screen immediately
      if !loot.cameraOpportunity {
        showingVictoryScreen = true
      }
    }
  }
}

// Separate modal component
struct CameraOpportunityModal: View {
  let onCapture: (CameraAsset) -> Void
  let onSkip: () -> Void

  @State private var isPresented = false
  @State private var showingCamera = false
  @State private var isProcessing = false

  var body: some View {
    VStack(spacing: 20) {
      Text("📸 CAMERA OPPORTUNITY!")
        .font(.title)
        .fontWeight(.bold)

      Text("Capture something from your world\nand transform it into a magical\nitem or material!")
        .multilineTextAlignment(.center)

      HStack(spacing: 20) {
        Button("📷 Capture") {
          showingCamera = true
        }
        .buttonStyle(.borderedProminent)

        Button("✕ Skip") {
          onSkip()
        }
        .buttonStyle(.bordered)
      }
    }
    .padding(40)
    .background(.ultraThinMaterial)
    .cornerRadius(20)
    .scaleEffect(isPresented ? 1.0 : 0.7)
    .opacity(isPresented ? 1.0 : 0.0)
    .onAppear {
      withAnimation(.spring(duration: 0.5)) {
        isPresented = true
      }
    }
    .sheet(isPresented: $showingCamera) {
      CameraCaptureView(onComplete: onCapture)
    }
  }
}
```

---

## Success Metrics

**Engagement:**
- % of camera opportunities used (vs. skipped)
- Average time to use opportunity after trigger
- Repeat usage patterns (players who use it once vs. multiple times)

**Quality:**
- % of successful generations vs. failures
- Distribution of AI-chosen item vs. material classifications
- User feedback on created items (if we add rating system)

**Economy:**
- Impact on material/item economy
- Rarity distribution of created assets
- Trading/selling patterns for camera-created items

**Cost:**
- Actual daily spend on AI processing
- Average cost per successful creation
- Cost per active player (to validate 5% drop rate control)

---

## Non-Goals (Explicit Scope Exclusions)

❌ **Ticket persistence** - No saving opportunities for later
❌ **Manual stat editing** - Players can't customize generated stats
❌ **Sharing/trading opportunities** - Cannot transfer to other players
❌ **Retry on failure** - One shot per opportunity
❌ **Preview before commit** - Cannot see generated item before accepting
❌ **Type selection** - AI decides item vs. material based on photo
❌ **Content moderation** - Trust-based system (no pre-screening)
❌ **Duplicate detection** - Allow AI to create duplicate names/items

---

## Implementation Readiness

**Status:** ✅ **Ready for Implementation Planning**

All key design decisions finalized:
- ✅ Ephemeral design (no persistence)
- ✅ AI-driven type classification (no pre-assignment)
- ✅ Immediate modal UX (not loot card)
- ✅ Blocking anticipation flow (18-30s intentional)
- ✅ Standard rarity distribution (60/25/10/4/1)
- ✅ Allow duplicates (no uniqueness logic)
- ✅ Stat distribution generation (four core stats adding up to 1.0)

**Next Steps:**
1. Build implementation plan with task breakdown
2. Implement backend API endpoint (`/api/v1/camera/create-from-photo`)
3. Implement AI processing pipeline (OpenAI + Nano-Banana)
4. Implement SwiftUI modal and camera capture flow
5. Test end-to-end with real photos
6. Monitor success metrics and costs in production
