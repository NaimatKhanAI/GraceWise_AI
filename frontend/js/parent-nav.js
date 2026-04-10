/**
 * Main parent app sidebar: exactly 5 top-level items.
 * Set <body data-nav="dashboard|family|learning|records|coach"> for active state.
 * Settings and other tools stay in the sidebar footer (not counted as main tabs).
 */
(function () {
    var NAV = [
        { key: 'dashboard', href: 'dashboard.html', icon: 'fa-th-large', label: 'Dashboard' },
        { key: 'family', href: 'family.html', icon: 'fa-users', label: 'Family' },
        { key: 'learning', href: 'learning.html', icon: 'fa-graduation-cap', label: 'Learning' },
        { key: 'records', href: 'records.html', icon: 'fa-folder-open', label: 'Records' },
        { key: 'coach', href: 'ai-assistant.html', icon: 'fa-comments', label: 'AI Coach' }
    ];

    function render() {
        var el = document.getElementById('parent-nav-menu');
        if (!el) return;
        var active = (document.body.getAttribute('data-nav') || '').trim();
        el.innerHTML = NAV.map(function (item) {
            var cls = 'nav-item' + (item.key === active ? ' active' : '');
            return (
                '<a href="' +
                item.href +
                '" class="' +
                cls +
                '"><i class="fas ' +
                item.icon +
                '"></i><span>' +
                item.label +
                '</span></a>'
            );
        }).join('');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', render);
    } else {
        render();
    }
})();
