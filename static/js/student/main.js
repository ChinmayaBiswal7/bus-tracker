import { auth } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initMap, stopTrackingRoute, setBusFilter, startTrackingRoute } from './map.js';
import { openSchedule, closeSchedule, initSchedule } from './schedule.js';
import { openAnnouncements, closeAnnouncements, initAnnouncements } from './announcements.js';
import { openDrivers, closeDrivers, closeProfile, showProfile } from './driver-directory.js';
import { toggleSidebar, requestNotificationPermission, initTheme } from './ui.js';
import { initFCM } from './fcm.js';
import { initChat, toggleChat } from './chat.js';
import { StopSearchUI } from './search.js?v=4'; // Search Module (Cache Bust v4)

// Attach Globals for HTML onclick attributes
window.toggleSidebar = toggleSidebar;
window.requestNotificationPermission = requestNotificationPermission;
window.toggleChat = toggleChat;
window.openSchedule = openSchedule;
window.closeSchedule = closeSchedule;
window.openAnnouncements = openAnnouncements;
window.closeAnnouncements = closeAnnouncements;
window.openDrivers = openDrivers;
window.closeDrivers = closeDrivers;
window.closeProfile = closeProfile;
window.showProfile = showProfile;
window.stopTrackingRoute = stopTrackingRoute;
window.startTrackingRoute = startTrackingRoute;
window.startTrackingRouteByBusNo = startTrackingRoute; // Fix: Alias for legacy onclick handlers

window.setFilter = async function () {
    const input = document.getElementById('trackInput');
    if (!input) return;
    const val = input.value.trim();

    // 1. Legacy: Filter Map by Bus Number (Immediate)
    setBusFilter(val);

    // 2. New: Search for Stops (if module loaded)
    if (searchUI && val.length >= 2) {
        searchUI.performSearch(val);
    }
};

window.quickSearch = function (busId) {
    // Used by "Locate" buttons or map logic to trigger a specific bus view
    const input = document.getElementById('trackInput');
    if (input) {
        input.value = busId;
        setBusFilter(busId);
    }
};

window.logout = function () {
    auth.signOut().then(() => window.location.href = '/').catch(console.error);
};

// Global State
let map;
let searchUI;

// Components Init
function initializeAppComponents() {
    console.log("[Main] Initializing Components...");
    map = initMap();
    searchUI = new StopSearchUI(map);

    initAnnouncements();
    initSchedule();
    initFCM();
    initChat();
    initTheme();

    // Resize map fallback
    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 500);
}

// Auth Guard & Entry Point
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User logged in:", user.email);

        // Show UI
        document.getElementById('main-body').style.display = 'block';

        // Update Name
        const nameEl = document.getElementById('user-display-name');
        if (nameEl) nameEl.textContent = user.displayName || user.email.split('@')[0];

        // Init App if not already done (idempotency check often good, but here simple call)
        initializeAppComponents();

    } else {
        // Redirect if not logged in
        window.location.href = '/login?role=student';
    }
});

// Keep Socket connection alive
const socket = io(); 
