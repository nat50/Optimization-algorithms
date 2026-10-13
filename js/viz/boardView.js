// N-queens board with attacking pairs drawn as red lines.
import { setupCanvas, cssVar } from './lineChart.js';
import { attackingPairList } from '../problems/queens.js';

export function drawBoard(canvas, rows) {
  const c = setupCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;
  const n = rows.length;
  const size = Math.min(w, h) - 8;
  const cell = size / n;
  const ox = (w - size) / 2;
  const oy = (h - size) / 2;
  const center = (col) => [ox + col * cell + cell / 2, oy + rows[col] * cell + cell / 2];

  for (let r = 0; r < n; r++) {
    for (let col = 0; col < n; col++) {
      ctx.fillStyle = (r + col) % 2 ? cssVar('--board-dark') : cssVar('--board-light');
      ctx.fillRect(ox + col * cell, oy + r * cell, cell, cell);
    }
  }

  const pairs = attackingPairList(rows);
  const attacked = new Set(pairs.flat());
  ctx.strokeStyle = cssVar('--bad');
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  for (const [i, j] of pairs) {
    const [x1, y1] = center(i);
    const [x2, y2] = center(j);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let col = 0; col < n; col++) {
    const [x, y] = center(col);
    ctx.fillStyle = attacked.has(col) ? cssVar('--bad') : cssVar('--good');
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.round(cell * 0.42)}px "Segoe UI Symbol", system-ui, sans-serif`;
    ctx.fillText('♛', x, y + 1);
  }
}
