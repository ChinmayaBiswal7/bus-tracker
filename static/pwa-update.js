// PWA Auto-Update & Registration Logic

function showUpdateToast(registration) {
    // 1. Only show toast if in "App" mode (Standalone)
    // The user requested this behavior to avoid annoying website visitors.
    const isApp = window.matchMedia('(display-mode: standalone)').matches;
    if (!isApp) {
        console.log("Update available, but suppressed on website view.");
        return;
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-slate-800 border border-slate-700 text-white p-4 rounded-2xl shadow-2xl flex flex-col gap-3 z-50 transform translate-y-20 transition-transform duration-300';
    toast.innerHTML = `
        <div class="flex items-start gap-3">
            <div class="p-2 bg-blue-600/20 rounded-full text-blue-400">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            </div>
            <div>
                <h3 class="font-bold text-lg">Update Available</h3>
                <p class="text-slate-400 text-sm">A new version of Campus Ride is available.</p>
            </div>
        </div>
        <div class="flex gap-2 w-full">
            <button id="pwa-update-btn" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl transition-colors">
                UPDATE NOW
            </button>
            <button id="pwa-dismiss-btn" class="px-4 text-slate-400 hover:text-white font-bold transition-colors">
                LATER
            </button>
        </div>
    `;

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.style.transform = 'translateY(0)';
    });

    // Handlers
    const btnUpdate = document.getElementById('pwa-update-btn');
    btnUpdate.addEventListener('click', () => {
        if (registration.waiting) {
            btnUpdate.textContent = "UPDATING...";
            btnUpdate.disabled = true;
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
    });

    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
        toast.style.transform = 'translateY(150%)';
        setTimeout(() => toast.remove(), 300);
    });
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW Registered:', registration.scope);

                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('New update available');
                            showUpdateToast(registration);
                        }
                    });
                });

                // If already waiting (updated while closed)
                if (registration.waiting) {
                    console.log('Waiting worker found');
                    showUpdateToast(registration);
                }
            })
            .catch(err => {
                console.log('SW Registration Failed:', err);
            });

        // Reload when new SW takes control
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                console.log('Controller changed, reloading...');
                window.location.reload();
                refreshing = true;
            }
        });
    });
}
