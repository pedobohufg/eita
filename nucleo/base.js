/* EITA núcleo · base — utilidades numéricas.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function amostra(arr, passo) {
  const out = new Float32Array(Math.ceil(arr.length / passo));
  for (let i = 0, k = 0; i < arr.length; i += passo, k++) out[k] = arr[i];
  return out;
}
export function percentil(arr, p, mascara) {
  let v;
  if (mascara) { const t = []; for (let i = 0; i < arr.length; i++) if (mascara[i]) t.push(arr[i]); v = Float32Array.from(t); }
  else v = arr.length > 400000 ? amostra(arr, Math.ceil(arr.length / 400000)) : Float32Array.from(arr);
  if (!v.length) return NaN;
  v.sort();
  const pos = (p / 100) * (v.length - 1), lo = Math.floor(pos), hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
};
export const mediana = (arr, m) => percentil(arr, 50, m);
export function mediaDesvio(arr) {
  let s = 0, s2 = 0; const n = arr.length;
  for (let i = 0; i < n; i++) { s += arr[i]; s2 += arr[i] * arr[i]; }
  const m = s / n; return [m, Math.sqrt(Math.max(s2 / n - m * m, 0))];
}

export function resolver3(A, b) {
  const M = A.map((r, i) => r.concat([b[i]]));
  for (let c = 0; c < 3; c++) {
    let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < 3; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k]; }
  }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
}
export const hex = (rgb) => "#" + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
