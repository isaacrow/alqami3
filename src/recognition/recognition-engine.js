// Closed-Set Custom Artifact Recognition Engine for Alqami
import { FeatureExtractor } from './feature-extractor.js';
import { SimilarityMetrics } from './similarity.js';
import { TemporalStabilityFilter } from './temporal-filter.js';
import { ArtifactDatabase } from '../database/artifact-db.js';

export class ClosedSetRecognitionEngine {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    
    this.featureExtractor = new FeatureExtractor();
    this.db = new ArtifactDatabase();
    this.temporalFilter = new TemporalStabilityFilter({
      requiredConsecutiveFrames: 3,
      debounceMs: 350,
      lossGraceMs: 900
    });

    this.artifacts = [];
    this.globalThreshold = 0.65; // Configurable (0.00 - 1.00)
    this.isRunning = false;
    this.animFrameId = null;
    this.isProcessingFrame = false;

    // Callbacks
    this.onEvaluation = null;        // Emits every frame for HUD / live inspector
    this.onArtifactConfirmed = null; // Emits when artifact passes threshold & temporal filter
    this.onArtifactLost = null;      // Emits when recognition is lost / unknown
    
    this.lastConfirmedId = null;
  }

  async init() {
    console.log('Initializing Closed-Set Recognition Engine...');
    await Promise.all([
      this.featureExtractor.init(),
      this.db.init()
    ]);
    this.artifacts = await this.db.getAll();
    console.log(`Loaded ${this.artifacts.length} registered artifacts into recognition index.`);
    return true;
  }

  async reloadDatabase() {
    this.artifacts = await this.db.getAll();
    console.log(`Reloaded ${this.artifacts.length} artifacts in recognition engine.`);
  }

  setThreshold(thresholdValue) {
    this.globalThreshold = Math.max(0.0, Math.min(1.0, parseFloat(thresholdValue)));
    console.log(`Updated recognition threshold: ${this.globalThreshold}`);
  }

  async start() {
    if (!this.artifacts || this.artifacts.length === 0) {
      await this.init();
    }

    this.isRunning = true;
    this.temporalFilter.reset();

    // Access camera
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
      console.error('Camera access error in Closed-Set Engine:', err);
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
      this.video.srcObject.getTracks().forEach(t => t.stop());
      this.video.srcObject = null;
    }
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.temporalFilter.reset();
    this.lastConfirmedId = null;
  }

  _loop() {
    if (!this.isRunning) return;

    if (!this.isProcessingFrame && this.video.readyState >= 2) {
      this.isProcessingFrame = true;
      this._processFrame().finally(() => {
        this.isProcessingFrame = false;
      });
    }

    this.animFrameId = requestAnimationFrame(() => this._loop());
  }

  async _processFrame() {
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    if (vw === 0 || vh === 0) return;

    if (this.canvas.width !== vw || this.canvas.height !== vh) {
      this.canvas.width = vw;
      this.canvas.height = vh;
    }

    // ROI: Central square area (65% of smaller dimension)
    const roiSize = Math.round(Math.min(vw, vh) * 0.68);
    const roi = {
      x: Math.round((vw - roiSize) / 2),
      y: Math.round((vh - roiSize) / 2),
      width: roiSize,
      height: roiSize
    };

    // 1. Extract 1024-D embedding from camera ROI
    let queryEmbedding;
    try {
      queryEmbedding = await this.featureExtractor.extractFromCrop(this.video, roi);
    } catch (e) {
      console.warn('Embedding extraction skipped frame:', e);
      return;
    }

    // 2. Vector search against registered multi-view artifact embeddings
    const evalResult = SimilarityMetrics.evaluate(queryEmbedding, this.artifacts);
    const bestCandidate = evalResult.bestMatch;
    const topScore = evalResult.topScore;

    // 3. Strict Closed-Set Threshold Gate
    const targetThreshold = bestCandidate?.artifact?.recognitionThreshold ?? this.globalThreshold;
    const passesThreshold = (bestCandidate && topScore >= targetThreshold);
    if (bestCandidate) {
      bestCandidate.roi = roi;
    }

    // 4. Temporal Filter
    const filterInput = passesThreshold ? bestCandidate : null;
    const temporalResult = this.temporalFilter.process(filterInput);

    // 5. Render AR Reticle & Dynamic Badges
    this._renderVisuals(roi, passesThreshold, temporalResult, bestCandidate, topScore, targetThreshold);

    // 6. Notify subscribers
    const evalReport = {
      recognized: temporalResult.status === 'CONFIRMED',
      status: temporalResult.status,
      bestCandidate: bestCandidate,
      topScore: Math.round(topScore * 1000) / 10,
      threshold: Math.round(targetThreshold * 1000) / 10,
      roi: roi,
      candidates: evalResult.candidates.map(c => ({
        id: c.id,
        title: c.title,
        similarity: Math.round(c.similarity * 1000) / 10,
        matchedView: c.matchedView
      }))
    };

    if (this.onEvaluation) {
      this.onEvaluation(evalReport);
    }

    if (temporalResult.status === 'CONFIRMED' && temporalResult.candidate) {
      if (this.lastConfirmedId !== temporalResult.candidate.id) {
        this.lastConfirmedId = temporalResult.candidate.id;
        if (this.onArtifactConfirmed) {
          this.onArtifactConfirmed(temporalResult.candidate);
        }
      }
    } else if (temporalResult.status === 'UNKNOWN') {
      if (this.lastConfirmedId !== null) {
        this.lastConfirmedId = null;
        if (this.onArtifactLost) {
          this.onArtifactLost();
        }
      }
    }
  }

  _renderVisuals(roi, passesThreshold, temporal, bestCandidate, topScore, threshold) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const x = roi.x;
    const y = roi.y;
    const w = roi.width;
    const h = roi.height;
    const corner = 32;

    ctx.save();

    const isConfirmed = temporal.status === 'CONFIRMED';
    const isUnknown = temporal.status === 'UNKNOWN';

    // Reticle Colors
    let color = 'rgba(255, 255, 255, 0.4)';
    let glow = 'transparent';

    if (isConfirmed) {
      color = '#00f2fe'; // Vision cyan
      glow = 'rgba(0, 242, 254, 0.6)';
    } else if (isUnknown && topScore > 0) {
      color = '#ff9f0a'; // Warning amber for unknown
      glow = 'rgba(255, 159, 10, 0.4)';
    }

    // Draw Corner Brackets
    ctx.lineWidth = isConfirmed ? 5 : 3;
    ctx.strokeStyle = color;
    ctx.shadowColor = glow;
    ctx.shadowBlur = isConfirmed ? 16 : 6;
    ctx.lineCap = 'round';

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(x, y + corner);
    ctx.lineTo(x, y);
    ctx.lineTo(x + corner, y);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(x + w - corner, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + corner);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(x, y + h - corner);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + corner, y + h);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(x + w - corner, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - corner);
    ctx.stroke();

    // Floating Badge above Reticle
    const badgeW = Math.min(w, 360);
    const badgeH = 58;
    const badgeX = x + (w - badgeW) / 2;
    const badgeY = Math.max(16, y - badgeH - 14);

    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 16);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';

    if (isConfirmed && bestCandidate) {
      // Confirmed Artifact
      const pct = Math.round(topScore * 100);
      ctx.fillStyle = '#00f2fe';
      ctx.font = 'bold 15px -apple-system, sans-serif';
      ctx.fillText(`✓ ${bestCandidate.id} • ${pct}% [${bestCandidate.matchedView.toUpperCase()}]`, badgeX + badgeW / 2, badgeY + 24);

      ctx.fillStyle = '#ffffff';
      ctx.font = '600 13px -apple-system, sans-serif';
      const shortTitle = bestCandidate.title.length > 32 ? bestCandidate.title.slice(0, 30) + '…' : bestCandidate.title;
      ctx.fillText(shortTitle, badgeX + badgeW / 2, badgeY + 44);
    } else {
      // Unknown Artifact / Scanning
      ctx.fillStyle = '#ff9f0a';
      ctx.font = 'bold 14px -apple-system, sans-serif';
      ctx.fillText(`⚠️ UNKNOWN ARTIFACT`, badgeX + badgeW / 2, badgeY + 23);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '12px -apple-system, sans-serif';
      const topPct = Math.round(topScore * 100);
      const thPct = Math.round(threshold * 100);
      ctx.fillText(`Top Match: ${topPct}% (Threshold: ${thPct}%)`, badgeX + badgeW / 2, badgeY + 43);
    }

    ctx.restore();
  }
}
