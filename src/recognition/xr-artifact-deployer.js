// XR AR Spatial Deployment Engine for Alqami Custom Artifact Recognition
// Renders 3D holographic metadata & 3D models directly anchored on the physical artifact

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ARCardManager } from '../ar-card.js';

export class XRArtifactDeployer {
  constructor(overlayContainer) {
    this.container = overlayContainer;
    this.baseUrl = import.meta.env.BASE_URL || './';

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.animFrameId = null;

    // Root 3D Anchor Group (Anchored onto physical artifact's screen coordinates)
    this.rootAnchorGroup = new THREE.Group();
    this.modelGroup = new THREE.Group();
    this.cardGroup = new THREE.Group();
    this.tetherGroup = new THREE.Group();

    this.cardManager = null;
    this.currentModel = null;
    this.gltfLoader = new GLTFLoader();

    // State & Animation
    this.isConfirmed = false;
    this.targetScale = 0;
    this.currentScale = 0;
    this.currentArtifactId = null;
    this.time = 0;
    this.rotationSpeed = 0.008;
    this.userRotating = false;
    this.previousTouchX = 0;

    // 3D Skeletal / Morph Animation Mixer for Interactive Models (e.g. Nahj al-Balagha Open Book)
    this.clock = new THREE.Clock();
    this.mixer = null;
    this.animations = [];
    this.bookAction = null;
    this.currentClip = null;
    this.isBookOpen = false;
    this.onAnimationStateChange = null;

    // Screen-to-3D projection caches
    this.target3DPos = new THREE.Vector3(0, 0, -2.4);
    this.current3DPos = new THREE.Vector3(0, 0, -2.4);

    // Tether line geometry
    this.tetherLine = null;
  }

  async init() {
    console.log('Initializing XR Artifact Deployer (3D WebXR on Artifact)...');

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 1. Scene & Perspective Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 0);

    // 2. WebGL Renderer with Alpha Transparency
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.container.appendChild(this.renderer.domElement);

    // 3. Realistic AR Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff5e6, 2.2);
    dirLight.position.set(2, 4, 3);
    this.scene.add(dirLight);

    const cyanGlowLight = new THREE.PointLight(0x00f2fe, 3.0, 8);
    cyanGlowLight.position.set(0, 0.8, 1);
    this.scene.add(cyanGlowLight);

    // 4. Build Hierarchy
    this.rootAnchorGroup.scale.set(0, 0, 0);
    this.rootAnchorGroup.position.copy(this.current3DPos);
    this.scene.add(this.rootAnchorGroup);

    // 4a. 3D Model Group (Floats above object)
    this.modelGroup.position.set(-0.35, 0.12, 0);
    this.rootAnchorGroup.add(this.modelGroup);

    // 4b. 3D Holographic Card Manager
    this.cardGroup.position.set(0.42, 0.18, 0);
    this.cardGroup.scale.set(0.68, 0.68, 0.68);
    this.rootAnchorGroup.add(this.cardGroup);
    this.cardManager = new ARCardManager(this.cardGroup);

    // 4c. Laser Tether Lines & Ground Base
    this._createLaserTethersAndGizmo();

    // 5. Preload 3D Model
    await this._load3DModel(`${this.baseUrl}model.glb`);

    // 6. Setup Interactive Touch / Drag Rotation
    this._setupTouchInteractions();

    // Resize listener
    window.addEventListener('resize', () => this._handleResize());

