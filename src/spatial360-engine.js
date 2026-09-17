import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Decoded API key
const GEMINI_KEY = atob('QVEuQWI4Uk42SWEwRUdzR1RfOWlwajM3OXpmQ1BIU2x1VldQbktRZV93MmhRR1ZPalZXMmc=');

export class Spatial360Engine {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.isRunning = false;
    this.cocoModel = null;
    this.genAI = new GoogleGenerativeAI(GEMINI_KEY);

    // Orientation tracking (360 degrees)
    this.currentHeading = 0;
    this.currentPitch = 0;
    this.currentRoll = 0;
    this.onOrientationChange = this._handleOrientation.bind(this);

    // Callbacks
    this.onTargetRecognized = null;
    this.onScanningStatus = null;

    // State
    this.isAnalyzing = false;
    this.lastAnalyzedTime = 0;
    this.lastRecognizedTarget = null;
    this.lockedTarget = null;
    this.stableFrames = 0;

    // Registered Museum Catalog
    this.catalog = {
      'alqami': {
        id: 'alqami',
        title: 'تحفة القمي الخزفية (Alqami Artifact)',
        ttl: 'alqami.ttl',
        model: 'saqakhane_bowl.glb', // or 3d representation
        keywords: ['خزف', 'فخار', 'غطاء', 'قمي', 'alqami', 'vase', 'bowl', 'ceramic']
      },
      'zulfiqar': {
        id: 'zulfiqar',
        title: 'سيف ذو الفقار (Zulfiqar Sword)',
        ttl: 'Zulfiqar_Sword.ttl',
        model: 'Zulfiqar_Sword.glb',
        keywords: ['سيف', 'ذو الفقار', 'sword', 'blade', 'weapon']
      },
      'shrine': {
        id: 'shrine',
        title: 'مرقد الإمام الحسين (Shrine of Imam Hussein)',
        ttl: 'shrine_of_imam_hussein.ttl',
        model: 'shrine_of_imam_hussein.glb',
        keywords: ['مرقد', 'ضريح', 'قبة', 'حسين', 'shrine', 'dome']
      },
      'minaret': {
        id: 'minaret',
        title: 'المنارة الذهبية (Golden Minaret)',
        ttl: 'golden_minaret.ttl',
        model: 'golden_minaret.glb',
        keywords: ['منارة', 'مئذنة', 'minaret', 'tower']
      },
      'bowl': {
        id: 'bowl',
        title: 'طاسة سقاخانة (Saqakhane Bowl)',
        ttl: 'saqakhane_bowl.ttl',
        model: 'saqakhane_bowl.glb',
        keywords: ['طاسة', 'وعاء', 'إناء', 'bowl', 'cup']
      },
      'manuscript': {
        id: 'manuscript',
        title: 'مخطوط القبسات (Al-Qabasat)',
        ttl: 'model.ttl',
        model: 'model.glb',
        keywords: ['مخطوط', 'القبسات', 'كتاب', 'ورق', 'manuscript', 'book']
      },
      'quran': {
        id: 'quran',
        title: 'المصحف الشريف المذهب (Illuminated Quran)',
        ttl: 'quran.ttl',
        model: 'model.glb',
        keywords: ['قرآن', 'مصحف', 'تذهيب', 'نسخ', 'quran']
      },
      'kufic': {
        id: 'kufic',
        title: 'المصحف الكوفي العتيق (Kufic Quran)',
        ttl: 'kufic.ttl',
        model: 'model.glb',
        keywords: ['كوفي', 'رق', 'غزال', 'kufic']
      },
      'helmet': {
        id: 'helmet',
        title: 'خوذة إسلامية حربية (Islamic Helmet)',
        ttl: 'Old_Islamic_Helmet.ttl',
        model: 'Old_Islamic_Helmet.glb',
        keywords: ['خوذة', 'درع', 'فولاذ', 'helmet', 'armor']
      },
      'tablet': {
        id: 'tablet',
        title: 'لوح مسماري بابلي (Cuneiform Tablet)',
        ttl: 'old-babylonian_cuneiform_tablet_s264.ttl',
        model: 'old-babylonian_cuneiform_tablet_s264.glb',
        keywords: ['مسماري', 'بابلي', 'لوح', 'cuneiform', 'tablet']
      }
    };
  }

  async init() {
    if (!this.cocoModel) {
      try {
        this.cocoModel = await cocoSsd.load();
      } catch (err) {
        console.warn('COCO-SSD initial load warning:', err);
      }
    }
  }

  async start() {
    this.isRunning = true;

    // Start orientation sensor listener
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', this.onOrientationChange, true);
    }

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
      console.error('Camera access error in Spatial360Engine:', err);
      return;
    }

    if (this.canvas) {
      this.canvas.width = this.video.videoWidth || 1280;
      this.canvas.height = this.video.videoHeight || 720;
    }

    this._runLoop();
  }

  stop() {
    this.isRunning = false;
    if (this.video && this.video.srcObject) {
      this.video.srcObject.getTracks().forEach(t => t.stop());
      this.video.srcObject = null;
    }
    if (window.DeviceOrientationEvent) {
      window.removeEventListener('deviceorientation', this.onOrientationChange, true);
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  _handleOrientation(event) {
    if (event.alpha !== null) {
      this.currentHeading = Math.round(event.alpha);
    }
    if (event.beta !== null) {
      this.currentPitch = Math.round(event.beta);
    }
    if (event.gamma !== null) {
      this.currentRoll = Math.round(event.gamma);
    }
  }

  async _runLoop() {
    if (!this.isRunning) return;

    if (this.canvas && this.ctx && this.video && this.video.readyState >= 2) {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
      this._drawSpatialReticle();
    }

    // Periodically run auto scan if center has stable object
    const now = performance.now();
    if (!this.isAnalyzing && (now - this.lastAnalyzedTime > 3500)) {
      this._checkCenterObjectFor360Scan();
    }

    requestAnimationFrame(() => this._runLoop());
  }

  _drawSpatialReticle() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.28;

    this.ctx.clearRect(0, 0, w, h);

    const now = performance.now();
    const isLocked = Boolean(this.lockedTarget);
    const mainColor = isLocked ? '#ffd700' : '#00e5ff';
    const accentColor = isLocked ? 'rgba(255, 215, 0, 0.4)' : 'rgba(0, 229, 255, 0.3)';

    // Outer 360 Rotating Compass Ring
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate((now * 0.0008) % (Math.PI * 2));

    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius + 20, 0, Math.PI * 2);
    this.ctx.strokeStyle = accentColor;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([8, 12]);
    this.ctx.stroke();

    // 4 Cardinal Axis ticks
    for (let i = 0; i < 4; i++) {
      this.ctx.rotate(Math.PI / 2);
      this.ctx.beginPath();
      this.ctx.moveTo(radius + 10, 0);
      this.ctx.lineTo(radius + 28, 0);
      this.ctx.strokeStyle = mainColor;
      this.ctx.lineWidth = 3;
      this.ctx.stroke();
    }
    this.ctx.restore();

    // Inner Targeting Reticle
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.strokeStyle = isLocked ? '#ffd700' : 'rgba(255, 255, 255, 0.8)';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // Corner targeting brackets
    const bracketSize = 25;
    const bOffset = radius * 0.85;

    this.ctx.strokeStyle = mainColor;
    this.ctx.lineWidth = 4;
    // Top-Left
    this.ctx.beginPath();
    this.ctx.moveTo(cx - bOffset, cy - bOffset + bracketSize);
    this.ctx.lineTo(cx - bOffset, cy - bOffset);
    this.ctx.lineTo(cx - bOffset + bracketSize, cy - bOffset);
    this.ctx.stroke();

    // Top-Right
    this.ctx.beginPath();
    this.ctx.moveTo(cx + bOffset - bracketSize, cy - bOffset);
    this.ctx.lineTo(cx + bOffset, cy - bOffset);
    this.ctx.lineTo(cx + bOffset, cy - bOffset + bracketSize);
    this.ctx.stroke();

    // Bottom-Left
    this.ctx.beginPath();
    this.ctx.moveTo(cx - bOffset, cy + bOffset - bracketSize);
    this.ctx.lineTo(cx - bOffset, cy + bOffset);
    this.ctx.lineTo(cx - bOffset + bracketSize, cy + bOffset);
    this.ctx.stroke();

    // Bottom-Right
    this.ctx.beginPath();
    this.ctx.moveTo(cx + bOffset - bracketSize, cy + bOffset);
    this.ctx.lineTo(cx + bOffset, cy + bOffset);
    this.ctx.lineTo(cx + bOffset, cy + bOffset - bracketSize);
    this.ctx.stroke();

    // Angle & Gyro Display HUD
    this.ctx.font = 'bold 18px -apple-system, sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';

    const angleText = `360° SPATIAL TRACKER • ${this.currentHeading}°`;
    this.ctx.fillText(angleText, cx, cy - radius - 35);

    if (this.isAnalyzing) {
      this.ctx.fillStyle = '#ffd700';
      this.ctx.fillText('⚡ جاري الفحص المجسم 360°...', cx, cy + radius + 40);
    } else if (this.lockedTarget) {
      this.ctx.fillStyle = '#00ff88';
      this.ctx.fillText(`✓ تم التعرف: ${this.lockedTarget.title}`, cx, cy + radius + 40);
    } else {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      this.ctx.fillText('ضع المجسم داخل الإطار من أي زاوية (360°)', cx, cy + radius + 40);
    }

    this.ctx.restore();
  }

  async _checkCenterObjectFor360Scan() {
    if (!this.video || !this.video.videoWidth) return;

    // Fast preliminary scan using COCO-SSD if available
    if (this.cocoModel) {
      try {
        const predictions = await this.cocoModel.detect(this.video);
        const w = this.video.videoWidth;
        const h = this.video.videoHeight;
        const cx = w / 2;
        const cy = h / 2;

        // Check if any object is near the center reticle
        const centerObj = predictions.find(p => {
          const [bx, by, bw, bh] = p.bbox;
          const objCx = bx + bw / 2;
          const objCy = by + bh / 2;
          const dist = Math.hypot(objCx - cx, objCy - cy);
          return dist < Math.min(w, h) * 0.35 && p.score > 0.45;
        });

        if (centerObj) {
          this.stableFrames++;
          if (this.stableFrames >= 2) {
            this.stableFrames = 0;
            await this.performDeep360Scan();
          }
        } else {
          this.stableFrames = 0;
        }
      } catch (err) {
        console.warn('Center check error:', err);
      }
    }
  }

  async performDeep360Scan() {
    if (this.isAnalyzing || !this.video || !this.video.videoWidth) return;

    this.isAnalyzing = true;
    this.lastAnalyzedTime = performance.now();
    if (this.onScanningStatus) this.onScanningStatus('جاري التحليل المجسم 360°...');

    try {
      // Capture crisp snapshot from video
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(this.video.videoWidth, 800);
      canvas.height = Math.round(canvas.width * (this.video.videoHeight / this.video.videoWidth));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

      const prompt = `أنت نظام التعرف على القطع الأثرية والمجسمات في متحف القمي الذكي (Alqami 360 Spatial Object Recognizer).
المطلوب منك فحص هذا المجسم الملتقط بالكاميرا من أي زاوية كانت (360 درجة، من الأعلى، الجوانب، القاعدة، أو المائل).
طابق المجسم مع إحدى القطع المسجلة في قاعدة بيانات المتحف التالية بدقة:
1. [alqami] - تحفة القمي الخزفية (قطعة فخارية ملونة ومزججة، ألوان أخضر زمردي وبرتقالي وأبيض، تاج علوي كشكل الرمانة، زخارف خليلية أو إسلامية ملونة).
2. [zulfiqar] - سيف ذو الفقار (سيف ذو نصلين، مقبض مزخرف، فولاذ دمشقي).
3. [shrine] - مرقد الإمام الحسين (قبة ذهبية، مآذن، عمارة إسلامية شريفة).
4. [minaret] - المنارة الذهبية لمرقد الإمام علي (مئذنة ذهبية إسلامية شاهقة).
5. [bowl] - طاسة سقاخانة أو وعاء أثري نحاسي أو برونزي مزخرف.
6. [manuscript] - مخطوط القبسات (مخطوط قديم بخط النستعليق على ورق).
7. [quran] - مصحف شريف مذهب (مخطوط قرآني مزخرف بالذهب).
8. [kufic] - مصحف كوفي عتيق (رق غزال أصفر فاتح، خط كوفي قديم).
9. [helmet] - خوذة إسلامية حربية (خوذة فولاذية عسكرية ذات واقية أنف).
10. [tablet] - لوح مسماري بابلي (لوح طيني أو حجري منقوش بكتابة مسمارية).

أجب فقط بصيغة JSON بدون أي كلام إضافي:
{
  "matched": true,
  "targetId": "alqami",
  "confidence": 95,
  "angleDetected": "جانبي 360°",
  "briefReason": "تم التعرف على الزخارف الخزفية والتاج العلوي"
}`;

      const candidateModels = [
        'gemini-3.5-flash',
        'gemini-3.6-flash',
        'gemini-flash-latest',
        'gemini-pro-latest'
      ];

      let parsed = null;

      for (const modelName of candidateModels) {
        try {
          const model = this.genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent([
            prompt,
            {
              inlineData: {
                data: base64,
                mimeType: 'image/jpeg'
              }
            }
          ]);
          const text = (await result.response).text();
          // Extract JSON
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
            break;
          }
        } catch (err) {
          console.warn(`Model ${modelName} failed during 360 scan, trying next:`, err.message);
          continue;
        }
      }

      if (parsed && parsed.matched && parsed.targetId && this.catalog[parsed.targetId]) {
        const item = this.catalog[parsed.targetId];
        this.lockedTarget = item;
        if (this.onTargetRecognized) {
          this.onTargetRecognized(item, parsed);
        }
        if (this.onScanningStatus) {
          this.onScanningStatus(`تم التعرف: ${item.title} (${parsed.angleDetected || '360°'})`);
        }
      } else {
        if (this.onScanningStatus) {
          this.onScanningStatus('لم يتم التعرف على قطعة مسجلة من هذه الزاوية. حرك الكاميرا.');
        }
      }
    } catch (err) {
      console.warn('Deep 360 scan error:', err);
    } finally {
      this.isAnalyzing = false;
    }
  }
}
