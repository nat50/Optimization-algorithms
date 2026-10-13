// TSP tour on a 100 × 100 map.
import { setupCanvas, cssVar, color } from './lineChart.js';

export function drawTour(canvas, cities, tour, { stroke = 'accent', caption = '' } = {}) {
  const c = setupCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;
  const pad = 12;
  const top = caption ? 22 : 0;
  const s = Math.min(w - 2 * pad, h - 2 * pad - top);
  const ox = (w - s) / 2;
  const oy = top + (h - top - s) / 2;
  const P = (city) => [ox + (city.x / 100) * s, oy + (city.y / 100) * s];

  ctx.strokeStyle = cssVar('--grid');
  ctx.lineWidth = 1;
  ctx.strokeRect(ox + 0.5, oy + 0.5, s, s);

  if (tour?.length) {
    ctx.strokeStyle = color(stroke);
    ctx.lineWidth = 2;
    ctx.beginPath();
    tour.forEach((idx, i) => {
      const [x, y] = P(cities[idx]);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  }

  ctx.fillStyle = cssVar('--text');
  for (const city of cities) {
    const [x, y] = P(city);
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (caption) {
    ctx.fillStyle = cssVar('--muted');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(caption, ox, 2);
  }
}
