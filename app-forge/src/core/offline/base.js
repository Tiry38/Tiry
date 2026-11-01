'use strict';
/**
 * Premium-UI-Kit für die Offline-Vorlagen: Aurora-Verläufe, Glas-Karten,
 * Verlaufs-Buttons, Bottom-Navigation, Sheets, Toasts, Fortschrittsringe.
 * Farben kommen ausschließlich aus den Palette-Variablen (design.cssTokens).
 */
const { cssTokens } = require('../design');
const { PWA_HEAD, PWA_REGISTER } = require('../pwa');

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>',
  pause: '<path d="M7 4h4v16H7zM13 4h4v16h-4z" fill="currentColor"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
  skip: '<path d="M5 4l10 8-10 8zM19 5v14"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  flame: '<path d="M12 22c4.4 0 7-2.9 7-6.6 0-3.3-2.2-5.5-3.6-7.6-.6 1.8-1.7 2.9-2.9 3.3.3-3-1-6.2-3.5-8.1.2 3.1-1.6 5.3-3.2 7.4C4.5 12.2 5 13.6 5 15.4 5 19.1 7.6 22 12 22z"/>',
  drop: '<path d="M12 2.7s7 7.5 7 12.3a7 7 0 0 1-14 0C5 10.2 12 2.7 12 2.7z"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><circle cx="16" cy="14.5" r="1.2" fill="currentColor"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>'
};

function icon(name, size = 22) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent;overflow-x:hidden}
html,body{scrollbar-width:none}::-webkit-scrollbar{display:none}
body{min-height:100vh;min-height:100dvh;font-family:"Segoe UI Variable Display","Segoe UI Variable","SF Pro Display","Segoe UI",Inter,system-ui,-apple-system,Roboto,sans-serif;color:var(--text);background:var(--bg1);line-height:1.45;overflow-x:hidden;-webkit-font-smoothing:antialiased;font-size:16px}
body::before{content:"";position:fixed;inset:-18%;z-index:-2;pointer-events:none;background:
 radial-gradient(38% 30% at 16% 10%,var(--glow-soft),transparent 70%),
 radial-gradient(36% 30% at 90% 24%,var(--a2-soft),transparent 72%),
 radial-gradient(48% 40% at 50% 104%,var(--a1-soft),transparent 70%),
 linear-gradient(160deg,var(--bg1),var(--bg2) 55%,var(--bg3));animation:drift 24s ease-in-out infinite alternate}
