// 1-D objective landscape: area under the curve, peak markers, visited states, current and best.
import { setupCanvas, niceTicks, cssVar, fmt } from './lineChart.js';

export function drawLandscape(canvas, { values, peaks = [], current, best, visited = [], recent = [] }) {
  const c = setupCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;
  const n = values.length;
  const yt = niceTicks(0, 100, 4);
  const L = 40, R = 16, T = 34, B = 30;
  const pw = w - L - R;
  const ph = h - T - B;
  const X = (i) => L + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
  const Y = (v) => T + ph - ((v - yt.lo) / (yt.hi - yt.lo)) * ph;
  const accent = cssVar('--accent');
  const good = cssVar('--good');

  // grid and axes
  ctx.lineWidth = 1;
  ctx.strokeStyle = cssVar('--grid');
  ctx.fillStyle = cssVar('--muted');
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const t of yt.ticks) {
    const y = Math.round(Y(t)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(L, y);
    ctx.lineTo(L + pw, y);
    ctx.stroke();
    ctx.fillText(fmt(t), L - 8, y);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const every = n <= 21 ? 2 : n <= 61 ? 5 : 10;
  for (let i = 0; i < n; i += every) ctx.fillText(String(i), X(i), T + ph + 8);

  // area under the curve
  const grad = ctx.createLinearGradient(0, T, 0, T + ph);
  grad.addColorStop(0, cssVar('--accent-soft'));
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.moveTo(X(0), T + ph);
  values.forEach((v, i) => ctx.lineTo(X(i), Y(v)));
  ctx.lineTo(X(n - 1), T + ph);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = cssVar('--neutral-strong');
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.stroke();

  // peak markers: small triangles; the global maximum is green and labelled
  for (const p of peaks) {
    const x = X(p.x);
    const y = Y(values[p.x]) - 8;
    ctx.fillStyle = p.global ? good : cssVar('--neutral-strong');
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4.5, y - 7);
    ctx.lineTo(x + 4.5, y - 7);
    ctx.closePath();
    ctx.fill();
    if (p.global && current !== p.x) {
      ctx.font = '600 11.5px "Segoe UI", system-ui, sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.fillText('global max', x, y - 9);
      ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    }
  }

  // visited states
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.25;
  for (const i of new Set(visited)) {
    ctx.beginPath();
    ctx.arc(X(i), Y(values[i]), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // recent path, fading in
  recent.forEach((i, k) => {
    ctx.globalAlpha = 0.2 + (0.6 * (k + 1)) / recent.length;
    ctx.beginPath();
    ctx.arc(X(i), Y(values[i]), 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  if (best != null && best !== current) {
    ctx.strokeStyle = good;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(X(best), Y(values[best]), 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (current != null) {
    const x = X(current);
    const y = Y(values[current]);
    ctx.fillStyle = accent;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const text = `x = ${current}, f = ${values[current]}`;
    ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
    const tw = ctx.measureText(text).width + 14;
    const bx = Math.min(Math.max(x - tw / 2, L), L + pw - tw);
    const by = Math.max(2, y - 42);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(bx, by, tw, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + tw / 2, by + 11);
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  }
}
