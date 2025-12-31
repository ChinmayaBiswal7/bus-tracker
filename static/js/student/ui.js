export const CACHE_DTDO = "v1_ui";

// Sidebar Toggle Logic
export function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('-translate-x-full');
}

// GPS Status UI Helper
export function updateGpsStatus(state, msg) {
    const gpsDot = document.getElementById('gps-dot');
    const gpsText = document.getElementById('gps-text');

    if (!gpsText || !gpsDot) return;
    gpsText.textContent = msg;

    if (state === 'searching') {
        gpsDot.className = "w-2 h-2 rounded-full bg-yellow-500 animate-pulse";
    } else if (state === 'active') {
        gpsDot.className = "w-2 h-2 rounded-full bg-green-500";
    } else if (state === 'error') {
        gpsDot.className = "w-2 h-2 rounded-full bg-red-500";
    }
}

// Update Server Status
export function updateServerStatus(isOnline) {
    const serverDot = document.getElementById('server-dot');
    const serverText = document.getElementById('server-text');
    if (serverDot && serverText) {
        if (isOnline) {
            serverDot.className = "w-2 h-2 rounded-full bg-green-500";
            serverText.textContent = "Server: Live";
        } else {
            serverDot.className = "w-2 h-2 rounded-full bg-red-500 animate-pulse";
            serverText.textContent = "Server: Offline";
        }
    }
}

// Request Notification Permission (Badge Logic)
export function requestNotificationPermission() {
    if (Notification.permission === 'granted') {
        alert("Notifications are already enabled! 🔔");
        return;
    }
    const notifyBtn = document.getElementById('btn-notify');
    const notifyBadge = document.getElementById('notify-badge');

    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            if (notifyBadge) notifyBadge.classList.add('hidden');
            if (notifyBtn) notifyBtn.classList.replace('text-slate-400', 'text-green-400');
            new Notification("Notifications Enabled", {
                body: "You will now receive alerts for new announcements!",
                icon: "https://cdn-icons-png.flaticon.com/512/3233/3233914.png"
            });
        }
    });
}
