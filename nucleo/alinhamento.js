/* EITA núcleo · alinhamento — autovalores de matriz simétrica (Jacobi), ajuste de similaridade entre pares de pontos
   (rotação + escala opcional + translação, método de Horn por quatérnios) e composição de transformações.
   Origem: EITA! AFO v0.14 (jacobiEig, fitSim, matV, matM, compose, applyT), mesma aritmética. Puro: navegador e Node.
   Transformação: { R: matriz 3×3 (linhas), s: escala, t: translação } — p' = s·R·p + t.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const soma = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const escalar = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const ponto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Matriz simétrica n×n (arrays de linhas) → { valores (decrescentes), vetores (vetores[i] = autovetor de valores[i]) }
export function autovaloresSimetrica(A) {
  const e = A.length, n = A.map((v) => v.slice()), o = Array.from({ length: e }, (v, h) => Array.from({ length: e }, (u, x) => (h === x ? 1 : 0)));
  for (let it = 0; it < 60; it++) {
    let fora = 0;
    for (let u = 0; u < e; u++) for (let x = u + 1; x < e; x++) fora += n[u][x] * n[u][x];
    if (fora < 1e-18) break;
    for (let u = 0; u < e; u++) for (let x = u + 1; x < e; x++) {
      if (Math.abs(n[u][x]) < 1e-30) continue;
      const T = (n[x][x] - n[u][u]) / (2 * n[u][x]), b = Math.sign(T || 1) / (Math.abs(T) + Math.sqrt(T * T + 1)), c = 1 / Math.sqrt(b * b + 1), s = b * c;
      for (let k = 0; k < e; k++) { const W = n[k][u], U = n[k][x]; n[k][u] = c * W - s * U; n[k][x] = s * W + c * U; }
      for (let k = 0; k < e; k++) { const W = n[u][k], U = n[x][k]; n[u][k] = c * W - s * U; n[x][k] = s * W + c * U; }
      for (let k = 0; k < e; k++) { const W = o[k][u], U = o[k][x]; o[k][u] = c * W - s * U; o[k][x] = s * W + c * U; }
    }
  }
  const l = n.map((v, h) => v[h]), ord = l.map((v, h) => h).sort((v, h) => l[h] - l[v]);
  return { valores: ord.map((v) => l[v]), vetores: ord.map((v) => o.map((h) => h[v])) };
}

export const matrizVetor = (R, v) => [R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2], R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2], R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]];
export const matrizMatriz = (A, B) => A.map((n) => [0, 1, 2].map((o) => n[0] * B[0][o] + n[1] * B[1][o] + n[2] * B[2][o]));
// a ∘ b (aplica b, depois a)
export const comporTransformacoes = (a, b) => ({ R: matrizMatriz(a.R, b.R), s: a.s * b.s, t: soma(escalar(matrizVetor(a.R, b.t), a.s), a.t) });
export const aplicarTransformacao = (T, p) => soma(escalar(matrizVetor(T.R, p), T.s), T.t);

// Melhor transformação que leva origem[i] → destino[i] (mínimos quadrados). comEscala: estima a escala
// (aceita só entre 0,8 e 1,25; fora disso usa 1).
export function ajustarSimilaridade(origem, destino, comEscala) {
  const o = origem.length;
  let l = [0, 0, 0], s = [0, 0, 0];
  for (let i = 0; i < o; i++) for (let k = 0; k < 3; k++) { l[k] += origem[i][k] / o; s[k] += destino[i][k] / o; }
  const v = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  let h = 0;
  for (let i = 0; i < o; i++) {
    const a = sub(origem[i], l), b = sub(destino[i], s);
    h += ponto(a, a) / o;
    for (let g = 0; g < 3; g++) for (let k = 0; k < 3; k++) v[g][k] += (a[g] * b[k]) / o;
  }
  const [[u, x, T], [b, y, L], [C, W, U]] = v;
  const N = [[u + y + U, L - W, C - T, x - b], [L - W, u - y - U, x + b, C + T], [C - T, x + b, -u + y - U, L + W], [x - b, C + T, L + W, -u - y + U]];
  const [G, O, B, Z] = autovaloresSimetrica(N).vetores[0];
  const R = [
    [G * G + O * O - B * B - Z * Z, 2 * (O * B - G * Z), 2 * (O * Z + G * B)],
    [2 * (O * B + G * Z), G * G - O * O + B * B - Z * Z, 2 * (B * Z - G * O)],
    [2 * (O * Z - G * B), 2 * (B * Z + G * O), G * G - O * O - B * B + Z * Z]
  ];
  let D = 1;
  if (comEscala) {
    let acc = 0;
    for (let i = 0; i < o; i++) acc += ponto(sub(destino[i], s), matrizVetor(R, sub(origem[i], l))) / o;
    D = acc / h; if (!(D > 0.8 && D < 1.25)) D = 1;
  }
  return { R, s: D, t: sub(s, escalar(matrizVetor(R, l), D)) };
}
