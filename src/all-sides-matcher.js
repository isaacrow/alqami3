// All-Sides Object Vision Matcher for Alqami
// Multi-angle recognition for the Prague Wooden Box Artifact -> Al-Qabasat (القبسات)

import signaturesData from './all-sides-signatures.json';

export class AllSidesMatcher {
  constructor(videoElement, canvasElement, hudContainer) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.hudContainer = hudContainer;
    
    this.isRunning = false;
    this.animFrameId = null;
    this.lastProcessTime = 0;
    
    // Callbacks
    this.onMatch = null;
    
    // Reference signatures
    this.signatures = signaturesData;
    
    // Internal processing canvas (low-res for 60fps analysis)
    this.procCanvas = document.createElement('canvas');
    this.procCanvas.width = 128;
    this.procCanvas.height = 128;
    this.procCtx = this.procCanvas.getContext('2d', { willReadFrequently: true });
    
    // State smoothing
    this.currentDetectedSide = null;
    this.confidenceHistory = [];
    this.lastRecognizedTime = 0;
    this.stableMatchCount = 0;
  }

  async init() {
    console.log('Initializing All-Sides Object Vision Matcher...');
    // Signatures already imported synchronously via Vite
    return true;
  }

  async start() {
    this.isRunning = true;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      this.video.srcObject = stream;
      await this.video.play();
    } catch (err) {
      console.error('Error starting camera for All-Sides Matcher:', err);
      throw err;
    }

    const onLoaded = () => {
      this.canvas.width = this.video.videoWidth || 1280;
      this.canvas.height = this.video.videoHeight || 720;
      this._loop();
    };

    if (this.video.readyState >= 2) {
      onLoaded();
    } else {
      this.video.addEventListener('loadeddata', onLoaded, { once: true });
    }
  }

  stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.video && this.video.srcObject) {
      this.video.srcObject.getTracks().forEach(track => track.stop());
      this.video.srcObject = null;
    }
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.currentDetectedSide = null;
    this.stableMatchCount = 0;
  }

  _loop() {
    if (!this.isRunning) return;

    const now = performance.now();
    // Process at ~20-25 FPS to save battery & CPU
    if (now - this.lastProcessTime > 40) {
      this.lastProcessTime = now;
      this._processFrame();
    }

    this.animFrameId = requestAnimationFrame(() => this._loop());
  }

  _processFrame() {
    if (!this.video || this.video.readyState < 2) return;

    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    if (vw === 0 || vh === 0) return;

    // Ensure canvas dimensions match video
    if (this.canvas.width !== vw || this.canvas.height !== vh) {
      this.canvas.width = vw;
      this.canvas.height = vh;
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, vw, vh);

    // Target ROI: Center box (width: 48% of screen, height: 62% of screen)
    const roiW = Math.round(vw * 0.52);
    const roiH = Math.round(vh * 0.65);
    const roiX = Math.round((vw - roiW) / 2);
    const roiY = Math.round((vh - roiH) / 2);

    // Draw central analysis downscaled into procCanvas
    this.procCtx.drawImage(
      this.video,
      roiX, roiY, roiW, roiH,
      0, 0, 128, 128
    );

    const frameData = this.procCtx.getImageData(0, 0, 128, 128);
    const pixels = frameData.data;

    // 1. Analyze color profile (warm wood check)
    let sumR = 0, sumG = 0, sumB = 0;
    const totalP = 128 * 128;
    for (let i = 0; i < pixels.length; i += 4) {
      sumR += pixels[i];
      sumG += pixels[i + 1];
      sumB += pixels[i + 2];
    }
    const avgR = sumR / totalP;
    const avgG = sumG / totalP;
    const avgB = sumB / totalP;

    // Wood color test: warm brownish-tan tone
    const isWoodTone = (avgR > 75 && avgG > 60 && avgB > 40 && avgR >= avgG && avgG >= avgB - 25);

    // 2. Extract 8x8 grid luminance & edge energy
    const GRID_SIZE = 8;
    const cellStep = 128 / GRID_SIZE; // 16px per cell
    const currLum = [];
    const currEdges = [];

    const gray = new Float32Array(128 * 128);
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const idx = (y * 128 + x) * 4;
        gray[y * 128 + x] = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
      }
    }

    for (let gy = 0; gy < GRID_SIZE; gy++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        let lumSum = 0;
        let edgeSum = 0;
        let count = 0;

        const startY = gy * cellStep;
        const startX = gx * cellStep;

        for (let y = startY; y < startY + cellStep; y++) {
          for (let x = startX; x < startX + cellStep; x++) {
            lumSum += gray[y * 128 + x];
            if (x > 0 && x < 127 && y > 0 && y < 127) {
              const gxVal = gray[y * 128 + (x + 1)] - gray[y * 128 + (x - 1)];
              const gyVal = gray[(y + 1) * 128 + x] - gray[(y - 1) * 128 + x];
              edgeSum += Math.sqrt(gxVal * gxVal + gyVal * gyVal);
            }
            count++;
          }
        }
        currLum.push(lumSum / count);
        currEdges.push(edgeSum / count);
      }
    }

    // 3. Compare with all 5 sides
    let bestSide = null;
    let bestScore = 0;

    for (const [sideKey, sig] of Object.entries(this.signatures)) {
      // Lum correlation
      const lumSim = this._cosineSimilarity(currLum, sig.gridLum);
      // Edge correlation
      const edgeSim = this._cosineSimilarity(currEdges, sig.gridEdges);
      
      // Feature bonuses:
      let bonus = 0;
      
      // Side specific features:
      if (sideKey === 'front') {
        // Front has high edge density in rows 1 to 4 (Praha gothic text & bridge)
        const upperEdges = currEdges.slice(8, 40).reduce((a, b) => a + b, 0) / 32;
        if (upperEdges > 12) bonus += 0.08;
      } else if (sideKey === 'back') {
        // Back has high-contrast white price sticker "Kč 120" in upper cells
        const upperRightLum = (currLum[11] + currLum[12] + currLum[19] + currLum[20]) / 4;
        const lowerLum = (currLum[40] + currLum[41] + currLum[48] + currLum[49]) / 4;
        if (upperRightLum > lowerLum + 15) bonus += 0.10;
      } else if (sideKey === 'side1' || sideKey === 'side2') {
        // Center vertical slot: center columns are darker than outer columns
        let centerColLum = 0, outerColLum = 0;
        for (let row = 1; row < 7; row++) {
          centerColLum += currLum[row * 8 + 3] + currLum[row * 8 + 4];
          outerColLum += currLum[row * 8 + 1] + currLum[row * 8 + 6];
        }
        if (outerColLum > centerColLum) bonus += 0.09;
      } else if (sideKey === 'top') {
        // Top cavity: inner cells are darker than borders
        const borderLum = (currLum[0] + currLum[7] + currLum[56] + currLum[63]) / 4;
        const centerLum = (currLum[27] + currLum[28] + currLum[35] + currLum[36]) / 4;
        if (borderLum > centerLum) bonus += 0.08;
      }

      // Overall composite score
      let score = (lumSim * 0.45) + (edgeSim * 0.45) + bonus;
      if (isWoodTone) score += 0.05;

      if (score > bestScore) {
        bestScore = score;
        bestSide = sig;
      }
    }

    // Temporal smoothing
    const MATCH_THRESHOLD = 0.72;
    const isMatch = (bestScore >= MATCH_THRESHOLD);

    if (isMatch) {
      this.stableMatchCount = Math.min(this.stableMatchCount + 1, 10);
      this.currentDetectedSide = bestSide;
    } else {
      this.stableMatchCount = Math.max(this.stableMatchCount - 1, 0);
      if (this.stableMatchCount === 0) {
        this.currentDetectedSide = null;
      }
    }

    // Draw AR overlay
    this._renderOverlay(roiX, roiY, roiW, roiH, isMatch, bestSide, bestScore);

    // Trigger match callback once stable
    if (this.stableMatchCount >= 3) {
      const nowMs = performance.now();
      if (nowMs - this.lastRecognizedTime > 2500) {
        this.lastRecognizedTime = nowMs;
        if (this.onMatch) {
          this.onMatch({
            side: this.currentDetectedSide,
            confidence: Math.round(Math.min(99, bestScore * 100)),
            roi: { x: roiX, y: roiY, w: roiW, h: roiH }
          });
        }
      }
    }
  }

  _cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      magA += vecA[i] * vecA[i];
      magB += vecB[i] * vecB[i];
    }
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  _renderOverlay(x, y, w, h, isMatch, detectedSide, score) {
    const ctx = this.ctx;
    const cornerLen = 32;
    const strokeWidth = isMatch ? 5 : 3;
    const mainColor = isMatch ? '#00f2fe' : 'rgba(255, 255, 255, 0.4)';
    const glowColor = isMatch ? 'rgba(0, 242, 254, 0.6)' : 'rgba(0, 0, 0, 0.2)';

    ctx.save();

    // 1. Box corners (Vision Pro brackets)
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = mainColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isMatch ? 15 : 4;
    ctx.lineCap = 'round';

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(x, y + cornerLen);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerLen, y);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(x + w - cornerLen, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + cornerLen);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(x, y + h - cornerLen);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + cornerLen, y + h);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(x + w - cornerLen, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - cornerLen);
    ctx.stroke();

    // Subtle background tint when matched
    if (isMatch) {
      ctx.fillStyle = 'rgba(0, 242, 254, 0.08)';
      ctx.fillRect(x, y, w, h);
    }

    // 2. Animated scanning beam if not matched
    if (!isMatch) {
      const time = performance.now() * 0.002;
      const scanY = y + (Math.sin(time) * 0.5 + 0.5) * h;
      ctx.beginPath();
      ctx.moveTo(x + 10, scanY);
      ctx.lineTo(x + w - 10, scanY);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.85)';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 10;
      ctx.stroke();
    }

    // 3. Information Floating Badge above target
    if (isMatch && detectedSide) {
      const pct = Math.round(Math.min(99, score * 100));
      const badgeText = `${detectedSide.icon} ${detectedSide.nameAr} • ${pct}%`;
      const titleText = `القبسات (Al-Qabasat) — الميرداماد`;

      ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const textW = Math.max(ctx.measureText(badgeText).width, ctx.measureText(titleText).width);
      const badgeW = textW + 36;
      const badgeH = 60;
      const badgeX = x + (w - badgeW) / 2;
      const badgeY = Math.max(20, y - badgeH - 14);

      // Glass pill background
      ctx.fillStyle = 'rgba(10, 16, 26, 0.88)';
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(0, 242, 254, 0.5)';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 16);
      ctx.fill();
      ctx.stroke();

      // Top line: Side name & confidence
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#00f2fe';
      ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 24);

      // Bottom line: Object Identity
      ctx.fillStyle = '#ffffff';
      ctx.font = '500 13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(titleText, badgeX + badgeW / 2, badgeY + 46);
    }

    ctx.restore();
  }
}
