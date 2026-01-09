import { db, collection, query, orderBy, limit, onSnapshot } from '../firebase-config.js';
import { doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Listen to Driver Messages
export function initDriverAnnouncements() {
    const listEl = document.getElementById('driver-announcement-list');
    const badgeEl = document.getElementById('driver-news-badge');

    // Path: university/kiit/driver_messages
    // Hardcoded 'kiit' for now as per admin.py
    const msgsRef = collection(db, 'university', 'kiit', 'driver_messages');
    const q = query(msgsRef, orderBy('timestamp', 'desc'), limit(20));

    // Load read state
    let lastReadTime = new Date(localStorage.getItem('driver_last_read') || 0);

    onSnapshot(q, (snapshot) => {
        listEl.innerHTML = '';

        if (snapshot.empty) {
            listEl.innerHTML = '<p class="text-xs text-slate-500 italic text-center">No active broadcasts.</p>';
            return;
        }

        let hasNew = false;

        snapshot.forEach((doc) => {
            const data = doc.data();
            const msgTime = data.timestamp ? data.timestamp.toDate() : new Date();

            if (msgTime > lastReadTime) hasNew = true;

            renderDriverMessage(listEl, data, msgTime);
        });

        // Update Badge
        if (hasNew && badgeEl) {
            badgeEl.classList.remove('hidden');
            // Optional: Vibrate if new message arrives in realtime?
            // Note: onSnapshot runs on init too, logic needed to detect REAL change.
            // Simplified: If unread > 0, show dot.
        }
    });

    // Mark as read when panel opens
    // This requires hooking into the existing UI toggle system or adding a specific observer.
    // For now, we will expose a method 'markNewsRead' and call it from main.js or ui.js
}

export function markNewsRead() {
    const badgeEl = document.getElementById('driver-news-badge');
    if (badgeEl) badgeEl.classList.add('hidden');
    localStorage.setItem('driver_last_read', new Date().toISOString());
}

function renderDriverMessage(container, data, dateObj) {
    const dateStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + dateObj.toLocaleDateString();

    const div = document.createElement('div');
    // Styling: High contrast for drivers
    div.className = "bg-slate-800 p-3 rounded-lg border-l-4 border-yellow-500 shadow-lg";
    div.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">ADMIN BROADCAST</span>
            <span class="text-[10px] text-slate-400">${dateStr}</span>
        </div>
        <p class="text-white text-sm font-medium leading-relaxed">${data.message}</p>
    `;
    container.appendChild(div);
}
