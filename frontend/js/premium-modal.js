// Premium Modal Functions
function openPremiumModal() {
    document.getElementById('premiumModal').style.display = 'block';
}

function closePremiumModal() {
    document.getElementById('premiumModal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('premiumModal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}