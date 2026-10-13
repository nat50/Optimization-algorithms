// Encodings for the genetic algorithm: a chromosome is an array of genes in [0, alphabet).
import { attackingPairs } from './queens.js';
import { landscapeProblem } from './landscape.js';

export const toInt = (genes) => genes.reduce((a, b) => a * 2 + b, 0);
const bitText = (v) => String(v);

// 0/1 knapsack: gene i = take item i. Overweight solutions are penalised in proportion to the excess.
export function knapsackProblem(nItems, rng) {
  const items = Array.from({ length: nItems }, () => ({ w: rng.int(3, 30), v: rng.int(5, 60) }));
  const totalW = items.reduce((s, it) => s + it.w, 0);
  const capacity = Math.round(totalW * 0.4);
  const ratio = Math.max(...items.map((it) => it.v / it.w));

  // exact optimum by dynamic programming, so the GA knows when it has found it
  const dp = new Array(capacity + 1).fill(0);
  for (const it of items) for (let c = capacity; c >= it.w; c--) dp[c] = Math.max(dp[c], dp[c - it.w] + it.v);
  const optimum = dp[capacity];

  const totals = (g) => {
    let w = 0;
    let v = 0;
    g.forEach((take, i) => {
      if (take) {
        w += items[i].w;
        v += items[i].v;
      }
    });
    return { w, v };
  };
  const fitness = (g) => {
    const { w, v } = totals(g);
    return w <= capacity ? v : Math.max(0, Math.round(v - ratio * 1.5 * (w - capacity)));
  };
  return {
    kind: 'knapsack',
    title: `Knapsack: ${nItems} items, capacity ${capacity}`,
    items,
    capacity,
    totals,
    length: nItems,
    alphabet: 2,
    fitness,
    maxFitness: optimum,
    isGoal: (g) => {
      const { w, v } = totals(g);
      return w <= capacity && v === optimum;
    },
    decode: (g) => {
      const { w, v } = totals(g);
      return `value ${v}, weight ${w}/${capacity}${w > capacity ? ' (over)' : ''}`;
    },
    geneText: bitText,
  };
}

// A classic multimodal function, x encoded with n bits over [−1, 2].
export function functionProblem(bits) {
  const lo = -1;
  const hi = 2;
  const maxCode = 2 ** bits - 1;
  const f = (x) => x * Math.sin(10 * Math.PI * x) + 2;
  const xOf = (g) => lo + (toInt(g) / maxCode) * (hi - lo);
  let best = -Infinity;
  for (let k = 0; k <= maxCode; k++) best = Math.max(best, f(lo + (k / maxCode) * (hi - lo)));
  return {
    kind: 'function',
    title: `Maximize f(x) = x·sin(10πx) + 2, x ∈ [−1, 2], ${bits} bits`,
    f,
    lo,
    hi,
    xOf,
    length: bits,
    alphabet: 2,
    fitness: (g) => f(xOf(g)),
    maxFitness: best,
    isGoal: (g) => f(xOf(g)) >= best - 1e-3,
    decode: (g) => `x = ${xOf(g).toFixed(4)}`,
    geneText: bitText,
  };
}

// N-queens as a digit string: gene c = row of the queen in column c.
// Fitness = number of non-attacking pairs.
export function queensGeneProblem(n = 8) {
  const pairs = (n * (n - 1)) / 2;
  return {
    kind: 'queens',
    title: `${n}-queens, fitness = non-attacking pairs (max ${pairs})`,
    length: n,
    alphabet: n,
    fitness: (g) => pairs - attackingPairs(g),
    maxFitness: pairs,
    isGoal: (g) => attackingPairs(g) === 0,
    decode: (g) => `h = ${attackingPairs(g)}`,
    geneText: (v) => String(v + 1),
  };
}

// 1-D landscape with x encoded in binary; codes past the last state score 0.
export function landscapeGeneProblem(key, seed) {
  const { values, title } = landscapeProblem(key, seed);
  const bits = Math.ceil(Math.log2(values.length));
  const best = Math.max(...values);
  const f = (g) => {
    const x = toInt(g);
    return x < values.length ? values[x] : 0;
  };
  return {
    kind: 'landscape',
    title: `${title}, x as ${bits} bits`,
    length: bits,
    alphabet: 2,
    fitness: f,
    maxFitness: best,
    isGoal: (g) => f(g) === best,
    decode: (g) => `x = ${toInt(g)}`,
    geneText: bitText,
  };
}

// Local-search view of a binary GA problem: neighbors flip one bit (used by the Compare tab).
export function bitLocalProblem(gp) {
  return {
    kind: gp.kind,
    title: gp.title,
    minimize: false,
    knownGoal: true,
    optimum: gp.maxFitness,
    objective: gp.fitness,
    value: gp.fitness,
    randomState: (rng) => Array.from({ length: gp.length }, () => rng.int(0, 1)),
    neighbors: (s) => s.map((_, i) => s.map((b, j) => (i === j ? 1 - b : b))),
    randomNeighbor: (s, rng) => {
      const i = rng.int(0, s.length - 1);
      return s.map((b, j) => (i === j ? 1 - b : b));
    },
    isGoal: gp.isGoal,
    label: gp.decode,
    describeNeighbors: (ns, vals) => `best ${Math.max(...vals)} of ${ns.length}`,
    describeMove: (from, to) => `flip bit ${from.findIndex((b, i) => b !== to[i]) + 1}`,
  };
}
