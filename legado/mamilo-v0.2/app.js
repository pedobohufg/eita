/* EITA! MAMILO — © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
/* EITA!Mamilo web — núcleo de processamento (porte da v0.2 em Python). Lab.EITA / UFG.
   Funções puras sobre imagens {data:Uint8ClampedArray RGBA, width, height}. Roda no navegador e no Node. */
(function (G) {
  "use strict";
  const E = {};
  E.VERSAO = "0.2-web";
  const BRANCO_REF = 245, PRETO_REF = 25, CINZA_REF = 128;

  // ------------------------------------------------------------------ básicos
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  E.clamp = clamp;

  const LIN = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const fLab = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

  E.rgbParaLab = function (r, g, b) {
    const R = LIN[r], Gg = LIN[g], B = LIN[b];
    const x = (0.4124 * R + 0.3576 * Gg + 0.1805 * B) / 0.95047;
    const y = 0.2126 * R + 0.7152 * Gg + 0.0722 * B;
    const z = (0.0193 * R + 0.1192 * Gg + 0.9505 * B) / 1.08883;
    const fx = fLab(x), fy = fLab(y), fz = fLab(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  };

  E.lab = function (img) {
    const n = img.width * img.height, d = img.data;
    const L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const l = E.rgbParaLab(d[j], d[j + 1], d[j + 2]);
      L[i] = l[0]; A[i] = l[1]; B[i] = l[2];
    }
    return { L, A, B };
  };

  function amostra(arr, passo) {
    const out = new Float32Array(Math.ceil(arr.length / passo));
    for (let i = 0, k = 0; i < arr.length; i += passo, k++) out[k] = arr[i];
    return out;
  }
  E.percentil = function (arr, p, mascara) {
    let v;
    if (mascara) { const t = []; for (let i = 0; i < arr.length; i++) if (mascara[i]) t.push(arr[i]); v = Float32Array.from(t); }
    else v = arr.length > 400000 ? amostra(arr, Math.ceil(arr.length / 400000)) : Float32Array.from(arr);
    if (!v.length) return NaN;
    v.sort();
    const pos = (p / 100) * (v.length - 1), lo = Math.floor(pos), hi = Math.ceil(pos);
    return v[lo] + (v[hi] - v[lo]) * (pos - lo);
  };
  E.mediana = (arr, m) => E.percentil(arr, 50, m);
  function mediaDesvio(arr) {
    let s = 0, s2 = 0; const n = arr.length;
    for (let i = 0; i < n; i++) { s += arr[i]; s2 += arr[i] * arr[i]; }
    const m = s / n; return [m, Math.sqrt(Math.max(s2 / n - m * m, 0))];
  }

  // desfoque gaussiano separável (kernel direto até sigma 4; acima, 3 passadas de caixa)
  function kernel(s) {
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
  E.desfocar = function (src, w, h, s) {
    if (s <= 0.3) return Float32Array.from(src);
    if (s <= 4) { const k = kernel(s); return convColunas(convLinhas(src, w, h, k), w, h, k); }
    const r = Math.max(1, Math.round((Math.sqrt(12 * s * s / 3 + 1) - 1) / 2));
    let a = src;
    for (let p = 0; p < 3; p++) a = caixa(a, w, h, r, true);
    for (let p = 0; p < 3; p++) a = caixa(a, w, h, r, false);
    return a;
  };
  E.desfocar1d = function (arr, s, modo) {
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

  E.otsu = function (v8, mascara) {
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
  E.normalizar8 = function (src) {
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
  E.abertura = function (m, w, h, it) { let a = m; for (let i = 0; i < it; i++) a = erodir(a, w, h); for (let i = 0; i < it; i++) a = dilatar(a, w, h); return a; };
  E.preencherBuracos = function (m, w, h) {
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
  E.rotular = function (m, w, h) {
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
  function componenteProxima(m, w, h, px, py) {
    const { lab, comps } = E.rotular(m, w, h);
    if (!comps.length) return m;
    let melhor = null, v = -1;
    for (const c of comps) { const s = c.area / (1 + Math.hypot(c.cx - px, c.cy - py)); if (s > v) { v = s; melhor = c; } }
    const o = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) o[i] = lab[i] === melhor.id ? 1 : 0;
    return o;
  }
  function elipseMomentos(m, w, h) {
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
  E.bilinear = function (arr, w, h, x, y) {
    x = clamp(x, 0, w - 1.001); y = clamp(y, 0, h - 1.001);
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
    return arr[i] * (1 - fx) * (1 - fy) + arr[i + 1] * fx * (1 - fy) + arr[i + w] * (1 - fx) * fy + arr[i + w + 1] * fx * fy;
  };

  // geometria plana
  function cruz(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
  function casco(pts) {
    pts = pts.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cruz(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cruz(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    up.pop(); lo.pop(); return lo.concat(up);
  }
  function quadDoCasco(h) {
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
  E.areaPoligono = function (q) { let s = 0; for (let i = 0; i < q.length; i++) { const p = q[i], r = q[(i + 1) % q.length]; s += p[0] * r[1] - r[0] * p[1]; } return Math.abs(s) / 2; };
  E.escalarQuad = function (q, f) {
    const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
    return q.map((p) => [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f]);
  };
  function dentroConvexo(q, x, y) {
    let sinal = 0;
    for (let i = 0; i < q.length; i++) { const s = cruz(q[i], q[(i + 1) % q.length], [x, y]); if (s !== 0) { if (sinal === 0) sinal = Math.sign(s); else if (Math.sign(s) !== sinal) return false; } }
    return true;
  }
  E.mascaraQuad = function (w, h, q, fIn, fOut) {
    const qo = E.escalarQuad(q, fOut), qi = fIn > 0 ? E.escalarQuad(q, fIn) : null;
    const xs = qo.map((p) => p[0]), ys = qo.map((p) => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(w - 1, Math.ceil(Math.max(...xs)));
    const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(h - 1, Math.ceil(Math.max(...ys)));
    const idx = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (dentroConvexo(qo, x + 0.5, y + 0.5) && !(qi && dentroConvexo(qi, x + 0.5, y + 0.5))) idx.push(y * w + x);
    return idx;
  };
  E.ladosQuad = (q) => q.map((p, i) => Math.hypot(q[(i + 1) % 4][0] - p[0], q[(i + 1) % 4][1] - p[1]));

  // ------------------------------------------------------------------ marcador
  E.detectarMarcador = function (img) {
    const w = img.width, h = img.height, d = img.data, n = w * h;
    const cinza = new Float32Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) cinza[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
    const media = E.desfocar(cinza, w, h, Math.max(w, h) / 40);
    const escuro = new Uint8Array(n);
    for (let i = 0; i < n; i++) escuro[i] = cinza[i] < 0.62 * media[i] && cinza[i] < 110 ? 1 : 0;
    const { lab, comps } = E.rotular(escuro, w, h);
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
      const aq = E.areaPoligono(q), ah = E.areaPoligono(hull);
      if (aq / ah < 0.93) continue;
      const lados = E.ladosQuad(q), lm = lados.reduce((s, v) => s + v, 0) / 4;
      if (Math.max(...lados) / Math.min(...lados) > 1.35) continue;
      const fracEsc = c.area / aq;
      if (fracEsc < 0.3 || fracEsc > 0.9) continue;
      const dentro = E.mascaraQuad(w, h, q, 0, 0.9), anel = E.mascaraQuad(w, h, q, 1.04, 1.13);
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
  function medianaCanais(img, idx) {
    const r = new Float32Array(idx.length), g = new Float32Array(idx.length), b = new Float32Array(idx.length), d = img.data;
    idx.forEach((i, k) => { r[k] = d[4 * i]; g[k] = d[4 * i + 1]; b[k] = d[4 * i + 2]; });
    return [E.mediana(r), E.mediana(g), E.mediana(b)];
  }
  E.calibrarCor = function (img, q) {
    const w = img.width, h = img.height, d = img.data;
    const dentro = E.mascaraQuad(w, h, q, 0, 0.92);
    const cz = dentro.map((i) => 0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2]);
    const t = E.mediana(Float32Array.from(cz));
    const preto = medianaCanais(img, dentro.filter((_, k) => cz[k] < t));
    const branco = medianaCanais(img, E.mascaraQuad(w, h, q, 1.06, 1.24));
    const anelIdx = E.mascaraQuad(w, h, q, 1.36, 1.54), filIdx = E.mascaraQuad(w, h, q, 1.62, 1.68);
    let ref = null, alvo, claro;
    if (anelIdx.length && filIdx.length) {
      const m = medianaCanais(img, anelIdx), f = medianaCanais(img, filIdx);
      const estrutura = [0, 1, 2].every((c) => Math.abs(f[c] - branco[c]) < 20 && branco[c] - m[c] > 40);
      const meio = [0, 1, 2].every((c) => m[c] - preto[c] > 30);
      let dev = []; for (const i of anelIdx) dev.push(Math.abs(d[4 * i] - m[0]) + Math.abs(d[4 * i + 1] - m[1]) + Math.abs(d[4 * i + 2] - m[2]));
      const unif = E.mediana(Float32Array.from(dev)) / 3 < 12;
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

  // ------------------------------------------------------------------ segmentação
  E.mapaScore = function (img, labImg) {
    const w = img.width, h = img.height, n = w * h, { L, A } = labImg || E.lab(img);
    const mL = E.mediana(L), mA = E.mediana(A), [, dL] = mediaDesvio(L), [, dA] = mediaDesvio(A);
    const s = new Float32Array(n);
    for (let i = 0; i < n; i++) s[i] = -(L[i] - mL) / (dL + 1e-6) + 0.7 * (A[i] - mA) / (dA + 1e-6);
    return E.desfocar(s, w, h, Math.max(2, Math.min(w, h) / 300));
  };

  E.segmentarAuto = function (img, cantos, score) {
    const w = img.width, h = img.height, n = w * h;
    const s8 = E.normalizar8(score), excl = new Uint8Array(n);
    if (cantos) {
      const xs = cantos.map((p) => p[0]), ys = cantos.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), m = 0.45 * (x1 - x0);
      for (let y = Math.max(0, (y0 - m) | 0); y < Math.min(h, y1 + m); y++) for (let x = Math.max(0, (x0 - m) | 0); x < Math.min(w, x1 + m); x++) excl[y * w + x] = 1;
    }
    const valido = new Uint8Array(n); for (let i = 0; i < n; i++) { valido[i] = excl[i] ? 0 : 1; if (excl[i]) s8[i] = 0; }
    const t = E.otsu(s8, valido);
    let m = new Uint8Array(n); for (let i = 0; i < n; i++) m[i] = s8[i] > t && !excl[i] ? 1 : 0;
    m = E.preencherBuracos(E.abertura(m, w, h, 3), w, h);
    m = componenteProxima(m, w, h, w / 2, h / 2);
    const el = elipseMomentos(m, w, h);
    if (!(el.area > 50)) throw new Error("Não foi possível encontrar a aréola. Ajuste o contorno manualmente.");
    const seg = { areola: { cx: el.cx, cy: el.cy, eixo_maior_px: el.eixo_maior_px, eixo_menor_px: el.eixo_menor_px, angulo_graus: el.angulo_graus }, papila: null };
    const d2 = el.eixo_menor_px, centro = new Uint8Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (Math.hypot(x - el.cx, y - el.cy) < 0.33 * d2) centro[y * w + x] = 1;
    const t2 = E.percentil(score, 70, centro);
    let cand = new Uint8Array(n); for (let i = 0; i < n; i++) cand[i] = centro[i] && score[i] > t2 ? 1 : 0;
    cand = componenteProxima(E.abertura(cand, w, h, 2), w, h, el.cx, el.cy);
    let area = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) if (cand[i]) { area++; sx += i % w; sy += (i / w) | 0; }
    if (area > 30) { const eq = 2 * Math.sqrt(area / Math.PI); if (eq > 0.12 * d2 && eq < 0.5 * d2) seg.papila = { cx: sx / area, cy: sy / area, diam_px: eq }; }
    return { seg, mascara: m };
  };

  E.refinarPapila = function (score, w, h, pap) {
    let cx = pap.cx, cy = pap.cy, r0 = pap.diam_px / 2;
    const g = E.desfocar(score, w, h, Math.max(1, 0.04 * r0));
    const NR = 90, NS = 120; let frac = 0;
    for (let it = 0; it < 3; it++) {
      const perf = []; const X = [], Y = [];
      for (let a = 0; a < NR; a++) {
        const ang = (2 * Math.PI * a) / NR, row = new Float64Array(NS), xr = [], yr = [];
        for (let s = 0; s < NS; s++) { const r = r0 * (0.45 + (1.35 * s) / (NS - 1)); const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r; row[s] = E.bilinear(g, w, h, x, y); xr.push(x); yr.push(y); }
        perf.push(row); X.push(xr); Y.push(yr);
      }
      // média angular (sigma 2 raios) e suavização radial
      const sm = [];
      const ka = kernel(2), ra = (ka.length - 1) >> 1;
      for (let a = 0; a < NR; a++) { const row = new Float64Array(NS); for (let j = -ra; j <= ra; j++) { const q = perf[((a + j) % NR + NR) % NR]; for (let s = 0; s < NS; s++) row[s] += q[s] * ka[j + ra]; } sm.push(E.desfocar1d(row, 2)); }
      const px = [], py = [], rad = [];
      for (let a = 0; a < NR; a++) {
        let best = Infinity, ib = 0;
        for (let s = 1; s < NS - 1; s++) { const dd = (sm[a][s + 1] - sm[a][s - 1]) / 2; if (dd < best) { best = dd; ib = s; } }
        px.push(X[a][ib]); py.push(Y[a][ib]); rad.push(r0 * (0.45 + (1.35 * ib) / (NS - 1)));
      }
      const med = E.mediana(Float32Array.from(rad)), mad = E.mediana(Float32Array.from(rad.map((r) => Math.abs(r - med))));
      const ok = rad.map((r) => Math.abs(r - med) < 2.5 * (mad + 1e-6) + 0.05 * r0);
      // ajuste de círculo de Kasa
      let a11 = 0, a12 = 0, a13 = 0, a22 = 0, a23 = 0, a33 = 0, b1 = 0, b2 = 0, b3 = 0, nOk = 0;
      for (let i = 0; i < NR; i++) {
        if (!ok[i]) continue; nOk++;
        const x = 2 * px[i], y = 2 * py[i], z = px[i] * px[i] + py[i] * py[i];
        a11 += x * x; a12 += x * y; a13 += x; a22 += y * y; a23 += y; a33 += 1; b1 += x * z; b2 += y * z; b3 += z;
      }
      const sol = resolver3([[a11, a12, a13], [a12, a22, a23], [a13, a23, a33]], [b1, b2, b3]);
      if (!sol) break;
      cx = sol[0]; cy = sol[1]; r0 = Math.sqrt(sol[2] + cx * cx + cy * cy); frac = nOk / NR;
    }
    return { pap: { cx, cy, diam_px: 2 * r0 }, frac };
  };
  function resolver3(A, b) {
    const M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < 3; c++) {
      let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < 3; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k]; }
    }
    return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
  }
  E.resolver3 = resolver3;

  // ------------------------------------------------------------------ paleta
  const hex = (rgb) => "#" + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
  E.hex = hex;
  E.paleta = function (img, seg) {
    const w = img.width, h = img.height, a = seg.areola, p = seg.papila;
    const th = (a.angulo_graus * Math.PI) / 180, c = Math.cos(th), s = Math.sin(th);
    const A2 = a.eixo_maior_px / 2, B2 = a.eixo_menor_px / 2;
    const ar = [], pele = [], pap = [];
    const R = Math.max(A2, B2) * 1.5;
    for (let y = Math.max(0, (a.cy - R) | 0); y < Math.min(h, a.cy + R); y++) for (let x = Math.max(0, (a.cx - R) | 0); x < Math.min(w, a.cx + R); x++) {
      const dx = x - a.cx, dy = y - a.cy, xr = dx * c + dy * s, yr = -dx * s + dy * c;
      const rho = Math.sqrt((xr / A2) ** 2 + (yr / B2) ** 2), dp = Math.hypot(x - p.cx, y - p.cy);
      const i = y * w + x;
      if (dp < 0.8 * p.diam_px / 2) pap.push(i);
      else if (rho < 0.95 && dp > 1.2 * p.diam_px / 2) ar.push(i);
      else if (rho > 1.12 && rho < 1.45) pele.push(i);
    }
    return { areola: hex(medianaCanais(img, ar)), papila: hex(medianaCanais(img, pap)), pele: hex(medianaCanais(img, pele)) };
  };

  // ------------------------------------------------------------------ foto lateral
  function polyfit2(x, y) {
    let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0;
    for (let i = 0; i < x.length; i++) { const a = x[i], a2 = a * a; s0++; s1 += a; s2 += a2; s3 += a2 * a; s4 += a2 * a2; t0 += y[i]; t1 += a * y[i]; t2 += a2 * y[i]; }
    const r = resolver3([[s4, s3, s2], [s3, s2, s1], [s2, s1, s0]], [t2, t1, t0]);
    return r || [0, 0, y.reduce((p, q) => p + q, 0) / y.length];
  }
  function regiaoConexa1d(mask, i) { let a = i, b = i; while (a > 0 && mask[a - 1]) a--; while (b < mask.length - 1 && mask[b + 1]) b++; return [a, b]; }

  E.analisarLateral = function (img, opc) {
    opc = opc || {};
    const w = img.width, h = img.height, n = w * h, avisos = [];
    let k = opc.px_por_mm, cantos = opc.cantos || null;
    if (!k) {
      const mk = E.detectarMarcador(img);
      if (!mk) throw new Error("Foto lateral: marcador não encontrado. Informe a escala (px/mm) ou refaça a foto com o marcador visível.");
      cantos = mk.cantos; k = mk.lado_px / (opc.marcador_mm || 20);
    }
    const { L, A } = E.lab(img), [mL, dL] = mediaDesvio(L), [mA, dA] = mediaDesvio(A);
    let sc = new Float32Array(n); for (let i = 0; i < n; i++) sc[i] = (L[i] - mL) / (dL + 1e-6) + (A[i] - mA) / (dA + 1e-6);
    sc = E.desfocar(sc, w, h, Math.max(1.5, 0.15 * k));
    const s8 = E.normalizar8(sc);
    if (cantos) {
      const xs = cantos.map((p) => p[0]), ys = cantos.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), m = 0.5 * (x1 - x0);
      for (let y = Math.max(0, (y0 - m) | 0); y < Math.min(h, y1 + m); y++) for (let x = Math.max(0, (x0 - m) | 0); x < Math.min(w, x1 + m); x++) s8[y * w + x] = 0;
    }
    const t = E.otsu(s8);
    let corpo = new Uint8Array(n); for (let i = 0; i < n; i++) corpo[i] = s8[i] > t ? 1 : 0;
    corpo = E.abertura(corpo, w, h, 2);
    const { lab, comps } = E.rotular(corpo, w, h);
    if (!comps.length) throw new Error("Foto lateral: silhueta não encontrada. Use fundo liso escuro.");
    const maior = comps.reduce((p, c) => (c.area > p.area ? c : p));
    corpo = new Uint8Array(n); for (let i = 0; i < n; i++) corpo[i] = lab[i] === maior.id ? 1 : 0;
    corpo = E.preencherBuracos(corpo, w, h);
    let esq = 0, dir = 0; const q4 = (w / 4) | 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < q4; x++) { esq += corpo[y * w + x]; dir += corpo[y * w + w - 1 - x]; }
    const ladoCorpo = opc.lado_corpo && opc.lado_corpo !== "auto" ? opc.lado_corpo : esq > dir ? "esquerda" : "direita";
    const linhas = [], borda = [];
    for (let y = 0; y < h; y++) {
      let e = -1;
      if (ladoCorpo === "esquerda") { for (let x = w - 1; x >= 0; x--) if (corpo[y * w + x]) { e = x; break; } }
      else { for (let x = 0; x < w; x++) if (corpo[y * w + x]) { e = w - 1 - x; break; } }
      if (e >= 0 && e < w - 2) { linhas.push(y); borda.push(e); }
    }
    if (borda.length < 20) throw new Error("Foto lateral: perfil insuficiente.");
    const bs = E.desfocar1d(borda, Math.max(1, 0.1 * k));
    const N = bs.length, yv = Float64Array.from({ length: N }, (_, i) => i);
    // linha de base quadrática local, excluindo a papila
    const hp = E.desfocar1d(bs, 8 * k); let pico = 0, mx = -Infinity;
    for (let i = 0; i < N; i++) { const r = bs[i] - hp[i]; if (r > mx) { mx = r; pico = i; } }
    let meia = 5 * k, base = null; const jan = 25 * k;
    for (let it = 0; it < 4; it++) {
      const xs = [], ys = [];
      for (let i = 0; i < N; i++) { const d = Math.abs(i - pico); if (d <= jan && d > meia) { xs.push(i - pico); ys.push(bs[i]); } }
      if (xs.length < 10) break;
      const c = polyfit2(xs, ys);
      base = new Float64Array(N); for (let i = 0; i < N; i++) { const u = i - pico; base[i] = c[0] * u * u + c[1] * u + c[2]; }
      let bv = -Infinity, bi = pico;
      for (let i = 0; i < N; i++) if (Math.abs(i - pico) <= jan) { const r = bs[i] - base[i]; if (r > bv) { bv = r; bi = i; } }
      pico = bi;
      const acima = new Uint8Array(N); for (let i = 0; i < N; i++) acima[i] = bs[i] - base[i] > 0.05 * bv ? 1 : 0;
      const [a0, a1] = regiaoConexa1d(acima, pico);
      meia = Math.max(Math.abs(a0 - pico), Math.abs(a1 - pico)) + 2 * k;
    }
    if (!base) base = hp;
    const res = new Float64Array(N); for (let i = 0; i < N; i++) res[i] = (bs[i] - base[i]) / k;
    let p0 = 0; for (let i = 0; i < N; i++) if (res[i] > res[p0]) p0 = i;
    const proj = res[p0];
    const pl = new Uint8Array(N); for (let i = 0; i < N; i++) pl[i] = res[i] > 0.9 * proj ? 1 : 0;
    const [pa, pb] = regiaoConexa1d(pl, p0); const pc = Math.round((pa + pb) / 2);
    const ac = new Uint8Array(N); for (let i = 0; i < N; i++) ac[i] = res[i] > 0.1 * proj ? 1 : 0;
    const [ra, rb] = regiaoConexa1d(ac, pc); const largura = (linhas[rb] - linhas[ra]) / k;
    const rmax = (largura / 2) * 1.3, NRr = 60, r = [], hperf = [];
    const interp = (dir) => (rr) => { let i = pc; while (i + dir >= 0 && i + dir < N && Math.abs(linhas[i + dir] - linhas[pc]) / k < rr) i += dir; const j = i + dir; if (j < 0 || j >= N) return 0; const d0 = Math.abs(linhas[i] - linhas[pc]) / k, d1 = Math.abs(linhas[j] - linhas[pc]) / k; const f = (rr - d0) / (d1 - d0 || 1); return res[i] + (res[j] - res[i]) * f; };
    const lA = interp(-1), lB = interp(1); let assim = 0;
    for (let i = 0; i < NRr; i++) { const rr = (rmax * i) / (NRr - 1); const a = lA(rr), b = lB(rr); r.push(rr); hperf.push(Math.max(0, (a + b) / 2)); assim = Math.max(assim, Math.abs(a - b)); }
    if (assim > 0.25 * proj) avisos.push("Perfil lateral assimétrico (>25%): papila inclinada ou foto fora do eixo.");
    if (proj < 1) avisos.push("Projeção < 1 mm: papila plana/invertida ou silhueta mal segmentada.");
    let hs = E.desfocar1d(hperf, 1.5); for (let i = 1; i < hs.length; i++) hs[i] = Math.min(hs[i], hs[i - 1]);
    const f0 = proj / Math.max(hs[0], 1e-6); hs = Array.from(hs, (v) => v * f0);
    let melhor = [Infinity, rmax / 1.3, 4];
    for (let a = 0; a < 27; a++) { const nn = 1.5 + (6.5 * a) / 26; for (let b = 0; b < 36; b++) { const r0 = (0.5 + (0.7 * b) / 35) * largura / 2; let e = 0; for (let i = 0; i < r.length; i++) { const u = Math.min(r[i] / r0, 1); e += (proj * Math.pow(1 - Math.pow(u, nn), 1 / nn) - hs[i]) ** 2; } e /= r.length; if (e < melhor[0]) melhor = [e, r0, nn]; } }
    return {
      px_por_mm: k, cantos, lado_corpo: ladoCorpo, projecao_mm: +proj.toFixed(2), largura_base_mm: +largura.toFixed(2),
      forma_n: +melhor[2].toFixed(2), raio_ajuste_mm: +melhor[1].toFixed(2), rms_ajuste_mm: +Math.sqrt(melhor[0]).toFixed(3),
      perfil_r_mm: r, perfil_h_mm: hs, avisos,
      _debug: { linhas, borda: Array.from(bs), base: Array.from(base), centro: pc }
    };
  };

  // ------------------------------------------------------------------ geometria
  E.PARAMETROS = {
    marcador_mm: 20, raio_mama_mm: 80, esp_centro_mm: 1.2, esp_borda_mm: 0.15, largura_afinamento: 0.35, margem_mm: 2,
    relevo_amp_mm: 0.25, relevo_sigma_mm: 1.5, relevo_inverter: false, papila_diam_mm: null, papila_proj_mm: 6,
    textura_papila: { ativa: true, intensidade: 1, lobulo_mm: 1.3, sulco_mm: 0.1, ostios: 8, ostio_mm: 0.45, ruga_amp_mm: 0.06, ruga_passo_mm: 0.9, sulco_basal_mm: 0.18, irregularidade: 0.04, semente: 7 },
    resolucao_mm: 0.15, parede_molde_mm: 3, folga_pino_mm: 0.2, canal_transbordo_mm: 1, espelhar: false
  };

  function gauss2d(Z, n, s) { return E.desfocar(Z, n, n, s); }

  E.geometria = function (img, seg, k, p, lateral, cacheRelevo) {
    const a_ = seg.areola, pp = seg.papila, cx = a_.cx, cy = a_.cy;
    const a = a_.eixo_maior_px / k / 2, b = a_.eixo_menor_px / k / 2;
    const th = (-a_.angulo_graus * Math.PI) / 180, ct = Math.cos(th), st = Math.sin(th);
    const ext = Math.max(a, b) + p.margem_mm + 12;
    const n = Math.ceil((2 * ext) / p.resolucao_mm) + 1, N = n * n;
    const xs = new Float64Array(n); for (let i = 0; i < n; i++) xs[i] = -ext + (2 * ext * i) / (n - 1);
    const rhoOut = 1 + p.margem_mm / Math.min(a, b), R = p.raio_mama_mm;
    const S = new Float32Array(N), T = new Float32Array(N), rho = new Float32Array(N), dentro = new Uint8Array(N);
    // relevo: passa-alta da luminância
    let hp = cacheRelevo && cacheRelevo.sigma === p.relevo_sigma_mm && cacheRelevo.img === img ? cacheRelevo.hp : null;
    if (!hp) {
      const w = img.width, h = img.height, Lm = E.lab(img).L;
      const bl = E.desfocar(Lm, w, h, p.relevo_sigma_mm * k);
      hp = new Float32Array(w * h); for (let i = 0; i < w * h; i++) hp[i] = Lm[i] - bl[i];
      hp = E.desfocar(hp, w, h, Math.max(0.6, 0.15 * k));
      if (cacheRelevo) { cacheRelevo.hp = hp; cacheRelevo.sigma = p.relevo_sigma_mm; cacheRelevo.img = img; }
    }
    const rel = new Float32Array(N), absIn = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const X = xs[i], Y = xs[j], q = j * n + i;
      const xr = X * ct + Y * st, yr = -X * st + Y * ct;
      rho[q] = Math.sqrt((xr / a) ** 2 + (yr / b) ** 2);
      dentro[q] = rho[q] <= rhoOut ? 1 : 0;
      S[q] = Math.sqrt(R * R - Math.min(X * X + Y * Y, (0.95 * R) ** 2)) - R;
      rel[q] = E.bilinear(hp, img.width, img.height, cx + X * k, cy - Y * k);
      if (rho[q] <= 1) absIn.push(Math.abs(rel[q]));
    }
    const esc = E.percentil(Float32Array.from(absIn), 98) + 1e-6, sg = p.relevo_inverter ? -1 : 1;
    const dp = p.papila_diam_mm || pp.diam_px / k;
    const ox = (pp.cx - cx) / k, oy = -(pp.cy - cy) / k;
    const nForma = lateral ? lateral.forma_n : 4;
    const proj = lateral && !p.papila_proj_forcada ? lateral.projecao_mm : p.papila_proj_mm;
    let cup = new Float32Array(N);
    const TX = p.textura_papila && p.textura_papila.ativa ? p.textura_papila : null;
    const lob = TX ? contornoLobulado(TX) : () => 1;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const dx = xs[i] - ox, dy = xs[j] - oy, rp = Math.hypot(dx, dy) / (dp / 2) / lob(Math.atan2(dy, dx)); cup[j * n + i] = rp < 1 ? Math.pow(1 - Math.pow(rp, nForma), 1 / nForma) : 0; }
    cup = gauss2d(cup, n, 0.4 / p.resolucao_mm);
    const texP = TX ? E.texturaPapila(xs, n, ox, oy, dp / 2, proj, cup, lob, TX) : null;
    for (let q = 0; q < N; q++) {
      const i = q % n, j = (q / n) | 0;
      const u = clamp((rho[q] - (rhoOut - p.largura_afinamento)) / p.largura_afinamento, 0, 1);
      const perfil = 0.5 * (1 + Math.cos(Math.PI * u));
      let t = p.esp_borda_mm + (p.esp_centro_mm - p.esp_borda_mm) * perfil;
      const r = clamp((sg * rel[q]) / esc, -1, 1) * p.relevo_amp_mm;
      const jan = clamp((1 - rho[q]) / 0.12, 0, 1);
      const rp = Math.hypot(xs[i] - ox, xs[j] - oy) / (dp / 2);
      t += r * jan * perfil * clamp((rp - 1) / 0.25, 0, 1) + proj * cup[q] + (texP ? texP[q] : 0);
      T[q] = dentro[q] ? t : 0;
    }
    let Tf = T, Df = dentro, Rf = rho;
    if (p.espelhar) {
      Tf = new Float32Array(N); Df = new Uint8Array(N); Rf = new Float32Array(N);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const s = j * n + (n - 1 - i), d = j * n + i; Tf[d] = T[s]; Df[d] = dentro[s]; Rf[d] = rho[s]; }
    }
    const F = new Float32Array(N); for (let q = 0; q < N; q++) F[q] = S[q] + Tf[q];
    return { n, xs, S, T: Tf, F, dentro: Df, rho: Rf, rho_out: rhoOut, a, b, ext, papila_diam_mm: dp, papila_proj_mm: proj, papila_offset_mm: [p.espelhar ? -ox : ox, oy] };
  };

  // ------------------------------------------------------------------ textura anatômica da papila
  // Referências: topo "em paralelepípedo" cruzado por sulcos rasos, com 5 a 12 óstios no fundo dos
  // sulcos, e sulco papilar raso na base (Petrović et al., Acta Med Medianae 2022); 4 a 18 óstios
  // (Ramsay et al., J Anat 2005); músculo circular (Sappey) na parede e na base da papila.
  function hash2(i, j, s) { let h = (i * 374761393 + j * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function ruido(x, y, s) {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
  }
  function fbm(x, y, s) { return 0.6 * ruido(x, y, s) + 0.3 * ruido(2.1 * x, 2.1 * y, s + 11) + 0.1 * ruido(4.3 * x, 4.3 * y, s + 23); }
  function contornoLobulado(TX) {
    const ph = [1, 2, 3, 4].map((k) => hash2(k, 99, TX.semente) * 2 * Math.PI), am = [0.45, 0.3, 0.15, 0.1];
    return (t) => 1 + TX.irregularidade * am.reduce((s, a, k) => s + a * Math.sin((k + 2) * t + ph[k]), 0);
  }
  E.texturaPapila = function (xs, n, ox, oy, Rp, proj, cup, lob, TX) {
    const dx = xs[1] - xs[0], N = n * n, out = new Float32Array(N), k = TX.intensidade, sem = TX.semente;
    const H = (i, j) => proj * cup[clamp(j, 0, n - 1) * n + clamp(i, 0, n - 1)];
    // células de Worley (lóbulos do topo)
    const L = TX.lobulo_mm, cel = (ci, cj) => [(ci + 0.15 + 0.7 * hash2(ci, cj, sem + 5)) * L, (cj + 0.15 + 0.7 * hash2(ci, cj, sem + 6)) * L];
    // óstios: pontos no topo, separados por >= 0.8 mm, puxados para o sulco mais próximo
    const ost = []; let tent = 0;
    while (ost.length < TX.ostios && tent++ < 500) {
      const a = 2 * Math.PI * hash2(tent, 1, sem + 31), r = Rp * 0.55 * Math.sqrt(hash2(tent, 2, sem + 37));
      const x = r * Math.cos(a), y = r * Math.sin(a);
      if (ost.every((o) => Math.hypot(o[0] - x, o[1] - y) >= 0.8)) ost.push([x, y]);
    }
    const i0 = Math.max(1, Math.floor((ox - 1.6 * Rp - xs[0]) / dx)), i1 = Math.min(n - 2, Math.ceil((ox + 1.6 * Rp - xs[0]) / dx));
    const j0 = Math.max(1, Math.floor((oy - 1.6 * Rp - xs[0]) / dx)), j1 = Math.min(n - 2, Math.ceil((oy + 1.6 * Rp - xs[0]) / dx));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const q = j * n + i, x = xs[i] - ox, y = xs[j] - oy, r = Math.hypot(x, y), t = Math.atan2(y, x);
      const Re = Rp * lob(t), h0 = proj * cup[q], hn = proj > 0 ? h0 / proj : 0;
      let d = 0;
      // 1) topo: sulcos entre lóbulos (F2 - F1 de Worley) + leve abaulamento de cada lóbulo
      const wTopo = clamp((hn - 0.55) / 0.3, 0, 1);
      if (wTopo > 0) {
        // coordenadas deformadas: sulcos sinuosos, não poligonais
        const wx = x + 0.35 * L * fbm(x / L * 0.9, y / L * 0.9, sem + 51), wy = y + 0.35 * L * fbm(x / L * 0.9 + 7.3, y / L * 0.9, sem + 53);
        const ci = Math.floor(wx / L), cj = Math.floor(wy / L); let f1 = 1e9, f2 = 1e9;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const c = cel(ci + a, cj + b), dd = Math.hypot(c[0] - wx, c[1] - wy); if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd; }
        const borda = f2 - f1, sulco = Math.exp(-(borda * borda) / (2 * 0.13 * 0.13));
        const forca = clamp(0.55 + 0.6 * fbm(x * 0.8 + 3, y * 0.8, sem + 57), 0, 1);   // alguns sulcos somem
        d += wTopo * (-TX.sulco_mm * sulco * forca + 0.3 * TX.sulco_mm * Math.pow(1 - Math.min(f1 / (0.75 * L), 1), 1.5) + 0.025 * fbm(x * 3.5, y * 3.5, sem + 3));
        for (const o of ost) { const e = Math.hypot(x - o[0], y - o[1]) / (TX.ostio_mm / 2); if (e < 2.5) d -= wTopo * 0.18 * Math.exp(-e * e * 1.4); }
      }
      // 2) parede: rugas circunferenciais irregulares (deslocamento radial convertido em altura pela inclinação)
      const gx = (H(i + 1, j) - H(i - 1, j)) / (2 * dx), gy = (H(i, j + 1) - H(i, j - 1)) / (2 * dx), incl = Math.hypot(gx, gy);
      const wParede = clamp(hn / 0.08, 0, 1) * clamp((0.97 - hn) / 0.15, 0, 1);
      if (wParede > 0 && incl > 0.05) {
        const quebra = clamp(0.35 + 0.9 * fbm(Math.cos(t) * 3.1, Math.sin(t) * 3.1 + h0 * 0.7, sem + 41), 0, 1);
        const fase = 4.5 * fbm(Math.cos(t) * 1.6 + 5, Math.sin(t) * 1.6 + h0 * 0.3, sem + 43);
        const passo = TX.ruga_passo_mm * (1 + 0.35 * fbm(Math.cos(t) * 2 + 9, Math.sin(t) * 2, sem + 47));
        const eps = TX.ruga_amp_mm * (quebra * Math.sin((2 * Math.PI * h0) / passo + fase) + 0.35 * fbm(t * 6, h0 * 2.5, sem + 49));
        d += wParede * clamp(incl * eps, -0.35, 0.35);
      }
      // 3) sulco papilar raso na base
      const db = r - Re; d -= TX.sulco_basal_mm * Math.exp(-((db - 0.35) ** 2) / (2 * 0.3 * 0.3));
      out[q] = k * d;
    }
    return out;
  };

  // ------------------------------------------------------------------ malhas
  E.moldes = function (G, parede, folga, canalProf) {
    const { n, xs, S, F, dentro, rho, rho_out } = G, N = n * n, lado = G.ext - 1, aMin = Math.min(G.a, G.b), c = lado - 5;
    const ginf = new Float32Array(N), sc = new Float32Array(N), bloco = new Uint8Array(N);
    let zmax = -Infinity, zmin = Infinity;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const q = j * n + i, X = xs[i], Y = xs[j];
      bloco[q] = Math.abs(X) <= lado && Math.abs(Y) <= lado ? 1 : 0;
      let pino = 0, furo = 0;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const r = Math.hypot(X - sx * c, Y - sy * c);
        pino = Math.max(pino, Math.max(3 - r, 0));
        furo = Math.max(furo, Math.max(3 + folga - r, 0) + (r < 3 + folga ? folga : 0));
      }
      const canal = Math.abs(rho[q] - (rho_out + 2.5 / aMin)) < 1.2 / aMin;
      ginf[q] = (dentro[q] ? F[q] : S[q]) + furo;
      sc[q] = S[q] - (canal ? canalProf : 0) + pino;
      if (dentro[q] && F[q] > zmax) zmax = F[q];
      if (bloco[q] && S[q] < zmin) zmin = S[q];
    }
    const zTop = zmax + parede, zBot = zmin - parede;
    return { frente: [ginf, new Float32Array(N).fill(zTop), bloco], contra: [new Float32Array(N).fill(zBot), sc, bloco], zTop, zBot };
  };

  E.indicesAdaptativos = function (xs, zonaFina, passoGrosso) {
    const dx = xs[1] - xs[0], salto = Math.max(1, Math.round(passoGrosso / dx)), out = [];
    for (let i = 0; i < xs.length; i++) if (Math.abs(xs[i]) <= zonaFina || i % salto === 0 || i === 0 || i === xs.length - 1) out.push(i);
    return out;
  };

  // sólido fechado entre dois campos de altura (grade idx×idx), com faces planas opcionais em leque
  E.solido = function (xs, idx, n, Zb, Zt, mask, cimaPlano, baixoPlano) {
    const m = idx.length, no = (a, b) => idx[a] * n + idx[b];
    const cel = new Uint8Array((m - 1) * (m - 1));
    const usado = new Uint8Array(m * m);
    for (let j = 0; j < m - 1; j++) for (let i = 0; i < m - 1; i++)
      if (mask[no(j, i)] && mask[no(j + 1, i)] && mask[no(j, i + 1)] && mask[no(j + 1, i + 1)]) {
        cel[j * (m - 1) + i] = 1; usado[j * m + i] = usado[(j + 1) * m + i] = usado[j * m + i + 1] = usado[(j + 1) * m + i + 1] = 1;
      }
    const vid = new Int32Array(m * m).fill(-1); let nv = 0;
    for (let q = 0; q < m * m; q++) if (usado[q]) vid[q] = nv++;
    const extra = 2;
    const V = new Float32Array((2 * nv + extra) * 3);
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
      const v = vid[j * m + i]; if (v < 0) continue;
      const g = no(j, i), x = xs[idx[i]], y = xs[idx[j]];
      V.set([x, y, Zt[g]], 3 * v); V.set([x, y, Zb[g]], 3 * (v + nv));
    }
    const F = [];
    const tri = (a, b, c) => { F.push(a, b, c); };
    // laço do contorno (máscara retangular)
    let laco = null;
    if (cimaPlano || baixoPlano) {
      let j0 = m, j1 = -1, i0 = m, i1 = -1, cnt = 0;
      for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) if (usado[j * m + i]) { cnt++; if (j < j0) j0 = j; if (j > j1) j1 = j; if (i < i0) i0 = i; if (i > i1) i1 = i; }
      if (cnt === (j1 - j0 + 1) * (i1 - i0 + 1)) {
        laco = [];
        for (let i = i0; i < i1; i++) laco.push(vid[j0 * m + i]);
        for (let j = j0; j < j1; j++) laco.push(vid[j * m + i1]);
        for (let i = i1; i > i0; i--) laco.push(vid[j1 * m + i]);
        for (let j = j1; j > j0; j--) laco.push(vid[j * m + i0]);
      }
    }
    let prox = 2 * nv;
    const leque = (off, cima) => {
      let sx = 0, sy = 0, sz = 0;
      for (const v of laco) { sx += V[3 * (v + off)]; sy += V[3 * (v + off) + 1]; sz += V[3 * (v + off) + 2]; }
      const c = prox++; V.set([sx / laco.length, sy / laco.length, sz / laco.length], 3 * c);
      for (let t = 0; t < laco.length; t++) { const a = laco[t] + off, b = laco[(t + 1) % laco.length] + off; if (cima) tri(c, a, b); else tri(c, b, a); }
    };
    if (cimaPlano && laco) leque(0, true);
    else for (let j = 0; j < m - 1; j++) for (let i = 0; i < m - 1; i++) if (cel[j * (m - 1) + i]) { const a = vid[j * m + i], b = vid[j * m + i + 1], c = vid[(j + 1) * m + i], d = vid[(j + 1) * m + i + 1]; tri(a, b, d); tri(a, d, c); }
    if (baixoPlano && laco) leque(nv, false);
    else for (let j = 0; j < m - 1; j++) for (let i = 0; i < m - 1; i++) if (cel[j * (m - 1) + i]) { const a = vid[j * m + i] + nv, b = vid[j * m + i + 1] + nv, c = vid[(j + 1) * m + i] + nv, d = vid[(j + 1) * m + i + 1] + nv; tri(a, d, b); tri(a, c, d); }
    const ativo = (j, i) => j >= 0 && i >= 0 && j < m - 1 && i < m - 1 && cel[j * (m - 1) + i];
    for (let j = 0; j < m - 1; j++) for (let i = 0; i < m - 1; i++) {
      if (!cel[j * (m - 1) + i]) continue;
      const lados = [[-1, 0, [0, 0], [0, 1]], [1, 0, [1, 1], [1, 0]], [0, -1, [1, 0], [0, 0]], [0, 1, [0, 1], [1, 1]]];
      for (const [dj, di, A, B] of lados) {
        if (ativo(j + dj, i + di)) continue;
        const pa = vid[(j + A[0]) * m + i + A[1]], pb = vid[(j + B[0]) * m + i + B[1]];
        tri(pa, pb + nv, pb); tri(pa, pa + nv, pb + nv);
      }
    }
    return { V: V.subarray(0, 3 * prox), F: Uint32Array.from(F) };
  };

  E.stl = function (malha, transformar) {
    const { V, F } = malha, nt = F.length / 3, buf = new ArrayBuffer(84 + 50 * nt), dv = new DataView(buf);
    const cab = "EITA!Mamilo - Lab.EITA/UFG"; for (let i = 0; i < cab.length; i++) dv.setUint8(i, cab.charCodeAt(i));
    dv.setUint32(80, nt, true);
    const p = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let t = 0; t < nt; t++) {
      let o = 84 + 50 * t;
      for (let k = 0; k < 3; k++) { const v = F[3 * t + k]; let x = V[3 * v], y = V[3 * v + 1], z = V[3 * v + 2]; if (transformar) [x, y, z] = transformar(x, y, z); p[3 * k] = x; p[3 * k + 1] = y; p[3 * k + 2] = z; }
      if (transformar && transformar.inverte) { for (let c = 0; c < 3; c++) { const tmp = p[3 + c]; p[3 + c] = p[6 + c]; p[6 + c] = tmp; } }
      const ux = p[3] - p[0], uy = p[4] - p[1], uz = p[5] - p[2], vx = p[6] - p[0], vy = p[7] - p[1], vz = p[8] - p[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
      dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true); o += 12;
      for (let k = 0; k < 9; k++) { dv.setFloat32(o, p[k], true); o += 4; }
    }
    return buf;
  };

  E.volume = function (malha) {
    const { V, F } = malha; let s = 0;
    for (let t = 0; t < F.length; t += 3) {
      const a = 3 * F[t], b = 3 * F[t + 1], c = 3 * F[t + 2];
      s += V[a] * (V[b + 1] * V[c + 2] - V[b + 2] * V[c + 1]) - V[a + 1] * (V[b] * V[c + 2] - V[b + 2] * V[c]) + V[a + 2] * (V[b] * V[c + 1] - V[b + 1] * V[c]);
    }
    return s / 6;
  };

  E.exportarConjunto = function (G, p, zonaFina) {
    const M = E.moldes(G, p.parede_molde_mm, p.folga_pino_mm, p.canal_transbordo_mm);
    const zf = zonaFina || Math.max(G.a, G.b) * G.rho_out + 5;
    const idx = E.indicesAdaptativos(G.xs, zf, 0.5), n = G.n;
    const Tp = new Float32Array(n * n); for (let q = 0; q < n * n; q++) Tp[q] = G.S[q] + Math.max(G.T[q], 1e-3);
    const prot = E.solido(G.xs, idx, n, G.S, Tp, G.dentro, false, false);
    const frente = E.solido(G.xs, idx, n, M.frente[0], M.frente[1], M.frente[2], true, false);
    const contra = E.solido(G.xs, idx, n, M.contra[0], M.contra[1], M.contra[2], false, true);
    const zt = M.zTop, zb = M.zBot;
    const tf = (x, y, z) => [x, y, zt - z]; tf.inverte = true;
    const tc = (x, y, z) => [x, y, z - zb];
    return {
      M, malhas: { protese: prot, frente, contra },
      arquivos: { "protese_referencia.stl": E.stl(prot), "molde_frontal.stl": E.stl(frente, tf), "contramolde.stl": E.stl(contra, tc) },
      volume_ml: E.volume(prot) / 1000
    };
  };

  // ------------------------------------------------------------------ corpo de prova
  E.corpoDeProva = function (res) {
    res = res || 0.1;
    const raio = 22.5, esp = 1.2, faixa = 4, ext = raio + 12, n = Math.ceil((2 * ext) / res) + 1, N = n * n;
    const xs = new Float64Array(n); for (let i = 0; i < n; i++) xs[i] = -ext + (2 * ext * i) / (n - 1);
    const BOSSAS = [[0.1, 200], [0.2, 240], [0.3, 300], [0.5, 340]], RANH = [[0.1, -8], [0.2, -4], [0.3, 0], [0.4, 4], [0.5, 8]], BORDAS = [0.1, 0.15, 0.2, 0.3];
    const T = new Float32Array(N), S = new Float32Array(N), dentro = new Uint8Array(N), rho = new Float32Array(N);
    let cup = new Float32Array(N);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const X = xs[i], Y = xs[j], q = j * n + i, r = Math.hypot(X, Y);
      const ang = ((Math.atan2(Y, X) * 180) / Math.PI + 360) % 360, eb = BORDAS[Math.floor(ang / 90) % 4];
      const u = clamp((r - (raio - faixa)) / faixa, 0, 1);
      let t = eb + (esp - eb) * 0.5 * (1 + Math.cos(Math.PI * u));
      for (const [hb, a] of BOSSAS) {
        const bx = 9 * Math.cos((a * Math.PI) / 180), by = 9 * Math.sin((a * Math.PI) / 180), d = Math.hypot(X - bx, Y - by), Rr = (1 + hb * hb) / (2 * hb);
        if (d < 1) t += Math.sqrt(Math.max(Rr * Rr - d * d, 0)) - (Rr - hb);
      }
      for (const [pr, x0] of RANH) if (Math.abs(X - x0) <= 0.3 && Y >= 11 && Y <= 16) t -= pr;
      const rp = r / 6; cup[q] = rp < 1 ? Math.pow(1 - rp ** 4, 0.25) : 0;
      T[q] = t; dentro[q] = r <= raio ? 1 : 0; rho[q] = r / raio;
    }
    cup = gauss2d(cup, n, 0.4 / res);
    const F = new Float32Array(N);
    for (let q = 0; q < N; q++) { T[q] = dentro[q] ? T[q] + 6 * cup[q] : 0; F[q] = S[q] + T[q]; }
    const G = { n, xs, S, T, F, dentro, rho, rho_out: 1, a: raio, b: raio, ext };
    return { G, espec: { diametro_mm: 45, espessura_base_mm: esp, faixa_afinamento_mm: faixa, bossas: BOSSAS.map(([h, a]) => ({ altura_mm: h, angulo_graus: a, raio_posicao_mm: 9, diametro_base_mm: 2 })), ranhuras: RANH.map(([p, x]) => ({ profundidade_mm: p, x_mm: x, y_mm: [11, 16], largura_mm: 0.6 })), borda_por_quadrante_mm: { Q1: 0.1, Q2: 0.15, Q3: 0.2, Q4: 0.3 }, papila_mm: { diametro: 12, projecao: 6 }, resolucao_mm: res } };
  };

  // ------------------------------------------------------------------ zip
  const CRC = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[i] = c >>> 0; }
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  async function deflateRaw(u8) {
    if (typeof CompressionStream === "undefined") return null;
    try {
      const cs = new CompressionStream("deflate-raw"), w = cs.writable.getWriter(); w.write(u8); w.close();
      return new Uint8Array(await new Response(cs.readable).arrayBuffer());
    } catch (e) { return null; }
  }
  E.zip = async function (arquivos) {
    const enc = new TextEncoder(), partes = [], central = []; let off = 0;
    for (const [nome, conteudo] of Object.entries(arquivos)) {
      const dados = typeof conteudo === "string" ? enc.encode(conteudo) : new Uint8Array(conteudo);
      const crc = crc32(dados), comp = await deflateRaw(dados), usar = comp && comp.length < dados.length;
      const corpo = usar ? comp : dados, metodo = usar ? 8 : 0, nb = enc.encode(nome);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, metodo, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 0x5b21, true); lh.setUint32(14, crc, true); lh.setUint32(18, corpo.length, true); lh.setUint32(22, dados.length, true);
      lh.setUint16(26, nb.length, true); lh.setUint16(28, 0, true);
      partes.push(new Uint8Array(lh.buffer), nb, corpo);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, metodo, true);
      ch.setUint16(12, 0, true); ch.setUint16(14, 0x5b21, true); ch.setUint32(16, crc, true); ch.setUint32(20, corpo.length, true); ch.setUint32(24, dados.length, true);
      ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nb);
      off += 30 + nb.length + corpo.length;
    }
    const tamC = central.reduce((s, u) => s + u.length, 0), fim = new DataView(new ArrayBuffer(22));
    fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, Object.keys(arquivos).length, true); fim.setUint16(10, Object.keys(arquivos).length, true);
    fim.setUint32(12, tamC, true); fim.setUint32(16, off, true);
    return new Blob([...partes, ...central, new Uint8Array(fim.buffer)], { type: "application/zip" });
  };

  // ------------------------------------------------------------------ marcador v2 (SVG em mm)
  // DICT_4X4_50 id 7 (bits 4x4, 1 = branco), gerado do OpenCV
  E.BITS_ID7 = null; // preenchido pela página
  E.marcadorSVG = function (bits) {
    const c = 20 / 6; let r = "";
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (bits[y][x]) r += `<rect x="${(9 + c * (x + 1)).toFixed(4)}" y="${(9 + c * (y + 1)).toFixed(4)}" width="${c.toFixed(4)}" height="${c.toFixed(4)}" fill="#fff"/>`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="38mm" height="44mm" viewBox="0 0 38 44">
<rect x="0" y="0" width="38" height="38" fill="#fff" stroke="#999" stroke-width="0.1"/>
<rect x="3" y="3" width="32" height="32" fill="#808080"/>
<rect x="6" y="6" width="26" height="26" fill="#fff"/>
<rect x="9" y="9" width="20" height="20" fill="#000"/>${r}
<text x="19" y="41" font-family="Arial, sans-serif" font-size="2.2" text-anchor="middle" fill="#333">EITA!Mamilo · marcador v2 · quadrado preto = 20,0 mm · imprimir em 100%</text>
</svg>`;
  };

  G.EITA = E;
  if (typeof module !== "undefined") module.exports = E;
})(typeof globalThis !== "undefined" ? globalThis : this);
/* EITA! MAMILO — interface (padrão visual Lab.EITA). © 2026 Lab.EITA/UFG. */
(function () {
"use strict";
const E = window.EITA;
const $ = (id) => document.getElementById(id);
const fmt = (v, d = 1) => (v == null || isNaN(v) ? "—" : Number(v).toFixed(d).replace(".", ","));
const espera = () => new Promise((r) => setTimeout(r, 20));
const BITS_ID7 = [[1, 1, 0, 0], [0, 1, 0, 0], [1, 1, 1, 1], [0, 0, 1, 0]];
const COR = { areola: "#1fae63", papila: "#2f6fdb", marc: "#d99a00", accent: "#6B3FD6", brand: "#9560FD", ink: "#1C1730", muted: "#5B5573", line: "#E1DCEC" };

const S = { frontal: null, lateral: null, aba: "photo", p: Object.assign({}, E.PARAMETROS, { textura_papila: Object.assign({}, E.PARAMETROS.textura_papila) }), forma: 4, projForcada: false, cache: {}, prev: null, modo3d: "prot", vol: null, exemplo: false };

// ------------------------------------------------------------------ status, ocupado, downloads
function status(msg, aviso) { const s = $("status"); s.innerHTML = msg; s.classList.toggle("warn", !!aviso); }
function ocupado(on, txt) { $("busy").style.display = on ? "grid" : "none"; if (txt) $("busyT").textContent = txt; }
let dl = null;
try { if (window.claude && window.claude.use) window.claude.use("downloads").then((ns) => { dl = ns; }).catch(() => {}); } catch (e) {}
async function salvar(nome, dados) {
  if (dl) {
    try { await dl.save({ filename: nome, data: dados }); status(`Arquivo entregue: <b>${nome}</b>`); return true; }
    catch (e) {
      if (e && e.code === "declined") { status("Download cancelado."); return false; }
      if (e && e.code === "rate_limited") { status("Já há uma confirmação de download aberta. Responda a ela e tente de novo.", true); return false; }
    }
  }
  try {
    const blob = dados instanceof Blob ? dados : new Blob([dados]);
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status(`Download iniciado: <b>${nome}</b>`); return true;
  } catch (e) { status("Este visualizador bloqueou o download. Abra a página no claude.ai.", true); return false; }
}
async function carregarImagem(src, maxLado) {
  const img = new Image(); img.decoding = "async";
  await new Promise((ok, erro) => { img.onload = ok; img.onerror = () => erro(new Error("Não foi possível abrir a imagem.")); img.src = src; });
  const f = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * f), h = Math.round(img.naturalHeight * f);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h);
  return { data: d.data, width: w, height: h, canvas: c, original: [img.naturalWidth, img.naturalHeight] };
}
const lerArquivo = (f) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); });
function paraCanvas(img) { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0); return c; }

// ------------------------------------------------------------------ etapas e seções
const ETAPAS = [["s1", "Foto"], ["s2", "Contornos"], ["s3", "Escala e cor"], ["s4", "Lateral"], ["s5", "Prótese"], ["s6", "Exportar"]];
const feitas = new Set();
function montarStepper() {
  $("stepper").innerHTML = ETAPAS.map(([id, nome], i) => `<button type="button" data-s="${id}" class="${feitas.has(id) ? "done" : ""}"><span class="n">${i + 1}</span>${nome}</button>`).join("");
  $("stepper").querySelectorAll("button").forEach((b) => (b.onclick = () => abrir(b.dataset.s)));
}
function abrir(id, semVista) {
  const sec = $(id); if (sec.classList.contains("off")) { status("Carregue a foto frontal primeiro (etapa 1).", true); return; }
  document.querySelectorAll("#panel section").forEach((s) => s.classList.toggle("collapsed", s.id !== id));
  $("stepper").querySelectorAll("button").forEach((b) => b.classList.toggle("cur", b.dataset.s === id));
  sec.scrollIntoView({ block: "nearest", behavior: "smooth" });
  if (!semVista) {
    if (id === "s1" || id === "s2") { mudarAba("photo"); if (id === "s2") enquadrar("areola"); }
    if (id === "s3") { mudarAba("photo"); enquadrar("tudo"); }
    if (id === "s4") mudarAba("lat");
    if (id === "s5" || id === "s6") mudarAba("3d");
  }
  if (id === "sCorpo") desenharCorpo();
}
document.querySelectorAll("#panel section > h2").forEach((h) => h.addEventListener("click", () => {
  const s = h.parentElement; if (s.classList.contains("off")) return;
  if (s.classList.contains("collapsed")) abrir(s.id); else s.classList.add("collapsed");
}));
function feito(id) { if (id === "s0") return; feitas.add(id); montarStepper(); const cur = document.querySelector("#panel section:not(.collapsed)"); if (cur) $("stepper").querySelectorAll("button").forEach((b) => b.classList.toggle("cur", b.dataset.s === cur.id)); }
function liberar() { ["s2", "s3", "s4", "s5", "s6"].forEach((id) => $(id).classList.remove("off")); }

// ------------------------------------------------------------------ abas da vista
function mudarAba(t) {
  S.aba = t;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("cur", b.dataset.t === t));
  $("pc").hidden = t !== "photo"; $("lc").hidden = t !== "lat"; $("gl").hidden = t !== "3d";
  $("toolsFoto").hidden = t !== "photo" || !S.frontal; $("tools3d").hidden = t !== "3d" || !S.frontal;
  $("empty").hidden = !!S.frontal;
  if (t === "photo") desenharFoto();
  if (t === "lat") desenharLateral();
  if (t === "3d") { if (iniciar3D()) { if (!S.prev) atualizarPrevia(); else desenhar3D(); } }
  legenda();
}
document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => { if (!S.frontal) return; mudarAba(b.dataset.t); }));
function legenda() {
  const L = $("legend");
  if (!S.frontal) { L.hidden = true; return; }
  L.hidden = false;
  if (S.aba === "photo") {
    const a = S.frontal.seg.areola, k = S.frontal.k;
    L.innerHTML = `<div><i style="background:${COR.areola}"></i>aréola ${fmt(a.eixo_maior_px / k)} × ${fmt(a.eixo_menor_px / k)} mm</div><div><i style="background:${COR.papila}"></i>papila Ø ${fmt(S.frontal.seg.papila.diam_px / k)} mm</div><div><i style="background:${COR.marc}"></i>marcador ${fmt(S.p.marcador_mm)} mm · ${fmt(k, 2)} px/mm</div>`;
  } else if (S.aba === "lat") {
    L.innerHTML = S.lateral ? `<div><i style="background:${COR.accent}"></i>perfil · projeção ${fmt(S.lateral.projecao_mm)} mm</div><div><i style="background:${COR.line};border:1px dashed ${COR.muted}"></i>linha de base da mama</div>` : `<div>sem foto lateral · projeção digitada ${fmt(S.p.papila_proj_mm)} mm</div>`;
  } else {
    const G = S.prev;
    L.innerHTML = G ? (S.modo3d === "molde" ? `<div>molde frontal (em cima) e contramolde</div><div>bloco ${fmt(2 * (G.ext - 1), 0)} × ${fmt(2 * (G.ext - 1), 0)} mm</div>` : `<div>prótese ${fmt(2 * G.a * G.rho_out)} × ${fmt(2 * G.b * G.rho_out)} mm</div><div>papila Ø ${fmt(G.papila_diam_mm)} × ${fmt(G.papila_proj_mm)} mm</div>${S.vol ? `<div>silicone ${fmt(S.vol, 2)} mL</div>` : ""}`) : "";
  }
}

// ------------------------------------------------------------------ 1. foto frontal
function soltavel(zona, input, fn) {
  const z = $(zona), f = $(input);
  z.addEventListener("click", () => f.click());
  z.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); f.click(); } });
  z.addEventListener("dragover", (e) => { e.preventDefault(); z.classList.add("hover"); });
  z.addEventListener("dragleave", () => z.classList.remove("hover"));
  z.addEventListener("drop", (e) => { e.preventDefault(); z.classList.remove("hover"); const a = e.dataTransfer.files[0]; if (a) fn(a); });
  f.addEventListener("change", () => { const a = f.files[0]; if (a) fn(a); f.value = ""; });
}
soltavel("drop1", "file1", async (f) => { S.exemplo = false; await processarFrontal(await lerArquivo(f), f.name); });
$("demo1").onclick = () => carregarExemplo();

async function processarFrontal(src, nome) {
  ocupado(true, "Abrindo a imagem…"); await espera();
  try {
    const orig = await carregarImagem(src, 2000);
    ocupado(true, "Procurando o marcador…"); await espera();
    const mk = E.detectarMarcador(orig);
    let cantos;
    if (mk) cantos = mk.cantos;
    else { const l = Math.min(orig.width, orig.height) * 0.12, x = orig.width * 0.06, y = orig.height * 0.06; cantos = [[x, y], [x + l, y], [x + l, y + l], [x, y + l]]; }
    S.frontal = { nome, orig, cantos, marcadorAuto: !!mk, editado: false };
    ocupado(true, "Calibrando a cor e medindo…"); await espera();
    recalibrar(); segmentar();
    S.prev = null; S.vol = null; S.cache = {};
    liberar(); feito("s1");
    const [ow, oh] = orig.original;
    $("imgInfo").innerHTML = `<b>${nome}</b> · ${ow} × ${oh} px${orig.width !== ow ? ` (processada em ${orig.width} × ${orig.height})` : ""}`;
    atualizarTudo();
    mudarAba("photo"); enquadrar("areola");
    if (!mk) { abrir("s3", true); mudarAba("photo"); enquadrar("tudo"); status("Marcador não encontrado. Arraste os quatro cantos amarelos sobre o quadrado preto e confira a escala na etapa 3.", true); }
    else { abrir("s2", true); status(S.exemplo ? "Exemplo sintético carregado. Confira os contornos e siga as etapas, ou carregue a sua foto na etapa 1." : "Foto processada. Confira os contornos da aréola e da papila (etapa 2)."); }
    ocupado(false);
    if (pendingFicha && (!pendingFicha.foto || pendingFicha.foto.arquivo === nome)) aplicarFicha(pendingFicha);
    return true;
  } catch (e) { ocupado(false); status("Falha ao processar a foto: " + e.message, true); return false; }
}
function recalibrar() {
  const fr = S.frontal, lados = E.ladosQuad(fr.cantos), lado = lados.reduce((a, b) => a + b, 0) / 4;
  fr.k = lado / S.p.marcador_mm; fr.persp = (Math.max(...lados) - Math.min(...lados)) / lado;
  const cal = E.calibrarCor(fr.orig, fr.cantos);
  fr.img = cal.img; fr.refCor = cal.ref; fr.canvas = paraCanvas(fr.img);
  fr.score = E.mapaScore(fr.img); S.cache = {};
}
function segmentar() {
  const fr = S.frontal, w = fr.img.width, h = fr.img.height;
  try { fr.seg = E.segmentarAuto(fr.img, fr.marcadorAuto ? fr.cantos : null, fr.score).seg; fr.segAuto = true; }
  catch (e) { const r = Math.min(w, h) * 0.18; fr.seg = { areola: { cx: w / 2, cy: h / 2, eixo_maior_px: 2 * r, eixo_menor_px: 2 * r, angulo_graus: 0 }, papila: null }; fr.segAuto = false; }
  if (!fr.seg.papila) { const a = fr.seg.areola; fr.seg.papila = { cx: a.cx, cy: a.cy, diam_px: 0.3 * a.eixo_menor_px }; fr.papFonte = "estimada por proporção"; }
  else {
    fr.papFonte = "foto";
    const r = E.refinarPapila(fr.score, w, h, fr.seg.papila), q = r.pap.diam_px / fr.seg.papila.diam_px;
    if (q > 0.5 && q < 1.6 && r.frac > 0.6) { fr.seg.papila = r.pap; fr.papFonte = "foto, borda refinada"; }
  }
  fr.paleta = E.paleta(fr.img, fr.seg);
}
$("detect").onclick = () => { if (!S.frontal) return; ocupado(true, "Detectando…"); setTimeout(() => { segmentar(); S.frontal.editado = false; ocupado(false); aposEdicao(false, true); enquadrar("areola"); status("Detecção automática refeita."); }, 20); };

// ------------------------------------------------------------------ 2/3. editor da foto (zoom, arrasto, alças)
const ED = { s: 1, ox: 0, oy: 0, modo: "areola", arr: null, pan: null };
function enquadrar(modo) {
  ED.modo = modo; $("fitAr").classList.toggle("cur", modo === "areola"); $("fitAll").classList.toggle("cur", modo === "tudo");
  const fr = S.frontal; if (!fr) return;
  const cv = $("pc"), W = cv.clientWidth || 800, H = cv.clientHeight || 600, a = fr.seg.areola;
  if (modo === "areola") { const r = Math.max(a.eixo_maior_px, a.eixo_menor_px) * 0.82; ED.s = Math.min(W, H - 110) / (2 * r); ED.ox = W / 2 - a.cx * ED.s; ED.oy = (H + 10) / 2 - a.cy * ED.s; }
  else { ED.s = Math.min(W / fr.img.width, (H - 110) / fr.img.height) * 0.96; ED.ox = (W - fr.img.width * ED.s) / 2; ED.oy = (H - fr.img.height * ED.s) / 2 + 8; }
  desenharFoto();
}
$("fitAr").onclick = () => enquadrar("areola"); $("fitAll").onclick = () => enquadrar("tudo");
$("marcBtn").onclick = () => { mudarAba("photo"); enquadrar("tudo"); status("Arraste os quatro cantos amarelos sobre o quadrado preto do marcador."); };
function alcas() {
  const fr = S.frontal, a = fr.seg.areola, p = fr.seg.papila, t = (a.angulo_graus * Math.PI) / 180;
  const h = [
    { id: "ac", x: a.cx, y: a.cy, cor: COR.areola, tipo: "anel" },
    { id: "a1", x: a.cx + Math.cos(t) * a.eixo_maior_px / 2, y: a.cy + Math.sin(t) * a.eixo_maior_px / 2, cor: COR.areola, tipo: "cheio" },
    { id: "a2", x: a.cx - Math.sin(t) * a.eixo_menor_px / 2, y: a.cy + Math.cos(t) * a.eixo_menor_px / 2, cor: COR.areola, tipo: "vazado" },
    { id: "pc", x: p.cx, y: p.cy, cor: COR.papila, tipo: "cheio" },
    { id: "pr", x: p.cx + p.diam_px / 2, y: p.cy, cor: COR.papila, tipo: "vazado" }
  ];
  fr.cantos.forEach((c, i) => h.push({ id: "m" + i, x: c[0], y: c[1], cor: COR.marc, tipo: "cheio" }));
  return h;
}
function desenharFoto() {
  const fr = S.frontal, cv = $("pc"); if (S.aba !== "photo") return;
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
  cv.width = W * dpr; cv.height = H * dpr; const x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
  if (!fr) return;
  x.save(); x.translate(ED.ox, ED.oy); x.scale(ED.s, ED.s);
  x.shadowColor = "rgba(60,30,130,.18)"; x.shadowBlur = 18 / ED.s; x.drawImage(fr.canvas, 0, 0); x.shadowBlur = 0;
  const a = fr.seg.areola, p = fr.seg.papila, ang = (a.angulo_graus * Math.PI) / 180, lw = 2 / ED.s;
  x.lineWidth = lw; x.strokeStyle = COR.areola; x.beginPath(); x.ellipse(a.cx, a.cy, a.eixo_maior_px / 2, a.eixo_menor_px / 2, ang, 0, 2 * Math.PI); x.stroke();
  const m = 1 + (2 * S.p.margem_mm * fr.k) / Math.min(a.eixo_maior_px, a.eixo_menor_px);
  x.setLineDash([5 / ED.s, 4 / ED.s]); x.globalAlpha = 0.75; x.beginPath(); x.ellipse(a.cx, a.cy, a.eixo_maior_px / 2 * m, a.eixo_menor_px / 2 * m, ang, 0, 2 * Math.PI); x.stroke(); x.setLineDash([]); x.globalAlpha = 1;
  x.strokeStyle = COR.papila; x.beginPath(); x.arc(p.cx, p.cy, p.diam_px / 2, 0, 2 * Math.PI); x.stroke();
  x.strokeStyle = COR.marc; x.beginPath(); fr.cantos.forEach((c, i) => (i ? x.lineTo(c[0], c[1]) : x.moveTo(c[0], c[1]))); x.closePath(); x.stroke();
  x.restore();
  for (const h of alcas()) {
    const X = h.x * ED.s + ED.ox, Y = h.y * ED.s + ED.oy;
    if (X < -20 || Y < -20 || X > W + 20 || Y > H + 20) continue;
    if (h.tipo === "anel") { x.lineWidth = 6; x.strokeStyle = "rgba(255,255,255,.85)"; x.beginPath(); x.arc(X, Y, 15, 0, 2 * Math.PI); x.stroke(); x.lineWidth = 3; x.strokeStyle = h.cor; x.stroke(); continue; }
    x.beginPath(); x.arc(X, Y, 6.5, 0, 2 * Math.PI);
    x.fillStyle = h.tipo === "cheio" ? h.cor : "#fff"; x.fill(); x.lineWidth = 2; x.strokeStyle = h.tipo === "cheio" ? "#fff" : h.cor; x.stroke();
  }
  // régua de 10 mm
  const l10 = 10 * fr.k * ED.s; if (l10 > 20 && l10 < W * 0.6) {
    const x0 = 34, y0 = 86; x.fillStyle = "rgba(255,255,255,.92)"; x.strokeStyle = COR.line; x.lineWidth = 1;
    x.beginPath(); x.roundRect ? x.roundRect(x0 - 10, y0 - 18, l10 + 20, 30, 8) : x.rect(x0 - 10, y0 - 18, l10 + 20, 30); x.fill(); x.stroke();
    x.fillStyle = COR.ink; x.fillRect(x0, y0, l10, 3); x.fillRect(x0, y0 - 4, 1.5, 7); x.fillRect(x0 + l10 - 1.5, y0 - 4, 1.5, 7);
    x.font = "500 11px IBM Plex Mono, monospace"; x.textAlign = "center"; x.fillText("10 mm", x0 + l10 / 2, y0 - 5); x.textAlign = "left";
  }
}
(function () {
  const cv = $("pc");
  const pos = (e) => { const r = cv.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top; return [(sx - ED.ox) / ED.s, (sy - ED.oy) / ED.s, sx, sy]; };
  const achar = (sx, sy) => { let melhor = null, d = 16; for (const h of alcas()) { let dd = Math.hypot(h.x * ED.s + ED.ox - sx, h.y * ED.s + ED.oy - sy); if (h.tipo === "anel") dd = Math.abs(dd - 15) + 1; if (dd < d) { d = dd; melhor = h; } } return melhor; };
  cv.addEventListener("pointerdown", (e) => {
    if (!S.frontal) return; const [, , sx, sy] = pos(e); const h = achar(sx, sy);
    cv.setPointerCapture(e.pointerId);
    if (h) ED.arr = h.id; else { ED.pan = [sx, sy, ED.ox, ED.oy]; cv.style.cursor = "grabbing"; }
  });
  cv.addEventListener("pointermove", (e) => {
    if (!S.frontal) return;
    const [x, y, sx, sy] = pos(e);
    if (ED.pan) { ED.ox = ED.pan[2] + sx - ED.pan[0]; ED.oy = ED.pan[3] + sy - ED.pan[1]; desenharFoto(); return; }
    if (!ED.arr) { cv.classList.toggle("alca", !!achar(sx, sy)); return; }
    const fr = S.frontal, a = fr.seg.areola, p = fr.seg.papila, id = ED.arr;
    if (id === "ac") { const dx = x - a.cx, dy = y - a.cy; a.cx = x; a.cy = y; p.cx += dx; p.cy += dy; }
    else if (id === "a1") { const dx = x - a.cx, dy = y - a.cy; a.eixo_maior_px = Math.max(2 * Math.hypot(dx, dy), a.eixo_menor_px); a.angulo_graus = (((Math.atan2(dy, dx) * 180) / Math.PI) % 180 + 180) % 180; }
    else if (id === "a2") { const t = (a.angulo_graus * Math.PI) / 180; a.eixo_menor_px = Math.min(2 * Math.abs(-Math.sin(t) * (x - a.cx) + Math.cos(t) * (y - a.cy)), a.eixo_maior_px); }
    else if (id === "pc") { p.cx = x; p.cy = y; }
    else if (id === "pr") { p.diam_px = Math.max(4, 2 * Math.hypot(x - p.cx, y - p.cy)); }
    else if (id[0] === "m") fr.cantos[+id[1]] = [x, y];
    desenharFoto(); sincronizarCampos(); legenda();
  });
  const fim = () => { cv.style.cursor = ""; if (ED.pan) { ED.pan = null; return; } if (!ED.arr) return; const m = ED.arr[0] === "m"; ED.arr = null; aposEdicao(m); };
  cv.addEventListener("pointerup", fim); cv.addEventListener("pointercancel", fim);
  cv.addEventListener("wheel", (e) => { if (!S.frontal) return; e.preventDefault(); const [, , sx, sy] = pos(e); const f = Math.exp(-e.deltaY * 0.0015); ED.ox = sx - (sx - ED.ox) * f; ED.oy = sy - (sy - ED.oy) * f; ED.s *= f; desenharFoto(); }, { passive: false });
  window.addEventListener("resize", () => { if (S.aba === "photo") desenharFoto(); if (S.aba === "lat") desenharLateral(); if (S.aba === "3d") desenhar3D(); });
})();
function aposEdicao(marcador, auto) {
  const fr = S.frontal; if (!auto) fr.editado = true;
  if (marcador) { fr.marcadorAuto = false; recalibrar(); }
  fr.paleta = E.paleta(fr.img, fr.seg);
  atualizarTudo(); desenharFoto(); agendarPrevia();
  if (!auto) feito("s2");
}
function sincronizarCampos() {
  const fr = S.frontal; if (!fr) return; const a = fr.seg.areola, k = fr.k;
  const set = (id, v, d) => { if (document.activeElement !== $(id)) $(id).value = (+v).toFixed(d); };
  set("cMaior", a.eixo_maior_px / k, 1); set("cMenor", a.eixo_menor_px / k, 1); set("cAng", a.angulo_graus, 0); set("cPap", fr.seg.papila.diam_px / k, 1);
}
for (const [id, fn] of [["cMaior", (v) => (S.frontal.seg.areola.eixo_maior_px = v * S.frontal.k)], ["cMenor", (v) => (S.frontal.seg.areola.eixo_menor_px = v * S.frontal.k)], ["cAng", (v) => (S.frontal.seg.areola.angulo_graus = ((v % 180) + 180) % 180)], ["cPap", (v) => (S.frontal.seg.papila.diam_px = v * S.frontal.k)]])
  $(id).addEventListener("change", () => { const v = parseFloat($(id).value); if (!S.frontal || isNaN(v) || (v <= 0 && id !== "cAng")) return; fn(v); aposEdicao(); });
$("marcMM").addEventListener("change", () => { const v = parseFloat($("marcMM").value); if (v > 5) { S.p.marcador_mm = v; if (S.frontal) { recalibrar(); aposEdicao(false, true); } } });

// ------------------------------------------------------------------ 4. lateral
soltavel("drop3", "file3", async (f) => processarLateral(await lerArquivo(f), f.name));
$("demo3").onclick = () => processarLateral("assets/mamilo-exemplo-lateral.jpg", "exemplo-lateral.jpg");
$("sem3").onclick = () => { S.lateral = null; S.projForcada = false; atualizarTudo(); agendarPrevia(); desenharLateral(); status("Sem foto lateral: a projeção e a forma da papila vêm dos valores digitados."); };
$("cProj").addEventListener("change", () => { const v = parseFloat($("cProj").value); if (v >= 0) { S.p.papila_proj_mm = v; S.projForcada = !!S.lateral; atualizarTudo(); agendarPrevia(); } });
$("cForma").addEventListener("change", () => { const v = parseFloat($("cForma").value); if (v >= 1.2) { S.forma = v; if (S.lateral) S.lateral.forma_n = v; atualizarTudo(); agendarPrevia(); } });
async function processarLateral(src, nome) {
  ocupado(true, "Analisando o perfil…"); await espera();
  try {
    const img = await carregarImagem(src, 1600);
    const r = E.analisarLateral(img, { marcador_mm: S.p.marcador_mm });
    r.canvas = img.canvas; r.nome = nome;
    S.lateral = r; S.projForcada = false; S.forma = r.forma_n;
    feito("s4"); atualizarTudo(); agendarPrevia(); mudarAba("lat");
    status(`Perfil analisado: projeção da papila de <b>${fmt(r.projecao_mm)} mm</b>.${r.avisos.length ? " " + r.avisos[0] : ""}`, r.avisos.length > 0);
  } catch (e) { status(e.message, true); }
  ocupado(false);
}
function desenharLateral() {
  const cv = $("lc"); if (S.aba !== "lat") return;
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
  cv.width = W * dpr; cv.height = H * dpr; const x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
  const L = S.lateral;
  if (!L) { x.fillStyle = COR.muted; x.font = "500 15px Instrument Sans, sans-serif"; x.textAlign = "center"; x.fillText("Sem foto lateral. Carregue uma na etapa 4 ou use a projeção digitada.", W / 2, H / 2); x.textAlign = "left"; return; }
  // foto à esquerda
  const fotoW = Math.min(W * 0.36, 380), fh = Math.min((fotoW * L.canvas.height) / L.canvas.width, H - 150), fw = (fh * L.canvas.width) / L.canvas.height;
  const fx = 24, fy = 70;
  x.save(); x.shadowColor = "rgba(60,30,130,.18)"; x.shadowBlur = 16; x.drawImage(L.canvas, fx, fy, fw, fh); x.restore();
  const d = L._debug, k = L.px_por_mm, ef = fw / L.canvas.width, esq = L.lado_corpo === "esquerda";
  x.strokeStyle = COR.brand; x.lineWidth = 2; x.beginPath();
  d.linhas.forEach((ln, i) => { const bx = esq ? d.borda[i] : L.canvas.width - 1 - d.borda[i]; const X = fx + bx * ef, Y = fy + ln * ef; i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.stroke();
  // gráfico à direita
  const gx = fx + fw + 40, gw = W - gx - 30, gy = 80, gh = H - 200; if (gw < 160) return;
  const c = d.centro, ys = [], xb = [], xbase = [];
  for (let i = 0; i < d.linhas.length; i++) { const y = (d.linhas[i] - d.linhas[c]) / k; if (Math.abs(y) <= 22) { ys.push(y); xb.push(d.borda[i] / k); xbase.push(d.base[i] / k); } }
  const xmin = Math.min(...xbase, ...xb) - 1, xmax = Math.max(...xb) + 1, s = Math.min(gw / 44, gh / (xmax - xmin));
  const X = (y) => gx + gw / 2 + y * s, Y = (v) => gy + gh - (v - xmin) * s;
  x.fillStyle = "#fff"; x.strokeStyle = COR.line; x.lineWidth = 1; x.beginPath(); x.roundRect ? x.roundRect(gx - 12, gy - 40, gw + 24, gh + 80, 10) : x.rect(gx - 12, gy - 40, gw + 24, gh + 80); x.fill(); x.stroke();
  x.strokeStyle = "#EEEAF6"; for (let g = -20; g <= 20; g += 5) { x.beginPath(); x.moveTo(X(g), gy - 10); x.lineTo(X(g), gy + gh); x.stroke(); }
  x.fillStyle = COR.muted; x.font = "11px IBM Plex Mono, monospace"; x.textAlign = "center"; for (let g = -20; g <= 20; g += 10) x.fillText(g + " mm", X(g), gy + gh + 18);
  x.setLineDash([5, 4]); x.strokeStyle = COR.muted; x.lineWidth = 1.2; x.beginPath(); ys.forEach((y, i) => (i ? x.lineTo(X(y), Y(xbase[i])) : x.moveTo(X(y), Y(xbase[i])))); x.stroke(); x.setLineDash([]);
  x.strokeStyle = COR.accent; x.lineWidth = 2.5; x.beginPath(); ys.forEach((y, i) => (i ? x.lineTo(X(y), Y(xb[i])) : x.moveTo(X(y), Y(xb[i])))); x.stroke();
  const i0 = ys.findIndex((y) => y >= 0), top = Y(xb[i0]), bot = Y(xbase[i0]);
  x.strokeStyle = COR.ink; x.lineWidth = 1; x.beginPath(); x.moveTo(X(0) + 18, top); x.lineTo(X(0) + 18, bot); x.moveTo(X(0) + 13, top); x.lineTo(X(0) + 23, top); x.moveTo(X(0) + 13, bot); x.lineTo(X(0) + 23, bot); x.stroke();
  x.textAlign = "left"; x.fillStyle = COR.ink; x.font = "600 14px IBM Plex Mono, monospace"; x.fillText(`${fmt(L.projecao_mm)} mm`, X(0) + 28, (top + bot) / 2 + 5);
  x.font = "600 13px Instrument Sans, sans-serif"; x.fillText("Perfil da papila (rotacionado)", gx, gy - 16);
  x.fillStyle = COR.muted; x.font = "12px Instrument Sans, sans-serif"; x.fillText(`largura na base ${fmt(L.largura_base_mm)} mm · forma ${fmt(L.forma_n, 2)}`, gx + 210, gy - 16);
}

// ------------------------------------------------------------------ 5. parâmetros
const PARES = [["pCentro", "esp_centro_mm", 2], ["pBorda", "esp_borda_mm", 2], ["pMargem", "margem_mm", 1], ["pRelevo", "relevo_amp_mm", 2], ["pRaio", "raio_mama_mm", 0]];
for (const [id, ch, d] of PARES) {
  const n = $(id), r = $(id + "R"); n.value = S.p[ch].toFixed(d); r.value = S.p[ch];
  const aplicar = (v) => { if (isNaN(v)) return; S.p[ch] = v; n.value = v.toFixed(d); r.value = v; atualizarTudo(); agendarPrevia(); if (ch === "margem_mm") desenharFoto(); };
  r.addEventListener("input", () => aplicar(parseFloat(r.value)));
  n.addEventListener("change", () => aplicar(E.clamp(parseFloat(n.value), +r.min, +r.max)));
}
$("pInv").addEventListener("change", (e) => { S.p.relevo_inverter = e.target.checked; agendarPrevia(); });
const TXP = [["txInt", "intensidade", 1], ["txLob", "lobulo_mm", 1], ["txSul", "sulco_mm", 2], ["txOst", "ostios", 0], ["txRug", "ruga_amp_mm", 2], ["txBas", "sulco_basal_mm", 2]];
for (const [id, ch, d] of TXP) {
  const n = $(id), r = $(id + "R"), T = S.p.textura_papila; n.value = T[ch].toFixed(d); r.value = T[ch];
  const aplicar = (v) => { if (isNaN(v)) return; T[ch] = d === 0 ? Math.round(v) : v; n.value = T[ch].toFixed(d); r.value = T[ch]; agendarPrevia(); };
  r.addEventListener("input", () => aplicar(parseFloat(r.value)));
  n.addEventListener("change", () => aplicar(E.clamp(parseFloat(n.value), +r.min, +r.max)));
}
$("txOn").addEventListener("change", (e) => { S.p.textura_papila.ativa = e.target.checked; $("txBox").style.opacity = e.target.checked ? 1 : 0.5; agendarPrevia(); });
$("txVar").onclick = () => { S.p.textura_papila.semente = (S.p.textura_papila.semente * 7919 + 13) % 100003; agendarPrevia(); status("Nova variação da textura da papila."); };
$("txZoom").onclick = () => { mudarAba("3d"); vistaPapila(); };
function lados() {
  S.p.espelhar = $("photoSide").value !== $("protSide").value;
  const nome = (v) => (v === "D" ? "direita" : "esquerda");
  $("mirrorNote").textContent = S.p.espelhar ? `A foto é da mama ${nome($("photoSide").value)} e a prótese é para a ${nome($("protSide").value)}: o modelo será espelhado.` : "Foto e prótese do mesmo lado: sem espelhamento.";
  agendarPrevia();
}
$("photoSide").addEventListener("change", lados); $("protSide").addEventListener("change", lados);

function lateralEfetiva() { return S.lateral ? { forma_n: S.lateral.forma_n, projecao_mm: S.lateral.projecao_mm } : { forma_n: S.forma, projecao_mm: S.p.papila_proj_mm }; }
function geometria(res) { const fr = S.frontal; const p = Object.assign({}, S.p, { resolucao_mm: res, papila_proj_forcada: !S.lateral || S.projForcada }); return E.geometria(fr.img, fr.seg, fr.k, p, lateralEfetiva(), S.cache); }
let tPrev = null;
function agendarPrevia() { if (!S.frontal) return; S.prev = null; clearTimeout(tPrev); tPrev = setTimeout(() => { if (S.aba === "3d") atualizarPrevia(); }, 200); }
function atualizarPrevia() { if (!S.frontal) return; S.prev = geometria(S.p.textura_papila.ativa ? 0.2 : 0.3); montarCena(); legenda(); feito("s5"); }

// ------------------------------------------------------------------ resumo (tabelas, cores, avisos)
function atualizarTudo() {
  const fr = S.frontal; if (!fr) return;
  const a = fr.seg.areola, k = fr.k, L = S.lateral;
  sincronizarCampos();
  $("segTab").innerHTML = `<tr><td>Contornos</td><td>${fr.editado ? "ajustados" : fr.segAuto ? "automáticos" : "manuais"}</td></tr><tr><td>Papila</td><td>${fr.editado ? "ajustada" : fr.papFonte}</td></tr><tr><td>Área da aréola</td><td>${fmt((Math.PI * a.eixo_maior_px * a.eixo_menor_px) / 4 / k / k / 100, 2)} cm²</td></tr>`;
  $("scaleTab").innerHTML = `<tr><td>Marcador</td><td>${fr.marcadorAuto ? "detectado" : "cantos manuais"}</td></tr><tr><td>Escala</td><td>${fmt(k, 2)} px/mm</td></tr><tr><td>Perspectiva</td><td>${fmt(fr.persp * 100, 1)} %</td></tr>`;
  $("sw").innerHTML = [["aréola", fr.paleta.areola], ["papila", fr.paleta.papila], ["pele", fr.paleta.pele]].map(([n, h]) => `<div><i style="background:${h}"></i>${n} ${h}</div>`).join("");
  const sat = fr.refCor && /SATURADO/.test(fr.refCor);
  $("corInfo").innerHTML = !fr.refCor ? `<div class="warnbox">Cor sem calibração: o marcador não teve contraste suficiente.</div>` : sat ? `<div class="warnbox">O branco do marcador estourou na foto. Reduza a exposição ou use o marcador v2 com anel cinza.</div>` : `<div class="okbox">Cor calibrada pelo ${fr.refCor}.</div>`;
  if (fr.persp > 0.05) $("corInfo").innerHTML += `<div class="warnbox">O marcador aparece em perspectiva (${fmt(fr.persp * 100, 0)} %). Fotografe com o celular paralelo à pele.</div>`;
  if (fr.k) feito("s3");
  if (L) {
    $("cProj").value = (S.projForcada ? S.p.papila_proj_mm : L.projecao_mm).toFixed(1); $("cForma").value = L.forma_n.toFixed(2);
    $("latNota").textContent = S.projForcada ? "Projeção digitada (substitui a medida da foto lateral)." : "Valores medidos na foto lateral. Editar a projeção substitui a medida.";
    $("latTab").innerHTML = `<tr><td>Foto</td><td>${L.nome}</td></tr><tr><td>Projeção medida</td><td>${fmt(L.projecao_mm)} mm</td></tr><tr><td>Largura na base</td><td>${fmt(L.largura_base_mm)} mm</td></tr><tr><td>Ajuste da forma (RMS)</td><td>${fmt(L.rms_ajuste_mm, 2)} mm</td></tr>`;
    const dpf = fr.seg.papila.diam_px / k, av = [...L.avisos];
    if (L.largura_base_mm < 0.6 * dpf || L.largura_base_mm > 2 * dpf) av.push("A largura da papila no perfil não bate com a foto frontal. Confira as duas fotos.");
    $("latInfo").innerHTML = av.map((t) => `<div class="warnbox">${t}</div>`).join("");
  } else {
    $("cProj").value = S.p.papila_proj_mm.toFixed(1); $("cForma").value = S.forma.toFixed(1);
    $("latNota").textContent = "Sem foto lateral, vale o valor digitado. Forma 4 = cilindro de topo arredondado; 2 = cúpula.";
    $("latTab").innerHTML = ""; $("latInfo").innerHTML = "";
  }
  legenda();
}

// ------------------------------------------------------------------ 3D (WebGL próprio)
const V3 = { gl: null, prog: null, malhas: [], teta: -1.2, fi: 0.95, dist: 145, alvo: [0, 0, 1], ok: null };
function iniciar3D() {
  if (V3.ok !== null) return V3.ok;
  const cv = $("gl"), gl = cv.getContext("webgl", { antialias: true, preserveDrawingBuffer: true, alpha: true });
  if (!gl) { V3.ok = false; status("Este navegador não oferece WebGL: a visualização 3D fica indisponível, mas a exportação funciona.", true); return false; }
  const vs = "attribute vec3 p;attribute vec3 n;attribute vec3 c;uniform mat4 mvp;varying vec3 vn;varying vec3 vc;void main(){vn=n;vc=c;gl_Position=mvp*vec4(p,1.0);}";
  const fs = "precision mediump float;varying vec3 vn;varying vec3 vc;uniform vec3 l1;uniform vec3 l2;void main(){vec3 n=normalize(vn);float d=max(dot(n,l1),0.0)*0.72+max(dot(n,l2),0.0)*0.28+0.26;float s=pow(max(dot(n,normalize(l1+vec3(0.0,0.0,1.0))),0.0),28.0)*0.16;gl_FragColor=vec4(vc*d+s,1.0);}";
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
  V3.gl = gl; V3.prog = pr; V3.ok = true;
  let arr = null; const pts = new Map();
  cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); arr = [e.clientX, e.clientY]; });
  cv.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; const d0 = Math.hypot(a[0] - b[0], a[1] - b[1]); pts.set(e.pointerId, [e.clientX, e.clientY]); const [c, d] = [...pts.values()]; V3.dist = E.clamp((V3.dist * d0) / (Math.hypot(c[0] - d[0], c[1] - d[1]) || d0), 12, 400); desenhar3D(); return; }
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    V3.teta -= (e.clientX - arr[0]) * 0.01; V3.fi = E.clamp(V3.fi - (e.clientY - arr[1]) * 0.01, 0.02, 3.1); arr = [e.clientX, e.clientY]; desenhar3D();
  });
  const fim = (e) => pts.delete(e.pointerId); cv.addEventListener("pointerup", fim); cv.addEventListener("pointercancel", fim);
  cv.addEventListener("wheel", (e) => { e.preventDefault(); V3.dist = E.clamp(V3.dist * Math.exp(e.deltaY * 0.001), 12, 400); desenhar3D(); }, { passive: false });
  return true;
}
document.querySelectorAll("#tools3d button[data-m]").forEach((b) => (b.onclick = () => { S.modo3d = b.dataset.m; document.querySelectorAll("#tools3d button[data-m]").forEach((x) => x.classList.toggle("cur", x === b)); montarCena(); legenda(); }));
function vistaPapila() {
  const G = S.prev; if (!G) { setTimeout(vistaPapila, 300); return; }
  const n = G.n, i = E.clamp(Math.round(((G.papila_offset_mm[0] + G.ext) / (2 * G.ext)) * (n - 1)), 0, n - 1), j = E.clamp(Math.round(((G.papila_offset_mm[1] + G.ext) / (2 * G.ext)) * (n - 1)), 0, n - 1);
  V3.alvo = [G.papila_offset_mm[0], G.papila_offset_mm[1], G.F[j * n + i] * 0.75]; V3.dist = Math.max(28, G.papila_diam_mm * 3.2); V3.fi = 0.75; V3.teta = -1.1; desenhar3D();
}
document.querySelectorAll("#tools3d button[data-v]").forEach((b) => (b.onclick = () => { const v = b.dataset.v; if (v === "pap") { vistaPapila(); return; } V3.alvo = [0, 0, 1]; V3.dist = 145; if (v === "front") { V3.fi = 0.02; V3.teta = -Math.PI / 2; } else if (v === "three") { V3.fi = 0.95; V3.teta = -1.2; } else { V3.fi = 1.5; V3.teta = -Math.PI / 2; } desenhar3D(); }));
$("vC").addEventListener("change", montarCena); $("vPele").addEventListener("change", montarCena);
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
function malhaGL(pos, nor, cor) { const gl = V3.gl, b = (d) => { const x = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, x); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW); return x; }; return { p: b(pos), n: b(nor), c: b(cor), cont: pos.length / 3 }; }
function triangulos(sol, corDe, dz, corte) {
  const { V, F } = sol, pos = [], nor = [], col = [];
  for (let t = 0; t < F.length; t += 3) {
    const P = [0, 1, 2].map((k) => [V[3 * F[t + k]], V[3 * F[t + k] + 1], V[3 * F[t + k] + 2] + dz]);
    if (corte && P[0][1] > 0.01 && P[1][1] > 0.01 && P[2][1] > 0.01) continue;
    const u = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], w = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const l = Math.hypot(...n) || 1; n = n.map((v) => v / l);
    for (const q of P) { pos.push(q[0], q[1], q[2]); nor.push(...n); col.push(...corDe(q)); }
  }
  return malhaGL(new Float32Array(pos), new Float32Array(nor), new Float32Array(col));
}
// superfície visível da prótese com normais suaves por vértice (gradiente do campo de altura)
function superficieSuave(G, corDe) {
  const n = G.n, xs = G.xs, dx = xs[1] - xs[0], F = G.F, D = G.dentro, pos = [], nor = [], col = [];
  const Fv = (i, j) => F[E.clamp(j, 0, n - 1) * n + E.clamp(i, 0, n - 1)];
  const vtx = (i, j) => { const gx = (Fv(i + 1, j) - Fv(i - 1, j)) / (2 * dx), gy = (Fv(i, j + 1) - Fv(i, j - 1)) / (2 * dx), l = Math.hypot(gx, gy, 1), p = [xs[i], xs[j], Fv(i, j)]; pos.push(p[0], p[1], p[2]); nor.push(-gx / l, -gy / l, 1 / l); col.push(...corDe(p)); };
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const q = j * n + i; if (!(D[q] && D[q + 1] && D[q + n] && D[q + n + 1])) continue;
    vtx(i, j); vtx(i + 1, j); vtx(i + 1, j + 1); vtx(i, j); vtx(i + 1, j + 1); vtx(i, j + 1);
  }
  return malhaGL(new Float32Array(pos), new Float32Array(nor), new Float32Array(col));
}
function montarCena() {
  if (!S.prev || !iniciar3D()) return;
  const G = S.prev, fr = S.frontal, n = G.n, gl = V3.gl, idx = Array.from({ length: n }, (_, i) => i);
  for (const m of V3.malhas) { gl.deleteBuffer(m.p); gl.deleteBuffer(m.n); gl.deleteBuffer(m.c); } V3.malhas = [];
  const usarCor = $("vC").checked, cA = hexRgb(fr.paleta.areola), cP = hexRgb(fr.paleta.papila), cS = hexRgb(fr.paleta.pele), neutro = [0.78, 0.74, 0.86];
  if (S.modo3d !== "molde") {
    const corte = S.modo3d === "corte", ox = G.papila_offset_mm[0], oy = G.papila_offset_mm[1], rp0 = G.papila_diam_mm / 2;
    const corDe = (q) => {
      if (!usarCor) return neutro;
      const i = E.clamp(Math.round(((q[0] + G.ext) / (2 * G.ext)) * (n - 1)), 0, n - 1), j = E.clamp(Math.round(((q[1] + G.ext) / (2 * G.ext)) * (n - 1)), 0, n - 1), rho = G.rho[j * n + i];
      if (Math.hypot(q[0] - ox, q[1] - oy) / rp0 < 1.05) return cP;
      if (rho < 0.97) return cA; if (rho > 1.05) return cS; const f = (rho - 0.97) / 0.08; return cA.map((v, k) => v * (1 - f) + cS[k] * f);
    };
    if (!corte) { V3.malhas.push(superficieSuave(G, corDe)); }
    else {
    const prot = E.solido(G.xs, idx, n, G.S, Float32Array.from(G.S, (s, q) => s + Math.max(G.T[q], 1e-3)), G.dentro, false, false);
    V3.malhas.push(triangulos(prot, (q) => {
      if (!usarCor) return neutro;
      const i = E.clamp(Math.round(((q[0] + G.ext) / (2 * G.ext)) * (n - 1)), 0, n - 1), j = E.clamp(Math.round(((q[1] + G.ext) / (2 * G.ext)) * (n - 1)), 0, n - 1), rho = G.rho[j * n + i];
      if (Math.hypot(q[0] - ox, q[1] - oy) / rp0 < 1.05) return cP;
      if (rho < 0.97) return cA; if (rho > 1.05) return cS; const f = (rho - 0.97) / 0.08; return cA.map((v, k) => v * (1 - f) + cS[k] * f);
    }, 0, corte));
    }
    if ($("vPele").checked) {
      const R = S.p.raio_mama_mm, rMax = Math.min(G.ext * 1.1, 0.9 * R), NA = 128, NR = 40, pos = [], nor = [], col = [], cs = usarCor ? cS.map((v) => v * 0.9) : [0.9, 0.88, 0.93];
      const pt = (r, t) => { const x = r * Math.cos(t), y = r * Math.sin(t), z = Math.sqrt(R * R - r * r) - R - 0.04, L = R; return [x, y, z, x / L, y / L, (z + R) / L]; };
      for (let a = 0; a < NA; a++) for (let k = 0; k < NR; k++) {
        const t0 = (2 * Math.PI * a) / NA, t1 = (2 * Math.PI * (a + 1)) / NA, r0 = (rMax * k) / NR, r1 = (rMax * (k + 1)) / NR;
        if (corte && Math.sin((t0 + t1) / 2) > 0) continue;
        for (const [r, t] of [[r0, t0], [r1, t0], [r1, t1], [r0, t0], [r1, t1], [r0, t1]]) { const v = pt(r, t); pos.push(v[0], v[1], v[2]); nor.push(v[3], v[4], v[5]); col.push(...cs); }
      }
      V3.malhas.push(malhaGL(new Float32Array(pos), new Float32Array(nor), new Float32Array(col)));
    }
  } else {
    const M = E.moldes(G, S.p.parede_molde_mm, S.p.folga_pino_mm, S.p.canal_transbordo_mm);
    V3.malhas.push(triangulos(E.solido(G.xs, idx, n, M.frente[0], M.frente[1], M.frente[2], true, false), () => [0.86, 0.83, 0.93], 16, false));
    V3.malhas.push(triangulos(E.solido(G.xs, idx, n, M.contra[0], M.contra[1], M.contra[2], false, true), () => [0.62, 0.52, 0.86], -8, false));
  }
  desenhar3D();
}
function mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; }
function persp(f, asp, n, fa) { const t = 1 / Math.tan(f / 2); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0]); }
function olhar(e, c, u) {
  const z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]], zl = Math.hypot(...z); z.forEach((v, i) => (z[i] = v / zl));
  let x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; const xl = Math.hypot(...x) || 1; x = x.map((v) => v / xl);
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]);
}
function desenhar3D() {
  if (!V3.ok || S.aba !== "3d") return;
  const gl = V3.gl, cv = $("gl"), dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
  cv.width = W * dpr; cv.height = H * dpr; gl.viewport(0, 0, cv.width, cv.height);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
  const A = V3.alvo, e = [A[0] + V3.dist * Math.sin(V3.fi) * Math.cos(V3.teta), A[1] + V3.dist * Math.sin(V3.fi) * Math.sin(V3.teta), A[2] + V3.dist * Math.cos(V3.fi)];
  const up = V3.fi < 0.05 ? [0, 1, 0] : [0, 0, 1];
  const pr = V3.prog; gl.useProgram(pr);
  gl.uniformMatrix4fv(gl.getUniformLocation(pr, "mvp"), false, mul(persp(0.62, W / H, 0.5, 1000), olhar(e, V3.alvo, up)));
  const nz = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  gl.uniform3fv(gl.getUniformLocation(pr, "l1"), nz([0.35, -0.55, 0.78])); gl.uniform3fv(gl.getUniformLocation(pr, "l2"), nz([-0.6, 0.45, 0.35]));
  for (const m of V3.malhas) { for (const [nome, buf] of [["p", m.p], ["n", m.n], ["c", m.c]]) { const loc = gl.getAttribLocation(pr, nome); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0); } gl.drawArrays(gl.TRIANGLES, 0, m.cont); }
}

// ------------------------------------------------------------------ 6. exportar
function relatorioJSON(G, vol) {
  const fr = S.frontal, a = fr.seg.areola, k = fr.k;
  return {
    software: "EITA! MAMILO v0.2 (web) — Lab.EITA/UFG", caso: codigoArquivo(), ficha: S.fichaId || null, paciente: readPatient(), data: new Date().toISOString().slice(0, 10),
    foto: { mama: $("photoSide").value === "D" ? "direita" : "esquerda", arquivo: fr.nome }, protese: { mama: $("protSide").value === "D" ? "direita" : "esquerda", espelhada: S.p.espelhar },
    medidas: { px_por_mm: +k.toFixed(3), marcador_mm: S.p.marcador_mm, marcador: fr.marcadorAuto ? "detectado" : "cantos manuais", cor_referencia: fr.refCor || "sem calibração",
      areola_eixo_maior_mm: +(a.eixo_maior_px / k).toFixed(2), areola_eixo_menor_mm: +(a.eixo_menor_px / k).toFixed(2), areola_angulo_graus: +a.angulo_graus.toFixed(1),
      papila_diam_mm: +G.papila_diam_mm.toFixed(2), papila_proj_mm: +G.papila_proj_mm.toFixed(2), papila_proj_fonte: S.lateral && !S.projForcada ? "foto lateral" : "digitada", papila_forma_n: lateralEfetiva().forma_n,
      contornos: fr.editado ? "ajustados à mão" : "automáticos", cores: fr.paleta },
    lateral: S.lateral ? { projecao_mm: S.lateral.projecao_mm, largura_base_mm: S.lateral.largura_base_mm, forma_n: S.lateral.forma_n, rms_ajuste_mm: S.lateral.rms_ajuste_mm, avisos: S.lateral.avisos } : null,
    parametros: S.p, volume_silicone_ml: vol != null ? +vol.toFixed(3) : null,
    avisos: checagens().map((c) => c.n + ": " + c.t)
  };
}
async function imgDe(src) { const i = new Image(); await new Promise((ok) => { i.onload = ok; i.onerror = ok; i.src = src; }); return i; }
async function relatorioPNG(G, J) {
  const W = 1600, H = 1000, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  x.fillStyle = "#F4F2F9"; x.fillRect(0, 0, W, H); x.fillStyle = "#fff"; x.fillRect(0, 0, W, 90);
  const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, "#9560FD"); g.addColorStop(0.45, "#6B3FD6"); g.addColorStop(1, "rgba(107,63,214,0)"); x.fillStyle = g; x.fillRect(0, 88, W, 4);
  const [sim, ufg] = await Promise.all([imgDe("assets/eita-mamilo-simbolo.png"), imgDe("assets/logo-ufg.png")]);
  try { x.drawImage(sim, 24, 17, 56, 56); } catch (e) {}
  x.fillStyle = "#1C1730"; x.font = "800 32px Instrument Sans, sans-serif"; x.fillText("EITA!", 94, 50); x.fillStyle = "#9560FD"; x.fillText("MAMILO", 94 + x.measureText("EITA! ").width, 50);
  x.fillStyle = "#2a2438"; x.font = "600 14px Instrument Sans, sans-serif"; x.fillText("Relatório da prótese externa de aréola e papila", 94, 72);
  x.font = "500 15px IBM Plex Mono, monospace"; x.textAlign = "right"; x.fillStyle = "#5B5573"; x.fillText(`${J.caso} · ${J.data}`, W - 110, 52); x.textAlign = "left";
  try { x.drawImage(ufg, W - 80, 18, (54 * ufg.width) / ufg.height, 54); } catch (e) {}
  const card = (X, Y, w, h, t) => { x.fillStyle = "#fff"; x.strokeStyle = "#E1DCEC"; x.lineWidth = 1; x.beginPath(); x.roundRect ? x.roundRect(X, Y, w, h, 10) : x.rect(X, Y, w, h); x.fill(); x.stroke(); x.fillStyle = "#6B3FD6"; x.font = "600 12px IBM Plex Mono, monospace"; x.fillText(t.toUpperCase(), X + 16, Y + 26); };
  const fr = S.frontal, a = fr.seg.areola, r = Math.max(a.eixo_maior_px, a.eixo_menor_px) * 0.85, box = 420;
  card(24, 110, 468, 500, "1 · Contornos"); x.save(); x.beginPath(); x.rect(48, 150, box, box); x.clip();
  x.drawImage(fr.canvas, a.cx - r, a.cy - r, 2 * r, 2 * r, 48, 150, box, box); const esc = box / (2 * r);
  x.translate(48 + box / 2, 150 + box / 2); x.scale(esc, esc); x.translate(-a.cx, -a.cy); x.lineWidth = 2.5 / esc;
  x.strokeStyle = COR.areola; x.beginPath(); x.ellipse(a.cx, a.cy, a.eixo_maior_px / 2, a.eixo_menor_px / 2, (a.angulo_graus * Math.PI) / 180, 0, 7); x.stroke();
  const p = fr.seg.papila; x.strokeStyle = COR.papila; x.beginPath(); x.arc(p.cx, p.cy, p.diam_px / 2, 0, 7); x.stroke(); x.restore();
  const n = G.n, im = x.createImageData(n, n); let tmax = 0; for (let q = 0; q < n * n; q++) if (G.dentro[q]) tmax = Math.max(tmax, G.T[q]);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const q = (n - 1 - j) * n + i, o = 4 * (j * n + i); if (!G.dentro[q]) continue; const t = Math.pow(G.T[q] / tmax, 0.45); im.data[o] = 245 - 140 * t; im.data[o + 1] = 240 - 190 * t; im.data[o + 2] = 252 - 40 * t; im.data[o + 3] = 255; }
  const tmp = document.createElement("canvas"); tmp.width = n; tmp.height = n; tmp.getContext("2d").putImageData(im, 0, 0);
  card(508, 110, 468, 500, "2 · Espessura (mais escuro = mais espesso)"); x.drawImage(tmp, 532, 150, box, box);
  card(992, 110, 584, 500, "3 · Corte central (escala vertical 3×)");
  const j0 = (n / 2) | 0, sx = 540 / (2 * G.ext), sy = sx * 3, oy0 = 400, X0 = 1012;
  x.strokeStyle = "#A79FBF"; x.lineWidth = 1.5; x.beginPath(); for (let i = 0; i < n; i++) { const X = X0 + (G.xs[i] + G.ext) * sx, Y = oy0 - G.S[j0 * n + i] * sy; i ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke();
  x.fillStyle = fr.paleta.areola; x.beginPath(); let ini = false;
  for (let i = 0; i < n; i++) { const q = j0 * n + i; if (!G.dentro[q]) continue; const X = X0 + (G.xs[i] + G.ext) * sx, Y = oy0 - G.F[q] * sy; ini ? x.lineTo(X, Y) : (x.moveTo(X, Y), (ini = true)); }
  for (let i = n - 1; i >= 0; i--) { const q = j0 * n + i; if (!G.dentro[q]) continue; x.lineTo(X0 + (G.xs[i] + G.ext) * sx, oy0 - G.S[q] * sy); } x.fill();
  card(24, 626, 952, 340, "Medidas e parâmetros");
  const m = J.medidas; x.fillStyle = "#1C1730"; x.font = "15px IBM Plex Mono, monospace";
  [[`Escala`, `${m.px_por_mm} px/mm (marcador ${m.marcador})`], [`Cor`, m.cor_referencia], [`Aréola`, `${m.areola_eixo_maior_mm} × ${m.areola_eixo_menor_mm} mm, ${m.areola_angulo_graus}°`], [`Papila`, `Ø ${m.papila_diam_mm} mm · projeção ${m.papila_proj_mm} mm (${m.papila_proj_fonte})`], [`Espessura`, `${S.p.esp_centro_mm} mm no centro → ${S.p.esp_borda_mm} mm na borda`], [`Margem / raio`, `${S.p.margem_mm} mm / ${S.p.raio_mama_mm} mm`], [`Lados`, `foto ${J.foto.mama} → prótese ${J.protese.mama}${J.protese.espelhada ? " (espelhada)" : ""}`], [`Silicone`, J.volume_silicone_ml != null ? `${J.volume_silicone_ml} mL` : "—"], [`Contornos`, m.contornos]]
    .forEach(([k2, v], i) => { x.fillStyle = "#5B5573"; x.fillText(k2, 44, 680 + i * 30); x.fillStyle = "#1C1730"; x.fillText(v, 220, 680 + i * 30); });
  card(992, 626, 584, 340, "Cores de referência");
  [["aréola", m.cores.areola], ["papila", m.cores.papila], ["pele", m.cores.pele]].forEach(([nm, h], i) => { x.fillStyle = h; x.beginPath(); x.roundRect ? x.roundRect(1012 + i * 186, 666, 170, 70, 8) : x.rect(1012 + i * 186, 666, 170, 70); x.fill(); x.fillStyle = "#1C1730"; x.font = "14px IBM Plex Mono, monospace"; x.fillText(`${nm} ${h}`, 1012 + i * 186, 758); });
  x.fillStyle = "#B04E0C"; x.font = "13px Instrument Sans, sans-serif"; J.avisos.slice(0, 5).forEach((t, i) => x.fillText("• " + (t.length > 80 ? t.slice(0, 78) + "…" : t), 1012, 796 + i * 22));
  x.fillStyle = "#5B5573"; x.font = "12.5px Instrument Sans, sans-serif"; x.fillText("Lab.EITA · Laboratório de Estudos Inventivos em Tecnologias Assistivas · Universidade Federal de Goiás — protótipo de pesquisa, não validado clinicamente.", 24, H - 14);
  return new Promise((ok) => c.toBlob(ok, "image/png"));
}
const LEIAME = `EITA! MAMILO — pacote de fabricação (Lab.EITA/UFG)

molde_frontal.stl ...... molde com a cavidade para cima (face visível da prótese, com o relevo)
contramolde.stl ........ face que fica contra a pele, com 4 pinos de registro e canal de transbordo
protese_referencia.stl . a prótese em si, para conferência visual
segmentacao.json ....... contornos em pixels (compatível com o pipeline Python: --segmentacao)
relatorio.pdf ......... relatório de fabricação (paciente, medidas, cores, checagem de segurança)
relatorio.json ........ medidas, cores, parâmetros e avisos

Fabricação sugerida: moldes em resina SLA/DLP (camada <= 50 um), pós-cura completa, teste de inibição
da cura do silicone platinum, desmoldante, pintura intrínseca em camadas e silicone de grau médico.
Protótipo de pesquisa: não é dispositivo médico validado.
`;
$("exp").onclick = async () => {
  if (!S.frontal) return; const res = parseFloat($("res").value), caso = codigoArquivo();
  try {
    ocupado(true, "Calculando a geometria…"); await espera();
    const G = geometria(res);
    ocupado(true, "Gerando os moldes…"); await espera();
    const ex = E.exportarConjunto(G, S.p); S.vol = ex.volume_ml;
    const J = relatorioJSON(G, ex.volume_ml);
    ocupado(true, "Montando o relatório…"); await espera(); const pdf = await gerarPDF(G, ex.volume_ml);
    ocupado(true, "Compactando…"); await espera();
    const zip = await E.zip(Object.assign({}, ex.arquivos, { "relatorio.json": JSON.stringify(J, null, 2), "segmentacao.json": JSON.stringify(S.frontal.seg, null, 2), "LEIA-ME.txt": LEIAME, "relatorio.pdf": pdf }));
    ocupado(false);
    $("expInfo").innerHTML = `<div class="okbox">3 STL (malhas fechadas) · silicone ${fmt(ex.volume_ml, 2)} mL · pacote ${fmt(zip.size / 1e6, 1)} MB</div>`;
    legenda();
    if (await salvar(`EITA-Mamilo_${caso}.zip`, zip)) feito("s6");
  } catch (e) { ocupado(false); status("Falha ao exportar: " + e.message, true); }
};
$("expPdf").onclick = async () => { if (!S.frontal) return; try { ocupado(true, "Montando o relatório…"); await espera(); const G = geometria(0.2); let vol = S.vol; if (vol == null) { const n = G.n, idx = Array.from({ length: n }, (_, i) => i); vol = E.volume(E.solido(G.xs, idx, n, G.S, Float32Array.from(G.S, (s, q) => s + Math.max(G.T[q], 1e-3)), G.dentro, false, false)) / 1000; } const pdf = await gerarPDF(G, vol); ocupado(false); await salvar(`EITA-Mamilo_${codigoArquivo()}_relatorio.pdf`, new Blob([pdf], { type: "application/pdf" })); } catch (e) { ocupado(false); status("Falha ao gerar o relatório: " + e.message, true); } };


// ------------------------------------------------------------------ 0. ficha da paciente (padrão EITA! AFO)
const FICHA_KEY = "eitaMAMILO.fichas.v1", PAT_IDS = ["pName", "pId", "pBirth", "pLado", "pFoto", "pDiag", "pRecon", "pRadio", "pAlerg", "pGoal", "pProf", "pNotes"];
let pendingFicha = null;
const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function readPatient() { const t = {}; for (const id of PAT_IDS) t[id] = $(id).value.trim(); return t; }
function writePatient(t) { for (const id of PAT_IDS) $(id).value = (t && t[id]) || ""; updAge(); badge(); }
function ageText(d) {
  if (!d) return ""; const e = new Date(d + "T12:00:00"), n = new Date(); if (isNaN(e)) return "";
  let m = (n.getFullYear() - e.getFullYear()) * 12 + n.getMonth() - e.getMonth(); if (n.getDate() < e.getDate()) m--;
  return m < 0 ? "" : Math.floor(m / 12) + " anos";
}
function updAge() { const a = ageText($("pBirth").value); $("pAge").textContent = a ? "Idade: " + a : ""; }
function badge() { const n = $("pName").value.trim(); $("pBadge").textContent = n ? "· " + n : ""; }
function patientCode() {
  const id = $("pId").value.trim(); if (id) return id;
  const nm = $("pName").value.trim();
  return nm ? nm.normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/).filter(Boolean).map((p) => p[0].toUpperCase()).join("").slice(0, 5) : "";
}
function codigoArquivo() { return (($("caso").value || patientCode() || "caso").normalize("NFD").replace(/[̀-ͯ]/g, "")).replace(/[^\w.-]+/g, "_"); }
function fichaId() { if (!S.fichaId) S.fichaId = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); return S.fichaId; }
function collectFicha() {
  const fr = S.frontal;
  return {
    formato: "EITA! MAMILO ficha", versaoApp: "0.2-web", id: fichaId(), nome: $("pName").value.trim(), codigo: patientCode(), atualizado: new Date().toISOString(),
    paciente: readPatient(),
    foto: fr ? { arquivo: fr.nome, largura: fr.img.width, altura: fr.img.height } : null,
    segmentacao: fr ? JSON.parse(JSON.stringify(fr.seg)) : null, cantos: fr ? fr.cantos.map((c) => c.map((v) => +v.toFixed(2))) : null,
    marcadorAuto: fr ? fr.marcadorAuto : null, editado: fr ? fr.editado : false,
    lateral: S.lateral ? { arquivo: S.lateral.nome, projecao_mm: S.lateral.projecao_mm, forma_n: S.lateral.forma_n, largura_base_mm: S.lateral.largura_base_mm } : null,
    projForcada: S.projForcada, forma: S.forma,
    lados: { foto: $("photoSide").value, protese: $("protSide").value },
    parametros: JSON.parse(JSON.stringify(S.p)),
    resultado: S.vol ? { volume_ml: +S.vol.toFixed(3) } : null
  };
}
function fichaList() { try { return JSON.parse(localStorage.getItem(FICHA_KEY) || "[]"); } catch (e) { return []; } }
function fichaStore(l) { try { localStorage.setItem(FICHA_KEY, JSON.stringify(l)); return true; } catch (e) { return false; } }
let delPend = null;
function renderFichas() {
  const el = $("fList"), l = fichaList();
  if (!l.length) { el.innerHTML = '<div class="note">Nenhuma ficha salva neste navegador.</div>'; return; }
  el.innerHTML = l.map((f, i) => `<div class="frow"><div><b>${esc(f.nome || "(sem nome)")}</b><small>${f.paciente && f.paciente.pLado ? (f.paciente.pLado === "D" ? "direita · " : "esquerda · ") : ""}${new Date(f.atualizado).toLocaleDateString("pt-BR")} · ${esc(f.foto ? f.foto.arquivo : "sem foto")}</small></div><button type="button" data-open="${i}">Abrir</button><button type="button" class="del" data-del="${i}" title="Excluir">${delPend === f.id ? "Confirmar" : "×"}</button></div>`).join("");
  el.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => openFicha(fichaList()[+b.dataset.open])));
  el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => {
    const l2 = fichaList(), f = l2[+b.dataset.del];
    if (delPend !== f.id) { delPend = f.id; renderFichas(); status(`Clique em "Confirmar" para excluir a ficha "${esc(f.nome)}" deste navegador.`, true); setTimeout(() => { if (delPend === f.id) { delPend = null; renderFichas(); } }, 5000); return; }
    l2.splice(+b.dataset.del, 1); fichaStore(l2); delPend = null; renderFichas(); status("Ficha excluída deste navegador.");
  }));
}
function saveFicha() {
  const f = collectFicha();
  if (!f.nome && !f.paciente.pId) { status("Dê um nome ou prontuário à ficha antes de salvar.", true); $("pName").focus(); return; }
  if (!f.nome) f.nome = f.paciente.pId;
  const l = fichaList(), i = l.findIndex((x) => x.id === f.id); if (i >= 0) l[i] = f; else l.unshift(f);
  const ok = fichaStore(l);
  status(ok ? `Ficha "${esc(f.nome)}" salva neste navegador. Use "Exportar" para guardar uma cópia em arquivo.` : 'Não foi possível salvar no navegador; use "Exportar".', !ok);
  renderFichas();
}
async function exportFicha() { const f = collectFicha(); await salvar(((f.codigo || "ficha").replace(/[^\w-]+/g, "_")) + "_ficha_MAMILO.json", JSON.stringify(f, null, 1)); }
function sincronizarControles() {
  for (const [id, ch, d] of PARES) { $(id).value = S.p[ch].toFixed(d); $(id + "R").value = S.p[ch]; }
  const T = S.p.textura_papila; for (const [id, ch, d] of TXP) { $(id).value = (+T[ch]).toFixed(d); $(id + "R").value = T[ch]; }
  $("txOn").checked = !!T.ativa; $("txBox").style.opacity = T.ativa ? 1 : 0.5; $("pInv").checked = !!S.p.relevo_inverter; $("marcMM").value = S.p.marcador_mm;
}
function openFicha(f) {
  if (!f || f.formato !== "EITA! MAMILO ficha") { status("Arquivo de ficha não reconhecido.", true); return; }
  S.fichaId = f.id; writePatient(f.paciente || { pName: f.nome });
  if (f.lados) { $("photoSide").value = f.lados.foto; $("protSide").value = f.lados.protese; }
  if (f.parametros) { S.p = Object.assign({}, E.PARAMETROS, f.parametros, { textura_papila: Object.assign({}, E.PARAMETROS.textura_papila, f.parametros.textura_papila || {}) }); sincronizarControles(); }
  lados();
  if (f.foto && (!S.frontal || S.frontal.nome !== f.foto.arquivo)) { pendingFicha = f; abrir("s1"); status(`Ficha "${esc(f.nome)}" aberta. Carregue a foto <b>${esc(f.foto.arquivo)}</b> (etapa 1) para aplicar os contornos e as medidas.`); return; }
  aplicarFicha(f);
}
function aplicarFicha(f) {
  pendingFicha = null; const fr = S.frontal;
  if (fr && f.segmentacao && f.foto && fr.img.width === f.foto.largura && fr.img.height === f.foto.altura) {
    fr.seg = JSON.parse(JSON.stringify(f.segmentacao)); fr.editado = !!f.editado;
    if (f.cantos && !f.marcadorAuto) { fr.cantos = f.cantos; fr.marcadorAuto = false; recalibrar(); }
    fr.paleta = E.paleta(fr.img, fr.seg);
  } else if (fr && f.foto) status("A foto carregada tem outro tamanho que a da ficha: os contornos foram refeitos automaticamente.", true);
  if (f.lateral && (!S.lateral || S.lateral.nome !== f.lateral.arquivo)) { S.lateral = null; S.p.papila_proj_mm = f.lateral.projecao_mm; S.forma = f.lateral.forma_n; S.projForcada = false; }
  else if (!f.lateral) { S.forma = f.forma || S.forma; }
  if (f.projForcada && S.lateral) S.projForcada = true;
  S.prev = null; atualizarTudo(); desenharFoto(); agendarPrevia(); feito("s0");
  status(`Ficha "${esc(f.nome || "")}" aplicada: contornos, medidas e parâmetros restaurados.`);
}
async function dbExport() {
  const l = fichaList(), d = new Date();
  await salvar(`base_EITA_MAMILO_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.json`, JSON.stringify({ formato: "EITA! MAMILO base", versaoApp: "0.2-web", exportado: d.toISOString(), fichas: l }));
}
async function dbImport(file) {
  try {
    const b = JSON.parse(await file.text()); if (b.formato !== "EITA! MAMILO base") throw new Error("o arquivo não é uma base do EITA! MAMILO");
    const m = new Map(fichaList().map((f) => [f.id, f])); let novas = 0, atual = 0;
    for (const f of b.fichas || []) { if (!f || f.formato !== "EITA! MAMILO ficha") continue; const x = m.get(f.id); if (!x) { m.set(f.id, f); novas++; } else if (new Date(f.atualizado) > new Date(x.atualizado)) { m.set(f.id, f); atual++; } }
    fichaStore([...m.values()].sort((a, c) => new Date(c.atualizado) - new Date(a.atualizado))); renderFichas();
    status(`Base importada: ${novas} fichas novas e ${atual} atualizadas.`);
  } catch (e) { status("Não foi possível importar a base: " + e.message, true); }
}
$("fSave").onclick = saveFicha; $("fExp").onclick = exportFicha; $("fImpB").onclick = () => $("fImp").click();
$("fImp").onchange = async () => { const f = $("fImp").files[0]; if (f) { try { openFicha(JSON.parse(await f.text())); } catch (e) { status("Não foi possível ler a ficha: " + e.message, true); } $("fImp").value = ""; } };
$("dbExp").onclick = dbExport; $("dbImpB").onclick = () => $("dbImp").click(); $("dbImp").onchange = () => { const f = $("dbImp").files[0]; if (f) dbImport(f); $("dbImp").value = ""; };
$("pName").addEventListener("input", badge); $("pBirth").addEventListener("input", updAge);
$("pLado").addEventListener("change", () => { const v = $("pLado").value; if (v) { $("protSide").value = v; lados(); } });
$("s0").addEventListener("change", () => atualizarTudo());
renderFichas();

// ------------------------------------------------------------------ checagem de segurança
function checagens() {
  const out = [], P = readPatient(), fr = S.frontal;
  if (P.pRadio === "curso") out.push({ n: "alerta", t: "Radioterapia em curso: não use adesivo nem prótese sobre a pele irradiada sem liberação da equipe." });
  if (P.pRadio === "recente") out.push({ n: "alerta", t: "Radioterapia há menos de 6 meses: avalie a pele e a liberação médica antes do uso do adesivo." });
  if (P.pAlerg) out.push({ n: /silic|adesiv|cola|esparadrap|látex|latex|acril/i.test(P.pAlerg) ? "alerta" : "atenção", t: "Alergia ou sensibilidade informada (" + P.pAlerg + "): faça teste de contato com o silicone e o adesivo antes da entrega." });
  if (fr) {
    if (!fr.marcadorAuto) out.push({ n: "atenção", t: "Marcador não detectado automaticamente: confira a escala com uma régua." });
    if (fr.persp > 0.05) out.push({ n: "atenção", t: `Marcador em perspectiva (${fmt(fr.persp * 100, 0)} %): as medidas podem ter erro.` });
    if (!fr.refCor) out.push({ n: "atenção", t: "Cor sem calibração: use as cores apenas como orientação." });
    else if (/SATURADO/.test(fr.refCor)) out.push({ n: "atenção", t: "Branco do marcador saturado: cor pouco confiável." });
    if (fr.papFonte === "estimada por proporção" && !fr.editado) out.push({ n: "atenção", t: "Papila não detectada: o diâmetro foi estimado. Confira na etapa 2." });
  }
  if (!S.lateral) out.push({ n: "info", t: `Sem foto lateral: projeção da papila digitada (${fmt(S.p.papila_proj_mm)} mm).` });
  else if (fr) { const dpf = fr.seg.papila.diam_px / fr.k; if (S.lateral.largura_base_mm < 0.6 * dpf || S.lateral.largura_base_mm > 2 * dpf) out.push({ n: "atenção", t: "A largura da papila no perfil não bate com a foto frontal." }); }
  if (S.p.textura_papila.ativa && parseFloat($("res").value) > 0.1) out.push({ n: "info", t: "Textura da papila ativa com malha acima de 0,10 mm: os óstios podem não aparecer no molde." });
  if (!P.pProf) out.push({ n: "info", t: "Profissional responsável não informado na ficha." });
  return out;
}

// ------------------------------------------------------------------ relatório em PDF (gerador próprio, mesmo do EITA! AFO)
const CP1252 = { "€": 128, "‚": 130, "ƒ": 131, "„": 132, "…": 133, "†": 134, "‡": 135, "ˆ": 136, "‰": 137, "Š": 138, "‹": 139, "Œ": 140, "Ž": 142, "‘": 145, "’": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151, "˜": 152, "™": 153, "š": 154, "›": 155, "œ": 156, "ž": 158, "Ÿ": 159 };
const SUBST = { "→": "->", "≥": ">=", "≤": "<=", "⚠": "!", "≈": "~" };
function pdfEsc(t) { let e = ""; for (let ch of String(t)) { if (SUBST[ch]) ch = SUBST[ch]; for (const c2 of ch) { let o = c2.charCodeAt(0); if (o > 255) o = CP1252[c2] || 63; const l = String.fromCharCode(o); e += l === "(" || l === ")" || l === "\\" ? "\\" + l : l; } } return e; }
function pdfW(t, s) { let n = 0; for (const o of String(t)) n += /[ilI.,;:'|!]/.test(o) ? 0.28 : /[mwMW@]/.test(o) ? 0.85 : /[A-Z0-9]/.test(o) ? 0.64 : 0.52; return n * s; }
function corta(t, s, w) { t = String(t); if (pdfW(t, s) <= w) return t; while (t.length > 1 && pdfW(t + "…", s) > w) t = t.slice(0, -1); return t + "…"; }
function quebra(t, s, w) { const pal = String(t).split(/\s+/), lin = []; let a = ""; for (const p of pal) { if (pdfW(a + " " + p, s) > w && a) { lin.push(a); a = p; } else a = a ? a + " " + p : p; } if (a) lin.push(a); return lin; }
class PdfPage {
  constructor() { this.c = ""; }
  rect(x, y, w, h, c) { this.c += `${c.map((v) => v.toFixed(3)).join(" ")} rg ${x} ${y} ${w} ${h} re f\n`; }
  line(x, y, x2, y2, c, w = 0.6) { this.c += `${c.map((v) => v.toFixed(3)).join(" ")} RG ${w} w ${x} ${y} m ${x2} ${y2} l S\n`; }
  text(x, y, s, t, b, c = [0.11, 0.09, 0.19]) { this.c += `BT /${b ? "F2" : "F1"} ${s} Tf ${c.map((v) => v.toFixed(3)).join(" ")} rg ${x} ${y} Td (${pdfEsc(t)}) Tj ET\n`; }
  image(n, x, y, w, h) { this.c += `q ${w} 0 0 ${h} ${x} ${y} cm /${n} Do Q\n`; }
}
function makePDF(pages, imgs) {
  const bin = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
  const partes = [], off = []; let pos = 0; const add = (u) => { partes.push(u); pos += u.length; };
  add(bin("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"));
  const ni = imgs.length, p0 = 5 + ni, tot = 4 + ni + pages.length * 2;
  const obj = (k, b) => { off[k] = pos; add(b instanceof Uint8Array ? b : bin(`${k} 0 obj\n${b}\nendobj\n`)); };
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => p0 + i * 2 + " 0 R").join(" ")}] /Count ${pages.length} >>`);
  obj(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  obj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const xo = imgs.map((m, i) => `/${m.name} ${5 + i} 0 R`).join(" ");
  imgs.forEach((m, i) => { const k = 5 + i, a = bin(`${k} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${m.w} /Height ${m.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${m.bytes.length} >>\nstream\n`), z = bin("\nendstream\nendobj\n"), u = new Uint8Array(a.length + m.bytes.length + z.length); u.set(a); u.set(m.bytes, a.length); u.set(z, a.length + m.bytes.length); obj(k, u); });
  pages.forEach((pg, i) => {
    const k = p0 + i * 2, cont = bin(pg.c);
    obj(k, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xo} >> >> /Contents ${k + 1} 0 R >>`);
    const a = bin(`${k + 1} 0 obj\n<< /Length ${cont.length} >>\nstream\n`), z = bin("\nendstream\nendobj\n"), u = new Uint8Array(a.length + cont.length + z.length); u.set(a); u.set(cont, a.length); u.set(z, a.length + cont.length); obj(k + 1, u);
  });
  const xref = pos; let x = `xref\n0 ${tot + 1}\n0000000000 65535 f \n`;
  for (let k = 1; k <= tot; k++) x += String(off[k]).padStart(10, "0") + " 00000 n \n";
  add(bin(x + `trailer\n<< /Size ${tot + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  const out = new Uint8Array(pos); let o = 0; for (const p of partes) { out.set(p, o); o += p.length; } return out;
}
function jpegOf(c, q = 0.88) { const d = c.toDataURL("image/jpeg", q), b = atob(d.split(",")[1]), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return { bytes: u, w: c.width, h: c.height }; }
async function logoJpeg() { try { const i = new Image(); i.src = "assets/eita-mamilo-simbolo.png"; await i.decode(); const c = document.createElement("canvas"); c.width = c.height = 160; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 160, 160); x.drawImage(i, 0, 0, 160, 160); return jpegOf(c, 0.92); } catch (e) { return null; } }
function imgContornos() {
  const fr = S.frontal, a = fr.seg.areola, p = fr.seg.papila, r = Math.max(a.eixo_maior_px, a.eixo_menor_px) * 0.8, c = document.createElement("canvas"); c.width = c.height = 600; const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, 600, 600); x.drawImage(fr.canvas, a.cx - r, a.cy - r, 2 * r, 2 * r, 0, 0, 600, 600);
  const s = 600 / (2 * r); x.save(); x.translate(300, 300); x.scale(s, s); x.translate(-a.cx, -a.cy); x.lineWidth = 3 / s;
  x.strokeStyle = COR.areola; x.beginPath(); x.ellipse(a.cx, a.cy, a.eixo_maior_px / 2, a.eixo_menor_px / 2, (a.angulo_graus * Math.PI) / 180, 0, 7); x.stroke();
  x.strokeStyle = COR.papila; x.beginPath(); x.arc(p.cx, p.cy, p.diam_px / 2, 0, 7); x.stroke(); x.restore();
  const l10 = 10 * fr.k * s; x.fillStyle = "rgba(255,255,255,.9)"; x.fillRect(16, 556, l10 + 70, 30); x.fillStyle = "#1C1730"; x.fillRect(26, 570, l10, 4); x.font = "600 16px Helvetica, Arial"; x.fillText("10 mm", 34 + l10, 578);
  return jpegOf(c);
}
function imgTopo(G) {
  const fr = S.frontal, n = G.n, R = 600, c = document.createElement("canvas"); c.width = c.height = R; const x = c.getContext("2d"), im = x.createImageData(R, R);
  const ext = Math.max(G.a, G.b) * G.rho_out * 1.12, dx = G.xs[1] - G.xs[0], hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const cA = hx(fr.paleta.areola), cP = hx(fr.paleta.papila), cS = hx(fr.paleta.pele), ox = G.papila_offset_mm[0], oy = G.papila_offset_mm[1], rp0 = G.papila_diam_mm / 2;
  const F = (i, j) => G.F[E.clamp(j, 0, n - 1) * n + E.clamp(i, 0, n - 1)];
  for (let py = 0; py < R; py++) for (let px = 0; px < R; px++) {
    const X = -ext + (2 * ext * px) / R, Y = ext - (2 * ext * py) / R, i = Math.round((X - G.xs[0]) / dx), j = Math.round((Y - G.xs[0]) / dx), o = 4 * (py * R + px);
    const q = E.clamp(j, 0, n - 1) * n + E.clamp(i, 0, n - 1);
    const gx = (F(i + 1, j) - F(i - 1, j)) / (2 * dx) * 2.5, gy = (F(i, j + 1) - F(i, j - 1)) / (2 * dx) * 2.5, nl = Math.hypot(gx, gy, 1);
    const sh = 0.45 + 0.6 * Math.max(0, (gx * 0.45 - gy * 0.5 + 0.74) / (nl * 1.0)), rho = G.rho[q];
    let c0 = !G.dentro[q] ? cS.map((v) => v * 0.55 + 115) : Math.hypot(X - ox, Y - oy) / rp0 < 1.03 ? cP : rho < 0.97 ? cA : cS;
    const k = G.dentro[q] ? sh : 1; im.data[o] = E.clamp(c0[0] * k, 0, 255); im.data[o + 1] = E.clamp(c0[1] * k, 0, 255); im.data[o + 2] = E.clamp(c0[2] * k, 0, 255); im.data[o + 3] = 255;
  }
  x.putImageData(im, 0, 0); return jpegOf(c);
}
function imgCorte(G) {
  const c = document.createElement("canvas"); c.width = 900; c.height = 600; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 900, 600);
  const n = G.n, j0 = E.clamp(Math.round((G.papila_offset_mm[1] - G.xs[0]) / (G.xs[1] - G.xs[0])), 0, n - 1), L = Math.max(G.a, G.b) * G.rho_out + 3;
  let zmin = 1e9, zmax = -1e9; for (let i = 0; i < n; i++) { if (Math.abs(G.xs[i]) > L) continue; zmin = Math.min(zmin, G.S[j0 * n + i]); zmax = Math.max(zmax, G.F[j0 * n + i]); }
  const s = Math.min(820 / (2 * L), 440 / (zmax - zmin) / 2.5), X = (v) => 450 + v * s, Y = (z) => 520 - (z - zmin) * s * 2.5;
  x.strokeStyle = "#EEEAF6"; x.lineWidth = 1; for (let g = -Math.floor(L / 5) * 5; g <= L; g += 5) { x.beginPath(); x.moveTo(X(g), 40); x.lineTo(X(g), 530); x.stroke(); }
  x.fillStyle = S.frontal.paleta.areola; x.beginPath(); let ini = false;
  for (let i = 0; i < n; i++) { if (Math.abs(G.xs[i]) > L) continue; const q = j0 * n + i; if (!G.dentro[q]) continue; ini ? x.lineTo(X(G.xs[i]), Y(G.F[q])) : (x.moveTo(X(G.xs[i]), Y(G.F[q])), (ini = true)); }
  for (let i = n - 1; i >= 0; i--) { if (Math.abs(G.xs[i]) > L) continue; const q = j0 * n + i; if (G.dentro[q]) x.lineTo(X(G.xs[i]), Y(G.S[q])); }
  x.fill(); x.strokeStyle = "#A79FBF"; x.lineWidth = 2; x.beginPath(); ini = false;
  for (let i = 0; i < n; i++) { if (Math.abs(G.xs[i]) > L) continue; const v = [X(G.xs[i]), Y(G.S[j0 * n + i])]; ini ? x.lineTo(...v) : (x.moveTo(...v), (ini = true)); } x.stroke();
  x.fillStyle = "#5B5573"; x.font = "30px Helvetica, Arial"; x.fillText("escala vertical 2,5×", 24, 40); x.fillText("linhas a cada 5 mm", 24, 585);
  return jpegOf(c);
}
async function gerarPDF(G, vol) {
  const fr = S.frontal, P = readPatient(), J = relatorioJSON(G, vol), m = J.medidas, T = S.p.textura_papila;
  const imgs = [Object.assign({ name: "Im1" }, imgContornos()), Object.assign({ name: "Im2" }, imgTopo(G)), Object.assign({ name: "Im3" }, imgCorte(G))];
  const lg = await logoJpeg(); if (lg) imgs.push(Object.assign({ name: "Lg" }, lg));
  const ROXO = [0.42, 0.25, 0.84], TINTA = [0.11, 0.09, 0.19], SUT = [0.36, 0.33, 0.45], LIN = [0.88, 0.86, 0.93], d = (v, k = 1) => (v == null || isNaN(v) ? "—" : (+v).toFixed(k).replace(".", ","));
  const v = (t) => (t && String(t).trim() ? String(t).trim() : "—");
  const L = new PdfPage(), pags = [L];
  L.rect(0, 792, 595, 50, [0.97, 0.96, 0.99]); L.rect(0, 790, 595, 2.5, ROXO);
  if (lg) L.image("Lg", 36, 800, 34, 34);
  const x0 = lg ? 78 : 36; L.text(x0, 820, 18, "EITA!", true, [0.07, 0.07, 0.07]); L.text(x0 + pdfW("EITA! ", 18), 820, 18, "MAMILO", true, [0.584, 0.376, 0.992]);
  L.text(x0, 805, 9, "Relatório de fabricação · prótese externa de aréola e papila · Lab.EITA / UFG", false, SUT);
  const agora = new Date(); L.text(430, 820, 9, agora.toLocaleDateString("pt-BR") + " " + agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), false, SUT);
  L.text(430, 806, 9, corta(P.pName || patientCode() || "paciente não identificada", 9, 128), true, TINTA);
  // paciente
  let y = 776; L.text(36, y, 10.5, "Paciente", true, ROXO); y -= 6; L.line(36, y, 559, y, LIN); y -= 13;
  const campo = (x, w, rot, val) => { L.text(x, y, 7.6, rot, false, SUT); L.text(x, y - 10, 9, corta(v(val), 9, w - 6), true, TINTA); };
  const nasc = P.pBirth ? new Date(P.pBirth + "T12:00:00").toLocaleDateString("pt-BR") : "", idade = ageText(P.pBirth);
  const RECON = { nenhuma: "sem reconstrução", implante: "implante / expansor", retalho: "retalho autólogo", "nipple-sparing": "mastectomia poupadora", outra: "outra" };
  const RADIO = { nao: "não fez", concluida: "concluída há 6 meses ou mais", recente: "concluída há menos de 6 meses", curso: "em curso" };
  campo(36, 200, "Nome", P.pName); campo(236, 100, "Prontuário / código", P.pId); campo(336, 140, "Nascimento", nasc ? nasc + (idade ? " · " + idade : "") : ""); campo(476, 83, "Fototipo", P.pFoto); y -= 25;
  campo(36, 200, "Mama da prótese", J.protese.mama + (J.protese.espelhada ? " (foto da " + J.foto.mama + ", espelhada)" : "")); campo(236, 323, "Diagnóstico / cirurgia", P.pDiag); y -= 25;
  campo(36, 200, "Reconstrução", RECON[P.pRecon]); campo(236, 160, "Radioterapia", RADIO[P.pRadio]); campo(396, 163, "Alergias / sensibilidade", P.pAlerg); y -= 25;
  campo(36, 260, "Objetivo / indicação", P.pGoal); campo(304, 255, "Profissional responsável", P.pProf); y -= 25;
  campo(36, 523, "Observações", (P.pNotes || "").replace(/\s+/g, " ")); y -= 22;
  // imagens
  const iw = 160, gap = (523 - 3 * iw) / 2, iy = y - iw;
  L.image("Im1", 36, iy, iw, iw); L.image("Im2", 36 + iw + gap, iy, iw, iw); L.image("Im3", 36 + 2 * (iw + gap), iy + (iw - (iw * 600) / 900) / 2, iw, (iw * 600) / 900);
  L.text(36, iy - 11, 7.6, "Contornos na foto calibrada", false, SUT); L.text(36 + iw + gap, iy - 11, 7.6, "Prótese, vista de frente (relevo)", false, SUT); L.text(36 + 2 * (iw + gap), iy - 11, 7.6, "Corte pela papila", false, SUT);
  y = iy - 30;
  let pg = L;
  const novaPagina = () => { pg = new PdfPage(); pags.push(pg); pg.rect(0, 820, 595, 22, [0.97, 0.96, 0.99]); pg.text(36, 826, 9.5, "EITA! MAMILO · " + corta(P.pName || patientCode() || "", 9, 300) + " · continuação", true, ROXO); y = 796; };
  const tabela = (x, tit, linhas) => { let yy = y; pg.text(x, yy, 10.5, tit, true, ROXO); yy -= 6; pg.line(x, yy, x + 255, yy, LIN); yy -= 13; for (const [a, b] of linhas) { pg.text(x, yy, 8.8, corta(a, 8.8, 150), false, SUT); const s = corta(String(b), 8.8, 140); pg.text(x + 255 - pdfW(s, 8.8), yy, 8.8, s, true, TINTA); yy -= 13.2; } return yy; };
  const par = (t1, l1, t2, l2) => { const h = 26 + Math.max(l1.length, l2.length) * 13.2; if (y - h < 50) novaPagina(); const a = tabela(36, t1, l1), b = tabela(304, t2, l2); y = Math.min(a, b) - 12; };
  par("Fotografia e medidas", [["Foto frontal", corta(fr.nome, 8.8, 140)], ["Escala", d(m.px_por_mm, 2) + " px/mm"], ["Marcador", m.marcador], ["Referência de cor", m.cor_referencia], ["Aréola (eixos)", d(m.areola_eixo_maior_mm) + " × " + d(m.areola_eixo_menor_mm) + " mm"], ["Ângulo da aréola", d(m.areola_angulo_graus, 0) + "°"], ["Papila, diâmetro", d(m.papila_diam_mm) + " mm"], ["Papila, projeção", d(m.papila_proj_mm) + " mm (" + m.papila_proj_fonte + ")"], ["Forma da papila (expoente)", d(m.papila_forma_n, 2)], ["Contornos", m.contornos]],
    "Prótese", [["Espessura no centro", d(S.p.esp_centro_mm, 2) + " mm"], ["Borda afinada", d(S.p.esp_borda_mm, 2) + " mm"], ["Margem além da aréola", d(S.p.margem_mm) + " mm"], ["Microrrelevo da foto", d(S.p.relevo_amp_mm, 2) + " mm" + (S.p.relevo_inverter ? " (invertido)" : "")], ["Raio da mama (verso)", d(S.p.raio_mama_mm, 0) + " mm"], ["Textura da papila", T.ativa ? "sim · intensidade " + d(T.intensidade) : "não"], ["Lóbulos / sulcos", T.ativa ? d(T.lobulo_mm) + " / " + d(T.sulco_mm, 2) + " mm" : "—"], ["Óstios / rugas / sulco basal", T.ativa ? T.ostios + " / " + d(T.ruga_amp_mm, 2) + " / " + d(T.sulco_basal_mm, 2) + " mm" : "—"], ["Espelhada", J.protese.espelhada ? "sim" : "não"]]);
  const dimA = 2 * G.a * G.rho_out, dimB = 2 * G.b * G.rho_out;
  par("Resultado", [["Dimensões da prótese", d(dimA) + " × " + d(dimB) + " mm"], ["Altura total no centro", d(G.papila_proj_mm + S.p.esp_centro_mm) + " mm"], ["Volume de silicone", vol != null ? d(vol, 2) + " mL" : "—"], ["Massa estimada (1,1 g/mL)", vol != null ? d(vol * 1.1, 1) + " g" : "—"], ["Bloco dos moldes", d(2 * (G.ext - 1), 0) + " × " + d(2 * (G.ext - 1), 0) + " mm"], ["Resolução da malha", d(parseFloat($("res").value), 2) + " mm"], ["Malhas", "sólidos fechados"]],
    "Fabricação", [["Moldes", "SLA/DLP, camada <= 0,05 mm"], ["Pós-cura", "completa + teste de cura"], ["Desmoldante", "antes da pintura"], ["Pintura", "intrínseca, em camadas"], ["Silicone", "platinum, grau médico"], ["Fixação", "adesivo de grau médico"], ["Acabamento", "aparar a borda fina"]]);
  // cores
  if (y - 70 < 50) novaPagina();
  pg.text(36, y, 10.5, "Cores de referência (pigmentação)", true, ROXO); y -= 6; pg.line(36, y, 559, y, LIN); y -= 34;
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  [["Aréola", m.cores.areola], ["Papila", m.cores.papila], ["Pele ao redor", m.cores.pele]].forEach(([nm, h], i) => { const x = 36 + i * 176; pg.rect(x, y, 40, 24, rgb(h)); pg.text(x + 48, y + 13, 9, nm, true, TINTA); pg.text(x + 48, y + 2, 8.4, h.toUpperCase(), false, SUT); });
  y -= 22;
  // segurança
  const ch = checagens(), hS = 24 + ch.reduce((s, c) => s + 11 * quebra(c.t, 8.6, 465).length + 2, 12); if (y - hS < 48) novaPagina();
  pg.text(36, y, 10.5, "Checagem de segurança", true, ROXO); y -= 6; pg.line(36, y, 559, y, LIN); y -= 13;
  if (!ch.length) { pg.text(36, y, 8.8, "Nenhum problema encontrado pelas verificações automáticas.", false, [0.15, 0.47, 0.31]); y -= 12; }
  for (const c of ch) { const cor = c.n === "alerta" ? [0.62, 0.18, 0.08] : c.n === "info" ? SUT : [0.55, 0.33, 0.03]; const lin = quebra(c.t, 8.6, 465); if (y - lin.length * 11 < 46) novaPagina(); pg.text(36, y, 8.6, c.n === "alerta" ? "ALERTA" : c.n === "info" ? "info" : "atenção", true, cor); lin.forEach((l, k) => pg.text(92, y - k * 11, 8.6, l, false, TINTA)); y -= 11 * lin.length + 2; }
  y -= 8; if (y < 76) novaPagina();
  pg.line(36, y, 559, y, LIN);
  quebra("Medidas obtidas por fotografia calibrada e modelo computacional. Protótipo de pesquisa, não validado clinicamente: confira as medidas, a cor e a adaptação na paciente antes da entrega. A prótese não substitui a avaliação da equipe de saúde.", 8, 523).forEach((l, k) => pg.text(36, y - 14 - k * 11, 8, l, false, SUT));
  pags.forEach((p, i) => {
    if (i === 0) { p.text(36, 34, 7.2, "EITA! MAMILO · © 2026 Lab.EITA — Laboratório de Estudos Inventivos em Tecnologias Assistivas · Universidade Federal de Goiás", false, SUT); p.text(36, 24, 7.2, "Autor: Pedro Henrique Gonçalves", false, SUT); }
    else p.text(36, 28, 7.2, "EITA! MAMILO · Lab.EITA / UFG", false, SUT);
    const t = "página " + (i + 1) + " de " + pags.length; p.text(559 - pdfW(t, 7.2), i === 0 ? 24 : 28, 7.2, t, false, SUT);
  });
  return makePDF(pags, imgs);
}

