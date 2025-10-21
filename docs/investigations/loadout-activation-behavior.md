# Loadout Activation Behavior Analysis

## Investigation Summary

Analysis of loadout activation behavior to determine whether "active loadout is loaded and applied" means:
- **Option A:** GET /loadouts returns active loadout, frontend displays those slot assignments
- **Option B:** PUT /loadouts/{id}/activate syncs loadout to UserEquipment, so GET /equipment reflects it

**Conclusion: Option B is correct** - loadout activation copies data to UserEquipment table, which is the single source of truth.

## API Specification - PUT /loadouts/{id}/activate

From `docs/api-contracts.yaml` lines 1337-1367:
```yaml
/loadouts/{loadout_id}/activate:
  put:
    summary: Activate loadout (F-09)
    description: Copies LoadoutSlots to UserEquipment, sets is_active=true. Deactivates other loadouts.
    responses:
      '200':
        description: Loadout activated, equipment updated
        content:
          application/json:
            schema:
              properties:
                success: boolean
                active_loadout_id: string (uuid)
                updated_equipment:
                  type: object
                  description: New UserEquipment state after activation
```

**Interpretation:** The activation endpoint explicitly "Copies LoadoutSlots to UserEquipment" and returns "updated_equipment" showing the new UserEquipment state. This indicates the loadout data is synchronized into the UserEquipment table.

## API Specification - GET /equipment

From `docs/api-contracts.yaml` lines 1111-1159:
```yaml
/equipment:
  get:
    summary: Get equipped items (8 slots)
    description: Returns current UserEquipment state across 8 equipment slots
    responses:
      '200':
        content:
          application/json:
            schema:
              properties:
                slots:
                  properties:
                    weapon: {$ref: '#/components/schemas/PlayerItem'}
                    offhand: {$ref: '#/components/schemas/PlayerItem'}
                    # ... all 8 slots
                total_stats: object
```

**Source:** UserEquipment table - the API description explicitly states "Returns current UserEquipment state across 8 equipment slots".

## Loadout Schema Analysis

From `docs/api-contracts.yaml` lines 437-496:
```yaml
Loadout:
  type: object
  properties:
    id: string (uuid)
    user_id: string (uuid)
    name: string (maxLength: 50)
    is_active: boolean
    description: Only one loadout can be active per user
    slots:
      type: object
      description: Equipment slot assignments (references to LoadoutSlots table)
      properties:
        weapon: string (uuid, nullable)
        offhand: string (uuid, nullable)
        # ... all 8 slots
```

**Key fields:**
- `is_active: boolean` - tracks which loadout is currently active
- `slots: object` - 8 equipment slot assignments stored in LoadoutSlots table

## F-09 Architecture Comment

From `docs/api-contracts.yaml` lines 23-27:
```yaml
# Equipment System Architecture:
# - UserEquipment table tracks current equipped items per slot (single source of truth)
# - Loadouts table stores saved equipment configurations
# - LoadoutSlots table stores item assignments for each loadout
# - PlayerItem schema no longer tracks equipment state directly
# - 8 equipment slots: weapon, offhand, head, armor, feet, accessory_1, accessory_2, pet
```

**Single Source of Truth:** UserEquipment table is explicitly designated as the "single source of truth" for current equipped items.

## F-09 Detailed Architecture

From `docs/feature-specs/F-09-inventory-management.yaml` lines 145-151:
```yaml
PUT /loadouts/{id}/activate:
  side_effects:
    - "Sets previous active loadout is_active = false"
    - "Sets target loadout is_active = true"
    - "Copies LoadoutSlots → UserEquipment for all 8 slots"
    - "Database trigger recalculates Users.vanity_level and avg_item_level"
    - "Creates ItemHistory records for each slot change"
```

This confirms the loadout activation process synchronizes LoadoutSlots into UserEquipment.

## Answer to Question 6

**Recommended Approach:**
- [x] **Option B:** GET /equipment (UserEquipment already reflects active loadout)
- [ ] Option A: GET /loadouts, apply active loadout slots to display

**Rationale:**
1. UserEquipment table is the "single source of truth" per architecture comments
2. PUT /loadouts/{id}/activate explicitly "Copies LoadoutSlots to UserEquipment"
3. GET /equipment returns "current UserEquipment state" - already synchronized
4. Loadouts are storage for saved configurations, not runtime state

## US-701 Implication

For startup data loading in user story US-701:

**Equipment Loading:**
- **Required:** Call GET /equipment to load current equipped items
- **Not required:** Call GET /loadouts during startup (loadouts are "post-MVP" per story line 12)
- **Sufficient:** GET /equipment provides complete current equipment state

**When loadout data is needed:**
- Loadout management UI (post-MVP feature)
- Saving new loadout configurations
- Switching between saved loadouts
- **Not needed:** Runtime equipment display or combat stat calculations

## Key Findings

1. **Loadout activation mechanism:** PUT /loadouts/{id}/activate copies LoadoutSlots → UserEquipment
2. **Equipment state synchronization:** Active loadout is already synced to UserEquipment table
3. **Required API calls for startup:** GET /equipment is sufficient - no need for loadout APIs during startup
4. **Architecture separation:** Loadouts = saved configurations, UserEquipment = current runtime state

## Implementation Status

**Backend Status:**
- Equipment endpoints exist but not implemented (EquipmentService throws NotImplementedError)
- No loadout endpoints implemented yet (LoadoutController/LoadoutService don't exist)
- Database schema applied to remote Supabase with UserEquipment and Loadouts tables

**Frontend Implication for US-701:**
For Question 6's startup data loading, implement:
```swift
// In EquipmentService.loadEquipment()
let equipment = try await api.get("/equipment") // UserEquipment state
// DO NOT call GET /loadouts during startup
```

The active loadout is already reflected in UserEquipment, so no additional loadout API calls are needed during app startup.