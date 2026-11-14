/* Durchzieher-Zentrale – Abruf von Facebook (Graph API, nur lesen).
 * Der Token wird nie geloggt oder in Fehlermeldungen ausgegeben. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DZMeta = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HOST = 'https://graph.facebook.com/';
  const MAX_PAGES = 200;

  class MetaError extends Error {
    constructor(message, code, kind) { super(message); this.name = 'MetaError'; this.code = code; this.kind = kind; }
  }

  function germanError(err) {
    const code = Number(err && err.code);
    const sub = Number(err && err.error_subcode);
    if (code === 190) return new MetaError('Der Zugangsschlüssel (Token) ist abgelaufen oder ungültig. Bitte in den Einstellungen einen neuen Token eintragen.', code, 'token');
    if (code === 10 || (code >= 200 && code <= 299)) return new MetaError('Facebook verweigert den Zugriff: Rechte fehlen (pages_read_engagement, pages_read_user_content). Token mit diesen Rechten neu erstellen.', code, 'rechte');
    if (code === 4 || code === 17 || code === 32 || code === 613) return new MetaError('Zu viele Abfragen bei Facebook. Ein paar Minuten warten und erneut abrufen.', code, 'limit');
    if (code === 100) return new MetaError('Facebook kennt die Anfrage nicht (Seiten-ID oder API-Version prüfen).', code, 'anfrage');
    return new MetaError('Facebook meldet einen Fehler' + (code ? ' (Code ' + code + (sub ? '/' + sub : '') + ')' : '') + '. Später erneut versuchen.', code || 0, 'sonst');
  }

  function stripToken(url) { return String(url).replace(/access_token=[^&]*/g, 'access_token=***'); }

  function createClient(opts) {
    const fetchFn = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    const token = String(opts.token || '').trim();
    const version = String(opts.version || 'v23.0').replace(/^\/+|\/+$/g, '');
    if (!fetchFn) throw new MetaError('Kein Netzwerkzugriff verfügbar.', 0, 'netz');
    if (!token) throw new MetaError('Kein Token eingetragen. Einstellungen → Facebook-Token.', 0, 'token');

    function url(path, params) {
      const q = new URLSearchParams(Object.assign({}, params, { access_token: token }));
      return HOST + version + '/' + path.replace(/^\/+/, '') + '?' + q.toString();
    }

    async function getJson(u) {
      let res;
      try { res = await fetchFn(u, { method: 'GET', credentials: 'omit', cache: 'no-store' }); }
      catch (e) { throw new MetaError('Keine Verbindung zu Facebook. Internet prüfen.', 0, 'netz'); }
      let body;
      try { body = await res.json(); } catch (e) { throw new MetaError('Facebook hat unlesbare Daten geschickt (HTTP ' + res.status + ').', res.status, 'sonst'); }
      if (body && body.error) throw germanError(body.error);
      if (!res.ok) throw new MetaError('Facebook antwortet mit HTTP ' + res.status + '.', res.status, 'sonst');
      return body;
    }

    async function getAll(path, params, onPage) {
      const out = [];
      let next = url(path, params);
      let pages = 0;
      while (next && pages < MAX_PAGES) {
        const body = await getJson(next);
        pages++;
        for (const x of body.data || []) out.push(x);
        if (onPage) onPage(out.length);
        next = body.paging && body.paging.next ? body.paging.next : null;
      }
      return out;
    }

    return { url: (p, q) => stripToken(url(p, q)), getJson, getAll };
  }

  /* Alles für den Zeitraum holen: Beiträge, Kommentare (oberste Ebene), Reaktionen. */
  async function fetchAll(opts) {
    const s = opts.settings;
    const E = opts.engine;
    const log = opts.onProgress || function () {};
    const client = createClient({ fetch: opts.fetch, token: opts.token, version: s.apiVersion });
    const startIso = E.berlinToUtcIso(E.addDays(s.startDate, -1), '00:00');
    const endIso = E.berlinToUtcIso(E.addDays(s.startDate, E.DAYS + 1), '23:59');
    const since = Math.floor(Date.parse(startIso) / 1000);
    const until = Math.floor(Date.parse(endIso) / 1000);

    log('Beiträge werden geladen …');
    const rawPosts = await client.getAll(s.pageId + '/posts', { fields: 'id,message,created_time,permalink_url', since, until, limit: 100 });
    const posts = rawPosts.map((p) => ({ id: p.id, message: p.message || '', created_time: p.created_time, permalink_url: p.permalink_url || '' }))
      .filter((p) => E.postDay(s, p) != null);
    const comments = [];
    const reactions = [];
    let noFrom = 0, total = 0, reactNoName = 0;
    let i = 0;
    for (const p of posts) {
      i++;
      log('Beitrag ' + i + ' von ' + posts.length + ': Kommentare …');
      const cs = await client.getAll(p.id + '/comments', { fields: 'id,message,created_time,from{id,name}', filter: 'toplevel', order: 'chronological', limit: 100 });
      for (const c of cs) {
        total++;
        if (!c.from || !c.from.id) noFrom++;
        comments.push({ id: c.id, postId: p.id, userId: c.from && c.from.id ? String(c.from.id) : null, name: c.from && c.from.name ? c.from.name : null, message: c.message || '', created_time: c.created_time });
      }
      log('Beitrag ' + i + ' von ' + posts.length + ': Likes …');
      const rs = await client.getAll(p.id + '/reactions', { fields: 'id,name,type', limit: 100 });
      for (const r of rs) {
        if (!r.id) reactNoName++;
        reactions.push({ postId: p.id, userId: r.id ? String(r.id) : null, name: r.name || null, type: r.type || 'LIKE' });
      }
    }
    const warnings = [];
    if (total > 0 && noFrom === total) warnings.push('Facebook liefert keine Namen – Zugriffsrechte (pages_read_engagement, pages_read_user_content) fehlen. Kommentare ohne Namen zählen nicht.');
    else if (noFrom > 0) warnings.push(noFrom + ' Kommentar(e) ohne Namen – zählen nicht.');
    if (reactNoName > 0) warnings.push(reactNoName + ' Like(s) ohne Namen – nur in der Summe gezählt.');
    if (!posts.length) warnings.push('Keine Türchen-Beiträge im Zeitraum gefunden.');
    return { posts, comments, reactions, warnings, stats: { posts: posts.length, comments: comments.length, reactions: reactions.length } };
  }

  return { MetaError, germanError, createClient, fetchAll, stripToken };
});
