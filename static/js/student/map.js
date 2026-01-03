import { updateServerStatus, updateGpsStatus } from './ui.js';

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
let fallbackLine = null;
let routingTimer = null; // Internal timer
let lastBusData = {};
let currentBusFilter = '';
const socket = io();

// Initialize Map
export function initMap() {
    map = L.map('map', { zoomControl: false }).setView([20.2961, 85.8245], 13);
    window.map = map; // For debug/global access if needed

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
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
}



function renderBusList() {
    const data = lastBusData;
    const busList = document.getElementById('bus-list');
    if (!busList) return;

    busList.innerHTML = '';

    // Filter Logic
    // Filter Logic
    // Filter Logic
    // ---------------------------------------------------------
    // UNIFIED DATA SOURCE: Merge Live Socket Data + Filter Results
    // ---------------------------------------------------------
    const mergedBuses = new Map();

    // 1. Add known live buses (Socket)
    Object.entries(lastBusData).forEach(([id, info]) => {
        const busNo = String(info.bus_no).trim().toLowerCase();
        mergedBuses.set(busNo, { id, info });
    });

    // 2. Inject "Offline" placeholders from Filter
    // If the search says "Bus 66 goes here", but socket doesn't know "Bus 66",
    // we MUST show it anyway so the student can see the route.
    if (Array.isArray(currentBusFilter)) {
        currentBusFilter.forEach(filterRaw => {
            const busNo = String(filterRaw).trim().toLowerCase();
            if (!mergedBuses.has(busNo)) {
                // Not in socket -> Create Offline Placeholder
                mergedBuses.set(busNo, {
                    id: `OFFLINE_${busNo}`,
                    info: {
                        bus_no: busNo.toUpperCase(), // Display as clean string
                        offline: true,
                        lat: 20.2961, // Default fallback (centered)
                        lng: 85.8245,
                        crowd: 'OFFLINE'
                    }
                });
            }
        });
    }

    // 3. Render List (Iterate over the Merged Map)
    // Only show items that match the current filter
    const activeEntries = [];
    mergedBuses.forEach((entry, busNoKey) => {
        const displayBusNo = String(entry.info.bus_no).trim().toLowerCase();

        let isMatch = false;
        if (Array.isArray(currentBusFilter)) {
            isMatch = currentBusFilter.includes(displayBusNo);
        } else {
            isMatch = displayBusNo.includes(String(currentBusFilter).trim().toLowerCase());
        }

        if (isMatch) {
            activeEntries.push(entry);
        }
    });

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
        item.className = "group flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-blue-500 cursor-pointer transition-all";
        item.onclick = () => {
            // Use setView for instant/controlled snap to avoid animation glitches
            // If offline, default lat/lng might be 0,0 or generic.
            const targetLat = info.lat || 20.2961;
            const targetLng = info.lng || 85.8245;

            map.setView([targetLat, targetLng], 16);
            startTrackingRouteByBusNo(String(info.bus_no));
        };
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
        <button onclick="event.stopPropagation(); map.setView([${info.lat || 20.2961}, ${info.lng || 85.8245}], 16); startTrackingRouteByBusNo('${info.bus_no}');"
            class="hidden group-hover:block px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-lg transition-all">
            LOCATE
        </button>
        `;
        busList.appendChild(item);
    });
}

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
    } else {
        markers[busId] = L.marker([info.lat, info.lng], { icon: icon }).addTo(map)
            .bindPopup(`<b class="text-slate-900">Bus ${info.bus_no}</b><br>${generateDensityIcons(info.crowd || 'LOW')}`)
            .on('click', () => {
                map.setView([info.lat, info.lng], 16);
                startTrackingRouteByBusNo(String(info.bus_no));
            });
    }
    // Store Bus Data for Routing
    markers[busId].speed = info.speed || 0; // Store real GPS speed (km/h) 
    markers[busId].crowd = info.crowd || 'LOW';

    // Update Popup Content (Density instead of Time)
    if (markers[busId] && markers[busId].getPopup()) {
        const popupContent = `
            <div class="flex items-center justify-between gap-2 min-w-[80px]">
                <b class="text-slate-900 text-sm">Bus ${info.bus_no}</b>
                ${generateDensityIcons(markers[busId].crowd)}
            </div>
        `;
        if (markers[busId].getPopup().isOpen()) {
            markers[busId].setPopupContent(popupContent);
        } else {
            markers[busId].bindPopup(popupContent);
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
        if (fullscreenToggle) fullscreenToggle.classList.remove('hidden');
        if (tripCard) tripCard.classList.remove('hidden');
    }

    // Update Header Immediately
    if (busNoEl) busNoEl.textContent = busNo || "Bus";

    // 2. Try to find live socket ID from local data
    for (const [bid, info] of Object.entries(lastBusData)) {
        // String comparison to be safe
        if (String(info.bus_no) === String(busNo) && !info.offline) {
            targetBusId = bid;
            break;
        }
    }

    // 3. Draw Route from Excel Data (Always works via bus_no)
    drawBusPath(busNo);

    // 4. Update Status/ETA
    updateRoute();

    // 5. Force Emit if we found a live bus
    if (targetBusId && userLat && userLng && lastBusData[targetBusId]) {
        console.log("[STUDENT] Force emitting initial location -> Driver of Bus:", busNo);
        socket.emit('student_update', {
            bus_no: busNo,
            lat: userLat,
            lng: userLng
        });
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
    if (currentStopsLayer) map.removeLayer(currentStopsLayer);

    try {
        const res = await fetch(`/api/routes/${busNo}`);
        if (!res.ok) return; // No route found

        const data = await res.json();

        // 1. Draw Polyline (Road Snapped using OSRM)
        if (data.path && data.path.length > 0) {
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

        // 2. Draw Stops
        if (data.stops && data.stops.length > 0) {
            currentStopsLayer = L.layerGroup().addTo(map);
            data.stops.forEach(stop => {
                L.circleMarker([stop.lat, stop.lng], {
                    radius: 5,
                    color: '#86198f', // Dark Fuchsia Border
                    fillColor: '#f0abfc', // Light Fuchsia Fill
                    fillOpacity: 1,
                    weight: 2
                }).bindTooltip(stop.stop_name, {
                    permanent: false,
                    direction: 'top',
                    offset: [0, -5],
                    className: 'text-xs font-bold text-fuchsia-500 bg-slate-900/90 border-0 rounded px-2 py-1'
                }).addTo(currentStopsLayer);
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

export function stopTrackingRoute() {
    if (targetBusId) {
        targetBusId = null;
    }
    const tripCard = document.getElementById('trip-info-card');
    if (tripCard) tripCard.classList.add('hidden');

    // Reset Split Screen
    const routePanel = document.getElementById('route-panel');
    const fullscreenToggle = document.getElementById('fullscreen-toggle');
    if (routePanel) {
        routePanel.classList.add('hidden');
        routePanel.classList.remove('flex');
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

    // DEBOUNCE: Only update OSRM every 2 seconds to prevent map jank
    if (window.routeDebounce) clearTimeout(window.routeDebounce);
    window.routeDebounce = setTimeout(() => {
        executeOsrmRoute(waypoints);
        updateTimelinePosition(busLatLng);
    }, 2000);
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
    let bars = '';

    // 3 Bars
    // 1: Green, 2: Yellow, 3: Red

    // Bar 1 (Always Visible)
    const color1 = status === 'LOW' ? 'bg-green-500' : (status === 'MED' ? 'bg-yellow-500' : 'bg-red-500');
    bars += `<div class="w-1.5 h-3 rounded-sm ${color1}"></div>`;

    // Bar 2
    if (status === 'MED' || status === 'HIGH') {
        const color2 = status === 'MED' ? 'bg-yellow-500' : 'bg-red-500';
        bars += `<div class="w-1.5 h-4 rounded-sm ${color2}"></div>`;
    } else {
        bars += `<div class="w-1.5 h-4 rounded-sm bg-slate-700/50"></div>`;
    }

    // Bar 3
    if (status === 'HIGH') {
        bars += `<div class="w-1.5 h-5 rounded-sm bg-red-500"></div>`;
    } else {
        bars += `<div class="w-1.5 h-5 rounded-sm bg-slate-700/50"></div>`;
    }

    return `<div class="flex items-end gap-0.5" title="Crowd: ${status}">${bars}</div>`;
}

// Set Bus Filter (Called from Search/Main)
export function setBusFilter(filter) {
    if (Array.isArray(filter)) {
        // Normalize array: trim + lowercase
        currentBusFilter = filter.map(f => String(f).trim().toLowerCase());
    } else {
        // Normalize string
        currentBusFilter = String(filter).trim().toLowerCase();
    }
    console.log("BUS FILTER SET:", currentBusFilter);
    renderBusList();
}
