// Console debug commands - paste these in browser console

// Check if leaderboard container exists
console.log('📋 Leaderboard container:', document.getElementById('leaderboard-list'));

// Check if it has content
const leaderboard = document.getElementById('leaderboard-list');
if (leaderboard) {
  console.log('📝 Leaderboard HTML content:', leaderboard.innerHTML);
  console.log('👥 Number of list items:', leaderboard.children.length);
  console.log('🎨 Computed styles:', window.getComputedStyle(leaderboard));
  console.log('👁️ Visibility:', {
    display: leaderboard.style.display,
    visibility: leaderboard.style.visibility,
    opacity: leaderboard.style.opacity,
    height: leaderboard.offsetHeight + 'px',
    width: leaderboard.offsetWidth + 'px'
  });
}

// Check parent container
const leaderboardSection = document.getElementById('leaderboard');
if (leaderboardSection) {
  console.log('📦 Leaderboard section:', leaderboardSection);
  console.log('📏 Section dimensions:', {
    height: leaderboardSection.offsetHeight + 'px',
    width: leaderboardSection.offsetWidth + 'px',
    display: window.getComputedStyle(leaderboardSection).display
  });
}
