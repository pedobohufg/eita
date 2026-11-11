/* EITA! CRÂNIO — pontos de referência automáticos (E3c-4). Puro: navegador e Node.
   A partir do scan já preparado (mm, centrado; ortese.prepararScan) sugere os 5 pontos que o alinhamento usa
   (glabela, opistocrânio, eúrios D/E e vértice), sem depender da orientação do arquivo:
   1) para cima, aproximado: oposto ao corte plano do pescoço (a maior área com a mesma normal) ou, sem corte,
      oposto às bordas abertas da malha;
   2) plano sagital: busca de simetria por espelhamento entre normais quase perpendiculares ao "para cima";
      entre os dois melhores planos (a calota de bebê é quase simétrica também de frente para trás) fica aquele em
      que os detalhes da face (onde a superfície é mais irregular) ficam centrados;
   3) frente = lado oposto ao pescoço (ou, sem pescoço, o dos detalhes da face); no contorno sagital: opistocrânio
      (o ponto mais posterior da metade de cima, fora do corte), násio (a primeira reentrância do perfil da frente
      entre 45 e 5 mm abaixo do opistocrânio, com o nariz logo abaixo), glabela (12 mm acima do násio; sem násio,
      8 mm abaixo da altura do opistocrânio) e vértice (o mais alto); eúrios = extremos laterais acima da glabela + 10 mm (sem as orelhas);
   4) repete 3) uma vez com o "para cima" dado pelos próprios pontos (vértice − meio dos eúrios), se ele ficar a
      menos de 20° do primeiro.
   Entre os dois planos de simetria, o sagital é aquele cuja perpendicular (no plano horizontal) é a direção mais
   curta da metade de cima da cabeça (a cabeça é mais comprida que larga); empate: o pescoço no plano; depois, a face.
   É uma sugestão: a página mostra os pontos para conferência, e qualquer um pode ser marcado de novo.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */

import { amostrarGrade, analisar } from "./ortese.js";

const GRAU = Math.PI / 180;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const escala = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const semComp = (a, n) => norm(sub(a, escala(n, dot(a, n))));   // a sem a componente em n, normalizado

// triângulos: centro, normal e área; amostra por área (sorteio fixo, reprodutível)
function triangulos(pos) {
  const nt = pos.length / 9, C = new Float64Array(nt * 3), N = new Float64Array(nt * 3), A = new Float64Array(nt);
  for (let t = 0; t < nt; t++) {
    const o = t * 9, u = [pos[o + 3] - pos[o], pos[o + 4] - pos[o + 1], pos[o + 5] - pos[o + 2]], v = [pos[o + 6] - pos[o], pos[o + 7] - pos[o + 1], pos[o + 8] - pos[o + 2]];
    const c = cruz(u, v), a = Math.hypot(c[0], c[1], c[2]) / 2;
    A[t] = a; for (let q = 0; q < 3; q++) { C[t * 3 + q] = (pos[o + q] + pos[o + 3 + q] + pos[o + 6 + q]) / 3; N[t * 3 + q] = a > 0 ? c[q] / (2 * a) : 0; }
  }
  return { nt, C, N, A };
}
function amostrar(T, n) {
  const acc = new Float64Array(T.nt); let tot = 0; for (let t = 0; t < T.nt; t++) { tot += T.A[t]; acc[t] = tot; }
  let s = 12345; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647), ids = [];
  for (let i = 0; i < n; i++) { const r = rnd() * tot; let lo = 0, hi = T.nt - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (acc[m] < r) lo = m + 1; else hi = m; } ids.push(lo); }
  return ids;
}
// grade espacial para vizinho mais próximo
function grade(P, H) {
  const g = new Map(), k = (cx, cy, cz) => ((cx + 512) * 1024 + (cy + 512)) * 1024 + (cz + 512);   // chave numérica
  P.forEach((p, i) => { const c = k(Math.floor(p[0] / H), Math.floor(p[1] / H), Math.floor(p[2] / H)); (g.get(c) || g.set(c, []).get(c)).push(i); });
  return {
    perto(x, y, z, lim) {
      const cx = Math.floor(x / H), cy = Math.floor(y / H), cz = Math.floor(z / H); let b = lim * lim;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let l = -1; l <= 1; l++) { const L = g.get(k(cx + i, cy + j, cz + l)); if (L) for (const id of L) { const q = P[id], d = (q[0] - x) ** 2 + (q[1] - y) ** 2 + (q[2] - z) ** 2; if (d < b) b = d; } }
      return Math.sqrt(b);
    },
    vizinhos(x, y, z) { const cx = Math.floor(x / H), cy = Math.floor(y / H), cz = Math.floor(z / H), out = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let l = -1; l <= 1; l++) { const L = g.get(k(cx + i, cy + j, cz + l)); if (L) out.push(...L); } return out; }
  };
}

