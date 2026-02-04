// Search functionality
function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.trim();
    
    if (searchTerm === '') {
        if (typeof showWarning === 'function') {
            showWarning('Please enter a search term');
        }
        return;
    }
    
    // For now, show notification with search term
    if (typeof showInfo === 'function') {
        showInfo('Searching for: "' + searchTerm + '"\\nSearch functionality will be implemented later');
    }
    
    // Clear the search input
    searchInput.value = '';
}

// Allow Enter key to trigger search
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    
    searchInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            performSearch();
        }
    });
});