@keyframes drift{to{transform:translate3d(-3%,2%,0) scale(1.06)}}
button{font:inherit;color:inherit}
.app{max-width:480px;margin:0 auto;overflow-x:clip;padding:calc(env(safe-area-inset-top) + 22px) 18px calc(env(safe-area-inset-bottom) + 120px)}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px}
.eyebrow{font-size:13px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}
.h1{font-size:30px;font-weight:800;letter-spacing:-.025em;line-height:1.08}
.h2{font-size:19px;font-weight:750;letter-spacing:-.01em}
.grad-text{background:var(--grad-flow);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:flow 9s ease-in-out infinite}
@keyframes flow{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
.grad-edge{position:relative}
.grad-edge::before,.pill::before,.bubble::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1.2px;background:linear-gradient(130deg,var(--a1-soft),transparent 40%,transparent 60%,var(--a2-soft));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
.card{position:relative;background:var(--surface);border:1px solid var(--border);border-radius:calc(var(--radius) + 10px);padding:20px;backdrop-filter:blur(var(--blur)) saturate(150%);-webkit-backdrop-filter:blur(var(--blur)) saturate(150%);box-shadow:0 26px 50px -28px var(--shadow),inset 0 1px 0 rgba(255,255,255,.07);animation:rise .55s cubic-bezier(.2,.8,.2,1) both}
.card+.card,.stack>*+*{margin-top:16px}
@keyframes rise{from{opacity:0;transform:translateY(12px)}}
/* Fließende, organische Komposition statt Kasten-Stapel */
.flow{position:relative;margin-top:26px;animation:rise .55s cubic-bezier(.2,.8,.2,1) both}
.section-title{display:flex;align-items:center;gap:10px;font-size:19px;font-weight:780;letter-spacing:-.01em;margin:0 4px 14px}
.section-title::before{content:"";width:10px;height:10px;border-radius:50%;background:var(--grad);box-shadow:0 0 14px var(--glow-soft)}
.section-title .muted{margin-left:auto;font-size:13px;font-weight:600}
.hero-flow{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:26px 0 8px;min-height:250px;isolation:isolate}
.blob{position:absolute;z-index:-1;width:300px;height:300px;left:50%;top:50%;margin:-150px 0 0 -150px;background:conic-gradient(from 200deg,var(--a1),var(--glow),var(--a2),var(--a1));opacity:.28;filter:blur(6px);border-radius:42% 58% 63% 37% / 41% 44% 56% 59%;animation:morph 16s ease-in-out infinite}
.blob.b2{width:200px;height:200px;margin:-40px 0 0 -40px;background:radial-gradient(circle at 30% 30%,var(--glow),transparent 70%);opacity:.35;animation-duration:21s;animation-direction:reverse}
@keyframes morph{0%,100%{border-radius:42% 58% 63% 37% / 41% 44% 56% 59%;transform:rotate(0) scale(1)}33%{border-radius:58% 42% 35% 65% / 55% 38% 62% 45%;transform:rotate(40deg) scale(1.06)}66%{border-radius:36% 64% 52% 48% / 62% 52% 48% 38%;transform:rotate(-20deg) scale(.96)}}
.wave{display:block;width:calc(100% + 36px);height:46px;margin:6px -18px 0;color:var(--surface)}
.pill{position:relative;display:flex;align-items:center;gap:14px;padding:10px 12px 10px 10px;border-radius:999px;background:var(--surface);border:1px solid var(--border);backdrop-filter:blur(var(--blur)) saturate(150%);-webkit-backdrop-filter:blur(var(--blur)) saturate(150%);box-shadow:0 18px 34px -24px var(--shadow);transition:transform .25s cubic-bezier(.2,.8,.2,1),background .35s}
.pill+.pill{margin-top:12px}
.pill:active{transform:scale(.985)}
.orb-icon{width:52px;height:52px;flex:none;border-radius:50%;display:grid;place-items:center;font-size:24px;background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.35),transparent 60%),var(--surface-strong);box-shadow:inset 0 0 0 1px var(--border)}
.bubbles{display:flex;justify-content:center;align-items:flex-end;gap:12px;margin:8px 0 4px}
.bubble{position:relative;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.22),transparent 60%),var(--surface);border:1px solid var(--border);backdrop-filter:blur(var(--blur));-webkit-backdrop-filter:blur(var(--blur));box-shadow:0 20px 40px -24px var(--shadow);animation:float 7s ease-in-out infinite}
.bubble b{font-size:24px;font-weight:820;font-variant-numeric:tabular-nums;letter-spacing:-.03em;line-height:1}
.bubble span{font-size:12px;color:var(--muted);font-weight:650;margin-top:4px;padding:0 8px}
.bubble.lg{width:124px;height:124px}.bubble.md{width:104px;height:104px;animation-delay:-2s;margin-bottom:22px}.bubble.sm{width:92px;height:92px;animation-delay:-4s}
.bubble.accent{background:var(--grad-3);color:var(--on-accent);border-color:transparent;box-shadow:0 22px 44px -20px var(--a1-soft)}
.bubble.accent span{color:var(--on-accent);opacity:.85}
@keyframes float{50%{transform:translateY(-8px)}}
.btn{appearance:none;border:0;font-weight:750;font-size:16px;min-height:52px;padding:0 24px;border-radius:999px;background:var(--grad-flow);background-size:250% 100%;animation:flow 10s ease-in-out infinite;color:var(--on-accent);box-shadow:0 14px 30px -12px var(--a1-soft),inset 0 1px 0 rgba(255,255,255,.25);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:transform .16s ease,box-shadow .2s ease,filter .2s;user-select:none}
.btn:hover{filter:brightness(1.07)}.btn:active{transform:scale(.965)}
.btn.ghost{background:var(--surface-strong);color:var(--text);box-shadow:none;border:1px solid var(--border);animation:none}
.btn.block{width:100%}.btn.sm{min-height:46px;font-size:15px;padding:0 18px}
.icon-btn{width:48px;height:48px;flex:none;border-radius:50%;border:1px solid var(--border);background:var(--surface-strong);color:var(--text);display:grid;place-items:center;cursor:pointer;transition:transform .15s,background .2s}
.icon-btn:active{transform:scale(.93)}
.chip{min-height:44px;padding:0 16px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-weight:650;font-size:14px;cursor:pointer;transition:all .22s cubic-bezier(.2,.8,.2,1);white-space:nowrap}
.chip.on{background:var(--grad-3);color:var(--on-accent);border-color:transparent;box-shadow:0 10px 22px -12px var(--a1-soft)}
.row{display:flex;gap:10px;align-items:center}.wrap{flex-wrap:wrap}.between{justify-content:space-between}.grow{flex:1;min-width:0}
.muted{color:var(--muted)}.small{font-size:13px}.center{text-align:center}
.input{width:100%;min-height:54px;border-radius:999px;border:1px solid var(--border);background:var(--surface-strong);color:var(--text);font:inherit;font-size:16px;padding:0 20px;outline:none;transition:border-color .2s,box-shadow .2s}
.input::placeholder{color:var(--muted);opacity:.8}
.input:focus{border-color:var(--a1);box-shadow:0 0 0 4px var(--a1-soft)}
.label{display:block;font-size:13px;font-weight:650;color:var(--muted);margin:14px 0 8px 4px}
.stat{font-size:30px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.03em;line-height:1.1}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:10px 18px;backdrop-filter:blur(var(--blur));-webkit-backdrop-filter:blur(var(--blur));text-align:center}
.kpi b{display:block;font-size:20px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.kpi span{font-size:12px;color:var(--muted);font-weight:600}
.bar{height:12px;border-radius:99px;background:var(--surface-strong);overflow:hidden;border:1px solid var(--border)}
.bar>i{display:block;height:100%;border-radius:99px;background:var(--grad-3);box-shadow:0 0 18px var(--a1-soft);transition:width .8s cubic-bezier(.2,.8,.2,1)}
.bars{display:flex;align-items:flex-end;gap:8px;height:120px;padding-top:8px}
.bars>div{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end}
.bars>div>i{display:block;width:100%;max-width:26px;border-radius:99px;background:linear-gradient(180deg,var(--a2),var(--glow) 55%,var(--a1));opacity:.92;min-height:4px;transition:height .8s cubic-bezier(.2,.8,.2,1);box-shadow:0 8px 18px -10px var(--a1-soft)}
.bars>div>i.dim{opacity:.32}
.bars small{font-size:12px;color:var(--muted);font-weight:600}
.tabbar{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom) + 14px);width:min(452px,calc(100% - 28px));display:flex;gap:6px;padding:6px;border-radius:26px;background:var(--surface-strong);border:1px solid var(--border);backdrop-filter:blur(24px) saturate(170%);-webkit-backdrop-filter:blur(24px) saturate(170%);box-shadow:0 22px 44px -18px var(--shadow);z-index:20}
.tab{flex:1;min-height:54px;border:0;border-radius:20px;background:transparent;color:var(--muted);font-size:12px;font-weight:700;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;transition:all .25s cubic-bezier(.2,.8,.2,1)}
.tab.on{background:var(--grad-3);color:var(--on-accent);box-shadow:0 12px 24px -14px var(--a1-soft)}
.view{display:none}.view.on{display:block;animation:fade .38s cubic-bezier(.2,.8,.2,1) both}
@keyframes fade{from{opacity:0;transform:translateY(8px)}}
.toast{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 100px);transform:translate(-50%,24px);opacity:0;pointer-events:none;background:var(--surface-strong);color:var(--text);border:1px solid var(--border);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);padding:13px 20px;border-radius:18px;font-weight:650;font-size:14px;box-shadow:0 18px 34px -16px var(--shadow);transition:all .32s cubic-bezier(.2,.8,.2,1);z-index:60;max-width:calc(100% - 40px);text-align:center}
.toast.on{opacity:1;transform:translate(-50%,0)}
.sheet-bg{position:fixed;inset:0;background:rgba(0,0,0,.42);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);opacity:0;pointer-events:none;transition:opacity .28s;z-index:50}
.sheet-bg.on{opacity:1;pointer-events:auto}
.sheet{position:fixed;left:50%;bottom:0;transform:translate(-50%,108%);width:min(480px,100%);background:linear-gradient(180deg,var(--bg2),var(--bg1));border:1px solid var(--border);border-bottom:0;border-radius:40px 40px 0 0;padding:10px 20px calc(env(safe-area-inset-bottom) + 24px);transition:transform .38s cubic-bezier(.2,.8,.2,1);z-index:51;max-height:88vh;overflow:auto;box-shadow:0 -20px 50px -20px var(--shadow)}
.sheet.on{transform:translate(-50%,0)}
.grab{width:44px;height:5px;border-radius:9px;background:var(--border);margin:4px auto 16px}
.sheet h3{font-size:21px;font-weight:800;letter-spacing:-.01em;margin-bottom:4px}
.empty{text-align:center;padding:26px 10px 12px}
.empty .orb{width:92px;height:92px;margin:0 auto 14px;border-radius:42% 58% 63% 37% / 41% 44% 56% 59%;display:grid;place-items:center;background:var(--grad);color:var(--on-accent);box-shadow:0 20px 40px -18px var(--a1-soft);animation:morph 12s ease-in-out infinite}
.list>*{animation:rise .45s cubic-bezier(.2,.8,.2,1) both}
.ring-wrap{position:relative;display:grid;place-items:center}
.ring-wrap .ring-label{position:absolute;inset:0;display:grid;place-items:center;text-align:center}
.ring circle{transition:stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)}
.pop{animation:pop .45s cubic-bezier(.3,1.6,.5,1)}
@keyframes pop{40%{transform:scale(1.12)}}
:focus-visible{outline:2px solid var(--a2);outline-offset:3px}
@media (min-width:600px){.app{padding-top:40px}}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
`;

function baseJs(appId) {
  return `
