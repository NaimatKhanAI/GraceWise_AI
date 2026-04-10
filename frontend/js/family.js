document.addEventListener('DOMContentLoaded', function () {
    if (typeof auth === 'undefined' || !auth.isLoggedIn()) return;

    var grid = document.getElementById('childrenGrid');
    var empty = document.getElementById('childrenEmpty');
    var addBtn = document.getElementById('addFirstChildBtn');
    if (!grid || !empty) return;

    function token() {
        return localStorage.getItem('access_token') || localStorage.getItem('token');
    }

    async function loadChildren() {
        try {
            var res = await fetch(window.API_BASE_URL + '/child_progress/children', {
                headers: { Authorization: 'Bearer ' + token() }
            });
            if (!res.ok) throw new Error('load failed');
            var data = await res.json();
            var list = data.children || [];
            if (list.length === 0) {
                grid.innerHTML = '';
                empty.style.display = 'block';
                return;
            }
            empty.style.display = 'none';
            grid.innerHTML = list
                .map(function (c) {
                    return (
                        '<a class="child-tile" href="child-profile.html?id=' +
                        encodeURIComponent(c.id) +
                        '">' +
                        '<h3>' +
                        escapeHtml(c.name) +
                        '</h3>' +
                        '<span>Open profile · Overview, learning, progress, records</span>' +
                        '</a>'
                    );
                })
                .join('');
        } catch (e) {
            console.error(e);
            grid.innerHTML = '';
            empty.style.display = 'block';
            empty.querySelector('p').textContent = 'Could not load learners. Check your connection and try again.';
        }
    }

    function escapeHtml(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    async function addChild() {
        try {
            var res = await fetch(window.API_BASE_URL + '/child_progress/add_child', {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + token() }
            });
            if (res.ok) await loadChildren();
        } catch (e) {
            console.error(e);
        }
    }

    if (addBtn) addBtn.addEventListener('click', addChild);

    loadChildren();

    if (typeof initNotificationDropdown === 'function') initNotificationDropdown();
    if (typeof fetchNotifications === 'function') {
        fetchNotifications();
        setInterval(fetchNotifications, 30000);
    }
});
