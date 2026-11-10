/* EITA! OLHO — processamento específico da prótese ocular (puro: roda no navegador e no Node).
   Detecção da íris e da pupila, íris desenrolada e limpa, textura, mapa de alturas do relevo, contorno
   da casca e malhas (esclera, íris, pupila). Mesmos algoritmos da v0.2 publicada; os parâmetros chegam
   em objetos (ver modulos/olho/ui.js → parametros()) em vez de serem lidos da página.
   Unidades: mm; eixo z para a frente da prótese; origem no centro da íris.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import { desfocarGauss, bilinearLinhas } from "../../nucleo/imagem.js";
import { revolucao } from "../../nucleo/malha.js";

export const TAU = Math.PI * 2;
export const NT = 1024;                      // grade da íris desenrolada: ângulos…
export const NR = 256;                       // …e raios
export const TEX = 1024;                     // textura (px)
export const HM = 512;                       // mapa de alturas (px)
export const CABECALHO_STL = "EITA! OLHO - Lab.EITA/UFG - mm";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function fmt(v, d = 2) { return Number.isFinite(v) ? v.toFixed(d).replace(".", ",") : "—"; }
const bil = bilinearLinhas;

// foto = { px: RGBA, W, H, wb: [gR, gG, gB] }
// ------------------------------------------------------------------ amostragem bilinear com balanço de branco (0..1)
export function amostrar(foto, x, y, out) {
  const { W, H, px: p, wb } = foto;
  x = clamp(x, 0, W - 1.001); y = clamp(y, 0, H - 1.001);
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
  const i00 = (y0 * W + x0) * 4, i10 = i00 + 4, i01 = i00 + W * 4, i11 = i01 + 4;
  for (let c = 0; c < 3; c++) {
    const v = (p[i00 + c] * (1 - fx) + p[i10 + c] * fx) * (1 - fy) + (p[i01 + c] * (1 - fx) + p[i11 + c] * fx) * fy;
    out[c] = Math.min(1, v / 255 * wb[c]);
  }
  return out;
}

// ------------------------------------------------------------------ detecção da íris e da pupila
export function cinzaReduzida(foto, maxW) {
  const k = Math.min(1, maxW / foto.W), w = Math.round(foto.W * k), h = Math.round(foto.H * k);
  const g = new Float32Array(w * h), o = [0, 0, 0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    amostrar(foto, (x + .5) / k - .5, (y + .5) / k - .5, o);
    g[y * w + x] = 0.3 * o[0] + 0.59 * o[1] + 0.11 * o[2];
  }
  return { g, w, h, k };
}
// operador integro-diferencial (Daugman): maior salto de brilho médio ao longo do círculo
function melhorCirculo(G, cx0, cy0, span, step, rmin, rmax, angs) {
  const { g, w, h } = G; let best = { s: -1e9 };
  const ca = angs.map(Math.cos), sa = angs.map(Math.sin), na = angs.length;
  const nr = Math.max(3, Math.floor(rmax - rmin) + 1), M = new Float32Array(nr);
  for (let cy = cy0 - span; cy <= cy0 + span; cy += step) for (let cx = cx0 - span; cx <= cx0 + span; cx += step) {
    for (let k = 0; k < nr; k++) {
      const r = rmin + k; let a = 0;
      for (let j = 0; j < na; j++) a += bil(g, w, h, cx + r * ca[j], cy - r * sa[j]);
      M[k] = a / na;
    }
    for (let k = 2; k < nr - 2; k++) {
      const d = (M[k + 1] + M[k + 2] - M[k - 1] - M[k - 2]) / 4;
      if (d > best.s) best = { s: d, x: cx, y: cy, r: rmin + k };
    }
  }
  return best;
}
// → { iris: {x, y, r}, pup: {x, y, r} } em px da foto; semente = ponto clicado (px da foto) ou nada
export function detectarIrisPupila(foto, semente) {
  const G = cinzaReduzida(foto, 420); G.g = desfocarGauss(G.g, G.w, G.h, 1.2);
  const { w, h, k } = G;
  // 1) chute da pupila: região mais escura (ou o ponto clicado)
  let gx, gy;
  if (semente) { gx = semente.x * k; gy = semente.y * k; }
  else {
    const B = desfocarGauss(G.g, w, h, w / 45); let mn = 1e9;
    for (let y = Math.round(h * .12); y < h * .88; y++) for (let x = Math.round(w * .12); x < w * .88; x++) if (B[y * w + x] < mn) { mn = B[y * w + x]; gx = x; gy = y; }
  }
  const full = []; for (let i = 0; i < 48; i++) full.push(i / 48 * TAU);
  const lat = []; for (let i = 0; i < 40; i++) { const t = (-40 + i * 80 / 19) * Math.PI / 180; if (i < 20) lat.push(t); else lat.push(Math.PI + (-40 + (i - 20) * 80 / 19) * Math.PI / 180); }
  // 2) íris primeiro (maior contraste, só arcos laterais: pálpebras cobrem em cima e embaixo)
  let I = melhorCirculo(G, Math.round(gx), Math.round(gy), Math.round(w / 18), 2, Math.max(6, w * .04), Math.min(w, h) * .48, lat);
  I = melhorCirculo(G, I.x, I.y, 2, 0.5, I.r * .9, I.r * 1.1, lat);
  // 3) pupila dentro da íris
  let P = melhorCirculo(G, Math.round(I.x), Math.round(I.y), Math.max(2, Math.round(I.r * .18)), 1, Math.max(2, I.r * .12), I.r * .75, full);
  P = melhorCirculo(G, P.x, P.y, 1.5, 0.5, Math.max(2, P.r * .8), P.r * 1.2, full);
  return { pup: { x: P.x / k, y: P.y / k, r: P.r / k }, iris: { x: I.x / k, y: I.y / k, r: I.r / k } };
}

// ------------------------------------------------------------------ desenrolar e limpar a íris
export function desenrolar(foto, I, P) {
  const u = new Float32Array(NT * NR * 3), o = [0, 0, 0];
  for (let t = 0; t < NT; t++) {
    const th = t / NT * TAU, c = Math.cos(th), s = Math.sin(th);
    const px = P.x + P.r * c, py = P.y - P.r * s, ix = I.x + I.r * c, iy = I.y - I.r * s;
    for (let j = 0; j < NR; j++) {
      const rr = j / (NR - 1);
      amostrar(foto, px + (ix - px) * rr, py + (iy - py) * rr, o);
      const k = (j * NT + t) * 3; u[k] = o[0]; u[k + 1] = o[1]; u[k + 2] = o[2];
    }
  }
  return u;
}
const lum = (a, k) => 0.3 * a[k] + 0.59 * a[k + 1] + 0.11 * a[k + 2];
// setores de pálpebra ativos em graus: [[a, b], …]
export function setoresPalpebra(L) { const s = []; if (L.upOn) s.push([L.upA, L.upB]); if (L.loOn) s.push([L.loA, L.loB]); return s; }
// L = { upOn, upA, upB, loOn, loA, loB, specOn, specThr, cBri, cCon, cSat } → { c (limpa), mask (1 reflexo, 2 setor) }
export function limparIris(u, L) {
  const c = u.slice(), mask = new Uint8Array(NT * NR);
  // setores de pálpebra: copia do ângulo espelhado no eixo horizontal (θ → −θ)
  for (const [a, b] of setoresPalpebra(L)) {
    const fe = 6;
    for (let t = 0; t < NT; t++) {
      const deg = t / NT * 360;
      const inside = Math.min(deg - a, b - deg);
      if (inside < -fe) continue;
      const wgt = clamp((inside + fe) / (2 * fe), 0, 1);
      const ts = ((NT - t) % NT);
      for (let j = 0; j < NR; j++) {
        const k = (j * NT + t) * 3, ks = (j * NT + ts) * 3;
        for (let q = 0; q < 3; q++) c[k + q] = c[k + q] * (1 - wgt) + u[ks + q] * wgt;
        if (wgt > 0.5) mask[j * NT + t] = 2;
      }
    }
  }
  // reflexos: claros demais → interpola ao longo do anel
  if (L.specOn) {
    const thr = L.specThr, m2 = new Uint8Array(NT * NR);
    for (let i = 0; i < NT * NR; i++) if (lum(c, i * 3) > thr) m2[i] = 1;
    const m3 = m2.slice();
    for (let j = 0; j < NR; j++) for (let t = 0; t < NT; t++) if (m2[j * NT + t])
      for (let dj = -4; dj <= 4; dj++) for (let dt = -5; dt <= 5; dt++) { const jj = j + dj; if (jj < 0 || jj >= NR) continue; m3[jj * NT + ((t + dt + NT) % NT)] = 1; }
    for (let j = 0; j < NR; j++) {
      const row = j * NT; let any = false, all = true;
      for (let t = 0; t < NT; t++) { if (m3[row + t]) any = true; else all = false; }
      if (!any || all) continue;
      for (let t = 0; t < NT; t++) {
        if (!m3[row + t]) continue;
        let l = 1, r = 1; while (m3[row + ((t - l + NT) % NT)]) l++; while (m3[row + ((t + r) % NT)]) r++;
        const kl = (row + ((t - l + NT) % NT)) * 3, kr = (row + ((t + r) % NT)) * 3, f = l / (l + r), k = (row + t) * 3;
        for (let q = 0; q < 3; q++) c[k + q] = c[kl + q] * (1 - f) + c[kr + q] * f;
        mask[row + t] = mask[row + t] || 1;
      }
    }
  }
  // cor
  const bri = L.cBri, con = L.cCon, sat = L.cSat;
  for (let i = 0; i < NT * NR; i++) {
    const k = i * 3, Lm = lum(c, k);
    for (let q = 0; q < 3; q++) {
      let v = Lm + (c[k + q] - Lm) * sat;
      v = (v - 0.5) * con + 0.5 + bri;
      c[k + q] = clamp(v, 0, 1);
    }
  }
  return { c, mask };
}
// prótese: espelhada (foto de um olho, prótese do outro), diâmetros e razão pupila/íris
export function parametrosProtese({ espelhar, Di, Dp }) { return { mirror: espelhar, Di, Dp, rpn: clamp(Dp / Di, 0.1, 0.8) }; }
function amostrarDesenrolada(c, th, rho, out) { // th em rad, rho 0..1
  let t = (th / TAU) * NT; t = ((t % NT) + NT) % NT;
  const j = clamp(rho, 0, 1) * (NR - 1);
  const t0 = Math.floor(t), t1 = (t0 + 1) % NT, ft = t - t0, j0 = Math.min(NR - 2, Math.floor(j)), fj = j - j0;
  for (let q = 0; q < 3; q++) {
    const a = c[(j0 * NT + t0) * 3 + q], b = c[(j0 * NT + t1) * 3 + q], d = c[((j0 + 1) * NT + t0) * 3 + q], e = c[((j0 + 1) * NT + t1) * 3 + q];
    out[q] = (a * (1 - ft) + b * ft) * (1 - fj) + (d * (1 - ft) + e * ft) * fj;
  }
  return out;
}
// textura RGBA (TEX × TEX) no plano da prótese: X para a direita, Y para cima, raio 1 = limbo, fundo transparente
export function textura(c, prot) {
  const { mirror, rpn } = prot;
  const d = new Uint8ClampedArray(TEX * TEX * 4), o = [0, 0, 0];
  const pupC = [0.035, 0.035, 0.04];
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    let X = (x + .5) / TEX * 2 - 1; const Y = 1 - (y + .5) / TEX * 2;
    const r = Math.hypot(X, Y), k = (y * TEX + x) * 4;
    if (r > 1 + 1.5 / TEX) { d[k + 3] = 0; continue; }
    if (mirror) X = -X;
    const th = Math.atan2(Y, X);
    if (r < rpn) { d[k] = pupC[0] * 255; d[k + 1] = pupC[1] * 255; d[k + 2] = pupC[2] * 255; }
    else {
      amostrarDesenrolada(c, th, (r - rpn) / (1 - rpn), o);
      const pe = clamp((r - rpn) * TEX / 2 / 1.2, 0, 1); // borda suave da pupila
      for (let q = 0; q < 3; q++) d[k + q] = (o[q] * pe + pupC[q] * (1 - pe)) * 255;
    }
    d[k + 3] = clamp((1 + 1.5 / TEX - r) * TEX / 3, 0, 1) * 255;
  }
  return d;
}
// mapa de alturas (mm acima da face anterior da esclera), HM × HM.
// tex = RGBA da textura (no navegador, lida de volta do canvas); R = { hDetail, hSmooth, hBase, hDepth, hInv, hLimbus, hTrans }
export function mapaAltura(tex, prot, R) {
  const { rpn, Di } = prot;
  const s = TEX / HM, g = tex;
  const L = new Float32Array(HM * HM), Rr = new Float32Array(HM * HM);
  let sum = 0, n = 0;
  for (let y = 0; y < HM; y++) for (let x = 0; x < HM; x++) {
    const X = (x + .5) / HM * 2 - 1, Y = 1 - (y + .5) / HM * 2, r = Math.hypot(X, Y);
    Rr[y * HM + x] = r;
    const tx = Math.min(TEX - 1, Math.floor((x + .5) * s)), ty = Math.min(TEX - 1, Math.floor((y + .5) * s)), k = (ty * TEX + tx) * 4;
    const v = (0.3 * g[k] + 0.59 * g[k + 1] + 0.11 * g[k + 2]) / 255;
    L[y * HM + x] = v;
    if (r > rpn && r < 1) { sum += v; n++; }
  }
  const mean = sum / Math.max(1, n);
  for (let i = 0; i < L.length; i++) if (Rr[i] <= rpn + 0.01 || Rr[i] >= 0.995) L[i] = mean;
  const mmpx = Di / HM;
  const big = desfocarGauss(L, HM, HM, R.hDetail / mmpx);
  let D = new Float32Array(HM * HM), ss = 0; n = 0;
  for (let i = 0; i < L.length; i++) { D[i] = L[i] - big[i]; if (Rr[i] > rpn && Rr[i] < 1) { ss += D[i] * D[i]; n++; } }
  const sd = Math.sqrt(ss / Math.max(1, n)) || 1;
  D = desfocarGauss(D, HM, HM, R.hSmooth / mmpx);
  const base = R.hBase, depth = R.hDepth, sign = R.hInv ? -1 : 1, limb = R.hLimbus;
  const trans = R.hTrans, Ri = Di / 2;
  const h = new Float32Array(HM * HM);
  for (let i = 0; i < h.length; i++) {
    const r = Rr[i];
    if (r >= 1) { h[i] = 0; continue; }
    let v = base + depth * sign * clamp(D[i] / (2.2 * sd), -1, 1);
    if (limb) v += 0.08 * Math.exp(-(((r - 0.93) / 0.025) ** 2));
    const dmm = (1 - r) * Ri;                                   // distância ao limbo (mm)
    if (trans > 0.01) { const t = clamp(dmm / trans, 0, 1); v *= t * t * (3 - 2 * t); }   // nasce da esclera
    else v = Math.max(0.02, v) * Math.sqrt(clamp((1 - r) / 0.025, 0, 1));
    h[i] = Math.max(0, v);
  }
  return h;
}
export function alturaEm(h, X, Y) { return bil(h, HM, HM, (X + 1) / 2 * HM - .5, (1 - Y) / 2 * HM - .5); } // X, Y em raio normalizado
// altura da pupila (mm acima da esclera) em função do raio (mm): { pupMode: dome|flat|sunk, hBase, pPup, pupH }
export function funcaoPupila({ pupMode, hBase, pPup, pupH }) {
  const base = hBase, rp = pPup / 2, ph = pupH;
  if (pupMode === "flat") return () => base;
  if (pupMode === "sunk") return () => Math.max(0.02, base - 0.15);
  return (r) => base + ph * Math.sqrt(clamp(1 - (r / rp) ** 2, 0, 1));
}
// relevo com luz rasante → RGBA HM × HM (para a tela e o relatório)
export function sombrearRelevo(h, prot, pupila) {
  const d = new Uint8ClampedArray(HM * HM * 4);
  const mmpx = prot.Di / HM, ex = 6, L = [-0.55, 0.55, 0.62], ln = Math.hypot(...L), rpn = prot.rpn, Di2 = prot.Di / 2, pt = funcaoPupila(pupila);
  for (let y = 1; y < HM - 1; y++) for (let x = 1; x < HM - 1; x++) {
    const i = y * HM + x, X = (x + .5) / HM * 2 - 1, Y = 1 - (y + .5) / HM * 2, r = Math.hypot(X, Y), o = i * 4;
    if (r > 1) { d[o + 3] = 0; continue; }
    let dx = (h[i + 1] - h[i - 1]) / (2 * mmpx) * ex, dy = -(h[i + HM] - h[i - HM]) / (2 * mmpx) * ex;
    if (r < rpn) { // cúpula da pupila
      const zz = pt(r * Di2), zx = pt(Math.hypot(X + 2 / HM, Y) * Di2);
      dx = (zx - zz) / mmpx * ex * 0.5; dy = 0;
    }
    const n = [-dx, -dy, 1], nl = Math.hypot(...n);
    const v = clamp((n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / (nl * ln), 0, 1);
    const s = 40 + 205 * v; d[o] = s; d[o + 1] = s; d[o + 2] = s; d[o + 3] = 255;
  }
  return d;
}
// mapa de alturas em tons de cinza (branco = altura máxima) → { data: RGBA, mx }
export function alturaRGBA(h) {
  const d = new Uint8ClampedArray(HM * HM * 4); let mx = 0; for (const v of h) mx = Math.max(mx, v);
  for (let i = 0; i < h.length; i++) { const v = h[i] / mx * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  return { data: d, mx };
}
// íris desenrolada (NT × NR, limbo em cima) → RGBA; mascara opcional pinta reflexos (rosa) e setores (laranja)
export function desenroladaRGBA(arr, mask) {
  const d = new Uint8ClampedArray(NT * NR * 4);
  for (let j = 0; j < NR; j++) for (let t = 0; t < NT; t++) {
    const k = (j * NT + t) * 3, o = ((NR - 1 - j) * NT + t) * 4;
    d[o] = arr[k] * 255; d[o + 1] = arr[k + 1] * 255; d[o + 2] = arr[k + 2] * 255; d[o + 3] = 255;
    if (mask && mask[j * NT + t]) { if (mask[j * NT + t] === 1) { d[o] = 255; d[o + 1] = 40; d[o + 2] = 200; } else { d[o] = d[o] * .6 + 240 * .4; d[o + 1] = d[o + 1] * .6 + 140 * .4; d[o + 2] = d[o + 2] * .6 + 30 * .4; } }
  }
  return d;
}

// ------------------------------------------------------------------ geometria da casca
// contorno genérico (prótese direita, vista de frente: +x = nasal), mm
export const CONTORNO = [[-11.1, -4.6], [-7.3, 9.4], [0.3, 11.9], [9.2, 8.1], [11.7, -0.1], [7.9, -7.7], [-2.2, -12.8], [-9.8, -10.3]];
// raio do contorno em nT direções. F = { sW, sH, protSide: "D"|"E", sDx, sDy }
export function contornoRho(nT, F) {
  const W = F.sW, H = F.sH, side = F.protSide;
  const xs = CONTORNO.map((p) => p[0]), ys = CONTORNO.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const nas = side === "D" ? 1 : -1;
  const ox = F.sDx * nas, oy = F.sDy;
  const P = CONTORNO.map(([x, y]) => [((x - x0) / (x1 - x0) - .5) * W * nas - ox, ((y - y0) / (y1 - y0) - .5) * H - oy]);
  // Catmull-Rom fechado
  const C = [], n = P.length;
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    for (let s = 0; s < 40; s++) {
      const t = s / 40, t2 = t * t, t3 = t2 * t;
      C.push([0, 1].map((q) => 0.5 * ((2 * p1[q]) + (-p0[q] + p2[q]) * t + (2 * p0[q] - 5 * p1[q] + 4 * p2[q] - p3[q]) * t2 + (-p0[q] + 3 * p1[q] - 3 * p2[q] + p3[q]) * t3)));
    }
  }
  const rho = new Float32Array(nT);
  for (let i = 0; i < nT; i++) {
    const th = i / nT * TAU, dx = Math.cos(th), dy = Math.sin(th); let best = 0;
    for (let k = 0; k < C.length; k++) {
      const a = C[k], b = C[(k + 1) % C.length], ex = b[0] - a[0], ey = b[1] - a[1];
      const den = dx * ey - dy * ex; if (Math.abs(den) < 1e-12) continue;
      const t = (a[0] * ey - a[1] * ex) / den, u = (a[0] * dy - a[1] * dx) / den;
      if (t > 0 && u >= 0 && u <= 1) best = Math.max(best, t);
    }
    rho[i] = best;
  }
  return rho;
}
export const esfera = (r, R, RF) => Math.sqrt(Math.max(0, R * R - r * r)) - RF;
// F = { sRF, sRB, sT, sIns, sMode: shell|solid, sShell }, diâmetros da íris e da pupila (mm)
export function geometria(F, Di, Dp) {
  const G = { RF: F.sRF, RB: F.sRB, T: F.sT, INS: F.sIns, RI: Di / 2, RP: Dp / 2, mode: F.sMode, SH: F.sShell };
  G.front = (r) => esfera(r, G.RF, G.RF);
  G.back = G.mode === "shell" ? (r) => esfera(Math.min(r, G.RF - G.SH - 1e-3), G.RF - G.SH, G.RF) : (r) => -G.T - (G.RB - Math.sqrt(Math.max(0, G.RB * G.RB - r * r)));
  G.depth = G.mode === "shell" ? G.SH : G.T;   // espessura no centro
  return G;
}
// confere a casca → { minT, minR, avisos[], ok (texto quando não há avisos) }
export function verificarCasca(G, F) {
  const rho = contornoRho(180, F);
  let minR = 1e9, maxR = 0, minT = 1e9;
  for (let i = 0; i < rho.length; i++) {
    minR = Math.min(minR, rho[i]); maxR = Math.max(maxR, rho[i]);
    minT = Math.min(minT, G.front(rho[i]) - G.back(rho[i]));
  }
  const w = [];
  if (minR < G.RI + 1.2) w.push("A íris está muito perto da borda da casca: aumente a largura/altura ou reduza o deslocamento.");
  if (G.RI >= G.RF * 0.95) w.push("O raio da face anterior é pequeno demais para o diâmetro da íris.");
  if (G.mode === "shell") {
    if (maxR > G.RF - G.SH - 0.3) w.push("O contorno é largo demais para essa curvatura: a casca fecharia sobre si. Aumente o raio da face anterior ou reduza largura/altura.");
    if (G.INS > G.SH - 0.4) w.push(`O encaixe da íris (${fmt(G.INS, 1)} mm) é fundo demais para uma casca de ${fmt(G.SH, 1)} mm: deixe pelo menos 0,4 mm de fundo (encaixe ≤ ${fmt(G.SH - 0.4, 1)} mm).`);
  } else if (minT < 0.8) w.push(`Na borda a peça fica com ${fmt(minT, 2)} mm. Aumente a espessura no centro ou o raio da face anterior, ou diminua o raio posterior.`);
  const ok = G.mode === "shell" ? `Casca de ${fmt(G.SH, 1)} mm em toda a peça · altura total ≈ ${fmt(-G.back(Math.min(maxR, G.RF - G.SH - 0.3)), 1)} mm.` : `Espessura mínima na borda ≈ ${fmt(minT, 2)} mm.`;
  return { minT, minR, maxR, avisos: w, ok };
}
function lin(a, b, n) { const o = []; for (let i = 0; i <= n; i++) o.push(a + (b - a) * i / n); return o; }
// malhas da prótese: { sclera, iris, pupil } (sopa de triângulos com cor, ver nucleo/malha.js → revolucao)
// E = { hm (mapa de alturas), tex (RGBA da textura), hi (alta resolução), hTrans, pupila: parâmetros de funcaoPupila }
export function malhas(G, F, E) {
  const { RF, RI, RP, front, back } = G;
  const INS = G.mode === "shell" ? Math.min(G.INS, G.SH - 0.4) : G.INS;
  const inset = (r) => esfera(r, RF - INS, RF);
  const scl = [0.95, 0.92, 0.86], hi = E.hi;
  // ---------- esclera
  const nTs = hi ? 480 : 300, rho = contornoRho(nTs, F);
  const sclera = revolucao(nTs, (th, i) => {
    const P = [];
    lin(0, RI, 10).forEach((r) => P.push([r, inset(r)]));
    P.push([RI, front(RI)]);
    // borda arredondada com tangente contínua (Bézier entre a face anterior e a posterior)
    const rmax = G.mode === "shell" ? Math.min(rho[i], RF - G.SH - 0.3) : rho[i], thick = Math.max(0.3, front(rmax) - back(rmax));
    const L = clamp(thick * 0.55, 0.25, 1.4), re = Math.max(RI + 0.3, rmax - 0.75 * L);
    lin(RI, re, 28).slice(1).forEach((r) => P.push([r, front(r)]));
    const zt = front(re), zb = back(re);
    const df = (front(re + 1e-3) - front(re - 1e-3)) / 2e-3, db = (back(re + 1e-3) - back(re - 1e-3)) / 2e-3;
    let t0 = [1, df], t3 = [-1, -db]; const n0 = Math.hypot(...t0), n3 = Math.hypot(...t3); t0 = t0.map((v) => v / n0); t3 = t3.map((v) => v / n3);
    const P0 = [re, zt], C1 = [re + t0[0] * L, zt + t0[1] * L], P3 = [re, zb], C2 = [re - t3[0] * L, zb - t3[1] * L];
    for (let q = 1; q < 16; q++) {
      const u = q / 16, a = (1 - u) ** 3, b2 = 3 * u * (1 - u) ** 2, c = 3 * u * u * (1 - u), d = u ** 3;
      P.push([a * P0[0] + b2 * C1[0] + c * C2[0] + d * P3[0], a * P0[1] + b2 * C1[1] + c * C2[1] + d * P3[1]]);
    }
    lin(re, 0, 30).forEach((r) => P.push([r, back(r)]));
    return P;
  }, () => scl, false);
  // ---------- íris
  const nTi = hi ? 1440 : 720, nRi = hi ? 260 : 130;
  const texD = E.tex;
  const texAt = (x, y) => {
    const X = x / RI, Y = y / RI;
    const px = clamp(Math.round((X + 1) / 2 * TEX - .5), 0, TEX - 1), py = clamp(Math.round((1 - Y) / 2 * TEX - .5), 0, TEX - 1), k = (py * TEX + px) * 4;
    return [texD[k] / 255, texD[k + 1] / 255, texD[k + 2] / 255];
  };
  const irisSide = [0.45, 0.45, 0.48];
  const nTop = nRi + 1;
  const irisM = revolucao(nTi, (th) => {
    const c = Math.cos(th), s = Math.sin(th), P = [];
    lin(RP, RI, nRi).forEach((r) => P.push([r, front(r) + alturaEm(E.hm, r * c / RI, r * s / RI)]));
    P.push([RI, inset(RI)]);
    lin(RI, RP, 8).slice(1).forEach((r) => P.push([r, inset(r)]));
    return P;
  }, (p, k) => {
    if (k >= nTop) return irisSide;
    const c = texAt(p[0], p[1]), tr = E.hTrans;
    if (tr <= 0.01) return c;
    const t = clamp((RI - Math.hypot(p[0], p[1])) / (tr * 0.45), 0, 1), w = t * t * (3 - 2 * t);
    return [0, 1, 2].map((q) => c[q] * w + scl[q] * (1 - w));
  }, true);
  // ---------- pupila
  const nTp = hi ? 480 : 300, pupTop = funcaoPupila(E.pupila);
  const pupil = revolucao(nTp, () => {
    const P = [];
    lin(0, RP, hi ? 50 : 30).forEach((r) => P.push([r, front(r) + pupTop(r)]));
    P.push([RP, inset(RP)]);
    lin(RP, 0, 8).slice(1).forEach((r) => P.push([r, inset(r)]));
    return P;
  }, () => [0.05, 0.05, 0.06], false);
  return { sclera, iris: irisM, pupil };
}
