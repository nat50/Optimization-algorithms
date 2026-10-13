import { el, group, slider, select, checkbox, seedControl, controlBar, card, statGrid, escapeHtml, tick } from '../ui/controls.js';
import { Runner } from '../ui/runner.js';
import { makeRng, startRng } from '../rng.js';
import { landscapeProblem, LANDSCAPES, LANDSCAPE_OPTIONS } from '../problems/landscape.js';
import { queensProblem } from '../problems/queens.js';
import { surfaceProblem, SURFACES, SURFACE_OPTIONS } from '../problems/surface.js';
import { hillClimbing } from '../algorithms/hillClimbing.js';
import { drawLandscape } from '../viz/landscapeView.js';
import { drawBoard } from '../viz/boardView.js';
import { drawLineChart } from '../viz/lineChart.js';
import { createSurfaceView } from '../viz/surfaceView.js';

const PROBLEMS = [
  ...LANDSCAPE_OPTIONS.map((o) => ({ value: o.value, label: `Line: ${o.label}` })),
  ...SURFACE_OPTIONS.map((o) => ({ value: `surface:${o.value}`, label: `Surface: ${o.label}` })),
  { value: 'queens', label: 'N-queens' },
];
const VARIANTS = [
  { value: 'steepest', label: 'Steepest ascent' },
  { value: 'stochastic', label: 'Stochastic' },
  { value: 'first-choice', label: 'First-choice' },
];

