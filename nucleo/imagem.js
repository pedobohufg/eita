/* EITA núcleo · imagem — cor (Lab), filtros, limiar, morfologia e componentes.
   Imagens são {data: Uint8ClampedArray RGBA, width, height}; funções puras, rodam no navegador e no Node.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import { clamp, mediana } from "./base.js";

const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
const fLab = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

export function rgbParaLab(r, g, b) {
  const R = LIN[r], Gg = LIN[g], B = LIN[b];
  const x = (0.4124 * R + 0.3576 * Gg + 0.1805 * B) / 0.95047;
  const y = 0.2126 * R + 0.7152 * Gg + 0.0722 * B;
  const z = (0.0193 * R + 0.1192 * Gg + 0.9505 * B) / 1.08883;
  const fx = fLab(x), fy = fLab(y), fz = fLab(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};

export function paraLab(img) {
  const n = img.width * img.height, d = img.data;
  const L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const l = rgbParaLab(d[j], d[j + 1], d[j + 2]);
    L[i] = l[0]; A[i] = l[1]; B[i] = l[2];
  }
  return { L, A, B };
};

// desfoque gaussiano separável (kernel direto até sigma 4; acima, 3 passadas de caixa)
export function kernel(s) {
  const r = Math.max(1, Math.ceil(3 * s)), k = new Float32Array(2 * r + 1); let t = 0;
  for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-(i * i) / (2 * s * s)); t += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= t;
  return k;
}
function convLinhas(src, w, h, k) {
  const r = (k.length - 1) >> 1, out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += src[o + clamp(x + i, 0, w - 1)] * k[i + r];
      out[o + x] = s;
    }
  }
  return out;
}
function convColunas(src, w, h, k) {
  const r = (k.length - 1) >> 1, out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let i = -r; i <= r; i++) {
      const yy = clamp(y + i, 0, h - 1) * w, kk = k[i + r], o = y * w;
      for (let x = 0; x < w; x++) out[o + x] += src[yy + x] * kk;
    }
  }
  return out;
}
function caixa(src, w, h, r, horizontal) {
  const out = new Float32Array(w * h), n = 2 * r + 1;
  if (horizontal) {
    for (let y = 0; y < h; y++) {
      const o = y * w; let s = 0;
      for (let i = -r; i <= r; i++) s += src[o + clamp(i, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        out[o + x] = s / n;
        s += src[o + clamp(x + r + 1, 0, w - 1)] - src[o + clamp(x - r, 0, w - 1)];
      }
    }
  } else {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += src[clamp(i, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = s / n;
        s += src[clamp(y + r + 1, 0, h - 1) * w + x] - src[clamp(y - r, 0, h - 1) * w + x];
      }
    }
  }
  return out;
}
export function desfocar(src, w, h, s) {
  if (s <= 0.3) return Float32Array.from(src);
  if (s <= 4) { const k = kernel(s); return convColunas(convLinhas(src, w, h, k), w, h, k); }
  const r = Math.max(1, Math.round((Math.sqrt(12 * s * s / 3 + 1) - 1) / 2));
  let a = src;
  for (let p = 0; p < 3; p++) a = caixa(a, w, h, r, true);
  for (let p = 0; p < 3; p++) a = caixa(a, w, h, r, false);
  return a;
};
export function desfocar1d(arr, s, modo) {
  const k = kernel(s), r = (k.length - 1) >> 1, n = arr.length, out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let t = 0;
    for (let j = -r; j <= r; j++) {
      let q = i + j;
      if (modo === "wrap") q = ((q % n) + n) % n; else q = clamp(q, 0, n - 1);
      t += arr[q] * k[j + r];
    }
    out[i] = t;
  }
  return out;
};

export function otsu(v8, mascara) {
  const hist = new Float64Array(256); let tot = 0;
  for (let i = 0; i < v8.length; i++) if (!mascara || mascara[i]) { hist[v8[i]]++; tot++; }
  let soma = 0; for (let i = 0; i < 256; i++) soma += i * hist[i];
  let sB = 0, wB = 0, melhor = 0, t = 0;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]; if (!wB) continue;
    const wF = tot - wB; if (!wF) break;
    sB += i * hist[i];
    const mB = sB / wB, mF = (soma - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
    if (v > melhor) { melhor = v; t = i; }
  }
  return t;
};
export function normalizar8(src) {
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < src.length; i++) { if (src[i] < mn) mn = src[i]; if (src[i] > mx) mx = src[i]; }
  const out = new Uint8Array(src.length), f = 255 / (mx - mn || 1);
  for (let i = 0; i < src.length; i++) out[i] = Math.round((src[i] - mn) * f);
  return out;
};

// morfologia binária 3x3
function erodir(m, w, h) {
  const o = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (m[i] && m[i - 1] && m[i + 1] && m[i - w] && m[i + w] && m[i - w - 1] && m[i - w + 1] && m[i + w - 1] && m[i + w + 1]) o[i] = 1;
  }
  return o;
}
function dilatar(m, w, h) {
  const o = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!m[i]) continue;
    for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx >= 0 && xx < w) o[yy * w + xx] = 1; } }
  }
  return o;
}
export function abertura(m, w, h, it) { let a = m; for (let i = 0; i < it; i++) a = erodir(a, w, h); for (let i = 0; i < it; i++) a = dilatar(a, w, h); return a; };
export function preencherBuracos(m, w, h) {
  const fora = new Uint8Array(w * h), fila = new Int32Array(w * h); let ini = 0, fim = 0;
  const push = (i) => { if (!m[i] && !fora[i]) { fora[i] = 1; fila[fim++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (ini < fim) {
    const i = fila[ini++], x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
  }
  const o = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) o[i] = fora[i] ? 0 : 1;
  return o;
};
export function rotular(m, w, h) {
  const lab = new Int32Array(w * h), fila = new Int32Array(w * h), comps = [];
  let n = 0;
  for (let s = 0; s < w * h; s++) {
    if (!m[s] || lab[s]) continue;
    n++; let ini = 0, fim = 0; fila[fim++] = s; lab[s] = n;
    let area = 0, sx = 0, sy = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
    while (ini < fim) {
      const i = fila[ini++], x = i % w, y = (i / w) | 0;
      area++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= w) continue; const j = yy * w + xx; if (m[j] && !lab[j]) { lab[j] = n; fila[fim++] = j; } } }
    }
    comps.push({ id: n, area, cx: sx / area, cy: sy / area, x0, x1, y0, y1 });
  }
  return { lab, comps };
};
export function componenteProxima(m, w, h, px, py) {
  const { lab, comps } = rotular(m, w, h);
  if (!comps.length) return m;
  let melhor = null, v = -1;
  for (const c of comps) { const s = c.area / (1 + Math.hypot(c.cx - px, c.cy - py)); if (s > v) { v = s; melhor = c; } }
  const o = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) o[i] = lab[i] === melhor.id ? 1 : 0;
  return o;
}
export function elipseMomentos(m, w, h) {
  let n = 0, sx = 0, sy = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { n++; sx += x; sy += y; }
  const cx = sx / n, cy = sy / n; let xx = 0, yy = 0, xy = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { const dx = x - cx, dy = y - cy; xx += dx * dx; yy += dy * dy; xy += dx * dy; }
  xx /= n; yy /= n; xy /= n;
  const tr = xx + yy, det = xx * yy - xy * xy, disc = Math.sqrt(Math.max(tr * tr / 4 - det, 0));
  const l1 = tr / 2 + disc, l2 = tr / 2 - disc;
  let ang = 0.5 * Math.atan2(2 * xy, xx - yy) * 180 / Math.PI;
  ang = ((ang % 180) + 180) % 180;
  return { cx, cy, eixo_maior_px: 4 * Math.sqrt(l1), eixo_menor_px: 4 * Math.sqrt(Math.max(l2, 0)), angulo_graus: ang, area: n };
}
export function bilinear(arr, w, h, x, y) {
  x = clamp(x, 0, w - 1.001); y = clamp(y, 0, h - 1.001);
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
  return arr[i] * (1 - fx) * (1 - fy) + arr[i + 1] * fx * (1 - fy) + arr[i + w] * (1 - fx) * fy + arr[i + w + 1] * fx * fy;
};
export function medianaCanais(img, idx) {
  const r = new Float32Array(idx.length), g = new Float32Array(idx.length), b = new Float32Array(idx.length), d = img.data;
  idx.forEach((i, k) => { r[k] = d[4 * i]; g[k] = d[4 * i + 1]; b[k] = d[4 * i + 2]; });
  return [mediana(r), mediana(g), mediana(b)];
}
