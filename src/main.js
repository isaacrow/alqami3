import { RDFManuscriptParser } from './rdf-parser.js';
import { AREngine } from './ar-engine.js';
import { ARCardManager } from './ar-card.js';
import { RDFGraphVisualizer } from './graph-visualizer.js';
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
    this.rawInitialTtl = '';
    this.activeHotspot = null;
    this.lastTime = performance.now();

    // DOM Elements
    this.dom = {
      arContainer: document.getElementById('ar-container'),
      simulatorContainer: document.getElementById('simulator-container'),
      modeToggleBtn: document.getElementById('btn-mode-toggle'),
      modeIconSvg: document.getElementById('mode-icon-svg'),
      modeText: document.getElementById('mode-text'),
      audioGuideBtn: document.getElementById('btn-audio-guide'),
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
    console.log('Initializing Alqami AR...');
    this._setupTabNavigation();
    this._setupModals();
    this._setupButtons();

    // 1. Load and parse RDF data
    try {
      const baseUrl = import.meta.env.BASE_URL || './';
      const data = await this.rdfParser.loadFromUrl(`${baseUrl}model.ttl`);
      this.rawInitialTtl = this.rdfParser.rawTurtle;
      this.dom.ttlEditor.value = this.rawInitialTtl;
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

    // 2. Initialize Simulator Mode (3D Mode) first!
    this._startSimulatorMode();
  }

  async _startCameraMode() {
    this.mode = 'camera';
    this.dom.arContainer.style.display = 'block';
    this.dom.simulatorContainer.style.display = 'none';
    this.dom.modeText.textContent = 'Scan Mode';
    this.dom.modeToggleBtn.classList.add('active');

    this._setTrackingState(false, 'Scanning for manuscript');

    try {
      if (!this.arEngine) {
        const baseUrl = import.meta.env.BASE_URL || './';
        this.arEngine = new AREngine(this.dom.arContainer, `${baseUrl}targets/manuscript.mind`);

        this.arEngine.onTargetFound = () => {
          console.log('Target Detected in AR Camera');
          this._setTrackingState(true, 'Target Tracked · 60 FPS');
        };

        this.arEngine.onTargetLost = () => {
          console.log('Target Lost in AR Camera');
          this._setTrackingState(false, 'Scanning for manuscript');
        };

        this.arEngine.onError = (err) => {
          console.warn('Camera AR unavailable, switching to Simulator:', err);
          this._startSimulatorMode();
        };

        const { renderer, scene, camera, anchorGroup } = await this.arEngine.init();

        this.cardManager = new ARCardManager(anchorGroup);
        this.cardManager.createHolographicCard(this.rdfParser.metadata);
        this.cardManager.createHotspots(this.rdfParser.hotspots);

        this.lastTime = performance.now();
        await this.arEngine.start(() => {
          const now = performance.now();
          const delta = (now - this.lastTime) / 1000;
          this.lastTime = now;
          if (this.cardManager) {
            this.cardManager.update(delta);
          }
        });

        this._setupInteractionRaycasting(renderer.domElement, camera);
      }
    } catch (err) {
      console.warn('Camera AR init failed, switching to Desktop Simulator:', err);
      this._startSimulatorMode();
    }
  }

  _startSimulatorMode() {
    this.mode = 'simulator';
    this.dom.arContainer.style.display = 'none';
    this.dom.simulatorContainer.style.display = 'block';
    this.dom.modeText.textContent = '3D Mode';
    this.dom.modeToggleBtn.classList.remove('active');

    if (this.arEngine) {
      this.arEngine.stop();
      this.arEngine = null;
    }

    this._setTrackingState(true, '3D Viewer Active');
    
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

  _setupInteractionRaycasting(domElement, camera) {
    const handleTap = (e) => {
      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

      if (this.cardManager) {
        const hitHotspot = this.cardManager.checkRaycast(
          camera,
          clientX,
          clientY,
          domElement.clientWidth,
          domElement.clientHeight
        );

        if (hitHotspot) {
          this._openHotspotModal(hitHotspot);
        }
      }
    };

    domElement.addEventListener('click', handleTap);
  }

  _setTrackingState(isFound, message) {
    if (isFound) {
      this.dom.trackingStatus.classList.add('found');
      this.dom.trackingText.textContent = message || 'Target Tracked';
      if (this.dom.scanningHud) this.dom.scanningHud.classList.add('hidden');
    } else {
      this.dom.trackingStatus.classList.remove('found');
      this.dom.trackingText.textContent = message || 'Scanning for manuscript';
      if (this.dom.scanningHud) this.dom.scanningHud.classList.remove('hidden');
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
    // Mode switch
    this.dom.modeToggleBtn.addEventListener('click', () => {
      if (this.mode === 'camera') {
        this._startSimulatorMode();
      } else {
        this._startCameraMode();
      }
    });

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
