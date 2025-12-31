export function togglePanel(id) {
    // Hide all panels
    document.querySelectorAll('.pop-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-icon').forEach(i => i.classList.remove('active'));

    // Show target
    const target = document.getElementById('panel-' + id);
    const nav = document.getElementById('nav-' + id);
    if (target) target.classList.add('active');
    if (nav) nav.classList.add('active');

    if (id === 'drive') resetScheduleForm();
}

function resetScheduleForm() {
    // Optional: Clear form if needed
}

export function createIdleIcon() {
    return L.divIcon({ className: 'custom-icon', html: `<div class="w-6 h-6 bg-slate-500 rounded-full border-4 border-white shadow-lg"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
}

export function createBusIcon() {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="relative w-12 h-12 flex items-center justify-center">
                <div class="absolute inset-0 bg-amber-500 rounded-full animate-ping opacity-20"></div>
                <div class="relative w-10 h-10 bg-amber-500 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-xl">
                    🚌
                </div>
               </div>`,
        iconSize: [48, 48], iconAnchor: [24, 24]
    });
}

export function createEvIcon() {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="relative w-12 h-12 flex items-center justify-center">
                <div class="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
                <div class="relative w-10 h-10 bg-emerald-500 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-xl">
                    ⚡
                </div>
               </div>`,
        iconSize: [48, 48], iconAnchor: [24, 24]
    });
}

export function updateSpeed(kmh) {
    const speedVal = document.getElementById('speedVal');
    if (speedVal) speedVal.textContent = kmh;

    const circle = document.getElementById('speed-circle');
    if (circle) {
        const max = 365;
        const offset = max - (Math.min(kmh / 100, 1) * max);
        circle.style.strokeDashoffset = offset;
    }
}

export function updateStatsUI(latitude, longitude, accuracy, stage) {
    const statLat = document.getElementById('stat-lat');
    const statLng = document.getElementById('stat-lng');
    const statAcc = document.getElementById('stat-acc');
    const statStatus = document.getElementById('stat-status');

    if (statLat) statLat.textContent = latitude.toFixed(4);
    if (statLng) statLng.textContent = longitude.toFixed(4);
    if (statAcc) statAcc.textContent = `${Math.round(accuracy)} m`;

    if (statStatus) {
        statStatus.textContent = stage === 'NETWORK' ? "NET LOCK" : "GPS LOCK";

        let color = "text-red-400";
        if (accuracy < 20) color = "text-green-400";
        else if (accuracy < 100) color = "text-yellow-400";

        statAcc.className = `block ${color} font-bold text-xs`;
        statStatus.className = `block ${color} font-bold text-xs`;
    }
}
