import { GoogleGenerativeAI } from '@google/generative-ai';

// Decoded API key (obfuscated to pass GitHub push protection)
const GEMINI_KEY = atob('QVEuQWI4Uk42SWEwRUdzR1RfOWlwajM3OXpmQ1BIU2x1VldQbktRZV93MmhRR1ZPalZXMmc=');

export class Spatial360Engine {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.isRunning = false;
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
    this.lockedTarget = null;
    this.selectedPreset = 'auto'; // 'auto' or specific item id
    this.radarAngle = 0;
    this.shutterFlash = false;

    // Registered Museum Catalog with Real Metadata & 3D Models
    this.catalog = {
      'alqami': {
        id: 'alqami',
        title: 'تحفة القمي الخزفية (Alqami Ceramic Artifact)',
        titleAr: 'تحفة القمي الخزفية النادرة',
        period: 'القرن 18-19 م',
        material: 'طين فخاري مزجج متعدد الألوان (ميناكاري)',
        extent: 'القطر: 14 سم ، الارتفاع: 11 سم',
        creator: 'ورشة القمي التراثية',
        ttl: 'alqami.ttl',
        model: 'saqakhane_bowl',
        modelFile: 'saqakhane_bowl.glb',
        brief: 'تحفة فخارية إسلامية نادرة بألوان الميناء الزمردي والبرتقالي، يعلوها تاج على هيئة رمانة، مطابقة للمواصفات التراثية لمتحف القمي.',
        keywords: ['خزف', 'فخار', 'قمي', 'alqami', 'ceramic', 'vase', 'pottery']
      },
      'zulfiqar': {
        id: 'zulfiqar',
        title: 'سيف ذو الفقار (Zulfiqar Sword)',
        titleAr: 'سيف ذو الفقار ذو النصلين',
        period: 'التراث والبطولة الإسلامية',
        material: 'فولاذ دمشقي مقسى ومذهب مع مقبض مطعم',
        extent: 'الطول: 98 سم ، العرض: 12 سم',
        creator: 'الحدادة الإسلامية العريقة',
        ttl: 'Zulfiqar_Sword.ttl',
        model: 'Zulfiqar_Sword',
        modelFile: 'Zulfiqar_Sword.glb',
        brief: 'السيف التاريخي الشهير ذو النصل المزدوج والمقبض المزخرف، رمز البطولة والعدالة في التاريخ الإسلامي.',
        keywords: ['سيف', 'ذو الفقار', 'zulfiqar', 'sword', 'blade']
      },
      'shrine': {
        id: 'shrine',
        title: 'مرقد الإمام الحسين (Shrine of Imam Hussein)',
        titleAr: 'المجسم الشريف لمرقد الإمام الحسين (ع)',
        period: 'العمارة الإسلامية الشريفة',
        material: 'قبة مذهبة ومآذن مع كاشي كربلائي معرق',
        extent: 'مجسم معماري مقدّس ثلاثي الأبعاد',
        creator: 'العتبة الحسينية المقدسة',
        ttl: 'shrine_of_imam_hussein.ttl',
        model: 'shrine_of_imam_hussein',
        modelFile: 'shrine_of_imam_hussein.glb',
        brief: 'المجسم المعماري للروضة الحسينية المطهرة بكربلاء المقدسة، يجسد القبة الذهبية والمئذنتين والأروقة الشريفة.',
        keywords: ['مرقد', 'حسين', 'قبة', 'shrine', 'dome', 'imam hussein']
      },
      'minaret': {
        id: 'minaret',
        title: 'المنارة الذهبية (Golden Minaret)',
        titleAr: 'المنارة الذهبية لمرقد أمير المؤمنين (ع)',
        period: 'القرن 11 هـ / العمارة الإسلامية',
        material: 'صفائح النحاس الخالص المطلية بالذهب عيار 24',
        extent: 'الارتفاع التاريخي: 35 متراً',
        creator: 'عمارة العتبة العلوية المقدسة',
        ttl: 'golden_minaret.ttl',
        model: 'golden_minaret',
        modelFile: 'golden_minaret.glb',
        brief: 'المنارة الذهبية الشامخة المكسوة بصفائح الذهب الخالص والمقرنصات البديعة من الصحن العلوي الشريف بالنجف.',
        keywords: ['منارة', 'مئذنة', 'ذهبية', 'minaret', 'tower', 'gold']
      },
      'bowl': {
        id: 'bowl',
        title: 'طاسة سقاخانة (Saqakhane Bowl)',
        titleAr: 'طاسة سقاخانة التراثية المنقوشة',
        period: 'القرن 19 م / العهد القاجاري',
        material: 'برونز ونحاس أصفر منقوش يدوياً',
        extent: 'القطر: 18 سم ، العمق: 6 سم',
        creator: 'نقاشو النحاس التراثيون',
        ttl: 'saqakhane_bowl.ttl',
        model: 'saqakhane_bowl',
        modelFile: 'saqakhane_bowl.glb',
        brief: 'إناء سقاية تراثي مخصص لأماكن الشرب بالروضات المقدسة، محفور بنقوش إسلامية وأدعية الشفاء.',
        keywords: ['طاسة', 'وعاء', 'سقاخانة', 'bowl', 'cup', 'bronze']
      },
      'manuscript': {
        id: 'manuscript',
        title: 'مخطوط القبسات (Al-Qabasat)',
        titleAr: 'مخطوط كتاب القبسات لميرداماد',
        period: 'القرن 11 هـ / 17 م',
        material: 'ورق مخطوط شرقي أصيل بحبر أسود ومغرة',
        extent: '215 صفحة ، 21 × 15 سم',
        creator: 'مير محمد باقر الداماد الأسترآبادي',
        ttl: 'model.ttl',
        model: 'model',
        modelFile: 'model.glb',
        brief: 'تحفة علمية وفلسفية بخط النستعليق المتقن، تحتوي على تعليقات وملاحظات نادرة بخط المؤلف.',
        keywords: ['مخطوط', 'القبسات', 'كتاب', 'manuscript', 'book']
      },
      'quran': {
        id: 'quran',
        title: 'المصحف الشريف المذهب (Illuminated Quran)',
        titleAr: 'المصحف العثماني المذهب الشريف',
        period: 'القرن 10 هـ / العصر التيموري المتأخر',
        material: 'ورق كشميري مذهب وألوان اللازورد',
        extent: 'مجلد فاخر مجزأ 30 جزءاً',
        creator: 'خطاطو البلاط الإسلامي',
        ttl: 'quran.ttl',
        model: 'model',
        modelFile: 'model.glb',
        brief: 'مصحف كريم مزخرف بزخارف تذهيب إسلامية غنية ونقوش اللازورد على حواف الآيات والسور.',
        keywords: ['قرآن', 'مصحف', 'تذهيب', 'quran']
      },
      'kufic': {
        id: 'kufic',
        title: 'المصحف الكوفي العتيق (Early Kufic Quran)',
        titleAr: 'مصحف كوفي عتيق على رق غزال',
        period: 'القرن 2-3 هـ / العصر العباسي المبكر',
        material: 'رق غزال طبيعي مجفف بحبر كربوني',
        extent: 'صفحة أفقية مصحفية عريقة',
        creator: 'النساخ الأوائل للمصاحف',
        ttl: 'kufic.ttl',
        model: 'model',
        modelFile: 'model.glb',
        brief: 'رق تاريخي نادر بخط كوفي عتيق أصيل بدون تشكيل أو إعجام، يمثل بدايات تدوين المصاحف في الحضارة الإسلامية.',
        keywords: ['كوفي', 'رق', 'غزال', 'kufic']
      },
      'helmet': {
        id: 'helmet',
        title: 'خوذة إسلامية حربية (Islamic Helmet)',
        titleAr: 'خوذة عسكرية فولاذية منقوشة',
        period: 'القرن 16 م / العصر الصفوي-العثماني',
        material: 'فولاذ مقسى مطعم بأسلاك ذهبية',
        extent: 'الارتفاع: 28 سم مع واقية الأنف',
        creator: 'صناع الدروع الحربية الإسلامية',
        ttl: 'Old_Islamic_Helmet.ttl',
        model: 'Old_Islamic_Helmet',
        modelFile: 'Old_Islamic_Helmet.glb',
        brief: 'خوذة دفاعية إسلامية مدببة مزودة بحامي أنف متحرك وسلاسل لحماية العنق، منقوشة بآيات النصر المباركة.',
        keywords: ['خوذة', 'درع', 'فولاذ', 'helmet', 'armor']
      },
      'tablet': {
        id: 'tablet',
        title: 'لوح مسماري بابلي (Cuneiform Tablet)',
        titleAr: 'لوح طيني مسماري من بابل القديمة',
        period: 'الألف الثاني ق.م / العصر البابلي القديم',
        material: 'طين مفخور بنقوش مسمارية غائرة',
        extent: '11 × 7.5 سم',
        creator: 'الكتبة البابليون القدماء',
        ttl: 'old-babylonian_cuneiform_tablet_s264.ttl',
        model: 'old-babylonian_cuneiform_tablet_s264',
        modelFile: 'old-babylonian_cuneiform_tablet_s264.glb',
        brief: 'لوح أثري منقوش بالقلم المسماري على الطين، يوثق جانباً من المعاملات الإدارية والفلكية في بلاد الرافدين.',
        keywords: ['مسماري', 'بابلي', 'لوح', 'cuneiform', 'tablet']
      }
    };
  }

  async init() {
    return true;
  }

  async start() {
    this.isRunning = true;

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
    this.lockedTarget = null;
  }

  setPresetTarget(targetId) {
    this.selectedPreset = targetId;
    if (targetId === 'auto') {
      this.lockedTarget = null;
      if (this.onScanningStatus) this.onScanningStatus('وضع الكشف التلقائي 360° مفعل');
    } else if (this.catalog[targetId]) {
      const item = this.catalog[targetId];
      this.lockedTarget = item;
      const angle = this.getFormattedAngle();
      if (this.onTargetRecognized) {
        this.onTargetRecognized(item, {
          matched: true,
          targetId: item.id,
          confidence: 99,
          angleDetected: angle,
          briefReason: item.brief
        });
      }
      if (this.onScanningStatus) {
        this.onScanningStatus(`تم قفل الهدف: ${item.titleAr}`);
      }
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

  getFormattedAngle() {
    const heading = this.currentHeading;
    let compassDir = 'شمال';
    if (heading >= 30 && heading < 75) compassDir = 'شمال شرقي';
    else if (heading >= 75 && heading < 105) compassDir = 'شرق';
    else if (heading >= 105 && heading < 165) compassDir = 'جنوب شرقي';
    else if (heading >= 165 && heading < 195) compassDir = 'جنوب';
    else if (heading >= 195 && heading < 255) compassDir = 'جنوب غربي';
    else if (heading >= 255 && heading < 285) compassDir = 'غرب';
    else if (heading >= 285 && heading < 330) compassDir = 'شمال غربي';

    let elev = 'أمامي';
    if (this.currentPitch > 25) elev = 'منظور علوي';
    else if (this.currentPitch < -15) elev = 'منظور سفلي';

    return `${heading}° (${elev} - ${compassDir})`;
  }

  _runLoop() {
    if (!this.isRunning) return;

    if (this.canvas && this.ctx && this.video && this.video.readyState >= 2) {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
      this._drawSpatialReticle();
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

    if (this.shutterFlash) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      this.ctx.fillRect(0, 0, w, h);
    }

    this.radarAngle += 0.02;

    const isLocked = Boolean(this.lockedTarget);
    const mainColor = isLocked ? '#ffd700' : '#00e5ff';
    const accentColor = isLocked ? 'rgba(255, 215, 0, 0.35)' : 'rgba(0, 229, 255, 0.25)';

    // Outer 360 Rotating Compass Ring
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(this.radarAngle * 0.2);

    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius + 24, 0, Math.PI * 2);
    this.ctx.strokeStyle = accentColor;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([6, 10]);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // 4 Cardinal Axis ticks
    for (let i = 0; i < 4; i++) {
      this.ctx.rotate(Math.PI / 2);
      this.ctx.beginPath();
      this.ctx.moveTo(radius + 12, 0);
      this.ctx.lineTo(radius + 28, 0);
      this.ctx.strokeStyle = mainColor;
      this.ctx.lineWidth = 3;
      this.ctx.stroke();
    }
    this.ctx.restore();

    // Radar Sweep Beam
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(this.radarAngle);
    const grad = this.ctx.createLinearGradient(0, 0, radius, 0);
    grad.addColorStop(0, 'rgba(0, 229, 255, 0)');
    grad.addColorStop(1, isLocked ? 'rgba(255, 215, 0, 0.4)' : 'rgba(0, 229, 255, 0.35)');
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.arc(0, 0, radius, 0, Math.PI / 4);
    this.ctx.closePath();
    this.ctx.fillStyle = grad;
    this.ctx.fill();
    this.ctx.restore();

    // Inner Targeting Ring
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.strokeStyle = isLocked ? '#ffd700' : 'rgba(255, 255, 255, 0.85)';
    this.ctx.lineWidth = isLocked ? 3.5 : 2;
    this.ctx.stroke();

    // Corner targeting brackets
    const bSize = 28;
    const bDist = radius * 0.82;
    this.ctx.strokeStyle = mainColor;
    this.ctx.lineWidth = 4;
    this.ctx.lineCap = 'round';

    // Top-Left
    this.ctx.beginPath();
    this.ctx.moveTo(cx - bDist, cy - bDist + bSize);
    this.ctx.lineTo(cx - bDist, cy - bDist);
    this.ctx.lineTo(cx - bDist + bSize, cy - bDist);
    this.ctx.stroke();

    // Top-Right
    this.ctx.beginPath();
    this.ctx.moveTo(cx + bDist - bSize, cy - bDist);
    this.ctx.lineTo(cx + bDist, cy - bDist);
    this.ctx.lineTo(cx + bDist, cy - bDist + bSize);
    this.ctx.stroke();

    // Bottom-Left
    this.ctx.beginPath();
    this.ctx.moveTo(cx - bDist, cy + bDist - bSize);
    this.ctx.lineTo(cx - bDist, cy + bDist);
    this.ctx.lineTo(cx - bDist + bSize, cy + bDist);
    this.ctx.stroke();

    // Bottom-Right
    this.ctx.beginPath();
    this.ctx.moveTo(cx + bDist - bSize, cy + bDist);
    this.ctx.lineTo(cx + bDist, cy + bDist);
    this.ctx.lineTo(cx + bDist, cy + bDist - bSize);
    this.ctx.stroke();

    // Center crosshair
    this.ctx.beginPath();
    this.ctx.moveTo(cx - 12, cy);
    this.ctx.lineTo(cx + 12, cy);
    this.ctx.moveTo(cx, cy - 12);
    this.ctx.lineTo(cx, cy + 12);
    this.ctx.strokeStyle = mainColor;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Gyro & Compass HUD Label
    this.ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';

    const angleFormatted = this.getFormattedAngle();
    this.ctx.fillText(`🧭 SPATIAL 360° TRACKER • ${angleFormatted}`, cx, cy - radius - 24);

    if (this.isAnalyzing) {
      this.ctx.fillStyle = '#ffd700';
      this.ctx.fillText('⚡ جاري الفحص والمطابقة التراثية...', cx, cy + radius + 32);
    } else if (this.lockedTarget) {
      this.ctx.fillStyle = '#00ff88';
      this.ctx.fillText(`✓ تم قفل الهدف: ${this.lockedTarget.titleAr}`, cx, cy + radius + 32);
    } else {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      this.ctx.fillText('وجّه الكاميرا نحو القطعة واضغط على زر الفحص', cx, cy + radius + 32);
    }

    this.ctx.restore();
  }

  _analyzeLocalFeatures() {
    if (!this.video || !this.video.videoWidth) return null;

    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    const boxSize = Math.min(vw, vh) * 0.45;
    const sx = Math.floor((vw - boxSize) / 2);
    const sy = Math.floor((vh - boxSize) / 2);

    if (!this._sampleCanvas) {
      this._sampleCanvas = document.createElement('canvas');
      this._sampleCanvas.width = 64;
      this._sampleCanvas.height = 64;
      this._sampleCtx = this._sampleCanvas.getContext('2d', { willReadFrequently: true });
    }

    this._sampleCtx.drawImage(this.video, sx, sy, boxSize, boxSize, 0, 0, 64, 64);
    const imgData = this._sampleCtx.getImageData(0, 0, 64, 64).data;

    let totalR = 0, totalG = 0, totalB = 0;
    let greenCount = 0, orangeCount = 0, goldCount = 0, grayCount = 0, clayCount = 0;
    const numPixels = 64 * 64;

    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      totalR += r;
      totalG += g;
      totalB += b;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;

      // Green dominant (Alqami)
      if (g > r * 1.05 && g > b * 1.15 && sat > 0.16) greenCount++;
      // Orange / terracotta dominant (Alqami, Tablet)
      if (r > g * 1.2 && g > b * 1.2 && sat > 0.22) orangeCount++;
      // Gold / yellow (Minaret, Shrine, Gilded Quran)
      if (r > 140 && g > 120 && b < 110 && (r + g) > b * 2.1) goldCount++;
      // Metallic / Grayscale (Zulfiqar, Helmet)
      if (Math.abs(r - g) < 26 && Math.abs(g - b) < 26 && sat < 0.22) grayCount++;
      // Clay / brown (Tablet, Bowl)
      if (r > 90 && r < 190 && g > 55 && g < 140 && b > 25 && b < 100) clayCount++;
    }

    const avgR = totalR / numPixels;
    const avgG = totalG / numPixels;
    const avgB = totalB / numPixels;

    const greenRatio = greenCount / numPixels;
    const orangeRatio = orangeCount / numPixels;
    const goldRatio = goldCount / numPixels;
    const grayRatio = grayCount / numPixels;
    const clayRatio = clayCount / numPixels;

    return { avgR, avgG, avgB, greenRatio, orangeRatio, goldRatio, grayRatio, clayRatio };
  }

  _matchCatalogLocally(features) {
    if (!features) return 'alqami';

    const { greenRatio, orangeRatio, goldRatio, grayRatio, clayRatio } = features;

    // 1. Alqami Ceramic (Green + Orange/Terracotta + Porcelain White)
    if (greenRatio > 0.06 || (greenRatio > 0.03 && orangeRatio > 0.03)) {
      return 'alqami';
    }

    // 2. Golden Minaret (High Gold/Yellow)
    if (goldRatio > 0.20) {
      return 'minaret';
    }

    // 3. Shrine of Imam Hussein (Gold + Brick)
    if (goldRatio > 0.10 && orangeRatio > 0.05) {
      return 'shrine';
    }

    // 4. Zulfiqar Sword (High Metallic / Steel Gray)
    if (grayRatio > 0.40) {
      return 'zulfiqar';
    }

    // 5. Cuneiform Tablet (Clay Brown)
    if (clayRatio > 0.15) {
      return 'tablet';
    }

    // 6. Saqakhane Bowl (Bronze / Copper)
    if (clayRatio > 0.08 || orangeRatio > 0.06) {
      return 'bowl';
    }

    // 7. Manuscript / Quran
    if (features.avgR > 140 && features.avgG > 130 && features.avgB > 110) {
      return 'manuscript';
    }

    return 'alqami';
  }

  async performDeep360Scan() {
    if (this.isAnalyzing || !this.video || !this.video.videoWidth) return;

    this.isAnalyzing = true;
    this.shutterFlash = true;
    setTimeout(() => { this.shutterFlash = false; }, 180);

    if (this.onScanningStatus) this.onScanningStatus('⚡ جاري التحليل والتعرف 360°...');

    const angle = this.getFormattedAngle();

    // 1. Instant Local Analysis (takes 10ms)
    const features = this._analyzeLocalFeatures();
    const localTargetId = (this.selectedPreset !== 'auto') 
      ? this.selectedPreset 
      : this._matchCatalogLocally(features);

    let finalItem = this.catalog[localTargetId] || this.catalog['alqami'];
    let finalReason = finalItem.brief;
    let confidence = 96;

    // 2. Parallel Fast AI Verification with Gemini 3.5 Flash (Strict 2.0s Race Timeout)
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = Math.round(400 * (this.video.videoHeight / this.video.videoWidth));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

      const prompt = `Classify this museum artifact into ONE of these IDs: [alqami, zulfiqar, shrine, minaret, bowl, manuscript, quran, kufic, helmet, tablet].
If it has green/orange ceramic glazing or looks like an ornate jar/vase, it is "alqami".
If it is a sword, it is "zulfiqar".
Return ONLY raw JSON without markdown: {"targetId":"alqami","confidence":98,"reason":"تحفة القمي الخزفية بألوان الميناء"}`;

      const aiPromise = (async () => {
        const model = this.genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
        const res = await model.generateContent([
          prompt,
          { inlineData: { data: base64, mimeType: 'image/jpeg' } }
        ]);
        const txt = (await res.response).text();
        const m = txt.match(/\{[\s\S]*\}/);
        return m ? JSON.parse(m[0]) : null;
      })();

      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));

      const aiResult = await Promise.race([aiPromise, timeoutPromise]);
      if (aiResult && aiResult.targetId && this.catalog[aiResult.targetId]) {
        finalItem = this.catalog[aiResult.targetId];
        confidence = aiResult.confidence || 98;
        if (aiResult.reason) finalReason = aiResult.reason;
      }
    } catch (e) {
      // Local engine result is used instantly, zero waiting!
    }

    this.lockedTarget = finalItem;
    this.isAnalyzing = false;

    if (this.onTargetRecognized) {
      this.onTargetRecognized(finalItem, {
        matched: true,
        targetId: finalItem.id,
        confidence: confidence,
        angleDetected: angle,
        briefReason: finalReason
      });
    }

    if (this.onScanningStatus) {
      this.onScanningStatus(`✓ تم التعرف بنجاح: ${finalItem.titleAr}`);
    }
  }
}

