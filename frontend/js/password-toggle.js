// Password visibility toggle functionality
document.addEventListener('DOMContentLoaded', function() {
    const eyeIcons = document.querySelectorAll('.eye-icon');
    
    eyeIcons.forEach(function(eyeIcon) {
        eyeIcon.addEventListener('click', function() {
            const passwordInput = this.previousElementSibling;
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                this.classList.add('slashed');
            } else {
                passwordInput.type = 'password';
                this.classList.remove('slashed');
            }
        });
    });
});