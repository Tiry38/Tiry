'use strict';
/**
 * Monkey-Test – wird IN der generierten App ausgeführt (Browser-Kontext).
 * Tippt zufällig auf alles Bedienbare, füllt Eingabefelder, wischt über Canvas-Spiele
 * und misst danach Layout-Probleme. Liefert einen Bericht zurück.
 */
function monkeyScript({ durationMs = 6000, maxActions = 90, seed = 1 } = {}) {
  return `(async () => {
  let s = ${Number(seed) >>> 0 || 1};
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const report = { actions: 0, interactive: 0, inputs: 0, canvas: 0, overflowX: false, textLength: 0, textLengthAfter: 0,
    tinyTapTargets: 0, offscreenInteractive: 0, caught: [], blankAfter: false, title: document.title || '',
    lang: document.documentElement.lang || '', hasViewport: !!document.querySelector('meta[name=viewport]'),
    usesGradient: false, fontSizeMin: 99, navigationBlocked: 0 };
  window.addEventListener('error', (e) => report.caught.push(String(e.message || e.error || 'Fehler')));
  window.addEventListener('unhandledrejection', (e) => report.caught.push('Unhandled Promise: ' + String((e.reason && e.reason.message) || e.reason)));
  window.alert = () => {}; window.confirm = () => true; window.prompt = () => '';
  document.addEventListener('click', (e) => {
    const a = e.target && e.target.closest && e.target.closest('a[href]');
    if (a && !a.getAttribute('href').startsWith('#')) { e.preventDefault(); report.navigationBlocked++; }
  }, true);
  const W = innerWidth, H = innerHeight;
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 && !el.disabled; };
  const sel = 'button, a[href], [role=button], [onclick], input, select, textarea, [data-action], [tabindex]:not([tabindex="-1"]), summary, label[for]';
  const candidates = () => [...document.querySelectorAll(sel)].filter(visible);
  await sleep(300);
  const first = candidates();
  report.interactive = first.length;
  report.inputs = first.filter((el) => /INPUT|SELECT|TEXTAREA/.test(el.tagName)).length;
  report.canvas = document.querySelectorAll('canvas').length;
  report.textLength = (document.body && document.body.innerText || '').trim().length;
  report.tinyTapTargets = first.filter((el) => { const r = el.getBoundingClientRect(); return el.tagName !== 'INPUT' && (r.width < 30 || r.height < 30); }).length;
  report.offscreenInteractive = first.filter((el) => { const r = el.getBoundingClientRect(); return r.right > W + 4 || r.left < -4; }).length;
  report.overflowX = document.documentElement.scrollWidth > W + 4;
  const bg = [document.body, document.documentElement, ...document.querySelectorAll('body *')].slice(0, 400);
  report.usesGradient = bg.some((el) => /gradient/.test(getComputedStyle(el).backgroundImage));
  for (const el of [...document.querySelectorAll('p, span, button, li, label, small, div')].slice(0, 300)) {
    if (!visible(el) || !el.textContent.trim() || el.children.length > 0) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize); if (fs && fs < report.fontSizeMin) report.fontSizeMin = fs;
  }
  const tap = (el, x, y) => {
    const o = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true };
    try { el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mousedown', o)); el.dispatchEvent(new MouseEvent('mouseup', o)); } catch (e) {}
    if (typeof el.click === 'function') el.click();
  };
  const words = ['Test', 'Morgenrunde', '42', 'Einkauf', '7', 'Training', '12.5'];
  const end = Date.now() + ${Number(durationMs) || 6000};
  while (Date.now() < end && report.actions < ${Number(maxActions) || 90}) {
    const els = candidates();
    const canvases = [...document.querySelectorAll('canvas')].filter(visible);
    if (canvases.length && rnd() < 0.35) {
      const c = canvases[Math.floor(rnd() * canvases.length)]; const r = c.getBoundingClientRect();
      tap(c, r.left + rnd() * r.width, r.top + rnd() * r.height);
    } else if (els.length) {
      const el = els[Math.floor(rnd() * els.length)]; const r = el.getBoundingClientRect();
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        const t = (el.type || 'text').toLowerCase();
        if (t === 'checkbox' || t === 'radio') el.click();
        else if (t === 'range') { el.value = String(Number(el.min || 0) + rnd() * (Number(el.max || 100) - Number(el.min || 0))); }
        else if (t === 'number') el.value = String(Math.floor(rnd() * 50) + 1);
        else if (t === 'date') el.value = new Date().toISOString().slice(0, 10);
        else if (t === 'time') el.value = '08:30';
        else if (t === 'color') el.value = '#7c3aed';
        else el.value = words[Math.floor(rnd() * words.length)];
        el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
        if (rnd() < 0.5) el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      } else if (el.tagName === 'SELECT') {
        if (el.options.length) { el.selectedIndex = Math.floor(rnd() * el.options.length); el.dispatchEvent(new Event('change', { bubbles: true })); }
      } else {
        tap(el, r.left + r.width / 2, r.top + r.height / 2);
      }
    } else {
      tap(document.elementFromPoint(W / 2, H / 2) || document.body, W / 2, H / 2);
    }
    report.actions++;
    await sleep(40 + Math.floor(rnd() * 70));
  }
  await sleep(400);
  report.textLengthAfter = (document.body && document.body.innerText || '').trim().length;
  report.blankAfter = !document.body || (report.textLengthAfter < 3 && document.querySelectorAll('canvas').length === 0);
  report.overflowX = report.overflowX || document.documentElement.scrollWidth > W + 4;
  return report;
})()`;
}

module.exports = { monkeyScript };
