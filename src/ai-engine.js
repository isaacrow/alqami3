import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

export class AIEngine {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.model = null;
    this.isRunning = false;
    this.onObjectDetected = null; // Callback when object found
  }

  async init() {
    console.log('Loading AI Object Detection Model...');
    this.model = await cocoSsd.load();
    console.log('AI Model loaded!');
  }

  async start() {
    if (!this.model) await this.init();
    this.isRunning = true;
    
    // Setup camera stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      this.video.srcObject = stream;
      this.video.play();
    } catch (err) {
      console.error('Error accessing camera for AI Mode:', err);
      return;
    }

    this.video.addEventListener('loadeddata', () => {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
      this.detectFrame();
    });
  }

  stop() {
    this.isRunning = false;
    if (this.video.srcObject) {
      this.video.srcObject.getTracks().forEach(track => track.stop());
      this.video.srcObject = null;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  async detectFrame() {
    if (!this.isRunning) return;

    const predictions = await this.model.detect(this.video);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw bounding boxes
    predictions.forEach(prediction => {
      const isAlqami = (prediction.class === 'vase' || prediction.class === 'bowl');
      const displayName = isAlqami ? `alqami (تحفة القمي)` : `${prediction.class}`;
      const reportedClass = isAlqami ? 'alqami' : prediction.class;

      // Draw box
      this.ctx.beginPath();
      this.ctx.rect(...prediction.bbox);
      this.ctx.lineWidth = isAlqami ? 5 : 3;
      this.ctx.strokeStyle = isAlqami ? 'rgba(255, 215, 0, 0.95)' : 'rgba(0, 255, 128, 0.85)';
      this.ctx.fillStyle = isAlqami ? 'rgba(255, 215, 0, 0.2)' : 'rgba(0, 255, 128, 0.15)';
      this.ctx.stroke();
      this.ctx.fill();

      // Draw label badge
      const labelText = `${displayName} (${Math.round(prediction.score * 100)}%)`;
      this.ctx.font = 'bold 20px -apple-system, sans-serif';
      const textWidth = this.ctx.measureText(labelText).width;
      
      this.ctx.fillStyle = isAlqami ? 'rgba(20, 15, 0, 0.88)' : 'rgba(0, 0, 0, 0.75)';
      this.ctx.fillRect(prediction.bbox[0], Math.max(0, prediction.bbox[1] - 32), textWidth + 24, 32);
      
      this.ctx.fillStyle = isAlqami ? '#ffd700' : '#00ff80';
      this.ctx.fillText(
        labelText, 
        prediction.bbox[0] + 12, 
        Math.max(22, prediction.bbox[1] - 8)
      );

      // Trigger callback if confidence is acceptable
      if (prediction.score > 0.50 && this.onObjectDetected) {
        this.onObjectDetected(reportedClass, prediction.bbox);
      }
    });

    requestAnimationFrame(() => this.detectFrame());
  }
}
