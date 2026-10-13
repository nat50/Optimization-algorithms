// Calm, scroll-only parallax for the hero.
// - Layers move 1:1 with the scroll position (no easing, no lag) and by a small fraction of it,
//   so the scene drifts gently instead of swimming. Larger data-depth = farther away = moves less on screen.
// - Where the browser supports CSS scroll-driven animations, CSS does the work on the compositor
//   (see .hero-layer in style.css) and this script only sets --depth. Otherwise a rAF fallback applies
//   the same math, and only while the hero is on screen.
// - Nothing moves when the user prefers reduced motion. There is no pointer-driven motion.
const hero = document.getElementById('hero');
const tabbar = document.getElementById('tabbar');
const layers = [...hero.querySelectorAll('[data-depth]')];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const cssDriven = CSS.supports('animation-timeline: scroll()');

for (const layer of layers) layer.style.setProperty('--depth', layer.dataset.depth);

// Tab bar gets its shadow once the hero has scrolled away (no scroll listener needed).
new IntersectionObserver(([entry]) => tabbar.classList.toggle('stuck', !entry.isIntersecting), {
  rootMargin: `-${tabbar.offsetHeight + 1}px 0px 0px 0px`,
}).observe(hero);

if (!cssDriven) {
  let heroVisible = true;
  let queued = false;
  const apply = () => {
    queued = false;
    const y = reduceMotion.matches ? 0 : Math.min(window.scrollY, hero.offsetHeight);
    for (const layer of layers) layer.style.transform = y ? `translate3d(0, ${(y * layer.dataset.depth).toFixed(2)}px, 0)` : '';
    hero.style.setProperty('--fade', (1 - Math.min(1, y / hero.offsetHeight) * 0.6).toFixed(3));
  };
  const queue = () => {
    if (heroVisible && !queued) {
      queued = true;
      requestAnimationFrame(apply);
    }
  };
  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    queue();
  }).observe(hero);
  window.addEventListener('scroll', queue, { passive: true });
  reduceMotion.addEventListener('change', queue);
  apply();
}
