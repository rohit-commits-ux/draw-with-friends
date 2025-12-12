class MultiplayerManager {
    constructor() {
        this.socket = io();
        this.roomId = 'default-room';
        this.users = new Set();
        this.isConnected = false;
        this.username = localStorage.getItem('playerName') || 'Player';
        
        this.init();
    }
    
    init() {
        this.setupSocketEvents();
        this.setupUIEvents();
        this.joinRoom();
    }
    
    setupSocketEvents() {
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.updateConnectionStatus();
            console.log('✅ Connected to server');
            this.joinRoom();
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
            this.showSystemMessage('👤 A player joined the room');
        });
        
        this.socket.on('user-left', (userId) => {
            this.users.delete(userId);
            this.updateUserList();
            this.showSystemMessage('👤 A player left the room');
        });
        
        this.socket.on('room-stats', (data) => {
            this.updateRoomStats(data);
        });
        
        this.socket.on('chat-message', (data) => {
            this.displayChatMessage(data);
        });
    }
    
    setupUIEvents() {
        const joinRoomBtn = document.getElementById('joinRoomBtn');
        const roomIdInput = document.getElementById('roomIdInput');
        const createRoomBtn = document.getElementById('createRoomBtn');
        const clearBtn = document.getElementById('clearBtn');
        const saveBtn = document.getElementById('saveBtn');
        
        // Join room button
        if (joinRoomBtn) {
            joinRoomBtn.addEventListener('click', () => {
                this.roomId = roomIdInput.value.trim() || 'default-room';
                this.joinRoom();
            });
        }
        
        // Create room button
        if (createRoomBtn) {
            createRoomBtn.addEventListener('click', () => {
                const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
                this.roomId = randomId;
                roomIdInput.value = randomId;
                this.joinRoom();
            });
        }
        
        // Enter key to join room
        if (roomIdInput) {
            roomIdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.roomId = roomIdInput.value.trim() || 'default-room';
                    this.joinRoom();
                }
            });
        }
        
        // Clear canvas
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearCanvas();
            });
        }
        
        // Save drawing
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveDrawing();
            });
        }
    }
    
    joinRoom() {
        if (this.socket && this.roomId) {
            console.log(`🎮 Joining room: ${this.roomId}`);
            this.socket.emit('join-room', this.roomId);
            
            // Clear users list for new room
            this.users.clear();
            this.updateUserList();
            
            // Update UI
            const roomDisplay = document.getElementById('currentRoom');
            if (roomDisplay) {
                roomDisplay.textContent = `Room: ${this.roomId}`;
            }
            
            this.showSystemMessage(`🎮 Joined room: ${this.roomId}`);
        }
    }
    
    sendDrawing(data) {
        if (this.socket && this.isConnected) {
            this.socket.emit('drawing', {
                ...data,
                roomId: this.roomId,
                tool: data.tool || 'pen',
                color: data.color || '#000000',
                brushSize: data.brushSize || 5
            });
        }
    }
    
    clearCanvas() {
        if (this.socket && this.isConnected) {
            this.socket.emit('clear-canvas', this.roomId);
        }
        if (window.canvas) {
            window.canvas.clearCanvas();
        }
        this.showSystemMessage('🧹 Canvas cleared');
    }
    
    sendChatMessage(message) {
        if (this.socket && this.isConnected && message.trim()) {
            this.socket.emit('chat-message', {
                roomId: this.roomId,
                message: message.trim(),
                username: this.username,
                timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
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
            currentUserItem.innerHTML = `<strong>${this.username} (You)</strong>`;
            usersList.appendChild(currentUserItem);
            
            // Add other users
            this.users.forEach(userId => {
                const userItem = document.createElement('li');
                userItem.textContent = `Player`;
                usersList.appendChild(userItem);
            });
        }
        
        const totalUsers = this.users.size + 1;
        
        if (userCount) {
            userCount.textContent = `👤 ${totalUsers}`;
        }
        
        if (usersCount) {
            usersCount.textContent = `(${totalUsers})`;
        }
    }
    
    updateRoomStats(data) {
        const userCount = document.getElementById('userCount');
        if (userCount && data.userCount !== undefined) {
            userCount.textContent = `👤 ${data.userCount}`;
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
    
    showSystemMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            const messageElement = document.createElement('div');
            messageElement.className = 'system-message';
            messageElement.innerHTML = `💬 ${message}`;
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
            this.showSystemMessage('💾 Drawing saved!');
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
        
        // Focus on chat input when clicking chat panel
        const chatPanel = document.querySelector('.chat-panel');
        if (chatPanel) {
            chatPanel.addEventListener('click', () => {
                chatInput.focus();
            });
        }
    }
    
    // Auto-focus on room input
    const roomInput = document.getElementById('roomIdInput');
    if (roomInput) {
        setTimeout(() => roomInput.focus(), 500);
    }
});
