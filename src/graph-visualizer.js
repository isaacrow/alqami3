export class RDFGraphVisualizer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.nodes = [];
    this.links = [];
    this.width = canvasElement.width;
    this.height = canvasElement.height;
    this.animId = null;
    this.hoveredNode = null;
    this.selectedNode = null;
    this.isDragging = false;
    this.dragNode = null;
    this.onSelectCallback = null;

    this._setupEvents();
  }

  setData(graphData) {
    this.width = this.canvas.clientWidth || 500;
    this.height = this.canvas.clientHeight || 400;
    this.canvas.width = this.width * window.devicePixelRatio;
    this.canvas.height = this.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const totalNodes = graphData.nodes.length;
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const radius = Math.min(this.width, this.height) * 0.38;

    this.nodes = graphData.nodes.map((n, i) => {
      const angle = (i / totalNodes) * Math.PI * 2;
      const dist = n.group === 1 ? 0 : (n.group === 3 ? radius * 0.55 : radius * 0.9);
      return {
        ...n,
        x: centerX + Math.cos(angle) * dist + (Math.random() - 0.5) * 20,
        y: centerY + Math.sin(angle) * dist + (Math.random() - 0.5) * 20,
        vx: 0,
        vy: 0,
        radius: n.group === 1 ? 20 : (n.group === 3 ? 14 : 10)
      };
    });

    const nodeMap = new Map(this.nodes.map(n => [n.id, n]));

    this.links = graphData.links.map(l => ({
      source: nodeMap.get(l.source) || { x: centerX, y: centerY },
      target: nodeMap.get(l.target) || { x: centerX, y: centerY },
      predicate: l.predicate,
      fullPredicate: l.fullPredicate
    }));

    this.startSimulation();
  }

  startSimulation() {
    if (this.animId) cancelAnimationFrame(this.animId);

    let iteration = 0;
    const maxIterations = 200;

    const tick = () => {
      if (iteration < maxIterations || this.isDragging) {
        this._applyForces();
        iteration++;
      }
      this.draw();
      this.animId = requestAnimationFrame(tick);
    };
    tick();
  }

  _applyForces() {
    const k = 0.05;
    const repulsion = 1200;
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const dx = this.nodes[j].x - this.nodes[i].x;
        const dy = this.nodes[j].y - this.nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 250) {
          const f = repulsion / (dist * dist);
          const fx = (dx / dist) * f;
          const fy = (dy / dist) * f;
          if (this.nodes[i] !== this.dragNode) {
            this.nodes[i].x -= fx;
            this.nodes[i].y -= fy;
          }
          if (this.nodes[j] !== this.dragNode) {
            this.nodes[j].x += fx;
            this.nodes[j].y += fy;
          }
        }
      }
    }

    for (const link of this.links) {
      const dx = link.target.x - link.source.x;
      const dy = link.target.y - link.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const targetDist = 90;
      const f = (dist - targetDist) * k;
      const fx = (dx / dist) * f;
      const fy = (dy / dist) * f;

      if (link.source !== this.dragNode) {
        link.source.x += fx;
        link.source.y += fy;
      }
      if (link.target !== this.dragNode) {
        link.target.x -= fx;
        link.target.y -= fy;
      }
    }

    for (const node of this.nodes) {
      if (node !== this.dragNode) {
        node.x += (centerX - node.x) * 0.01;
        node.y += (centerY - node.y) * 0.01;
        node.x = Math.max(30, Math.min(this.width - 30, node.x));
        node.y = Math.max(30, Math.min(this.height - 30, node.y));
      }
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw Links
    for (const link of this.links) {
      this.ctx.beginPath();
      this.ctx.moveTo(link.source.x, link.source.y);
      this.ctx.lineTo(link.target.x, link.target.y);
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
      this.ctx.lineWidth = 1.2;
      this.ctx.stroke();

      const midX = (link.source.x + link.target.x) / 2;
      const midY = (link.source.y + link.target.y) / 2;
      this.ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      this.ctx.fillStyle = '#86868b';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(link.predicate || '', midX, midY - 3);
    }

    // Draw Nodes
    for (const node of this.nodes) {
      const isHovered = this.hoveredNode === node;
      const isSelected = this.selectedNode === node;

      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, node.radius + (isHovered ? 3 : 0), 0, Math.PI * 2);

      if (node.group === 1) {
        // Main Resource (Black)
        this.ctx.fillStyle = '#1d1d1f';
      } else if (node.group === 3) {
        // Linked Entity (Apple Blue)
        this.ctx.fillStyle = '#0071e3';
      } else {
        // Literal Value (Apple Green)
        this.ctx.fillStyle = '#34c759';
      }

      this.ctx.fill();

      // Node border
      this.ctx.strokeStyle = isSelected ? '#0071e3' : (isHovered ? '#1d1d1f' : '#ffffff');
      this.ctx.lineWidth = isSelected ? 3 : 2;
      this.ctx.stroke();

      // Node label
      this.ctx.font = node.group === 1 ? '600 11px -apple-system, BlinkMacSystemFont, sans-serif' : '500 10px -apple-system, BlinkMacSystemFont, sans-serif';
      this.ctx.fillStyle = '#1d1d1f';
      this.ctx.textAlign = 'center';
      const label = node.label || node.id;
      const truncated = label.length > 20 ? label.slice(0, 18) + '…' : label;
      this.ctx.fillText(truncated, node.x, node.y + node.radius + 12);
    }
  }

  _setupEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const findNode = (pos) => {
      return this.nodes.find(n => {
        const dx = n.x - pos.x;
        const dy = n.y - pos.y;
        return Math.sqrt(dx * dx + dy * dy) <= n.radius + 6;
      });
    };

    this.canvas.addEventListener('mousemove', (e) => {
      const pos = getPos(e);
      if (this.isDragging && this.dragNode) {
        this.dragNode.x = pos.x;
        this.dragNode.y = pos.y;
        return;
      }
      const node = findNode(pos);
      if (node !== this.hoveredNode) {
        this.hoveredNode = node;
        this.canvas.style.cursor = node ? 'pointer' : 'default';
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      const pos = getPos(e);
      const node = findNode(pos);
      if (node) {
        this.isDragging = true;
        this.dragNode = node;
        this.selectedNode = node;
        if (this.onSelectCallback) this.onSelectCallback(node);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.dragNode = null;
    });

    this.canvas.addEventListener('touchstart', (e) => {
      const pos = getPos(e);
      const node = findNode(pos);
      if (node) {
        this.isDragging = true;
        this.dragNode = node;
        this.selectedNode = node;
        if (this.onSelectCallback) this.onSelectCallback(node);
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (this.isDragging && this.dragNode) {
        const pos = getPos(e);
        this.dragNode.x = pos.x;
        this.dragNode.y = pos.y;
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', () => {
      this.isDragging = false;
      this.dragNode = null;
    });
  }

  onSelect(callback) {
    this.onSelectCallback = callback;
  }

  resize() {
    this.width = this.canvas.clientWidth || 500;
    this.height = this.canvas.clientHeight || 400;
    this.canvas.width = this.width * window.devicePixelRatio;
    this.canvas.height = this.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  destroy() {
    if (this.animId) cancelAnimationFrame(this.animId);
  }
}
