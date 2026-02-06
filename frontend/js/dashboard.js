// Dashboard JavaScript
const API_BASE_URL = window.API_BASE_URL;

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
    document.getElementById('totalQuizzesAttempted').textContent = stats.total_quiz_attempts || 0;
    document.getElementById('totalHoursSpent').textContent = stats.total_hours_spent || 0;
    document.getElementById('studentRanking').textContent = stats.ranking || 1;
    document.getElementById('totalStudents').textContent = stats.total_students_ranked || 0;
    
    const avgScore = stats.average_score || 0;
    document.getElementById('averageScore').textContent = Math.round(avgScore) + '%';
    
    // Update tab content with same values
    document.getElementById('totalQuizzesValue').textContent = stats.total_quiz_attempts || 0;
    document.getElementById('avgScoreValue').textContent = Math.round(avgScore) + '%';
    document.getElementById('totalHoursValue').textContent = (stats.total_hours_spent || 0) + ' hours';
    document.getElementById('rankingValue').textContent = stats.ranking || 1;
    document.getElementById('totalStudentsValue').textContent = stats.total_students_ranked || 0;
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
            return;
        }

        const data = await response.json();
        displayNotifications(data.notifications);
        updateNotificationBadge(data.unread_count);
    } catch (error) {
        console.error('Error fetching notifications:', error);
    }
}

// Display notifications
function displayNotifications(notifications) {
    const notificationList = document.getElementById('notificationList');
    
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
                    <span class="notification-item-time">${formatTime(notif.created_at)}</span>
                </div>
            </div>
        </div>
    `).join('');
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
    // This would require a backend endpoint - for now we'll refresh notifications
    fetchNotifications();
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