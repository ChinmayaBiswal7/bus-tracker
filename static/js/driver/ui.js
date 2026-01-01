export function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('-translate-x-full');
}

export function togglePanel(id) {
    // Hide all panels
    document.querySelectorAll('.pop-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-icon').forEach(i => i.classList.remove('active'));

    // Auto-close sidebar on mobile
    if (window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
            sidebar.classList.add('-translate-x-full');
        }
    }

    // Show target
    const target = document.getElementById('panel-' + id);
    const nav = document.getElementById('nav-' + id);
    if (target) target.classList.add('active');
    if (nav) nav.classList.add('active');

    if (id === 'drive') resetScheduleForm();
}

export function closePanels() {
    document.querySelectorAll('.pop-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-icon').forEach(i => i.classList.remove('active'));
}

function resetScheduleForm() {
    // Optional: Clear form if needed
}

export function createIdleIcon() {
    return L.divIcon({ className: 'custom-icon', html: `<div class="w-6 h-6 bg-slate-500 rounded-full border-4 border-white shadow-lg"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
}

// 1. EV ICON (Custom White Golf Cart SVG)
export function createEvIcon() {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `
        <div class="relative w-16 h-16 flex items-center justify-center filter drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
            <svg width="64" height="64" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Canopy -->
                <path d="M15 25 H85 V30 H15 Z" fill="#10B981" stroke="white" stroke-width="2"/>
                <!-- Posts -->
                <path d="M25 30 L20 60" stroke="#E2E8F0" stroke-width="3" stroke-linecap="round"/>
                <path d="M50 30 L50 60" stroke="#E2E8F0" stroke-width="3" stroke-linecap="round"/>
                <path d="M75 30 L80 60" stroke="#E2E8F0" stroke-width="3" stroke-linecap="round"/>
                <!-- Body (White) -->
                <path d="M10 60 H90 L95 80 H5 L10 60 Z" fill="white" stroke="#10B981" stroke-width="2"/>
                <!-- Seats -->
                <path d="M25 50 H45 V60 H25 Z" fill="#10B981"/>
                <path d="M55 50 H75 V60 H55 Z" fill="#10B981"/>
                <!-- Wheels -->
                <circle cx="25" cy="80" r="8" fill="#18181B" stroke="white" stroke-width="2"/>
                <circle cx="75" cy="80" r="8" fill="#18181B" stroke="white" stroke-width="2"/>
                <!-- Lightning Bolt (Yellow) -->
                <path d="M50 55 L45 65 H50 L48 75 L58 63 H52 L55 55 Z" fill="#FACC15" stroke="black" stroke-width="1"/>
            </svg>
            <!-- Pulse -->
            <div class="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-30 -z-10 scale-75"></div>
        </div>`,
        iconSize: [64, 64], iconAnchor: [32, 32]
    });
}

// 2. BUS ICON (Custom Yellow Bus SVG)
export function createBusIcon() {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `
        <div class="relative w-16 h-16 flex items-center justify-center filter drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
            <svg width="64" height="64" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Body (Yellow) -->
                <rect x="10" y="30" width="80" height="40" rx="5" fill="#FACC15" stroke="white" stroke-width="2"/>
                <!-- Windows (Blue-Grey) -->
                <rect x="15" y="35" width="15" height="12" fill="#334155"/>
                <rect x="35" y="35" width="15" height="12" fill="#334155"/>
                <rect x="55" y="35" width="15" height="12" fill="#334155"/>
                <rect x="75" y="35" width="10" height="12" fill="#334155"/>
                <!-- Stripe (Blue) -->
                <rect x="10" y="52" width="80" height="6" fill="#1E3A8A"/>
                <!-- Wheels -->
                <circle cx="25" cy="70" r="8" fill="#18181B" stroke="white" stroke-width="2"/>
                <circle cx="75" cy="70" r="8" fill="#18181B" stroke="white" stroke-width="2"/>
                <!-- Lights -->
                <circle cx="12" cy="65" r="2" fill="#EF4444"/>
                <circle cx="88" cy="65" r="2" fill="#F59E0B"/>
            </svg>
             <!-- Pulse -->
            <div class="absolute inset-0 bg-yellow-400 rounded-full animate-ping opacity-30 -z-10 scale-75"></div>
        </div>`,
        iconSize: [64, 64], iconAnchor: [32, 32]
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
