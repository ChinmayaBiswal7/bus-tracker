import { db, collection, query, orderBy, onSnapshot, getDocs } from '../firebase-config.js';
import { toggleSidebar } from './ui.js';

// DEBUG: Confirm file load
console.log("Schedule Module v3 Loaded");
// alert("Update: Schedule Module v3 Loaded! Try clicking now."); 

let unsubscribeSchedules = null;
let activeSchedules = [];

// Initialize: Bind Button (and maybe Badge if we had one)
export function initSchedule() {
    // 1. Bind Button (Robustly refind if replaced)
    const btn = document.getElementById('btn-open-sched');
    if (btn) {
        // Remove old listeners by cloning (optional but safe) or just add new one
        // Since we are using modules, just adding is fine
        btn.onclick = openSchedule; // Direct bind for max reliability
    } else {
        console.warn("Schedule button not found in DOM");
    }
}

export function openSchedule() {
    console.log("Opening Schedule...");
    const overlay = document.getElementById('schedule-overlay');
    if (!overlay) return;

    overlay.classList.remove('hidden');
    if (window.innerWidth < 768) toggleSidebar();

    // Start Listening if not already
    if (!unsubscribeSchedules) {
        subscribeToSchedules();
    } else {
        renderScheduleList(); // Just re-render if already listening
    }
}

export function closeSchedule() {
    const overlay = document.getElementById('schedule-overlay');
    if (overlay) overlay.classList.add('hidden');
}

function subscribeToSchedules() {
    const listEl = document.getElementById('schedule-list');
    if (listEl) listEl.innerHTML = '<p class="text-slate-500 text-center italic mt-10 animate-pulse">Loading schedules...</p>';

    const q = query(collection(db, "schedules"), orderBy("last_update", "desc"));

    unsubscribeSchedules = onSnapshot(q, (snapshot) => {
        activeSchedules = [];
        if (snapshot.empty) {
            renderScheduleList();
            return;
        }

        snapshot.forEach(doc => {
            activeSchedules.push({ id: doc.id, ...doc.data() });
        });
        renderScheduleList();

    }, (error) => {
        console.error("Error fetching schedules:", error);
        if (listEl) listEl.innerHTML = '<p class="text-red-400 text-center text-xs mt-10">Error loading schedules.</p>';
    });
}

function renderScheduleList() {
    const listEl = document.getElementById('schedule-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (activeSchedules.length === 0) {
        listEl.innerHTML = '<p class="text-slate-500 text-center italic mt-10">No schedules published yet.</p>';
        return;
    }

    activeSchedules.forEach(bus => {
        const containerId = `sched-box-${bus.id}`;
        const div = document.createElement('div');
        div.className = "border border-slate-700 rounded-xl overflow-hidden mb-2";
        div.id = containerId;

        div.innerHTML = `
             <div class="flex items-center justify-between p-4 bg-slate-800/80 hover:bg-slate-800 cursor-pointer text-left sched-item-header">
                <div class="flex items-center gap-3 pointer-events-none">
                    <div class="w-8 h-8 rounded-full bg-purple-900/50 flex items-center justify-center text-xs">📅</div>
                    <span class="font-bold text-slate-200 text-sm">Bus ${bus.bus_no || bus.id}</span>
                </div>
                <svg id="arrow-sched-${bus.id}" class="w-5 h-5 text-slate-500 transition-transform pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
            </div>
            <div id="sched-content-${bus.id}" class="hidden bg-slate-900/50 p-4 space-y-3 min-h-[50px]">
                <p class="text-xs text-slate-500 animate-pulse">Loading dates...</p>
            </div>
        `;

        // Click Listener for Accordion
        div.firstElementChild.addEventListener('click', () => toggleScheduleSection(bus.id));
        listEl.appendChild(div);
    });
}

// Named "toggle" to match announcements pattern
export function toggleScheduleSection(busId) {
    const content = document.getElementById(`sched-content-${busId}`);
    const arrow = document.getElementById(`arrow-sched-${busId}`);
    if (!content) return;

    if (content.classList.contains('hidden')) {
        // Open
        content.classList.remove('hidden');
        if (arrow) arrow.classList.add('rotate-180');
        loadBusScheduleDetails(busId);
    } else {
        // Close
        content.classList.add('hidden');
        if (arrow) arrow.classList.remove('rotate-180');
    }
}

function loadBusScheduleDetails(busId) {
    const content = document.getElementById(`sched-content-${busId}`);

    // Fetch Dates (Subcollection)
    const today = new Date().toISOString().split('T')[0];
    const q = query(collection(db, "schedules", busId, "dates"), orderBy("__name__"));

    getDocs(q).then(snapshot => {
        content.innerHTML = '';
        const validDocs = snapshot.docs.filter(d => d.id >= today);

        if (validDocs.length === 0) {
            content.innerHTML = '<p class="text-xs text-slate-500 text-center italic">No upcoming schedule.</p>';
            return;
        }

        validDocs.forEach(d => {
            const dateData = d.data();
            const timings = dateData.timings || [];
            const niceDate = new Date(d.id).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

            const row = document.createElement('div');
            row.className = "mb-3 last:mb-0";

            let timelineHTML = '';
            timings.forEach(t => {
                timelineHTML += `
                <div class="flex items-start gap-3 relative pb-4 last:pb-0 border-l border-slate-700 ml-2 pl-4">
                    <div class="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-purple-500 border-2 border-slate-900"></div>
                    <div>
                        <p class="text-white font-bold font-mono text-sm">${t.time}</p>
                        <p class="text-slate-400 text-xs">${t.note}</p>
                    </div>
                </div>
             `;
            });

            row.innerHTML = `
            <p class="text-[10px] uppercase font-bold text-slate-500 mb-2 sticky top-0 bg-slate-900/90 py-1 z-10">${niceDate}</p>
            <div class="pl-2">${timelineHTML}</div>
         `;
            content.appendChild(row);
        });
    }).catch(err => {
        console.error("Error loading dates:", err);
        content.innerHTML = '<p class="text-xs text-red-400">Failed to load details.</p>';
    });
}
