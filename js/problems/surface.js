// Two-dimensional landscapes on a G × G grid. State = cell index k = y·G + x.
// Neighbors are the 8 surrounding cells. Values are rescaled to [0, 100].
import { makeRng } from '../rng.js';
import { toInt } from './bitstring.js';

export const G = 61;

function grid(fn, lo, hi) {
  const raw = new Array(G * G);
  for (let j = 0; j < G; j++) {
    for (let i = 0; i < G; i++) {
      raw[j * G + i] = fn(lo + (i / (G - 1)) * (hi - lo), lo + (j / (G - 1)) * (hi - lo));
    }
  }
  let min = Infinity;
  let max = -Infinity;
  for (const v of raw) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return raw.map((v) => Math.round(((v - min) / (max - min || 1)) * 1000) / 10);
}

const { exp, cos, log, PI } = Math;

export const SURFACES = {
  peaks: {
    title: 'Three peaks and two pits',
    note: 'One tall peak and two lower ones. Where you start decides which peak greedy search climbs.',
    make: () =>
      grid(
        (x, y) => 3 * (1 - x) ** 2 * exp(-x * x - (y + 1) ** 2) - 10 * (x / 5 - x ** 3 - y ** 5) * exp(-x * x - y * y) - exp(-((x + 1) ** 2) - y * y) / 3,
        -3,
        3,
      ),
  },
  eggcrate: {
    title: 'Egg crate (many local maxima)',
    note: 'A bump every few cells on top of a dome. Plain hill climbing almost always stops on a small bump.',
    make: () => grid((x, y) => -(20 + x * x - 10 * cos(2 * PI * x) + y * y - 10 * cos(2 * PI * y)), -5.12, 5.12),
  },
  fourpeaks: {
    title: 'Four near-equal peaks',
    note: 'Four peaks of almost the same height, separated by valleys.',
    make: () => grid((x, y) => -log(1 + (x * x + y - 11) ** 2 + (x + y * y - 7) ** 2), -5, 5),
  },
  ridge: {
    title: 'Curved ridge',
    note: 'A narrow banana-shaped ridge that rises slowly towards one end.',
    make: () => grid((x, y) => -log(1 + (1 - x) ** 2 + 100 * (y - x * x) ** 2), -2, 2),
  },
  random: {
    title: 'Random terrain (from the seed)',
    note: 'A new terrain for every seed.',
    make: (seed) => {
      const r = makeRng(seed * 31 + 7);
      const bumps = Array.from({ length: 9 }, () => ({ x: r.next() * 2 - 1, y: r.next() * 2 - 1, w: 0.12 + r.next() * 0.35, h: 0.3 + r.next() }));
      return grid((x, y) => bumps.reduce((s, b) => s + b.h * exp(-((x - b.x) ** 2 + (y - b.y) ** 2) / (b.w * b.w)), 0), -1, 1);
    },
  },
};

export const SURFACE_OPTIONS = Object.entries(SURFACES).map(([value, s]) => ({ value, label: s.title }));

const cellLabel = (k) => `(${k % G}, ${Math.floor(k / G)})`;

export function surfaceProblem(key, seed = 1) {
  const values = SURFACES[key].make(seed);
  const optimum = Math.max(...values);
  const neighbors = (k) => {
    const x = k % G;
    const y = Math.floor(k / G);
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && x + dx >= 0 && x + dx < G && y + dy >= 0 && y + dy < G) out.push((y + dy) * G + x + dx);
      }
    }
    return out;
  };
  return {
    kind: 'surface',
    key,
    title: SURFACES[key].title,
    values,
    G,
    minimize: false,
    knownGoal: false,
    optimum,
    objective: (k) => values[k],
    value: (k) => values[k],
    randomState: (rng) => rng.int(0, G * G - 1),
    neighbors,
    randomNeighbor: (k, rng) => rng.pick(neighbors(k)),
    isGoal: (k) => values[k] >= optimum - 0.5,
    label: cellLabel,
    describeNeighbors: (ns, vals) => `best f=${Math.max(...vals)} of ${ns.length}`,
    describeMove: (from, to) => `→ ${cellLabel(to)}`,
  };
}

// GA view: 6 bits for x then 6 bits for y; codes outside the grid score 0.
export function surfaceGeneProblem(key, seed = 1) {
  const p = surfaceProblem(key, seed);
  const cellOf = (g) => {
    const x = toInt(g.slice(0, 6));
    const y = toInt(g.slice(6));
    return x < G && y < G ? y * G + x : -1;
  };
  const f = (g) => {
    const k = cellOf(g);
    return k < 0 ? 0 : p.values[k];
  };
  return {
    kind: 'surface',
    title: `${p.title}, (x, y) as 6 + 6 bits`,
    length: 12,
    alphabet: 2,
    fitness: f,
    maxFitness: p.optimum,
    isGoal: (g) => f(g) >= p.optimum - 0.5,
    decode: (g) => {
      const k = cellOf(g);
      return k < 0 ? 'off the grid' : cellLabel(k);
    },
    geneText: (v) => String(v),
    cellOf,
  };
}
