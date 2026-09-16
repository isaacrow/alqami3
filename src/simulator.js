import * as THREE from 'three';

export class ManuscriptSimulator {
  constructor(containerElement, onTargetFound, onTargetLost) {
    this.container = containerElement;
    this.onTargetFound = onTargetFound;
    this.onTargetLost = onTargetLost;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    this.anchorGroup = new THREE.Group();
    this.scene.add(this.anchorGroup);

    this.manuscriptMesh = null;
    this.isTracking = false;
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.cameraRotation = { x: -0.4, y: 0 };
    this.cameraDistance = 1.6;

    this.animId = null;
    this._initScene();
  }

  _initScene() {
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (this.renderer.outputEncoding !== undefined) {
      this.renderer.outputEncoding = THREE.sRGBEncoding;
    }
    this.container.appendChild(this.renderer.domElement);

    // Camera initial pose
    this._updateCameraTransform();

    // Subtle atmospheric ambient lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.8);
    dirLight.position.set(2, 4, 3);
    this.scene.add(dirLight);

    // Blue holographic back rim light
    const rimLight = new THREE.PointLight(0x00d2ff, 2.5, 10);
    rimLight.position.set(-2, 2, -1);
    this.scene.add(rimLight);

    // Load manuscript plane
    const baseUrl = import.meta.env.BASE_URL || './';
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(`${baseUrl}manuscript.jpg`, (tex) => {
      if (tex.encoding !== undefined) {
        tex.encoding = THREE.sRGBEncoding;
      }
      const aspect = tex.image.width / tex.image.height;
      const height = 1.0 / aspect;

      // Realistic manuscript parchment material
      const planeGeo = new THREE.PlaneGeometry(1.0, height);
      const planeMat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.8,
        metalness: 0.1,
        side: THREE.DoubleSide
      });
      this.manuscriptMesh = new THREE.Mesh(planeGeo, planeMat);
      this.manuscriptMesh.rotation.x = -Math.PI / 2; // Flat on table
      this.anchorGroup.add(this.manuscriptMesh);

      // Studio tabletop / desk grid
      const grid = new THREE.GridHelper(5, 20, 0x00d2ff, 0x1e293b);
      grid.position.y = -0.01;
      this.scene.add(grid);

      // Trigger detected
      this.isTracking = true;
      if (this.onTargetFound) this.onTargetFound();
    });

    this._setupControls();
    this._animate();
  }

  _setupControls() {
    const dom = this.renderer.domElement;

    const onPointerDown = (e) => {
      this.isDragging = true;
      this.previousMousePosition = {
        x: e.touches ? e.touches[0].clientX : e.clientX,
        y: e.touches ? e.touches[0].clientY : e.clientY
      };
    };

    const onPointerMove = (e) => {
      if (!this.isDragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - this.previousMousePosition.x;
      const deltaY = clientY - this.previousMousePosition.y;

      this.cameraRotation.y -= deltaX * 0.006;
      this.cameraRotation.x -= deltaY * 0.006;
      // Clamp vertical pitch
      this.cameraRotation.x = Math.max(-Math.PI / 2.2, Math.min(-0.05, this.cameraRotation.x));

      this.previousMousePosition = { x: clientX, y: clientY };
      this._updateCameraTransform();
    };

    const onPointerUp = () => {
      this.isDragging = false;
    };

    const onWheel = (e) => {
      this.cameraDistance += e.deltaY * 0.0015;
      this.cameraDistance = Math.max(0.6, Math.min(3.5, this.cameraDistance));
      this._updateCameraTransform();
      e.preventDefault();
    };

    dom.addEventListener('mousedown', onPointerDown);
    dom.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    dom.addEventListener('touchstart', onPointerDown, { passive: true });
    dom.addEventListener('touchmove', onPointerMove, { passive: true });
    dom.addEventListener('touchend', onPointerUp);

    dom.addEventListener('wheel', onWheel, { passive: false });

    window.addEventListener('resize', () => this.resize());
  }

  _updateCameraTransform() {
    const phi = -this.cameraRotation.x;
    const theta = this.cameraRotation.y;

    this.camera.position.x = this.cameraDistance * Math.sin(phi) * Math.sin(theta);
    this.camera.position.y = this.cameraDistance * Math.cos(phi);
    this.camera.position.z = this.cameraDistance * Math.sin(phi) * Math.cos(theta);

    this.camera.lookAt(0, 0.1, 0);
  }

  _animate() {
    this.animId = requestAnimationFrame(() => this._animate());
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  getAnchorGroup() {
    return this.anchorGroup;
  }

  getCamera() {
    return this.camera;
  }

  destroy() {
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