// ------------------------------------------------------------------ ferramentas: marcador e corpo de prova
const SVGM = E.marcadorSVG(BITS_ID7);
$("marcVista").innerHTML = SVGM.replace(/<\?xml[^>]*>/, "");
$("marcDl").onclick = () => salvar("EITA-Mamilo_marcador_v2.svg", SVGM);
let CORPO = null;
function desenharCorpo() {
  if (!CORPO) CORPO = E.corpoDeProva(0.1);
  const cv = $("cvCorpo"), G = CORPO.G, n = G.n, Wd = 520; cv.width = Wd; cv.height = Wd;
  const x = cv.getContext("2d"), img = x.createImageData(Wd, Wd), ext = G.ext, dx = G.xs[1] - G.xs[0];
  const Fv = (i, j) => G.F[E.clamp(j, 0, n - 1) * n + E.clamp(i, 0, n - 1)];
  for (let py = 0; py < Wd; py++) for (let px = 0; px < Wd; px++) {
    const X = -ext + (2 * ext * px) / Wd, Y = ext - (2 * ext * py) / Wd, i = Math.round((X + ext) / dx), j = Math.round((Y + ext) / dx), o = 4 * (py * Wd + px);
    if (Math.hypot(X, Y) > 22.5) { img.data[o] = 244; img.data[o + 1] = 242; img.data[o + 2] = 249; img.data[o + 3] = 255; continue; }
    const gx = ((Fv(i + 1, j) - Fv(i - 1, j)) / (2 * dx)) * 6, gy = ((Fv(i, j + 1) - Fv(i, j - 1)) / (2 * dx)) * 6, nl = Math.hypot(gx, gy, 1);
    const s = Math.max(0, (gx * 0.5 - gy * 0.5 + 0.7) / (nl * 1.0488)), v = 70 + 175 * s;
    img.data[o] = v * 0.86; img.data[o + 1] = v * 0.8; img.data[o + 2] = v; img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const P = (X, Y) => [((X + ext) / (2 * ext)) * Wd, ((ext - Y) / (2 * ext)) * Wd];
  x.font = "600 11px IBM Plex Mono, monospace"; x.textAlign = "center";
  [[0.1, 200], [0.2, 240], [0.3, 300], [0.5, 340]].forEach(([h, a]) => { const [u, v] = P(13.8 * Math.cos((a * Math.PI) / 180), 13.8 * Math.sin((a * Math.PI) / 180)); x.fillStyle = COR.accent; x.fillText(h + "", u, v); });
  [[0.1, -8], [0.2, -4], [0.3, 0], [0.4, 4], [0.5, 8]].forEach(([p, X]) => { const [u, v] = P(X, 9.2); x.fillStyle = COR.accent; x.fillText(String(p), u, v); });
  [["Q1 0,10", 45], ["Q2 0,15", 135], ["Q3 0,20", 225], ["Q4 0,30", 315]].forEach(([t, a]) => { const [u, v] = P(29.5 * Math.cos((a * Math.PI) / 180), 29.5 * Math.sin((a * Math.PI) / 180)); x.fillStyle = COR.ink; x.fillText(t, u, v); });
  x.textAlign = "left";
}
$("corpoDl").onclick = async () => {
  try {
    ocupado(true, "Gerando os moldes do corpo de prova…"); await espera();
    if (!CORPO) CORPO = E.corpoDeProva(0.1);
    const ex = E.exportarConjunto(CORPO.G, Object.assign({}, E.PARAMETROS), 23.5);
    const mapa = await new Promise((ok) => $("cvCorpo").toBlob(ok, "image/png"));
    ocupado(true, "Compactando…"); await espera();
    const arq = Object.fromEntries(Object.entries(ex.arquivos).map(([k, v]) => ["corpo_de_prova_" + k, v]));
    arq["corpo_de_prova.json"] = JSON.stringify(CORPO.espec, null, 2); if (mapa) arq["corpo_de_prova_mapa.png"] = await mapa.arrayBuffer();
    const zip = await E.zip(arq); ocupado(false);
    await salvar("EITA-Mamilo_corpo-de-prova.zip", zip);
  } catch (e) { ocupado(false); status("Falha: " + e.message, true); }
};

// ------------------------------------------------------------------ início
async function carregarExemplo() {
  S.exemplo = true;
  const ok = await processarFrontal("assets/mamilo-exemplo-frontal.jpg", "exemplo-frontal.jpg (sintética)");
  if (ok) { await processarLateral("assets/mamilo-exemplo-lateral.jpg", "exemplo-lateral.jpg (sintética)"); mudarAba("photo"); abrir("s2", true); status("Exemplo sintético carregado. Confira os contornos e siga as etapas, ou carregue a sua foto na etapa 1."); }
}
montarStepper(); lados(); mudarAba("photo");
carregarExemplo();
})();
