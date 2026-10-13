// Problem-specific views of a GA population: the function curve, and the knapsack contents.
import { setupCanvas, niceTicks, cssVar, fmt } from './lineChart.js';
import { escapeHtml } from '../ui/controls.js';

// Function curve with every individual drawn as a dot at (x, f(x)).
export function drawFunctionPopulation(canvas, { problem, pop, best }) {
  const c = setupCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;
  const { f, lo, hi, xOf } = problem;
  const samples = Array.from({ length: 600 }, (_, i) => lo + (i / 599) * (hi - lo));
  const ys = samples.map(f);
  const yt = niceTicks(Math.min(...ys), Math.max(...ys), 4);
  const xt = niceTicks(lo, hi, 6);
  const L = 44, R = 16, T = 16, B = 30;
  const pw = w - L - R;
  const ph = h - T - B;
  const X = (x) => L + ((x - lo) / (hi - lo)) * pw;
  const Y = (v) => T + ph - ((v - yt.lo) / (yt.hi - yt.lo)) * ph;

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
  for (const t of xt.ticks) if (t >= lo && t <= hi) ctx.fillText(fmt(t), X(t), T + ph + 8);

  ctx.strokeStyle = cssVar('--neutral-strong');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  samples.forEach((x, i) => (i ? ctx.lineTo(X(x), Y(ys[i])) : ctx.moveTo(X(x), Y(ys[i]))));
  ctx.stroke();

  ctx.fillStyle = cssVar('--accent');
  ctx.globalAlpha = 0.55;
  for (const g of pop) {
    const x = xOf(g);
    ctx.beginPath();
    ctx.arc(X(x), Y(f(x)), 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (best) {
    const x = xOf(best);
    ctx.strokeStyle = cssVar('--good');
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(X(x), Y(f(x)), 9, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Items as chips (taken ones filled) plus a capacity bar.
export function renderKnapsack(container, { problem, genes }) {
  const { w, v } = problem.totals(genes);
  const over = w > problem.capacity;
  const pct = Math.min(100, (w / problem.capacity) * 100);
  const chips = problem.items
    .map((it, i) => `<span class="item${genes[i] ? ' taken' : ''}" title="item ${i + 1}"><b>${it.v}</b><small>w ${it.w}</small></span>`)
    .join('');
  container.innerHTML = `
    <div class="cap">
      <div class="cap-head"><span>Weight ${w} / ${problem.capacity}</span><span>Value <strong>${v}</strong> (optimum ${problem.maxFitness})</span></div>
      <div class="cap-bar${over ? ' over' : ''}"><span style="width:${pct.toFixed(1)}%"></span></div>
    </div>
    <div class="items">${chips}</div>
    <p class="muted small">${escapeHtml(over ? 'Over capacity: this solution is penalised.' : 'Filled chips are the items in the knapsack. Big number = value, w = weight.')}</p>`;
}
