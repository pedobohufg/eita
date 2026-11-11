/* EITA! CRÂNIO · órtese — cálculo puro da órtese craniana (sem DOM, sem three.js): preparo e alinhamento do scan,
   análise de assimetria por espelhamento, orelhas, indicação (plagiocefalia/braquicefalia), correções manuais, mapa de
   cores, linha de corte, casca da órtese e STL. Roda no navegador e no Node.
   Origem: EITA! Crânio "UI v8" (legado/cranio-ortese): o window.CROCore inteiro (bloco 0), movido na E3c-2 sem mudar a
   aritmética — só os nomes das funções passaram ao português; os campos dos objetos (análise `an`, parâmetros `P`,
   estatísticas da casca) seguem os do legado, porque estão nas fichas antigas e na referência. Do bloco 1 (interface)
   vieram, também sem mudança de aritmética, o preparo do STL (escala + centro), o alinhamento pelos 5 pontos (antes
   feito com THREE.Matrix4/Vector3/BufferGeometry, aqui com as mesmas contas do three.js r128) e o crescimento pela
   curva OMS do perímetro cefálico. O STL da órtese sai do stl() do núcleo (mesmos bytes do toBinarySTL antigo).
   Convenções (modelo já alinhado): x = direita do paciente, y = anterior, z = superior; mm. Origem de análise
   O = (0, 0, zRef), zRef = altura do plano de referência (glabela–opistocrânio). Azimute θ: 0° = anterior, +90° = direita.
   Elevação φ: 0° = plano de referência, +90° = vértice. Grade (θ, φ) de 180 × 76 (2° × 2°, φ de −60° a 90°).
   Malha do scan: posições soltas (Float32Array, 9 números por triângulo), como as do lerSTL() do núcleo.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import { stl } from "../../nucleo/malha.js";

/* ============================================================ análise e casca (window.CROCore do legado) */
export const GRAU = Math.PI / 180;
export const GRADE = { NT: 180, NP: 76, PMIN: -60, PMAX: 90 };
GRADE.dT = 360 / GRADE.NT;
GRADE.dP = (GRADE.PMAX - GRADE.PMIN) / (GRADE.NP - 1);

export function limitar(v, a, b) { return Math.min(b, Math.max(a, v)); }

export function amostrarGrade(arr, thDeg, phiDeg) {
  let ft = thDeg / GRADE.dT;
  ft = ((ft % GRADE.NT) + GRADE.NT) % GRADE.NT;
  const f0 = Math.floor(ft);
  const t0 = f0 % GRADE.NT, t1 = (f0 + 1) % GRADE.NT, wt = ft - f0;
  let fp = (phiDeg - GRADE.PMIN) / GRADE.dP;
  fp = limitar(fp, 0, GRADE.NP - 1);
  const p0 = Math.min(Math.floor(fp), GRADE.NP - 2), p1 = p0 + 1, wp = fp - p0;
  const a = arr[p0 * GRADE.NT + t0] * (1 - wt) + arr[p0 * GRADE.NT + t1] * wt;
  const b = arr[p1 * GRADE.NT + t0] * (1 - wt) + arr[p1 * GRADE.NT + t1] * wt;
  return a * (1 - wp) + b * wp;
}

export function suavizarGrade(arr, passes) {
  const NT = GRADE.NT, NP = GRADE.NP;
  let a = Float32Array.from(arr);
  const b = new Float32Array(a.length);
  for (let p = 0; p < passes; p++) {
    for (let ip = 0; ip < NP; ip++) {
      for (let it = 0; it < NT; it++) {
        b[ip * NT + it] = (a[ip * NT + (it - 1 + NT) % NT] + 2 * a[ip * NT + it] + a[ip * NT + (it + 1) % NT]) / 4;
      }
    }
    for (let ip = 0; ip < NP; ip++) {
      const dn = Math.max(0, ip - 1), up = Math.min(NP - 1, ip + 1);
      for (let it = 0; it < NT; it++) {
        a[ip * NT + it] = (b[dn * NT + it] + 2 * b[ip * NT + it] + b[up * NT + it]) / 4;
      }
    }
  }
  return a;
}

export function distanciaAngular(th1, ph1, th2, ph2) {
  const a = ph1 * GRAU, b = ph2 * GRAU, d = (th1 - th2) * GRAU;
  const c = Math.sin(a) * Math.sin(b) + Math.cos(a) * Math.cos(b) * Math.cos(d);
  return Math.acos(limitar(c, -1, 1)) / GRAU;
}

export function nomeDaRegiao(th, ph) {
  if (ph >= 68) return 'vértice / superior';
  const side = (th > 0 && th < 180) ? ' D' : ((th > 180 && th < 360) ? ' E' : '');
  const t = th > 180 ? 360 - th : th; // 0..180 (distância à linha média anterior)
  let n;
  if (t < 22.5) n = 'frontal';
  else if (t < 67.5) n = 'fronto-parietal';
  else if (t < 112.5) n = 'parietal / temporal';
  else if (t < 157.5) n = 'parieto-occipital';
  else n = 'occipital';
  return n + (n === 'frontal' || n === 'occipital' ? '' : side);
}

