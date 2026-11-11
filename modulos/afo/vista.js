/* EITA! AFO · vista — contas da câmera do visualizador (órbita sobre uma base de eixos, matrizes e projeção na tela).
   Puro (sem DOM e sem WebGL): roda no Node. Movido de ui.js na E4d sem mudança de conta; a câmera, o tamanho do canvas
   e o da sobreposição passaram a ser argumentos. mul4 trabalha em precisão dupla (a projeção das marcas na tela usa
   a matriz antes de ela ir para a GPU), por isso não é o multiplicar4 do núcleo (Float32Array).
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import { V3 } from "./vetor.js";

// cam: { target, dist, yaw, pitch, fov, basis: [eixo X, eixo Y, eixo Z] } → { eye, f, r, u }
export function vetoresCamera(cam) {
  const [t, e, n] = cam.basis,
    o = Math.cos(cam.pitch),
    l = Math.sin(cam.pitch),
    s = Math.cos(cam.yaw),
    v = Math.sin(cam.yaw),
    h = [o * v, -o * s, l],
    u = V3.add(V3.add(V3.mul(t, h[0]), V3.mul(e, h[1])), V3.mul(n, h[2])),
    x = V3.add(cam.target, V3.mul(u, cam.dist)),
    T = V3.mul(u, -1);
  let b = V3.norm(V3.cross(T, n));
  (!isFinite(b[0]) || V3.len(V3.cross(T, n)) < 1e-6) && (b = t);
  const y = V3.cross(b, T);
  return { eye: x, f: T, r: b, u: y };
}
// largura e altura do canvas WebGL → { mvp, vrot, eye, f, r, u }
export function matrizesCamera(cam, t, e) {
  const { eye: n, f: o, r: l, u: s } = vetoresCamera(cam),
    v = [
      l[0],
      s[0],
      -o[0],
      0,
      l[1],
      s[1],
      -o[1],
      0,
      l[2],
      s[2],
      -o[2],
      0,
      -V3.dot(l, n),
      -V3.dot(s, n),
      V3.dot(o, n),
      1,
    ],
    h = cam.dist * 0.05,
    u = cam.dist * 10,
    x = 1 / Math.tan(cam.fov / 2),
    T = t / e,
    b = [x / T, 0, 0, 0, 0, x, 0, 0, 0, 0, (u + h) / (h - u), -1, 0, 0, (2 * u * h) / (h - u), 0],
    y = mul4(b, v),
    L = [...v];
  return ((L[12] = L[13] = L[14] = 0), { mvp: y, vrot: L, eye: n, f: o, r: l, u: s });
}
export function mul4(t, e) {
  const n = new Array(16).fill(0);
  for (let o = 0; o < 4; o++)
    for (let l = 0; l < 4; l++) for (let s = 0; s < 4; s++) n[o * 4 + l] += t[s * 4 + l] * e[o * 4 + s];
  return n;
}
// ponto → [x, y, w] em pixels da sobreposição (largura × altura)
export function projetar(t, e, largura, altura) {
  const n = e.mvp,
    o = n[0] * t[0] + n[4] * t[1] + n[8] * t[2] + n[12],
    l = n[1] * t[0] + n[5] * t[1] + n[9] * t[2] + n[13],
    s = n[3] * t[0] + n[7] * t[1] + n[11] * t[2] + n[15];
  return [((o / s) * 0.5 + 0.5) * largura, (1 - ((l / s) * 0.5 + 0.5)) * altura, s];
}
