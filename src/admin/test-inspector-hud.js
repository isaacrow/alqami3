// Real-Time Developer & Testing Diagnostics HUD for Alqami Artifact Recognition

export class TestInspectorHUD {
  constructor(containerElement, onThresholdChange) {
    this.container = containerElement;
    this.onThresholdChange = onThresholdChange;
    this.isCollapsed = false;
    this._render();
  }

  _render() {
    this.container.innerHTML = `
      <div id="inspector-card" class="inspector-card vision-glass">
        <div class="inspector-header">
          <div class="inspector-title">
            <span class="inspector-dot"></span>
            <span>فاحص التعرف المغلق (Closed-Set Inspector)</span>
          </div>
          <button id="btn-inspector-toggle" class="btn-inspector-icon" title="Toggle Compact">▾</button>
        </div>

        <div id="inspector-body" class="inspector-body">
          <!-- Status Banner -->
          <div id="inspector-status-badge" class="status-badge unknown">
            <span class="status-icon">⚠️</span>
            <span class="status-text">UNKNOWN ARTIFACT</span>
          </div>

          <!-- Detected Info -->
          <div class="inspector-field-row">
            <span class="field-lbl">القطعة:</span>
            <span id="inspector-artifact-id" class="field-val">—</span>
          </div>

          <!-- Similarity vs Threshold Gauge -->
          <div class="inspector-score-section">
            <div class="score-labels">
              <span>نسبة المطابقة: <strong id="inspector-score-val">0.0%</strong></span>
              <span>الحد الأدنى: <strong id="inspector-threshold-val">65%</strong></span>
            </div>
            <div class="meter-bar-track">
              <div id="inspector-score-bar" class="meter-bar-fill" style="width: 0%;"></div>
              <div id="inspector-threshold-line" class="meter-threshold-marker" style="left: 65%;"></div>
            </div>
          </div>

          <!-- Threshold Slider -->
          <div class="threshold-slider-group">
            <div class="slider-label-row">
              <label for="threshold-slider">تعديل عتبة القبول (Threshold):</label>
              <span id="threshold-slider-label">0.65</span>
            </div>
            <input type="range" id="threshold-slider" min="0.50" max="0.98" step="0.01" value="0.65" class="styled-slider" />
          </div>

          <!-- Candidate Rankings -->
          <div class="candidates-ranking-group">
            <div class="ranking-title">أفضل المرشحين (Top Candidates):</div>
            <div id="inspector-candidates-list" class="candidates-list">
              <div class="candidate-item empty">لا توجد قراءات بعد...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Events
    const slider = this.container.querySelector('#threshold-slider');
    const sliderLbl = this.container.querySelector('#threshold-slider-label');
    const thresholdLine = this.container.querySelector('#inspector-threshold-line');
    const thresholdVal = this.container.querySelector('#inspector-threshold-val');

    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      sliderLbl.textContent = val.toFixed(2);
      thresholdVal.textContent = `${Math.round(val * 100)}%`;
      thresholdLine.style.left = `${Math.round(val * 100)}%`;
      if (this.onThresholdChange) {
        this.onThresholdChange(val);
      }
    });

    const btnToggle = this.container.querySelector('#btn-inspector-toggle');
    const body = this.container.querySelector('#inspector-body');
    btnToggle.addEventListener('click', () => {
      this.isCollapsed = !this.isCollapsed;
      body.style.display = this.isCollapsed ? 'none' : 'flex';
      btnToggle.textContent = this.isCollapsed ? '▸' : '▾';
    });
  }

  update(report) {
    if (!report) return;

    const badge = this.container.querySelector('#inspector-status-badge');
    const artIdElem = this.container.querySelector('#inspector-artifact-id');
    const scoreVal = this.container.querySelector('#inspector-score-val');
    const scoreBar = this.container.querySelector('#inspector-score-bar');
    const candidatesList = this.container.querySelector('#inspector-candidates-list');

    const isRecognized = report.recognized;
    const best = report.bestCandidate;

    // Status
    if (isRecognized && best) {
      badge.className = 'status-badge recognized';
      badge.querySelector('.status-icon').textContent = '✓';
      badge.querySelector('.status-text').textContent = 'ARTIFACT CONFIRMED';
      artIdElem.textContent = `${best.id} — ${best.title}`;
    } else {
      badge.className = 'status-badge unknown';
      badge.querySelector('.status-icon').textContent = '⚠️';
      badge.querySelector('.status-text').textContent = 'UNKNOWN ARTIFACT';
      artIdElem.textContent = best ? `رفض: ${best.id} (${report.topScore}% < ${report.threshold}%)` : 'لا يوجد تطابق';
    }

    // Gauge
    scoreVal.textContent = `${report.topScore}%`;
    scoreBar.style.width = `${Math.min(100, Math.max(0, report.topScore))}%`;
    scoreBar.style.backgroundColor = isRecognized ? '#00f2fe' : '#ff9f0a';

    // Candidates
    if (report.candidates && report.candidates.length > 0) {
      candidatesList.innerHTML = report.candidates.map((c, idx) => `
        <div class="candidate-row ${idx === 0 && isRecognized ? 'active-match' : ''}">
          <div class="cand-info">
            <span class="cand-rank">#${idx + 1}</span>
            <span class="cand-title">${c.id} (${c.title})</span>
            <span class="cand-view">[${c.matchedView}]</span>
          </div>
          <div class="cand-score">${c.similarity}%</div>
        </div>
      `).join('');
    }
  }
}
