import { db, collection, query, orderBy, onSnapshot, getDocs } from '../firebase-config.js';
import { toggleSidebar } from './ui.js';

export function openSchedule() {
    console.log("Opening Schedule (Module)...");
    const overlay = document.getElementById('schedule-overlay');
    if (!overlay) return console.error("Schedule overlay not found");

    overlay.classList.remove('hidden');
    if (window.innerWidth < 768) toggleSidebar();

    fetchSchedules();
}

export function closeSchedule() {
    const overlay = document.getElementById('schedule-overlay');
    if (overlay) overlay.classList.add('hidden');
}

function fetchSchedules() {
    const listEl = document.getElementById('schedule-list');
    if (!listEl) return;

    listEl.innerHTML = '<p class="text-slate-500 text-center italic mt-10 animate-pulse">Loading schedules...</p>';

    const q = query(collection(db, "schedules"), orderBy("last_update", "desc"));

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            listEl.innerHTML = '<p class="text-slate-500 text-center italic mt-10">No schedules published yet.</p>';
            return;
        }

        listEl.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const busNo = data.bus_no || doc.id;
            const containerId = `sched-box-${doc.id}`;

            const div = document.createElement('div');
            div.className = "border border-slate-700 rounded-xl overflow-hidden mb-2";
            div.id = containerId;

            div.innerHTML = `
             <div class="flex items-center justify-between p-4 bg-slate-800/80 hover:bg-slate-800 cursor-pointer text-left" class="sched-item-header">
                <div class="flex items-center gap-3 pointer-events-none">
                    <div class="w-8 h-8 rounded-full bg-purple-900/50 flex items-center justify-center text-xs">📅</div>
                    <span class="font-bold text-slate-200 text-sm">Bus ${busNo}</span>
                </div>
                <svg id="arrow-sched-${doc.id}" class="w-5 h-5 text-slate-500 transition-transform pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
            </div>
            <div id="sched-content-${doc.id}" class="hidden bg-slate-900/50 p-4 space-y-3 min-h-[50px]">
                <p class="text-xs text-slate-500 animate-pulse">Loading dates...</p>
            </div>
        `;
            // Add click listener programmatically to avoid window.loadBusSchedule Dependency inside HTML string if possible,
            // but for simplicity we keep usage of exported functions if we attach them to window.
            // Here, I will attach the listener to the first child (header) specificially.
            div.firstElementChild.addEventListener('click', () => loadBusSchedule(doc.id));

            listEl.appendChild(div);
        });
    }, (error) => {
        console.error("Error fetching schedules:", error);
        listEl.innerHTML = '<p class="text-red-400 text-center text-xs mt-10">Error loading schedules.</p>';
    });
}

export function loadBusSchedule(busId) {
    console.log("Loading schedule for:", busId);
    const content = document.getElementById(`sched-content-${busId}`);
    const arrow = document.getElementById(`arrow-sched-${busId}`);

    if (content.classList.contains('hidden')) {
        // Open
        content.classList.remove('hidden');
        arrow.classList.add('rotate-180');
        // Continue to fetch
    } else {
        // Close
        content.classList.add('hidden');
        arrow.classList.remove('rotate-180');
        return;
    }

    // Fetch Dates
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
        content.innerHTML = '<p class="text-xs text-red-400">Failed to load.</p>';
    });
}
