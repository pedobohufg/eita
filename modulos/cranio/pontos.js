/* EITA! CRÂNIO — pontos de referência automáticos (E3c-4). Puro: navegador e Node.
   A partir do scan já preparado (mm, centrado; ortese.prepararScan) sugere os 5 pontos que o alinhamento usa
   (glabela, opistocrânio, eúrios D/E e vértice), sem depender da orientação do arquivo:
   1) para cima, aproximado: oposto ao corte plano do pescoço (a maior área com a mesma normal) ou, sem corte,
      oposto às bordas abertas da malha;
   2) plano sagital: busca de simetria por espelhamento entre normais quase perpendiculares ao "para cima";
      entre os dois melhores planos (a calota de bebê é quase simétrica também de frente para trás) fica aquele em
      que os detalhes da face (onde a superfície é mais irregular) ficam centrados;
   3) frente = lado do nariz (reentrância do násio seguida do nariz no contorno sagital); se ele não decidir, lado
   oposto ao pescoço (ou, sem pescoço, o dos detalhes da face); no contorno sagital: opistocrânio
      (o ponto mais posterior da metade de cima, fora do corte), násio (a primeira reentrância do perfil da frente
      entre 45 e 5 mm abaixo do opistocrânio, com o nariz logo abaixo), glabela (12 mm acima do násio; sem násio,
      8 mm abaixo da altura do opistocrânio), eúrios = extremos laterais acima da glabela + 10 mm (sem as orelhas) e
      vértice = o ponto do contorno logo acima do meio dos eúrios, na perpendicular à linha glabela–opistocrânio (o
      alinhamento usa vértice − meio dos eúrios como "para cima"; assim a linha glabela–opistocrânio fica horizontal);
   4) repete 3) uma vez com o "para cima" dado pelos próprios pontos (mais alto − meio dos eúrios), se ele ficar a
      menos de 20° do primeiro.
   Entre os dois planos de simetria, o sagital é aquele cuja perpendicular (no plano horizontal) é a direção mais
   curta da metade de cima da cabeça (a cabeça é mais comprida que larga); empate: o pescoço no plano; depois, a face.
   É uma sugestão: a página mostra os pontos para conferência, e qualquer um pode ser marcado de novo.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */

import { amostrarGrade, analisar, GRADE, nomeDaRegiao, diferencaAzimute } from "./ortese.js";

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
  // vértice para o alinhamento (z = vértice − meio dos eúrios): o ponto do contorno logo acima do meio dos eúrios na
  // direção perpendicular à linha glabela–opistocrânio, para que essa linha fique horizontal. O ponto mais alto do
  // quadro provisório não serve: os eúrios costumam ficar atrás do meio da cabeça e o "para cima" inclinava a face
  // para cima (no scan dos gêmeos, 33°)
  const meioLat = escala([0, 1, 2].map((q) => dir.v[q] + esq.v[q]), 0.5), u = norm(sub(glab.p, post.p)), sup = norm(semComp(s, u));
  const topo = S.filter((q) => dot(sub(q.p, meioLat), sup) > 20).reduce((m, q) => { const e = Math.abs(dot(sub(q.p, meioLat), u)); return !m || e < m.e ? { q, e } : m; }, null);
  return { anterior: glab.p, posterior: post.p, right: dir.v, left: esq.v, vertex: topo ? topo.q.p : vert.p, maisAlto: vert.p, nasio: hNasio != null };
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
  // o plano sagital é n·p = d com o n do sagital; quando a frente inverte, n troca de sinal e d também
  const dDe = (m) => sag.d * Math.sign(dot(m, sag.n));
  let r = pontosNoQuadro(pos, pos, n, a, s, dDe(n), ct.fracao > 0.025 ? ct : null);
  // a pista mais forte da frente é o nariz: se só o lado oposto tem a reentrância do násio seguida do nariz, a frente
  // é ele (mãos e dedos debaixo do queixo deixam bordas abertas na frente e enganam a pista do pescoço)
  if (!(r && r.nasio)) {
    const a2 = escala(a, -1), n2 = norm(cruz(a2, s)), r2 = pontosNoQuadro(pos, pos, n2, a2, s, dDe(n2), ct.fracao > 0.025 ? ct : null);
    if (r2 && r2.nasio) { a = a2; n = n2; r = r2; }
  }
  if (o.depurar) o.depurar({ primeira: r });
  // 4) uma vez de novo, com o "para cima" dos próprios pontos, se ele não se afastar mais de 20° do primeiro
  if (r) {
    const meioLat = escala([0, 1, 2].map((q) => r.left[q] + r.right[q]), 0.5), cimaP = semComp(sub(r.maisAlto, meioLat), n);
    if (dot(cimaP, s) > Math.cos(20 * GRAU)) { const s2 = cimaP, a2 = norm(cruz(s2, n)), n3 = norm(cruz(a2, s2)), r2 = pontosNoQuadro(pos, pos, n3, a2, s2, dDe(n3), ct.fracao > 0.025 ? ct : null); if (r2) r = r2; }
  }
  if (o.depurar) o.depurar({ final: r });
  if (!r) return null;
  const arred = (p) => p.map((v) => +v.toFixed(4));
  return { pontos: { anterior: arred(r.anterior), posterior: arred(r.posterior), left: arred(r.left), right: arred(r.right), vertex: arred(r.vertex) },
    plano: { n: n.map((v) => +v.toFixed(5)), d: +dDe(n).toFixed(3) }, erroEspelho: +sag.c.toFixed(2), corte: +ct.fracao.toFixed(3), nasio: r.nasio };
}

