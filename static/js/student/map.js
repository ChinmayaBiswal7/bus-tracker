import { updateServerStatus, updateGpsStatus } from './ui.js';

let map;
let userMarker = null;
let userIcon = null;
let routingControl = null;
let routeLine = null;
let targetBusId = null;
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

    // User Icon
    userIcon = L.divIcon({
        className: 'custom-user-icon',
        html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg pulse-ring"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
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

export function setBusFilter(filter) {
    currentBusFilter = filter.toLowerCase();
    renderBusList();
}

function renderBusList() {
    const data = lastBusData;
    const busList = document.getElementById('bus-list');
    if (!busList) return;

    busList.innerHTML = '';

    // Filter Logic
    const filteredEntries = Object.entries(data).filter(([busId]) =>
        busId.toLowerCase().includes(currentBusFilter)
    );

    // Update Counts (Optional: Update 'Tracking: All' text if needed, but keeping it simple)
    const statusEl = document.getElementById('tracking-status');
    const countSpan = document.getElementById('fw-bold');
    if (countSpan) countSpan.textContent = filteredEntries.length > 0 ? filteredEntries.length : "0";
    if (statusEl) statusEl.classList.remove('hidden');

    if (filteredEntries.length === 0) {
        busList.innerHTML = '<p class="text-xs text-slate-500 text-center py-4 italic">No matching buses found.</p>';
        return;
    }

    filteredEntries.forEach(([busId, info]) => {
        const item = document.createElement('div');
        item.className = "group flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-blue-500 cursor-pointer transition-all";
        item.onclick = () => {
            map.flyTo([info.lat, info.lng], 16);
            startTrackingRoute(busId);
        };
        item.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">${info.bus_no}</div>
            <div>
               <p class="text-slate-200 font-bold text-sm">Bus ${info.bus_no}</p>
               <p class="text-[10px] text-slate-400 flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full ${info.offline ? 'bg-slate-500' : 'bg-green-500'}"></span>
                  ${info.offline ? 'Offline' : 'Live'}
               </p>
            </div>
        </div>
        <button onclick="event.stopPropagation(); map.flyTo([${info.lat}, ${info.lng}], 16); startTrackingRoute('${busId}');"
            class="hidden group-hover:block px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-lg transition-all">
            LOCATE
        </button>
        `;
        busList.appendChild(item);
    });
}

function updateBusMarker(busId, info) {
    const isOffline = info.offline || false;
    const isEV = (info.bus_no || '').toLowerCase().includes('ev') || (info.bus_no || '').toLowerCase().includes('shuttle');

    // Colors
    let borderColor = 'border-blue-600';
    let iconColor = 'text-blue-600';

    if (isOffline) {
        borderColor = 'border-slate-500';
        iconColor = 'text-slate-500';
    } else if (isEV) {
        borderColor = 'border-green-500';
        iconColor = 'text-green-500';
    }

    const iconHtml = `
        <div class="relative w-10 h-10">
            <!-- Bus Icon (SVG) -->
            <div class="absolute inset-0 bg-white rounded-full shadow-md flex items-center justify-center border-2 ${borderColor}">
                 <svg class="w-6 h-6 ${iconColor}" fill="currentColor" viewBox="0 0 512 512">
                    <path d="M256 0C161.896 0 85.333 76.563 85.333 170.667v128c0 47.146 38.188 85.333 85.334 85.333H341.333c47.146 0 85.333-38.188 85.333-85.333v-128C426.666 76.563 350.104 0 256 0zM128 170.667c0-70.688 57.313-128 128-128s128 57.313 128 128v42.666H128V170.667zm256 128c0 23.584-19.083 42.666-42.667 42.666H170.667c-23.584 0-42.667-19.082-42.667-42.666V256h256v42.667zM149.333 320c11.792 0 21.334 9.542 21.334 21.333s-9.542 21.333-21.334 21.333S128 353.125 128 341.333 137.542 320 149.333 320zm213.334 0c11.791 0 21.333 9.542 21.333 21.333s-9.542 21.333-21.333 21.333S341.333 353.125 341.333 341.333 350.875 320 362.667 320z"/>
                    <path d="M106.666 426.667v21.333C106.666 459.792 116.208 469.333 128 469.333h42.667c11.791 0 21.333-9.541 21.333-21.333v-21.333h128v21.333c0 11.792 9.542 21.333 21.333 21.333H384c11.792 0 21.334-9.541 21.334-21.333v-21.333c23.583 0 42.666-19.084 42.666-42.667h-42.666v21.333H106.666V405.333H64c0 23.583 19.084 42.667 42.666 42.667v-21.333z"/>
                </svg>
            </div>
            <!-- Badge -->
            <div class="absolute -top-1 -right-2 bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-slate-700 shadow-sm z-10">
                ${info.bus_no}
            </div>
             ${!isOffline ? '<div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/20 blur-sm rounded-full"></div>' : ''}
        </div>
    `;
    const icon = L.divIcon({ className: '', html: iconHtml, iconSize: [40, 40], iconAnchor: [20, 20] });

    if (markers[busId]) {
        markers[busId].setLatLng([info.lat, info.lng]).setIcon(icon);
    } else {
        markers[busId] = L.marker([info.lat, info.lng], { icon: icon }).addTo(map)
            .bindPopup(`<b class="text-slate-900">Bus ${info.bus_no}</b><br><span class="text-xs text-slate-500">${new Date().toLocaleTimeString()}</span>`)
            .on('click', () => {
                map.flyTo([info.lat, info.lng], 16);
                startTrackingRoute(busId);
            });
    }
    markers[busId].isOffline = isOffline;
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
            if (targetBusId) updateRoute();

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
export function startTrackingRoute(busId) {
    targetBusId = busId;
    const tripCard = document.getElementById('trip-info-card');
    if (tripCard) tripCard.classList.remove('hidden');
    updateRoute();
}

export function stopTrackingRoute() {
    targetBusId = null;
    const tripCard = document.getElementById('trip-info-card');
    if (tripCard) tripCard.classList.add('hidden');

    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }
    if (fallbackLine) {
        map.removeLayer(fallbackLine);
        fallbackLine = null;
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

    if (routingControl) {
        if (routingTimer) clearTimeout(routingTimer);
        startRoutingTimer(busLatLng);
        routingControl.setWaypoints(waypoints);
    } else {
        startRoutingTimer(busLatLng);
        try {
            routingControl = L.Routing.control({
                waypoints: waypoints,
                router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1', profile: 'driving', timeout: 5000 }),
                lineOptions: { styles: [{ color: '#3b82f6', opacity: 0.8, weight: 6 }] },
                createMarker: function () { return null; },
                addWaypoints: false, draggableWaypoints: false, fitSelectedRoutes: false, show: false
            }).addTo(map);

            routingControl.on('routesfound', function (e) {
                if (fallbackLine) { map.removeLayer(fallbackLine); fallbackLine = null; }
                if (routingTimer) clearTimeout(routingTimer);
                const summary = e.routes[0].summary;
                if (tripEta) tripEta.textContent = `${Math.ceil(summary.totalTime / 60)} min`;
                if (tripDist) tripDist.textContent = `(${(summary.totalDistance / 1000).toFixed(1)} km)`;
            });

            routingControl.on('routingerror', () => {
                console.warn("Routing failed.");
            });
        } catch (e) { console.error("Routing Init Error", e); }
    }
}

function runFallbackRouting(busLatLng, etaEl, distEl) {
    const dist = map.distance([userLat, userLng], busLatLng);
    const distKm = (dist / 1000).toFixed(1);
    const timeMins = Math.ceil((distKm / 30) * 60);

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
