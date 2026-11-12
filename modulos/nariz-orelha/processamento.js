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
import { volume as volumeMalha, verificarFechada, filtrarComponentes } from "../../nucleo/malha.js";
import { aplicarTransformacao, ajustarSimilaridade } from "../../nucleo/alinhamento.js";

export const VERSAO = "0.1";
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
// rosto: w ≤ topo(u, v), cortada pela base (columela e soleira das narinas, inclinada pelo ângulo nasolabial) e pela
// raiz. topo = máximo suave entre o corpo (dorso e lóbulo: seção parabólica de meia-largura b(v) e altura D(v), o
// perfil do dorso) e as asas (lobos laterais); o vale entre os dois é o sulco alar. As narinas ficam à parte
// (narinasParametricas), para atravessarem até o oco.
export function narizTopo(p) {
  const L = p.comprimento, W = p.largura, P = p.projecao, vt = Math.min(p.alturaPonta, 0.4 * L), r0 = 1.5, Rt = Math.max(4, 0.14 * L);
  const bR = 0.25 * W, bM = 0.34 * W, bL = Math.max(4, 0.45 * p.larguraPonta), v6 = 0.6 * L;
  const ra = 0.2 * W, ua = W / 2 - ra, Amax = 0.45 * P, va = 0.12 * L, rv = 0.2 * L;
  const D = (v) => {
    if (v >= vt) { const s = (L - v) / (L - vt); return r0 + (P - r0) * s + (p.dorso || 0) * 4 * s * (1 - s); }
    return P - ((vt - v) * (vt - v)) / (2 * Rt);
  };
  const b = (v) => (v >= v6 ? bM + (bR - bM) * sstep((v - v6) / (L - v6)) : v >= vt + 2 ? bL + (bM - bL) * sstep((v - vt - 2) / (v6 - vt - 2)) : bL);
  const pe = (v) => (v >= v6 ? 2 : v >= vt ? 2 + 0.6 * (1 - (v - vt) / (v6 - vt)) : 2.6);
  return function (u, v) {
    const vv = Math.min(L + 3, v), au = Math.abs(u), bv = b(vv), x = au / bv;
    const corpo = x < 1 ? Math.max(0, D(vv)) * (1 - Math.pow(x, pe(vv))) : -(au - bv);
    const ya = (v - va) / rv, za = (au - ua) / (au > ua ? ra : 1.4 * ra);
    const asa = Amax * (1 - ya * ya - za * za);   // paraboloide elíptico: contorno oval de frente
    return -Vo.uniaoSuave(-corpo, -asa, 4);
  };
}
// campo do nariz (distância aproximada: altura normalizada pela inclinação, base e raiz)
export function narizParametrico(p) {
  const topo = narizTopo(p), L = p.comprimento, alfa = ((p.nasolabial - 90) * Math.PI) / 180, tg = Math.tan(alfa), ca = Math.cos(alfa), e = 0.25;
  return function (u, v, w) {
    const t = topo(u, v), gu = (topo(u + e, v) - topo(u - e, v)) / (2 * e), gv = (topo(u, v + e) - topo(u, v - e)) / (2 * e);
    return Math.max((w - t) / Math.sqrt(1 + gu * gu + gv * gv), (tg * w - v) * ca, v - (L + 3));
  };
}
// malha fechada do nariz paramétrico no referencial do nariz, cortada a 40 mm atrás do subnasal (dentro do rosto)
export function malhaNariz(p, passo = 0.4) {
  const f = narizParametrico(p), W = p.largura, L = p.comprimento, P = p.projecao;
  const g = Vo.criarGrade([-W / 2 - 4, -8, -40], [W / 2 + 4, L + 6, P + 4], passo);
  Vo.preencherGrade(g, (u, v, w) => Math.max(f(u, v, w), -40 + passo - w));
  return decimar(Vo.extrairSuperficie(g), { tolerancia: 0.01 });
}
export function narinasParametricas(p) {
  const L = p.comprimento, W = p.largura, P = p.projecao, alfa = ((p.nasolabial - 90) * Math.PI) / 180, k = p.narina || 1;
  const ca = Math.cos(alfa), sa = Math.sin(alfa), du = 0.12 * W, wc = 0.45 * P, vc = Math.tan(alfa) * wc;
  return function (u, v, w) {
    let f = Infinity;
    for (const s of [-1, 1]) {
      // eixos da narina: ao longo da columela (no plano v-w), lateral, e normal à base (para dentro do nariz)
      const x = u - s * du, y = v - vc, z = w - wc;
      const al = y * sa + z * ca, no = y * ca - z * sa;
      f = Math.min(f, Vo.elipsoide(x, no - p.profNarina * 0.25, al, 0.07 * W * k, p.profNarina * 0.45, 0.25 * P * k));
    }
    return f;
  };
}

// ------------------------------------------------------------------ prótese
export const PARAMETROS_PADRAO = {
  // filete: sob a parte solta da doadora, a aba entra até esta distância da raiz (fecha a ponta do sulco atrás da orelha,
  // sem cunha fina de ar); no nariz fica 0 (taparia o fundo das narinas)
  orelha: { passo: 0.5, aba: 8, bordaEsp: 0.3, baseEsp: 1.5, raioUniao: 1.5, oco: false, parede: 3, filete: 3 },
  nariz: { passo: 0.5, aba: 6, bordaEsp: 0.3, baseEsp: 1.5, raioUniao: 1.5, oco: true, parede: 3, filete: 0 },
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
  // extensão da região em (u, v)
  if (!regiaoUV) {
    if (nz) regiaoUV = { lo: [-nz.largura / 2 - 4, -5, 0], hi: [nz.largura / 2 + 4, nz.comprimento + 4, 0] };
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
  { const D = doadoraL.V; for (let i = 0; i < D.length; i += 3) { const u = D[i], v = D[i + 1]; if (poligono ? Vo.distanciaPoligono(u, v, poligono) < 2 : true) dmax = Math.max(dmax, D[i + 2]); } }
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
    const mask = new Uint8Array(NC);
    for (let c = 0; c < NC; c++) for (let k = 0; k < g.nz; k++) { const q = c + NC * k; if (sD[q] < 0 && sH[q] > 0.3) { mask[c] = 1; break; } }
    if (!mask.some((x) => x)) throw new Error("a forma doadora não aparece acima da pele: confira o alinhamento e os pontos");
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
  const imas = (e.imas || []).map((m) => { const q = paraLocal(R, m.p); const i = Math.round((q[0] - g.o[0]) / h), j = Math.round((q[1] - g.o[1]) / h); const w0 = i >= 0 && j >= 0 && i < g.nx && j < g.ny ? pele[i + g.nx * j] : q[2]; return { u: q[0], v: q[1], w0 }; });
  const rI = (e.imaDiam || 6) / 2, pI = e.imaProf || 3;
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
        if (narinas) f = Math.max(f, -narinas(u, v, w));
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
