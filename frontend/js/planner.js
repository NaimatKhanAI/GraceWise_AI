// Weekly Planner Script
// Global variables
let currentWeekStart = null;
let allPlans = [];
let selectedChildId = null;
let editingPlanId = null;
let deletingPlanId = null;
let currentView = 'weekly';

// Time slots for the planner (hourly)
const TIME_SLOTS = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Subject colors mapping
const SUBJECT_COLORS = {
    'mathematics': 'mathematics',
    'english': 'english',
    'science': 'science',
    'history': 'history',
    'geography': 'geography',
    'art': 'art',
    'pe': 'pe',
    'music': 'music',
    'study': 'study',
    'break': 'break',
    'default': 'study'
};

// Initialize the planner
document.addEventListener('DOMContentLoaded', async function() {
    await initializePlanner();
    setupEventListeners();
    await loadPlans();
    renderPlanner();
});

// Initialize planner
async function initializePlanner() {
    // Get selected child from localStorage or session
    const childId = localStorage.getItem('selectedChildId');
    if (childId) {
        selectedChildId = parseInt(childId);
    } else {
        // Try to fetch and auto-select first child
        await fetchAndSelectFirstChild();
    }

    // Set current week to this week
    setCurrentWeekToThisWeek();
}

// Fetch children and auto-select first one if none selected
async function fetchAndSelectFirstChild() {
    try {
        // First, try to get a test child or create one
        const response = await fetch(`${API_BASE_URL}/child_progress/add_child`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token') || localStorage.getItem('access_token')}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            selectedChildId = data.child_id;
            localStorage.setItem('selectedChildId', selectedChildId);
            console.log('Auto-created and selected child:', selectedChildId);
        }
    } catch (error) {
        console.warn('Could not auto-create child:', error);
    }
}

// Set current week to this week
function setCurrentWeekToThisWeek() {
    const today = new Date();
    const dayOfWeek = today.getDay() || 7; // Make Sunday = 7
    const diff = today.getDate() - dayOfWeek + 1; // Adjust when day is Sunday
    currentWeekStart = new Date(today.setDate(diff));
    currentWeekStart.setHours(0, 0, 0, 0);
}

// Setup event listeners
function setupEventListeners() {
    // Week selector
    document.getElementById('weekSelector').addEventListener('change', function(e) {
        const customRange = document.getElementById('customDateRange');
        if (e.target.value === 'custom') {
            customRange.style.display = 'flex';
        } else {
            customRange.style.display = 'none';
            handleWeekSelection(e.target.value);
        }
    });

    // View toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentView = this.dataset.view;
            renderPlanner();
        });
    });
}

// Handle week selection
function handleWeekSelection(selection) {
    if (selection === 'this-week') {
        setCurrentWeekToThisWeek();
    } else if (selection === 'next-week') {
        setCurrentWeekToThisWeek();
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }
    updateWeekDisplay();
    loadPlans().then(() => renderPlanner());
}

// Apply custom date range
function applyCustomRange() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!startDate || !endDate) {
        showToast('Please select both start and end dates', 'error');
        return;
    }

    if (new Date(startDate) > new Date(endDate)) {
        showToast('Start date must be before end date', 'error');
        return;
    }

    currentWeekStart = new Date(startDate);
    currentWeekStart.setHours(0, 0, 0, 0);
    renderPlanner();
}

// Navigate to previous week
function navigatePreviousWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    // Reset selector to show we're in custom mode
    const selector = document.getElementById('weekSelector');
    if (selector) {
        selector.value = isCurrentWeek() ? 'this-week' : (isNextWeek() ? 'next-week' : 'custom');
    }
    updateWeekDisplay();
    renderPlanner();
}

// Navigate to next week
function navigateNextWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    // Reset selector to show we're in custom mode
    const selector = document.getElementById('weekSelector');
    if (selector) {
        selector.value = isCurrentWeek() ? 'this-week' : (isNextWeek() ? 'next-week' : 'custom');
    }
    updateWeekDisplay();
    renderPlanner();
}

