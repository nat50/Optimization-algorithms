// Small canvas-2D 3D renderer for a height grid: shaded quads drawn back to front (painter's algorithm),
// solid side walls, and markers on top. Drag to rotate, double-click to reset the view.
import { setupCanvas, cssVar } from './lineChart.js';

const HEIGHT = 0.7; // world height of f = 100 (the grid spans −1 … 1)
const DIST = 4; // camera distance, for a mild perspective
const DEFAULT_VIEW = { yaw: -0.75, pitch: 0.95 };

// height colour ramp: cool lowlands → green → warm peaks
const RAMP = [
  [0, [165, 180, 252]],
  [0.3, [94, 234, 212]],
  [0.55, [134, 239, 172]],
  [0.78, [252, 211, 77]],
  [1, [251, 146, 60]],
];
function rampColor(t) {
  for (let i = 1; i < RAMP.length; i++) {
    if (t <= RAMP[i][0]) {
      const [t0, c0] = RAMP[i - 1];
      const [t1, c1] = RAMP[i];
      const u = (t - t0) / (t1 - t0);
      return c0.map((c, j) => c + (c1[j] - c) * u);
    }
  }
  return RAMP[RAMP.length - 1][1];
}
const shadeRgb = (rgb, s) => `rgb(${rgb.map((c) => Math.round(Math.min(255, c * s))).join(',')})`;

