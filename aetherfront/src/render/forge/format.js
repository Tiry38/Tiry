// Aether-Forge – kompaktes Binärformat (.afm): 'AFM1' | u32 JSON-Länge | JSON-Kopf | Puffer (4-Byte-ausgerichtet).
// Kopf: { ..., buffers: [{ name, type, offset, count }] } – Puffer sind typisierte Arrays (Positionen, Indizes, …).
const TYPES = { Float32Array, Uint32Array, Uint16Array, Uint8Array, Int16Array, Int8Array };

export function encodeAFM(header, buffers) {
  const list = [];
  let off = 0;
  for (const [name, arr] of Object.entries(buffers)) {
    const type = arr.constructor.name;
    if (!TYPES[type]) throw new Error('AFM: Typ nicht unterstützt ' + type);
    list.push({ name, type, offset: off, count: arr.length });
    off += Math.ceil(arr.byteLength / 4) * 4;
  }
  const json = new TextEncoder().encode(JSON.stringify({ ...header, buffers: list }));
  const jl = Math.ceil(json.length / 4) * 4;
  const out = new Uint8Array(8 + jl + off);
  out.set([65, 70, 77, 49], 0);
  new DataView(out.buffer).setUint32(4, jl, true);
  out.set(json, 8);
  for (let i = json.length; i < jl; i++) out[8 + i] = 32;
  let p = 8 + jl;
  for (const arr of Object.values(buffers)) {
    out.set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), p);
    p += Math.ceil(arr.byteLength / 4) * 4;
  }
  return out;
}

export function decodeAFM(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (u8[0] !== 65 || u8[1] !== 70 || u8[2] !== 77 || u8[3] !== 49) throw new Error('AFM: falsche Kennung');
  const jl = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + jl)));
  const base = 8 + jl;
  const arrays = {};
  // Ausrichtung: Daten in eigenen ArrayBuffer kopieren, falls der Versatz nicht passt
  const ab = (u8.byteOffset + base) % 4 === 0 ? u8.buffer : u8.slice().buffer;
  const shift = (u8.byteOffset + base) % 4 === 0 ? u8.byteOffset + base : base;
  for (const b of header.buffers) {
    const T = TYPES[b.type];
    arrays[b.name] = new T(ab, shift + b.offset, b.count);
  }
  return { header, arrays };
}
