// Quick script to show actual AI dialogue generation
const { EnemyChatterService } = require('./dist/services/EnemyChatterService.js');

const service = new EnemyChatterService();

// Test combat event
const testEvent = {
  sessionId: '550e8400-e29b-41d4-a716-446655440001',
  eventType: 'combat_start',
  eventDetails: {
    turn_number: 1,
    player_hp_pct: 1.0,
    enemy_hp_pct: 1.0,
  },
};

console.log('🎮 Testing Enemy Dialogue Generation...\n');

service.generateDialogue(
  testEvent.sessionId,
  testEvent.eventType,
  testEvent.eventDetails
).then(response => {
  console.log('📝 Generated Dialogue:');
  console.log(`   "${response.dialogue}"`);
  console.log(`\n📊 Details:`);
  console.log(`   Enemy Type: ${response.enemy_type}`);
  console.log(`   Tone: ${response.dialogue_tone}`);
  console.log(`   AI Generated: ${response.was_ai_generated ? 'Yes' : 'No (fallback)'}`);
  console.log(`   Generation Time: ${response.generation_time_ms}ms`);
  console.log(`   Word Count: ${response.dialogue.split(/\s+/).length}`);
  console.log(`\n✅ Success!`);
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
