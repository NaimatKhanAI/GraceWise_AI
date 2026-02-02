// Search functionality
function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.trim();
    
    if (searchTerm === '') {
        alert('Please enter a search term');
        return;
    }
    
    // For now, show alert with search term
    alert('Searching for: "' + searchTerm + '"\\nSearch functionality will be implemented later');
    
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