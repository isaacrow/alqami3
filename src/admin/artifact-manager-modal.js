// Artifact Recognition Manager (Admin Modal) for Alqami
import { ArtifactDatabase } from '../database/artifact-db.js';
import { FeatureExtractor } from '../recognition/feature-extractor.js';

export class ArtifactManagerModal {
  constructor(modalContainer, onDatabaseUpdated) {
    this.container = modalContainer;
    this.onDatabaseUpdated = onDatabaseUpdated;
    this.db = new ArtifactDatabase();
    this.featureExtractor = new FeatureExtractor();
    this.isOpen = false;
    this.artifacts = [];
    this.editingArtifact = null;
  }

  async init() {
    await Promise.all([
      this.db.init(),
      this.featureExtractor.init()
    ]);
  }

  async open() {
    await this.init();
    this.artifacts = await this.db.getAll();
    this.editingArtifact = null;
    this.isOpen = true;
    this.container.classList.add('active');
    this._renderList();
  }

  close() {
    this.isOpen = false;
    this.container.classList.remove('active');
  }

  _renderList() {
    this.container.innerHTML = `
      <div class="manager-modal-backdrop"></div>
      <div class="manager-modal-card vision-glass">
        <div class="manager-header">
          <div class="manager-title-group">
            <h2 class="manager-title">إدارة مقتنيات القمي (Artifact Recognition Manager)</h2>
            <p class="manager-subtitle">إدارة القطع المسجلة في النظام وتوليد البصمات البصرية متعددة الزوايا (1024-D Embeddings)</p>
          </div>
          <button id="btn-close-manager" class="btn-close-modal">✕</button>
        </div>

        <div class="manager-toolbar">
          <button id="btn-add-artifact" class="btn-primary-action">+ إضافة قطعة جديدة</button>
          <div class="toolbar-secondary-actions">
            <button id="btn-export-db" class="btn-secondary-action">📥 تصدير JSON</button>
            <label class="btn-secondary-action" for="file-import-db">
              📤 استيراد JSON
              <input type="file" id="file-import-db" accept=".json" style="display: none;" />
            </label>
            <button id="btn-reset-db" class="btn-danger-action" title="استعادة المقتنيات الافتراضية">🔄 استعادة الافتراضي</button>
          </div>
        </div>

        <div class="manager-content">
          <div class="artifacts-grid" id="artifacts-grid">
            ${this.artifacts.map(art => `
              <div class="artifact-card vision-glass" data-id="${art.id}">
                <div class="card-badge">${art.id}</div>
                <div class="card-info">
                  <h3 class="card-title">${art.title}</h3>
                  <div class="card-meta">
                    <span>${art.collection || 'مجموعة عامة'}</span> • 
                    <span>${art.images ? art.images.length : 0} زوايا تصوير</span>
                  </div>
                  <div class="card-threshold">
                    عتبة القبول: <strong>${Math.round((art.recognitionThreshold || 0.80) * 100)}%</strong>
                  </div>
                </div>
                <div class="card-actions">
                  <button class="btn-card-edit" data-id="${art.id}">✏️ تعديل / صور</button>
                  <button class="btn-card-delete" data-id="${art.id}">🗑️ حذف</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    this._bindListEvents();
  }

