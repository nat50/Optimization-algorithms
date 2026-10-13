// Traveling salesman on a 100 × 100 map. State = order of cities.

export const TSP_LAYOUTS = [
  { value: 'uniform', label: 'Scattered at random' },
  { value: 'clusters', label: 'Clustered towns' },
  { value: 'circle', label: 'Ring (optimum is the circle)' },
  { value: 'grid', label: 'Jittered grid' },
];

function placeCities(n, rng, layout) {
  const clamp = (v) => Math.min(96, Math.max(4, v));
  const normal = () => Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());
  if (layout === 'circle') {
    const offset = rng.next() * Math.PI * 2;
    return Array.from({ length: n }, (_, i) => {
      const a = offset + (i / n) * Math.PI * 2 + (rng.next() - 0.5) * (2.4 / n);
      const r = 40 + (rng.next() - 0.5) * 4;
      return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) };
    });
  }
  if (layout === 'clusters') {
    const k = Math.max(2, Math.min(6, Math.round(n / 8)));
    const centers = Array.from({ length: k }, () => ({ x: 15 + rng.next() * 70, y: 15 + rng.next() * 70 }));
    return Array.from({ length: n }, (_, i) => {
      const c = centers[i % k];
      return { x: clamp(c.x + normal() * 6), y: clamp(c.y + normal() * 6) };
    });
  }
  if (layout === 'grid') {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    return Array.from({ length: n }, (_, i) => ({
      x: clamp(8 + ((i % cols) + 0.5) * (84 / cols) + (rng.next() - 0.5) * 6),
      y: clamp(8 + (Math.floor(i / cols) + 0.5) * (84 / rows) + (rng.next() - 0.5) * 6),
    }));
  }
  return Array.from({ length: n }, () => ({ x: 5 + rng.next() * 90, y: 5 + rng.next() * 90 }));
}

export function tspProblem(nCities, rng, layout = 'uniform') {
  const cities = placeCities(nCities, rng, layout);
  const dist = cities.map((a) => cities.map((b) => Math.hypot(a.x - b.x, a.y - b.y)));
  const length = (tour) => {
    let d = 0;
    for (let i = 0; i < tour.length; i++) d += dist[tour[i]][tour[(i + 1) % tour.length]];
    return d;
  };
  return {
    kind: 'tsp',
    title: `Traveling salesman, ${nCities} cities`,
    cities,
    minimize: true,
    knownGoal: false,
    objective: length,
    value: (t) => -length(t),
    randomState: (r) => r.shuffle(cities.map((_, i) => i)),
    // 2-opt move: reverse the segment between two random positions
    randomNeighbor(t, r) {
      const n = t.length;
      let i = r.int(0, n - 1);
      let j = r.int(0, n - 2);
      if (j >= i) j++;
      if (i > j) [i, j] = [j, i];
      const next = t.slice();
      while (i < j) {
        [next[i], next[j]] = [next[j], next[i]];
        i++;
        j--;
      }
      return next;
    },
    isGoal: () => false,
    label: (t) => t.join('-'),
  };
}
