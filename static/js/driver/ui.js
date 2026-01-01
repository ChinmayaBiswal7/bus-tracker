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
    // Custom "Skeleton" Style EV Icon
    // Green bottom, White top, Lightning Bolt
    const evSvg = `
    <svg viewBox="0 0 512 512" class="w-14 h-14 drop-shadow-xl z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Body -->
        <path d="M400 160H112C94.3 160 80 174.3 80 192V320C80 337.7 94.3 352 112 352H128V384C128 401.7 142.3 416 160 416H208C225.7 416 240 401.7 240 384V352H272V384C272 401.7 286.3 416 304 416H352C369.7 416 384 401.7 384 384V352H400C417.7 352 432 337.7 432 320V192C432 174.3 417.7 160 400 160Z" fill="#10B981"/> <!-- Emerald Green Base -->
        <path d="M400 160H112C94.3 160 80 174.3 80 192V256H432V192C432 174.3 417.7 160 400 160Z" fill="white"/> <!-- White Top -->
        
        <!-- Windows -->
        <path d="M120 180H392C400.8 180 408 187.2 408 196V230C408 238.8 400.8 246 392 246H120C111.2 246 104 238.8 104 230V196C104 187.2 111.2 180 120 180Z" fill="#38BDF8"/>
        
        <!-- Lightning Bolt -->
        <path d="M236 330L266 260H226L256 330H236Z" fill="#FACC15" stroke="white" stroke-width="8"/>
        <path d="M256 340L236 290H276L256 340Z" fill="#FACC15"/> <!-- Bolt Shape Fix -->
        <path d="M245 270L220 310H245L235 340L270 295H245L260 270H245Z" fill="#F59E0B" stroke="white" stroke-width="4"/>

        <!-- Wheels -->
        <circle cx="168" cy="384" r="24" fill="#1F2937" stroke="#4B5563" stroke-width="4"/>
        <circle cx="344" cy="384" r="24" fill="#1F2937" stroke="#4B5563" stroke-width="4"/>
        
        <!-- Headlights -->
        <circle cx="100" cy="300" r="8" fill="#FACC15"/>
        <circle cx="412" cy="300" r="8" fill="#FACC15"/>
    </svg>
    `;

    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="relative w-16 h-16 flex items-center justify-center">
                <div class="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
                ${evSvg}
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