/* Isolar a cabeça num scan bruto (14/11/2026). Os scans do escâner de mão chegam com tronco, braços, as mãos de quem
   segura o bebê, a mesa, panos e ruído solto (cenas de 0,3 a 1,2 m); a análise e os pontos automáticos supõem só a
   cabeça. A calota é a única parte da cena que é quase uma esfera de 50 a 95 mm de raio:
   1) votação (Hough) com 20 mil pontos amostrados por área: cada ponto vota no centro p − R·n (normal para dentro ou
      para fora, R de 50 a 95 mm de 5 em 5, células de 8 mm); vale a célula mais votada em relação a R²;
   2) esfera por mínimos quadrados nos pontos a menos de 14 → 6 mm dela, com a normal radial (12 voltas);
   3) ficam os triângulos a menos de 1,6 R do centro (calota, rosto, orelhas e começo do pescoço) e, entre eles, o
      componente conexo com mais área sobre a esfera (o resto — mão solta, pano, ruído — sai).
   pos em mm. → { pos, centro, raio, cobertura (área sobre a esfera ÷ área da esfera), removidos, triangulos } ou null.
   Quem chama decide se usa: ver precisaIsolar. */
export function isolarCabeca(pos, o) {
  o = o || {};
  if (pos.length < 9 * 200) return null;
  const nt = pos.length / 9, C = new Float32Array(nt * 3), N = new Float32Array(nt * 3), A = new Float32Array(nt);
  let tot = 0;
  for (let t = 0; t < nt; t++) {
    const p = t * 9, ux = pos[p + 3] - pos[p], uy = pos[p + 4] - pos[p + 1], uz = pos[p + 5] - pos[p + 2], vx = pos[p + 6] - pos[p], vy = pos[p + 7] - pos[p + 1], vz = pos[p + 8] - pos[p + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx, l = Math.hypot(cx, cy, cz);
    A[t] = l / 2; tot += A[t];
    if (l > 0) { N[t * 3] = cx / l; N[t * 3 + 1] = cy / l; N[t * 3 + 2] = cz / l; }
    for (let q = 0; q < 3; q++) C[t * 3 + q] = (pos[p + q] + pos[p + 3 + q] + pos[p + 6 + q]) / 3;
  }
  // amostra por área (sorteio fixo)
  const ns = o.amostras || 20000, acc = new Float64Array(nt); let s0 = 0; for (let t = 0; t < nt; t++) { s0 += A[t]; acc[t] = s0; }
  let sd = 12345; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647), ids = new Uint32Array(ns);
  for (let i = 0; i < ns; i++) { const r = rnd() * tot; let lo = 0, hi = nt - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (acc[m] < r) lo = m + 1; else hi = m; } ids[i] = lo; }
  // votação (Hough): centro = p − R·n, para os dois sentidos da normal; célula de 8 mm
  const H = 8; let melhor = null;
  for (const sinal of [1, -1]) for (let R = 50; R <= 95; R += 5) {
    const votos = new Map();
    for (let i = 0; i < ns; i++) { const t = ids[i] * 3; const k = `${Math.round((C[t] - sinal * R * N[t]) / H)},${Math.round((C[t + 1] - sinal * R * N[t + 1]) / H)},${Math.round((C[t + 2] - sinal * R * N[t + 2]) / H)}`; votos.set(k, (votos.get(k) || 0) + 1); }
    for (const [k, v] of votos) { const nota = v / (R * R); if (!melhor || nota > melhor.nota) { const c = k.split(",").map((x) => +x * H); melhor = { nota, v, R, c, sinal }; } }
  }
  // ajuste: esfera por mínimos quadrados nos pontos próximos, com a normal apontando para fora
  let c = melhor.c.slice(), R = melhor.R; const sg = melhor.sinal;
  for (let it = 0; it < 12; it++) {
    let sx = 0, sy = 0, sz = 0, sr = 0, n = 0; const pts = [];
    for (let i = 0; i < ns; i++) {
      const t = ids[i] * 3, dx = C[t] - c[0], dy = C[t + 1] - c[1], dz = C[t + 2] - c[2], d = Math.hypot(dx, dy, dz);
      if (Math.abs(d - R) > Math.max(6, 14 - it) || sg * (dx * N[t] + dy * N[t + 1] + dz * N[t + 2]) / d < 0.75) continue;
      pts.push([C[t], C[t + 1], C[t + 2]]);
    }
    if (pts.length < 50) break;
    // esfera algébrica: |p|² = 2 c·p + (R² − |c|²)
    const M = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], b = [0, 0, 0, 0];
    for (const p of pts) { const v = [2 * p[0], 2 * p[1], 2 * p[2], 1], y = p[0] * p[0] + p[1] * p[1] + p[2] * p[2]; for (let i = 0; i < 4; i++) { b[i] += v[i] * y; for (let j = 0; j < 4; j++) M[i][j] += v[i] * v[j]; } }
    for (let i = 0; i < 4; i++) { let pv = i; for (let r = i + 1; r < 4; r++) if (Math.abs(M[r][i]) > Math.abs(M[pv][i])) pv = r; [M[i], M[pv]] = [M[pv], M[i]]; [b[i], b[pv]] = [b[pv], b[i]]; for (let r = i + 1; r < 4; r++) { const f = M[r][i] / M[i][i]; b[r] -= f * b[i]; for (let j = i; j < 4; j++) M[r][j] -= f * M[i][j]; } }
    const x = [0, 0, 0, 0]; for (let i = 3; i >= 0; i--) { let s = b[i]; for (let j = i + 1; j < 4; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
    const Rn = Math.sqrt(Math.max(1, x[3] + x[0] * x[0] + x[1] * x[1] + x[2] * x[2]));
    if (!(Rn > 40 && Rn < 110)) break;
    c = [x[0], x[1], x[2]]; R = Rn;
  }
  if (!(R >= 45 && R <= 105)) return null;
  // recorte: triângulos a menos de k·R do centro; fica o componente conexo com mais área sobre a esfera
  const lim = (o.alcance || 1.6) * R, fica = [];
  for (let t = 0; t < nt; t++) if (Math.hypot(C[t * 3] - c[0], C[t * 3 + 1] - c[1], C[t * 3 + 2] - c[2]) < lim) fica.push(t);
  const map = new Map(), vid = new Uint32Array(fica.length * 3);
  fica.forEach((t, i) => { for (let q = 0; q < 3; q++) { const p = t * 9 + q * 3, k = `${Math.round(pos[p] * 500)},${Math.round(pos[p + 1] * 500)},${Math.round(pos[p + 2] * 500)}`; let id = map.get(k); if (id === undefined) { id = map.size; map.set(k, id); } vid[i * 3 + q] = id; } });
  const pai = new Uint32Array(map.size); for (let i = 0; i < pai.length; i++) pai[i] = i;
  const f = (x) => { while (pai[x] !== x) { pai[x] = pai[pai[x]]; x = pai[x]; } return x; };
  for (let i = 0; i < fica.length; i++) { const a = f(vid[i * 3]); pai[f(vid[i * 3 + 1])] = a; pai[f(vid[i * 3 + 2])] = a; }
  const peso = new Map();
  fica.forEach((t, i) => { const d = Math.hypot(C[t * 3] - c[0], C[t * 3 + 1] - c[1], C[t * 3 + 2] - c[2]); if (Math.abs(d - R) < 10) { const r = f(vid[i * 3]); peso.set(r, (peso.get(r) || 0) + A[t]); } });
  let raiz = -1, pm = 0; for (const [r, w] of peso) if (w > pm) { pm = w; raiz = r; }
  const sel = fica.filter((t, i) => f(vid[i * 3]) === raiz), out = new Float32Array(sel.length * 9);
  sel.forEach((t, i) => out.set(pos.subarray(t * 9, t * 9 + 9), i * 9));
  return { pos: out, centro: c.map((x) => +x.toFixed(2)), raio: +R.toFixed(2), cobertura: pm / (4 * Math.PI * R * R), removidos: nt - sel.length, triangulos: nt };
}

