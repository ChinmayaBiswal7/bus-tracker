
let currentTarget = 'student';

export function initAdminUI() {
    window.setTarget = setTarget;
    window.sendAnnouncement = sendAnnouncement;
}

function setTarget(target) {
    currentTarget = target;

    const btnStudent = document.getElementById('tab-student');
    const btnDriver = document.getElementById('tab-driver');

    if (target === 'student') {
        btnStudent.classList.replace('text-slate-400', 'text-white');
        btnStudent.classList.replace('hover:text-white', 'bg-blue-600');
        // Logic to reset classes simpler:
        btnStudent.className = "flex-1 py-2 text-xs font-bold rounded-md bg-blue-600 text-white shadow-sm transition-all";
        btnDriver.className = "flex-1 py-2 text-xs font-bold rounded-md text-slate-400 hover:text-white transition-all";
    } else {
        btnDriver.className = "flex-1 py-2 text-xs font-bold rounded-md bg-purple-600 text-white shadow-sm transition-all";
        btnStudent.className = "flex-1 py-2 text-xs font-bold rounded-md text-slate-400 hover:text-white transition-all";
    }
}

async function sendAnnouncement() {
    const txt = document.getElementById('announce-msg');
    const btn = document.getElementById('btn-send');

    if (!txt.value.trim()) return showToast("Enter a message", 'error');

    btn.disabled = true;
    btn.innerHTML = `<span>Sending...</span>`;

    try {
        const res = await fetch('/api/admin/announce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: txt.value.trim(),
                target: currentTarget
            })
        });

        const data = await res.json();

        if (res.ok) {
            showToast("Announcement Sent!");
            txt.value = '';
        } else {
            showToast("Error: " + data.error, 'error');
        }

    } catch (e) {
        console.error("[ANNOUNCEMENT ERROR]", e);
        showToast("Network Error: " + e.message, 'error');
    }

    btn.disabled = false;
    btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg><span>SEND BROADCAST</span>`;
}

// Custom Toast Logic
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');

    if (!toast || !toastMsg) return;

    toastMsg.textContent = msg;

    // Style based on type
    if (type === 'error') {
        toast.className = "fixed top-6 left-1/2 -translate-x-1/2 bg-red-900/90 text-white px-6 py-3 rounded-full shadow-2xl border border-red-500/50 flex items-center gap-3 transform translate-y-0 transition-all duration-500 z-50 pointer-events-none"; // red theme
        toast.querySelector('div').className = "w-2 h-2 rounded-full bg-red-500 animate-pulse";
    } else {
        toast.className = "fixed top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl border border-white/10 flex items-center gap-3 transform translate-y-0 transition-all duration-500 z-50 pointer-events-none"; // standard
        toast.querySelector('div').className = "w-2 h-2 rounded-full bg-green-500 animate-pulse";
    }

    // Show
    // (Classes already set to translate-y-0 above for show)

    // Hide after 3s
    setTimeout(() => {
        toast.classList.add('-translate-y-20', 'opacity-0');
        toast.classList.remove('translate-y-0');
    }, 3000);
}