/* ---------------- Análise de assimetria por espelhamento ---------------- */
// opcoes.icLegado (ou legado): índice cefálico e detecção das orelhas como na página antiga; ver indiceCefalico e
// detectarOrelhas
export function analisar(pos, zRef, opcoes) {
  const NT = GRADE.NT, NP = GRADE.NP, N = NT * NP;
  const sum = new Float64Array(N), cnt = new Uint32Array(N);
  for (let k = 0; k + 2 < pos.length; k += 3) {
    const x = pos[k], y = pos[k + 1], z = pos[k + 2] - zRef;
    const r = Math.sqrt(x * x + y * y + z * z);
    if (r < 1e-6) continue;
    const phi = Math.asin(limitar(z / r, -1, 1)) / GRAU;
    if (phi < GRADE.PMIN - GRADE.dP / 2) continue;
    let th = Math.atan2(x, y) / GRAU;
    if (th < 0) th += 360;
    const it = Math.round(th / GRADE.dT) % NT;
    const ip = limitar(Math.round((phi - GRADE.PMIN) / GRADE.dP), 0, NP - 1);
    sum[ip * NT + it] += r;
    cnt[ip * NT + it]++;
  }
  const rho = new Float32Array(N), has = new Uint8Array(N);
  let filled = 0;
  for (let i = 0; i < N; i++) if (cnt[i] > 0) { rho[i] = sum[i] / cnt[i]; has[i] = 1; filled++; }
  if (filled < N * 0.15) {
    return { error: 'A malha cobre pouco da calota craniana ao redor do plano de referência. Verifique a unidade do STL, o alinhamento e a altura do plano axial.' };
  }
  let missing = N - filled;
  const has0 = Uint8Array.from(has);
  for (let pass = 0; pass < 120 && missing > 0; pass++) {
    const upd = [];
    for (let ip = 0; ip < NP; ip++) {
      for (let it = 0; it < NT; it++) {
        const idx = ip * NT + it;
        if (has[idx]) continue;
        let s = 0, n = 0;
        for (let dp = -1; dp <= 1; dp++) {
          const q = ip + dp; if (q < 0 || q >= NP) continue;
          for (let dt = -1; dt <= 1; dt++) {
            const j = q * NT + (it + dt + NT) % NT;
            if (has[j]) { s += rho[j]; n++; }
          }
        }
        if (n > 0) upd.push(idx, s / n);
      }
    }
    for (let u = 0; u < upd.length; u += 2) { rho[upd[u]] = upd[u + 1]; has[upd[u]] = 1; missing--; }
    if (upd.length === 0) break;
  }
  // linha do vértice: um único valor
  let row = 0;
  for (let it = 0; it < NT; it++) row += rho[(NP - 1) * NT + it];
  row /= NT;
  for (let it = 0; it < NT; it++) rho[(NP - 1) * NT + it] = row;

  const rs = suavizarGrade(rho, 2);
  // a suavização em φ reintroduz variação na linha do vértice: reimpõe valor único
  let rowS = 0;
  for (let it = 0; it < NT; it++) rowS += rs[(NP - 1) * NT + it];
  rowS /= NT;
  for (let it = 0; it < NT; it++) rs[(NP - 1) * NT + it] = rowS;
  const devM = new Float32Array(N);
  for (let ip = 0; ip < NP; ip++) {
    for (let it = 0; it < NT; it++) {
      const m = (NT - it) % NT; // espelho sagital: θ -> -θ
      devM[ip * NT + it] = 0.5 * (rs[ip * NT + it] - rs[ip * NT + m]);
    }
  }
  const an = { rho: rs, devMirror: devM, filled: filled / N, edits: [], editSeq: 0 };
  let cc = 0, cn = 0;
  for (let ip = 0; ip < NP; ip++) {
    const phv = GRADE.PMIN + ip * GRADE.dP;
    if (phv < -45 || phv > -15) continue;
    for (let it = 0; it < NT; it++) {
      const thv = it * GRADE.dT;
      if (!((thv >= 30 && thv <= 100) || (thv >= 260 && thv <= 330))) continue;
      cn++; if (has0[ip * NT + it]) cc++;
    }
  }
  an.cheekCoverage = cn ? cc / cn : 0;
  an.ears = detectarOrelhas(rs, !(opcoes && (opcoes.legado || opcoes.icLegado)));
  an.rsNoEar = an.ears.rsNoEar; delete an.ears.rsNoEar;
  const ci = indiceCefalico(rs, an.rsNoEar, !!(opcoes && opcoes.icLegado));
  an.ic = ci.ic; an.width = ci.w; an.length = ci.l;
  an.mirrorMax = maiorDesvio(devM);
  definirIndicacao(an, { mode: 'auto' });
  return an;
}


/* Detecção do pavilhão auricular por lado: abertura morfológica (mín→máx) do raio remove
   saliências estreitas (orelha) e preserva o crânio; o que sobra acima do limiar é a orelha. */
// plausivel (E3c-4): entre os calombos de cada lado, fica o maior que seja plausível como orelha (a página antiga
// pegava o maior e, se não fosse plausível, dava a orelha como não detectada — p. ex. quando o resto da mão que
// segurou o bebê forma um calombo maior perto da orelha)
export function detectarOrelhas(rs, plausivel) {
  const NT = GRADE.NT, NP = GRADE.NP, N = NT * NP;
  const wT = Math.round(20 / GRADE.dT), wP = Math.round(20 / GRADE.dP);
  const tmp = new Float32Array(N), mn = new Float32Array(N), op = new Float32Array(N);
  function filtrar(src, dst, isMin) {
    for (let ip = 0; ip < NP; ip++) for (let it = 0; it < NT; it++) {
      let v = isMin ? 1e9 : -1e9;
      for (let k = -wT; k <= wT; k++) { const x = src[ip * NT + (it + k + NT) % NT]; v = isMin ? Math.min(v, x) : Math.max(v, x); }
      tmp[ip * NT + it] = v;
    }
    for (let ip = 0; ip < NP; ip++) for (let it = 0; it < NT; it++) {
      let v = isMin ? 1e9 : -1e9;
      for (let k = -wP; k <= wP; k++) { const x = tmp[limitar(ip + k, 0, NP - 1) * NT + it]; v = isMin ? Math.min(v, x) : Math.max(v, x); }
      dst[ip * NT + it] = v;
    }
  }
  filtrar(rs, mn, true); filtrar(mn, op, false);
  // superfície sem a orelha: só onde o raio excede a abertura em ≥ 2 mm (preserva o crânio liso)
  const rsE = Float32Array.from(rs);
  for (let i = 0; i < N; i++) if (rs[i] - op[i] > 1.2) rsE[i] = op[i];
  const thr = 3.5, out = { rsNoEar: rsE };
  ['R', 'L'].forEach(function (side) {
    const mask = new Uint8Array(N), bump = new Float32Array(N);
    for (let ip = 0; ip < NP; ip++) {
      const ph = GRADE.PMIN + ip * GRADE.dP;
      if (ph < -45 || ph > 45) continue;
      for (let t0 = 55; t0 <= 150; t0 += GRADE.dT) {
        const it = Math.round((side === 'R' ? t0 : 360 - t0) / GRADE.dT) % NT, i = ip * NT + it;
        const b = rs[i] - op[i];
        if (b >= thr) { mask[i] = 1; bump[i] = b; }
      }
    }
    const seen = new Uint8Array(N), grupos = [];
    for (let i0 = 0; i0 < N; i0++) {
      if (!mask[i0] || seen[i0]) continue;
      const q = [i0]; seen[i0] = 1; const cells = []; let sum = 0;
      while (q.length) {
        const i = q.pop(); cells.push(i); sum += bump[i];
        const ip = (i / NT) | 0, it = i % NT;
        [[ip - 1, it], [ip + 1, it], [ip, (it + 1) % NT], [ip, (it + NT - 1) % NT]].forEach(function (c) {
          if (c[0] < 0 || c[0] >= NP) return;
          const j = c[0] * NT + c[1];
          if (mask[j] && !seen[j]) { seen[j] = 1; q.push(j); }
        });
      }
      grupos.push({ cells: cells, sum: sum });
    }
    const medir = function (g) {
      let tmin = 1e9, tmax = -1e9, pmin = 1e9, pmax = -1e9, topH = -1e9;
      g.cells.forEach(function (i) {
        const ip = (i / NT) | 0, it = i % NT, ph = GRADE.PMIN + ip * GRADE.dP;
        let th = it * GRADE.dT; if (side === 'L') th = 360 - th;
        tmin = Math.min(tmin, th); tmax = Math.max(tmax, th);
        pmin = Math.min(pmin, ph); pmax = Math.max(pmax, ph);
        topH = Math.max(topH, rs[i] * Math.sin(ph * GRAU));
      });
      const az = (tmin + tmax) / 2, w = (tmax - tmin) / 2 + GRADE.dT / 2;
      const plaus = az >= 60 && az <= 140 && w <= 32 && topH >= -20 && topH <= 35;      // orelha plausível: perto do plano de referência
      return { ok: plaus, az: az, w: w, top: topH, phiTop: pmax, phiBot: pmin, cells: g.cells.length, doubtful: !plaus };
    };
    let best = null;
    for (const g of grupos) if (!best || g.sum > best.sum) best = g;
    if (!best || best.cells.length < 40) { out[side] = { ok: false }; return; }
    let r = medir(best);
    if (!r.ok && plausivel) {
      let alt = null;
      for (const g of grupos) { if (g.cells.length < 40 || g === best) continue; const m = medir(g); if (m.ok && (!alt || g.sum > alt.sum)) alt = { sum: g.sum, m: m }; }
      if (alt) r = alt.m;
    }
    out[side] = r;
  });
  return out;
}

