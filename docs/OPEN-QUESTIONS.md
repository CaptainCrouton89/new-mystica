# Open Questions - Material System Design

**Last Updated:** 2025-10-19
**Status:** Awaiting decisions before implementation

---

## 🔥 Critical Decisions Needed for MVP1

### 1. Material Stacking Mechanics

**Question:** How do multiple materials combine on a single item?

**Option A: Materials Stack Additively (RECOMMENDED)**
```javascript
Base Sword: {atkPower: 30, defPower: 20}
+ Iron Material: {atkPower: -5, defPower: +5}
+ Flame Material: {atkPower: +10, defPower: -10}
= "Iron Flame Sword": {atkPower: 35, defPower: 15}
```
- ✅ Names concatenate: "Iron Flame Sword"
- ✅ Each material shifts stats
- ⚠️ Order matters? Or alphabetical?
- ⚠️ Need stat modification formula (not simple addition - see note below)

**Option B: Materials Replace (Single Material Only)**
```javascript
Sword → Apply Iron → "Iron Sword"
Iron Sword → Apply Flame → "Flame Sword" (iron is gone)
```
- ❌ Contradicts "multiple materials can be applied"

**Option C: Limited Stacks (Max 2-3 Materials)**
```javascript
Sword → +Iron → "Iron Sword"
Iron Sword → +Flame → "Iron Flame Sword"
Iron Flame Sword → +Matcha → "Iron Flame Matcha Sword" (MAX)
```
- ✅ Prevents "Iron Flame Matcha Coffee Lightning Shadow Crystal Dragon Sword"
- ✅ Caps complexity
- ⚠️ What's the cap? 2? 3? 5?

**User Note:** "Stat modification might not be quite so simple. Let's log it as an open question."

**Decision Needed:**
- [ ] Which option? (A or C recommended)
- [ ] If Option C, what's max material count? (Suggest: 3)
- [ ] Material order significance? (alphabetical, application order, or sorted by rarity?)
- [ ] **How exactly do stat modifiers combine?** (additive, multiplicative, diminishing returns, formula TBD)

---

### 2. Material Drop System

**Question:** How do enemies drop materials to inventory?

**Current Understanding:**
- Enemies drop:
  1. **Gold** (always) - amount scales with enemy level
  2. **Material item** (sometimes) - goes to inventory
     - 95% normal material
     - 5% shiny material (better stats? visual only?)

**Sub-Questions:**

**2a. Material Inventory Management**
- [ ] Can you have multiple of the same material? (5× Iron materials in inventory?)
  - **Recommendation:** Yes, stackable (display as "Iron x5")
- [ ] Is there an inventory cap? (Unlimited materials?)
  - **Recommendation:** Start unlimited for MVP1, can add cap later if needed
- [ ] Can you remove/replace materials from items?
  - **Option 1:** Once applied, permanent (simpler)
  - **Option 2:** Can cleanse item back to base (costs gold?)
  - **Option 3:** Can replace material (old one destroyed)

**2b. Shiny Materials**
- [ ] What does shiny material do?
  - **Option 1:** +20% stat modifiers (e.g., normal Iron = +5 DEF, shiny Iron = +6 DEF)
  - **Option 2:** Visual sparkle only (same stats)
  - **Option 3:** Unlocks special visual effects on item (flame particles, glow, etc.)
  - **Recommendation:** Option 1 (+20% stats) for meaningful progression

---

### 3. Base Item Types & Slots

**Question:** What base item types exist and how do you unlock them?

**Equipment Slots (6 confirmed):**
1. Weapon (sword, wrench, mace, flamethrower, etc.)
2. Head (helmet)
3. Body (armor)
4. Amulet
5. Ring
6. Pet

**For MVP1 Starting Set:**
- 1 weapon type (sword)
- 1 helmet type
- 1 armor type
- 1 amulet type
- 1 ring type
- 1 pet type

**Unlocking Additional Base Types (wrench, mace, flamethrower):**
- [ ] **Option A:** All available from start (simpler, just cosmetic differences)
- [ ] **Option B:** Unlock at vanity level milestones (Level 5 = wrench, Level 10 = mace)
- [ ] **Option C:** Defeat specific bosses (MVP2+ feature)
- [ ] **Option D:** Random rare drop from combat

**Recommendation:** Option A for MVP1 (all types available), save unlocking for MVP2

**Decision Needed:**
- [ ] How many base types per slot for MVP1? (1 per slot or multiple?)
- [ ] Do different weapon types have different stats? Or purely cosmetic?
  - **Recommendation:** Same stats for MVP1, purely cosmetic choice

