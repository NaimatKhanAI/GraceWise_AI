// Curriculum Page JavaScript

// Use shared API_BASE_URL if available, otherwise define it
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'http://127.0.0.1:5000';
}
const API_BASE_URL = window.API_BASE_URL;
let allCurriculum = [];
let currentLessonId = null;

// Get access token from localStorage
function getAccessToken() {
    return localStorage.getItem('access_token');
}

document.addEventListener('DOMContentLoaded', function() {
    // Set current date
    const currentDateElement = document.getElementById('current-date');
    if (currentDateElement) {
        const today = new Date();
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        };
        currentDateElement.textContent = today.toLocaleDateString('en-US', options);
    }

    // Load curriculum from backend
    loadCurriculum();

    // Search functionality
    const searchInput = document.querySelector('.search-bar input');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterCurriculum(this.value.toLowerCase());
        });
    }

    // Initialize notifications
    initNotificationDropdown();
    fetchNotifications();
    setInterval(fetchNotifications, 30000);
    
    // Avatar button click
    const avatarBtn = document.getElementById('avatarBtn');
    if (avatarBtn) {
        avatarBtn.addEventListener('click', openProfileModal);
    }
    
    // Profile modal outside click
    const profileModal = document.getElementById('profileModal');
    if (profileModal) {
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) closeProfileModal();
        });
    }
    
    // Change password modal outside click
    const changePasswordModal = document.getElementById('changePasswordModal');
    if (changePasswordModal) {
        changePasswordModal.addEventListener('click', (e) => {
            if (e.target === changePasswordModal) closeChangePasswordModal();
        });
    }
});

// Load curriculum from API
async function loadCurriculum() {
    const curriculumList = document.getElementById('curriculumList');
    const token = getAccessToken();

    if (!token) {
        curriculumList.innerHTML = '<div class="error-message">Please log in to view curriculum.</div>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/curriculum/?include_modules=true`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load curriculum');
        }

        const data = await response.json();
        allCurriculum = Array.isArray(data) ? data : (data.curriculum || []);
        renderCurriculum(allCurriculum);
    } catch (error) {
        console.error('Error loading curriculum:', error);
        curriculumList.innerHTML = '<div class="error-message">Failed to load curriculum. Please try again.</div>';
        Toast.error('Failed to load curriculum');
    }
}

// Render curriculum with modules and lessons
function renderCurriculum(curriculumData) {
    const curriculumList = document.getElementById('curriculumList');
    
    if (!curriculumData || curriculumData.length === 0) {
        curriculumList.innerHTML = '<div class="empty-state">No curriculum available yet.</div>';
        return;
    }

    let html = '';
    curriculumData.forEach(curriculum => {
        const modules = curriculum.modules || [];
        const totalLessons = modules.reduce((sum, m) => sum + (m.lesson_count || 0), 0);

        html += `
            <div class="curriculum-card" data-curriculum-id="${curriculum.id}">
                <div class="curriculum-header" onclick="toggleCurriculum(${curriculum.id})">
                    <div class="curriculum-icon">
                        <i class="fas fa-book"></i>
                    </div>
                    <div class="curriculum-info">
                        <h3>${escapeHtml(curriculum.title)}</h3>
                        <p>${escapeHtml(curriculum.description || '')}</p>
                        <div class="curriculum-meta">
                            <span><i class="fas fa-layer-group"></i> ${modules.length} modules</span>
                            <span><i class="fas fa-file-alt"></i> ${totalLessons} lessons</span>
                        </div>
                    </div>
                    <button class="curriculum-toggle" onclick="event.stopPropagation(); toggleCurriculum(${curriculum.id})">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
                <div class="curriculum-body" id="curriculum-body-${curriculum.id}" style="display: none;">
                    <div class="modules-container">
                        ${renderModules(modules)}
                    </div>
                </div>
            </div>
        `;
    });

    curriculumList.innerHTML = html;
}

// Render modules with lessons
function renderModules(modules) {
    if (!modules || modules.length === 0) {
        return '<div class="empty-state">No modules available.</div>';
    }

    let html = '';
    modules.forEach((module, index) => {
        const lessons = module.lessons || [];
        const moduleKey = module.id ? `module-${module.id}` : `module-index-${index}`;

        html += `
            <div class="module-card">
                <div class="module-header" onclick="toggleModule('${moduleKey}')">
                    <div class="module-header-main">
                        <div class="module-icon">
                            <i class="fas fa-folder-open"></i>
                        </div>
                        <div class="module-info">
                            <h4>${escapeHtml(module.name)}</h4>
                            <p>${escapeHtml(module.description || '')}</p>
                        </div>
                    </div>
                    <button class="module-toggle" onclick="event.stopPropagation(); toggleModule('${moduleKey}')">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
                <div class="lessons-list" id="module-body-${moduleKey}" style="display: none;">
                    ${renderLessons(lessons)}
                </div>
            </div>
        `;
    });

    return html;
}

