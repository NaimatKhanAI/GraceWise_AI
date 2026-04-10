document.addEventListener('DOMContentLoaded', function () {
    if (typeof auth === 'undefined' || !auth.isLoggedIn()) return;

    var params = new URLSearchParams(window.location.search);
    var id = parseInt(params.get('id'), 10);
    var titleEl = document.getElementById('childProfileTitle');
    var statRow = document.getElementById('childStatRow');
    var shortcuts = document.getElementById('childShortcutRow');

    if (!id || !titleEl || !statRow || !shortcuts) {
        if (titleEl) titleEl.textContent = 'Learner not found';
        return;
    }

    localStorage.setItem('selectedChildId', String(id));

    function token() {
        return localStorage.getItem('access_token') || localStorage.getItem('token');
    }

    shortcuts.innerHTML =
        '<a href="learning.html"><i class="fas fa-graduation-cap"></i> Learning</a>' +
        '<a href="progress.html"><i class="fas fa-chart-line"></i> Progress</a>' +
        '<a href="records.html"><i class="fas fa-folder-open"></i> Records</a>';

    fetch(window.API_BASE_URL + '/child_progress/children', {
        headers: { Authorization: 'Bearer ' + token() }
    })
        .then(function (r) {
            return r.ok ? r.json() : null;
        })
        .then(function (data) {
            if (!data || !data.children) {
                titleEl.textContent = 'Learner ' + id;
                return;
            }
            var found = data.children.filter(function (c) {
                return c.id === id;
            })[0];
            titleEl.textContent = found ? found.name : 'Learner ' + id;
        })
        .catch(function () {
            titleEl.textContent = 'Learner ' + id;
        });

    fetch(window.API_BASE_URL + '/child_progress/' + id, {
        headers: { Authorization: 'Bearer ' + token() }
    })
        .then(function (r) {
            if (!r.ok) throw new Error('not found');
            return r.json();
        })
        .then(function (data) {
            var pct = Math.round(data.completion_percentage || 0);
            statRow.innerHTML =
                '<div class="stat"><strong>' +
                pct +
                '%</strong><span>Devotional track (sample)</span></div>' +
                '<div class="stat"><strong>' +
                (data.completed_devotionals || 0) +
                '</strong><span>Items completed</span></div>' +
                '<div class="stat"><strong>' +
                (data.remaining_devotionals || 0) +
                '</strong><span>Remaining</span></div>';
        })
        .catch(function () {
            titleEl.textContent = 'Learner';
            statRow.innerHTML =
                '<p style="color:#718096;font-size:14px;">Could not load this profile. Return to Family and pick a learner.</p>';
        });
});
