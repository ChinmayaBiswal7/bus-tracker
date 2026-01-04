import { messaging, getToken, onMessage } from '../firebase-config.js';

const VAPID_KEY = "BJoiF9u6UpFvBbNQcjByY3IfcxS9yivCpdcMS5b1jpg4rFoTnM35kZzmgEuVCWgJiBrcofsPLrjh4CoO5i1DZBE";

export async function initFCM() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const debugEl = document.getElementById('debug-status');
            if (debugEl) debugEl.innerHTML = "🔔 Perm: GRANTED";

            let registration;
            if ('serviceWorker' in navigator) {
                try {
                    registration = await navigator.serviceWorker.ready;
                } catch (e) {
                    console.log("SW Ready Timeout/Error", e);
                }
            }

            const token = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (token) {
                console.log("🔥 FCM Token:", token);
                if (debugEl) debugEl.innerHTML = "🔥 Token: OK";

                // Subscribe
                fetch('/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: token }),
                });
            } else {
                if (debugEl) debugEl.innerHTML = "⚠️ Token: MISSING";
            }
        }
    } catch (err) {
        console.error('FCM Error:', err);
    }
}

import { notifications } from '../notifications.js';

onMessage(messaging, (payload) => {
    console.log('[FCM] Message received: ', payload);
    const { title, body, icon } = payload.notification;
    // Use the robust manager which handles Service Worker fallback logic automatically
    notifications.showNotification(title, body, icon);
});
