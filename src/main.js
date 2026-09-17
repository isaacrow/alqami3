import './styles.css';
import { RDFManuscriptParser } from './rdf-parser.js';
import { ARCardManager } from './ar-card.js';
import { AREngine } from './ar-engine.js';
import { AIEngine } from './ai-engine.js';
import { Spatial360Engine } from './spatial360-engine.js';
import { GenAIEngine } from './genai-engine.js';
import { marked } from 'marked';
import { RDFGraphVisualizer } from './graph-visualizer.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ManuscriptSimulator } from './simulator.js';
import { ManuscriptSpeechEngine } from './speech.js';

class AppController {
  constructor() {
    this.mode = 'camera'; // 'camera' or 'simulator'
    this.rdfParser = new RDFManuscriptParser();
    this.speech = new ManuscriptSpeechEngine();
    this.arEngine = null;
    this.simulator = null;
    this.cardManager = null;
    this.graphVisualizer = null;
    this.spatial360Engine = null;
    this.rawInitialTtl = '';
    this.activeHotspot = null;
    this.lastTime = performance.now();

    // DOM Elements
    this.dom = {
      arContainer: document.getElementById('ar-container'),
      aiContainer: document.getElementById('ai-container'),
      spatial360Container: document.getElementById('spatial360-container'),
      simulatorContainer: document.getElementById('simulator-container'),
      btnMode3d: document.getElementById('btn-mode-3d'),
      btnModeScan: document.getElementById('btn-mode-scan'),
      btnModeAi: document.getElementById('btn-mode-ai'),
      btnMode360: document.getElementById('btn-mode-360'),
      btnModeGenai: document.getElementById('btn-mode-genai'),
      btnSpatial360Trigger: document.getElementById('btn-spatial360-trigger'),
      spatial360BtnText: document.getElementById('spatial360-btn-text'),
      spatial360ResultCard: document.getElementById('spatial360-result-card'),
      spatial360CardTitle: document.getElementById('spatial360-card-title'),
      spatial360CardDesc: document.getElementById('spatial360-card-desc'),
      spatial360AngleBadge: document.getElementById('spatial360-angle-badge'),
      btnSpatial360CardClose: document.getElementById('btn-spatial360-card-close'),
      btnSpatial360Audio: document.getElementById('btn-spatial360-audio'),
      btnSpatial360Viewmeta: document.getElementById('btn-spatial360-viewmeta'),
      genaiContainer: document.getElementById('genai-container'),
      btnGenaiCapture: document.getElementById('btn-genai-capture'),
      genaiResultPanel: document.getElementById('genai-result-panel'),
      genaiResultContent: document.getElementById('genai-result-content'),
      btnGenaiClose: document.getElementById('btn-genai-close'),
      modelDock: document.getElementById('model-dock'),
      mainPanel: document.getElementById('main-panel-container'),
      audioGuideBtn: document.getElementById('btn-audio-guide'),
      btnThemeToggle: document.getElementById('btn-theme-toggle'),
      snapshotBtn: document.getElementById('btn-snapshot'),
      trackingStatus: document.getElementById('tracking-status'),
      trackingText: document.getElementById('tracking-text'),
      scanningHud: document.getElementById('scanning-hud'),
      metaTitle: document.getElementById('meta-title'),
      metaCreator: document.getElementById('meta-creator'),
      metaDate: document.getElementById('meta-date'),
      metaExtent: document.getElementById('meta-extent'),
      metaMaterial: document.getElementById('meta-material'),
      metaNotes: document.getElementById('meta-notes'),
      graphCanvas: document.getElementById('graph-canvas'),
      ttlEditor: document.getElementById('ttl-code-editor'),
      btnApplyRdf: document.getElementById('btn-apply-rdf'),
      btnResetRdf: document.getElementById('btn-reset-rdf'),
      hotspotModal: document.getElementById('hotspot-modal'),
      modalTitle: document.getElementById('modal-title'),
      modalBody: document.getElementById('modal-body'),
      btnCloseModal: document.getElementById('btn-close-modal'),
      btnModalAction: document.getElementById('btn-modal-action'),
      cameraFlash: document.getElementById('camera-flash')
    };
  }

