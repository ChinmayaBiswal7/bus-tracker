import { getActiveBuses } from './map.js';

/**
 * FIXED: Bus Stop Search with Working Click Handler & Clickable Bus Numbers
 * Adapted for 'trackInput' ID
 */

export class BusStopSearch {
    constructor(mapInstance) {
        this.map = mapInstance;
        this.markers = [];
        this.searchTimeout = null;
        this.init();
    }

    init() {
        console.log('🔍 Search initialized');
        this.attachSearchListener();
        this.attachResultsListener();
    }

    attachSearchListener() {
        // CHANGED: Adapted to our ID 'trackInput'
        const searchInput = document.getElementById('trackInput');

        // Find GO button (sibling or nearby button)
        // In our HTML, the button is next to input with onclick="setFilter()" originally.
        // We will try to find it.
        const searchButton = searchInput ? searchInput.parentElement.querySelector('button') : null;

        if (!searchInput) {
            console.error('❌ Search input (trackInput) not found');
            return;
        }

        console.log('✓ Search input found');

        // Handle input typing
        searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        // Handle Enter key
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleSearch(e.target.value);
            }
        });

        // Handle GO button click
        if (searchButton) {
            searchButton.addEventListener('click', (e) => {
                e.preventDefault();
                const query = searchInput.value;
                this.handleSearch(query);
            });
        }
    }

    attachResultsListener() {
        const sidebar = document.querySelector('.sidebar') || document.body;

        sidebar.addEventListener('click', (e) => {
            // Check if clicked using our new dedicated class for search results items
            // 1. Bus Result Item
            const busItem = e.target.closest('.bus-result-item');
            if (busItem) {
                e.preventDefault();
                const busNo = busItem.dataset.busNo;
                const stopName = "Search Result"; // Context
                console.log(`🚌 Clicking Bus Result: ${busNo}`);
                this.locateBus(busNo, stopName);
                return;
            }

            // 2. Existing Logic: Bus Number Badge inside Stop Item
            const busBadge = e.target.closest('[data-bus-no]');
            if (busBadge && !busBadge.classList.contains('bus-result-item')) {
                e.preventDefault();
                e.stopPropagation();

                const busNo = parseInt(busBadge.dataset.busNo);
                const stopName = busBadge.dataset.stopName;

                console.log(`🚌 Locating Bus ${busNo} at ${stopName}`);
                this.locateBus(busNo, stopName);
                return;
            }

            // 3. Stop Item
            const stopItem = e.target.closest('[data-stop-name]');
            if (stopItem && !stopItem.hasAttribute('data-bus-no')) {
                e.preventDefault();
                e.stopPropagation();

                // If it's a bus result masquerading as stop (unlikely with new logic), ignore
                if (stopItem.classList.contains('bus-result-item')) return;

                const stopName = stopItem.dataset.stopName;
                const lat = parseFloat(stopItem.dataset.lat);
                const lng = parseFloat(stopItem.dataset.lng);

                console.log('📍 Showing stop:', stopName);
                this.selectStop({ name: stopName, lat, lng });
            }
        });
    }

    handleSearch(query) {
        clearTimeout(this.searchTimeout);

        const trimmedQuery = query.trim();

        if (trimmedQuery.length < 1) { // Allow 1 char for bus numbers
            this.hideResults();
            return;
        }

        console.log('🔍 Searching:', trimmedQuery);

        this.searchTimeout = setTimeout(() => {
            this.performSearch(trimmedQuery);
        }, 300);
    }

    async performSearch(query) {
        try {
            console.log('📡 Fetching results...');
            const qLower = query.toLowerCase();

            // 1. Search Active Buses (Local)
            const busResults = [];
            const allBuses = getActiveBuses();

            console.log(`[Search] Active Buses available:`, Object.keys(allBuses || {}).length);

            if (allBuses) {
                Object.values(allBuses).forEach(info => {
                    // Robust check: Ensure bus_no exists
                    if (!info || !info.bus_no) return;

                    const bNo = String(info.bus_no).trim().toLowerCase();
                    // Match Exact or Partial (e.g. "6" matches "61", "61" matches "61")
                    if (bNo.includes(qLower)) {
                        busResults.push({
                            type: 'bus',
                            bus_no: info.bus_no,
                            status: info.offline ? 'Offline' : (info.crowd || 'Live'),
                            isOffline: info.offline
                        });
                    }
                });
            }

            // 2. Search Stops (API)
            let stopResults = [];
            // Only search API if query length >= 2 to save calls, unless it's a number
            if (query.length >= 2 || !isNaN(query)) {
                try {
                    const response = await fetch(`/api/search-stop?q=${encodeURIComponent(query)}&threshold=0.4`);
                    const data = await response.json();
                    if (data.success && data.results.length > 0) {
                        stopResults = data.results.map(r => ({ ...r, type: 'stop' }));
                    }
                } catch (e) {
                    console.warn("Stop search API failed", e);
                }
            }

            const finalResults = [...busResults, ...stopResults];

            console.log('📦 Combined Results:', finalResults);

            if (finalResults.length > 0) {
                this.displayResults(finalResults);

                // Also trigger sidebar filter visually
                if (window.setBusFilter) window.setBusFilter(query);

            } else {
                this.displayNoResults(query);
            }

        } catch (error) {
            console.error('❌ Search error:', error);
            this.displayError(error.message);
        }
    }

    displayResults(results) {
        console.log('✓ Rendering', results.length, 'results');

        // Find or create results container
        // Using our class .search-results-container
        let resultsContainer = document.querySelector('.search-results-container');

        if (!resultsContainer) {
            // Create new container after the search input
            const searchInput = document.getElementById('trackInput');
            if (searchInput) {
                const searchDiv = searchInput.parentElement;
                resultsContainer = document.createElement('div');
                resultsContainer.className = 'search-results-container';
                searchDiv.parentElement.insertBefore(resultsContainer, searchDiv.nextSibling);
            }
        }

        if (!resultsContainer) return;

        let html = '';

        // Render Buses First
        const buses = results.filter(r => r.type === 'bus');
        if (buses.length > 0) {
            html += `<div class="p-2 text-[10px] uppercase font-bold text-slate-500 bg-slate-900/50">Buses</div>`;
            html += buses.map(bus => `
                <div class="bus-result-item flex items-center justify-between p-3 border-b border-slate-700 hover:bg-slate-800 cursor-pointer transition-colors"
                     data-bus-no="${bus.bus_no}">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full ${bus.isOffline ? 'bg-slate-600' : 'bg-blue-600'} flex items-center justify-center text-white font-bold text-xs">
                            ${bus.bus_no}
                        </div>
                        <div>
                            <p class="font-bold text-white text-sm">Bus ${bus.bus_no}</p>
                            <p class="text-[10px] ${bus.isOffline ? 'text-slate-400' : 'text-green-400'}">
                                ${bus.status}
                            </p>
                        </div>
                    </div>
                    <button class="text-xs bg-slate-700 hover:bg-blue-600 px-3 py-1 rounded-lg text-white transition-colors">
                        Track
                    </button>
                </div>
             `).join('');
        }

        // Render Stops
        const stops = results.filter(r => r.type === 'stop');
        if (stops.length > 0) {
            html += `<div class="p-2 text-[10px] uppercase font-bold text-slate-500 bg-slate-900/50">Stops</div>`;
            html += stops.map(result => `
                <div class="stop-result-item p-3 border-b border-slate-700"
                     data-stop-name="${result.stop_name}"
                     data-lat="${result.lat}"
                     data-lng="${result.lng}">

                    <div class="mb-2">
                        <div class="font-medium text-white cursor-pointer hover:text-blue-400 transition-colors">
                            📍 ${result.stop_name}
                        </div>
                        <div class="text-xs text-slate-400 mt-1">
                            ${result.bus_count} bus${result.bus_count > 1 ? 'es' : ''} available
                        </div>
                    </div>

                    <!-- Clickable Bus Number Buttons -->
                    <div class="flex gap-2 flex-wrap">
                        ${result.buses.map(bus => `
                            <button class="bus-locate-btn px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-sm transition-all hover:scale-105 active:scale-95 shadow-md"
                                    data-bus-no="${bus}"
                                    data-stop-name="${result.stop_name}"
                                    title="Click to locate Bus ${bus} on map">
                                🚌 ${bus}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        }

        resultsContainer.innerHTML = html;
        resultsContainer.style.display = 'block';
    }

    displayNoResults(query) {
        let resultsContainer = document.querySelector('.search-results-container');
        const activeBusCount = Object.keys(getActiveBuses() || {}).length;

        if (!resultsContainer) {
            const searchInput = document.getElementById('trackInput');
            if (searchInput) {
                const searchDiv = searchInput.parentElement;
                resultsContainer = document.createElement('div');
                resultsContainer.className = 'search-results-container';
                searchDiv.parentElement.insertBefore(resultsContainer, searchDiv.nextSibling);
            }
        }

        if (!resultsContainer) return;

        resultsContainer.innerHTML = `
            <div class="p-6 text-center text-slate-400">
                <svg class="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p>No matches for "<strong class="text-white">${query}</strong>"</p>
                <p class="text-xs mt-2 text-slate-500">Scanned ${activeBusCount} active buses & stops.</p>
                <p class="text-[10px] text-slate-600 mt-1">Try "Hostel" or "Square"</p>
            </div>
        `;
        resultsContainer.style.display = 'block';
    }

    displayError(message) {
        let resultsContainer = document.querySelector('.search-results-container');

        if (!resultsContainer) {
            const searchInput = document.getElementById('trackInput');
            if (searchInput) {
                const searchDiv = searchInput.parentElement;
                resultsContainer = document.createElement('div');
                resultsContainer.className = 'search-results-container';
                searchDiv.parentElement.insertBefore(resultsContainer, searchDiv.nextSibling);
            }
        }

        if (!resultsContainer) return;

        resultsContainer.innerHTML = `
            <div class="p-4 text-center text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg m-2">
                <p>⚠️ Search failed</p>
                <p class="text-sm mt-1">${message}</p>
            </div>
        `;
        resultsContainer.style.display = 'block';
    }

    async locateBus(busNo, stopName) {
        try {
            console.log(`🔍 Looking for Bus ${busNo}...`);
            if (window.startTrackingRouteByBusNo) {
                const found = window.startTrackingRouteByBusNo(String(busNo));

                if (found) {
                    this.showSuccessMessage(`Tracking Bus ${busNo}`);
                } else {
                    // Bus is in Excel but not in our Tracking System (Offline/Unknown)
                    this.showBusOfflineMessage(busNo, stopName);
                }
            } else {
                console.warn("startTrackingRouteByBusNo function not found in window.");
                this.showBusOfflineMessage(busNo, stopName);
            }
        } catch (error) {
            console.error('❌ Locate error:', error);
            this.showBusOfflineMessage(busNo, stopName);
        }
    }

    showBusOfflineMessage(busNo, stopName) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-yellow-900/90 text-yellow-200 px-6 py-3 rounded-lg shadow-xl z-[9999] animate-bounce';
        notification.innerHTML = `
            <div class="flex items-center gap-3">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <div>
                    <strong>Bus ${busNo} is Offline</strong>
                    <div class="text-xs mt-1">Not currently tracking near ${stopName}</div>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transition = 'opacity 0.5s';
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }

    showSuccessMessage(message) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-900/90 text-green-200 px-6 py-3 rounded-lg shadow-xl z-[9999]';
        notification.innerHTML = `
            <div class="flex items-center gap-3">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                <strong>${message}</strong>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transition = 'opacity 0.5s';
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 500);
        }, 2000);
    }

    selectStop(stop) {
        console.log('📍 Navigating to STOP:', stop.name, stop.lat, stop.lng);

        if (!stop.lat || !stop.lng || isNaN(stop.lat) || isNaN(stop.lng)) {
            console.error("Invalid Stop Coordinates:", stop);
            alert(`Could not locate "${stop.name}" on the map. Coordinates missing.`);
            return;
        }

        try {
            this.clearMarkers();

            const markerIcon = L.divIcon({
                className: 'custom-stop-marker',
                html: `
                    <div style="
                        background: #ef4444; 
                        color: white; 
                        width: 40px; 
                        height: 40px; 
                        border-radius: 50%; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                        border: 3px solid white;
                        font-size: 20px;
                        font-weight: bold;
                    ">📍</div>
                `,
                iconSize: [40, 40],
                iconAnchor: [20, 40]
            });

            const marker = L.marker([stop.lat, stop.lng], {
                icon: markerIcon
            }).addTo(this.map);

            marker.bindPopup(`
                <div style="text-align: center; min-width: 150px;">
                    <strong style="font-size: 16px; display: block; margin-bottom: 8px;">${stop.name}</strong>
                </div>
            `).openPopup();

            this.markers.push(marker);

            this.map.flyTo([stop.lat, stop.lng], 16, {
                duration: 1.5,
                easeLinearity: 0.5
            });

            console.log('✓ Navigation successful');

        } catch (error) {
            console.error('❌ Navigation error:', error);
            // Don't alert general errors to avoid spamming user if map is busy
            console.warn("Failed to navigate. Map might be busy.");
        }
    }

    clearMarkers() {
        this.markers.forEach(marker => {
            try {
                this.map.removeLayer(marker);
            } catch (e) {
                console.warn('Could not remove marker:', e);
            }
        });
        this.markers = [];
    }

    hideResults() {
        const resultsContainer = document.querySelector('.search-results-container');
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
    }
}
