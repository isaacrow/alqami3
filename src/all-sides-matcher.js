// 3D WebXR Continuous Multi-Side Object AR Engine for Alqami
// Tracks all 5 sides of the Prague Box with continuous 3D holographic metadata & 3D model

import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ARCardManager } from './ar-card.js';

export const SIDES_CONFIG = [
  { id: 'front', index: 0, nameAr: 'الجهة الأمامية (Praha Facade)', icon: '🏛️' },
  { id: 'back', index: 1, nameAr: 'الجهة الخلفية (Kč 120 Sticker)', icon: '🏷️' },
  { id: 'side1', index: 2, nameAr: 'الجانب الأيسر (Vertical Slot)', icon: '📐' },
  { id: 'side2', index: 3, nameAr: 'الجانب الأيمن (Vertical Slot)', icon: '📐' },
  { id: 'top', index: 4, nameAr: 'الجهة العلوية (Top Opening)', icon: '🔲' }
];

export class AllSidesMatcher {
  constructor(viewportContainer, hudContainer) {
    this.container = viewportContainer;
    this.hudContainer = hudContainer;
    this.baseUrl = import.meta.env.BASE_URL || './';
    
    this.mindarThree = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.anchors = [];
    
    // Continuous 3D Root Group (Anchored in 3D Space Across All Sides)
    this.continuous3DGroup = new THREE.Group();
    this.cardManager = null;
    this.manuscriptModel = null;
    this.badgeMesh = null;
    this.badgeCanvas = null;
    this.badgeTexture = null;
    
    // Continuity smoothing math
    this.tempTargetPos = new THREE.Vector3();
    this.tempTargetQuat = new THREE.Quaternion();
    this.lastSeenTime = 0;
    this.lastActiveIndex = -1;
    this.currentReportedSide = -1;
    this.isRunning = false;
    
    // Callbacks
    this.onMatch = null;
    this.onActiveSideChange = null;
  }

  async init() {
    console.log('Initializing 3D WebXR Continuous All-Sides Engine...');
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera getUserMedia not supported.');
    }

    const cacheBust = `?v=${Date.now()}`;
    this.mindarThree = new MindARThree({
      container: this.container,
      imageTargetSrc: `${this.baseUrl}targets/praha_box.mind${cacheBust}`,
      filterMinCF: 0.0005, // Ultra-smooth filter for jitter reduction
      filterBeta: 500,
      warmupTolerance: 3,
      missTolerance: 10,
      uiLoading: 'no',
      uiScanning: 'no'
    });

