// Dashboard JavaScript

// Use shared API_BASE_URL if available, otherwise define it
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:5000`;
}
const API_BASE_URL = window.API_BASE_URL;
let currentToolAccess = null;

// Fetch student dashboard stats
async function fetchStudentStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/student/stats`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch stats:', response.statusText);
            return;
        }

        const data = await response.json();
        updateStatsDisplay(data);
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

// Update stats display
function updateStatsDisplay(stats) {
    const elements = {
        'totalQuizzesAttempted': stats.total_quiz_attempts || 0,
        'totalHoursSpent': stats.total_hours_spent || 0,
        'studentRanking': stats.ranking || 1,
        'totalStudents': stats.total_students_ranked || 0,
        'averageScore': Math.round(stats.average_score || 0) + '%',
        'totalQuizzesValue': stats.total_quiz_attempts || 0,
        'avgScoreValue': Math.round(stats.average_score || 0) + '%',
        'totalHoursValue': (stats.total_hours_spent || 0) + ' hours',
        'rankingValue': stats.ranking || 1,
        'totalStudentsValue': stats.total_students_ranked || 0
    };
    
    // Update elements only if they exist in the DOM
    for (const [elementId, value] of Object.entries(elements)) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = value;
        }
    }
}

// Fetch notifications
async function fetchNotifications() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/student/notifications`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch notifications:', response.statusText);
            const alertEl = document.getElementById('dashboardAlertsSummary');
            if (alertEl) alertEl.textContent = 'Could not load alerts. Try again from the bell icon.';
            return;
        }

        const data = await response.json();
        displayNotifications(data.notifications);
        updateNotificationBadge(data.unread_count);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        const alertEl = document.getElementById('dashboardAlertsSummary');
        if (alertEl) alertEl.textContent = 'Could not load alerts. Try again from the bell icon.';
    }
}

async function fetchToolAccess() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/student/tool-access`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch tool access:', response.statusText);
            return;
        }

        const data = await response.json();
        currentToolAccess = data.tool_access || null;
        applyToolAccess();
    } catch (error) {
        console.error('Error fetching tool access:', error);
    }
}

function applyToolAccess() {
    if (!currentToolAccess) return;

    document.querySelectorAll('[data-tool-key]').forEach((card) => {
        const key = card.getAttribute('data-tool-key');
        const allowed = !!currentToolAccess[key];
        const link = card.querySelector('a');

        card.classList.remove('tool-locked');
        if (link) {
            link.classList.remove('disabled-link');
            link.removeAttribute('aria-disabled');
        }

        let lockBadge = card.querySelector('.lock-badge');
        if (lockBadge) lockBadge.remove();

        if (allowed) return;

        card.classList.add('tool-locked');
        if (link) {
            link.classList.add('disabled-link');
            link.setAttribute('aria-disabled', 'true');
            link.addEventListener('click', function (e) {
                e.preventDefault();
                if (typeof showWarning === 'function') {
                    showWarning('Upgrade your subscription to unlock this tool.');
                }
            });
        }

        lockBadge = document.createElement('div');
        lockBadge.className = 'lock-badge';
        lockBadge.textContent = 'Upgrade required';
        card.appendChild(lockBadge);
    });
}

function updateDashboardAlertsSummary(notifications, unreadCount) {
    const el = document.getElementById('dashboardAlertsSummary');
    if (!el) return;
    if (!notifications || notifications.length === 0) {
        el.textContent = 'No alerts right now. You are all caught up.';
        return;
    }
    const unread =
        typeof unreadCount === 'number'
            ? unreadCount
            : notifications.filter(function (n) {
                  return !n.is_read;
              }).length;
    const preview = notifications
        .slice(0, 2)
        .map(function (n) {
            return n.title || n.message || 'Update';
        })
        .join(' · ');
    el.textContent =
        unread > 0
            ? unread + ' unread. Latest: ' + preview + '.'
            : 'All caught up. Latest: ' + preview + '.';
}

