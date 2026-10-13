// Canvas helpers plus line and bar charts. Colors come from CSS custom properties.

// Colors are read from the canvas being drawn, so each page can define its own accent.
let scope = document.documentElement;

export function cssVar(name) {
  return getComputedStyle(scope).getPropertyValue(name).trim();
}

// 'accent' → var(--accent); literal colors pass through.
export function color(c) {
  return /^(#|rgb|hsl)/.test(c) ? c : cssVar('--' + c);
}

export function setupCanvas(canvas) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return null;
  scope = canvas;
  const dpr = window.devicePixelRatio || 1;
  const W = Math.round(w * dpr);
  const H = Math.round(h * dpr);
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.font = '12px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return { ctx, w, h };
}

export function niceTicks(min, max, count = 5, integer = false) {
  if (!(max > min)) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  let step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  if (integer) step = Math.max(1, step);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step * 1e-9; v += step) ticks.push(+v.toPrecision(12));
  return { lo, hi, ticks };
}

export function fmt(v) {
  if (!isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 10000) return Math.round(v).toLocaleString('en-US');
  if (Number.isInteger(v)) return String(v);
  if (a >= 100) return v.toFixed(0);
  if (a >= 1) return (+v.toFixed(2)).toString();
  if (a === 0) return '0';
  return (+v.toPrecision(2)).toString();
}

function legend(ctx, items, right, y) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let x = right;
  for (const it of [...items].reverse()) {
    const tw = ctx.measureText(it.name).width;
    x -= tw;
    ctx.fillStyle = cssVar('--muted');
    ctx.fillText(it.name, x, y);
    x -= 18;
    ctx.strokeStyle = color(it.color);
    ctx.lineWidth = 3;
    ctx.setLineDash(it.dashed ? [4, 3] : []);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 12, y);
    ctx.stroke();
    ctx.setLineDash([]);
    x -= 14;
  }
}

/**
 * series: [{ name, data: number[], color, dashed?, width? }]
 * Point i of each series is drawn at x = x0 + i.
 */
export function drawLineChart(canvas, opts) {
  const c = setupCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;
  const { series, x0 = 0, xLabel = '', yLabel = '', vlines = [], hlines = [] } = opts;
  const n = Math.max(1, ...series.map((s) => s.data.length));

  let yMin = opts.yMin ?? Infinity;
  let yMax = opts.yMax ?? -Infinity;
  for (const s of series) {
    for (const v of s.data) {
      if (opts.yMin == null && v < yMin) yMin = v;
      if (opts.yMax == null && v > yMax) yMax = v;
    }
  }
  for (const l of hlines) {
    if (opts.yMax == null) yMax = Math.max(yMax, l.y);
    if (opts.yMin == null) yMin = Math.min(yMin, l.y);
  }
  if (!isFinite(yMin)) yMin = 0;
  if (!isFinite(yMax)) yMax = 1;
  const yt = niceTicks(yMin, yMax, 4);
  const xt = niceTicks(x0, x0 + Math.max(1, n - 1), Math.max(2, Math.floor(w / 90)), true);

  const L = 54, R = 26, T = 26, B = 38;
  const pw = w - L - R;
  const ph = h - T - B;
  const X = (x) => L + ((x - xt.lo) / (xt.hi - xt.lo)) * pw;
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
  for (const t of xt.ticks) ctx.fillText(fmt(t), X(t), T + ph + 6);
  if (xLabel) ctx.fillText(xLabel, L + pw / 2, T + ph + 22);
  if (yLabel) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(yLabel, 4, 11);
  }

  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = cssVar('--muted');
  for (const v of vlines) {
    const x = Math.round(X(x0 + v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, T);
    ctx.lineTo(x, T + ph);
    ctx.stroke();
  }
  for (const l of hlines) {
    ctx.strokeStyle = color(l.color ?? 'muted');
    const y = Math.round(Y(l.y)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(L, y);
    ctx.lineTo(L + pw, y);
    ctx.stroke();
    if (l.label) {
      ctx.fillStyle = color(l.color ?? 'muted');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(l.label, L + 4, y - 3);
    }
  }
  ctx.setLineDash([]);

  for (const s of series) {
    const len = s.data.length;
    if (!len) continue;
    ctx.strokeStyle = color(s.color);
    ctx.fillStyle = color(s.color);
    ctx.lineWidth = s.width ?? 2;
    ctx.setLineDash(s.dashed ? [5, 4] : []);
    if (len === 1) {
      ctx.beginPath();
      ctx.arc(X(x0), Y(s.data[0]), 3, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    const stride = Math.max(1, Math.floor(len / (pw * 1.5)));
    ctx.beginPath();
    ctx.moveTo(X(x0), Y(s.data[0]));
    for (let i = stride; i < len; i += stride) ctx.lineTo(X(x0 + i), Y(s.data[i]));
    ctx.lineTo(X(x0 + len - 1), Y(s.data[len - 1]));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  legend(ctx, series.filter((s) => s.name), w - R, 11);
}

/** Vertical bars: labels[], values[], colors[] (token names), optional max and format. */
export function drawBarChart(canvas, { labels, values, colors, max, format = fmt, yLabel = '' }) {
  const c = setupCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;
  const L = 48, R = 10, T = 26, B = 30;
  const pw = w - L - R;
  const ph = h - T - B;
  const yt = niceTicks(0, max ?? Math.max(1e-9, ...values), 4);
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
  if (yLabel) {
    ctx.textAlign = 'left';
    ctx.fillText(yLabel, 4, 11);
  }

  const slot = pw / values.length;
  const bw = Math.min(64, slot * 0.6);
  values.forEach((v, i) => {
    const x = L + slot * i + (slot - bw) / 2;
    const y = Y(v);
    ctx.fillStyle = color(colors[i]);
    ctx.beginPath();
    ctx.roundRect(x, y, bw, T + ph - y, [4, 4, 0, 0]);
    ctx.fill();
    ctx.fillStyle = cssVar('--text');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(format(v), x + bw / 2, y - 4);
    ctx.fillStyle = cssVar('--muted');
    ctx.textBaseline = 'top';
    ctx.fillText(labels[i], L + slot * i + slot / 2, T + ph + 8);
  });
}
