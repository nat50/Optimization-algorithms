import { el, group, slider, select, checkbox, seedControl, controlBar, card, statGrid } from '../ui/controls.js';
import { Runner } from '../ui/runner.js';
import { makeRng, startRng } from '../rng.js';
import { landscapeProblem, LANDSCAPES, LANDSCAPE_OPTIONS } from '../problems/landscape.js';
import { tspProblem, TSP_LAYOUTS } from '../problems/tsp.js';
import { surfaceProblem, SURFACES, SURFACE_OPTIONS } from '../problems/surface.js';
import { simulatedAnnealing, SCHEDULES } from '../algorithms/simulatedAnnealing.js';
import { drawLandscape } from '../viz/landscapeView.js';
import { drawTour } from '../viz/tspView.js';
import { drawLineChart, fmt } from '../viz/lineChart.js';
import { createSurfaceView } from '../viz/surfaceView.js';

const PROBLEMS = [
  { value: 'tsp', label: 'Traveling salesman' },
  ...SURFACE_OPTIONS.map((o) => ({ value: `surface:${o.value}`, label: `Surface: ${o.label}` })),
  ...LANDSCAPE_OPTIONS.map((o) => ({ value: o.value, label: `Line: ${o.label}` })),
];
const DEFAULTS = {
  surface: { T0: 30, alpha: 0.98, movesPerT: 30, maxIter: 50000, speed: 6 },
  landscape: { T0: 40, alpha: 0.99, movesPerT: 40, maxIter: 50000, speed: 6 },
  tsp: { T0: 100, alpha: 0.95, movesPerT: 100, maxIter: 50000, speed: 6 },
};
const MAX_ITERS = [1000, 5000, 20000, 50000, 100000];

