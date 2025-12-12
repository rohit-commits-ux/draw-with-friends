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
        this.currentTool = 'pen'; // pen, eraser, line, fill
        
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
        
        // Handle fill tool on click (not drag)
        if (this.currentTool === 'fill') {
            this.floodFill(pos.x, pos.y, this.color);
            this.isDrawing = false;
            return;
        }
        
        // For line tool
        if (this.currentTool === 'line') {
            this.startX = pos.x;
            this.startY = pos.y;
        }
        
        // Save state for undo
        this.saveState();
    }
    
    draw(e) {
        if (!this.isDrawing) return;
        if (this.currentTool === 'fill') return; // Fill doesn't use drag
        
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
    
    // Flood Fill Algorithm (Bucket Tool)
    floodFill(startX, startY, fillColor) {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const pixels = imageData.data;
        const startPos = (Math.floor(startY) * this.canvas.width + Math.floor(startX)) * 4;
        
        // Get the color at the starting point
        const startR = pixels[startPos];
        const startG = pixels[startPos + 1];
        const startB = pixels[startPos + 2];
        const startA = pixels[startPos + 3];
        
        // Convert fill color to RGBA
        const fillRGBA = this.hexToRgba(fillColor);
        
        // If we're trying to fill with the same color, do nothing
        if (startR === fillRGBA.r && startG === fillRGBA.g && startB === fillRGBA.b && startA === fillRGBA.a) {
            return;
        }
        
        const stack = [[Math.floor(startX), Math.floor(startY)]];
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const pos = (y * width + x) * 4;
            
            // Check bounds
            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            
            // Check if pixel matches the target color
            if (pixels[pos] === startR && 
                pixels[pos + 1] === startG && 
                pixels[pos + 2] === startB && 
                pixels[pos + 3] === startA) {
                
                // Set the new color
                pixels[pos] = fillRGBA.r;
                pixels[pos + 1] = fillRGBA.g;
                pixels[pos + 2] = fillRGBA.b;
                pixels[pos + 3] = fillRGBA.a;
                
                // Add neighboring pixels to stack
                stack.push([x + 1, y]);
                stack.push([x - 1, y]);
                stack.push([x, y + 1]);
                stack.push([x, y - 1]);
            }
        }
        
        // Put the modified image data back
        this.ctx.putImageData(imageData, 0, 0);
        
        // Save state for undo
        this.saveState();
        
        // Emit fill data in multiplayer mode
        if (this.mode === 'multiplayer' && window.multiplayerManager) {
            window.multiplayerManager.sendDrawing({
                tool: 'fill',
                x: startX,
                y: startY,
                color: fillColor
            });
        }
    }
    
    hexToRgba(hex) {
        // Remove # if present
        hex = hex.replace('#', '');
        
        // Parse hex values
        let r, g, b, a = 255;
        
        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length === 6) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else if (hex.length === 8) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
            a = parseInt(hex.substring(6, 8), 16);
        }
        
        return { r, g, b, a };
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
        
        if (data.tool === 'fill') {
            // Handle fill tool
            this.floodFill(data.x, data.y, data.color);
        } else if (data.tool === 'line') {
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
