/* EITA núcleo · interface/vista3d — visualizador WebGL próprio (órbita, zoom com roda e pinça).
   Só navegador para desenhar; as funções de matriz são puras. Unidades em mm, eixo z para fora da pele.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import { clamp } from "../base.js";

// ------------------------------------------------------------------ matrizes 4×4 (coluna principal, como o WebGL)
export function multiplicar4(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; }
export function perspectiva(f, asp, n, fa) { const t = 1 / Math.tan(f / 2); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0]); }
export function olharPara(e, c, u) {
  const z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]], zl = Math.hypot(...z); z.forEach((v, i) => (z[i] = v / zl));
  let x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; const xl = Math.hypot(...x) || 1; x = x.map((v) => v / xl);
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]);
}
export const identidade4 = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
export function rotacaoX(a) { const o = identidade4(), c = Math.cos(a), s = Math.sin(a); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; }
export function rotacaoY(a) { const o = identidade4(), c = Math.cos(a), s = Math.sin(a); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; }
export function translacao(x, y, z) { const o = identidade4(); o[12] = x; o[13] = y; o[14] = z; return o; }
export const hexParaRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

// ------------------------------------------------------------------ blocos WebGL (atributos p, n, c: vec3)
export function compilarPrograma(gl, vs, fs) {
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
  return pr;
}
// posições, normais e cores (Float32Array, 3 por vértice, triângulos soltos) → malha na GPU
export function enviarMalha(gl, pos, nor, cor) { const b = (d) => { const x = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, x); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW); return x; }; return { p: b(pos), n: b(nor), c: b(cor), cont: pos.length / 3 }; }
export function apagarMalha(gl, m) { gl.deleteBuffer(m.p); gl.deleteBuffer(m.n); gl.deleteBuffer(m.c); }
export function desenharMalha(gl, pr, m) {
  for (const [nome, buf] of [["p", m.p], ["n", m.n], ["c", m.c]]) { const loc = gl.getAttribLocation(pr, nome); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0); }
  gl.drawArrays(gl.TRIANGLES, 0, m.cont);
}

const VS = "attribute vec3 p;attribute vec3 n;attribute vec3 c;uniform mat4 mvp;varying vec3 vn;varying vec3 vc;void main(){vn=n;vc=c;gl_Position=mvp*vec4(p,1.0);}";
const FS = "precision mediump float;varying vec3 vn;varying vec3 vc;uniform vec3 l1;uniform vec3 l2;void main(){vec3 n=normalize(vn);float d=max(dot(n,l1),0.0)*0.72+max(dot(n,l2),0.0)*0.28+0.26;float s=pow(max(dot(n,normalize(l1+vec3(0.0,0.0,1.0))),0.0),28.0)*0.16;gl_FragColor=vec4(vc*d+s,1.0);}";

// canvas: <canvas> da vista; visivel(): se a vista está na tela; aoFalhar(): sem WebGL.
// camera: { teta, fi, dist, alvo } iniciais (órbita em torno de alvo, fi a partir do eixo z).
export function criarVista3D(cv, { visivel = () => true, aoFalhar = () => {}, camera = {}, distMin = 12, distMax = 400 } = {}) {
  const V = Object.assign({ gl: null, prog: null, malhas: [], teta: -1.2, fi: 0.95, dist: 145, alvo: [0, 0, 1], ok: null }, camera);

  V.iniciar = () => {
    if (V.ok !== null) return V.ok;
    const gl = cv.getContext("webgl", { antialias: true, preserveDrawingBuffer: true, alpha: true });
    if (!gl) { V.ok = false; aoFalhar(); return false; }
    V.gl = gl; V.prog = compilarPrograma(gl, VS, FS); V.ok = true;
    let arr = null; const pts = new Map();
    cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); arr = [e.clientX, e.clientY]; });
    cv.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; const d0 = Math.hypot(a[0] - b[0], a[1] - b[1]); pts.set(e.pointerId, [e.clientX, e.clientY]); const [c, d] = [...pts.values()]; V.dist = clamp((V.dist * d0) / (Math.hypot(c[0] - d[0], c[1] - d[1]) || d0), distMin, distMax); V.desenhar(); return; }
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      V.teta -= (e.clientX - arr[0]) * 0.01; V.fi = clamp(V.fi - (e.clientY - arr[1]) * 0.01, 0.02, 3.1); arr = [e.clientX, e.clientY]; V.desenhar();
    });
    const fim = (e) => pts.delete(e.pointerId); cv.addEventListener("pointerup", fim); cv.addEventListener("pointercancel", fim);
    cv.addEventListener("wheel", (e) => { e.preventDefault(); V.dist = clamp(V.dist * Math.exp(e.deltaY * 0.001), distMin, distMax); V.desenhar(); }, { passive: false });
    return true;
  };

  // posições, normais e cores (Float32Array, 3 por vértice, triângulos soltos) → malha na GPU
  V.malha = (pos, nor, cor) => enviarMalha(V.gl, pos, nor, cor);
  // sólido { V, F } com normais por face; corDe(ponto) → [r,g,b]; dz desloca em z; corte esconde a metade y > 0
  V.triangulos = (sol, corDe, dz, corte) => {
    const { V: Vs, F } = sol, pos = [], nor = [], col = [];
    for (let t = 0; t < F.length; t += 3) {
      const P = [0, 1, 2].map((k) => [Vs[3 * F[t + k]], Vs[3 * F[t + k] + 1], Vs[3 * F[t + k] + 2] + dz]);
      if (corte && P[0][1] > 0.01 && P[1][1] > 0.01 && P[2][1] > 0.01) continue;
      const u = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], w = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
      let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const l = Math.hypot(...n) || 1; n = n.map((v) => v / l);
      for (const q of P) { pos.push(q[0], q[1], q[2]); nor.push(...n); col.push(...corDe(q)); }
    }
    return V.malha(new Float32Array(pos), new Float32Array(nor), new Float32Array(col));
  };
  // superfície de um campo de altura G = { n, xs, F (alturas), dentro (máscara) } com normais suaves por vértice
  V.superficieCampo = (G, corDe) => {
    const n = G.n, xs = G.xs, dx = xs[1] - xs[0], F = G.F, D = G.dentro, pos = [], nor = [], col = [];
    const Fv = (i, j) => F[clamp(j, 0, n - 1) * n + clamp(i, 0, n - 1)];
    const vtx = (i, j) => { const gx = (Fv(i + 1, j) - Fv(i - 1, j)) / (2 * dx), gy = (Fv(i, j + 1) - Fv(i, j - 1)) / (2 * dx), l = Math.hypot(gx, gy, 1), p = [xs[i], xs[j], Fv(i, j)]; pos.push(p[0], p[1], p[2]); nor.push(-gx / l, -gy / l, 1 / l); col.push(...corDe(p)); };
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const q = j * n + i; if (!(D[q] && D[q + 1] && D[q + n] && D[q + n + 1])) continue;
      vtx(i, j); vtx(i + 1, j); vtx(i + 1, j + 1); vtx(i, j); vtx(i + 1, j + 1); vtx(i, j + 1);
    }
    return V.malha(new Float32Array(pos), new Float32Array(nor), new Float32Array(col));
  };
  V.limpar = () => { for (const m of V.malhas) apagarMalha(V.gl, m); V.malhas = []; };

  V.desenhar = () => {
    if (!V.ok || !visivel()) return;
    const gl = V.gl, dpr = Math.min(globalThis.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
    cv.width = W * dpr; cv.height = H * dpr; gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
    const A = V.alvo, e = [A[0] + V.dist * Math.sin(V.fi) * Math.cos(V.teta), A[1] + V.dist * Math.sin(V.fi) * Math.sin(V.teta), A[2] + V.dist * Math.cos(V.fi)];
    const up = V.fi < 0.05 ? [0, 1, 0] : [0, 0, 1];
    const pr = V.prog; gl.useProgram(pr);
    gl.uniformMatrix4fv(gl.getUniformLocation(pr, "mvp"), false, multiplicar4(perspectiva(0.62, W / H, 0.5, 1000), olharPara(e, V.alvo, up)));
    const nz = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
    gl.uniform3fv(gl.getUniformLocation(pr, "l1"), nz([0.35, -0.55, 0.78])); gl.uniform3fv(gl.getUniformLocation(pr, "l2"), nz([-0.6, 0.45, 0.35]));
    for (const m of V.malhas) desenharMalha(gl, pr, m);
  };
  return V;
}
