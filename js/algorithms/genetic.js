// Genetic algorithm as a generator: yields one snapshot per generation.

// Probability that each individual is picked as a parent in one draw.
export function selectionProbs(fits, method, k = 3) {
  const N = fits.length;
  if (method === 'roulette') {
    const total = fits.reduce((a, b) => a + b, 0);
    return total > 0 ? fits.map((f) => f / total) : fits.map(() => 1 / N);
  }
  // Rank-based methods: sort from worst (position 0) to best (position N - 1).
  const order = fits.map((_, i) => i).sort((a, b) => fits[a] - fits[b]);
  const byPos =
    method === 'rank'
      ? order.map((_, r) => (r + 1) / ((N * (N + 1)) / 2))
      : // tournament of size k with replacement: P(best of k draws is position r)
        order.map((_, r) => ((r + 1) / N) ** k - (r / N) ** k);
  // Individuals with equal fitness share their probability equally.
  const probs = new Array(N);
  for (let a = 0; a < N; ) {
    let b = a;
    while (b + 1 < N && fits[order[b + 1]] === fits[order[a]]) b++;
    let sum = 0;
    for (let r = a; r <= b; r++) sum += byPos[r];
    for (let r = a; r <= b; r++) probs[order[r]] = sum / (b - a + 1);
    a = b + 1;
  }
  return probs;
}

function sample(probs, rng) {
  let r = rng.next();
  for (let i = 0; i < probs.length; i++) {
    r -= probs[i];
    if (r < 0) return i;
  }
  return probs.length - 1;
}

export function* geneticAlgorithm(problem, opts, rng) {
  const {
    N = 20,
    crossoverRate = 0.8,
    mutationRate = 0.1,
    selection = 'roulette',
    k = 3,
    elitism = 0,
    maxGenerations = 100,
    stopOnGoal = true,
    initial = null,
  } = opts;
  const L = problem.length;
  const A = problem.alphabet;

  let pop = initial
    ? initial.map((g) => g.slice())
    : Array.from({ length: N }, () => Array.from({ length: L }, () => rng.int(0, A - 1)));
  const size = pop.length;

  let evals = 0;
  const evaluate = (g) => {
    evals++;
    return problem.fitness(g);
  };
  let fits = pop.map(evaluate);
  let best = null;
  let bestFit = -Infinity;
  let bestGen = 0;
  let gen = 0;
  const updateBest = () => {
    fits.forEach((f, i) => {
      if (f > bestFit) {
        bestFit = f;
        best = pop[i].slice();
        bestGen = gen;
      }
    });
  };
  updateBest();

  const mutate = (genes) => {
    const flipped = [];
    for (let i = 0; i < L; i++) {
      if (rng.next() < mutationRate) {
        if (A === 2) genes[i] = 1 - genes[i];
        else {
          let v = rng.int(0, A - 2);
          if (v >= genes[i]) v++;
          genes[i] = v;
        }
        flipped.push(i);
      }
    }
    return flipped;
  };

  const snap = (extra) => {
    const avg = fits.reduce((a, b) => a + b, 0) / size;
    return {
      gen,
      pop,
      fits,
      probs: selectionProbs(fits, selection, k),
      best,
      bestFit,
      bestGen,
      avg,
      genBest: Math.max(...fits),
      evals,
      solved: problem.isGoal(best),
      ...extra,
    };
  };

  yield snap({ crossover: null, mutation: null, crossovers: 0, mutations: 0 });

  while (gen < maxGenerations && !(stopOnGoal && problem.isGoal(best))) {
    const probs = selectionProbs(fits, selection, k);
    const ranked = fits.map((_, i) => i).sort((a, b) => fits[b] - fits[a]);
    const next = [];
    for (let i = 0; i < Math.min(elitism, size); i++) next.push(pop[ranked[i]].slice());

    let crossover = null;
    let mutation = null;
    let crossovers = 0;
    let mutations = 0;
    while (next.length < size) {
      const i1 = sample(probs, rng);
      const i2 = sample(probs, rng);
      const p1 = pop[i1];
      const p2 = pop[i2];
      let c1;
      let c2;
      if (L > 1 && rng.next() < crossoverRate) {
        const cut = rng.int(1, L - 1);
        c1 = p1.slice(0, cut).concat(p2.slice(cut));
        c2 = p2.slice(0, cut).concat(p1.slice(cut));
        crossovers++;
        if (!crossover) crossover = { p1: p1.slice(), p2: p2.slice(), cut, c1: c1.slice(), c2: c2.slice() };
      } else {
        c1 = p1.slice();
        c2 = p2.slice();
      }
      for (const child of next.length + 1 < size ? [c1, c2] : [c1]) {
        const before = child.slice();
        const flipped = mutate(child);
        if (flipped.length) {
          mutations += flipped.length;
          if (!mutation) mutation = { before, after: child.slice(), flipped };
        }
        next.push(child);
      }
    }

    pop = next;
    fits = pop.map(evaluate);
    gen++;
    updateBest();
    yield snap({ crossover, mutation, crossovers, mutations });
  }
}
