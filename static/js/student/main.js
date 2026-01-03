import { auth } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initMap, stopTrackingRoute, setBusFilter, startTrackingRoute } from './map.js';
import { openSchedule, closeSchedule, initSchedule } from './schedule.js';
import { openAnnouncements, closeAnnouncements, initAnnouncements } from './announcements.js';
import { openDrivers, closeDrivers, closeProfile, showProfile } from './driver-directory.js';
import { toggleSidebar, requestNotificationPermission, initTheme } from './ui.js';
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
        initTheme();
        initSearch();

        // Socket Status Listeners (Removed UI, but keeping connection alive)
        const socket = io(); // Connect/Get global instance

        // Resize Map Fallback
        setTimeout(() => { if (window.map) window.map.invalidateSize(); }, 500);
    } else {
        window.location.href = '/login?role=student';
    }
});

// --- Search Logic ---
function initSearch() {
    const input = document.getElementById('trackInput');
    const suggestionsBox = document.getElementById('search-suggestions');
    if (!input || !suggestionsBox) return;

    let debounceTimer;

    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimer);

        if (query.length < 2) {
            suggestionsBox.classList.add('hidden');
            if (query.length === 0) setBusFilter('');
            return;
        }

        debounceTimer = setTimeout(() => {
            fetchSuggestions(query);
        }, 300);
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggestionsBox.contains(e.target)) {
            suggestionsBox.classList.add('hidden');
        }
    });
}

async function fetchSuggestions(query) {
    const suggestionsBox = document.getElementById('search-suggestions');
    try {
        const res = await fetch(`/api/search_stops?q=${encodeURIComponent(query)}`);
        const results = await res.json();

        suggestionsBox.innerHTML = '';
        if (results.length > 0) {
            suggestionsBox.classList.remove('hidden');
            results.forEach(item => {
                const div = document.createElement('div');
                div.className = "p-3 border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer transition-colors";
                div.innerHTML = `
                    <div class="flex flex-col">
                        <span class="text-white font-bold text-sm text-left">${item.stop_name}</span>
                        <div class="flex gap-1 mt-1 flex-wrap">
                            ${item.buses.map(b => `<span class="bg-blue-600 text-[10px] px-1.5 py-0.5 rounded text-white font-mono">Bus ${b}</span>`).join('')}
                        </div>
                    </div>
                `;
                div.onclick = () => {
                    selectSuggestion(item);
                };
                suggestionsBox.appendChild(div);
            });
        } else {
            suggestionsBox.classList.add('hidden');
        }
    } catch (e) {
        console.error("Search failed", e);
    }
}

function selectSuggestion(item) {
    const input = document.getElementById('trackInput');
    const suggestionsBox = document.getElementById('search-suggestions');

    input.value = item.stop_name;
    suggestionsBox.classList.add('hidden');

    console.log("Filtering for buses:", item.buses);
    setBusFilter(item.buses);
}
