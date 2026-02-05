document.addEventListener('DOMContentLoaded', function () {
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const profileName = document.querySelector('.profile span');

    const API_BASE_URL = 'http://127.0.0.1:5000';
    let aiSessionId = null;

    function getAccessToken() {
        return localStorage.getItem('accessToken') || auth?.accessToken;
    }

    async function startAiSession() {
        try {
            const token = getAccessToken();
            if (!token) return;

            const response = await fetch(`${API_BASE_URL}/dashboard/student/ai-sessions/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                return;
            }

            const data = await response.json();
            aiSessionId = data.session_id || null;
        } catch (error) {
            console.error('AI session start error:', error);
        }
    }

    async function endAiSession() {
        try {
            const token = getAccessToken();
            if (!token || !aiSessionId) return;

            await fetch(`${API_BASE_URL}/dashboard/student/ai-sessions/${aiSessionId}/end`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                keepalive: true
            });
        } catch (error) {
            console.error('AI session end error:', error);
        }
    }

    const currentUser = localStorage.getItem('currentUser');
    if (currentUser && profileName) {
        try {
            const user = JSON.parse(currentUser);
            profileName.textContent = user.first_name || user.firstName || user.name || 'User';
        } catch (e) {
            profileName.textContent = 'User';
        }
    }

    startAiSession();

    function appendMessage(text, sender) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${sender === 'user' ? 'user-message' : 'bot-message'}`;

        if (sender === 'ai') {
            const avatar = document.createElement('div');
            avatar.className = 'message-avatar';
            avatar.innerHTML = '<i class="fas fa-robot"></i>';
            messageEl.appendChild(avatar);
        }

        const content = document.createElement('div');
        content.className = 'message-content';
        const p = document.createElement('p');
        p.innerHTML = marked.parse(text);
        content.appendChild(p);
        messageEl.appendChild(content);

        if (sender === 'user') {
            const avatar = document.createElement('div');
            avatar.className = 'message-avatar';
            avatar.innerHTML = '<i class="fas fa-user"></i>';
            messageEl.appendChild(avatar);
        }

        chatMessages.appendChild(messageEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageEl;
    }

    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        appendMessage(text, 'user');
        chatInput.value = '';
        chatInput.focus();

        const loadingEl = appendMessage('Thinking...', 'ai');
        sendBtn.disabled = true;

        try {
            const token = getAccessToken();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

            const response = await fetch(`${API_BASE_URL}/rag/ask`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ question: text }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();
            const answer = data.answer || 'Sorry, I could not process your request.';

            if (loadingEl) {
                const content = loadingEl.querySelector('p');
                if (content) content.innerHTML = marked.parse(answer);

            }
        } catch (error) {
            console.error('Chat error:', error);
            let errorMessage = 'Sorry, there was an error processing your request.';
            
            if (error.name === 'AbortError') {
                errorMessage = 'Request timed out. Please try again.';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Cannot connect to server. Please check if the backend is running.';
            }

            if (loadingEl) {
                const content = loadingEl.querySelector('p');
                if (content) content.textContent = errorMessage;
            }
        } finally {
            sendBtn.disabled = false;
        }
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (chatInput) {
        chatInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    window.addEventListener('pagehide', endAiSession);
    window.addEventListener('beforeunload', endAiSession);
});
