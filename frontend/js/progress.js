const API_BASE_URL = 'http://127.0.0.1:5000';

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

document.addEventListener('DOMContentLoaded', function() {
    fetchProgressData();
});
