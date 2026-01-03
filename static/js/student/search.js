/**
 * FIXED: Bus Stop Search with Working Click Handler
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
        // Listen for clicks on the results sidebar or body (delegation)
        const sidebar = document.querySelector('.sidebar') || document.body;

        sidebar.addEventListener('click', (e) => {
            // Find if clicked element is a stop result
            const stopItem = e.target.closest('[data-stop-name]');

            if (stopItem) {
                e.preventDefault();
                e.stopPropagation();

                const stopName = stopItem.dataset.stopName;
                const lat = parseFloat(stopItem.dataset.lat);
                const lng = parseFloat(stopItem.dataset.lng);

                console.log('📍 Clicked stop:', stopName);

                // Navigate to stop
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
            <div class="stop-result-item p-3 hover:bg-blue-900/30 cursor-pointer border-b border-slate-700 transition-colors"
                 data-stop-name="${result.stop_name}"
                 data-lat="${result.lat}"
                 data-lng="${result.lng}">
                
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <div class="font-medium text-white">${result.stop_name}</div>
                        <div class="flex items-center gap-2 mt-1 text-sm">
                            <span class="text-slate-300">${result.bus_count} bus${result.bus_count > 1 ? 'es' : ''}</span>
                            <div class="flex gap-1 flex-wrap">
                                ${result.buses.map(bus => `
                                    <span class="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs font-medium border border-blue-500/30">
                                        ${bus}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    <svg class="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
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

    selectStop(stop) {
        console.log('📍 Navigating to:', stop.name);

        try {
            // Clear previous markers
            this.clearMarkers();

            // Create custom marker
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

            // Add marker
            const marker = L.marker([stop.lat, stop.lng], {
                icon: markerIcon
            }).addTo(this.map);

            // Add popup
            marker.bindPopup(`
                <div style="text-align: center; min-width: 150px;">
                    <strong style="font-size: 16px; display: block; margin-bottom: 8px;">${stop.name}</strong>
                </div>
            `).openPopup();

            this.markers.push(marker);

            // Fly to location
            this.map.flyTo([stop.lat, stop.lng], 16, {
                duration: 1.5,
                easeLinearity: 0.5
            });

            console.log('✓ Navigation successful');

        } catch (error) {
            console.error('❌ Navigation error:', error);
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