var APP_ID = ${JSON.stringify(appId)};
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var store = {
  get: function (k, d) { try { var v = localStorage.getItem(APP_ID + ':' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem(APP_ID + ':' + k, JSON.stringify(v)); } catch (e) {} }
};
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function pad(n) { return String(n).padStart(2, '0'); }
function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
var WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
function num(v, min, max, def) { var n = Number(String(v == null ? '' : v).replace(',', '.').trim()); if (!isFinite(n) || String(v).trim() === '') return def; return Math.min(max, Math.max(min, n)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function haptic(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 12); } catch (e) {} }
var toastTimer = null;
function toast(msg) { var t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2300); }
function openSheet(html, onMount) { var b = $('#sheet-body'); b.innerHTML = '<div class="grab"></div>' + html; $('#sheet').classList.add('on'); $('#sheet-bg').classList.add('on'); if (onMount) onMount(b); }
function closeSheet() { $('#sheet').classList.remove('on'); $('#sheet-bg').classList.remove('on'); }
function confirmSheet(title, text, okLabel, onOk) {
  openSheet('<h3>' + esc(title) + '</h3><p class="muted">' + esc(text) + '</p><div class="row" style="margin-top:22px"><button class="btn ghost sm grow" data-close>Abbrechen</button><button class="btn sm grow" data-ok>' + esc(okLabel) + '</button></div>', function (b) {
    b.querySelector('[data-ok]').addEventListener('click', function () { closeSheet(); onOk(); });
  });
}
document.addEventListener('click', function (e) { if ((e.target.closest && e.target.closest('[data-close]')) || e.target.id === 'sheet-bg') closeSheet(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
var ringSeq = 0;
function ring(pct, size, stroke, inner) {
  var id = 'rg' + (++ringSeq); var r = (size - stroke) / 2; var c = 2 * Math.PI * r; var p = Math.max(0, Math.min(1, pct || 0));
  return '<div class="ring-wrap" style="width:' + size + 'px;height:' + size + 'px"><svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
    '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--a1)"/><stop offset=".5" style="stop-color:var(--glow)"/><stop offset="1" style="stop-color:var(--a2)"/></linearGradient></defs>' +
    '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" style="stroke:var(--border)" stroke-width="' + stroke + '"/>' +
    '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="url(#' + id + ')" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + c * (1 - p) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
    '</svg><div class="ring-label">' + (inner || '') + '</div></div>';
}
function wave() { return '<svg class="wave" viewBox="0 0 400 46" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30 C 70 6, 140 46, 210 24 S 340 4, 400 22 L 400 46 L 0 46 Z" fill="currentColor"/></svg>'; }
function setupTabs(onChange) {
  $$('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      var v = t.getAttribute('data-view'); if (!v) return;
      $$('.tab').forEach(function (x) { x.classList.toggle('on', x === t); x.setAttribute('aria-selected', x === t ? 'true' : 'false'); });
      $$('.view').forEach(function (x) { x.classList.toggle('on', x.id === v); });
      haptic(8); if (onChange) onChange(v);
    });
  });
}
`;
}

function page({ appId, lang = 'de', title, description = '', palette, style, css = '', body, script = '' }) {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="${palette.bg[1]}">
<meta name="description" content="${String(description).replace(/"/g, '&quot;')}">
<title>${title}</title>
${PWA_HEAD}
<style>
${cssTokens(palette, style)}
${BASE_CSS}
${css}
</style>
</head>
<body>
<main class="app">
${body}
</main>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<div class="sheet-bg" id="sheet-bg"></div>
<div class="sheet" id="sheet" role="dialog" aria-modal="true"><div id="sheet-body"></div></div>
<script>
(function () {
'use strict';
${baseJs(appId)}
${script}
${PWA_REGISTER}
})();
</script>
</body>
</html>`;
}

module.exports = { page, icon, ICONS, BASE_CSS };