  async init() {
    console.log('Initializing Alqami AR (Vision Pro UI)...');
    this._setupTabNavigation();
    this._setupModals();
    this._setupButtons();

    // Hide UI when interacting with 3D model
    const viewer = document.getElementById('model-3d-viewer');
    let interactTimeout;
    if (viewer) {
      viewer.addEventListener('camera-change', (event) => {
        if (event.detail.source === 'user-interaction') {
          if (this.dom.mainPanel) this.dom.mainPanel.classList.add('hide-ui');
          if (this.dom.modelDock) this.dom.modelDock.classList.add('hide-ui');
          
          clearTimeout(interactTimeout);
          interactTimeout = setTimeout(() => {
            if (this.dom.mainPanel) this.dom.mainPanel.classList.remove('hide-ui');
            if (this.dom.modelDock) this.dom.modelDock.classList.remove('hide-ui');
          }, 600);
        }
      });
    }

    // 1. Load and parse initial RDF data for 3D Mode
    try {
      const baseUrl = import.meta.env.BASE_URL || './';
      const cacheBust = `?v=${Date.now()}`;
      const data = await this.rdfParser.loadFromUrl(`${baseUrl}model.ttl${cacheBust}`);
      this.rawInitialTtl = this.rdfParser.rawTurtle;
      if(this.dom.ttlEditor) this.dom.ttlEditor.value = this.rawInitialTtl;
      this._updateUIWithMetadata(data.metadata);

      // Setup graph visualizer
      this.graphVisualizer = new RDFGraphVisualizer(this.dom.graphCanvas);
      this.graphVisualizer.setData(this.rdfParser.getGraphData());
      this.graphVisualizer.onSelect((node) => {
        console.log('Selected Graph Node:', node);
      });
    } catch (err) {
      console.error('Failed to load initial RDF:', err);
    }

    // 2. Initialize Simulator Mode (3D Mode) first
    this._startSimulatorMode();
  }

