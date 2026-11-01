/*
 * Browser-Brücke für die Oberfläche außerhalb von Electron.
 * In der Desktop-App existiert window.forge bereits (preload.js) – dann passiert hier nichts.
 * Im Browser/Test-Harness kann eine Funktion window.__forgeBridge(action, args) bereitgestellt werden
 * (z. B. per Playwright exposeFunction); Ereignisse kommen über window.__forgeEmit(event) herein.
 */
(function () {
  'use strict';
  if (window.forge) return;
  var listeners = [];
  window.__forgeEmit = function (ev) {
    listeners.slice().forEach(function (fn) {
      try { fn(ev); } catch (e) { console.error(e); }
    });
  };
  window.forge = {
    platform: 'web',
    invoke: function (action, args) {
      if (typeof window.__forgeBridge === 'function') {
        return Promise.resolve(window.__forgeBridge(String(action), args || {})).then(function (r) {
          if (r && r.__error) throw new Error(r.__error);
          return r;
        });
      }
      return Promise.reject(new Error('Kein Hub verbunden – bitte die Desktop-App starten.'));
    },
    on: function (fn) {
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
    }
  };
})();