// Display notifications
function displayNotifications(notifications) {
    const notificationList = document.getElementById('notificationList');
    
    // Exit if element doesn't exist (e.g., not on dashboard page)
    if (!notificationList) {
        return;
    }
    
    if (!notifications || notifications.length === 0) {
        notificationList.innerHTML = '<div class="no-notifications">No notifications yet</div>';
        updateDashboardAlertsSummary([], 0);
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
                    <span class="notification-item-time">${formatTime(notif.created_at)}</span>
                </div>
            </div>
        </div>
    `).join('');

    const unread = notifications.filter(function (n) {
        return !n.is_read;
    }).length;
    updateDashboardAlertsSummary(notifications, unread);
}

// Update notification badge
function updateNotificationBadge(count) {
    const badge = document.getElementById('notificationBadge');
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// Mark notification as read
async function markNotificationRead(notificationId) {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/student/notifications/${notificationId}/mark-read`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
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

// Mark all notifications as read
async function markAllNotificationsRead() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/student/notifications/mark-all-read`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            fetchNotifications();
            showSuccess('All notifications marked as read');
        }
    } catch (error) {
        console.error('Error marking all notifications:', error);
    }
}

// Format time to relative format
function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
}

// Tab switching
function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // Remove active class from all tabs and panes
            tabs.forEach(t => t.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding pane
            this.classList.add('active');
            const targetPane = document.getElementById(targetTab + '-tab');
            if (targetPane) {
                targetPane.classList.add('active');
            }
        });
    });
}

// Notification dropdown toggle
function initNotificationDropdown() {
    const notificationBell = document.getElementById('notificationBell');
    const notificationDropdown = document.getElementById('notificationDropdown');
    
    if (notificationBell && notificationDropdown) {
        notificationBell.addEventListener('click', function(e) {
            e.stopPropagation();
            notificationDropdown.classList.toggle('active');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!notificationBell.contains(e.target) && !notificationDropdown.contains(e.target)) {
                notificationDropdown.classList.remove('active');
            }
        });
    }
}

// Profile modal functions
const avatarBtn = document.getElementById('avatarBtn');
const profileModal = document.getElementById('profileModal');

function openProfileModal() {
    const user = auth.getCurrentUser();
    if (user) {
        document.getElementById('userNameDisplay').textContent = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User';
        document.getElementById('userEmailDisplay').value = user.email || '';
        document.getElementById('userFullNameDisplay').value = [user.first_name, user.last_name].filter(Boolean).join(' ') || '';
    }
    profileModal.classList.add('active');
}

function closeProfileModal() {
    profileModal.classList.remove('active');
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
        showError('Passwords do not match');
        return;
    }

    if (newPassword.length < 6) {
        showError('Password must be at least 6 characters long');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.accessToken}`
            },
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });

        const data = await response.json();
        if (response.ok) {
            showSuccess('Password changed successfully');
            closeChangePasswordModal();
        } else {
            showError(data.message || 'Failed to change password');
        }
    } catch (error) {
        showError('Error changing password');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize modules
    initTabs();
    initNotificationDropdown();

    const encouragementEl = document.getElementById('dashboardEncouragement');
    if (encouragementEl) {
        var quotes = [
            'Small steps today add up to a strong year. You have got this.',
            'Consistency beats perfection. One lesson at a time is enough.',
            'You are the right parent for this job. Rest when you need to.',
            'Progress is rarely linear. Celebrate what got done today.'
        ];
        encouragementEl.textContent = quotes[new Date().getDate() % quotes.length];
    }

    var dashOpenAlerts = document.getElementById('dashboardOpenNotifications');
    var notificationBell = document.getElementById('notificationBell');
    if (dashOpenAlerts && notificationBell) {
        dashOpenAlerts.addEventListener('click', function (e) {
            e.preventDefault();
            notificationBell.click();
        });
    }

    // Welcome message name
    const welcomeName = document.getElementById('welcomeName');
    const currentUser = auth.getCurrentUser();
    if (welcomeName && currentUser) {
        welcomeName.textContent = [currentUser.first_name, currentUser.last_name]
            .filter(Boolean)
            .join(' ') || 'Student';
    }
    
    // Fetch data
    fetchStudentStats();
    fetchNotifications();
    fetchToolAccess();
    
    // Refresh notifications every 30 seconds
    setInterval(fetchNotifications, 30000);
    
    // Avatar button click
    if (avatarBtn) {
        avatarBtn.addEventListener('click', openProfileModal);
    }
    
    // Profile modal outside click
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
    
    // Mobile menu
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    const body = document.body;
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    
    if (mobileToggle) {
        mobileToggle.addEventListener('click', toggleMobileMenu);
    }
    
    if (overlay) {
        overlay.addEventListener('click', toggleMobileMenu);
    }
    
    function toggleMobileMenu() {
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('active');
        body.classList.toggle('menu-open');
        
        const icon = mobileToggle.querySelector('i');
        if (sidebar.classList.contains('mobile-open')) {
            icon.className = 'fas fa-times';
        } else {
            icon.className = 'fas fa-bars';
        }
    }
    
    // Premium Modal Functions
    function openPremiumModal() {
        document.getElementById('premiumModal').style.display = 'block';
    }
    
    function closePremiumModal() {
        document.getElementById('premiumModal').style.display = 'none';
    }
    
    // Close modal when clicking outside
    window.onclick = function(event) {
        const modal = document.getElementById('premiumModal');
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }
    
    // Update current date
    const currentDateElement = document.getElementById('current-date');
    if (currentDateElement) {
        currentDateElement.textContent = new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }
});
