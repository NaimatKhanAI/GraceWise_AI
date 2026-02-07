// Admin Curriculum Management
const API_BASE_URL = window.API_BASE_URL;

// Get access token
function getAccessToken() {
    return localStorage.getItem('access_token');
}

// Check if user is admin
async function checkAdminAuth() {
    const user = await auth?.getCurrentUser();
    if (!user || !user.is_admin) {
        window.location.href = 'sign_in.html';
        return false;
    }
    return true;
}

// Load all curriculum
async function loadCurriculum() {
    try {
        const response = await fetch(`${API_BASE_URL}/curriculum/?include_modules=true`, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Failed to load curriculum');

        const data = await response.json();
        renderCurriculum(data);
    } catch (error) {
        console.error('Error loading curriculum:', error);
        document.getElementById('curriculumList').innerHTML = `
            <div class="loading">Failed to load curriculum. Please try again.</div>
        `;
    }
}

// Sync existing folders into database
async function syncExistingFolders() {
    try {
        const response = await fetch(`${API_BASE_URL}/curriculum/sync-folders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAccessToken()}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to sync folders');
        }
    } catch (error) {
        console.error('Error syncing folders:', error);
        Toast.warning('Folder sync failed. Existing folders may not appear.');
    }
}

// Render curriculum list
function renderCurriculum(curriculumList) {
    const container = document.getElementById('curriculumList');
    
    if (curriculumList.length === 0) {
        container.innerHTML = `
            <div class="loading">No curriculum created yet. Click "Create Curriculum" to start.</div>
        `;
        return;
    }

    container.innerHTML = curriculumList.map(curriculum => `
        <div class="curriculum-card" id="curriculum-${curriculum.id}">
            <div class="curriculum-header" onclick="toggleCurriculum(${curriculum.id})">
                <div class="curriculum-info">
                    <h3>${curriculum.title}</h3>
                    <p>${curriculum.description}</p>
                </div>
                <div class="curriculum-meta">
                    <span><i class="fas fa-book"></i> ${curriculum.module_count || 0} Modules</span>
                    ${curriculum.age_group ? `<span><i class="fas fa-users"></i> ${curriculum.age_group}</span>` : ''}
                </div>
                <div class="curriculum-actions" onclick="event.stopPropagation()">
                    <button onclick="showCreateModuleModal(${curriculum.id})">
                        <i class="fas fa-plus"></i> Add Module
                    </button>
                    <button class="btn-danger" onclick="deleteCurriculum(${curriculum.id}, '${curriculum.title}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    <button class="curriculum-toggle-btn" onclick="toggleCurriculum(${curriculum.id})" aria-label="Toggle curriculum">
                        <i class="fas fa-chevron-down curriculum-toggle" id="toggle-${curriculum.id}"></i>
                    </button>
                </div>
            </div>
            <div class="curriculum-body" id="body-${curriculum.id}">
                <div class="modules-container" id="modules-${curriculum.id}">
                    <div class="loading">Loading modules...</div>
                </div>
            </div>
        </div>
    `).join('');
}

// Toggle curriculum expand/collapse
function toggleCurriculum(curriculumId) {
    closeOtherCurriculums(curriculumId);
    const body = document.getElementById(`body-${curriculumId}`);
    const toggle = document.getElementById(`toggle-${curriculumId}`);
    
    const isExpanded = body.classList.contains('expanded');
    
    if (!isExpanded) {
        body.classList.add('expanded');
        toggle.classList.add('expanded');
        if (!body.dataset.loaded) {
            loadModules(curriculumId);
            body.dataset.loaded = 'true';
        }
    } else {
        body.classList.remove('expanded');
        toggle.classList.remove('expanded');
    }
}

function closeOtherCurriculums(activeId) {
    document.querySelectorAll('.curriculum-body').forEach(body => {
        const bodyId = body.id.replace('body-', '');
        if (bodyId !== String(activeId)) {
            body.classList.remove('expanded');
            const toggle = document.getElementById(`toggle-${bodyId}`);
            if (toggle) toggle.classList.remove('expanded');
        }
    });
}

// Load modules for a curriculum
async function loadModules(curriculumId) {
    try {
        const response = await fetch(`${API_BASE_URL}/curriculum/${curriculumId}`);
        
        if (!response.ok) throw new Error('Failed to load modules');

        const data = await response.json();
        renderModules(curriculumId, data.modules || []);
    } catch (error) {
        console.error('Error loading modules:', error);
        document.getElementById(`modules-${curriculumId}`).innerHTML = `
            <div class="no-modules">Failed to load modules</div>
        `;
    }
}

// Render modules
function renderModules(curriculumId, modules) {
    const container = document.getElementById(`modules-${curriculumId}`);
    
    if (modules.length === 0) {
        container.innerHTML = `
            <div class="no-modules">No modules yet. Click "Add Module" to create one.</div>
        `;
        return;
    }

    container.innerHTML = modules.map(module => `
        <div class="module-card" id="module-${module.id}">
            <div class="module-header">
                <div class="module-info">
                    <h4><i class="fas fa-folder"></i> ${module.name}</h4>
                    <p>${module.description || 'No description'}</p>
                </div>
                <div class="module-actions">
                    <button class="btn-icon" onclick="showUploadLessonModal(${module.id})">
                        <i class="fas fa-upload"></i> Upload Lesson
                    </button>
                    <button class="btn-danger" onclick="deleteModule(${module.id}, '${module.name}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="lessons-list" id="lessons-${module.id}">
                ${renderLessons(module.lessons || [])}
            </div>
        </div>
    `).join('');
}

// Render lessons
function renderLessons(lessons) {
    if (lessons.length === 0) {
        return '<div class="no-lessons">No lessons uploaded yet</div>';
    }

    return lessons.map(lesson => `
        <div class="lesson-item">
            <div class="lesson-info">
                <div class="lesson-icon">
                    <i class="fas fa-file-${lesson.file_type === 'pdf' ? 'pdf' : 'alt'}"></i>
                </div>
                <div class="lesson-details">
                    <h5>${lesson.name}</h5>
                    <p>${lesson.description || 'No description'} • ${formatFileSize(lesson.file_size)}</p>
                </div>
            </div>
            <button class="btn-danger" onclick="deleteLesson(${lesson.id}, '${lesson.name}')">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `).join('');
}

// Format file size
function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// ==================== MODAL FUNCTIONS ====================

// Create Curriculum Modal
function showCreateCurriculumModal() {
    document.getElementById('createCurriculumModal').classList.add('active');
}

function closeCreateCurriculumModal() {
    document.getElementById('createCurriculumModal').classList.remove('active');
    document.getElementById('createCurriculumForm').reset();
}

// Create Module Modal
function showCreateModuleModal(curriculumId) {
    document.getElementById('moduleCurriculumId').value = curriculumId;
    document.getElementById('createModuleModal').classList.add('active');
}

function closeCreateModuleModal() {
    document.getElementById('createModuleModal').classList.remove('active');
    document.getElementById('createModuleForm').reset();
}

// Upload Lesson Modal
function showUploadLessonModal(moduleId) {
    document.getElementById('lessonModuleId').value = moduleId;
    document.getElementById('uploadLessonModal').classList.add('active');
}

function closeUploadLessonModal() {
    document.getElementById('uploadLessonModal').classList.remove('active');
    document.getElementById('uploadLessonForm').reset();
}

// ==================== CRUD OPERATIONS ====================

// Create Curriculum
async function createCurriculum(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {
        title: formData.get('title'),
        description: formData.get('description'),
        age_group: formData.get('age_group') || null
    };

    try {
        const response = await fetch(`${API_BASE_URL}/curriculum/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAccessToken()}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create curriculum');
        }

        Toast.success('Curriculum created successfully!');
        closeCreateCurriculumModal();
        loadCurriculum();
    } catch (error) {
        console.error('Error creating curriculum:', error);
        Toast.error('Failed to create curriculum: ' + error.message);
    }
}

