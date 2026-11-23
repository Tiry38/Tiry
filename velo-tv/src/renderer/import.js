/* Velo-TV – Dateien für den Fernseher aufbereiten und zur Zentrale hochladen.
   Bilder → max. 2560×1440 JPEG (TV-Browser bleibt flott), PDF/PowerPoint → eine Folie je Seite,
   Videos → unverändert + Vorschaubild. */

const MAX_W = 2560, MAX_H = 1440;
const BILD = /\.(jpe?g|png|webp|bmp|gif|heic|heif|avif|tiff?)$/i;
const VIDEO = /\.(mp4|m4v|webm|mov|mkv)$/i;
const PDF = /\.pdf$/i;
const PPT = /\.(pptx?|ppsx?|odp)$/i;

export function art(file) {
  const n = file.name || '';
  if (PDF.test(n) || file.type === 'application/pdf') return 'pdf';
  if (PPT.test(n)) return 'ppt';
  if (VIDEO.test(n) || (file.type || '').startsWith('video/')) return 'video';
  if (BILD.test(n) || (file.type || '').startsWith('image/')) return 'image';
  return null;
}

function canvasZuJpeg(canvas, q) {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Bild konnte nicht umgewandelt werden'))), 'image/jpeg', q || 0.88));
}

export async function bildVerkleinern(file) {
  if (/\.gif$/i.test(file.name)) return file; // animierte GIFs unverändert
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) { throw new Error('Bildformat wird nicht unterstützt (bitte JPG oder PNG)'); }
  const f = Math.min(1, MAX_W / bmp.width, MAX_H / bmp.height);
  const w = Math.round(bmp.width * f), h = Math.round(bmp.height * f);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); // Transparenz → schwarz
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close && bmp.close();
  return canvasZuJpeg(c, 0.88);
}

export function videoInfo(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true; v.preload = 'auto'; v.src = url;
    let fertig = false;
    const ende = (x) => { if (fertig) return; fertig = true; URL.revokeObjectURL(url); resolve(x); };
    setTimeout(() => ende({ duration: null, thumb: null, playable: false }), 15000);
    v.onerror = () => ende({ duration: null, thumb: null, playable: false });
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 3); };
    v.onseeked = async () => {
      try {
        const c = document.createElement('canvas');
        const f = Math.min(1, 640 / (v.videoWidth || 640));
        c.width = Math.round((v.videoWidth || 640) * f); c.height = Math.round((v.videoHeight || 360) * f);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        ende({ duration: v.duration, thumb: await canvasZuJpeg(c, 0.8), playable: true, width: v.videoWidth, height: v.videoHeight });
      } catch (e) { ende({ duration: v.duration, thumb: null, playable: true }); }
    };
  });
}

let pdfjs = null;
async function ladePdfJs() {
  if (pdfjs) return pdfjs;
  pdfjs = await import('../../node_modules/pdfjs-dist/build/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  return pdfjs;
}

/** PDF (ArrayBuffer) → Liste von JPEG-Blobs, je Seite eine Folie */
export async function pdfSeiten(daten, fortschritt) {
  const lib = await ladePdfJs();
  const doc = await lib.getDocument({ data: daten, isEvalSupported: false }).promise;
  const seiten = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const seite = await doc.getPage(i);
    const v1 = seite.getViewport({ scale: 1 });
    const scale = Math.min(MAX_W / v1.width, MAX_H / v1.height);
    const vp = seite.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await seite.render({ canvasContext: ctx, viewport: vp }).promise;
    seiten.push(await canvasZuJpeg(c, 0.9));
    seite.cleanup();
    fortschritt && fortschritt(i, doc.numPages);
  }
  await doc.destroy();
  return seiten;
}

/** Hochladen mit Fortschritt (XHR, weil fetch keinen Upload-Fortschritt kennt) */
export function hochladen(url, headers, body, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    for (const [k, v] of Object.entries(headers)) x.setRequestHeader(k, v);
    x.setRequestHeader('Content-Type', 'application/octet-stream');
    x.upload.onprogress = (e) => e.lengthComputable && onProgress && onProgress(e.loaded / e.total);
    x.onload = () => {
      let d = {}; try { d = JSON.parse(x.responseText); } catch (e) { /* leer */ }
      if (x.status >= 200 && x.status < 300) resolve(d); else reject(new Error(d.error || 'Hochladen fehlgeschlagen (' + x.status + ')'));
    };
    x.onerror = () => reject(new Error('Zentrale nicht erreichbar'));
    x.send(body);
  });
}
