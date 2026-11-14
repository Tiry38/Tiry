// Balancing-Simulation: rechnet viele komplette Bot-Partien (alle Teamgrößen, alle Völker, Helden aktiv)
// parallel auf allen Prozessorkernen durch und meldet Ausreißer.
// Aufruf: node scripts/balance.mjs [Partien=48] [Schwierigkeit=normal]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

if (isMainThread) {
  const games = +(process.argv[2] || 48);
  const difficulty = process.argv[3] || 'normal';
  const threads = Math.max(1, Math.min(os.cpus().length, games));
  const jobs = Array.from({ length: games }, (_, i) => ({ seed: 1000 + i, size: 1 + (i % 4), difficulty }));
  const results = [];
  let next = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: threads }, () => new Promise((resolve) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: null });
    const feed = () => { if (next >= jobs.length) { w.terminate(); resolve(); return; } w.postMessage(jobs[next++]); };
    w.on('message', (r) => { results.push(r); feed(); });
    feed();
  })));
  const { FACTION_IDS } = await import('../src/sim/data.js');
  const { HERO_IDS } = await import('../src/sim/heroes.js');
  const agg = (key, ids) => {
    const o = Object.fromEntries(ids.map((id) => [id, { n: 0, leaks: 0, wins: 0, games: 0 }]));
    for (const r of results) for (const p of r.players) { const a = o[p[key]]; if (!a) continue; a.n++; a.leaks += p.leaks; if (r.winner === p.team) a.wins++; if (r.winner !== -1) a.games++; }
    return o;
  };
  const fac = agg('faction', FACTION_IDS), her = agg('hero', HERO_IDS);
  const table = (o, label) => {
    const rows = Object.entries(o).filter(([, a]) => a.n);
    const avgLeak = rows.reduce((s, [, a]) => s + a.leaks / a.n, 0) / rows.length;
    console.log(`\n${label}  (Durchbrüche je Spieler und Partie · Siegquote)`);
    for (const [id, a] of rows) {
      const l = a.leaks / a.n, wr = a.games ? a.wins / a.games : 0;
      const flag = Math.abs(l - avgLeak) > Math.max(1.5, avgLeak * 0.45) || Math.abs(wr - 0.5) > 0.15 ? '  ⚠ Ausreißer' : '';
      console.log(`  ${id.padEnd(10)} ${l.toFixed(1).padStart(5)} · ${(wr * 100).toFixed(0).padStart(3)} %  (${a.n})${flag}`);
    }
  };
  table(fac, 'Völker'); table(her, 'Helden');
  const ends = results.map((r) => r.wave);
  const bySize = {};
  for (const r of results) (bySize[r.size] = bySize[r.size] || []).push(r.wave);
  console.log('\nPartie-Ende (Welle) je Teamgröße:', Object.entries(bySize).map(([k, v]) => `${k}v${k}: Ø ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)}`).join(' · '));
  console.log(`Ø Ende Welle ${(ends.reduce((a, b) => a + b, 0) / ends.length).toFixed(1)} · ${results.length} Partien in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
} else {
  const { Sim } = await import('../src/sim/sim.js');
  const { FACTION_IDS } = await import('../src/sim/data.js');
  const { HERO_IDS } = await import('../src/sim/heroes.js');
  const { Rng } = await import('../src/sim/rng.js');
  parentPort.on('message', ({ seed, size, difficulty }) => {
    const r = new Rng(seed * 7919);
    const players = [];
    for (let i = 0; i < size * 2; i++) players.push({ team: i % 2, faction: FACTION_IDS[r.int(FACTION_IDS.length)], hero: HERO_IDS[r.int(HERO_IDS.length)], bot: true, difficulty });
    const sim = new Sim({ seed, players });
    while (sim.phase !== 'over' && sim.tick < 20 * 60 * 90) sim.step();
    parentPort.postMessage({ seed, size, winner: sim.winner, wave: sim.wave, players: sim.players.map((p) => ({ team: p.team, faction: p.faction, hero: p.heroId, leaks: p.stats.leaks })) });
  });
}
