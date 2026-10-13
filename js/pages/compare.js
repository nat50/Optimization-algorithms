import { el, group, slider, select, checkbox, seedControl, card, escapeHtml, tick } from '../ui/controls.js';
import { makeRng } from '../rng.js';
import { landscapeProblem, LANDSCAPES } from '../problems/landscape.js';
import { queensProblem, attackingPairs } from '../problems/queens.js';
import { queensGeneProblem, landscapeGeneProblem, knapsackProblem, bitLocalProblem } from '../problems/bitstring.js';
import { surfaceProblem, surfaceGeneProblem, SURFACES } from '../problems/surface.js';
import { hillClimbing } from '../algorithms/hillClimbing.js';
import { simulatedAnnealing } from '../algorithms/simulatedAnnealing.js';
import { geneticAlgorithm } from '../algorithms/genetic.js';
import { drawBarChart, fmt } from '../viz/lineChart.js';

const PROBLEMS = [
  { value: 'queens', label: 'N-queens' },
  { value: 'knapsack', label: 'Knapsack, 25 items' },
  { value: 'surface:eggcrate', label: `Surface: ${SURFACES.eggcrate.title}` },
  { value: 'surface:peaks', label: `Surface: ${SURFACES.peaks.title}` },
  { value: 'rugged', label: `Line: ${LANDSCAPES.rugged.title}` },
  { value: 'hills', label: `Line: ${LANDSCAPES.hills.title}` },
  { value: 'terraced', label: `Line: ${LANDSCAPES.terraced.title}` },
];
const LANDSCAPE_DEFAULTS = { restarts: 3, sideways: true, T0: 40, alpha: 0.99, movesPerT: 40, N: 20, gens: 50, mut: 0.143 };
const SURFACE_DEFAULTS = { restarts: 5, sideways: false, T0: 30, alpha: 0.98, movesPerT: 30, N: 40, gens: 80, mut: 0.083 };
const DEFAULTS = {
  queens: { restarts: 10, sideways: true, T0: 5, alpha: 0.98, movesPerT: 50, N: 100, gens: 300, mut: 0.125 },
  knapsack: { restarts: 20, sideways: false, T0: 30, alpha: 0.97, movesPerT: 30, N: 60, gens: 200, mut: 0.04 },
  'surface:eggcrate': SURFACE_DEFAULTS,
  'surface:peaks': SURFACE_DEFAULTS,
  rugged: LANDSCAPE_DEFAULTS,
  hills: LANDSCAPE_DEFAULTS,
  terraced: LANDSCAPE_DEFAULTS,
};
const ALGOS = ['Hill climbing', 'Simulated annealing', 'Genetic algorithm'];
const COLORS = ['algo-hc', 'algo-sa', 'algo-ga'];

