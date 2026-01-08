import { updateSpeed, createIdleIcon, createBusIcon, createEvIcon, updateStatsUI } from './ui.js';

let map = null;
let userMarker = null;
let watchId = null;
let isSharing = false;
const socket = io(); // Singleton
let studentMarkers = {};
let stopMarkers = {}; // NEW: Cache for stop markers
let activeBusNo = null;
let currentCrowdStatus = 'LOW';

// Listen for student updates
socket.on('student_location_update', (data) => {
    console.log("[DRIVER] Received student update:", data, "Active Bus:", activeBusNo);
    if (!isSharing || !map || !activeBusNo) {
        console.log("[DRIVER] ignored (not sharing or no map)");
        return;
    }

    // Filter: Only show students tracking MY bus
    // Robust comparison: Trim and Upper Case
    const updateBus = String(data.bus_no).trim().toUpperCase();
    const myBus = String(activeBusNo).trim().toUpperCase();

    if (updateBus !== myBus) {
        console.log(`[DRIVER] ignored (Bus mismatch: '${updateBus}' != '${myBus}')`);
        return;
    }

    // Render Marker
    if (studentMarkers[data.id]) {
        studentMarkers[data.id].setLatLng([data.lat, data.lng]);
    } else {
        const studentIcon = L.divIcon({
            className: 'student-marker',
            html: `
            <div class="relative w-16 h-16 flex items-center justify-center filter drop-shadow-xl">
                 <svg width="64" height="64" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="25" r="12" fill="#3B82F6" stroke="white" stroke-width="2"/>
                    <path d="M30 45 Q30 40 35 40 H65 Q70 40 70 45 V70 H60 V90 H40 V70 H30 V45 Z" fill="#3B82F6" stroke="white" stroke-width="2"/>
                    <rect x="35" y="45" width="30" height="25" rx="5" fill="#1E3A8A" fill-opacity="0.5"/>
                </svg>
                 <!-- Pulse -->
                <div class="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-30 -z-10 scale-75"></div>
            </div>`,
            iconSize: [64, 64],
            iconAnchor: [32, 32]
        });

        studentMarkers[data.id] = L.marker([data.lat, data.lng], { icon: studentIcon })
            .addTo(map)
            .bindPopup("Student Waiting");
    }
});

// --- NEW: Bus Stop Listeners ---
socket.on('stop_update', (data) => {
    if (activeBusNo && String(data.bus_no).trim().toUpperCase() === String(activeBusNo).trim().toUpperCase()) {
        updateStopUI(data.stop_name, data.count);
    }
});

socket.on('stop_reset', (data) => {
    if (activeBusNo && String(data.bus_no).trim().toUpperCase() === String(activeBusNo).trim().toUpperCase()) {
        updateStopUI(data.stop_name, 0);
    }
});

function updateStopUI(stopName, count) {
    const marker = stopMarkers[stopName];
    if (!marker) return;

    if (count > 0) {
        // ACTIVE: Red + Pulse
        const redIcon = L.divIcon({
            className: 'stop-marker-active',
            html: `
                <div class="relative flex items-center justify-center">
                    <div class="w-8 h-8 rounded-full bg-red-600 border-2 border-white flex items-center justify-center text-white font-bold text-sm shadow-md z-10">
                        ${count}
                    </div>
                    <div class="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-50 -z-10"></div>
                </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
        marker.setIcon(redIcon);
        marker.setZIndexOffset(1000); // Bring to front
    } else {
        // RESET: Default Gray
        marker.setIcon(createDefaultStopIcon());
        marker.setZIndexOffset(0);
    }
}

function createDefaultStopIcon() {
    return L.divIcon({
        className: 'stop-marker-default',
        html: `<div class="w-3 h-3 rounded-full bg-slate-400 border border-slate-600 opacity-50"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });
}

export function initMap() {
    if (map) return;
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([20.2961, 85.8245], 15);
    window.map = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '' }).addTo(map);
    const icon = createIdleIcon();
    userMarker = L.marker([0, 0], { icon: icon }).addTo(map);
}

export let activeMode = 'BUS';

export function setMode(mode) {
    activeMode = mode;
    console.log("Mode set to:", mode);

    const btnBus = document.querySelector("button[onclick=\"setMode('BUS')\"]");
    const btnEv = document.querySelector("button[onclick=\"setMode('EV')\"]");
    const blob = document.getElementById('active-blob');
    const busInput = document.getElementById('busInput');

    if (mode === 'BUS') {
        if (blob) blob.style.transform = 'translateX(0)';
        if (btnBus) btnBus.classList.replace('text-slate-400', 'text-white');
        if (btnEv) btnEv.classList.replace('text-white', 'text-slate-400');
        if (busInput) {
            busInput.placeholder = "ENTER NUMBER (e.g. 42)";
            busInput.value = "";
        }
    } else {
        if (blob) blob.style.transform = 'translateX(100%)';
        if (btnEv) btnEv.classList.replace('text-slate-400', 'text-white');
        if (btnBus) btnBus.classList.replace('text-white', 'text-slate-400');
        if (busInput) {
            busInput.placeholder = "SHUTTLE ID (e.g. EV-1)";
            busInput.value = "EV-1";
        }
    }
}

