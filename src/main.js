import './styles.css';
import { RDFManuscriptParser } from './rdf-parser.js';
import { ARCardManager } from './ar-card.js';
import { AREngine } from './ar-engine.js';
import { AIEngine } from './ai-engine.js';
import { GenAIEngine } from './genai-engine.js';
import { marked } from 'marked';
import { RDFGraphVisualizer } from './graph-visualizer.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ManuscriptSimulator } from './simulator.js';
import { ManuscriptSpeechEngine } from './speech.js';
import { AllSidesMatcher } from './all-sides-matcher.js';
import { ClosedSetRecognitionEngine } from './recognition/recognition-engine.js';
import { TestInspectorHUD } from './admin/test-inspector-hud.js';
import { ArtifactManagerModal } from './admin/artifact-manager-modal.js';

class AppController {
  constructor() {
    this.mode = 'camera'; // 'camera' or 'simulator'
    this.rdfParser = new RDFManuscriptParser();
    this.speech = new ManuscriptSpeechEngine();
    this.arEngine = null;
    this.simulator = null;
    this.cardManager = null;
    this.graphVisualizer = null;
    this.allSidesMatcher = null;
    this.closedSetEngine = null;
    this.testInspectorHUD = null;
    this.artifactManagerModal = null;
    this.rawInitialTtl = '';
    this.activeHotspot = null;
    this.lastTime = performance.now();

    // DOM Elements
    this.dom = {
      arContainer: document.getElementById('ar-container'),
      aiContainer: document.getElementById('ai-container'),
      allsidesContainer: document.getElementById('allsides-container'),
      closedsetContainer: document.getElementById('closedset-container'),
      simulatorContainer: document.getElementById('simulator-container'),
      btnMode3d: document.getElementById('btn-mode-3d'),
      btnModeScan: document.getElementById('btn-mode-scan'),
      btnModeAi: document.getElementById('btn-mode-ai'),
      btnModeAllSides: document.getElementById('btn-mode-allsides'),
      btnModeClosedSet: document.getElementById('btn-mode-closedset'),
      btnAdminManager: document.getElementById('btn-admin-manager'),
      artifactManagerModal: document.getElementById('artifact-manager-modal'),
      closedsetHudContainer: document.getElementById('closedset-hud-container'),
      btnModeGenai: document.getElementById('btn-mode-genai'),
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
    if (this.dom.btnModeAllSides) this.dom.btnModeAllSides.classList.remove('active');
    if (this.dom.btnModeClosedSet) this.dom.btnModeClosedSet.classList.remove('active');
    if (this.dom.btnModeGenai) this.dom.btnModeGenai.classList.remove('active');
    
    this.dom.modelDock.style.display = 'none';
    if(this.dom.mainPanel) this.dom.mainPanel.style.display = 'none';
    if (this.dom.genaiContainer) this.dom.genaiContainer.style.display = 'none';
    if (this.dom.allsidesContainer) this.dom.allsidesContainer.style.display = 'none';
    if (this.dom.closedsetContainer) this.dom.closedsetContainer.style.display = 'none';
    this.dom.trackingStatus.style.display = 'flex';

    if (this.aiEngine) this.aiEngine.stop();
    if (this.allSidesMatcher) this.allSidesMatcher.stop();
    if (this.closedSetEngine) this.closedSetEngine.stop();
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
    if (this.dom.btnModeAllSides) this.dom.btnModeAllSides.classList.remove('active');
    if (this.dom.btnModeClosedSet) this.dom.btnModeClosedSet.classList.remove('active');
    if (this.dom.btnModeGenai) this.dom.btnModeGenai.classList.remove('active');
    
    this.dom.modelDock.style.display = 'block';
    if(this.dom.mainPanel) this.dom.mainPanel.style.display = 'flex';
    if (this.dom.genaiContainer) this.dom.genaiContainer.style.display = 'none';
    if (this.dom.allsidesContainer) this.dom.allsidesContainer.style.display = 'none';
    if (this.dom.closedsetContainer) this.dom.closedsetContainer.style.display = 'none';
    this.dom.trackingStatus.style.display = 'none';
    this.dom.scanningHud.style.display = 'none';

    if (this.arEngine) {
      this.arEngine.stop();
    }
    if (this.aiEngine) {
      this.aiEngine.stop();
    }
    if (this.allSidesMatcher) {
      this.allSidesMatcher.stop();
    }
    if (this.closedSetEngine) {
      this.closedSetEngine.stop();
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
    if (this.dom.btnModeGenai) this.dom.btnModeGenai.classList.remove('active');
    if (this.dom.btnModeAllSides) this.dom.btnModeAllSides.classList.remove('active');
    if (this.dom.btnModeClosedSet) this.dom.btnModeClosedSet.classList.remove('active');
    this.dom.btnModeAi.classList.add('active');

    this.dom.modelDock.style.display = 'none';
    if(this.dom.mainPanel) this.dom.mainPanel.style.display = 'none';
    if (this.dom.genaiContainer) this.dom.genaiContainer.style.display = 'none';
    if (this.dom.allsidesContainer) this.dom.allsidesContainer.style.display = 'none';
    if (this.dom.closedsetContainer) this.dom.closedsetContainer.style.display = 'none';
    this.dom.trackingStatus.style.display = 'flex';
    this.dom.scanningHud.style.display = 'none';

    this._setTrackingState(false, 'Initializing AI Vision...');

    if (this.arEngine) this.arEngine.stop();
    if (this.allSidesMatcher) this.allSidesMatcher.stop();
    if (this.closedSetEngine) this.closedSetEngine.stop();
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
        let displayLabel = className;
        if (className === 'alqami' || className === 'vase') displayLabel = 'Alqami (تحفة القمي)';
        else if (className === 'knife' || className === 'sword') displayLabel = 'Zulfiqar (سيف ذو الفقار)';
        else if (className === 'cup' || className === 'bowl') displayLabel = 'Saqakhane (طاسة سقاخانة)';
        else if (className === 'book') displayLabel = 'Quran / Manuscript (المصحف الشريف)';

        this._setTrackingState(true, `Recognized: ${displayLabel}`);
        
        // Show simulated metadata based on detection
        const baseUrl = import.meta.env.BASE_URL || './';
        let ttlFile = 'model.ttl'; // fallback
        if (className === 'alqami' || className === 'vase') ttlFile = 'alqami.ttl';
        else if (className === 'cup' || className === 'bowl') ttlFile = 'saqakhane_bowl.ttl';
        else if (className === 'knife' || className === 'sword') ttlFile = 'Zulfiqar_Sword.ttl';
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
    if (this.dom.genaiContainer) this.dom.genaiContainer.style.display = 'block';

    this.dom.btnMode3d.classList.remove('active');
    this.dom.btnModeScan.classList.remove('active');
    if (this.dom.btnModeAi) this.dom.btnModeAi.classList.remove('active');
    if (this.dom.btnModeAllSides) this.dom.btnModeAllSides.classList.remove('active');
    if (this.dom.btnModeClosedSet) this.dom.btnModeClosedSet.classList.remove('active');
    if (this.dom.btnModeGenai) this.dom.btnModeGenai.classList.add('active');

    this.dom.modelDock.style.display = 'none';
    if (this.dom.mainPanel) this.dom.mainPanel.style.display = 'none';
    if (this.dom.allsidesContainer) this.dom.allsidesContainer.style.display = 'none';
    if (this.dom.closedsetContainer) this.dom.closedsetContainer.style.display = 'none';
    this.dom.trackingStatus.style.display = 'flex';
    this.dom.scanningHud.style.display = 'none';

    this._setTrackingState(false, 'GenAI Curator Ready');

    if (this.arEngine) this.arEngine.stop();
    if (this.aiEngine) this.aiEngine.stop();
    if (this.allSidesMatcher) this.allSidesMatcher.stop();
    if (this.closedSetEngine) this.closedSetEngine.stop();

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

  async _startAllSidesMode() {
    this.mode = 'allsides';
    this.dom.simulatorContainer.style.display = 'none';
    this.dom.arContainer.style.display = 'none';
    if (this.dom.aiContainer) this.dom.aiContainer.style.display = 'none';
    if (this.dom.genaiContainer) this.dom.genaiContainer.style.display = 'none';
    if (this.dom.allsidesContainer) this.dom.allsidesContainer.style.display = 'block';

    this.dom.btnMode3d.classList.remove('active');
    this.dom.btnModeScan.classList.remove('active');
    if (this.dom.btnModeAi) this.dom.btnModeAi.classList.remove('active');
    if (this.dom.btnModeGenai) this.dom.btnModeGenai.classList.remove('active');
    if (this.dom.btnModeClosedSet) this.dom.btnModeClosedSet.classList.remove('active');
    if (this.dom.btnModeAllSides) this.dom.btnModeAllSides.classList.add('active');

    this.dom.modelDock.style.display = 'none';
    if (this.dom.mainPanel) this.dom.mainPanel.style.display = 'none';
    if (this.dom.closedsetContainer) this.dom.closedsetContainer.style.display = 'none';
    this.dom.trackingStatus.style.display = 'flex';
    this.dom.scanningHud.style.display = 'none';

    this._setTrackingState(false, 'وجه الكاميرا نحو صندوق التحفة (تتبع 3D مستمر)...');

    if (this.arEngine) this.arEngine.stop();
    if (this.aiEngine) this.aiEngine.stop();
    if (this.closedSetEngine) this.closedSetEngine.stop();
    this._stopGenAiCamera();

    if (!this.allSidesMatcher) {
      const viewport = document.getElementById('allsides-ar-viewport');
      const hud = document.getElementById('allsides-hud');
      this.allSidesMatcher = new AllSidesMatcher(viewport, hud);
      await this.allSidesMatcher.init();

      // Pre-load Al-Qabasat RDF metadata into the 3D Holographic card
      const baseUrl = import.meta.env.BASE_URL || './';
      const cacheBust = `?v=${Date.now()}`;
      try {
        const data = await this.rdfParser.loadFromUrl(`${baseUrl}alqabasat.ttl${cacheBust}`);
        this.rawInitialTtl = this.rdfParser.rawTurtle;
        if (this.dom.ttlEditor) this.dom.ttlEditor.value = this.rawInitialTtl;
        this._updateUIWithMetadata(data.metadata);
        this.allSidesMatcher.setMetadata(data.metadata);

        if (this.graphVisualizer) {
          this.graphVisualizer.setData(this.rdfParser.getGraphData());
        }
      } catch (err) {
        console.error('Error preloading Alqabasat metadata:', err);
      }

      this.lastVoiceSide = null;
      this.allSidesMatcher.onMatch = async (matchData) => {
        console.log('Continuous 3D WebXR Side Detected:', matchData);

        // Highlight matching side pill
        const pills = document.querySelectorAll('.side-pill');
        pills.forEach(p => p.classList.remove('active'));
        const activePill = document.getElementById(`pill-${matchData.side.id}`);
        if (activePill) activePill.classList.add('active');

        this._setTrackingState(true, `القبسات (Al-Qabasat) — تتبع 3D مستمر: ${matchData.side.nameAr}`);

        if (this.dom.mainPanel) {
          this.dom.mainPanel.style.display = 'flex';
          this.dom.mainPanel.classList.remove('hidden');
        }

        // Voice feedback when side changes
        if (this.speech && this.lastVoiceSide !== matchData.side.id) {
          this.lastVoiceSide = matchData.side.id;
          this.speech.speak(`تم التعرف على مخطوط القبسات من ${matchData.side.nameAr} بتتبع هولوغرافي ثلاثي الأبعاد مستمر.`, 'ar');
        }
      };

      if (this.allSidesMatcher.renderer && this.allSidesMatcher.camera) {
        this._setupInteractionRaycasting(this.allSidesMatcher.renderer.domElement, this.allSidesMatcher.camera);
      }
    }

    try {
      await this.allSidesMatcher.start();
    } catch (err) {
      console.error('Failed to start AllSidesMatcher:', err);
      this._setTrackingState(false, 'تعذر فتح كاميرا الواقع المعزز');
    }
  }

  async _startClosedSetMode() {
    this.mode = 'closedset';
    this.dom.simulatorContainer.style.display = 'none';
    this.dom.arContainer.style.display = 'none';
    if (this.dom.aiContainer) this.dom.aiContainer.style.display = 'none';
    if (this.dom.genaiContainer) this.dom.genaiContainer.style.display = 'none';
    if (this.dom.allsidesContainer) this.dom.allsidesContainer.style.display = 'none';
    if (this.dom.closedsetContainer) this.dom.closedsetContainer.style.display = 'block';

    this.dom.btnMode3d.classList.remove('active');
    this.dom.btnModeScan.classList.remove('active');
    if (this.dom.btnModeAi) this.dom.btnModeAi.classList.remove('active');
    if (this.dom.btnModeGenai) this.dom.btnModeGenai.classList.remove('active');
    if (this.dom.btnModeAllSides) this.dom.btnModeAllSides.classList.remove('active');
    if (this.dom.btnModeClosedSet) this.dom.btnModeClosedSet.classList.add('active');

    this.dom.modelDock.style.display = 'none';
    if (this.dom.mainPanel) this.dom.mainPanel.style.display = 'none';
    this.dom.trackingStatus.style.display = 'flex';
    this.dom.scanningHud.style.display = 'none';

    this._setTrackingState(false, 'التعرف المغلق: جاري فحص البيئة بحثاً عن المقتنيات المسجلة...');

    if (this.arEngine) this.arEngine.stop();
    if (this.aiEngine) this.aiEngine.stop();
    if (this.allSidesMatcher) this.allSidesMatcher.stop();
    this._stopGenAiCamera();

    if (!this.closedSetEngine) {
      const video = document.getElementById('closedset-video');
      const canvas = document.getElementById('closedset-canvas');
      const hudContainer = document.getElementById('closedset-hud-container');

      this.closedSetEngine = new ClosedSetRecognitionEngine(video, canvas);
      await this.closedSetEngine.init();

      this.testInspectorHUD = new TestInspectorHUD(hudContainer, (newThreshold) => {
        this.closedSetEngine.setThreshold(newThreshold);
      });

      this.closedSetEngine.onEvaluation = (report) => {
        this.testInspectorHUD.update(report);
      };

      this.lastConfirmedSpeechId = null;
      this.closedSetEngine.onArtifactConfirmed = async (match) => {
        console.log('Closed-Set Confirmed Match:', match);
        this._setTrackingState(true, `✓ تم التعرف: ${match.id} — ${match.title} (${Math.round(match.similarity * 100)}%)`);

        // Load linked BIBFRAME record
        const baseUrl = import.meta.env.BASE_URL || './';
        const cacheBust = `?v=${Date.now()}`;
        const ttlFile = match.artifact.bibframe?.ttlPath || 'model.ttl';

        try {
          const data = await this.rdfParser.loadFromUrl(`${baseUrl}${ttlFile}${cacheBust}`);
          this.rawInitialTtl = this.rdfParser.rawTurtle;
          if (this.dom.ttlEditor) this.dom.ttlEditor.value = this.rawInitialTtl;
          this._updateUIWithMetadata(data.metadata);

          if (this.graphVisualizer) {
            this.graphVisualizer.setData(this.rdfParser.getGraphData());
          }

          if (this.dom.mainPanel) {
            this.dom.mainPanel.style.display = 'flex';
            this.dom.mainPanel.classList.remove('hidden');
          }

          if (this.speech && this.lastConfirmedSpeechId !== match.id) {
            this.lastConfirmedSpeechId = match.id;
            this.speech.speak(`تم التعرف على القطعة المسجلة: ${match.title}.`, 'ar');
          }
        } catch (err) {
          console.warn('Error loading BIBFRAME TTL for artifact:', match.id, err);
        }
      };

      this.closedSetEngine.onArtifactLost = () => {
        this._setTrackingState(false, '⚠️ UNKNOWN ARTIFACT — القطعة غير مسجلة في قاعدة المقتنيات');
        if (this.dom.mainPanel) {
          this.dom.mainPanel.style.display = 'none';
        }
        this.lastConfirmedSpeechId = null;
      };
    }

    try {
      await this.closedSetEngine.start();
    } catch (err) {
      console.error('Failed to start ClosedSetRecognitionEngine:', err);
      this._setTrackingState(false, 'تعذر فتح الكاميرا');
    }
  }

  _setupInteractionRaycasting(domElement, camera) {
    const handleTap = (e) => {
      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

      let hitHotspot = null;
      if (this.allSidesMatcher && this.allSidesMatcher.cardManager) {
        hitHotspot = this.allSidesMatcher.cardManager.checkRaycast(
          camera,
          clientX,
          clientY,
          domElement.clientWidth,
          domElement.clientHeight
        );
      } else if (this.cardManagers && this.cardManagers.length > 0) {
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

    if (this.dom.btnModeAllSides) {
      this.dom.btnModeAllSides.addEventListener('click', () => {
        if (this.mode !== 'allsides') this._startAllSidesMode();
      });
    }

    if (this.dom.btnModeClosedSet) {
      this.dom.btnModeClosedSet.addEventListener('click', () => {
        if (this.mode !== 'closedset') this._startClosedSetMode();
      });
    }

    if (this.dom.btnAdminManager) {
      this.dom.btnAdminManager.addEventListener('click', () => {
        if (!this.artifactManagerModal) {
          this.artifactManagerModal = new ArtifactManagerModal(this.dom.artifactManagerModal, () => {
            if (this.closedSetEngine) {
              this.closedSetEngine.reloadDatabase();
            }
          });
        }
        this.artifactManagerModal.open();
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