export class Surface3D {
  constructor(canvas, onChange) {
    this.canvas = canvas;
    this.onChange = onChange;
    Object.assign(this, DEFAULT_VIEW);
    this.order = null;
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('dragging');
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      this.rotate((e.clientX - drag.x) * 0.008, (e.clientY - drag.y) * 0.006);
      drag = { x: e.clientX, y: e.clientY };
    });
    const end = () => {
      drag = null;
      canvas.classList.remove('dragging');
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('dblclick', () => this.resetView());
  }

  rotate(dYaw, dPitch = 0) {
    this.yaw += dYaw;
    this.pitch = Math.min(1.45, Math.max(0.2, this.pitch + dPitch));
    this.order = null;
    this.onChange?.();
  }

  resetView() {
    Object.assign(this, DEFAULT_VIEW);
    this.order = null;
    this.onChange?.();
  }

  setData(values, G) {
    if (this.values === values) return;
    this.values = values;
    this.G = G;
    const n = G * G;
    this.wx = new Float32Array(n);
    this.wy = new Float32Array(n);
    this.wz = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      this.wx[k] = ((k % G) / (G - 1)) * 2 - 1;
      this.wy[k] = (Math.floor(k / G) / (G - 1)) * 2 - 1;
      this.wz[k] = (values[k] / 100) * HEIGHT;
    }
    // faces: grid quads plus vertical walls along the four edges
    const L = [-0.45, -0.55, 0.7];
    const ln = Math.hypot(...L);
    const faces = [];
    const step = 2 / (G - 1);
    for (let j = 0; j < G - 1; j++) {
      for (let i = 0; i < G - 1; i++) {
        const a = j * G + i;
        const v = [a, a + 1, a + G + 1, a + G];
        const z = v.map((q) => this.wz[q]);
        const dzx = (z[1] + z[2] - z[0] - z[3]) / (2 * step);
        const dzy = (z[3] + z[2] - z[0] - z[1]) / (2 * step);
        const nl = Math.hypot(dzx, dzy, 1);
        const lambert = Math.max(0, (-dzx * L[0] - dzy * L[1] + L[2]) / (nl * ln));
        const t = (values[a] + values[a + 1] + values[a + G] + values[a + G + 1]) / 400;
        const color = shadeRgb(rampColor(t), 0.62 + 0.45 * lambert);
        faces.push({ v, color, wall: false, gx: i % 6 === 0, gy: j % 6 === 0 });
      }
    }
    const wall = (a, b, s) => faces.push({ v: [a, b], color: shadeRgb([148, 163, 184], s), wall: true });
    for (let i = 0; i < G - 1; i++) {
      wall(i, i + 1, 0.95);
      wall((G - 1) * G + i, (G - 1) * G + i + 1, 0.8);
      wall(i * G, (i + 1) * G, 0.88);
      wall(i * G + G - 1, (i + 1) * G + G - 1, 0.72);
    }
    this.faces = faces;
    this.order = null;
  }

  // unscaled projection: [right, down, depth]
  static unit(yaw, pitch) {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    return (x, y, z) => {
      const xr = x * cy - y * sy;
      const yr = x * sy + y * cy;
      const zc = z - HEIGHT * 0.4;
      const depth = yr * cp - zc * sp;
      const f = DIST / (DIST + depth);
      return [xr * f, -(yr * sp + zc * cp) * f, depth];
    };
  }

  // Fit the box to the canvas for every yaw at this pitch, so turning never resizes the scene.
  fit(w, h) {
    const key = `${this.pitch.toFixed(4)}|${w}|${h}`;
    if (this.fitKey === key) return this.fitVal;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let a = 0; a < 32; a++) {
      const U = Surface3D.unit((a / 32) * Math.PI * 2, this.pitch);
      for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        for (const z of [0, HEIGHT * 1.25]) {
          const [px, py] = U(x, y, z);
          x0 = Math.min(x0, px); x1 = Math.max(x1, px);
          y0 = Math.min(y0, py); y1 = Math.max(y1, py);
        }
      }
    }
    const pad = 14;
    const scale = Math.min((w - 2 * pad) / (x1 - x0), (h - 2 * pad) / (y1 - y0));
    this.fitKey = key;
    this.fitVal = { scale, ox: w / 2 - ((x0 + x1) / 2) * scale, oy: h / 2 - ((y0 + y1) / 2) * scale };
    return this.fitVal;
  }

  // world → screen; returns [sx, sy, depth]
  projector(w, h) {
    const U = Surface3D.unit(this.yaw, this.pitch);
    const { scale, ox, oy } = this.fit(w, h);
    return (x, y, z) => {
      const [px, py, d] = U(x, y, z);
      return [ox + px * scale, oy + py * scale, d];
    };
  }

  draw({ current = null, best = null, trail = [], pop = [], goals = [] } = {}) {
    if (!this.values) return;
    const c = setupCanvas(this.canvas);
    if (!c) return;
    const { ctx, w, h } = c;
    const P = this.projector(w, h);
    const n = this.G * this.G;
    const sx = new Float32Array(n);
    const sy = new Float32Array(n);
    const sd = new Float32Array(n);
    const bx = new Float32Array(n);
    const by = new Float32Array(n);
    const bd = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      [sx[k], sy[k], sd[k]] = P(this.wx[k], this.wy[k], this.wz[k]);
      [bx[k], by[k], bd[k]] = P(this.wx[k], this.wy[k], 0);
    }

    // back-to-front order only changes with the camera
    if (!this.order) {
      const depth = this.faces.map((f) =>
        f.wall ? (sd[f.v[0]] + sd[f.v[1]] + bd[f.v[0]] + bd[f.v[1]]) / 4 + 0.001 : (sd[f.v[0]] + sd[f.v[1]] + sd[f.v[2]] + sd[f.v[3]]) / 4,
      );
      this.order = this.faces.map((_, i) => i).sort((a, b) => depth[b] - depth[a]);
    }

    ctx.lineWidth = 0.6;
    for (const i of this.order) {
      const f = this.faces[i];
      ctx.beginPath();
      if (f.wall) {
        const [a, b] = f.v;
        ctx.moveTo(sx[a], sy[a]);
        ctx.lineTo(sx[b], sy[b]);
        ctx.lineTo(bx[b], by[b]);
        ctx.lineTo(bx[a], by[a]);
      } else {
        const [a, b, cc, d] = f.v;
        ctx.moveTo(sx[a], sy[a]);
        ctx.lineTo(sx[b], sy[b]);
        ctx.lineTo(sx[cc], sy[cc]);
        ctx.lineTo(sx[d], sy[d]);
      }
      ctx.closePath();
      ctx.fillStyle = f.color;
      ctx.strokeStyle = f.color;
      ctx.fill();
      ctx.stroke();
      // faint grid every 6 cells helps the eye read the shape
      if (f.gx || f.gy) {
        const [a, b, , d] = f.v;
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.10)';
        ctx.beginPath();
        if (f.gx) {
          ctx.moveTo(sx[a], sy[a]);
          ctx.lineTo(sx[d], sy[d]);
        }
        if (f.gy) {
          ctx.moveTo(sx[a], sy[a]);
          ctx.lineTo(sx[b], sy[b]);
        }
        ctx.stroke();
      }
    }

    const lift = (k, dz) => P(this.wx[k], this.wy[k], this.wz[k] + dz);
    const pin = (k, color, r, ring = false) => {
      const [x0, y0] = lift(k, 0.005);
      const [x1, y1] = lift(k, 0.16);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x1, y1, r, 0, Math.PI * 2);
      if (ring) {
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    // global maximum: small green flag
    const good = cssVar('--good');
    for (const k of goals) {
      const [x0, y0] = lift(k, 0);
      const [x1, y1] = lift(k, 0.1);
      ctx.strokeStyle = good;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.fillStyle = good;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + 10, y1 + 3.5);
      ctx.lineTo(x1, y1 + 7);
      ctx.closePath();
      ctx.fill();
    }

    const accent = cssVar('--accent');
    if (trail.length > 1) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.2;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      trail.forEach((k, i) => {
        const [x, y] = lift(k, 0.012);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (pop.length) {
      ctx.fillStyle = accent;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      for (const k of pop) {
        if (k < 0) continue;
        const [x, y] = lift(k, 0.015);
        ctx.beginPath();
        ctx.arc(x, y, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    if (best != null && best !== current) pin(best, good, 6, true);
    if (current != null) pin(current, accent, 7);
  }
}
