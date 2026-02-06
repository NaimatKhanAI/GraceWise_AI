document.addEventListener('DOMContentLoaded', function () {
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const profileName = document.querySelector('.profile span');

    const API_BASE_URL = 'http://127.0.0.1:5000';
    let aiSessionId = null;
    let conversationHistory = []; // stores {role, content} for lesson context

    // --- Lesson mode detection from URL params ---
    const urlParams = new URLSearchParams(window.location.search);
    const lessonId = urlParams.get('lesson_id');
    const lessonName = urlParams.get('lesson_name') || 'Lesson';
    const lessonDesc = urlParams.get('lesson_desc') || '';
    const isLessonMode = !!lessonId;

    function getAccessToken() {
        return localStorage.getItem('access_token') || localStorage.getItem('accessToken') || auth?.accessToken;
    }

    // --- Show lesson context banner ---
    if (isLessonMode) {
        const lessonBanner = document.getElementById('lessonBanner');
        const lessonBannerName = document.getElementById('lessonBannerName');
        const lessonBannerDesc = document.getElementById('lessonBannerDesc');
        
        if (lessonBanner) {
            lessonBanner.style.display = 'flex';
            lessonBannerName.textContent = decodeURIComponent(lessonName);
            lessonBannerDesc.textContent = decodeURIComponent(lessonDesc) || 'Ask me anything about this lesson!';
        }

        // Replace the default greeting with lesson-specific one
        if (chatMessages) {
            chatMessages.innerHTML = '';
            appendMessage(
                `Hello! I'm your AI tutor for **${decodeURIComponent(lessonName)}**. I have the full lesson document loaded and ready to help you learn!\n\nYou can ask me to:\n- Explain concepts from the lesson\n- Summarize sections\n- Quiz you on the material\n- Clarify anything you don't understand\n\nWhat would you like to know?`,
                'ai'
            );
        }

        // Update page title
        document.title = `AI Tutor — ${decodeURIComponent(lessonName)} — Gracewise`;
    }

    // --- Back to curriculum button ---
    const backBtn = document.getElementById('backToCurriculum');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            window.location.href = 'curriculum.html';
        });
        backBtn.style.display = isLessonMode ? 'inline-flex' : 'none';
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

            if (!response.ok) return;
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
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            let url, body;

            if (isLessonMode) {
                // Lesson-specific RAG endpoint with conversation history
                url = `${API_BASE_URL}/rag/ask-lesson/${lessonId}`;
                body = JSON.stringify({ 
                    question: text,
                    history: conversationHistory
                });
            } else {
                // General AI assistant endpoint
                url = `${API_BASE_URL}/rag/ask`;
                body = JSON.stringify({ question: text });
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: body,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();
            const answer = data.answer || 'Sorry, I could not process your request.';

            // Update conversation history for lesson mode
            if (isLessonMode) {
                conversationHistory.push({ role: 'user', content: text });
                conversationHistory.push({ role: 'assistant', content: answer });
            }

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