// Check if current week is this week
function isCurrentWeek() {
    const today = new Date();
    const dayOfWeek = today.getDay() || 7;
    const diff = today.getDate() - dayOfWeek + 1;
    const thisWeekStart = new Date(today.setDate(diff));
    thisWeekStart.setHours(0, 0, 0, 0);
    return currentWeekStart.getTime() === thisWeekStart.getTime();
}

// Check if current week is next week
function isNextWeek() {
    const today = new Date();
    const dayOfWeek = today.getDay() || 7;
    const diff = today.getDate() - dayOfWeek + 1;
    const thisWeekStart = new Date(today.setDate(diff));
    thisWeekStart.setHours(0, 0, 0, 0);
    const nextWeekStart = new Date(thisWeekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    return currentWeekStart.getTime() === nextWeekStart.getTime();
}

// Load plans from backend
async function loadPlans() {
    if (!selectedChildId) {
        console.warn('No selected child ID - using empty plans list');
        allPlans = [];
        return;
    }

    try {
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/planner/${selectedChildId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            allPlans = await response.json();
            console.log('Loaded plans:', allPlans.length);
        } else {
            console.warn('Failed to load plans:', response.status);
            allPlans = [];
        }
    } catch (error) {
        console.error('Error loading plans:', error);
        allPlans = [];
    }
}

// Get plans for current week
function getPlansForWeek() {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    return allPlans.filter(plan => {
        if (!plan.date) return false;
        const planDate = new Date(plan.date);
        return planDate >= currentWeekStart && planDate <= weekEnd;
    });
}

// Render the planner
function renderPlanner() {
    const grid = document.getElementById('plannerGrid');
    const emptyState = document.getElementById('emptyState');
    const weekPlans = getPlansForWeek();

    if (weekPlans.length === 0 && !hasPlansInWeek()) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    if (currentView === 'weekly') {
        renderWeeklyView(grid, weekPlans);
    } else {
        renderDailyView(grid, weekPlans);
    }

    updateWeekDisplay();
}

// Check if there are any plans in the current week
function hasPlansInWeek() {
    return getPlansForWeek().length > 0;
}

// Update week display
function updateWeekDisplay() {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const startStr = currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    document.getElementById('currentWeekDisplay').textContent = `Week of ${startStr} - ${endStr}`;
}

// Render weekly view
function renderWeeklyView(grid, weekPlans) {
    grid.innerHTML = '';
    grid.classList.remove('daily-view');
    grid.classList.add('weekly-view');

    // Create day headers and content
    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(currentWeekStart);
        dayDate.setDate(dayDate.getDate() + i);
        const dateStr = formatDateForComparison(dayDate);

        // Create day column container
        const dayColumn = document.createElement('div');
        dayColumn.className = 'day-column-container';

        // Create day header
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.innerHTML = `
            <div class="day-name">${DAYS_OF_WEEK[i]}</div>
            <div class="day-date">${dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
        `;
        dayColumn.appendChild(dayHeader);

        // Create day content area
        const dayContent = document.createElement('div');
        dayContent.className = 'day-content';

        // Get all plans for this day and sort by start time
        const dayPlans = weekPlans.filter(p => p.date === dateStr)
                                  .sort((a, b) => a.start_time.localeCompare(b.start_time));

        if (dayPlans.length > 0) {
            dayPlans.forEach(plan => {
                const planCard = document.createElement('div');
                planCard.className = 'day-plan-item';
                planCard.innerHTML = createPlanCard(plan);
                planCard.querySelector('.planner-card').addEventListener('click', () => viewPlan(plan));
                dayContent.appendChild(planCard);
            });
        } else {
            // Empty state for the day
            const emptySlot = document.createElement('div');
            emptySlot.className = 'empty-day-slot';
            emptySlot.innerHTML = '<div class="empty-day-text">No plans</div>';
            emptySlot.addEventListener('click', () => openNewPlanModal(dayDate, null));
            dayContent.appendChild(emptySlot);
        }

        dayColumn.appendChild(dayContent);
        grid.appendChild(dayColumn);
    }
}

