/* Durchzieher-Zentrale – Auswertungslogik (ohne Oberfläche).
 * Läuft im Browser (window.DZEngine) und in Node (require('./engine.js')). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DZEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TZ = 'Europe/Berlin';
  const DAYS = 30;
  const WEEKS = [
    { key: 'W1', label: 'Woche 1', from: 1, to: 7 },
    { key: 'W2', label: 'Woche 2', from: 8, to: 14 },
    { key: 'W3', label: 'Woche 3', from: 15, to: 21 },
    { key: 'W4', label: 'Woche 4', from: 22, to: 28 },
  ];
  const STATUS = {
    durchzieher: 'Durchzieher',
    rennen: 'Im Rennen',
    joker: 'Joker nötig',
    raus: 'Raus',
  };
  const JOKER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne I, O, 0, 1
  const DAY_RE = /T[üu]e?rchen\s*(\d{1,2})\s*\/\s*30/i;

  function defaultSettings() {
    return {
      pageId: '220020558190688',
      apiVersion: 'v23.0',
      startDate: '2026-11-22',
      weeklyWinners: 2,
      weeklyBackups: 1,
      mainWinners: 1,
      mainBackups: 2,
      staff: [],
      blocked: [],
      asOf: '',
    };
  }

  function emptyState() {
    return {
      version: 1,
      settings: defaultSettings(),
      posts: [],
      comments: [],
      reactions: [],
      jokers: [],
      draws: {},
      lastFetch: null,
      fetchLog: [],
    };
  }

  /* ---------- Zeit (immer Europe/Berlin) ---------- */
  let fmt = null;
  function berlinFmt() {
    if (!fmt) {
      fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      });
    }
    return fmt;
  }
  function parseTime(v) {
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    const s = String(v || '').trim().replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : NaN;
  }
  function berlinParts(v) {
    const t = parseTime(v);
    if (!Number.isFinite(t)) return null;
    const p = {};
    for (const x of berlinFmt().formatToParts(new Date(t))) p[x.type] = x.value;
    const hour = p.hour === '24' ? '00' : p.hour;
    return { date: p.year + '-' + p.month + '-' + p.day, time: hour + ':' + p.minute };
  }
  function utcDay(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }
  function addDays(dateStr, n) {
    return new Date(utcDay(dateStr) + n * 864e5).toISOString().slice(0, 10);
  }
  function dayDate(settings, day) { return addDays(settings.startDate, day - 1); }
  function dayIndexOfDate(settings, dateStr) {
    return Math.round((utcDay(dateStr) - utcDay(settings.startDate)) / 864e5) + 1;
  }
  function berlinToUtcIso(dateStr, timeStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [h, mi] = String(timeStr || '12:00').split(':').map(Number);
    const target = Date.UTC(y, m - 1, d, h, mi);
    let guess = target;
    for (let i = 0; i < 3; i++) {
      const p = berlinParts(guess);
      const [py, pm, pd] = p.date.split('-').map(Number);
      const [ph, pmi] = p.time.split(':').map(Number);
      const diff = Date.UTC(py, pm - 1, pd, ph, pmi) - target;
      if (!diff) break;
      guess -= diff;
    }
    return new Date(guess).toISOString();
  }
  function fmtDateDe(dateStr) {
    const [y, m, d] = dateStr.split('-');
    const wd = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(utcDay(dateStr)).getUTCDay()];
    return wd + ' ' + d + '.' + m + '.';
  }

  /* ---------- Namen / Identität ---------- */
  function normName(s) {
    return String(s || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
  }
  function listMatch(list, id, name) {
    if (!list || !list.length) return false;
    const n = normName(name);
    return list.some((e) => {
      const x = normName(e);
      return x && (x === String(id).toLowerCase() || x === n);
    });
  }
  function isExcluded(settings, id, name) {
    if (!id) return false;
    if (String(id) === String(settings.pageId)) return true;
    return listMatch(settings.staff, id, name) || listMatch(settings.blocked, id, name);
  }

  /* ---------- Beiträge den Tagen zuordnen ---------- */
  function postDay(settings, post) {
    if (post.dayOverride != null && post.dayOverride !== '') {
      const o = Number(post.dayOverride);
      return o >= 1 && o <= DAYS ? o : null;
    }
    const m = DAY_RE.exec(post.message || '');
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= DAYS) return n;
    }
    const p = berlinParts(post.created_time);
    if (!p) return null;
    const idx = dayIndexOfDate(settings, p.date);
    return idx >= 1 && idx <= DAYS ? idx : null;
  }

  /* ---------- Heute ---------- */
  function today(settings, nowIso) {
    const now = settings.asOf ? berlinToUtcIso(settings.asOf, '12:00') : (nowIso || new Date().toISOString());
    const p = berlinParts(now);
    const idx = dayIndexOfDate(settings, p.date);
    let phase = 'läuft';
    let closedUpTo = idx - 1;
    let current = idx;
    if (idx < 1) { phase = 'vor'; closedUpTo = 0; current = 0; }
    else if (idx > DAYS) { phase = 'vorbei'; closedUpTo = DAYS; current = DAYS + 1; }
    return { date: p.date, time: p.time, dayIndex: idx, current, closedUpTo, phase };
  }

  /* ---------- Hauptauswertung ---------- */
  function compute(state, nowIso) {
    const s = Object.assign(defaultSettings(), state.settings || {});
    const t = today(s, nowIso);
    const warnings = [];
    const postsById = new Map();
    const days = [];
    for (let d = 1; d <= DAYS; d++) {
      days.push({ day: d, date: dayDate(s, d), posts: [], comments: [], onTime: 0, late: 0, likes: 0, likers: [], people: new Set() });
    }
    const unassigned = [];
    for (const p of state.posts || []) {
      const d = postDay(s, p);
      postsById.set(p.id, { post: p, day: d });
      if (d) days[d - 1].posts.push(p); else unassigned.push(p);
    }

    const persons = new Map();
    let anon = 0, excluded = new Set();
    function person(id, name) {
      let x = persons.get(id);
      if (!x) {
        x = { id, name: name || 'Unbekannt', comments: [], likesByDay: new Array(DAYS + 1).fill(0), likes: 0, onTimeDays: new Set() };
        persons.set(id, x);
      } else if (name && (!x.name || x.name === 'Unbekannt')) x.name = name;
      return x;
    }

    for (const c of state.comments || []) {
      let d = c.day != null ? Number(c.day) : null;
      if (c.postId) { const pp = postsById.get(c.postId); d = pp ? pp.day : null; }
      if (!d) continue;
      const dd = days[d - 1];
      if (!c.userId) { anon++; dd.comments.push(Object.assign({ anon: true }, c)); continue; }
      if (isExcluded(s, c.userId, c.name)) { excluded.add(c.userId); continue; }
      const bp = c.timeUnknown ? { date: dd.date, time: '' } : berlinParts(c.created_time);
      if (!bp) continue;
      const late = bp.date > dd.date;
      const entry = { id: c.id, day: d, text: c.message || '', time: bp.time, date: bp.date, late, source: c.source || 'meta', userId: c.userId, name: c.name };
      const per = person(c.userId, c.name);
      per.comments.push(entry);
      dd.comments.push(entry);
      if (late) dd.late++;
      else { dd.onTime += per.onTimeDays.has(d) ? 0 : 1; per.onTimeDays.add(d); }
      dd.people.add(c.userId);
    }

    for (const r of state.reactions || []) {
      let d = r.day != null ? Number(r.day) : null;
      if (r.postId) { const pp = postsById.get(r.postId); d = pp ? pp.day : null; }
      if (!d) continue;
      const dd = days[d - 1];
      dd.likes++;
      if (!r.userId) continue;
      if (isExcluded(s, r.userId, r.name)) { excluded.add(r.userId); continue; }
      dd.likers.push({ id: r.userId, name: r.name, type: r.type || 'LIKE' });
      const per = persons.get(r.userId);
      if (per) { per.likes++; per.likesByDay[d]++; }
      else {
        const x = person(r.userId, r.name);
        x.likes++; x.likesByDay[d]++;
      }
    }
    const named = (state.comments || []).filter((c) => c.userId).length;
    if (anon > 0 && anon >= named) {
      warnings.push({ kind: 'anon', text: 'Facebook liefert keine Namen – Zugriffsrechte (pages_read_engagement, pages_read_user_content) fehlen. ' + anon + ' Kommentar(e) ohne Namen zählen nicht.' });
    } else if (anon > 0) {
      warnings.push({ kind: 'anon-few', text: anon + ' Kommentar(e) ohne Namen (z. B. gelöschtes Profil) – zählen nicht.' });
    }

    const jokerByUser = new Map();
    for (const j of state.jokers || []) {
      if (j.used && j.userId) jokerByUser.set(j.userId, j);
    }
    const weeklyWinnerOf = new Map();
    for (const w of WEEKS) {
      const dr = (state.draws || {})[w.key];
      if (dr) for (const x of dr.winners || []) weeklyWinnerOf.set(x.id, w.key);
    }

    const list = [];
    for (const p of persons.values()) {
      if (!p.comments.length) continue; // nur Likes = kein Teilnehmer
      const joker = jokerByUser.get(p.id) || null;
      const jokerDay = joker ? Number(joker.day) : null;
      const done = new Array(DAYS + 1).fill(false);
      for (const d of p.onTimeDays) done[d] = true;
      const missed = [];
      for (let d = 1; d <= t.closedUpTo; d++) if (!done[d]) missed.push(d);
      const covered = jokerDay && missed.includes(jokerDay) ? jokerDay : null;
      const gaps = missed.filter((d) => d !== covered);
      const ful = done.slice();
      if (covered) ful[covered] = true;
      let fulfilled = 0;
      for (let d = 1; d <= DAYS; d++) if (ful[d]) fulfilled++;
      let status;
      if (gaps.length === 0) status = fulfilled === DAYS ? 'durchzieher' : 'rennen';
      else if (gaps.length === 1 && !covered) status = 'joker';
      else status = 'raus';
      // Serien
      let longest = 0, run = 0;
      for (let d = 1; d <= DAYS; d++) { if (ful[d]) { run++; if (run > longest) longest = run; } else run = 0; }
      let streak = 0;
      let startD = Math.min(t.current, DAYS);
      if (startD >= 1 && !ful[startD] && t.phase === 'läuft') startD--;
      for (let d = startD; d >= 1 && ful[d]; d--) streak++;
      const weeks = {};
      for (const w of WEEKS) {
        let all = true, anyClosedMiss = false, anyClosed = false;
        for (let d = w.from; d <= w.to; d++) {
          if (!ful[d]) all = false;
          if (d <= t.closedUpTo) { anyClosed = true; if (!ful[d]) anyClosedMiss = true; }
        }
        const closed = t.closedUpTo >= w.to;
        weeks[w.key] = closed ? (all ? 'voll' : 'verpasst') : anyClosedMiss ? 'verpasst' : anyClosed ? 'läuft' : 'offen';
      }
      const notes = [];
      if (jokerDay && !covered) notes.push('Joker steht auf Tag ' + jokerDay + ', der Tag ist erfüllt – Joker umbuchen.');
      list.push({
        id: p.id, name: p.name, status, statusLabel: STATUS[status],
        fulfilled, commentDays: p.onTimeDays.size, streak, longest,
        missed, gaps, joker: joker ? { code: joker.code, day: jokerDay, covers: !!covered } : null,
        likes: p.likes, likesByDay: p.likesByDay, done, ful,
        comments: p.comments.slice().sort((a, b) => a.day - b.day || a.time.localeCompare(b.time)),
        lateCount: p.comments.filter((c) => c.late).length,
        weeks, weeklyWin: weeklyWinnerOf.get(p.id) || null,
        activeToday: (t.phase === 'vorbei' ? done[DAYS] : t.current >= 1 && t.current <= DAYS && done[t.current]),
        notes,
      });
    }
    list.sort((a, b) => b.fulfilled - a.fulfilled || b.streak - a.streak || a.name.localeCompare(b.name, 'de'));
    const byId = new Map(list.map((x) => [x.id, x]));
    for (const dd of days) dd.peopleCount = dd.people.size;

    const counts = {
      participants: list.length,
      activeToday: list.filter((x) => x.activeToday).length,
      inRace: list.filter((x) => x.status === 'rennen' || x.status === 'durchzieher' || x.status === 'joker').length,
      out: list.filter((x) => x.status === 'raus').length,
      finishers: list.filter((x) => x.status === 'durchzieher').length,
      jokerNeeded: list.filter((x) => x.status === 'joker').length,
      comments: days.reduce((a, d) => a + d.comments.filter((c) => !c.anon).length, 0),
      likes: days.reduce((a, d) => a + d.likes, 0),
      excluded: excluded.size,
      anon,
    };
    const funnel = [
      { label: 'Mitgemacht', n: list.length },
      { label: '7+ Tage', n: list.filter((x) => x.fulfilled >= 7).length },
      { label: '14+ Tage', n: list.filter((x) => x.fulfilled >= 14).length },
      { label: '21+ Tage', n: list.filter((x) => x.fulfilled >= 21).length },
      { label: 'Durchzieher', n: counts.finishers },
    ];
    return { settings: s, today: t, days, unassigned, persons: list, byId, counts, funnel, warnings };
  }

  /* ---------- Auslosung ---------- */
  function weekPool(res, state, key) {
    const others = new Set();
    for (const w of WEEKS) {
      if (w.key === key) continue;
      const dr = (state.draws || {})[w.key];
      if (dr) for (const x of dr.winners || []) others.add(x.id);
    }
    return res.persons.filter((p) => p.weeks[key] === 'voll' && !others.has(p.id));
  }
  function mainPool(res) { return res.persons.filter((p) => p.status === 'durchzieher'); }
  function weekClosed(res, key) {
    const w = WEEKS.find((x) => x.key === key);
    return res.today.closedUpTo >= w.to;
  }
  function randomIndex(n, randU32) {
    const lim = Math.floor(0x100000000 / n) * n;
    let x;
    do { x = randU32() >>> 0; } while (x >= lim);
    return x % n;
  }
  function draw(pool, nWin, nBackup, randU32, meta) {
    const ids = pool.map((p) => ({ id: String(p.id), name: p.name })).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const arr = ids.slice();
    const take = Math.min(arr.length, nWin + nBackup);
    for (let i = 0; i < take; i++) {
      const j = i + randomIndex(arr.length - i, randU32);
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return Object.assign({
      time: new Date().toISOString(),
      poolSize: ids.length,
      poolHash: sha256(ids.map((x) => x.id).join('\n')),
      winners: arr.slice(0, Math.min(nWin, take)),
      backups: arr.slice(Math.min(nWin, take), take),
    }, meta || {});
  }
  function protocolText(state) {
    const lines = ['Durchzieher – Auslosungsprotokoll', 'Velocenter Hessert, Wörth am Rhein', ''];
    const keys = WEEKS.map((w) => w.key).concat(['MAIN']);
    for (const k of keys) {
      const d = (state.draws || {})[k];
      if (!d) continue;
      const p = berlinParts(d.time);
      lines.push((d.label || k) + ' – gezogen am ' + p.date + ' um ' + p.time + ' Uhr (Berlin)');
      lines.push('  Lostopf: ' + d.poolSize + ' Personen');
      lines.push('  SHA-256 der Teilnehmerliste: ' + d.poolHash);
      d.winners.forEach((w, i) => lines.push('  Gewinner ' + (i + 1) + ': ' + w.name + ' (ID ' + w.id + ')'));
      d.backups.forEach((w, i) => lines.push('  Nachrücker ' + (i + 1) + ': ' + w.name + ' (ID ' + w.id + ')'));
      if (d.redrawn) lines.push('  Hinweis: neu gezogen (' + d.redrawn + '. Ziehung)');
      lines.push('');
    }
    return lines.join('\n');
  }

  /* ---------- SHA-256 (reines JS, auch auf file://) ---------- */
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  function sha256(str) {
    const bytes = new TextEncoder().encode(str);
    const l = bytes.length;
    const total = ((l + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(total);
    buf.set(bytes);
    buf[l] = 0x80;
    const bits = l * 8;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 8, Math.floor(bits / 0x100000000));
    dv.setUint32(total - 4, bits >>> 0);
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const W = new Uint32Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
        const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const mj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + mj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    return Array.from(H, (x) => x.toString(16).padStart(8, '0')).join('');
  }

  /* ---------- Joker ---------- */
  function generateJokerCodes(n, randU32, existing) {
    const have = new Set((existing || []).map((j) => j.code));
    const out = [];
    let guard = 0;
    while (out.length < n && guard++ < n * 100) {
      let c = 'DZ-';
      for (let i = 0; i < 4; i++) c += JOKER_ALPHABET[randomIndex(JOKER_ALPHABET.length, randU32)];
      if (have.has(c)) continue;
      have.add(c);
      out.push({ code: c, used: false, userId: null, name: null, day: null, assignedAt: null });
    }
    return out;
  }
  function normCode(c) {
    let x = String(c || '').toUpperCase().replace(/\s+/g, '');
    if (/^[A-Z0-9]{4}$/.test(x)) x = 'DZ-' + x;
    if (/^DZ[A-Z0-9]{4}$/.test(x)) x = 'DZ-' + x.slice(2);
    return x;
  }
  function assignJoker(state, res, code, userId, day) {
    const c = normCode(code);
    const j = (state.jokers || []).find((x) => x.code === c);
    if (!j) return { ok: false, error: 'Code ' + c + ' gibt es nicht.' };
    if (j.used) return { ok: false, error: 'Code ' + c + ' ist schon benutzt (' + (j.name || j.userId) + ', Tag ' + j.day + ').' };
    const p = res.byId.get(userId);
    if (!p) return { ok: false, error: 'Person nicht gefunden.' };
    if (p.joker) return { ok: false, error: p.name + ' hat den Joker schon benutzt (' + p.joker.code + ').' };
    const d = Number(day);
    if (!(d >= 1 && d <= DAYS)) return { ok: false, error: 'Tag muss zwischen 1 und 30 liegen.' };
    if (p.done[d]) return { ok: false, error: 'Tag ' + d + ' hat ' + p.name + ' schon erfüllt.' };
    if (d > res.today.closedUpTo) return { ok: false, error: 'Tag ' + d + ' ist noch nicht vorbei.' };
    Object.assign(j, { used: true, userId, name: p.name, day: d, assignedAt: new Date().toISOString() });
    return { ok: true, joker: j };
  }
  function releaseJoker(state, code) {
    const j = (state.jokers || []).find((x) => x.code === normCode(code));
    if (!j) return false;
    Object.assign(j, { used: false, userId: null, name: null, day: null, assignedAt: null });
    return true;
  }

  /* ---------- Manueller Modus ---------- */
  function resolveId(state, name) {
    const n = normName(name);
    for (const c of state.comments || []) if (c.userId && normName(c.name) === n) return c.userId;
    for (const r of state.reactions || []) if (r.userId && normName(r.name) === n) return r.userId;
    return 'm:' + n;
  }
  function parseManualLines(text) {
    const rows = [], errors = [];
    String(text || '').split(/\r?\n/).forEach((line, i) => {
      if (!line.trim()) return;
      const parts = line.split('|').map((x) => x.trim());
      const name = parts[0];
      const msg = parts.length > 2 ? parts.slice(1, -1).join(' | ') : (parts[1] || '');
      let time = parts.length > 2 ? parts[parts.length - 1] : '';
      if (parts.length === 2 && /^\d{1,2}[:.]\d{2}$/.test(parts[1])) { time = parts[1]; }
      if (!name) { errors.push('Zeile ' + (i + 1) + ': Name fehlt.'); return; }
      if (time && !/^\d{1,2}[:.]\d{2}$/.test(time)) { errors.push('Zeile ' + (i + 1) + ': Uhrzeit „' + time + '“ unklar (Format HH:MM).'); return; }
      if (time) { const [h, m] = time.replace('.', ':').split(':'); time = h.padStart(2, '0') + ':' + m; }
      rows.push({ name, message: msg, time });
    });
    return { rows, errors };
  }
  function addManual(state, day, text, likesText) {
    const s = Object.assign(defaultSettings(), state.settings);
    const d = Number(day);
    const { rows, errors } = parseManualLines(text);
    let added = 0;
    const date = dayDate(s, d);
    for (const r of rows) {
      const userId = resolveId(state, r.name);
      state.comments.push({
        id: 'man-' + d + '-' + Date.now().toString(36) + '-' + (added++),
        day: d, postId: null, userId, name: r.name, message: r.message,
        created_time: berlinToUtcIso(date, r.time || '12:00'), timeUnknown: !r.time, source: 'manuell',
      });
    }
    let likes = 0;
    for (const line of String(likesText || '').split(/\r?\n/)) {
      const name = line.trim();
      if (!name) continue;
      state.reactions.push({ day: d, postId: null, userId: resolveId(state, name), name, type: 'LIKE', source: 'manuell' });
      likes++;
    }
    return { added, likes, errors };
  }

  /* ---------- Meta-Daten übernehmen ---------- */
  function mergeMeta(state, data) {
    const overrides = new Map((state.posts || []).filter((p) => p.dayOverride != null).map((p) => [p.id, p.dayOverride]));
    const manualPosts = (state.posts || []).filter((p) => p.source === 'manuell');
    state.posts = manualPosts.concat((data.posts || []).map((p) => Object.assign({}, p, { source: 'meta', dayOverride: overrides.has(p.id) ? overrides.get(p.id) : null })));
    state.comments = (state.comments || []).filter((c) => c.source === 'manuell').concat((data.comments || []).map((c) => Object.assign({ source: 'meta' }, c)));
    state.reactions = (state.reactions || []).filter((r) => r.source === 'manuell').concat((data.reactions || []).map((r) => Object.assign({ source: 'meta' }, r)));
    state.lastFetch = new Date().toISOString();
    return state;
  }

  /* ---------- Export ---------- */
  function exportJson(state) {
    const copy = JSON.parse(JSON.stringify(state));
    delete copy.token;
    if (copy.settings) delete copy.settings.token;
    return JSON.stringify(copy, null, 2);
  }
  function importJson(text) {
    const o = JSON.parse(text);
    if (!o || typeof o !== 'object' || !Array.isArray(o.comments)) throw new Error('Keine Durchzieher-Datei.');
    const st = emptyState();
    Object.assign(st, o);
    st.settings = Object.assign(defaultSettings(), o.settings || {});
    delete st.token; delete st.settings.token;
    for (const k of ['posts', 'comments', 'reactions', 'jokers']) if (!Array.isArray(st[k])) st[k] = [];
    if (!st.draws || typeof st.draws !== 'object') st.draws = {};
    return st;
  }
  function csvEscape(v) {
    const s = String(v == null ? '' : v);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function participantsCsv(res) {
    const head = ['Name', 'Facebook-ID', 'Status', 'Tage erfüllt', 'Serie in Folge', 'Längste Serie', 'Verpasste Tage', 'Joker-Code', 'Joker-Tag', 'Likes', 'Zu spät', 'W1', 'W2', 'W3', 'W4', 'Wochengewinn'];
    const rows = res.persons.map((p) => [p.name, p.id, p.statusLabel, p.fulfilled, p.streak, p.longest, p.missed.join(' '), p.joker ? p.joker.code : '', p.joker ? p.joker.day : '', p.likes, p.lateCount, p.weeks.W1, p.weeks.W2, p.weeks.W3, p.weeks.W4, p.weeklyWin || '']);
    return '﻿' + [head].concat(rows).map((r) => r.map(csvEscape).join(';')).join('\r\n');
  }

  /* ---------- Demo-Daten ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function demoState() {
    const r = mulberry32(20261122);
    const st = emptyState();
    st.settings.asOf = '2026-12-22';
    const s = st.settings;
    const first = ['Laura', 'Jonas', 'Sabine', 'Michael', 'Anja', 'Thomas', 'Petra', 'Markus', 'Julia', 'Stefan', 'Nicole', 'Andreas', 'Melanie', 'Daniel', 'Sandra', 'Christian', 'Katrin', 'Frank', 'Tanja', 'Uwe', 'Heike', 'Jürgen', 'Birgit', 'Sven', 'Claudia', 'Tobias', 'Monika', 'Florian', 'Silke', 'Dennis', 'Ute', 'Patrick', 'Kerstin', 'Marco', 'Ines', 'Bernd', 'Lena', 'Kai', 'Doris', 'Timo'];
    const last = 'ABCDEFGHKLMNPRSTWZ';
    const titles = ['Hör-Rätsel', 'Werkzeug-Rätsel', 'Was kostet dieser Fehler?', 'Vorher/Nachher', 'Werkstatt-Wahrheit', 'Bilderrätsel'];
    for (let d = 1; d <= DAYS; d++) {
      const date = dayDate(s, d);
      st.posts.push({ id: '220020558190688_' + (900000 + d), message: 'Türchen ' + d + '/30 – ' + titles[d % titles.length] + '\nHeute im Kommentar: deine Antwort bis 23:59 Uhr.', created_time: berlinToUtcIso(date, '07:00').replace('.000Z', '+0000'), permalink_url: 'https://www.facebook.com/velocenterhessert/posts/' + (900000 + d), source: 'meta', dayOverride: null });
    }
    const answers = ['Das Tretlager!', 'Ich tippe auf die Kassette', 'Kettenverschleiß', 'Bremsbeläge runter', 'Das ist der Freilauf', 'Speichenspannung', 'Ab in die Werkstatt damit 😄', 'Schaltauge verbogen', 'Lagerspiel im Steuersatz', 'Antwort B', 'Antwort C', 'Der Akku-Kontakt', 'Drehmomentschlüssel', 'Zentrierständer', 'Kettenlehre', 'Tag geschafft 💪'];
    const people = [];
    for (let i = 0; i < 118; i++) {
      const name = first[i % first.length] + ' ' + last[Math.floor(r() * last.length)] + '.';
      people.push({ id: String(10000000000000 + i * 7919), name, start: r() < 0.82 ? 1 : 2 + Math.floor(r() * 6), pMiss: r() < 0.55 ? 0.002 : 0.01 + r() * 0.08, liker: r() });
    }
    let cid = 1;
    for (const p of people) {
      let active = true;
      for (let d = p.start; d <= DAYS && active; d++) {
        const date = dayDate(s, d);
        const postId = st.posts[d - 1].id;
        if (r() < p.pMiss) { if (r() < 0.55) active = false; continue; }
        const lateC = r() < 0.025;
        const h = lateC ? Math.floor(r() * 3) : 7 + Math.floor(r() * 16);
        const m = Math.floor(r() * 60);
        const cdate = lateC ? addDays(date, 1) : date;
        st.comments.push({ id: 'c' + (cid++), postId, userId: p.id, name: p.name, message: answers[Math.floor(r() * answers.length)], created_time: berlinToUtcIso(cdate, String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0')) });
        if (r() < 0.35 + p.liker * 0.5) st.reactions.push({ postId, userId: p.id, name: p.name, type: r() < 0.85 ? 'LIKE' : 'LOVE' });
      }
    }
    for (let i = 0; i < 46; i++) {
      const id = String(20000000000000 + i * 104729);
      const name = first[(i * 7) % first.length] + ' ' + last[(i * 5) % last.length] + '.';
      for (let d = 1; d <= DAYS; d++) if (r() < 0.25) st.reactions.push({ postId: st.posts[d - 1].id, userId: id, name, type: 'LIKE' });
    }
    // anonymer Kommentar + eigene Seite (werden korrekt ignoriert)
    st.comments.push({ id: 'c' + (cid++), postId: st.posts[2].id, message: 'Super Aktion!', created_time: berlinToUtcIso(dayDate(s, 3), '10:00') });
    st.comments.push({ id: 'c' + (cid++), postId: st.posts[2].id, userId: s.pageId, name: 'Velocenter Hessert', message: 'Danke euch!', created_time: berlinToUtcIso(dayDate(s, 3), '10:05') });
    let seed = 7;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
    st.jokers = generateJokerCodes(100, rnd, []);
    st.lastFetch = berlinToUtcIso('2026-12-22', '08:30');
    // Joker: einigen Personen mit genau einer Lücke einen Joker geben
    const res = compute(st);
    let k = 0;
    for (const p of res.persons) {
      if (p.status === 'joker' && k < 6 && (k % 2 === 0 || p.gaps[0] > 5)) {
        assignJoker(st, res, st.jokers[k].code, p.id, p.gaps[0]);
        k++;
      }
    }
    return st;
  }

  return {
    DAYS, WEEKS, STATUS, JOKER_ALPHABET,
    defaultSettings, emptyState, berlinParts, berlinToUtcIso, addDays, dayDate, dayIndexOfDate, fmtDateDe,
    normName, isExcluded, postDay, today, compute,
    weekPool, mainPool, weekClosed, draw, randomIndex, protocolText, sha256,
    generateJokerCodes, normCode, assignJoker, releaseJoker,
    parseManualLines, addManual, resolveId, mergeMeta, exportJson, importJson, participantsCsv, demoState,
  };
});
