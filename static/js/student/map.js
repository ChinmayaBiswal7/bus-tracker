import { updateServerStatus, updateGpsStatus } from './ui.js';
import { notifications } from '../notifications.js';

let map;
let userMarker = null;
let userIcon = null;
// let routingControl = null; // REPLACED by manual layer
// let dynamicRouteRouter is defined below locally or module scope
let routeLine = null;
let targetBusId = null;
let targetBusNo = null; // NEW: Single Source of Truth
let userLat = null, userLng = null;
let watchId = null;
let markers = {};
let stopMarkers = {}; // NEW: Cache for active stop markers
let fallbackLine = null;
let routingTimer = null; // Internal timer
let lastBusData = {};
let currentBusFilter = '';
let speedHistory = {}; // NEW: { busId: [speed1, speed2, ...] }
const socket = io();

let userVotes = new Set(); // Track user's active votes

// --- STOP ATTENDANCE LOGIC ---
// Listen for resets from Driver (Arrival)
socket.on('stop_reset', (data) => {
    // Clear local vote if we had one
    if (userVotes.has(data.stop_name)) {
        userVotes.delete(data.stop_name);
        // Force refresh popup if open
        if (stopMarkers[data.stop_name]) {
            const m = stopMarkers[data.stop_name];
            if (m.isPopupOpen()) {
                updateStopMarkerPopup(m, data.stop_name, data.bus_no);
            }
        }
    }

    if (stopMarkers[data.stop_name]) {
        stopMarkers[data.stop_name].stopCount = 0;
        updateStopMarkerPopup(stopMarkers[data.stop_name], data.stop_name, data.bus_no);
    }
});

