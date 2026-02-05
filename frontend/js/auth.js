// Authentication System
class AuthSystem {
    constructor() {
        this.apiBaseUrl = 'http://127.0.0.1:5000';
        this.currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
        this.accessToken = localStorage.getItem('access_token') || null;
    }

    // Register new user (backend)
    async register(userData) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    first_name: userData.firstName,
                    last_name: userData.lastName || '',
                    email: userData.email,
                    password: userData.password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                return { success: false, message: data.message || 'Registration failed.' };
            }

            return { success: true, message: data.message || 'Registration successful! Please log in.' };
        } catch (error) {
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    // Login user (backend)
    async login(email, password) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                return { success: false, message: data.message || 'Invalid email or password.' };
            }

            this.accessToken = data.access_token;
            localStorage.setItem('access_token', data.access_token);
            this.currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(data.user));

            return { success: true, message: data.message || 'Login successful!' };
        } catch (error) {
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    // Logout user
    logout() {
        this.currentUser = null;
        this.accessToken = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('access_token');
        window.location.href = 'index.html';
    }

    // Check if user is logged in
    isLoggedIn() {
        return this.currentUser !== null && !!this.accessToken;
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Redirect based on user type
    redirectAfterLogin() {
        // Check if user is admin
        if (this.currentUser && this.currentUser.is_admin) {
            window.location.href = 'admin-dashboard.html';
        } else {
            window.location.href = 'dashboard.html';
        }
    }

    // Check access permissions
    checkAccess() {
        const currentPage = window.location.pathname.split('/').pop();
        const adminPages = ['admin-dashboard.html', 'all-users.html', 'admin-curriculum.html'];
        
        if (adminPages.includes(currentPage)) {
            if (!this.isLoggedIn() || !this.currentUser.is_admin) {
                if (typeof showError === 'function') {
                    showError('Access denied! Admin privileges required.');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1500);
                } else {
                    window.location.href = 'index.html';
                }
                return false;
            }
        }
        
        const userPages = ['dashboard.html', 'curriculum.html', 'ai-assistant.html', 'devotional.html', 'progress.html'];
        if (userPages.includes(currentPage)) {
            if (!this.isLoggedIn()) {
                if (typeof showWarning === 'function') {
                    showWarning('Please sign in to access this page.');
                    setTimeout(() => {
                        window.location.href = 'sign_in.html';
                    }, 1500);
                } else {
                    window.location.href = 'sign_in.html';
                }
                return false;
            }
        }
        
        return true;
    }
}

// Initialize auth system
const auth = new AuthSystem();

// Check access on page load
document.addEventListener('DOMContentLoaded', function() {
    auth.checkAccess();
});