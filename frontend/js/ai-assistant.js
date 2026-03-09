document.addEventListener('DOMContentLoaded', function () {
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const profileName = document.querySelector('.profile span');

    const API_BASE_URL = window.API_BASE_URL;

    let aiSessionId = null;
    let conversationHistory = []; // stores {role, content} for lesson context
    const MAX_INPUT_HEIGHT = 180;

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
            if (table.parentElement && table.parentElement.classList.contains('table-wrapper')) {
                return;
            }
            const wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        });
    }

    function loadMessageForEditing(text) {
        if (!chatInput) return;
        chatInput.value = text;
        autoResizeInput();
        chatInput.focus();
        chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
    }

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
        content.innerHTML = marked.parse(text);
        wrapTables(content);

        if (sender === 'user') {
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'edit-message-btn';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => loadMessageForEditing(text));
            content.appendChild(editBtn);
        }

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
        autoResizeInput();
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
                const content = loadingEl.querySelector('.message-content');
                if (content) {
                    content.innerHTML = marked.parse(answer);
                    wrapTables(content);
                }
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

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
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
            document.getElementById('userNameDisplay').textContent = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User';
            document.getElementById('userEmailDisplay').value = user.email || '';
            document.getElementById('userFullNameDisplay').value = [user.first_name, user.last_name].filter(Boolean).join(' ') || '';
        }
        document.getElementById('profileModal').classList.add('active');
    };

    window.closeProfileModal = function() {
        document.getElementById('profileModal').classList.remove('active');
    };

    window.openChangePasswordModal = function() {
        document.getElementById('changePasswordModal').classList.add('active');
    };

    window.closeChangePasswordModal = function() {
        document.getElementById('changePasswordModal').classList.remove('active');
        document.getElementById('passwordForm').reset();
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

    // Initialize notifications
    initNotificationDropdown();
    fetchNotifications();
    setInterval(fetchNotifications, 30000);

   // Avatar button click
    const avatarBtn = document.getElementById('avatarBtn');
    if (avatarBtn) {
        avatarBtn.addEventListener('click', window.openProfileModal);
    }

    // Profile modal outside click
    const profileModal = document.getElementById('profileModal');
    if (profileModal) {
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) window.closeProfileModal();
        });
    }

    // Change password modal outside click
    const changePasswordModal = document.getElementById('changePasswordModal');
    if (changePasswordModal) {
        changePasswordModal.addEventListener('click', (e) => {
            if (e.target === changePasswordModal) window.closeChangePasswordModal();
        });
    }

    window.addEventListener('pagehide', endAiSession);
    window.addEventListener('beforeunload', endAiSession);
});
