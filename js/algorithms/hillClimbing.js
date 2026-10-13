// Hill climbing as a generator: yields one snapshot per move.
// Variants: steepest ascent, stochastic, first-choice; optional sideways moves and random restarts.

export function* hillClimbing(problem, opts, rng) {
  const {
    variant = 'steepest',
    sideways = false,
    maxSideways = 100,
    restarts = 0,
    start = null,
    maxSteps = 5000,
    firstChoiceTries = 100,
  } = opts;

  let evals = 0;
  let totalMoves = 0;
  let best = null;
  let bestValue = -Infinity;
  const value = (s) => {
    evals++;
    return problem.value(s);
  };
  const snap = (extra) => ({
    evals,
    totalMoves,
    best,
    bestValue,
    solved: best != null && problem.isGoal(best),
    ...extra,
  });

  const pickWeighted = (weights) => {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  };

  // Choose the next state, or { next: null } when the search should stop.
  const decide = (current, fc, side) => {
    const canSide = sideways && side < maxSideways;

    if (variant === 'first-choice') {
      let eq = null;
      for (let t = 1; t <= firstChoiceTries; t++) {
        const n = problem.randomNeighbor(current, rng);
        const v = value(n);
        if (v > fc) return { next: n, value: v, type: 'up', text: `better after ${t} random ${t === 1 ? 'try' : 'tries'}` };
        if (v === fc && eq === null) eq = n;
      }
      const text = `no better in ${firstChoiceTries} tries`;
      if (canSide && eq) return { next: eq, value: fc, type: 'side', text };
      return { next: null, text };
    }

    const ns = problem.neighbors(current);
    const vals = ns.map(value);
    const text = problem.describeNeighbors(ns, vals);

    if (variant === 'stochastic') {
      const up = [];
      const w = [];
      vals.forEach((v, i) => {
        if (v > fc) {
          up.push(i);
          w.push(v - fc); // steeper uphill moves are more likely
        }
      });
      if (up.length) {
        const i = up[pickWeighted(w)];
        return { next: ns[i], value: vals[i], type: 'up', text };
      }
    } else {
      const maxV = Math.max(...vals);
      if (maxV > fc) {
        const ties = vals.flatMap((v, i) => (v === maxV ? [i] : []));
        const i = rng.pick(ties);
        return { next: ns[i], value: vals[i], type: 'up', text };
      }
    }

    if (canSide) {
      const eq = vals.flatMap((v, i) => (v === fc ? [i] : []));
      if (eq.length) {
        const i = rng.pick(eq);
        return { next: ns[i], value: fc, type: 'side', text };
      }
    }
    return { next: null, text };
  };

  for (let run = 0; run <= restarts; run++) {
    let current = run === 0 && start != null ? start : problem.randomState(rng);
    let fc = value(current);
    let step = 0;
    let side = 0;
    if (fc > bestValue) {
      best = current;
      bestValue = fc;
    }
    yield snap({ event: 'start', run, step, current, row: null });

    while (true) {
      if (problem.knownGoal && problem.isGoal(current)) {
        yield snap({ event: 'stop', run, step, current, reason: 'goal', row: { run, step, state: current, neighbors: '—', move: 'Goal reached' } });
        break;
      }
      if (step >= maxSteps) {
        yield snap({ event: 'stop', run, step, current, reason: 'limit', row: { run, step, state: current, neighbors: '—', move: 'Step limit' } });
        break;
      }
      const d = decide(current, fc, side);
      if (!d.next) {
        const reason = side > 0 && sideways ? 'sideways cap' : 'local optimum';
        yield snap({ event: 'stop', run, step, current, reason, row: { run, step, state: current, neighbors: d.text, move: 'Stop' } });
        break;
      }
      const from = current;
      current = d.next;
      fc = d.value;
      step++;
      totalMoves++;
      side = d.type === 'side' ? side + 1 : 0;
      if (fc > bestValue) {
        best = current;
        bestValue = fc;
      }
      const move = (d.type === 'side' ? 'sideways ' : '') + problem.describeMove(from, current);
      yield snap({ event: 'move', run, step, current, moveType: d.type, row: { run, step: step - 1, state: from, neighbors: d.text, move } });
    }

    if (problem.knownGoal && best && problem.isGoal(best)) break;
  }
}
