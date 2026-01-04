/**
 * Push Notification System for Campus Ride PWA
 * static/js/notifications.js
 */

class NotificationManager {
    constructor() {
        this.permission = 'default';
        this.registration = null;
        this.init();
    }

    async init() {
        // Check if notifications are supported
        if (!('Notification' in window)) {
            console.warn('⚠️ This browser does not support notifications');
            return;
        }

        // Check if service worker is supported
        if (!('serviceWorker' in navigator)) {
            console.warn('⚠️ Service Worker not supported');
            return;
        }

        this.permission = Notification.permission;
        console.log('🔔 Notification permission:', this.permission);

        // Get service worker registration
        try {
            this.registration = await navigator.serviceWorker.ready;
            console.log('✓ Service Worker ready for notifications');
        } catch (error) {
            console.error('❌ Service Worker error:', error);
        }
    }

    // Request notification permission
    async requestPermission() {
        if (this.permission === 'granted') {
            console.log('✓ Notification permission already granted');
            return true;
        }

        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;

            if (permission === 'granted') {
                console.log('✓ Notification permission granted!');
                this.showWelcomeNotification();
                window.dispatchEvent(new Event('notification-permission-granted')); // Notify app
                return true;
            } else {
                console.log('❌ Notification permission denied');
                return false;
            }
        } catch (error) {
            console.error('❌ Permission request error:', error);
            return false;
        }
    }

    // Show welcome notification
    showWelcomeNotification() {
        this.showNotification(
            '🎉 Notifications Enabled!',
            'You\'ll now receive updates about bus arrivals and announcements',
            '/static/icon-192.png'
        );
    }

    // Show basic notification (works even when app is closed)
    async showNotification(title, body, icon = '/static/icon-192.png', data = {}) {
        // 1. Prefer In-App Popup if app is in foreground
        // This ensures interactive buttons (like Mark as Read) work without Service Worker complexity
        if (document.visibilityState === 'visible') {
            console.log('📱 App in foreground, using In-App Popup');
            // Pass data as options (which may contain actions)
            this.showPopup(title, body, 'info', data);
            return;
        }

        if (this.permission !== 'granted') {
            console.warn('⚠️ Cannot show notification: permission not granted');
            // Fallback to in-app popup if permission denied/default
            // Pass data as options (which may contain actions)
            this.showPopup(title, body, 'info', data);
            return;
        }

        try {
            if (this.registration) {
                // Use service worker notification (persistent)
                await this.registration.showNotification(title, {
                    body: body,
                    icon: icon,
                    badge: '/static/icon-72.png',
                    vibrate: [200, 100, 200],
                    data: data,
                    actions: [
                        { action: 'view', title: 'View' },
                        { action: 'close', title: 'Close' }
                    ],
                    tag: data.tag || 'campus-ride-notification',
                    requireInteraction: false,
                    silent: false
                });
                console.log('✓ Notification sent via Service Worker');
            } else {
                // Fallback to basic notification
                new Notification(title, {
                    body: body,
                    icon: icon,
                    badge: '/static/icon-72.png',
                    vibrate: [200, 100, 200],
                    data: data
                });
                console.log('✓ Basic notification sent');
            }
        } catch (error) {
            console.error('❌ Notification error:', error);
            // Fallback
            this.showPopup(title, body, 'error');
        }
    }

    // Bus arrival notification
    notifyBusArrival(busNo, stopName, eta) {
        this.showNotification(
            `🚌 Bus ${busNo} Arriving Soon!`,
            `Bus ${busNo} will arrive at ${stopName} in ${eta} minutes`,
            '/static/icon-192.png',
            {
                type: 'bus-arrival',
                busNo: busNo,
                stopName: stopName,
                eta: eta,
                tag: `bus-${busNo}-arrival`
            }
        );
    }

    // Bus departure notification
    notifyBusDeparture(busNo, stopName) {
        this.showNotification(
            `🚌 Bus ${busNo} Departed`,
            `Bus ${busNo} has left ${stopName}`,
            '/static/icon-192.png',
            {
                type: 'bus-departure',
                busNo: busNo,
                stopName: stopName,
                tag: `bus-${busNo}-departure`
            }
        );
    }

    // Announcement notification
    notifyAnnouncement(title, message, actions = []) {
        this.showNotification(
            `📢 ${title}`,
            message,
            '/static/icon-192.png',
            {
                type: 'announcement',
                tag: 'announcement',
                actions: actions
            }
        );
    }

    // Bus breakdown notification
    notifyBreakdown(busNo, message) {
        this.showNotification(
            `⚠️ Bus ${busNo} Alert`,
            message,
            '/static/icon-192.png',
            {
                type: 'breakdown',
                busNo: busNo,
                tag: `bus-${busNo}-breakdown`,
                requireInteraction: true
            }
        );
    }

    // Schedule change notification
    notifyScheduleChange(title, message) {
        this.showNotification(
            `📅 ${title}`,
            message,
            '/static/icon-192.png',
            {
                type: 'schedule',
                tag: 'schedule-change'
            }
        );
    }

    // Show in-app popup notification (no permission needed)
    showPopup(title, message, type = 'info', options = {}) {
        // Handle legacy call: options might be just duration (number)
        let duration = 3000;
        let actions = [];

        if (typeof options === 'number') {
            duration = options;
        } else {
            duration = options.duration !== undefined ? options.duration : 3000;
            actions = options.actions || [];
        }

        console.log(`[Popup] ${title}: ${message}`);
        const popup = document.createElement('div');
        popup.className = `notification-popup notification-${type}`;

        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            bus: '🚌'
        };

        let actionsHtml = '';
        if (actions.length > 0) {
            actionsHtml = `<div class="notification-actions">
                ${actions.map((action, index) => `
                    <button class="notification-action-btn" data-index="${index}">
                        ${action.title}
                    </button>
                `).join('')}
            </div>`;
        }

        popup.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">${icons[type] || icons.info}</div>
                <div class="notification-text">
                    <div class="notification-title">${title}</div>
                    <div class="notification-message">${message}</div>
                    ${actionsHtml}
                </div>
                <button class="notification-close" aria-label="Close notification">
                    ✕
                </button>
            </div>
        `;

        // Handle Action Clicks
        if (actions.length > 0) {
            const actionBtns = popup.querySelectorAll('.notification-action-btn');
            actionBtns.forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const index = parseInt(btn.dataset.index);
                    if (actions[index] && actions[index].action) {
                        actions[index].action(); // Execute callback
                    }
                    // Close popup after action? Optional. Let's close it.
                    popup.classList.remove('show');
                    setTimeout(() => popup.remove(), 300);
                };
            });
        }

        // Handle close button click
        const closeBtn = popup.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                popup.classList.remove('show');
                setTimeout(() => popup.remove(), 300);
            };
        }

        document.body.appendChild(popup);

        // Animate in
        requestAnimationFrame(() => {
            popup.classList.add('show');
        });

        // Auto remove (only if no actions, or very long duration? Usually sticky if actions present)
        // If actions are important, maybe don't auto-close?
        // User requested: "mark as read". If they ignore it, it should vanish.
        // But if it vanishes, they can't mark as read.
        // Let's set a longer duration if actions exist, e.g. 10s, or keep default.
        // User said "pops up every time", so probably auto-close is fine, they just want to stop FUTURE ones.

        if (duration > 0) {
            setTimeout(() => {
                if (popup.parentElement) {
                    popup.classList.remove('show');
                    setTimeout(() => popup.remove(), 300);
                }
            }, duration);
        }
    }
}

// Create global instance
const notifications = new NotificationManager();

// Expose globally
window.notifications = notifications;

// Export for use in other modules
export { notifications, NotificationManager };

// Test Helper (window.testNotifications)
window.testNotifications = () => {
    console.log('🔔 Testing notifications...');

    // Test 1: Bus arrival
    setTimeout(() => {
        notifications.notifyBusArrival(1, 'KIIT Square', 3);
    }, 1000);

    // Test 2: Announcement
    setTimeout(() => {
        notifications.notifyAnnouncement(
            'Service Update',
            'Bus 2 will be delayed by 15 minutes'
        );
    }, 3000);

    // Test 3: Breakdown
    setTimeout(() => {
        notifications.notifyBreakdown(
            3,
            'Bus has broken down at Master Canteen. Alternative bus arranged.'
        );
    }, 5000);

    // Test 4: Popup
    setTimeout(() => {
        notifications.showPopup(
            'Test Successful!',
            'All notification types are working',
            'success'
        );
    }, 7000);
};
