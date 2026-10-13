// One-dimensional landscapes: state = integer x, neighbors = x - 1 and x + 1.
// Values are rescaled to integers in [5, 100]; integers keep ties, so plateaus are real plateaus.
import { makeRng } from '../rng.js';

const gauss = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
const range = (n) => Array.from({ length: n }, (_, i) => i);

function rescale(raw, lo = 5, hi = 100) {
  const min = Math.min(...raw);
  const max = Math.max(...raw);
  return raw.map((v) => Math.round(lo + ((v - min) / (max - min || 1)) * (hi - lo)));
}

export const LANDSCAPES = {
  single: {
    title: 'Single smooth peak',
    note: 'One peak: every uphill path leads to the global maximum.',
    make: () => rescale(range(41).map((x) => gauss(x, 27, 12))),
    start: 4,
  },
  twopeaks: {
    title: 'Two peaks',
    note: 'A lower peak on the left traps greedy search started there.',
    make: () => rescale(range(61).map((x) => 0.62 * gauss(x, 14, 7) + gauss(x, 45, 8) + 0.04 * Math.sin(x / 3))),
    start: 6,
  },
  hills: {
    title: 'Rolling hills',
    note: 'Several peaks of different heights.',
    make: () =>
      rescale(range(101).map((x) => 0.25 * Math.sin(x / 7) + 0.18 * Math.sin(x / 3.1 + 1) + 0.12 * Math.sin(x / 13 + 2) + 0.35 * gauss(x, 72, 13))),
    start: 10,
  },
  rugged: {
    title: 'Rugged (many local maxima)',
    note: 'A big hill covered in small bumps: a local maximum every few steps.',
    make: () => rescale(range(101).map((x) => gauss(x, 62, 26) + 0.2 * Math.cos(x * 0.95) + 0.06 * Math.cos(x * 2.3))),
    start: 8,
  },
  terraced: {
    title: 'Terraces and plateaus',
    note: 'Flat steps: shoulders that sideways moves can cross, and flat tops they cannot.',
    make: () => {
      const smooth = rescale(range(81).map((x) => 0.7 * gauss(x, 20, 10) + gauss(x, 58, 14)));
      return smooth.map((v) => Math.max(5, Math.round(v / 12) * 12));
    },
    start: 3,
  },
  random: {
    title: 'Random terrain (from the seed)',
    note: 'A new terrain for every seed.',
    make: (seed) => {
      const r = makeRng(seed * 7 + 13);
      const bumps = Array.from({ length: 7 }, () => ({ c: r.next() * 100, w: 4 + r.next() * 14, h: 0.3 + r.next() }));
      return rescale(range(101).map((x) => bumps.reduce((s, b) => s + b.h * gauss(x, b.c, b.w), 0) + 0.012 * Math.sin(x * 1.7 + seed)));
    },
    start: 5,
  },
};

export const LANDSCAPE_OPTIONS = Object.entries(LANDSCAPES).map(([value, l]) => ({ value, label: l.title }));

// Peaks (including flat tops): runs of equal values whose neighbors on both sides are lower.
export function findPeaks(values) {
  const peaks = [];
  const best = Math.max(...values);
  for (let a = 0; a < values.length; ) {
    let b = a;
    while (b + 1 < values.length && values[b + 1] === values[a]) b++;
    const leftLower = a === 0 || values[a - 1] < values[a];
    const rightLower = b === values.length - 1 || values[b + 1] < values[a];
    if (leftLower && rightLower) peaks.push({ x: Math.floor((a + b) / 2), from: a, to: b, global: values[a] === best });
    a = b + 1;
  }
  return peaks;
}

export function landscapeProblem(key, seed = 1) {
  const { title, make } = LANDSCAPES[key];
  const values = make(seed);
  const n = values.length;
  const optimum = Math.max(...values);
  const neighbors = (x) => [x - 1, x + 1].filter((y) => y >= 0 && y < n);
  return {
    kind: 'landscape',
    key,
    title,
    values,
    peaks: findPeaks(values),
    minimize: false,
    knownGoal: false, // the algorithm cannot tell a local peak from the global one
    optimum,
    objective: (x) => values[x],
    value: (x) => values[x],
    randomState: (rng) => rng.int(0, n - 1),
    neighbors,
    randomNeighbor: (x, rng) => rng.pick(neighbors(x)),
    isGoal: (x) => values[x] === optimum,
    label: (x) => `x = ${x}`,
    describeNeighbors: (ns, vals) => ns.map((y, i) => `f(${y})=${vals[i]}`).join(', '),
    describeMove: (from, to) => `→ ${to}`,
  };
}
