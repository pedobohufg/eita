/* EITA! AFO · casca — geração da casca da AFO e funções que rodam no Worker. Puro (sem estado e sem DOM). Movido de ui.js
   na E4c sem mudança; o texto do Worker passou a ser montado aqui (textoDoWorker), com a lista de dependências num só lugar.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import { V3, DEG, smooth } from "./vetor.js";
import { pl } from "./anatomia.js";
import { normaisDeVertices } from "../../nucleo/malha.js";

export function binCenters(t, e, n, o, l) {
  const s = Array.from({ length: l }, () => [[], []]);
  for (let v = 0; v < e.length; v++) {
    const h = Math.floor((e[v] - n) / o);
    h >= 0 && h < l && (s[h][0].push(t[v][0]), s[h][1].push(t[v][1]));
  }
  return s.map(([v, h]) => {
    if (v.length < 30) return null;
    (v.sort((x, T) => x - T), h.sort((x, T) => x - T));
    const u = (x, T) => x[Math.floor(T * (x.length - 1))];
    return [(u(v, 0.03) + u(v, 0.97)) / 2, (u(h, 0.03) + u(h, 0.97)) / 2];
  });
}
export function fillSmooth(t, e) {
  const n = t.length;
  for (let o = 1; o < n; o++) t[o] || (t[o] = t[o - 1]);
  for (let o = n - 2; o >= 0; o--) t[o] || (t[o] = t[o + 1]);
  return t[0]
    ? t.map((o, l) => {
        let s = 0,
          v = 0,
          h = 0;
        for (let u = Math.max(0, l - e); u <= Math.min(n - 1, l + e); u++) ((s += t[u][0]), (v += t[u][1]), h++);
        return [s / h, v / h];
      })
    : t.map(() => null);
}
export function legCenterline(t) {
  const e = t.length / 3,
    n = 5,
    o = 30;
  let l = -1e9;
  for (let x = 0; x < e; x++) l = Math.max(l, t[x * 3 + 2]);
  const s = Math.max(1, Math.ceil((l - o) / n) + 1),
    v = [],
    h = [];
  for (let x = 0; x < e; x++) {
    const T = t[x * 3 + 2];
    T >= o && (v.push([t[x * 3], t[x * 3 + 1]]), h.push(T));
  }
  const u = fillSmooth(binCenters(v, h, o, n, s), 3);
  return (x) => {
    if (!u[0]) return [0, 0];
    if (x <= 0) return [0, 0];
    if (x < o) {
      const C = x / o;
      return [u[0][0] * C, u[0][1] * C];
    }
    const T = (x - o) / n,
      b = Math.min(s - 1, Math.floor(T)),
      y = Math.min(s - 1, b + 1),
      L = Math.min(1, T - Math.floor(T));
    return [u[b][0] + (u[y][0] - u[b][0]) * L, u[b][1] + (u[y][1] - u[b][1]) * L];
  };
}
export function footAxis(t) {
  const e = t.length / 3,
    n = 6;
  let o = 1e9,
    l = -1e9;
  for (let x = 0; x < e; x++) t[x * 3 + 2] < 10 && ((o = Math.min(o, t[x * 3 + 1])), (l = Math.max(l, t[x * 3 + 1])));
  const s = Math.max(1, Math.ceil((l - o) / n) + 1),
    v = [],
    h = [];
  for (let x = 0; x < e; x++) t[x * 3 + 2] < 10 && (v.push([t[x * 3], t[x * 3 + 2]]), h.push(t[x * 3 + 1]));
  const u = fillSmooth(binCenters(v, h, o, n, s), 2);
  return (x) => {
    const T = Math.max(0, Math.min(s - 1, Math.floor((x - o) / n)));
    return u[T] || [0, -20];
  };
}
export function pctl(t, e) {
  const n = Float64Array.from(t).sort();
  return n[Math.min(n.length - 1, Math.max(0, Math.floor(e * (n.length - 1))))];
}
export function gauss1(t, e, n, o, l, s) {
  if (l <= 0) return;
  const v = Math.ceil(l * 2.5),
    h = [];
  for (let x = -v; x <= v; x++) h.push(Math.exp((-x * x) / (2 * l * l)));
  const u = new Float64Array(e);
  for (let x = 0; x < o; x++) {
    const T = x * (n === 1 ? e : 1),
      b = n;
    for (let y = 0; y < e; y++) {
      let L = 0,
        C = 0;
      for (let W = -v; W <= v; W++) {
        let U = y + W;
        if (s) U = ((U % e) + e) % e;
        else if (U < 0 || U >= e) continue;
        ((L += t[T + U * b] * h[W + v]), (C += h[W + v]));
      }
      u[y] = L / C;
    }
    for (let y = 0; y < e; y++) t[T + y * b] = u[y];
  }
}
export const STROKE_FONT = {
  0: [
    [0, 0, 4, 0, 4, 6, 0, 6, 0, 0],
    [0, 0, 4, 6],
  ],
  1: [
    [1, 5, 2, 6, 2, 0],
    [1, 0, 3, 0],
  ],
  2: [[0, 6, 4, 6, 4, 3, 0, 3, 0, 0, 4, 0]],
  3: [
    [0, 6, 4, 6, 4, 0, 0, 0],
    [1, 3, 4, 3],
  ],
  4: [
    [0, 6, 0, 3, 4, 3],
    [4, 6, 4, 0],
  ],
  5: [[4, 6, 0, 6, 0, 3, 4, 3, 4, 0, 0, 0]],
  6: [[4, 6, 0, 6, 0, 0, 4, 0, 4, 3, 0, 3]],
  7: [[0, 6, 4, 6, 4, 0]],
  8: [
    [0, 0, 4, 0, 4, 6, 0, 6, 0, 0],
    [0, 3, 4, 3],
  ],
  9: [[4, 3, 0, 3, 0, 6, 4, 6, 4, 0, 0, 0]],
  A: [
    [0, 0, 0, 4, 2, 6, 4, 4, 4, 0],
    [0, 3, 4, 3],
  ],
  B: [
    [0, 0, 0, 6, 3, 6, 4, 5, 4, 4, 3, 3, 0, 3],
    [3, 3, 4, 2, 4, 1, 3, 0, 0, 0],
  ],
  C: [[4, 6, 0, 6, 0, 0, 4, 0]],
  D: [[0, 0, 0, 6, 2, 6, 4, 4, 4, 2, 2, 0, 0, 0]],
  E: [
    [4, 6, 0, 6, 0, 0, 4, 0],
    [0, 3, 3, 3],
  ],
  F: [
    [4, 6, 0, 6, 0, 0],
    [0, 3, 3, 3],
  ],
  G: [[4, 6, 0, 6, 0, 0, 4, 0, 4, 3, 2, 3]],
  H: [
    [0, 6, 0, 0],
    [4, 6, 4, 0],
    [0, 3, 4, 3],
  ],
  I: [
    [1, 6, 3, 6],
    [2, 6, 2, 0],
    [1, 0, 3, 0],
  ],
  J: [[4, 6, 4, 0, 0, 0, 0, 2]],
  K: [
    [0, 6, 0, 0],
    [4, 6, 0, 3, 4, 0],
  ],
  L: [[0, 6, 0, 0, 4, 0]],
  M: [[0, 0, 0, 6, 2, 3, 4, 6, 4, 0]],
  N: [[0, 0, 0, 6, 4, 0, 4, 6]],
  O: [[0, 0, 4, 0, 4, 6, 0, 6, 0, 0]],
  P: [[0, 0, 0, 6, 4, 6, 4, 3, 0, 3]],
  Q: [
    [0, 0, 4, 0, 4, 6, 0, 6, 0, 0],
    [2.5, 1.5, 4.5, -0.5],
  ],
  R: [[0, 0, 0, 6, 4, 6, 4, 3, 0, 3, 4, 0]],
  S: [[4, 5, 3, 6, 1, 6, 0, 5, 0, 4, 1, 3, 3, 3, 4, 2, 4, 1, 3, 0, 1, 0, 0, 1]],
  T: [
    [0, 6, 4, 6],
    [2, 6, 2, 0],
  ],
  U: [[0, 6, 0, 0, 4, 0, 4, 6]],
  V: [[0, 6, 2, 0, 4, 6]],
  W: [[0, 6, 1, 0, 2, 3, 3, 0, 4, 6]],
  X: [
    [0, 6, 4, 0],
    [4, 6, 0, 0],
  ],
  Y: [
    [0, 6, 2, 3, 4, 6],
    [2, 3, 2, 0],
  ],
  Z: [[0, 6, 4, 6, 0, 0, 4, 0]],
  "-": [[1, 3, 3, 3]],
  "/": [[0, 0, 4, 6]],
  ".": [[2, 0, 2, 0.7]],
  ":": [
    [2, 1, 2, 1.7],
    [2, 4, 2, 4.7],
  ],
  "#": [
    [1, 0, 1.5, 6],
    [2.5, 0, 3, 6],
    [0, 2, 4, 2],
    [0, 4, 4, 4],
  ],
  "+": [
    [2, 1, 2, 5],
    [0, 3, 4, 3],
  ],
  "(": [[3, 6, 1.5, 4, 1.5, 2, 3, 0]],
  ")": [[1, 6, 2.5, 4, 2.5, 2, 1, 0]],
  _: [[0, 0, 4, 0]],
};
export function engraveText(t) {
  return String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split(/\n|\|/)
    .map((e) => e.replace(/[^0-9A-Z\-\/.:#+()_ ]/g, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}
export function meshCheck(t, e, n, o) {
  const l = e.length / 3,
    s = 3,
    v = 1024,
    h = 2048,
    u = new Float64Array(l * 6),
    x = new Map(),
    T = (U, j, Q) => U + v + (j + v) * h + (Q + v) * h * h;
  for (let U = 0; U < l; U++) {
    let j = [1e9, 1e9, 1e9],
      Q = [-1e9, -1e9, -1e9];
    for (let G = 0; G < 3; G++) {
      const O = e[U * 3 + G] * 3;
      for (let B = 0; B < 3; B++) {
        const Z = t[O + B];
        (Z < j[B] && (j[B] = Z), Z > Q[B] && (Q[B] = Z));
      }
    }
    for (let G = 0; G < 3; G++) ((u[U * 6 + G] = j[G]), (u[U * 6 + 3 + G] = Q[G]));
    for (let G = Math.floor(j[0] / s); G <= Math.floor(Q[0] / s); G++)
      for (let O = Math.floor(j[1] / s); O <= Math.floor(Q[1] / s); O++)
        for (let B = Math.floor(j[2] / s); B <= Math.floor(Q[2] / s); B++) {
          const Z = T(G, O, B);
          let rt = x.get(Z);
          (rt || ((rt = []), x.set(Z, rt)), rt.push(U));
        }
  }
  const b = (U, j) => {
      const Q = e[U * 3 + j] * 3;
      return [t[Q], t[Q + 1], t[Q + 2]];
    },
    y = (U, j, Q, G, O) => {
      const B = [j[0] - U[0], j[1] - U[1], j[2] - U[2]],
        Z = [G[0] - Q[0], G[1] - Q[1], G[2] - Q[2]],
        rt = [O[0] - Q[0], O[1] - Q[1], O[2] - Q[2]],
        D = [B[1] * rt[2] - B[2] * rt[1], B[2] * rt[0] - B[0] * rt[2], B[0] * rt[1] - B[1] * rt[0]],
        kt = Z[0] * D[0] + Z[1] * D[1] + Z[2] * D[2];
      if (Math.abs(kt) < 1e-12) return !1;
      const Bt = 1 / kt,
        wt = [U[0] - Q[0], U[1] - Q[1], U[2] - Q[2]],
        Kt = Bt * (wt[0] * D[0] + wt[1] * D[1] + wt[2] * D[2]);
      if (Kt <= 1e-6 || Kt >= 1) return !1;
      const Gt = [wt[1] * Z[2] - wt[2] * Z[1], wt[2] * Z[0] - wt[0] * Z[2], wt[0] * Z[1] - wt[1] * Z[0]],
        nt = Bt * (B[0] * Gt[0] + B[1] * Gt[1] + B[2] * Gt[2]);
      if (nt <= 1e-6 || Kt + nt >= 1 - 1e-6) return !1;
      const ge = Bt * (rt[0] * Gt[0] + rt[1] * Gt[1] + rt[2] * Gt[2]);
      return ge > 1e-6 && ge < 1 - 1e-6;
    },
    L = new Uint8Array(l);
  let C = 0;
  const W = [];
  for (const [U, j] of x) {
    if (j.length < 2) continue;
    const Q = (U % h) - v,
      G = (Math.floor(U / h) % h) - v,
      O = Math.floor(U / (h * h)) - v;
    for (let B = 0; B < j.length; B++)
      for (let Z = B + 1; Z < j.length; Z++) {
        const rt = j[B],
          D = j[Z];
        let kt = !1;
        for (let nt = 0; nt < 3; nt++)
          if (u[rt * 6 + nt] > u[D * 6 + 3 + nt] || u[D * 6 + nt] > u[rt * 6 + 3 + nt]) {
            kt = !0;
            break;
          }
        if (
          kt ||
          Math.floor(Math.max(u[rt * 6], u[D * 6]) / s) !== Q ||
          Math.floor(Math.max(u[rt * 6 + 1], u[D * 6 + 1]) / s) !== G ||
          Math.floor(Math.max(u[rt * 6 + 2], u[D * 6 + 2]) / s) !== O
        )
          continue;
        let Bt = !1;
        for (let nt = 0; nt < 3; nt++) for (let ge = 0; ge < 3; ge++) e[rt * 3 + nt] === e[D * 3 + ge] && (Bt = !0);
        if (Bt) continue;
        const wt = [b(rt, 0), b(rt, 1), b(rt, 2)],
          Kt = [b(D, 0), b(D, 1), b(D, 2)];
        let Gt = !1;
        for (let nt = 0; nt < 3 && !Gt; nt++)
          Gt = y(wt[nt], wt[(nt + 1) % 3], Kt[0], Kt[1], Kt[2]) || y(Kt[nt], Kt[(nt + 1) % 3], wt[0], wt[1], wt[2]);
        Gt &&
          (n && (n.length < 60 || o) && n.push([rt, D]),
          L[rt] || ((L[rt] = 1), C++, W.length < 200 && W.push(wt[0])),
          L[D] || ((L[D] = 1), C++));
      }
  }
  return { n: C, where: W };
}
export function nnGrid(t, e) {
  const n = t.length / 3,
    o = new Uint32Array(n);
  for (let h = 0; h < n; h++) o[h] = h;
  const l = [],
    s = (h, u, x) => {
      if (u - h <= 8) return (l.push([h, u, -1, 0]), l.length - 1);
      let T = [1e9, 1e9, 1e9],
        b = [-1e9, -1e9, -1e9];
      for (let G = h; G < u; G++) {
        const O = o[G] * 3;
        for (let B = 0; B < 3; B++) ((T[B] = Math.min(T[B], t[O + B])), (b[B] = Math.max(b[B], t[O + B])));
      }
      const y = [0, 1, 2].reduce((G, O) => (b[O] - T[O] > b[G] - T[G] ? O : G), 0),
        L = (h + u) >> 1;
      let C = h,
        W = u - 1;
      for (; C < W; ) {
        const G = t[o[(C + W) >> 1] * 3 + y];
        let O = C,
          B = W;
        for (; O <= B; ) {
          for (; t[o[O] * 3 + y] < G; ) O++;
          for (; t[o[B] * 3 + y] > G; ) B--;
          if (O <= B) {
            const Z = o[O];
            ((o[O] = o[B]), (o[B] = Z), O++, B--);
          }
        }
        if (L <= B) W = B;
        else if (L >= O) C = O;
        else break;
      }
      const U = l.length;
      l.push([h, u, y, t[o[L] * 3 + y], 0, 0]);
      const j = s(h, L, x + 1),
        Q = s(L, u, x + 1);
      return ((l[U][4] = j), (l[U][5] = Q), U);
    },
    v = s(0, n, 0);
  return (h, u, x, T) => {
    let b = (T || 1e9) ** 2,
      y = -1;
    const L = [h, u, x],
      C = (W) => {
        const U = l[W];
        if (U[2] < 0) {
          for (let O = U[0]; O < U[1]; O++) {
            const B = o[O] * 3,
              Z = (t[B] - h) ** 2 + (t[B + 1] - u) ** 2 + (t[B + 2] - x) ** 2;
            Z < b && ((b = Z), (y = o[O]));
          }
          return;
        }
        const j = L[U[2]] - U[3],
          Q = j < 0 ? U[4] : U[5],
          G = j < 0 ? U[5] : U[4];
        (C(Q), j * j < b && C(G));
      };
    return (C(v), [y, Math.sqrt(b)]);
  };
}
export function printXf(t, e) {
  if (t === "anat") return (v) => v;
  const n = t === "deitada" ? (v) => [v[0], -v[2], v[1]] : (v) => v;
  let o = [1e9, 1e9, 1e9],
    l = [-1e9, -1e9, -1e9];
  for (let v = 0; v < e.length; v += 3) {
    const h = n([e[v], e[v + 1], e[v + 2]]);
    for (let u = 0; u < 3; u++) ((o[u] = Math.min(o[u], h[u])), (l[u] = Math.max(l[u], h[u])));
  }
  const s = [(o[0] + l[0]) / 2, (o[1] + l[1]) / 2, o[2]];
  return (v) => {
    const h = n(v);
    return [h[0] - s[0], h[1] - s[1], h[2] - s[2]];
  };
}
export function generateShell(t, e, n, o) {
  const l = t.length / 3,
    s = {},
    v = performance.now();
  let h = null;
  if (o.dbg) {
    const a = normaisDeVertices(t, e),
      r = 4,
      d = new Map(),
      m = (i, p, f) => (i * 73856093) ^ (p * 19349663) ^ (f * 83492791);
    for (let i = 0; i < l; i++) {
      const p = m(Math.floor(t[i * 3] / r), Math.floor(t[i * 3 + 1] / r), Math.floor(t[i * 3 + 2] / r));
      let f = d.get(p);
      (f || ((f = []), d.set(p, f)), f.push(i));
    }
    ((s.dbg = []),
      (h = (i, p, f, g, c) => {
        let w = 0,
          A = null,
          F = 0;
        for (let R = 0; R < f * g; R++) {
          const H = p[R * 3],
            X = p[R * 3 + 1],
            Y = p[R * 3 + 2],
            I = Math.floor(H / r),
            N = Math.floor(X / r),
            q = Math.floor(Y / r);
          let st = 1 / 0,
            St = -1;
          for (let Xt = -1; Xt <= 1; Xt++)
            for (let Nt = -1; Nt <= 1; Nt++)
              for (let Ft = -1; Ft <= 1; Ft++) {
                const xt = d.get(m(I + Xt, N + Nt, q + Ft));
                if (xt)
                  for (const bt of xt) {
                    const vt = (t[bt * 3] - H) ** 2 + (t[bt * 3 + 1] - X) ** 2 + (t[bt * 3 + 2] - Y) ** 2;
                    vt < st && ((st = vt), (St = bt));
                  }
              }
          if (St < 0) continue;
          const Mt =
            (H - t[St * 3]) * a[St * 3] + (X - t[St * 3 + 1]) * a[St * 3 + 1] + (Y - t[St * 3 + 2]) * a[St * 3 + 2];
          (Mt < -1 && F++, Mt < w && ((w = Mt), (A = [Math.floor(R / g) - c, R % g, +Y.toFixed(0)])));
        }
        s.dbg.push([i, +w.toFixed(1), F, A]);
      }));
  }
  const u = [],
    x = [];
  for (let a = 0; a < l; a++) t[a * 3 + 2] < -5 && (u.push(t[a * 3 + 2]), x.push(t[a * 3 + 1]));
  const T = pctl(u, 0.005),
    b = pctl(x, 0.995),
    y = Math.max(n.M1[1], n.M5[1]),
    L = n.CA[1];
  let C = b;
  {
    const r = L - 5,
      d = Math.max(1, Math.ceil((b - r) / 2.5) + 1),
      m = new Float64Array(d).fill(1e9),
      i = new Float64Array(d).fill(-1e9),
      p = new Float64Array(d);
    for (let g = 0; g < l; g++) {
      if (t[g * 3 + 2] > 0) continue;
      const w = Math.floor((t[g * 3 + 1] - r) / 2.5);
      w < 0 || w >= d || ((m[w] = Math.min(m[w], t[g * 3])), (i[w] = Math.max(i[w], t[g * 3])), p[w]++);
    }
    let f = 0;
    for (let g = 0; g < d; g++) p[g] >= 8 && (f = Math.max(f, i[g] - m[g]));
    for (let g = 0; g < d; g++) p[g] >= 8 && i[g] - m[g] >= 0.3 * f && (C = r + (g + 1) * 2.5);
    C = Math.min(Math.max(C, y + 10), Math.max(b, y + 10));
  }
  const W = [];
  {
    const r = new Map();
    for (let d = 0; d < l; d++) {
      const m = t[d * 3 + 2];
      if (m > 0 || m > T + 45) continue;
      const i = t[d * 3 + 1];
      if (i < y - 25) continue;
      const p = Math.floor(t[d * 3] / 2);
      let f = r.get(p);
      (f || ((f = []), r.set(p, f)),
        f.length < 3 ? (f.push(i), f.sort((g, c) => c - g)) : i > f[2] && ((f[2] = i), f.sort((g, c) => c - g)));
    }
    for (const [d, m] of r) m.length >= 2 && W.push([(d + 0.5) * 2, m[m.length - 1]]);
    W.sort((d, m) => d[0] - m[0]);
  }
  const U = W.reduce((a, r) => Math.max(a, r[1]), -1e9),
    j = o.toe === "dedos" ? Math.max(C, Math.min(U, b + 2)) : Math.min(C, y + o.metExt);
  s.yToeReal = U;
  const Q = pctl(x, 0.005),
    G = C - Q,
    O = Math.min(y, Q + o.plateFrac * G);
  ((s.footLen = G), (s.yPlate = O));
  let B,
    Z,
    rt,
    D = null;
  {
    const r = Q - 4,
      d = j + (o.toe === "dedos" ? o.toeMargin : 0),
      m = Math.ceil((d + 4 - r) / 2) + 1,
      i = (_) => r + (_ + 0.5) * 2,
      p = (_) => Math.max(0, Math.min(m - 1, Math.floor((_ - r) / 2))),
      f = Array.from({ length: m }, () => []);
    for (let _ = 0; _ < l; _++) {
      const it = t[_ * 3 + 2];
      if (it > 0 || it > T + 45) continue;
      const z = t[_ * 3 + 1];
      z < r || z > j || f[p(z)].push(t[_ * 3]);
    }
    const g = (_, it) => _[Math.max(0, Math.min(_.length - 1, Math.floor(it * (_.length - 1))))],
      c = new Float64Array(m).fill(NaN),
      w = new Float64Array(m).fill(NaN);
    f.forEach((_, it) => {
      _.length >= 8 && (_.sort((z, P) => z - P), (c[it] = g(_, 0.02)), (w[it] = g(_, 0.98)));
    });
    const A = (_) => {
      let it = _.findIndex(Number.isFinite);
      if (it < 0) return !1;
      for (let P = 0; P < it; P++) _[P] = _[it];
      let z = it;
      for (let P = it + 1; P < _.length; P++)
        if (Number.isFinite(_[P])) {
          for (let lt = z + 1; lt < P; lt++) _[lt] = _[z] + ((_[P] - _[z]) * (lt - z)) / (P - z);
          z = P;
        }
      for (let P = z + 1; P < _.length; P++) _[P] = _[z];
      return !0;
    };
    if (!A(c) || !A(w)) throw new Error("Não encontrei o contorno do pé no scan. Confira os pontos CA, M1 e M5.");
    (gauss1(c, m, 1, 1, o.olSig, !1), gauss1(w, m, 1, 1, o.olSig, !1));
    let F = p(O);
    for (let _ = p(O - 15); _ <= p(O + 5); _++) w[_] - c[_] > w[F] - c[F] && (F = _);
    const R = o.plateMargin,
      H = o.toe === "dedos" ? o.tipMargin : 0,
      X = O - 15,
      Y = [];
    for (let _ = 0; _ < l; _++) {
      const it = t[_ * 3 + 2];
      if (it > 0 || it > T + o.toeZ) continue;
      const z = t[_ * 3 + 1];
      if (z < X) continue;
      const P = t[_ * 3],
        lt = p(Math.min(z, j));
      P < c[lt] - o.toeSide || P > w[lt] + o.toeSide || (o.toe !== "dedos" && z > j) || Y.push([P, z]);
    }
    const I = (_) => {
      _.sort((lt, V) => lt[0] - V[0] || lt[1] - V[1]);
      const it = (lt, V, J) => (V[0] - lt[0]) * (J[1] - lt[1]) - (V[1] - lt[1]) * (J[0] - lt[0]),
        z = [],
        P = [];
      for (const lt of _) {
        for (; z.length >= 2 && it(z[z.length - 2], z[z.length - 1], lt) <= 0; ) z.pop();
        z.push(lt);
      }
      for (let lt = _.length - 1; lt >= 0; lt--) {
        const V = _[lt];
        for (; P.length >= 2 && it(P[P.length - 2], P[P.length - 1], V) <= 0; ) P.pop();
        P.push(V);
      }
      return (z.pop(), P.pop(), z.concat(P));
    };
    let N = null;
    if (Y.length >= 20) {
      const _ = I(Y),
        it = [];
      for (const [z, P] of _)
        for (let lt = 0; lt < 24; lt++) {
          const V = (lt / 24) * 2 * Math.PI,
            J = Math.cos(V),
            pt = Math.sin(V);
          it.push([z + R * J, P + (pt > 0 ? Math.max(R, H) : R) * pt]);
        }
      N = I(it);
    }
    const q = (_) => {
      if (!N) return null;
      let it = 1 / 0,
        z = -1 / 0;
      for (let P = 0; P < N.length; P++) {
        const lt = N[P],
          V = N[(P + 1) % N.length];
        if ((lt[1] - _) * (V[1] - _) > 0 || lt[1] === V[1]) continue;
        const J = lt[0] + ((V[0] - lt[0]) * (_ - lt[1])) / (V[1] - lt[1]);
        ((it = Math.min(it, J)), (z = Math.max(z, J)));
      }
      return it <= z ? [it, z] : null;
    };
    if (N && o.tipShape === "elipse") {
      let _ = -1e9;
      for (const [, yt] of Y) _ = Math.max(_, yt);
      const it = (yt, jt) => {
          let zt = 0,
            Jt = 0,
            $t = 0;
          for (const [ce, pe] of Y) pe >= yt && pe <= jt && ((zt += ce), (Jt += pe), $t++);
          return $t > 5 ? [zt / $t, Jt / $t] : null;
        },
        z = it(O - 15, O),
        P = it(_ - 25, _);
      let lt = 0;
      z &&
        P &&
        P[1] - z[1] > 10 &&
        (lt = Math.max(-o.tipMaxAng / DEG, Math.min(o.tipMaxAng / DEG, Math.atan2(P[0] - z[0], P[1] - z[1]))));
      const V = Math.sin(lt),
        J = Math.cos(lt),
        pt = (yt) => yt[0] * J - yt[1] * V,
        Yt = (yt) => yt[0] * V + yt[1] * J,
        Rt = (yt, jt) => [yt * J + jt * V, -yt * V + jt * J],
        ut = N.map((yt) => [pt(yt), Yt(yt)]);
      let ft = -1e9;
      for (const yt of ut) ft = Math.max(ft, yt[1]);
      let k = 1e9,
        E = -1e9;
      for (const yt of ut) yt[1] > ft - 30 && ((k = Math.min(k, yt[0])), (E = Math.max(E, yt[0])));
      const et = ft - o.tipDepth * (E - k);
      let dt = 1 / 0,
        ht = -1 / 0;
      for (let yt = 0; yt < ut.length; yt++) {
        const jt = ut[yt],
          zt = ut[(yt + 1) % ut.length];
        if ((jt[1] - et) * (zt[1] - et) > 0 || jt[1] === zt[1]) continue;
        const Jt = jt[0] + ((zt[0] - jt[0]) * (et - jt[1])) / (zt[1] - jt[1]);
        ((dt = Math.min(dt, Jt)), (ht = Math.max(ht, Jt)));
      }
      if (dt < ht) {
        const yt = ht - dt;
        let jt = ut[0];
        for (const he of ut) he[1] > jt[1] && (jt = he);
        const zt = Math.min(ht - o.tipApex * yt, Math.max(dt + o.tipApex * yt, jt[0]));
        let Jt = zt - dt,
          $t = ht - zt,
          ce = 1;
        for (const [he, xe] of ut) {
          if (xe <= et) continue;
          const be = he - zt;
          be < 0 ? (Jt = Math.max(Jt, -be)) : ($t = Math.max($t, be));
        }
        ((Jt *= 1 + o.tipWide), ($t *= 1 + o.tipWide));
        for (const [he, xe] of ut) {
          if (xe <= et) continue;
          const be = he - zt,
            Ee = Math.min(0.995, Math.abs(be) / (be < 0 ? Jt : $t));
          ce = Math.max(ce, (xe - et) / Math.sqrt(1 - Ee * Ee));
        }
        const pe = ut.filter((he) => he[1] <= et).map((he) => Rt(he[0], he[1]));
        for (let he = 0; he <= 24; he++) {
          const xe = he / 24,
            be = Math.sqrt(Math.max(0, 1 - xe * xe));
          (pe.push(Rt(zt - Jt * be, et + ce * xe)), pe.push(Rt(zt + $t * be, et + ce * xe)));
        }
        (ce <= 1.5 * (ft - et) + 6 ? (N = I(pe)) : (s.tipFallback = !0),
          (s.tipCap = { ang: +(lt * DEG).toFixed(1), aL: +Jt.toFixed(1), aR: +$t.toFixed(1), b: +ce.toFixed(1) }));
      }
    }
    let st = d;
    if (N) {
      st = -1e9;
      for (const _ of N) st = Math.max(st, _[1]);
    }
    const St = () => st;
    D = st;
    {
      let _ = 1e9,
        it = -1e9;
      if (N) for (const z of N) ((_ = Math.min(_, z[0])), (it = Math.max(it, z[0])));
      s.plateFront = [+_.toFixed(1), +it.toFixed(1), +st.toFixed(1)];
    }
    ((B = (_) => {
      const it = p(Math.min(_, j));
      let z = c[it] - R,
        P = w[it] + R;
      if (!N) return (_ > O && ((z = Math.min(z, c[F] - R)), (P = Math.max(P, w[F] + R))), [z, P]);
      if (_ < X + 5) return [z, P];
      const lt = q(Math.min(_, st - 0.01));
      if (!lt) return [z, P];
      const V = smooth(X + 5, O + 15, _);
      if (((z += (lt[0] - z) * V), (P += (lt[1] - P) * V), _ > st)) {
        const J = (z + P) / 2;
        return [J - 0.5, J + 0.5];
      }
      return [z, P];
    }),
      (s.outline = []));
    for (let _ = Q - 4; _ <= st + 1; _ += 1) {
      const it = B(_);
      s.outline.push([_, it[0], it[1]]);
    }
    ((s.YF = N || []), (s.fp = []), (s.yPlateL = O));
    {
      let _ = 0,
        it = 0,
        z = 0;
      for (let P = 0; P < l; P++) {
        const lt = t[P * 3 + 2],
          V = t[P * 3 + 1],
          J = t[P * 3];
        if (lt > 0 || lt > T + 30 || V < O - 10) continue;
        it++;
        const pt = B(V),
          Yt = Math.max(pt[0] - J, J - pt[1], V - St());
        Yt > 0.5 &&
          (_++,
          Yt > z &&
            ((z = Yt),
            (s.toeOutAt = [
              +J.toFixed(0),
              pt.map((Rt) => +Rt.toFixed(0)),
              +(J - (pt[0] + pt[1]) / 2).toFixed(0),
              +(V - O).toFixed(0),
              +(lt - T).toFixed(0),
              pt[0] - J > 0.5 ? "medial/esq" : J - pt[1] > 0.5 ? "dir" : "frente",
            ])));
      }
      s.toeOut = [_, it, +z.toFixed(1)];
    }
    const Mt = 2;
    let Xt = 1e9,
      Nt = -1e9;
    for (let _ = 0; _ < m; _++) ((Xt = Math.min(Xt, c[_])), (Nt = Math.max(Nt, w[_])));
    ((Xt -= 12), (Nt += 12));
    const Ft = Math.ceil((Nt - Xt) / Mt) + 1,
      xt = m,
      bt = new Float64Array(Ft * xt).fill(1 / 0),
      vt = (_) => Math.max(0, Math.min(Ft - 1, Math.floor((_ - Xt) / Mt)));
    for (let _ = 0; _ < l; _++) {
      const it = t[_ * 3 + 2];
      if (it > 0) continue;
      const z = t[_ * 3 + 1];
      if (z < r || z > j + 2) continue;
      const P = p(z) * Ft + vt(t[_ * 3]);
      it < bt[P] && (bt[P] = it);
    }
    const ct = new Float64Array(bt.length).fill(NaN);
    for (let _ = 0; _ < xt; _++)
      for (let it = 0; it < Ft; it++) {
        const z = bt[_ * Ft + it];
        if (!Number.isFinite(z)) continue;
        let P = 1 / 0;
        for (let lt = -3; lt <= 3; lt++)
          for (let V = -3; V <= 3; V++) {
            const J = _ + lt,
              pt = it + V;
            J < 0 || J >= xt || pt < 0 || pt >= Ft || (P = Math.min(P, bt[J * Ft + pt]));
          }
        z <= P + o.plantarTol && (ct[_ * Ft + it] = z);
      }
    for (let _ = 0; _ < 400; _++) {
      let it = 0;
      const z = Float64Array.from(ct);
      for (let P = 0; P < xt; P++)
        for (let lt = 0; lt < Ft; lt++) {
          const V = P * Ft + lt;
          if (Number.isFinite(ct[V])) continue;
          let J = 0,
            pt = 0;
          for (const [Yt, Rt] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const ut = lt + Yt,
              ft = P + Rt;
            if (ut < 0 || ft < 0 || ut >= Ft || ft >= xt) continue;
            const k = ct[ft * Ft + ut];
            Number.isFinite(k) && ((J += k), pt++);
          }
          pt && ((z[V] = J / pt), it++);
        }
      if ((ct.set(z), !it)) break;
    }
    for (let _ = 0; _ < ct.length; _++) Number.isFinite(ct[_]) || (ct[_] = T);
    {
      const _ = Float64Array.from(ct);
      if ((gauss1(ct, Ft, 1, xt, o.plantarSig, !1), gauss1(ct, xt, Ft, Ft, o.plantarSig, !1), o.envIt > 0)) {
        {
          const it = Float64Array.from(_);
          for (let z = 0; z < xt; z++)
            for (let P = 0; P < Ft; P++) {
              let lt = it[z * Ft + P];
              for (let V = -1; V <= 1; V++)
                for (let J = -1; J <= 1; J++) {
                  const pt = z + V,
                    Yt = P + J;
                  pt < 0 || pt >= xt || Yt < 0 || Yt >= Ft || (lt = Math.min(lt, it[pt * Ft + Yt]));
                }
              _[z * Ft + P] = lt;
            }
          (gauss1(_, Ft, 1, xt, o.envRefSig, !1), gauss1(_, xt, Ft, Ft, o.envRefSig, !1));
        }
        for (let it = 0; it < o.envIt; it++) {
          for (let z = 0; z < ct.length; z++) ct[z] > _[z] + o.envTol && (ct[z] = _[z] + o.envTol);
          (gauss1(ct, Ft, 1, xt, 1, !1), gauss1(ct, xt, Ft, Ft, 1, !1));
        }
      }
    }
    const mt = o.archFill,
      Ct = new Float64Array(xt);
    for (let _ = 0; _ < xt; _++) {
      const it = [c[_], w[_]];
      let z = 1 / 0;
      for (let P = vt(it[0]); P <= vt(it[1]); P++) z = Math.min(z, ct[_ * Ft + P]);
      Ct[_] = Number.isFinite(z) ? z : T;
    }
    const Wt = [];
    for (let _ = 0; _ < xt; _++) {
      const it = [_, Ct[_]];
      for (; Wt.length >= 2; ) {
        const [z, P] = [Wt[Wt.length - 2], Wt[Wt.length - 1]];
        if ((P[0] - z[0]) * (it[1] - z[1]) - (P[1] - z[1]) * (it[0] - z[0]) <= 0) Wt.pop();
        else break;
      }
      Wt.push(it);
    }
    const se = new Float64Array(xt);
    {
      let _ = 0;
      for (let it = 0; it < xt; it++) {
        for (; _ < Wt.length - 2 && Wt[_ + 1][0] < it; ) _++;
        const [z, P] = [Wt[_], Wt[Math.min(_ + 1, Wt.length - 1)]];
        se[it] = P[0] === z[0] ? z[1] : z[1] + ((P[1] - z[1]) * (it - z[0])) / (P[0] - z[0]);
      }
    }
    const ne = new Float64Array(xt);
    for (let _ = 0; _ < xt; _++) ne[_] = se[_] + (1 - mt) * (Ct[_] - se[_]);
    const de = new Float64Array(ct.length);
    for (let _ = 0; _ < xt; _++)
      for (let it = 0; it < Ft; it++) de[_ * Ft + it] = ne[_] + (1 - mt) * (ct[_ * Ft + it] - Ct[_]);
    const ie = p(O);
    for (let _ = 0; _ < xt; _++) {
      const it = smooth(O - 4, O + 8, i(_));
      if (!(it <= 0)) {
        for (let z = 0; z < Ft; z++) de[_ * Ft + z] += (de[ie * Ft + z] - de[_ * Ft + z]) * it;
        ne[_] += (ne[ie] - ne[_]) * it;
      }
    }
    ((Z = (_, it) => {
      const z = Math.max(0, Math.min(Ft - 1.001, (_ - Xt) / Mt - 0.5)),
        P = Math.max(0, Math.min(xt - 1.001, (it - r) / 2 - 0.5)),
        lt = Math.floor(z),
        V = Math.floor(P),
        J = z - lt,
        pt = P - V,
        Yt = (Rt, ut) => de[ut * Ft + Rt];
      return (
        (Yt(lt, V) * (1 - J) + Yt(lt + 1, V) * J) * (1 - pt) + (Yt(lt, V + 1) * (1 - J) + Yt(lt + 1, V + 1) * J) * pt
      );
    }),
      (rt = (_) => {
        const it = Math.max(0, Math.min(xt - 1.001, (_ - r) / 2 - 0.5)),
          z = Math.floor(it),
          P = it - z;
        return ne[z] * (1 - P) + ne[z + 1] * P;
      }),
      (s.archMax = Math.max(...Array.from(Ct, (_, it) => _ - se[it]))));
  }
  ((s.zFloor = T), (s.yToe = j));
  const kt = legCenterline(t),
    Bt = footAxis(t),
    wt = [];
  if (!(o.top >= 25))
    throw new Error(
      `A borda superior ficou a ${Math.round(o.top)} mm do tornozelo (mínimo 25 mm). Confira o ponto PX ou o campo "Altura da borda superior".`,
    );
  o = Object.assign({}, o, { bendZ: Math.min(o.bendZ, Math.max(8, o.top - 25)) });
  {
    let a = 0,
      r = 0,
      d = 0,
      m = 0,
      i = 0,
      p = 0,
      f = 0;
    for (let R = o.bendZ; R <= o.top + 8; R += 2) {
      const H = kt(R);
      (a++, (r += R), (d += H[0]), (m += H[1]), (i += R * R), (p += R * H[0]), (f += R * H[1]));
    }
    const g = a * i - r * r || 1,
      c = (a * p - r * d) / g,
      w = (d - c * r) / a,
      A = (a * f - r * m) / g,
      F = (m - A * r) / a;
    for (let R = o.top + 8; R >= o.bendZ; R -= 2) wt.push([c * R + w, A * R + F, R]);
    s.legTilt = Math.atan(Math.hypot(c, A)) * DEG;
  }
  const Kt = wt[wt.length - 1],
    Gt = Math.max(10, Math.min(o.bendY, 0.4 * j)),
    nt = Bt(Gt),
    ge = [nt[0], Gt, Math.min(nt[1], Kt[2] - 10)],
    gt = (a) => {
      const r = Bt(Math.min(a, O));
      let d = r[0],
        m = r[1];
      const i = smooth(O - 25, O, a);
      if (i > 0) {
        const p = B(Math.min(a, O)),
          f = rt(a) + o.plateCH;
        ((d += ((p[0] + p[1]) / 2 - d) * i), (m += (f - m) * i));
      }
      return [d, a, m];
    },
    Ut = Math.min(Gt + 45, Math.max(Gt + 15, qt()));
  function qt() {
    return Math.max(Gt + 10, D != null ? D - 1 : j + (o.toe === "dedos" ? o.toeMargin : 0));
  }
  const ot = gt(Ut);
  let At = V3.norm([0, Ut - Gt, Math.max(-0.6 * (Ut - Gt), Math.min(0.15 * (Ut - Gt), ot[2] - ge[2]))]);
  const Vt = 1 * V3.len(V3.sub(ge, Kt)),
    oe = [0, 0, -Vt],
    It = V3.mul(At, Vt);
  s.footDir = At;
  for (let a = 1; a < 20; a++) {
    const r = a / 20,
      d = r * r,
      m = d * r,
      i = 2 * m - 3 * d + 1,
      p = m - 2 * d + r,
      f = -2 * m + 3 * d,
      g = m - d;
    wt.push([0, 1, 2].map((c) => i * Kt[c] + p * oe[c] + f * ge[c] + g * It[c]));
  }
  const Zt = wt.length,
    Me = qt();
  for (let a = Gt; a <= Me + 1; a += 2) {
    const r = gt(a);
    ((r[2] = Math.min(r[2], ge[2])), wt.push(r));
  }
  const _t = wt.map((a) => a.slice());
  for (let a = 0; a < o.spineSm; a++)
    for (let r = 2; r < wt.length - 2; r++)
      for (let d = 0; d < 3; d++) _t[r][d] = (_t[r - 2][d] + _t[r - 1][d] + _t[r][d] + _t[r + 1][d] + _t[r + 2][d]) / 5;
  const ue = [0];
  for (let a = 1; a < _t.length; a++) ue.push(ue[a - 1] + V3.len(V3.sub(_t[a], _t[a - 1])));
  const De = ue[wt.findIndex((a) => a === Kt) >= 0 ? wt.indexOf(Kt) : Zt - 20],
    Qt = ue[Zt],
    ae = o.step,
    Et = Math.floor(ue[ue.length - 1] / ae) + 1,
    Pt = [],
    te = [];
  for (let a = 0, r = 0; a < Et; a++) {
    const d = a * ae;
    for (; r < ue.length - 2 && ue[r + 1] < d; ) r++;
    const m = (d - ue[r]) / (ue[r + 1] - ue[r] || 1);
    (Pt.push(V3.add(_t[r], V3.mul(V3.sub(_t[r + 1], _t[r]), Math.min(1, m)))), te.push(d));
  }
  const ye = Pt.map((a, r) => V3.norm(V3.sub(Pt[Math.min(Et - 1, r + 1)], Pt[Math.max(0, r - 1)])));
  {
    const a = [];
    for (let r = 1; r < Et; r++) a.push(+(Math.acos(Math.min(1, V3.dot(ye[r - 1], ye[r]))) * DEG).toFixed(1));
    s.spineK = a;
  }
  const Ne = [],
    Ge = [];
  Ne[0] = V3.norm(V3.rej([0, -1, 0], ye[0]));
  for (let a = 1; a < Et; a++) {
    const r = V3.cross(ye[a - 1], ye[a]),
      d = V3.len(r);
    let m = Ne[a - 1];
    if (d > 1e-9) {
      const i = Math.atan2(d, V3.dot(ye[a - 1], ye[a]));
      m = V3.rot(m, V3.mul(r, 1 / d), i);
    }
    Ne[a] = V3.norm(V3.rej(m, ye[a]));
  }
  for (let a = 0; a < Et; a++) Ge[a] = V3.cross(ye[a], Ne[a]);
  const tt = o.nb,
    Qe = 360 / tt,
    Tt = new Float64Array(Et * tt).fill(NaN),
    Ue = new Float64Array(l);
  let co = o.rLim;
  const fo = [];
  {
    const a = pl(n, "CA");
    for (let r = 0; r < l; r++) t[r * 3 + 1] < a[1] + 15 && t[r * 3 + 2] < T + 50 && fo.push(r);
  }
  let uo = 0;
  for (let a = 0; a < Et; a++) {
    const r = Pt[a],
      d = ye[a],
      m = Ne[a],
      i = Ge[a];
    for (let c = 0; c < l; c++)
      Ue[c] = (t[c * 3] - r[0]) * d[0] + (t[c * 3 + 1] - r[1]) * d[1] + (t[c * 3 + 2] - r[2]) * d[2];
    const p = (c, w) => {
      let A = Math.floor((Math.atan2(w, c) * DEG + 180) / Qe);
      return A >= tt ? tt - 1 : A;
    };
    let f = null;
    {
      for (const c of fo) {
        if (Math.abs(Ue[c]) > 4) continue;
        const w = t[c * 3] - r[0],
          A = t[c * 3 + 1] - r[1],
          F = t[c * 3 + 2] - r[2],
          R = w * m[0] + A * m[1] + F * m[2],
          H = w * i[0] + A * i[1] + F * i[2],
          X = Math.hypot(R, H);
        if (X <= co * 0.85) continue;
        f || (f = new Float64Array(tt));
        const Y = p(R, H);
        X > f[Y] && (f[Y] = X);
      }
      if (f) {
        uo++;
        const c = Math.round(tt / 16),
          w = new Float64Array(tt);
        for (let A = 0; A < tt; A++) {
          let F = 0;
          for (let R = -c; R <= c; R++) F = Math.max(F, f[(A + R + tt) % tt]);
          w[A] = F;
        }
        f = w;
      }
    }
    const g = (c, w, A) => {
      const F = c - r[0],
        R = w - r[1],
        H = A - r[2],
        X = F * m[0] + R * m[1] + H * m[2],
        Y = F * i[0] + R * i[1] + H * i[2],
        I = Math.hypot(X, Y),
        N = p(X, Y);
      if (I > co && !(f && I <= f[N] + 6)) return;
      const q = a * tt + N;
      Tt[q] >= I || (Tt[q] = I);
    };
    for (let c = 0; c < e.length; c += 3) {
      const w = e[c],
        A = e[c + 1],
        F = e[c + 2],
        R = Ue[w],
        H = Ue[A],
        X = Ue[F];
      if ((R > 0 && H > 0 && X > 0) || (R < 0 && H < 0 && X < 0)) continue;
      const Y = [];
      for (const [I, N, q, st] of [
        [w, A, R, H],
        [A, F, H, X],
        [F, w, X, R],
      ])
        if (q <= 0 != st <= 0) {
          const St = q / (q - st);
          Y.push([
            t[I * 3] + (t[N * 3] - t[I * 3]) * St,
            t[I * 3 + 1] + (t[N * 3 + 1] - t[I * 3 + 1]) * St,
            t[I * 3 + 2] + (t[N * 3 + 2] - t[I * 3 + 2]) * St,
          ]);
        }
      Y.length === 2 &&
        (g(...Y[0]), g(...Y[1]), g((Y[0][0] + Y[1][0]) / 2, (Y[0][1] + Y[1][1]) / 2, (Y[0][2] + Y[1][2]) / 2));
    }
  }
  s.heelRows = uo;
  const ho = o.dbg ? Float64Array.from(Tt) : null,
    Ve = new Uint8Array(Et),
    mo = new Float64Array(Et);
  o.dbg && (s.Rst = s.Rst || []).push(["flap?", +Tt[113 * tt + 67].toFixed(1), +Tt[113 * tt + 72].toFixed(1)]);
  for (let a = 0; a < Et; a++) {
    let r = 0;
    for (let d = 0; d < tt; d++) Tt[a * tt + d] >= 0 && r++;
    mo[a] = r / tt;
  }
  {
    const a = (d) => mo[d] >= 0.6;
    let r = 0;
    for (; r < Et && !a(r); ) r++;
    if (r > 0 && r < Et) for (let d = 0; d < r; d++) for (let m = 0; m < tt; m++) Tt[d * tt + m] = Tt[r * tt + m];
    s.topCopied = r;
  }
  for (let a = 0; a < Et; a++) {
    const r = [];
    for (let i = 0; i < tt; i++) {
      const p = Tt[a * tt + i];
      p >= 0 && r.push(p);
    }
    if (r.length < tt * 0.25) continue;
    r.sort((i, p) => i - p);
    const d = r[r.length >> 1];
    {
      const i = Math.round(tt / 24),
        p = new Float64Array(tt);
      for (let f = 0; f < tt; f++) {
        const g = [];
        for (let c = -i; c <= i; c++) {
          const w = Tt[a * tt + ((f + c + tt) % tt)];
          w >= 0 && g.push(w);
        }
        (g.sort((c, w) => c - w), (p[f] = g.length ? g[g.length >> 1] : NaN));
      }
      for (let f = 0; f < tt; f++) {
        const g = Tt[a * tt + f];
        g >= 0 && (g > o.flapLoc * p[f] + 5 || (g > 3 * d && g > o.flapMedLoc * p[f] + 5)) && (Tt[a * tt + f] = NaN);
      }
    }
    const m = [];
    for (let i = 0; i < tt; i++) Tt[a * tt + i] >= 0 && m.push(i);
    if (!(m.length < tt * 0.25)) {
      Ve[a] = 1;
      for (let i = 0; i < tt; i++) {
        if (Tt[a * tt + i] >= 0) continue;
        let p = -1,
          f = -1;
        for (
          let g = 1;
          g < tt &&
          (p < 0 && Tt[a * tt + ((i - g + tt) % tt)] >= 0 && (p = g),
          f < 0 && Tt[a * tt + ((i + g) % tt)] >= 0 && (f = g),
          !(p > 0 && f > 0));
          g++
        );
        Tt[a * tt + i] = (Tt[a * tt + ((i - p + tt) % tt)] * f + Tt[a * tt + ((i + f) % tt)] * p) / (p + f);
      }
    }
  }
  o.dbg && (s.Rst = s.Rst || []).push(["filled", +Tt[113 * tt + 67].toFixed(1), +Tt[113 * tt + 72].toFixed(1)]);
  for (let a = 0; a < Et; a++) {
    if (Ve[a]) continue;
    let r = a - 1,
      d = a + 1;
    for (; r >= 0 && !Ve[r]; ) r--;
    for (; d < Et && !Ve[d]; ) d++;
    for (let m = 0; m < tt; m++) {
      const i = r >= 0 ? Tt[r * tt + m] : NaN,
        p = d < Et ? Tt[d * tt + m] : NaN;
      Tt[a * tt + m] = r < 0 ? p : d >= Et ? i : (i * (d - a) + p * (a - r)) / (d - r);
    }
  }
  o.dbg && (s.Rst = s.Rst || []).push(["rowfill", +Tt[113 * tt + 67].toFixed(1), +Tt[113 * tt + 72].toFixed(1)]);
  {
    const a = (d) => {
      let m = 0;
      for (let i = 0; i < tt; i++) m += Tt[d * tt + i];
      return m / tt;
    };
    let r = 0;
    for (; r < Et - 12; ) {
      let d = 0;
      for (let m = r; m <= r + 10; m++) d = Math.max(d, a(m));
      if (a(r) >= 0.85 * d) break;
      r++;
    }
    if (r > 0 && Pt[r][2] > 40) {
      for (let d = 0; d < r; d++) for (let m = 0; m < tt; m++) Tt[d * tt + m] = Tt[r * tt + m];
      s.topCopied = r;
    }
  }
  o.dbg && (s.Rst = s.Rst || []).push(["topcut", +Tt[113 * tt + 67].toFixed(1), +Tt[113 * tt + 72].toFixed(1)]);
  const Pe = Pt.findIndex((a, r) => r > 0 && te[r] > Qt && a[1] >= O);
  if (Pe > 0) for (let a = Pe + 1; a < Et; a++) for (let r = 0; r < tt; r++) Tt[a * tt + r] = Tt[Pe * tt + r];
  o.dbg && (s.Rst = s.Rst || []).push(["met", +Tt[113 * tt + 67].toFixed(1), +Tt[113 * tt + 72].toFixed(1)]);
  {
    let a = 0;
    for (let r = 0; r < Et; r++) {
      if (te[r] < Qt) continue;
      const d = Pt[r][1],
        m = B(d),
        i = smooth(Qt - 5, Qt + 25, te[r]);
      if (d > O - 5) {
        const q = smooth(O - 5, O + 10, d);
        for (let st = 0; st < tt; st++) Tt[r * tt + st] *= 1 - q;
      }
      const p = m[0],
        f = m[1],
        g = Math.max(0.5, Math.min(o.boxR, (f - p) / 2 - 0.5)),
        c = (q) => Z(Math.min(Math.max(q, p + g), f - g), d);
      let w = -1e9;
      const A = [];
      for (let q = p; q <= f + 1e-9; q += 0.4) {
        const st = Math.min(q - p, f - q),
          St = st < g ? g - Math.sqrt(Math.max(0, g * g - (g - st) ** 2)) : 0,
          Mt = c(q) + St;
        (A.push([q, Mt, 1]), (w = Math.max(w, c(q) + o.boxH)));
      }
      const F = c(f) + g,
        R = c(p) + g;
      for (let q = F; q <= w; q += 0.4) A.push([f, q, q < c(f) + o.sideKeep ? 1 : 0]);
      for (let q = f; q >= p; q -= 0.4) A.push([q, w, 0]);
      for (let q = w; q >= R; q -= 0.4) A.push([p, q, q < c(p) + o.sideKeep ? 1 : 0]);
      const H = new Float64Array(tt),
        X = new Float64Array(tt),
        Y = Pt[r],
        I = Ne[r],
        N = Ge[r];
      for (const [q, st, St] of A) {
        const Mt = q - Y[0],
          Xt = st - Y[2],
          Nt = Mt * I[0] + Xt * I[2],
          Ft = Mt * N[0] + Xt * N[2],
          xt = Math.hypot(Nt, Ft);
        let bt = Math.floor((Math.atan2(Ft, Nt) * DEG + 180) / Qe);
        (bt >= tt && (bt = tt - 1), St ? xt > H[bt] && (H[bt] = xt) : xt > X[bt] && (X[bt] = xt));
      }
      for (let q = 0; q < tt; q++) {
        const st = r * tt + q,
          St = Tt[st];
        (H[q] > 0 ? (Tt[st] = Tt[st] * (1 - i) + H[q] * i) : X[q] > 0 && i > 0.5 && (Tt[st] = Math.max(Tt[st], X[q])),
          d <= O - 5 && St > Tt[st] && o.boxKeepSkin && (Tt[st] = St));
      }
      a++;
    }
    s.plateRows = a;
  }
  o.dbg && (s.Rst = s.Rst || []).push(["box", +Tt[113 * tt + 67].toFixed(1), +Tt[113 * tt + 72].toFixed(1)]);
  const Ro = Float64Array.from(Tt);
  {
    const a = Float64Array.from(Tt);
    for (let r = 1; r < Et - 1; r++)
      for (let d = 0; d < tt; d++) {
        const m = [];
        for (let i = -1; i <= 1; i++) for (let p = -1; p <= 1; p++) m.push(Tt[(r + i) * tt + ((d + p + tt) % tt)]);
        (m.sort((i, p) => i - p), (a[r * tt + d] = m[4]));
      }
    Tt.set(a);
  }
  {
    const a = Float64Array.from(Tt);
    if (o.envPre) for (let r = 0; r < Tt.length; r++) a[r] = Math.max(a[r], Ro[r]);
    for (let r = 0; r < 2; r++) (gauss1(Tt, tt, 1, Et, o.sigPhi, !0), gauss1(Tt, Et, tt, tt, o.sigU, !1));
    if (o.envIt > 0) {
      {
        const d = Float64Array.from(a);
        for (let m = 0; m < Et; m++)
          for (let i = 0; i < tt; i++) {
            let p = d[m * tt + i];
            for (let f = -1; f <= 1; f++) {
              const g = m + f;
              if (!(g < 0 || g >= Et)) for (let c = -1; c <= 1; c++) p = Math.max(p, d[g * tt + ((i + c + tt) % tt)]);
            }
            a[m * tt + i] = p;
          }
        (gauss1(a, tt, 1, Et, o.envRefSig, !0), gauss1(a, Et, tt, tt, o.envRefSig, !1));
      }
      for (let d = 0; d < o.envIt; d++) {
        for (let m = 0; m < Tt.length; m++) Tt[m] < a[m] - o.envTol && (Tt[m] = a[m] - o.envTol);
        (gauss1(Tt, tt, 1, Et, 1, !0), gauss1(Tt, Et, tt, tt, 1, !1));
      }
      let r = 0;
      for (let d = 0; d < Tt.length; d++) {
        const m = a[d] - o.envTol - Tt[d];
        m > r && (r = m);
      }
      s.envR = +r.toFixed(2);
    }
  }
  o.dbg && (s.Rst = s.Rst || []).push(["smooth", +Tt[113 * tt + 67].toFixed(1), +Tt[113 * tt + 72].toFixed(1)]);
  {
    const a = Math.max(
        0,
        Pt.findIndex((d) => d[2] <= o.top),
      ),
      r = Math.round(30 / ae);
    for (let d = Math.max(0, a - 4); d < Math.min(Et, a + r); d++) {
      const m = d <= a ? 1 : 1 - (d - a) / r,
        i = Tt.slice(d * tt, (d + 1) * tt),
        p = 6,
        f = new Float64Array(tt);
      for (let g = 0; g < tt; g++) {
        const c = [];
        for (let w = -p; w <= p; w++) c.push(i[(g + w + tt) % tt]);
        (c.sort((w, A) => w - A), (f[g] = c[p]));
      }
      for (let g = 0; g < tt; g++) i[g] = Math.min(i[g], f[g] + 1.5);
      gauss1(i, tt, 1, 1, 5, !0);
      for (let g = 0; g < tt; g++) Tt[d * tt + g] += (i[g] - Tt[d * tt + g]) * m;
    }
    for (let d = Math.max(0, a - 4); d <= a; d++)
      for (let m = 0; m < tt; m++) Tt[d * tt + m] = Tt[a * tt + m] * 0.3 + Tt[d * tt + m] * 0.7;
  }
  if (o.dbg) {
    s.Rdbg = [];
    for (let a = 0; a < Et; a += 1) {
      if (Pt[a][2] > 25 || Pt[a][1] > 20) continue;
      let r = 0,
        d = 0;
      for (let i = 0; i < tt; i++) {
        const p = ho[a * tt + i];
        p > d && ((d = p), (r = i));
      }
      const m = Math.round(tt / 2);
      s.Rdbg.push([
        a,
        Pt[a].map((i) => +i.toFixed(0)).join("/"),
        "raw0",
        +(ho[a * tt + m] || 0).toFixed(0),
        "fin0",
        +Tt[a * tt + m].toFixed(0),
        "rawMax",
        +d.toFixed(0),
        r,
        "fin@",
        +Tt[a * tt + r].toFixed(0),
      ]);
    }
  }
  o.dbg && (s.Rst = s.Rst || []).push(["top", +Tt[113 * tt + 67].toFixed(1), +Tt[113 * tt + 72].toFixed(1)]);
  const Oe = (a, r) => {
      const d = ((r + 180) / Qe - 0.5 + tt) % tt,
        m = Math.floor(d),
        i = d - m;
      return Tt[a * tt + m] * (1 - i) + Tt[a * tt + ((m + 1) % tt)] * i;
    },
    po = (a, r) => {
      const d = r / DEG,
        m = Oe(a, r);
      return V3.add(Pt[a], V3.add(V3.mul(Ne[a], m * Math.cos(d)), V3.mul(Ge[a], m * Math.sin(d))));
    },
    Ht = Math.max(
      0,
      Pt.findIndex((a) => a[2] <= o.top),
    ),
    Re = Et - 1,
    go = (a) => {
      let r = o.hHeel + (o.hFore - o.hHeel) * smooth(L + 10, L + 70, a);
      return r + (o.hToe - r) * smooth(O - 45, O + 5, a);
    },
    ke = new Float64Array(Et),
    Fe = new Float64Array(Et);
  for (let a = 0; a < Et; a++) {
    const r = Pt[a][2],
      d = o.thAnk + (o.thCalf - o.thAnk) * smooth(0, 60, r),
      m = 180 - d,
      i = te[a] >= Qt ? rt(Pt[a][1]) : T,
      p = te[a] >= Qt - 10,
      f = (A) => {
        const F = go(Pt[a][1]);
        for (let R = 0; R <= 176; R += 2) {
          const H = po(a, A * R),
            X = p ? Math.min(Z(H[0], H[1]), i + 15) : i;
          if (H[2] - X >= F) return R;
        }
        return 176;
      },
      g = 1 - smooth(Qt, Qt + o.blend, te[a]);
    let c = g < 1 ? Math.min(o.phiFootMax, f(1)) : 0,
      w = g < 1 ? Math.min(o.phiFootMax, f(-1)) : 0;
    ((ke[a] = g * m + (1 - g) * c),
      (Fe[a] = g * m + (1 - g) * w),
      te[a] < Qt && ((ke[a] = Math.max(ke[a], m)), (Fe[a] = Math.max(Fe[a], m))));
  }
  const Mo = (a) => Math.max(0, Math.min(1, (te[a] - te[Ht]) / (te[Re] - te[Ht] || 1))),
    Xe = (a, r) => {
      const d = o.trimAdj && o.trimAdj[a];
      if (!d || !d.length) return 0;
      const m = d.length,
        i = r * (m - 1),
        p = Math.min(m - 2, Math.floor(i)),
        f = i - p,
        g = f * f * (3 - 2 * f);
      return d[p] * (1 - g) + d[p + 1] * g;
    };
  if (o.trimAdj)
    for (let a = Ht; a <= Re; a++) {
      const r = Math.max(10, (Oe(a, 90) + Oe(a, -90)) / 2),
        d = Mo(a);
      ((Fe[a] += (Xe(0, d) / r) * DEG),
        (ke[a] += (Xe(1, d) / r) * DEG),
        (Fe[a] = Math.max(20, Math.min(178, Fe[a]))),
        (ke[a] = Math.max(20, Math.min(178, ke[a]))));
    }
  (gauss1(ke, Et, 1, 1, o.sigTrim / ae, !1), gauss1(Fe, Et, 1, 1, o.sigTrim / ae, !1));
  const $o = (a) => {
    let r = 0;
    for (let d = 0; d < tt; d++) r += Tt[a * tt + d];
    return r / tt;
  };
  for (let a = Ht; a <= Re; a++) {
    const r = te[a] - te[Ht],
      d = te[Re] - te[a];
    let m = 0;
    const i = (g, c) => (g < c ? (1 - Math.sqrt(Math.max(0, 1 - ((c - g) / c) ** 2))) * c : 0);
    m = Math.max(i(r, o.rTop), i(d, o.rToe));
    const p = Math.max(10, (Oe(a, 90) + Oe(a, -90)) / 2),
      f = (m / p) * DEG;
    ((ke[a] = Math.max(15, ke[a] - f)), (Fe[a] = Math.max(15, Fe[a] - f)));
  }
  s.trimTop = [ke[Ht], Fe[Ht]];
  const K = Re - Ht + 1,
    M = o.nj,
    at = new Float64Array(K * M * 3),
    Ze = (a, r) => {
      const d = [0];
      for (let f = 1; f < a.length; f++)
        d.push(d[f - 1] + Math.hypot(a[f][0] - a[f - 1][0], a[f][1] - a[f - 1][1], a[f][2] - a[f - 1][2]));
      const m = d[d.length - 1] || 1,
        i = [];
      let p = 0;
      for (let f = 0; f < r; f++) {
        const g = (m * f) / (r - 1);
        for (; p < d.length - 2 && d[p + 1] < g; ) p++;
        const c = Math.min(1, Math.max(0, (g - d[p]) / (d[p + 1] - d[p] || 1)));
        i.push([0, 1, 2].map((w) => a[p][w] + (a[p + 1][w] - a[p][w]) * c));
      }
      return i;
    };
  for (let a = 0; a < K; a++) {
    const r = Ht + a,
      d = [],
      m = M * 4;
    for (let i = 0; i <= m; i++) d.push(po(r, -Fe[r] + ((ke[r] + Fe[r]) * i) / m));
    Ze(d, M).forEach((i, p) => at.set(i, (a * M + p) * 3));
  }
  {
    let a = -1,
      r = 0;
    for (let m = Ht; m <= Re - 3; m++) te[m] >= Qt - 10 && (r = Math.max(r, ye[m][1]));
    const d = Math.min(o.swT, r - 0.01);
    for (let m = Ht; m <= Re - 3; m++)
      if (te[m] >= Qt - 10 && ye[m][1] > d) {
        a = m;
        break;
      }
    if (a > 0) {
      const m = a - Ht,
        i = at[m * M * 3] > at[(m * M + M - 1) * 3],
        p = (H) => {
          const X = (m * M + H) * 3;
          return at[X + 2] - Z(at[X], at[X + 1]);
        },
        f = Math.max(5, (p(0) + p(M - 1)) / 2),
        g = Pt[a][1];
      let c = null;
      if (o.tipStretch && o.tipArc && D != null) {
        let H = 0,
          X = O;
        for (let I = O; I <= D; I += 1) {
          const N = B(I),
            q = N[1] - N[0];
          q > H && ((H = q), (X = I));
        }
        let Y = X;
        for (let I = X; I <= D; I += 0.5) {
          const N = B(I);
          if (N[1] - N[0] < o.tipKeep * H) break;
          Y = I;
        }
        c = Y;
      }
      const w = (H) => f + (go(H) - f) * smooth(g, g + o.blendU, H),
        A = new Map();
      for (let H = 0; H < e.length; H += 3) {
        let X = 1e9,
          Y = -1e9;
        for (let I = 0; I < 3; I++) {
          const N = t[e[H + I] * 3 + 1];
          (N < X && (X = N), N > Y && (Y = N));
        }
        if (!(Y < g - 20))
          for (let I = Math.floor(X / 4); I <= Math.floor(Y / 4); I++) {
            let N = A.get(I);
            (N || ((N = []), A.set(I, N)), N.push(H));
          }
      }
      const F = i ? 0 : 1,
        R = (H, X) => {
          const Y = B(H),
            I = Y[0],
            N = Y[1],
            q = (I + N) / 2,
            st = o.plateMargin,
            St = w(H),
            Mt = X != null ? Mo(X) : 0,
            Xt = Math.max(1.5, St + Xe(F, Mt)),
            Nt = Math.max(1.5, St + Xe(1 - F, Mt)),
            Ft = Math.max(Xt, Nt),
            xt = (z) => Z(Math.min(Math.max(z, I), N), H),
            bt = xt(N),
            vt = xt(I),
            ct = Math.min(bt, vt) - 4,
            mt = Math.ceil((Ft + 12) / 2) + 1,
            Ct = new Float64Array(mt).fill(NaN),
            Wt = new Float64Array(mt).fill(NaN),
            se = (z, P) => {
              const lt = Math.floor((P - ct) / 2);
              lt < 0 || lt >= mt || (z > q ? Ct[lt] >= z || (Ct[lt] = z) : Wt[lt] <= z || (Wt[lt] = z));
            };
          if (H < O + 5)
            for (const z of [H - 1, H, H + 1]) {
              const P = A.get(Math.floor(z / 4));
              if (P)
                for (const lt of P) {
                  const V = e[lt],
                    J = e[lt + 1],
                    pt = e[lt + 2],
                    Yt = t[V * 3 + 1] - z,
                    Rt = t[J * 3 + 1] - z,
                    ut = t[pt * 3 + 1] - z;
                  if ((Yt > 0 && Rt > 0 && ut > 0) || (Yt < 0 && Rt < 0 && ut < 0)) continue;
                  const ft = [];
                  for (const [et, dt, ht, yt] of [
                    [V, J, Yt, Rt],
                    [J, pt, Rt, ut],
                    [pt, V, ut, Yt],
                  ])
                    if (ht <= 0 != yt <= 0) {
                      const jt = ht / (ht - yt);
                      ft.push([
                        t[et * 3] + (t[dt * 3] - t[et * 3]) * jt,
                        t[et * 3 + 2] + (t[dt * 3 + 2] - t[et * 3 + 2]) * jt,
                      ]);
                    }
                  if (ft.length < 2) continue;
                  const k = Math.hypot(ft[1][0] - ft[0][0], ft[1][1] - ft[0][1]),
                    E = Math.max(1, Math.ceil(k / 0.5));
                  for (let et = 0; et <= E; et++) {
                    const dt = et / E;
                    se(ft[0][0] + (ft[1][0] - ft[0][0]) * dt, ft[0][1] + (ft[1][1] - ft[0][1]) * dt);
                  }
                }
            }
          const ne = (z, P) => {
            if (!z.some(Number.isFinite)) {
              z.fill(P);
              return;
            }
            let lt = z.findIndex(Number.isFinite);
            for (let J = 0; J < lt; J++) z[J] = z[lt];
            let V = lt;
            for (let J = lt + 1; J < mt; J++)
              if (Number.isFinite(z[J])) {
                for (let pt = V + 1; pt < J; pt++) z[pt] = z[V] + ((z[J] - z[V]) * (pt - V)) / (J - V);
                V = J;
              }
            for (let J = V + 1; J < mt; J++) z[J] = z[V];
            gauss1(z, mt, 1, 1, 1.5, !1);
          };
          if ((ne(Ct, N - st), ne(Wt, I + st), o.wallNoUndercut)) {
            const z = o.undercut || 0;
            let P = -1e9,
              lt = 1e9;
            for (let V = 0; V < mt; V++)
              ((P = Math.max(P, Ct[V])),
                (lt = Math.min(lt, Wt[V])),
                (Ct[V] = Math.max(Ct[V], P - z)),
                (Wt[V] = Math.min(Wt[V], lt + z)));
            (gauss1(Ct, mt, 1, 1, 1, !1), gauss1(Wt, mt, 1, 1, 1, !1));
          }
          const de = (z, P, lt) => {
              const V = Math.max(0, Math.min(mt - 1.001, (P - ct) / 2)),
                J = Math.floor(V),
                pt = V - J,
                Yt = z[J] * (1 - pt) + z[J + 1] * pt;
              return lt > 0 ? Math.min(N, Math.max(q + 4, Yt + o.wallM)) : Math.max(I, Math.min(q - 4, Yt - o.wallM));
            },
            ie = [];
          for (let z = bt + Xt; z > bt; z -= 1) ie.push([de(Ct, z, 1), H, z]);
          for (let z = N; z >= I; z -= 0.5) ie.push([z, H, xt(z)]);
          for (let z = vt + 1; z <= vt + Nt; z += 1) ie.push([de(Wt, z, -1), H, z]);
          let _ = Ze(ie, Math.max(20, Math.round((Ft * 2 + (N - I)) / 0.5)));
          const it = o.boxR / 0.5 / 1.2;
          for (let z = 0; z < 2; z++)
            for (let P of [0, 2]) {
              const lt = Float64Array.from(_.map((V) => V[P]));
              (gauss1(lt, _.length, 1, 1, it, !1),
                (_ = _.map((V, J) => {
                  const pt = V.slice();
                  return ((pt[P] = lt[J]), pt);
                })));
            }
          return ((_ = Ze(_, M)), i || _.reverse(), _);
        };
      for (let H = a; H <= Re; H++) {
        const X = H - Ht,
          Y = R(Pt[H][1], H),
          I = smooth(a - 1, a + o.swRows, H);
        for (let N = 0; N < M; N++) {
          const q = (X * M + N) * 3;
          for (let st = 0; st < 3; st++) at[q + st] += (Y[N][st] - at[q + st]) * I;
        }
      }
      {
        const H = Math.max(0, a - Ht - 10),
          X = K - H;
        if (X > 6)
          for (let Y = 0; Y < M; Y++)
            for (let I = 0; I < 3; I++) {
              if (I === 1) continue;
              const N = new Float64Array(X);
              for (let q = 0; q < X; q++) N[q] = at[((H + q) * M + Y) * 3 + I];
              gauss1(N, X, 1, 1, o.footSig, !1);
              for (let q = 0; q < X; q++) {
                const st = Math.min(1, q / 8);
                at[((H + q) * M + Y) * 3 + I] += (N[q] - at[((H + q) * M + Y) * 3 + I]) * st;
              }
            }
      }
      if (o.wallNoUndercut) {
        let H = 0;
        for (let X = 0; X < K; X++) {
          const Y = Ht + X,
            I = smooth(Qt - 15, Qt + 10, te[Y]);
          if (I <= 0) continue;
          const N = new Float64Array(M);
          for (let Nt = 0; Nt < M; Nt++) N[Nt] = at[(X * M + Nt) * 3];
          let q = 0,
            st = 0;
          for (let Nt = 0; Nt < M; Nt++) (N[Nt] < N[q] && (q = Nt), N[Nt] > N[st] && (st = Nt));
          const St = o.undercut || 0,
            Mt = (Nt, Ft, xt) => {
              let bt = N[Nt];
              for (let vt = Nt; vt >= 0 && vt < M; vt += Ft) {
                const ct = N[vt];
                if (xt * ct > xt * bt) bt = ct;
                else if (xt * (bt - ct) > St) {
                  const mt = bt - xt * St,
                    Ct = ct + (mt - ct) * I;
                  Math.abs(Ct - ct) > 0.01 && ((at[(X * M + vt) * 3] = Ct), H++);
                }
              }
            },
            Xt = M >> 1;
          (Mt(q, q < Xt ? -1 : 1, -1), Mt(st, st < Xt ? -1 : 1, 1));
        }
        s.undercutFix = H;
      }
      if (o.tipStretch && D != null) {
        let H = 0,
          X = O;
        for (let q = O; q <= D; q += 1) {
          const st = B(q),
            St = st[1] - st[0];
          St > H && ((H = St), (X = q));
        }
        let Y = X;
        for (let q = X; q <= D; q += 0.5) {
          const st = B(q);
          if (st[1] - st[0] < o.tipKeep * H) break;
          Y = q;
        }
        let I = -1;
        for (let q = Math.max(0, a - Ht); q < K; q++)
          if (Pt[Ht + q][1] >= Y) {
            I = q;
            break;
          }
        const N = I < 0 ? 0 : K - 1 - I;
        if (N >= 4) {
          const q = B(Pt[Ht + I][1]),
            st = [],
            St = [],
            Mt = (bt, vt) => {
              const ct = B(vt);
              return ct[1] - ct[0] > 1.5 && bt >= ct[0] && bt <= ct[1];
            };
          for (let bt = q[0] - 2; bt <= q[1] + 2; bt += 0.5) {
            let vt = -1e9;
            for (let ct = Y; ct <= D - 0.25; ct += 0.25) Mt(bt, ct) && (vt = ct);
            if (vt > -1e9 && vt + 0.25 <= D - 0.25) {
              let ct = vt,
                mt = vt + 0.25;
              for (let Ct = 0; Ct < 8; Ct++) {
                const Wt = (ct + mt) / 2;
                Mt(bt, Wt) ? (ct = Wt) : (mt = Wt);
              }
              vt = ct;
            }
            (st.push(bt), St.push(vt));
          }
          {
            const bt = St.map((ct) => ct > -1e8),
              vt = Float64Array.from(St.map((ct, mt) => (bt[mt] ? ct : NaN)));
            for (let ct = 0; ct < vt.length; ct++)
              if (!bt[ct]) {
                let mt = ct,
                  Ct = ct;
                for (; mt >= 0 && !bt[mt]; ) mt--;
                for (; Ct < vt.length && !bt[Ct]; ) Ct++;
                vt[ct] =
                  mt < 0
                    ? Ct < vt.length
                      ? vt[Ct]
                      : Y
                    : Ct >= vt.length
                      ? vt[mt]
                      : vt[mt] + ((vt[Ct] - vt[mt]) * (ct - mt)) / (Ct - mt);
              }
            gauss1(vt, vt.length, 1, 1, o.tipFrontSig, !1);
            for (let ct = 0; ct < vt.length; ct++) St[ct] = vt[ct];
          }
          const Xt = (bt) => {
            const vt = Math.max(0, Math.min(st.length - 1, (bt - st[0]) / 0.5)),
              ct = Math.floor(vt),
              mt = Math.min(st.length - 1, ct + 1),
              Ct = vt - ct;
            return St[ct] * (1 - Ct) + St[mt] * Ct;
          };
          let Nt = 1e9;
          for (let bt = 0; bt < M; bt++) Nt = Math.min(Nt, at[(I * M + bt) * 3 + 2]);
          const Ft = new Float64Array(M);
          for (let bt = 0; bt < M; bt++) {
            const vt = (I * M + bt) * 3,
              ct = at[vt + 1],
              mt = ct + o.tipMinExt * N,
              Ct = Xt(at[vt]),
              Wt = 2.5;
            Ft[bt] = Math.max(Ct, mt) + Wt * Math.log1p(Math.exp(-Math.abs(Ct - mt) / Wt));
          }
          gauss1(Ft, M, 1, 1, o.tipColSig, !1);
          let xt = !1;
          if (o.tipArc) {
            const bt = Pt[Ht + I][1],
              vt = [[], []];
            for (let ct = bt; ct < D - 0.02; ct += 0.2) {
              const mt = B(ct);
              if (mt[1] - mt[0] < 0.6) break;
              (vt[0].push([mt[0], ct]), vt[1].push([mt[1], ct]));
            }
            if (vt[0].length > 8) {
              const ct = [
                (vt[0][vt[0].length - 1][0] + vt[1][vt[1].length - 1][0]) / 2,
                vt[0][vt[0].length - 1][1] + 0.3,
              ];
              (vt[0].push(ct), vt[1].push(ct));
              const mt = (ft) => {
                  const k = [0];
                  for (let E = 1; E < ft.length; E++)
                    k.push(k[E - 1] + Math.hypot(ft[E][0] - ft[E - 1][0], ft[E][1] - ft[E - 1][1]));
                  return k;
                },
                Ct = mt(vt[0]),
                Wt = mt(vt[1]),
                se = (ft, k, E) => {
                  const et = k[k.length - 1] * E;
                  let dt = 0;
                  for (; dt < k.length - 2 && k[dt + 1] < et; ) dt++;
                  const ht = Math.min(1, Math.max(0, (et - k[dt]) / (k[dt + 1] - k[dt] || 1)));
                  return [ft[dt][0] + (ft[dt + 1][0] - ft[dt][0]) * ht, ft[dt][1] + (ft[dt + 1][1] - ft[dt][1]) * ht];
                };
              for (const ft of vt)
                for (let k = 0; k < 2; k++) {
                  const E = Float64Array.from(ft.map((ht) => ht[k])),
                    et = E.length,
                    dt = E.slice();
                  gauss1(E, et, 1, 1, 4, !1);
                  for (let ht = 1; ht < et - 1; ht++) ft[ht][k] = E[ht];
                  ((ft[0][k] = dt[0]), (ft[et - 1][k] = dt[et - 1]));
                }
              const ne = at[I * M * 3] < at[(I * M + M - 1) * 3] ? 0 : M - 1,
                de = M - 1 - ne,
                ie = [at[(I * M + ne) * 3], bt],
                _ = [at[(I * M + de) * 3], bt],
                it = [ie[0] - vt[0][0][0], 0],
                z = [_[0] - vt[1][0][0], 0],
                P = at[(I * M + ne) * 3],
                lt = at[(I * M + de) * 3],
                V = new Float64Array(M);
              {
                let ft = 0;
                for (let k = 0; k < M; k++) {
                  const E = ne === 0 ? k : M - 1 - k,
                    et = (I * M + E) * 3;
                  ((ft = Math.max(ft, Math.max(0, Math.min(1, (at[et] - P) / (lt - P || 1))))), (V[E] = ft));
                }
                if (o.tipWallOnEdge) {
                  const k = Nt + o.tipWallZ;
                  let E = 0;
                  for (; E < M && at[(I * M + E) * 3 + 2] > k; ) E++;
                  const et = E;
                  for (E = M - 1; E >= 0 && at[(I * M + E) * 3 + 2] > k; ) E--;
                  const dt = E;
                  for (let ht = 0; ht < et; ht++) V[ht] = (V[Math.min(M - 1, et)] < 0.5, V[0]);
                  for (let ht = dt + 1; ht < M; ht++) V[ht] = V[M - 1];
                }
              }
              const J = vt[0].slice();
              for (let ft = vt[1].length - 2; ft >= 0; ft--) J.push(vt[1][ft]);
              {
                const ft = J.length,
                  k = o.tipRound / 0.2;
                for (let E = 0; E < 2; E++) {
                  const et = Float64Array.from(J.map((ht) => ht[E])),
                    dt = et.slice();
                  gauss1(et, ft, 1, 1, k, !1);
                  for (let ht = 0; ht < ft; ht++) {
                    const yt = Math.min(1, ht / (2 * k), (ft - 1 - ht) / (2 * k));
                    J[ht][E] = dt[ht] + (et[ht] - dt[ht]) * yt;
                  }
                }
              }
              const pt = mt(J),
                Yt = pt[pt.length - 1],
                Rt = Math.min(0.3, o.tipSideLen / Yt),
                ut = 1 - Rt;
              for (let ft = I + 1; ft < K; ft++) {
                const k = (ft - I) / N;
                for (let E = 0; E < M; E++) {
                  const et = (I * M + E) * 3,
                    dt = (ft * M + E) * 3,
                    ht = ne === 0 ? V[E] : 1 - V[E],
                    yt = se(J, pt, Rt + (ut - Rt) * V[E]),
                    jt = at[et] + 0,
                    zt = at[et + 1];
                  ((at[dt] = jt + (yt[0] - jt) * k),
                    (at[dt + 1] = zt + (yt[1] - zt) * k),
                    (at[dt + 2] = Nt + (at[et + 2] - Nt) * (1 - smooth(0, o.tipWallFade, k))));
                }
              }
              ((xt = !0), (s.tipArc = +Ct[Ct.length - 1].toFixed(1)));
            }
          }
          if (!xt)
            for (let bt = 0; bt < M; bt++) {
              const vt = (I * M + bt) * 3,
                ct = at[vt],
                mt = at[vt + 1],
                Ct = at[vt + 2],
                Wt = Math.max(Ft[bt], mt + 1),
                se = ((I - 3) * M + bt) * 3,
                ne = mt - at[se + 1],
                de = ne > 0.5 ? Math.max(-0.6, Math.min(0.6, (ct - at[se]) / ne)) : 0;
              for (let ie = I + 1; ie < K; ie++) {
                const _ = (ie - I) / N,
                  it = (ie * M + bt) * 3,
                  z = (Wt - mt) * _;
                ((at[it] = ct + (o.tipCont ? de * z * (1 - 0.5 * _) : 0)),
                  (at[it + 1] = mt + z),
                  (at[it + 2] = Nt + (Ct - Nt) * (1 - smooth(0, o.tipWallFade, _))));
              }
            }
          if (o.tipResample)
            for (let bt = I + 1; bt < K; bt++) {
              const vt = [];
              for (let mt = 0; mt < M; mt++) {
                const Ct = (bt * M + mt) * 3;
                vt.push([at[Ct], at[Ct + 1], at[Ct + 2]]);
              }
              const ct = Ze(vt, M);
              for (let mt = 0; mt < M; mt++) at.set(ct[mt], (bt * M + mt) * 3);
            }
          s.tipStretch = { yS0: +Y.toFixed(1), rows: N };
        }
      }
      ((s.footRows = Re - a + 1), (s.ySw = g), (s.aSw = a - Ht));
    }
  }
  h && h("grid", at, K, M, s.aSw != null ? s.aSw : 0);
  {
    let a = 0;
    const r = new Float64Array(K * M),
      d = new Float64Array(K * 3),
      m = s.aSw != null ? s.aSw : K;
    for (let i = 0; i < K; i++) {
      const p = Ht + i,
        f = m < K ? smooth(m - 10, m + 2, i) : smooth(Qt - 25, Qt + 5, te[p]),
        g = [0, 1, 0];
      let c = V3.sub([0, 0, 1], V3.mul(g, g[2]));
      const w = V3.len(c);
      if (((c = w > 0.3 ? V3.mul(c, 1 / w) : [0, 0, 1]), d.set(c, i * 3), f <= 0)) continue;
      const A = new Float64Array(M).fill(NaN),
        F = new Float64Array(M);
      for (let R = 0; R < M; R++) {
        const H = (i * M + R) * 3,
          X = Z(at[H], at[H + 1]);
        ((F[R] = at[H + 2] - X), F[R] < o.snapB0 && (A[R] = -F[R]));
      }
      if (A.some(Number.isFinite))
        for (let R = 0; R < M; R++) {
          let H = A[R];
          if (!Number.isFinite(H)) {
            let Y = R,
              I = R;
            for (; Y >= 0 && !Number.isFinite(A[Y]); ) Y--;
            for (; I < M && !Number.isFinite(A[I]); ) I++;
            H = Y < 0 ? A[I] : I >= M || R - Y <= I - R ? A[Y] : A[I];
          }
          const X = f * (1 - smooth(o.snapB0, o.snapB1, F[R]));
          X <= 0 || ((r[i * M + R] = (H / Math.max(0.6, c[2])) * X), a++);
        }
    }
    {
      let i = 0,
        p = 0;
      for (let f = 0; f < K * M; f++) Math.abs(r[f]) > i && ((i = Math.abs(r[f])), (p = f));
      s.snapMax = [+i.toFixed(1), Math.floor(p / M) - m, p % M];
    }
    s.snapRaw = [];
    for (let i = Math.max(0, m - 30); i < Math.min(K, m + 10); i++)
      s.snapRaw.push([i - m, +r[i * M + 20].toFixed(1), +r[i * M + 40].toFixed(1), +r[i * M + 60].toFixed(1)]);
    (gauss1(r, M, 1, K, o.snapSig, !1), gauss1(r, K, M, M, o.snapSig, !1));
    for (let i = 0; i < K; i++)
      for (let p = 0; p < M; p++) {
        const f = i * M + p;
        for (let g = 0; g < 3; g++) at[f * 3 + g] += r[f] * d[i * 3 + g];
      }
    s.snapped = a;
  }
  if ((h && h("snap", at, K, M, s.aSw != null ? s.aSw : 0), s.aSw != null && o.relaxIt > 0)) {
    const a = s.aSw,
      r = Math.max(1, a - o.relaxPre),
      d = Math.min(K - 2, a + o.swRows + 6),
      m = new Float64Array(K);
    for (let f = r; f <= d; f++) m[f] = Math.min(1, (f - r) / 6, (d - f) / 6);
    const i = new Float64Array(at.length),
      p = (f) => {
        i.set(at);
        for (let g = r; g <= d; g++)
          if (!(m[g] <= 0))
            for (let c = 0; c < M; c++) {
              const w = (g * M + c) * 3,
                A = c === 0 || c === M - 1;
              for (let F = 0; F < 3; F++) {
                let R = (i[w - M * 3 + F] + i[w + M * 3 + F]) / 2;
                (A || (R = (R + (i[w - 3 + F] + i[w + 3 + F]) / 2) / 2),
                  (at[w + F] = i[w + F] + f * m[g] * (R - i[w + F])));
              }
            }
      };
    for (let f = 0; f < o.relaxIt; f++) (p(0.5), p(-0.53));
  }
  h && h("relax", at, K, M, s.aSw != null ? s.aSw : 0);
  const Io = (a, r) => {
    const d = Math.min(a, K - 1 - a),
      m = Math.min(r, M - 1 - r);
    return Math.min(1, Math.hypot(Math.max(0, d - 1), Math.max(0, m - 1)) / o.cornerD);
  };
  if (o.edgeFair > 0) {
    const a = o.edgeBand;
    for (const r of [0, 1]) {
      const d = r ? M - 1 : 0;
      for (let m = 0; m < 3; m++) {
        const i = new Float64Array(K);
        for (let f = 0; f < K; f++) i[f] = at[(f * M + d) * 3 + m];
        const p = i.slice();
        gauss1(i, K, 1, 1, o.edgeFair, !1);
        for (let f = 0; f < K; f++) {
          const g = Math.min(1, (f - 1) / o.cornerD, (K - 2 - f) / o.cornerD);
          if (g <= 0) continue;
          const c = (i[f] - p[f]) * g;
          for (let w = 0; w < a; w++) {
            const A = r ? M - 1 - w : w;
            at[(f * M + A) * 3 + m] += c * (1 - w / a) ** 2;
          }
        }
      }
    }
    for (let r = 0; r < Math.min(a, K >> 2); r++) {
      const d = r,
        m = (1 - r / a) ** 2,
        i = o.edgeFair * m;
      if (!(i < 0.3))
        for (let p = 0; p < 3; p++) {
          const f = new Float64Array(M);
          for (let c = 0; c < M; c++) f[c] = at[(d * M + c) * 3 + p];
          const g = f.slice();
          gauss1(f, M, 1, 1, i, !1);
          for (let c = 1; c < M - 1; c++) {
            const w = Math.min(1, (c - 1) / o.cornerD, (M - 2 - c) / o.cornerD);
            w > 0 && (at[(d * M + c) * 3 + p] = g[c] + (f[c] - g[c]) * w);
          }
        }
    }
  }
  if ((h && h("fair", at, K, M, s.aSw != null ? s.aSw : 0), o.fixCells && o.fixCells.length)) {
    const a = new Float64Array(K * M),
      r = o.fixR || [4, 8];
    for (const [i, p] of o.fixCells)
      for (let f = Math.max(0, i - r[0] - 3); f <= Math.min(K - 1, i + r[0] + 3); f++)
        for (let g = Math.max(0, p - r[1] - 4); g <= Math.min(M - 1, p + r[1] + 4); g++) {
          const c = Math.hypot((f - i) / (r[0] + 3), (g - p) / (r[1] + 4));
          a[f * M + g] = Math.max(a[f * M + g], 1 - smooth(0.5, 1, c));
        }
    const d = new Float64Array(at.length),
      m = (i) => {
        d.set(at);
        for (let p = 0; p < K; p++)
          for (let f = 0; f < M; f++) {
            const g = a[p * M + f];
            if (g <= 0) continue;
            const c = (p * M + f) * 3,
              w = [],
              A = p === 0 || p === K - 1,
              F = f === 0 || f === M - 1;
            if (!(A && F)) {
              ((!F || A) && (f > 0 && w.push(c - 3), f < M - 1 && w.push(c + 3)),
                (!A || F) && (p > 0 && w.push(c - M * 3), p < K - 1 && w.push(c + M * 3)));
              for (let R = 0; R < 3; R++) {
                let H = 0;
                for (const X of w) H += d[X + R];
                ((H /= w.length), (at[c + R] = d[c + R] + i * g * (H - d[c + R])));
              }
            }
          }
      };
    for (let i = 0; i < o.fixIt; i++) (m(0.5), m(-0.53));
    s.fixed = o.fixCells.length;
  }
  if (o.hug > 0) {
    const r = new Map(),
      d = (f, g, c) => (f * 73856093) ^ (g * 19349663) ^ (c * 83492791);
    for (let f = 0; f < l; f++) {
      const g = d(Math.floor(t[f * 3] / 4), Math.floor(t[f * 3 + 1] / 4), Math.floor(t[f * 3 + 2] / 4));
      let c = r.get(g);
      (c || ((c = []), r.set(g, c)), c.push(f));
    }
    const m = (f, g, c) => {
        const w = Math.floor(f / 4),
          A = Math.floor(g / 4),
          F = Math.floor(c / 4);
        let R = 1 / 0,
          H = -1;
        for (let X = -2; X <= 2; X++)
          for (let Y = -2; Y <= 2; Y++)
            for (let I = -2; I <= 2; I++) {
              const N = r.get(d(w + X, A + Y, F + I));
              if (N)
                for (const q of N) {
                  const st = (t[q * 3] - f) ** 2 + (t[q * 3 + 1] - g) ** 2 + (t[q * 3 + 2] - c) ** 2;
                  st < R && ((R = st), (H = q));
                }
            }
        return H;
      },
      i = new Float64Array(K);
    for (let f = 0; f < K; f++) {
      const g = te[Ht + f] - Qt;
      i[f] = smooth(-70, -45, g) * (1 - smooth(70, 95, g));
    }
    let p = 0;
    for (let f = 0; f < 4; f++) {
      const g = new Float64Array(K * M * 3);
      for (let c = 2; c < K - 2; c++)
        if (!(i[c] <= 0))
          for (let w = 2; w < M - 2; w++) {
            const A = c * M + w,
              F = A * 3,
              R = [
                at[F + M * 3] - at[F - M * 3],
                at[F + M * 3 + 1] - at[F - M * 3 + 1],
                at[F + M * 3 + 2] - at[F - M * 3 + 2],
              ],
              H = [at[F + 3] - at[F - 3], at[F + 4] - at[F - 2], at[F + 5] - at[F - 1]],
              X = V3.norm(V3.cross(R, H));
            if (Math.abs(X[2]) > 0.6) continue;
            const Y = m(at[F], at[F + 1], at[F + 2]);
            if (Y < 0) continue;
            const I = [at[F] - t[Y * 3], at[F + 1] - t[Y * 3 + 1], at[F + 2] - t[Y * 3 + 2]],
              N = V3.len(I),
              q = Math.abs(V3.dot(I, X));
            if (N < o.hugTol || q < 0.6 * N) continue;
            const st = Math.min(1, Math.min(w - 1, M - 2 - w) / (o.hugEdge || 6)),
              St = Math.min(o.hug, N - o.hugTol) * 0.5 * i[c] * st,
              Mt = V3.mul(I, -St / N);
            ((g[F] = Mt[0]), (g[F + 1] = Mt[1]), (g[F + 2] = Mt[2]));
          }
      for (let c = 0; c < 3; c++) {
        const w = new Float64Array(K * M);
        for (let A = 0; A < K * M; A++) w[A] = g[A * 3 + c];
        (gauss1(w, M, 1, K, 2, !1), gauss1(w, K, M, M, 2, !1));
        for (let A = 0; A < K * M; A++) ((at[A * 3 + c] += w[A]), Math.abs(w[A]) > 0.05 && p++);
      }
    }
    s.hug = p;
  }
  const fe = (a, r) => [at[(a * M + r) * 3], at[(a * M + r) * 3 + 1], at[(a * M + r) * 3 + 2]],
    Dt = new Float64Array(K * M * 3);
  for (let a = 0; a < K; a++)
    for (let r = 0; r < M; r++) {
      const d = V3.sub(fe(Math.min(K - 1, a + 1), r), fe(Math.max(0, a - 1), r)),
        m = V3.sub(fe(a, Math.min(M - 1, r + 1)), fe(a, Math.max(0, r - 1)));
      let i = V3.norm(V3.cross(d, m));
      Dt.set(i, (a * M + r) * 3);
    }
  let xo = 0;
  for (let a = 0; a < K; a++) {
    const r = M >> 1,
      d = [Dt[(a * M + r) * 3], Dt[(a * M + r) * 3 + 1], Dt[(a * M + r) * 3 + 2]];
    xo += Math.sign(V3.dot(d, V3.sub(fe(a, r), Pt[Ht + a])));
  }
  const bo = xo < 0;
  if (bo) for (let a = 0; a < Dt.length; a++) Dt[a] = -Dt[a];
  if (o.nSig > 0) {
    for (let a = 0; a < 3; a++) {
      const r = new Float64Array(K * M);
      for (let d = 0; d < K * M; d++) r[d] = Dt[d * 3 + a];
      (gauss1(r, M, 1, K, o.nSig, !1), gauss1(r, K, M, M, o.nSig, !1));
      for (let d = 0; d < K * M; d++) Dt[d * 3 + a] = r[d];
    }
    for (let a = 0; a < K * M; a++) {
      const r = Math.hypot(Dt[a * 3], Dt[a * 3 + 1], Dt[a * 3 + 2]) || 1;
      ((Dt[a * 3] /= r), (Dt[a * 3 + 1] /= r), (Dt[a * 3 + 2] /= r));
    }
  }
  const Ot = new Float64Array(at.length),
    Lt = new Float64Array(at.length),
    Co = [n.ML, n.MM];
  for (let a = 0; a < K; a++)
    for (let r = 0; r < M; r++) {
      const d = (a * M + r) * 3,
        m = fe(a, r),
        i = [Dt[d], Dt[d + 1], Dt[d + 2]];
      let p = o.clear;
      for (const c of Co) {
        const w = V3.len(V3.sub(m, c));
        w < o.relR && (p += o.relD * 0.5 * (1 + Math.cos((Math.PI * w) / o.relR)));
      }
      if (o.reliefs)
        for (const c of o.reliefs) {
          const w = V3.len(V3.sub(m, c.p));
          w < c.r && (p += c.d * 0.5 * (1 + Math.cos((Math.PI * w) / c.r)));
        }
      const f = te[Ht + a] - te[Ht];
      f < o.flareL && (p += o.flare * (1 - f / o.flareL) ** 2);
      const g = o.t + o.tAnk * smooth(-25, -5, m[2]) * (1 - smooth(45, 75, m[2]));
      for (let c = 0; c < 3; c++) ((Ot[d + c] = m[c] + i[c] * p), (Lt[d + c] = m[c] + i[c] * (p + g)));
    }
  if ((h && h("In", Ot, K, M, s.aSw != null ? s.aSw : 0), o.flat)) {
    const a = new Float64Array(K).fill(1 / 0),
      r = new Float64Array(K),
      d = pl(n, "CA"),
      m = V3.mid(pl(n, "M1"), pl(n, "M5")),
      i = Math.max(20, m[1] - d[1]),
      p = (m[2] - d[2]) / i,
      f = (c) => d[2] + p * (c - d[1]) - o.clear - o.t;
    for (let c = 0; c < K; c++)
      if (((r[c] = (1 - smooth(-12, 2, Pt[Ht + c][2])) * smooth(o.soleT0, o.soleT1, ye[Ht + c][1])), !(r[c] <= 0)))
        for (let w = 0; w < M; w++) a[c] = Math.min(a[c], Lt[(c * M + w) * 3 + 2]);
    const g = new Float64Array(K * M);
    for (let c = 0; c < K; c++)
      if (!(r[c] <= 0))
        for (let w = 0; w < M; w++) {
          const A = c * M + w,
            F = A * 3 + 2,
            R = f(Lt[F - 1]);
          if (!(Lt[F] > R)) continue;
          const H = Math.max(Lt[F] - a[c], at[F] - Z(at[F - 2], at[F - 1]), 0),
            X = Lt[F] - R,
            Y =
              (1 - smooth(o.soleB0, o.soleB1 + 0.8 * Math.min(X, o.soleDropCap), H)) *
              r[c] *
              smooth(o.soleN0, o.soleN1, -Dt[A * 3 + 2]);
          g[A] = -Y * X;
        }
    (gauss1(g, M, 1, K, o.soleSig, !1), gauss1(g, K, M, M, o.soleSig, !1));
    for (let c = 0; c < K * M; c++) {
      const w = c * 3 + 2,
        A = Lt[w];
      if (!(g[c] < 0)) continue;
      const F = smooth(0.2, 3, Ot[w] - A);
      F <= 0 || (Lt[w] += g[c] * F);
    }
    s.soleSlope = Math.atan(p) * DEG;
  }
  {
    let a = 0;
    const r = M - 1,
      d = (m, i, p) => {
        const f = (i * M + p) * 3,
          g = ((i + 1) * M + p) * 3,
          c = ((i + 1) * M + p + 1) * 3,
          w = (i * M + p + 1) * 3,
          A = [m[c] - m[f], m[c + 1] - m[f + 1], m[c + 2] - m[f + 2]],
          F = [m[w] - m[g], m[w + 1] - m[g + 1], m[w + 2] - m[g + 2]];
        return V3.cross(A, F);
      };
    for (let m = 0; m < 25; m++) {
      const i = new Uint8Array(K * M);
      let p = 0;
      for (let g = 0; g < K - 1; g++)
        for (let c = 0; c < r; c++) {
          const w = d(Ot, g, c),
            A = d(at, g, c),
            F = V3.len(w),
            R = V3.len(A);
          if (R > 0 && (V3.dot(w, A) < 0.25 * F * R || F < 0.05 * R)) {
            p++;
            for (let H = -2; H <= 3; H++)
              for (let X = -2; X <= 3; X++) {
                const Y = g + H,
                  I = c + X;
                Y >= 0 && I >= 0 && Y < K && I < M && (i[Y * M + I] = 1);
              }
          }
        }
      if (!p) break;
      a = Math.max(a, p);
      const f = Float64Array.from(Ot);
      for (let g = 0; g < K; g++)
        for (let c = 0; c < M; c++) {
          const w = g * M + c;
          if (!i[w]) continue;
          const A = w * 3,
            F = [],
            R = g === 0 || g === K - 1,
            H = c === 0 || c === M - 1;
          if (R && H) continue;
          ((!H || R) && (c > 0 && F.push(A - 3), c < M - 1 && F.push(A + 3)),
            (!R || H) && (g > 0 && F.push(A - M * 3), g < K - 1 && F.push(A + M * 3)));
          for (let I = 0; I < 3; I++) {
            let N = 0;
            for (const q of F) N += f[q + I];
            ((N /= F.length), (Ot[A + I] = f[A + I] + 0.6 * (N - f[A + I])));
          }
          let X = 0;
          for (let I = 0; I < 3; I++) X += (Lt[A + I] - Ot[A + I]) * Dt[A + I];
          const Y = 0.6 * o.t;
          if (X < Y) for (let I = 0; I < 3; I++) Ot[A + I] -= Dt[A + I] * (Y - X);
        }
    }
    a && (s.inFold = a);
  }
  for (const [a, r, d, m] of [
    [0, 0, 1, 1],
    [0, M - 1, 1, -1],
    [K - 1, 0, -1, 1],
    [K - 1, M - 1, -1, -1],
  ]) {
    const i = a * M + r,
      p = (a + d) * M + r + m,
      f = (a + d) * M + r,
      g = a * M + r + m;
    for (const c of [at, Lt, Ot]) {
      const w = Math.hypot(c[i * 3] - c[p * 3], c[i * 3 + 1] - c[p * 3 + 1], c[i * 3 + 2] - c[p * 3 + 2]),
        A =
          (Math.hypot(c[f * 3] - c[p * 3], c[f * 3 + 1] - c[p * 3 + 1], c[f * 3 + 2] - c[p * 3 + 2]) +
            Math.hypot(c[g * 3] - c[p * 3], c[g * 3 + 1] - c[p * 3 + 1], c[g * 3 + 2] - c[p * 3 + 2])) /
          2;
      if (w < 0.6 * A * Math.SQRT2)
        for (let F = 0; F < 3; F++) c[i * 3 + F] = c[f * 3 + F] + c[g * 3 + F] - c[p * 3 + F];
    }
  }
  if (o.fixCells && o.fixCells.length) {
    const a = o.fixR || [4, 8],
      r = new Float64Array(K * M);
    for (const [d, m] of o.fixCells)
      for (let i = Math.max(0, d - a[0]); i <= Math.min(K - 1, d + a[0]); i++)
        for (let p = Math.max(0, m - a[1]); p <= Math.min(M - 1, m + a[1]); p++) {
          const f = Math.hypot((i - d) / a[0], (p - m) / a[1]);
          r[i * M + p] = Math.max(r[i * M + p], 1 - smooth(0.4, 1, f));
        }
    for (const d of [Lt, Ot])
      for (let m = 0; m < 6; m++) {
        const i = Float64Array.from(d);
        for (let p = 0; p < K; p++)
          for (let f = 0; f < M; f++) {
            const g = p * M + f,
              c = r[g];
            if (c <= 0) continue;
            const w = g * 3,
              A = [],
              F = p === 0 || p === K - 1,
              R = f === 0 || f === M - 1;
            if (!(F && R)) {
              ((!R || F) && (f > 0 && A.push(w - 3), f < M - 1 && A.push(w + 3)),
                (!F || R) && (p > 0 && A.push(w - M * 3), p < K - 1 && A.push(w + M * 3)));
              for (let H = 0; H < 3; H++) {
                let X = 0;
                for (const Y of A) X += i[Y + H];
                ((X /= A.length), (d[w + H] = i[w + H] + 0.5 * c * (X - i[w + H])));
              }
              if (R && !F && M > 3) {
                const H = f === 0 ? 3 : -3,
                  X = w + H,
                  Y = w + 2 * H;
                for (let I = 0; I < 3; I++) {
                  const N = 2 * i[X + I] - i[Y + I];
                  d[w + I] += 0.35 * c * (N - d[w + I]);
                }
              }
            }
          }
      }
  }
  if (o.outIt > 0) {
    const a = new Float64Array(K * M);
    for (let i = 0; i < K * M; i++) {
      let p = 0;
      for (let f = 0; f < 3; f++) p += (Lt[i * 3 + f] - Ot[i * 3 + f]) * Dt[i * 3 + f];
      a[i] = p;
    }
    s.thinIn = 0;
    for (let i = 0; i < K * M; i++) a[i] < 0.5 * o.t && s.thinIn++;
    const r = new Float64Array(Lt.length),
      d = (i) => {
        r.set(Lt);
        for (let p = 0; p < K; p++)
          for (let f = 0; f < M; f++) {
            const g = p * M + f,
              c = g * 3,
              w = [],
              A = p === 0 || p === K - 1,
              F = f === 0 || f === M - 1;
            if (
              ((!F || A) && (f > 0 && w.push(c - 3), f < M - 1 && w.push(c + 3)),
              (!A || F) && (p > 0 && w.push(c - M * 3), p < K - 1 && w.push(c + M * 3)),
              A && F)
            )
              continue;
            const R = Io(p, f) * Math.min(1, Math.min(p, K - 1 - p, f, M - 1 - f) / o.outEdge);
            if (!(R <= 0))
              for (let H = 0; H < 3; H++) {
                let X = 0;
                for (const Y of w) X += r[Y + H];
                ((X /= w.length), (Lt[c + H] = r[c + H] + i * R * (X - r[c + H])));
              }
          }
      },
      m = () => {
        for (let i = 0; i < K * M; i++) {
          const p = i * 3;
          let f = 0;
          for (let A = 0; A < 3; A++) f += (Lt[p + A] - Ot[p + A]) * Dt[p + A];
          const g = Math.max(o.t * o.tMinF, Math.min(a[i], o.t) * o.tMinF),
            c = Math.max(a[i], g) + o.tAdd,
            w = f < g ? g - f : f > c ? c - f : 0;
          if (w) for (let A = 0; A < 3; A++) Lt[p + A] += Dt[p + A] * w;
        }
      };
    for (let i = 0; i < o.outIt; i++) (d(0.5), d(-0.53), (i % 2 === 1 || i === o.outIt - 1) && m());
    {
      let i = 1e9,
        p = 0;
      for (let f = 0; f < K * M; f++) {
        let g = 0;
        for (let c = 0; c < 3; c++) g += (Lt[f * 3 + c] - Ot[f * 3 + c]) * Dt[f * 3 + c];
        (g < i && ((i = g), (s.thickAt = [Math.floor(f / M), f % M, K, M, a[f]])), (p = Math.max(p, g)));
      }
      s.thick = [+i.toFixed(2), +p.toFixed(2)];
    }
  }
  const Te = new Uint8Array((K - 1) * (M - 1));
  s.rivets = [];
  const vo = [];
  s.artic = null;
  let Je = -1,
    Bo = -1;
  const to = new Uint8Array((K - 1) * (M - 1));
  if (o.artic) {
    const a = o.artGap / 2,
      r = M - 1,
      d = (() => {
        let p = 0;
        for (; p < K - 1 && te[Ht + p] < Qt + 10; ) p++;
        return p;
      })(),
      m = (p, f, g) => {
        let c = 0;
        for (const [w, A] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ])
          c += p[((f + w) * M + g + A) * 3 + 2];
        return c / 4;
      };
    let i = 0;
    for (let p = 0; p < K - 1; p++)
      for (let f = 0; f < r; f++) {
        let g = 1e9,
          c = -1e9;
        for (const [w, A] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ]) {
          const F = at[((p + w) * M + f + A) * 3 + 2];
          ((g = Math.min(g, F)), (c = Math.max(c, F)));
        }
        c > -a && g < a && ((to[p * r + f] = 1), i++);
      }
    if (i > 8) {
      for (let p = 0; p < to.length; p++) to[p] && (Te[p] = 3);
      ((Je = 0), (s.artic = { gap: +(2 * a).toFixed(1), cells: i, joints: [] }));
    } else s.artic = { fail: "o plano do eixo dos maléolos não cruza a casca" };
  }
  if (o.rivets) {
    const a = (f) => {
        const g = [0];
        for (let c = 1; c < M; c++) {
          const w = (f * M + c) * 3,
            A = w - 3;
          g.push(g[c - 1] + Math.hypot(at[w] - at[A], at[w + 1] - at[A + 1], at[w + 2] - at[A + 2]));
        }
        return g;
      },
      r = (f) => te[Ht + f] - te[Ht],
      d = (f) => {
        let g = null,
          c = 1e9;
        for (let w = 2; w < K - 2; w++) {
          const A = f(w);
          A != null && Math.abs(A) < c && ((c = Math.abs(A)), (g = w));
        }
        return g;
      },
      m = (f, g, c) => {
        const w = Math.floor(c),
          A = c - w,
          F = (g * M + w) * 3,
          R = F + 3;
        return [f[F] + (f[R] - f[F]) * A, f[F + 1] + (f[R + 1] - f[F + 1]) * A, f[F + 2] + (f[R + 2] - f[F + 2]) * A];
      },
      i = [];
    (o.rvCalf && i.push(["panturrilha", d((f) => r(f) - o.rvTopGap)]),
      o.rvAnk &&
        i.push([
          "tornozelo",
          d((f) => (te[Ht + f] < Qt ? Pt[Ht + f][2] - (Je >= 0 ? -(o.artGap / 2 + o.artArm + 9) : o.rvAnkZ) : null)),
        ]),
      o.rvFore &&
        i.push([
          "antepé",
          d((f) => (te[Ht + f] >= Qt && Pt[Ht + f][1] < O + 5 ? Pt[Ht + f][1] - (O - o.rvForeBack) : null)),
        ]));
    const p = Math.sign(n.ML[0] - n.MM[0]) || 1;
    for (const [f, g] of i) {
      if (g == null) continue;
      const c = a(g),
        w = c[M - 1];
      if (w < 2 * o.rvInset + 8) {
        s.rivetsSkipped = (s.rivetsSkipped || []).concat(f);
        continue;
      }
      for (const A of [o.rvInset, w - o.rvInset]) {
        let F = 0;
        for (; F < M - 2 && c[F + 1] < A; ) F++;
        const R = F + Math.min(1, Math.max(0, (A - c[F]) / (c[F + 1] - c[F] || 1))),
          H = m(Lt, g, R),
          X = m(Ot, g, R),
          Y = m(at, g, R),
          I = g * M + Math.round(R),
          N = [Dt[I * 3], Dt[I * 3 + 1], Dt[I * 3 + 2]];
        s.rivets.push({
          name: f,
          lado: Math.sign(Y[0]) === p ? "lateral" : "medial",
          a: g,
          jf: R,
          pO: H,
          pI: X,
          n: N,
          z: +Y[2].toFixed(0),
          y: +(Y[1] - pl(n, "CA")[1]).toFixed(0),
          edge: o.rvInset,
        });
      }
    }
  }
  if (Je >= 0) {
    const a = Math.sign(n.ML[0] - n.MM[0]) || 1,
      r = (() => {
        let d = 0;
        for (; d < K - 1 && te[Ht + d] < Qt + 10; ) d++;
        return d;
      })();
    for (const d of [1, -1]) {
      const m = (c) => {
          let w = -1,
            A = 1e9;
          for (let F = 2; F < Math.min(K - 3, r); F++)
            for (let R = 2; R < M - 3; R++) {
              const H = (F * M + R) * 3;
              if (Math.sign(at[H]) * a !== d) continue;
              const X = Math.abs(at[H + 2] - c) + 0.7 * Math.abs(at[H + 1]);
              X < A && ((A = X), (w = F * M + R));
            }
          return w;
        },
        i = m(0);
      if (i < 0) continue;
      const p = Math.floor(i / M),
        f = i % M;
      let g = 1e9;
      {
        const c = f < M / 2 ? -1 : 1;
        let w = 0;
        for (let A = f; A > 0 && A < M - 1; A += c) {
          const F = (p * M + A) * 3,
            R = (p * M + A + c) * 3;
          w += Math.hypot(at[F] - at[R], at[F + 1] - at[R + 1], at[F + 2] - at[R + 2]);
        }
        g = w;
      }
      s.artic.joints.push({
        lado: d > 0 ? "lateral" : "medial",
        z: +at[i * 3 + 2].toFixed(0),
        y: +at[i * 3 + 1].toFixed(0),
        frente: +g.toFixed(0),
      });
      for (const [c, w] of [
        ["acima", o.artGap / 2 + o.artArm],
        ["abaixo", -(o.artGap / 2 + o.artArm)],
      ]) {
        const A = m(w);
        if (A < 0) continue;
        const F = Math.floor(A / M),
          R = A % M;
        s.rivets.push({
          name: "articulação " + c,
          lado: d > 0 ? "lateral" : "medial",
          a: F,
          jf: R,
          pO: [Lt[A * 3], Lt[A * 3 + 1], Lt[A * 3 + 2]],
          pI: [Ot[A * 3], Ot[A * 3 + 1], Ot[A * 3 + 2]],
          n: [Dt[A * 3], Dt[A * 3 + 1], Dt[A * 3 + 2]],
          z: +at[A * 3 + 2].toFixed(0),
          y: +(at[A * 3 + 1] - pl(n, "CA")[1]).toFixed(0),
          edge: 0,
          mode: o.artMode,
          d: o.artD,
          joint: !0,
        });
      }
    }
  }
  for (const a of s.rivets) {
    const r = a.mode || o.rvMode,
      d = a.d || o.rvD;
    if (r === "furo") {
      const m = d / 2,
        i = Math.round(a.jf),
        p = a.pO,
        f = V3.norm(V3.rej(V3.sub(fe(Math.min(K - 1, a.a + 1), i), fe(Math.max(0, a.a - 1), i)), a.n)),
        g = V3.cross(a.n, f),
        c = (N, q, st) => {
          const St = q * 3,
            Mt = [N[St] - st[0], N[St + 1] - st[1], N[St + 2] - st[2]];
          return Math.hypot(V3.dot(Mt, f), V3.dot(Mt, g));
        };
      let w = 1,
        A = 1,
        F = !1;
      for (let N = 0; N < 12; N++) {
        const q = a.a - w,
          st = a.a + w,
          St = i - A,
          Mt = i + A;
        if (q < 1 || st > K - 2 || St < 1 || Mt > M - 2) break;
        let Xt = !1,
          Nt = !1;
        const Ft = m + 0.9;
        for (let xt = St; xt <= Mt; xt++)
          for (const bt of [q, st]) (c(Lt, bt * M + xt, a.pO) < Ft || c(Ot, bt * M + xt, a.pI) < Ft) && (Xt = !0);
        for (let xt = q; xt <= st; xt++)
          for (const bt of [St, Mt]) (c(Lt, xt * M + bt, a.pO) < Ft || c(Ot, xt * M + bt, a.pI) < Ft) && (Nt = !0);
        if (!Xt && !Nt) {
          F = !0;
          break;
        }
        (Xt && w++, Nt && A++);
      }
      const R = a.a - w,
        H = a.a + w,
        X = i - A,
        Y = i + A;
      let I = F;
      if (I) for (let N = R; N < H; N++) for (let q = X; q < Y; q++) Te[N * (M - 1) + q] && (I = !1);
      if (!I) {
        a.holeFail = !0;
        continue;
      }
      for (let N = R; N < H; N++) for (let q = X; q < Y; q++) Te[N * (M - 1) + q] = 2;
      vo.push({ r: a, a0: R, a1: H, j0: X, j1: Y, rr: m, u: f, v: g, jc: i });
    } else {
      const m = o.rvMarkR;
      for (let i = Math.max(0, a.a - 6); i <= Math.min(K - 1, a.a + 6); i++)
        for (let p = Math.max(0, Math.floor(a.jf) - 8); p <= Math.min(M - 1, Math.floor(a.jf) + 8); p++) {
          const f = i * M + p,
            g = f * 3,
            c = Math.hypot(Lt[g] - a.pO[0], Lt[g + 1] - a.pO[1], Lt[g + 2] - a.pO[2]);
          if (c < m) {
            const w = o.rvMarkD * (1 - (c / m) ** 2) ** 2;
            for (let A = 0; A < 3; A++) Lt[g + A] -= Dt[g + A] * w;
          }
        }
    }
  }
  const Ce = new Float64Array(K * M).fill(NaN);
  {
    const r = new Map(),
      d = (m, i, p) => (m * 73856093) ^ (i * 19349663) ^ (p * 83492791);
    for (let m = 0; m < l; m++) {
      const i = d(Math.floor(t[m * 3] / 4), Math.floor(t[m * 3 + 1] / 4), Math.floor(t[m * 3 + 2] / 4));
      let p = r.get(i);
      (p || ((p = []), r.set(i, p)), p.push(m));
    }
    for (let m = 0; m < K * M; m++) {
      const i = Ot[m * 3],
        p = Ot[m * 3 + 1],
        f = Ot[m * 3 + 2],
        g = Math.floor(i / 4),
        c = Math.floor(p / 4),
        w = Math.floor(f / 4);
      let A = 1 / 0,
        F = -1;
      for (let R = -1; R <= 1; R++)
        for (let H = -1; H <= 1; H++)
          for (let X = -1; X <= 1; X++) {
            const Y = r.get(d(g + R, c + H, w + X));
            if (Y)
              for (const I of Y) {
                const N = (t[I * 3] - i) ** 2 + (t[I * 3 + 1] - p) ** 2 + (t[I * 3 + 2] - f) ** 2;
                N < A && ((A = N), (F = I));
              }
          }
      F >= 0 &&
        (Ce[m] = (i - t[F * 3]) * Dt[m * 3] + (p - t[F * 3 + 1]) * Dt[m * 3 + 1] + (f - t[F * 3 + 2]) * Dt[m * 3 + 2]);
    }
  }
  if (o.dbg) {
    const a = [];
    for (let d = 0; d < K * M; d++) Ce[d] < -1 && a.push(d);
    (a.sort((d, m) => Ce[d] - Ce[m]),
      (s.gapWorst = a
        .slice(0, 12)
        .map((d) => [
          +Ce[d].toFixed(1),
          Math.floor(d / M) - (s.aSw || 0),
          d % M,
          +Ot[d * 3].toFixed(0),
          +Ot[d * 3 + 1].toFixed(0),
          +Ot[d * 3 + 2].toFixed(0),
        ])));
    {
      const m = new Map(),
        i = (g, c, w) => (g * 73856093) ^ (c * 19349663) ^ (w * 83492791);
      for (let g = 0; g < K * M; g++) {
        const c = i(Math.floor(Ot[g * 3] / 4), Math.floor(Ot[g * 3 + 1] / 4), Math.floor(Ot[g * 3 + 2] / 4));
        let w = m.get(c);
        (w || ((w = []), m.set(c, w)), w.push(g));
      }
      const p = [];
      let f = 0;
      for (let g = 0; g < l; g++) {
        const c = t[g * 3],
          w = t[g * 3 + 1],
          A = t[g * 3 + 2];
        if (A > o.top - 5) continue;
        const F = Math.floor(c / 4),
          R = Math.floor(w / 4),
          H = Math.floor(A / 4);
        let X = 1 / 0,
          Y = -1;
        for (let st = -1; st <= 1; st++)
          for (let St = -1; St <= 1; St++)
            for (let Mt = -1; Mt <= 1; Mt++) {
              const Xt = m.get(i(F + st, R + St, H + Mt));
              if (Xt)
                for (const Nt of Xt) {
                  const Ft = (Ot[Nt * 3] - c) ** 2 + (Ot[Nt * 3 + 1] - w) ** 2 + (Ot[Nt * 3 + 2] - A) ** 2;
                  Ft < X && ((X = Ft), (Y = Nt));
                }
            }
        if (Y < 0) continue;
        const I = Math.floor(Y / M),
          N = Y % M;
        if (I < 2 || I > K - 3 || N < 2 || N > M - 3) continue;
        const q =
          (c - Ot[Y * 3]) * Dt[Y * 3] + (w - Ot[Y * 3 + 1]) * Dt[Y * 3 + 1] + (A - Ot[Y * 3 + 2]) * Dt[Y * 3 + 2];
        (q > 0.5 && f++,
          q > 0.8 * o.t && p.push([+q.toFixed(1), I - (s.aSw || 0), N, +c.toFixed(0), +w.toFixed(0), +A.toFixed(0)]));
      }
      (p.sort((g, c) => c[0] - g[0]), (s.skinOut = { pres: f, poke: p.length, worst: p.slice(0, 8) }));
    }
    const r = {};
    for (const d of a) {
      const m = Math.floor(d / M) - (s.aSw || 0),
        i = m < -40 ? "leg" : m < 0 ? "heelbend" : m < 40 ? "rear" : "fore";
      r[i] = (r[i] || 0) + 1;
    }
    s.gapReg = r;
  }
  if (((s.slots = []), o.slots)) {
    const a = (i) => {
        const p = [0];
        for (let f = 1; f < M; f++) {
          const g = (i * M + f) * 3,
            c = g - 3;
          p.push(p[f - 1] + Math.hypot(at[g] - at[c], at[g + 1] - at[c + 1], at[g + 2] - at[c + 2]));
        }
        return p;
      },
      r = (i) => te[Ht + i] - te[Ht],
      d = (i, p) => {
        if (p == null || p < 3 || p > K - 4) return;
        const f = o.strapW + 2;
        let g = p,
          c = p;
        for (; g > 2 && r(p) - r(g - 1) <= f / 2; ) g--;
        for (; c < K - 3 && r(c + 1) - r(p) <= f / 2; ) c++;
        if (r(c) - r(g) < f * 0.8) return;
        for (const X of s.slots) if (!(c < X.a0 - 3 || g > X.a1 + 3)) return;
        let w = 1e9,
          A = -1,
          F = 1e9,
          R = -1;
        for (let X = g; X <= c; X++) {
          const Y = a(X),
            I = Y[M - 1];
          for (let N = 2; N < M - 3; N++) {
            const q = Y[N],
              st = I - Y[N + 1];
            (q >= o.slotInset &&
              Y[N + 1] <= o.slotInset + o.slotW + 0.01 &&
              ((w = Math.min(w, N)), (A = Math.max(A, N))),
              st >= o.slotInset &&
                I - Y[N] <= o.slotInset + o.slotW + 0.01 &&
                ((F = Math.min(F, N)), (R = Math.max(R, N))));
          }
        }
        const H = [];
        if ((A >= w && w >= 2 && H.push([w, A]), R >= F && R <= M - 4 && H.push([F, R]), !(H.length < 2))) {
          for (const [X, Y] of H) for (let I = g; I < c; I++) for (let N = X; N <= Y; N++) Te[I * (M - 1) + N] = 1;
          s.slots.push({ name: i, a0: g, a1: c, mm: +(r(c) - r(g)).toFixed(0) });
        }
      },
      m = (i) => {
        let p = null,
          f = 1e9;
        for (let g = 0; g < K; g++) {
          const c = i(g);
          c != null && Math.abs(c) < f && ((f = Math.abs(c)), (p = g));
        }
        return p;
      };
    (o.slotCalf &&
      d(
        "panturrilha",
        m((i) => r(i) - (o.slotTopGap + (o.strapW + 2) / 2)),
      ),
      o.slotAnk &&
        d(
          "tornozelo",
          m((i) => (te[Ht + i] < Qt ? Pt[Ht + i][2] - o.slotAnkZ : null)),
        ),
      o.slotFore &&
        d(
          "antepé",
          m((i) => (te[Ht + i] >= Qt && Pt[Ht + i][1] < O + 5 ? Pt[Ht + i][1] - (O - o.slotForeBack) : null)),
        ));
  }
  {
    const a = o.mat === "nylon" ? 1600 : 1200;
    let r = 1 / 0,
      d = 0,
      m = 0;
    for (let i = 0; i < K - 1; i++) {
      const p = Ht + i,
        f = Pt[p][2];
      if (te[p] >= Qt - 5 || f < o.kZ0 || f > o.kZ1) continue;
      const g = ye[p],
        c = V3.norm(V3.cross(g, [1, 0, 0]));
      if (!(V3.len(c) > 0.5)) continue;
      let w = 0,
        A = 0,
        F = 0;
      for (let H = 0; H < M - 1; H++) {
        const X = (i * M + H) * 3,
          Y = X + 3,
          I = [(Ot[X] + Lt[X]) / 2, (Ot[X + 1] + Lt[X + 1]) / 2, (Ot[X + 2] + Lt[X + 2]) / 2],
          N = [(Ot[Y] + Lt[Y]) / 2, (Ot[Y + 1] + Lt[Y + 1]) / 2, (Ot[Y + 2] + Lt[Y + 2]) / 2],
          q =
            (Math.hypot(Lt[X] - Ot[X], Lt[X + 1] - Ot[X + 1], Lt[X + 2] - Ot[X + 2]) +
              Math.hypot(Lt[Y] - Ot[Y], Lt[Y + 1] - Ot[Y + 1], Lt[Y + 2] - Ot[Y + 2])) /
            2;
        if (Te[i * (M - 1) + H]) continue;
        const st = V3.len(V3.sub(N, I)),
          St = V3.dot(V3.mid(I, N), c),
          Mt = q * st;
        ((w += Mt), (A += Mt * St), (F += Mt * St * St));
      }
      if (w <= 0) continue;
      const R = F - (A * A) / w;
      (R < r && ((r = R), (d = f)), m++);
    }
    if (m > 3 && r < 1 / 0) {
      const i = o.t + o.tAnk,
        p = o.thAnk,
        f = o.mat === "nylon" ? 3 : 3.5,
        g = p <= 75 && i >= f ? "rígida" : (p <= 95 && i >= f) || p <= 75 ? "semirrígida" : "flexível";
      s.stiff = {
        EI: +((a * r) / 1e6).toFixed(2),
        Imin: Math.round(r),
        zMin: Math.round(d),
        E: a,
        cls: g,
        th: p,
        tEff: i,
      };
    }
    Je >= 0 && (s.stiff = { EI: null, cls: "articulada", th: o.thAnk, tEff: o.t + o.tAnk, E: a });
  }
  const yo = o.edgeSeg,
    le = [];
  for (let a = 0; a < M; a++) le.push([0, a]);
  for (let a = 1; a < K; a++) le.push([a, M - 1]);
  for (let a = M - 2; a >= 0; a--) le.push([K - 1, a]);
  for (let a = K - 2; a >= 1; a--) le.push([a, 0]);
  const ve = K * M,
    Se = [],
    qe = (a) => (Se.push(a[0], a[1], a[2]), Se.length / 3 - 1);
  for (let a = 0; a < ve * 3; a++) Se.push(Lt[a]);
  for (let a = 0; a < ve * 3; a++) Se.push(Ot[a]);
  const re = (a, r) => a * M + r,
    Le = [],
    $e = [];
  let we = 0;
  const Ke = (a, r, d, m, i) => {
      (i ? Le.push(a, d, r, a, m, d) : Le.push(a, r, d, a, d, m), $e.push(we, we));
    },
    je = !bo,
    wo = [];
  for (let a = 0; a < K - 1; a++)
    for (let r = 0; r < M - 1; r++) {
      if (Te[a * (M - 1) + r]) {
        Te[a * (M - 1) + r] === 3 && wo.push([a, r]);
        continue;
      }
      we = a * M + r;
      {
        const d = re(a, r),
          m = re(a + 1, r),
          i = re(a + 1, r + 1),
          p = re(a, r + 1),
          f = [
            [d, m, a, r - 1],
            [m, i, a + 1, r],
            [i, p, a, r + 1],
            [p, d, a - 1, r],
          ];
        for (const [g, c, w, A] of f) {
          if (w < 0 || A < 0 || w >= K - 1 || A >= M - 1 || Te[w * (M - 1) + A] !== 1) continue;
          const [F, R] = je ? [c, g] : [g, c];
          (Le.push(R, F, ve + F, R, ve + F, ve + R), $e.push(we, we));
        }
      }
      (Ke(re(a, r), re(a + 1, r), re(a + 1, r + 1), re(a, r + 1), je),
        Ke(ve + re(a, r), ve + re(a + 1, r), ve + re(a + 1, r + 1), ve + re(a, r + 1), !je));
    }
  const He = o.artic ? o.artGap / 2 : 0,
    Be = (a) => at[a * 3 + 2],
    eo = new Map(),
    Ae = (a) => [Se[a * 3], Se[a * 3 + 1], Se[a * 3 + 2]];
  let We = 1;
  {
    let r = ((m, i, p) => V3.cross(V3.sub(Ae(i), Ae(m)), V3.sub(Ae(p), Ae(m))))(re(1, 1), re(2, 1), re(2, 2));
    je && (r = V3.mul(r, -1));
    const d = re(1, 1) * 3;
    We = Math.sign(V3.dot(r, [Dt[d], Dt[d + 1], Dt[d + 2]])) || 1;
  }
  const Ao = (a, r, d) => {
      const m = (a < r ? a + "_" + r : r + "_" + a) + "_" + d;
      if (eo.has(m)) return eo.get(m);
      const i = (d - Be(a)) / (Be(r) - Be(a)),
        p = (g) => [
          g[a * 3] + (g[r * 3] - g[a * 3]) * i,
          g[a * 3 + 1] + (g[r * 3 + 1] - g[a * 3 + 1]) * i,
          g[a * 3 + 2] + (g[r * 3 + 2] - g[a * 3 + 2]) * i,
        ],
        f = [qe(p(Lt)), qe(p(Ot)), i];
      return (eo.set(m, f), f);
    },
    Ye = (a, r, d, m) => {
      const i = V3.cross(V3.sub(Ae(r), Ae(a)), V3.sub(Ae(d), Ae(a)));
      (V3.dot(i, m) < 0 ? Le.push(a, d, r) : Le.push(a, r, d), $e.push(we));
    };
  for (const [a, r] of wo) {
    we = a * M + r;
    const d = re(a, r),
      m = re(a + 1, r),
      i = re(a + 1, r + 1),
      p = re(a, r + 1),
      f = [(d + m + i + p) / 4],
      g = (() => {
        let c = [0, 0, 0];
        for (const w of [d, m, i, p]) c = V3.add(c, [Dt[w * 3], Dt[w * 3 + 1], Dt[w * 3 + 2]]);
        return V3.norm(c);
      })();
    for (const c of [
      [d, m, i],
      [d, i, p],
    ])
      for (const [w, A] of [
        [He, !0],
        [-He, !1],
      ]) {
        const F = (Y) => (A ? Be(Y) >= w : Be(Y) <= w),
          R = [];
        for (let Y = 0; Y < 3; Y++) {
          const I = c[Y],
            N = c[(Y + 1) % 3];
          if ((F(I) && R.push({ o: I, i: ve + I, c: !1 }), F(I) !== F(N))) {
            const [q, st] = Ao(I, N, w);
            R.push({ o: q, i: st, c: !0 });
          }
        }
        if (R.length < 3) continue;
        const H = V3.mul(g, We),
          X = V3.mul(g, -We);
        for (let Y = 1; Y < R.length - 1; Y++) (Ye(R[0].o, R[Y].o, R[Y + 1].o, H), Ye(R[0].i, R[Y].i, R[Y + 1].i, X));
        for (let Y = 0; Y < R.length; Y++) {
          const I = R[Y],
            N = R[(Y + 1) % R.length];
          if (!(I.c && N.c)) continue;
          let q = [0, 0, 0];
          for (const St of R) q = V3.add(q, Ae(St.o));
          q = V3.mul(q, 1 / R.length);
          const st = V3.mul(V3.sub(V3.mid(Ae(I.o), Ae(N.o)), q), We);
          (Ye(I.o, N.o, N.i, st), Ye(I.o, N.i, I.i, st));
        }
      }
  }
  for (const a of vo) {
    const { r, a0: d, a1: m, j0: i, j1: p, rr: f, u: g, v: c } = a,
      w = Math.max(16, Math.round((2 * Math.PI * f) / 0.7));
    we = r.a * M + a.jc;
    const A = [];
    for (let N = i; N <= p; N++) A.push([d, N]);
    for (let N = d + 1; N <= m; N++) A.push([N, p]);
    for (let N = p - 1; N >= i; N--) A.push([m, N]);
    for (let N = m - 1; N > d; N--) A.push([N, i]);
    const F = (N) => [Se[N * 3], Se[N * 3 + 1], Se[N * 3 + 2]],
      R = (N, q, st) => {
        const St = F(N),
          Mt = F(q),
          Xt = F(st);
        return V3.cross(V3.sub(Mt, St), V3.sub(Xt, St));
      },
      H = [];
    for (const N of [0, 1]) {
      const q = N ? ve : 0,
        st = N ? r.pI : r.pO,
        St = q + re(d, i),
        Mt = q + re(d + 1, i),
        Xt = q + re(d + 1, i + 1);
      let Nt = R(St, Mt, Xt);
      (N ? !je : je) && (Nt = V3.mul(Nt, -1));
      const Ft = A.map(([V, J]) => q + re(V, J)),
        xt = (V) => {
          const J = V3.sub(F(V), st);
          return Math.atan2(V3.dot(J, c), V3.dot(J, g));
        };
      let bt = 0;
      for (let V = 0; V < Ft.length; V++) {
        let J = xt(Ft[(V + 1) % Ft.length]) - xt(Ft[V]);
        for (; J > Math.PI; ) J -= 2 * Math.PI;
        for (; J < -Math.PI; ) J += 2 * Math.PI;
        bt += J;
      }
      bt < 0 && Ft.reverse();
      let vt = 0,
        ct = 1e9;
      Ft.forEach((V, J) => {
        const pt = xt(V);
        pt < ct && ((ct = pt), (vt = J));
      });
      const mt = Ft.slice(vt).concat(Ft.slice(0, vt)),
        Ct = [xt(mt[0])];
      for (let V = 1; V < mt.length; V++) {
        let J = xt(mt[V]);
        for (; J < Ct[V - 1]; ) J += 2 * Math.PI;
        Ct.push(J);
      }
      const Wt = (() => {
          const V = [[0, 0, 0]];
          for (const Rt of mt) {
            const ut = V3.sub(F(Rt), st);
            V.push([V3.dot(ut, g), V3.dot(ut, c), V3.dot(ut, r.n)]);
          }
          const J = 5,
            pt = Array.from({ length: J }, () => new Array(J + 1).fill(0));
          for (const [Rt, ut, ft] of V) {
            const k = [Rt * Rt, Rt * ut, ut * ut, Rt, ut];
            for (let E = 0; E < J; E++) {
              for (let et = 0; et < J; et++) pt[E][et] += k[E] * k[et];
              pt[E][J] += k[E] * ft;
            }
          }
          for (let Rt = 0; Rt < J; Rt++) pt[Rt][Rt] += 1e-6;
          for (let Rt = 0; Rt < J; Rt++) {
            let ut = Rt;
            for (let ft = Rt + 1; ft < J; ft++) Math.abs(pt[ft][Rt]) > Math.abs(pt[ut][Rt]) && (ut = ft);
            [pt[Rt], pt[ut]] = [pt[ut], pt[Rt]];
            for (let ft = 0; ft < J; ft++)
              if (ft !== Rt) {
                const k = pt[ft][Rt] / pt[Rt][Rt];
                for (let E = Rt; E <= J; E++) pt[ft][E] -= k * pt[Rt][E];
              }
          }
          const Yt = pt.map((Rt, ut) => Rt[J] / Rt[ut]);
          return (Rt, ut) => {
            const ft = Yt[0] * Rt * Rt + Yt[1] * Rt * ut + Yt[2] * ut * ut + Yt[3] * Rt + Yt[4] * ut;
            return Number.isFinite(ft) ? Math.max(-1.5, Math.min(1.5, ft)) : 0;
          };
        })(),
        se = [];
      for (let V = 0; V < w; V++) {
        const J = Ct[0] + (2 * Math.PI * V) / w,
          pt = f * Math.cos(J),
          Yt = f * Math.sin(J);
        se.push(qe(V3.add(st, V3.add(V3.add(V3.mul(g, pt), V3.mul(c, Yt)), V3.mul(r.n, Wt(pt, Yt))))));
      }
      const ne = (V) => Ct[0] + (2 * Math.PI * V) / w,
        de = mt.length,
        ie = (V) => mt[V % de],
        _ = (V) => se[V % w],
        it = (V) => (V < de ? Ct[V] : Ct[0] + 2 * Math.PI),
        z = (V, J, pt) => {
          const Yt = R(V, J, pt);
          (V3.dot(Yt, Nt) < 0 ? Le.push(V, pt, J) : Le.push(V, J, pt), $e.push(we));
        };
      let P = 0,
        lt = 0;
      for (; P < de || lt < w; )
        lt < w && (P >= de || ne(lt + 1) <= it(P + 1))
          ? (z(ie(P), _(lt), _(lt + 1)), lt++)
          : (z(ie(P), _(lt), ie(P + 1)), P++);
      H.push({ C: se, s: Math.sign(V3.dot(Nt, r.n)) || 1 });
    }
    const [X, Y] = [H[0].C, H[1].C],
      I = H[0].s;
    for (let N = 0; N < w; N++) {
      const q = (N + 1) % w,
        st = X[N],
        St = X[q],
        Mt = Y[q],
        Xt = Y[N],
        Nt = V3.mul(V3.add(V3.add(F(st), F(St)), V3.add(F(Mt), F(Xt))), 0.25),
        Ft = V3.mul(V3.sub(V3.mid(r.pO, r.pI), Nt), I),
        xt = R(st, St, Mt);
      (V3.dot(xt, Ft) < 0 ? Le.push(st, Mt, St, st, Xt, Mt) : Le.push(st, St, Mt, st, Mt, Xt), $e.push(we, we));
    }
  }
  const Ie = [le.map(([a, r]) => ve + re(a, r))],
    ze = le.length;
  for (let a = 1; a < yo; a++) {
    const r = (-90 + (180 * a) / yo) / DEG;
    Ie.push(
      le.map(([d, m], i) => {
        const p = re(d, m) * 3,
          f = [Ot[p], Ot[p + 1], Ot[p + 2]],
          g = [Lt[p], Lt[p + 1], Lt[p + 2]],
          c = V3.mid(f, g),
          w = V3.len(V3.sub(g, f)) / 2,
          A = V3.norm(V3.sub(g, f));
        let F = [0, 0, 0];
        if (
          (d === 0 && (F = V3.add(F, V3.sub(fe(0, m), fe(1, m)))),
          d === K - 1 && (F = V3.add(F, V3.sub(fe(K - 1, m), fe(K - 2, m)))),
          m === 0 && (F = V3.add(F, V3.sub(fe(d, 0), fe(d, 1)))),
          m === M - 1 && (F = V3.add(F, V3.sub(fe(d, M - 1), fe(d, M - 2)))),
          (F = V3.norm(V3.rej(F, A))),
          o.rimTan)
        ) {
          const [H, X] = le[(i + 1) % ze],
            [Y, I] = le[(i - 1 + ze) % ze],
            N = V3.sub(fe(H, X), fe(Y, I));
          let q = V3.cross(N, A);
          const st = V3.len(q);
          st > 1e-6 &&
            ((q = V3.mul(q, 1 / st)),
            V3.dot(q, F) < 0 && (q = V3.mul(q, -1)),
            ((d === 0 || d === K - 1) && (m === 0 || m === M - 1)) || (F = q));
        }
        let R = 1;
        if (o.rimFlat) {
          const [H, X] = le[(i + 1) % ze],
            [Y, I] = le[(i - 1 + ze) % ze],
            N = V3.sub(fe(H, X), fe(Y, I)),
            q = V3.len(N);
          if (q > 1e-6) {
            const st = Math.abs(V3.dot(F, N)) / q;
            R = Math.max(0.15, Math.min(1, (0.35 * q) / (w * Math.max(st, 0.001))));
          }
        }
        if (((R *= o.rimScale), o.fixCells && o.fixCells.length)) {
          for (const [H, X] of o.fixCells)
            if (Math.abs(H - d) <= 5 && Math.abs(X - m) <= 6) {
              R *= 0.1;
              break;
            }
        }
        return qe(V3.add(c, V3.add(V3.mul(A, w * Math.sin(r)), V3.mul(F, R * w * Math.cos(r)))));
      }),
    );
  }
  Ie.push(le.map(([a, r]) => re(a, r)));
  const Fo = le.length,
    jo = (a, r) =>
      a[1] === r[1] && (a[1] === 0 || a[1] === M - 1) && Math.abs(a[0] - r[0]) === 1
        ? Math.min(a[0], r[0]) * (M - 1) + (a[1] === 0 ? 0 : M - 2)
        : a[0] === r[0] && (a[0] === 0 || a[0] === K - 1) && Math.abs(a[1] - r[1]) === 1
          ? (a[0] === 0 ? 0 : K - 2) * (M - 1) + Math.min(a[1], r[1])
          : -1,
    oo = Ie.length - 1,
    no = new Map();
  for (let a = 0; a < Fo; a++) {
    const r = (a + 1) % Fo,
      d = jo(le[a], le[r]);
    if (!(d >= 0 && Te[d] === 3)) {
      for (let A = 0; A < oo; A++)
        ((we = le[a][0] * M + le[a][1]), Ke(Ie[A][a], Ie[A][r], Ie[A + 1][r], Ie[A + 1][a], !je));
      continue;
    }
    const m = re(le[a][0], le[a][1]),
      i = re(le[r][0], le[r][1]),
      p = Be(m),
      f = Be(i),
      g = [];
    we = le[a][0] * M + le[a][1];
    for (const A of [He, -He]) (p - A) * (f - A) < 0 && g.push([(A - p) / (f - p), A]);
    g.sort((A, F) => A[0] - F[0]);
    const c = [[0, null], ...g, [1, null]],
      w = (A, F) => {
        if (F == null) return Ie.map((I) => (A === 0 ? I[a] : I[r]));
        const R = m < i ? m + "_" + i + "_" + F : i + "_" + m + "_" + F;
        if (no.has(R)) return no.get(R);
        const [H, X] = Ao(m, i, F),
          Y = Ie.map((I, N) => {
            if (N === 0) return X;
            if (N === oo) return H;
            const q = Ae(I[a]),
              st = Ae(I[r]);
            return qe(V3.add(q, V3.mul(V3.sub(st, q), A)));
          });
        return (no.set(R, Y), Y);
      };
    for (let A = 0; A < c.length - 1; A++) {
      const [F, R] = c[A],
        [H, X] = c[A + 1],
        Y = p + ((f - p) * (F + H)) / 2;
      if (Math.abs(Y) < He) continue;
      const I = w(F, R),
        N = w(H, X);
      for (let q = 0; q < oo; q++) Ke(I[q], N[q], N[q + 1], I[q + 1], !je);
      for (const [q, st] of [
        [I, R != null ? -1 : 0],
        [N, X != null ? 1 : 0],
      ]) {
        if (!st) continue;
        const St = V3.mul(V3.sub(fe(le[r][0], le[r][1]), fe(le[a][0], le[a][1])), st * We);
        for (let Mt = 1; Mt < q.length - 1; Mt++) Ye(q[0], q[Mt], q[Mt + 1], St);
      }
    }
  }
  let ee = new Float64Array(Se),
    me = new Uint32Array(Le);
  if (o.dbg) {
    const a = [],
      r = meshCheck(ee, me, a),
      d = (K - 1) * (M - 1),
      m = (p) => {
        const f = $e[p];
        return "c" + (Math.floor(f / M) - (s.aSw || 0)) + ":" + (f % M);
      };
    s.crossPairs = a.slice(0, 20).map(([p, f]) => m(p) + " x " + m(f));
    const i = {};
    for (const p of r.where) {
      let f = 1e9,
        g = -1;
      for (let F = 0; F < ve * 2; F++) {
        const R = (ee[F * 3] - p[0]) ** 2 + (ee[F * 3 + 1] - p[1]) ** 2 + (ee[F * 3 + 2] - p[2]) ** 2;
        R < f && ((f = R), (g = F));
      }
      const c = g < ve ? "out" : "in",
        w = g % ve,
        A = c + ":" + (Math.floor(w / M) - (s.aSw || 0)) + ":" + (w % M);
      i[A] = (i[A] || 0) + 1;
    }
    s.crossAt = i;
  }
  if (o.selfCheck) {
    const a = [],
      r = performance.now(),
      d = meshCheck(ee, me, a, !0);
    ((s.check = d.n), (s.checkMs = performance.now() - r));
    const m = (K - 1) * (M - 1),
      i = new Map(),
      p = (f) => {
        const g = $e[f];
        return [Math.floor(g / M), g % M];
      };
    for (const [f, g] of a)
      for (const c of [p(f), p(g)]) {
        const w = Math.round(c[0] / 2) + ":" + Math.round(c[1] / 3);
        i.has(w) || i.set(w, c);
      }
    ((s.crossCells = [...i.values()]), (s.checkWhere = d.where));
  }
  {
    let a = 0;
    for (let r = 0; r < ee.length; r++) Number.isFinite(ee[r]) || a++;
    if (a || K < 4)
      throw new Error(
        "A superfície não pôde ser reconstruída a partir do scan nesta posição. Confira os pontos ML, MM, CA e PX e se o scan cobre a parte de trás da perna e o calcanhar.",
      );
  }
  let _e = 0;
  for (let a = 0; a < me.length; a += 3) {
    const r = me[a] * 3,
      d = me[a + 1] * 3,
      m = me[a + 2] * 3;
    _e +=
      (ee[r] * (ee[d + 1] * ee[m + 2] - ee[d + 2] * ee[m + 1]) -
        ee[r + 1] * (ee[d] * ee[m + 2] - ee[d + 2] * ee[m]) +
        ee[r + 2] * (ee[d] * ee[m + 1] - ee[d + 1] * ee[m])) /
      6;
  }
  if (_e < 0) {
    for (let a = 0; a < me.length; a += 3) {
      const r = me[a + 1];
      ((me[a + 1] = me[a + 2]), (me[a + 2] = r));
    }
    _e = -_e;
  }
  ((s.baseTris = me.length / 3), (s.engrave = null));
  {
    const a = o.engrave ? engraveText(o.engText) : [];
    if (a.length) {
      const r = (A) => te[Ht + A] - te[Ht];
      let d = 0;
      for (; d < K - 1 && te[Ht + d] < Qt - 25; ) d++;
      const m = r(d);
      let i = o.engH,
        p = a.length,
        f = 0.6;
      const g = o.rivets && o.rvCalf ? o.rvTopGap + o.strapW / 2 + 6 : 12,
        c = (A) => A * (p + (p - 1) * f);
      g + c(i) + 5 > m && (i = Math.max(3, (m - g - 5) / (p + (p - 1) * f)));
      const w = g + c(i) / 2;
      if (g + c(i) + 5 <= m) {
        const A = (ct) => {
            let mt = 0;
            for (; mt < K - 2 && r(mt + 1) < ct; ) mt++;
            return mt + Math.max(0, Math.min(1, (ct - r(mt)) / (r(mt + 1) - r(mt) || 1)));
          },
          F = Math.round(A(w));
        let R = 0,
          H = 1e9;
        for (let ct = 0; ct < M; ct++) {
          const mt = at[(F * M + ct) * 3 + 1];
          mt < H && ((H = mt), (R = ct));
        }
        const X = V3.sub(fe(F, Math.min(M - 1, R + 1)), fe(F, Math.max(0, R - 1))),
          Y = X[0] >= 0 ? 1 : -1,
          I = new Map(),
          N = (ct) => {
            if (I.has(ct)) return I.get(ct);
            const mt = [0];
            for (let Ct = 1; Ct < M; Ct++) {
              const Wt = (ct * M + Ct) * 3,
                se = Wt - 3;
              mt.push(mt[Ct - 1] + Math.hypot(Lt[Wt] - Lt[se], Lt[Wt + 1] - Lt[se + 1], Lt[Wt + 2] - Lt[se + 2]));
            }
            return (I.set(ct, mt), mt);
          },
          q = (() => {
            const ct = N(F);
            return Math.min(ct[R], ct[M - 1] - ct[R]);
          })(),
          st = (Math.max(...a.map((ct) => ct.length * 6 - 2)) * i) / 6;
        st > 1.5 * q - 2 * o.rvInset - 8 && (i = Math.max(3, (i * (1.5 * q - 2 * o.rvInset - 8)) / st));
        const St = (ct, mt) => {
            const Ct = A(w - mt),
              Wt = Math.min(K - 2, Math.floor(Ct)),
              se = Ct - Wt,
              ne = [];
            for (const _ of [Wt, Wt + 1]) {
              const it = N(_),
                z = it[R] + Y * ct;
              let P = 0;
              for (; P < M - 2 && it[P + 1] < z; ) P++;
              const lt = Math.max(0, Math.min(1, (z - it[P]) / (it[P + 1] - it[P] || 1))),
                V = (_ * M + P) * 3,
                J = V + 3;
              ne.push([
                [
                  Lt[V] + (Lt[J] - Lt[V]) * lt,
                  Lt[V + 1] + (Lt[J + 1] - Lt[V + 1]) * lt,
                  Lt[V + 2] + (Lt[J + 2] - Lt[V + 2]) * lt,
                ],
                [
                  Dt[V] + (Dt[J] - Dt[V]) * lt,
                  Dt[V + 1] + (Dt[J + 1] - Dt[V + 1]) * lt,
                  Dt[V + 2] + (Dt[J + 2] - Dt[V + 2]) * lt,
                ],
              ]);
            }
            const de = V3.add(V3.mul(ne[0][0], 1 - se), V3.mul(ne[1][0], se)),
              ie = V3.norm(V3.add(V3.mul(ne[0][1], 1 - se), V3.mul(ne[1][1], se)));
            return [de, ie];
          },
          Mt = i / 6,
          Xt = Math.max(0.8, Math.min(1.4, i * 0.17)),
          Nt = o.engD,
          Ft = 0.6,
          xt = [],
          bt = [];
        let vt = 0;
        if (
          (a.forEach((ct, mt) => {
            const Ct = (ct.length * 6 - 2) * Mt,
              Wt = c(i) / 2 - i - mt * i * (1 + f);
            [...ct].forEach((se, ne) => {
              const de = STROKE_FONT[se];
              if (!de) return;
              const ie = -Ct / 2 + ne * 6 * Mt;
              for (const _ of de) {
                const it = [];
                for (let ut = 0; ut + 3 < _.length; ut += 2) {
                  const ft = _[ut],
                    k = _[ut + 1],
                    E = _[ut + 2],
                    et = _[ut + 3],
                    dt = Math.hypot(E - ft, et - k) * Mt,
                    ht = Math.max(1, Math.ceil(dt / 1));
                  for (let yt = 0; yt < ht; yt++) {
                    const jt = yt / ht;
                    it.push([ft + (E - ft) * jt, k + (et - k) * jt]);
                  }
                }
                it.push([_[_.length - 2], _[_.length - 1]]);
                const z = it.map(([ut, ft]) => [ie + ut * Mt, Wt + ft * Mt]);
                if (z.length < 2) continue;
                const P = (ut, ft) => {
                  const k = [ut[0] - ft[0], ut[1] - ft[1]],
                    E = Math.hypot(k[0], k[1]) || 1;
                  return [ut[0] + (k[0] / E) * Xt * 0.45, ut[1] + (k[1] / E) * Xt * 0.45];
                };
                if (Math.hypot(z[1][0] - z[0][0], z[1][1] - z[0][1]) > 1e-6) {
                  z[0] = P(z[0], z[1]);
                  const ut = z.length;
                  z[ut - 1] = P(z[ut - 1], z[ut - 2]);
                }
                const lt = z.map(([ut, ft]) => St(ut, ft)),
                  V = xt.length / 3,
                  J = lt.length;
                for (let ut = 0; ut < J; ut++) {
                  const [ft, k] = lt[ut],
                    E = lt[Math.max(0, ut - 1)][0],
                    et = lt[Math.min(J - 1, ut + 1)][0];
                  let dt = V3.norm(V3.rej(V3.sub(et, E), k)),
                    ht = V3.norm(V3.cross(k, dt)),
                    yt = 1;
                  if (ut > 0 && ut < J - 1) {
                    const zt = V3.norm(V3.rej(V3.sub(ft, E), k)),
                      Jt = V3.norm(V3.rej(V3.sub(et, ft), k)),
                      $t = V3.dot(zt, Jt);
                    yt = Math.min(2, 1 / Math.max(0.5, Math.sqrt((1 + $t) / 2)));
                  }
                  const jt = (Xt / 2) * yt;
                  for (const [zt, Jt] of [
                    [-1, -Ft],
                    [1, -Ft],
                    [1, Nt],
                    [-1, Nt],
                  ]) {
                    const $t = V3.add(ft, V3.add(V3.mul(ht, zt * jt), V3.mul(k, Jt)));
                    xt.push($t[0], $t[1], $t[2]);
                  }
                }
                const pt = [];
                for (let ut = 0; ut < J - 1; ut++)
                  for (let ft = 0; ft < 4; ft++) {
                    const k = V + ut * 4 + ft,
                      E = V + ut * 4 + ((ft + 1) % 4),
                      et = k + 4,
                      dt = E + 4;
                    pt.push(k, E, dt, k, dt, et);
                  }
                pt.push(V, V + 2, V + 1, V, V + 3, V + 2);
                const Yt = V + (J - 1) * 4;
                pt.push(Yt, Yt + 1, Yt + 2, Yt, Yt + 2, Yt + 3);
                let Rt = 0;
                for (let ut = 0; ut < pt.length; ut += 3) {
                  const ft = pt[ut] * 3,
                    k = pt[ut + 1] * 3,
                    E = pt[ut + 2] * 3;
                  Rt +=
                    xt[ft] * (xt[k + 1] * xt[E + 2] - xt[k + 2] * xt[E + 1]) -
                    xt[ft + 1] * (xt[k] * xt[E + 2] - xt[k + 2] * xt[E]) +
                    xt[ft + 2] * (xt[k] * xt[E + 1] - xt[k + 1] * xt[E]);
                }
                if (Rt < 0)
                  for (let ut = 0; ut < pt.length; ut += 3) {
                    const ft = pt[ut + 1];
                    ((pt[ut + 1] = pt[ut + 2]), (pt[ut + 2] = ft));
                  }
                ((vt += Math.abs(Rt) / 6), bt.push(...pt));
              }
            });
          }),
          bt.length)
        ) {
          const ct = ee.length / 3,
            mt = new Float64Array(ee.length + xt.length);
          (mt.set(ee), mt.set(xt, ee.length));
          const Ct = new Uint32Array(me.length + bt.length);
          Ct.set(me);
          for (let Wt = 0; Wt < bt.length; Wt++) Ct[me.length + Wt] = bt[Wt] + ct;
          ((ee = mt),
            (me = Ct),
            (_e += vt * 0.5),
            (s.engrave = { lines: a, h: +i.toFixed(1), z: +fe(F, R)[2].toFixed(0) }));
        }
      } else s.engrave = { lines: a, skipped: !0 };
    }
  }
  if (((s.wedge = null), o.lift > 0 || o.wedge > 0))
    try {
      const a = No();
      if (a) {
        const r = ee.length / 3,
          d = new Float64Array(ee.length + a.V.length);
        (d.set(ee), d.set(a.V, ee.length));
        const m = new Uint32Array(me.length + a.F.length);
        m.set(me);
        for (let i = 0; i < a.F.length; i++) m[me.length + i] = a.F[i] + r;
        ((ee = d), (me = m), (_e += a.vol), (s.wedge = a.info));
      } else s.wedge = { fail: !0 };
    } catch (a) {
      s.wedge = { fail: !0, err: String(a) };
    }
  function No() {
    const a = K * M;
    let r = 1e9;
    for (let k = 0; k < a; k++) Dt[k * 3 + 2] < -0.85 && (r = Math.min(r, Lt[k * 3 + 2]));
    let d = [];
    for (let k = 0; k < a; k++) Dt[k * 3 + 2] < -0.9 && Lt[k * 3 + 2] < r + 8 && d.push(k);
    if (d.length < 30) return null;
    let m = 0,
      i = 0,
      p = r;
    for (let k = 0; k < 4; k++) {
      let E = [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
        ],
        et = [0, 0, 0];
      for (const $t of d) {
        const ce = Lt[$t * 3],
          pe = Lt[$t * 3 + 1],
          he = Lt[$t * 3 + 2],
          xe = [ce, pe, 1];
        for (let be = 0; be < 3; be++) {
          for (let Ee = 0; Ee < 3; Ee++) E[be][Ee] += xe[be] * xe[Ee];
          et[be] += xe[be] * he;
        }
      }
      const dt = ($t) =>
          $t[0][0] * ($t[1][1] * $t[2][2] - $t[1][2] * $t[2][1]) -
          $t[0][1] * ($t[1][0] * $t[2][2] - $t[1][2] * $t[2][0]) +
          $t[0][2] * ($t[1][0] * $t[2][1] - $t[1][1] * $t[2][0]),
        ht = dt(E);
      if (Math.abs(ht) < 1e-9) break;
      [m, i, p] = [0, 1, 2].map(($t) => dt(E.map((ce, pe) => ce.map((he, xe) => (xe === $t ? et[pe] : he)))) / ht);
      const jt = d.map(($t) => Lt[$t * 3 + 2] - (m * Lt[$t * 3] + i * Lt[$t * 3 + 1] + p)),
        zt = jt.slice().sort(($t, ce) => $t - ce),
        Jt = Math.max(0.4, zt[Math.floor(zt.length * 0.6)]);
      d = d.filter(($t, ce) => jt[ce] <= Jt);
    }
    const f = V3.norm([-m, -i, 1]),
      g = [0, 0, p],
      c = V3.norm(V3.rej([1, 0, 0], f)),
      w = V3.cross(f, c),
      A = (k) => {
        const E = V3.sub([Lt[k * 3], Lt[k * 3 + 1], Lt[k * 3 + 2]], g);
        return [V3.dot(E, c), V3.dot(E, w), V3.dot(E, f)];
      },
      F = new Float64Array(a * 3);
    for (let k = 0; k < a; k++) {
      const E = A(k);
      ((F[k * 3] = E[0]), (F[k * 3 + 1] = E[1]), (F[k * 3 + 2] = E[2]));
    }
    const R = new Uint8Array(a);
    for (let k = 0; k < a; k++)
      V3.dot([Dt[k * 3], Dt[k * 3 + 1], Dt[k * 3 + 2]], f) > -0.55 || (F[k * 3 + 2] < 12 && (R[k] = 1));
    const H = new Float64Array(a * 3);
    for (let k = 0; k < a; k++) ((H[k * 3] = F[k * 3]), (H[k * 3 + 1] = F[k * 3 + 1]), (H[k * 3 + 2] = R[k] ? 0 : 1e6));
    const X = nnGrid(H, 2),
      Y = (k, E) => {
        const [et] = X(k, E, 0, 20);
        if (et < 0) return 0;
        const dt = Math.floor(et / M),
          ht = et % M;
        let yt = F[et * 3 + 2];
        for (let jt = Math.max(0, dt - 1); jt <= Math.min(K - 2, dt); jt++)
          for (let zt = Math.max(0, ht - 1); zt <= Math.min(M - 2, ht); zt++) {
            const Jt = [jt * M + zt, (jt + 1) * M + zt, (jt + 1) * M + zt + 1, jt * M + zt + 1];
            for (const [$t, ce, pe] of [
              [Jt[0], Jt[1], Jt[2]],
              [Jt[0], Jt[2], Jt[3]],
            ]) {
              const he = F[$t * 3],
                xe = F[$t * 3 + 1],
                be = F[ce * 3] - he,
                Ee = F[ce * 3 + 1] - xe,
                So = F[pe * 3] - he,
                To = F[pe * 3 + 1] - xe,
                Lo = k - he,
                Eo = E - xe,
                so = be * To - Ee * So;
              if (Math.abs(so) < 1e-9) continue;
              const lo = (Lo * To - Eo * So) / so,
                io = (be * Eo - Ee * Lo) / so;
              if (lo >= -1e-6 && io >= -1e-6 && lo + io <= 1 + 1e-6)
                return F[$t * 3 + 2] + lo * (F[ce * 3 + 2] - F[$t * 3 + 2]) + io * (F[pe * 3 + 2] - F[$t * 3 + 2]);
            }
          }
        return yt;
      },
      I = M - 1;
    let N = new Uint8Array((K - 1) * I);
    for (let k = 0; k < K - 1; k++)
      for (let E = 0; E < I; E++)
        N[k * I + E] =
          R[k * M + E] && R[(k + 1) * M + E] && R[k * M + E + 1] && R[(k + 1) * M + E + 1] && !Te[k * I + E] ? 1 : 0;
    for (let k = 0; k < 3; k++) {
      const E = N.slice();
      for (let et = 0; et < K - 1; et++)
        for (let dt = 0; dt < I; dt++) {
          if (!N[et * I + dt]) continue;
          let ht = 0;
          for (const [yt, jt] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const zt = et + yt,
              Jt = dt + jt;
            zt >= 0 && Jt >= 0 && zt < K - 1 && Jt < I && N[zt * I + Jt] && ht++;
          }
          ht < 3 && (E[et * I + dt] = 0);
        }
      N = E;
    }
    const q = new Map();
    for (let k = 0; k < K - 1; k++)
      for (let E = 0; E < I; E++) {
        if (!N[k * I + E]) continue;
        const et = [k * M + E, (k + 1) * M + E, (k + 1) * M + E + 1, k * M + E + 1],
          dt = [
            [k, E - 1],
            [k + 1, E],
            [k, E + 1],
            [k - 1, E],
          ];
        for (let ht = 0; ht < 4; ht++) {
          const [yt, jt] = dt[ht];
          (yt >= 0 && jt >= 0 && yt < K - 1 && jt < I && N[yt * I + jt]) || q.set(et[ht], et[(ht + 1) % 4]);
        }
      }
    if (
      ((s.wdbg = {
        tilt: +(Math.acos(f[2]) * DEG).toFixed(1),
        nS: R.reduce((k, E) => k + E, 0),
        nCell: N.reduce((k, E) => k + E, 0),
        nxt: q.size,
      }),
      q.size < 12)
    )
      return null;
    const st = new Set();
    let St = null;
    for (const k of q.keys()) {
      if (st.has(k)) continue;
      const E = [];
      let et = k,
        dt = 0;
      for (; !st.has(et) && dt++ < 1e5 && (st.add(et), E.push(et), (et = q.get(et)), et != null); );
      (!St || E.length > St.length) && (St = E);
    }
    let Mt = St.map((k) => {
      const E = A(k);
      return [E[0], E[1]];
    });
    for (let k = 0; k < 8; k++)
      Mt = Mt.map((et, dt) => {
        const ht = Mt[(dt - 1 + Mt.length) % Mt.length],
          yt = Mt[(dt + 1) % Mt.length];
        return [et[0] + 0.5 * ((ht[0] + yt[0]) / 2 - et[0]), et[1] + 0.5 * ((ht[1] + yt[1]) / 2 - et[1])];
      });
    {
      const k = [];
      let E = 0;
      for (let yt = 0; yt < Mt.length; yt++) {
        const jt = Mt[yt],
          zt = Mt[(yt + 1) % Mt.length];
        (k.push(E), (E += Math.hypot(zt[0] - jt[0], zt[1] - jt[1])));
      }
      const et = Math.max(24, Math.round(E / 1.5)),
        dt = [];
      let ht = 0;
      for (let yt = 0; yt < et; yt++) {
        const jt = (yt * E) / et;
        for (; ht < Mt.length - 1 && k[ht + 1] <= jt; ) ht++;
        const zt = Mt[ht],
          Jt = Mt[(ht + 1) % Mt.length],
          $t = (ht + 1 < k.length ? k[ht + 1] : E) - k[ht] || 1,
          ce = (jt - k[ht]) / $t;
        dt.push([zt[0] + (Jt[0] - zt[0]) * ce, zt[1] + (Jt[1] - zt[1]) * ce]);
      }
      Mt = dt;
    }
    let Xt = 0;
    for (let k = 0; k < Mt.length; k++) {
      const E = Mt[k],
        et = Mt[(k + 1) % Mt.length];
      Xt += E[0] * et[1] - et[0] * E[1];
    }
    Xt < 0 && Mt.reverse();
    let Nt = 1e9,
      Ft = -1e9,
      xt = 1e9,
      bt = -1e9;
    for (const [k, E] of Mt)
      ((Nt = Math.min(Nt, E)), (Ft = Math.max(Ft, E)), (xt = Math.min(xt, k)), (bt = Math.max(bt, k)));
    const vt = Math.sign(V3.dot(V3.sub(n.ML, n.MM), c)) || 1,
      ct = Math.tan(o.wedge / DEG),
      mt = o.wedgeSide === "medial" ? -vt : vt,
      Ct = mt > 0 ? xt : bt,
      Wt = (k) => {
        const E = (k - Nt) / Math.max(1, Ft - Nt);
        return o.liftReg === "toda"
          ? E < 0.7
            ? 1
            : 1 - (0.7 * (E - 0.7)) / 0.3
          : E < 0.45
            ? 1
            : E < 0.65
              ? 1 - (E - 0.45) / 0.2
              : 0;
      },
      se = (k, E) => Wt(E) * (o.lift + ct * Math.abs(k - Ct)),
      ne = (k, E, et) => {
        const dt = [];
        for (let ht = 0; ht < k.length; ht++) {
          const yt = k[ht],
            jt = k[(ht + 1) % k.length],
            zt = et ? yt[1] >= E : yt[1] <= E,
            Jt = et ? jt[1] >= E : jt[1] <= E;
          if ((zt && dt.push(yt), zt !== Jt)) {
            const $t = (E - yt[1]) / (jt[1] - yt[1]);
            dt.push([yt[0] + (jt[0] - yt[0]) * $t, E]);
          }
        }
        return dt;
      },
      de = (k) => {
        const E = k.slice(),
          et = [],
          dt = (yt, jt, zt) => (jt[0] - yt[0]) * (zt[1] - yt[1]) - (jt[1] - yt[1]) * (zt[0] - yt[0]);
        let ht = 0;
        for (; E.length > 3 && ht++ < 2e4; ) {
          let yt = !1;
          for (let jt = 0; jt < E.length; jt++) {
            const zt = E[(jt - 1 + E.length) % E.length],
              Jt = E[jt],
              $t = E[(jt + 1) % E.length];
            if (dt(zt, Jt, $t) <= 1e-9) continue;
            let ce = !1;
            for (const pe of E)
              if (
                !(pe === zt || pe === Jt || pe === $t) &&
                dt(zt, Jt, pe) > 0 &&
                dt(Jt, $t, pe) > 0 &&
                dt($t, zt, pe) > 0
              ) {
                ce = !0;
                break;
              }
            if (!ce) {
              (et.push([zt, Jt, $t]), E.splice(jt, 1), (yt = !0));
              break;
            }
          }
          yt || E.splice(0, 1);
        }
        return (E.length === 3 && dt(E[0], E[1], E[2]) > 1e-9 && et.push(E.slice()), et);
      },
      ie = [];
    for (let k = Nt; k < Ft; k += 5) {
      let E = ne(ne(Mt, k, !0), Math.min(Ft, k + 5), !1);
      if (
        ((E = E.filter((et, dt) => {
          const ht = E[(dt + 1) % E.length];
          return Math.hypot(et[0] - ht[0], et[1] - ht[1]) > 1e-6;
        })),
        !(E.length < 3) && E.some(([et, dt]) => se(et, dt) >= 0.5))
      )
        for (const et of de(E)) ie.push(et);
    }
    if (ie.length < 4) return null;
    const _ = (k) => Math.round(k[0] * 1e3) + "," + Math.round(k[1] * 1e3),
      it = new Map(),
      z = [],
      P = (k) => {
        const E = _(k);
        return (it.has(E) || (it.set(E, z.length), z.push(k)), it.get(E));
      },
      lt = ie.map((k) => k.map(P)).filter((k) => k[0] !== k[1] && k[1] !== k[2] && k[0] !== k[2]),
      V = z.length,
      J = new Float64Array(V * 6);
    let pt = 0;
    const Yt = (k, E, et) => V3.add(g, V3.add(V3.add(V3.mul(c, k), V3.mul(w, E)), V3.mul(f, et)));
    for (let k = 0; k < V; k++) {
      const [E, et] = z[k],
        dt = Math.max(0.8, se(E, et));
      ((pt = Math.max(pt, dt)), J.set(Yt(E, et, Y(E, et) + 1.2), k * 3), J.set(Yt(E, et, -dt), (V + k) * 3));
    }
    const Rt = [],
      ut = new Map();
    for (const [k, E, et] of lt) {
      Rt.push(k, E, et, V + k, V + et, V + E);
      for (const [dt, ht] of [
        [k, E],
        [E, et],
        [et, k],
      ]) {
        const yt = Math.min(dt, ht) + ":" + Math.max(dt, ht);
        ut.set(yt, (ut.get(yt) || 0) + 1);
      }
    }
    for (const [k, E, et] of lt)
      for (const [dt, ht] of [
        [k, E],
        [E, et],
        [et, k],
      ])
        ut.get(Math.min(dt, ht) + ":" + Math.max(dt, ht)) === 1 && Rt.push(V + dt, V + ht, ht, V + dt, ht, dt);
    let ft = 0;
    for (let k = 0; k < Rt.length; k += 3) {
      const E = Rt[k] * 3,
        et = Rt[k + 1] * 3,
        dt = Rt[k + 2] * 3;
      ft +=
        J[E] * (J[et + 1] * J[dt + 2] - J[et + 2] * J[dt + 1]) -
        J[E + 1] * (J[et] * J[dt + 2] - J[et + 2] * J[dt]) +
        J[E + 2] * (J[et] * J[dt + 1] - J[et + 1] * J[dt]);
    }
    if (ft < 0)
      for (let k = 0; k < Rt.length; k += 3) {
        const E = Rt[k + 1];
        ((Rt[k + 1] = Rt[k + 2]), (Rt[k + 2] = E));
      }
    return {
      V: J,
      F: Rt,
      vol: (Math.abs(ft) / 6) * 0.95,
      info: { lift: o.lift, reg: o.liftReg, wedge: o.wedge, side: o.wedgeSide, tmax: +pt.toFixed(1) },
    };
  }
  let ao = [1e9, 1e9, 1e9],
    ro = [-1e9, -1e9, -1e9];
  for (let a = 0; a < ee.length; a += 3)
    for (let r = 0; r < 3; r++) ((ao[r] = Math.min(ao[r], ee[a + r])), (ro[r] = Math.max(ro[r], ee[a + r])));
  ((s.volume = _e / 1e3),
    (s.bbox = V3.sub(ro, ao)),
    (s.tris = me.length / 3),
    (s.rows = K),
    (s.ms = performance.now() - v));
  const ko = new Float32Array(ee.length / 3).fill(-999);
  for (let a = 0; a < K * M; a++) ko[ve + a] = Number.isFinite(Ce[a]) ? Ce[a] : -999;
  {
    const a = Array.from(Ce).filter(Number.isFinite);
    s.contact = {
      pressao: a.filter((r) => r < -0.3).length / a.length,
      ok: a.filter((r) => r >= -0.3 && r <= 2.5).length / a.length,
      folga: a.filter((r) => r > 2.5).length / a.length,
    };
  }
  return {
    shell: { V: ee, F: me },
    log: s,
    spine: Pt.slice(Ht),
    grid: {
      NI: K,
      NJ: M,
      G: Float64Array.from(at),
      Out: Float64Array.from(Lt),
      In: Float64Array.from(Ot),
      iS: Array.from({ length: K }, (a, r) => [te[Ht + r] - Qt, Pt[Ht + r][1], Pt[Ht + r][2]]),
      aSw: s.aSw != null ? s.aSw : -1,
    },
    heat: ko,
  };
}

// Texto do Worker da casca: generateShell e tudo de que ela depende, copiados como texto (o Worker não importa módulos).
// Mesma montagem da v0.14 (makeWorker); ao mudar as dependências de generateShell, mudar esta lista.
export const FUNCOES_DO_WORKER = [binCenters, fillSmooth, legCenterline, footAxis, pctl, gauss1, generateShell, meshCheck, engraveText, nnGrid, normaisDeVertices];
export function textoDoWorker() {
  const t = FUNCOES_DO_WORKER.map((o) => o.toString()).join("\n");
  return (
    "const V3={" + Object.entries(V3).map(([o, l]) => o + ":" + l.toString()).join(",") + "};\n" +
    "const DEG=" + DEG + ";\n" +
    "const smooth=" + smooth.toString() + ";\n" +
    "const pl=" + pl.toString() + ";\n" +
    "const STROKE_FONT=" + JSON.stringify(STROKE_FONT) + ";\n" +
    t + "\n" +
    "self.onmessage=e=>{const {id,A,F,L,P}=e.data;try{const R=generateShell(A,F,L,P);const tr=[R.shell.V.buffer,R.shell.F.buffer];if(R.heat)tr.push(R.heat.buffer);self.postMessage({id,R},tr)}catch(err){self.postMessage({id,err:String(err&&err.message||err)})}};"
  );
}