// 1) corte plano: normal com mais área (bins de ~3°) e quanto da área ele ocupa
export function cortePlano(T) {
  const bins = new Map(); let tot = 0;
  for (let t = 0; t < T.nt; t++) { const nz = T.N[t * 3 + 2], k = Math.round(Math.acos(Math.max(-1, Math.min(1, nz))) / 0.05) + "," + Math.round(Math.atan2(T.N[t * 3 + 1], T.N[t * 3]) / 0.05); bins.set(k, (bins.get(k) || 0) + T.A[t]); tot += T.A[t]; }
  const [k] = [...bins.entries()].sort((a, b) => b[1] - a[1])[0], [i, j] = k.split(",").map(Number);
  const n0 = [Math.sin(i * 0.05) * Math.cos(j * 0.05), Math.sin(i * 0.05) * Math.sin(j * 0.05), Math.cos(i * 0.05)];
  let s = [0, 0, 0], a = 0, c = [0, 0, 0];
  for (let t = 0; t < T.nt; t++) { const n = [T.N[t * 3], T.N[t * 3 + 1], T.N[t * 3 + 2]]; if (dot(n, n0) > Math.cos(8 * GRAU)) { s = s.map((v, q) => v + n[q] * T.A[t]); c = c.map((v, q) => v + T.C[t * 3 + q] * T.A[t]); a += T.A[t]; } }
  return { normal: norm(s), fracao: a / tot, centro: escala(c, 1 / (a || 1)) };
}
// bordas abertas da malha (arestas usadas por um só triângulo, solda em 1/100 mm) → centro, ou null
function centroDasBordas(pos) {
  const id = new Map(), chave = (o) => Math.round(pos[o] * 100) + "," + Math.round(pos[o + 1] * 100) + "," + Math.round(pos[o + 2] * 100);
  const vid = (o) => { const k = chave(o); let v = id.get(k); if (v === undefined) { v = id.size; id.set(k, v); } return v; };
  const ar = new Map(), pt = [];
  for (let o = 0; o < pos.length; o += 9) { const v = [vid(o), vid(o + 3), vid(o + 6)]; for (let q = 0; q < 3; q++) { const a = v[q], b = v[(q + 1) % 3], k = a < b ? a * 1e7 + b : b * 1e7 + a; ar.set(k, (ar.get(k) || 0) + 1); pt[v[q]] = [pos[o + q * 3], pos[o + q * 3 + 1], pos[o + q * 3 + 2]]; } }
  let c = [0, 0, 0], n = 0; ar.forEach((m, k) => { if (m !== 1) return; const a = Math.floor(k / 1e7), b = k - a * 1e7; c = c.map((v, q) => v + pt[a][q] + pt[b][q]); n += 2; });
  return n >= 30 ? escala(c, 1 / n) : null;
}

// 2) simetria: erro médio do espelho dos pontos amostrados num plano de normal n (melhor deslocamento)
function erroEspelho(P, G, n, passo, grosso) {
  const ds = P.map((p) => dot(p, n)).sort((a, b) => a - b), med = ds[ds.length >> 1];
  let melhor = { c: 1e9, d: med };
  for (const off of grosso ? [-4, 0, 4] : [-5, -2.5, 0, 2.5, 5]) {
    const d = med + off; let c = 0, k = 0;
    for (let i = 0; i < P.length; i += passo) { const p = P[i], e = 2 * (dot(p, n) - d); c += G.perto(p[0] - e * n[0], p[1] - e * n[1], p[2] - e * n[2], 8); k++; }
    if (c / k < melhor.c) melhor = { c: c / k, d };
  }
  return melhor;
}

