'use strict';
/** Hilfen rund um generiertes HTML. */

/** Holt das vollständige HTML-Dokument aus einer KI-Antwort. */
function extractHtml(text) {
  if (!text) return null;
  let t = String(text);
  const fence = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence && /<html[\s>]/i.test(fence[1])) t = fence[1];
  const start = t.search(/<!doctype html/i) >= 0 ? t.search(/<!doctype html/i) : t.search(/<html[\s>]/i);
  const end = t.toLowerCase().lastIndexOf('</html>');
  if (start < 0 || end < 0 || end < start) return null;
  return t.slice(start, end + 7).trim();
}

/** Grobe Größe in Tokens (für Kostenschätzungen in der Oberfläche). */
function approxTokens(s) {
  return Math.ceil(String(s || '').length / 3.6);
}

module.exports = { extractHtml, approxTokens };
