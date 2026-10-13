// Seeded pseudo-random generator (mulberry32) so every run can be reproduced.
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    // integer in [lo, hi], both ends included
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}

// Independent stream for start states: the n-th re-roll for a given seed.
// Kept apart from the algorithm's stream so a start never depends on algorithm settings.
export function startRng(seed, roll) {
  return makeRng(Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(roll + 1, 0xc2b2ae35));
}
