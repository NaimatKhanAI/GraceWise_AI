document.addEventListener('DOMContentLoaded', async function () {
    const form = document.getElementById('onboardingForm');
    const coreContainer = document.getElementById('coreQuestions');
    const tierContainer = document.getElementById('tierQuestions');
    const tierTitle = document.getElementById('tierQuestionsTitle');
    const submitBtn = form.querySelector('button[type=\"submit\"]');
    const apiBase = window.API_BASE_URL;

    let allowedFields = [];

    const selectOptions = {
        homeschool_type: ['Traditional homeschool', 'Hybrid', 'Unschooling', 'Classical', 'Charlotte Mason', 'Other'],
        work_schedule: ['Full-time', 'Part-time', 'Flexible', 'Shifts', 'Stay-at-home'],
        budget_level: ['Tight', 'Moderate', 'Comfortable'],
        meal_planning_help: ['Yes', 'No'],
        morning_routine_help: ['Yes', 'No'],
        need_schedules: ['Yes', 'No'],
        need_checklists: ['Yes', 'No']
    };

    function authHeaders() {
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    function fieldId(field) {
        return `onboarding_${field}`;
    }

    function normalizeLabel(label) {
        return label || '';
    }

    function createField(question, initialValue) {
        const wrapper = document.createElement('div');
        wrapper.className = 'field-wrap';

        const label = document.createElement('label');
        label.setAttribute('for', fieldId(question.key));
        label.textContent = normalizeLabel(question.label);
        wrapper.appendChild(label);

        const value = initialValue == null ? '' : String(initialValue);
        let input;

        if (question.key === 'number_of_children') {
            input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.step = '1';
            input.required = true;
            input.value = value;
        } else if (selectOptions[question.key]) {
            input = document.createElement('select');
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Select one';
            input.appendChild(placeholder);

            selectOptions[question.key].forEach((optionText) => {
                const option = document.createElement('option');
                option.value = optionText;
                option.textContent = optionText;
                input.appendChild(option);
            });
            input.value = value;
        } else {
            input = document.createElement('textarea');
            input.value = value;
            input.placeholder = 'Type your answer...';
        }

        input.id = fieldId(question.key);
        input.name = question.key;
        if (question.required) {
            input.required = true;
        }

        wrapper.appendChild(input);
        return wrapper;
    }

    async function loadQuestionsAndProfile() {
        const [questionsRes, profileRes] = await Promise.all([
            fetch(`${apiBase}/onboarding/questions`, { headers: authHeaders() }),
            fetch(`${apiBase}/onboarding/me`, { headers: authHeaders() })
        ]);

        const questionData = await questionsRes.json();
        const profileData = await profileRes.json();

        if (!questionsRes.ok) {
            throw new Error(questionData.message || 'Could not load onboarding questions');
        }
        if (!profileRes.ok) {
            throw new Error(profileData.message || 'Could not load onboarding profile');
        }

        const profile = profileData.profile || {};
        allowedFields = profileData.allowed_fields || [];

        coreContainer.innerHTML = '';
        tierContainer.innerHTML = '';

        (questionData.core_questions || []).forEach((question) => {
            const q = { ...question, required: true };
            coreContainer.appendChild(createField(q, profile[q.key]));
        });

        const tierQuestions = questionData.tier_questions || [];
        if (tierQuestions.length === 0) {
            tierContainer.innerHTML = '<p>No extra questions for your current tier.</p>';
        } else {
            tierQuestions.forEach((question) => {
                tierContainer.appendChild(createField(question, profile[question.key]));
            });
        }

        tierTitle.textContent = `${(questionData.plan_name || 'Tier')} Extra Questions`;
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        submitBtn.disabled = true;

        try {
            const payload = {};
            allowedFields.forEach((field) => {
                const el = document.getElementById(fieldId(field));
                if (!el) return;
                payload[field] = el.value;
            });

            if (payload.number_of_children !== undefined && payload.number_of_children !== '') {
                payload.number_of_children = Number(payload.number_of_children);
            }

            const response = await fetch(`${apiBase}/onboarding/me`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Could not save onboarding');
            }

            auth.updateUser({ onboarding_completed: true });
            showSuccess('Onboarding saved. Redirecting to dashboard...');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } catch (error) {
            showError(error.message || 'Could not save onboarding');
        } finally {
            submitBtn.disabled = false;
        }
    });

    try {
        await loadQuestionsAndProfile();
    } catch (error) {
        showError(error.message || 'Could not load onboarding.');
        if ((error.message || '').toLowerCase().includes('subscription')) {
            setTimeout(() => {
                window.location.href = 'premium-plan.html';
            }, 1000);
        }
    }
});
