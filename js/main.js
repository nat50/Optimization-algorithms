import { mountHillClimbing } from './pages/hc.js';
import { mountSimulatedAnnealing } from './pages/sa.js';
import { mountGenetic } from './pages/ga.js';
import { mountCompare } from './pages/compare.js';

const pages = { hc: mountHillClimbing, sa: mountSimulatedAnnealing, ga: mountGenetic, compare: mountCompare };
const mounted = {};
let active = null;

function show(tab) {
  active = tab;
  for (const b of document.querySelectorAll('.tabs button')) {
    const on = b.dataset.tab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
  }
  for (const key of Object.keys(pages)) document.getElementById(`page-${key}`).hidden = key !== tab;
  if (!mounted[tab]) mounted[tab] = pages[tab](document.getElementById(`page-${tab}`));
  else mounted[tab].render();
  history.replaceState(null, '', `#${tab}`);
}

for (const b of document.querySelectorAll('.tabs button')) b.addEventListener('click', () => show(b.dataset.tab));

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => mounted[active]?.render(), 100);
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => mounted[active]?.render());

const initial = location.hash.slice(1);
show(initial in pages ? initial : 'hc');