// Vale isolar? Só quando o arquivo é claramente mais que uma cabeça: maior dimensão acima de 300 mm, ou mais de um
// quarto dos triângulos fora da cabeça achada (um scan já recortado, com o pescoço, fica como está).
export function precisaIsolar(pos, iso) {
  if (!iso || !(iso.cobertura > 0.45)) return false;
  let mn = [1e30, 1e30, 1e30], mx = [-1e30, -1e30, -1e30];
  for (let i = 0; i < pos.length; i += 3) for (let q = 0; q < 3; q++) { const v = pos[i + q]; if (v < mn[q]) mn[q] = v; if (v > mx[q]) mx[q] = v; }
  return Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) > 300 || iso.removidos > 0.25 * iso.triangulos;
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

// Saliências estranhas (E3c-4): o que sobra acima do "crânio liso" (abertura morfológica da grade de raios com janela
// de ±20°) em ≥ `altura` mm (padrão 4), em grupos de ≥ `area` cm² (padrão 1,5), na zona onde a órtese encosta
// (elevação −40° a 75°), fora da face (azimute ±70° abaixo de +5°) e fora das orelhas detectadas. Em geral é dedo, mão,
// dobra ou costura da touca, ou cabelo. → [{ th, ph (centro, graus), altura (mm), area (cm²), regiao, celulas }]
function abertura(src, graus) {
  const NT = GRADE.NT, NP = GRADE.NP, N = NT * NP, wT = Math.round(graus / GRADE.dT), wP = Math.round(graus / GRADE.dP);
  const t = new Float32Array(N), mn = new Float32Array(N), op = new Float32Array(N);
  const filtro = (a, d, min) => {
    for (let ip = 0; ip < NP; ip++) for (let it = 0; it < NT; it++) { let v = min ? 1e9 : -1e9; for (let k = -wT; k <= wT; k++) { const x = a[ip * NT + (it + k + NT) % NT]; v = min ? Math.min(v, x) : Math.max(v, x); } t[ip * NT + it] = v; }
    for (let ip = 0; ip < NP; ip++) for (let it = 0; it < NT; it++) { let v = min ? 1e9 : -1e9; for (let k = -wP; k <= wP; k++) { const x = t[Math.min(NP - 1, Math.max(0, ip + k)) * NT + it]; v = min ? Math.min(v, x) : Math.max(v, x); } d[ip * NT + it] = v; }
  };
  filtro(src, mn, true); filtro(mn, op, false);
  return op;
}
export function detectarSaliencias(an, o) {
  o = o || {};
  const NT = GRADE.NT, NP = GRADE.NP, N = NT * NP, rs = an.rho, op = abertura(rs, 20), alt = o.altura || 4, amin = o.area || 1.5;
  const naOrelha = (th, ph) => ["R", "L"].some((s) => { const e = an.ears && an.ears[s]; if (!e || !e.ok) return false; const az = s === "R" ? e.az : 360 - e.az; return diferencaAzimute(th, az) <= e.w + 6 && ph <= e.phiTop + 6 && ph >= e.phiBot - 6; });
  const marca = new Uint8Array(N);
  for (let ip = 0; ip < NP; ip++) {
    const ph = GRADE.PMIN + ip * GRADE.dP; if (ph < -40 || ph > 75) continue;
    for (let it = 0; it < NT; it++) {
      const th = it * GRADE.dT, i = ip * NT + it;
      if (ph < 5 && diferencaAzimute(th, 0) < 70) continue;
      if (rs[i] - op[i] >= alt && !naOrelha(th, ph)) marca[i] = 1;
    }
  }
  const visto = new Uint8Array(N), out = [];
  for (let i0 = 0; i0 < N; i0++) {
    if (!marca[i0] || visto[i0]) continue;
    const fila = [i0], cel = []; visto[i0] = 1;
    while (fila.length) { const i = fila.pop(); cel.push(i); const ip = (i / NT) | 0, it = i % NT; for (const [a, b] of [[ip - 1, it], [ip + 1, it], [ip, (it + 1) % NT], [ip, (it + NT - 1) % NT]]) { if (a < 0 || a >= NP) continue; const j = a * NT + b; if (marca[j] && !visto[j]) { visto[j] = 1; fila.push(j); } } }
    let area = 0, sx = 0, cx = 0, sp = 0, h = 0, w = 0;
    for (const i of cel) { const ip = (i / NT) | 0, th = (i % NT) * GRADE.dT * GRAU, ph = GRADE.PMIN + ip * GRADE.dP, r = rs[i], d = rs[i] - op[i]; area += r * GRADE.dT * GRAU * Math.cos(ph * GRAU) * r * GRADE.dP * GRAU; sx += Math.sin(th) * d; cx += Math.cos(th) * d; sp += ph * d; w += d; h = Math.max(h, d); }
    // o crânio também tem calombos (a proeminência da plagiocefalia), mas largos e baixos; dedo, mão e orelha são
    // estreitos e altos: altura ≥ 0,3 × √área
    if (area / 100 < amin || h < 0.3 * Math.sqrt(area)) continue;
    let th = Math.atan2(sx, cx) / GRAU; if (th < 0) th += 360;
    const ph = sp / w;
    const lado = diferencaAzimute(th, 90) <= 50 ? "R" : diferencaAzimute(th, 270) <= 50 ? "L" : null;
    const talvezOrelha = !!lado && ph >= -50 && ph <= 10;
    out.push({ th: +th.toFixed(0), ph: +ph.toFixed(0), altura: +h.toFixed(1), area: +(area / 100).toFixed(1), regiao: nomeDaRegiao(th, ph), talvezOrelha, celulas: cel });
  }
  return out.sort((a, b) => b.area * b.altura - a.area * a.altura);
}

