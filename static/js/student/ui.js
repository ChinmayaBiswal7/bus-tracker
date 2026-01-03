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

// Theme Logic
export function initTheme() {
    const toggleBtn = document.getElementById('theme-toggle');
    const mapEl = document.getElementById('map');

    // Default to Dark Mode
    let isDarkMode = true;
    if (localStorage.getItem('theme') === 'light') {
        isDarkMode = false;
    }

    const updateTheme = () => {
        if (isDarkMode) {
            // Dark Mode
            if (mapEl) mapEl.classList.add('map-dark-mode');
            if (toggleBtn) toggleBtn.innerHTML = `
            <svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>`; // Sun Icon for switching to light
        } else {
            // Light Mode
            if (mapEl) mapEl.classList.remove('map-dark-mode');
            if (toggleBtn) toggleBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>`; // Moon Icon for switching to dark
        }
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    };

    // Initialize
    updateTheme();

    // Event Listener
    if (toggleBtn) {
        toggleBtn.onclick = () => {
            isDarkMode = !isDarkMode;
            updateTheme();
        };
    }
}
