import { auth } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initMap, toggleSession, stopSession, setMode, setCrowdStatus } from './tracking.js';
import { initAnnouncements } from './announcements.js';
import { initSchedule, addTimeSlot, saveSchedule } from './schedule.js';
import { initChat } from './chat.js';
import { togglePanel, closePanels, toggleSidebar } from './ui.js';

// Global Exports for HTML onclick
window.togglePanel = togglePanel;
window.closePanels = closePanels;
window.toggleSidebar = toggleSidebar;
window.toggleSession = toggleSession;
window.stopSession = stopSession;
window.setMode = setMode;
window.setCrowdStatus = setCrowdStatus;
window.addTimeSlot = addTimeSlot;
window.saveSchedule = saveSchedule;
window.logout = function () {
    auth.signOut().then(() => window.location.href = '/').catch(console.error);
};

// Auth and Init
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Driver Module Loaded:", user.email);
        const body = document.getElementById('main-body');
        if (body) {
            body.style.display = 'block';
            body.setAttribute('data-user-email', user.email);
            // Smart Fallback: If no display name, parse from email
            const fallbackName = user.displayName || user.email.split('@')[0].replace(/[0-9]/g, '').replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            body.setAttribute('data-user-name', fallbackName || 'Driver');
        }

        // Init Components
        initMap();
        initAnnouncements();
        initSchedule();
        initChat();
    } else {
        window.location.href = '/login?role=driver';
    }
});
