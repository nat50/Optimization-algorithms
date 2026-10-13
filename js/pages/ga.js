import { el, group, slider, select, checkbox, seedControl, controlBar, card, statGrid } from '../ui/controls.js';
import { Runner } from '../ui/runner.js';
import { makeRng, startRng } from '../rng.js';
import { knapsackProblem, functionProblem, queensGeneProblem } from '../problems/bitstring.js';
import { geneticAlgorithm } from '../algorithms/genetic.js';
import { renderPopulation, renderOperators } from '../viz/populationView.js';
import { drawFunctionPopulation, renderKnapsack } from '../viz/gaProblemView.js';
import { drawBoard } from '../viz/boardView.js';
import { drawLineChart, fmt } from '../viz/lineChart.js';
import { surfaceProblem, surfaceGeneProblem, SURFACES, SURFACE_OPTIONS, G } from '../problems/surface.js';
import { createSurfaceView } from '../viz/surfaceView.js';

const PROBLEMS = [
  { value: 'knapsack', label: 'Knapsack (pick items under a weight limit)' },
  { value: 'function', label: 'Maximize f(x) = x·sin(10πx) + 2' },
  { value: 'queens', label: 'N-queens (fitness = non-attacking pairs)' },
  ...SURFACE_OPTIONS.map((o) => ({ value: `surface:${o.value}`, label: `Surface: ${o.label}` })),
];
const NOTES = {
  knapsack: 'Each gene says whether an item is packed. Fitness is the total value; going over capacity is penalised.',
  function: 'x ∈ [−1, 2] is encoded in binary. The function has many peaks, and the highest is near x ≈ 1.85.',
  queens: 'Gene c is the row of the queen in column c. Fitness counts the pairs of queens that do not attack each other.',
};
const SELECTIONS = [
  { value: 'tournament', label: 'Tournament' },
  { value: 'roulette', label: 'Roulette wheel (fitness-proportionate)' },
  { value: 'rank', label: 'Rank' },
];
const DEFAULTS = {
  knapsack: { N: 40, maxGen: 150, elitism: 1 },
  function: { N: 30, maxGen: 100, elitism: 1 },
  queens: { N: 100, maxGen: 300, elitism: 2 },
  surface: { N: 40, maxGen: 80, elitism: 1 },
};

