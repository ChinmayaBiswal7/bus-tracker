import { auth } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initMap, stopTrackingRoute, setBusFilter, startTrackingRoute } from './map.js?v=27';
import { openSchedule, closeSchedule, initSchedule } from './schedule.js?v=3';
import { openAnnouncements, closeAnnouncements, initAnnouncements } from './announcements.js';
import { openDrivers, closeDrivers, closeProfile, showProfile } from './driver-directory.js';
import { toggleSidebar, requestNotificationPermission } from './ui.js';
import { initFCM } from './fcm.js';
import { initChat, toggleChat } from './chat.js';

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
window.setFilter = function () {
    const input = document.getElementById('trackInput');
    if (input) setBusFilter(input.value);
};
window.quickSearch = function (busId) {
    const input = document.getElementById('trackInput');
    if (input) {
        input.value = busId;
        setBusFilter(busId);
    }
};
window.logout = function () {
    auth.signOut().then(() => window.location.href = '/').catch(console.error);
};

// Auth Guard & Init
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User logged in:", user.email);
        document.getElementById('main-body').style.display = 'block';
        const nameEl = document.getElementById('user-display-name');
        if (nameEl) nameEl.textContent = user.displayName || user.email.split('@')[0];

        // Initialize Components
        initMap();
        initAnnouncements();
        initSchedule();
        initFCM();
        initChat();

        // Resize Map Fallback
        setTimeout(() => { if (window.map) window.map.invalidateSize(); }, 500);
    } else {
        window.location.href = '/login?role=student';
    }
});
