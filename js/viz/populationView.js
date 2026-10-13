// HTML views for the genetic algorithm: population table, crossover and mutation.
import { escapeHtml } from '../ui/controls.js';
import { fmt } from './lineChart.js';

// cls(i) returns extra classes for gene i; cut inserts a cut marker before gene `cut`.
export function geneCells(genes, problem, { cls = () => '', cut = null } = {}) {
  const binary = problem.alphabet === 2;
  return (
    '<span class="genes">' +
    genes
      .map((g, i) => {
        const base = binary ? (g ? 'gene g1' : 'gene g0') : 'gene gd';
        const marker = cut === i ? '<span class="cut" aria-hidden="true"></span>' : '';
        return `${marker}<span class="${base} ${cls(i)}">${escapeHtml(problem.geneText(g))}</span>`;
      })
      .join('') +
    '</span>'
  );
}

export function renderPopulation(container, { pop, fits, probs, problem, elitism = 0, maxRows = 40 }) {
  const order = fits.map((_, i) => i).sort((a, b) => fits[b] - fits[a]);
  const maxP = Math.max(...probs, 1e-9);
  const rows = order.slice(0, maxRows).map((i, rank) => {
    const p = probs[i];
    return `<tr class="${rank === 0 ? 'top' : ''}">
      <td class="num">#${i + 1}</td>
      <td>${geneCells(pop[i], problem)}</td>
      <td>${escapeHtml(problem.decode(pop[i]))}</td>
      <td class="num">${fmt(fits[i])}</td>
      <td class="pcell"><span class="pbar"><span style="width:${((p / maxP) * 100).toFixed(1)}%"></span></span><span class="pval">${(p * 100).toFixed(1)}%</span></td>
    </tr>`;
  });
  container.innerHTML = `
    <table class="pop">
      <thead><tr><th>#</th><th>Chromosome</th><th>Decoded</th><th class="num">Fitness</th><th>P(selected)</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
    ${pop.length > maxRows ? `<p class="muted small">Showing the ${maxRows} fittest of ${pop.length} individuals.</p>` : ''}
    ${elitism ? `<p class="muted small">Elitism: the top ${elitism} ${elitism === 1 ? 'individual is' : 'individuals are'} copied unchanged into the next generation.</p>` : ''}`;
}

export function renderOperators(container, { crossover, mutation, problem }) {
  const meta = (g) => `<span class="meta">${escapeHtml(problem.decode(g))}, f = ${fmt(problem.fitness(g))}</span>`;
  let html = '';
  if (crossover) {
    const { p1, p2, c1, c2, cut } = crossover;
    const a = (i) => (i < cut ? 'src-a' : 'src-b');
    const b = (i) => (i < cut ? 'src-b' : 'src-a');
    html += `<div class="op">
      <h4>One-point crossover <span class="muted">(cut after gene ${cut})</span></h4>
      <div class="op-row"><span class="op-label">Parent 1</span>${geneCells(p1, problem, { cls: () => 'src-a', cut })}${meta(p1)}</div>
      <div class="op-row"><span class="op-label">Parent 2</span>${geneCells(p2, problem, { cls: () => 'src-b', cut })}${meta(p2)}</div>
      <div class="op-arrow">↓</div>
      <div class="op-row"><span class="op-label">Child 1</span>${geneCells(c1, problem, { cls: a, cut })}${meta(c1)}</div>
      <div class="op-row"><span class="op-label">Child 2</span>${geneCells(c2, problem, { cls: b, cut })}${meta(c2)}</div>
    </div>`;
  } else {
    html += `<div class="op"><h4>One-point crossover</h4><p class="muted">No crossover yet. Step one generation to see one.</p></div>`;
  }
  if (mutation) {
    const flipped = new Set(mutation.flipped);
    const label = problem.alphabet === 2 ? 'Bit-flip mutation' : 'Random-reset mutation';
    html += `<div class="op">
      <h4>${label} <span class="muted">(gene ${mutation.flipped.map((i) => i + 1).join(', ')})</span></h4>
      <div class="op-row"><span class="op-label">Before</span>${geneCells(mutation.before, problem)}${meta(mutation.before)}</div>
      <div class="op-arrow">↓</div>
      <div class="op-row"><span class="op-label">Mutated</span>${geneCells(mutation.after, problem, { cls: (i) => (flipped.has(i) ? 'flip' : '') })}${meta(mutation.after)}</div>
    </div>`;
  } else {
    html += `<div class="op"><h4>Mutation</h4><p class="muted">No mutation in this generation.</p></div>`;
  }
  container.innerHTML = html;
}