  async _startCameraMode() {
    this.mode = 'camera';
    this.dom.arContainer.style.display = 'block';
    this.dom.simulatorContainer.style.display = 'none';
    
    // UI Updates for Scan Mode
    this.dom.btnModeScan.classList.add('active');
    this.dom.btnMode3d.classList.remove('active');
    if (this.dom.btnModeAi) this.dom.btnModeAi.classList.remove('active');
    if (this.dom.btnMode360) this.dom.btnMode360.classList.remove('active');
    if (this.dom.btnModeGenai) this.dom.btnModeGenai.classList.remove('active');
    
    this.dom.modelDock.style.display = 'none';
    if(this.dom.mainPanel) this.dom.mainPanel.style.display = 'none';
    if (this.dom.genaiContainer) this.dom.genaiContainer.style.display = 'none';
    if (this.dom.spatial360Container) this.dom.spatial360Container.style.display = 'none';
    this.dom.trackingStatus.style.display = 'flex';

    if (this.aiEngine) this.aiEngine.stop();
    if (this.spatial360Engine) this.spatial360Engine.stop();
    this._stopGenAiCamera();

    this._setTrackingState(false, 'Scanning for manuscript');

    // Reset Metadata to manuscript for Scan Mode
    try {
      const baseUrl = import.meta.env.BASE_URL || './';
      const data = await this.rdfParser.loadFromUrl(`${baseUrl}data/manuscript.ttl`);
      this.rawInitialTtl = this.rdfParser.rawTurtle;
      if(this.dom.ttlEditor) this.dom.ttlEditor.value = this.rawInitialTtl;
      this._updateUIWithMetadata(data.metadata);
      if (this.graphVisualizer) this.graphVisualizer.setData(this.rdfParser.getGraphData());
    } catch(e) { console.warn('No manuscript.ttl found', e); }

    try {
      if (!this.arEngine) {
        const baseUrl = import.meta.env.BASE_URL || './';
        const cacheBust = `?v=${Date.now()}`;
        this.arEngine = new AREngine(this.dom.arContainer, `${baseUrl}targets/manuscript.mind${cacheBust}`);

        const { renderer, scene, camera, anchors } = await this.arEngine.init();

        // Define datasets for each target index in the .mind file
        const targetDatasets = [
          'model.ttl', // 0: Al-Qabasat (manuscript.jpg)
          'quran.ttl', // 1: Quran (quran.jpg)
          'kufic.ttl', // 2: Kufic Quran (kufic.jpg)
          'hand.ttl',  // 3: Hand triggering Helmet (hand.jpg)
          'alqami.ttl' // 4: Alqami Ceramic Artifact (alqami_artifact.jpg)
        ];

        this.cardManagers = [];

        // Create a card manager for each available anchor
        if (anchors) {
          const loader = new GLTFLoader();
          for (let i = 0; i < anchors.length; i++) {
            const mgr = new ARCardManager(anchors[i].group);
            this.cardManagers.push(mgr);

            // If it's target 3 (the hand), load the 3D helmet model!
            if (i === 3) {
              loader.load(`${baseUrl}Old_Islamic_Helmet.glb`, (gltf) => {
                const model = gltf.scene;
                // Scale and position the helmet above the hand
                model.scale.set(3.5, 3.5, 3.5);
                model.position.set(0, 0, 0.2); // slight offset towards camera
                
                // Add a gentle rotation animation
                this.handModel = model;
                anchors[i].group.add(model);
              });
            }
          }
        }

        this.arEngine.onTargetFound = async (index) => {
          console.log(`Target ${index} Detected in AR Camera`);
          this._setTrackingState(true, `Target ${index} Tracked`);
          
          // Dynamically load the correct metadata for this target!
          const ttlFile = targetDatasets[index] || targetDatasets[0];
          try {
            const data = await this.rdfParser.loadFromUrl(`${baseUrl}${ttlFile}${cacheBust}`);
            this.rawInitialTtl = this.rdfParser.rawTurtle;
            if (this.dom.ttlEditor) this.dom.ttlEditor.value = this.rawInitialTtl;
            this._updateUIWithMetadata(data.metadata);
            
            if (this.graphVisualizer) {
              this.graphVisualizer.setData(this.rdfParser.getGraphData());
            }

            // Update the holographic card specifically for this anchor
            if (this.cardManagers[index]) {
              this.cardManagers[index].createHolographicCard(data.metadata);
              this.cardManagers[index].createHotspots(data.hotspots);
            }
          } catch (e) {
            console.error(`Failed to load TTL for target ${index}:`, e);
          }

          if(this.dom.mainPanel) {
            this.dom.mainPanel.style.display = 'flex';
            this.dom.mainPanel.classList.remove('hidden');
          }
        };

        this.arEngine.onTargetLost = (index) => {
          console.log(`Target ${index} Lost in AR Camera`);
          this._setTrackingState(false, 'Scanning for manuscript');
          if(this.dom.mainPanel) {
            this.dom.mainPanel.style.display = 'none';
          }
        };

        this.arEngine.onError = (err) => {
          console.warn('Camera AR unavailable, switching to Simulator:', err);
          this._startSimulatorMode();
        };

        this.lastTime = performance.now();
        await this.arEngine.start(() => {
          const now = performance.now();
          const delta = (now - this.lastTime) / 1000;
          this.lastTime = now;
          if (this.cardManagers && this.cardManagers.length > 0) {
            this.cardManagers.forEach(mgr => mgr.update(delta));
          } else if (this.cardManager) {
            this.cardManager.update(delta);
          }
          if (this.handModel) {
            this.handModel.rotation.y += delta * 0.5; // slow spin
            this.handModel.rotation.x = Math.sin(now * 0.001) * 0.1; // slight bobble
          }
        });

        this._setupInteractionRaycasting(renderer.domElement, camera);
      } else {
        // Resume MindAR if it was stopped
        this.arEngine.start();
      }
    } catch (err) {
      console.warn('Camera AR init failed, switching to Desktop Simulator:', err);
      this._startSimulatorMode();
    }
  }

