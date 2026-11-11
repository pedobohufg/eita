/* EITA! CRÂNIO — medidas no plano axial do scan e vistas do modelo para o relatório (puro: navegador e Node).
   Veio do bloco 1 da página antiga (legado/cranio-ortese, "RV"): corte da malha por um plano z, raios a partir
   da origem (0, 0) do plano, as quatro medidas AP, LL, D1 e D2 e o rasterizador em software das vistas
   ortogonais. A aritmética é a mesma; o que dependia do canvas (desenho de rótulos, régua) ficou na interface.
   Convenções do scan alinhado (ver ortese.js): x = direita, y = anterior, z = superior, mm.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */

const GRAU = Math.PI / 180;

// ------------------------------------------------------------------ medidas no plano axial
// segmentos da interseção da malha (triângulos soltos, 9 números cada; ou indexada) com o plano z:
// [x1, y1, x2, y2, …]
export function cortePlanoZ(pos, idx, z) {
  const nt = idx ? idx.length / 3 : pos.length / 9, seg = [];
  for (let t = 0; t < nt; t++) {
    const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, c = idx ? idx[t * 3 + 2] : t * 3 + 2;
    const za = pos[a * 3 + 2] - z, zb2 = pos[b * 3 + 2] - z, zc = pos[c * 3 + 2] - z;
    if ((za > 0 && zb2 > 0 && zc > 0) || (za <= 0 && zb2 <= 0 && zc <= 0)) continue;
    const pts = [];
    [[a, b, za, zb2], [b, c, zb2, zc], [c, a, zc, za]].forEach(function (e) {
      if ((e[2] <= 0 && e[3] > 0) || (e[2] > 0 && e[3] <= 0)) {
        const k = e[2] / (e[2] - e[3]);
        pts.push(pos[e[0] * 3] + (pos[e[1] * 3] - pos[e[0] * 3]) * k, pos[e[0] * 3 + 1] + (pos[e[1] * 3 + 1] - pos[e[0] * 3 + 1]) * k);
      }
    });
    if (pts.length >= 4) seg.push(pts[0], pts[1], pts[2], pts[3]);
  }
  return seg;
}
// raio a partir de (0, 0) na direção (dx, dy): a interseção mais distante com o contorno → { t, x, y } ou null
export function raioMaisDistante(seg, dx, dy) {
  let best = null;
  for (let i = 0; i < seg.length; i += 4) {
    const x1 = seg[i], y1 = seg[i + 1], x2 = seg[i + 2], y2 = seg[i + 3], ex = x2 - x1, ey = y2 - y1;
    const den = dx * ey - dy * ex; if (Math.abs(den) < 1e-12) continue;
    const t = (x1 * ey - y1 * ex) / den, s = (x1 * dy - y1 * dx) / den;
    if (t > 0 && s >= 0 && s <= 1 && (!best || t > best.t)) best = { t: t, x: dx * t, y: dy * t };
  }
  return best;
}
// direções das medidas: AP (anterior/posterior), LL (direita/esquerda), D1 (anterior direita → posterior
// esquerda) e D2 (anterior esquerda → posterior direita), as diagonais a 30° do eixo AP
export const DIRECOES = (() => { const s = Math.sin(30 * GRAU), c = Math.cos(30 * GRAU); return { ant: [0, 1], post: [0, -1], right: [1, 0], left: [-1, 0], d1a: [s, c], d1p: [-s, -c], d2a: [-s, c], d2p: [s, -c] }; })();
// Medidas no plano z (página antiga: planeData, mais a área e os índices da tabela do relatório).
// → { seg, hit, perimeter, area (mm²), AP, LL, D1, D2 (mm ou null), radii, cva, cvai, ci }
export function medidasNoPlano(pos, idx, z) {
  const seg = cortePlanoZ(pos, idx, z), hit = {};
  Object.keys(DIRECOES).forEach(function (k) { hit[k] = raioMaisDistante(seg, DIRECOES[k][0], DIRECOES[k][1]); });
  let per = 0, area = 0;
  for (let i = 0; i < seg.length; i += 4) { per += Math.hypot(seg[i + 2] - seg[i], seg[i + 3] - seg[i + 1]); area += (seg[i] * seg[i + 3] - seg[i + 2] * seg[i + 1]) / 2; }
  const len = function (a, b) { return hit[a] && hit[b] ? Math.hypot(hit[a].x - hit[b].x, hit[a].y - hit[b].y) : null; };
  const AP = len("ant", "post"), LL = len("right", "left"), D1 = len("d1a", "d1p"), D2 = len("d2a", "d2p"), radii = {};
  Object.keys(DIRECOES).forEach(function (k) { radii[k] = hit[k] && hit[k].t; });
  return { seg: seg, hit: hit, perimeter: per, area: Math.abs(area), AP: AP, LL: LL, D1: D1, D2: D2, radii: radii,
    cva: D1 != null && D2 != null ? Math.abs(D1 - D2) : null,
    cvai: D1 != null && D2 != null ? Math.abs(D1 - D2) / Math.max(D1, D2) * 100 : null,
    ci: AP && LL ? LL / AP * 100 : null };
}

