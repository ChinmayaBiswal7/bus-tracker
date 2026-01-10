// Firebase Messaging Service Worker (Merged)
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyAW7XS_Q_Kdh2eiYEaKBEHvZDpOk7-ynDg",
    authDomain: "bustracker-c0af6.firebaseapp.com",
    projectId: "bustracker-c0af6",
    storageBucket: "bustracker-c0af6.firebasestorage.app",
    messagingSenderId: "103145940746",
    appId: "1:103145940746:web:80a8444bff23e75b94fcf3",
    measurementId: "G-PKF72NB657"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Store shown notifications to prevent duplicates
const shownNotifications = new Set();
const NOTIFICATION_TIMEOUT = 60000; // 1 minute

// Clean up old notifications
setInterval(() => { shownNotifications.clear(); }, NOTIFICATION_TIMEOUT);

messaging.onBackgroundMessage(function (payload) {
    console.log('[sw.js] Received background message ', payload);

    // 1. Check if App is Open & Focused (Suppress)
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
        for (var i = 0; i < clientList.length; i++) {
            var client = clientList[i];
            if (client.url.includes('/') && 'focus' in client && client.visibilityState === 'visible') {
                console.log('[sw.js] App open. Suppressing.');
                return;
            }
        }

        // 2. Prepare Data
        const data = payload.data || payload.notification;
        const title = data.title || "New Announcement";
        const body = data.body || "Check app";

        // UNIQUE TAG Generation (Critical for prevention)
        // Use provided tag or generate one from content
        const tag = data.tag || `msg-${title}-${body}`.replace(/\s+/g, '-');

        // 3. DEDUPLICATION CHECK
        if (shownNotifications.has(tag)) {
            console.log('[sw.js] Duplicate prevented:', tag);
            return;
        }
        shownNotifications.add(tag);

        const notificationOptions = {
            body: body,
            icon: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
            data: { url: '/' },
            tag: tag, // Browser handles replacement if same tag
            renotify: false, // Don't buzz again if same tag
            actions: [
                { action: 'mark_read', title: 'Mark as Read' },
                { action: 'view', title: 'View App' }
            ]
        };

        return self.registration.showNotification(title, notificationOptions);
    });
});


self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

const CACHE_NAME = 'bus-tracker-v7-force-update'; // Bump version to force fresh cache

// Handle Notification Click (Opens App)
// Handle Notification Click (Opens App)
self.addEventListener('notificationclick', function (event) {
    const action = event.action;
    const notification = event.notification;

    // Always close the notification first
    notification.close();

    if (action === 'close' || action === 'mark_read') {
        // Just close (already done above)
        console.log('[sw.js] Notification closed/marked as read');
        return;
    }

    // Default behavior or 'view' action: Open/Focus App
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            // Check if app is already open
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if (client.url.includes('/') && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not open, open it
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

const urlsToCache = [
    '/',
    '/student',
    '/static/manifest.json',
    '/static/firebase-messaging-sw.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', (event) => {
    // Perform install steps
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Network hit - return and cache it
                // Check if valid response
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }

                // IMPORTANT: Do NOT cache POST requests (or anything other than GET)
                if (event.request.method !== 'GET') {
                    return response;
                }

                // Clone response to cache
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                    .then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                return response;
            })
            .catch(() => {
                // Network failed (Offline) - return from cache
                return caches.match(event.request);
            })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Take control of all clients immediately
    );
});
