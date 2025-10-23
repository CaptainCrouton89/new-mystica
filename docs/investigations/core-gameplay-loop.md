# Core Gameplay Loop Implementation Analysis

## Executive Summary

This investigation maps all code implementing the core gameplay loop across the New Mystica codebase. The game follows a location-based combat RPG flow: **Map Exploration → Combat → Reward Collection → Equipment Management → Crafting Enhancement**.

## Implementation Overview

### 1. Map & Location System

**Frontend (SwiftUI):**
- `MapView.swift` - Main map interface with Google Maps integration, location markers, proximity detection (50m interaction range)
- `MapViewModel.swift` - Location services management, GPS tracking, nearby location discovery with 100m debounce
- `LocationMarkerView` - Individual location markers with level indicators and biome-specific icons

**Backend (Express/TypeScript):**
- `routes/locations.ts` - Location discovery endpoints (`/nearby`, `/:id`)
- `controllers/LocationController.ts` - Geospatial location retrieval handlers
- `services/LocationService.ts` - PostGIS-based proximity queries, enemy/loot pool matching

**Models:**
- `Location.swift` - Location data model with lat/lng, enemy levels, material drop pools
- `Zone.swift` - Biome-based location grouping (forest, urban, desert, etc.)

### 2. Combat System

**Frontend (SwiftUI):**
- `BattleView.swift` - Turn-based combat interface with timing dial mechanics
- `CombatViewModel.swift` - Combat session state management, attack/defense actions
- `VictoryView.swift` / `DefeatView.swift` - Combat outcome screens with rewards display

**Backend (Express/TypeScript):**
- `routes/combat.ts` - Combat action endpoints (`/start`, `/attack`, `/defend`, `/complete`)
- `controllers/CombatController.ts` - Combat session orchestration
- `services/CombatService.ts` - **Core combat engine** (1,134 lines) implementing:
  - Timing dial mechanics with accuracy-based hit zones (injure/miss/graze/normal/crit)
  - Weapon pattern system with adjustable bands
  - Damage calculation with zone multipliers and crit bonuses
  - Enemy selection from weighted pools
  - Combat rating and win probability calculations

**Combat Flow:**
1. Player selects location and difficulty level (1-20)
2. System selects enemy from location's enemy pools using weighted random
3. Turn-based combat with timing dial accuracy (0.0-1.0)
4. Hit zones determined by accuracy: <0.1=injure, 0.1-0.3=miss, 0.3-0.6=graze, 0.6-0.9=normal, >0.9=crit
5. Damage calculation: `(ATK * zone_multiplier) - DEF` with crit bonuses
6. Combat ends when either HP reaches 0

**Models:**
- `Combat.swift` - Combat session, enemy stats, action results
- `Enemy` - Enemy data with stats, dialogue tone, personality traits

### 3. Crafting System

**Frontend (SwiftUI):**
- `CraftingSheet.swift` - Material application interface with 20-second blocking progress simulation
- `CraftingViewModel.swift` - Material application workflow management
- `MaterialSelectionModal` - Material picker with stat previews

**Backend (Express/TypeScript):**
- `routes/materials.ts` - Material inventory and templates
- `controllers/MaterialController.ts` - Material management
- `services/MaterialService.ts` - Material application logic

**Crafting Flow:**
1. Player selects item from inventory
2. Choose material slot (1-3 slots based on item level)
3. Select material from available pool
4. 20-second AI image generation process (blocking)
5. Material stats applied to item, new image generated

**Models:**
- `MaterialTemplate` - Base material with stat modifiers
- `ItemMaterialApplication` - Applied material per slot
- `EnhancedPlayerItem` - Item with applied materials and computed stats

### 4. Equipment & Inventory

**Frontend (SwiftUI):**
- `EquipmentView.swift` - Equipment slot management with character-centered layout
- `EquipmentViewModel.swift` - Equipment state management
- `InventoryView.swift` - Item browsing with styled/unstyled filtering
- `InventoryViewModel.swift` - Inventory loading and item selection

**Backend (Express/TypeScript):**
- `routes/equipment.ts` - Equipment management endpoints
- `routes/inventory.ts` - Inventory querying with filtering
- `controllers/EquipmentController.ts` - Equipment operations
- `services/EquipmentService.ts` - Equipment stat calculations

**Equipment Slots:**
- weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet
- Total stats computed from all equipped items
- Real-time stat preview during equipment changes

**Models:**
- `Equipment.swift` - Equipment state with total stats
- `EquipmentSlots` - Individual slot data
- `PlayerItem` - Base item model
- `EnhancedPlayerItem` - Item with crafting enhancements

### 5. Backend APIs Summary

