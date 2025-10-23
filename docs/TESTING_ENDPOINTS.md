# Testing Equipment Endpoints

## Key Learnings

### Authentication
- **Register new device:** `POST /api/v1/auth/register-device` with `{"device_id": "<valid-uuid>"}`
- Device ID must be a valid UUID (use `python3 -c "import uuid; print(uuid.uuid4())"` to generate)
- Response includes `access_token` in `data.session.access_token` (wrapped response format)
- Token expiration: 30 days (2592000 seconds)
- Legacy tokens may fail with "invalid JWT structure" if expired

**Quick token generation:**
```bash
# Generate fresh device and extract token
curl -s "http://localhost:3000/api/v1/auth/register-device" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"device_id\":\"$(python3 -c 'import uuid; print(uuid.uuid4())')\"}" \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['session']['access_token'])"
```

### Equipment Data Structure
The `/api/v1/equipment` endpoint returns a **wrapped response**:
```json
{
  "success": true,
  "data": {
    "slots": {
      "weapon": { PlayerItem or null },
      "offhand": { PlayerItem or null },
      ...
    },
    "total_stats": { atkPower, atkAccuracy, defPower, defAccuracy },
    "equipment_count": number
  },
  "timestamp": "2025-10-23T03:49:18.974Z"
}
```

**PlayerItem structure (flattened, not nested):**
```json
{
  "id": "uuid",
  "base_type": "Sword",           // String (not nested ItemType object)
  "item_type_id": "uuid",
  "category": "weapon",
  "level": 3,
  "rarity": "epic",
  "applied_materials": [],
  "computed_stats": { ... },
  "is_styled": false,
  "is_equipped": true,
  "generated_image_url": "https://..."
}
```

**Swift model fix:** `PlayerItem.swift` was updated to use `baseType: String`, `itemTypeId: String`, and `category: String` as flat fields instead of expecting a nested `itemType: ItemType` object.

### Database
- `UserEquipment` table must have rows for ALL 8 slots (even if `item_id` is null)
- Test user `6a7a9353-e4d9-4ae0-b3a8-0736b77a8a99` has items equipped
- ItemTypes exist; no need to create them

### Frontend
When adding detailed logging to decode errors:
- Log the raw response string before throwing (helps debug nil issues)
- Remove FileLogger references if that class doesn't exist (linter may add them)
- Equipment and Auth services both had this issue

### Quick Test
```bash
# Complete workflow: register device, get token, test equipment endpoint
TOKEN=$(curl -s "http://localhost:3000/api/v1/auth/register-device" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"device_id\":\"$(python3 -c 'import uuid; print(uuid.uuid4())')\"}" \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['session']['access_token'])")

curl -s "http://localhost:3000/api/v1/equipment" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**Expected response:** Wrapped format with `success: true`, `data` containing `slots`, `total_stats`, and `equipment_count`. New users will have empty slots (`{}`), existing users will have PlayerItem objects in equipped slots.
