document.addEventListener('DOMContentLoaded', function () {
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const profileName = document.querySelector('.profile span');
    const chatHistoryList = document.getElementById('chatHistoryList');
    const newChatBtn = document.getElementById('newChatBtn');
    const editState = document.getElementById('editState');
    const cancelEditBtn = document.getElementById('cancelEditBtn');

    const API_BASE_URL = window.API_BASE_URL;

    let aiSessionId = null;
    let activeSession = null;
    let historySessions = [];
    let conversationHistory = [];
    let editingMessageId = null;
    const MAX_INPUT_HEIGHT = 180;

    const urlParams = new URLSearchParams(window.location.search);
    const lessonId = urlParams.get('lesson_id');
    const rawLessonName = urlParams.get('lesson_name') || 'Lesson';
    const rawLessonDesc = urlParams.get('lesson_desc') || '';
    const isLessonMode = !!lessonId;

    function decodeParam(value) {
        try {
            return decodeURIComponent(value);
        } catch (_) {
            return value;
        }
    }

    const lessonName = decodeParam(rawLessonName);
    const lessonDesc = decodeParam(rawLessonDesc);

    function getAccessToken() {
        return localStorage.getItem('access_token') || localStorage.getItem('accessToken') || auth?.accessToken;
    }

    function autoResizeInput() {
        if (!chatInput) return;
        chatInput.style.height = 'auto';
        const nextHeight = Math.min(chatInput.scrollHeight, MAX_INPUT_HEIGHT);
        chatInput.style.height = `${nextHeight}px`;
        chatInput.style.overflowY = chatInput.scrollHeight > MAX_INPUT_HEIGHT ? 'auto' : 'hidden';
    }

    function wrapTables(container) {
        const tables = container.querySelectorAll('table');
        tables.forEach((table) => {
            if (table.parentElement && table.parentElement.classList.contains('table-wrapper')) return;
            const wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        });
    }

    function clearEditState() {
        editingMessageId = null;
        if (editState) editState.style.display = 'none';
    }

    function setEditState(messageId, text) {
        editingMessageId = messageId;
        if (editState) editState.style.display = 'flex';
        if (chatInput) {
            chatInput.value = text;
            autoResizeInput();
            chatInput.focus();
            chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
        }
    }

    function appendMessage(text, sender, options = {}) {
        if (!chatMessages) return null;

        const normalizedSender = sender === 'assistant' ? 'ai' : sender;
        const messageEl = document.createElement('div');
        messageEl.className = `message ${normalizedSender === 'user' ? 'user-message' : 'bot-message'}`;

        if (options.messageId) {
            messageEl.dataset.messageId = String(options.messageId);
        }

        if (normalizedSender === 'ai') {
            const avatar = document.createElement('div');
            avatar.className = 'message-avatar';
            avatar.innerHTML = '<i class="fas fa-robot"></i>';
            messageEl.appendChild(avatar);
        }

        const content = document.createElement('div');
        content.className = 'message-content';
        content.innerHTML = marked.parse(text || '');
        wrapTables(content);

        if (normalizedSender === 'user' && options.allowEdit !== false && options.messageId) {
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'edit-message-btn';
            editBtn.innerHTML = '<i class="fas fa-pen"></i>';
            editBtn.setAttribute('aria-label', 'Edit message');
            editBtn.setAttribute('title', 'Edit message');
            editBtn.addEventListener('click', () => setEditState(options.messageId, text));
            content.appendChild(editBtn);
        }

        messageEl.appendChild(content);

        if (normalizedSender === 'user') {
            const avatar = document.createElement('div');
            avatar.className = 'message-avatar';
            avatar.innerHTML = '<i class="fas fa-user"></i>';
            messageEl.appendChild(avatar);
        }

        chatMessages.appendChild(messageEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageEl;
    }

    function renderDefaultConversation() {
        if (!chatMessages) return;
        chatMessages.innerHTML = '';

        if (isLessonMode) {
            appendMessage(
                `Hello! I'm your AI tutor for **${lessonName}**. I have the full lesson document loaded and ready to help you learn!\n\nYou can ask me to:\n- Explain concepts from the lesson\n- Summarize sections\n- Quiz you on the material\n- Clarify anything you don't understand\n\nWhat would you like to know?`,
                'ai',
                { allowEdit: false }
            );
            return;
        }

        appendMessage("Hello! I'm your AI learning assistant. How can I help you today?", 'ai', { allowEdit: false });
    }

    function setConversationFromMessages(messages) {
        conversationHistory = (messages || []).map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content || ''
        }));

        if (!chatMessages) return;
        chatMessages.innerHTML = '';

        if (!messages || messages.length === 0) {
            renderDefaultConversation();
            return;
        }

        messages.forEach((msg) => {
            appendMessage(msg.content || '', msg.role, {
                messageId: msg.id,
                allowEdit: msg.role === 'user'
            });
        });
    }

    function sessionMatchesCurrentMode(session) {
        const chatType = (session.chat_type || 'general').toLowerCase();

        if (isLessonMode) {
            return chatType === 'lesson' && String(session.lesson_id || '') === String(lessonId || '');
        }

        return chatType !== 'lesson';
    }

    function formatHistoryTime(isoDate) {
        if (!isoDate) return '';
        const date = new Date(isoDate);
        const now = new Date();
        const sameDay = date.toDateString() === now.toDateString();
        if (sameDay) {
            return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        }
        return date.toLocaleDateString();
    }

    function renderHistoryList() {
        if (!chatHistoryList) return;

        if (!historySessions.length) {
            chatHistoryList.innerHTML = '<div class="chat-history-empty">No previous chats</div>';
            return;
        }

        chatHistoryList.innerHTML = '';

        historySessions.forEach((session) => {
            const item = document.createElement('div');
            item.className = `chat-history-item ${session.id === aiSessionId ? 'active' : ''}`;

            const openBtn = document.createElement('button');
            openBtn.type = 'button';
            openBtn.className = 'chat-history-open';

            const title = document.createElement('p');
            title.className = 'chat-history-title';
            title.textContent = session.title || 'New chat';

            const meta = document.createElement('div');
            meta.className = 'chat-history-meta';
            meta.textContent = formatHistoryTime(session.updated_at || session.started_at);

            openBtn.appendChild(title);
            openBtn.appendChild(meta);
            openBtn.addEventListener('click', async () => {
                await openSession(session.id);
            });

            const actions = document.createElement('div');
            actions.className = 'chat-history-actions';

            const renameBtn = document.createElement('button');
            renameBtn.type = 'button';
            renameBtn.className = 'history-action-btn';
            renameBtn.title = 'Rename chat';
            renameBtn.innerHTML = '<i class="fas fa-pen"></i>';
            renameBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const currentTitle = session.title || 'New chat';
                const nextTitle = window.prompt('Enter new chat name:', currentTitle);
                if (nextTitle === null) return;
                const trimmed = nextTitle.trim();
                if (!trimmed || trimmed === currentTitle) return;
                await renameChatSession(session.id, trimmed);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'history-action-btn history-delete-btn';
            deleteBtn.title = 'Delete chat';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const confirmed = window.confirm('Delete this chat permanently?');
                if (!confirmed) return;
                await deleteChatSession(session.id);
            });

            actions.appendChild(renameBtn);
            actions.appendChild(deleteBtn);

            item.appendChild(openBtn);
            item.appendChild(actions);
            chatHistoryList.appendChild(item);
        });
    }

    async function fetchHistorySessions() {
        const token = getAccessToken();
        if (!token) {
            historySessions = [];
            renderHistoryList();
            return [];
        }

        try {
            const response = await fetch(`${API_BASE_URL}/dashboard/student/ai-sessions?limit=80`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Session list error: ${response.status}`);
            }

            const data = await response.json();
            historySessions = (data.sessions || []).filter(sessionMatchesCurrentMode);
            renderHistoryList();
            return historySessions;
        } catch (error) {
            console.error('Error loading chat sessions:', error);
            historySessions = [];
            renderHistoryList();
            return [];
        }
    }

    async function renameChatSession(sessionId, title) {
        const token = getAccessToken();
        if (!token) return;

        try {
            const response = await fetch(`${API_BASE_URL}/dashboard/student/ai-sessions/${sessionId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title })
            });

            if (!response.ok) {
                throw new Error(`Rename session error: ${response.status}`);
            }

            if (activeSession && activeSession.id === sessionId) {
                activeSession.title = title;
            }

            await fetchHistorySessions();
        } catch (error) {
            console.error('Error renaming session:', error);
            if (typeof showError === 'function') showError('Unable to rename chat');
        }
    }

    async function deleteChatSession(sessionId) {
        const token = getAccessToken();
        if (!token) return;

        try {
            const deletingActive = sessionId === aiSessionId;
            const response = await fetch(`${API_BASE_URL}/dashboard/student/ai-sessions/${sessionId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Delete session error: ${response.status}`);
            }

            const sessions = await fetchHistorySessions();

            if (deletingActive) {
                clearEditState();
                if (sessions.length > 0) {
                    await openSession(sessions[0].id);
                } else {
                    await createNewSession();
                }
            }
        } catch (error) {
            console.error('Error deleting session:', error);
            if (typeof showError === 'function') showError('Unable to delete chat');
        }
    }

    async function loadSessionMessages(sessionId) {
        const token = getAccessToken();
        if (!token) return null;

        const response = await fetch(`${API_BASE_URL}/dashboard/student/ai-sessions/${sessionId}/messages`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Session messages error: ${response.status}`);
        }

        return await response.json();
    }

    async function refreshCurrentSessionMessages() {
        if (!aiSessionId) return false;

        try {
            const data = await loadSessionMessages(aiSessionId);
            activeSession = data?.session || activeSession;
            setConversationFromMessages(data?.messages || []);
            return true;
        } catch (error) {
            console.error('Error refreshing session messages:', error);
            return false;
        }
    }

    async function openSession(sessionId) {
        if (!sessionId) return;

        try {
            aiSessionId = sessionId;
            clearEditState();
            const data = await loadSessionMessages(sessionId);
            activeSession = data?.session || null;
            setConversationFromMessages(data?.messages || []);
            renderHistoryList();
        } catch (error) {
            console.error('Error opening session:', error);
        }
    }

    async function startAiSession() {
        const token = getAccessToken();
        if (!token) return null;

        const payload = {
            chat_type: isLessonMode ? 'lesson' : 'general',
            lesson_id: isLessonMode ? Number(lessonId) : null,
            lesson_name: isLessonMode ? lessonName : null,
            lesson_desc: isLessonMode ? lessonDesc : null
        };

        const response = await fetch(`${API_BASE_URL}/dashboard/student/ai-sessions/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Session start error: ${response.status}`);
        }

        return await response.json();
    }

    async function createNewSession() {
        try {
            const data = await startAiSession();
            aiSessionId = data?.session_id || null;
            activeSession = data?.session || null;
            conversationHistory = [];
            clearEditState();
            renderDefaultConversation();
            await fetchHistorySessions();
        } catch (error) {
            console.error('AI session start error:', error);
            aiSessionId = null;
            activeSession = null;
            conversationHistory = [];
            renderDefaultConversation();
        }
    }

    async function endAiSession(sessionId = aiSessionId) {
        try {
            const token = getAccessToken();
            if (!token || !sessionId) return;

            await fetch(`${API_BASE_URL}/dashboard/student/ai-sessions/${sessionId}/end`, {
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

    async function initializeSessions() {
        const token = getAccessToken();
        if (!token) {
            aiSessionId = null;
            historySessions = [];
            renderHistoryList();
            renderDefaultConversation();
            return;
        }

        const sessions = await fetchHistorySessions();
        if (sessions.length > 0) {
            await openSession(sessions[0].id);
            return;
        }

        await createNewSession();
    }

    async function sendMessage() {
        const text = (chatInput?.value || '').trim();
        if (!text) return;

        if (!aiSessionId) {
            await createNewSession();
            if (!aiSessionId) {
                return;
            }
        }

        const userPreview = appendMessage(text, 'user', { allowEdit: false });
        const loadingEl = appendMessage('Thinking...', 'ai', { allowEdit: false });

        chatInput.value = '';
        autoResizeInput();
        chatInput.focus();
        sendBtn.disabled = true;

        try {
            const token = getAccessToken();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            const payload = {
                question: text,
                session_id: aiSessionId,
                history: conversationHistory
            };

            if (editingMessageId) {
                payload.edit_message_id = editingMessageId;
            }

            const url = isLessonMode
                ? `${API_BASE_URL}/rag/ask-lesson/${lessonId}`
                : `${API_BASE_URL}/rag/ask`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();
            const answer = data.answer || 'Sorry, I could not process your request.';

            const refreshed = await refreshCurrentSessionMessages();
            if (!refreshed) {
                conversationHistory.push({ role: 'user', content: text });
                conversationHistory.push({ role: 'assistant', content: answer });
                if (loadingEl) {
                    const content = loadingEl.querySelector('.message-content');
                    if (content) {
                        content.innerHTML = marked.parse(answer);
                        wrapTables(content);
                    }
                }
            }

            clearEditState();
            await fetchHistorySessions();

            if (refreshed && userPreview) {
                userPreview.remove();
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
                const content = loadingEl.querySelector('.message-content');
                if (content) content.textContent = errorMessage;
            }
        } finally {
            sendBtn.disabled = false;
        }
    }

    // Lesson context banner
    if (isLessonMode) {
        const lessonBanner = document.getElementById('lessonBanner');
        const lessonBannerName = document.getElementById('lessonBannerName');
        const lessonBannerDesc = document.getElementById('lessonBannerDesc');

        if (lessonBanner) {
            lessonBanner.style.display = 'flex';
            lessonBannerName.textContent = lessonName;
            lessonBannerDesc.textContent = lessonDesc || 'Ask me anything about this lesson!';
        }

        document.title = `AI Tutor - ${lessonName} - Gracewise`;
    }

    const backBtn = document.getElementById('backToCurriculum');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            window.location.href = 'curriculum.html';
        });
        backBtn.style.display = isLessonMode ? 'inline-flex' : 'none';
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

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (newChatBtn) {
        newChatBtn.addEventListener('click', async () => {
            await createNewSession();
        });
    }

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', clearEditState);
    }

    if (chatInput) {
        autoResizeInput();
        chatInput.addEventListener('input', autoResizeInput);
        chatInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // Notification functions
    async function fetchNotifications() {
        try {
            const token = getAccessToken();
            if (!token) return;

            const response = await fetch(`${API_BASE_URL}/dashboard/student/notifications`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('Failed to fetch notifications:', response.statusText);
                return;
            }

            const data = await response.json();
            displayNotifications(data.notifications);
            updateNotificationBadge(data.unread_count);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }

    function displayNotifications(notifications) {
        const notificationList = document.getElementById('notificationList');

        if (!notificationList) return;

        if (!notifications || notifications.length === 0) {
            notificationList.innerHTML = '<div class="no-notifications">No notifications yet</div>';
            return;
        }

        notificationList.innerHTML = notifications.map(notif => `
            <div class="notification-item ${!notif.is_read ? 'unread' : ''}" onclick="markNotificationRead(${notif.id})">
                <div class="notification-item-content">
                    <div class="notification-item-icon ${notif.notification_type === 'document_upload' ? 'document' : 'quiz'}">
                        <i class="fas ${notif.notification_type === 'document_upload' ? 'fa-file-pdf' : 'fa-question-circle'}"></i>
                    </div>
                    <div class="notification-item-text" style="flex: 1;">
                        <h4>${notif.title}</h4>
                        <p>${notif.message}</p>
                        <span class="notification-item-time">${formatNotificationTime(notif.created_at)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function updateNotificationBadge(count) {
        const badge = document.getElementById('notificationBadge');
        if (!badge) return;

        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    async function markNotificationRead(notificationId) {
        try {
            const token = getAccessToken();
            if (!token) return;

            const response = await fetch(`${API_BASE_URL}/dashboard/student/notifications/${notificationId}/mark-read`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                fetchNotifications();
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    window.markAllNotificationsRead = async function() {
        try {
            const token = getAccessToken();
            if (!token) return;

            const response = await fetch(`${API_BASE_URL}/dashboard/student/notifications/mark-all-read`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                fetchNotifications();
                if (typeof showSuccess === 'function') {
                    showSuccess('All notifications marked as read');
                }
            }
        } catch (error) {
            console.error('Error marking all notifications:', error);
        }
    };

    window.markNotificationRead = markNotificationRead;

    function formatNotificationTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

        return date.toLocaleDateString();
    }

    function initNotificationDropdown() {
        const notificationBell = document.getElementById('notificationBell');
        const notificationDropdown = document.getElementById('notificationDropdown');

        if (notificationBell && notificationDropdown) {
            notificationBell.addEventListener('click', function(e) {
                e.stopPropagation();
                notificationDropdown.classList.toggle('active');
            });

            document.addEventListener('click', function(e) {
                if (!notificationBell.contains(e.target) && !notificationDropdown.contains(e.target)) {
                    notificationDropdown.classList.remove('active');
                }
            });
        }
    }

    window.openProfileModal = function() {
        const user = auth?.getCurrentUser();
        if (user) {
            const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User';
            const nameDisplay = document.getElementById('userNameDisplay');
            const emailDisplay = document.getElementById('userEmailDisplay');
            const fullNameDisplay = document.getElementById('userFullNameDisplay');

            if (nameDisplay) nameDisplay.textContent = fullName;
            if (emailDisplay) emailDisplay.value = user.email || '';
            if (fullNameDisplay) fullNameDisplay.value = fullName;
        }

        const profileModal = document.getElementById('profileModal');
        if (profileModal) profileModal.classList.add('active');
    };

    window.closeProfileModal = function() {
        const profileModal = document.getElementById('profileModal');
        if (profileModal) profileModal.classList.remove('active');
    };

    window.openChangePasswordModal = function() {
        const changePasswordModal = document.getElementById('changePasswordModal');
        if (changePasswordModal) changePasswordModal.classList.add('active');
    };

    window.closeChangePasswordModal = function() {
        const changePasswordModal = document.getElementById('changePasswordModal');
        if (changePasswordModal) changePasswordModal.classList.remove('active');
        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) passwordForm.reset();
    };

    window.handleChangePassword = async function(event) {
        event.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            if (typeof showError === 'function') showError('Passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            if (typeof showError === 'function') showError('Password must be at least 6 characters long');
            return;
        }

        try {
            const token = getAccessToken();
            const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });

            const data = await response.json();
            if (response.ok) {
                if (typeof showSuccess === 'function') showSuccess('Password changed successfully');
                window.closeChangePasswordModal();
            } else {
                if (typeof showError === 'function') showError(data.message || 'Failed to change password');
            }
        } catch (error) {
            if (typeof showError === 'function') showError('Error changing password');
        }
    };

    initNotificationDropdown();
    fetchNotifications();
    setInterval(fetchNotifications, 30000);

    const avatarBtn = document.getElementById('avatarBtn');
    if (avatarBtn) {
        avatarBtn.addEventListener('click', window.openProfileModal);
    }

    const profileModal = document.getElementById('profileModal');
    if (profileModal) {
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) window.closeProfileModal();
        });
    }

    const changePasswordModal = document.getElementById('changePasswordModal');
    if (changePasswordModal) {
        changePasswordModal.addEventListener('click', (e) => {
            if (e.target === changePasswordModal) window.closeChangePasswordModal();
        });
    }

    initializeSessions();

    window.addEventListener('pagehide', () => endAiSession());
    window.addEventListener('beforeunload', () => endAiSession());
});
