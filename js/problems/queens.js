// N-queens: one queen per column, state[c] = row of the queen in column c (0-based).

export function attackingPairs(rows) {
  let h = 0;
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const d = rows[i] - rows[j];
      if (d === 0 || d === j - i || d === i - j) h++;
    }
  }
  return h;
}

export function attackingPairList(rows) {
  const pairs = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const d = rows[i] - rows[j];
      if (d === 0 || d === j - i || d === i - j) pairs.push([i, j]);
    }
  }
  return pairs;
}

export function queensProblem(n = 8) {
  return {
    kind: 'queens',
    n,
    title: `${n}-queens (minimize attacking pairs)`,
    minimize: true,
    knownGoal: true, // h = 0 is recognisable as a solution
    optimum: 0,
    objective: attackingPairs,
    value: (s) => -attackingPairs(s),
    randomState: (rng) => Array.from({ length: n }, () => rng.int(0, n - 1)),
    neighbors(s) {
      const out = [];
      for (let c = 0; c < n; c++) {
        for (let r = 0; r < n; r++) {
          if (r === s[c]) continue;
          const t = s.slice();
          t[c] = r;
          out.push(t);
        }
      }
      return out;
    },
    randomNeighbor(s, rng) {
      const c = rng.int(0, n - 1);
      let r = rng.int(0, n - 2);
      if (r >= s[c]) r++;
      const t = s.slice();
      t[c] = r;
      return t;
    },
    isGoal: (s) => attackingPairs(s) === 0,
    label: (s) => s.map((r) => r + 1).join(''),
    describeNeighbors(ns, vals) {
      const best = Math.max(...vals);
      const count = vals.filter((v) => v === best).length;
      return `best h=${-best} (${count} of ${ns.length})`;
    },
    describeMove(from, to) {
      const c = from.findIndex((r, i) => r !== to[i]);
      return `col ${c + 1}: row ${from[c] + 1}→${to[c] + 1}`;
    },
  };
}