// 3) pontos no quadro (n = lateral D, a = frente, s = cima); contorno sagital no plano n·p = d
function pontosNoQuadro(pos, Vtx, n, a, s, d, corte) {
  const seg = [];
  for (let o = 0; o < pos.length; o += 9) {
    const V = [0, 3, 6].map((k) => [pos[o + k], pos[o + k + 1], pos[o + k + 2]]), e = V.map((v) => dot(v, n) - d), pts = [];
    for (const [i, j] of [[0, 1], [1, 2], [2, 0]]) if ((e[i] <= 0) !== (e[j] <= 0)) { const k = e[i] / (e[i] - e[j]); pts.push(V[i].map((x, q) => x + (V[j][q] - x) * k)); }
    if (pts.length >= 2) seg.push(pts[0], pts[1]);
  }
  if (seg.length < 20) return null;
  const S = seg.map((p) => ({ p, a: dot(p, a), s: dot(p, s) }));
  const sMin = Math.min(...S.map((q) => q.s)), sMax = Math.max(...S.map((q) => q.s)), aMed = (Math.min(...S.map((q) => q.a)) + Math.max(...S.map((q) => q.a))) / 2;
  // perfil anterior: maior "a" por altura (1 mm), só na metade da frente
  const perf = new Map(); for (const q of S) { if (q.a < aMed) continue; const h = Math.round(q.s); if (!perf.has(h) || perf.get(h).a < q.a) perf.set(h, q); }
  const hs = [...perf.keys()].sort((x, y) => y - x);   // de cima para baixo
  const meio = sMin + 0.45 * (sMax - sMin);
  let hTesta = null; for (const h of hs) if (h >= meio && (hTesta == null || perf.get(h).a > perf.get(hTesta).a)) hTesta = h;
  // opistocrânio: o ponto mais posterior da metade de cima do contorno (fora do corte plano do pescoço)
  const foraDoCorte = (q) => !corte || Math.abs(dot(sub(q.p, corte.centro), corte.normal)) > 4;
  const post = S.filter((q) => q.s >= meio && foraDoCorte(q)).reduce((m, q) => (!m || q.a < m.a ? q : m), null);
  if (!post) return null;
  // násio: entre 45 e 5 mm abaixo do opistocrânio, a primeira reentrância (de cima para baixo) do perfil da frente
  // seguida de uma saliência (nariz) de ≥ 1 mm em até 25 mm
  let hNasio = null;
  for (const h of hs) {
    if (!perf.has(h) || h > post.s - 5 || h < post.s - 45) continue;
    const aq = perf.get(h).a, acima = perf.get(h + 1), abaixo = perf.get(h - 1); if (!acima || !abaixo) continue;
    if (aq <= acima.a && aq <= abaixo.a) { let sobe = false; for (let k = 1; k <= 25; k++) { const q = perf.get(h - k); if (q && q.a > aq + 1) { sobe = true; break; } } if (sobe) { hNasio = h; break; } }
  }
  // glabela: o ponto da frente 12 mm acima do násio; sem násio, 8 mm abaixo da altura do opistocrânio
  let glab = null;
  if (hNasio != null) for (let h = hNasio + 12; h >= hNasio + 6 && !glab; h--) if (perf.has(h)) glab = perf.get(h);
  if (!glab) for (let h = Math.round(post.s - 8); h >= Math.round(post.s - 14) && !glab; h--) if (perf.has(h)) glab = perf.get(h);
  if (!glab) return null;
  const sG = glab.s;
  const vert = S.reduce((m, q) => (!m || q.s > m.s ? q : m), null);
  let dir = null, esq = null;
  for (let i = 0; i < Vtx.length; i += 3) { const v = [Vtx[i], Vtx[i + 1], Vtx[i + 2]]; if (dot(v, s) < sG + 10) continue; const x = dot(v, n); if (!dir || x > dir.x) dir = { v, x }; if (!esq || x < esq.x) esq = { v, x }; }
  if (!post || !vert || !dir || !esq) return null;
  return { anterior: glab.p, posterior: post.p, right: dir.v, left: esq.v, vertex: vert.p, nasio: hNasio != null };
}

