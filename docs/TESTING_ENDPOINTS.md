# Testing Equipment Endpoints

## Key Learnings

### Authentication
- Device tokens need `exp` claim or they fail silently with "invalid JWT structure"
- Use the app's existing keychain token rather than trying to create custom JWTs
- Existing devices: `EBC2A413-66A2-4566-9339-0B5B1DE4A788` (frontend test user)

### Equipment Data Structure
The `/api/v1/equipment` endpoint returns:
```json
{
  "slots": {
    "weapon": { PlayerItem or null },
    "offhand": { PlayerItem or null },
    ...
  },
  "total_stats": { atkPower, atkAccuracy, defPower, defAccuracy },
  "equipment_count": number
}
```

Frontend Equipment model needs custom `init(from:)` to handle optional PlayerItem fields in each slot (can't rely on auto Codable).

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
# Get equipped items for test device
curl "http://localhost:3000/api/v1/equipment" \
  -H "Authorization: Bearer <token>"
```

Response should include `slots` with actual item objects, not empty.
