/**
 * Stop Search Module (Adapted for Existing UI)
 */
export class StopSearchUI {
    constructor(mapInstance) {
        this.map = mapInstance;
        this.input = document.getElementById('trackInput'); // Existing Search Bar
        this.resultsDiv = document.getElementById('search-suggestions') || this.createResultsDiv();
        this.markers = [];
        this.init();
    }

    createResultsDiv() {
        const div = document.createElement('div');
        div.id = 'search-suggestions';
        // Fixed positioning relative to viewport/body
        div.className = "fixed bg-slate-900 border-2 border-slate-600 rounded-xl shadow-2xl max-h-60 overflow-y-auto hidden z-[9999]";
        document.body.appendChild(div);
        return div;
    }

    updateDropdownPosition() {
        if (!this.input || !this.resultsDiv) return;
        const rect = this.input.getBoundingClientRect();
        this.resultsDiv.style.top = `${rect.bottom + 8}px`;
        this.resultsDiv.style.left = `${rect.left}px`;
        this.resultsDiv.style.width = `${rect.width}px`;
    }

    init() {
        if (!this.input) {
            console.warn("Search Input not found!");
            return;
        }

        // Attach Debounced Listener
        let searchTimeout;
        this.input.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();

            if (query.length < 2) {
                this.hideResults();
                return;
            }

            searchTimeout = setTimeout(() => {
                this.performSearch(query);
            }, 300);
        });

        // Hide on outside click
        document.addEventListener('click', (e) => {
            if (!this.input.contains(e.target) && !this.resultsDiv.contains(e.target)) {
                this.hideResults();
            }
        });

        // Update position on scroll/resize
        window.addEventListener('resize', () => this.updateDropdownPosition());
        window.addEventListener('scroll', () => this.updateDropdownPosition(), true); // true for capture (sidebar scroll)
    }

    async performSearch(query) {
        try {
            console.log(`[Search] Querying: ${query}`);
            const response = await fetch(`/api/search-stop?q=${encodeURIComponent(query)}&threshold=0.4`);
            const data = await response.json();

            if (data.success && data.results.length > 0) {
                this.displayResults(data.results);
                // Hide Legacy List to prevent "No buses found" confusion
                const busList = document.getElementById('bus-list');
                if (busList) busList.classList.add('hidden');
            } else {
                this.displayNoResults(query);
            }
        } catch (error) {
            console.error('[Search] Failed:', error);
        }
    }

    displayResults(results) {
        this.updateDropdownPosition(); // Recalculate position
        this.resultsDiv.innerHTML = '';
        this.resultsDiv.classList.remove('hidden');

        results.forEach(result => {
            const item = document.createElement('div');
            item.className = "p-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700 last:border-b-0 transition-colors";

            // Generate Bus Badges
            const busesHtml = result.buses.map(bus => `
                <span class="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-bold">
                    ${bus}
                </span>
            `).join('');

            item.innerHTML = `
                <div class="flex items-start justify-between">
                    <div>
                        <h3 class="font-bold text-slate-200 text-sm">${result.stop_name}</h3>
                        <div class="flex items-center gap-2 mt-1 flex-wrap">
                            ${busesHtml}
                        </div>
                    </div>
                    <svg class="w-4 h-4 text-slate-500 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                </div>
            `;

            item.onclick = () => {
                this.onStopSelected(result);
            };

            this.resultsDiv.appendChild(item);
        });
    }

    displayNoResults(query) {
        this.resultsDiv.innerHTML = `
            <div class="p-4 text-center text-slate-500 text-xs italic">
                No stops found for "${query}"
            </div>
        `;
        this.resultsDiv.classList.remove('hidden');
    }

    hideResults() {
        this.resultsDiv.classList.add('hidden');
        const busList = document.getElementById('bus-list');
        if (busList) busList.classList.remove('hidden');
    }

    onStopSelected(stop) {
        // 1. Clear previous markers
        this.clearMarkers();

        // 2. Add Stop Marker
        const marker = L.marker([stop.lat, stop.lng], {
            icon: L.divIcon({
                className: 'custom-stop-marker',
                html: `
                    <div class="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg animate-pulse"></div>
                `,
                iconSize: [16, 16]
            })
        }).addTo(this.map);

        marker.bindPopup(`<strong class="text-slate-800">${stop.stop_name}</strong>`).openPopup();
        this.markers.push(marker);

        // 3. Fly to Stop
        this.map.setView([stop.lat, stop.lng], 16);

        // 4. Update Input & Close Dropdown
        this.input.value = stop.stop_name;
        this.hideResults();

        // 5. Fetch Real-time Status of Buses at this Stop
        this.fetchStopStatus(stop.stop_name);
    }

    async fetchStopStatus(stopName) {
        // Trigger generic filter update if needed or just show a toast
        try {
            const res = await fetch(`/api/stop-status/${encodeURIComponent(stopName)}`);
            const data = await res.json();
            if (data.success) {
                console.log("Live Bus Status at Stop:", data.buses);
                // Optionally: Highlight these buses on the map or filter the list
                // For now, we just let the map be the visual guide.
            }
        } catch (e) { console.error(e); }
    }

    clearMarkers() {
        this.markers.forEach(m => this.map.removeLayer(m));
        this.markers = [];
    }
}
