const API_BASE_URL = window.API_BASE_URL;

async function fetchProgressData() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/student/progress`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch progress data');
            return;
        }

        const data = await response.json();
        updateProgressStats(data);
        renderSubjectPerformance(data.subject_performance || []);
        renderRecentActivities(data.recent_activities || []);
    } catch (error) {
        console.error('Error fetching progress data:', error);
    }
}

function updateProgressStats(data) {
    const quizAttempts = data.quiz_attempts || 0;
    const avgScore = Math.round(data.average_score || 0);
    const bestScore = Math.round(data.best_score || 0);
    const studyHours = data.study_hours || 0;
    const aiSessions = data.ai_session_count || 0;
    const recentCount = (data.recent_activities || []).length;

    const quizAttemptsEl = document.getElementById('progressQuizAttempts');
    const avgScoreEl = document.getElementById('progressAverageScore');
    const bestScoreEl = document.getElementById('progressBestScore');
    const studyHoursEl = document.getElementById('progressStudyHours');
    const aiSessionsEl = document.getElementById('progressAiSessions');
    const recentCountEl = document.getElementById('progressRecentCount');

    if (quizAttemptsEl) quizAttemptsEl.textContent = quizAttempts;
    if (avgScoreEl) avgScoreEl.textContent = `${avgScore}%`;
    if (bestScoreEl) bestScoreEl.textContent = `Best: ${bestScore}%`;
    if (studyHoursEl) studyHoursEl.textContent = studyHours;
    if (aiSessionsEl) aiSessionsEl.textContent = `AI Sessions: ${aiSessions}`;
    if (recentCountEl) recentCountEl.textContent = recentCount;
}

function renderSubjectPerformance(items) {
    const list = document.getElementById('performanceList');
    if (!list) return;

    if (!items.length) {
        list.innerHTML = '<div class="no-data">No subject performance yet</div>';
        return;
    }

    list.innerHTML = items.map(item => {
        const percent = Math.round(item.average_score || 0);
        return `
            <div class="performance-item">
                <span class="subject-name">${item.subject}</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percent}%"></div>
                </div>
                <span class="percentage">${percent}%</span>
            </div>
        `;
    }).join('');
}

function renderRecentActivities(items) {
    const list = document.getElementById('activitiesList');
    if (!list) return;

    if (!items.length) {
        list.innerHTML = '<div class="no-data">No recent activities yet</div>';
        return;
    }

    list.innerHTML = items.map(item => {
        const dateText = item.completed_at ? formatDate(item.completed_at) : 'Unknown date';
        const score = Math.round(item.score || 0);
        return `
            <div class="activity-item">
                <div class="activity-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
                    </svg>
                </div>
                <div class="activity-info">
                    <h4>${item.title}</h4>
                    <p>Quiz • Completed on ${dateText}</p>
                </div>
                <div class="activity-score">${score}%</div>
                <div class="activity-status completed">Completed</div>
            </div>
        `;
    }).join('');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

// Export Progress Report as PDF
async function exportProgressReport() {
    try {
        // Fetch fresh data
        const response = await fetch(`${API_BASE_URL}/dashboard/student/progress`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (typeof showError === 'function') {
                showError('Failed to fetch progress data');
            }
            return;
        }

        const data = await response.json();
        
        // Get user info
        const user = auth?.getCurrentUser();
        const userName = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') : 'Student';
        
        // Initialize jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Set up colors and fonts
        const primaryColor = [196, 165, 123]; // #c4a57b
        const textColor = [45, 55, 72];
        const lightGray = [226, 232, 240];
        
        // Title
        doc.setFontSize(22);
        doc.setTextColor(...primaryColor);
        doc.text('Progress Report', 105, 20, { align: 'center' });
        
        // Student name and date
        doc.setFontSize(12);
        doc.setTextColor(...textColor);
        doc.text(`Student: ${userName}`, 20, 35);
        doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 20, 42);
        
        // Horizontal line
        doc.setDrawColor(...lightGray);
        doc.line(20, 48, 190, 48);
        
        // Summary Statistics
        let yPos = 60;
        doc.setFontSize(16);
        doc.setTextColor(...primaryColor);
        doc.text('Summary Statistics', 20, yPos);
        
        yPos += 10;
        doc.setFontSize(11);
        doc.setTextColor(...textColor);
        
        const stats = [
            ['Quiz Attempts:', `${data.quiz_attempts || 0}`],
            ['Average Score:', `${Math.round(data.average_score || 0)}%`],
            ['Best Score:', `${Math.round(data.best_score || 0)}%`],
            ['Study Hours:', `${data.study_hours || 0} hours`],
            ['AI Sessions:', `${data.ai_session_count || 0} sessions`]
        ];
        
        stats.forEach(([label, value]) => {
            doc.text(label, 25, yPos);
            doc.text(value, 100, yPos);
            yPos += 7;
        });
        
        // Subject Performance
        yPos += 10;
        doc.setFontSize(16);
        doc.setTextColor(...primaryColor);
        doc.text('Subject Performance', 20, yPos);
        
        yPos += 10;
        doc.setFontSize(11);
        doc.setTextColor(...textColor);
        
        const subjectPerformance = data.subject_performance || [];
        if (subjectPerformance.length > 0) {
            subjectPerformance.forEach(item => {
                const percent = Math.round(item.average_score || 0);
                doc.text(item.subject, 25, yPos);
                doc.text(`${percent}%`, 100, yPos);
                
                // Progress bar
                doc.setFillColor(...lightGray);
                doc.rect(120, yPos - 4, 60, 5, 'F');
                doc.setFillColor(...primaryColor);
                doc.rect(120, yPos - 4, (60 * percent / 100), 5, 'F');
                
                yPos += 10;
            });
        } else {
            doc.text('No subject performance data available', 25, yPos);
            yPos += 10;
        }
        
        // Recent Activities
        if (yPos > 230) {
            doc.addPage();
            yPos = 20;
        } else {
            yPos += 10;
        }
        
        doc.setFontSize(16);
        doc.setTextColor(...primaryColor);
        doc.text('Recent Activities', 20, yPos);
        
        yPos += 10;
        doc.setFontSize(10);
        doc.setTextColor(...textColor);
        
        const recentActivities = data.recent_activities || [];
        if (recentActivities.length > 0) {
            recentActivities.slice(0, 10).forEach(item => {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }
                
                const dateText = item.completed_at ? formatDate(item.completed_at) : 'Unknown date';
                const score = Math.round(item.score || 0);
                
                doc.text(`• ${item.title}`, 25, yPos);
                doc.text(`${score}%`, 150, yPos);
                doc.setFontSize(9);
                doc.setTextColor(128, 128, 128);
                doc.text(`Completed on ${dateText}`, 27, yPos + 5);
                doc.setFontSize(10);
                doc.setTextColor(...textColor);
                
                yPos += 12;
            });
        } else {
            doc.text('No recent activities available', 25, yPos);
        }
        
        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(9);
            doc.setTextColor(128, 128, 128);
            doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
            doc.text('GraceWise AI - Homeschool Learning Platform', 105, 290, { align: 'center' });
        }
        
        // Save the PDF
        const fileName = `Progress_Report_${userName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
        
        if (typeof showSuccess === 'function') {
            showSuccess('Progress report downloaded successfully');
        }
    } catch (error) {
        console.error('Error exporting progress report:', error);
        if (typeof showError === 'function') {
            showError('Failed to export progress report');
        }
    }
}

// Notification functions
async function fetchNotifications() {
    try {
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
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
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
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
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
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
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
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

document.addEventListener('DOMContentLoaded', function() {
    fetchProgressData();
    
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