export function maiorDesvio(dev) {
  const ipMin = Math.round((-5 - GRADE.PMIN) / GRADE.dP), ipMax = Math.round((78 - GRADE.PMIN) / GRADE.dP);
  let m = 0;
  for (let ip = ipMin; ip <= ipMax; ip++) for (let it = 0; it < GRADE.NT; it++) m = Math.max(m, Math.abs(dev[ip * GRADE.NT + it]));
  return m;
}

// índice cefálico no plano de referência (diâmetros que passam pela origem na linha média)
// Desde a E3c-4: largura TRANSVERSAL (maior extensão perpendicular ao plano sagital, x) sobre o comprimento
// (maior extensão ântero-posterior, y), no plano de referência. A página antiga usava a maior corda entre 65° e 115°
// de azimute, que numa cabeça em paralelogramo (plagiocefalia) pega a diagonal longa e infla o IC; continua
// disponível com legado = true (comparações com a página antiga).
export function indiceCefalico(rs, rsW, legado) {
  const rw = rsW || rs;   // largura medida sem o pavilhão auricular
  if (!legado) {
    let x0 = 0, x1 = 0, y0 = 0, y1 = 0;
    for (let t = 0; t < 360; t += 0.5) {
      const rx = amostrarGrade(rw, t, 0) * Math.sin(t * GRAU), ry = amostrarGrade(rs, t, 0) * Math.cos(t * GRAU);
      if (rx > x1) x1 = rx; if (rx < x0) x0 = rx; if (ry > y1) y1 = ry; if (ry < y0) y0 = ry;
    }
    const L = y1 - y0, W = x1 - x0;
    return { l: L, w: W, ic: L > 0 ? W / L : 0 };
  }
  let L = 0, W = 0;
  for (let t = -15; t <= 15; t += 2) L = Math.max(L, amostrarGrade(rs, t, 0) + amostrarGrade(rs, t + 180, 0));
  for (let t = 65; t <= 115; t += 2) W = Math.max(W, amostrarGrade(rw, t, 0) + amostrarGrade(rw, t + 180, 0));
  return { l: L, w: W, ic: L > 0 ? W / L : 0 };
}

export function detectarPontos(dev, rs) {
  const NT = GRADE.NT, NP = GRADE.NP;
  const ipMin = Math.round((-5 - GRADE.PMIN) / GRADE.dP), ipMax = Math.round((78 - GRADE.PMIN) / GRADE.dP);
  const win = 4;
  function acharPontos(sign) {
    const cand = [];
    for (let ip = ipMin; ip <= ipMax; ip++) {
      for (let it = 0; it < NT; it++) {
        const v = sign * dev[ip * NT + it];
        if (v < 1.0) continue;
        let isMax = true;
        for (let dp = -win; dp <= win && isMax; dp++) {
          const q = ip + dp; if (q < 0 || q >= NP) continue;
          for (let dt = -win; dt <= win; dt++) {
            if (sign * dev[q * NT + (it + dt + NT) % NT] > v) { isMax = false; break; }
          }
        }
        if (isMax) cand.push({ th: it * GRADE.dT, ph: GRADE.PMIN + ip * GRADE.dP, v: v });
      }
    }
    cand.sort((a, b) => b.v - a.v);
    const sel = [];
    for (const c of cand) {
      if (sel.every(s => distanciaAngular(s.th, s.ph, c.th, c.ph) >= 25)) sel.push(c);
      if (sel.length >= 3) break;
    }
    return sel;
  }
  const peaks = [];
  acharPontos(+1).forEach((c, i) => peaks.push({ type: 'P', label: 'P' + (i + 1), th: c.th, ph: c.ph, mag: c.v, rho: amostrarGrade(rs, c.th, c.ph), region: nomeDaRegiao(c.th, c.ph) }));
  acharPontos(-1).forEach((c, i) => peaks.push({ type: 'A', label: 'A' + (i + 1), th: c.th, ph: c.ph, mag: -c.v, rho: amostrarGrade(rs, c.th, c.ph), region: nomeDaRegiao(c.th, c.ph) }));
  return peaks;
}

// Redução média esperada do IC com órtese (fração), por idade de início. Fonte: Outcome Analysis of the
// Effects of Helmet Therapy in Infants with Brachycephaly (J Clin Med 2020; 9(4):1171; n=207; IC 95,55→88,87%;
// duração média 5,0 meses). Por faixa: <4 m 6,5 pp; 4–5 m 7,3; 6–7 m 7,0; 8–9 m 5,7; ≥10 m 4,5 (valores da Tabela 3).
export function ganhoEsperadoIC(ageMonths) {
  if (!(ageMonths > 0)) return 0.067;
  if (ageMonths < 4) return 0.065;
  if (ageMonths < 6) return 0.073;
  if (ageMonths < 8) return 0.070;
  if (ageMonths < 10) return 0.057;
  return 0.045;
}
export function icAlvoPadrao(ic, ageMonths) {
  return Math.round(Math.min(ic, Math.max(0.81, ic - ganhoEsperadoIC(ageMonths))) * 100) / 100;
}

/* Indicação: 'auto' | 'plagio' | 'brachy' | 'both'. Braquicefalia: reduz a largura (contato
   lateral) e libera o eixo AP (alívio frontal/occipital) por escala kx·ky = 1 até o IC alvo. */
export function definirIndicacao(an, o) {
  const NT = GRADE.NT, NP = GRADE.NP, N = NT * NP;
  const mode = (o && o.mode) || 'auto';
  let usePl, useBr;
  if (mode === 'auto') {
    useBr = an.ic >= 0.90;
    usePl = an.mirrorMax >= 3;
    if (!useBr && !usePl) usePl = true;
  } else { usePl = mode === 'plagio' || mode === 'both'; useBr = mode === 'brachy' || mode === 'both'; }
  let icT = o && o.icTarget > 0 ? o.icTarget : icAlvoPadrao(an.ic, o && o.age);
  an.age = o && o.age > 0 ? o.age : null;
  let kx = 1, ky = 1;
  if (useBr && icT < an.ic) { kx = Math.sqrt(icT / an.ic); ky = 1 / kx; }
  const base = new Float32Array(N);
  for (let ip = 0; ip < NP; ip++) {
    const ph = (GRADE.PMIN + ip * GRADE.dP) * GRAU, c2 = Math.cos(ph) * Math.cos(ph);
    for (let it = 0; it < NT; it++) {
      const idx = ip * NT + it, th = it * GRADE.dT * GRAU;
      let v = 0;
      if (usePl) v += an.devMirror[idx];
      if (useBr) v += -an.rho[idx] * c2 * ((kx - 1) * Math.sin(th) * Math.sin(th) + (ky - 1) * Math.cos(th) * Math.cos(th));
      base[idx] = v;
    }
  }
  an.devBase = base; an.mode = mode; an.usePl = usePl; an.useBr = useBr; an.icTarget = icT; an.kx = kx; an.ky = ky;
  recalcular(an);
}

