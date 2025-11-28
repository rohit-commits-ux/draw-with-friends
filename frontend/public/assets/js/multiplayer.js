class MultiplayerManager {
    constructor() {
        this.socket = io();
        this.roomId = 'default-room';
        this.users = new Set();
        this.isConnected = false;
        this.username = `User${Math.random().toString(36).substring(2, 8)}`;
        
        this.init();
    }
    
    init() {
        this.setupSocketEvents();
        this.setupUIEvents();
        this.joinRoom();
        this.updateConnectionStatus();
    }
    
    setupSocketEvents() {
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.updateConnectionStatus();
            console.log('✅ Connected to server');
            this.joinRoom(); // Rejoin room on reconnect
        });
        
        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.updateConnectionStatus();
            console.log('❌ Disconnected from server');
        });
        
        this.socket.on('drawing', (data) => {
            if (window.canvas) {
                window.canvas.drawReceived(data);
            }
        });
        
        this.socket.on('clear-canvas', () => {
            if (window.canvas) {
                window.canvas.clearCanvas();
            }
        });
        
        this.socket.on('load-drawings', (drawings) => {
            if (window.canvas && drawings && drawings.length > 0) {
                console.log(`📥 Loading ${drawings.length} previous drawings`);
                drawings.forEach(data => {
                    window.canvas.drawReceived(data);
                });
            }
        });
        
        this.socket.on('user-joined', (userId) => {
            this.users.add(userId);
            this.updateUserList();
            this.showSystemMessage(`User ${userId.substring(0, 8)} joined the room`);
        });
        
        this.socket.on('user-left', (userId) => {
            this.users.delete(userId);
            this.updateUserList();
            this.showSystemMessage(`User ${userId.substring(0, 8)} left the room`);
        });
        
        this.socket.on('room-stats', (data) => {
            this.updateRoomStats(data);
        });
        
        this.socket.on('chat-message', (data) => {
            this.displayChatMessage(data);
        });
        
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.showSystemMessage(`Error: ${error.message}`, 'error');
        });
    }
    
    setupUIEvents() {
        const joinRoomBtn = document.getElementById('joinRoomBtn');
        const roomIdInput = document.getElementById('roomIdInput');
        const clearBtn = document.getElementById('clearBtn');
        const saveBtn = document.getElementById('saveBtn');
        
        if (joinRoomBtn && roomIdInput) {
            joinRoomBtn.addEventListener('click', () => {
                this.roomId = roomIdInput.value.trim() || 'default-room';
                this.joinRoom();
            });
            
            roomIdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.roomId = roomIdInput.value.trim() || 'default-room';
                    this.joinRoom();
                }
            });
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearCanvas();
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveDrawing();
            });
        }
        
        // Update room display
        const roomDisplay = document.getElementById('currentRoom');
        if (roomDisplay) {
            roomDisplay.textContent = `Room: ${this.roomId}`;
        }
    }
    
    joinRoom() {
        if (this.socket && this.roomId) {
            this.socket.emit('join-room', this.roomId);
            this.updateUserList();
            
            // Update room display
            const roomDisplay = document.getElementById('currentRoom');
            if (roomDisplay) {
                roomDisplay.textContent = `Room: ${this.roomId}`;
            }
            
            const roomIdInput = document.getElementById('roomIdInput');
            if (roomIdInput) {
                roomIdInput.value = this.roomId;
            }
            
            this.showSystemMessage(`Joined room: ${this.roomId}`);
            console.log(`🎮 Joined room: ${this.roomId}`);
        }
    }
    
    sendDrawing(data) {
        if (this.socket && this.isConnected) {
            this.socket.emit('drawing', {
                ...data,
                roomId: this.roomId
            });
        }
    }
    
    clearCanvas() {
        if (this.socket && this.isConnected) {
            this.socket.emit('clear-canvas', this.roomId);
            this.showSystemMessage('Canvas cleared');
        }
    }
    
    sendChatMessage(message) {
        if (this.socket && this.isConnected && message.trim()) {
            this.socket.emit('chat-message', {
                roomId: this.roomId,
                message: message.trim(),
                username: this.username
            });
        }
    }
    
    updateUserList() {
        const usersList = document.getElementById('usersList');
        const userCount = document.getElementById('userCount');
        const usersCount = document.getElementById('usersCount');
        
        if (usersList) {
            usersList.innerHTML = '';
            
            // Add current user first
            const currentUserItem = document.createElement('li');
            currentUserItem.innerHTML = `<strong>You (${this.username})</strong>`;
            usersList.appendChild(currentUserItem);
            
            // Add other users
            this.users.forEach(userId => {
                const userItem = document.createElement('li');
                userItem.textContent = `User ${userId.substring(0, 8)}`;
                usersList.appendChild(userItem);
            });
        }
        
        const totalUsers = this.users.size + 1; // +1 for current user
        
        if (userCount) {
            userCount.textContent = `👤 Users: ${totalUsers}`;
        }
        
        if (usersCount) {
            usersCount.textContent = `(${totalUsers})`;
        }
    }
    
    updateRoomStats(data) {
        const userCount = document.getElementById('userCount');
        if (userCount && data.userCount !== undefined) {
            userCount.textContent = `👤 Users: ${data.userCount}`;
        }
    }
    
    updateConnectionStatus() {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            if (this.isConnected) {
                statusElement.textContent = '🟢 Connected';
                statusElement.className = 'status-connected';
            } else {
                statusElement.textContent = '🔴 Disconnected';
                statusElement.className = 'status-disconnected';
            }
        }
    }
    
    showSystemMessage(message, type = 'info') {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            const messageElement = document.createElement('div');
            messageElement.className = `system-message ${type}`;
            messageElement.textContent = message;
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
    
    displayChatMessage(data) {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            const messageElement = document.createElement('div');
            messageElement.className = 'chat-message';
            messageElement.innerHTML = `
                <strong>${data.username}:</strong> ${data.message}
                <span class="message-time">${data.timestamp}</span>
            `;
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
    
    saveDrawing() {
        if (window.canvas) {
            const link = document.createElement('a');
            link.download = `drawing-${this.roomId}-${new Date().getTime()}.png`;
            link.href = window.canvas.exportImage();
            link.click();
            this.showSystemMessage('Drawing saved!');
        }
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.canvas = new DrawingCanvas('multiplayer');
    window.multiplayerManager = new MultiplayerManager();
    
    // Add chat functionality
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    
    if (chatInput && sendBtn) {
        const sendMessage = () => {
            const message = chatInput.value.trim();
            if (message) {
                window.multiplayerManager.sendChatMessage(message);
                chatInput.value = '';
            }
        };
        
        sendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
});