// Render daily view
function renderDailyView(grid, weekPlans) {
    grid.innerHTML = '';
    grid.classList.add('daily-view');
    grid.classList.remove('weekly-view');

    // Sort plans by start time
    weekPlans.sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.start_time.localeCompare(b.start_time);
    });

    if (weekPlans.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-state';
        emptyMsg.innerHTML = `
            <i class="fas fa-calendar-times"></i>
            <h3>No plans this week</h3>
        `;
        grid.appendChild(emptyMsg);
        return;
    }

    weekPlans.forEach(plan => {
        const planDate = new Date(plan.date);
        const dayName = DAYS_OF_WEEK[planDate.getDay() === 0 ? 6 : planDate.getDay() - 1];
        const dayStr = planDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

        const planItem = document.createElement('div');
        planItem.className = 'daily-plan-item';
        planItem.innerHTML = `
            <div class="daily-plan-date">${dayStr}</div>
            ${createPlanCard(plan)}
        `;
        planItem.querySelector('.planner-card').addEventListener('click', () => viewPlan(plan));
        grid.appendChild(planItem);
    });
}

// Create plan card HTML
function createPlanCard(plan) {
    const subjectClass = SUBJECT_COLORS[plan.subject?.toLowerCase()] || 'study';
    const endTime = plan.end_time || '00:00';
    
    // Format time to show AM/PM
    const formatTime = (time) => {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    };

    return `
        <div class="planner-card ${subjectClass}">
            <div class="planner-card-time">${formatTime(plan.start_time)} - ${formatTime(endTime)}</div>
            <div class="planner-card-header">
                <div class="planner-card-title">Subject : ${plan.task_name}</div>
                ${plan.subtitle ? `<div class="planner-card-subtitle">${plan.subtitle}</div>` : ''}
            </div>
            <div class="planner-card-actions">
                <button class="card-action-btn" onclick="event.stopPropagation(); editPlan(${plan.id})" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="card-action-btn" onclick="event.stopPropagation(); deletePlan(${plan.id})" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

// Open new plan modal
function openNewPlanModal(date = null, time = null) {
    editingPlanId = null;
    document.getElementById('modalTitle').textContent = 'Create New Plan';
    document.getElementById('planForm').reset();

    // Set date
    if (date) {
        document.getElementById('planDate').value = formatDateForInput(date);
    } else {
        document.getElementById('planDate').value = formatDateForInput(new Date());
    }

    // Set time
    if (time) {
        document.getElementById('planStartTime').value = time;
    }

    openModal('planModal');
}

// Open edit modal for existing plan
function editPlan(planId) {
    const plan = allPlans.find(p => p.id === planId);
    if (!plan) return;

    editingPlanId = planId;
    document.getElementById('modalTitle').textContent = 'Edit Plan';

    document.getElementById('planTitle').value = plan.task_name;
    document.getElementById('planSubject').value = plan.subject || '';
    document.getElementById('planDate').value = plan.date;
    document.getElementById('planStartTime').value = plan.start_time;
    document.getElementById('planEndTime').value = plan.end_time;
    document.getElementById('planSubtitle').value = plan.subtitle || '';
    document.getElementById('planDescription').value = plan.description || '';

    openModal('planModal');
}

// View plan details
function viewPlan(plan) {
    const viewContent = document.getElementById('viewPlanContent');
    const endTime = plan.end_time || 'Not specified';

    viewContent.innerHTML = `
        <div class="plan-details">
            <div class="plan-detail-item">
                <div class="plan-detail-icon" style="background: #f0f5ff; color: #5b6cdd;">
                    <i class="fas fa-book"></i>
                </div>
                <div class="plan-detail-content">
                    <div class="plan-detail-label">Title</div>
                    <div class="plan-detail-value">${escapeHtml(plan.task_name)}</div>
                </div>
            </div>

            <div class="plan-detail-item">
                <div class="plan-detail-icon" style="background: #e8f6f3; color: #16a085;">
                    <i class="fas fa-tag"></i>
                </div>
                <div class="plan-detail-content">
                    <div class="plan-detail-label">Subject</div>
                    <div class="plan-detail-badge">${escapeHtml(plan.subject || 'General')}</div>
                </div>
            </div>

            <div class="plan-detail-item">
                <div class="plan-detail-icon" style="background: #fff3e8; color: #f39c12;">
                    <i class="fas fa-calendar"></i>
                </div>
                <div class="plan-detail-content">
                    <div class="plan-detail-label">Date</div>
                    <div class="plan-detail-value">${new Date(plan.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
            </div>

            <div class="plan-detail-item">
                <div class="plan-detail-icon" style="background: #ffe8f0; color: #e91e63;">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="plan-detail-content">
                    <div class="plan-detail-label">Time</div>
                    <div class="plan-detail-value">${plan.start_time} - ${endTime}</div>
                </div>
            </div>

            ${plan.subtitle ? `
            <div class="plan-detail-item">
                <div class="plan-detail-icon" style="background: #f3e8f6; color: #9b59b6;">
                    <i class="fas fa-info-circle"></i>
                </div>
                <div class="plan-detail-content">
                    <div class="plan-detail-label">Additional Info</div>
                    <div class="plan-detail-value">${escapeHtml(plan.subtitle)}</div>
                </div>
            </div>
            ` : ''}

            ${plan.description ? `
            <div class="plan-detail-item">
                <div class="plan-detail-icon" style="background: #f0fff0; color: #27ae60;">
                    <i class="fas fa-sticky-note"></i>
                </div>
                <div class="plan-detail-content">
                    <div class="plan-detail-label">Description</div>
                    <div class="plan-detail-value">${escapeHtml(plan.description).replace(/\n/g, '<br>')}</div>
                </div>
            </div>
            ` : ''}
        </div>
    `;

    // Store current plan for edit/delete
    window.currentPlan = plan;

    openModal('viewPlanModal');
}

// Edit current viewing plan
function editCurrentPlan() {
    if (window.currentPlan) {
        closeViewPlanModal();
        editPlan(window.currentPlan.id);
    }
}

// Delete plan confirmation
function deletePlan(planId) {
    deletingPlanId = planId;
    openModal('deleteModal');
}

// Delete plan confirmation from view modal
function deletePlanConfirm() {
    if (window.currentPlan) {
        deletingPlanId = window.currentPlan.id;
        closeViewPlanModal();
        openModal('deleteModal');
    }
}

// Confirm delete
async function confirmDelete() {
    if (!deletingPlanId) return;

    try {
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/planner/${deletingPlanId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            allPlans = allPlans.filter(p => p.id !== deletingPlanId);
            renderPlanner();
            closeDeleteModal();
            showToast('Plan deleted successfully', 'success');
        } else {
            showToast('Error deleting plan', 'error');
        }
    } catch (error) {
        console.error('Error deleting plan:', error);
        showToast('Error deleting plan', 'error');
    }

    deletingPlanId = null;
}

// Save plan
async function savePlan(event) {
    event.preventDefault();

    // Check if child is selected
    if (!selectedChildId) {
        showToast('Please wait while we set up your account...', 'warning');
        await fetchAndSelectFirstChild();
        if (!selectedChildId) {
            showToast('Unable to create plan. Please try again.', 'error');
            return;
        }
    }

    const planData = {
        child_id: selectedChildId,
        task_name: document.getElementById('planTitle').value,
        subject: document.getElementById('planSubject').value,
        date: document.getElementById('planDate').value,
        start_time: document.getElementById('planStartTime').value,
        end_time: document.getElementById('planEndTime').value,
        subtitle: document.getElementById('planSubtitle').value,
        description: document.getElementById('planDescription').value,
        status: 'Pending'
    };

    // Validate
    if (!planData.task_name || !planData.subject || !planData.date || !planData.start_time || !planData.end_time) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    if (planData.start_time >= planData.end_time) {
        showToast('End time must be after start time', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        let response;

        if (editingPlanId) {
            // Update plan
            response = await fetch(`${API_BASE_URL}/planner/${editingPlanId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(planData)
            });
        } else {
            // Create new plan
            response = await fetch(`${API_BASE_URL}/planner/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(planData)
            });
        }

        if (response.ok) {
            const result = await response.json();
            
            if (editingPlanId) {
                // Update in local array
                const index = allPlans.findIndex(p => p.id === editingPlanId);
                if (index !== -1) {
                    allPlans[index] = { ...allPlans[index], ...planData };
                }
                showToast('Plan updated successfully', 'success');
            } else {
                // Add to local array
                allPlans.push({
                    id: result.id,
                    ...planData
                });
                showToast('Plan created successfully', 'success');
            }

            renderPlanner();
            closePlanModal();
            editingPlanId = null;
        } else {
            // Get error message from response
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error || errorData.message || 'Error saving plan';
            console.error('Server error:', errorMsg);
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        console.error('Error saving plan:', error);
        showToast('Network error. Please check your connection and try again.', 'error');
    }
}

// Modal functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('modalOverlay');
    modal.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('modalOverlay');
    modal.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = 'auto';
}

function closePlanModal() {
    closeModal('planModal');
    editingPlanId = null;
}

function closeDeleteModal() {
    closeModal('deleteModal');
    deletingPlanId = null;
}

function closeViewPlanModal() {
    closeModal('viewPlanModal');
}

function closeAllModals() {
    document.querySelectorAll('.modal.active').forEach(modal => {
        modal.classList.remove('active');
    });
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = 'auto';
}

// Utility functions
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateForComparison(date) {
    return formatDateForInput(date);
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function showToast(message, type = 'info') {
    // Use the existing notification system from the app
    if (type === 'success') {
        showSuccess(message);
    } else if (type === 'error') {
        showError(message);
    } else if (type === 'warning') {
        showWarning(message);
    } else {
        showInfo(message);
    }
}

// Profile modal functions
function openProfileModal() {
    const user = auth.getCurrentUser();
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

// Fetch notifications
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

// Display notifications
function displayNotifications(notifications) {
    const notificationList = document.getElementById('notificationList');
    
    // Exit if element doesn't exist
    if (!notificationList) {
        return;
    }
    
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

// Update notification badge
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

// Mark notification as read
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

// Mark all notifications as read
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
            showToast('All notifications marked as read', 'success');
        }
    } catch (error) {
        console.error('Error marking all notifications:', error);
    }
}

// Format time to relative format
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

async function handleChangePassword(event) {
    event.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters long', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token') || localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });

        const data = await response.json();
        if (response.ok) {
            showToast('Password changed successfully', 'success');
            closeChangePasswordModal();
        } else {
            showToast(data.message || 'Failed to change password', 'error');
        }
    } catch (error) {
        showToast('Error changing password', 'error');
    }
}

// Set minimum date for plan date input
document.addEventListener('DOMContentLoaded', function() {
    const today = new Date();
    document.getElementById('planDate').min = formatDateForInput(today);
    
    // Initialize notification dropdown
    initNotificationDropdown();
    
    // Fetch notifications
    fetchNotifications();
    
    // Refresh notifications every 30 seconds
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
    
    // Mobile menu functionality
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    const body = document.body;

    function toggleMobileMenu() {
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('active');
        body.classList.toggle('menu-open');
        
        // Toggle icon between bars and times
        const icon = mobileToggle.querySelector('i');
        if (sidebar.classList.contains('mobile-open')) {
            icon.className = 'fas fa-times';
        } else {
            icon.className = 'fas fa-bars';
        }
    }

    if (mobileToggle) {
        mobileToggle.addEventListener('click', toggleMobileMenu);
    }
    if (overlay) {
        overlay.addEventListener('click', toggleMobileMenu);
    }
});