// Render lessons with AI buttons
function renderLessons(lessons) {
    if (!lessons || lessons.length === 0) {
        return '<div class="empty-lessons">No lessons available yet.</div>';
    }

    let html = '';
    lessons.forEach(lesson => {
        const fileIcon = lesson.file_type === 'pdf' ? 'fa-file-pdf' : 'fa-file-alt';
        const fileSize = formatFileSize(lesson.file_size);
        const safeName = escapeHtml(lesson.name).replace(/'/g, '&apos;');
        const safeDesc = escapeHtml(lesson.description || '').replace(/'/g, '&apos;');

        html += `
            <div class="lesson-item">
                <div class="lesson-icon">
                    <i class="fas ${fileIcon}"></i>
                </div>
                <div class="lesson-info">
                    <h5>${escapeHtml(lesson.name)}</h5>
                    <div class="lesson-meta">
                        <span>${lesson.file_type.toUpperCase()}</span>
                        <span>${fileSize}</span>
                    </div>
                </div>
                <button class="ai-lesson-btn" onclick="openLessonAiTutor(${lesson.id}, '${safeName}', '${safeDesc}')" title="Chat with AI about this lesson">
                    <i class="fas fa-robot"></i>
                    <span>AI Tutor</span>
                </button>
            </div>
        `;
    });

    return html;
}

// Toggle curriculum expand/collapse
function toggleCurriculum(curriculumId) {
    const body = document.getElementById(`curriculum-body-${curriculumId}`);
    const card = body.closest('.curriculum-card');
    const toggle = card.querySelector('.curriculum-toggle i');

    if (body.style.display === 'none') {
        body.style.display = 'block';
        toggle.classList.remove('fa-chevron-down');
        toggle.classList.add('fa-chevron-up');
    } else {
        body.style.display = 'none';
        toggle.classList.remove('fa-chevron-up');
        toggle.classList.add('fa-chevron-down');
    }
}

// Toggle module expand/collapse
function toggleModule(moduleKey) {
    const body = document.getElementById(`module-body-${moduleKey}`);
    if (!body) return;

    const card = body.closest('.module-card');
    const toggle = card ? card.querySelector('.module-toggle i') : null;

    if (body.style.display === 'none') {
        body.style.display = 'flex';
        if (toggle) {
            toggle.classList.remove('fa-chevron-down');
            toggle.classList.add('fa-chevron-up');
        }
    } else {
        body.style.display = 'none';
        if (toggle) {
            toggle.classList.remove('fa-chevron-up');
            toggle.classList.add('fa-chevron-down');
        }
    }
}

// Redirect to AI Assistant page with lesson context
function openLessonAiTutor(lessonId, lessonName, lessonDescription) {
    const params = new URLSearchParams({
        lesson_id: lessonId,
        lesson_name: lessonName,
        lesson_desc: lessonDescription || ''
    });
    window.location.href = `ai-assistant.html?${params.toString()}`;
}

// Filter curriculum based on search term
function filterCurriculum(searchTerm) {
    if (!searchTerm) {
        renderCurriculum(allCurriculum);
        return;
    }

    const filtered = allCurriculum.map(curriculum => {
        const matchesCurriculum = curriculum.name.toLowerCase().includes(searchTerm) ||
                                   (curriculum.description || '').toLowerCase().includes(searchTerm);

        const filteredModules = (curriculum.modules || []).map(module => {
            const matchesModule = module.name.toLowerCase().includes(searchTerm) ||
                                  (module.description || '').toLowerCase().includes(searchTerm);

            const filteredLessons = (module.lessons || []).filter(lesson =>
                lesson.name.toLowerCase().includes(searchTerm) ||
                (lesson.description || '').toLowerCase().includes(searchTerm)
            );

            if (matchesModule || filteredLessons.length > 0) {
                return { ...module, lessons: filteredLessons.length > 0 ? filteredLessons : module.lessons };
            }
            return null;
        }).filter(m => m !== null);

        if (matchesCurriculum || filteredModules.length > 0) {
            return { ...curriculum, modules: filteredModules };
        }
        return null;
    }).filter(c => c !== null);

    renderCurriculum(filtered);
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper function to decode HTML entities
function decodeHtml(html) {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
}

// Helper function to format file size
function formatFileSize(bytes) {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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

async function markAllNotificationsRead() {
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
}

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

function openProfileModal() {
    const user = auth?.getCurrentUser();
    if (user) {
        document.getElementById('userNameDisplay').textContent = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User';
        document.getElementById('userEmailDisplay').value = user.email || '';
        document.getElementById('userFullNameDisplay').value = [user.first_name, user.last_name].filter(Boolean).join(' ') || '';
    }
    document.getElementById('profileModal').classList.add('active');
}

function closeProfileModal() {
    document.getElementById('profileModal').classList.remove('active');
}

function openChangePasswordModal() {
    document.getElementById('changePasswordModal').classList.add('active');
}

function closeChangePasswordModal() {
    document.getElementById('changePasswordModal').classList.remove('active');
    document.getElementById('passwordForm').reset();
}

async function handleChangePassword(event) {
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
            closeChangePasswordModal();
        } else {
            if (typeof showError === 'function') showError(data.message || 'Failed to change password');
        }
    } catch (error) {
        if (typeof showError === 'function') showError('Error changing password');
    }
}