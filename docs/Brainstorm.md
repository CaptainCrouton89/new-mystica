# New Mystica - Game Design Document

## Development Environment
- XCode (iOS/macOS SwiftUI frontend)

---

## Core Game Features

### 1. UI/UX Design System

#### Global Style Guide
- **Buttons**
  - Back buttons
  - Icon buttons
  - Text buttons
- **Typography**
  - Titles
  - Body text
- **Visual Design**
  - Color scheme
  - Font family

---

### 2. Geolocation System

#### Location-Based Gameplay
- Integration with Google Maps
- Navigate to real-world locations to discover enemies
- Location-specific item icons displayed on map

---

### 3. Combat System

#### Combat Mechanics
- **Attack Timing Mechanic**
  - Tap a moving dial to optimize attack multiplier
  - Closer to center = higher multiplier
- **Combat Flow**
  1. Player avatar attacks enemy
  2. Calculate stats from equipped items and pet
  3. Receive damage from enemy
  4. Start next round

---

### 4. Items System

#### Item Properties
- **Location Association**
  - Specific to location
  - City-based (or global for all cities)
  - Special: Single location for paid premium items (overrides city stat)
- **Variants**
  - Standard version
  - Shiny version (rare)
- **Stats** (stackable modifiers)
  - Attack
  - Defense
  - Health
- **Metadata**
  - Equippable (boolean)
  - Rank/rarity tier

---

### 5. Pets System

#### Pet Properties
- **Location Association**
  - Specific to location
- **Variants**
  - Standard version
  - Shiny version (rare)
- **Stats** (stackable modifiers)
  - Attack
  - Defense
  - Health

---

### 6. AI Generation & Crafting System

#### AI Item Generation
- Generate items with stats once and store in database
- **Generation Schema**:
  ```json
  {
    "type": "helmet|armor|amulet|ring|sword|axe|shield",
    "description": "string",
    "statDistribution": {
      "atk": "number (0-1)",
      "def": "number (0-1)",
      "health": "number (0-1)"
    },
    "level": "number"
  }
  ```

#### Crafting Rules
- **Item Fusion**
  - Burn 2 items to generate a child item (saved in DB)
  - Only combine items in the same generation
  - Only combine items of the same type
  - Maximum: 3rd generation items/pets (no further generations)
- **Crafting Mechanics**
  - Crafting time increases with each generation
  - Can craft iteratively until no items remain
  - Valid combinations:
    - Materials + Items ✓
    - Items + Items ✓
    - Materials + Materials ✗

---

## Next Steps
- Combat begins implementation