export function mountCompare(root) {
  const s = { problem: 'queens', n: 8, trials: 50, seed: 11, ...DEFAULTS.queens };
  const side = el('aside', { class: 'controls' });
  const main = el('div', { class: 'viz' });
  root.append(side, main);

  const gP = group(side, 'Experiment');
  select(gP, {
    label: 'Problem',
    options: PROBLEMS,
    value: s.problem,
    onChange: (v) => {
      s.problem = v;
      Object.assign(s, DEFAULTS[v]);
      for (const [key, ctl] of Object.entries(ctls)) ctl.set(s[key]);
      nSl.show(v === 'queens');
    },
  });
  const nSl = slider(gP, { label: 'Board size N', min: 4, max: 12, value: s.n, onChange: (v) => (s.n = v) });
  slider(gP, { label: 'Trials per algorithm', min: 5, max: 300, step: 5, value: s.trials, onChange: (v) => (s.trials = v) });
  seedControl(gP, { value: s.seed, onChange: (v) => (s.seed = v) });

  const ctls = {};
  const gH = group(side, 'Hill climbing (steepest ascent)');
  ctls.sideways = checkbox(gH, { label: 'Sideways moves (cap 100)', value: s.sideways, onChange: (v) => (s.sideways = v) });
  ctls.restarts = slider(gH, { label: 'Random restarts', min: 0, max: 50, value: s.restarts, onChange: (v) => (s.restarts = v) });
  const gS = group(side, 'Simulated annealing (geometric)');
  ctls.T0 = slider(gS, { label: 'T₀', min: 1, max: 200, value: s.T0, onChange: (v) => (s.T0 = v) });
  ctls.alpha = slider(gS, { label: 'α', min: 0.8, max: 0.995, step: 0.005, value: s.alpha, format: (v) => v.toFixed(3), onChange: (v) => (s.alpha = v) });
  ctls.movesPerT = slider(gS, { label: 'Moves per temperature', min: 1, max: 200, value: s.movesPerT, onChange: (v) => (s.movesPerT = v) });
  const gG = group(side, 'Genetic algorithm (tournament k = 3, elitism 2)');
  ctls.N = slider(gG, { label: 'Population N', min: 4, max: 200, step: 2, value: s.N, onChange: (v) => (s.N = v) });
  ctls.gens = slider(gG, { label: 'Max generations', min: 10, max: 1000, step: 10, value: s.gens, onChange: (v) => (s.gens = v) });
  ctls.mut = slider(gG, { label: 'Mutation rate', min: 0, max: 0.5, step: 0.005, value: s.mut, format: (v) => v.toFixed(3), onChange: (v) => (s.mut = v) });

  const runBtn = el('button', { type: 'button', class: 'btn primary', text: 'Run comparison', onclick: run });
  const progress = el('span', { class: 'muted small' });
  side.append(el('div', { class: 'btn-row' }, runBtn), progress);

  // ---- views
  const resCard = card(main, 'Results', { wide: true });
  const resBody = el('div', { class: 'table-scroll' });
  resCard.body.append(resBody);

  const succCard = card(main, 'Success rate (%)');
  const succCanvas = el('canvas', { class: 'canvas-md' });
  succCard.body.append(succCanvas);
  const evalCard = card(main, 'Mean fitness evaluations per trial');
  const evalCanvas = el('canvas', { class: 'canvas-md' });
  evalCard.body.append(evalCanvas);


  let results = null;

  async function run() {
    runBtn.disabled = true;
    // lp: local-search view (HC, SA); gp: chromosome view (GA); objective in the problem's natural units
    let lp, gp, gaObjective, title, objLabel;
    if (s.problem === 'queens') {
      lp = queensProblem(s.n);
      gp = queensGeneProblem(s.n);
      gaObjective = attackingPairs;
      title = `${s.n}-queens`;
      objLabel = 'Mean best h (0 = solved)';
    } else if (s.problem === 'knapsack') {
      gp = knapsackProblem(25, makeRng(s.seed * 2654435761 + 17));
      lp = bitLocalProblem(gp);
      gaObjective = gp.fitness;
      title = gp.title;
      objLabel = `Mean best value (optimum ${gp.maxFitness})`;
    } else if (s.problem.startsWith('surface:')) {
      lp = surfaceProblem(s.problem.slice(8), s.seed);
      gp = surfaceGeneProblem(s.problem.slice(8), s.seed);
      gaObjective = gp.fitness;
      title = `Surface: ${lp.title}`;
      objLabel = `Mean best f (optimum ${lp.optimum})`;
    } else {
      lp = landscapeProblem(s.problem, s.seed);
      gp = landscapeGeneProblem(s.problem, s.seed);
      gaObjective = gp.fitness;
      title = lp.title;
      objLabel = `Mean best f (optimum ${lp.optimum})`;
    }

    const runners = [
      (rng) => {
        let last;
        for (const x of hillClimbing(lp, { variant: 'steepest', sideways: s.sideways, maxSideways: 100, restarts: s.restarts }, rng)) last = x;
        return { solved: lp.isGoal(last.best), obj: lp.objective(last.best), evals: last.evals };
      },
      (rng) => {
        let last;
        for (const x of simulatedAnnealing(lp, { T0: s.T0, schedule: 'geometric', alpha: s.alpha, Tmin: 0.01, movesPerT: s.movesPerT, maxIter: 100000 }, rng)) last = x;
        return { solved: lp.isGoal(last.best), obj: lp.objective(last.best), evals: last.evals };
      },
      (rng) => {
        let last;
        for (const x of geneticAlgorithm(gp, { N: s.N, crossoverRate: 0.8, mutationRate: s.mut, selection: 'tournament', k: 3, elitism: 2, maxGenerations: s.gens }, rng)) last = x;
        return { solved: last.solved, obj: gaObjective(last.best), evals: last.evals };
      },
    ];

    results = [];
    for (const [ai, fn] of runners.entries()) {
      const rng = makeRng(s.seed * 31 + ai);
      let solved = 0, obj = 0, evals = 0;
      const t0 = performance.now();
      for (let t = 0; t < s.trials; t++) {
        const r = fn(rng);
        if (r.solved) solved++;
        obj += r.obj;
        evals += r.evals;
        if (t % 5 === 4 || t === s.trials - 1) {
          progress.textContent = `${ALGOS[ai]}: ${t + 1} / ${s.trials}`;
          await tick();
        }
      }
      results.push({ solved: (solved / s.trials) * 100, obj: obj / s.trials, evals: evals / s.trials, ms: (performance.now() - t0) / s.trials });
    }
    progress.textContent = 'Done.';
    runBtn.disabled = false;

    const row = (label, f) => `<tr><th>${label}</th>${results.map((r) => `<td class="num">${f(r)}</td>`).join('')}</tr>`;
    resBody.innerHTML = `<table class="log">
      <thead><tr><th>${escapeHtml(title)}, ${s.trials} trials</th>${ALGOS.map((a) => `<th class="num">${a}</th>`).join('')}</tr></thead>
      <tbody>
        ${row('Success rate', (r) => `<strong>${r.solved.toFixed(1)}%</strong>`)}
        ${row(objLabel, (r) => r.obj.toFixed(2))}
        ${row('Mean fitness evaluations', (r) => Math.round(r.evals).toLocaleString('en-US'))}
      </tbody></table>`;
    render();
  }

  function render() {
    if (!results) return;
    const labels = ['Hill climbing', 'Sim. annealing', 'Genetic alg.'];
    drawBarChart(succCanvas, { labels, values: results.map((r) => r.solved), colors: COLORS, max: 100, format: (v) => `${v.toFixed(0)}%` });
    drawBarChart(evalCanvas, { labels, values: results.map((r) => r.evals), colors: COLORS, format: (v) => fmt(Math.round(v)) });
  }

  return { render };
}
