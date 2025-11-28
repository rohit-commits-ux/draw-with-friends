// Authentication utilities (for future features)
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.checkAuthStatus();
    }
    
    // Placeholder for future login functionality
    login(username, password) {
        // This would typically make an API call to your backend
        return new Promise((resolve, reject) => {
            // Simulate API call
            setTimeout(() => {
                if (username && password) {
                    this.currentUser = {
                        username: username,
                        id: Math.random().toString(36).substring(2, 9),
                        joinedAt: new Date().toISOString()
                    };
                    this.isLoggedIn = true;
                    localStorage.setItem('user', JSON.stringify(this.currentUser));
                    resolve(this.currentUser);
                } else {
                    reject(new Error('Username and password are required'));
                }
            }, 1000);
        });
    }
    
    // Placeholder for future logout functionality
    logout() {
        this.currentUser = null;
        this.isLoggedIn = false;
        localStorage.removeItem('user');
        console.log('User logged out');
    }
    
    // Check if user is logged in
    checkAuthStatus() {
        try {
            const userData = localStorage.getItem('user');
            if (userData) {
                this.currentUser = JSON.parse(userData);
                this.isLoggedIn = true;
                console.log('User is logged in:', this.currentUser.username);
                return true;
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
            this.logout();
        }
        return false;
    }
    
    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }
    
    // Check if user is authenticated
    isAuthenticated() {
        return this.isLoggedIn;
    }
    
    // Generate guest username
    generateGuestName() {
        const adjectives = ['Creative', 'Happy', 'Swift', 'Clever', 'Brave', 'Calm', 'Eager', 'Gentle', 'Jolly', 'Lucky'];
        const nouns = ['Artist', 'Painter', 'Creator', 'Designer', 'Drawer', 'Sketch', 'Master', 'Wizard', 'Genius', 'Star'];
        
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const number = Math.floor(Math.random() * 1000);
        
        return `${adj}${noun}${number}`;
    }
    
    // Quick login as guest
    quickLogin() {
        const guestName = this.generateGuestName();
        return this.login(guestName, 'guest');
    }
}

// Demo usage for future features
document.addEventListener('DOMContentLoaded', function() {
    const auth = new AuthManager();
    
    // Example: Add login button if needed
    const addLoginDemo = () => {
        const header = document.querySelector('header');
        if (header && !document.getElementById('authDemo')) {
            const authDemo = document.createElement('div');
            authDemo.id = 'authDemo';
            authDemo.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(255,255,255,0.9);
                padding: 10px;
                border-radius: 8px;
                z-index: 1000;
                font-size: 12px;
            `;
            
            if (auth.isAuthenticated()) {
                authDemo.innerHTML = `
                    Welcome, ${auth.currentUser.username}!
                    <button onclick="auth.logout(); location.reload();">Logout</button>
                `;
            } else {
                authDemo.innerHTML = `
                    <button onclick="auth.quickLogin().then(() => location.reload())">Quick Login</button>
                `;
            }
            
            header.appendChild(authDemo);
        }
    };
    
    // Uncomment to enable demo login button
    // addLoginDemo();
});

// Make AuthManager available globally
window.AuthManager = AuthManager;
window.auth = new AuthManager();