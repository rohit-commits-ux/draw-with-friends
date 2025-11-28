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
        this.brushSize = 5;
        this.color = '#000000';
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupTools();
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
        
        // Keyboard events for undo/redo
        document.addEventListener('keydown', this.handleKeyboard.bind(this));
    }
    
    setupTools() {
        const brushSize = document.getElementById('brushSize');
        const brushSizeValue = document.getElementById('brushSizeValue');
        const colorPicker = document.getElementById('colorPicker');
        const clearBtn = document.getElementById('clearBtn');
        const undoBtn = document.getElementById('undoBtn');
        
        if (brushSize) {
            brushSize.addEventListener('input', (e) => {
                this.brushSize = parseInt(e.target.value);
                this.ctx.lineWidth = this.brushSize;
                if (brushSizeValue) {
                    brushSizeValue.textContent = `${this.brushSize}px`;
                }
            });
        }
        
        if (colorPicker) {
            colorPicker.addEventListener('input', (e) => {
                this.color = e.target.value;
                this.ctx.strokeStyle = this.color;
            });
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearCanvas();
                if (this.mode === 'multiplayer' && window.multiplayerManager) {
                    window.multiplayerManager.clearCanvas();
                }
            });
        }
        
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                this.undo();
            });
        }
        
        // Color presets
        document.querySelectorAll('.color-preset').forEach(preset => {
            preset.addEventListener('click', () => {
                const color = preset.getAttribute('data-color');
                this.color = color;
                this.ctx.strokeStyle = color;
                if (colorPicker) {
                    colorPicker.value = color;
                }
            });
        });
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        const pos = this.getMousePos(e);
        [this.lastX, this.lastY] = [pos.x, pos.y];
        
        // Save state for undo
        this.saveState();
    }
    
    draw(e) {
        if (!this.isDrawing) return;
        
        e.preventDefault();
        const pos = this.getMousePos(e);
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
        
        // Emit drawing data in multiplayer mode
        if (this.mode === 'multiplayer' && window.multiplayerManager) {
            window.multiplayerManager.sendDrawing({
                x: pos.x,
                y: pos.y,
                prevX: this.lastX,
                prevY: this.lastY,
                color: this.color,
                brushSize: this.brushSize
            });
        }
        
        [this.lastX, this.lastY] = [pos.x, pos.y];
    }
    
    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
        }
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
    
    handleKeyboard(e) {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
                e.preventDefault();
                this.redo();
            }
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
        if (this.drawingHistory.length > 50) {
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
        
        this.ctx.strokeStyle = data.color;
        this.ctx.lineWidth = data.brushSize;
        
        this.ctx.beginPath();
        this.ctx.moveTo(data.prevX, data.prevY);
        this.ctx.lineTo(data.x, data.y);
        this.ctx.stroke();
        
        // Reset to current user's settings
        this.ctx.strokeStyle = originalColor;
        this.ctx.lineWidth = originalWidth;
    }
    
    // Export drawing as image
    exportImage(format = 'png', quality = 1.0) {
        return this.canvas.toDataURL(`image/${format}`, quality);
    }
}
