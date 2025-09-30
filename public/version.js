// Version configuration for cache busting
window.APP_VERSION = '1.2.5';
window.BUILD_DATE = '2025-09-30T16:02:23+02:00';

// Cache busting utility
window.versionedUrl = function(path) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}v=${window.APP_VERSION}`;
};

console.log(`🚀 Dickerchen v${window.APP_VERSION} (${window.BUILD_DATE})`);
