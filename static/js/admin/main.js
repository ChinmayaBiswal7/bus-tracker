import { auth } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initMap } from './map.js';
import { initAdminUI } from './admin_ui.js';

console.log("[ADMIN] Initializing Dashboard...");

// Main Init
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("[AUTH] Admin access granted:", user.email);
            initMap();
            initAdminUI();
        } else {
            console.warn("[AUTH] No user detected. Redirecting to login.");
            window.location.href = '/login?role=admin';
        }
    });
});
window.logout = function () {
    auth.signOut().then(() => window.location.href = '/').catch(console.error);
};