**Core Endpoints:**
```
GET  /locations/nearby        - Geospatial location discovery
GET  /locations/:id           - Location details
POST /combat/start            - Initiate combat session
POST /combat/attack           - Execute attack with timing
POST /combat/defend           - Execute defense
POST /combat/complete         - End combat, distribute rewards
GET  /inventory               - Player items and materials
GET  /materials               - Material templates
GET  /equipment               - Equipment state
POST /equipment/equip         - Equip/unequip items
```

### 6. Database Schema

**Key Tables:**
- `locations` - Location coordinates and properties
- `combat_sessions` - Active combat state with TTL
- `enemy_types` - Enemy templates
- `player_items` - Individual item instances
- `materials` - Material definitions
- `equipment_slots` - Current equipment state
- `material_applications` - Applied materials per item

**Views:**
- `v_player_powerlevel` - Computed player stats from equipment
- `v_enemy_realized_stats` - Enemy stats with tier scaling
- `v_loot_pool_material_weights` - Weighted loot generation

### 7. AI Pipeline Integration

**Image Generation (scripts/):**
- `generate-image.ts` - Replicate-based image generation for crafted items
- `generate-raw-image.ts` - Base item/material image generation
- `r2-service.ts` - Cloudflare R2 storage integration
- **Providers:** Google Nano Banana (Gemini 2.5), ByteDance Seedream-4
- **Cost:** ~$0.002-0.01 per image

**Workflow:**
1. Player applies material to item
2. System generates unique material combination hash
3. If not cached, triggers AI image generation (20s blocking)
4. Generated image uploaded to R2 storage
5. Item updated with new image URL and computed stats

## Implementation Quality

### Strengths
1. **Complete gameplay loop** - All core systems implemented
2. **Real combat mechanics** - Sophisticated timing dial with hit zones
3. **Geospatial integration** - PostGIS-based location discovery
4. **AI-powered crafting** - Dynamic image generation for item combinations
5. **Strong architecture** - Clear separation between SwiftUI views, ViewModels, and repositories

### Areas for Enhancement
1. **Combat balance** - Hit zone thresholds may need tuning
2. **Material variety** - Limited material pool in current implementation
3. **Location content** - Need more diverse biomes and enemy types
4. **Progression systems** - Player leveling and skill trees not yet implemented

## Technical Architecture

**Frontend Stack:**
- SwiftUI with MVVM pattern
- Combine for reactive programming
- CoreLocation for GPS
- Google Maps SDK for map display

**Backend Stack:**
- Express.js with TypeScript
- Supabase PostgreSQL with PostGIS
- Zod for schema validation
- JWT authentication

**AI/Storage Stack:**
- Replicate for image generation
- Cloudflare R2 for asset storage
- OpenAI GPT-4.1-mini for descriptions

## File Reference Summary

### Frontend Core Files
```
New-Mystica/New-Mystica/
├── MapView.swift                    - Main map interface
├── BattleView.swift                 - Combat interface
├── EquipmentView.swift              - Equipment management
├── Views/
│   ├── Inventory/InventoryView.swift     - Item inventory
│   └── Crafting/CraftingSheet.swift     - Material application
├── ViewModels/
│   ├── MapViewModel.swift              - Location services
│   ├── CombatViewModel.swift           - Combat state
│   ├── EquipmentViewModel.swift        - Equipment state
│   ├── InventoryViewModel.swift        - Inventory state
│   └── CraftingViewModel.swift         - Crafting workflow
└── Models/
    ├── Location.swift                  - Location models
    ├── Combat.swift                    - Combat models
    ├── Equipment.swift                 - Equipment models
    └── Inventory.swift                 - Item/material models
```

### Backend Core Files
```
mystica-express/src/
├── routes/
│   ├── locations.ts                - Location endpoints
│   ├── combat.ts                   - Combat endpoints
│   ├── inventory.ts                - Inventory endpoints
│   └── materials.ts                - Material endpoints
├── controllers/
│   ├── LocationController.ts       - Location handlers
│   ├── CombatController.ts         - Combat handlers
│   └── EquipmentController.ts      - Equipment handlers
├── services/
│   ├── LocationService.ts          - Geospatial logic
│   ├── CombatService.ts            - Combat engine (1,134 lines)
│   ├── EquipmentService.ts         - Equipment logic
│   └── MaterialService.ts          - Material logic
└── repositories/
    ├── LocationRepository.ts       - Location data access
    ├── CombatRepository.ts         - Combat data access
    └── EquipmentRepository.ts      - Equipment data access
```

### AI Pipeline Files
```
scripts/
├── generate-image.ts               - Main image generation
├── generate-raw-image.ts           - Base asset generation
├── r2-service.ts                   - Storage service
└── generate-item-description.ts    - AI descriptions
```

## Conclusion

The New Mystica codebase implements a sophisticated and complete core gameplay loop. The combat system is particularly well-developed with realistic timing mechanics, the location system provides engaging exploration, and the crafting system offers meaningful customization through AI-generated content. The architecture supports scalability and the implementation demonstrates production-quality code organization.