  _bindListEvents() {
    this.container.querySelector('#btn-close-manager')?.addEventListener('click', () => this.close());
    this.container.querySelector('.manager-modal-backdrop')?.addEventListener('click', () => this.close());

    this.container.querySelector('#btn-add-artifact')?.addEventListener('click', () => {
      this._openEditForm({
        id: `ART-00${this.artifacts.length + 1}`,
        identifier: `IPKSN:ART-00${this.artifacts.length + 1}`,
        title: '',
        type: 'artifact',
        description: '',
        collection: 'مقتنيات القمي المعرفية',
        institution: 'مؤسسة القمي للتراث المعرفي',
        date: new Date().getFullYear().toString(),
        materials: [],
        dimensions: {},
        recognitionThreshold: 0.80,
        images: [],
        embeddings: []
      }, true);
    });

    // Edit buttons
    this.container.querySelectorAll('.btn-card-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const art = this.artifacts.find(a => a.id === id);
        if (art) this._openEditForm(art, false);
      });
    });

    // Delete buttons
    this.container.querySelectorAll('.btn-card-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm(`هل أنت متأكد من حذف القطعة [${id}] من قاعدة البيانات؟`)) {
          await this.db.delete(id);
          this.artifacts = await this.db.getAll();
          this._renderList();
          if (this.onDatabaseUpdated) this.onDatabaseUpdated();
        }
      });
    });

    // Export
    this.container.querySelector('#btn-export-db')?.addEventListener('click', async () => {
      const json = await this.db.exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alqami-artifacts-database-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Import
    const fileImport = this.container.querySelector('#file-import-db');
    fileImport?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          await this.db.importJSON(event.target.result);
          alert('تم استيراد قاعدة البيانات بنجاح!');
          this.artifacts = await this.db.getAll();
          this._renderList();
          if (this.onDatabaseUpdated) this.onDatabaseUpdated();
        } catch (err) {
          alert('خطأ في استيراد الملف: ' + err.message);
        }
      };
      reader.readAsText(file);
    });

    // Reset default
    this.container.querySelector('#btn-reset-db')?.addEventListener('click', async () => {
      if (confirm('هل تريد بالتأكيد استعادة قاعدة المقتنيات الافتراضية؟ سيتم مسح أي تعديلات غير محفوظة في ملف خارجي.')) {
        await this.db.resetToDefault();
        this.artifacts = await this.db.getAll();
        this._renderList();
        if (this.onDatabaseUpdated) this.onDatabaseUpdated();
      }
    });
  }

  _openEditForm(artifact, isNew = false) {
    this.editingArtifact = JSON.parse(JSON.stringify(artifact));

    const modal = this.container.querySelector('.manager-modal-card');
    modal.innerHTML = `
      <div class="manager-header">
        <div class="manager-title-group">
          <h2 class="manager-title">${isNew ? 'إضافة قطعة جديدة' : `تعديل القطعة [${this.editingArtifact.id}]`}</h2>
          <p class="manager-subtitle">إدخال البيانات الوصفية ورفع صور الزوايا المتعددة لاستخراج البصمات الرياضية</p>
        </div>
        <button id="btn-back-to-list" class="btn-secondary-action">← العودة للقائمة</button>
      </div>

      <div class="edit-form-scrollable">
        <form id="artifact-edit-form" class="artifact-form">
          <div class="form-row">
            <div class="form-group">
              <label>المعرف الداخلي (Artifact ID):</label>
              <input type="text" id="form-art-id" value="${this.editingArtifact.id}" required ${!isNew ? 'readonly' : ''} />
            </div>
            <div class="form-group">
              <label>معرف IPKSN التراثي:</label>
              <input type="text" id="form-art-ipksn" value="${this.editingArtifact.identifier || ''}" placeholder="IPKSN:ART-00X" />
            </div>
          </div>

          <div class="form-group">
            <label>عنوان القطعة (Title):</label>
            <input type="text" id="form-art-title" value="${this.editingArtifact.title || ''}" required />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>المجموعة (Collection):</label>
              <input type="text" id="form-art-collection" value="${this.editingArtifact.collection || ''}" />
            </div>
            <div class="form-group">
              <label>المؤسسة الحافظة (Institution):</label>
              <input type="text" id="form-art-institution" value="${this.editingArtifact.institution || ''}" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>تاريخ القطعة / العهد:</label>
              <input type="text" id="form-art-date" value="${this.editingArtifact.date || ''}" />
            </div>
            <div class="form-group">
              <label>عتبة القبول للتعرف (0.50 - 0.98):</label>
              <input type="number" id="form-art-threshold" step="0.01" min="0.50" max="0.98" value="${this.editingArtifact.recognitionThreshold || 0.80}" />
            </div>
          </div>

          <div class="form-group">
            <label>الوصف الشامل للقطعة:</label>
            <textarea id="form-art-desc" rows="3">${this.editingArtifact.description || ''}</textarea>
          </div>

          <!-- Multi-View Images Section -->
          <div class="form-section-divider"></div>
          <h3 class="section-title">صور الزوايا المرجعية وبصمات التعرف (Multi-View Embeddings)</h3>
          
          <div class="upload-box-wrapper">
            <label class="btn-upload-file">
              📷 رفع صور جديدة للقطعة (Front, Back, Side, Detail...)
              <input type="file" id="form-image-uploader" multiple accept="image/*" style="display: none;" />
            </label>
            <span id="upload-status-text" style="font-size: 13px; color: var(--apple-blue);"></span>
          </div>

          <div id="views-preview-list" class="views-preview-list">
            ${(this.editingArtifact.images || []).map((img, idx) => `
              <div class="view-item-row" data-index="${idx}">
                <span class="view-tag-badge">${img.view || 'view'}</span>
                <span class="view-label-text">${img.label || img.file || 'Reference Photo'}</span>
                <span class="view-embedding-status ${this.editingArtifact.embeddings && this.editingArtifact.embeddings[idx] ? 'ready' : 'pending'}">
                  ${this.editingArtifact.embeddings && this.editingArtifact.embeddings[idx] ? '✓ البصمة جاهزة (1280-D)' : '⏳ بانتظار التوليد'}
                </span>
              </div>
            `).join('')}
          </div>

          <div class="form-actions-bottom">
            <button type="button" id="btn-generate-embeddings" class="btn-accent-action">⚡ توليد بصمات التعرف (Generate Embeddings)</button>
            <button type="submit" class="btn-primary-action">💾 حفظ القطعة في قاعدة البيانات</button>
          </div>
        </form>
      </div>
    `;

    this._bindFormEvents(isNew);
  }

  _bindFormEvents(isNew) {
    const form = this.container.querySelector('#artifact-edit-form');
    const btnBack = this.container.querySelector('#btn-back-to-list');
    const uploader = this.container.querySelector('#form-image-uploader');
    const btnGen = this.container.querySelector('#btn-generate-embeddings');
    const previewList = this.container.querySelector('#views-preview-list');
    const uploadStatus = this.container.querySelector('#upload-status-text');

    btnBack?.addEventListener('click', () => this._renderList());

    // Image Uploader Handler
    uploader?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files || files.length === 0) return;

      if (!this.editingArtifact.images) this.editingArtifact.images = [];
      if (!this.editingArtifact.pendingFiles) this.editingArtifact.pendingFiles = [];

      for (const file of files) {
        const url = URL.createObjectURL(file);
        const nameLower = file.name.toLowerCase();
        let view = 'angle';
        if (nameLower.includes('front')) view = 'front';
        else if (nameLower.includes('back')) view = 'back';
        else if (nameLower.includes('left') || nameLower.includes('side1')) view = 'left';
        else if (nameLower.includes('right') || nameLower.includes('side2')) view = 'right';
        else if (nameLower.includes('top')) view = 'top';
        else if (nameLower.includes('detail')) view = 'detail';

        this.editingArtifact.images.push({
          view: view,
          label: `${view.toUpperCase()} (${file.name})`,
          fileUrl: url,
          fileName: file.name
        });
        this.editingArtifact.pendingFiles.push({ file, url, view });
      }

      uploadStatus.textContent = `تم تحميل ${files.length} صور جديدة. يرجى الضغط على «توليد البصمات» ثم «حفظ».`;
      
      // Update preview UI
      previewList.innerHTML = this.editingArtifact.images.map((img, idx) => `
        <div class="view-item-row" data-index="${idx}">
          <span class="view-tag-badge">${img.view}</span>
          <span class="view-label-text">${img.label}</span>
          <span class="view-embedding-status pending">⏳ بانتظار التوليد</span>
        </div>
      `).join('');
    });

    // Generate Embeddings Handler
    btnGen?.addEventListener('click', async () => {
      if (!this.editingArtifact.images || this.editingArtifact.images.length === 0) {
        alert('يرجى رفع صور للقطعة أولاً.');
        return;
      }

      btnGen.disabled = true;
      btnGen.textContent = 'جاري استخراج البصمات الرياضية... ⏳';

      if (!this.editingArtifact.embeddings) this.editingArtifact.embeddings = [];

      for (let i = 0; i < this.editingArtifact.images.length; i++) {
        const imgInfo = this.editingArtifact.images[i];
        
        // Load image into HTMLImageElement
        const imgElem = new Image();
        imgElem.crossOrigin = 'anonymous';
        const src = imgInfo.fileUrl || `${import.meta.env.BASE_URL || './'}${imgInfo.file}`;
        
        await new Promise((resolve) => {
          imgElem.onload = () => resolve(true);
          imgElem.onerror = () => resolve(false);
          imgElem.src = src;
        });

        if (imgElem.width > 0) {
          try {
            const vector = await this.featureExtractor.extractEmbedding(imgElem);
            this.editingArtifact.embeddings[i] = {
              view: imgInfo.view,
              label: imgInfo.label,
              vector: Array.from(vector).map(n => Math.round(n * 10000) / 10000)
            };
          } catch (err) {
            console.warn('Embedding error for image', imgInfo, err);
          }
        }
      }

      btnGen.disabled = false;
      btnGen.textContent = '✓ تم توليد البصمات بنجاح!';
      uploadStatus.textContent = `تم توليد البصمات لـ ${this.editingArtifact.embeddings.length} زاوية تصوير.`;

      // Update preview UI
      previewList.innerHTML = this.editingArtifact.images.map((img, idx) => `
        <div class="view-item-row" data-index="${idx}">
          <span class="view-tag-badge">${img.view}</span>
          <span class="view-label-text">${img.label}</span>
          <span class="view-embedding-status ready">✓ البصمة جاهزة (1280-D)</span>
        </div>
      `).join('');
    });

    // Form Submit Handler
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      this.editingArtifact.id = this.container.querySelector('#form-art-id').value.trim();
      this.editingArtifact.identifier = this.container.querySelector('#form-art-ipksn').value.trim();
      this.editingArtifact.title = this.container.querySelector('#form-art-title').value.trim();
      this.editingArtifact.collection = this.container.querySelector('#form-art-collection').value.trim();
      this.editingArtifact.institution = this.container.querySelector('#form-art-institution').value.trim();
      this.editingArtifact.date = this.container.querySelector('#form-art-date').value.trim();
      this.editingArtifact.description = this.container.querySelector('#form-art-desc').value.trim();
      this.editingArtifact.recognitionThreshold = parseFloat(this.container.querySelector('#form-art-threshold').value);

      delete this.editingArtifact.pendingFiles;

      await this.db.save(this.editingArtifact);
      alert(`تم حفظ القطعة [${this.editingArtifact.id}] بنجاح!`);

      this.artifacts = await this.db.getAll();
      this._renderList();

      if (this.onDatabaseUpdated) {
        this.onDatabaseUpdated();
      }
    });
  }
}