export function mountHillClimbing(root) {
  const s = { problem: 'surface:peaks', queens: 8, variant: 'steepest', sideways: false, maxSideways: 100, restarts: 0, randomStart: false, start: LANDSCAPES.twopeaks.start, seed: 42, roll: 0, trials: 1000 };
  // isLandscape: maximise f (1-D line or 3D surface); isLine: the 1-D landscapes only
  const surfaceKey = () => (s.problem.startsWith('surface:') ? s.problem.slice(8) : null);
  const isLandscape = () => s.problem !== 'queens';
  const isLine = () => isLandscape() && !surfaceKey();
  let problem, cur, hist, rows, visited, restartMarks;
  let bar;

  const side = el('aside', { class: 'controls' });
  const main = el('div', { class: 'viz' });
  root.append(side, main);

  // ---- controls
  const gP = group(side, 'Problem');
  select(gP, { label: 'Objective', options: PROBLEMS, value: s.problem, onChange: (v) => { s.problem = v; onProblemChange(); } });
  const problemNote = el('p', { class: 'hint' });
  gP.append(problemNote);
  const queensSl = slider(gP, { label: 'Board size N', min: 4, max: 14, value: s.queens, onChange: (v) => { s.queens = v; onProblemChange(); } });
  const randomStart = checkbox(gP, { label: 'Random start state', value: s.randomStart, onChange: (v) => { s.randomStart = v; if (v) s.roll++; syncVisibility(); restart(); } });
  const startSl = slider(gP, { label: 'Start x', min: 0, max: 10, value: s.start, onChange: (v) => { s.start = v; restart(); } });

  const gA = group(side, 'Algorithm');
  select(gA, { label: 'Variant', options: VARIANTS, value: s.variant, onChange: (v) => { s.variant = v; restart(); } });
  checkbox(gA, { label: 'Allow sideways moves', value: s.sideways, onChange: (v) => { s.sideways = v; syncVisibility(); restart(); } });
  const capSl = slider(gA, { label: 'Max consecutive sideways moves', min: 1, max: 200, value: s.maxSideways, onChange: (v) => { s.maxSideways = v; restart(); } });
  slider(gA, { label: 'Random restarts', min: 0, max: 50, value: s.restarts, onChange: (v) => { s.restarts = v; restart(); } });

  const gR = group(side, 'Run');
  seedControl(gR, { value: s.seed, onChange: (v) => { s.seed = v; s.roll = 0; /random$/.test(s.problem) ? onProblemChange() : restart(); } });
  const runner = new Runner({ create, onStep, onRender: render, onState: (st) => bar.setState(st) });
  bar = controlBar(gR, runner, {
    onReset: () => { s.roll++; restart(); },
    resetHint: 'Reset draws a new random start state (fixed Start x is kept).',
  });

  // ---- views
  const vizCard = card(main, 'State space', { wide: true });
  const vizCanvas = el('canvas', { class: 'canvas-lg' });
  vizCard.body.append(vizCanvas);
  const surfaceView = createSurfaceView(vizCard.body, () => render());

  const statusCard = card(main, 'Status');
  const stats = statGrid(statusCard.body, [
    ['step', 'Step'],
    ['state', 'Current'],
    ['value', 'f(current)'],
    ['best', 'Best found'],
  ]);
  const statusLine = el('p', { class: 'status-line' });
  statusCard.body.append(statusLine);

  const chartCard = card(main, 'Objective by step');
  const chartCanvas = el('canvas', { class: 'canvas-md' });
  chartCard.body.append(chartCanvas);

  const logCard = card(main, 'Step log', { wide: true });
  const logWrap = el('div', { class: 'table-scroll' });
  logCard.body.append(logWrap);

  const batchCard = card(main, 'Batch experiment', { wide: true });
  const batchCtl = el('div', { class: 'batch-controls' });
  batchCard.body.append(batchCtl);
  slider(batchCtl, { label: 'Trials per configuration', min: 100, max: 5000, step: 100, value: s.trials, onChange: (v) => (s.trials = v) });
  const batchBtn = el('button', { type: 'button', class: 'btn primary', text: 'Run trials', onclick: runBatch });
  const batchProgress = el('span', { class: 'muted' });
  batchCtl.append(el('div', { class: 'btn-row' }, batchBtn, batchProgress));
  const batchOut = el('div', { class: 'table-scroll' });
  batchCard.body.append(batchOut);

  // ---- behaviour
  function buildProblem() {
    if (surfaceKey()) return surfaceProblem(surfaceKey(), s.seed);
    return isLine() ? landscapeProblem(s.problem, s.seed) : queensProblem(s.queens);
  }

  function syncVisibility() {
    randomStart.show(isLine());
    queensSl.show(!isLandscape());
    startSl.show(isLine() && !s.randomStart);
    vizCanvas.hidden = !!surfaceKey();
    surfaceView.show(!!surfaceKey());
    capSl.show(s.sideways);
  }

  function onProblemChange() {
    if (surfaceKey()) {
      problemNote.textContent = SURFACES[surfaceKey()].note;
    } else if (isLine()) {
      const L = LANDSCAPES[s.problem];
      startSl.setRange(0, landscapeProblem(s.problem, s.seed).values.length - 1);
      s.start = L.start;
      startSl.set(s.start);
      problemNote.textContent = L.note;
    } else {
      problemNote.textContent = 'One queen per column; h counts attacking pairs.';
    }
    syncVisibility();
    stats.label('value', isLandscape() ? 'f(current)' : 'h (attacking pairs)');
    vizCard.setTitle(
      surfaceKey()
        ? `Surface (3D view): ${SURFACES[surfaceKey()].title}`
        : isLine()
          ? `State space: ${LANDSCAPES[s.problem].title}`
          : `State: ${s.queens}-queens board (red lines join attacking queens)`,
    );
    batchOut.innerHTML = '';
    restart();
  }

  function create() {
    problem = buildProblem();
    cur = null;
    hist = [];
    rows = [];
    visited = [];
    restartMarks = [];
    // A random start comes from its own stream: Reset re-rolls it, changing parameters keeps it.
    const fixed = isLine() && !s.randomStart;
    const start = fixed ? s.start : problem.randomState(startRng(s.seed, s.roll));
    return hillClimbing(problem, { variant: s.variant, sideways: s.sideways, maxSideways: s.maxSideways, restarts: s.restarts, start }, makeRng(s.seed));
  }

  function onStep(snap) {
    cur = snap;
    if (snap.event === 'start') {
      restartMarks.push(hist.length);
      visited = [];
    }
    if (snap.event !== 'stop') {
      hist.push(problem.objective(snap.current));
      visited.push(snap.current);
    }
    if (snap.row) {
      rows.push(snap.row);
      if (rows.length > 400) rows.shift();
    }
  }

  function statusText() {
    if (!runner.finished) return cur.event === 'stop' ? `Run ${cur.run + 1} stopped (${cur.reason}). Restarting…` : 'Climbing…';
    if (cur.solved) return isLandscape() ? 'Finished: reached the global maximum.' : 'Finished: solution found (h = 0).';
    return isLandscape() ? 'Finished: stuck on a local maximum or plateau.' : 'Finished: stuck, no solution found.';
  }

  function render() {
    if (!cur) return;
    if (surfaceKey()) {
      surfaceView.draw({ values: problem.values, G: problem.G, current: cur.current, best: cur.best, trail: visited });
    } else if (isLine()) {
      drawLandscape(vizCanvas, {
        values: problem.values,
        current: cur.current,
        best: cur.best,
        visited,
        recent: visited.slice(-12),
        peaks: problem.peaks,
      });
    } else {
      drawBoard(vizCanvas, cur.current);
    }
    const obj = problem.objective;
    const sym = isLandscape() ? 'f' : 'h';
    stats.set('step', s.restarts ? `${cur.step}  (run ${cur.run + 1}/${s.restarts + 1})` : cur.step);
    stats.set('state', problem.label(cur.current));
    stats.set('value', obj(cur.current));
    stats.set('best', `${problem.label(cur.best)}  (${sym} = ${obj(cur.best)})`);
    statusLine.textContent = statusText();
    statusLine.className = 'status-line' + (runner.finished ? (cur.solved ? ' good' : ' bad') : '');

    drawLineChart(chartCanvas, {
      series: [{ name: isLandscape() ? 'f(current)' : 'h(current)', data: hist, color: 'accent' }],
      xLabel: s.restarts ? 'move (all runs, dashed line = restart)' : 'move',
      yLabel: isLandscape() ? 'f' : 'h',
      yMin: 0,
      vlines: restartMarks.slice(1),
      hlines: [{ y: problem.optimum, label: isLandscape() ? 'global max' : 'goal h = 0', color: 'good' }],
    });
    renderLog();
  }

  function renderLog() {
    const sym = isLandscape() ? 'f(x)' : 'h';
    const shown = rows.slice(-200);
    const body = shown
      .map((r) => {
        const stop = /Stop|Goal|limit/.test(r.move);
        return `<tr class="${stop ? 'stop' : ''}">${s.restarts ? `<td class="num">${r.run + 1}</td>` : ''}<td class="num">${r.step}</td><td>${escapeHtml(problem.label(r.state))}</td><td class="num">${problem.objective(r.state)}</td><td>${escapeHtml(r.neighbors)}</td><td>${escapeHtml(r.move)}</td></tr>`;
      })
      .join('');
    logWrap.innerHTML = `<table class="log"><thead><tr>${s.restarts ? '<th>Run</th>' : ''}<th>Step</th><th>State</th><th class="num">${sym}</th><th>Neighbors</th><th>Move</th></tr></thead><tbody>${body || '<tr><td colspan="6" class="muted">Press Step or Run to start.</td></tr>'}</tbody></table>`;
    logWrap.scrollTop = logWrap.scrollHeight;
  }

  async function runBatch() {
    batchBtn.disabled = true;
    const configs = [
      { name: 'Steepest ascent', opts: { variant: 'steepest', sideways: false, restarts: 0 } },
      { name: `With sideways moves (cap ${s.maxSideways})`, opts: { variant: 'steepest', sideways: true, maxSideways: s.maxSideways, restarts: 0 } },
      { name: `Current settings (${VARIANTS.find((v) => v.value === s.variant).label.split(' (')[0]}${s.sideways ? ', sideways' : ''}, ${s.restarts} restarts)`, opts: { variant: s.variant, sideways: s.sideways, maxSideways: s.maxSideways, restarts: s.restarts } },
    ];
    const p = buildProblem();
    const results = [];
    const t0 = performance.now();
    for (const [ci, c] of configs.entries()) {
      const rng = makeRng(s.seed * 7919 + 1);
      let solved = 0, movesSolved = 0, movesStuck = 0, evals = 0;
      for (let t = 0; t < s.trials; t++) {
        let last;
        for (const snap of hillClimbing(p, { ...c.opts, start: null }, rng)) last = snap;
        if (last.solved) {
          solved++;
          movesSolved += last.totalMoves;
        } else movesStuck += last.totalMoves;
        evals += last.evals;
        if (t % 50 === 49) {
          batchProgress.textContent = `Configuration ${ci + 1}/3: ${t + 1} / ${s.trials}`;
          await tick();
        }
      }
      results.push({ name: c.name, solved, movesSolved, movesStuck, evals });
    }
    const n = s.trials;
    const avg = (sum, k) => (k ? (sum / k).toFixed(1) : '—');
    batchOut.innerHTML = `<table class="log">
      <thead><tr><th>Configuration</th><th class="num">Solved</th><th class="num">Avg moves (solved)</th><th class="num">Avg moves (stuck)</th></tr></thead>
      <tbody>${results
        .map(
          (r) => `<tr><td>${escapeHtml(r.name)}</td><td class="num"><strong>${((r.solved / n) * 100).toFixed(1)}%</strong></td><td class="num">${avg(r.movesSolved, r.solved)}</td><td class="num">${avg(r.movesStuck, n - r.solved)}</td></tr>`,
        )
        .join('')}</tbody></table>`;
    batchProgress.textContent = `${n.toLocaleString('en-US')} trials each, ${((performance.now() - t0) / 1000).toFixed(1)} s`;
    batchBtn.disabled = false;
  }

  function restart() {
    runner.reset();
  }

  onProblemChange();
  return { render };
}
