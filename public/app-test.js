// Simple test to verify script loading
console.log('🔥 FRESH app.js loaded at:', new Date().toISOString());
console.log('🔍 Testing if this appears in console...');

// Immediate API test
fetch('/api/test')
  .then(r => r.json())
  .then(data => console.log('🚀 Immediate API test:', data))
  .catch(e => console.error('❌ Immediate API test failed:', e));

// Test leaderboard immediately
fetch('/api/leaderboard/combined')
  .then(r => r.json())
  .then(data => {
    console.log('📊 Immediate leaderboard test:', data);
    console.log('👥 Users found:', data.length);
  })
  .catch(e => console.error('❌ Immediate leaderboard test failed:', e));

console.log('✅ Test script executed completely');
