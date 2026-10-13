// Reusable 3D view for 2-D surface objectives: rotatable canvas plus a legend.
import { el } from '../ui/controls.js';
import { Surface3D } from './surface3d.js';

const goalCache = new WeakMap();
const goalsOf = (values) => {
  if (!goalCache.has(values)) {
    const best = Math.max(...values);
    goalCache.set(values, values.flatMap((v, k) => (v === best ? [k] : [])));
  }
  return goalCache.get(values);
};

export function createSurfaceView(parent, onRotate) {
  const canvas = el('canvas', { class: 'canvas-3d', 'aria-label': '3D surface of the objective; drag to rotate' });
  const foot = el('div', { class: 'legend3d' });
  const wrap = el('div', { class: 'surface-wrap' }, canvas, foot);
  parent.append(wrap);
  const view = new Surface3D(canvas, onRotate);
  let lastMode = null;

  return {
    show(on) {
      wrap.hidden = !on;
    },
    // mode: 'path' (one current state and its path) or 'population' (GA individuals)
    draw({ values, G, current = null, best = null, trail = [], pop = [], mode = 'path' }) {
      view.setData(values, G);
      view.draw({ current, best, trail, pop, goals: goalsOf(values) });
      if (mode !== lastMode) {
        lastMode = mode;
        foot.innerHTML = `
          <span><i class="sw cur"></i>${mode === 'population' ? 'individuals' : 'current state'}</span>
          ${mode === 'population' ? '' : '<span><i class="sw trail"></i>path</span>'}
          <span><i class="sw best"></i>best found</span>
          <span><i class="sw goal"></i>global maximum</span>
          <span class="legend-hint">Drag to rotate · double-click to reset</span>`;
      }
    },
  };
}