    const { renderer, scene, camera } = this.mindarThree;
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    if (renderer.outputEncoding !== undefined) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // 1. Lighting Setup for 3D Assets
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff3e0, 2.0);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);

    const cyanPointLight = new THREE.PointLight(0x00f2fe, 2.5, 6);
    cyanPointLight.position.set(0, 1.2, 0.8);
    scene.add(cyanPointLight);

    // 2. Setup 5 Anchor targets (0: Front, 1: Back, 2: Side1, 3: Side2, 4: Top)
    this.anchors = [];
    for (let i = 0; i < 5; i++) {
      try {
        const anchor = this.mindarThree.addAnchor(i);
        this.anchors.push(anchor);

        anchor.onTargetFound = () => {
          this.lastActiveIndex = i;
          this.lastSeenTime = performance.now();
          this._handleSideFound(i);
        };

        anchor.onTargetLost = () => {
          // Continuity handled in render loop
        };
      } catch (e) {
        console.warn(`Anchor ${i} init warning:`, e);
      }
    }

    // 3. Build Continuous 3D Group
    this.continuous3DGroup.visible = false;
    scene.add(this.continuous3DGroup);

    // 3a. 3D Holographic Card Manager
    this.cardManager = new ARCardManager(this.continuous3DGroup);

    // 3b. Load 3D Manuscript Model (Al-Qabasat)
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(`${this.baseUrl}model.glb`, (gltf) => {
      const model = gltf.scene;
      // Scale and position floating directly above target
      model.scale.set(0.65, 0.65, 0.65);
      model.position.set(0, 0.22, 0.12);
      this.manuscriptModel = model;
      this.continuous3DGroup.add(model);
      console.log('Loaded Al-Qabasat 3D Manuscript model into AR continuous group');
    }, undefined, (err) => {
      console.warn('Could not load 3D model.glb, card will display standalone:', err);
    });

    // 3c. Build 3D Orientation Badge (Floats in 3D Space)
    this._create3DOrientationBadge();

    return true;
  }

  _create3DOrientationBadge() {
    this.badgeCanvas = document.createElement('canvas');
    this.badgeCanvas.width = 512;
    this.badgeCanvas.height = 128;
    this.badgeCtx = this.badgeCanvas.getContext('2d');

    this.badgeTexture = new THREE.CanvasTexture(this.badgeCanvas);
    this.badgeTexture.minFilter = THREE.LinearFilter;

    const badgeGeo = new THREE.PlaneGeometry(0.72, 0.18);
    const badgeMat = new THREE.MeshBasicMaterial({
      map: this.badgeTexture,
      transparent: true,
      side: THREE.DoubleSide
    });

    this.badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
    this.badgeMesh.position.set(0, 1.05, 0.18); // Above the holographic card
    this.continuous3DGroup.add(this.badgeMesh);

    this._render3DBadgeText(SIDES_CONFIG[0]);
  }

  _render3DBadgeText(side) {
    if (!this.badgeCtx) return;
    const ctx = this.badgeCtx;
    const w = 512;
    const h = 128;

    ctx.clearRect(0, 0, w, h);

    // Pill background
    ctx.fillStyle = 'rgba(10, 18, 30, 0.92)';
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, h - 16, 24);
    ctx.fill();
    ctx.stroke();

    // Top text: active side
    ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = '#00f2fe';
    ctx.textAlign = 'center';
    ctx.fillText(`${side.icon} ${side.nameAr}`, w / 2, 54);

    // Subtitle
    ctx.font = '600 20px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('القبسات (Al-Qabasat) — تتبع 3D مستمر', w / 2, 94);

    if (this.badgeTexture) this.badgeTexture.needsUpdate = true;
  }

  async start() {
    if (!this.mindarThree) await this.init();
    this.isRunning = true;

    try {
      await this.mindarThree.start();
      console.log('MindAR Three.js WebXR engine started successfully!');

      let lastAnimTime = performance.now();

      this.renderer.setAnimationLoop(() => {
        if (!this.isRunning) return;

        const now = performance.now();
        const delta = (now - lastAnimTime) / 1000;
        lastAnimTime = now;

        // Gentle 3D model rotation
        if (this.manuscriptModel) {
          this.manuscriptModel.rotation.y += delta * 0.45;
          this.manuscriptModel.position.y = 0.22 + Math.sin(now * 0.002) * 0.02;
        }

        // Update holographic card animations (hotspots, subtle bobble)
        if (this.cardManager) {
          this.cardManager.update(delta);
        }

        // CONTINUITY LOGIC: Track across all 5 sides
        let visibleAnchorIndex = -1;
        for (let i = 0; i < this.anchors.length; i++) {
          if (this.anchors[i].group.visible) {
            visibleAnchorIndex = i;
            this.lastActiveIndex = i;
            this.lastSeenTime = now;
            break;
          }
        }

        if (visibleAnchorIndex !== -1) {
          const visibleAnchor = this.anchors[visibleAnchorIndex];
          visibleAnchor.group.getWorldPosition(this.tempTargetPos);
          visibleAnchor.group.getWorldQuaternion(this.tempTargetQuat);

          // Smooth interpolation so switching sides is fluid and continuous
          this.continuous3DGroup.position.lerp(this.tempTargetPos, 0.28);
          this.continuous3DGroup.quaternion.slerp(this.tempTargetQuat, 0.28);
          this.continuous3DGroup.visible = true;

          const side = SIDES_CONFIG[visibleAnchorIndex] || SIDES_CONFIG[0];
          this._render3DBadgeText(side);

          if (visibleAnchorIndex !== this.currentReportedSide) {
            this.currentReportedSide = visibleAnchorIndex;
            this._handleSideFound(visibleAnchorIndex);
          }
        } else {
          // CONTINUITY GRACE PERIOD: When turning box from side to side,
          // maintain 3D metadata in space for 2.5 seconds!
          const timeSinceSeen = now - this.lastSeenTime;
          if (timeSinceSeen < 2500) {
            this.continuous3DGroup.visible = true;
          } else {
            this.continuous3DGroup.visible = false;
            this.currentReportedSide = -1;
          }
        }

        this.renderer.render(this.scene, this.camera);
      });
    } catch (err) {
      console.error('Error starting MindAR WebXR engine:', err);
      throw err;
    }
  }

  stop() {
    this.isRunning = false;
    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
    }
    if (this.mindarThree) {
      try {
        this.mindarThree.stop();
      } catch (e) {
        console.warn('Error stopping MindAR:', e);
      }
    }
    if (this.continuous3DGroup) {
      this.continuous3DGroup.visible = false;
    }
    this.currentReportedSide = -1;
  }

  setMetadata(meta) {
    if (this.cardManager) {
      this.cardManager.createHolographicCard(meta);
    }
  }

  _handleSideFound(index) {
    const side = SIDES_CONFIG[index] || SIDES_CONFIG[0];
    console.log(`Continuous 3D WebXR: Side ${index} (${side.nameAr}) Active`);

    if (this.onMatch) {
      this.onMatch({
        side: side,
        confidence: 98,
        index: index
      });
    }

    if (this.onActiveSideChange) {
      this.onActiveSideChange(side);
    }
  }
}