// Conferência do scan (E3c-4): avisos para a pessoa olhar antes de gerar a órtese. d = { pontos (detectarPontos),
// analise, corte (semCortePlano), abas (removidos por semAbas), saliencias (detectarSaliencias) }; tudo opcional.
// → [{ nivel: "alerta" | "atencao", codigo, texto }]
export function conferirScan(d) {
  const av = [], A = (nivel, codigo, texto) => av.push({ nivel, codigo, texto }), an = d.analise, mm = (v) => String(Math.round(v));
  if (d.pontos && !d.pontos.nasio) A("atencao", "frente", "O nariz não foi achado no contorno do meio do rosto: confira se a glabela (G) ficou na testa e não na nuca.");
  if (d.pontos && d.pontos.erroEspelho > 7) A("atencao", "simetria", `Simetria fraca (${String(d.pontos.erroEspelho).replace(".", ",")} mm): confira o plano do meio (G, O e V) antes de medir.`);
  if (an && an.ears) {
    const R = an.ears.R, L = an.ears.L, nome = { R: "direita", L: "esquerda" };
    for (const s of ["R", "L"]) { const e = an.ears[s]; if (!e || !e.ok) A("alerta", "orelha" + s, `Orelha ${nome[s]} não encontrada${e && e.cells ? " (o que parece orelha está fora do lugar — dedo, mão ou touca?)" : ""}: marque-a no modelo ou ajuste a janela à mão.`); }
    // na plagiocefalia a orelha do lado achatado vai para a frente; além de ~30° ou 15 mm de altura, desconfiar
    if (R && L && R.ok && L.ok && (Math.abs(R.az - L.az) > 30 || Math.abs(R.top - L.top) > 15)) A("atencao", "orelhas", `Orelhas bem assimétricas (azimute ${mm(R.az)}° × ${mm(L.az)}°, topo ${mm(R.top)} × ${mm(L.top)} mm): pode ser a plagiocefalia, mas confira se uma delas não é dedo, mão ou dobra da touca.`);
    const tops = [R, L].filter((e) => e && e.ok).map((e) => e.top);
    if (tops.length && Math.max(...tops) < -30) A("atencao", "plano", `As orelhas ficaram ${mm(-Math.max(...tops))} mm abaixo do plano glabela–opistocrânio (comum no occipital plano): confira a altura da borda e das janelas.`);
  }
  if (an && an.cheekCoverage != null && an.cheekCoverage < 0.5) A("atencao", "bochecha", `O scan cobre pouco a região da bochecha (${mm(an.cheekCoverage * 100)}%): o apoio fica estimado.`);
  for (const q of d.saliencias || []) A("alerta", "saliencia", `Saliência de ${String(q.altura).replace(".", ",")} mm em ${q.area.toString().replace(".", ",")} cm² (${q.regiao}, ${q.th}°/${q.ph}°): ${q.talvezOrelha ? "é a orelha (não reconhecida) ou dedo/mão junto dela? Confira qual é a orelha e, se preciso, marque-a no modelo." : "dedo, mão, dobra ou costura da touca? Ela entra no molde se não for tirada."}`);
  if (d.corte && d.corte.removidos) A("atencao", "pescoco", `Corte plano do pescoço tirado (${mm(d.corte.area / 100)} cm²): a região é completada pela análise.`);
  if (d.abas > 40) A("atencao", "abas", `${d.abas} triângulos soltos (mão ou dedos colados à nuca) tirados da malha.`);
  return av;
}