// Delete Curriculum
async function deleteCurriculum(curriculumId, title) {
    if (!confirm(`Are you sure you want to delete "${title}"? This will also delete all modules and lessons inside it.`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/curriculum/${curriculumId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getAccessToken()}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete curriculum');
        }

        Toast.success('Curriculum deleted successfully!');
        loadCurriculum();
    } catch (error) {
        console.error('Error deleting curriculum:', error);
        Toast.error('Failed to delete curriculum: ' + error.message);
    }
}

// Create Module
async function createModule(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const curriculumId = formData.get('curriculum_id');
    const data = {
        name: formData.get('name'),
        description: formData.get('description') || ''
    };

    try {
        const response = await fetch(`${API_BASE_URL}/curriculum/${curriculumId}/module`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAccessToken()}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create module');
        }

        Toast.success('Module created successfully!');
        closeCreateModuleModal();
        loadModules(curriculumId);
    } catch (error) {
        console.error('Error creating module:', error);
        Toast.error('Failed to create module: ' + error.message);
    }
}

// Delete Module
async function deleteModule(moduleId, name) {
    if (!confirm(`Are you sure you want to delete module "${name}"? This will also delete all lessons inside it.`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/curriculum/module/${moduleId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getAccessToken()}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete module');
        }

        Toast.success('Module deleted successfully!');
        loadCurriculum();
    } catch (error) {
        console.error('Error deleting module:', error);
        Toast.error('Failed to delete module: ' + error.message);
    }
}

// Upload Lesson
async function uploadLesson(event) {
    event.preventDefault();
    
    const formElement = event.target;
    const formData = new FormData(formElement);
    const moduleId = formData.get('module_id');
    
    // Validate file size (10MB max)
    const file = formData.get('file');
    if (file.size > 10 * 1024 * 1024) {
        Toast.warning('File size must be less than 10MB');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/curriculum/module/${moduleId}/lesson`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAccessToken()}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to upload lesson');
        }

        Toast.success('Lesson uploaded successfully!');
        closeUploadLessonModal();
        loadCurriculum();
    } catch (error) {
        console.error('Error uploading lesson:', error);
        Toast.error('Failed to upload lesson: ' + error.message);
    }
}

// Delete Lesson
async function deleteLesson(lessonId, name) {
    if (!confirm(`Are you sure you want to delete lesson "${name}"?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/curriculum/lesson/${lessonId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getAccessToken()}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete lesson');
        }

        Toast.success('Lesson deleted successfully!');
        loadCurriculum();
    } catch (error) {
        console.error('Error deleting lesson:', error);
        Toast.error('Failed to delete lesson: ' + error.message);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = await checkAdminAuth();
    if (isAdmin) {
        await syncExistingFolders();
        loadCurriculum();
    }
});

// Close modals when clicking outside
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.classList.remove('active');
        }
    });
};