export function setCrowdStatus(status) {
    currentCrowdStatus = status;
    console.log("Crowd Status:", status);

    // Update UI
    const btns = {
        'LOW': document.getElementById('btn-crowd-low'),
        'MED': document.getElementById('btn-crowd-med'),
        'HIGH': document.getElementById('btn-crowd-high')
    };

    // Reset all
    Object.values(btns).forEach(btn => {
        if (btn) {
            btn.classList.remove('bg-slate-700', 'border-blue-500', 'text-white');
            btn.classList.add('bg-slate-800', 'border-slate-700', 'text-slate-400');
        }
    });

    // Highlight selected
    if (btns[status]) {
        btns[status].classList.remove('bg-slate-800', 'border-slate-700', 'text-slate-400');
        btns[status].classList.add('bg-slate-700', 'border-blue-500', 'text-white');
    }

    // Force immediate update if sharing
    if (isSharing && socket.connected) {
        // We don't have lat/lng here easily without geolocation callback, 
        // but the next GPS update will pick it up. 
        // ideally we cache last pos.
    }
}

export function toggleSession() {
    const btnMain = document.getElementById('btnMain');
    const busInput = document.getElementById('busInput');
    const busNo = busInput.value.trim().toUpperCase();

    if (!isSharing) {
        // START
        if (!busNo) return alert("Enter Bus Number");
        isSharing = true;
        activeBusNo = busNo; // Store active bus number
        busInput.disabled = true;

        btnMain.innerHTML = `<span class="animate-pulse">⏳</span> INITIALIZING...`;
        btnMain.className = "w-full py-4 bg-slate-700 text-slate-300 rounded-2xl font-bold text-lg cursor-wait flex items-center justify-center gap-3";

        loadRouteStops(busNo); // NEW: Load stops
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
        opts = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
        nextStage = 'GPS_RETRY';
        uiIcon = "🛰️"; uiMsg = "SEARCHING SATELLITE (HIGH)..."; uiColor = "text-yellow-400"; uiStatusShort = "GPS SCAN..."; uiPulse = "bg-yellow-500";
    } else if (stage === 'GPS_RETRY') {
        opts = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
        nextStage = 'WIFI_CELL';
        uiIcon = "📡"; uiMsg = "RETRYING HIGH ACCURACY..."; uiColor = "text-orange-400"; uiStatusShort = "GPS RETRY..."; uiPulse = "bg-orange-500";
    } else {
        // "Low Accuracy" in browser usually means Wifi/Cell triangulation
        // User requested "don't time out, stay a while". Increased to 5 minutes (300000ms).
        opts = { enableHighAccuracy: false, timeout: 300000, maximumAge: 0 };
        nextStage = null;
        uiIcon = "📶"; uiMsg = "SEARCHING NETWORK/TOWER..."; uiColor = "text-blue-400"; uiStatusShort = "NET SCAN..."; uiPulse = "bg-blue-500";
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

// State
let hasCentered = false;

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

        // Update Marker Icon
        const newIcon = (activeMode === 'EV') ? createEvIcon() : createBusIcon();
        if (userMarker) userMarker.setIcon(newIcon);
    }

    const { latitude, longitude, speed, accuracy } = pos.coords;
    const kmh = speed ? Math.round(speed * 3.6) : 0;

    // Stats
    updateSpeed(kmh);
    updateStatsUI(latitude, longitude, accuracy, stage);

    if (map && userMarker) {
        userMarker.setLatLng([latitude, longitude]);

        // Fix: Only center map ONCE on first lock.
        // This allows the driver to pan around to see students without fighting the auto-center.
        if (!hasCentered) {
            map.setView([latitude, longitude], 18);
            hasCentered = true;
        }
    }

    if (socket.connected) {
        socket.emit('driver_update', {
            lat: latitude,
            lng: longitude,
            speed,
            bus_no: busNo,
            crowd: currentCrowdStatus
        });
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
    hasCentered = false; // Reset for next session logic
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

    // Clear Student Markers
    activeBusNo = null;
    Object.values(studentMarkers).forEach(marker => map.removeLayer(marker));
    studentMarkers = {};

    // Clear Stop Markers
    Object.values(stopMarkers).forEach(marker => map.removeLayer(marker));
    stopMarkers = {};

    // Reset Stats
    if (statAcc) { statAcc.textContent = "--"; statAcc.className = "block text-white font-bold text-xs"; }
    if (statLat) statLat.textContent = "--";
    if (statLng) statLng.textContent = "--";
    if (statStatus) { statStatus.textContent = "IDLE"; statStatus.className = "block text-slate-400 font-bold text-xs"; }
}

async function loadRouteStops(busNo) {
    try {
        const res = await fetch(`/api/routes/${busNo}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.stops) {
            data.stops.forEach(stop => {
                const marker = L.marker([stop.lat, stop.lng], {
                    icon: createDefaultStopIcon()
                }).addTo(map);

                // Store
                stopMarkers[stop.stop_name] = marker;
            });
            console.log(`[DRIVER] Loaded ${data.stops.length} stops.`);
        }
    } catch (e) {
        console.warn("[DRIVER] Failed to load stops:", e);
    }
}
