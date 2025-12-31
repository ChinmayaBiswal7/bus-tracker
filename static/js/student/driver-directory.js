import { db, collection, getDocs } from '../firebase-config.js';
import { toggleSidebar } from './ui.js';

export function openDrivers() {
    const driversOverlay = document.getElementById('drivers-overlay');
    if (driversOverlay) driversOverlay.classList.remove('hidden');
    if (window.innerWidth < 768) toggleSidebar();
    fetchDrivers();
}

export function closeDrivers() {
    const driversOverlay = document.getElementById('drivers-overlay');
    if (driversOverlay) driversOverlay.classList.add('hidden');
}

export function closeProfile() {
    const profileModal = document.getElementById('profile-modal');
    if (profileModal) profileModal.classList.add('hidden');
}

export function showProfile(data) {
    document.getElementById('profile-name').textContent = data.name || "Driver";
    document.getElementById('profile-mobile').textContent = data.mobile || "N/A";
    const callBtn = document.getElementById('profile-call-btn');
    if (callBtn) callBtn.href = `tel:${data.mobile}`;

    const profileModal = document.getElementById('profile-modal');
    if (profileModal) profileModal.classList.remove('hidden');
}

function fetchDrivers() {
    const driverListEl = document.getElementById('driver-list');
    if (!driverListEl) return;

    driverListEl.innerHTML = '<p class="text-slate-500 text-center italic mt-10 animate-pulse">Loading drivers...</p>';

    getDocs(collection(db, "drivers")).then(snapshot => {
        if (snapshot.empty) {
            driverListEl.innerHTML = '<p class="text-slate-500 text-center italic mt-10">No drivers registered.</p>';
            return;
        }

        driverListEl.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const card = document.createElement('div');
            card.className = "flex items-center justify-between p-4 bg-slate-800/80 rounded-xl border border-slate-700 hover:border-emerald-500/50 cursor-pointer transition-all group";
            card.onclick = () => showProfile(data);

            card.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                    👮‍♂️
                </div>
                <div>
                    <h3 class="text-white font-bold text-sm">${data.name || 'Unknown Driver'}</h3>
                    <p class="text-[10px] text-slate-400">Tap to view info</p>
                </div>
            </div>
            <div class="p-2 bg-emerald-500/10 rounded-full text-emerald-500">
                 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
        `;
            driverListEl.appendChild(card);
        });
    });
}
