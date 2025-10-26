# Testing Backend Endpoints

## Dev Auth Bypass (Local Development Only)

For local testing, use the **dev bypass authentication** header to skip JWT token generation.

**Key location:** `mystica-express/.env.local` → `DEV_BYPASS_KEY`

### Email-Based User
```bash
curl -X GET http://localhost:3000/api/v1/inventory \
  -H "X-Dev-Token: a0527824305b2d74a9d4386fea1fae904dad4876c12329e72c7fcdba067f5920" \
  -H "X-Dev-User-Id: 85EF3561-6C9E-4D6D-B02D-FE3FFD08658A" \
  -H "X-Dev-Email: admin@mystica.app"
```

### Anonymous Device User
```bash
curl -X GET http://localhost:3000/api/v1/inventory \
  -H "X-Dev-Token: a0527824305b2d74a9d4386fea1fae904dad4876c12329e72c7fcdba067f5920" \
  -H "X-Dev-User-Id: 85EF3561-6C9E-4D6D-B02D-FE3FFD08658A" \
  -H "X-Dev-Device-Id: 85EF3561-6C9E-4D6D-B02D-FE3FFD08658A"
```

**Requirements:**
- ✅ Only works in `NODE_ENV=development`
- ✅ `X-Dev-Token` must match `DEV_BYPASS_KEY` in `.env.local` exactly
- ✅ `X-Dev-User-Id` is required
- ✅ `X-Dev-Device-Id` (anonymous) OR `X-Dev-Email` (email-based) are optional
- ⚠️ Logs a warning so you know bypass is active

---

## Predefined Test Users

Use these user IDs with the dev bypass:

- **Admin (email):** `123e4567-e89b-12d3-a456-426614174000`
- **Email User:** `550e8400-e29b-41d4-a716-446655440000`
- **Anonymous (device):** `85EF3561-6C9E-4D6D-B02D-FE3FFD08658A`

---

## Response Structures

### Equipment Endpoint
The `/api/v1/equipment` endpoint returns a **wrapped response**:
```json
{
  "success": true,
  "data": {
    "slots": {
      "weapon": { "PlayerItem or null" },
      "offhand": { "PlayerItem or null" }
    },
    "total_stats": { "atkPower": 0, "atkAccuracy": 0, "defPower": 0, "defAccuracy": 0 },
    "equipment_count": 0
  },
  "timestamp": "2025-10-23T03:49:18.974Z"
}
```

### PlayerItem Structure
```json
{
  "id": "uuid",
  "base_type": "Sword",
  "item_type_id": "uuid",
  "category": "weapon",
  "level": 3,
  "rarity": "epic",
  "applied_materials": [],
  "computed_stats": { },
  "is_styled": false,
  "is_equipped": true,
  "generated_image_url": "https://..."
}
```

---

## Database Notes

- `UserEquipment` table must have rows for **ALL 8 slots** (even if `item_id` is null)
- ItemTypes exist; no need to create them
- Test user `6a7a9353-e4d9-4ae0-b3a8-0736b77a8a99` has items equipped

---

## Complete Test Example

```bash
# Test as admin user
curl -s "http://localhost:3000/api/v1/equipment" \
  -H "X-Dev-Token: a0527824305b2d74a9d4386fea1fae904dad4876c12329e72c7fcdba067f5920" \
  -H "X-Dev-User-Id: 47B46728-3DF4-49BA-83D3-8742D86DAD80" \
  -H "X-Dev-Email: admin@mystica.app" | python3 -m json.tool
```

Expected response: Wrapped format with `success: true`, `data` containing `slots`, `total_stats`, and `equipment_count`.

---

## Notes

- **Swift model:** `PlayerItem.swift` uses flat fields (`baseType`, `itemTypeId`, `category`) instead of nested objects
- **Response format:** All endpoints use wrapped format with `success`, `data`, and `timestamp` fields
