export function initChat() {
    const chatInput = document.getElementById('chatInput');
    const btnChat = document.getElementById('btnChatSend');

    if (btnChat) btnChat.addEventListener('click', sendChat);
    if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(); });
}

async function sendChat() {
    const chatInput = document.getElementById('chatInput');
    const chatHistory = document.getElementById('chat-history');

    const txt = chatInput.value.trim(); if (!txt) return;

    chatHistory.innerHTML += `<div class="chat-user chat-msg">${txt}</div>`;
    chatInput.value = "";
    chatHistory.scrollTop = chatHistory.scrollHeight;

    try {
        const res = await fetch('/api/driver/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: txt }) });
        const data = await res.json();
        chatHistory.innerHTML += `<div class="chat-ai chat-msg">${data.response || "Error"}</div>`;
    } catch (e) {
        chatHistory.innerHTML += `<div class="chat-ai chat-msg">Connection Error</div>`;
    }
    chatHistory.scrollTop = chatHistory.scrollHeight;
}
