/* EITA núcleo · geometria plana — polígonos e quadriláteros (marcador).
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */


function cruz(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
export function casco(pts) {
  pts = pts.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cruz(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cruz(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up);
}
export function quadDoCasco(h) {
  // diagonal = par mais distante; os outros dois cantos = mais distantes da diagonal de cada lado
  let a = 0, b = 0, d = -1;
  for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) { const t = (h[i][0] - h[j][0]) ** 2 + (h[i][1] - h[j][1]) ** 2; if (t > d) { d = t; a = i; b = j; } }
  let c1 = -1, c2 = -1, m1 = 0, m2 = 0;
  for (let i = 0; i < h.length; i++) { const s = cruz(h[a], h[b], h[i]); if (s > m1) { m1 = s; c1 = i; } if (-s > m2) { m2 = -s; c2 = i; } }
  if (c1 < 0 || c2 < 0) return null;
  const q = [h[a], h[c1], h[b], h[c2]];
  const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
  q.sort((p, r) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(r[1] - cy, r[0] - cx));
  return q;
}
export function areaPoligono(q) { let s = 0; for (let i = 0; i < q.length; i++) { const p = q[i], r = q[(i + 1) % q.length]; s += p[0] * r[1] - r[0] * p[1]; } return Math.abs(s) / 2; };
export function escalarQuad(q, f) {
  const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
  return q.map((p) => [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f]);
};
function dentroConvexo(q, x, y) {
  let sinal = 0;
  for (let i = 0; i < q.length; i++) { const s = cruz(q[i], q[(i + 1) % q.length], [x, y]); if (s !== 0) { if (sinal === 0) sinal = Math.sign(s); else if (Math.sign(s) !== sinal) return false; } }
  return true;
}
export function mascaraQuad(w, h, q, fIn, fOut) {
  const qo = escalarQuad(q, fOut), qi = fIn > 0 ? escalarQuad(q, fIn) : null;
  const xs = qo.map((p) => p[0]), ys = qo.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(w - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(h - 1, Math.ceil(Math.max(...ys)));
  const idx = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (dentroConvexo(qo, x + 0.5, y + 0.5) && !(qi && dentroConvexo(qi, x + 0.5, y + 0.5))) idx.push(y * w + x);
  return idx;
};
export const ladosQuad = (q) => q.map((p, i) => Math.hypot(q[(i + 1) % 4][0] - p[0], q[(i + 1) % 4][1] - p[1]));