  _startSimulatorMode() {
    this.mode = 'simulator';
    this.dom.arContainer.style.display = 'none';
    if (this.dom.aiContainer) this.dom.aiContainer.style.display = 'none';
    this.dom.simulatorContainer.style.display = 'block';
    
    // UI Updates for 3D Mode
    this.dom.btnMode3d.classList.add('active');
    this.dom.btnModeScan.classList.remove('active');
    if (this.dom.btnModeAi) this.dom.btnModeAi.classList.remove('active');
    if (this.dom.btnMode360) this.dom.btnMode360.classList.remove('active');
    if (this.dom.btnModeGenai) this.dom.btnModeGenai.classList.remove('active');
    
    this.dom.modelDock.style.display = 'block';
    if(this.dom.mainPanel) this.dom.mainPanel.style.display = 'flex';
    if (this.dom.genaiContainer) this.dom.genaiContainer.style.display = 'none';
    if (this.dom.spatial360Container) this.dom.spatial360Container.style.display = 'none';
    this.dom.trackingStatus.style.display = 'none';
    this.dom.scanningHud.style.display = 'none';

    if (this.arEngine) {
      this.arEngine.stop();
    }
    if (this.aiEngine) {
      this.aiEngine.stop();
    }
    if (this.spatial360Engine) {
      this.spatial360Engine.stop();
    }
    this._stopGenAiCamera();

    // Model Dock Setup
    const dockBtns = document.querySelectorAll('.dock-btn');
    dockBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        dockBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const modelId = btn.dataset.model;
        const modelTitle = btn.dataset.title;
        document.getElementById('top-title').textContent = modelTitle;
        
        // Load GLB
        const baseUrl = import.meta.env.BASE_URL || './';
        const viewer = document.getElementById('model-3d-viewer');
        if (viewer) viewer.src = `${baseUrl}${modelId}.glb`;
        
        // Load TTL
        try {
          const data = await this.rdfParser.loadFromUrl(`${baseUrl}${modelId}.ttl`);
          this.rawInitialTtl = this.rdfParser.rawTurtle;
          if (this.dom.ttlEditor) this.dom.ttlEditor.value = this.rawInitialTtl;
          this._updateUIWithMetadata(data.metadata);

          if (this.graphVisualizer) {
            this.graphVisualizer.setData(this.rdfParser.getGraphData());
          }
        } catch (err) {
          console.error('Failed to load TTL for', modelId, err);
        }
      });
    });

    // Model Viewer Progress Bar
    const viewer = document.getElementById('model-3d-viewer');
    if (viewer && !viewer.hasAttribute('data-progress-listener')) {
      viewer.setAttribute('data-progress-listener', 'true');
      viewer.addEventListener('progress', (e) => {
        const bar = viewer.querySelector('.progress-bar');
        const update = viewer.querySelector('.update-bar');
        if (bar && update) {
          update.style.width = `${e.detail.totalProgress * 100}%`;
          if (e.detail.totalProgress === 1) bar.classList.add('hide');
          else bar.classList.remove('hide');
        }
      });
    }
  }

  async _startAiMode() {
    this.mode = 'ai';
    this.dom.simulatorContainer.style.display = 'none';
    this.dom.arContainer.style.display = 'none';
    this.dom.aiContainer.style.display = 'block';

    this.dom.btnMode3d.classList.remove('active');
    this.dom.btnModeScan.classList.remove('active');
    if (this.dom.btnMode360) this.dom.btnMode360.classList.remove('active');
    if (this.dom.btnModeGenai) this.dom.btnModeGenai.classList.remove('active');
    this.dom.btnModeAi.classList.add('active');

    this.dom.modelDock.style.display = 'none';
    if(this.dom.mainPanel) this.dom.mainPanel.style.display = 'none';
    if (this.dom.genaiContainer) this.dom.genaiContainer.style.display = 'none';
    if (this.dom.spatial360Container) this.dom.spatial360Container.style.display = 'none';
    this.dom.trackingStatus.style.display = 'flex';
    this.dom.scanningHud.style.display = 'none';

    this._setTrackingState(false, 'Initializing AI Vision...');

    if (this.arEngine) this.arEngine.stop();
    if (this.spatial360Engine) this.spatial360Engine.stop();
    this._stopGenAiCamera();

    if (!this.aiEngine) {
      const video = document.getElementById('ai-video');
      const canvas = document.getElementById('ai-canvas');
      this.aiEngine = new AIEngine(video, canvas);
      await this.aiEngine.init();
      
      this.aiEngine.onObjectDetected = async (className, bbox) => {
        // Prevent rapid refreshing
        const now = performance.now();
        if (now - this.lastAiDetectionTime < 3000) return;
        this.lastAiDetectionTime = now;

        console.log('AI Detected:', className);
        const displayLabel = className === 'alqami' ? 'Alqami (تحفة القمي)' : className;
        this._setTrackingState(true, `Recognized: ${displayLabel}`);
        
        // Show simulated metadata based on detection
        const baseUrl = import.meta.env.BASE_URL || './';
        let ttlFile = 'model.ttl'; // fallback
        if (className === 'alqami' || className === 'vase') ttlFile = 'alqami.ttl';
        else if (className === 'cup' || className === 'bowl') ttlFile = 'saqakhane_bowl.ttl';
        else if (className === 'book') ttlFile = 'quran.ttl';
        
        try {
          const cacheBust = `?v=${Date.now()}`;
          const data = await this.rdfParser.loadFromUrl(`${baseUrl}${ttlFile}${cacheBust}`);
          this.rawInitialTtl = this.rdfParser.rawTurtle;
          if (this.dom.ttlEditor) this.dom.ttlEditor.value = this.rawInitialTtl;
          this._updateUIWithMetadata(data.metadata);
          
          if (this.graphVisualizer) {
            this.graphVisualizer.setData(this.rdfParser.getGraphData());
          }
          if(this.dom.mainPanel) this.dom.mainPanel.style.display = 'flex';
        } catch (err) {
          console.warn('Error loading AI metadata', err);
        }
      };
    }
    
    this.lastAiDetectionTime = 0;
    this._setTrackingState(false, 'Scanning environment for objects...');
    await this.aiEngine.start();
  }

  async _startGenAiMode() {
    this.mode = 'genai';
    this.dom.simulatorContainer.style.display = 'none';
    this.dom.arContainer.style.display = 'none';
    if (this.dom.aiContainer) this.dom.aiContainer.style.display = 'none';
    if (this.dom.spatial360Container) this.dom.spatial360Container.style.display = 'none';
    if (this.dom.genaiContainer) this.dom.genaiContainer.style.display = 'block';

    this.dom.btnMode3d.classList.remove('active');
    this.dom.btnModeScan.classList.remove('active');
    if (this.dom.btnModeAi) this.dom.btnModeAi.classList.remove('active');
    if (this.dom.btnMode360) this.dom.btnMode360.classList.remove('active');
    if (this.dom.btnModeGenai) this.dom.btnModeGenai.classList.add('active');

    this.dom.modelDock.style.display = 'none';
    if (this.dom.mainPanel) this.dom.mainPanel.style.display = 'none';
    this.dom.trackingStatus.style.display = 'flex';
    this.dom.scanningHud.style.display = 'none';

    this._setTrackingState(false, 'GenAI Curator Ready');

    if (this.arEngine) this.arEngine.stop();
    if (this.aiEngine) this.aiEngine.stop();
    if (this.spatial360Engine) this.spatial360Engine.stop();

    if (!this.genaiEngine) {
      this.genaiEngine = new GenAIEngine();

      if (this.dom.btnGenaiClose) {
        this.dom.btnGenaiClose.addEventListener('click', () => {
          if (this.dom.genaiResultPanel) this.dom.genaiResultPanel.classList.add('hidden');
        });
      }

      if (this.dom.btnGenaiCapture) {
        this.dom.btnGenaiCapture.addEventListener('click', async () => {
          const video = document.getElementById('genai-video');
          if (!video || !video.videoWidth) {
            alert('Camera stream not ready yet. Please wait a moment.');
            return;
          }

          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

          this.dom.btnGenaiCapture.textContent = 'جاري التحليل... ⏳';
          this.dom.btnGenaiCapture.disabled = true;

          try {
            const markdown = await this.genaiEngine.analyzeArtifact(dataUrl);
            if (this.dom.genaiResultContent) {
              this.dom.genaiResultContent.innerHTML = marked.parse(markdown);
            }
            if (this.dom.genaiResultPanel) {
              this.dom.genaiResultPanel.classList.remove('hidden');
            }
          } catch (err) {
            alert('Error analyzing artifact: ' + err.message);
          } finally {
            this.dom.btnGenaiCapture.textContent = '🔍 تحليل ذكي (Smart Analyze)';
            this.dom.btnGenaiCapture.disabled = false;
          }
        });
      }
    }

    const video = document.getElementById('genai-video');
    try {
      if (video && !video.srcObject) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        video.srcObject = stream;
        video.play();
      }
    } catch (err) {
      console.warn('Could not start camera for GenAI mode', err);
    }
  }

  _stopGenAiCamera() {
    const video = document.getElementById('genai-video');
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
  }

  async _startSpatial360Mode() {
    this.mode = 'spatial360';
    this.dom.simulatorContainer.style.display = 'none';
    this.dom.arContainer.style.display = 'none';
    if (this.dom.aiContainer) this.dom.aiContainer.style.display = 'none';
    if (this.dom.genaiContainer) this.dom.genaiContainer.style.display = 'none';
    this.dom.spatial360Container.style.display = 'block';

    this.dom.btnMode3d.classList.remove('active');
    this.dom.btnModeScan.classList.remove('active');
    if (this.dom.btnModeAi) this.dom.btnModeAi.classList.remove('active');
    if (this.dom.btnModeGenai) this.dom.btnModeGenai.classList.remove('active');
    this.dom.btnMode360.classList.add('active');

    this.dom.modelDock.style.display = 'none';
    if (this.dom.mainPanel) this.dom.mainPanel.style.display = 'none';
    this.dom.trackingStatus.style.display = 'none';
    this.dom.scanningHud.style.display = 'none';

    if (this.arEngine) this.arEngine.stop();
    if (this.aiEngine) this.aiEngine.stop();
    this._stopGenAiCamera();

    if (!this.spatial360Engine) {
      const video = document.getElementById('spatial360-video');
      const canvas = document.getElementById('spatial360-canvas');
      this.spatial360Engine = new Spatial360Engine(video, canvas);
      await this.spatial360Engine.init();

      // Trigger button
      if (this.dom.btnSpatial360Trigger) {
        this.dom.btnSpatial360Trigger.addEventListener('click', async () => {
          this.dom.spatial360BtnText.textContent = '⚡ جاري الفحص المجسم 360°...';
          await this.spatial360Engine.performDeep360Scan();
          this.dom.spatial360BtnText.textContent = '🔍 فحص 360° فوري (Scan 360°)';
        });
      }

      // Close result card
      if (this.dom.btnSpatial360CardClose) {
        this.dom.btnSpatial360CardClose.addEventListener('click', () => {
          this.dom.spatial360ResultCard.classList.add('hidden');
        });
      }

      // Audio guide button on card
      if (this.dom.btnSpatial360Audio) {
        this.dom.btnSpatial360Audio.addEventListener('click', () => {
          if (this.activeRecognizedMeta && this.speech) {
            const txt = `${this.activeRecognizedMeta.title || ''}. ${this.activeRecognizedMeta.transcriptionArabic || ''}`;
            this.speech.speak(txt, 'ar');
          }
        });
      }

      // View full metadata on card
      if (this.dom.btnSpatial360Viewmeta) {
        this.dom.btnSpatial360Viewmeta.addEventListener('click', () => {
          if (this.dom.mainPanel) {
            this.dom.mainPanel.style.display = 'flex';
            this.dom.mainPanel.classList.remove('hidden');
          }
        });
      }

      // Callbacks
      this.spatial360Engine.onTargetRecognized = async (item, parsed) => {
        console.log('360 Target Recognized:', item.id, parsed);

        // Load item TTL metadata
        try {
          const baseUrl = import.meta.env.BASE_URL || './';
          const cacheBust = `?v=${Date.now()}`;
          const data = await this.rdfParser.loadFromUrl(`${baseUrl}${item.ttl}${cacheBust}`);
          this.rawInitialTtl = this.rdfParser.rawTurtle;
          if (this.dom.ttlEditor) this.dom.ttlEditor.value = this.rawInitialTtl;
          this.activeRecognizedMeta = data.metadata;
          this._updateUIWithMetadata(data.metadata);

          if (this.graphVisualizer) {
            this.graphVisualizer.setData(this.rdfParser.getGraphData());
          }

          // Populate floating 360 result card
          if (this.dom.spatial360CardTitle) {
            this.dom.spatial360CardTitle.textContent = data.metadata.titleArabic || data.metadata.title || item.title;
          }
          if (this.dom.spatial360CardDesc) {
            const desc = data.metadata.transcriptionArabic || parsed.briefReason || 'تم التعرف على المجسم ومطابقته بنجاح.';
            this.dom.spatial360CardDesc.textContent = desc;
          }
          if (this.dom.spatial360AngleBadge) {
            this.dom.spatial360AngleBadge.textContent = parsed.angleDetected || 'زاوية 360°';
          }
          if (this.dom.spatial360ResultCard) {
            this.dom.spatial360ResultCard.classList.remove('hidden');
          }
        } catch (err) {
          console.warn('Error loading 360 target metadata:', err);
        }
      };

      this.spatial360Engine.onScanningStatus = (msg) => {
        if (this.dom.spatial360BtnText) {
          this.dom.spatial360BtnText.textContent = msg;
          setTimeout(() => {
            if (this.dom.spatial360BtnText) {
              this.dom.spatial360BtnText.textContent = '🔍 فحص 360° فوري (Scan 360°)';
            }
          }, 3000);
        }
      };
    }

    await this.spatial360Engine.start();
  }

  _setupInteractionRaycasting(domElement, camera) {
    const handleTap = (e) => {
      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

      let hitHotspot = null;
      if (this.cardManagers && this.cardManagers.length > 0) {
        for (const mgr of this.cardManagers) {
          hitHotspot = mgr.checkRaycast(
            camera,
            clientX,
            clientY,
            domElement.clientWidth,
            domElement.clientHeight
          );
          if (hitHotspot) break;
        }
      } else if (this.cardManager) {
        hitHotspot = this.cardManager.checkRaycast(
          camera,
          clientX,
          clientY,
          domElement.clientWidth,
          domElement.clientHeight
        );
      }

      if (hitHotspot) {
        this._openHotspotModal(hitHotspot);
      }
    };

    domElement.addEventListener('click', handleTap);
  }

  _setTrackingState(isFound, message) {
    if (isFound) {
      this.dom.trackingStatus.classList.add('found');
      this.dom.trackingText.textContent = message || 'Target Tracked';
      if (this.dom.scanningHud) this.dom.scanningHud.style.display = 'none';
    } else {
      this.dom.trackingStatus.classList.remove('found');
      this.dom.trackingText.textContent = message || 'Scanning for manuscript';
      if (this.dom.scanningHud) this.dom.scanningHud.style.display = 'flex';
    }
  }

  _updateUIWithMetadata(meta) {
    if (!meta) return;

    this.dom.metaTitle.textContent = meta.titleArabic || meta.title || '—';
    this.dom.metaCreator.textContent = meta.creator || '—';
    this.dom.metaDate.textContent = meta.date || '—';
    this.dom.metaExtent.textContent = meta.dimensions || meta.extent || '—';
    this.dom.metaMaterial.textContent = meta.material || '—';

    this.dom.metaNotes.textContent = meta.transcriptionArabic || '—';
  }

  _setupTabNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach((b) => b.classList.remove('active'));
        tabPanes.forEach((p) => p.classList.remove('active'));

        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        const pane = document.getElementById(tabId);
        if (pane) {
          pane.classList.add('active');
        }

        if (tabId === 'tab-graph' && this.graphVisualizer) {
          setTimeout(() => this.graphVisualizer.resize(), 50);
        }
      });
    });
  }

  _setupModals() {
    if (this.dom.btnCloseModal) {
      this.dom.btnCloseModal.addEventListener('click', () => {
        this.dom.hotspotModal.classList.remove('active');
      });
    }

    if (this.dom.btnModalAction) {
      this.dom.btnModalAction.addEventListener('click', () => {
        if (this.activeHotspot) {
          this.speech.speak(`${this.activeHotspot.label}. ${this.activeHotspot.description}`);
        }
      });
    }
  }

  _openHotspotModal(hs) {
    this.activeHotspot = hs;
    this.dom.modalTitle.textContent = hs.label;
    this.dom.modalBody.innerHTML = `
      <p style="margin-bottom: 8px;"><strong>Location:</strong> <span style="color: var(--apple-blue);">${hs.folio}</span></p>
      <p style="line-height: 1.6;">${hs.description}</p>
    `;
    this.dom.hotspotModal.classList.add('active');
  }

  _setupButtons() {
    // Mode switches
    if (this.dom.btnMode3d) {
      this.dom.btnMode3d.addEventListener('click', () => {
        if (this.mode !== 'simulator') this._startSimulatorMode();
      });
    }

    if (this.dom.btnModeScan) {
      this.dom.btnModeScan.addEventListener('click', () => {
        if (this.mode !== 'camera') this._startCameraMode();
      });
    }

    if (this.dom.btnModeAi) {
      this.dom.btnModeAi.addEventListener('click', () => {
        if (this.mode !== 'ai') this._startAiMode();
      });
    }

    if (this.dom.btnMode360) {
      this.dom.btnMode360.addEventListener('click', () => {
        if (this.mode !== 'spatial360') this._startSpatial360Mode();
      });
    }

    if (this.dom.btnModeGenai) {
      this.dom.btnModeGenai.addEventListener('click', () => {
        if (this.mode !== 'genai') this._startGenAiMode();
      });
    }

    // Custom AR Button for 3D Mode
    const customArBtn = document.getElementById('custom-ar-button');
    if (customArBtn) {
      customArBtn.addEventListener('click', () => {
        const viewer = document.getElementById('model-3d-viewer');
        if (viewer && viewer.canActivateAR) {
          viewer.activateAR();
        } else {
          alert('Sorry, your device or browser does not support placing 3D models in AR.');
        }
      });
    }

    // Theme Toggle
    if (this.dom.btnThemeToggle) {
      this.dom.btnThemeToggle.addEventListener('click', () => {
        const bgLayer = document.getElementById('bg-layer');
        const sunIcon = this.dom.btnThemeToggle.querySelector('.icon-sun');
        const moonIcon = this.dom.btnThemeToggle.querySelector('.icon-moon');
        
        if (!bgLayer) return;
        
        document.body.classList.toggle('light-theme');
        const isWhite = document.body.classList.contains('light-theme');
        
        if (isWhite) {
          bgLayer.style.background = 'radial-gradient(circle at center, #ffffff 0%, #e5e5ea 100%)';
          if(sunIcon) sunIcon.style.display = 'block';
          if(moonIcon) moonIcon.style.display = 'none';
        } else {
          bgLayer.style.background = 'radial-gradient(circle at center, #1a1a1a 0%, #000000 100%)';
          if(sunIcon) sunIcon.style.display = 'none';
          if(moonIcon) moonIcon.style.display = 'block';
        }
      });
    }

    // Lang Toggle
    const btnLang = document.getElementById('btn-lang-toggle');
    if (btnLang) {
      btnLang.addEventListener('click', () => {
        const iconEn = btnLang.querySelector('.icon-en');
        const iconAr = btnLang.querySelector('.icon-ar');
        if (iconEn && iconAr) {
          if (iconEn.style.display === 'none') {
            iconEn.style.display = 'block';
            iconAr.style.display = 'none';
          } else {
            iconEn.style.display = 'none';
            iconAr.style.display = 'block';
          }
        }
        // Additional localization logic can be added here
      });
    }

    // Audio Guide Main
    if (this.dom.audioGuideBtn) {
      this.dom.audioGuideBtn.addEventListener('click', () => {
        const summary = this.dom.metaNotes ? this.dom.metaNotes.textContent : 'No description available.';
        this.speech.toggle(summary, 'ar');
      });
    }

    // Snapshot feature
    if (this.dom.snapshotBtn) {
      this.dom.snapshotBtn.addEventListener('click', () => {
        if (this.dom.cameraFlash) {
          this.dom.cameraFlash.classList.add('flash');
          setTimeout(() => this.dom.cameraFlash.classList.remove('flash'), 200);
        }

        const targetCanvas = this.mode === 'camera' 
          ? this.dom.arContainer.querySelector('canvas') 
          : this.dom.simulatorContainer.querySelector('canvas');

        if (targetCanvas) {
          const link = document.createElement('a');
          link.download = `alqami-${Date.now()}.png`;
          link.href = targetCanvas.toDataURL('image/png');
          link.click();
        }
      });
    }

    // RDF Live Editor: Apply
    this.dom.btnApplyRdf.addEventListener('click', async () => {
      try {
        const updatedTtl = this.dom.ttlEditor.value;
        const data = await this.rdfParser.parseTurtle(updatedTtl);
        this._updateUIWithMetadata(data.metadata);

        if (this.cardManager) {
          this.cardManager.createHolographicCard(data.metadata);
          this.cardManager.createHotspots(data.hotspots);
        }

        if (this.graphVisualizer) {
          this.graphVisualizer.setData(this.rdfParser.getGraphData());
        }

        alert('AR Hologram and metadata updated successfully.');
      } catch (err) {
        alert(`RDF Syntax Error: ${err.message}`);
      }
    });

    // RDF Live Editor: Reset
    this.dom.btnResetRdf.addEventListener('click', async () => {
      this.dom.ttlEditor.value = this.rawInitialTtl;
      const data = await this.rdfParser.parseTurtle(this.rawInitialTtl);
      this._updateUIWithMetadata(data.metadata);

      if (this.cardManager) {
        this.cardManager.createHolographicCard(data.metadata);
        this.cardManager.createHotspots(data.hotspots);
      }

      if (this.graphVisualizer) {
        this.graphVisualizer.setData(this.rdfParser.getGraphData());
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  app.init();
});
