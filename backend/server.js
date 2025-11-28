const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Store active rooms and drawings
const rooms = new Map();
const drawings = new Map();

// Serve main pages - LOGIN PAGE IS NOW FIRST
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.get('/mode', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/mode.html'));
});

app.get('/multiplayer', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/multiplayer.html'));
});

app.get('/singleplayer', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/singleplayer.html'));
});

// API route for health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Draw With Friends Server is running!',
    timestamp: new Date().toISOString(),
    activeRooms: rooms.size
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🎨 User connected:', socket.id);

  // Join a room
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
      drawings.set(roomId, []);
    }
    
    rooms.get(roomId).add(socket.id);
    
    // Send existing drawings to new user
    const roomDrawings = drawings.get(roomId);
    socket.emit('load-drawings', roomDrawings);
    
    // Notify others in the room
    socket.to(roomId).emit('user-joined', socket.id);
    
    // Update room stats
    const userCount = rooms.get(roomId).size;
    io.to(roomId).emit('room-stats', { 
      userCount: userCount,
      roomId: roomId
    });
    
    console.log(`👥 User ${socket.id} joined room ${roomId} (Total users: ${userCount})`);
  });

  // Handle drawing data
  socket.on('drawing', (data) => {
    const { roomId, x, y, prevX, prevY, color, brushSize } = data;
    
    // Validate data
    if (!roomId || x === undefined || y === undefined) {
      return;
    }
    
    // Store drawing data
    if (drawings.has(roomId)) {
      drawings.get(roomId).push(data);
      
      // Limit stored drawings to prevent memory issues
      const roomDrawings = drawings.get(roomId);
      if (roomDrawings.length > 1000) {
        drawings.set(roomId, roomDrawings.slice(-500));
      }
    }
    
    // Broadcast to other users in the room
    socket.to(roomId).emit('drawing', data);
  });

  // Handle clear canvas
  socket.on('clear-canvas', (roomId) => {
    if (drawings.has(roomId)) {
      drawings.set(roomId, []);
    }
    socket.to(roomId).emit('clear-canvas');
    console.log(`🧹 Canvas cleared in room ${roomId} by ${socket.id}`);
  });

  // Handle chat messages
  socket.on('chat-message', (data) => {
    const { roomId, message, username } = data;
    const chatData = {
      username: username || `User${socket.id.substring(0, 6)}`,
      message: message,
      timestamp: new Date().toLocaleTimeString()
    };
    io.to(roomId).emit('chat-message', chatData);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
    
    // Remove user from all rooms
    rooms.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        socket.to(roomId).emit('user-left', socket.id);
        
        // Update room stats
        const userCount = users.size;
        io.to(roomId).emit('room-stats', { 
          userCount: userCount,
          roomId: roomId
        });
        
        // Clean up empty rooms after 5 minutes
        if (users.size === 0) {
          setTimeout(() => {
            if (rooms.get(roomId) && rooms.get(roomId).size === 0) {
              rooms.delete(roomId);
              drawings.delete(roomId);
              console.log(`🗑️ Room ${roomId} cleaned up`);
            }
          }, 300000); // 5 minutes
        }
      }
    });
  });

  // Handle connection error
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Handle 404 routes
app.use('*', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('🚀 Draw With Friends Server started!');
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Static files: ${path.join(__dirname, '../frontend/public')}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = app;
