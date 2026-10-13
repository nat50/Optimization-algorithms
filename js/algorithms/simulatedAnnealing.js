// Simulated annealing as a generator: yields one snapshot per proposed move.

export const SCHEDULES = {
  geometric: { label: 'Geometric: Tₖ = α·Tₖ₋₁', temp: (k, p) => p.T0 * p.alpha ** k },
  linear: { label: 'Linear: Tₖ = T₀ − β·k', temp: (k, p) => Math.max(0, p.T0 - p.beta * k) },
  logarithmic: { label: 'Logarithmic: Tₖ = T₀·ln2 / ln(k+2)', temp: (k, p) => (p.T0 * Math.LN2) / Math.log(k + 2) },
};

export function temperature(schedule, k, params) {
  return SCHEDULES[schedule].temp(k, params);
}

export function* simulatedAnnealing(problem, opts, rng) {
  const { schedule = 'geometric', Tmin = 0.01, movesPerT = 1, maxIter = 20000, start = null } = opts;

  let current = start != null ? start : problem.randomState(rng);
  let fc = problem.value(current);
  let evals = 1;
  let best = current;
  let bestValue = fc;
  let better = 0;
  let worseAccepted = 0;
  let worseRejected = 0;

  let k = 0;
  let T = temperature(schedule, 0, opts);
  let iter = 0;

  while (T > Tmin && iter < maxIter) {
    for (let m = 0; m < movesPerT && iter < maxIter; m++) {
      const next = problem.randomNeighbor(current, rng);
      const fn = problem.value(next);
      evals++;
      const dE = fn - fc;
      let p = 1;
      let accepted = true;
      if (dE > 0) {
        better++;
      } else {
        p = Math.exp(dE / T);
        accepted = rng.next() < p;
        if (accepted) worseAccepted++;
        else worseRejected++;
      }
      if (accepted) {
        current = next;
        fc = fn;
        if (fc > bestValue) {
          best = current;
          bestValue = fc;
        }
      }
      iter++;
      yield { iter, k, T, current, value: fc, best, bestValue, dE, p, accepted, better, worseAccepted, worseRejected, evals };
      if (problem.knownGoal && problem.isGoal(current)) return;
    }
    k++;
    T = temperature(schedule, k, opts);
  }
}