// ------------------------------------------------------------------ vistas ortogonais (rasterizador em software)
export const VISTAS = Object.freeze({ top: { az: 0, el: 90 }, front: { az: 0, el: 0 }, post: { az: 180, el: 0 }, latR: { az: 90, el: 0 }, latL: { az: 270, el: 0 }, oblR: { az: 38, el: 22 }, oblL: { az: -38, el: 22 } });
// base da câmera para azimute/elevação: v (para o observador), r (direita da imagem), u (para cima)
export function baseDaVista(az, el) {
  const v = [Math.cos(el * GRAU) * Math.sin(az * GRAU), Math.cos(el * GRAU) * Math.cos(az * GRAU), Math.sin(el * GRAU)];
  let r = el >= 89.5 ? [1, 0, 0] : [-v[1], v[0], 0];
  const n = Math.hypot(r[0], r[1], r[2]); r = [r[0] / n, r[1] / n, r[2] / n];
  const u = [v[1] * r[2] - v[2] * r[1], v[2] * r[0] - v[0] * r[2], v[0] * r[1] - v[1] * r[0]];
  return { v: v, r: r, u: u };
}
// normais dos vértices (malha solta: soldada por posição numa grade de 1/400 mm); guardadas por malha
const cacheNormais = new WeakMap();
export function normaisDosVertices(pos, idx) {
  if (cacheNormais.has(pos)) return cacheNormais.get(pos);
  const nv = pos.length / 3, nt = idx ? idx.length / 3 : nv / 3;
  let map = null, ids = null;
  if (!idx) {
    if (nt > 600000) { cacheNormais.set(pos, null); return null; }
    map = new Map(); ids = new Uint32Array(nv);
    for (let i = 0; i < nv; i++) {
      const k = (((Math.round(pos[i * 3] * 400) * 73856093) ^ (Math.round(pos[i * 3 + 1] * 400) * 19349663) ^ (Math.round(pos[i * 3 + 2] * 400) * 83492791)) >>> 0);
      let id = map.get(k); if (id === undefined) { id = map.size; map.set(k, id); } ids[i] = id;
    }
  }
  const nU = idx ? nv : map.size, acc = new Float32Array(nU * 3);
  for (let t = 0; t < nt; t++) {
    const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, c = idx ? idx[t * 3 + 2] : t * 3 + 2;
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    [a, b, c].forEach(function (q) { const j = (idx ? q : ids[q]) * 3; acc[j] += nx; acc[j + 1] += ny; acc[j + 2] += nz; });
  }
  const out = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) {
    const j = (idx ? i : ids[i]) * 3, l = Math.hypot(acc[j], acc[j + 1], acc[j + 2]) || 1;
    out[i * 3] = acc[j] / l; out[i * 3 + 1] = acc[j + 1] / l; out[i * 3 + 2] = acc[j + 2] / l;
  }
  cacheNormais.set(pos, out); return out;
}
// caixa envolvente → { mn, mx, c, size }
export function limites(pos) {
  const mn = [1e30, 1e30, 1e30], mx = [-1e30, -1e30, -1e30];
  for (let i = 0; i < pos.length; i += 3) for (let q = 0; q < 3; q++) { const x = pos[i + q]; if (x < mn[q]) mn[q] = x; if (x > mx[q]) mx[q] = x; }
  return { mn: mn, mx: mx, c: [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2], size: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]] };
}
// Rasteriza em projeção ortogonal, com superamostragem ss. src = { pos, idx?, col? } (col: RGB 0–1 por vértice);
// vista = { az, el }; o = { W, H, ss, B, scale (px/mm), bg, base, flat }.
// → { dados (RGBA, Wb × Hb), Wb, Hb, W, H, B, pxPorMm, v, proj(x, y, z) → [px, py] na imagem final W × H }
export function rasterizar(src, vista, o) {
  o = o || {};
  const W = o.W || 600, H = o.H || 600, ss = o.ss || 2, Wb = W * ss, Hb = H * ss;
  const pos = src.pos, idx = src.idx || null, col = src.col || null, B = o.B || limites(pos);
  const bs = baseDaVista(vista.az, vista.el), v = bs.v, r = bs.r, u = bs.u;
  const ext = Math.max(B.size[0], B.size[1], B.size[2]);
  const scale = (o.scale || (Math.min(W, H) * 0.84 / ext)) * ss;
  const cxp = B.c[0] * r[0] + B.c[1] * r[1] + B.c[2] * r[2], cyp = B.c[0] * u[0] + B.c[1] * u[1] + B.c[2] * u[2];
  const nv = pos.length / 3, PX = new Float32Array(nv), PY = new Float32Array(nv), PD = new Float32Array(nv), SH = new Float32Array(nv);
  const nrm = o.flat ? null : normaisDosVertices(pos, idx);
  const L = [v[0] + 0.55 * u[0] - 0.35 * r[0], v[1] + 0.55 * u[1] - 0.35 * r[1], v[2] + 0.55 * u[2] - 0.35 * r[2]], Ll = Math.hypot(L[0], L[1], L[2]);
  L[0] /= Ll; L[1] /= Ll; L[2] /= Ll;
  for (let i = 0; i < nv; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    PX[i] = Wb / 2 + ((x * r[0] + y * r[1] + z * r[2]) - cxp) * scale;
    PY[i] = Hb / 2 - ((x * u[0] + y * u[1] + z * u[2]) - cyp) * scale;
    PD[i] = x * v[0] + y * v[1] + z * v[2];
    if (nrm) {
      let nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2];
      if (nx * v[0] + ny * v[1] + nz * v[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
      SH[i] = 0.36 + 0.64 * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    }
  }
  const bg = o.bg || [243, 246, 247], base = o.base || [190, 204, 211];
  const zb = new Float32Array(Wb * Hb).fill(-1e30), cb = new Uint8ClampedArray(Wb * Hb * 4);
  for (let p = 0; p < Wb * Hb; p++) { cb[p * 4] = bg[0]; cb[p * 4 + 1] = bg[1]; cb[p * 4 + 2] = bg[2]; cb[p * 4 + 3] = 255; }
  const nt = idx ? idx.length / 3 : nv / 3;
  for (let t = 0; t < nt; t++) {
    const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, c = idx ? idx[t * 3 + 2] : t * 3 + 2;
    const x0 = PX[a], y0 = PY[a], x1 = PX[b], y1 = PY[b], x2 = PX[c], y2 = PY[c];
    const den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (den > -1e-9 && den < 1e-9) continue;
    let s0 = SH[a], s1 = SH[b], s2 = SH[c];
    if (!nrm) {   // sombreamento plano
      const ax = pos[b * 3] - pos[a * 3], ay = pos[b * 3 + 1] - pos[a * 3 + 1], az = pos[b * 3 + 2] - pos[a * 3 + 2];
      const bx = pos[c * 3] - pos[a * 3], by = pos[c * 3 + 1] - pos[a * 3 + 1], bz = pos[c * 3 + 2] - pos[a * 3 + 2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      if (nx * v[0] + ny * v[1] + nz * v[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
      s0 = s1 = s2 = 0.36 + 0.64 * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    }
    const d0 = PD[a], d1 = PD[b], d2 = PD[c];
    const xa = Math.max(0, Math.floor(Math.min(x0, x1, x2))), xb = Math.min(Wb - 1, Math.ceil(Math.max(x0, x1, x2)));
    const ya = Math.max(0, Math.floor(Math.min(y0, y1, y2))), yb = Math.min(Hb - 1, Math.ceil(Math.max(y0, y1, y2)));
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / den, w1 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / den, w2 = 1 - w0 - w1;
        if (w0 < -0.001 || w1 < -0.001 || w2 < -0.001) continue;
        const d = w0 * d0 + w1 * d1 + w2 * d2, p = y * Wb + x;
        if (d <= zb[p]) continue;
        zb[p] = d;
        const s = w0 * s0 + w1 * s1 + w2 * s2, q = p * 4;
        if (col) {
          cb[q] = (w0 * col[a * 3] + w1 * col[b * 3] + w2 * col[c * 3]) * 255 * s * 1.08;
          cb[q + 1] = (w0 * col[a * 3 + 1] + w1 * col[b * 3 + 1] + w2 * col[c * 3 + 1]) * 255 * s * 1.08;
          cb[q + 2] = (w0 * col[a * 3 + 2] + w1 * col[b * 3 + 2] + w2 * col[c * 3 + 2]) * 255 * s * 1.08;
        } else { cb[q] = base[0] * s * 1.12; cb[q + 1] = base[1] * s * 1.12; cb[q + 2] = base[2] * s * 1.12; }
      }
    }
  }
  const px = scale / ss;
  return {
    dados: cb, Wb: Wb, Hb: Hb, W: W, H: H, B: B, pxPorMm: px, v: v,
    proj: function (x, y, z) { return [W / 2 + ((x * r[0] + y * r[1] + z * r[2]) - cxp) * px, H / 2 - ((x * u[0] + y * u[1] + z * u[2]) - cyp) * px]; }
  };
}
