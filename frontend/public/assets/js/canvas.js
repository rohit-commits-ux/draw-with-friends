class DrawingCanvas {
    constructor(mode = 'single') {
        this.mode = mode;
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.drawingHistory = [];
        this.historyIndex = -1;
        
        // Default settings
        this.brushSize = 3;
        this.color = '#000000';
        this.currentTool = 'pen'; // pen, eraser, line
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.resizeCanvas();
    }
    
    setupCanvas() {
        // Set initial canvas style
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        this.ctx.lineWidth = this.brushSize;
        this.ctx.strokeStyle = this.color;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('mouseout', this.stopDrawing.bind(this));
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', this.handleTouch.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouch.bind(this));
        this.canvas.addEventListener('touchend', this.stopDrawing.bind(this));
        
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Window resize
        window.addEventListener('resize', this.resizeCanvas.bind(this));
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        const pos = this.getMousePos(e);
        [this.lastX, this.lastY] = [pos.x, pos.y];
        
        // For line tool, we'll handle it differently
        if (this.currentTool === 'line') {
            this.startX = pos.x;
            this.startY = pos.y;
        }
        
        // Save state for undo
        this.saveState();
    }
    
    draw(e) {
        if (!this.isDrawing) return;
        
        e.preventDefault();
        const pos = this.getMousePos(e);
        
        if (this.currentTool === 'pen' || this.currentTool === 'eraser') {
            // Handle pen and eraser (free drawing)
            this.ctx.beginPath();
            this.ctx.moveTo(this.lastX, this.lastY);
            this.ctx.lineTo(pos.x, pos.y);
            
            if (this.currentTool === 'eraser') {
                // Eraser - use white color and set composite operation
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.globalCompositeOperation = 'destination-out';
            } else {
                // Pen - use selected color
                this.ctx.strokeStyle = this.color;
                this.ctx.globalCompositeOperation = 'source-over';
            }
            
            this.ctx.stroke();
            
            // Emit drawing data in multiplayer mode
            if (this.mode === 'multiplayer' && window.multiplayerManager) {
                window.multiplayerManager.sendDrawing({
                    x: pos.x,
                    y: pos.y,
                    prevX: this.lastX,
                    prevY: this.lastY,
                    color: this.currentTool === 'eraser' ? '#ffffff' : this.color,
                    brushSize: this.brushSize,
                    tool: this.currentTool
                });
            }
            
            [this.lastX, this.lastY] = [pos.x, pos.y];
        }
    }
    
    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            
            // Handle line tool completion
            if (this.currentTool === 'line' && this.startX !== undefined) {
                const pos = this.getMousePos(event);
                this.drawLine(this.startX, this.startY, pos.x, pos.y);
                
                // Emit line data in multiplayer mode
                if (this.mode === 'multiplayer' && window.multiplayerManager) {
                    window.multiplayerManager.sendDrawing({
                        tool: 'line',
                        startX: this.startX,
                        startY: this.startY,
                        endX: pos.x,
                        endY: pos.y,
                        color: this.color,
                        brushSize: this.brushSize
                    });
                }
            }
            
            // Reset composite operation
            this.ctx.globalCompositeOperation = 'source-over';
        }
    }
    
    drawLine(startX, startY, endX, endY) {
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.strokeStyle = this.color;
        this.ctx.stroke();
    }
    
    handleTouch(e) {
        e.preventDefault();
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 'mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        }
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }
    
    clearCanvas() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = this.color;
        this.saveState();
    }
    
    resizeCanvas() {
        const parent = this.canvas.parentElement;
        if (parent) {
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            
            // Maintain aspect ratio
            const rect = parent.getBoundingClientRect();
            this.canvas.width = Math.min(800, rect.width - 30);
            this.canvas.height = Math.min(600, rect.height - 30);
            
            this.setupCanvas();
        }
    }
    
    saveState() {
        // Remove any future states if we're in the middle of undo/redo
        this.drawingHistory = this.drawingHistory.slice(0, this.historyIndex + 1);
        
        // Save current canvas state
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.drawingHistory.push(imageData);
        this.historyIndex++;
        
        // Limit history size
        if (this.drawingHistory.length > 20) {
            this.drawingHistory.shift();
            this.historyIndex--;
        }
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.ctx.putImageData(this.drawingHistory[this.historyIndex], 0, 0);
        } else if (this.historyIndex === 0) {
            this.clearCanvas();
            this.historyIndex = -1;
        }
    }
    
    redo() {
        if (this.historyIndex < this.drawingHistory.length - 1) {
            this.historyIndex++;
            this.ctx.putImageData(this.drawingHistory[this.historyIndex], 0, 0);
        }
    }
    
    // Method to draw received data (for multiplayer)
    drawReceived(data) {
        const originalColor = this.ctx.strokeStyle;
        const originalWidth = this.ctx.lineWidth;
        const originalComposite = this.ctx.globalCompositeOperation;
        
        if (data.tool === 'line') {
            // Draw line
            this.ctx.strokeStyle = data.color;
            this.ctx.lineWidth = data.brushSize;
            this.drawLine(data.startX, data.startY, data.endX, data.endY);
        } else {
            // Draw freehand (pen or eraser)
            this.ctx.strokeStyle = data.color;
            this.ctx.lineWidth = data.brushSize;
            
            if (data.tool === 'eraser') {
                this.ctx.globalCompositeOperation = 'destination-out';
            } else {
                this.ctx.globalCompositeOperation = 'source-over';
            }
            
            this.ctx.beginPath();
            this.ctx.moveTo(data.prevX, data.prevY);
            this.ctx.lineTo(data.x, data.y);
            this.ctx.stroke();
        }
        
        // Reset to current user's settings
        this.ctx.strokeStyle = originalColor;
        this.ctx.lineWidth = originalWidth;
        this.ctx.globalCompositeOperation = originalComposite;
    }
    
    // Export drawing as image
    exportImage(format = 'png', quality = 1.0) {
        return this.canvas.toDataURL(`image/${format}`, quality);
    }
}
