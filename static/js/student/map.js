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

    // User Icon (Student Sticker - Clean SVG)
    userIcon = L.divIcon({
        className: 'custom-user-icon',
        html: `
        <div class="relative w-12 h-12 flex items-center justify-center">
             <div class="absolute inset-0 bg-yellow-400 rounded-full opacity-40 animate-ping"></div>
             <!-- Black Circle Bg -->
             <div class="relative w-9 h-9 bg-black rounded-full shadow-md flex items-center justify-center border-2 border-black z-10">
                <!-- Neon Yellow -->
                <svg class="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                     <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
             </div>
        </div>`,
        iconSize: [48, 48],
        iconAnchor: [24, 24]
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

    // HTML Content
    let iconInnerHtml;

    if (isEV) {
        // EV ICON (Black Dot Style)
        iconInnerHtml = `
            <div class="relative w-12 h-12 flex items-center justify-center">
                <div class="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
                <!-- Black Bg -->
                <div class="relative w-9 h-9 bg-black rounded-full border-2 border-black shadow-lg flex items-center justify-center z-10">
                    <svg width="20" height="20" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M48,256 L464,256 C477.255,256 488,266.745 488,280 L488,360 L24,360 L24,280 C24,266.745 34.745,256 48,256 Z" fill="white"/>
                         <path d="M40,120 L472,120 L440,256 L72,256 L40,120 Z" fill="none" stroke="white" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
                         <path d="M250,290 L230,320 H250 L240,350 L270,310 H250 L260,290 Z" fill="#FACC15"/>
                    </svg>
                </div>
                <!-- Badge -->
                <div class="absolute -top-2 -right-2 bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-slate-700 shadow-sm z-20">
                    ${info.bus_no}
                </div>
            </div>
        `;
    } else {
        // BUS ICON (Black Dot Style)
        iconInnerHtml = `
            <div class="relative w-12 h-12 flex items-center justify-center">
                <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>
                <!-- Black Bg -->
                <div class="relative w-9 h-9 bg-black rounded-full border-2 border-black shadow-lg flex items-center justify-center z-10">
                    <svg width="20" height="20" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M32 112 H480 V368 H32 V112 Z" fill="white"/>
                        <rect x="32" y="240" width="448" height="32" fill="#3B82F6"/>
                    </svg>
                </div>
                <!-- Badge -->
                <div class="absolute -top-2 -right-2 bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-slate-700 shadow-sm z-20">
                    ${info.bus_no}
                </div>
            </div>
        `;
    }

    const icon = L.divIcon({ className: '', html: iconInnerHtml, iconSize: [48, 48], iconAnchor: [24, 24] });

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
    // Store Bus Data for Routing
    markers[busId].isOffline = isOffline;
    markers[busId].speed = info.speed || 0; // Store real GPS speed (km/h) 
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
export function startTrackingRoute(busId) {
    targetBusId = busId;
    const tripCard = document.getElementById('trip-info-card');
    if (tripCard) tripCard.classList.remove('hidden');
    updateRoute();

    // FORCE EMIT: Send immediate update to driver (don't wait for GPS movement)
    if (userLat && userLng && lastBusData[busId]) {
        const busNo = lastBusData[busId].bus_no;
        console.log("[STUDENT] Force emitting initial location -> Driver of Bus:", busNo);
        socket.emit('student_update', {
            bus_no: busNo,
            lat: userLat,
            lng: userLng
        });
    } else {
        console.warn("[STUDENT] Cannot force emit. Missing data:", { userLat, busData: !!lastBusData[busId] });
    }
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

                const distanceKm = summary.totalDistance / 1000;

                // --- REAL-TIME ETA CALCULATION ---
                // Formula: ETA = Distance / Current Bus Speed

                const currentSpeedKmph = markers[targetBusId]?.speed || 0;
                const MIN_RELIABLE_SPEED = 5; // km/h

                // Fallback Logic
                const FALLBACK_CITY_SPEED = 15; // km/h
                const FALLBACK_HIGHWAY_SPEED = 45; // km/h
                const HIGHWAY_DISTANCE_THRESHOLD = 20; // km

                let finalTimeMin;
                let statusMsg = "";

                if (currentSpeedKmph > MIN_RELIABLE_SPEED) {
                    // Scenario 1: Real GPS Speed (Best)
                    finalTimeMin = Math.ceil((distanceKm / currentSpeedKmph) * 60);
                } else {
                    // Scenario 2: Bus Stopped/Offline (Fallback)
                    if (distanceKm > HIGHWAY_DISTANCE_THRESHOLD) {
                        // Highway Trip
                        finalTimeMin = Math.ceil((distanceKm / FALLBACK_HIGHWAY_SPEED) * 60);
                        statusMsg = " (Highway Est.)";
                    } else {
                        // City Trip
                        finalTimeMin = Math.ceil((distanceKm / FALLBACK_CITY_SPEED) * 60);
                        // If speed is literally 0, explicitly say "Halted"
                        statusMsg = currentSpeedKmph <= 0 ? " (Halted)" : " (Heavy Traffic)";
                    }
                }

                // Buffer for stops
                finalTimeMin += 2;

                if (tripEta) tripEta.textContent = `${finalTimeMin} min${statusMsg}`;
                if (tripDist) tripDist.textContent = `(${distanceKm.toFixed(1)} km)`;
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
