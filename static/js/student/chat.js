
export function initChat() {
    const chatInput = document.getElementById('student-chat-input');
    const sendBtn = document.getElementById('student-chat-send');

    if (sendBtn) {
        sendBtn.addEventListener('click', sendStudentChat);
    }
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendStudentChat();
        });
    }
}

export function toggleChat() {
    const overlay = document.getElementById('chat-overlay');
    if (overlay) {
        if (overlay.classList.contains('hidden')) {
            overlay.classList.remove('hidden');
            // Focus input
            setTimeout(() => {
                const input = document.getElementById('student-chat-input');
                if (input) input.focus();
            }, 300);
        } else {
            overlay.classList.add('hidden');
        }
    }
}

async function sendStudentChat() {
    const input = document.getElementById('student-chat-input');
    const history = document.getElementById('student-chat-history');
    if (!input || !history) return;

    const text = input.value.trim();
    if (!text) return;

    // User Message
    history.innerHTML += `
        <div class="flex flex-col items-end mb-3">
            <div class="bg-blue-600 text-white px-4 py-2 rounded-2xl rounded-tr-none max-w-[80%] text-sm shadow-md">
                ${text}
            </div>
        </div>
    `;

    input.value = "";
    history.scrollTop = history.scrollHeight;

    // Loading State
    const loadingId = "loading-" + Date.now();
    history.innerHTML += `
        <div id="${loadingId}" class="flex flex-col items-start mb-3">
             <div class="bg-slate-700 text-slate-300 px-4 py-3 rounded-2xl rounded-tl-none max-w-[80%] text-sm shadow-md flex gap-1">
                <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></span>
                <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
            </div>
        </div>
    `;
    history.scrollTop = history.scrollHeight;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });

        const data = await response.json();

        // Remove loading
        const loader = document.getElementById(loadingId);
        if (loader) loader.remove();

        // AI Response
        history.innerHTML += `
             <div class="flex flex-col items-start mb-3">
                <div class="flex items-center gap-2 mb-1 pl-1">
                    <div class="w-4 h-4 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center text-[8px] text-white font-bold">AI</div>
                    <span class="text-[10px] text-slate-400 font-bold">Assistant</span>
                </div>
                <div class="bg-slate-800 border border-slate-700 text-slate-200 px-4 py-2 rounded-2xl rounded-tl-none max-w-[85%] text-sm shadow-md leading-relaxed">
                    ${data.response || "I didn't quite catch that."}
                </div>
            </div>
        `;

    } catch (e) {
        console.error(e);
        const loader = document.getElementById(loadingId);
        if (loader) loader.remove();

        history.innerHTML += `
            <div class="flex flex-col items-start mb-3">
                 <div class="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-2 rounded-2xl rounded-tl-none max-w-[80%] text-sm">
                    ⚠️ Connection Error. Please try again.
                </div>
            </div>
        `;
    }

    history.scrollTop = history.scrollHeight;
}
