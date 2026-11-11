/* EITA! AFO · vetor — operações com vetores 3D, graus e degrau suave (movidos de ui.js na E4c, sem mudança).
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */

export const V3 = {
    sub: (t, e) => [t[0] - e[0], t[1] - e[1], t[2] - e[2]],
    add: (t, e) => [t[0] + e[0], t[1] + e[1], t[2] + e[2]],
    mul: (t, e) => [t[0] * e, t[1] * e, t[2] * e],
    dot: (t, e) => t[0] * e[0] + t[1] * e[1] + t[2] * e[2],
    cross: (t, e) => [t[1] * e[2] - t[2] * e[1], t[2] * e[0] - t[0] * e[2], t[0] * e[1] - t[1] * e[0]],
    len: (t) => Math.hypot(t[0], t[1], t[2]),
    norm: (t) => {
      const e = Math.hypot(t[0], t[1], t[2]) || 1;
      return [t[0] / e, t[1] / e, t[2] / e];
    },
    mid: (t, e) => [(t[0] + e[0]) / 2, (t[1] + e[1]) / 2, (t[2] + e[2]) / 2],
    rej: (t, e) => {
      const n = t[0] * e[0] + t[1] * e[1] + t[2] * e[2];
      return [t[0] - n * e[0], t[1] - n * e[1], t[2] - n * e[2]];
    },
    rot: (t, e, n) => {
      const o = Math.cos(n),
        l = Math.sin(n),
        s = (1 - o) * (e[0] * t[0] + e[1] * t[1] + e[2] * t[2]);
      return [
        t[0] * o + (e[1] * t[2] - e[2] * t[1]) * l + e[0] * s,
        t[1] * o + (e[2] * t[0] - e[0] * t[2]) * l + e[1] * s,
        t[2] * o + (e[0] * t[1] - e[1] * t[0]) * l + e[2] * s,
      ];
    },
  };
export const DEG = 180 / Math.PI;
export const smooth = (t, e, n) => {
    const o = Math.min(1, Math.max(0, (n - t) / (e - t)));
    return o * o * (3 - 2 * o);
  };
