/* EITA núcleo · calibração — marcador ArUco v2 (escala) e correção de cor por dois pontos.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import { mediana } from "./base.js";
import { areaPoligono, casco, ladosQuad, mascaraQuad, quadDoCasco } from "./geometria-plana.js";
import { desfocar, medianaCanais, rotular } from "./imagem.js";

const BRANCO_REF = 245, PRETO_REF = 25, CINZA_REF = 128;
// ------------------------------------------------------------------ marcador
export function detectarMarcador(img) {
  const w = img.width, h = img.height, d = img.data, n = w * h;
  const cinza = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) cinza[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
  const media = desfocar(cinza, w, h, Math.max(w, h) / 40);
  const escuro = new Uint8Array(n);
  for (let i = 0; i < n; i++) escuro[i] = cinza[i] < 0.62 * media[i] && cinza[i] < 110 ? 1 : 0;
  const { lab, comps } = rotular(escuro, w, h);
  let melhor = null;
  for (const c of comps) {
    const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
    if (c.area < 0.0004 * n || c.area > 0.15 * n || bw < 20 || bh < 20) continue;
    if (Math.max(bw, bh) / Math.min(bw, bh) > 1.8) continue;
    const pts = [];
    for (let y = c.y0; y <= c.y1; y++) {
      let xa = -1, xb = -1;
      for (let x = c.x0; x <= c.x1; x++) if (lab[y * w + x] === c.id) { if (xa < 0) xa = x; xb = x; }
      if (xa >= 0) { pts.push([xa, y]); pts.push([xb + 1, y]); pts.push([xa, y + 1]); pts.push([xb + 1, y + 1]); }
    }
    const hull = casco(pts);
    if (hull.length < 4) continue;
    const q = quadDoCasco(hull);
    if (!q) continue;
    const aq = areaPoligono(q), ah = areaPoligono(hull);
    if (aq / ah < 0.93) continue;
    const lados = ladosQuad(q), lm = lados.reduce((s, v) => s + v, 0) / 4;
    if (Math.max(...lados) / Math.min(...lados) > 1.35) continue;
    const fracEsc = c.area / aq;
    if (fracEsc < 0.3 || fracEsc > 0.9) continue;
    const dentro = mascaraQuad(w, h, q, 0, 0.9), anel = mascaraQuad(w, h, q, 1.04, 1.13);
    let claroD = 0, nD = 0; for (const i of dentro) if (!escuro[i]) { claroD += cinza[i]; nD++; }
    let mA = 0; for (const i of anel) mA += cinza[i]; mA /= anel.length || 1;
    let mE = 0, nE = 0; for (const i of dentro) if (escuro[i]) { mE += cinza[i]; nE++; } mE /= nE || 1;
    if (nD < 0.08 * dentro.length || mA - mE < 60) continue;
    const nota = (1 - Math.abs(fracEsc - 0.6)) * (aq / ah) * (Math.min(...lados) / Math.max(...lados)) * Math.min(1, (mA - mE) / 120);
    if (!melhor || nota > melhor.nota) melhor = { cantos: q, nota, lado_px: lm };
  }
  return melhor;
};

// ------------------------------------------------------------------ cor
export function calibrarCor(img, q) {
  const w = img.width, h = img.height, d = img.data;
  const dentro = mascaraQuad(w, h, q, 0, 0.92);
  const cz = dentro.map((i) => 0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2]);
  const t = mediana(Float32Array.from(cz));
  const preto = medianaCanais(img, dentro.filter((_, k) => cz[k] < t));
  const branco = medianaCanais(img, mascaraQuad(w, h, q, 1.06, 1.24));
  const anelIdx = mascaraQuad(w, h, q, 1.36, 1.54), filIdx = mascaraQuad(w, h, q, 1.62, 1.68);
  let ref = null, alvo, claro;
  if (anelIdx.length && filIdx.length) {
    const m = medianaCanais(img, anelIdx), f = medianaCanais(img, filIdx);
    const estrutura = [0, 1, 2].every((c) => Math.abs(f[c] - branco[c]) < 20 && branco[c] - m[c] > 40);
    const meio = [0, 1, 2].every((c) => m[c] - preto[c] > 30);
    let dev = []; for (const i of anelIdx) dev.push(Math.abs(d[4 * i] - m[0]) + Math.abs(d[4 * i + 1] - m[1]) + Math.abs(d[4 * i + 2] - m[2]));
    const unif = mediana(Float32Array.from(dev)) / 3 < 12;
    if (estrutura && meio && unif) { ref = "anel cinza"; alvo = CINZA_REF; claro = m; }
  }
  if (!ref) { ref = "branco do papel"; alvo = BRANCO_REF; claro = branco; }
  if ([0, 1, 2].some((c) => claro[c] - preto[c] < 40)) return { img, ref: null };
  const out = new Uint8ClampedArray(d.length);
  const ganho = [0, 1, 2].map((c) => (alvo - PRETO_REF) / (claro[c] - preto[c]));
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) out[i + c] = (d[i + c] - preto[c]) * ganho[c] + PRETO_REF;
    out[i + 3] = 255;
  }
  const saturado = ref === "branco do papel" && branco.some((v) => v >= 250);
  return { img: { data: out, width: w, height: h }, ref: ref + (saturado ? " (SATURADO)" : ""), preto, claro };
};
// ------------------------------------------------------------------ marcador v2 (SVG em mm)
// DICT_4X4_50 id 7 (bits 4x4, 1 = branco), gerado do OpenCV — marcador padrão do Lab.EITA
export const BITS_ID7 = [[1, 1, 0, 0], [0, 1, 0, 0], [1, 1, 1, 1], [0, 0, 1, 0]];
export function marcadorSVG(bits = BITS_ID7, rotulo = "Lab.EITA") {
  const c = 20 / 6; let r = "";
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (bits[y][x]) r += `<rect x="${(9 + c * (x + 1)).toFixed(4)}" y="${(9 + c * (y + 1)).toFixed(4)}" width="${c.toFixed(4)}" height="${c.toFixed(4)}" fill="#fff"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="38mm" height="44mm" viewBox="0 0 38 44">
<rect x="0" y="0" width="38" height="38" fill="#fff" stroke="#999" stroke-width="0.1"/>
<rect x="3" y="3" width="32" height="32" fill="#808080"/>
<rect x="6" y="6" width="26" height="26" fill="#fff"/>
<rect x="9" y="9" width="20" height="20" fill="#000"/>${r}
<text x="19" y="41" font-family="Arial, sans-serif" font-size="2.2" text-anchor="middle" fill="#333">${rotulo} · marcador v2 · quadrado preto = 20,0 mm · imprimir em 100%</text>
</svg>`;
};

// ------------------------------------------------------------------ escala sem marcador (EITA! OLHO)
// mm por pixel a partir de uma medida de referência conhecida (ex.: diâmetro horizontal da íris)
export const escalaPorDiametro = (diametro_mm, raio_px) => diametro_mm / (2 * raio_px);
// mm por pixel a partir de dois pontos de uma régua fotografada junto
export const escalaPorRegua = (p0, p1, distancia_mm) => distancia_mm / Math.hypot(p1.x - p0.x, p1.y - p0.y);

// ------------------------------------------------------------------ balanço de branco por clique
// ganhos R/G/B (0,5–2,5) que tornam neutra a média de uma janela (2·raio+1)² em torno de (x, y)
export function ganhosBranco(px, W, H, x, y, raio = 5) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let j = -raio; j <= raio; j++) for (let i = -raio; i <= raio; i++) {
    const xx = Math.max(0, Math.min(W - 1, Math.round(x + i))), yy = Math.max(0, Math.min(H - 1, Math.round(y + j))), o = (yy * W + xx) * 4;
    r += px[o]; g += px[o + 1]; b += px[o + 2]; n++;
  }
  r /= n; g /= n; b /= n; const m = Math.max(r, g, b);
  return [m / Math.max(r, 1), m / Math.max(g, 1), m / Math.max(b, 1)].map((v) => Math.max(0.5, Math.min(2.5, v)));
}
// aplica os ganhos a uma imagem RGBA → nova RGBA opaca
export function aplicarGanhos(px, ganhos) {
  const d = new Uint8ClampedArray(px.length);
  for (let i = 0; i < d.length; i += 4) { d[i] = Math.min(255, px[i] * ganhos[0]); d[i + 1] = Math.min(255, px[i + 1] * ganhos[1]); d[i + 2] = Math.min(255, px[i + 2] * ganhos[2]); d[i + 3] = 255; }
  return d;
}
