# Documentation Gap Analysis
**Generated:** 2025-10-20
**Project:** New Mystica
**Status:** Pre-MVP Development

---

## Executive Summary

New Mystica documentation is **75% complete** with comprehensive PRD, system design, API contracts, and data plan. Key gaps:
- **3 missing feature specifications** (F-08, F-09, F-10)
- **7 features without user stories** (58% story coverage gap)
- **Validation script false positives** (reports filled fields as empty)

**Priority:** Complete missing specs for Light MVP features (F-08, F-09) before 2025-10-22 deadline.

---

## 1. Missing Feature Specifications

### 🔴 Critical: F-08 - Design System
**Priority:** Critical
**PRD Reference:** [`docs/product-requirements.yaml:76-79`](file:///Users/silasrhyneer/Code/new-mystica/docs/product-requirements.yaml#L76)
**Status:** Planned
**Target:** Light MVP (3 days, due 2025-10-22)

#### What's Missing
No specification file exists at `docs/feature-specs/F-08-design-system.yaml`

#### Why Critical
- **Light MVP Blocker:** Deadline is 2025-10-22 (3 days)
- **Foundation Dependency:** All UI screens depend on design system components
- **Current State:** Design spec exists (`docs/design-spec.yaml`) but no feature implementation spec

#### Recommended Content
Should document:
- **Technical Implementation:**
  - SwiftUI component library structure
  - Design token implementation (colors, spacing, typography from design-spec.yaml:270-287)
  - SF Symbols integration patterns
  - Component API patterns (Button, Card, StatBar, etc.)

- **Components to Spec:**
  - `PrimaryButton` - Main CTAs (design-spec.yaml:183-189)
  - `IconButton` - Navigation actions (design-spec.yaml:191-197)
  - `ItemCard` - Inventory grid items (design-spec.yaml:216-223)
  - `StatBar` - HP/ATK/DEF displays (design-spec.yaml:207-214)
  - `TypographyStyles` - Text style system
  - `ColorPalette` - Color token system

- **Data Structures:**
  ```swift
  // Design tokens structure
  struct DesignTokens {
    static let spacing: Spacing
    static let colors: ColorPalette
    static let typography: Typography
  }
  ```

- **APIs:** N/A (client-only, no backend)

- **Dependencies:**
  - SF Symbols (iOS native)
  - SwiftUI framework
  - Design spec color palette (design-spec.yaml:13-47)

#### Brainstormed Ideas
- **Component Preview System:** Create SwiftUI previews for each component for rapid iteration
- **Theme Support:** Design token system to support future dark mode (mentioned in design-spec.yaml:298)
- **Accessibility Tokens:** Include minimum tap targets (44x44pt), contrast ratios (design-spec.yaml:172-174)
- **Modular Structure:** Separate package (`MysticaDesignSystem`) for reuse across iOS/macOS targets

---

### 🔴 Critical: F-09 - Inventory Management
**Priority:** High (listed as critical in Light MVP, but scheduled for Full MVP)
**PRD Reference:** [`docs/product-requirements.yaml:82-84`](file:///Users/silasrhyneer/Code/new-mystica/docs/product-requirements.yaml#L82)
**Status:** Planned
**Target:** Full MVP (2 weeks, due 2025-11-05)

#### What's Missing
No specification file exists at `docs/feature-specs/F-09-inventory-management.yaml`

#### Why Important
- **User Stories Exist:** US-301 (View Inventory) and US-302 (Equip Items) reference this feature
- **Core Gameplay:** Players need to view/manage collected items and pets
- **Design Complete:** Full inventory screen spec exists (design-spec.yaml:105-114, 116-128)

#### Recommended Content
Should document:
- **Technical Implementation:**
  - SwiftData local inventory cache
  - API sync strategy (pull on open, push on equip)
  - Pagination for large collections (50 items per page - design-spec.yaml:248)
  - Filter/sort logic (by type, generation, equipped status)

- **Data Structures:**
  ```swift
  struct InventoryItem {
    let id: UUID
    let itemType: ItemType // weapon, armor, pet, etc.
    let generation: Int // 1-3
    let stats: StatBlock
    let styleId: String // e.g., "normal", "pixel_art", "watercolor"
    let isEquipped: Bool
    let materials: [Material] // max 3
  }

  enum InventoryFilter {
    case all, equipped, byType(ItemType)
  }

  enum InventorySortOrder {
    case type, generation, stats
  }
  ```

- **APIs:**
  - `GET /inventory` - Fetch player inventory (paginated)
  - `GET /inventory/equipped` - Get currently equipped items
  - `PUT /inventory/equip/{item_id}` - Equip item to slot
  - `PUT /inventory/unequip/{slot}` - Unequip slot

- **User Stories:**
  - US-301: View Inventory (docs/user-stories/US-301-view-inventory.yaml)
  - US-302: Equip Items and Pets (docs/user-stories/US-302-equip-items.yaml)

- **Dependencies:**
  - F-03 (Base Items & Equipment System) - item data model
  - F-04 (Materials System) - material display
  - F-07 (User Authentication) - ownership validation
  - F-08 (Design System) - UI components

#### Brainstormed Ideas
- **Smart Sorting:** Auto-sort by "best stats" (highest total stat sum)
- **Quick Actions:** Long-press item card for quick equip/craft without opening detail view
- **Collection Progress:** Show "X/Y collected" badges for each item type
- **Shiny Showcase:** Separate tab or filter for shiny items (collectors feature)
- **Search:** Text search by item name (AI-generated names are unique)
- **Comparison Mode:** Select two items to compare stats side-by-side

---

### 🟡 Medium: F-10 - Premium Items
**Priority:** Medium
**PRD Reference:** [`docs/product-requirements.yaml:86-89`](file:///Users/silasrhyneer/Code/new-mystica/docs/product-requirements.yaml#L86)
**Status:** Planned
**Target:** Finished Product (2 months, due 2026-01-05)

#### What's Missing
No specification file exists at `docs/feature-specs/F-10-premium-items.yaml`

#### Why Lower Priority
- **Post-MVP:** Not in Light MVP or Full MVP scope
- **Monetization Feature:** Can be added after core gameplay is proven
- **No Dependencies:** Other features don't depend on this

#### Recommended Content
Should document:
- **Technical Implementation:**
  - Premium currency system (gems/coins)
  - Single-location spawn logic (geofencing for exclusive locations)
  - Payment integration (StoreKit 2 for IAP)
  - Premium item rarity tier (above shiny?)

- **Data Structures:**
  ```swift
  struct PremiumItem {
    let id: UUID
    let exclusiveLocationId: UUID
    let premiumCurrencyCost: Int
    let isPurchased: Bool
    let stats: StatBlock // higher than standard items?
  }

  struct PremiumCurrency {
    let balance: Int
    let purchaseHistory: [Transaction]
  }
  ```

- **APIs:**
  - `GET /shop/premium-items` - List available premium items
  - `POST /shop/purchase/{item_id}` - Purchase with premium currency
  - `GET /shop/currency-balance` - Get player's premium currency
  - `POST /shop/currency/purchase` - Buy premium currency (IAP)

- **Monetization Questions:**
  - Pricing model: $0.99-$4.99 per premium item? Or premium currency bundles?
  - Are premium items stat-advantaged or cosmetic only? (balance considerations)
  - Can premium items be crafted or traded? (probably no for exclusivity)
  - Exclusive location spawn: tourist attractions? landmarks? How many globally?

#### Brainstormed Ideas
- **Location-Based Exclusivity:** Premium items only spawn at famous landmarks (Eiffel Tower, Statue of Liberty, etc.)
- **Legendary Tier:** New rarity tier above shiny (golden glow, 1.5x stats?)
- **Premium Pet Variants:** Special pet skins/personalities available via premium
- **Battle Pass Model:** Seasonal premium track with exclusive items at milestones
- **Gifting System:** Allow premium items to be gifted to friends (social feature)
- **Achievement Rewards:** Some premium items earnable via hard challenges (30% premium, 70% IAP for monetization balance)

---

## 2. Missing User Story Coverage

**Current Coverage:** 5/12 features have user stories (42%)
**Total User Stories:** 11
**Features with Stories:** F-01, F-02, F-05, F-06, F-07, F-09

### Features Without User Stories

#### 🔴 Critical: F-03 - Base Items & Equipment System
**PRD Reference:** [`docs/product-requirements.yaml:51-54`](file:///Users/silasrhyneer/Code/new-mystica/docs/product-requirements.yaml#L51)
**Priority:** Critical (Light MVP blocker)

**Why Critical:**
- Core data model for entire game
- Combat system (F-02) depends on equipment stats
- Referenced by US-301, US-302 but no base stories

**Suggested User Stories:**
- **US-303: View Item Stats**
  *As a player, I want to view detailed stats of an item so I can decide if it improves my build*
  - Acceptance Criteria:
    - Given I tap an item card
    - When the detail view opens
    - Then I see ATK Power, ATK Accuracy, DEF Power, DEF Accuracy, HP stats
    - And stats are color-coded (red=ATK, blue=DEF, green=HP)
    - And generation indicator (Gen 1/2/3) is displayed

- **US-304: Understand Stat Normalization**
  *As a player, I want to see how materials modify my item stats so I understand the tradeoff system*
  - Acceptance Criteria:
    - Given an item with materials applied
    - When I view item details
    - Then I see base stats and material modifiers separately
    - And total stats sum displayed (should equal 1.0)
    - And material modifiers shown as +/- values

#### 🔴 Critical: F-04 - Materials System
**PRD Reference:** [`docs/product-requirements.yaml:56-59`](file:///Users/silasrhyneer/Code/new-mystica/docs/product-requirements.yaml#L56)
**Priority:** Critical (Full MVP)

**Why Critical:**
- Unique customization mechanic (differentiator)
- PRD notes emphasize material system (product-requirements.yaml:185-190)

**Suggested User Stories:**
- **US-402: Apply Material to Item**
  *As a player, I want to apply a material to my item so I can customize its stats*
  - Acceptance Criteria:
    - Given I have collected materials
    - When I tap "Apply Material" on an item
    - Then I see list of available materials
    - And preview shows stat changes before confirming
    - And materials can stack up to 3 per item
    - And applying consumes the material

- **US-403: Replace Material on Item**
  *As a player, I want to replace a material on my item so I can adjust my build*
  - Acceptance Criteria:
    - Given an item has 3 materials applied (max)
    - When I try to apply a new material
    - Then I'm prompted to select which material to replace
    - And old material is destroyed (not refunded)
    - And gold cost is displayed and deducted

- **US-404: Compare Different Material Styles**
  *As a player, I want to distinguish styled materials so I know they have unique visual appearances*
  - Acceptance Criteria:
    - Given I view a material in inventory
    - When it has a non-default style (e.g., "pixel_art", "watercolor")
    - Then it displays the style's unique visual treatment
    - And style name is clearly labeled
    - And styled materials are visually distinct from normal materials

#### 🟡 High: F-06 - Item Upgrade System
**PRD Reference:** [`docs/product-requirements.yaml:66-69`](file:///Users/silasrhyneer/Code/new-mystica/docs/product-requirements.yaml#L66)
**Priority:** High (Full MVP)
**Note:** US-401 exists but covers crafting, not upgrading

**Why Important:**
- Gold sink mechanic (economy balance)
- Progression without RNG (deterministic growth)

**Suggested User Stories:**
- **US-405: Upgrade Item Level**
  *As a player, I want to upgrade my item's level so I can increase its stats*
  - Acceptance Criteria:
    - Given I have sufficient gold
    - When I tap "Upgrade" on an item
    - Then gold cost is displayed based on current level
    - And preview shows stat increase (proportional to current stats)
    - And item level increases by 1
    - And stats scale maintaining normalized ratios

#### 🟡 High: F-08 - Design System
**PRD Reference:** [`docs/product-requirements.yaml:76-79`](file:///Users/silasrhyneer/Code/new-mystica/docs/product-requirements.yaml#L76)

**Why Low Priority for Stories:**
- Developer-facing feature (no direct user interaction)
- Better documented in technical spec than user stories

**Suggested Story (if needed):**
- **US-801: Consistent UI Experience**
  *As a player, I want a consistent visual experience so the app feels polished*
  - (This is more of a quality attribute than a user-actionable story)

#### 🟡 High: F-11 - Pet Personality System
**PRD Reference:** [`docs/product-requirements.yaml:91-94`](file:///Users/silasrhyneer/Code/new-mystica/docs/product-requirements.yaml#L91)
**Feature Spec:** Exists (F-11-pet-personality-system.yaml)

**Why Important:**
- Novel feature (AI-powered pet chatter)
- Enhances combat engagement

**Suggested User Stories:**
- **US-1101: Select Pet Personality**
  *As a player, I want to choose my pet's personality so they match my play style*
  - Acceptance Criteria:
    - Given I have a pet in inventory
    - When I tap "Set Personality"
    - Then I see list of personality types (Cheerleader, Analyst, Comedic, etc.)
    - And preview shows example dialogue for each type
    - And selection is saved per-pet

- **US-1102: Pet Chatter During Combat**
  *As a player, I want my pet to comment during combat so battles feel more engaging*
  - Acceptance Criteria:
    - Given I have a pet equipped with personality set
    - When combat events occur (attack, hit, miss, HP threshold)
    - Then pet generates contextual dialogue within 2s
    - And dialogue appears in speech bubble above pet sprite
    - And dialogue fades after 2-3s
    - And dialogue reflects personality type and combat state

#### 🟡 High: F-12 - Enemy AI Personality System
**PRD Reference:** [`docs/product-requirements.yaml:96-99`](file:///Users/silasrhyneer/Code/new-mystica/docs/product-requirements.yaml#L96)
**Feature Spec:** Exists (F-12-enemy-ai-personality-system.yaml)

**Why Important:**
- Differentiator feature (enemies remember you)
- Increases replay value (dynamic difficulty perception)

**Suggested User Stories:**
- **US-1201: Enemy Trash-Talk Based on History**
  *As a player, I want enemies to reference my past attempts so victories feel earned*
  - Acceptance Criteria:
    - Given I've fought an enemy multiple times
    - When combat starts
    - Then enemy may taunt about previous losses ("Back for more?")
    - And dialogue reflects win/loss record
    - And dialogue escalates if I'm on losing streak

- **US-1202: Enemy Gloating or Panicking**
  *As a player, I want enemies to react to combat state so battles feel alive*
  - Acceptance Criteria:
    - Given combat is in progress
    - When enemy HP drops below 30%
    - Then enemy may show panic/desperation in dialogue
    - When player HP drops below 30%
    - Then enemy may gloat or mock
    - And dialogue generation completes within 2s

#### 🟡 Medium: F-10 - Premium Items
**PRD Reference:** [`docs/product-requirements.yaml:86-89`](file:///Users/silasrhyneer/Code/new-mystica/docs/product-requirements.yaml#L86)
**Priority:** Medium (Finished Product phase)

**Suggested User Stories:**
- **US-1001: Discover Premium Location**
  *As a player, I want to find exclusive premium locations so I can collect rare items*
  - Acceptance Criteria:
    - Given I'm near a landmark location
    - When I open the map
    - Then premium location marker is distinct (purple/gold)
    - And marker indicates premium currency requirement
    - And location distance is displayed

- **US-1002: Purchase Premium Item**
  *As a player, I want to buy premium items with premium currency so I can obtain exclusive gear*
  - Acceptance Criteria:
    - Given I have sufficient premium currency
    - When I tap premium location marker
    - Then premium item preview is shown
    - And purchase confirmation dialog appears
    - And premium currency cost is displayed
    - And purchase deducts currency and grants item

---

## 3. Data Completeness Issues

### Validation Script False Positives
**Issue:** Script reports filled fields as empty

**Affected Fields:**
- `product-requirements.yaml`: `project_name`, `goal` (both filled)
- `system-design.yaml`: `goal` (filled)
- `design-spec.yaml`: `design_goals` (filled)

**Current Values:**
- Project Name: "New Mystica" (product-requirements.yaml:8)
- PRD Goal: "Create an engaging location-based RPG..." (product-requirements.yaml:29)
- System Goal: "Build a location-based mobile RPG..." (system-design.yaml:8)
- Design Goals: "Create an immersive RPG experience..." (design-spec.yaml:8)

**Recommendation:** Debug `check-project.sh` script to identify why validation fails

---

## 4. Priority Recommendations

### Immediate (Before Light MVP - 2025-10-22, 3 days)
1. ✅ **Create F-08 Feature Spec** (Design System) - Light MVP blocker
2. ✅ **Create US-303, US-304** (Base Items stories) - Clarify equipment system
3. 🔧 **Fix validation script** - Remove false warnings

### Short-term (Before Full MVP - 2025-11-05, 2 weeks)
4. ✅ **Create F-09 Feature Spec** (Inventory Management) - User stories exist
5. ✅ **Create US-402, US-403, US-404** (Materials System stories)
6. ✅ **Create US-405** (Item Upgrade story)
7. ✅ **Create US-1101, US-1102** (Pet Personality stories)
8. ✅ **Create US-1201, US-1202** (Enemy AI stories)

### Long-term (Before Finished Product - 2026-01-05, 2 months)
9. ✅ **Create F-10 Feature Spec** (Premium Items)
10. ✅ **Create US-1001, US-1002** (Premium Items stories)

---

## 5. Cross-Reference Health

### ✅ Strong Linkage
- User Stories → Features: All 11 stories link to valid feature IDs
- Feature Specs → PRD: All 9 specs reference correct feature IDs
- API Contracts → Features: Endpoints note feature IDs in descriptions

### ⚠️ Weak Coverage
- **58% Features Missing Stories:** 7/12 features lack user story coverage
- **25% Features Missing Specs:** 3/12 features lack technical specifications

### 📊 Coverage by Phase
- **Light MVP Features (4):** F-01 ✅, F-02 ✅, F-03 ⚠️ (no stories), F-08 ❌ (no spec, no stories)
- **Full MVP Features (6):** F-04 ⚠️, F-05 ✅, F-06 ⚠️, F-07 ✅, F-09 ❌, F-11 ⚠️, F-12 ⚠️
- **Finished Features (2):** F-10 ❌

**Legend:**
- ✅ = Spec + Stories exist
- ⚠️ = Spec exists, stories missing (or vice versa)
- ❌ = Both spec and stories missing

---

## 6. Brainstormed Ideas & Suggestions

### Documentation Improvements
- **Interactive Documentation:** Generate browsable HTML docs from YAML (script exists: `generate-docs.sh`)
- **Dependency Graph:** Visual diagram showing feature dependencies (e.g., F-02 depends on F-03)
- **Traceability Matrix:** Spreadsheet linking PRD → Specs → Stories → APIs → Tests
- **Changelog:** Track documentation changes in `TRACEABILITY.md` or git log

### Process Improvements
- **Story Template:** Create standard Gherkin-style template (Given/When/Then) for consistency
- **Review Checklist:** Require spec review before marking feature as "in-progress"
- **API Contract Sync:** Automate OpenAPI validation against feature specs
- **Coverage Dashboard:** Script to show real-time coverage % (specs, stories, tests)

### Content Additions
- **Edge Cases:** Document error states, edge cases, validation rules per feature
- **Performance Criteria:** Add performance acceptance criteria to specs (e.g., "Map loads <1s")
- **Analytics Events:** Ensure every user story maps to tracking event in data-plan.yaml
- **Migration Plan:** If database schema changes, add migration scripts to specs

---

## Appendix: File Links

### Core Documents
- [Product Requirements](file:///Users/silasrhyneer/Code/new-mystica/docs/product-requirements.yaml)
- [System Design](file:///Users/silasrhyneer/Code/new-mystica/docs/system-design.yaml)
- [API Contracts](file:///Users/silasrhyneer/Code/new-mystica/docs/api-contracts.yaml)
- [Data Plan](file:///Users/silasrhyneer/Code/new-mystica/docs/data-plan.yaml)
- [Design Spec](file:///Users/silasrhyneer/Code/new-mystica/docs/design-spec.yaml)

### Multi-file Documentation
- [User Flows](file:///Users/silasrhyneer/Code/new-mystica/docs/user-flows/)
- [User Stories](file:///Users/silasrhyneer/Code/new-mystica/docs/user-stories/)
- [Feature Specs](file:///Users/silasrhyneer/Code/new-mystica/docs/feature-specs/)

### Utilities
- [List Stories Script](file:///Users/silasrhyneer/Code/new-mystica/docs/user-stories/list-stories.sh)
- [List Features Script](file:///Users/silasrhyneer/Code/new-mystica/docs/feature-specs/list-features.sh)
- [List APIs Script](file:///Users/silasrhyneer/Code/new-mystica/docs/list-apis.sh)
- [Check Project Script](file:///Users/silasrhyneer/Code/new-mystica/docs/check-project.sh)
- [Generate Docs Script](file:///Users/silasrhyneer/Code/new-mystica/docs/generate-docs.sh)

---

**End of Gap Analysis**
