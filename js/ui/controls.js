// Small DOM helpers for control panels, cards and stat grids.
import { SPEEDS } from './runner.js';

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) e.append(c);
  return e;
}

export const tick = () => new Promise((r) => setTimeout(r, 0));

const visible = (wrap) => ({
  show(on) {
    wrap.hidden = !on;
  },
});

export function group(parent, title) {
  const g = el('section', { class: 'ctl-group' }, el('h3', { text: title }));
  parent.append(g);
  return g;
}

export function slider(parent, { label, min, max, step = 1, value, format = (v) => String(v), hint, onChange }) {
  const input = el('input', { type: 'range', min, max, step, value });
  input.value = value;
  const out = el('output', { text: format(+input.value) });
  const wrap = el(
    'label',
    { class: 'ctl' },
    el('span', { class: 'ctl-head' }, el('span', { text: label }), out),
    input,
    hint ? el('small', { text: hint }) : null,
  );
  input.addEventListener('input', () => {
    out.textContent = format(+input.value);
    onChange?.(+input.value);
  });
  parent.append(wrap);
  return {
    el: wrap,
    get value() {
      return +input.value;
    },
    set(v) {
      input.value = v;
      out.textContent = format(+input.value);
    },
    setRange(mn, mx) {
      input.min = mn;
      input.max = mx;
    },
    disable(on) {
      input.disabled = on;
    },
    ...visible(wrap),
  };
}

export function select(parent, { label, options, value, onChange }) {
  const s = el('select');
  for (const o of options) s.append(el('option', { value: o.value, text: o.label }));
  s.value = value;
  s.addEventListener('change', () => onChange?.(s.value));
  const wrap = el('label', { class: 'ctl' }, el('span', { class: 'ctl-head' }, el('span', { text: label })), s);
  parent.append(wrap);
  return {
    el: wrap,
    get value() {
      return s.value;
    },
    set(v) {
      s.value = v;
    },
    ...visible(wrap),
  };
}

export function checkbox(parent, { label, value, onChange }) {
  const c = el('input', { type: 'checkbox' });
  c.checked = !!value;
  c.addEventListener('change', () => onChange?.(c.checked));
  const wrap = el('label', { class: 'ctl ctl-check' }, c, el('span', { text: label }));
  parent.append(wrap);
  return {
    el: wrap,
    get value() {
      return c.checked;
    },
    set(v) {
      c.checked = !!v;
    },
    disable(on) {
      c.disabled = on;
    },
    ...visible(wrap),
  };
}

export function seedControl(parent, { value, onChange }) {
  const n = el('input', { type: 'number', min: 0, max: 999999, value, 'aria-label': 'Random seed' });
  const apply = () => onChange(Math.max(0, parseInt(n.value, 10) || 0));
  n.addEventListener('change', apply);
  const dice = el('button', {
    type: 'button',
    class: 'btn small',
    text: 'New',
    title: 'Pick a new random seed',
    onclick: () => {
      n.value = Math.floor(Math.random() * 1e6);
      apply();
    },
  });
  const wrap = el('div', { class: 'ctl' }, el('span', { class: 'ctl-head' }, el('span', { text: 'Random seed' })), el('div', { class: 'row' }, n, dice));
  parent.append(wrap);
  return wrap;
}

export function controlBar(parent, runner, { onReset, resetHint } = {}) {
  const play = el('button', { type: 'button', class: 'btn primary', text: 'Run' });
  const step = el('button', { type: 'button', class: 'btn', text: 'Step' });
  const finish = el('button', { type: 'button', class: 'btn', text: 'Finish', title: 'Run to the end instantly' });
  const reset = el('button', { type: 'button', class: 'btn', text: 'Reset', title: resetHint ?? 'Restart the run' });
  play.onclick = () => (runner.running ? runner.pause() : runner.play());
  step.onclick = () => runner.step();
  finish.onclick = () => runner.finish();
  reset.onclick = () => (onReset ? onReset() : runner.reset());
  parent.append(el('div', { class: 'btn-row' }, play, step, finish, reset));
  const sp = slider(parent, {
    label: 'Speed',
    min: 1,
    max: SPEEDS.length,
    value: runner.speed,
    format: (v) => SPEEDS[v - 1].label,
    onChange: (v) => (runner.speed = v),
  });
  return {
    speed: sp,
    setState(s) {
      play.textContent = s === 'running' ? 'Pause' : 'Run';
      play.disabled = step.disabled = finish.disabled = s === 'done';
    },
  };
}

export function card(parent, title, { wide = false, note } = {}) {
  const h = el('h2', { text: title });
  const n = el('p', { class: 'card-note', text: note ?? '' });
  n.hidden = !note;
  const body = el('div', { class: 'card-body' });
  const c = el('section', { class: 'card' + (wide ? ' wide' : '') }, h, n, body);
  parent.append(c);
  return {
    el: c,
    body,
    setTitle: (t) => (h.textContent = t),
    setNote(t) {
      n.textContent = t ?? '';
      n.hidden = !t;
    },
  };
}

export function statGrid(parent, items) {
  const cells = {};
  const grid = el('dl', { class: 'stats' });
  for (const [key, label] of items) {
    const dt = el('dt', { text: label });
    const dd = el('dd', { text: '—' });
    cells[key] = { dt, dd };
    grid.append(el('div', {}, dt, dd));
  }
  parent.append(grid);
  return {
    set: (key, text) => (cells[key].dd.textContent = text),
    label: (key, text) => (cells[key].dt.textContent = text),
  };
}

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