// Pontos sugeridos → { pontos: { anterior, posterior, left, right, vertex } (no referencial de pos), plano: { n, d },
// erroEspelho (mm), corte (fração da área no corte plano), nasio (achou a reentrância?) } ou null
export function detectarPontos(pos, o) {
  o = o || {};
  const T = triangulos(pos), ids = amostrar(T, o.amostras || 2400), P = ids.map((t) => [T.C[t * 3], T.C[t * 3 + 1], T.C[t * 3 + 2]]), G = grade(P, 4);
  // irregularidade local: 1 − |média das normais| num raio de 8 mm (alta na face e nas orelhas)
  const Gv = grade(P, 8), Nn = ids.map((t) => [T.N[t * 3], T.N[t * 3 + 1], T.N[t * 3 + 2]]);
  const rug = P.map((p, i) => { let m = [0, 0, 0], k = 0; for (const j of Gv.vizinhos(p[0], p[1], p[2])) { const q = P[j]; if ((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2 < 64) { m = m.map((x, c) => x + Nn[j][c]); k++; } } return k > 3 ? 1 - Math.hypot(m[0], m[1], m[2]) / k : 0; });
  // 1) para cima
  const ct = cortePlano(T); let cima;
  const cg = P.reduce((a, p) => a.map((x, q) => x + p[q] / P.length), [0, 0, 0]);
  // o sentido da normal depende da ordem dos vértices no arquivo: "cima" aponta do corte (ou das bordas) para o centro
  const baixo = ct.fracao > 0.025 ? ct.centro : centroDasBordas(pos);
  if (ct.fracao > 0.025) cima = dot(ct.normal, sub(cg, ct.centro)) > 0 ? ct.normal : escala(ct.normal, -1);
  else cima = baixo ? norm(sub(cg, baixo)) : [0, 0, 1];
  const noCorte = ids.map((t) => ct.fracao > 0.025 && dot([T.N[t * 3], T.N[t * 3 + 1], T.N[t * 3 + 2]], ct.normal) > Math.cos(10 * GRAU));
  // 2) plano sagital: normais n com |n·cima| ≤ sen 35°
  const e1 = semComp(Math.abs(cima[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], cima), e2 = cruz(cima, e1), cand = [];
  for (let az = 0; az < 180; az += 4) for (let el = -35; el <= 35; el += 7) {
    const ca = Math.cos(az * GRAU), sa = Math.sin(az * GRAU), ce = Math.cos(el * GRAU), se = Math.sin(el * GRAU);
    const n = norm([0, 1, 2].map((q) => ce * (ca * e1[q] + sa * e2[q]) + se * cima[q]));
    cand.push(Object.assign({ n, az, el }, erroEspelho(P, G, n, 4, true)));
  }
  cand.sort((x, y) => x.c - y.c);
  const sep = (x, y) => Math.acos(Math.min(1, Math.abs(dot(x.n, y.n)))) / GRAU;
  const melhores = [cand[0]]; for (const c of cand) if (melhores.length < 2 && sep(c, cand[0]) > 45) melhores.push(c);
  // refino de cada candidato (passos menores em torno dele)
  const refinar = (b) => { for (const st of [2, 1, 0.5]) { let m = b; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const az = b.az + i * st, el = b.el + j * st, ca = Math.cos(az * GRAU), sa = Math.sin(az * GRAU), ce = Math.cos(el * GRAU), se = Math.sin(el * GRAU); const n = norm([0, 1, 2].map((q) => ce * (ca * e1[q] + sa * e2[q]) + se * cima[q])), r = Object.assign({ n, az, el }, erroEspelho(P, G, n, 1)); if (r.c < m.c) m = r; } b = m; } return b; };
  // detalhes da face: os 12% mais irregulares (fora do corte); no plano sagital o centro deles fica no plano
  const lim = rug.filter((_, i) => !noCorte[i]).slice().sort((x, y) => y - x)[Math.floor(0.12 * P.length)] || 0;
  const centrado = (c) => { let sw = 0, sd = 0; P.forEach((p, i) => { if (noCorte[i] || rug[i] < lim) return; sw += rug[i]; sd += rug[i] * (dot(p, c.n) - c.d); }); return Math.abs(sd / (sw || 1)); };
  const ref = melhores.map(refinar).map((c) => Object.assign(c, { desc: centrado(c) }));
  // o pescoço (corte/bordas) fica no plano sagital e fora do coronal; sem essa pista, vale a face centrada
  const distBaixo = (c) => (baixo ? Math.abs(dot(baixo, c.n) - c.d) : null);
  // 1º critério: a cabeça é mais comprida (frente–trás) que larga; na metade de cima não há orelhas. Com o plano
  // sagital, a direção perpendicular a ele e ao "cima" é a lateral (a extensão menor).
  const hs = P.map((p) => dot(p, cima)), hMeio = (Math.min(...hs) + Math.max(...hs)) / 2;
  const largura = (c) => { let lo = Infinity, hi = -Infinity; P.forEach((p, i) => { if (hs[i] < hMeio) return; const x = dot(p, c.n); if (x < lo) lo = x; if (x > hi) hi = x; }); return hi - lo; };
  let sag = ref[0];
  if (ref.length > 1) {
    const l0 = largura(ref[0]), l1 = largura(ref[1]);
    if (Math.abs(l0 - l1) > 0.04 * Math.max(l0, l1)) sag = l1 < l0 ? ref[1] : ref[0];
    else if (baixo && Math.abs(distBaixo(ref[0]) - distBaixo(ref[1])) > 3) sag = distBaixo(ref[1]) < distBaixo(ref[0]) ? ref[1] : ref[0];
    else sag = ref[1].desc < ref[0].desc ? ref[1] : ref[0];
  }
  // 3) quadro: frente = lado dos detalhes da face
  let s = semComp(cima, sag.n), a = norm(cruz(s, sag.n));
  // o pescoço (corte ou bordas abertas) fica atrás do centro da cabeça; sem essa pista, vale o lado dos detalhes da face
  const atras = baixo ? dot(sub(baixo, cg), a) : 0;
  if (Math.abs(atras) > 5) { if (atras > 0) a = escala(a, -1); }
  else { let sf = 0; P.forEach((p, i) => { if (!noCorte[i] && rug[i] >= lim) sf += rug[i] * dot(p, a); }); if (sf < 0) a = escala(a, -1); }
  let n = norm(cruz(a, s));   // direita do paciente = frente × cima
  if (o.depurar) o.depurar({ distBaixo: ref.map(distBaixo), cima, corte: ct, candidatos: ref.map((c) => ({ n: c.n, c: c.c, d: c.d, desc: c.desc })), sag: sag.n, a, s, n });
  let r = pontosNoQuadro(pos, pos, n, a, s, sag.d, ct.fracao > 0.025 ? ct : null);
  if (o.depurar) o.depurar({ primeira: r });
  // 4) uma vez de novo, com o "para cima" dos próprios pontos, se ele não se afastar mais de 20° do primeiro
  if (r) {
    const meioLat = escala([0, 1, 2].map((q) => r.left[q] + r.right[q]), 0.5), cimaP = semComp(sub(r.vertex, meioLat), n);
    if (dot(cimaP, s) > Math.cos(20 * GRAU)) { const s2 = cimaP, a2 = norm(cruz(s2, n)), r2 = pontosNoQuadro(pos, pos, norm(cruz(a2, s2)), a2, s2, sag.d, ct.fracao > 0.025 ? ct : null); if (r2) r = r2; }
  }
  if (o.depurar) o.depurar({ final: r });
  if (!r) return null;
  const arred = (p) => p.map((v) => +v.toFixed(4));
  return { pontos: { anterior: arred(r.anterior), posterior: arred(r.posterior), left: arred(r.left), right: arred(r.right), vertex: arred(r.vertex) },
    plano: { n: n.map((v) => +v.toFixed(5)), d: +sag.d.toFixed(3) }, erroEspelho: +sag.c.toFixed(2), corte: +ct.fracao.toFixed(3), nasio: r.nasio };
}

// Correção do pescoço (E3c-4): tira da malha os triângulos do corte plano (a maior área com a mesma normal, quando
// passa de 2,5% da área), que não são a cabeça — em geral é onde o bebê foi segurado —, e as abas esticadas que o
// scanner cria ligando a cabeça à mão (triângulos com aresta acima de 6× a típica e muito finos). A análise da órtese completa
// essa região como completa qualquer falta de malha (interpolação da grade de raios).
// → { pos (sem o corte), removidos (triângulos), area (mm²), fracao } ou null se não houver corte
export function semCortePlano(pos, o) {
  o = o || {};
  if (!pos || pos.length < 9) return null;
  const T = triangulos(pos), ct = cortePlano(T);
  if (ct.fracao <= (o.minimo == null ? 0.025 : o.minimo)) return null;
  const tol = Math.cos((o.angulo || 10) * GRAU), dist = o.distancia || 3, fica = [];
  // aresta típica da malha (mediana das maiores arestas) → triângulos esticados: aresta > 6× a típica e finos
  const maiorAresta = (t) => { const q = t * 9; let m = 0; for (const [i, j] of [[0, 3], [3, 6], [6, 0]]) m = Math.max(m, Math.hypot(pos[q + i] - pos[q + j], pos[q + i + 1] - pos[q + j + 1], pos[q + i + 2] - pos[q + j + 2])); return m; };
  const ar = new Float64Array(T.nt); for (let t = 0; t < T.nt; t++) ar[t] = maiorAresta(t);
  const tip = Float64Array.from(ar).sort()[T.nt >> 1];
  let area = 0, rem = 0, esticados = 0;
  for (let t = 0; t < T.nt; t++) {
    const n = [T.N[t * 3], T.N[t * 3 + 1], T.N[t * 3 + 2]], c = [T.C[t * 3], T.C[t * 3 + 1], T.C[t * 3 + 2]];
    if (Math.abs(dot(n, ct.normal)) > tol && Math.abs(dot(sub(c, ct.centro), ct.normal)) < dist) { area += T.A[t]; rem++; continue; }
    if (ar[t] > Math.max(6 * tip, 8) && T.A[t] / (ar[t] * ar[t]) < 0.08) { area += T.A[t]; rem++; esticados++; continue; }   // aba esticada (scanner ligando a cabeça à mão)
    fica.push(t);
  }
  const out = new Float32Array(fica.length * 9);
  fica.forEach((t, i) => out.set(pos.subarray(t * 9, t * 9 + 9), i * 9));
  return { pos: out, removidos: rem, esticados, area, fracao: ct.fracao, normal: ct.normal, centro: ct.centro };
}

// Abas soltas (E3c-4): triângulos com os três vértices mais de `folga` mm (padrão 6) fora do raio da calota na mesma
// direção (grade da análise, em torno de (0, 0, zRef) do modelo alinhado), só na metade de trás (azimute 90–270°,
// elevação −55° a +30°; a face, o queixo e o nariz também saltam para fora e ficam), fora das janelas das orelhas
// (azimute 55–135° e 225–305°, elevação −45° a +20°) e, se houver corte plano (o.corte = semCortePlano), a até 30 mm
// do plano dele. → { pos, removidos } (pos alinhado)
export function semAbas(pos, zRef, o) {
  o = o || {};
  const folga = o.folga == null ? 6 : o.folga, an = o.analise || analisar(pos, zRef), fica = [], ct = o.corte || null;
  const fora = (k) => {
    const x = pos[k], y = pos[k + 1], z = pos[k + 2] - zRef, r = Math.hypot(x, y, z) || 1, ph = Math.asin(Math.max(-1, Math.min(1, z / r))) / GRAU;
    let th = Math.atan2(x, y) / GRAU; if (th < 0) th += 360;
    if (th < 90 || th > 270 || ph < -55 || ph > 30) return false;            // só na metade de trás (a face fica)
    if (ct && Math.abs((pos[k] - ct.centro[0]) * ct.normal[0] + (pos[k + 1] - ct.centro[1]) * ct.normal[1] + (pos[k + 2] - ct.centro[2]) * ct.normal[2]) > 30) return false;   // perto do corte, se houver
    const orelha = ph > -45 && ph < 20 && ((th > 55 && th < 135) || (th > 225 && th < 305));
    return !orelha && r - amostrarGrade(an.rho, th, ph) > folga;
  };
  let rem = 0;
  for (let t = 0; t < pos.length / 9; t++) { if (fora(t * 9) && fora(t * 9 + 3) && fora(t * 9 + 6)) { rem++; continue; } fica.push(t); }
  const out = new Float32Array(fica.length * 9); fica.forEach((t, i) => out.set(pos.subarray(t * 9, t * 9 + 9), i * 9));
  return { pos: out, removidos: rem };
}