---

### 4. Starting Conditions

**Question:** What does a new player start with?

**Proposed Starting Inventory:**
- [ ] 6 level-1 base items (one per slot, no materials applied)?
- [ ] OR start empty, must collect first items from combat?
- [ ] Starting gold amount? (0? 100? 1000?)
- [ ] Starting materials? (0? Give 1-2 starter materials?)

**Recommendation:**
- Start with 6 level-1 base items (one per slot, no materials)
- 500 starting gold
- 0 starting materials (must earn through combat)
- This ensures immediate combat capability but progression incentive

---

### 5. Material Library Size

**Question:** How many materials for MVP1?

**Options:**
- [ ] **10 materials** - Minimal viable (2 per stat theme)
- [ ] **20 materials** - Moderate variety
- [ ] **50 materials** - High variety

**Material Themes (Examples):**
- Defensive: Iron, Stone, Steel, Diamond
- Offensive: Flame, Lightning, Ice, Shadow
- Balanced: Wood, Copper, Bronze, Silver
- Exotic: Matcha, Coffee, Cosmic, Quantum

**Recommendation:** 20 materials for MVP1 (enough variety without overwhelming)

**Decision Needed:**
- [ ] Exact material count for MVP1
- [ ] Do we pre-generate all materials? Or procedurally generate?
  - **Recommendation:** Pre-generate fixed library for consistency

---

### 6. Enemy Level Scaling

**Question:** How do enemy levels work?

**Option A: Fixed Levels per Location**
- This coffee shop always has Level 3 enemy
- Players choose easier/harder locations
- Requires location tier system

**Option B: Dynamic Scaling to Player**
- Enemy level = average of player's 6 equipped item levels
- OR: average + 1 for slight challenge
- Always appropriately challenging
- No location management needed

**Recommendation:** Option B for MVP1 (simpler, no location tiers)

**Decision Needed:**
- [ ] Which scaling option?
- [ ] If Option B, exact formula? (avg, avg+1, avg*1.1, etc.)

---

### 7. Stat Modification Formula

**Question:** How exactly do material stat modifiers combine?

**User Note:** "For stat modification, it might not be quite so simple."

**Current Unknown:**
- Simple addition might not work (e.g., stacking 10 materials could break balance)
- Need formula for combining multiple modifiers

**Possible Approaches:**

**Option A: Additive with Caps**
```javascript
baseStat + material1Mod + material2Mod + ...
// But cap at +50% / -50% of base
```

**Option B: Multiplicative**
```javascript
baseStat * (1 + material1Mod) * (1 + material2Mod) * ...
// Compounds, harder to predict
```

**Option C: Diminishing Returns**
```javascript
baseStat + material1Mod + (material2Mod * 0.75) + (material3Mod * 0.5) + ...
// Each additional material less impactful
```

**Option D: Custom Formula TBD**
- Define base formula
- Test with sample materials
- Balance iteratively

**Decision Needed:**
- [ ] **What formula should we use?**
- [ ] How do we prevent stat stacking from breaking balance?
- [ ] Should there be min/max stat bounds?

---

## 🎯 Summary of Decisions Needed

### Must Decide for MVP1 Implementation:

1. **Material Stacking:**
   - [ ] Max materials per item (3 recommended)
   - [ ] **Stat modification formula (CRITICAL - blocks implementation)**
   - [ ] Material order handling

2. **Material Management:**
   - [ ] Can remove materials from items? (Yes/No)
   - [ ] Shiny material effect (+20% stats recommended)

3. **Starting Conditions:**
   - [ ] Player starts with 6 level-1 items? (Yes recommended)
   - [ ] Starting gold (500 recommended)

4. **Material Library:**
   - [ ] Material count for MVP1 (20 recommended)

5. **Enemy Scaling:**
   - [ ] Dynamic scaling to player level? (Yes recommended)

6. **Base Item Types:**
   - [ ] Multiple weapon types available from start? (Yes, cosmetic only)

---

## 📋 Next Steps

Once these decisions are made:
1. ✅ Update PRD with material system
2. ✅ Revise feature specs (F-03, F-05, F-06)
3. ✅ Update API contracts (new material endpoints)
4. ✅ Update data schemas (materials table, player_items structure)
5. ✅ Update design spec (material application UI)
6. ✅ Create material seed data (JSON for base materials)
7. ✅ Calculate gold costs and drop rates
8. ✅ Define exact stat formulas

**User:** Please answer these questions when ready, then I'll update all documentation accordingly.
