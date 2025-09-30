// Dickerchen Service Worker
// Supports: offline core assets, push notifications, dev-friendly behaviour

const VERSION = '1.2.6'; // Match app version exactly - no 'v' prefix
const DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
const CORE_CACHE = `dickerchen-core-${VERSION}`;
const RUNTIME_CACHE = `dickerchen-runtime-${VERSION}`;

// Core assets (small & critical). Index last so we always re-fetch if changed.
const CORE_ASSETS = [
	'/',
	'/index.html',
	'/styles.css',
	'/app.js',
	'/manifest.json',
	'/icon-192.svg',
	'/icon-512.svg',
	'/favicon.ico'
];

// Utility: log only in dev
function log(...args) {
	if (DEV) console.log('[SW]', ...args);
}

// Install: pre-cache core assets (skip if dev & user refreshing often; still cache minimal)
self.addEventListener('install', event => {
	log('install', VERSION, 'DEV=', DEV);
	self.skipWaiting(); // Force immediate activation
	
	// In development, skip caching to avoid stale content
	if (DEV) {
		log('DEV mode: skipping asset caching');
		return;
	}
	
	event.waitUntil(
		caches.open(CORE_CACHE).then(async cache => {
			try {
				// Add cache-busting for critical files
				const assetsWithCacheBust = CORE_ASSETS.map(url => {
					if (url.includes('.css') || url.includes('.js')) {
						return `${url}?v=${VERSION}`;
					}
					return url;
				});
				await cache.addAll(assetsWithCacheBust);
				log('core cached with version', VERSION);
			} catch (e) {
				log('core cache error', e);
			}
		})
	);
});

// Activate: clean old caches and force client reload
self.addEventListener('activate', event => {
	log('activate - forcing client update');
	event.waitUntil(
		(async () => {
			const names = await caches.keys();
			await Promise.all(
				names.filter(n => ![CORE_CACHE, RUNTIME_CACHE].includes(n))
					.map(n => caches.delete(n))
			);
			await self.clients.claim();
			
			// Force all clients to reload to get new version (safely)
			try {
				const clients = await self.clients.matchAll();
				clients.forEach(client => {
					if (client.url && client.url.includes('dickerchen')) {
						client.postMessage({ type: 'UPDATE_AVAILABLE' });
					}
				});
				log('clients notified safely');
			} catch (e) {
				log('client notification failed (non-critical):', e);
			}
		})()
	);
});

// Fetch strategy:
//  - API requests: network-first with fallback to cache (prod), network only (dev)
//  - HTML navigation: network-first, fallback to cached index
//  - Static assets (css/js/svg/png): cache-first, update in background
//  - Everything else: pass through
self.addEventListener('fetch', event => {
	const req = event.request;
	const url = new URL(req.url);

	// Ignore non-GET
	if (req.method !== 'GET') return;

	// Bypass chrome-extension and similar
	if (url.protocol.startsWith('chrome')) return;

	// API calls
	if (url.pathname.startsWith('/api/')) {
		if (DEV) return; // dev: do not interfere
		event.respondWith(networkFirst(req));
		return;
	}

	// Navigations / HTML
	if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
		event.respondWith(
			fetch(req)
				.then(r => {
					cachePut(CORE_CACHE, '/', r.clone());
					return r;
				})
				.catch(() => caches.match('/index.html'))
		);
		return;
	}

	// Static assets
	if (/(\.js$|\.css$|\.svg$|\.png$|\.ico$)/.test(url.pathname)) {
		// In development, always fetch fresh to avoid stale content
		if (DEV) {
			log('DEV mode: fetching fresh asset', url.pathname);
			event.respondWith(fetch(req));
			return;
		}
		event.respondWith(cacheFirst(req));
		return;
	}
});

async function networkFirst(request) {
	try {
		const fresh = await fetch(request);
		cachePut(RUNTIME_CACHE, request, fresh.clone());
		return fresh;
	} catch (e) {
		const cached = await caches.match(request);
		if (cached) return cached;
		return new Response('Offline', { status: 503, statusText: 'Offline' });
	}
}

async function cacheFirst(request) {
	const cached = await caches.match(request);
	if (cached) {
		// Update in background (stale-while-revalidate)
		fetch(request).then(r => cachePut(RUNTIME_CACHE, request, r)).catch(()=>{});
		return cached;
	}
	try {
		const fresh = await fetch(request);
		cachePut(RUNTIME_CACHE, request, fresh.clone());
		return fresh;
	} catch (e) {
		return new Response('Not available', { status: 404 });
	}
}

async function cachePut(cacheName, request, response) {
	try {
		const cache = await caches.open(cacheName);
		await cache.put(request, response);
	} catch (e) {
		log('cache put failed', e);
	}
}

// Push notifications
self.addEventListener('push', event => {
	let data = {};
	try { data = event.data ? event.data.json() : {}; } catch (e) {}
	
	// Include sender name in title if available
	let title = data.title || 'Dickerchen';
	if (data.fromUserName) {
		title = `${title} (von ${data.fromUserName})`;
	}
	
	const body = data.body || 'Zeit für ein paar Dicke!';
	const options = {
		body,
		icon: '/icon-192.svg',
		badge: '/icon-192.svg',
		data: data.data || '/',
	};
	event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
	event.notification.close();
	const target = event.notification.data || '/';
	event.waitUntil(
		(async () => {
			const allClients = await self.clients.matchAll({ type: 'window' });
			for (const client of allClients) {
				if (client.url.includes(self.location.origin)) {
					client.focus();
					return;
				}
			}
			self.clients.openWindow(target);
		})()
	);
});

// Message handler (optional future use)
self.addEventListener('message', event => {
	if (event.data === 'skipWaiting') {
		self.skipWaiting();
	}
});

