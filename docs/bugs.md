## Fixed Bugs

### ✅ Material Application Decode Error (2025-10-24)
**Issue:** Frontend failed to decode `/api/v1/items/:id/materials/apply` response with error:
```
keyNotFound: 'success' at path 'data'
```

**Root Cause:** Backend controller returned response with wrong field names:
- Returned: `{ item, stats, image_url, is_first_craft, total_crafts }`
- Expected: `{ success, updated_item, image_url, is_first_craft, craft_count }`

**Fix:** Updated `ItemController.applyMaterial` (mystica-express/src/controllers/ItemController.ts:222-229) to match Swift `ApplyMaterialResult` model:
- Added `success: true` field
- Renamed `item` → `updated_item`
- Renamed `total_crafts` → `craft_count`
- Removed redundant `stats` field (already in `updated_item.current_stats`)

**File:** mystica-express/src/controllers/ItemController.ts:208-233

---

## Open Bugs

### 🐛 Item Names Display Issue
- Fix names

### 🐛 Speech Bubbles
- Speech bubbles