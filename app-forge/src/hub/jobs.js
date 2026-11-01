'use strict';
/**
 * JobQueue – alle langen Arbeiten (App erzeugen, verbessern, testen, exportieren)
 * laufen nacheinander mit Fortschritt und Abbruch-Möglichkeit.
 */
let counter = 0;

class JobQueue {
  constructor(bus, { concurrency = 1, keep = 80 } = {}) {
    this.bus = bus;
    this.concurrency = concurrency;
    this.keep = keep;
    this.jobs = [];
    this.running = 0;
  }

  add({ type, title, run, priority = 0, source = 'ui', meta = {} }) {
    const controller = new AbortController();
    const job = {
      id: `job-${Date.now().toString(36)}-${(++counter).toString(36)}`,
      type,
      title: title || type,
      source,
      meta,
      priority,
      status: 'queued',
      progress: 0,
      message: '',
      createdAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      result: null,
      error: null,
      signal: controller.signal,
      _controller: controller,
      _run: run
    };
    job.done = new Promise((resolve) => { job._resolve = resolve; });
    this.jobs.push(job);
    this.bus.emit('job.queued', this.view(job), { source: 'jobs' });
    this._pump();
    return job;
  }

  view(job) {
    const { id, type, title, source, meta, status, progress, message, createdAt, startedAt, finishedAt, error } = job;
    return { id, type, title, source, meta, status, progress, message, createdAt, startedAt, finishedAt, error };
  }

  isBusy() {
    return this.running > 0 || this.jobs.some((j) => j.status === 'queued');
  }

  hasQueued(type) {
    return this.jobs.some((j) => j.type === type && (j.status === 'queued' || j.status === 'running'));
  }

  cancel(id) {
    const job = this.jobs.find((j) => j.id === id);
    if (!job || ['done', 'failed', 'cancelled'].includes(job.status)) return false;
    job._controller.abort();
    if (job.status === 'queued') this._finish(job, 'cancelled', null, 'Abgebrochen');
    return true;
  }

  list() {
    return this.jobs.map((j) => this.view(j));
  }

  _pump() {
    while (this.running < this.concurrency) {
      const next = this.jobs.filter((j) => j.status === 'queued').sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)[0];
      if (!next) return;
      this._start(next);
    }
  }

  async _start(job) {
    this.running++;
    job.status = 'running';
    job.startedAt = Date.now();
    this.bus.emit('job.started', this.view(job), { source: 'jobs' });
    const api = {
      signal: job.signal,
      progress: (pct, message) => {
        job.progress = Math.max(0, Math.min(100, Math.round(pct)));
        if (message) job.message = message;
        this.bus.emit('job.progress', this.view(job), { source: 'jobs' });
      },
      checkCancelled: () => {
        if (job.signal.aborted) {
          const e = new Error('Abgebrochen');
          e.cancelled = true;
          throw e;
        }
      }
    };
    try {
      const result = await job._run(api);
      if (job.signal.aborted) this._finish(job, 'cancelled', null, 'Abgebrochen');
      else this._finish(job, 'done', result, null);
    } catch (err) {
      const cancelled = job.signal.aborted || (err && err.cancelled);
      this._finish(job, cancelled ? 'cancelled' : 'failed', null, String(err && err.message ? err.message : err));
    } finally {
      this.running--;
      this._pump();
    }
  }

  _finish(job, status, result, error) {
    job.status = status;
    job.result = result;
    job.error = error;
    job.progress = status === 'done' ? 100 : job.progress;
    job.finishedAt = Date.now();
    this.bus.emit(`job.${status}`, this.view(job), { source: 'jobs' });
    job._resolve({ status, result, error });
    const finished = this.jobs.filter((j) => ['done', 'failed', 'cancelled'].includes(j.status));
    if (finished.length > this.keep) {
      const drop = new Set(finished.slice(0, finished.length - this.keep));
      this.jobs = this.jobs.filter((j) => !drop.has(j));
    }
  }
}

module.exports = { JobQueue };