export function recalcular(an) {
  const NT = GRADE.NT, NP = GRADE.NP;
  const dev = Float32Array.from(an.devBase);
  an.edits.forEach(function (e) {
    for (let ip = 0; ip < NP; ip++) {
      const ph = GRADE.PMIN + ip * GRADE.dP;
      if (Math.abs(ph - e.ph) > e.alpha) continue;
      for (let it = 0; it < NT; it++) {
        const d = distanciaAngular(it * GRADE.dT, ph, e.th, e.ph);
        if (d >= e.alpha) continue;
        const w = 0.5 * (1 + Math.cos(Math.PI * d / e.alpha));
        const i = ip * NT + it;
        if (e.kind === 'contact') dev[i] += e.mm * w;
        else if (e.kind === 'relief') dev[i] -= e.mm * w;
        else dev[i] *= (1 - w);
      }
    }
  });
  for (let ip = 0; ip < NP; ip++) {
    const ph = GRADE.PMIN + ip * GRADE.dP, f = limitar((ph + 16) / 8, 0, 1);
    if (f >= 1) continue;
    for (let it = 0; it < NT; it++) dev[ip * NT + it] *= f;
  }
  an.dev = dev;
  an.maxAbs = maiorDesvio(dev);
  an.peaks = detectarPontos(dev, an.rho);
}

// kind: 'contact' (+mm) | 'relief' (−mm) | 'zero' (anula o desvio na região)
export function acrescentarCorrecao(an, e) {
  const rho = amostrarGrade(an.rho, e.th, e.ph);
  const alpha = limitar((e.radiusMm / rho) / GRAU, 3, 80);
  const ed = { id: ++an.editSeq, label: 'E' + an.editSeq, kind: e.kind, th: ((e.th % 360) + 360) % 360, ph: e.ph, radiusMm: e.radiusMm, mm: e.mm, alpha: alpha, rho: rho, region: nomeDaRegiao(((e.th % 360) + 360) % 360, e.ph) };
  an.edits.push(ed);
  recalcular(an);
  return ed;
}
export function removerCorrecao(an, id) { an.edits = an.edits.filter(e => e.id !== id); recalcular(an); }
export function limparCorrecoes(an) { an.edits = []; recalcular(an); }

/* ----------------------------- Cores (mapa) ----------------------------- */
export function corDoDesvio(d, range, fade) {
  const dead = 0.3;
  let t = Math.sign(d) * Math.max(0, Math.abs(d) - dead) / Math.max(0.5, range - dead);
  t = limitar(t, -1, 1) * (fade == null ? 1 : fade);
  const n = [0.86, 0.88, 0.88], r = [0.86, 0.16, 0.12], b = [0.14, 0.38, 0.88];
  const tg = t >= 0 ? r : b, a = Math.abs(t);
  return [n[0] + (tg[0] - n[0]) * a, n[1] + (tg[1] - n[1]) * a, n[2] + (tg[2] - n[2]) * a];
}

export function coresDosVertices(pos, an, zRef, range) {
  const out = new Float32Array(pos.length);
  for (let k = 0; k + 2 < pos.length; k += 3) {
    const x = pos[k], y = pos[k + 1], z = pos[k + 2] - zRef;
    const r = Math.sqrt(x * x + y * y + z * z) || 1;
    const phi = Math.asin(limitar(z / r, -1, 1)) / GRAU;
    let th = Math.atan2(x, y) / GRAU; if (th < 0) th += 360;
    const d = amostrarGrade(an.dev, th, phi);
    const fade = limitar((phi + 12) / 8, 0, 1);
    const c = corDoDesvio(d, range, fade);
    out[k] = c[0]; out[k + 1] = c[1]; out[k + 2] = c[2];
  }
  return out;
}

// Vista superior (equidistante azimutal): centro = vértice, borda = φ_borda.
export function mapaSuperior(an, range, S, phiEdge, margin) {
  const img = new Uint8ClampedArray(S * S * 4);
  const c = S / 2, R = S / 2 - (margin == null ? 2 : margin);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const o = (py * S + px) * 4;
      const dx = (px + 0.5 - c) / R, dy = (c - py - 0.5) / R;
      const rn = Math.hypot(dx, dy);
      if (rn > 1) { img[o] = img[o + 1] = img[o + 2] = 255; img[o + 3] = 255; continue; }
      let th = Math.atan2(dx, dy) / GRAU; if (th < 0) th += 360;
      const ph = 90 - rn * (90 - phiEdge);
      const col = corDoDesvio(amostrarGrade(an.dev, th, ph), range, 1);
      img[o] = col[0] * 255; img[o + 1] = col[1] * 255; img[o + 2] = col[2] * 255; img[o + 3] = 255;
    }
  }
  return img;
}

