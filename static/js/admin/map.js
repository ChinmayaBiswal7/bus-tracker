export let map = null;
export let markers = {};
export let ALL_STOPS_CACHE = []; // Global Cache
export let ALL_BUSES_CACHE = {}; // Global Cache
const socket = io();

export function initMap() {
    // Center on Bhubaneswar
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([20.2961, 85.8245], 13);

    // L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    setupSocketListeners();

    // Fetch Stops Overlay
    fetchStops();

    // Request initial data (in case we missed the 'connect' event)
    socket.emit('get_buses');

    // Initialize Search
    setupSearchListeners();
}

// STOP MARKERS LOGIC
async function fetchStops() {
    try {
        console.log("[MAP] Fetching stops...");
        const res = await fetch('/api/admin/stops');
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

        const stops = await res.json();
        console.log(`[MAP] Received ${stops.length} stops.`);

        ALL_STOPS_CACHE = stops; // Populate Search Cache

        stops.forEach(stop => {
            // Robust defaults
            const waitingCount = parseInt(stop.waiting) || 0;
            const hasriders = waitingCount > 0;
            const size = hasriders ? 32 : 24;

            // Validate Coords
            if (!stop.lat || !stop.lng) return;

            const icon = L.divIcon({
                className: '',
                html: `
                <div class="group relative flex flex-col items-center justify-center -translate-y-full transform transition-all hover:scale-125 hover:z-50">
                    
                    ${hasriders ? `
                    <div class="absolute -top-3 -right-2 bg-red-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-lg z-20 border-2 border-slate-900 animate-bounce">
                        ${waitingCount}
                    </div>
                    ` : ''}

                    <div class="relative z-10">
                        <div class="w-8 h-8 ${hasriders ? 'bg-amber-500 text-amber-900' : 'bg-slate-700 text-slate-300'} rounded-lg shadow-xl flex items-center justify-center border-2 ${hasriders ? 'border-amber-300' : 'border-slate-500'}">
                            <span class="text-lg">🚏</span>
                        </div>
                        <div class="w-1 h-3 ${hasriders ? 'bg-amber-600' : 'bg-slate-600'} mx-auto"></div>
                    </div>
                    
                    <div class="w-4 h-1 bg-black/50 rounded-full blur-[1px]"></div>

                    <div class="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap border border-slate-700 pointer-events-none">
                        ${stop.name || 'Unknown Stop'}
                    </div>
                </div>
                `,
                iconSize: [size, size + 10],
                iconAnchor: [size / 2, size + 10]
            });

            L.marker([stop.lat, stop.lng], { icon: icon })
                .addTo(map)
                .bindPopup(`
                    <div class="p-2 min-w-[150px] text-center">
                        <div class="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2 text-2xl shadow-inner">
                            🚏
                        </div>
                        <h3 class="font-bold text-slate-800 text-sm mb-1">${stop.name}</h3>
                        ${hasriders ?
                        `<div class="bg-red-100 text-red-700 px-2 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1">
                            👥 ${waitingCount} Waiting
                         </div>` :
                        `<span class="text-xs text-slate-500 italic">No students waiting</span>`
                    }
                    </div>
                `);
        });

    } catch (e) {
        console.error("[MAP] Failed to fetch stops:", e);
    }
}

function setupSocketListeners() {
    console.log("[MAP] Setting up socket listeners...");

    socket.on('connect', () => {
        console.log("[SOCKET] Connected to server. ID:", socket.id);
    });

    socket.on('update_buses', (data) => {
        console.log("[SOCKET] Received bus update:", data);
        updateMarkers(data);
        updateBusList(data);
    });
}