// Tira da malha alinhada as saliências marcadas: triângulos com os três vértices nas células delas e acima do "crânio
// liso" (abertura) + 1 mm. A análise completa o buraco como completa qualquer falta de malha. → { pos, removidos }
export function semSaliencias(pos, zRef, saliencias, an) {
  if (!saliencias || !saliencias.length) return { pos, removidos: 0 };
  const NT = GRADE.NT, NP = GRADE.NP, marca = new Uint8Array(NT * NP), op = abertura(an.rho, 20);
  for (const q of saliencias) for (const i of q.celulas) {   // a célula e as vizinhas (borda do dedo)
    const ip = (i / NT) | 0, it = i % NT;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const p = ip + a; if (p >= 0 && p < NP) marca[p * NT + (it + b + NT) % NT] = 1; }
  }
  const fora = (k) => {
    const x = pos[k], y = pos[k + 1], z = pos[k + 2] - zRef, r = Math.hypot(x, y, z) || 1, ph = Math.asin(Math.max(-1, Math.min(1, z / r))) / GRAU;
    let th = Math.atan2(x, y) / GRAU; if (th < 0) th += 360;
    const it = Math.round(th / GRADE.dT) % NT, ip = Math.round((ph - GRADE.PMIN) / GRADE.dP);
    return ip >= 0 && ip < NP && marca[ip * NT + it] && r > amostrarGrade(op, th, ph) + 1;
  };
  const fica = []; let rem = 0;
  for (let t = 0; t < pos.length / 9; t++) { if (fora(t * 9) && fora(t * 9 + 3) && fora(t * 9 + 6)) { rem++; continue; } fica.push(t); }
  const out = new Float32Array(fica.length * 9); fica.forEach((t, i) => out.set(pos.subarray(t * 9, t * 9 + 9), i * 9));
  return { pos: out, removidos: rem };
}