export function mountGenetic(root) {
  const s = { problem: 'knapsack', items: 24, bits: 18, queens: 8, N: 40, cx: 0.8, mut: 0.04, selection: 'tournament', k: 3, elitism: 1, maxGen: 150, stopOnGoal: true, seed: 3, roll: 0 };
  let problem, cur, histBest, histAvg, surface;
  const surfaceKey = () => (s.problem.startsWith('surface:') ? s.problem.slice(8) : null);
  const kind = () => (surfaceKey() ? 'surface' : s.problem);
  let bar;

  const side = el('aside', { class: 'controls' });
  const main = el('div', { class: 'viz' });
  root.append(side, main);

  // ---- controls
  const geneLength = () => (surfaceKey() ? 12 : s.problem === 'knapsack' ? s.items : s.problem === 'function' ? s.bits : s.queens);
  const resetMutation = () => {
    s.mut = +(1 / geneLength()).toFixed(3);
    mutSl.set(s.mut);
  };

  const gP = group(side, 'Problem');
  select(gP, { label: 'Problem', options: PROBLEMS, value: s.problem, onChange: (v) => { s.problem = v; onProblemChange(); } });
  const problemNote = el('p', { class: 'hint' });
  gP.append(problemNote);
  const itemsSl = slider(gP, { label: 'Number of items', min: 8, max: 40, value: s.items, onChange: (v) => { s.items = v; resetMutation(); restart(); } });
  const bitsSl = slider(gP, { label: 'Bits for x', min: 8, max: 20, value: s.bits, onChange: (v) => { s.bits = v; resetMutation(); restart(); } });
  const queensSl = slider(gP, { label: 'Board size N', min: 4, max: 12, value: s.queens, onChange: (v) => { s.queens = v; resetMutation(); restart(); } });

  const gG = group(side, 'Genetic operators');
  const nSl = slider(gG, { label: 'Population size N', min: 4, max: 200, step: 2, value: s.N, onChange: (v) => { s.N = v; elitSl.setRange(0, Math.min(10, v - 1)); restart(); } });
  slider(gG, { label: 'Crossover rate', min: 0, max: 1, step: 0.05, value: s.cx, format: (v) => v.toFixed(2), onChange: (v) => { s.cx = v; restart(); } });
  const mutSl = slider(gG, { label: 'Mutation rate (per gene)', min: 0, max: 0.5, step: 0.005, value: s.mut, format: (v) => v.toFixed(3), onChange: (v) => { s.mut = v; restart(); } });
  select(gG, { label: 'Selection', options: SELECTIONS, value: s.selection, onChange: (v) => { s.selection = v; kSl.show(v === 'tournament'); restart(); } });
  const kSl = slider(gG, { label: 'Tournament size k', min: 2, max: 10, value: s.k, onChange: (v) => { s.k = v; restart(); } });
  const elitSl = slider(gG, { label: 'Elitism e (best copied unchanged)', min: 0, max: 10, value: s.elitism, onChange: (v) => { s.elitism = v; restart(); } });

  const gS = group(side, 'Stopping');
  const genSl = slider(gS, { label: 'Max generations G', min: 1, max: 1000, value: s.maxGen, onChange: (v) => { s.maxGen = v; restart(); } });
  checkbox(gS, { label: 'Stop when the optimum is found', value: s.stopOnGoal, onChange: (v) => { s.stopOnGoal = v; restart(); } });

  const gR = group(side, 'Run');
  seedControl(gR, { value: s.seed, onChange: (v) => { s.seed = v; s.roll = 0; restart(); } });
  const runner = new Runner({ create, onStep, onRender: render, onState: (st) => bar.setState(st) });
  bar = controlBar(gR, runner, {
    onReset: () => { s.roll++; restart(); },
    resetHint: 'Reset draws a new random initial population. The seed fixes the problem data.',
  });
  bar.speed.set(2);
  runner.speed = 2;

  // ---- views
  const probCard = card(main, 'Best solution', { wide: true });
  const fnCanvas = el('canvas', { class: 'canvas-md' });
  const knapBody = el('div');
  const boardCanvas = el('canvas', { class: 'canvas-sq' });
  probCard.body.append(fnCanvas, knapBody, boardCanvas);
  const surfaceView = createSurfaceView(probCard.body, () => render());

  const statusCard = card(main, 'Status');
  const stats = statGrid(statusCard.body, [
    ['gen', 'Generation'],
    ['best', 'Best fitness'],
    ['avg', 'Average fitness'],
    ['decoded', 'Best solution'],
  ]);
  const statusLine = el('p', { class: 'status-line' });
  statusCard.body.append(statusLine);

  const chartCard = card(main, 'Fitness by generation');
  const chartCanvas = el('canvas', { class: 'canvas-md' });
  chartCard.body.append(chartCanvas);

  const popCard = card(main, 'Population', { wide: true });
  const popBody = el('div', { class: 'table-scroll tall' });
  popCard.body.append(popBody);

  const opCard = card(main, 'Crossover and mutation', { wide: true });
  const opBody = el('div', { class: 'ops' });
  opCard.body.append(opBody);

  // ---- behaviour
  function onProblemChange() {
    const d = DEFAULTS[kind()];
    Object.assign(s, d);
    nSl.set(s.N);
    genSl.set(s.maxGen);
    elitSl.setRange(0, Math.min(10, s.N - 1));
    elitSl.set(s.elitism);
    resetMutation();
    itemsSl.show(s.problem === 'knapsack');
    bitsSl.show(s.problem === 'function');
    queensSl.show(s.problem === 'queens');
    fnCanvas.hidden = s.problem !== 'function';
    knapBody.hidden = s.problem !== 'knapsack';
    boardCanvas.hidden = s.problem !== 'queens';
    surfaceView.show(!!surfaceKey());
    problemNote.textContent = surfaceKey()
      ? SURFACES[surfaceKey()].note
      : NOTES[s.problem];
    probCard.setTitle(
      surfaceKey()
        ? `Population on the surface (3D view): ${SURFACES[surfaceKey()].title}`
        : { knapsack: 'Best packing so far', function: 'Population on the function (green ring = best so far)', queens: 'Best board so far' }[s.problem],
    );
    kSl.show(s.selection === 'tournament');
    restart();
  }

  function buildProblem() {
    if (surfaceKey()) {
      surface = surfaceProblem(surfaceKey(), s.seed);
      return surfaceGeneProblem(surfaceKey(), s.seed);
    }
    if (s.problem === 'knapsack') return knapsackProblem(s.items, makeRng(s.seed * 2654435761 + 17));
    if (s.problem === 'function') return functionProblem(s.bits);
    return queensGeneProblem(s.queens);
  }

  function create() {
    problem = buildProblem();
    cur = null;
    histBest = [];
    histAvg = [];
    popCard.setTitle(`Population: ${problem.title}`);
    const r = startRng(s.seed, s.roll);
    const initial = Array.from({ length: s.N }, () => Array.from({ length: problem.length }, () => r.int(0, problem.alphabet - 1)));
    return geneticAlgorithm(
      problem,
      { N: s.N, crossoverRate: s.cx, mutationRate: s.mut, selection: s.selection, k: s.k, elitism: s.elitism, maxGenerations: s.maxGen, stopOnGoal: s.stopOnGoal, initial },
      makeRng(s.seed),
    );
  }

  function onStep(snap) {
    cur = snap;
    histBest.push(snap.genBest);
    histAvg.push(snap.avg);
  }

  function render() {
    if (!cur) return;
    if (surfaceKey()) {
      surfaceView.draw({ values: surface.values, G, best: problem.cellOf(cur.best), pop: cur.pop.map(problem.cellOf), mode: 'population' });
    } else if (s.problem === 'function') drawFunctionPopulation(fnCanvas, { problem, pop: cur.pop, best: cur.best });
    else if (s.problem === 'knapsack') renderKnapsack(knapBody, { problem, genes: cur.best });
    else if (s.problem === 'queens') drawBoard(boardCanvas, cur.best);
    renderPopulation(popBody, { pop: cur.pop, fits: cur.fits, probs: cur.probs, problem, elitism: s.elitism });
    renderOperators(opBody, { crossover: cur.crossover, mutation: cur.mutation, problem });

    stats.set('gen', `${cur.gen} of ${s.maxGen}`);
    stats.set('best', `${fmt(cur.bestFit)} / ${fmt(problem.maxFitness)}`);
    stats.set('avg', fmt(cur.avg));
    stats.set('decoded', problem.decode(cur.best));

    let status = 'Evolving…';
    let cls = '';
    if (runner.finished) {
      status = cur.solved ? `Finished: optimum found in generation ${cur.bestGen}.` : `Finished: ${s.maxGen} generations without reaching the optimum.`;
      cls = cur.solved ? ' good' : ' bad';
    } else if (cur.gen === 0) status = 'Generation 0: random initial population. Press Step to evolve one generation.';
    statusLine.textContent = status;
    statusLine.className = 'status-line' + cls;

    drawLineChart(chartCanvas, {
      series: [
        { name: 'best in generation', data: histBest, color: 'accent' },
        { name: 'average', data: histAvg, color: 'series-2', dashed: true },
      ],
      xLabel: 'generation',
      yLabel: 'fitness',
      yMin: 0,
      hlines: [{ y: problem.maxFitness, label: 'optimum', color: 'good' }],
    });
  }

  function restart() {
    runner.reset();
  }

  onProblemChange();
  return { render };
}