function updateMarkers(data) {
    const activeIds = new Set();

    Object.entries(data).forEach(([busId, info]) => {
        if (info.offline) return; // Don't show inactive on map
        activeIds.add(busId);

        // Validate Coordinates
        if (!info.lat || !info.lng) {
            console.warn(`[MAP] Bus ${info.bus_no} has no coordinates. Skipping marker.`);
            if (markers[busId]) {
                map.removeLayer(markers[busId]);
                delete markers[busId];
            }
            return;
        }

        const lat = info.lat;
        const lng = info.lng;

        if (markers[busId]) {
            markers[busId].setLatLng([lat, lng]);
            // Update popup content if open?
        } else {
            // New Marker
            const icon = L.divIcon({
                className: '',
                html: `
                <div class="relative group">
                     <div class="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center border-4 border-slate-900 shadow-2xl transform transition-transform group-hover:scale-110">
                        <span class="text-2xl filter drop-shadow">🚌</span>
                     </div>
                     <div class="absolute -top-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-slate-900"></div>
                     <div class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700">
                        ${info.bus_no}
                     </div>
                </div>
                `,
                iconSize: [48, 48],
                iconAnchor: [24, 24]
            });

            markers[busId] = L.marker([lat, lng], { icon: icon })
                .addTo(map)
                .bindPopup(`
                    <div class="p-2 min-w-[140px]">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-slate-900 font-bold text-lg">Bus ${info.bus_no}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${getDensityClass(info.crowd)}">${info.crowd || 'LOW'}</span>
                        </div>
                        <div class="flex items-center gap-2 mb-1">
                            <span>👨‍✈️</span>
                            <span class="text-sm text-slate-600 font-semibold">${info.driver_name || 'Unknown'}</span>
                        </div>
                        <div class="flex items-center gap-2">
                             <span>🚀</span>
                            <span class="text-xs text-slate-500 font-mono">${Math.round(info.speed || 0)} km/h</span>
                        </div>
                    </div>
                `);
        }
    });

    // Update Global Cache for Search
    ALL_BUSES_CACHE = data;

    // Remove stale
    for (let id in markers) {
        if (!activeIds.has(id)) {
            map.removeLayer(markers[id]);
            delete markers[id];
        }
    }
}

// --- SEARCH & LOCATE LOGIC ---
let SEARCH_DEBOUNCE = null;

function setupSearchListeners() {
    console.log("[SEARCH] Initializing listeners...");
    const searchInput = document.getElementById('admin-search');
    const resultsContainer = document.getElementById('admin-search-results');

    if (!searchInput || !resultsContainer) {
        console.error("[SEARCH] Elements not found!");
        return;
    }

    // Search Input Handler
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toUpperCase();
        console.log(`[SEARCH] Input: "${query}"`);

        if (SEARCH_DEBOUNCE) clearTimeout(SEARCH_DEBOUNCE);

        SEARCH_DEBOUNCE = setTimeout(() => {
            if (query.length === 0) {
                resultsContainer.classList.add('hidden');
                resultsContainer.innerHTML = '';
            } else {
                performSearch(query, resultsContainer);
            }
        }, 50); // Fast debounce
    });

    // Close on Click Outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.classList.add('hidden');
        }
    });
}

function performSearch(query, container) {
    console.log(`[SEARCH] Performing search with Cache Size: ${ALL_STOPS_CACHE.length}`);
    const results = [];

    // 1. Search Buses (using Cache)
    Object.entries(ALL_BUSES_CACHE).forEach(([id, bus]) => {
        const busNo = String(bus.bus_no || '');
        if (busNo.toUpperCase().includes(query)) {
            results.push({
                type: 'BUS',
                id: id,
                label: `Bus ${busNo}`,
                sub: bus.offline ? 'Offline' : 'Active',
                icon: '🚌'
            });
        }
    });

    // 2. Search Stops (by Name)
    ALL_STOPS_CACHE.forEach(stop => {
        const sName = stop.name || '';
        if (sName.toUpperCase().includes(query)) {
            results.push({
                type: 'STOP',
                id: stop.lat + ',' + stop.lng,
                label: sName,
                sub: `${stop.waiting || 0} Waiting`,
                icon: '🚏'
            });
        }
    });

    // De-duplicate results (just in case)
    const uniqueResults = results.filter((v, i, a) => a.findIndex(t => (t.label === v.label && t.type === v.type)) === i);

    console.log(`[SEARCH] Found ${uniqueResults.length} results.`);
    renderSearchResults(uniqueResults, container);
}