/* ------------------------------ Geometria ------------------------------- */
export function degrauSuave(t) { t = limitar(t, 0, 1); return t * t * (3 - 2 * t); }
export function diferencaAzimute(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

/* Orelhas (por lado) e pernas de apoio na bochecha. Ângulos no espaço da orelha direita
   (o lado esquerdo é espelhado: θ → 360−θ). modo 'auto' usa a detecção na malha. */
export function resolverOrelhas(an, P) {
  const clr = P.earClear == null ? 8 : P.earClear;
  const pick = function (a, b, c) { return a != null ? a : (b != null ? b : c); };
  const man = function (s, src) { return { az: pick(P['earAz' + s], null, 100), w: pick(P['earW' + s], P.earW, 24), top: pick(P['earTop' + s], P.earTop, 14), src: src || 'manual' }; };
  const out = { mode: P.earMode === 'manual' ? 'manual' : 'auto' };
  ['R', 'L'].forEach(function (s) {
    if (P.earMode === 'manual' || P['earMan' + s]) { out[s] = man(s); return; }          // lado marcado pelo usuário prevalece
    const e = an.ears && an.ears[s];
    if (e && e.ok) {
      const rr = amostrarGrade(an.rho, e.az, 0);
      out[s] = { az: e.az, w: e.w + (clr / rr) / GRAU, top: e.top + clr, src: 'detectada' };
    }
  });
  if (!out.R && out.L) out.R = Object.assign({}, out.L, { src: 'espelhada da esquerda' });
  if (!out.L && out.R) out.L = Object.assign({}, out.R, { src: 'espelhada da direita' });
  if (!out.R) out.R = man('R', 'padrão (orelha não detectada)');
  if (!out.L) out.L = man('L', 'padrão (orelha não detectada)');
  ['R', 'L'].forEach(function (s) {
    const e = out[s];
    const rr = amostrarGrade(an.rho, e.az, -8);
    const wl = ((P.cheekWidth || 24) / 2 / rr) / GRAU, gap = ((P.cheekGap == null ? 6 : P.cheekGap) / rr) / GRAU;
    out['leg' + s] = P.cheek === 'off' ? null : { az: e.az - e.w - gap - wl, w: wl, rr: rr, wmm: (P.cheekWidth || 24) / 2, rc: P.legCorner == null ? 9 : P.legCorner, depth: P.cheekDepth == null ? 32 : P.cheekDepth };
    const wm = ((P.mastWidth || 24) / 2 / rr) / GRAU, gm = ((P.mastGap == null ? 4 : P.mastGap) / rr) / GRAU;
    out['mast' + s] = P.mast === 'on' ? { az: e.az + e.w + gm + wm, w: wm, rr: rr, wmm: (P.mastWidth || 24) / 2, rc: P.legCorner == null ? 9 : P.legCorner, depth: P.mastDepth == null ? 24 : P.mastDepth } : null;
  });
  return out;
}

// altura (mm, relativa ao plano de referência) da borda inferior em cada azimute
export function funcaoDaBorda(P, ears, noLegs) {
  // frontArc (E3c-4): a borda fica na altura da frente (hf) até ±frontArc graus e só então desce para a de trás,
  // para não passar sobre os olhos; sem ele, a transição em cosseno da página antiga
  const fa = P.frontArc > 0 ? Math.min(P.frontArc, 170) : 0;
  return function (th) {
    let h;
    if (fa) { const d = diferencaAzimute(th, 0), t = d <= fa ? 1 : (1 + Math.cos(Math.PI * (d - fa) / (180 - fa))) / 2; h = P.hb + (P.hf - P.hb) * t; }
    else h = P.hb + (P.hf - P.hb) * (1 + Math.cos(th * GRAU)) / 2;
    if (P.occDrop > 0) {                                                                       // descida extra da borda no occipício
      const dd = diferencaAzimute(th, 180), ow = P.occWidth || 50;
      if (dd < ow) h -= P.occDrop * degrauSuave((ow - dd) / ((P.occSoft == null ? 0.6 : P.occSoft) * ow));
    }
    ['R', 'L'].forEach(function (s) {
      const ts = s === 'R' ? th : 360 - th;
      const e = ears[s], rd = P.legRound == null ? 0.3 : limitar(P.legRound, 0.1, 1);
      const d = diferencaAzimute(ts, e.az);
      if (d < e.w) { const t = degrauSuave((e.w - d) / (0.45 * e.w)); h = Math.max(h, h + (e.top - h) * t); }   // janela da orelha (arco)
      (noLegs ? [] : [ears['leg' + s], ears['mast' + s]]).forEach(function (lg) {
        if (!lg) return;
        const d2 = diferencaAzimute(ts, lg.az);
        if (d2 < lg.w) { const t = degrauSuave((lg.w - d2) / (rd * lg.w)); h = Math.min(h, h + (-lg.depth - h) * t); }
      });
    });
    return h;
  };
}

// elevação φ em que o raio da malha atinge a altura h (h = r·sen φ), por iteração de ponto fixo
export function elevacaoNaAltura(an, th, h) {
  let ph = Math.atan2(h, amostrarGrade(an.rho, th, 0)) / GRAU;
  for (let k = 0; k < 4; k++) {
    const r = amostrarGrade(an.rho, th, ph);
    ph = Math.asin(limitar(h / r, -0.99, 0.99)) / GRAU;
  }
  return ph;
}

// Linha de corte da borda (azimute → elevação) e orelhas/pernas resolvidas, para pré-visualização
export function linhaDeCorte(an, P, Nc) {
  const ears = resolverOrelhas(an, P), tf = campoDeCorte(an, P, ears), line = [];
  for (let j = 0; j < Nc; j++) { const th = j * 360 / Nc; line.push({ th: th, ph: Math.max(GRADE.PMIN + 2, tf.lowest(th)) }); }
  return { line: line, ears: ears };
}

// Reserva de crescimento radial: meses até o reajuste × taxa (mm/mês). Nas áreas de alívio
// vale 100%; nas de contato só a fração indicada (o capacete segue segurando a região);
// no vértice soma-se uma reserva extra (o crânio cresce também para cima).
export function reservaDeCrescimento(d, ph, P) {
  const g = (P.growMonths || 0) * (P.growRate || 0), fc = (P.growContactPct == null ? 30 : P.growContactPct) / 100;
  let w;
  if (d >= 2) w = fc; else if (d <= -1) w = 1; else w = 1 + (fc - 1) * (d + 1) / 3;
  let v = g * w;
  if (P.growVertex > 0) { const t = limitar((ph - 40) / 50, 0, 1); v += P.growVertex * t * t * (3 - 2 * t); }
  return v;
}

export function raioInterno(an, th, ph, P) {
  const r = amostrarGrade(an.rho, th, ph);
  const d = amostrarGrade(an.dev, th, ph);
  let add = 0;
  if (d < 0) add = Math.min(P.reliefMax, P.relief * (-d));              // alívio (vazio) na área achatada
  else if (P.mode === 'active') add = -Math.min(P.compMax, P.relief * d); // compressão opcional na área proeminente
  let gap = P.c0 + add + reservaDeCrescimento(d, ph, P);
  if (P.cheekClear != null) { const low = limitar((-ph - 6) / 10, 0, 1); gap = gap * (1 - low) + P.cheekClear * low; }
  return r + gap;
}

/* Campo de corte (mm, >0 = material). Une a borda-base (com janela da orelha) às abas
   (retângulos de cantos arredondados definidos em mm). Serve à malha e à pré-visualização. */
export function campoDeCorte(an, P, ears) {
  const brim = funcaoDaBorda(P, ears, true), tabs = [];
  ['R', 'L'].forEach(function (s) {
    ['leg', 'mast'].forEach(function (k) { const lg = ears[k + s]; if (lg) tabs.push({ lg: lg, left: s === 'L' }); });
  });
  function f(th, ph) {
    const r = amostrarGrade(an.rho, th, ph), h = r * Math.sin(ph * GRAU);
    let v = limitar(h - brim(th), -4, 4);
    for (let q = 0; q < tabs.length; q++) {
      const lg = tabs[q].lg, ts = tabs[q].left ? 360 - th : th;
      const s = diferencaAzimute(ts, lg.az) * GRAU * lg.rr, hw = lg.wmm, rc = Math.min(lg.rc, hw - 0.5);
      const dx = s - (hw - rc), dy = (-lg.depth + rc) - h;
      const sd = (dx > 0 && dy > 0) ? Math.hypot(dx, dy) - rc : Math.max(dx, dy) - rc;
      v = Math.max(v, limitar(-sd, -4, 4));
    }
    return v;
  }
  function lowest(th) {
    let prev = GRADE.PMIN + 1;
    if (f(th, prev) > 0) return prev;
    for (let ph = GRADE.PMIN + 2; ph <= 60; ph += 1) {
      if (f(th, ph) > 0) {
        let lo = ph - 1, hi = ph;
        for (let k = 0; k < 10; k++) { const m = (lo + hi) / 2; if (f(th, m) > 0) hi = m; else lo = m; }
        return hi;
      }
    }
    return 60;
  }
  return { f: f, lowest: lowest };
}

export function gerarOrtese(an, zRef, P, pos) {
  const lv = P.res === 'fine' ? 2 : (P.res === 'high' ? 1 : 0);
  const Nc = [360, 540, 720][lv], dPhT = [1, 0.67, 0.5][lv];
  const dTh = 360 / Nc;
  // faixa de topo aberto: borda superior na elevação bandTop (frente) e, se dado e diferente, bandTopBack (atrás),
  // variando com o azimute como a borda inferior (E3c-4, estilo do laboratório)
  const topoVar = P.type === 'band' && P.bandTopBack != null && P.bandTopBack !== P.bandTop;
  const phiTop = P.type === 'band' ? (topoVar ? Math.max(P.bandTop, P.bandTopBack) : P.bandTop) : 90;
  const topoEm = topoVar ? (th) => P.bandTopBack + (P.bandTop - P.bandTopBack) * (1 + Math.cos(th * GRAU)) / 2 : () => phiTop;
  const closed = phiTop >= 89.9;
  const wrap = th => ((th % 360) + 360) % 360;

  const ears = resolverOrelhas(an, P), tf = campoDeCorte(an, P, ears);
  const phT = new Float32Array(Nc);
  let Rm = 0, phMin = 90;
  for (let j = 0; j < Nc; j++) {
    const th = j * dTh;
    Rm += amostrarGrade(an.rho, th, 0) / Nc;
    phT[j] = tf.lowest(th);
    phMin = Math.min(phMin, phT[j]);
  }
  let maxJump = 0;
  for (let j = 0; j < Nc; j++) maxJump = Math.max(maxJump, Math.abs(phT[(j + 1) % Nc] - phT[j]));
  const phLo = Math.max(GRADE.PMIN + 1, phMin - 1.5);
  const Nr = Math.max(8, Math.ceil((phiTop - phLo) / dPhT));
  const dPh = (phiTop - phLo) / Nr;

  // ---- furos: rede hexagonal em (θ,φ); cada furo só existe se couber com a margem ----
  const useHoles = P.holeD >= 1 && P.pitch > P.holeD + 1.5;
  const hr = P.holeD / 2, rowSp = P.pitch * 0.8660254 / Rm;
  const slitOn = P.split !== 'none';
  // fenda lateral única (peça inteira, E3c-4): plano vertical pelo eixo z no azimute da fenda, só daquele lado
  const lateral = P.split === 'lateralL' || P.split === 'lateralR', azF = (P.split === 'lateralR' ? 90 : 270) * GRAU;
  function campoDaFenda(x, y) {
    if (lateral) return x * Math.sin(azF) + y * Math.cos(azF) <= 0 ? 1e3 : Math.abs(x * Math.cos(azF) - y * Math.sin(azF)) - P.gap / 2;
    return Math.abs((P.split === 'coronal' ? y : x) - P.splitPos) - P.gap / 2;
  }
  // furos só na frente e atrás (E3c-4): dentro de ±holeArc graus de azimute em torno de 0° e de 180°
  const furosNaZona = P.holeZone === 'ap' ? (th) => diferencaAzimute(th, 0) <= (P.holeArc || 50) || diferencaAzimute(th, 180) <= (P.holeArc || 50) : () => true;
  function manterAprox(th, ph) {
    let v = tf.f(wrap(th), ph);
    if (!closed) v = Math.min(v, (topoEm(wrap(th)) - ph) * GRAU * Rm);
    if (slitOn) {
      const r = amostrarGrade(an.rho, wrap(th), ph) + P.c0 + P.t + 3, cp = Math.cos(ph * GRAU);
      v = Math.min(v, campoDaFenda(r * cp * Math.sin(th * GRAU), r * cp * Math.cos(th * GRAU)));
    }
    return v;
  }
  const act = new Map();
  function furoAtivo(k, m, n, thc, phc) {
    const key = k * 100003 + m;
    let a = act.get(key);
    if (a !== undefined) return a;
    a = phc < 76 * GRAU && furosNaZona(wrap(thc / GRAU)) && manterAprox(thc / GRAU, phc / GRAU) > 0;
    if (a) {
      const R = hr + P.margin, cp = Math.max(0.2, Math.cos(phc));
      if (slitOn) { const r0 = amostrarGrade(an.rho, wrap(thc / GRAU), phc / GRAU) + P.c0 + P.t + 3; if (campoDaFenda(r0 * Math.cos(phc) * Math.sin(thc), r0 * Math.cos(phc) * Math.cos(thc)) < R) a = false; }
      for (let q = 0; q < 12 && a; q++) {
        const al = q * Math.PI / 6;
        if (manterAprox(thc / GRAU + (R * Math.cos(al) / (Rm * cp)) / GRAU, phc / GRAU + (R * Math.sin(al) / Rm) / GRAU) <= 0) a = false;
      }
    }
    act.set(key, a);
    return a;
  }
  function campoDosFuros(thDeg, phDeg) {
    const ph = phDeg * GRAU, th = thDeg * GRAU, k0 = Math.round(ph / rowSp);
    let best = 3;
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const phk = k * rowSp, ck = Math.cos(phk);
      if (ck < 0.2) continue;
      const n = Math.max(1, Math.round(2 * Math.PI * Rm * ck / P.pitch)), dth = 2 * Math.PI / n, off = (k & 1) ? dth / 2 : 0;
      const m = Math.round((th - off) / dth), dthe = th - (off + m * dth);
      const d = Math.hypot(Rm * Math.cos((ph + phk) / 2) * dthe, Rm * (ph - phk)) - hr;
      if (d < best && furoAtivo(k, ((m % n) + n) % n, n, off + m * dth, phk)) best = d;
    }
    return best;
  }

  // ---- vértices da grade (θ uniforme, φ uniforme) ----
  const NG = closed ? Nr * Nc + 1 : (Nr + 1) * Nc;
  const PIN = [], POUT = [], Fv = new Float32Array(NG);
  function acrescentarPosicao(th, ph) {
    const rin = raioInterno(an, th, ph, P), rout = rin + P.t;
    const cp = Math.cos(ph * GRAU), dx = cp * Math.sin(th * GRAU), dy = cp * Math.cos(th * GRAU), dz = Math.sin(ph * GRAU);
    PIN.push(rin * dx, rin * dy, zRef + rin * dz);
    POUT.push(rout * dx, rout * dy, zRef + rout * dz);
  }
  const gid = (i, j) => (closed && i === Nr) ? Nr * Nc : i * Nc + (j % Nc);
  for (let i = 0; i <= Nr; i++) {
    if (closed && i === Nr) break;
    const ph = phLo + dPh * i;
    for (let j = 0; j < Nc; j++) {
      const th = j * dTh, v = i * Nc + j;
      acrescentarPosicao(th, ph);
      let f = tf.f(th, ph);
      if (topoVar) f = Math.min(f, (topoEm(th) - ph) * GRAU * Rm);
      if (slitOn) f = Math.min(f, campoDaFenda(POUT[v * 3], POUT[v * 3 + 1]));
      if (useHoles && f > 0) f = Math.min(f, campoDosFuros(th, ph));
      Fv[v] = Math.abs(f) < 1e-6 ? 1e-6 : f;
    }
  }
  if (closed) {
    acrescentarPosicao(0, 90);
    Fv[Nr * Nc] = 1;
  }

  // ---- recorte por campo escalar (triângulos de marcha) ----
  const cross = new Map(), TRI = [];
  function cruzamento(u, v) {
    const lo = u.id < v.id ? u : v, hi = u.id < v.id ? v : u, key = lo.id * 4194304 + hi.id;
    let c = cross.get(key);
    if (c) return c;
    const t = limitar(lo.f / (lo.f - hi.f), 0.03, 0.97);
    const jf = lo.jf + t * (hi.jf - lo.jf), ph = lo.ph + t * (hi.ph - lo.ph);
    c = { id: PIN.length / 3, jf: jf, ph: ph, f: 0 };
    acrescentarPosicao(wrap(jf * dTh), ph);
    cross.set(key, c);
    return c;
  }
  function recortar(A, B, C) {
    if (A.id === B.id || B.id === C.id || A.id === C.id) return;
    if (A.f <= 0 && B.f <= 0 && C.f <= 0) return;
    const V = [A, B, C], out = [];
    for (let q = 0; q < 3; q++) {
      const u = V[q], w = V[(q + 1) % 3];
      if (u.f > 0) out.push(u);
      if ((u.f > 0) !== (w.f > 0)) out.push(cruzamento(u, w));
    }
    for (let q = 1; q + 1 < out.length; q++) TRI.push(out[0].id, out[q].id, out[q + 1].id);
  }
  for (let i = 0; i < Nr; i++) {
    const p0 = phLo + dPh * i, p1 = p0 + dPh;
    for (let j = 0; j < Nc; j++) {
      const a = gid(i, j), b = gid(i, j + 1), c = gid(i + 1, j + 1), d = gid(i + 1, j);
      if (Fv[a] <= 0 && Fv[b] <= 0 && Fv[c] <= 0 && Fv[d] <= 0) continue;
      const A = { id: a, jf: j, ph: p0, f: Fv[a] }, B = { id: b, jf: j + 1, ph: p0, f: Fv[b] },
        C = { id: c, jf: j + 1, ph: p1, f: Fv[c] }, D = { id: d, jf: j, ph: p1, f: Fv[d] };
      if ((i + j) & 1) { recortar(A, B, D); recortar(B, C, D); } else { recortar(A, B, C); recortar(A, C, D); }
    }
  }

  // ---- malha triangular ----
  const tris = []; let dropped = 0;
  function acrescentarTriangulo(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) {
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-14) { dropped++; return; }
    if (nx * dx + ny * dy + nz * dz >= 0) tris.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    else tris.push(ax, ay, az, cx, cy, cz, bx, by, bz);
  }
  function triangulo3(A, a, B, b, C, c, dx, dy, dz) {
    acrescentarTriangulo(A[a * 3], A[a * 3 + 1], A[a * 3 + 2], B[b * 3], B[b * 3 + 1], B[b * 3 + 2], C[c * 3], C[c * 3 + 1], C[c * 3 + 2], dx, dy, dz);
  }
  const E = new Map();
  for (let k = 0; k < TRI.length; k += 3) {
    const a = TRI[k], b = TRI[k + 1], c = TRI[k + 2];
    const rx = (POUT[a * 3] + POUT[b * 3] + POUT[c * 3]) / 3, ry = (POUT[a * 3 + 1] + POUT[b * 3 + 1] + POUT[c * 3 + 1]) / 3, rz = (POUT[a * 3 + 2] + POUT[b * 3 + 2] + POUT[c * 3 + 2]) / 3 - zRef;
    triangulo3(POUT, a, POUT, b, POUT, c, rx, ry, rz);
    triangulo3(PIN, a, PIN, b, PIN, c, -rx, -ry, -rz);
    E.set(a * 4194304 + b, c); E.set(b * 4194304 + c, a); E.set(c * 4194304 + a, b);
  }
  const bdeg = new Map();
  E.forEach(function (w, key) {
    const u = Math.floor(key / 4194304), v = key - u * 4194304;
    if (E.has(v * 4194304 + u)) return;                       // aresta interna
    bdeg.set(u, (bdeg.get(u) || 0) + 1); bdeg.set(v, (bdeg.get(v) || 0) + 1);
    const mx = (POUT[u * 3] + POUT[v * 3]) / 2 - POUT[w * 3], my = (POUT[u * 3 + 1] + POUT[v * 3 + 1]) / 2 - POUT[w * 3 + 1], mz = (POUT[u * 3 + 2] + POUT[v * 3 + 2]) / 2 - POUT[w * 3 + 2];
    triangulo3(POUT, u, POUT, v, PIN, v, mx, my, mz);
    triangulo3(POUT, u, PIN, v, PIN, u, mx, my, mz);
  });
  const T = Float32Array.from(tris);
  let pinch = 0; bdeg.forEach(function (d) { if (d !== 2) pinch++; });
  const holesRemoved = Array.from(act.values()).filter(Boolean).length, cellsN = Nr * Nc;

  // ---- estatísticas / controle de qualidade ----
  let vol = 0;
  for (let k = 0; k < T.length; k += 9) {
    vol += T[k] * (T[k + 4] * T[k + 8] - T[k + 5] * T[k + 7])
         - T[k + 1] * (T[k + 3] * T[k + 8] - T[k + 5] * T[k + 6])
         + T[k + 2] * (T[k + 3] * T[k + 7] - T[k + 4] * T[k + 6]);
  }
  vol /= 6; // mm³
  let maxInterf = { mm: -1e9, th: 0, ph: 0 }, maxVoid = 0, nIn = 0;
  const gs = [0, 0, 0], gn = [0, 0, 0];
  if (pos) {
    for (let k = 0; k + 2 < pos.length; k += 3) {
      const x = pos[k], y = pos[k + 1], z = pos[k + 2] - zRef;
      const r = Math.sqrt(x * x + y * y + z * z) || 1;
      const ph = Math.asin(limitar(z / r, -1, 1)) / GRAU;
      let th = Math.atan2(x, y) / GRAU; if (th < 0) th += 360;
      const ftj = th / dTh, j0 = Math.floor(ftj) % Nc, j1 = (j0 + 1) % Nc, w = ftj - Math.floor(ftj);
      const trim = phT[j0] * (1 - w) + phT[j1] * w;
      if (ph < trim + 2 || ph > topoEm(th) - 2) continue;
      const rin = raioInterno(an, th, ph, P);
      nIn++;
      const interf = r - rin;
      const dz = amostrarGrade(an.dev, th, ph), zi = dz >= 1 ? 0 : (dz <= -1 ? 2 : 1);
      gs[zi] -= interf; gn[zi]++;
      if (interf > maxInterf.mm) maxInterf = { mm: interf, th: th, ph: ph };
      if (-interf > maxVoid) maxVoid = -interf;
    }
  }
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let k = 0; k < T.length; k += 3) for (let q = 0; q < 3; q++) { mn[q] = Math.min(mn[q], T[k + q]); mx[q] = Math.max(mx[q], T[k + q]); }
  return {
    tris: T,
    stats: {
      triangles: T.length / 9,
      volume_cm3: vol / 1000,
      mass_g: vol / 1000 * 1.01,
      size: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]],
      interference: nIn ? maxInterf : null,
      maxVoid: maxVoid,
      brimJump: maxJump,
      ears: ears,
      gap: { contact: gn[0] ? gs[0] / gn[0] : null, neutral: gn[1] ? gs[1] / gn[1] : null, relief: gn[2] ? gs[2] / gn[2] : null },
      holesRemoved: holesRemoved,
      mesh: { pinch: pinch, dropped: dropped },
      cells: cellsN
    }
  };
}