// Initialize Map
export function initMap() {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([20.2961, 85.8245], 13);
    window.map = map; // For debug/global access if needed

    // L.control.zoom({ position: 'bottomright' }).addTo(map); // Removed User Request

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // User Icon (Custom Scratch SVG)
    userIcon = L.divIcon({
        className: 'custom-user-icon',
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

    // Start Geolocation
    if (navigator.geolocation) {
        startLocationTracking(false);
    } else {
        console.error("Browser does not support Geolocation");
    }

    setupSocketListeners();
}

function setupSocketListeners() {
    socket.on('connect', () => updateServerStatus(true));
    socket.on('disconnect', () => updateServerStatus(false));

    socket.on('update_buses', (data) => {
        lastBusData = data;

        // 1. Update Map Markers (Always show all on map)
        const activeIds = new Set();
        Object.entries(data).forEach(([busId, info]) => {
            updateBusMarker(busId, info);
            activeIds.add(busId);
        });

        // 2. Remove Stale Markers
        for (let id in markers) {
            if (!activeIds.has(id)) {
                map.removeLayer(markers[id]);
                delete markers[id];
            }
        }

        // 3. Render Sidebar List
        renderBusList();
    });

    // --- NEW: Handle Explicit Disconnect ---
    socket.on('bus_disconnected', (sid) => {
        console.log(`[SOCKET] Bus disconnected: ${sid}`);
        if (markers[sid]) {
            map.removeLayer(markers[sid]);
            delete markers[sid];
        }
        // Also clean up if it was the target
        if (targetBusId === sid) {
            notifications.showPopup("Bus Offline", "The bus you were tracking has ended its session.", "info");
            stopTrackingRoute();
        }
    });

    // --- NEW: Bus Stop Attendance Listeners ---
    socket.on('stop_update', (data) => {
        // Only update if we are tracking this bus
        if (targetBusNo && String(data.bus_no) === String(targetBusNo)) {
            const marker = stopMarkers[data.stop_name];
            if (marker) {
                marker.stopCount = data.count || 0;
                updateStopMarkerPopup(marker, data.stop_name, data.bus_no);

                // Visual feedback if count > 0
                if (marker.stopCount > 0) {
                    marker.setStyle({ radius: 8, fillColor: '#ef4444', color: '#fff' }); // Red & Bigger
                }
            }
        }
    });

    socket.on('stop_reset', (data) => {
        if (targetBusNo && String(data.bus_no) === String(targetBusNo)) {
            const marker = stopMarkers[data.stop_name];
            if (marker) {
                marker.stopCount = 0;
                updateStopMarkerPopup(marker, data.stop_name, data.bus_no);
                marker.setStyle({ radius: 5, fillColor: '#f0abfc', color: '#86198f' }); // Reset Style
            }
        }
    });
}



function renderBusList() {
    const data = lastBusData;
    const busList = document.getElementById('bus-list');
    if (!busList) return;

    busList.innerHTML = '';

    // Filter Logic
    const activeEntries = [];
    Object.entries(lastBusData).forEach(([id, info]) => {
        const displayBusNo = String(info.bus_no).trim().toLowerCase();
        let isMatch = false;

        if (Array.isArray(currentBusFilter)) {
            isMatch = currentBusFilter.includes(displayBusNo);
        } else if (currentBusFilter) {
            isMatch = displayBusNo.includes(currentBusFilter);
        } else {
            isMatch = true; // No filter = Show all
        }

        // Show only Online buses in sidebar (User Request)
        if (info.offline) return;

        if (isMatch) {
            activeEntries.push({ id, info });
        }
    });

    console.log(`[RENDER MATCHES]: Filter '${currentBusFilter}' matched ${activeEntries.length} buses.`);

    // Update Counts
    const statusEl = document.getElementById('tracking-status');
    const countSpan = document.getElementById('fw-bold');
    if (countSpan) countSpan.textContent = activeEntries.length > 0 ? activeEntries.length : "0";
    if (statusEl) statusEl.classList.remove('hidden');

    if (activeEntries.length === 0) {
        busList.innerHTML = '<p class="text-xs text-slate-500 text-center py-4 italic">No matching buses found.</p>';
        return;
    }

    activeEntries.forEach(({ id: busId, info }) => {
        const item = document.createElement('div');
        // Add Identifying Attribute for Search Sync
        item.setAttribute('data-bus-no', info.bus_no);
        item.setAttribute('data-status', info.offline ? 'offline' : 'online');
        item.className = "group flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-blue-500 cursor-pointer transition-all";

        // Row Click: Track Bus
        item.addEventListener('click', () => {
            console.log(`[SIDEBAR] Row clicked for Bus ${info.bus_no}`);
            startTrackingRouteByBusNo(String(info.bus_no));
        });

        item.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">${info.bus_no}</div>
            <div>
               <p class="text-slate-200 font-bold text-sm">Bus ${info.bus_no}</p>
               <p class="text-[10px] text-slate-400 flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full ${info.offline ? 'bg-slate-500' : 'bg-green-500'}"></span>
                  ${info.offline ? 'Offline' : (info.crowd || 'Live')}
               </p>
            </div>
        </div>
        <button class="locate-btn hidden group-hover:block px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-lg transition-all">
            LOCATE
        </button>
        `;

        // Button Click: Track Bus (Prevent Row Click Bubble)
        const btn = item.querySelector('.locate-btn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Stop row click
                console.log(`[SIDEBAR] LOCATE Button clicked for Bus ${info.bus_no}`);
                startTrackingRouteByBusNo(String(info.bus_no));
            });
        }

        busList.appendChild(item);
    });
}

// --- NEW: Expose Filter to Window for Search.js ---
window.setBusFilter = function (query) {
    if (!query) {
        currentBusFilter = '';
        renderBusList();
        return;
    }

    // Normalize
    const normalized = String(query).trim().toLowerCase();

    // Set filter
    currentBusFilter = normalized;

    // Re-render
    console.log(`[MAP] Filter set to: '${currentBusFilter}'`);
    renderBusList();
};

function updateBusMarker(busId, info) {
    const isOffline = info.offline || false;

    // 1. If Offline, DO NOT Render Marker on Map
    if (isOffline) {
        if (markers[busId]) {
            map.removeLayer(markers[busId]);
            delete markers[busId];
        }
        return; // Exit early
    }

    const isEV = (info.bus_no || '').toLowerCase().includes('ev') || (info.bus_no || '').toLowerCase().includes('shuttle');

    // Colors
    let borderColor = 'border-blue-600';
    let iconColor = 'text-blue-600';

    if (isEV) {
        borderColor = 'border-green-500';
        iconColor = 'text-green-500';
    }

    // HTML Content
    let iconInnerHtml;

    if (isEV) {
        // EV ICON (Custom Scratch SVG)
        iconInnerHtml = `
            <div class="relative w-12 h-12 flex items-center justify-center filter drop-shadow-md">
                 <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 25 H85 V30 H15 Z" fill="#10B981" stroke="white" stroke-width="2"/>
                    <path d="M25 30 L20 60" stroke="#E2E8F0" stroke-width="3"/>
                    <path d="M50 30 L50 60" stroke="#E2E8F0" stroke-width="3"/>
                    <path d="M75 30 L80 60" stroke="#E2E8F0" stroke-width="3"/>
                    <path d="M10 60 H90 L95 80 H5 L10 60 Z" fill="white" stroke="#10B981" stroke-width="2"/>
                    <path d="M25 50 H45 V60 H25 Z" fill="#10B981"/>
                    <path d="M55 50 H75 V60 H55 Z" fill="#10B981"/>
                    <circle cx="25" cy="80" r="8" fill="#18181B" stroke="white" stroke-width="2"/>
                    <circle cx="75" cy="80" r="8" fill="#18181B" stroke="white" stroke-width="2"/>
                    <path d="M50 55 L45 65 H50 L48 75 L58 63 H52 L55 55 Z" fill="#FACC15" stroke="black" stroke-width="1"/>
                </svg>
                <!-- Badge -->
                <div class="absolute -top-1 -right-1 bg-slate-900/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-slate-700 shadow-sm z-20">
                    ${info.bus_no}
                </div>
            </div>
        `;
    } else {
        // BUS ICON (Custom Scratch SVG)
        iconInnerHtml = `
            <div class="relative w-12 h-12 flex items-center justify-center filter drop-shadow-md">
                 <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="10" y="30" width="80" height="40" rx="5" fill="#FACC15" stroke="white" stroke-width="2"/>
                    <rect x="15" y="35" width="15" height="12" fill="#334155"/>
                    <rect x="35" y="35" width="15" height="12" fill="#334155"/>
                    <rect x="55" y="35" width="15" height="12" fill="#334155"/>
                    <rect x="75" y="35" width="10" height="12" fill="#334155"/>
                    <rect x="10" y="52" width="80" height="6" fill="#1E3A8A"/>
                    <circle cx="25" cy="70" r="8" fill="#18181B" stroke="white" stroke-width="2"/>
                    <circle cx="75" cy="70" r="8" fill="#18181B" stroke="white" stroke-width="2"/>
                </svg>
                <!-- Badge -->
                <div class="absolute -top-1 -right-1 bg-slate-900/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-slate-700 shadow-sm z-20">
                    ${info.bus_no}
                </div>
            </div>
        `;
    }

    const icon = L.divIcon({ className: '', html: iconInnerHtml, iconSize: [56, 56], iconAnchor: [28, 28] });

    if (markers[busId]) {
        markers[busId].setLatLng([info.lat, info.lng]).setIcon(icon);
        markers[busId].setOpacity(1); // Restore visibility if it was Hidden by Ghost Mode
    } else {
        markers[busId] = L.marker([info.lat, info.lng], { icon: icon }).addTo(map)
            .bindPopup(`<b class="text-slate-900">Bus ${info.bus_no}</b><br>${generateDensityIcons(info.crowd || 'LOW')}`)
            .bindTooltip(`<div class="text-center"><b class="text-slate-900">Bus ${info.bus_no}</b><br>${generateDensityIcons(info.crowd || 'LOW')}</div>`, {
                direction: 'top',
                offset: [0, -30],
                opacity: 1,
                className: 'custom-tooltip' // Tailwind styles in CSS
            })
            .on('click', () => {
                map.setView([info.lat, info.lng], 16);
                startTrackingRouteByBusNo(String(info.bus_no));
            });
    }
    // Store Bus Data for Routing
    markers[busId].speed = info.speed || 0; // Store real GPS speed (km/h) 
    markers[busId].crowd = info.crowd || 'LOW';

    // --- NEW: Populate Speed History ---
    if (!speedHistory[busId]) speedHistory[busId] = [];
    if (info.speed && info.speed > 5) { // Only record significant movement (>5km/h)
        speedHistory[busId].push(info.speed);
        if (speedHistory[busId].length > 20) speedHistory[busId].shift(); // Keep last 20 readings
    }

    // --- NEW: Bus Type Logic ---
    const busType = info.type || 'HOSTEL';
    const typeBadge = busType === 'HOSTEL'
        ? `<span class="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 font-bold tracking-tight">HOSTEL</span>`
        : `<span class="text-[10px] bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded border border-cyan-200 font-bold tracking-tight">DAY SCHOLAR</span>`;

    // Update Popup & Tooltip Content
    if (markers[busId]) {
        const popupContent = `
            <div class="flex flex-col gap-1 min-w-[120px]">
                <div class="flex items-center justify-between gap-2 mb-1">
                    <b class="text-slate-900 text-sm">Bus ${info.bus_no}</b>
                    ${generateDensityIcons(markers[busId].crowd)}
                </div>
                
                <div class="flex items-center gap-2 mb-1 pl-0.5">
                     <span class="text-xs">👨‍✈️</span> 
                     <span class="text-[10px] text-slate-600 font-bold truncate max-w-[80px]">${info.driver_name || 'Driver'}</span>
                </div>

                <div class="flex items-center justify-between">
                    ${typeBadge}
                </div>
            </div>
        `;

        // Update Popup
        if (markers[busId].getPopup() && markers[busId].getPopup().isOpen()) {
            markers[busId].setPopupContent(popupContent);
        } else {
            markers[busId].setPopupContent(popupContent);
        }

        // Update Tooltip (Hover Card)
        if (markers[busId].getTooltip()) {
            markers[busId].setTooltipContent(popupContent);
        }
    }
}

export function startLocationTracking(highAccuracy = true) {
    if (watchId) navigator.geolocation.clearWatch(watchId);

    const gpsTimeout = highAccuracy ? 5000 : 30000;
    const maxAge = highAccuracy ? 0 : Infinity;

    const options = { enableHighAccuracy: highAccuracy, timeout: gpsTimeout, maximumAge: maxAge };

    console.log(`Starting GPS (High Acc: ${highAccuracy})...`);
    updateGpsStatus('searching', `GPS: Locating (${highAccuracy ? 'High' : 'Low'})...`);

    watchId = navigator.geolocation.watchPosition(
        (pos) => {
            userLat = pos.coords.latitude;
            userLng = pos.coords.longitude;
            updateUserMarker(userLat, userLng);
            updateGpsStatus('active', 'GPS: Active');

            if (targetBusId) {
                updateRoute();
                // Emit Location to Driver
                const busInfo = lastBusData[targetBusId];
                if (busInfo && busInfo.bus_no) {
                    console.log("[STUDENT] Emitting location to driver for bus:", busInfo.bus_no);
                    socket.emit('student_update', {
                        bus_no: busInfo.bus_no,
                        lat: userLat,
                        lng: userLng
                    });
                }
            }

            const tripDist = document.getElementById('trip-dist');
            if (tripDist && tripDist.textContent.includes("GPS")) {
                document.getElementById('trip-info-card').classList.add('hidden');
            }
        },
        (err) => {
            console.warn(`GPS Error:`, err);
            if (highAccuracy) {
                console.log("Switching to Low Accuracy...");
                startLocationTracking(false);
                return;
            }
            updateGpsStatus('error', 'GPS: Failed');
            // Show error in trip card if tracking
            const tripCard = document.getElementById('trip-info-card');
            const tripDist = document.getElementById('trip-dist');
            if (tripCard && tripDist) {
                tripCard.classList.remove('hidden');
                tripDist.textContent = "GPS Access Denied/Error";
            }
        },
        options
    );
}

function updateUserMarker(lat, lng) {
    if (userMarker) {
        userMarker.setLatLng([lat, lng]);
    } else {
        userMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
    }
}

// Routing
// Routing
// Routing
export function startTrackingRouteByBusNo(busNo) {
    targetBusNo = busNo;   // Set Truth
    targetBusId = null;    // Reset Socket ID (will find if online)

    // 1. Activate Split Screen Mode
    const mapContainer = document.getElementById('map-container');
    const routePanel = document.getElementById('route-panel');
    const fullscreenToggle = document.getElementById('fullscreen-toggle');
    const tripCard = document.getElementById('trip-info-card');
    const busNoEl = document.getElementById('rp-bus-no');

    if (mapContainer && routePanel) {
        routePanel.classList.remove('hidden');
        routePanel.classList.add('flex'); // Ensure flex layout is active
        if (fullscreenToggle) fullscreenToggle.classList.remove('hidden');
        if (tripCard) tripCard.classList.remove('hidden');
    }

    // Update Header Immediately
    if (busNoEl) busNoEl.textContent = busNo || "Bus";

    // 2. Try to find socket ID from local data (Live or Cache)
    for (const [bid, info] of Object.entries(lastBusData)) {
        // Match Bus Number (String safely) - Allow OFFLINE buses too so we can fly to last location
        if (String(info.bus_no).trim() === String(busNo).trim()) {
            targetBusId = bid;
            break;
        }
    }

    // 3. Draw Route from Excel Data (Always works via bus_no)
    drawBusPath(busNo);

    // 4. Update Status/ETA
    updateRoute();

    // Reset Proximity Flag for new bus
    window.notifiedProximityBusId = null;

    // Request Screen Keep-Awake
    requestWakeLock();

    // 5. Logic: If we found the bus (Offline or Online), fly to it.
    if (targetBusId && lastBusData[targetBusId]) {
        console.log("[STUDENT] Found Bus in Data -> Locating:", busNo);

        // Fly to Bus Location
        const b = lastBusData[targetBusId];
        if (map && b.lat && b.lng) {
            console.log("📍 Flying to Bus Location:", b.lat, b.lng);
            map.flyTo([b.lat, b.lng], 16, { duration: 1.5 });

            // Open the "Info Card" (Popup) immediately
            if (markers[targetBusId]) {
                setTimeout(() => {
                    markers[targetBusId].openPopup();
                }, 1500); // Wait for flyTo or do it immediately? FlyTo animation might be weird. Let's do it after a slight delay or immediately. Leaflet handles it.
                // Actually, doing it immediately is better for responsiveness.
                markers[targetBusId].openPopup();
            }
        }

        // Force Emit to Driver
        if (userLat && userLng) {
            socket.emit('student_update', {
                bus_no: busNo,
                lat: userLat,
                lng: userLng
            });
        }
        return true; // Found
    } else {
        // Bus is completely unknown (not in our local data/cache)
        console.warn(`Bus ${busNo} is not live in local data.`);
        return false; // Not found
    }
}

// Deprecated wrapper (for backward compat if needed, but we switch clicks to above)
export function startTrackingRoute(busId) {
    if (lastBusData[busId]) {
        startTrackingRouteByBusNo(lastBusData[busId].bus_no);
    }
}

// --- NEW: Toggle Full Screen ---
// --- NEW: Toggle Full Screen ---\nwindow.toggleFullScreenMap = function () {\n    const routePanel = document.getElementById('route-panel');\n    const fullscreenToggle = document.getElementById('fullscreen-toggle');\n    const tripCard = document.getElementById('trip-info-card');\n\n    if (routePanel.classList.contains('hidden')) {\n        // Show Overlay\n        routePanel.classList.remove('hidden');\n        /* routePanel.classList.add('flex'); */\n        fullscreenToggle.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>`;\n    } else {\n        // Hide Overlay (Full Map)\n        routePanel.classList.add('hidden');\n        /* routePanel.classList.remove('flex'); */\n        fullscreenToggle.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 4l-5-5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>`;\n    }\n}

// --- NEW: Render Timeline ---
let cachedStops = [];

function renderRouteTimeline(stops) {
    // Sort stops by order
    stops.sort((a, b) => (a.stop_order || 0) - (b.stop_order || 0));
    cachedStops = stops;
    const container = document.getElementById('route-timeline');
    const busNoEl = document.getElementById('rp-bus-no');

    if (!container) return;

    // Update Header
    if (busNoEl) busNoEl.textContent = lastBusData[targetBusId]?.bus_no || "Bus";

    // Clear list (keep the vertical line div)
    // We recreate stricture: Line + items
    container.scrollTop = 0; // Reset scroll position
    container.innerHTML = `<div class="absolute left-[27px] top-6 bottom-0 w-0.5 bg-slate-700 z-0"></div>`;

    stops.forEach((stop, index) => {
        const div = document.createElement('div');
        div.className = "relative flex items-start gap-4 mb-6 z-10 stop-item";
        div.dataset.lat = stop.lat;
        div.dataset.lng = stop.lng;
        div.id = `stop-${index}`;

        div.innerHTML = `
            <div class="w-4 h-4 rounded-full bg-slate-900 border-2 border-slate-500 shrink-0 mt-1 transition-colors" id="dot-${index}"></div>
            <div>
                <p class="text-slate-200 font-bold text-sm leading-tight">${stop.stop_name}</p>
                <p class="text-[10px] text-slate-500 font-mono mt-0.5">Stop #${stop.stop_order}</p>
                
                <!-- Bus Icon Container (Hidden by default) -->
                <div id="bus-at-${index}" class="hidden mt-2 bg-slate-800 p-2 rounded-lg border border-slate-700 flex items-center gap-2">
                     <span class="text-lg">🚌</span>
                     <div>
                        <p class="text-[10px] text-green-400 font-bold">Current Location</p>
                        <p class="text-[10px] text-slate-400">Arriving...</p>
                     </div>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

// Route Visuals
let currentRouteLayer = null;
let currentStopsLayer = null;

async function drawBusPath(busNo) {
    // Clear previous
    if (currentRouteLayer) map.removeLayer(currentRouteLayer);
    if (currentStopsLayer) {
        map.removeLayer(currentStopsLayer);
        stopMarkers = {}; // Clear cache
    }

    try {
        const res = await fetch(`/api/routes/${busNo}`);
        if (!res.ok) return; // No route found

        const data = await res.json();

        // 1. Draw Polyline (Road Snapped using OSRM)
        if (data.path && data.path.length > 0) {
            // Ensure stops are sorted by order
            data.stops.sort((a, b) => (a.stop_order || 0) - (b.stop_order || 0));

            // Convert simple path points to LatLng waypoints for OSRM
            const waypoints = data.stops.map(s => L.latLng(s.lat, s.lng));

            // Use the existing routing engine or creating a temporary one
            const router = L.Routing.osrmv1({
                serviceUrl: 'https://router.project-osrm.org/route/v1',
                profile: 'driving'
            });

            router.route(waypoints.map(wp => ({ latLng: wp })), (err, routes) => {
                if (!err && routes && routes.length > 0) {
                    const line = L.Routing.line(routes[0], {
                        styles: [{ color: '#d946ef', opacity: 0.9, weight: 6, dashArray: '1, 6' }] // Neon Purple dashed
                    });
                    // Override OSRM default style preventing it from being transparent
                    // actually L.Routing.line returns a layer that might have its own opinion.
                    // The safest way for a solid route line:
                    const routeCoords = routes[0].coordinates;
                    currentRouteCoordinates = routeCoords; // Save for Prediction Logic
                    const staticLine = L.polyline(routeCoords, {
                        color: '#d946ef', // Fuchsia-500
                        weight: 6,
                        opacity: 0.9,
                        lineCap: 'round'
                    });

                    currentRouteLayer = staticLine;
                    staticLine.addTo(map);
                } else {
                    // Fallback to straight lines
                    console.warn("OSRM Failed, falling back to straight lines");
                    currentRouteLayer = L.polyline(data.path, {
                        color: '#d946ef', weight: 6, opacity: 0.9, dashArray: '5, 10'
                    }).addTo(map);
                }
            });
        }

        if (data.stops && data.stops.length > 0) {
            currentStopsLayer = L.layerGroup().addTo(map);
            data.stops.forEach(stop => {
                // NEW: Bus Stop Icon (SVG)
                // NEW: Labeled Bus Stop Icon
                const stopIcon = L.divIcon({
                    className: '', // No default styles
                    html: `
                    <div class="flex flex-col items-center group cursor-pointer transition-transform hover:scale-110" style="margin-top: -30px;">
                        <!-- Icon -->
                        <div class="w-6 h-6 bg-white border-2 border-slate-900 rounded-md flex items-center justify-center shadow-md mb-1">
                            <span class="text-xs">🚏</span>
                        </div>
                        <!-- Label (Visible Always) -->
                        <div class="bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm whitespace-nowrap backdrop-blur-sm border border-slate-700">
                            ${stop.stop_name}
                        </div>
                    </div>
                    `,
                    iconSize: [100, 50], // Wide enough for label
                    iconAnchor: [50, 25], // Center
                    popupAnchor: [0, -25]
                });

                const marker = L.marker([stop.lat, stop.lng], {
                    icon: stopIcon
                }).addTo(currentStopsLayer);

                // Init Count
                marker.stopCount = 0;

                // Store in cache
                stopMarkers[stop.stop_name] = marker;

                // Bind Popup with Interaction
                updateStopMarkerPopup(marker, stop.stop_name, busNo);
            });

        }

        // 3. Render Timeline Panel
        if (data.stops && data.stops.length > 0) {
            renderRouteTimeline(data.stops);
        }

    } catch (e) {
        console.error("Failed to load route path:", e);
    }
}

export function minimizeRoutePanel() {
    const routePanel = document.getElementById('route-panel');
    if (routePanel) {
        routePanel.classList.add('hidden');
    }
}

export function stopTrackingRoute() {
    if (targetBusId) {
        targetBusId = null;
    }

    // Release Wake Lock
    releaseWakeLock();
    window.notifiedProximityBusId = null;

    const tripCard = document.getElementById('trip-info-card');
    if (tripCard) tripCard.classList.add('hidden');

    // Reset Split Screen
    const routePanel = document.getElementById('route-panel');
    const fullscreenToggle = document.getElementById('fullscreen-toggle');
    if (routePanel) {
        routePanel.classList.add('hidden');
        // Do NOT remove flex, as it breaks layout on re-opening
        // routePanel.classList.remove('flex'); 
    }
    if (fullscreenToggle) fullscreenToggle.classList.add('hidden');
    setTimeout(() => map.invalidateSize(), 300);

    // Clean up dynamic layer
    if (dynamicRouteLayer) {
        map.removeLayer(dynamicRouteLayer);
        dynamicRouteLayer = null;
    }

    // Clean up router if we want (optional, but good practice to reset)
    // dynamicRouteRouter = null; 

    if (fallbackLine) {
        map.removeLayer(fallbackLine);
        fallbackLine = null;
    }
    if (currentRouteLayer) {
        map.removeLayer(currentRouteLayer);
        currentRouteLayer = null;
    }
    if (currentStopsLayer) {
        map.removeLayer(currentStopsLayer);
        currentStopsLayer = null;
    }
}

function updateRoute() {
    if (!targetBusId || !markers[targetBusId]) return;
    const tripEta = document.getElementById('trip-eta');
    const tripDist = document.getElementById('trip-dist');
    const tripCard = document.getElementById('trip-info-card');

    if (!userLat) {
        if (tripEta) tripEta.textContent = "--";
        if (tripDist) tripDist.textContent = "Locating you...";
        return;
    }

    const busMarker = markers[targetBusId];
    if (busMarker.isOffline && tripCard) tripCard.classList.add('grayscale');
    else if (tripCard) tripCard.classList.remove('grayscale');

    const busLatLng = busMarker.getLatLng();
    const waypoints = [L.latLng(busLatLng.lat, busLatLng.lng), L.latLng(userLat, userLng)];

    runFallbackRouting(busLatLng, tripEta, tripDist);

    // Calc vars locally for notification
    const dist = map.distance([userLat, userLng], busLatLng);
    const distKm = (dist / 1000).toFixed(1);
    const etaMin = Math.ceil((distKm / 15) * 60); // Rough estimate till OSRM updates

    // Check Proximity for Notification
    checkProximityAndNotify(busMarker.getLatLng(), distKm, etaMin);

    // DEBOUNCE: Only update OSRM every 2 seconds to prevent map jank
    if (window.routeDebounce) clearTimeout(window.routeDebounce);
    window.routeDebounce = setTimeout(() => {
        executeOsrmRoute(waypoints);
        updateTimelinePosition(busLatLng);
    }, 2000);
}

// Proximity Notification State
let hasNotifiedArrival = false;
let lastNotifiedBusId = null;

function checkProximityAndNotify(busLatLng, distKm, etaMin) {
    // Reset if tracking a new bus
    if (lastNotifiedBusId !== targetBusId) {
        hasNotifiedArrival = false;
        lastNotifiedBusId = targetBusId;
    }

    if (!hasNotifiedArrival && distKm < 1.0) { // 1km threshold
        const busNo = lastBusData[targetBusId]?.bus_no || "Unknown";
        console.log(`[NOTIFY] Bus ${busNo} is near (${distKm}km)`);

        notifications.notifyBusArrival(busNo, "Your Location", etaMin);
        hasNotifiedArrival = true;
    }
}

// --- NEW: Update Timeline Position ---
function updateTimelinePosition(busLatLng) {
    if (!cachedStops || cachedStops.length === 0) return;

    let nearestStopIndex = -1;
    let minDist = Infinity;

    // Find nearest stop
    cachedStops.forEach((stop, index) => {
        const dist = map.distance(busLatLng, [stop.lat, stop.lng]);

        // Reset Visuals first
        const dot = document.getElementById(`dot-${index}`);
        const busIcon = document.getElementById(`bus-at-${index}`);
        if (dot) {
            dot.className = "w-4 h-4 rounded-full bg-slate-900 border-2 border-slate-500 shrink-0 mt-1 transition-colors";
        }
        if (busIcon) busIcon.classList.add('hidden');

        if (dist < minDist) {
            minDist = dist;
            nearestStopIndex = index;
        }
    });

    // Threshold: 500 meters. If bus is > 500m from ANY stop, show nothing on timeline.
    if (minDist < 500 && nearestStopIndex !== -1) {
        const busIcon = document.getElementById(`bus-at-${nearestStopIndex}`);
        const dot = document.getElementById(`dot-${nearestStopIndex}`);

        if (busIcon) {
            busIcon.classList.remove('hidden');
            // Auto scroll to this element
            busIcon.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (dot) {
            dot.className = "w-4 h-4 rounded-full bg-green-500 border-2 border-green-300 shrink-0 mt-1 shadow-[0_0_10px_rgba(34,197,94,0.5)]";
        }
    }
}

let dynamicRouteRouter = null;
let dynamicRouteLayer = null;

function executeOsrmRoute(waypoints) {
    if (!dynamicRouteRouter) {
        dynamicRouteRouter = L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            profile: 'driving',
            timeout: 5000
        });
    }

    dynamicRouteRouter.route(waypoints.map(wp => ({ latLng: wp })), (err, routes) => {
        if (err) {
            console.warn("OSRM Routing Error", err);
            return;
        }

        if (routes && routes.length > 0) {
            const route = routes[0];
            const coordinates = route.coordinates;
            const summary = route.summary;

            // 1. Draw the Blue Navigation Line manually (Guarantee NO map movement)
            if (dynamicRouteLayer) map.removeLayer(dynamicRouteLayer);

            dynamicRouteLayer = L.polyline(coordinates, {
                color: '#3b82f6',
                weight: 6,
                opacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(map);

            // 2. Hide Fallback Line since we have a real road path
            if (fallbackLine) {
                map.removeLayer(fallbackLine);
                fallbackLine = null;
            }

            // 3. Update ETA/Distance UI
            const distanceKm = (summary.totalDistance || 0) / 1000;
            updateTripInfoCard(distanceKm);
        }
    });

    startRoutingTimer();
}

function updateTripInfoCard(distanceKm) {
    const tripEta = document.getElementById('trip-eta');
    const tripDist = document.getElementById('trip-dist');
    if (!targetBusId || !markers[targetBusId]) return;

    const currentSpeedKmph = markers[targetBusId]?.speed || 0;
    const MIN_RELIABLE_SPEED = 5;
    const FALLBACK_CITY_SPEED = 15;
    const FALLBACK_HIGHWAY_SPEED = 45;
    const HIGHWAY_DISTANCE_THRESHOLD = 20;

    let finalTimeMin;
    let statusMsg = "";

    if (currentSpeedKmph > MIN_RELIABLE_SPEED) {
        finalTimeMin = Math.ceil((distanceKm / currentSpeedKmph) * 60);
    } else {
        if (distanceKm > HIGHWAY_DISTANCE_THRESHOLD) {
            finalTimeMin = Math.ceil((distanceKm / FALLBACK_HIGHWAY_SPEED) * 60);
            statusMsg = " (Highway Est.)";
        } else {
            finalTimeMin = Math.ceil((distanceKm / FALLBACK_CITY_SPEED) * 60);
            statusMsg = currentSpeedKmph <= 0 ? " (Halted)" : " (Heavy Traffic)";
        }
    }
    finalTimeMin += 2;

    if (tripEta) tripEta.textContent = `${finalTimeMin} min${statusMsg}`;
    if (tripDist) tripDist.textContent = `(${distanceKm.toFixed(1)} km)`;

    const tripStatus = document.getElementById('trip-status');
    if (tripStatus) {
        const status = markers[targetBusId]?.crowd || 'LOW';
        tripStatus.textContent = status;
        tripStatus.className = "text-xs font-bold font-mono";
        if (status === 'HIGH') tripStatus.classList.add('text-red-500');
        else if (status === 'MED') tripStatus.classList.add('text-yellow-400');
        else tripStatus.classList.add('text-green-400');
    }
}


function runFallbackRouting(busLatLng, etaEl, distEl) {
    const dist = map.distance([userLat, userLng], busLatLng);
    const distKm = (dist / 1000).toFixed(1);

    // Fallback Calculation
    const FALLBACK_CITY_SPEED = 15;
    const FALLBACK_HIGHWAY_SPEED = 45;
    const speed = distKm > 20 ? FALLBACK_HIGHWAY_SPEED : FALLBACK_CITY_SPEED;

    const timeMins = Math.ceil((distKm / speed) * 60);

    if (distEl) distEl.textContent = `(${distKm} km)`;
    if (etaEl) etaEl.textContent = `${timeMins} min`;

    if (fallbackLine) map.removeLayer(fallbackLine);
    fallbackLine = L.polyline([[userLat, userLng], [busLatLng.lat, busLatLng.lng]], {
        color: '#3b82f6', weight: 4, dashArray: '10, 10', opacity: 0.7
    }).addTo(map);
}

function startRoutingTimer(busLatLng) {
    if (routingTimer) clearTimeout(routingTimer);
    routingTimer = setTimeout(() => {
        console.warn("OSRM Timeout");
    }, 5000);
}

function generateDensityIcons(status) {
    status = (status || 'LOW').toUpperCase();

    // Config: Count & Color
    let count = 1;
    let colorClass = 'text-green-500';

    if (status === 'MED') {
        count = 2;
        colorClass = 'text-yellow-400';
    } else if (status === 'HIGH') {
        count = 3;
        colorClass = 'text-red-500';
    }

    // Person SVG
    const personSvg = `
        <svg class="w-4 h-4 ${colorClass}" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>
        </svg>
    `;

    // Generate Icons
    let iconsHtml = '';
    for (let i = 0; i < count; i++) {
        iconsHtml += personSvg;
    }

    return `<div class="flex items-center gap-0.5" title="Crowd: ${status}">${iconsHtml}</div>`;
}

// Set Bus Filter (Called from Search/Main)
// Set Bus Filter (Called from Search/Main)
export function setBusFilter(filter) {
    if (Array.isArray(filter)) {
        // Normalize array: trim + lowercase
        currentBusFilter = filter.map(f => String(f).trim().toLowerCase());
        console.log("[SET_FILTER] ARRAY:", currentBusFilter);
    } else {
        // Normalize string
        currentBusFilter = String(filter).trim().toLowerCase();
        console.log("[SET_FILTER] STRING:", currentBusFilter);
    }
    renderBusList();
}

export function getActiveBuses() {
    return lastBusData || {};
}

// --- WAKE LOCK (Keep Screen On) ---
let wakeLock = null;

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('💡 Screen Wake Lock active');

            // Re-acquire if visibility changes (e.g. user switches tabs and comes back)
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }
    } catch (err) {
        console.warn(`Wake Lock Warning: ${err.name}, ${err.message}`);
    }
}

async function handleVisibilityChange() {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        await requestWakeLock(); // Re-request
    }
}

function releaseWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release()
            .then(() => {
                wakeLock = null;
                console.log('💡 Screen Wake Lock released');
            });
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
}

// --- OFFLINE PREDICTION Logic (Dead Reckoning) ---
let predictionInterval = null;
let currentRouteCoordinates = []; // Stores the full lat/lng path of the route
let ghostBusMarker = null;

function checkOfflineStatus() {
    if (!targetBusId || !lastBusData[targetBusId]) return;

    const bus = lastBusData[targetBusId];
    if (!bus.last_updated) return;

    // Parse UTC Date
    const lastUpdate = new Date(bus.last_updated + "Z"); // Ensure UTC treatment
    const now = new Date();
    const diffMs = now - lastUpdate;
    const diffMins = Math.floor(diffMs / 60000);

    // Threshold: 1 Minute
    if (diffMins >= 1 && !bus.offline_prediction_active) {
        console.warn(`[OFFLINE] Bus ${bus.bus_no} is silent for ${diffMins} mins.`);

        // Show Popup asking for consent
        showOfflinePredictionPopup(bus.bus_no, diffMins, bus.speed, lastUpdate);

        // Mark as checked to prevent loop
        bus.offline_prediction_active = true;
    }
}

function showOfflinePredictionPopup(busNo, mins, speed, lastTime) {
    // Create Modal
    const modal = document.createElement('div');
    modal.className = "fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-300";
    modal.innerHTML = `
        <div class="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden">
             <!-- Signal Waves Animation -->
            <div class="absolute -top-10 -right-10 w-32 h-32 bg-red-500/20 rounded-full animate-ping"></div>

            <h3 class="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <span class="text-2xl">📡</span> Signal Lost
            </h3>
            <p class="text-slate-300 text-sm mb-4">
                Bus <b>${busNo}</b> stopped sending signals <b>${mins} mins ago</b>.
            </p>
            
            <div class="bg-slate-800/50 rounded-lg p-3 mb-4 text-xs text-slate-400 space-y-1">
                <p>Last Speed: <span class="text-white font-mono">${speed?.toFixed(1) || 0} km/h</span></p>
                <p>Last Seen: <span class="text-white font-mono">${lastTime.toLocaleTimeString()}</span></p>
            </div>

            <p class="text-xs text-slate-500 mb-6 italic">
                Do you want to see the <b>Estimated Location</b> based on its last speed?
            </p>

            <div class="flex gap-3">
                <button id="predict-cancel" class="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 font-bold text-sm hover:bg-slate-800 transition-colors">
                    No, Cancel
                </button>
                <button id="predict-confirm" class="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all active:scale-95">
                    Show Ghost Bus 👻
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('predict-cancel').onclick = () => {
        modal.remove();
    };

    document.getElementById('predict-confirm').onclick = () => {
        modal.remove();
        startGhostBusPrediction(speed, lastTime);
    };
}

function startGhostBusPrediction(lastSpeedKmph, lastTime) {
    if (!currentRouteCoordinates || currentRouteCoordinates.length === 0) {
        notifications.showPopup("Prediction Failed", "Route path not available for ghost bus.", "error");
        return;
    }

    // --- SMART PREDICTION LOGIC ---
    let predictionSpeed = lastSpeedKmph;

    // CASE: Bus was stopped (Traffic Light/Stop) when signal lost
    if (!lastSpeedKmph || lastSpeedKmph < 1) {
        // Attempt to get Session Average
        const history = speedHistory[targetBusNo] || []; // targetBusNo is global source of truth
        if (history.length > 0) {
            const sum = history.reduce((a, b) => a + b, 0);
            predictionSpeed = sum / history.length;
            console.log(`[PREDICTION] Bus was stopped. Using Session Avg Speed: ${predictionSpeed.toFixed(1)} km/h`);
        } else {
            // No history? Use Default City Speed
            predictionSpeed = 30; // 30 km/h default
            console.log(`[PREDICTION] Bus was stopped. No history. Using Default Speed: 30 km/h`);
        }
    }

    console.log(`[PREDICTION] Starting Dead Reckoning. Speed: ${predictionSpeed.toFixed(1)} km/h`);

    // HIDE Real Marker (No duplicate visuals)
    if (markers[targetBusId]) {
        markers[targetBusId].setOpacity(0); // Fade out instead of remove, to keep state
        if (markers[targetBusId].closePopup) markers[targetBusId].closePopup();
        if (markers[targetBusId].closeTooltip) markers[targetBusId].closeTooltip();
    }

    // Setup Ghost Bus Marker
    const ghostIcon = L.divIcon({
        className: 'ghost-bus-icon',
        html: `
            <div class="relative w-12 h-12 flex items-center justify-center opacity-70">
                <span class="text-4xl filter drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">👻</span>
                <span class="absolute -bottom-2 bg-slate-900 text-[8px] text-white px-1 rounded">ESTIMATED</span>
            </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24]
    });

    // Initial Render
    if (ghostBusMarker) map.removeLayer(ghostBusMarker);
    ghostBusMarker = L.marker([0, 0], { icon: ghostIcon, zIndexOffset: 900 }).addTo(map);

    // Initial Calculation
    updateGhostPosition(predictionSpeed, lastTime);

    // Update every second (Simulate movement)
    if (predictionInterval) clearInterval(predictionInterval);
    predictionInterval = setInterval(() => {
        updateGhostPosition(predictionSpeed, lastTime);
    }, 1000);
}

function updateGhostPosition(speedKmph, lastTime) {
    const now = new Date();
    const elapsedHours = (now - lastTime) / 3600000; // ms -> hours
    const distTraveledKm = speedKmph * elapsedHours;
    const distTraveledMeters = distTraveledKm * 1000;

    // Dead Reckoning: Walk the line
    // 1. Find start point (Bus last known pos) on route
    // 2. Add distance

    // For simplicity/robustness: We assume the bus WAS on the route.
    // We walk from index 0 of the route to find the point closest to "distance from start".

    // BETTER APPROACH for "Resume":
    // We need to know where the bus was ON THE LINE when it died.
    // Finding closest point on polyline is heavy. 
    // Optimization: We check checking distance from Stop 0? 
    // No, simplest is: Calculate total distance of route. Find point at (StartDist + Traveled).

    // Let's use a Helper to find the "Point at Distance X" along the polyline.
    // BUT we need to know "Distance of Bus from Start" at t=0.
    // We can estimate that by finding the closest point on path to `lastBusData.lat/lng`.

    if (targetBusId && lastBusData[targetBusId]) {
        const bus = lastBusData[targetBusId];
        const busLatLng = L.latLng(bus.lat, bus.lng);

        // Find initial distance on path
        const startDist = getDistanceFromStart(busLatLng, currentRouteCoordinates);

        const totalDist = startDist + distTraveledMeters;

        const predictedLatLng = getPointAtDistance(totalDist, currentRouteCoordinates);

        if (predictedLatLng) {
            ghostBusMarker.setLatLng(predictedLatLng);
            ghostBusMarker.bindPopup(`
                <div class="text-center">
                    <b>👻 Ghost Bus</b><br>
                    <span class="text-xs">Estimated Location</span><br>
                    <span class="text-[10px] text-slate-400">assuming constant speed</span>
                </div>
             `).openPopup();
        } else {
            // End of route
            console.log("Prediction: End of route reached.");
            clearInterval(predictionInterval);
        }
    }
}

// Helper: Find rough distance of a point ALONG the polyline
function getDistanceFromStart(point, coords) {
    let minDist = Infinity;
    let closestIndex = 0;

    // 1. Find closest vertex (Simpler than projection)
    for (let i = 0; i < coords.length; i++) {
        const d = map.distance(point, coords[i]);
        if (d < minDist) {
            minDist = d;
            closestIndex = i;
        }
    }

    // 2. Sum distance up to that index
    let dist = 0;
    for (let i = 0; i < closestIndex; i++) {
        dist += map.distance(coords[i], coords[i + 1]);
    }
    return dist;
}

// Helper: Get LatLng at specific distance along polyline
function getPointAtDistance(targetDist, coords) {
    let accDist = 0;

    for (let i = 0; i < coords.length - 1; i++) {
        const segDist = map.distance(coords[i], coords[i + 1]);

        if (accDist + segDist >= targetDist) {
            // Target is inside this segment
            const remaining = targetDist - accDist;
            const ratio = remaining / segDist;

            // Interpolate
            const lat = coords[i].lat + (coords[i + 1].lat - coords[i].lat) * ratio;
            const lng = coords[i].lng + (coords[i + 1].lng - coords[i].lng) * ratio;

            return L.latLng(lat, lng);
        }

        accDist += segDist;
    }

    return null; // Reached end
}

// Start Main Timer for Checks
setInterval(checkOfflineStatus, 10000); // Check every 10s

// --- NEW: Popup Helper (Moved to Scope Safe Zone) ---
function updateStopMarkerPopup(marker, stopName, busNo) {

    const count = marker.stopCount || 0;

    const container = document.createElement('div');
    container.className = "flex flex-col items-center gap-1 min-w-[140px] p-1";

    // Header
    const title = document.createElement('div');
    title.className = "font-bold text-slate-900 mb-1";
    title.textContent = stopName;
    container.appendChild(title);

    // Count Badge
    if (count > 0) {
        const badge = document.createElement('div');
        badge.className = "text-xs font-bold text-red-600 mb-2";
        badge.textContent = `🔴 ${count} Waiting`;
        container.appendChild(badge);
    } else {
        const badge = document.createElement('div');
        badge.className = "text-xs text-slate-500 mb-2";
        badge.textContent = "No one waiting yet";
        container.appendChild(badge);
    }

    // Button Logic
    const hasVoted = userVotes.has(stopName);
    const btn = document.createElement('button');

    if (hasVoted) {
        // Render Cancel Button
        btn.className = "bg-red-900/50 border border-red-500 hover:bg-red-700 text-red-200 text-xs font-bold py-1.5 px-3 rounded-full w-full transition-all active:scale-95";
        btn.innerHTML = `❌ Cancel Request`;
        btn.onclick = (e) => {
            e.stopPropagation();
            console.log(`[VOTE] Cancel for Stop: ${stopName}`);

            // Optimistic UI
            btn.innerHTML = `Wait Here (+1)`;
            btn.className = "bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-3 rounded-full w-full transition-all active:scale-95";

            userVotes.delete(stopName);
            socket.emit('cancel_stop', {
                bus_no: busNo,
                stop_name: stopName
            });

            // Re-bind to ensure state consistency next time
            setTimeout(() => updateStopMarkerPopup(marker, stopName, busNo), 100);
        };
    } else {
        // Render Vote Button
        btn.className = "bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-3 rounded-full w-full transition-all active:scale-95";
        btn.innerHTML = `🙋‍♂️ Wait Here (+1)`;

        btn.onclick = (e) => {
            e.stopPropagation();
            console.log(`[VOTE] +1 for Stop: ${stopName}`);

            // Optimistic UI
            btn.innerHTML = `✅ Posted!`;
            btn.classList.add('bg-green-600');
            btn.classList.remove('bg-blue-600');

            userVotes.add(stopName);
            socket.emit('request_stop', {
                bus_no: busNo,
                stop_name: stopName,
                lat: marker.getLatLng().lat,
                lng: marker.getLatLng().lng
            });

            setTimeout(() => {
                updateStopMarkerPopup(marker, stopName, busNo);
            }, 1000);
        };
    }

    container.appendChild(btn);

    if (marker.getPopup()) {
        marker.setPopupContent(container);
    } else {
        marker.bindPopup(container);
    }
}

