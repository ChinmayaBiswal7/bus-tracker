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
            // Check if clicked on bus number badge
            const busBadge = e.target.closest('[data-bus-no]');
            if (busBadge) {
                e.preventDefault();
                e.stopPropagation();

                const busNo = parseInt(busBadge.dataset.busNo);
                const stopName = busBadge.dataset.stopName;

                console.log(`🚌 Locating Bus ${busNo} at ${stopName}`);
                this.locateBus(busNo, stopName);
                return;
            }

            // Check if clicked on stop name (to show stop location)
            const stopItem = e.target.closest('[data-stop-name]');
            if (stopItem && !stopItem.hasAttribute('data-bus-no')) {
                e.preventDefault();
                e.stopPropagation();

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

        if (trimmedQuery.length < 2) {
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

            const response = await fetch(`/api/search-stop?q=${encodeURIComponent(query)}&threshold=0.4`);
            const data = await response.json();

            console.log('📦 Response:', data);

            if (data.success && data.results.length > 0) {
                this.displayResults(data.results);
            } else {
                this.displayNoResults(query);
            }

        } catch (error) {
            console.error('❌ Search error:', error);
            this.displayError(error.message);
        }
    }

    displayResults(results) {
        console.log('✓ Displaying', results.length, 'results');

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

        // Build HTML with data attributes for click handling
        const html = results.map(result => `
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

        resultsContainer.innerHTML = html;
        resultsContainer.style.display = 'block';
    }

    displayNoResults(query) {
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
            <div class="p-6 text-center text-slate-400">
                <svg class="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p>No stops found for "<strong class="text-white">${query}</strong>"</p>
                <p class="text-sm mt-1">Try a different search term</p>
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
                window.startTrackingRouteByBusNo(String(busNo));
                this.showSuccessMessage(`Tracking Bus ${busNo}`);
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