// STL binário da órtese (triângulos soltos de gerarOrtese().tris), cabeçalho "Lab.EITA CRO (mm)"
export function stlDaOrtese(tris) {
  const n = tris.length / 3, F = new Uint32Array(n);
  for (let i = 0; i < n; i++) F[i] = i;
  return stl({ V: tris, F }, null, "Lab.EITA CRO (mm)");
}

/* ============================================================ crescimento pela idade (curva OMS) */
// Perímetro cefálico, mediana OMS (cm) de 0 a 24 meses. Meninas: tabela OMS; meninos: padrão OMS.
export const PC_OMS_MENINOS = [34.5, 37.3, 39.1, 40.5, 41.6, 42.6, 43.3, 44.0, 44.5, 45.0, 45.4, 45.8, 46.1, 46.3, 46.6, 46.8, 47.0, 47.2, 47.4, 47.5, 47.7, 47.8, 48.0, 48.1, 48.3];
export const PC_OMS_MENINAS = [33.9, 36.5, 38.3, 39.5, 40.6, 41.5, 42.2, 42.8, 43.4, 43.8, 44.2, 44.6, 44.9, 45.2, 45.4, 45.7, 45.9, 46.1, 46.2, 46.4, 46.6, 46.7, 46.9, 47.0, 47.2];
// média de meninos e meninas, interpolada por mês (idade limitada a 0–24 meses)
export function perimetroCefalicoOMS(idade) {
  const a = Math.max(0, Math.min(24, idade)), i = Math.min(23, Math.floor(a)), w = a - i;
  const f = (T) => T[i] * (1 - w) + T[i + 1] * w;
  return (f(PC_OMS_MENINOS) + f(PC_OMS_MENINAS)) / 2;
}
// Crescimento previsto da idade até o reajuste (meses): cm de perímetro, mm de raio e a taxa (mm/mês) que o campo
// "crescimento radial" recebia na página antiga — arredondada a 2 casas, como lá (o campo mostrava 2 casas e a casca lia
// o campo). null sem idade ou sem meses (a página antiga ficava então com o valor manual).
export function crescimentoPelaIdade(idade, meses) {
  if (!(idade > 0 && meses > 0)) return null;
  const cm = perimetroCefalicoOMS(idade + meses) - perimetroCefalicoOMS(idade), raioMm = cm * 10 / (2 * Math.PI);
  return { cm, raioMm, taxa: Number((raioMm / meses).toFixed(2)) };
}

