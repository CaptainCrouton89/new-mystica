#!/bin/bash
cd mystica-express
# Start server in background
pnpm build > /dev/null 2>&1
NODE_ENV=test timeout 5s pnpm start > /dev/null 2>&1 &
SERVER_PID=$!
sleep 2

# Make a test request
curl -X POST http://localhost:3000/api/v1/combat/enemy-chatter \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "session_id": "550e8400-e29b-41d4-a716-446655440001",
    "event_type": "combat_start",
    "event_details": {
      "turn_number": 1,
      "player_hp_pct": 1.0,
      "enemy_hp_pct": 1.0
    }
  }' 2>/dev/null | jq '.dialogue_response.dialogue, .dialogue_response.was_ai_generated, .dialogue_response.generation_time_ms'

# Cleanup
kill $SERVER_PID 2>/dev/null
