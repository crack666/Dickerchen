// Version configuration for cache busting
window.APP_VERSION = '1.2.3';
window.BUILD_DATE = '2025-09-18T' + new Date().toISOString().split('T')[1];

// Cache busting utility
window.versionedUrl = function(path) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}v=${window.APP_VERSION}`;
};

console.log(`🚀 Dickerchen v${window.APP_VERSION} (${window.BUILD_DATE})`);