function renderSearchResults(results, container) {
    container.innerHTML = '';

    if (results.length === 0) {
        container.innerHTML = `
                <div class="p-3 text-slate-500 text-xs text-center font-mono">NO DATA FOUND</div>
            `;
    } else {
        results.forEach(res => {
            const el = document.createElement('div');
            el.className = 'flex items-center gap-3 p-3 bg-slate-800/80 hover:bg-slate-700 cursor-pointer border-b border-white/5 transition-all group';
            el.innerHTML = `
                    <div class="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                        ${res.icon}
                    </div>
                    <div>
                        <div class="text-white text-sm font-bold tracking-wide">${res.label}</div>
                        <div class="text-xs ${res.sub.includes('Waiting') && !res.sub.startsWith('0') ? 'text-amber-400 font-bold' : 'text-slate-500'} uppercase font-mono tracking-wider">${res.sub}</div>
                    </div>
                `;
            el.onclick = () => {
                locateEntity(res.type, res.id);
                container.classList.add('hidden');
                document.getElementById('admin-search').value = '';

                // Close Sidebar on Mobile if open
                if (window.innerWidth < 768 && window.toggleSidebar) {
                    const sidebar = document.getElementById('admin-panel');
                    if (!sidebar.classList.contains('translate-x-full')) {
                        window.toggleSidebar();
                    }
                }
            };
            container.appendChild(el);
        });
    }

    container.classList.remove('hidden');
}

function locateEntity(type, id) {
    if (type === 'BUS') {
        // Find marker in markers object
        // NOTE: markers keys might be complex, typically keys are 'bus_no'
        const marker = markers[id];
        if (marker) {
            map.flyTo(marker.getLatLng(), 17, { duration: 1.5 });
            marker.openPopup();
        } else {
            // If strictly relying on sidebar click logic:
            const busItem = document.querySelector(`.bus-list-item[data-bus-no="${id}"]`);
            if (busItem) busItem.click();
        }
    } else if (type === 'STOP') {
        const [lat, lng] = id.split(',').map(Number);
        map.flyTo([lat, lng], 18, { duration: 1.5 });
    }
}



function getDensityClass(status) {
    if (status === 'HIGH') return 'bg-red-100 text-red-700';
    if (status === 'MED') return 'bg-yellow-100 text-yellow-700';
    return 'bg-emerald-100 text-emerald-700';
}

function updateBusList(data) {
    const list = document.getElementById('bus-list-mini');
    if (!list) return;

    list.innerHTML = '';

    const activeEntries = Object.entries(data).filter(([_, b]) => !b.offline);

    if (activeEntries.length === 0) {
        list.innerHTML = '<p class="text-xs text-slate-600 italic text-center">No active buses</p>';
        return;
    }

    activeEntries.forEach(([busId, bus]) => {
        const div = document.createElement('div');
        div.className = "flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-blue-500/50 hover:bg-slate-800 transition-all cursor-pointer group";

        // Handle Click
        div.onclick = () => {
            if (markers[busId]) {
                const m = markers[busId];
                map.flyTo(m.getLatLng(), 16);
                m.openPopup();
            } else {
                // Shake animation or alert
                alert(`Bus ${bus.bus_no} is active but has not sent GPS data yet.`);
            }
        };

        const crowdColor = bus.crowd === 'HIGH' ? 'bg-red-500' : (bus.crowd === 'MED' ? 'bg-yellow-500' : 'bg-emerald-500');

        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform">
                    🚌
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">Bus ${bus.bus_no}</span>
                    </div>
                    <div class="flex items-center gap-1 text-[10px] text-slate-400">
                        <span>👨‍✈️</span>
                        <span class="truncate max-w-[80px]">${bus.driver_name || 'Driver'}</span>
                    </div>
                </div>
            </div>
            
            <div class="flex flex-col items-end gap-1">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${crowdColor} text-slate-900 shadow-lg shadow-${crowdColor}/20">
                    ${bus.crowd || 'LOW'}
                </span>
                <div class="flex items-center gap-1">
                    ${(!bus.lat || !bus.lng) ? '<span class="text-[8px] text-yellow-500 font-bold tracking-wider">NO GPS</span>' : ''}
                    <span class="text-[10px] font-mono text-slate-500">${Math.round(bus.speed || 0)} km/h</span>
                </div>
            </div>
        `;
        list.appendChild(div);
    });
}
