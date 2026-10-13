// Drives an algorithm generator: run / pause / step / finish with an adjustable speed.

export const SPEEDS = [
  { label: '2 / s', interval: 500, steps: 1 },
  { label: '4 / s', interval: 250, steps: 1 },
  { label: '8 / s', interval: 120, steps: 1 },
  { label: '20 / s', interval: 50, steps: 1 },
  { label: '60 / s', interval: 0, steps: 1 },
  { label: '4 / frame', interval: 0, steps: 4 },
  { label: '15 / frame', interval: 0, steps: 15 },
  { label: '60 / frame', interval: 0, steps: 60 },
  { label: '250 / frame', interval: 0, steps: 250 },
  { label: '1000 / frame', interval: 0, steps: 1000 },
];

export class Runner {
  constructor({ create, onStep, onRender, onState }) {
    this.create = create;
    this.onStep = onStep;
    this.onRender = onRender;
    this.onState = onState;
    this.speed = 3;
    this.running = false;
    this.finished = false;
    this.raf = 0;
  }

  // One step ahead is prefetched so the UI knows a snapshot is the last one when it is shown.
  pull() {
    if (this.pending.done) {
      this.finished = true;
      return false;
    }
    this.onStep(this.pending.value);
    this.pending = this.gen.next();
    if (this.pending.done) this.finished = true;
    return true;
  }

  emit() {
    this.onState?.(this.finished ? 'done' : this.running ? 'running' : 'paused');
  }

  reset() {
    this.stop();
    this.gen = this.create();
    this.pending = this.gen.next();
    this.finished = false;
    this.pull();
    this.onRender();
    this.emit();
  }

  advance(n) {
    for (let i = 0; i < n && this.pull(); i++);
    if (this.finished) this.stop();
    this.onRender();
    this.emit();
  }

  play() {
    if (this.finished || this.running) return;
    this.running = true;
    this.last = -Infinity;
    this.emit();
    const loop = (ts) => {
      if (!this.running) return;
      const s = SPEEDS[this.speed - 1];
      if (ts - this.last >= s.interval) {
        this.last = ts;
        this.advance(s.steps);
      }
      if (this.running) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  pause() {
    this.stop();
    this.emit();
  }

  step() {
    this.stop();
    if (!this.finished) this.advance(1);
  }

  finish(limit = 2_000_000) {
    this.stop();
    for (let n = 0; n < limit && this.pull(); n++);
    this.onRender();
    this.emit();
  }
}
