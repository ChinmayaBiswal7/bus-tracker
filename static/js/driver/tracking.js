import { updateSpeed, createIdleIcon, updateStatsUI } from './ui.js';

let map = null;
let userMarker = null;
let watchId = null;
let isSharing = false;
const socket = io(); // Singleton

export function initMap() {
    if (map) return;
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([20.2961, 85.8245], 15);
    window.map = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '' }).addTo(map);
    const icon = createIdleIcon();
    userMarker = L.marker([0, 0], { icon: icon }).addTo(map);
}

export function toggleSession() {
    const btnMain = document.getElementById('btnMain');
    const busInput = document.getElementById('busInput');
    const busNo = busInput.value.trim().toUpperCase();

    if (!isSharing) {
        // START
        if (!busNo) return alert("Enter Bus Number");
        isSharing = true;
        busInput.disabled = true;

        btnMain.innerHTML = `<span class="animate-pulse">⏳</span> INITIALIZING...`;
        btnMain.className = "w-full py-4 bg-slate-700 text-slate-300 rounded-2xl font-bold text-lg cursor-wait flex items-center justify-center gap-3";

        attemptGPS('GPS_HIGH', busNo);
    } else {
        // STOP
        stopSession();
    }
}

function attemptGPS(stage, busNo) {
    let opts = {};
    let nextStage = null;
    let uiIcon, uiMsg, uiColor, uiStatusShort, uiPulse;

    // UI Elements
    const btnMain = document.getElementById('btnMain');
    const serverStatus = document.getElementById('serverStatus');
    const statusDot = document.getElementById('statusDot');
    const statStatus = document.getElementById('stat-status');

    if (stage === 'GPS_HIGH') {
        opts = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };
        nextStage = 'GPS_WEAK';
        uiIcon = "🛰️"; uiMsg = "SEARCHING SATELLITE..."; uiColor = "text-yellow-400"; uiStatusShort = "GPS SCAN..."; uiPulse = "bg-yellow-500";
    } else if (stage === 'GPS_WEAK') {
        opts = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
        nextStage = 'NETWORK';
        uiIcon = "📡"; uiMsg = "SEARCHING WEAK SIGNAL..."; uiColor = "text-orange-400"; uiStatusShort = "BOOSTING..."; uiPulse = "bg-orange-500";
    } else {
        opts = { enableHighAccuracy: false, timeout: 20000, maximumAge: 0 };
        nextStage = null;
        uiIcon = "📶"; uiMsg = "SEARCHING NETWORK..."; uiColor = "text-blue-400"; uiStatusShort = "NET SCAN..."; uiPulse = "bg-blue-500";
    }

    if (btnMain) {
        btnMain.innerHTML = `<span class="animate-pulse">${uiIcon}</span> ${uiMsg}`;
        btnMain.className = "w-full py-4 bg-slate-700 text-slate-300 rounded-2xl font-bold text-lg cursor-wait flex items-center justify-center gap-3";
    }

    if (serverStatus) {
        serverStatus.textContent = uiStatusShort;
        serverStatus.className = `text-[10px] font-bold ${uiColor} uppercase tracking-widest animate-pulse`;
    }
    if (statusDot) statusDot.className = `w-2.5 h-2.5 rounded-full ${uiPulse} ring-2 ring-slate-800 transition-colors`;
    if (statStatus) statStatus.textContent = stage;

    if (watchId) navigator.geolocation.clearWatch(watchId);

    console.log(`[GPS] Attempting ${stage}...`);

    watchId = navigator.geolocation.watchPosition(
        (pos) => handleGPS(pos, busNo, stage),
        (err) => {
            console.warn(`[GPS] ${stage} Failed:`, err);
            if (nextStage) {
                console.log(`[GPS] Falling back to ${nextStage}...`);
                attemptGPS(nextStage, busNo);
            } else {
                handleGPSError(err);
            }
        },
        opts
    );
}

function handleGPS(pos, busNo, stage) {
    const btnMain = document.getElementById('btnMain');
    const serverStatus = document.getElementById('serverStatus');
    const statusDot = document.getElementById('statusDot');
    const statStatus = document.getElementById('stat-status');

    // Once locked, update Main Button
    if (btnMain && btnMain.textContent.includes("SEARCHING")) {
        btnMain.innerHTML = `<span class="animate-pulse">■</span> TERMINATE SESSION`;
        btnMain.className = "w-full py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-red-900/40 active:scale-[0.98] transition-all flex items-center justify-center gap-3";
        if (serverStatus) {
            serverStatus.textContent = "LIVE BROADCAST";
            serverStatus.className = "text-[10px] font-bold text-green-400 uppercase tracking-widest animate-pulse";
        }
        if (statusDot) statusDot.className = "w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-green-900 transition-colors";
    }

    const { latitude, longitude, speed, accuracy } = pos.coords;
    const kmh = speed ? Math.round(speed * 3.6) : 0;

    // Stats
    updateSpeed(kmh);
    updateStatsUI(latitude, longitude, accuracy, stage);

    if (map && userMarker) {
        userMarker.setLatLng([latitude, longitude]);
        map.setView([latitude, longitude], 18);
    }

    if (socket.connected) {
        socket.emit('driver_update', { lat: latitude, lng: longitude, speed, bus_no: busNo });
    } else {
        if (statStatus) {
            statStatus.textContent = "NET ERR";
            statStatus.className = "block text-red-500 font-bold text-xs";
        }
    }
}

function handleGPSError(err) {
    console.error(err);
    const serverStatus = document.getElementById('serverStatus');
    const statusDot = document.getElementById('statusDot');

    if (serverStatus) {
        serverStatus.textContent = "GPS ERROR";
        serverStatus.className = "text-[10px] font-bold text-red-500 uppercase tracking-widest animate-pulse";
    }
    if (statusDot) statusDot.className = "w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-900";

    alert(`GPS Error: ${err.message}. Check permissions.`);
    stopSession();
}

export function stopSession() {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    watchId = null; isSharing = false;
    socket.emit('driver_update', null);

    // Reset UI
    const btnMain = document.getElementById('btnMain');
    const busInput = document.getElementById('busInput');
    const serverStatus = document.getElementById('serverStatus');
    const statusDot = document.getElementById('statusDot');
    const statAcc = document.getElementById('stat-acc');
    const statLat = document.getElementById('stat-lat');
    const statLng = document.getElementById('stat-lng');
    const statStatus = document.getElementById('stat-status');

    if (btnMain) {
        btnMain.innerHTML = `<svg class="w-6 h-6 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> <span>START SESSION</span>`;
        btnMain.className = "w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-900/40 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group";
    }

    if (serverStatus) {
        serverStatus.textContent = "Idle";
        serverStatus.className = "text-[10px] font-bold text-slate-400 uppercase tracking-widest";
    }
    if (statusDot) statusDot.className = "w-2.5 h-2.5 rounded-full bg-slate-600 ring-2 ring-slate-800 transition-colors";
    if (busInput) busInput.disabled = false;

    updateSpeed(0);
    if (userMarker) userMarker.setIcon(createIdleIcon());

    // Reset Stats
    if (statAcc) { statAcc.textContent = "--"; statAcc.className = "block text-white font-bold text-xs"; }
    if (statLat) statLat.textContent = "--";
    if (statLng) statLng.textContent = "--";
    if (statStatus) { statStatus.textContent = "IDLE"; statStatus.className = "block text-slate-400 font-bold text-xs"; }
}
