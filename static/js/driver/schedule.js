
export function initSchedule() {
    const schedDate = document.getElementById('sched-date');
    if (schedDate) {
        const now = new Date();
        const localDate = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0');
        schedDate.value = localDate;
    }
    addTimeSlot(); // Add one default slot
}

export function addTimeSlot() {
    const schedList = document.getElementById('sched-list');
    if (!schedList) return;

    const div = document.createElement('div');
    div.className = "flex gap-2 items-center animate-[fadeIn_0.3s_ease-out] w-full";
    div.innerHTML = `
        <input type="time" class="sched-time bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm focus:border-blue-500 outline-none w-24 flex-shrink-0">
        <input type="text" placeholder="Route / Gate" class="sched-note bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm focus:border-blue-500 outline-none flex-1 min-w-0">
        <button class="p-2 text-red-400 hover:bg-slate-800 rounded-lg flex-shrink-0 btn-remove-slot" title="Remove">
            <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
    `;

    // Add event listener for remove button safely
    const btnRemove = div.querySelector('.btn-remove-slot');
    btnRemove.addEventListener('click', () => div.remove());

    schedList.appendChild(div);
}

export async function saveSchedule() {
    const schedDate = document.getElementById('sched-date');
    const schedBus = document.getElementById('sched-bus');
    const date = schedDate.value;
    const busNo = schedBus.value.trim().toUpperCase();

    if (!date || !busNo) return alert("Please set Date and Bus Number");

    // Collect Data
    const timings = [];
    const timeInputs = document.querySelectorAll('.sched-time');
    const noteInputs = document.querySelectorAll('.sched-note');

    timeInputs.forEach((inp, i) => {
        if (inp.value) {
            timings.push({
                time: inp.value,
                note: noteInputs[i].value || "Regular Route"
            });
        }
    });

    if (timings.length === 0) return alert("Add at least one timing");

    const btn = document.getElementById('btn-save-sched');
    if (btn) btn.textContent = "Publishing...";

    try {
        // Updated: Send to Backend API
        const response = await fetch('/api/schedule/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bus_no: busNo,
                date: date,
                timings: timings
            })
        });

        const result = await response.json();

        if (response.ok) {
            alert("Schedule Published! 📅");
        } else {
            throw new Error(result.message || "Unknown error");
        }

    } catch (e) {
        console.error(e);
        alert("Error saving: " + e.message);
    } finally {
        if (btn) btn.textContent = "PUBLISH SCHEDULE";
    }
}