/* ============================================================ preparo e alinhamento do scan */
// Matriz 4×4 na ordem do three.js (por colunas: e[12..14] = translação) aplicada a um ponto, com a divisão por w
const aplicarMatriz = (e, x, y, z) => {
  const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
  return [(e[0] * x + e[4] * y + e[8] * z + e[12]) * w, (e[1] * x + e[5] * y + e[9] * z + e[13]) * w, (e[2] * x + e[6] * y + e[10] * z + e[14]) * w];
};
// aplica a matriz a todas as posições, guardando em float32 (como BufferAttribute.applyMatrix4)
function aplicarMatrizPosicoes(e, pos) {
  for (let k = 0; k + 2 < pos.length; k += 3) { const p = aplicarMatriz(e, pos[k], pos[k + 1], pos[k + 2]); pos[k] = p[0]; pos[k + 1] = p[1]; pos[k + 2] = p[2]; }
  return pos;
}
const translacao = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
// caixa envolvente das posições: { min: [x, y, z], max: [x, y, z] }
export function caixaEnvolvente(pos) {
  let a = Infinity, b = Infinity, c = Infinity, d = -Infinity, e = -Infinity, f = -Infinity;
  for (let k = 0; k + 2 < pos.length; k += 3) {
    const x = pos[k], y = pos[k + 1], z = pos[k + 2];
    if (x < a) a = x; if (y < b) b = y; if (z < c) c = z;
    if (x > d) d = x; if (y > e) e = y; if (z > f) f = z;
  }
  return { min: [a, b, c], max: [d, e, f] };
}
// inversa de matriz 4×4 (cofatores; a mesma ordem de contas de Matrix4.invert do three.js r128)
export function inverterMatriz4(te) {
  const n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3], n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7],
    n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11], n14 = te[12], n24 = te[13], n34 = te[14], n44 = te[15],
    t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44,
    t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44,
    t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44,
    t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;
  const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
  if (det === 0) return new Array(16).fill(0);
  const di = 1 / det;
  return [
    t11 * di,
    (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * di,
    (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * di,
    (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * di,
    t12 * di,
    (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * di,
    (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * di,
    (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * di,
    t13 * di,
    (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * di,
    (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * di,
    (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * di,
    t14 * di,
    (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * di,
    (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * di,
    (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * di,
  ];
}

// Unidades do STL que a página oferecia (fator para mm); o padrão era metros.
export const UNIDADES_STL = { mm: 1, cm: 10, m: 1000 };
export const UNIDADE_STL_PADRAO = "m";
// Scan recém-lido → mm e centrado na caixa envolvente (como a página antiga ao abrir o STL: geometry.scale, se o fator
// não é 1, e geometry.center()). Os pontos de referência marcados na malha (e os guardados na ficha) ficam neste
// referencial. Devolve uma cópia (Float32Array); o centro tirado vai em `centro`.
export function prepararScan(pos, fator) {
  const p = Float32Array.from(pos);
  if (fator && fator !== 1) aplicarMatrizPosicoes([fator, 0, 0, 0, 0, fator, 0, 0, 0, 0, fator, 0, 0, 0, 0, 1], p);
  const cx = caixaEnvolvente(p), c = [0, 1, 2].map((q) => (cx.min[q] + cx.max[q]) * 0.5);
  if (p.length < 3) return { pos: p, centro: [0, 0, 0] };                                // malha vazia
  aplicarMatrizPosicoes(translacao(-c[0], -c[1], -c[2]), p);
  return { pos: p, centro: c };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const normalizar = (a) => { const l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1, k = 1 / l; return [a[0] * k, a[1] * k, a[2] * k]; };
const vetorial = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const PONTOS_DE_REFERENCIA = ["anterior", "posterior", "left", "right", "vertex"];

// Alinhamento anatômico pelos 5 pontos (glabela "anterior", opistocrânio "posterior", eúrios "left"/"right" e vértice
// "vertex"; [x, y, z] no referencial de prepararScan): z = vértice − meio dos eúrios, y = anterior − posterior,
// x = y × z (e y refeito ortogonal). Origem no meio glabela–opistocrânio em x/y e no centro da caixa em z.
// Devolve a cópia alinhada (`pos`, Float32Array), a rotação aplicada (`rotacao`: matriz 4×4 na ordem do three.js) e
// a translação feita depois (`translacao`), e `zRef`, a altura do plano glabela–opistocrânio no modelo alinhado (a
// página antiga levava o plano axial até ela, dentro da faixa do controle deslizante). null se faltar algum ponto.
export function alinharPorPontos(pos, pontos) {
  if (!pontos || !PONTOS_DE_REFERENCIA.every((k) => pontos[k])) return null;
  const P = {}; PONTOS_DE_REFERENCIA.forEach((k) => (P[k] = [+pontos[k][0], +pontos[k][1], +pontos[k][2]]));
  const meioLat = [(P.left[0] + P.right[0]) * 0.5, (P.left[1] + P.right[1]) * 0.5, (P.left[2] + P.right[2]) * 0.5];
  const z = normalizar(sub(P.vertex, meioLat));
  let y = normalizar(sub(P.anterior, P.posterior));
  const x = normalizar(vetorial(y, z));
  y = normalizar(vetorial(z, x));
  const m = inverterMatriz4([x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, 0, 0, 0, 1]);   // makeBasis(x, y, z)
  const aL = aplicarMatriz(m, P.anterior[0], P.anterior[1], P.anterior[2]), pL = aplicarMatriz(m, P.posterior[0], P.posterior[1], P.posterior[2]);
  const meio = [(aL[0] + pL[0]) * 0.5, (aL[1] + pL[1]) * 0.5, (aL[2] + pL[2]) * 0.5];
  const p = aplicarMatrizPosicoes(m, Float32Array.from(pos));
  const cx = caixaEnvolvente(p), zc = (cx.min[2] + cx.max[2]) / 2, t = [-meio[0], -meio[1], -zc];
  aplicarMatrizPosicoes(translacao(t[0], t[1], t[2]), p);
  return { pos: p, rotacao: m, translacao: t, zRef: (aL[2] + pL[2]) / 2 - zc };
}
// leva um ponto do referencial de prepararScan ao modelo alinhado (em float64; a malha é guardada em float32)
export function pontoAlinhado(alinhamento, ponto) {
  const q = aplicarMatriz(alinhamento.rotacao, +ponto[0], +ponto[1], +ponto[2]), t = alinhamento.translacao;
  return [q[0] + t[0], q[1] + t[1], q[2] + t[2]];
}
