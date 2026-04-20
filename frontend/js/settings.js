// Settings Page JavaScript
// Use the API_BASE_URL from config.js (already loaded via window object)

// Get access token
function getAccessToken() {
    return localStorage.getItem('access_token') || localStorage.getItem('token');
}

// Load user settings on page load
async function loadUserSettings() {
    try {
        // First try to get from auth
        let user = auth?.getCurrentUser();
        
        // If not available, fetch from backend
        if (!user) {
            const token = getAccessToken();
            const response = await fetch(`${window.API_BASE_URL}/auth/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                user = data.user;
            }
        }
        
        if (user) {
            const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User';
            document.getElementById('displayUserName').textContent = fullName;
            document.getElementById('displayUserEmail').textContent = user.email || 'No email';
            
            // Pre-fill modal fields
            document.getElementById('firstName').value = user.first_name || '';
            document.getElementById('lastName').value = user.last_name || '';
        } else {
            document.getElementById('displayUserName').textContent = 'User';
            document.getElementById('displayUserEmail').textContent = 'No email';
        }

        await loadSubscriptionSettings();

        // Load notification preference
        const notificationEnabled = localStorage.getItem('notificationsEnabled');
        if (notificationEnabled !== null) {
            document.getElementById('notificationToggle').checked = notificationEnabled === 'true';
        }
    } catch (error) {
        console.error('Error loading user settings:', error);
        document.getElementById('displayUserName').textContent = 'Error loading';
        document.getElementById('displayUserEmail').textContent = 'Error loading';
    }
}

async function loadSubscriptionSettings() {
    const subscriptionLabel = document.getElementById('displaySubscriptionTier');
    const retryPaymentSetting = document.getElementById('retryPaymentSetting');
    const manageBillingBtn = document.getElementById('manageBillingBtn');

    if (!subscriptionLabel || !manageBillingBtn || typeof billingApi === 'undefined') return;

    try {
        const sub = await billingApi.getSubscription(true);
        const tier = (sub.effective_tier || 'free').toLowerCase();
        const status = (sub.subscription_status || 'inactive').toLowerCase();
        const names = { free: 'Free', plan: 'Plan', thrive: 'Thrive', together: 'Together' };
        const tierLabel = names[tier] || tier;

        subscriptionLabel.textContent = `${tierLabel} (${status})`;
        retryPaymentSetting.style.display = status === 'past_due' ? 'flex' : 'none';

        manageBillingBtn.textContent = tier === 'free' ? 'View Plans' : 'Manage Billing';
    } catch (error) {
        subscriptionLabel.textContent = 'Unavailable';
        retryPaymentSetting.style.display = 'none';
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (typeof auth === 'undefined' || !auth.isLoggedIn()) {
        setTimeout(() => {
            window.location.href = 'sign_in.html';
        }, 100);
        return;
    }

    // Load user settings with slight delay to ensure auth is ready
    setTimeout(() => {
        loadUserSettings();
    }, 100);

    const manageBillingBtn = document.getElementById('manageBillingBtn');
    if (manageBillingBtn) {
        manageBillingBtn.addEventListener('click', async function () {
            try {
                const sub = await billingApi.getSubscription();
                const tier = (sub.effective_tier || 'free').toLowerCase();
                if (tier === 'free') {
                    window.location.href = 'premium-plan.html';
                    return;
                }
                const portalUrl = await billingApi.openPortal('settings.html');
                window.location.href = portalUrl;
            } catch (error) {
                if (typeof showError === 'function') {
                    showError(error.message || 'Could not open billing portal.');
                }
            }
        });
    }

    const retryPaymentBtn = document.getElementById('retryPaymentBtn');
    if (retryPaymentBtn) {
        retryPaymentBtn.addEventListener('click', async function () {
            try {
                await billingApi.retryPayment();
                if (typeof showSuccess === 'function') {
                    showSuccess('Payment retry submitted.');
                }
                await loadSubscriptionSettings();
            } catch (error) {
                if (typeof showError === 'function') {
                    showError(error.message || 'Could not retry payment.');
                }
            }
        });
    }

    // Set current date
    const currentDateElement = document.getElementById('currentDate');
    if (currentDateElement) {
        currentDateElement.textContent = new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    // Notification toggle handler
    const notificationToggle = document.getElementById('notificationToggle');
    if (notificationToggle) {
        notificationToggle.addEventListener('change', handleNotificationToggle);
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

    // Mobile menu
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');

    if (mobileToggle) {
        mobileToggle.addEventListener('click', function() {
            sidebar.classList.toggle('mobile-open');
            overlay.classList.toggle('active');
            const icon = mobileToggle.querySelector('i');
            icon.className = sidebar.classList.contains('mobile-open') ? 'fas fa-times' : 'fas fa-bars';
        });
    }

    if (overlay) {
        overlay.addEventListener('click', function() {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('active');
            const icon = mobileToggle.querySelector('i');
            icon.className = 'fas fa-bars';
        });
    }
});

// Handle notification toggle
async function handleNotificationToggle(event) {
    const isEnabled = event.target.checked;
    
    try {
        const token = getAccessToken();
        const response = await fetch(`${window.API_BASE_URL}/auth/notification-preferences`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                notifications_enabled: isEnabled
            })
        });

        if (response.ok) {
            localStorage.setItem('notificationsEnabled', isEnabled.toString());
            if (typeof showSuccess === 'function') {
                showSuccess(`Notifications ${isEnabled ? 'enabled' : 'disabled'}`);
            }
        } else {
            event.target.checked = !isEnabled;
            if (typeof showError === 'function') {
                showError('Failed to update notification preference');
            }
        }
    } catch (error) {
        console.error('Error updating notification preference:', error);
        event.target.checked = !isEnabled;
        if (typeof showError === 'function') {
            showError('Error updating notification preference');
        }
    }
}

// Edit Name Modal Functions
window.openEditNameModal = function() {
    document.getElementById('editNameModal').classList.add('active');
}

window.closeEditNameModal = function() {
    document.getElementById('editNameModal').classList.remove('active');
}

window.handleNameUpdate = async function(event) {
    event.preventDefault();
    
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();

    try {
        const token = getAccessToken();
        const response = await fetch(`${window.API_BASE_URL}/auth/update-profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                first_name: firstName,
                last_name: lastName
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            // Update display
            const fullName = [firstName, lastName].filter(Boolean).join(' ');
            document.getElementById('displayUserName').textContent = fullName;
            
            // Update user in auth
            if (auth && typeof auth.updateUser === 'function') {
                auth.updateUser({ first_name: firstName, last_name: lastName });
            }
            
            if (typeof showSuccess === 'function') {
                showSuccess('Name updated successfully');
            }
            closeEditNameModal();
        } else {
            if (typeof showError === 'function') {
                showError(data.message || 'Failed to update name');
            }
        }
    } catch (error) {
        console.error('Error updating name:', error);
        if (typeof showError === 'function') {
            showError('Error updating name');
        }
    }
}

// Edit Email Modal Functions
window.openEditEmailModal = function() {
    document.getElementById('editEmailModal').classList.add('active');
}

window.closeEditEmailModal = function() {
    document.getElementById('editEmailModal').classList.remove('active');
    document.getElementById('editEmailForm').reset();
}

window.handleEmailUpdate = async function(event) {
    event.preventDefault();
    
    const newEmail = document.getElementById('newEmail').value.trim();
    const password = document.getElementById('confirmPassword').value;

    try {
        const token = getAccessToken();
        const response = await fetch(`${window.API_BASE_URL}/auth/update-email`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                new_email: newEmail,
                password: password
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            // Update display
            document.getElementById('displayUserEmail').textContent = newEmail;
            
            // Update user in auth
            if (auth && typeof auth.updateUser === 'function') {
                auth.updateUser({ email: newEmail });
            }
            
            if (typeof showSuccess === 'function') {
                showSuccess('Email updated successfully');
            }
            closeEditEmailModal();
        } else {
            if (typeof showError === 'function') {
                showError(data.message || 'Failed to update email');
            }
        }
    } catch (error) {
        console.error('Error updating email:', error);
        if (typeof showError === 'function') {
            showError('Error updating email');
        }
    }
}

// Change Password Modal Functions
window.openChangePasswordModal = function() {
    document.getElementById('changePasswordModal').classList.add('active');
}

window.closeChangePasswordModal = function() {
    document.getElementById('changePasswordModal').classList.remove('active');
    document.getElementById('passwordForm').reset();
}

window.handleChangePassword = async function(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPasswordChange').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;

    if (newPassword !== confirmPassword) {
        if (typeof showError === 'function') {
            showError('New passwords do not match');
        }
        return;
    }

    if (newPassword.length < 6) {
        if (typeof showError === 'function') {
            showError('Password must be at least 6 characters long');
        }
        return;
    }

    try {
        const token = getAccessToken();
        const response = await fetch(`${window.API_BASE_URL}/auth/change-password`, {
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
            if (typeof showSuccess === 'function') {
                showSuccess('Password changed successfully');
            }
            closeChangePasswordModal();
        } else {
            if (typeof showError === 'function') {
                showError(data.message || 'Failed to change password');
            }
        }
    } catch (error) {
        console.error('Error changing password:', error);
        if (typeof showError === 'function') {
            showError('Error changing password');
        }
    }
}

// Profile Modal Functions
window.openProfileModal = function() {
    const user = auth?.getCurrentUser();
    if (user) {
        document.getElementById('userNameDisplay').textContent = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User';
        document.getElementById('userEmailDisplay').value = user.email || '';
        document.getElementById('userFullNameDisplay').value = [user.first_name, user.last_name].filter(Boolean).join(' ') || '';
    }
    document.getElementById('profileModal').classList.add('active');
}

window.closeProfileModal = function() {
    document.getElementById('profileModal').classList.remove('active');
}

// Notification functions (copied from progress.js)
async function fetchNotifications() {
    try {
        const token = getAccessToken();
        const response = await fetch(`${window.API_BASE_URL}/dashboard/student/notifications`, {
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
        const response = await fetch(`${window.API_BASE_URL}/dashboard/student/notifications/${notificationId}/mark-read`, {
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
        const response = await fetch(`${window.API_BASE_URL}/dashboard/student/notifications/mark-all-read`, {
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

// Make notification functions globally accessible
window.markNotificationRead = markNotificationRead;
window.markAllNotificationsRead = markAllNotificationsRead;