    this._animate();
    return true;
  }

  _createLaserTethersAndGizmo() {
    // 3D Laser Tether Line connecting artifact origin to floating 3D model and card
    const points = [
      new THREE.Vector3(0, -0.45, 0), // Physical artifact center
      new THREE.Vector3(0, -0.15, 0),
      new THREE.Vector3(-0.35, 0.12, 0), // To 3D Model
      new THREE.Vector3(0, -0.15, 0),
      new THREE.Vector3(0.42, 0.18, 0)  // To Metadata Card
    ];
    const tetherGeo = new THREE.BufferGeometry().setFromPoints(points);
    const tetherMat = new THREE.LineBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.75,
      linewidth: 2
    });
    this.tetherLine = new THREE.Line(tetherGeo, tetherMat);
    this.rootAnchorGroup.add(this.tetherLine);

    // Holographic Base Ring at physical contact plane
    const ringGeo = new THREE.RingGeometry(0.18, 0.22, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.45;
    this.rootAnchorGroup.add(ring);

    // Subtle pulsing center beacon
    const beaconGeo = new THREE.SphereGeometry(0.024, 16, 16);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = -0.45;
    this.rootAnchorGroup.add(beacon);
  }

  async _load3DModel(modelUrl) {
    return new Promise((resolve) => {
      this.gltfLoader.load(
        modelUrl,
        (gltf) => {
          if (this.currentModel) {
            this.modelGroup.remove(this.currentModel);
          }
          if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer = null;
          }

          this.currentModel = gltf.scene;

          // Process GLTF Animation Clips (e.g. Open_Book on Nahj al-Balagha)
          this.animations = gltf.animations || [];
          if (this.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(this.currentModel);
            const clip = this.animations.find(a => a.name === 'Open_Book') || this.animations[0];
            this.currentClip = clip;
            const action = this.mixer.clipAction(clip);
            action.setLoop(THREE.LoopOnce);
            action.clampWhenFinished = true;
            this.bookAction = action;
            this.isBookOpen = false;

            if (this.onAnimationStateChange) {
              this.onAnimationStateChange({
                hasAnimation: true,
                isOpen: false,
                clipName: clip.name
              });
            }
          } else {
            this.bookAction = null;
            this.currentClip = null;
            this.isBookOpen = false;
            if (this.onAnimationStateChange) {
              this.onAnimationStateChange({
                hasAnimation: false,
                isOpen: false,
                clipName: null
              });
            }
          }

          // Auto-center and normalize scale
          const box = new THREE.Box3().setFromObject(this.currentModel);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const desiredScale = 0.55 / maxDim;
          this.currentModel.scale.set(desiredScale, desiredScale, desiredScale);

          // Center pivot
          const center = box.getCenter(new THREE.Vector3());
          this.currentModel.position.sub(center.multiplyScalar(desiredScale));

          this.modelGroup.add(this.currentModel);
          console.log('XR 3D Model Loaded Successfully into AR layer:', modelUrl, 'Clips:', this.animations.map(a => a.name));
          resolve(this.currentModel);
        },
        undefined,
        (err) => {
          console.warn('Could not load 3D GLB model for XR layer:', err);
          resolve(null);
        }
      );
    });
  }

  toggleBookAnimation() {
    if (!this.mixer || !this.bookAction) return false;

    if (!this.isBookOpen) {
      // Open the book: play forward
      this.bookAction.reset();
      this.bookAction.timeScale = 1.0;
      this.bookAction.paused = false;
      this.bookAction.setLoop(THREE.LoopOnce);
      this.bookAction.clampWhenFinished = true;
      this.bookAction.play();
      this.isBookOpen = true;
    } else {
      // Close the book: play reverse smoothly
      this.bookAction.paused = false;
      this.bookAction.timeScale = -1.0;
      this.bookAction.setLoop(THREE.LoopOnce);
      this.bookAction.clampWhenFinished = true;
      this.bookAction.play();
      this.isBookOpen = false;
    }

    if (this.onAnimationStateChange) {
      this.onAnimationStateChange({
        hasAnimation: true,
        isOpen: this.isBookOpen,
        clipName: this.currentClip?.name || 'Open_Book'
      });
    }

    return this.isBookOpen;
  }

  _setupTouchInteractions() {
    const el = this.renderer.domElement;
    let startX = 0;
    let startY = 0;
    let hasMoved = false;

    const onStart = (clientX, clientY) => {
      this.userRotating = true;
      this.previousTouchX = clientX;
      startX = clientX;
      startY = clientY;
      hasMoved = false;
    };

    const onMove = (clientX, clientY) => {
      if (!this.userRotating) return;
      const deltaX = clientX - this.previousTouchX;
      if (Math.abs(clientX - startX) > 6 || Math.abs(clientY - startY) > 6) {
        hasMoved = true;
      }
      this.previousTouchX = clientX;
      this.modelGroup.rotation.y += deltaX * 0.015;
    };

    const onEnd = (clientX, clientY) => {
      this.userRotating = false;
      // If tapped without dragging, check raycast to trigger movement animation!
      if (!hasMoved && this.mixer && this.camera) {
        const rect = el.getBoundingClientRect();
        const mouseX = ((clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((clientY - rect.top) / rect.height) * 2 + 1;
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), this.camera);
        const hits = raycaster.intersectObjects(this.modelGroup.children, true);
        if (hits.length > 0) {
          this.toggleBookAnimation();
        }
      }
    };

    // Pointer events
    el.addEventListener('pointerdown', (e) => onStart(e.clientX, e.clientY));
    window.addEventListener('pointermove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('pointerup', (e) => onEnd(e.clientX, e.clientY));
    window.addEventListener('pointercancel', () => { this.userRotating = false; });
  }

  _handleResize() {
    if (!this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  deployArtifactXR(artifactData, metadata, roi, matchedView, similarityPct) {
    this.isConfirmed = true;
    this.targetScale = 1.0;

    // Convert 2D video ROI center to 3D spatial coordinate
    this._compute3DPositionFromROI(roi);

    // Update 3D Holographic Card Content
    const enrichedMeta = {
      title: metadata?.title || artifactData.title || 'Al-Qabasat Manuscript',
      titleArabic: artifactData.title || metadata?.titleArabic || 'القبسات — الميرداماد',
      identifier: `${artifactData.id} • [${(matchedView || 'FRONT').toUpperCase()}] ${similarityPct}%`,
      creator: metadata?.creator || 'الميرداماد، محمد باقر بن محمد',
      date: metadata?.date || '1650م / 1041 هجري',
      material: metadata?.material || 'ورق وخام، حبر أسود، خط النستعليق',
      publisher: metadata?.publisher || 'مكتبة مجلس الشورى : 4662',
      dimensions: metadata?.dimensions || '344 ورقة • 22 × 14 سم',
      description: metadata?.description || 'مخطوط فلسفي إسلامي عريق في إثبات الحدوث الدهري وتوفيق الفلسفة الإشراقية مع الشريعة.'
    };

    if (this.cardManager) {
      this.cardManager.createHolographicCard(enrichedMeta);
      if (metadata?.hotspots) {
        this.cardManager.createHotspots(metadata.hotspots);
      }
    }

    // Load specific model if artifact changes
    if (this.currentArtifactId !== artifactData.id) {
      this.currentArtifactId = artifactData.id;
      const baseUrl = import.meta.env.BASE_URL || './';
      let modelFile = 'model.glb';
      if (artifactData.arModel?.glb) {
        modelFile = artifactData.arModel.glb;
      } else if (artifactData.id === 'ART-003') {
        modelFile = 'Old_Islamic_Helmet.glb';
      } else if (artifactData.id === 'ART-006' || artifactData.id?.toLowerCase().includes('nahj') || (artifactData.title && artifactData.title.includes('نهج'))) {
        modelFile = 'nahj_al_balagha.glb';
      }
      this._load3DModel(`${baseUrl}${modelFile}`);
    }
  }

  collapseArtifactXR() {
    this.isConfirmed = false;
    this.targetScale = 0.0;
  }

  _compute3DPositionFromROI(roi) {
    if (!roi || !this.camera) return;

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // Screen center of ROI
    const centerX = roi.x + roi.width / 2;
    const centerY = roi.y + roi.height / 2;

    // Normalized Device Coordinates (-1 to +1)
    const ndcX = (centerX / width) * 2 - 1;
    const ndcY = -(centerY / height) * 2 + 1;

    // Compute 3D target coordinates at depth Z = -2.2m in front of camera
    const depth = 2.2;
    const vFOV = (this.camera.fov * Math.PI) / 180;
    const visibleH = 2 * Math.tan(vFOV / 2) * depth;
    const visibleW = visibleH * this.camera.aspect;

    this.target3DPos.set(
      (ndcX * visibleW) / 2,
      (ndcY * visibleH) / 2 + 0.12, // Slight elevation above center
      -depth
    );
  }

  _animate() {
    this.animFrameId = requestAnimationFrame(() => this._animate());

    this.time += 0.018;

    // Update Three.js Animation Mixer for Skeletal / Morph Movements (Nahj al-Balagha Open Book)
    if (this.clock) {
      const delta = this.clock.getDelta();
      if (this.mixer) {
        this.mixer.update(delta);
      }
    }

    // Smooth LERP scale for pop-in / fold-out
    this.currentScale += (this.targetScale - this.currentScale) * 0.14;
    this.rootAnchorGroup.scale.set(this.currentScale, this.currentScale, this.currentScale);

    // Smooth LERP spatial position
    this.current3DPos.lerp(this.target3DPos, 0.15);
    this.rootAnchorGroup.position.copy(this.current3DPos);

    // Active spatial floating physics
    if (this.currentScale > 0.02) {
      // Gentle levitation bobbing
      const levitation = Math.sin(this.time * 2.2) * 0.035;
      this.modelGroup.position.y = 0.12 + levitation;
      this.cardGroup.position.y = 0.18 + levitation * 0.5;

      // Auto-rotation if user isn't actively dragging
      if (!this.userRotating) {
        this.modelGroup.rotation.y += this.rotationSpeed;
      }

      // Subtle card breath tilt toward camera
      this.cardGroup.rotation.y = -Math.PI * 0.04 + Math.sin(this.time * 1.5) * 0.02;

      // Pulse tether laser opacity
      if (this.tetherLine && this.tetherLine.material) {
        this.tetherLine.material.opacity = 0.55 + Math.sin(this.time * 4) * 0.25;
      }

      // Update Card Manager animations (hotspots pulse, etc.)
      if (this.cardManager) {
        this.cardManager.update(0.018);
      }
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  stop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.collapseArtifactXR();
  }

  start() {
    if (!this.animFrameId) {
      this._animate();
    }
  }
}
