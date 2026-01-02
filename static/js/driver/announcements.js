import { db, collection, doc, setDoc, addDoc, serverTimestamp } from '../firebase-config.js';
import { showToast } from './ui.js';

export function initAnnouncements() {
    const btnDraft = document.getElementById('btnAiDraft');
    const draftInput = document.getElementById('draftInput');
    const finalInput = document.getElementById('finalInput');
    const btnSend = document.getElementById('btnAnnounce');

    if (btnDraft) {
        btnDraft.addEventListener('click', async () => {
            const t = draftInput.value; if (!t) return;
            btnDraft.innerHTML = '...';
            try {
                const r = await fetch('/api/driver/ai-assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t }) });
                const d = await r.json();
                if (d.response) {
                    finalInput.value = d.response;
                    draftInput.value = "";
                }
            } catch (e) {
                console.error(e);
            } finally {
                btnDraft.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>`;
            }
        });
    }

    if (btnSend) {
        btnSend.addEventListener('click', async () => {
            const msg = finalInput.value;
            if (!msg) return;

            // Check Live Status
            if (document.getElementById('serverStatus').textContent !== "LIVE BROADCAST") return showToast("Go Live First", 'error');

            const busNo = document.getElementById('busInput').value || "EV";

            try {
                const ref = doc(db, 'announcements', busNo);
                await setDoc(ref, { bus_no: busNo, latest_message: msg, last_updated: serverTimestamp() }, { merge: true });
                await addDoc(collection(ref, 'messages'), { message: msg, timestamp: serverTimestamp(), bus_no: busNo });
                finalInput.value = "";
                showToast("Announcement successfully sent");
            } catch (e) { console.error(e); }
        });
    }
}
