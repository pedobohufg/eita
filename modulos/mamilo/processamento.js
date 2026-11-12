/* EITA! MAMILO · processamento — segmentação da aréola/papila, foto lateral,
   geometria da prótese, textura anatômica da papila, moldes e corpo de prova.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import { clamp, hex, mediaDesvio, mediana, percentil, resolver3 } from "../../nucleo/base.js";
import { detectarMarcador } from "../../nucleo/calibracao.js";
import { abertura, bilinear, componenteProxima, desfocar, desfocar1d, elipseMomentos, kernel, medianaCanais, normalizar8, otsu, paraLab, preencherBuracos, rotular } from "../../nucleo/imagem.js";
import { indicesAdaptativos, revolucao, solido, stl as stlNucleo, stlTriangulos, volume } from "../../nucleo/malha.js";

export const CABECALHO_STL = "EITA!Mamilo - Lab.EITA/UFG";
const stl = (malha, transformar) => stlNucleo(malha, transformar, CABECALHO_STL);

export const VERSAO = "0.2-web";
// ------------------------------------------------------------------ segmentação
export function mapaScore(img, labImg) {
  const w = img.width, h = img.height, n = w * h, { L, A } = labImg || paraLab(img);
  const mL = mediana(L), mA = mediana(A), [, dL] = mediaDesvio(L), [, dA] = mediaDesvio(A);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = -(L[i] - mL) / (dL + 1e-6) + 0.7 * (A[i] - mA) / (dA + 1e-6);
  return desfocar(s, w, h, Math.max(2, Math.min(w, h) / 300));
};

export function segmentarAuto(img, cantos, score) {
  const w = img.width, h = img.height, n = w * h;
  const s8 = normalizar8(score), excl = new Uint8Array(n);
  if (cantos) {
    const xs = cantos.map((p) => p[0]), ys = cantos.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), m = 0.45 * (x1 - x0);
    for (let y = Math.max(0, (y0 - m) | 0); y < Math.min(h, y1 + m); y++) for (let x = Math.max(0, (x0 - m) | 0); x < Math.min(w, x1 + m); x++) excl[y * w + x] = 1;
  }
  const valido = new Uint8Array(n); for (let i = 0; i < n; i++) { valido[i] = excl[i] ? 0 : 1; if (excl[i]) s8[i] = 0; }
  const t = otsu(s8, valido);
  let m = new Uint8Array(n); for (let i = 0; i < n; i++) m[i] = s8[i] > t && !excl[i] ? 1 : 0;
  m = preencherBuracos(abertura(m, w, h, 3), w, h);
  m = componenteProxima(m, w, h, w / 2, h / 2);
  const el = elipseMomentos(m, w, h);
  if (!(el.area > 50)) throw new Error("Não foi possível encontrar a aréola. Ajuste o contorno manualmente.");
  const seg = { areola: { cx: el.cx, cy: el.cy, eixo_maior_px: el.eixo_maior_px, eixo_menor_px: el.eixo_menor_px, angulo_graus: el.angulo_graus }, papila: null };
  const d2 = el.eixo_menor_px, centro = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (Math.hypot(x - el.cx, y - el.cy) < 0.33 * d2) centro[y * w + x] = 1;
  const t2 = percentil(score, 70, centro);
  let cand = new Uint8Array(n); for (let i = 0; i < n; i++) cand[i] = centro[i] && score[i] > t2 ? 1 : 0;
  cand = componenteProxima(abertura(cand, w, h, 2), w, h, el.cx, el.cy);
  let area = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) if (cand[i]) { area++; sx += i % w; sy += (i / w) | 0; }
  if (area > 30) { const eq = 2 * Math.sqrt(area / Math.PI); if (eq > 0.12 * d2 && eq < 0.5 * d2) seg.papila = { cx: sx / area, cy: sy / area, diam_px: eq }; }
  return { seg, mascara: m };
};

export function refinarPapila(score, w, h, pap) {
  let cx = pap.cx, cy = pap.cy, r0 = pap.diam_px / 2;
  const g = desfocar(score, w, h, Math.max(1, 0.04 * r0));
  const NR = 90, NS = 120; let frac = 0;
  for (let it = 0; it < 3; it++) {
    const perf = []; const X = [], Y = [];
    for (let a = 0; a < NR; a++) {
      const ang = (2 * Math.PI * a) / NR, row = new Float64Array(NS), xr = [], yr = [];
      for (let s = 0; s < NS; s++) { const r = r0 * (0.45 + (1.35 * s) / (NS - 1)); const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r; row[s] = bilinear(g, w, h, x, y); xr.push(x); yr.push(y); }
      perf.push(row); X.push(xr); Y.push(yr);
    }
    // média angular (sigma 2 raios) e suavização radial
    const sm = [];
    const ka = kernel(2), ra = (ka.length - 1) >> 1;
    for (let a = 0; a < NR; a++) { const row = new Float64Array(NS); for (let j = -ra; j <= ra; j++) { const q = perf[((a + j) % NR + NR) % NR]; for (let s = 0; s < NS; s++) row[s] += q[s] * ka[j + ra]; } sm.push(desfocar1d(row, 2)); }
    const px = [], py = [], rad = [];
    for (let a = 0; a < NR; a++) {
      let best = Infinity, ib = 0;
      for (let s = 1; s < NS - 1; s++) { const dd = (sm[a][s + 1] - sm[a][s - 1]) / 2; if (dd < best) { best = dd; ib = s; } }
      px.push(X[a][ib]); py.push(Y[a][ib]); rad.push(r0 * (0.45 + (1.35 * ib) / (NS - 1)));
    }
    const med = mediana(Float32Array.from(rad)), mad = mediana(Float32Array.from(rad.map((r) => Math.abs(r - med))));
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
// ------------------------------------------------------------------ paleta
export function paleta(img, seg) {
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

export function analisarLateral(img, opc) {
  opc = opc || {};
  const w = img.width, h = img.height, n = w * h, avisos = [];
  let k = opc.px_por_mm, cantos = opc.cantos || null;
  if (!k) {
    const mk = detectarMarcador(img);
    if (!mk) throw new Error("Foto lateral: marcador não encontrado. Informe a escala (px/mm) ou refaça a foto com o marcador visível.");
    cantos = mk.cantos; k = mk.lado_px / (opc.marcador_mm || 20);
  }
  const { L, A } = paraLab(img), [mL, dL] = mediaDesvio(L), [mA, dA] = mediaDesvio(A);
  let sc = new Float32Array(n); for (let i = 0; i < n; i++) sc[i] = (L[i] - mL) / (dL + 1e-6) + (A[i] - mA) / (dA + 1e-6);
  sc = desfocar(sc, w, h, Math.max(1.5, 0.15 * k));
  const s8 = normalizar8(sc);
  if (cantos) {
    const xs = cantos.map((p) => p[0]), ys = cantos.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), m = 0.5 * (x1 - x0);
    for (let y = Math.max(0, (y0 - m) | 0); y < Math.min(h, y1 + m); y++) for (let x = Math.max(0, (x0 - m) | 0); x < Math.min(w, x1 + m); x++) s8[y * w + x] = 0;
  }
  const t = otsu(s8);
  let corpo = new Uint8Array(n); for (let i = 0; i < n; i++) corpo[i] = s8[i] > t ? 1 : 0;
  corpo = abertura(corpo, w, h, 2);
  const { lab, comps } = rotular(corpo, w, h);
  if (!comps.length) throw new Error("Foto lateral: silhueta não encontrada. Use fundo liso escuro.");
  const maior = comps.reduce((p, c) => (c.area > p.area ? c : p));
  corpo = new Uint8Array(n); for (let i = 0; i < n; i++) corpo[i] = lab[i] === maior.id ? 1 : 0;
  corpo = preencherBuracos(corpo, w, h);
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
  const bs = desfocar1d(borda, Math.max(1, 0.1 * k));
  const N = bs.length, yv = Float64Array.from({ length: N }, (_, i) => i);
  // linha de base quadrática local, excluindo a papila
  const hp = desfocar1d(bs, 8 * k); let pico = 0, mx = -Infinity;
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
  let hs = desfocar1d(hperf, 1.5); for (let i = 1; i < hs.length; i++) hs[i] = Math.min(hs[i], hs[i - 1]);
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
export const PARAMETROS = {
  marcador_mm: 20, raio_mama_mm: 80, esp_centro_mm: 1.2, esp_borda_mm: 0.15, largura_afinamento: 0.35, margem_mm: 2,
  relevo_amp_mm: 0.25, relevo_sigma_mm: 1.5, relevo_inverter: false, papila_diam_mm: null, papila_proj_mm: 6,
  textura_papila: { ativa: true, intensidade: 1, lobulo_mm: 1.3, sulco_mm: 0.1, ostios: 8, ostio_mm: 0.45, ruga_amp_mm: 0.06, ruga_passo_mm: 0.9, sulco_basal_mm: 0.18, irregularidade: 0.04, semente: 7 },
  resolucao_mm: 0.15, parede_molde_mm: 3, folga_pino_mm: 0.2, canal_transbordo_mm: 1, espelhar: false
};

function gauss2d(Z, n, s) { return desfocar(Z, n, n, s); }

export function geometria(img, seg, k, p, lateral, cacheRelevo) {
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
    const w = img.width, h = img.height, Lm = paraLab(img).L;
    const bl = desfocar(Lm, w, h, p.relevo_sigma_mm * k);
    hp = new Float32Array(w * h); for (let i = 0; i < w * h; i++) hp[i] = Lm[i] - bl[i];
    hp = desfocar(hp, w, h, Math.max(0.6, 0.15 * k));
    if (cacheRelevo) { cacheRelevo.hp = hp; cacheRelevo.sigma = p.relevo_sigma_mm; cacheRelevo.img = img; }
  }
  const rel = new Float32Array(N), absIn = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const X = xs[i], Y = xs[j], q = j * n + i;
    const xr = X * ct + Y * st, yr = -X * st + Y * ct;
    rho[q] = Math.sqrt((xr / a) ** 2 + (yr / b) ** 2);
    dentro[q] = rho[q] <= rhoOut ? 1 : 0;
    S[q] = Math.sqrt(R * R - Math.min(X * X + Y * Y, (0.95 * R) ** 2)) - R;
    rel[q] = bilinear(hp, img.width, img.height, cx + X * k, cy - Y * k);
    if (rho[q] <= 1) absIn.push(Math.abs(rel[q]));
  }
  const esc = percentil(Float32Array.from(absIn), 98) + 1e-6, sg = p.relevo_inverter ? -1 : 1;
  const dp = p.papila_diam_mm || pp.diam_px / k;
  const ox = (pp.cx - cx) / k, oy = -(pp.cy - cy) / k;
  const nForma = lateral ? lateral.forma_n : 4;
  const proj = lateral && !p.papila_proj_forcada ? lateral.projecao_mm : p.papila_proj_mm;
  let cup = new Float32Array(N);
  const TX = p.textura_papila && p.textura_papila.ativa ? p.textura_papila : null;
  const lob = TX ? contornoLobulado(TX) : () => 1;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const dx = xs[i] - ox, dy = xs[j] - oy, rp = Math.hypot(dx, dy) / (dp / 2) / lob(Math.atan2(dy, dx)); cup[j * n + i] = rp < 1 ? Math.pow(1 - Math.pow(rp, nForma), 1 / nForma) : 0; }
  cup = gauss2d(cup, n, 0.4 / p.resolucao_mm);
  const texP = TX ? texturaPapila(xs, n, ox, oy, dp / 2, proj, cup, lob, TX) : null;
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
export function texturaPapila(xs, n, ox, oy, Rp, proj, cup, lob, TX) {
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
export function moldes(G, parede, folga, canalProf) {
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
export function exportarConjunto(G, p, zonaFina) {
  const M = moldes(G, p.parede_molde_mm, p.folga_pino_mm, p.canal_transbordo_mm);
  const zf = zonaFina || Math.max(G.a, G.b) * G.rho_out + 5;
  const idx = indicesAdaptativos(G.xs, zf, 0.5), n = G.n;
  const Tp = new Float32Array(n * n); for (let q = 0; q < n * n; q++) Tp[q] = G.S[q] + Math.max(G.T[q], 1e-3);
  const prot = solido(G.xs, idx, n, G.S, Tp, G.dentro, false, false);
  const frente = solido(G.xs, idx, n, M.frente[0], M.frente[1], M.frente[2], true, false);
  const contra = solido(G.xs, idx, n, M.contra[0], M.contra[1], M.contra[2], false, true);
  const zt = M.zTop, zb = M.zBot;
  const tf = (x, y, z) => [x, y, zt - z]; tf.inverte = true;
  const tc = (x, y, z) => [x, y, z - zb];
  return {
    M, malhas: { protese: prot, frente, contra },
    arquivos: { "protese_referencia.stl": stl(prot), "molde_frontal.stl": stl(frente, tf), "contramolde.stl": stl(contra, tc) },
    volume_ml: volume(prot) / 1000
  };
};

// ------------------------------------------------------------------ mama de prova
// Calota esférica com o mesmo raio do verso da prótese (S = √(R² − r²) − R, ápice em z = 0 no centro
// da aréola), sobre um pedestal de base plana, para imprimir e testar o assentamento da prótese.
// Um sulco raso acompanha o contorno da prótese (ρ = ρ_out, já espelhado se for o caso), afastado
// para fora para a borda afinada assentar em superfície lisa, e uma covinha marca o centro da papila. Sólido de revolução: cada raio tem os mesmos pontos, com passo fino
// em torno do contorno para o sulco sair redondo.
export const MAMA_PROVA = { diametro_mm: 120, pedestal_mm: 4, sulco_prof_mm: 0.4, sulco_larg_mm: 1.2, sulco_afastamento_mm: 1.5, covinha_diam_mm: 3, covinha_prof_mm: 0.5, nAngulos: 360 };

export function mamaDeProva(G, p, opc = {}) {
  const o = Object.assign({}, MAMA_PROVA, opc), R = p.raio_mama_mm;
  const { n, xs, rho, rho_out } = G, x0 = xs[0], dx = xs[1] - xs[0];
  const rhoEm = (X, Y) => {                                  // ρ da prótese (bilinear na grade de G)
    const fi = (X - x0) / dx, fj = (Y - x0) / dx;
    if (fi < 0 || fj < 0 || fi > n - 1.001 || fj > n - 1.001) return Infinity;
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, q = j * n + i;
    return (rho[q] * (1 - u) + rho[q + 1] * u) * (1 - v) + (rho[q + n] * (1 - u) + rho[q + n + 1] * u) * v;
  };
  // raio do contorno da prótese em cada direção (bisseção ao longo do raio)
  const nT = o.nAngulos, rLim = 0.98 * Math.abs(x0), rc = new Float64Array(nT);
  for (let t = 0; t < nT; t++) {
    const th = (t / nT) * 2 * Math.PI, c = Math.cos(th), s = Math.sin(th);
    let lo = 0, hi = rLim;
    if (rhoEm(hi * c, hi * s) <= rho_out) { rc[t] = hi; continue; }
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (rhoEm(m * c, m * s) <= rho_out) lo = m; else hi = m; }
    rc[t] = (lo + hi) / 2;
  }
  let rcMax = 0; for (const v of rc) rcMax = Math.max(rcMax, v);
  const Rb = Math.min(Math.max(o.diametro_mm / 2, rcMax + 15), 0.9 * R);
  if (rcMax + o.sulco_afastamento_mm + 3 > Rb) throw new Error(`a prótese (${(2 * rcMax).toFixed(0)} mm) não cabe numa mama de raio ${R} mm`);
  const esfera = (r) => Math.sqrt(R * R - r * r) - R;
  const zBorda = esfera(Rb), zBase = zBorda - o.pedestal_mm;
  const [px, py] = G.papila_offset_mm || [0, 0], rCov = o.covinha_diam_mm / 2, w = o.sulco_larg_mm / 2;
  const cosJ = (d, l) => (d < l ? 0.5 * (1 + Math.cos((Math.PI * d) / l)) : 0);
  const topo = (r, th, rs) => {
    const X = r * Math.cos(th), Y = r * Math.sin(th);
    return esfera(r) - o.sulco_prof_mm * cosJ(Math.abs(r - rs), w) - o.covinha_prof_mm * cosJ(Math.hypot(X - px, Y - py), rCov);
  };
  // pontos por raio: grosso até o sulco, fino no sulco, grosso até a borda (mesma contagem em todos)
  const nA = 60, nS = 24, nB = 40, faixa = 1.5 * w;
  const perfil = (th, t) => {
    const r0 = rc[t] + o.sulco_afastamento_mm, a = Math.max(0.5, r0 - faixa), b = Math.min(Rb - 0.5, r0 + faixa), P = [[0, zBase]];
    P.push([Rb, zBase], [Rb, zBorda]);
    for (let k = nB; k >= 1; k--) { const r = b + ((Rb - b) * k) / nB; if (r < Rb) P.push([r, topo(r, th, r0)]); }
    for (let k = nS; k >= 0; k--) { const r = a + ((b - a) * k) / nS; P.push([r, topo(r, th, r0)]); }
    for (let k = nA - 1; k >= 0; k--) { const r = (a * k) / nA; P.push([r, topo(r, th, r0)]); }
    return P;
  };
  const malha = revolucao(nT, perfil, null, false);
  const pos = malha.pos; for (let q = 2; q < pos.length; q += 3) pos[q] -= zBase;   // base na mesa (z = 0)
  return {
    malha, arquivo: stlTriangulos([malha], CABECALHO_STL), zBase,          // zBase: deslocamento exato aplicado (ápice da esfera em z = −zBase)
    espec: { raio_mama_mm: R, diametro_base_mm: +(2 * Rb).toFixed(1), altura_mm: +(-zBase).toFixed(1), pedestal_mm: o.pedestal_mm,
      sulco_mm: { profundidade: o.sulco_prof_mm, largura: o.sulco_larg_mm, afastamento_da_borda: o.sulco_afastamento_mm }, covinha_papila_mm: { diametro: o.covinha_diam_mm, profundidade: o.covinha_prof_mm },
      contorno_protese_mm: { min: +(2 * Math.min(...rc)).toFixed(1), max: +(2 * rcMax).toFixed(1) }, volume_cm3: +(malha.vol / 1000).toFixed(1), triangulos: malha.ntri }
  };
}

// ------------------------------------------------------------------ corpo de prova
export function corpoDeProva(res) {
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
