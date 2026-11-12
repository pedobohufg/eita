/* EITA! NARIZ·ORELHA — processamento (puro: navegador e Node). Projeto em docs/E5-NARIZ-ORELHA.md.
   1) Referencial: plano sagital mediano pelos pontos (cantos externos dos olhos, násio, subnasal), refinado pela
      simetria do rosto; eixos locais u, v (para cima), w (direção de retirada: lateral na orelha, anterior no nariz).
   2) Forma doadora: orelha sadia espelhada (dentro do contorno marcado), nariz paramétrico ou modelo importado.
   3) Prótese = (doadora ∩ região) ∪ aba que afina até a borda − rosto; nariz oco com narinas; nichos de ímãs.
   4) Molde: base (tudo abaixo da primeira cavidade em cada coluna, ou da pele) + parte externa (opcionalmente
      dividida em 2 por um plano), chaves, canal de injeção e respiros.
   Tudo em mm. Grade nos eixos locais (x = u, y = v, z = w).
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import * as Vo from "../../nucleo/volume.js";
import { decimar } from "../../nucleo/decimar.js";
import { paraLocal, deLocal, transformarVertices, criarBuscaProxima } from "../../nucleo/superficie.js";
import { volume as volumeMalha, verificarFechada, filtrarComponentes, normaisDeVertices } from "../../nucleo/malha.js";
import { aplicarTransformacao, ajustarSimilaridade, comporTransformacoes } from "../../nucleo/alinhamento.js";
import { componenteProxima, preencherBuracos } from "../../nucleo/imagem.js";

export const VERSAO = "0.4";
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], soma = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const esc = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const sstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export const fmt = (v, d = 1) => (v == null || !Number.isFinite(v) ? "—" : Number(v).toFixed(d).replace(".", ","));

// ------------------------------------------------------------------ pontos de referência
export const PONTOS = {
  exD: "Canto externo do olho direito (exocântio D)",
  exE: "Canto externo do olho esquerdo (exocântio E)",
  n: "Násio (raiz do nariz, linha média)",
  sn: "Subnasal (junção do lábio com a columela)",
  enD: "Canto interno do olho direito (endocântio D) — opcional",
  enE: "Canto interno do olho esquerdo (endocântio E) — opcional",
};
export const PONTOS_OBRIGATORIOS = ["exD", "exE", "n", "sn"];
export const faltando = (pontos) => PONTOS_OBRIGATORIOS.filter((k) => !pontos[k]);

// ------------------------------------------------------------------ plano sagital mediano
// normal pela diferença dos pares simétricos; posição pela média dos pontos médios e dos pontos da linha média
export function planoSagital(pontos) {
  const pares = [["exD", "exE"], ["enD", "enE"]].filter(([a, b]) => pontos[a] && pontos[b]);
  if (!pares.length) throw new Error("marque os dois cantos externos dos olhos");
  let n = [0, 0, 0]; for (const [a, b] of pares) n = soma(n, sub(pontos[b], pontos[a]));   // de D para E
  n = norm(n);
  const meios = pares.map(([a, b]) => esc(soma(pontos[a], pontos[b]), 0.5)).concat(["n", "sn"].filter((k) => pontos[k]).map((k) => pontos[k]));
  const d = meios.reduce((s, p) => s + dot(n, p), 0) / meios.length;
  return { n, d };   // n aponta do lado direito para o esquerdo do paciente
}
export const espelhar = (P, p) => { const s = 2 * (dot(P.n, p) - P.d); return [p[0] - s * P.n[0], p[1] - s * P.n[1], p[2] - s * P.n[2]]; };

// Refina o plano pela simetria do rosto (ICP ponto-plano): para cada ponto p da amostra, q = ponto do scan mais
// próximo do espelho de p, com a normal N do scan em q; o plano novo minimiza Σ ((espelho(p) − q)·N)², linearizado em
// torno do atual (2 graus de liberdade na normal + 1 na posição). 20 % dos piores pares ficam fora; o raio de busca
// encolhe de 25 para 6 mm. excluir: [{ c: [x, y, z], r }] — regiões fora da conta (defeito, orelhas).
// → { plano, residuo (mm, RMS ao longo da normal), pares, iteracoes }
export function refinarPlano(malha, plano, { centro, raio = 90, excluir = [], amostras = 2500, iteracoes = 20, busca } = {}) {
  const B = busca || criarBuscaProxima(malha, 4), { V } = malha, nv = V.length / 3;
  plano = { n: norm(plano.n), d: plano.d / Math.hypot(...plano.n) };
  const cand = [];
  for (let i = 0; i < nv; i++) {
    const p = [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]];
    if (centro && dist(p, centro) > raio) continue;
    if (Math.abs(dot(plano.n, p) - plano.d) < 6) continue;   // perto do plano a simetria não informa
    if (excluir.some((e) => dist(p, e.c) < e.r || dist(espelhar(plano, p), e.c) < e.r)) continue;
    cand.push(p);
  }
  if (cand.length < 50) return { plano, residuo: null, pares: cand.length, iteracoes: 0 };
  const passo = Math.max(1, Math.floor(cand.length / amostras)), pts = cand.filter((_, i) => i % passo === 0);
  let P = { n: plano.n.slice(), d: plano.d }, residuo = null, it = 0;
  for (; it < iteracoes; it++) {
    const raioBusca = Math.max(6, 25 - it * 4), pares = [];
    for (const p of pts) { const m = espelhar(P, p), q = B.pontoMaisProximo(m, raioBusca); if (q) pares.push({ p, q: q.p, N: q.n, r: dot(sub(m, q.p), q.n) }); }
    if (pares.length < 30) break;
    pares.sort((a, b) => Math.abs(a.r) - Math.abs(b.r));
    const usa = pares.slice(0, Math.floor(pares.length * 0.8));
    residuo = Math.sqrt(usa.reduce((s, x) => s + x.r * x.r, 0) / usa.length);
    const e1 = norm(Math.abs(P.n[0]) < 0.9 ? cruz(P.n, [1, 0, 0]) : cruz(P.n, [0, 1, 0])), e2 = cruz(P.n, e1);
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bb = [0, 0, 0];
    for (const { p, N, r } of usa) {
      const a = dot(P.n, N), b = dot(P.n, p) - P.d;
      const J = [-2 * (a * dot(e1, p) + b * dot(e1, N)), -2 * (a * dot(e2, p) + b * dot(e2, N)), 2 * a];
      for (let i = 0; i < 3; i++) { bb[i] -= J[i] * r; for (let j = 0; j < 3; j++) A[i][j] += J[i] * J[j]; }
    }
    for (let i = 0; i < 3; i++) A[i][i] += 1e-6 * (A[0][0] + A[1][1] + A[2][2]);
    const x = resolver3x3(A, bb); if (!x) break;
    const n = norm(soma(P.n, soma(esc(e1, x[0]), esc(e2, x[1]))));
    const mud = Math.hypot(x[0], x[1]) * 180 / Math.PI + Math.abs(x[2]);
    P = { n, d: P.d + x[2] };
    if (mud < 1e-3) { it++; break; }
  }
  return { plano: P, residuo, pares: pts.length, iteracoes: it };
}
// sistema linear n × n por eliminação de Gauss com pivô parcial → solução ou null
function resolverN(A, b) {
  const n = b.length, M = A.map((l, i) => Array.from(l).concat([b[i]]));
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (!(Math.abs(M[p][c]) > 1e-12)) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}
function resolver3x3(A, b) {
  const det = (M) => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const D = det(A); if (!(Math.abs(D) > 1e-18)) return null;
  return [0, 1, 2].map((c) => det(A.map((l, i) => l.map((v, j) => (j === c ? b[i] : v)))) / D);
}

// ------------------------------------------------------------------ eixos locais
// tipo "orelha": origem no centro do contorno espelhado (lado do defeito), w lateral (para fora do lado do defeito);
// tipo "nariz": origem no subnasal, v de sn para n, w anterior. → { o, U, V, W }
export function referencial({ tipo, lado, pontos, plano, origem }) {
  const up0 = sub(pontos.n, pontos.sn);
  let W;
  if (tipo === "orelha") {
    W = lado === "D" ? esc(plano.n, -1) : plano.n.slice();
  } else {
    const meio = esc(soma(pontos.exD, pontos.exE), 0.5);
    let a = cruz(plano.n, up0); a = norm(sub(a, esc(plano.n, dot(a, plano.n))));
    W = dot(a, sub(pontos.n, meio)) >= 0 ? a : esc(a, -1);
  }
  const V = norm(sub(up0, esc(W, dot(up0, W)))), U = norm(cruz(V, W));
  return { o: (origem || pontos.sn).slice(), U, V, W: norm(cruz(U, V)) };
}

// ------------------------------------------------------------------ nariz paramétrico
// Padrões a partir do rosto (adulto): largura alar ≈ distância intercantal (cânone neoclássico) ou 0,37 × biocular;
// projeção da ponta ≈ 0,40 × comprimento; ponta a 0,16 × comprimento acima do subnasal; ângulo nasolabial 100°.
export function narizPadrao(pontos) {
  const L = dist(pontos.n, pontos.sn);
  const W = pontos.enD && pontos.enE ? dist(pontos.enD, pontos.enE) : 0.37 * dist(pontos.exD, pontos.exE);
  return { comprimento: +L.toFixed(1), largura: +W.toFixed(1), projecao: +(0.4 * L).toFixed(1), alturaPonta: +(0.16 * L).toFixed(1), nasolabial: 100, dorso: 0, larguraPonta: +(0.5 * W).toFixed(1), narina: 1, profNarina: 10 };
}
// Nariz no referencial do nariz (origem sn, u lateral, v para cima, w anterior), como superfície de altura sobre o
// rosto: w ≤ topo(u, v), cortada pela base (columela e soleira das narinas, inclinada pelo ângulo nasolabial; as bordas
// das asas um pouco acima da columela) e pela raiz. topo = máximo suave de três partes:
//   corpo (dorso e paredes laterais): perfil D(v) na linha média, base de meia-largura b(v) que alarga da raiz para baixo
//     (pirâmide, não tubo), seção arredondada no dorso;
//   lóbulo da ponta: cúpula elíptica de largura larguraPonta, centrada na altura da ponta;
//   asas: lobos ovais arredondados (um pouco mais largos que altos), com o sulco alar onde encontram o lóbulo e
//     queda íngreme para o rosto (sulco alar-facial).
// Todas as partes têm inclinação contínua na borda (sem quinas, que apareciam como vincos na luz); fora da pegada a
// descida vai ficando forte (até 3,5 : 1): ao lado do nariz a forma fica abaixo da bochecha e a
// pegada é a do nariz, não a da caixa de trabalho. As narinas ficam à parte (narinasParametricas).
const QUEDA = 3.5;   // inclinação fora da pegada (mm de descida por mm para fora)
// Descida fora da borda de uma parte, a d mm da borda, partindo da inclinação s1 que a parte tem na borda: a inclinação
// cresce aos poucos (2 mm) até QUEDA. Sem quina na borda: a quina aparecia como um vinco ao longo da parede do nariz.
function descida(d, s1) {
  if (s1 >= QUEDA) return -s1 * d;
  const c = (QUEDA - s1) / 4;
  return d < 2 ? -(s1 * d + c * d * d) : -(s1 * 2 + c * 4) - QUEDA * (d - 2);
}
// cúpula elíptica de altura H e semieixos a, b (mm), perfil parabólico: H·(1 − r²) dentro e descida() fora, com a
// mesma inclinação na borda (2·H·|∇r|)
function cupula(x, y, a, b, H) {
  const r = Math.hypot(x / a, y / b);
  if (r < 1) return H * (1 - r * r);
  const g = Math.hypot(x / (a * a), y / (b * b)) / r || 1 / Math.max(a, b);
  return descida((r - 1) / g, 2 * H * g);
}
export function narizTopo(p) {
  const L = p.comprimento, W = p.largura, P = p.projecao, vt = Math.min(p.alturaPonta, 0.4 * L), r0 = 1.5, Rt = Math.max(4, 0.14 * L);
  const Wt = Math.min(p.larguraPonta || 0.5 * W, 0.8 * W);
  // corpo: meia-largura da base da raiz (0,17 W) até o terço inferior (0,29 W): dorso estreito em cima, abrindo para as asas
  const bR = 0.17 * W, bB = 0.29 * W, vB = 0.3 * L;
  const D = (v) => {
    if (v >= vt) { const s = (L - v) / (L - vt); return r0 + (P - r0) * s + (p.dorso || 0) * 4 * s * (1 - s); }
    return P - ((vt - v) * (vt - v)) / (2 * Rt);
  };
  const b = (v) => (v >= vB ? bB + (bR - bB) * sstep((v - vB) / (L - vB)) : bB);
  // lóbulo e asas (cúpulas)
  const ru = 0.62 * Wt, rvL = 0.22 * L, rzL = 0.55 * P, vL = vt - 0.5;
  const rau = 0.22 * W, ua = W / 2 - 0.85 * rau, rav = 0.19 * L, va = 0.13 * L, Ha = 0.56 * P;
  const forma = (dl) => function (u, v) {
    const vv = Math.min(L + 3, v), au = Math.abs(u), bv = b(vv), x = au / bv, Dv = Math.max(0, D(vv) - dl * sstep(1 - Math.abs(vv - vt) / (0.4 * L)));
    // seção do corpo: 1 − x^1,8 (dorso arredondado, paredes quase retas); fora, descida() a partir da mesma inclinação
    const corpo = x < 1 ? Dv * (1 - Math.pow(x, 1.8)) : descida(au - bv, (1.8 * Dv) / bv);
    const lob = P - dl - rzL + cupula(u, v - vL, ru, rvL, rzL);
    const asa = cupula(au - ua, v - va, rau, rav, Ha);
    return -Vo.uniaoSuave(Vo.uniaoSuave(-corpo, -lob, 5), -asa, 7);
  };
  // o máximo suave soma um pouco onde o corpo e o lóbulo se encontram: baixa os dois perto da ponta até a projeção
  // ficar igual à pedida (duas iterações bastam)
  const pico = (f) => { let m = -Infinity; for (let v = 0; v <= 0.5 * L; v += 0.25) m = Math.max(m, f(0, v)); return m; };
  let dl = 0; for (let i = 0; i < 3; i++) dl += pico(forma(dl)) - P;
  return forma(dl);
}
// máximo suave (raio r, mm): arredonda a quina entre duas formas que se cortam
const maxSuave = (a, b, r) => -Vo.uniaoSuave(-a, -b, r);
// Base do nariz (por baixo): altura v da base em cada (u, w).
//   columela: a parte mais baixa, na linha média, pelo ângulo nasolabial (sobe 10° para a frente em 100°);
//   bordas das asas: até 1,2 mm acima da columela, subindo aos poucos para os lados (de perfil a columela aparece um pouco abaixo da asa);
//   pé da columela: atrás, a base desce em curva até o lábio;
//   ponta: na frente (w > 0,55 P) a base curva para cima e encontra o lóbulo sem quina (ângulo columela-lóbulo).
function alturaBase(p, u, w) {
  const W = p.largura, P = p.projecao, tg = Math.tan(((p.nasolabial - 90) * Math.PI) / 180), f = Math.max(0, w - 0.55 * P);
  // junção columela-lábio: atrás (w < 0,3 P) e no meio, a base desce até 3 mm em curva para encontrar o lábio
  // (cobre o que houver de pele saliente no subnasal, em vez de a aba desenhar uma bolinha por cima)
  const pe = 3 * (1 - sstep(w / (0.3 * P))) * (1 - sstep(Math.abs(u) / (0.16 * W)));
  return tg * w + 1.2 * sstep((Math.abs(u) - 0.14 * W) / (0.2 * W)) + 0.035 * f * f - pe;
}
// campo do nariz (distância aproximada: altura normalizada pela inclinação, base e raiz); o encontro da base com a
// superfície de fora é arredondado (raio 1,8 mm): bordas das asas, columela e ponta sem fio
export function narizParametrico(p) {
  const topo = narizTopo(p), L = p.comprimento, ca = Math.cos(((p.nasolabial - 90) * Math.PI) / 180), e = 0.25;
  return function (u, v, w) {
    const t = topo(u, v), gu = (topo(u + e, v) - topo(u - e, v)) / (2 * e), gv = (topo(u, v + e) - topo(u, v - e)) / (2 * e);
    // o corte da base vale só dentro da largura das asas: do lado de fora (rampa até a bochecha) a forma desce direto
    // até a pele, e a asa termina no sulco alar-facial em curva, sem prateleira nos cantos
    const fora = Math.max(0, Math.abs(u) - (p.largura / 2 - 1));
    return Math.max(maxSuave((w - t) / Math.sqrt(1 + gu * gu + gv * gv), (alturaBase(p, u, w) - v) * ca - 2 * fora * fora, 1.8), v - (L + 3));
  };
}
// malha fechada do nariz paramétrico no referencial do nariz, cortada a 40 mm atrás do subnasal (dentro do rosto);
// a grade vai até onde o topo já desceu abaixo do corte (sem paredes da caixa)
export function malhaNariz(p, passo = 0.4) {
  const f = narizParametrico(p), W = p.largura, L = p.comprimento, P = p.projecao, m = 40 / QUEDA + 2;
  const g = Vo.criarGrade([-W / 2 - m, -8, -40], [W / 2 + m, L + 6, P + 4], passo);
  Vo.preencherGrade(g, (u, v, w) => Math.max(f(u, v, w), -40 + passo - w, Math.abs(u) - (W / 2 + m - passo)));
  return decimar(Vo.extrairSuperficie(g), { tolerancia: 0.01 });
}
// Contorno de uma narina vista de baixo, no plano (u, w), lado direito (u > 0): gota com a ponta fina para a frente e
// para a linha média (rumo à ponta do nariz) e a parte larga atrás e para fora (junto da base da asa).
// → polígono [[u, w], …]
export function contornoNarina(p) {
  const W = p.largura, P = p.projecao, k = p.narina || 1;
  const tras = [0.2 * W, 0.17 * P], frente = [0.1 * W, 0.17 * P + 0.55 * P * k];   // eixo da gota
  const ex = [frente[0] - tras[0], frente[1] - tras[1]], comp = Math.hypot(ex[0], ex[1]), d = [ex[0] / comp, ex[1] / comp], nrm = [d[1], -d[0]];
  const larg = 0.155 * W * k, pts = [];
  // meia-largura ao longo do eixo (t de 0 atrás a 1 na frente): cheia em t ≈ 0,3, afinando para a frente
  const meia = (t) => (t < 0.3 ? Math.sqrt(Math.max(0, 1 - ((0.3 - t) / 0.3) ** 2)) : 1 - 0.75 * sstep((t - 0.3) / 0.7)) * larg / 2;
  const N = 24;
  for (let i = 0; i <= N; i++) { const t = i / N, a = meia(t); pts.push([tras[0] + ex[0] * t + nrm[0] * a, tras[1] + ex[1] * t + nrm[1] * a]); }
  for (let i = N - 1; i >= 1; i--) { const t = i / N, a = meia(t); pts.push([tras[0] + ex[0] * t - nrm[0] * a, tras[1] + ex[1] * t - nrm[1] * a]); }
  return pts;
}
// narinas: a gota de contornoNarina aberta na base e subindo profNarina para dentro do nariz (vestíbulo), com o fundo
// arredondado e as paredes abrindo um pouco para cima; ficam a pelo menos 2 mm da superfície de fora
export function narinasParametricas(p) {
  const prof = p.profNarina || 10, topo = narizTopo(p), dir = contornoNarina(p), esq = dir.map(([u, w]) => [-u, w]);
  return function (u, v, w) {
    const h = v - alturaBase(p, u, w);   // altura acima da base
    const f2 = Vo.distanciaPoligono(u, w, u >= 0 ? dir : esq) - 0.12 * Math.max(0, Math.min(h, prof - 2));
    const q = h - prof, f = Math.hypot(Math.max(f2, 0), Math.max(q, 0)) + Math.min(Math.max(f2, q), 0);
    if (f > 3) return f;   // longe da narina: não precisa da parede
    // parede de pelo menos 2 mm até a superfície de fora, medida na perpendicular (na vertical, nas paredes inclinadas,
    // o topo da narina chegava a marcar a pele de fora)
    const e = 0.25, t = topo(u, v), gu = (topo(u + e, v) - topo(u - e, v)) / (2 * e), gv = (topo(u, v + e) - topo(u, v - e)) / (2 * e);
    return maxSuave(f, 2 - (t - w) / Math.sqrt(1 + gu * gu + gv * gv), 1);
  };
}

// ------------------------------------------------------------------ escultura
// O ajuste à mão é um campo d(u, v) em mm (para fora +, para dentro −) numa grade no plano local (u, v), feito de traços
// aplicados em ordem; a doadora é deslocada ao longo da sua normal por d. Assim a escultura vale para qualquer forma
// (espelho, paramétrica ou modelo) e a prótese e o molde saem de novo, fechados, a partir dela.
// escultura: { o: [u0, v0], h, nx, ny, tracos: [[{ t: "+" | "-" | "s", u, v, r, f }, …] (um gesto), …] }
export const ESCULTURA_PASSO = 0.5;
export function gradeEscultura(o, nx, ny, h = ESCULTURA_PASSO) { return { o: o.slice(), h, nx, ny, d: new Float32Array(nx * ny) }; }
// aplica um toque do pincel no campo (altera c.d); devolve a caixa [i0, i1, j0, j1] alterada
export function aplicarToque(c, k) {
  const { o, h, nx, ny, d } = c, R = k.r;
  // núcleo (1 − ρ²/R²)³: 1 no centro, zero com derivadas nulas na borda (sem degrau no limite do pincel)
  const nucleo = (x, y) => { const q = 1 - ((x - k.u) ** 2 + (y - k.v) ** 2) / (R * R); return q > 0 ? q * q * q : 0; };
  const i0 = Math.max(0, Math.floor((k.u - R - o[0]) / h)), i1 = Math.min(nx - 1, Math.ceil((k.u + R - o[0]) / h));
  const j0 = Math.max(0, Math.floor((k.v - R - o[1]) / h)), j1 = Math.min(ny - 1, Math.ceil((k.v + R - o[1]) / h));
  if (i1 < i0 || j1 < j0) return null;
  if (k.t === "s") {   // suavizar: aproxima da média da vizinhança (≈ 1,5 mm), com o peso do pincel
    const viz = Math.max(1, Math.round(1.5 / h)), copia = d.slice();
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const g = nucleo(o[0] + i * h, o[1] + j * h); if (!g) continue;
      let sm = 0, n = 0; for (let b = -viz; b <= viz; b++) for (let a = -viz; a <= viz; a++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < nx && jj < ny) { sm += copia[ii + nx * jj]; n++; } }
      d[i + nx * j] = copia[i + nx * j] + Math.min(1, k.f) * g * (sm / n - copia[i + nx * j]);
    }
  } else {
    const sinal = k.t === "-" ? -1 : 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) d[i + nx * j] += sinal * k.f * nucleo(o[0] + i * h, o[1] + j * h);
  }
  return [i0, i1, j0, j1];
}
// campo completo a partir dos traços
export function campoEscultura(esc) {
  const c = gradeEscultura(esc.o, esc.nx, esc.ny, esc.h || ESCULTURA_PASSO);
  for (const gesto of esc.tracos || []) for (const k of gesto) aplicarToque(c, k);
  return c;
}
// valor do campo em (u, v) (bilinear; fora da grade, 0)
export function valorEscultura(c, u, v) {
  const a = (u - c.o[0]) / c.h, b = (v - c.o[1]) / c.h;
  if (!(a >= 0 && b >= 0 && a <= c.nx - 1 && b <= c.ny - 1)) return 0;
  const i = Math.min(c.nx - 2, Math.floor(a)), j = Math.min(c.ny - 2, Math.floor(b)), x = a - i, y = b - j, q = i + c.nx * j, d = c.d;
  return (d[q] * (1 - x) + d[q + 1] * x) * (1 - y) + (d[q + c.nx] * (1 - x) + d[q + c.nx + 1] * x) * y;
}
// malha local deslocada ao longo da normal (para fora) por d(u, v); a orientação da normal é conferida pela média
// de w na região esculpida (pele e forma doadora olham para +w), o que cobre a malha espelhada (faces invertidas)
export function esculpirMalha(m, c) {
  const N = normaisDeVertices(m.V, m.F), V = Float64Array.from(m.V);
  let soma = 0;
  for (let i = 0; i < V.length; i += 3) { const d = valorEscultura(c, V[i], V[i + 1]); if (d !== 0) soma += N[i + 2] * Math.abs(d); }
  const s = soma < 0 ? -1 : 1;
  for (let i = 0; i < V.length; i += 3) { const d = valorEscultura(c, V[i], V[i + 1]); if (d) { V[i] += s * N[i] * d; V[i + 1] += s * N[i + 1] * d; V[i + 2] += s * N[i + 2] * d; } }
  return { V, F: m.F };
}

// ------------------------------------------------------------------ prótese
export const PARAMETROS_PADRAO = {
  // filete: sob a parte solta da doadora, a aba entra até esta distância da raiz (fecha a ponta do sulco atrás da orelha,
  // sem cunha fina de ar); no nariz fica 0 (taparia o fundo das narinas)
  orelha: { passo: 0.5, aba: 8, bordaEsp: 0.3, baseEsp: 1.5, raioUniao: 1.5, oco: false, parede: 3, filete: 3 },
  nariz: { passo: 0.5, aba: 3, bordaEsp: 0.3, baseEsp: 1.2, raioUniao: 2, oco: true, parede: 3, filete: 0 },
};
export const MOLDE_PADRAO = { parede: 8, base: 6, topo: 6, dividir: true, anguloDivisao: 90, deslocDivisao: 0, chaveRaio: 2.5, folga: 0.2, canal: 4, respiro: 1.5, respiros: 2, tolerancia: 0.03 };

const FOLGA_PELE = 0.6, VAO_RAIZ = 1;
const caixaDe = (pts) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (const p of pts) for (let q = 0; q < 3; q++) { lo[q] = Math.min(lo[q], p[q]); hi[q] = Math.max(hi[q], p[q]); } return { lo, hi }; };

// Ajuste manual da doadora (no referencial local): deslocamento (du, dv, dw), giro em torno de w (graus) e escala (%),
// em torno do centro c (u, v). → função p → p'
export function ajusteLocal(aj, c = [0, 0]) {
  const a = (((aj && aj.giro) || 0) * Math.PI) / 180, s = ((aj && aj.escala) || 100) / 100, ca = Math.cos(a), sa = Math.sin(a);
  const d = [(aj && aj.du) || 0, (aj && aj.dv) || 0, (aj && aj.dw) || 0];
  return (x, y, z) => { const X = x - c[0], Y = y - c[1]; return [c[0] + s * (ca * X - sa * Y) + d[0], c[1] + s * (sa * X + ca * Y) + d[1], s * z + d[2]]; };
}

// Gera a prótese. entrada:
//   tipo "orelha" | "nariz", lado ("D"/"E", orelha), malha (scan soldado { V, F }, em mm), pontos, plano,
//   contorno (orelha espelhada: pontos 3D no lado sadio), doadora: { tipo: "espelho" | "parametrico" | "modelo",
//   nariz (parâmetros), modelo ({ V, F } já no referencial do scan), ajuste }, imas: [{ p: [x,y,z] }], imaDiam, imaProf,
//   parametros (PARAMETROS_PADRAO), aoProgresso(texto, fração).
// → { R, grade (só dimensões), fP, sH, pele, regiao, malha (prótese), medidas, avisos }
export async function gerarProtese(e) {
  const prog = e.aoProgresso || (async () => {}), par = Object.assign({}, PARAMETROS_PADRAO[e.tipo], e.parametros || {}), h = par.passo;
  const avisos = [];
  const doa = e.doadora || { tipo: e.tipo === "orelha" ? "espelho" : "parametrico" };
  // referencial e região (u, v)
  let R, poligono = null, regiaoUV;
  if (e.tipo === "orelha" && doa.tipo === "espelho") {
    if (!e.contorno || e.contorno.length < 5) throw new Error("marque pelo menos 5 pontos em volta da orelha sadia");
    const esp = e.contorno.map((p) => espelhar(e.plano, p)), c = esc(esp.reduce((s, p) => soma(s, p), [0, 0, 0]), 1 / esp.length);
    R = referencial({ tipo: "orelha", lado: e.lado, pontos: e.pontos, plano: e.plano, origem: c });
    poligono = esp.map((p) => paraLocal(R, p).slice(0, 2));
    regiaoUV = caixaDe(poligono.map((q) => [q[0], q[1], 0]));
  } else if (e.tipo === "orelha") {
    const pts = (e.contorno || []).slice();
    const c = pts.length ? esc(pts.reduce((s, p) => soma(s, p), [0, 0, 0]), 1 / pts.length) : null;
    R = referencial({ tipo: "orelha", lado: e.lado, pontos: e.pontos, plano: e.plano, origem: c || modeloCentro(doa.modelo) });
  } else R = referencial({ tipo: "nariz", pontos: e.pontos, plano: e.plano });
  await prog("Preparando o scan…", 0.05);
  const ajc = [0, 0];   // centro do giro e da escala: a origem local (centro do contorno na orelha, subnasal no nariz)
  const aj = ajusteLocal(doa.ajuste, ajc);
  // doadora no referencial local (vértices) ou campo analítico
  const scanL = { V: transformarVertices(e.malha.V, (x, y, z) => paraLocal(R, [x, y, z])), F: e.malha.F };
  let doadoraL = null, narinas = null, nz = null;
  if (doa.tipo === "espelho") doadoraL = { V: transformarVertices(e.malha.V, (x, y, z) => { const q = paraLocal(R, espelhar(e.plano, [x, y, z])); return aj(q[0], q[1], q[2]); }), F: e.malha.F };
  else if (doa.tipo === "modelo") doadoraL = { V: transformarVertices(doa.modelo.V, (x, y, z) => { const q = paraLocal(R, [x, y, z]); return aj(q[0], q[1], q[2]); }), F: doa.modelo.F };
  else {
    nz = Object.assign(narizPadrao(e.pontos), doa.nariz || {});
    const fnN = narinasParametricas(nz), inv = ajusteInverso(doa.ajuste, ajc);
    narinas = (x, y, z) => { const q = inv(x, y, z); return fnN(q[0], q[1], q[2]); };
    // o nariz vira malha (fechada, cortada atrás, dentro do rosto) e o campo sai das distâncias exatas a ela, como num
    // modelo importado: a distância aproximada da fórmula erraria nos vales (sulco alar) e o oco furaria a parede
    const malhaN = malhaNariz(nz, Math.min(h, 0.4));
    doadoraL = { V: transformarVertices(malhaN.V, (x, y, z) => aj(x, y, z)), F: malhaN.F };
  }
  // escultura (ajuste à mão na tela): desloca a doadora ao longo da normal pelo campo esculpido
  if (e.escultura && e.escultura.tracos && e.escultura.tracos.length) doadoraL = esculpirMalha(doadoraL, campoEscultura(e.escultura));
  // extensão da região em (u, v)
  if (!regiaoUV) {
    if (nz) regiaoUV = { lo: [-nz.largura / 2 - 4, -5, 0], hi: [nz.largura / 2 + 4, nz.comprimento + 4, 0] };
    else if (e.tipo === "nariz") {   // modelo de nariz (pode ser um scan inteiro com o nariz): a região vem das proporções do rosto
      const pd = narizPadrao(e.pontos);
      regiaoUV = { lo: [-pd.largura / 2 - 6, -8, 0], hi: [pd.largura / 2 + 6, pd.comprimento + 6, 0] };
    }
    else { const pts = []; for (let i = 0; i < doadoraL.V.length; i += 3) pts.push([doadoraL.V[i], doadoraL.V[i + 1], 0]); regiaoUV = caixaDe(pts); }
  }
  const mold = Object.assign({}, MOLDE_PADRAO, e.molde || {});
  const margem = par.aba + mold.parede + 4;
  const lo = [regiaoUV.lo[0] - margem, regiaoUV.lo[1] - margem], hi = [regiaoUV.hi[0] + margem, regiaoUV.hi[1] + margem];
  // altura (w) da pele na região: a superfície mais externa de cada célula 2D de 2 mm (o outro lado da cabeça não conta)
  let wmin = Infinity, wmax = -Infinity, dmax = -Infinity;
  const V0 = scanL.V, bin = 2, nbu = Math.ceil((hi[0] - lo[0]) / bin) + 1, nbv = Math.ceil((hi[1] - lo[1]) / bin) + 1, topoBin = new Float64Array(nbu * nbv).fill(-Infinity);
  for (let i = 0; i < V0.length; i += 3) if (V0[i] >= lo[0] && V0[i] <= hi[0] && V0[i + 1] >= lo[1] && V0[i + 1] <= hi[1]) { const b = Math.floor((V0[i] - lo[0]) / bin) + nbu * Math.floor((V0[i + 1] - lo[1]) / bin); if (V0[i + 2] > topoBin[b]) topoBin[b] = V0[i + 2]; }
  // células sem vértice do lado de cá (triângulos grandes) mostrariam o outro lado: fica fora o que está a mais de
  // 40 mm abaixo da mediana
  const cheias = Array.from(topoBin).filter((x) => x > -Infinity).sort((a, b) => a - b);
  if (!cheias.length) throw new Error("o scan não cobre a região da prótese");
  const mediana = cheias[cheias.length >> 1];
  for (const x of cheias) if (x > mediana - 40) { wmin = Math.min(wmin, x); wmax = Math.max(wmax, x); }
  { const D = doadoraL.V; for (let i = 0; i < D.length; i += 3) { const u = D[i], v = D[i + 1]; if (u >= lo[0] && u <= hi[0] && v >= lo[1] && v <= hi[1] && (poligono ? Vo.distanciaPoligono(u, v, poligono) < 2 : true)) dmax = Math.max(dmax, D[i + 2]); } }
  // o fundo da grade fica abaixo da pele mais funda da região (a base do molde precisa caber)
  const zLo = wmin - mold.base - 3 * h - 2, zHi = Math.max(dmax, wmax) + mold.topo + 3 * h + 2;
  if (zHi - zLo > 160) avisos.push({ n: "atenção", t: `A região de trabalho tem ${fmt(zHi - zLo, 0)} mm de profundidade: confira os pontos e o contorno.` });
  const g = Vo.criarGrade([lo[0], lo[1], zLo], [hi[0], hi[1], zHi], h);
  const NC = g.nx * g.ny, N = NC * g.nz;
  await prog(`Pele: campo de distância (${(N / 1e6).toFixed(1)} milhões de células)…`, 0.15);
  const bandaPele = Math.max(3, par.baseEsp + par.raioUniao + 2 * h);
  const caixaMin = [g.o[0] - 4, g.o[1] - 4, g.o[2] - 4], caixaMax = [g.o[0] + g.nx * h + 4, g.o[1] + g.ny * h + 4, g.o[2] + g.nz * h + 4];
  const rH = Vo.campoDeMalha(g, Vo.triangulosNaCaixa(scanL, caixaMin, caixaMax), { banda: bandaPele, final: "dentro" });
  const sH = Float32Array.from(rH.f);
  const cobertura = rH.comSuperficie / NC;
  if (rH.reparadas / NC > 0.15) avisos.push({ n: "atenção", t: `${fmt((100 * rH.reparadas) / NC, 0)} % das colunas da região foram completadas por vizinhança (furos ou bordas do scan). Confira a base do molde.` });
  // doadora
  await prog("Forma doadora…", 0.35);
  const bandaD = Math.max(3, (par.oco ? par.parede : 0) + 2 * h + 1);
  const sD = new Float32Array(N);
  if (doadoraL) {
    const gd = Object.assign({}, g, { f: sD });
    Vo.campoDeMalha(gd, Vo.triangulosNaCaixa(doadoraL, caixaMin, caixaMax), { banda: bandaD, final: doa.tipo === "espelho" ? "dentro" : "livre" });
  }
  // pele por coluna (primeira saída de dentro da cabeça, de baixo para cima)
  const pele = new Float32Array(NC);
  for (let c = 0; c < NC; c++) {
    let s = g.o[2];
    for (let k = 1; k < g.nz; k++) { const a = sH[c + NC * (k - 1)], b = sH[c + NC * k]; if (a < 0 && b >= 0) { s = g.o[2] + (k - 1 + a / (a - b)) * h; break; } if (k === g.nz - 1) s = a < 0 ? g.o[2] + (g.nz - 1) * h : g.o[2]; }
    pele[c] = s;
  }
  // região: polígono (orelha espelhada) ou pegada automática da doadora acima da pele
  const regiao = new Float32Array(NC);
  if (poligono) { for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) regiao[i + g.nx * j] = Vo.distanciaPoligono(g.o[0] + i * h, g.o[1] + j * h, poligono); }
  else {
    // modelo importado (um scan com o nariz, p.ex.): fora do nariz ele coincide com a pele a menos do ruído dos dois
    // scans; só conta o que fica claramente acima (0,8 mm) e só a parte ligada ao nariz, sem buracos
    const lim = doa.tipo === "modelo" ? 0.8 : 0.3;
    let mask = new Uint8Array(NC);
    for (let c = 0; c < NC; c++) for (let k = 0; k < g.nz; k++) { const q = c + NC * k; if (sD[q] < 0 && sH[q] > lim) { mask[c] = 1; break; } }
    if (!mask.some((x) => x)) throw new Error("a forma doadora não aparece acima da pele: confira o alinhamento e os pontos");
    if (e.tipo === "nariz") {
      const cn = paraLocal(R, soma(esc(e.pontos.n, 0.3), esc(e.pontos.sn, 0.7)));
      mask = preencherBuracos(componenteProxima(mask, g.nx, g.ny, (cn[0] - g.o[0]) / h, (cn[1] - g.o[1]) / h), g.nx, g.ny);
    }
    regiao.set(Vo.distanciaMascara2D(mask, g.nx, g.ny, h));
  }
  // raiz: colunas em que a doadora encosta na pele (a aba nasce dali, para fora); onde a doadora passa acima da pele sem
  // encostar (atrás da orelha) não há aba, senão o molde ficaria preso entre a aba e a orelha
  // vão = distância à pele (normal, não vertical: a pele pode ser íngreme) do ponto mais baixo da doadora; até
  // VAO_RAIZ conta como raiz (a aba, mais grossa, o preenche: é o encontro em ângulo agudo da parede do nariz com a
  // bochecha); acima disso é parte solta (pendente)
  // (só conta a doadora além da folga da pele: a pele espelhada, colada à real, não é raiz)
  const raiz = new Uint8Array(NC), acima = new Uint8Array(NC), vaoRaiz = FOLGA_PELE + VAO_RAIZ + h;
  for (let c = 0; c < NC; c++) {
    if (regiao[c] > 0) continue;
    for (let k = 0; k < g.nz; k++) { const q = c + NC * k; if (sD[q] < 0 && sH[q] > FOLGA_PELE) { if (sH[q] <= vaoRaiz) raiz[c] = 1; else acima[c] = 1; break; } }
  }
  if (!raiz.some((x) => x)) throw new Error("a forma doadora não encosta na pele: confira o alinhamento, o contorno e os pontos");
  const dAba = Vo.distanciaMascara2D(raiz, g.nx, g.ny, h);
  // assimetria: perto do contorno (por dentro), quanto a pele espelhada fica acima da pele real
  // (mediana numa faixa de 2,5 mm por dentro do contorno: as colunas em que a orelha chega perto do contorno não pesam)
  let degrau = 0;
  if (poligono) {
    const difs = [];
    for (let c = 0; c < NC; c++) {
      if (!(regiao[c] > -3 && regiao[c] < -0.5)) continue;
      for (let k = 1; k < g.nz; k++) if (sD[c + NC * (k - 1)] < 0 && sD[c + NC * k] >= 0) { difs.push(g.o[2] + k * h - pele[c]); break; }
    }
    if (difs.length) { difs.sort((a, b) => a - b); degrau = difs[difs.length >> 1]; }
  }
  // ímãs: cilindros ao longo de w a partir da pele
  // modelo de nariz importado: narinas em gota pela base do próprio modelo (o scanner quase não vê dentro delas)
  if (e.tipo === "nariz" && doa.tipo === "modelo" && doa.narinas !== false) narinas = narinasDoModelo(g, sD, regiao, e.pontos, R, doa);
  const imas = (e.imas || []).map((m) => { const q = paraLocal(R, m.p); const i = Math.round((q[0] - g.o[0]) / h), j = Math.round((q[1] - g.o[1]) / h); const w0 = i >= 0 && j >= 0 && i < g.nx && j < g.ny ? pele[i + g.nx * j] : q[2]; return { u: q[0], v: q[1], w0 }; });
  const rI = (e.imaDiam || 6) / 2, pI = e.imaProf || 3;
  // armação de óculos (nariz): assento da ponte e nichos de ímãs na face de fora, tirados da doadora (o oco acompanha)
  const oculos = e.oculos && e.oculos.pontos && e.oculos.pontos.length === 2 ? assentoOculos(g, sD, R, e.oculos) : null;
  if (oculos) avisos.push(...oculos.avisos);
  if (oculos && par.oco && oculos.prof + (oculos.imas ? oculos.imaProf : 0) > par.parede - 1) avisos.push({ n: "atenção", t: `Assento de ${fmt(oculos.prof, 1)} mm${oculos.imas ? ` e nichos de ${fmt(oculos.imaProf, 1)} mm` : ""} numa prótese oca de parede ${fmt(par.parede, 1)} mm: o oco recua junto, mas confira a espessura atrás dos ímãs.` });
  // campo da prótese
  await prog("Prótese: combinação das formas…", 0.55);
  const fP = g.f, La = par.aba, t0 = par.baseEsp, tb = par.bordaEsp, tMin = 1.8 * h;
  // oco (nariz): a parte de dentro da doadora a mais de "parede" da superfície, longe da borda da base (anel maciço), e
  // estendido em linha reta até a pele: sem cunhas finas entre o oco e a pele (viravam furinhos) e sem retenção no molde
  let ocoFundo = null;
  if (par.oco) {
    ocoFundo = new Float32Array(NC).fill(Infinity);
    for (let c = 0; c < NC; c++) {
      if (!(dAba[c] < -par.parede)) continue;
      for (let k = 0; k < g.nz; k++) { const q = c + NC * k; if (sD[q] + par.parede < 0 && sH[q] > 0) { ocoFundo[c] = g.o[2] + k * h; break; } }
    }
  }
  for (let k = 0; k < g.nz; k++) {
    const w = g.o[2] + k * h;
    for (let j = 0; j < g.ny; j++) {
      const v = g.o[1] + j * h;
      for (let i = 0; i < g.nx; i++) {
        const c = i + g.nx * j, q = c + NC * k, u = g.o[0] + i * h, d2 = regiao[c], sh = sH[q], da = dAba[c];
        const t = Math.max(tMin, da <= 0 ? t0 : tb + (t0 - tb) * (1 - sstep(da / La)));
        const fAba = acima[c] && da > par.filete ? 1e3 : Math.max(-sh, sh - t, da - La, -da - 1.5);
        // fora da raiz, a doadora só conta onde fica claramente acima da pele real (espelho ≈ pele deixaria uma película
        // rasgada); na raiz ela assenta direto na pele (sem a folga ficaria uma lâmina de ar fina sob a prótese)
        let f = Vo.uniaoSuave(Math.max(sD[q], d2, (raiz[c] ? 0 : FOLGA_PELE) - sh), fAba, par.raioUniao);
        if (ocoFundo) { const hb = ocoFundo[c]; if (hb < Infinity) f = Math.max(f, -Math.min(sD[q] + par.parede, w - hb)); }
        if (narinas) { const na = narinas(u, v, w, q); if (na < 3) f = maxSuave(f, -(par.oco ? na : Math.max(na, 1.2 - sh)), 0.8); }   // no nariz maciço a narina não fura a pele (fica cega); no oco ela se abre no oco, sem deixar ilhas junto da pele
        for (const m of imas) f = Math.max(f, -Math.max(Math.hypot(u - m.u, v - m.v) - rI, m.w0 - 1 - w, w - (m.w0 + pI)));
        fP[q] = Math.max(f, -sh);
      }
    }
  }
  // borda: a grade tem de ficar "fora" nas faces laterais e no topo
  await prog("Prótese: superfície…", 0.75);
  let malha = Vo.extrairSuperficie(g);
  if (!malha.F.length) throw new Error("a prótese ficou vazia: confira a forma doadora, o contorno e o alinhamento");
  const borda = { g: { nx: g.nx, ny: g.ny, o: g.o, h }, pele, dAba, permitida: Uint8Array.from(raiz, (r, c) => (acima[c] && dAba[c] > par.filete ? 0 : 1)), La, t0, tb, tMin };
  afinarBorda(malha, borda);
  const fc = filtrarComponentes(malha.V, malha.F, 0.02);   // descarta lascas soltas (poucos triângulos)
  malha = decimar({ V: fc.V, F: fc.F }, { tolerancia: 0.01 });
  const med = medirProtese(g, fP, pele, regiao, malha, { tipo: e.tipo, nariz: nz, par });
  med.degrauContorno = degrau;
  if (med.limiteGrade) avisos.push({ n: "alerta", t: "A prótese encosta na borda da região de trabalho: o contorno ou a forma doadora estão grandes demais ou mal posicionados." });
  if (tb < 0.2) avisos.push({ n: "atenção", t: `Borda de ${fmt(tb, 2)} mm: abaixo de 0,2 mm o silicone rasga com facilidade ao descolar o adesivo.` });
  if (poligono && Math.abs(med.degrauContorno) > 2) avisos.push({ n: "atenção", t: `A pele espelhada fica, em média, ${fmt(med.degrauContorno, 1)} mm acima da pele real junto ao contorno (assimetria): pode sobrar material na base da orelha. Ajuste o contorno rente à orelha ou desloque a orelha (w).` });
  if (cobertura < 0.5) avisos.push({ n: "atenção", t: `O scan cobre só ${fmt(100 * cobertura, 0)} % da região de trabalho.` });
  return { R, g: { nx: g.nx, ny: g.ny, nz: g.nz, o: g.o, h }, fP, sH, pele, regiao, raiz, borda, poligono, malha, medidas: med, avisos, nariz: nz, parametros: par, cobertura, reparadas: rH.reparadas };
}
// Narinas num modelo de nariz importado. A base de referência é a face de baixo do próprio modelo: em cada coluna (u, w)
// da grade, a menor altura v em que ele começa; a largura entre as asas sai da pegada perto da base (v de 5 a 20 % do
// comprimento n–sn) e a projeção, do ponto mais à frente. O contorno é o mesmo da narina paramétrica (contornoNarina)
// e a parede até a superfície de fora (pela distância à doadora, sD) fica com pelo menos 2 mm.
function narinasDoModelo(g, sD, regiao, pontos, R, doa) {
  const { nx, ny, nz, o, h } = g, NC = nx * ny, L = dist(pontos.n, pontos.sn);
  const base = new Float32Array(nx * nz).fill(Infinity);
  let proj = 0;
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) { const c = i + nx * j; if (regiao[c] <= 0 && sD[c + NC * k] < 0) { base[i + nx * k] = o[1] + j * h; break; } }
  }
  for (let c = 0; c < NC; c++) if (regiao[c] <= 0) for (let k = nz - 1; k >= 0; k--) if (sD[c + NC * k] < 0) { proj = Math.max(proj, o[2] + k * h); break; }
  const larg = [];
  for (let j = 0; j < ny; j++) {
    const v = o[1] + j * h; if (v < 0.05 * L || v > 0.2 * L) continue;
    let a = Infinity, b = -Infinity; for (let i = 0; i < nx; i++) if (regiao[i + nx * j] <= 0) { const u = o[0] + i * h; a = Math.min(a, u); b = Math.max(b, u); }
    if (b > a) larg.push(b - a);
  }
  if (!larg.length || !(proj > 5)) return null;
  larg.sort((x, y) => x - y);
  const p = { largura: larg[larg.length >> 1], projecao: proj, narina: doa.narina || 1, profNarina: doa.profNarina || 10 };
  const dir = contornoNarina(p), esq = dir.map(([u, w]) => [-u, w]), prof = p.profNarina;
  return function (u, v, w, q) {
    const i = Math.round((u - o[0]) / h), k = Math.round((w - o[2]) / h);
    if (i < 0 || k < 0 || i >= nx || k >= nz) return 1e3;
    const bv = base[i + nx * k]; if (!(bv < Infinity)) return 1e3;
    const hb = v - bv, f2 = Vo.distanciaPoligono(u, w, u >= 0 ? dir : esq) - 0.12 * Math.max(0, Math.min(hb, prof - 2));
    const qq = hb - prof, f = Math.hypot(Math.max(f2, 0), Math.max(qq, 0)) + Math.min(Math.max(f2, qq), 0);
    return hb > 2.5 && f < 3 ? maxSuave(f, 2 + sD[q], 1) : f;
  };
}
// Assento da ponte dos óculos e nichos de ímãs. oc: { pontos: [p1, p2] (no scan, nos dois lados do dorso, onde a
// armação apoia), largura (mm, faixa do assento), prof (mm), imas (bool), imaDiam, imaProf }. Altera sD (a doadora):
// tira uma faixa de "prof" mm de profundidade entre os dois pontos (a ponte fica rente e esconde a margem de cima) e, se
// pedido, um nicho cilíndrico em cada ponto, ao longo da normal, a partir do fundo do assento.
export const OCULOS_PADRAO = { largura: 5, prof: 1.2, imas: false, imaDiam: 4, imaProf: 2 };
function assentoOculos(g, sD, R, oc) {
  const o = Object.assign({}, OCULOS_PADRAO, oc), { nx, ny, nz, h } = g, NC = nx * ny, avisos = [];
  const [a, b] = o.pontos.map((p) => paraLocal(R, p)).sort((x, y) => x[0] - y[0]);
  const grade = { nx, ny, nz, o: g.o, h, f: sD }, amostra = (p) => Vo.amostrarGrade(grade, p[0], p[1], p[2]);
  // normal da doadora em cada ponto (gradiente de sD) e o ponto levado à superfície
  const naSup = (p) => {
    let q = p.slice();
    for (let it = 0; it < 4; it++) {
      const e = 0.5, gr = [0, 1, 2].map((k) => { const m = q.slice(), n = q.slice(); m[k] += e; n[k] -= e; return (amostra(m) - amostra(n)) / (2 * e); });
      const l = Math.hypot(...gr) || 1, d = amostra(q); q = q.map((x, k) => x - (d * gr[k]) / l);
      if (it === 3) return { p: q, n: gr.map((x) => x / l) };
    }
  };
  const A = naSup(a), B = naSup(b);
  if (Math.abs(amostra(a)) > 3 || Math.abs(amostra(b)) > 3) avisos.push({ n: "atenção", t: "Um dos pontos da armação ficou longe da superfície do nariz: marque-os sobre a prótese, nos lados do dorso." });
  const u0 = A.p[0], u1 = B.p[0], vb = (u) => (u1 - u0 > 1e-6 ? A.p[1] + ((Math.min(u1, Math.max(u0, u)) - u0) / (u1 - u0)) * (B.p[1] - A.p[1]) : A.p[1]);
  const orig = Float32Array.from(sD), rI = o.imaDiam / 2;
  const nichos = o.imas ? [A, B].map((P) => ({ s: P.p.map((x, k) => x - P.n[k] * o.prof), n: P.n })) : [];
  for (let k = 0; k < nz; k++) {
    const w = g.o[2] + k * h;
    for (let j = 0; j < ny; j++) {
      const v = g.o[1] + j * h;
      for (let i = 0; i < nx; i++) {
        const q = i + nx * j + NC * k, u = g.o[0] + i * h;
        if (orig[q] > 3 || orig[q] < -(o.prof + o.imaProf + 3)) continue;
        // faixa do assento: perto da linha da ponte, "prof" para dentro da superfície entre os pontos e cada vez mais rasa
        // nos 4 mm depois deles (a armação sai do nariz)
        const fora = Math.max(0, u0 - u, u - u1), pe = o.prof * (1 - sstep(fora / 4));
        const G = Math.max(Math.abs(v - vb(u)) - o.largura / 2, fora - 4, -orig[q] - pe);
        let f = maxSuave(orig[q], -G, 0.8);
        for (const N of nichos) {
          const d = [u - N.s[0], v - N.s[1], w - N.s[2]], x = d[0] * N.n[0] + d[1] * N.n[1] + d[2] * N.n[2];
          const rad = Math.hypot(d[0] - x * N.n[0], d[1] - x * N.n[1], d[2] - x * N.n[2]);
          f = Math.max(f, -Math.max(rad - rI, -x - o.imaProf, x - o.prof - 1));
        }
        sD[q] = f;
      }
    }
  }
  return { prof: o.prof, imas: o.imas, imaProf: o.imaProf, largura: o.largura, pontos: [A.p, B.p], avisos };
}
// A aba é afinada até a borda (bordaEsp, p.ex. 0,3 mm), mais fina que o passo da grade: no campo ela entra com pelo menos
// tMin = 1,8 × passo (≥ √3 × passo: senão, na pele inclinada, o marching cubes a perderia entre duas amostras) e aqui os vértices da camada são trazidos
// de volta à espessura pedida, coluna a coluna (w' = pele + (w − pele) × t / tMin). Só move vértices ao longo de w,
// dentro da camada: a malha continua fechada. Vale para a prótese e para o teto da cavidade nas partes externas do molde.
export function afinarBorda(malha, B) {
  const { nx, ny, o, h } = B.g, V = malha.V;
  const amostra = (arr, a, b) => { const i = Math.max(0, Math.min(nx - 2, Math.floor(a))), j = Math.max(0, Math.min(ny - 2, Math.floor(b))), u = Math.min(1, Math.max(0, a - i)), v = Math.min(1, Math.max(0, b - j)), c = i + nx * j; return (arr[c] * (1 - u) + arr[c + 1] * u) * (1 - v) + (arr[c + nx] * (1 - u) + arr[c + nx + 1] * u) * v; };
  let movidos = 0;
  for (let q = 0; q < V.length; q += 3) {
    const a = (V[q] - o[0]) / h, b = (V[q + 1] - o[1]) / h;
    const i = Math.round(a), j = Math.round(b); if (i < 0 || j < 0 || i >= nx || j >= ny || !B.permitida[i + nx * j]) continue;
    const d = amostra(B.dAba, a, b); if (!(d > 0) || d > B.La + h) continue;
    const t = B.tb + (B.t0 - B.tb) * (1 - sstep(Math.min(1, d / B.La))), tg = Math.max(B.tMin, t);
    if (t >= tg - 1e-6) continue;
    const pl = amostra(B.pele, a, b), w = V[q + 2];
    if (w < pl - 0.3 * h || w > pl + tg + 0.3 * h) continue;
    V[q + 2] = pl + Math.max(0, w - pl) * (t / tg); movidos++;
  }
  return movidos;
}
function modeloCentro(m) { let c = [0, 0, 0]; const n = m.V.length / 3; for (let i = 0; i < m.V.length; i += 3) c = soma(c, [m.V[i], m.V[i + 1], m.V[i + 2]]); return esc(c, 1 / n); }
export function ajusteInverso(aj, c = [0, 0]) {
  const a = (((aj && aj.giro) || 0) * Math.PI) / 180, s = ((aj && aj.escala) || 100) / 100, ca = Math.cos(a), sa = Math.sin(a);
  const d = [(aj && aj.du) || 0, (aj && aj.dv) || 0, (aj && aj.dw) || 0];
  return (x, y, z) => { const X = (x - d[0] - c[0]) / s, Y = (y - d[1] - c[1]) / s; return [c[0] + ca * X + sa * Y, c[1] - sa * X + ca * Y, (z - d[2]) / s]; };
}

// medidas da prótese (mm, mm², mL)
function medirProtese(g, fP, pele, regiao, malha, { tipo, nariz, par }) {
  const { nx, ny, nz, o, h } = g, NC = nx * ny;
  let base = 0, alturaMax = 0, limiteGrade = false, ulo = Infinity, uhi = -Infinity, vlo = Infinity, vhi = -Infinity;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = i + nx * j; let topo = -Infinity, toca = false;
    for (let k = 0; k < nz; k++) if (fP[c + NC * k] < 0) { topo = o[2] + k * h; if (Math.abs(topo - pele[c]) < 1.5 * h) toca = true; }
    if (topo > -Infinity) {
      if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) limiteGrade = true;
      alturaMax = Math.max(alturaMax, topo - pele[c]);
      const u = o[0] + i * h, v = o[1] + j * h; ulo = Math.min(ulo, u); uhi = Math.max(uhi, u); vlo = Math.min(vlo, v); vhi = Math.max(vhi, v);
    }
    if (toca) base++;
  }
  const vol = volumeMalha(malha) / 1000;
  const m = { volume: vol, massa: vol * 1.1, areaBase: base * h * h, altura: vhi - vlo + h, largura: uhi - ulo + h, projecao: alturaMax, limiteGrade, degrauContorno: 0, triangulos: malha.F.length / 3, fechada: verificarFechada(malha).fechada };
  if (tipo === "nariz" && nariz) Object.assign(m, { comprimentoNariz: nariz.comprimento, larguraNariz: nariz.largura, projecaoPonta: nariz.projecao, nasolabial: nariz.nasolabial });
  return m;
}

// ------------------------------------------------------------------ molde
// → { pecas: [{ nome, malha, volume }], medidas, avisos, chaves, canais }
export async function gerarMolde(P, opcoes = {}) {
  const prog = opcoes.aoProgresso || (async () => {}), op = Object.assign({}, MOLDE_PADRAO, opcoes);
  const { nx, ny, nz, o, h } = P.g, NC = nx * ny, N = NC * nz, fP = P.fP, pele = P.pele, avisos = [];
  // primeira e última travessia da cavidade por coluna
  const baixo = new Float32Array(NC).fill(NaN), alto = new Float32Array(NC).fill(NaN);
  let ulo = Infinity, uhi = -Infinity, vlo = Infinity, vhi = -Infinity, topoCav = -Infinity, retencoes = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = i + nx * j; let k0 = -1, k1 = -1;
    for (let k = 0; k < nz; k++) if (fP[c + NC * k] < 0) { if (k0 < 0) k0 = k; k1 = k; }
    if (k0 < 0) continue;
    const a = k0 > 0 ? fP[c + NC * (k0 - 1)] : 1, b = fP[c + NC * k0]; baixo[c] = o[2] + (k0 - 1 + a / (a - b)) * h;
    const a2 = fP[c + NC * k1], b2 = k1 < nz - 1 ? fP[c + NC * (k1 + 1)] : 1; alto[c] = o[2] + (k1 + a2 / (a2 - b2)) * h;
    for (let k = k0; k <= k1; k++) if (fP[c + NC * k] >= 0) retencoes++;
    const u = o[0] + i * h, v = o[1] + j * h; ulo = Math.min(ulo, u); uhi = Math.max(uhi, u); vlo = Math.min(vlo, v); vhi = Math.max(vhi, v); topoCav = Math.max(topoCav, alto[c]);
  }
  if (!(ulo < uhi)) throw new Error("não há prótese para moldar");
  // bloco
  const B = { u0: ulo - op.parede, u1: uhi + op.parede, v0: vlo - op.parede, v1: vhi + op.parede };
  const gu0 = o[0] + h, gu1 = o[0] + (nx - 2) * h, gv0 = o[1] + h, gv1 = o[1] + (ny - 2) * h;
  if (B.u0 < gu0 || B.u1 > gu1 || B.v0 < gv0 || B.v1 > gv1) { avisos.push({ n: "atenção", t: "A parede do molde foi reduzida para caber na região de trabalho." }); B.u0 = Math.max(B.u0, gu0); B.u1 = Math.min(B.u1, gu1); B.v0 = Math.max(B.v0, gv0); B.v1 = Math.min(B.v1, gv1); }
  let peleMin = Infinity;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const u = o[0] + i * h, v = o[1] + j * h; if (u >= B.u0 && u <= B.u1 && v >= B.v0 && v <= B.v1) peleMin = Math.min(peleMin, pele[i + nx * j]); }
  B.w0 = Math.max(o[2] + h, peleMin - op.base); B.w1 = Math.min(o[2] + (nz - 2) * h, topoCav + op.topo);
  if (peleMin - B.w0 < op.base - 0.5 * h) avisos.push({ n: "atenção", t: `A base do molde ficou com ${fmt(peleMin - B.w0, 1)} mm no ponto mais fundo (pedido: ${fmt(op.base, 1)} mm).` });
  const fBloco = (u, v, w) => Math.max(B.u0 - u, u - B.u1, B.v0 - v, v - B.v1, B.w0 - w, w - B.w1);
  // altura de partição: fundo da cavidade ou pele
  const part = new Float32Array(NC);
  for (let c = 0; c < NC; c++) part[c] = Number.isNaN(baixo[c]) ? pele[c] : baixo[c];
  const partEm = (u, v) => { const i = Math.max(0, Math.min(nx - 1, Math.round((u - o[0]) / h))), j = Math.max(0, Math.min(ny - 1, Math.round((v - o[1]) / h))); return part[i + nx * j]; };
  // chaves base ↔ externa nos quatro cantos, no meio da parede
  const m = op.parede / 2, rk = Math.min(op.chaveRaio, op.parede / 2 - 0.5);
  const chaves = [[B.u0 + m, B.v0 + m], [B.u1 - m, B.v0 + m], [B.u1 - m, B.v1 - m], [B.u0 + m, B.v1 - m]].map(([u, v]) => ({ c: [u, v, partEm(u, v)], r: rk }));
  // divisão da externa: plano vertical pelo centro da cavidade
  const ang = (op.anguloDivisao * Math.PI) / 180, nd = [Math.cos(ang), Math.sin(ang)], cc = [(ulo + uhi) / 2 + op.deslocDivisao * nd[0], (vlo + vhi) / 2 + op.deslocDivisao * nd[1]];
  const sPlano = (u, v) => (u - cc[0]) * nd[0] + (v - cc[1]) * nd[1];
  let chavesAB = [];
  if (op.dividir) {
    const dir = [-nd[1], nd[0]], alc = [];
    // extremos do plano dentro do bloco
    for (const s of [-1, 1]) {
      let t = 0; while (t < 400) { const u = cc[0] + s * t * dir[0], v = cc[1] + s * t * dir[1]; if (u < B.u0 + m || u > B.u1 - m || v < B.v0 + m || v > B.v1 - m) break; t += 0.5; }
      const u = cc[0] + s * (t - 0.5) * dir[0], v = cc[1] + s * (t - 0.5) * dir[1];
      const pw = partEm(u, v); alc.push({ c: [u, v, (pw + B.w1) / 2], r: rk });
    }
    chavesAB = alc;
  }
  // canal de injeção no ponto mais alto da cavidade e respiros nos extremos mais distantes dele
  const cols = [];
  for (let c = 0; c < NC; c++) if (!Number.isNaN(alto[c])) cols.push(c);
  let cs = cols[0]; for (const c of cols) if (alto[c] > alto[cs]) cs = c;
  const posC = (c) => [o[0] + (c % nx) * h, o[1] + ((c / nx) | 0) * h];
  const canais = [];
  if (op.canal > 0) canais.push({ u: posC(cs)[0], v: posC(cs)[1], w: alto[cs] - 0.4, r: op.canal / 2, tipo: "injeção" });
  if (op.respiros > 0 && op.respiro > 0) {
    // extremidades: colunas da cavidade (com espessura > 1 mm) mais longe do canal e entre si
    const fortes = cols.filter((c) => alto[c] - baixo[c] > 1);
    const esc0 = [posC(cs)];
    for (let r = 0; r < op.respiros; r++) {
      let melhor = -1, md = -1;
      for (const c of fortes) { const p = posC(c), d = Math.min(...esc0.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))); if (d > md) { md = d; melhor = c; } }
      if (melhor < 0) break;
      esc0.push(posC(melhor)); canais.push({ u: posC(melhor)[0], v: posC(melhor)[1], w: alto[melhor] - 0.4, r: op.respiro / 2, tipo: "respiro" });
    }
  }
  // campos das peças
  const esfera = (u, v, w, k) => Math.hypot(u - k.c[0], v - k.c[1], w - k.c[2]) - k.r;
  const definicoes = [{ nome: "base", lado: 0 }].concat(op.dividir ? [{ nome: "externa-A", lado: -1 }, { nome: "externa-B", lado: 1 }] : [{ nome: "externa", lado: 2 }]);
  const lim = [Math.max(0, Math.floor((B.u0 - o[0]) / h) - 1), Math.min(nx - 1, Math.ceil((B.u1 - o[0]) / h) + 1), Math.max(0, Math.floor((B.v0 - o[1]) / h) - 1), Math.min(ny - 1, Math.ceil((B.v1 - o[1]) / h) + 1), Math.max(0, Math.floor((B.w0 - o[2]) / h) - 1), Math.min(nz - 1, Math.ceil((B.w1 - o[2]) / h) + 1)];
  const campo = new Float32Array(N), pecas = [];
  let n = 0;
  for (const d of definicoes) {
    await prog(`Molde: ${d.nome}…`, 0.1 + (0.85 * n++) / definicoes.length);
    for (let k = lim[4]; k <= lim[5]; k++) {
      const w = o[2] + k * h;
      for (let j = lim[2]; j <= lim[3]; j++) {
        const v = o[1] + j * h;
        for (let i = lim[0]; i <= lim[1]; i++) {
          const c = i + nx * j, q = c + NC * k, u = o[0] + i * h;
          let f = Math.max(fBloco(u, v, w), -fP[q]);
          if (d.lado === 0) {
            f = Math.max(f, w - part[c]);
            for (const ch of chaves) f = Math.min(f, Math.max(esfera(u, v, w, ch), fBloco(u, v, w), -fP[q]));
          } else {
            f = Math.max(f, part[c] - w);
            for (const ch of chaves) f = Math.max(f, -(esfera(u, v, w, ch) - op.folga));
            for (const cn of canais) f = Math.max(f, -Math.max(Math.hypot(u - cn.u, v - cn.v) - cn.r, cn.w - w));
            if (d.lado !== 2) {
              const s = sPlano(u, v);
              f = Math.max(f, d.lado < 0 ? s : -s);
              for (const ch of chavesAB) {
                const e2 = esfera(u, v, w, ch);
                if (d.lado < 0) f = Math.min(f, Math.max(e2, fBloco(u, v, w), part[c] - w, -fP[q]));
                else f = Math.max(f, -(e2 - op.folga));
              }
            }
          }
          campo[q] = f;
        }
      }
    }
    let malha = Vo.extrairSuperficie(Object.assign({}, P.g, { f: campo }), { lim });
    if (d.lado !== 0 && P.borda) afinarBorda(malha, P.borda);
    const fc = filtrarComponentes(malha.V, malha.F, 0.02);
    malha = decimar({ V: fc.V, F: fc.F }, { tolerancia: op.tolerancia });
    pecas.push({ nome: d.nome, malha, volume: volumeMalha(malha) / 1000, fechada: verificarFechada(malha).fechada, triangulos: malha.F.length / 3 });
  }
  const volRet = retencoes * h * h * h / 1000;
  if (volRet > 0.05) avisos.push({ n: "info", t: `Retenções no molde: ${fmt(volRet, 2)} mL de molde ficam presos entre partes da prótese na direção de retirada; o silicone precisa flexionar para sair (normal na hélice da orelha e nas narinas).` });
  return { pecas, bloco: B, chaves, chavesAB, canais, retencoes: volRet, avisos, opcoes: op };
}

// ------------------------------------------------------------------ alinhamento de modelo importado por pares de pontos
// origem: pontos no modelo; destino: os mesmos pontos no rosto (≥ 3 pares). → transformação { R, s, t } e erro médio
export function alinharModelo(origem, destino, comEscala = true) {
  if (origem.length < 3 || origem.length !== destino.length) throw new Error("marque pelo menos 3 pares de pontos (modelo e rosto)");
  const T = ajustarSimilaridade(origem, destino, comEscala);
  const erro = origem.reduce((s, p, i) => s + dist(aplicarTransformacao(T, p), destino[i]), 0) / origem.length;
  return { T, erro };
}
export const transformarModelo = (m, T) => ({ V: transformarVertices(m.V, (x, y, z) => aplicarTransformacao(T, [x, y, z])), F: m.F });

// Refina um modelo já perto do lugar pelo próprio rosto (ICP rígido, ponto-plano): serve quando o modelo é um scan da
// mesma pessoa com o nariz (ou com a orelha), feito antes. Só conta a pele em volta (até raio de centro), fora da região
// do defeito (excluir: [{ c, r }]), onde os dois scans devem coincidir. modelo: { V, F } já na posição atual (cena).
// → { T (a compor depois da transformação atual), rms (mm), pares, iteracoes }
export function refinarModelo(modelo, scan, { centro, raio = 80, excluir = [], amostras = 4000, iteracoes = 40, busca } = {}) {
  const B = busca || criarBuscaProxima(scan, 4), V = modelo.V, cand = [];
  for (let i = 0; i < V.length; i += 3) {
    const p = [V[i], V[i + 1], V[i + 2]];
    if (centro && dist(p, centro) > raio) continue;
    if (excluir.some((e) => dist(p, e.c) < e.r)) continue;
    cand.push(p);
  }
  if (cand.length < 50) throw new Error("o modelo não tem pele em volta da região do defeito para comparar com o rosto");
  const passo = Math.max(1, Math.floor(cand.length / amostras)), pts = cand.filter((_, i) => i % passo === 0);
  // ponto-plano (Chen–Medioni), linearizado em rotações pequenas: min Σ ((R p + t − q)·N)², 6 incógnitas
  let T = { R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], s: 1, t: [0, 0, 0] }, rms = null, n = 0, it = 0;
  for (; it < iteracoes; it++) {
    const lim = Math.max(2, 12 - 1.5 * it), A = Array.from({ length: 6 }, () => new Float64Array(6)), b = new Float64Array(6), res = [];
    for (const p0 of pts) {
      const p = aplicarTransformacao(T, p0), r = B.pontoMaisProximo(p, lim); if (!r) continue;
      const N = r.n, e = dot(sub(p, r.p), N); res.push({ p, N, e });
    }
    if (res.length < 30) break;
    res.sort((x, y) => Math.abs(x.e) - Math.abs(y.e));
    const usa = res.slice(0, Math.ceil(res.length * 0.9));   // 10 % piores fora (bordas, cabelo, diferenças reais)
    rms = Math.sqrt(usa.reduce((s2, x) => s2 + x.e * x.e, 0) / usa.length); n = usa.length;
    for (const { p, N, e } of usa) {
      const J = cruz(p, N).concat(N);
      for (let i = 0; i < 6; i++) { b[i] -= J[i] * e; for (let j = 0; j < 6; j++) A[i][j] += J[i] * J[j]; }
    }
    const x = resolverN(A, b); if (!x) break;
    const ang = Math.hypot(x[0], x[1], x[2]), k = ang > 1e-12 ? [x[0] / ang, x[1] / ang, x[2] / ang] : [1, 0, 0], c = Math.cos(ang), s1 = Math.sin(ang), v1 = 1 - c;
    const R = [[c + k[0] * k[0] * v1, k[0] * k[1] * v1 - k[2] * s1, k[0] * k[2] * v1 + k[1] * s1], [k[1] * k[0] * v1 + k[2] * s1, c + k[1] * k[1] * v1, k[1] * k[2] * v1 - k[0] * s1], [k[2] * k[0] * v1 - k[1] * s1, k[2] * k[1] * v1 + k[0] * s1, c + k[2] * k[2] * v1]];
    T = comporTransformacoes({ R, s: 1, t: [x[3], x[4], x[5]] }, T);
    if (it > 3 && ang < 1e-6 && Math.hypot(x[3], x[4], x[5]) < 1e-4) { it++; break; }
  }
  if (rms == null) throw new Error("o modelo está longe demais do rosto: alinhe antes pelos pares de pontos");
  return { T, rms, pares: n, iteracoes: it };
}

// ------------------------------------------------------------------ malha local → coordenadas do scan (para mostrar e exportar)
export function malhaParaScan(malha, R) {
  return { V: Float32Array.from(transformarVertices(malha.V, (x, y, z) => deLocal(R, [x, y, z]))), F: malha.F };
}

// ------------------------------------------------------------------ checagens
export const REFERENCIAS = {
  orelha: "Adultos jovens (Bozkir et al., 2006): altura 59,5–63 mm, largura 31–33 mm, projeção 15–20 mm.",
  nariz: "Padrões iniciais: largura alar ≈ distância intercantal; projeção da ponta ≈ 0,4 × comprimento n–sn; ângulo nasolabial 90–110°.",
};
export function checagens({ tipo, medidas, ficha = {}, protese, molde }) {
  const ch = [];
  if (ficha.radioterapia === "sim") ch.push({ n: "atenção", t: "Pele irradiada: prefira adesivo de baixa agressividade, confira a integridade da pele antes da prova e acompanhe a adaptação." });
  if (ficha.alergias) ch.push({ n: "atenção", t: `Alergias informadas (${ficha.alergias}): confira a compatibilidade do silicone, dos pigmentos e do adesivo.` });
  if (protese) for (const a of protese.avisos) ch.push(a);
  if (molde) for (const a of molde.avisos) ch.push(a);
  if (medidas && tipo === "orelha" && medidas.altura) {
    if (medidas.altura < 45 || medidas.altura > 75) ch.push({ n: "atenção", t: `Altura da orelha de ${fmt(medidas.altura, 0)} mm, fora da faixa usual de adultos (45–75 mm): confira o contorno e a escala do scan.` });
  }
  if (medidas && tipo === "nariz" && medidas.nasolabial && (medidas.nasolabial < 85 || medidas.nasolabial > 120)) ch.push({ n: "atenção", t: `Ângulo nasolabial de ${fmt(medidas.nasolabial, 0)}°, fora de 85–120°.` });
  if (medidas && medidas.fechada === false) ch.push({ n: "alerta", t: "A malha da prótese não ficou fechada." });
  if (molde) for (const p of molde.pecas) if (!p.fechada) ch.push({ n: "alerta", t: `A peça ${p.nome} do molde não ficou fechada.` });
  return ch;
}
