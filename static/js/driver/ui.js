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

// 1. EV ICON (Black Dot Style)
export function createEvIcon() {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `
        <div class="relative w-14 h-14 flex items-center justify-center">
            <!-- Black Background Circle (No Silver Border) -->
            <div class="absolute inset-0 bg-black rounded-full border-2 border-black shadow-lg flex items-center justify-center z-10">
                <!-- White Icon -->
                <svg width="28" height="28" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M48,256 L464,256 C477.255,256 488,266.745 488,280 L488,360 L24,360 L24,280 C24,266.745 34.745,256 48,256 Z" fill="white"/>
                    <path d="M40,120 L472,120 L440,256 L72,256 L40,120 Z" fill="none" stroke="white" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M120,120 L120,256" stroke="white" stroke-width="16"/>
                    <path d="M256,120 L256,256" stroke="white" stroke-width="16"/>
                    <path d="M392,120 L392,256" stroke="white" stroke-width="16"/>
                    <path d="M250,290 L230,320 H250 L240,350 L270,310 H250 L260,290 Z" fill="#FACC15"/>
                </svg>
            </div>
            <!-- Green Pulse -->
            <div class="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
        </div>`,
        iconSize: [56, 56], iconAnchor: [28, 28]
    });
}

// 2. BUS ICON (Black Dot Style)
export function createBusIcon() {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `
        <div class="relative w-14 h-14 flex items-center justify-center">
            <!-- Black Background Circle (No Silver Border) -->
            <div class="absolute inset-0 bg-black rounded-full border-2 border-black shadow-lg flex items-center justify-center z-10">
                 <!-- White Icon -->
                 <svg width="26" height="26" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M32 112 H480 V368 H32 V112 Z" fill="white"/> 
                    <path d="M64 144 H144 V224 H64 V144 Z" fill="#1e293b"/>
                    <path d="M168 144 H248 V224 H168 V144 Z" fill="#1e293b"/>
                    <path d="M272 144 H352 V224 H272 V144 Z" fill="#1e293b"/>
                    <path d="M376 144 H448 V224 H376 V144 Z" fill="#1e293b"/>
                    <rect x="32" y="240" width="448" height="32" fill="#3B82F6"/>
                </svg>
            </div>
            <!-- Blue Pulse -->
            <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>
        </div>`,
        iconSize: [56, 56], iconAnchor: [28, 28]
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
