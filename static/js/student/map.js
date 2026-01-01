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
        item.className = "flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-blue-500 cursor-pointer transition-all";
        item.onclick = () => {
            map.flyTo([info.lat, info.lng], 16);
            startTrackingRoute(busId);
        };
        item.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">${busId}</div>
            <div>
               <p class="text-slate-200 font-bold text-sm">Bus ${busId}</p>
               <p class="text-[10px] text-slate-400 flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full ${info.offline ? 'bg-slate-500' : 'bg-green-500'}"></span>
                  ${info.offline ? 'Offline' : 'Live'}
               </p>
            </div>
        </div>
        `;
        busList.appendChild(item);
    });
}

function updateBusMarker(busId, info) {
    const isOffline = info.offline || false;
    const iconHtml = `
        <div class="relative">
            <div class="w-8 h-8 rounded-full ${isOffline ? 'bg-slate-600' : 'bg-blue-600'} flex items-center justify-center border-2 border-slate-900 shadow-xl transform transition-transform hover:scale-110">
                <span class="text-[10px] font-bold text-white">${busId}</span>
            </div>
             ${!isOffline ? '<div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse shadow-lg"></div>' : ''}
        </div>
    `;
    const icon = L.divIcon({ className: '', html: iconHtml, iconSize: [32, 32], iconAnchor: [16, 16] });

    if (markers[busId]) {
        markers[busId].setLatLng([info.lat, info.lng]).setIcon(icon);
    } else {
        markers[busId] = L.marker([info.lat, info.lng], { icon: icon }).addTo(map)
            .bindPopup(`<b class="text-slate-900">Bus ${busId}</b><br><span class="text-xs text-slate-500">${new Date().toLocaleTimeString()}</span>`)
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