export function mountSimulatedAnnealing(root) {
  const s = { problem: 'tsp', layout: 'clusters', cities: 36, randomStart: false, start: 18, schedule: 'geometric', T0: 20, alpha: 0.95, beta: 0.5, tminExp: -2, movesPerT: 10, maxIter: 5000, seed: 7, roll: 0 };
  const isTsp = () => s.problem === 'tsp';
  const surfaceKey = () => (s.problem.startsWith('surface:') ? s.problem.slice(8) : null);
  const isLine = () => !isTsp() && !surfaceKey();
  const Tmin = () => 10 ** s.tminExp;
  let problem, cur, histT, histCur, histBest, recent, visited;
  let bar;

  const side = el('aside', { class: 'controls' });
  const main = el('div', { class: 'viz' });
  root.append(side, main);

  // ---- controls
  const gP = group(side, 'Problem');
  select(gP, { label: 'Problem', options: PROBLEMS, value: s.problem, onChange: (v) => { s.problem = v; onProblemChange(); } });
  const problemNote = el('p', { class: 'hint' });
  gP.append(problemNote);
  const layoutSel = select(gP, { label: 'City layout', options: TSP_LAYOUTS, value: s.layout, onChange: (v) => { s.layout = v; restart(); } });
  const citiesSl = slider(gP, { label: 'Number of cities', min: 5, max: 80, value: s.cities, onChange: (v) => { s.cities = v; restart(); } });
  const randomStart = checkbox(gP, { label: 'Random start state', value: s.randomStart, onChange: (v) => { s.randomStart = v; if (v) s.roll++; syncVisibility(); restart(); } });
  const startSl = slider(gP, { label: 'Start x', min: 0, max: 100, value: s.start, onChange: (v) => { s.start = v; restart(); } });

  const gT = group(side, 'Temperature');
  const T0Sl = slider(gT, { label: 'Initial temperature T₀', min: 1, max: 500, value: s.T0, onChange: (v) => { s.T0 = v; restart(); } });
  select(gT, {
    label: 'Cooling schedule',
    options: Object.entries(SCHEDULES).map(([value, d]) => ({ value, label: d.label })),
    value: s.schedule,
    onChange: (v) => { s.schedule = v; syncVisibility(); restart(); },
  });
  const alphaSl = slider(gT, { label: 'Cooling rate α', min: 0.8, max: 0.995, step: 0.005, value: s.alpha, format: (v) => v.toFixed(3), onChange: (v) => { s.alpha = v; restart(); } });
  const betaSl = slider(gT, { label: 'Linear step β', min: 0.01, max: 5, step: 0.01, value: s.beta, format: (v) => v.toFixed(2), onChange: (v) => { s.beta = v; restart(); } });
  slider(gT, { label: 'Stop temperature T_min', min: -3, max: 0, step: 0.5, value: s.tminExp, format: (v) => fmt(10 ** v), onChange: (v) => { s.tminExp = v; restart(); } });
  const movesSl = slider(gT, { label: 'Moves per temperature', min: 1, max: 500, value: s.movesPerT, onChange: (v) => { s.movesPerT = v; restart(); } });
  const iterSl = slider(gT, {
    label: 'Max iterations',
    min: 0,
    max: MAX_ITERS.length - 1,
    value: MAX_ITERS.indexOf(s.maxIter),
    format: (v) => MAX_ITERS[v].toLocaleString('en-US'),
    onChange: (v) => { s.maxIter = MAX_ITERS[v]; restart(); },
  });

  const gR = group(side, 'Run');
  seedControl(gR, { value: s.seed, onChange: (v) => { s.seed = v; s.roll = 0; /random$/.test(s.problem) ? onProblemChange() : restart(); } });
  const runner = new Runner({ create, onStep, onRender: render, onState: (st) => bar.setState(st) });
  bar = controlBar(gR, runner, {
    onReset: () => { s.roll++; restart(); },
    resetHint: 'Reset draws a new random start (a new initial tour for TSP; the cities stay).',
  });

  // ---- views
  const vizCard = card(main, 'State', { wide: true });
  const landCanvas = el('canvas', { class: 'canvas-lg' });
  const tourCur = el('canvas', { class: 'canvas-lg' });
  const tourBest = el('canvas', { class: 'canvas-lg' });
  const tourWrap = el('div', { class: 'two-col' }, tourCur, tourBest);
  vizCard.body.append(landCanvas, tourWrap);
  const surfaceView = createSurfaceView(vizCard.body, () => render());

  const statusCard = card(main, 'Status');
  const stats = statGrid(statusCard.body, [
    ['iter', 'Iteration'],
    ['T', 'Temperature T'],
    ['value', 'Current'],
    ['best', 'Best found'],
    ['worse', 'Worse moves accepted / rejected'],
  ]);
  const statusLine = el('p', { class: 'status-line' });
  statusCard.body.append(statusLine);


  const tCard = card(main, 'Temperature by iteration');
  const tCanvas = el('canvas', { class: 'canvas-md' });
  tCard.body.append(tCanvas);

  const oCard = card(main, 'Objective by iteration', { wide: true });
  const oCanvas = el('canvas', { class: 'canvas-md' });
  oCard.body.append(oCanvas);

  // ---- behaviour
  function syncVisibility() {
    citiesSl.show(isTsp());
    layoutSel.show(isTsp());
    randomStart.show(isLine());
    startSl.show(isLine() && !s.randomStart);
    alphaSl.show(s.schedule === 'geometric');
    betaSl.show(s.schedule === 'linear');
    landCanvas.hidden = !isLine();
    surfaceView.show(!!surfaceKey());
    tourWrap.hidden = !isTsp();
  }

  function onProblemChange() {
    const d = DEFAULTS[isTsp() ? 'tsp' : surfaceKey() ? 'surface' : 'landscape'];
    Object.assign(s, d);
    if (surfaceKey()) {
      problemNote.textContent = SURFACES[surfaceKey()].note;
    } else if (isLine()) {
      const p = landscapeProblem(s.problem, s.seed);
      // start on the first local maximum that is not the global one, where hill climbing would get stuck
      const trap = p.peaks.find((q) => !q.global) ?? p.peaks[0];
      s.start = trap.x;
      startSl.setRange(0, p.values.length - 1);
      startSl.set(s.start);
      problemNote.textContent = `${LANDSCAPES[s.problem].note} Starts on a local maximum.`;
    } else {
      problemNote.textContent = 'A neighbor reverses one segment of the tour (2-opt move).';
    }
    T0Sl.set(d.T0);
    alphaSl.set(d.alpha);
    bar.speed.set(d.speed);
    runner.speed = d.speed;
    movesSl.set(d.movesPerT);
    iterSl.set(MAX_ITERS.indexOf(d.maxIter));
    syncVisibility();
    vizCard.setTitle(
      isTsp() ? 'Tours: current (left) and best so far (right)' : surfaceKey() ? `Surface (3D view): ${SURFACES[surfaceKey()].title}` : `State space: ${LANDSCAPES[s.problem].title}`,
    );
    stats.label('value', isTsp() ? 'Current tour length' : 'f(current)');
    stats.label('best', isTsp() ? 'Best tour length' : 'Best f found');
    oCard.setTitle(isTsp() ? 'Tour length by iteration (minimize)' : 'f by iteration (maximize)');
    restart();
  }

  function create() {
    const rng = makeRng(s.seed);
    problem = isTsp() ? tspProblem(s.cities, rng, s.layout) : surfaceKey() ? surfaceProblem(surfaceKey(), s.seed) : landscapeProblem(s.problem, s.seed);
    cur = null;
    histT = [];
    histCur = [];
    histBest = [];
    recent = [];
    visited = new Set();
    // Cities come from the seed; a random start comes from its own stream so Reset can re-roll it.
    const start = isLine() && !s.randomStart ? s.start : problem.randomState(startRng(s.seed, s.roll));
    return simulatedAnnealing(
      problem,
      { T0: s.T0, schedule: s.schedule, alpha: s.alpha, beta: s.beta, Tmin: Tmin(), movesPerT: s.movesPerT, maxIter: s.maxIter, start },
      rng,
    );
  }

  function onStep(snap) {
    cur = snap;
    histT.push(snap.T);
    histCur.push(problem.objective(snap.current));
    histBest.push(problem.objective(snap.best));
    if (!isTsp()) {
      recent.push(snap.current);
      if (recent.length > (surfaceKey() ? 300 : 25)) recent.shift();
      visited.add(snap.current);
    }
  }

  function render() {
    if (!cur) return;
    const obj = problem.objective;
    if (isTsp()) {
      drawTour(tourCur, problem.cities, cur.current, { stroke: 'accent', caption: `Current: ${fmt(obj(cur.current))}` });
      drawTour(tourBest, problem.cities, cur.best, { stroke: 'good', caption: `Best: ${fmt(obj(cur.best))}` });
    } else if (surfaceKey()) {
      surfaceView.draw({ values: problem.values, G: problem.G, current: cur.current, best: cur.best, trail: recent });
    } else {
      drawLandscape(landCanvas, { values: problem.values, current: cur.current, best: cur.best, visited: [...visited], recent, peaks: problem.peaks });
    }

    stats.set('iter', cur.iter.toLocaleString('en-US'));
    stats.set('T', fmt(cur.T));
    stats.set('value', fmt(obj(cur.current)));
    stats.set('best', fmt(obj(cur.best)) + (isTsp() ? '' : `  at ${problem.label(cur.best)}`));
    stats.set('worse', `${cur.worseAccepted.toLocaleString('en-US')} / ${cur.worseRejected.toLocaleString('en-US')}`);

    let status = 'Annealing…';
    let cls = '';
    if (runner.finished) {
      if (isTsp()) status = `Finished. Best tour ${fmt(obj(cur.best))} (started at ${fmt(histCur[0])}).`;
      else {
        const global = problem.isGoal(cur.best);
        status = global ? 'Finished: reached the global maximum.' : 'Finished: did not reach the global maximum.';
        cls = global ? ' good' : ' bad';
      }
    }
    statusLine.textContent = status;
    statusLine.className = 'status-line' + cls;

    drawLineChart(tCanvas, {
      series: [{ name: 'T', data: histT, color: 'heat' }],
      x0: 1,
      xLabel: 'iteration',
      yLabel: 'T',
      yMin: 0,
      hlines: [{ y: Tmin(), label: 'T_min', color: 'muted' }],
    });
    drawLineChart(oCanvas, {
      series: [
        { name: 'current', data: histCur, color: 'accent', width: 1.5 },
        { name: 'best', data: histBest, color: 'good' },
      ],
      x0: 1,
      xLabel: 'iteration',
      yLabel: isTsp() ? 'length' : 'f',
      yMin: isTsp() ? undefined : 0,
      hlines: isTsp() ? [] : [{ y: problem.optimum, label: 'global max', color: 'good' }],
    });
  }


  function restart() {
    runner.reset();
  }

  onProblemChange();
  return { render };
}
