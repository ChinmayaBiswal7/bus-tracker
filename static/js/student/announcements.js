import { db, collection, query, orderBy, limit, onSnapshot } from '../firebase-config.js';
import { toggleSidebar } from './ui.js';

let activeBuses = [];
let unsubscribeMessages = {};

// Helper: Send Notification (Local)
function sendLocalNotification(title, body) {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: "https://cdn-icons-png.flaticon.com/512/3233/3233914.png"
        });
    }
}

export function initAnnouncements() {
    const overlayEl = document.getElementById('announcement-overlay');
    const badgeEl = document.getElementById('badge-count');

    // Listener
    const qBuses = query(collection(db, "announcements"), orderBy("last_updated", "desc"), limit(50));

    onSnapshot(qBuses, (snapshot) => {
        activeBuses = [];

        snapshot.docChanges().forEach((change) => {
            if (change.type === "added" || change.type === "modified") {
                const data = change.doc.data();
                const now = new Date();
                const msgTime = data.last_updated ? data.last_updated.toDate() : new Date();

                if ((now - msgTime) < 60000) {
                    console.log("Triggering Notification for:", data.bus_no);
                    sendLocalNotification(`📢 Bus ${data.bus_no}`, data.latest_message || "New announcement");
                }
            }
        });

        snapshot.forEach(doc => {
            const data = doc.data();
            activeBuses.push({ id: doc.id, ...data });
        });
        updateBadge();

        if (overlayEl && !overlayEl.classList.contains('hidden')) {
            renderBusList();
        }
    });
}

function updateBadge() {
    const badgeEl = document.getElementById('badge-count');
    if (!badgeEl) return;
    const lastReadStr = localStorage.getItem('lastReadTime');
    let unread = 0;

    if (!activeBuses.length) {
        badgeEl.classList.add('hidden');
        return;
    }

    if (!lastReadStr) {
        unread = activeBuses.length;
    } else {
        const lastRead = new Date(lastReadStr);
        unread = activeBuses.filter(bus => {
            if (!bus.last_updated) return false;
            return bus.last_updated.toDate() > lastRead;
        }).length;
    }

    if (unread > 0) {
        badgeEl.textContent = unread > 9 ? '9+' : unread;
        badgeEl.classList.remove('hidden');
    } else {
        badgeEl.classList.add('hidden');
    }
}

export function openAnnouncements() {
    const overlayEl = document.getElementById('announcement-overlay');
    if (overlayEl) {
        overlayEl.classList.remove('hidden');
        renderBusList();
        localStorage.setItem('lastReadTime', new Date().toISOString());
        updateBadge();
    }
    if (window.innerWidth < 768) toggleSidebar();
}

export function closeAnnouncements() {
    const overlayEl = document.getElementById('announcement-overlay');
    if (overlayEl) overlayEl.classList.add('hidden');
}

function renderBusList() {
    const listEl = document.getElementById('full-announcement-list');
    if (!listEl) return; // Should exist if ID is correct

    const currentIds = new Set(activeBuses.map(b => b.id));

    // 1. Remove orphans
    Array.from(listEl.children).forEach(child => {
        if (!child.id.startsWith('bus-container-')) return;
        const id = child.id.replace('bus-container-', '');
        if (!currentIds.has(id)) {
            if (unsubscribeMessages[id]) {
                unsubscribeMessages[id]();
                delete unsubscribeMessages[id];
            }
            child.remove();
        }
    });

    // 2. Empty State
    if (activeBuses.length === 0) {
        if (listEl.children.length === 0)
            listEl.innerHTML = '<p class="text-slate-500 text-center italic mt-4">No active announcements channels.</p>';
        return;
    } else {
        const emptyMsg = listEl.querySelector('p.italic');
        if (emptyMsg) emptyMsg.remove();
    }

    // 3. Render
    activeBuses.forEach(bus => {
        const containerId = `bus-container-${bus.id}`;
        let container = document.getElementById(containerId);
        const busStr = bus.bus_no || bus.id;

        if (!container) {
            container = document.createElement('div');
            container.className = "border border-slate-700 rounded-xl overflow-hidden mb-2 transition-all";
            container.id = containerId;

            const header = document.createElement('div');
            header.className = "flex items-center justify-between p-4 bg-slate-800/80 hover:bg-slate-800 cursor-pointer";
            header.onclick = () => toggleBusSection(bus.id);
            container.appendChild(header);

            const content = document.createElement('div');
            content.id = `content-${bus.id}`;
            content.className = "hidden bg-slate-900/50 p-4 space-y-3 min-h-[50px]";
            content.innerHTML = '<div class="text-center text-xs text-slate-500 py-2"><span class="animate-pulse">Loading messages...</span></div>';
            container.appendChild(content);
        }

        const header = container.firstElementChild;
        const isContentOpen = !container.lastElementChild.classList.contains('hidden');

        header.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-blue-900/50 flex items-center justify-center text-xs">🚌</div>
            <span class="font-bold text-slate-200 text-sm">${busStr}</span>
        </div>
         <div class="flex items-center gap-2">
            <span class="text-[10px] text-slate-500 italic">${bus.latest_message ? 'Active' : ''}</span>
            <svg id="arrow-${bus.id}" class="w-5 h-5 text-slate-500 transform transition-transform ${isContentOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
        </div>
        `;
        listEl.appendChild(container);
    });
}

export function toggleBusSection(busId) {
    const content = document.getElementById(`content-${busId}`);
    const arrow = document.getElementById(`arrow-${busId}`);
    if (!content) return;

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        if (arrow) arrow.classList.add('rotate-180');
        if (!unsubscribeMessages[busId]) {
            subscribeToBusMessages(busId);
        }
    } else {
        content.classList.add('hidden');
        if (arrow) arrow.classList.remove('rotate-180');
    }
}

function subscribeToBusMessages(busId) {
    const content = document.getElementById(`content-${busId}`);
    const q = query(collection(db, "announcements", busId, "messages"), orderBy("timestamp", "asc"), limit(50));

    // Unsubscribe previous if exists (safety)
    if (unsubscribeMessages[busId]) unsubscribeMessages[busId]();

    const unsub = onSnapshot(q, (snapshot) => {
        content.innerHTML = '';
        if (snapshot.empty) {
            content.innerHTML = '<p class="text-xs text-slate-500 text-center italic">No messages yet.</p>';
            return;
        }
        snapshot.forEach(doc => {
            renderMessage(content, doc.data());
        });
        // Auto scroll
        content.scrollTop = content.scrollHeight;
    });

    unsubscribeMessages[busId] = unsub;
}

function renderMessage(container, data) {
    let dateStr = "Just now";
    if (data.timestamp) {
        const d = data.timestamp.toDate();
        dateStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString();
    }

    const item = document.createElement('div');
    item.className = "bg-slate-800/40 border-l-2 border-blue-500 pl-3 py-1";
    item.innerHTML = `
    <p class="text-slate-300 text-sm leading-relaxed mb-1">${data.message}</p>
    <p class="text-[10px] text-slate-500">${dateStr}</p>
`;
    container.appendChild(item);
}
