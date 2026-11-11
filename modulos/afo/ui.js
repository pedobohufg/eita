/* EITA! AFO — interface (v0.14), separada da página publicada na E4a e reformatada (Prettier) para leitura.
   Malha, STL e downloads vêm do núcleo (E4b); vetores, anatomia e casca de modulos/afo/ (E4c). O restante sai
   nas próximas etapas da E4 (roteiro em docs/E4-AFO.md).
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
"use strict";
// Cálculo puro do AFO (E4c): vetores, anatomia e casca em modulos/afo/{vetor,anatomia,casca}.js, publicados em EITA.afo.
const { V3, DEG, smooth, computeFrame, addPlantar, measure, deform, pcaBasis, paraAnatomico, deAnatomico } = EITA.afo;
const { engraveText, meshCheck, nnGrid, printXf, generateShell } = EITA.afo;
// Malha e STL pelo núcleo (nucleo/malha.js; E4b). O STL do AFO usa transformações de ponto [x, y, z] e
// cabeçalho de até 79 caracteres, como na v0.14.
const { lerSTL, soldar, filtrarComponentes, contarArestasDeBorda, separarVincos, normaisDeVertices } = EITA;
const stlAFO = (V, F, xf, cab) => EITA.stl({ V, F }, (x, y, z) => xf([x, y, z]), (cab || "EITA AFO").slice(0, 79));
const LM = [
    { id: "ML", nm: "Maléolo lateral", hint: "ponto mais saliente do maléolo lateral", col: "#e2483d" },
    { id: "MM", nm: "Maléolo medial", hint: "ponto mais saliente do maléolo medial", col: "#2f6fdb" },
    { id: "CA", nm: "Calcâneo", hint: "parte de baixo e de trás do calcanhar (apoio no chão)", col: "#8a4fd1" },
    {
      id: "M1",
      nm: "1ª cabeça metatarsal",
      hint: "sob a base do hálux, na planta (parte mais larga do antepé)",
      col: "#1f9d6b",
    },
    { id: "M5", nm: "5ª cabeça metatarsal", hint: "sob a base do 5º dedo, na planta", col: "#d98a00" },
    {
      id: "PX",
      nm: "Tíbia proximal",
      hint: "face anterior da perna, perto do limite superior do scan",
      col: "#c23b8e",
    },
  ],
  S = {
    genSeq: 0,
    name: "",
    offset: [0, 0, 0],
    V0: null,
    F: null,
    V: null,
    N: null,
    L0: {},
    L: {},
    active: "ML",
    frame: null,
    meas: null,
    corrected: !1,
    disp: null,
    shell: null,
    trimAdj: null,
    trimEdit: !1,
    trimH: [],
    reliefs: [],
    relMode: !1,
    refShell: null,
    versions: [],
  },
  glc = document.getElementById("gl"),
  ov = document.getElementById("ov"),
  ctx = ov.getContext("2d"),
  gl = glc.getContext("webgl", { antialias: !0, preserveDrawingBuffer: !0 });
gl || (document.getElementById("status").textContent = "WebGL indisponível neste navegador.");
const ext32 = gl && gl.getExtension("OES_element_index_uint");
function sh(t, e) {
  const n = gl.createShader(t);
  if ((gl.shaderSource(n, e), gl.compileShader(n), !gl.getShaderParameter(n, gl.COMPILE_STATUS)))
    throw gl.getShaderInfoLog(n);
  return n;
}
function prog(t, e) {
  const n = gl.createProgram();
  return (
    gl.attachShader(n, sh(gl.VERTEX_SHADER, t)),
    gl.attachShader(n, sh(gl.FRAGMENT_SHADER, e)),
    gl.linkProgram(n),
    n
  );
}
const meshP = prog(
    `
attribute vec3 p; attribute vec3 n; attribute float h;
uniform mat4 mvp; uniform mat4 vrot; varying vec3 vn; varying float vh;
void main(){ gl_Position=mvp*vec4(p,1.0); vn=(vrot*vec4(n,0.0)).xyz; vh=h; }`,
    `precision mediump float; varying vec3 vn; varying float vh;
uniform vec3 col; uniform float alpha; uniform float useHeat;
vec3 heat(float t){ t=clamp(t,0.0,1.0); return mix(mix(vec3(0.85,0.88,0.92),vec3(0.98,0.75,0.25),smoothstep(0.0,0.5,t)),vec3(0.85,0.2,0.15),smoothstep(0.5,1.0,t)); }
void main(){ vec3 n=normalize(vn); vec3 L=normalize(vec3(0.35,0.5,0.8));
float d=abs(dot(n,L)); float r=pow(max(0.0,abs(n.z)),24.0)*0.15;
vec3 base= useHeat>0.5 ? heat(vh) : col;
if(useHeat>2.5){ float t=clamp(vh/2.0,-1.0,1.0); base = vh<-900.0 ? col*0.8 : t<0.0 ? mix(vec3(0.93,0.93,0.95),vec3(0.20,0.42,0.88),-t) : mix(vec3(0.93,0.93,0.95),vec3(0.85,0.25,0.20),t); }
else if(useHeat>1.5){ base = vh<-900.0 ? col*0.85 : vh<-0.3 ? vec3(0.25,0.45,0.90) : vh<2.5 ? vec3(0.30,0.70,0.42) : vh<5.0 ? vec3(0.95,0.78,0.25) : vec3(0.86,0.30,0.25); }
gl_FragColor=vec4(base*(0.30+0.72*d)+r, alpha); }`,
  ),
  lineP = prog(
    "attribute vec3 p; uniform mat4 mvp; void main(){gl_Position=mvp*vec4(p,1.0);}",
    "precision mediump float; uniform vec3 col; void main(){gl_FragColor=vec4(col,1.0);}",
  ),
  buf = {
    rpos: gl.createBuffer(),
    rnor: gl.createBuffer(),
    ridx: gl.createBuffer(),
    pos: gl.createBuffer(),
    nor: gl.createBuffer(),
    idx: gl.createBuffer(),
    heat: gl.createBuffer(),
    gpos: gl.createBuffer(),
    gnor: gl.createBuffer(),
    apos: gl.createBuffer(),
    anor: gl.createBuffer(),
    aidx: gl.createBuffer(),
    aheat: gl.createBuffer(),
    adev: gl.createBuffer(),
    line: gl.createBuffer(),
    sph: gl.createBuffer(),
    sphN: gl.createBuffer(),
  };
let nIdx = 0;
const SPH = (() => {
  const t = [],
    e = [];
  for (let l = 0; l < 10; l++)
    for (let s = 0; s < 14; s++) {
      const v = (b, y) => {
          const L = (b / 10) * Math.PI,
            C = (y / 14) * 2 * Math.PI;
          return [Math.sin(L) * Math.cos(C), Math.sin(L) * Math.sin(C), Math.cos(L)];
        },
        h = v(l, s),
        u = v(l + 1, s),
        x = v(l + 1, s + 1),
        T = v(l, s + 1);
      for (const b of [h, u, x, h, x, T]) (t.push(...b), e.push(...b));
    }
  return { p: new Float32Array(t), n: new Float32Array(e), count: t.length / 3 };
})();
(gl.bindBuffer(gl.ARRAY_BUFFER, buf.sph),
  gl.bufferData(gl.ARRAY_BUFFER, SPH.p, gl.STATIC_DRAW),
  gl.bindBuffer(gl.ARRAY_BUFFER, buf.sphN),
  gl.bufferData(gl.ARRAY_BUFFER, SPH.n, gl.STATIC_DRAW));
function uploadMesh() {
  const t = S.V.length / 3;
  (gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos),
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(S.V), gl.DYNAMIC_DRAW),
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.nor),
    gl.bufferData(gl.ARRAY_BUFFER, S.N, gl.DYNAMIC_DRAW));
  const e = new Float32Array(t);
  if (S.disp) {
    let n = 1e-6;
    for (const o of S.disp) n = Math.max(n, o);
    for (let o = 0; o < t; o++) e[o] = S.disp[o] / n;
  }
  (gl.bindBuffer(gl.ARRAY_BUFFER, buf.heat), gl.bufferData(gl.ARRAY_BUFFER, e, gl.DYNAMIC_DRAW));
}
function uploadGhost() {
  (gl.bindBuffer(gl.ARRAY_BUFFER, buf.gpos),
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(S.V0), gl.STATIC_DRAW),
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.gnor),
    gl.bufferData(gl.ARRAY_BUFFER, normaisDeVertices(S.V0, S.F), gl.STATIC_DRAW),
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.idx),
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, S.F, gl.STATIC_DRAW),
    (nIdx = S.F.length));
}
const cam = {
  target: [0, 0, 0],
  dist: 400,
  yaw: 0.6,
  pitch: 0.15,
  fov: 35 / DEG,
  basis: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
};
function camVectors() {
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
function matrices() {
  const t = glc.width,
    e = glc.height,
    { eye: n, f: o, r: l, u: s } = camVectors(),
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
function mul4(t, e) {
  const n = new Array(16).fill(0);
  for (let o = 0; o < 4; o++)
    for (let l = 0; l < 4; l++) for (let s = 0; s < 4; s++) n[o * 4 + l] += t[s * 4 + l] * e[o * 4 + s];
  return n;
}
function project(t, e) {
  const n = e.mvp,
    o = n[0] * t[0] + n[4] * t[1] + n[8] * t[2] + n[12],
    l = n[1] * t[0] + n[5] * t[1] + n[9] * t[2] + n[13],
    s = n[3] * t[0] + n[7] * t[1] + n[11] * t[2] + n[15];
  return [((o / s) * 0.5 + 0.5) * ov.width, (1 - ((l / s) * 0.5 + 0.5)) * ov.height, s];
}
function fit() {
  if (!S.V) return;
  const t = S.V;
  let e = [1e9, 1e9, 1e9],
    n = [-1e9, -1e9, -1e9];
  for (let o = 0; o < t.length; o += 3)
    for (let l = 0; l < 3; l++) ((e[l] = Math.min(e[l], t[o + l])), (n[l] = Math.max(n[l], t[o + l])));
  ((cam.target = V3.mid(e, n)), (cam.dist = V3.len(V3.sub(n, e)) * 1.5), draw());
}
function resize() {
  const t = glc.getBoundingClientRect(),
    e = window.devicePixelRatio || 1;
  for (const n of [glc, ov]) ((n.width = Math.max(1, t.width * e)), (n.height = Math.max(1, t.height * e)));
  draw();
}
window.addEventListener("resize", resize);
function bindAttr(t, e, n, o) {
  const l = gl.getAttribLocation(t, e);
  l < 0 ||
    (gl.bindBuffer(gl.ARRAY_BUFFER, n),
    gl.enableVertexAttribArray(l),
    gl.vertexAttribPointer(l, o, gl.FLOAT, !1, 0, 0));
}
function draw() {
  if (
    !gl ||
    (gl.viewport(0, 0, glc.width, glc.height),
    gl.clearColor(0.957, 0.949, 0.976, 1),
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT),
    ctx.clearRect(0, 0, ov.width, ov.height),
    !S.V)
  )
    return;
  const t = matrices();
  (gl.enable(gl.DEPTH_TEST),
    gl.useProgram(meshP),
    gl.uniformMatrix4fv(gl.getUniformLocation(meshP, "mvp"), !1, t.mvp),
    gl.uniformMatrix4fv(gl.getUniformLocation(meshP, "vrot"), !1, t.vrot),
    bindAttr(meshP, "p", buf.pos, 3),
    bindAttr(meshP, "n", buf.nor, 3),
    bindAttr(meshP, "h", buf.heat, 1),
    gl.uniform3fv(gl.getUniformLocation(meshP, "col"), [0.86, 0.72, 0.62]),
    gl.uniform1f(gl.getUniformLocation(meshP, "alpha"), 1),
    gl.uniform1f(gl.getUniformLocation(meshP, "useHeat"), S.corrected && $("heat").checked ? 1 : 0),
    S.shell
      ? (bindAttr(meshP, "p", buf.apos, 3),
        bindAttr(meshP, "n", buf.anor, 3),
        $("devMap") && $("devMap").checked && S.cmp
          ? (bindAttr(meshP, "h", buf.adev, 1), gl.uniform1f(gl.getUniformLocation(meshP, "useHeat"), 3))
          : $("contact").checked
            ? (bindAttr(meshP, "h", buf.aheat, 1), gl.uniform1f(gl.getUniformLocation(meshP, "useHeat"), 2))
            : (gl.disableVertexAttribArray(gl.getAttribLocation(meshP, "h")),
              gl.vertexAttrib1f(gl.getAttribLocation(meshP, "h"), 0),
              gl.uniform1f(gl.getUniformLocation(meshP, "useHeat"), 0)),
        gl.uniform3fv(gl.getUniformLocation(meshP, "col"), [0.66, 0.57, 0.93]),
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.aidx),
        gl.drawElements(gl.TRIANGLES, S.shell.nIdx, gl.UNSIGNED_INT, 0),
        S.refShell &&
          S.refShell.nIdx &&
          !($("devMap") && $("devMap").checked && S.cmp) &&
          (gl.enable(gl.BLEND),
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA),
          gl.depthMask(!1),
          gl.disableVertexAttribArray(gl.getAttribLocation(meshP, "h")),
          gl.vertexAttrib1f(gl.getAttribLocation(meshP, "h"), 0),
          gl.uniform1f(gl.getUniformLocation(meshP, "useHeat"), 0),
          bindAttr(meshP, "p", buf.rpos, 3),
          bindAttr(meshP, "n", buf.rnor, 3),
          gl.uniform3fv(gl.getUniformLocation(meshP, "col"), [0.98, 0.62, 0.22]),
          gl.uniform1f(gl.getUniformLocation(meshP, "alpha"), 0.42),
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.ridx),
          gl.drawElements(gl.TRIANGLES, S.refShell.nIdx, gl.UNSIGNED_INT, 0),
          gl.depthMask(!0),
          gl.disable(gl.BLEND),
          gl.uniform1f(gl.getUniformLocation(meshP, "alpha"), 1)),
        $("showLimb").checked &&
          (gl.enable(gl.BLEND),
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA),
          gl.depthMask(!1),
          bindAttr(meshP, "p", buf.pos, 3),
          bindAttr(meshP, "n", buf.nor, 3),
          gl.uniform3fv(gl.getUniformLocation(meshP, "col"), [0.86, 0.72, 0.62]),
          gl.uniform1f(gl.getUniformLocation(meshP, "alpha"), 0.35),
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.idx),
          gl.drawElements(gl.TRIANGLES, nIdx, ext32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0),
          gl.depthMask(!0),
          gl.disable(gl.BLEND),
          gl.uniform1f(gl.getUniformLocation(meshP, "alpha"), 1)))
      : (gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.idx),
        gl.drawElements(gl.TRIANGLES, nIdx, ext32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0)));
  const e = Math.max(2.5, cam.dist * 0.008);
  (bindAttr(meshP, "p", buf.sph, 3),
    bindAttr(meshP, "n", buf.sphN, 3),
    gl.disableVertexAttribArray(gl.getAttribLocation(meshP, "h")),
    gl.vertexAttrib1f(gl.getAttribLocation(meshP, "h"), 0),
    gl.uniform1f(gl.getUniformLocation(meshP, "useHeat"), 0));
  for (const o of LM) {
    const l = S.L[o.id];
    if (!l || S.clean) continue;
    const s = hex(o.col);
    gl.uniform3fv(gl.getUniformLocation(meshP, "col"), s);
    const v = [e, 0, 0, 0, 0, e, 0, 0, 0, 0, e, 0, l[0], l[1], l[2], 1];
    (gl.uniformMatrix4fv(gl.getUniformLocation(meshP, "mvp"), !1, mul4(t.mvp, v)),
      gl.drawArrays(gl.TRIANGLES, 0, SPH.count));
  }
  if (
    (S.corrected &&
      $("ghost").checked &&
      !S.shell &&
      (gl.enable(gl.BLEND),
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA),
      gl.depthMask(!1),
      gl.uniformMatrix4fv(gl.getUniformLocation(meshP, "mvp"), !1, t.mvp),
      bindAttr(meshP, "p", buf.gpos, 3),
      bindAttr(meshP, "n", buf.gnor, 3),
      gl.uniform3fv(gl.getUniformLocation(meshP, "col"), [0.25, 0.5, 0.85]),
      gl.uniform1f(gl.getUniformLocation(meshP, "alpha"), 0.22),
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.idx),
      gl.drawElements(gl.TRIANGLES, nIdx, ext32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0),
      gl.depthMask(!0),
      gl.disable(gl.BLEND)),
    S.frame && !S.clean)
  ) {
    (gl.disable(gl.DEPTH_TEST),
      gl.useProgram(lineP),
      gl.uniformMatrix4fv(gl.getUniformLocation(lineP, "mvp"), !1, t.mvp));
    const o = S.frame,
      l = S.L,
      s = V3.len(V3.sub(o.PC, o.AJC)),
      v = (h, u, x) => {
        (gl.bindBuffer(gl.ARRAY_BUFFER, buf.line),
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...h, ...u]), gl.STREAM_DRAW),
          bindAttr(lineP, "p", buf.line, 3),
          gl.uniform3fv(gl.getUniformLocation(lineP, "col"), x),
          gl.drawArrays(gl.LINES, 0, 2));
      };
    (v(V3.add(o.AJC, V3.mul(o.X, -60)), V3.add(o.AJC, V3.mul(o.X, 60)), hex("#e2483d")),
      v(o.AJC, V3.add(o.AJC, V3.mul(o.Z, s)), hex("#1f9d6b")),
      l.CA && l.M1 && l.M5 && v(l.CA, V3.mid(l.M1, l.M5), hex("#d98a00")));
  }
  const n = window.devicePixelRatio || 1;
  ctx.font = `600 ${12 * n}px system-ui`;
  for (const o of LM) {
    const l = S.L[o.id];
    if (!l || S.clean) continue;
    const [s, v, h] = project(l, t);
    if (h <= 0) continue;
    ctx.fillStyle = "rgba(255,255,255,.85)";
    const u = o.id,
      x = ctx.measureText(u).width;
    (ctx.fillRect(s + 8 * n, v - 9 * n, x + 8 * n, 16 * n),
      (ctx.fillStyle = o.col),
      ctx.fillText(u, s + 12 * n, v + 3 * n));
  }
  (drawTrimHandles(t, n), drawReliefs(t, n), drawRivets(t, n));
}
const TRIM_N = 9;
function gridWorld(t, e) {
  const n = S.shell.grid,
    o = (t * n.NJ + e) * 3,
    l = S.frame,
    s = V3.cross(l.Y, l.Z),
    v = [n.G[o], n.G[o + 1], n.G[o + 2]];
  return [0, 1, 2].map((h) => l.AJC[h] + s[h] * v[0] + l.Y[h] * v[1] + l.Z[h] * v[2]);
}
function drawTrimHandles(t, e) {
  if (((S.trimH = []), !S.trimEdit || !S.shell || !S.shell.grid)) return;
  const n = S.shell.grid;
  for (const o of [0, 1])
    for (let l = 0; l < TRIM_N; l++) {
      const s = Math.round((l / (TRIM_N - 1)) * (n.NI - 1)),
        v = o ? n.NJ - 1 : 0,
        h = o ? n.NJ - 6 : 5,
        u = gridWorld(s, v),
        x = gridWorld(s, h),
        T = V3.norm(V3.sub(u, x)),
        [b, y, L] = project(u, t);
      if (L <= 0) continue;
      const [C, W] = project(V3.add(u, V3.mul(T, 10)), t),
        U = (S.trimAdj && S.trimAdj[o][l]) || 0;
      if (
        (S.trimH.push({ side: o, k: l, x: b, y, sv: [C - b, W - y] }),
        ctx.beginPath(),
        ctx.arc(b, y, 7 * e, 0, Math.PI * 2),
        (ctx.fillStyle = U ? "#6B3FD6" : "#ffffff"),
        ctx.fill(),
        (ctx.lineWidth = 2 * e),
        (ctx.strokeStyle = "#6B3FD6"),
        ctx.stroke(),
        U)
      ) {
        ctx.font = `600 ${11 * e}px system-ui`;
        const j = (U > 0 ? "+" : "") + U.toFixed(0);
        ctx.fillStyle = "rgba(255,255,255,.9)";
        const Q = ctx.measureText(j).width;
        (ctx.fillRect(b + 10 * e, y - 8 * e, Q + 6 * e, 15 * e),
          (ctx.fillStyle = "#6B3FD6"),
          ctx.fillText(j, b + 13 * e, y + 3 * e));
      }
    }
}
function drawRivets(t, e) {
  if (!S.shell || !S.shell.rivetsW || !S.shell.rivetsW.length) return;
  const n = S.shell.log.rivets,
    { f: o } = camVectors(),
    l = S.frame,
    s = V3.cross(l.Y, l.Z);
  S.shell.rivetsW.forEach((v, h) => {
    const [u, x, T] = project(v, t);
    if (T <= 0) return;
    const b = n[h].n,
      y = [0, 1, 2].map((W) => s[W] * b[0] + l.Y[W] * b[1] + l.Z[W] * b[2]);
    ((ctx.globalAlpha = V3.dot(y, o) > 0.15 ? 0.3 : 1),
      ctx.beginPath(),
      ctx.arc(u, x, 5.5 * e, 0, Math.PI * 2),
      (ctx.fillStyle = "#E0892A"),
      ctx.fill(),
      (ctx.lineWidth = 2 * e),
      (ctx.strokeStyle = "#fff"),
      ctx.stroke(),
      ctx.beginPath(),
      ctx.moveTo(u - 9 * e, x),
      ctx.lineTo(u + 9 * e, x),
      ctx.moveTo(u, x - 9 * e),
      ctx.lineTo(u, x + 9 * e),
      (ctx.strokeStyle = "#E0892A"),
      (ctx.lineWidth = 1.2 * e),
      ctx.stroke(),
      (ctx.font = `700 ${11 * e}px system-ui`));
    const L = "R" + (h + 1),
      C = ctx.measureText(L).width;
    ((ctx.fillStyle = "rgba(255,255,255,.9)"),
      ctx.fillRect(u + 9 * e, x - 17 * e, C + 6 * e, 14 * e),
      (ctx.fillStyle = "#B8661A"),
      ctx.fillText(L, u + 12 * e, x - 6 * e),
      (ctx.globalAlpha = 1));
  });
}
function rivetText(t) {
  return t.name === "antepé"
    ? `${t.y} mm à frente do calcâneo`
    : t.z < 0
      ? `${-t.z} mm abaixo do centro do tornozelo`
      : `${t.z} mm acima do centro do tornozelo`;
}
function renderRivets() {
  const t = $("rvList");
  if (!t) return;
  const e = S.shell && S.shell.log.rivets;
  if (!e || !e.length) {
    t.innerHTML = "";
    return;
  }
  t.innerHTML =
    '<table class="m" style="margin-top:6px">' +
    e
      .map(
        (n, o) =>
          `<tr><td><b style="color:#B8661A">R${o + 1}</b> ${n.name}, ${n.lado}</td><td style="font-size:11.5px">${rivetText(n)} · ${n.joint ? "articulação" : n.edge + " mm da borda"}</td></tr>`,
      )
      .join("") +
    "</table>";
}
function drawReliefs(t, e) {
  if (!(!S.reliefs.length || S.clean))
    for (const [n, o] of S.reliefs.entries()) {
      const [l, s, v] = project(o.p, t);
      v <= 0 ||
        (ctx.beginPath(),
        ctx.arc(l, s, 6 * e, 0, Math.PI * 2),
        (ctx.fillStyle = "rgba(47,111,219,.85)"),
        ctx.fill(),
        (ctx.strokeStyle = "#fff"),
        (ctx.lineWidth = 2 * e),
        ctx.stroke(),
        (ctx.font = `600 ${11 * e}px system-ui`),
        (ctx.fillStyle = "#2f6fdb"),
        ctx.fillText("A" + (n + 1), l + 9 * e, s - 6 * e));
    }
}
const hex = (t) => [
    parseInt(t.slice(1, 3), 16) / 255,
    parseInt(t.slice(3, 5), 16) / 255,
    parseInt(t.slice(5, 7), 16) / 255,
  ],
  $ = (t) => document.getElementById(t);
let drag = null;
(glc.addEventListener("contextmenu", (t) => t.preventDefault()),
  glc.addEventListener("pointerdown", (t) => {
    if (S.trimEdit && t.button === 0 && S.trimH.length) {
      const e = glc.getBoundingClientRect(),
        n = window.devicePixelRatio || 1,
        o = (t.clientX - e.left) * n,
        l = (t.clientY - e.top) * n;
      let s = null,
        v = 14 * n;
      for (const h of S.trimH) {
        const u = Math.hypot(h.x - o, h.y - l);
        u < v && ((v = u), (s = h));
      }
      if (s) {
        (S.trimAdj || (S.trimAdj = [new Array(TRIM_N).fill(0), new Array(TRIM_N).fill(0)]),
          (drag = { trim: s, x: t.clientX, y: t.clientY, moved: !1, b: 0 }),
          glc.setPointerCapture(t.pointerId));
        return;
      }
    }
    ((drag = { x: t.clientX, y: t.clientY, b: t.button, shift: t.shiftKey, moved: !1 }),
      glc.setPointerCapture(t.pointerId));
  }),
  glc.addEventListener("pointermove", (t) => {
    if (!drag) return;
    const e = t.clientX - drag.x,
      n = t.clientY - drag.y;
    if ((Math.abs(e) + Math.abs(n) > 3 && (drag.moved = !0), drag.trim)) {
      const o = window.devicePixelRatio || 1,
        l = drag.trim,
        s = l.sv,
        v = s[0] * s[0] + s[1] * s[1] || 1;
      ((drag.x = t.clientX), (drag.y = t.clientY));
      const h = S.trimAdj[l.side][l.k] + ((e * o * s[0] + n * o * s[1]) / v) * 10;
      ((S.trimAdj[l.side][l.k] = Math.max(-40, Math.min(40, h))),
        (l.x += e * o),
        (l.y += n * o),
        trimInfo(),
        ctx && draw());
      return;
    }
    if (((drag.x = t.clientX), (drag.y = t.clientY), drag.b === 2 || drag.shift)) {
      const { r: o, u: l } = camVectors(),
        s = (cam.dist * Math.tan(cam.fov / 2) * 2) / glc.clientHeight;
      cam.target = V3.add(cam.target, V3.add(V3.mul(o, -e * s), V3.mul(l, n * s)));
    } else ((cam.yaw -= e * 0.008), (cam.pitch = Math.max(-1.55, Math.min(1.55, cam.pitch + n * 0.008))));
    draw();
  }),
  glc.addEventListener("pointerup", (t) => {
    if (drag && drag.trim) {
      for (const e of S.trimAdj) for (let n = 0; n < e.length; n++) e[n] = Math.round(e[n]);
      ((drag = null), trimInfo(), window.__regenNow && window.__regenNow());
      return;
    }
    (drag && !drag.moved && drag.b === 0 && !drag.shift && onPick(t), (drag = null));
  }),
  glc.addEventListener(
    "wheel",
    (t) => {
      (t.preventDefault(), (cam.dist *= Math.exp(t.deltaY * 0.0012)), draw());
    },
    { passive: !1 },
  ));
function trimInfo() {
  const t = $("trimInfo");
  if (!t) return;
  const e = S.trimAdj;
  if (!e || !e.some((l) => l.some((s) => Math.round(s)))) {
    t.textContent = "Sem ajustes.";
    return;
  }
  const n = (l) => l.map((s) => (s > 0 ? "+" : "") + Math.round(s)).join(" "),
    o = trimSideNames();
  t.innerHTML =
    o[0] +
    ": " +
    n(e[0]) +
    "<br>" +
    o[1] +
    ": " +
    n(e[1]) +
    ' <span style="color:var(--muted)">(mm, do topo à ponta)</span>';
}
function trimSideNames() {
  try {
    const t = S.shell.grid,
      e = Math.round(t.NI * 0.4),
      n = gridWorld(e, 0),
      o = V3.len(V3.sub(n, S.L.ML)),
      l = V3.len(V3.sub(n, S.L.MM));
    return o < l ? ["Lateral", "Medial"] : ["Medial", "Lateral"];
  } catch {
    return ["Lado A", "Lado B"];
  }
}
function renderReliefs() {
  const t = $("relList");
  if (t) {
    if (!S.reliefs.length) {
      t.innerHTML = '<div class="note">Nenhum alívio manual.</div>';
      return;
    }
    t.innerHTML = S.reliefs
      .map(
        (e, n) =>
          `<div class="relrow"><b>A${n + 1}</b><label>prof.<input type="number" data-i="${n}" data-k="d" value="${e.d}" step="0.5" min="0.5" max="10"> mm</label><label>raio<input type="number" data-i="${n}" data-k="r" value="${e.r}" step="1" min="5" max="40"> mm</label><button type="button" data-del="${n}" title="Remover">×</button></div>`,
      )
      .join("");
    for (const e of t.querySelectorAll("input"))
      e.onchange = () => {
        ((S.reliefs[+e.dataset.i][e.dataset.k] = +e.value), window.__regenNow && window.__regenNow());
      };
    for (const e of t.querySelectorAll("button[data-del]"))
      e.onclick = () => {
        (S.reliefs.splice(+e.dataset.del, 1), renderReliefs(), draw(), window.__regenNow && window.__regenNow());
      };
  }
}
function rayFromEvent(t) {
  const e = glc.getBoundingClientRect(),
    n = ((t.clientX - e.left) / e.width) * 2 - 1,
    o = 1 - ((t.clientY - e.top) / e.height) * 2,
    { eye: l, f: s, r: v, u: h } = camVectors(),
    u = Math.tan(cam.fov / 2),
    x = e.width / e.height;
  return { o: l, d: V3.norm(V3.add(s, V3.add(V3.mul(v, n * u * x), V3.mul(h, o * u)))) };
}
function raycast(t, e, n, o) {
  let l = 1 / 0,
    s = null;
  for (let v = 0; v < o.length; v += 3) {
    const h = o[v] * 3,
      u = o[v + 1] * 3,
      x = o[v + 2] * 3,
      T = n[u] - n[h],
      b = n[u + 1] - n[h + 1],
      y = n[u + 2] - n[h + 2],
      L = n[x] - n[h],
      C = n[x + 1] - n[h + 1],
      W = n[x + 2] - n[h + 2],
      U = e[1] * W - e[2] * C,
      j = e[2] * L - e[0] * W,
      Q = e[0] * C - e[1] * L,
      G = T * U + b * j + y * Q;
    if (Math.abs(G) < 1e-12) continue;
    const O = 1 / G,
      B = t[0] - n[h],
      Z = t[1] - n[h + 1],
      rt = t[2] - n[h + 2],
      D = (B * U + Z * j + rt * Q) * O;
    if (D < 0 || D > 1) continue;
    const kt = Z * y - rt * b,
      Bt = rt * T - B * y,
      wt = B * b - Z * T,
      Kt = (e[0] * kt + e[1] * Bt + e[2] * wt) * O;
    if (Kt < 0 || D + Kt > 1) continue;
    const Gt = (L * kt + C * Bt + W * wt) * O;
    Gt > 0 && Gt < l && ((l = Gt), (s = V3.add(t, V3.mul(e, Gt))));
  }
  return s;
}
function onPick(t) {
  if (S.relMode && S.V) {
    const { o: s, d: v } = rayFromEvent(t),
      h = raycast(s, v, S.V, S.F);
    if (!h) return;
    (S.reliefs.push({ p: h, d: 3, r: 15 }),
      renderReliefs(),
      draw(),
      status(
        "Alívio A" +
          S.reliefs.length +
          " adicionado. Ajuste profundidade e raio na lista; clique em outro ponto para adicionar mais.",
      ),
      window.__regenNow && window.__regenNow());
    return;
  }
  if (!S.V || !S.active) return;
  if (S.corrected) {
    status("Desfaça a correção para reposicionar pontos.");
    return;
  }
  const { o: e, d: n } = rayFromEvent(t),
    o = raycast(e, n, S.V, S.F);
  if (!o) return;
  setLandmark(S.active, o);
  const l = LM.find((s) => !S.L[s.id]);
  ((S.active = l ? l.id : null), renderLM(), update());
}
function setLandmark(t, e) {
  ((S.L[t] = e.slice()), (S.L0[t] = e.slice()), t === "PX" && $("pTop") && ($("pTop").value = "0"), clearShell());
}
function status(t) {
  $("status").innerHTML = t;
}
function renderLM() {
  $("lmlist").innerHTML = LM.map(
    (e) => `<div class="lm ${S.active === e.id ? "active" : ""}" data-id="${e.id}">
<span class="dot" style="background:${e.col}"></span>
<div><div class="nm">${e.id} · ${e.nm}</div><div class="hint">${e.hint}</div></div>
<span class="st ${S.L0[e.id] ? "done" : ""}">${S.L0[e.id] ? "✓" : "—"}</span></div>`,
  ).join("");
  for (const e of document.querySelectorAll(".lm"))
    e.onclick = () => {
      ((S.active = e.dataset.id), renderLM());
      const n = LM.find((o) => o.id === S.active);
      status(`Clique no modelo para marcar <b>${n.id} · ${n.nm}</b>: ${n.hint}.`);
    };
  const t = LM.find((e) => e.id === S.active);
  S.V &&
    !S.corrected &&
    status(
      t
        ? `Clique no modelo para marcar <b>${t.id} · ${t.nm}</b>: ${t.hint}.`
        : "Todos os pontos marcados. Confira as medidas e aplique a correção.",
    );
}
function fmt(t, e = 1) {
  return t === void 0 || isNaN(t) ? "—" : t.toFixed(e);
}
function update() {
  ((S.frame = computeFrame(S.L, S.V)),
    S.frame && !S.corrected && addPlantar(S.L, S.V, S.frame),
    (S.meas = measure(S.L, S.frame)));
  const t = LM.every((o) => S.L[o.id]);
  (setTimeout(checkLandmarks, 0),
    $("s3").classList.toggle("off", !S.frame),
    $("s4").classList.toggle("off", !t),
    $("s5").classList.toggle("off", !t),
    $("s6").classList.toggle("off", !t),
    ($("needPts").style.display = t ? "none" : "block"),
    $("pTop").value === "0" &&
      S.L.PX &&
      S.frame &&
      ($("pTop").value = Math.round(V3.dot(V3.sub(S.L.PX, S.frame.AJC), S.frame.Z) - 15)),
    ($("legend").style.display = S.frame ? "block" : "none"));
  const e = S.meas,
    n = S.frame;
  if (n) {
    const o =
        e.pf === void 0
          ? ""
          : Math.abs(e.pf) <= 5
            ? '<span class="flag o">neutro</span>'
            : e.pf > 0
              ? '<span class="flag w">equino</span>'
              : '<span class="flag w">dorsiflexão</span>',
      l =
        e.inv === void 0
          ? ""
          : Math.abs(e.inv) <= 5
            ? '<span class="flag o">neutro</span>'
            : e.inv > 0
              ? '<span class="flag w">inversão</span>'
              : '<span class="flag w">eversão</span>';
    $("meas").innerHTML = `
<tr><td>Lado detectado</td><td>${n.side}</td></tr>
<tr><td>Ângulo perna-pé</td><td>${fmt(e.sag)}°</td></tr>
<tr><td>Plantiflexão ${o}</td><td>${fmt(e.pf)}°</td></tr>
<tr><td>Inversão ${l}</td><td>${fmt(e.inv)}°</td></tr>
<tr><td>Largura bimaleolar</td><td>${fmt(e.bimal, 0)} mm</td></tr>
<tr><td>Largura do antepé (M1–M5)</td><td>${fmt(e.forefoot, 0)} mm</td></tr>
<tr><td>Calcâneo → antepé</td><td>${fmt(e.footLen, 0)} mm</td></tr>
<tr><td>Tornozelo → tíbia proximal</td><td>${fmt(e.legLen, 0)} mm</td></tr>`;
    const s = [];
    (S.L.M1 &&
      S.L.M5 &&
      V3.dot(V3.sub(S.L.M1, S.L.M5), n.X) > 0 &&
      s.push("M1 aparece do lado lateral e M5 do medial: os dois podem estar trocados, ou ML e MM."),
      e.bimal !== void 0 &&
        (e.bimal < 25 || e.bimal > 110) &&
        s.push("Largura bimaleolar fora do esperado: confira ML e MM."),
      e.sag !== void 0 && (e.sag < 45 || e.sag > 175) && s.push("Ângulo perna-pé improvável: confira CA, M1 e M5."),
      e.inv !== void 0 &&
        Math.abs(e.inv) > 35 &&
        s.push(
          "Inversão medida acima de 35°, provavelmente por M1/M5 fora da posição: a correção de inversão não será aplicada. Marque M1 e M5 na planta, sob a base do hálux e do 5º dedo.",
        ),
      ($("measnote").innerHTML =
        (s.length ? `<div style="color:var(--warn);margin-bottom:4px">⚠ ${s.join("<br>⚠ ")}</div>` : "") +
        (S.corrected
          ? "Medidas após a correção."
          : "Ângulo perna-pé: 90° = neutro; acima de 90° = equino. Inversão medida pela inclinação da linha M1–M5 em torno do eixo do pé. Confira se o lado detectado está correto.")));
  }
  draw();
}
async function loadBuffer(t, e) {
  (($("busy").style.display = "grid"), await new Promise((n) => setTimeout(n, 30)));
  try {
    const n = lerSTL(t);
    let { V: o, F: l } = soldar(n);
    const s = n.length / 9;
    let v = { componentes: 1, mantidos: 1 };
    if ($("frag").checked) {
      const y = filtrarComponentes(o, l, 0.02);
      ((o = y.V), (l = y.F), (v = y));
    }
    let h = [1e9, 1e9, 1e9],
      u = [-1e9, -1e9, -1e9];
    for (let y = 0; y < o.length; y += 3)
      for (let L = 0; L < 3; L++) ((h[L] = Math.min(h[L], o[y + L])), (u[L] = Math.max(u[L], o[y + L])));
    const x = V3.mid(h, u);
    for (let y = 0; y < o.length; y += 3) for (let L = 0; L < 3; L++) o[y + L] -= x[L];
    if (
      ((S.shell = null),
      ($("pTop").value = "0"),
      Object.assign(S, {
        name: e,
        offset: x,
        V0: new Float64Array(o),
        V: o,
        F: l,
        L0: {},
        L: {},
        corrected: !1,
        disp: null,
        active: "ML",
      }),
      !ext32 && o.length / 3 > 65535)
    )
      throw new Error("Malha grande demais para este navegador");
    ((S.N = normaisDeVertices(S.V, S.F)),
      uploadGhost(),
      uploadMesh(),
      (cam.basis = pcaBasis(o)),
      (cam.yaw = 0.6),
      (cam.pitch = 0.1));
    const T = contarArestasDeBorda(l),
      b = V3.sub(u, h);
    (($("stats").innerHTML =
      `<b>${esc(e)}</b><br>${(l.length / 3).toLocaleString("pt-BR")} triângulos (de ${s.toLocaleString("pt-BR")})<br>
${v.componentes} partes conectadas; ${v.componentes - v.mantidos} fragmentos removidos<br>
Dimensões: ${b.map((y) => y.toFixed(0)).join(" × ")} mm<br>
Bordas abertas: ${T.toLocaleString("pt-BR")} arestas ${T > 0 ? '<span class="flag w">superfície aberta</span>' : '<span class="flag o">fechada</span>'}`),
      $("s2").classList.remove("off"),
      renderLM(),
      update(),
      resize(),
      fit(),
      (S.versions = pendingFicha ? S.versions : []),
      (S.refShell = null),
      (S.refIdx = null),
      (S.reliefs = []),
      (S.trimAdj = null),
      renderReliefs(),
      trimInfo(),
      renderVersions(),
      refInfo(),
      pendingFicha &&
        (!pendingFicha.scan || pendingFicha.scan === e) &&
        setTimeout(() => applyFicha(pendingFicha), 50));
  } catch (n) {
    status("Erro ao ler o arquivo: " + (n.message || n));
  }
  $("busy").style.display = "none";
}
(($("drop").onclick = () => $("file").click()),
  ($("file").onchange = async (t) => {
    const e = t.target.files[0];
    e && loadBuffer(await e.arrayBuffer(), e.name);
  }));
for (const t of ["dragenter", "dragover"])
  $("drop").addEventListener(t, (e) => {
    (e.preventDefault(), $("drop").classList.add("hover"));
  });
for (const t of ["dragleave", "drop"])
  $("drop").addEventListener(t, (e) => {
    (e.preventDefault(), $("drop").classList.remove("hover"));
  });
($("drop").addEventListener("drop", async (t) => {
  const e = t.dataTransfer.files[0];
  e && loadBuffer(await e.arrayBuffer(), e.name);
}),
  document.addEventListener("dragover", (t) => t.preventDefault()),
  document.addEventListener("drop", async (t) => {
    t.preventDefault();
    const e = t.dataTransfer && t.dataTransfer.files[0];
    e && /\.stl$/i.test(e.name) && loadBuffer(await e.arrayBuffer(), e.name);
  }));
for (const t of document.querySelectorAll("#toolbar button")) t.onclick = () => setView(t.dataset.v);
function setView(t) {
  if (t === "fit") return fit();
  if (t === "flip") {
    const [e, n, o] = cam.basis;
    return ((cam.basis = [V3.mul(e, -1), n, V3.mul(o, -1)]), draw());
  }
  if (S.frame) {
    const e = S.frame;
    cam.basis = [e.X, e.Y, e.Z];
    let n = [1e9, 1e9, 1e9],
      o = [-1e9, -1e9, -1e9];
    for (let x = 0; x < S.V.length; x += 3) {
      const T = V3.sub([S.V[x], S.V[x + 1], S.V[x + 2]], e.AJC),
        b = [V3.dot(T, e.X), V3.dot(T, e.Y), V3.dot(T, e.Z)];
      for (let y = 0; y < 3; y++) ((n[y] = Math.min(n[y], b[y])), (o[y] = Math.max(o[y], b[y])));
    }
    const l = V3.mid(n, o);
    cam.target = V3.add(e.AJC, V3.add(V3.add(V3.mul(e.X, l[0]), V3.mul(e.Y, l[1])), V3.mul(e.Z, l[2])));
    const s = Math.max(o[2] - n[2], (((o[1] - n[1]) * glc.height) / glc.width) * 1.2);
    cam.dist = (s / 2 / Math.tan(cam.fov / 2)) * 1.12;
    const v = {
        front: [Math.PI, 0],
        back: [0, 0],
        lat: [Math.PI / 2, 0],
        med: [-Math.PI / 2, 0],
        top: [Math.PI, 1.5],
        bottom: [Math.PI, -1.5],
      },
      [h, u] = v[t];
    ((cam.yaw = h), (cam.pitch = u));
  } else {
    const e = {
      front: [0, 0],
      back: [Math.PI, 0],
      lat: [Math.PI / 2, 0],
      med: [-Math.PI / 2, 0],
      top: [0, 1.5],
      bottom: [0, -1.5],
    };
    [cam.yaw, cam.pitch] = e[t];
  }
  draw();
}
(($("apply").onclick = () => applyCorrection()),
  ($("reset").onclick = () => resetCorrection()),
  ($("ghost").onchange = draw),
  ($("heat").onchange = draw));
function applyCorrection(t) {
  if (!LM.every((b) => S.L0[b.id])) return;
  const e = t?.tSag ?? +$("tSag").value,
    n = t?.tCor ?? +$("tCor").value,
    o = t?.band ?? +$("band").value,
    l = {};
  for (const b in S.L0) l[b] = S.L0[b].slice();
  const s = computeFrame(l, S.V0);
  addPlantar(l, S.V0, s);
  const v = measure(l, s),
    h = { sag: v.sag, inv: v.inv };
  clearShell();
  const { V: u, invSkipped: inv } = deform(S.V0, S.F, l, s, v, e, n, o);
  S.invSkipped = inv;
  ((S.V = u), (S.L = l), (S.corrected = !0), (S.disp = new Float32Array(u.length / 3)));
  for (let b = 0; b < S.disp.length; b++)
    S.disp[b] = Math.hypot(u[b * 3] - S.V0[b * 3], u[b * 3 + 1] - S.V0[b * 3 + 1], u[b * 3 + 2] - S.V0[b * 3 + 2]);
  ((S.N = normaisDeVertices(S.V, S.F)), uploadMesh(), (S.frame = s), (S.meas = measure(S.L, s)));
  const x = S.meas;
  let T = 0;
  for (const b of S.disp) T = Math.max(T, b);
  return (
    ($("corrnote").innerHTML =
      `Ângulo perna-pé: ${fmt(h.sag)}° → <b>${fmt(x.sag)}°</b><br>Inversão: ${fmt(h.inv)}° → <b>${fmt(x.inv)}°</b><br>Deslocamento máximo: ${fmt(T, 0)} mm (antepé)`),
    status(
      S.invSkipped
        ? "Correção sagital aplicada. A inversão não foi corrigida porque a medida passou de 35° (confira M1 e M5)."
        : "Correção aplicada. O modelo azul translúcido é o scan original.",
    ),
    update(),
    renderLM(),
    { before: h, after: { sag: x.sag, inv: x.inv }, maxDisp: T }
  );
}
function resetCorrection() {
  if (S.V0) {
    (clearShell(), (S.V = new Float64Array(S.V0)), (S.L = {}));
    for (const t in S.L0) S.L[t] = S.L0[t].slice();
    ((S.corrected = !1),
      (S.disp = null),
      (S.N = normaisDeVertices(S.V, S.F)),
      uploadMesh(),
      ($("corrnote").textContent = ""),
      update(),
      renderLM());
  }
}
EITA.ui.capacidadeDownloads();
function anatXf() {
  return paraAnatomico(S.frame);
}
// Entrega pela capacidade "downloads" do claude.ai (STL e outros vão dentro de .zip; nucleo/saida.js) ou por link.
// → nome do arquivo entregue, ou false (o motivo vai para #expnote).
async function saveFile(t, e, n) {
  const dl = await EITA.ui.capacidadeDownloads();
  if (!dl) {
    if (EITA.ui.baixarPorLink(t, new Blob([e], { type: n || "application/octet-stream" }))) return t;
    $("expnote").textContent = "O download não está disponível nesta visualização.";
    return !1;
  }
  const { nome, dados } = await EITA.embalarParaDownload(t, e, n),
    r = await EITA.ui.salvarPelaCapacidade(dl, nome, dados);
  if (r.ok) return nome;
  const h = r.codigo;
  $("expnote").textContent =
    h === "declined"
      ? "Download cancelado."
      : h === "rate_limited"
        ? "Já há um pedido de download aberto — confirme ou aguarde e tente de novo."
        : "Não foi possível salvar o arquivo (" + (h || (r.erro && r.erro.message) || "erro") + ").";
  return !1;
}
function baseName() {
  return (S.name || "scan").replace(/\.stl$/i, "");
}
(($("expStl").onclick = async () => {
  const t = stlAFO(S.V, S.F, anatXf(), "EITA AFO " + baseName()),
    e = await saveFile(baseName() + (S.corrected ? "_corrigido" : "_alinhado") + ".stl", t, "model/stl");
  e &&
    ($("expnote").textContent =
      "STL salvo em " + e + " (" + (S.F.length / 3).toLocaleString("pt-BR") + " triângulos).");
}),
  ($("expJson").onclick = async () => {
    await saveFile(baseName() + "_pontos.json", JSON.stringify(exportData(), null, 1), "application/json");
  }));
function exportData() {
  const t = anatXf(),
    e = {};
  for (const o in S.L) e[o] = t(S.L[o]).map((l) => +l.toFixed(2));
  const n = S.meas;
  return {
    arquivo: S.name,
    versao: "EITA! AFO 0.14",
    lado: S.frame.side,
    corrigido: S.corrected,
    parametros: { anguloAlvo: +$("tSag").value, inversaoAlvo: +$("tCor").value, faixa_mm: +$("band").value },
    medidas: {
      anguloPernaPe: +fmt(n.sag),
      plantiflexao: +fmt(n.pf),
      inversao: +fmt(n.inv),
      bimaleolar_mm: +fmt(n.bimal),
      antepe_mm: +fmt(n.forefoot),
      calcaneoAntepe_mm: +fmt(n.footLen),
      pernaComprimento_mm: +fmt(n.legLen),
    },
    pontos_referencialAnatomico_mm: e,
  };
}
const DENS = { pp: 0.9, nylon: 1.1 };
function clearShell() {
  ((S.shell = null),
    $("expAfo") && ($("expAfo").disabled = !0),
    $("expPdf") && ($("expPdf").disabled = !0),
    $("shellInfo") && ($("shellInfo").innerHTML = ""),
    $("shellNote") && ($("shellNote").textContent = ""));
}
function sideLetter() {
  const t = $("pSide") ? $("pSide").value : "";
  if (t) return t;
  const e = S.frame && S.frame.side;
  return e === "direito" ? "D" : e === "esquerdo" ? "E" : "";
}
function patientCode() {
  const t = ($("pId") ? $("pId").value : "").trim();
  if (t) return t;
  const e = ($("pName") ? $("pName").value : "").trim();
  return e
    ? e
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/\s+/)
        .filter((n) => n.length > 2 || /^[A-Z]/.test(n))
        .map((n) => n[0].toUpperCase())
        .join("")
        .slice(0, 5)
    : "";
}
function engraveAuto() {
  const t = ($("pEngT") ? $("pEngT").value : "").trim();
  if (t) return t;
  const e = new Date(),
    n =
      String(e.getDate()).padStart(2, "0") +
      "/" +
      String(e.getMonth() + 1).padStart(2, "0") +
      "/" +
      String(e.getFullYear()).slice(2),
    o = patientCode();
  return (
    (o
      ? o +
        `
`
      : "") +
    (sideLetter() ? sideLetter() + " " : "") +
    n
  );
}
// idade e escape de HTML do núcleo (nucleo/ficha.js; E4d)
const ageText = (t) => EITA.idadeTexto(t, new Date(), { meses: !0 }),
  esc = EITA.escaparHTML;
const PAT_IDS = [
  "pName",
  "pId",
  "pBirth",
  "pSex",
  "pWeight",
  "pHeight",
  "pShoe",
  "pSide",
  "pDiag",
  "pGoal",
  "pProf",
  "pNotes",
];
function readPatient() {
  const t = {};
  for (const e of PAT_IDS) {
    const n = $(e);
    n && (t[e] = n.value.trim());
  }
  return t;
}
function writePatient(t) {
  for (const e of PAT_IDS) {
    const n = $(e);
    n && (n.value = (t && t[e]) || "");
  }
  updAge();
}
function updAge() {
  const t = $("pAge");
  if (!t) return;
  const e = ageText($("pBirth").value);
  t.textContent = e ? "Idade: " + e : "";
}
function shellParams(t = {}) {
  return Object.assign(
    {
      t: +$("pT").value,
      tAnk: +$("pTA").value,
      clear: +$("pClr").value,
      relD: +$("pRel").value,
      relR: 18,
      top: +$("pTop").value,
      thAnk: +$("pThA").value,
      thCalf: +$("pThC").value,
      hHeel: +$("pHH").value,
      hFore: +$("pHF").value,
      hToe: +$("pHT").value,
      toe: $("pToe").value === "dedos" ? "dedos" : "met",
      metExt: 15,
      flat: $("pFlat").checked,
      step: 2,
      nb: 144,
      rLim: 120,
      flapK: 1.8,
      flapLoc: 1.35,
      snapB0: 4,
      snapB1: 14,
      swT: 0.97,
      swRows: 22,
      relaxIt: 12,
      relaxPre: 28,
      snapSig: 1.5,
      spineSm: 30,
      nSig: 4,
      soleN0: -3,
      soleN1: -2,
      soleSig: 6,
      soleT0: 0.2,
      soleT1: 0.5,
      outIt: +$("pOut").value * 8,
      tMinF: 0.85,
      tAdd: 3,
      edgeFair: +$("pEdge").value,
      edgeBand: 8,
      cornerD: 10,
      outEdge: 4,
      toeR: 10,
      toeSig: 3,
      toeSide: 12,
      toeZ: 30,
      envIt: 8,
      envTol: 0.3,
      envRefSig: 1.2,
      envPre: !0,
      boxKeepSkin: !0,
      flapMedLoc: 1.15,
      rimTan: !1,
      rimFlat: !0,
      soleDropCap: 15,
      tipFrontSig: 3,
      tipColSig: 8,
      tipCont: !1,
      tipResample: !0,
      tipArc: !0,
      rimScale: 1,
      tipWallOnEdge: !1,
      autoFix: !0,
      fixIt: 15,
      tipWallLen: 25,
      tipWallZ: 3,
      tipArcEnd: 0.8,
      tipSideLen: 10,
      tipRound: 5,
      slots: !1,
      rivets: $("pRiv") ? $("pRiv").checked : !0,
      rvCalf: $("pRvCalf") ? $("pRvCalf").checked : !0,
      rvAnk: $("pRvAnk") ? $("pRvAnk").checked : !0,
      rvFore: $("pRvFore") ? $("pRvFore").checked : !0,
      rvMode: $("pRvMode") ? $("pRvMode").value : "marca",
      rvD: $("pRvD") ? +$("pRvD").value : 4.5,
      rvInset: $("pRvIn") ? +$("pRvIn").value : 10,
      rvTopGap: 18,
      rvAnkZ: 12,
      rvForeBack: 12,
      rvMarkR: 3.5,
      rvSnap: !0,
      rvMarkD: 1,
      strapW: $("pStrapW") ? +$("pStrapW").value : 25,
      slotW: 4,
      slotInset: $("pSlotIn") ? +$("pSlotIn").value : 7,
      slotCalf: $("pSlotCalf") ? $("pSlotCalf").checked : !0,
      slotAnk: $("pSlotAnk") ? $("pSlotAnk").checked : !0,
      slotFore: $("pSlotFore") ? $("pSlotFore").checked : !0,
      slotTopGap: 12,
      mat: $("mat") ? $("mat").value : "pp",
      kZ0: -10,
      kZ1: 60,
      trimAdj: S.trimAdj || null,
      hug: $("pHug") ? +$("pHug").value : 4,
      hugTol: 1.2,
      hugEdge: 6,
      undercut: 0,
      wallNoUndercut: $("pWall") ? $("pWall").value === "reta" : !1,
      artic: $("pArt") ? $("pArt").checked : !1,
      artGap: $("pArtGap") ? +$("pArtGap").value : 3,
      artArm: $("pArtArm") ? +$("pArtArm").value : 13,
      artD: $("pArtD") ? +$("pArtD").value : 4,
      artMode: $("pArtMode") ? $("pArtMode").value : "furo",
      lift: $("pLift") ? +$("pLift").value : 0,
      liftReg: $("pLiftReg") ? $("pLiftReg").value : "calcanhar",
      wedge: $("pWedge") ? +$("pWedge").value : 0,
      wedgeSide: $("pWedgeSide") ? $("pWedgeSide").value : "medial",
      engrave: $("pEng") ? $("pEng").checked : !1,
      engText: engraveAuto(),
      engH: $("pEngH") ? +$("pEngH").value : 5,
      engD: $("pEngD") ? +$("pEngD").value : 0.6,
      slotAnkZ: 12,
      slotForeBack: 12,
      tipShape: $("pTipShape") ? $("pTipShape").value : "elipse",
      tipMargin: ($("pTipM") ? +$("pTipM").value : 8) + ($("pGrow") ? +$("pGrow").value : 0),
      grow: $("pGrow") ? +$("pGrow").value : 0,
      tipApex: 0.3,
      tipWide: 0.02,
      tipDepth: 0.6,
      tipMaxAng: 60,
      tipStretch: !0,
      tipKeep: 0.85,
      tipMinExt: 0.4,
      tipWallFade: 0.6,
      wallM: 0.5,
      olSig: 5,
      footSig: 2.5,
      blendU: 40,
      sigPhi: +$("pSm").value * 1.5,
      sigU: +$("pSm").value * 1.5,
      blend: 70,
      sigTrim: 25,
      rTop: +$("pRT").value,
      rToe: 0,
      plateFrac: 0.68,
      plateCH: 12,
      archFill: +$("pArch").value / 100,
      plantarTol: 6,
      plantarSig: 1.5,
      sideKeep: 22,
      soleB0: 3,
      soleB1: 12,
      toeMargin: +$("pPM").value + 3,
      plateMargin: +$("pPM").value,
      boxH: 30,
      boxR: 6,
      phiFootMax: 125,
      bendZ: 40,
      bendY: 40,
      nj: 80,
      flare: +$("pFl").value,
      flareL: 20,
      edgeSeg: $("pRound").checked ? 6 : 1,
    },
    t,
  );
}
async function makeShell(t = {}) {
  if (!S.frame || !LM.every((n) => S.L[n.id])) return null;
  (($("busy").style.display = "grid"), await new Promise((n) => setTimeout(n, 30)));
  let e = 0;
  try {
    const n = anatXf(),
      o = S.V.length / 3,
      l = new Float64Array(S.V.length);
    for (let j = 0; j < o; j++) {
      const Q = n([S.V[j * 3], S.V[j * 3 + 1], S.V[j * 3 + 2]]);
      ((l[j * 3] = Q[0]), (l[j * 3 + 1] = Q[1]), (l[j * 3 + 2] = Q[2]));
    }
    const s = {};
    for (const j in S.L) s[j] = n(S.L[j]);
    const v = shellParams(t);
    v.reliefs = S.reliefs.map((j) => ({ p: n(j.p), d: j.d, r: j.r }));
    const h = performance.now();
    e = ++S.genSeq;
    let u = await generateShellAsync(l, S.F, s, Object.assign({}, v, { selfCheck: !0 }));
    if (e !== S.genSeq) return null;
    {
      let j = [],
        Q = 0;
      for (; v.autoFix && u.log.check > 0 && Q < 3; ) {
        (Q++, (j = j.concat(u.log.crossCells || [])));
        const G = await generateShellAsync(
          l,
          S.F,
          s,
          Object.assign({}, v, { selfCheck: !0, fixCells: j, fixR: [4 + 2 * Q, 8 + 3 * Q] }),
        );
        if (e !== S.genSeq) return null;
        G.log.check <= u.log.check && (u = G);
      }
      u.log.fixTries = Q;
    }
    (v.dbg && (u.anat = l), (u.ms = performance.now() - h), (u.params = v));
    const x = S.frame,
      T = V3.cross(x.Y, x.Z),
      b = new Float32Array(u.shell.V.length);
    for (let j = 0; j < b.length; j += 3) {
      const Q = u.shell.V[j],
        G = u.shell.V[j + 1],
        O = u.shell.V[j + 2];
      for (let B = 0; B < 3; B++) b[j + B] = x.AJC[B] + T[B] * Q + x.Y[B] * G + x.Z[B] * O;
    }
    const y = separarVincos(b, u.shell.F, 55);
    let L = u.heat;
    if (
      (y.mapa &&
        ((L = new Float32Array(y.V.length / 3)),
        L.set(u.heat),
        y.mapa.forEach((j, Q) => (L[u.heat.length + Q] = u.heat[j]))),
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.apos),
      gl.bufferData(gl.ARRAY_BUFFER, y.V, gl.STATIC_DRAW),
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.anor),
      gl.bufferData(gl.ARRAY_BUFFER, normaisDeVertices(y.V, y.F), gl.STATIC_DRAW),
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.aidx),
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, y.F, gl.STATIC_DRAW),
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.aheat),
      gl.bufferData(gl.ARRAY_BUFFER, L, gl.STATIC_DRAW),
      (S.shell = { ...u, nIdx: u.shell.F.length, dispMap: y.mapa }),
      setTimeout(refInfo, 0),
      setTimeout(showStiff, 0),
      setTimeout(renderSafety, 0),
      S.cmpSrc)
    ) {
      const j = S.cmpSrc;
      setTimeout(() => {
        try {
          compareReal(j.V, j.F, j.name);
        } catch {}
      }, 0);
    }
    const C = u.log,
      W = $("mat").value,
      U = C.volume * DENS[W];
    (($("shellInfo").innerHTML = `
<tr><td>Volume</td><td>${fmt(C.volume, 1)} cm³</td></tr>
<tr><td>Massa estimada (${W === "pp" ? "PP" : "nylon"}, 100%)</td><td>${fmt(U, 0)} g</td></tr>
<tr><td>Dimensões (L × C × A)</td><td>${C.bbox.map((j) => j.toFixed(0)).join(" × ")} mm</td></tr>
<tr><td>Triângulos</td><td>${C.tris.toLocaleString("pt-BR")}</td></tr>
<tr><td>Face interna: contato / folga / pressão</td><td>${Math.round(C.contact.ok * 100)} / ${Math.round(C.contact.folga * 100)} / ${Math.round(C.contact.pressao * 100)}%</td></tr>`),
      ($("shellNote").innerHTML =
        `Gerada em ${(u.ms / 1e3).toFixed(1)} s. Superfície reconstruída a partir dos contornos externos do scan; sólido fechado, pronto para o fatiador.`),
      ($("expAfo").disabled = !1),
      ($("expPdf").disabled = !1),
      status('Casca gerada. A perna aparece translúcida; desmarque "Mostrar perna" para ver só a AFO.'));
    {
      const j = performance.now(),
        Q = meshCheck(u.shell.V, u.log.baseTris ? u.shell.F.subarray(0, u.log.baseTris * 3) : u.shell.F);
      ((S.shell.check = Q), (u.log.check = Q.n), (u.log.checkMs = performance.now() - j));
      const G = S.meas && S.meas.pf,
        O = !S.corrected && G !== void 0 && Math.abs(G) > 12;
      $("shellInfo").insertAdjacentHTML(
        "beforeend",
        `<tr><td>Verificação da malha</td><td>${Q.n ? '<span class="flag w">' + Q.n + " faces cruzadas</span>" : '<span class="flag o">sem cruzamentos</span>'}</td></tr>`,
      );
      {
        const B = u.log.rivets || [];
        ((S.shell.rivetsW = B.map((Z) => {
          const rt = V3.cross(x.Y, x.Z);
          return [0, 1, 2].map((D) => x.AJC[D] + rt[D] * Z.pO[0] + x.Y[D] * Z.pO[1] + x.Z[D] * Z.pO[2]);
        })),
          u.params.rivets &&
            ($("shellInfo").insertAdjacentHTML(
              "beforeend",
              `<tr><td>Pontos de rebite</td><td>${B.length} ${u.params.rvMode === "furo" ? "furos Ø" + u.params.rvD : "marcas"}</td></tr>`,
            ),
            u.log.rivetsSkipped &&
              $("shellNote").insertAdjacentHTML(
                "beforeend",
                `<div class="note">Sem rebite em: ${u.log.rivetsSkipped.join(", ")} — a parede é baixa demais para a distância da borda escolhida.</div>`,
              )),
          renderRivets());
      }
      if (u.log.artic) {
        const B = u.log.artic;
        $("shellInfo").insertAdjacentHTML(
          "beforeend",
          B.fail
            ? '<tr><td>Articulação</td><td><span class="flag w">não aplicada</span></td></tr>'
            : `<tr><td>Articulação</td><td>corte de ${String(B.gap).replace(".", ",")} mm · ${B.joints.length} lados</td></tr>`,
        );
        const Z = $("artInfo");
        Z &&
          (Z.innerHTML = B.fail
            ? '<span style="color:var(--warn)">Não foi possível cortar: ' + B.fail + ".</span>"
            : B.joints
                .map(
                  (rt) =>
                    `${rt.lado}: eixo a ${rt.frente} mm da borda da frente${rt.frente < 12 ? ' <b style="color:var(--warn)">— pouco apoio; avance a linha de corte</b>' : ""}`,
                )
                .join("<br>"));
      } else $("artInfo") && ($("artInfo").innerHTML = "");
      if (u.log.stiff && u.log.stiff.EI > 0) {
        const B = u.log.stiff,
          Z = S.prevEI,
          rt = Z ? (B.EI / Z - 1) * 100 : null;
        S.prevEI = B.EI;
        let D = "";
        if (B.cls !== "rígida") {
          const kt = [];
          (B.th > 75 && kt.push("avançar a linha de corte no tornozelo para ≤ 70°"),
            B.tEff < (u.params.mat === "nylon" ? 3 : 3.5) &&
              kt.push("aumentar espessura + reforço para ≥ " + (u.params.mat === "nylon" ? 3 : 3.5) + " mm"),
            (D = kt.length ? " Para rigidez: " + kt.join(" e ") + "." : ""));
        }
        ($("shellInfo").insertAdjacentHTML(
          "beforeend",
          `<tr><td>Rigidez em dorsiflexão (estimativa)</td><td><span class="flag ${B.cls === "rígida" ? "o" : "w"}">${B.cls}</span></td></tr><tr><td>Rigidez da seção mais fraca (E·I)</td><td>${B.EI.toLocaleString("pt-BR")} N·m²${rt != null && Math.abs(rt) >= 0.5 ? ' <small style="color:var(--muted)">(' + (rt > 0 ? "+" : "") + rt.toFixed(0) + "%)</small>" : ""}</td></tr>`,
        ),
          $("shellNote").insertAdjacentHTML(
            "beforeend",
            `<div class="note">Classe pela linha de corte no tornozelo (${B.th}°) e espessura efetiva (${B.tEff} mm). E·I vem de um modelo de viga de parede fina na seção mais fraca da perna (${B.zMin} mm acima do tornozelo): use para comparar configurações, não como medida de bancada.${D}</div>`,
          ));
      }
      Q.n
        ? status(
            `<b>Atenção:</b> a malha tem ${Q.n} faces que se cruzam${O ? " — o pé está sem correção de postura (" + fmt(Math.abs(G), 0) + "° de " + (G > 0 ? "equino" : "dorsiflexão") + "). Aplique a correção (etapa 4) ou ajuste o ângulo alvo e gere de novo" : ". Ajuste os pontos M1/M5 ou a suavidade e gere de novo"}.`,
          )
        : O &&
          status(
            `Casca gerada sem correção de postura (${fmt(Math.abs(G), 0)}° de ${G > 0 ? "equino" : "dorsiflexão"}). Em deformidades acentuadas, prefira aplicar a correção (etapa 4) com o ângulo alcançável.`,
          );
    }
    return (draw(), u);
  } catch (n) {
    (console.error(n), clearShell(), draw());
    const o = (n && n.message) || String(n);
    status("Não foi possível gerar a casca: " + o);
    let l = "";
    try {
      const v = anatXf(),
        h = {};
      for (const u in S.L) h[u] = v(S.L[u]).map((x) => +x.toFixed(1));
      l = JSON.stringify({
        versao: "0.3",
        arquivo: S.name,
        erro: o,
        pilha: ((n && n.stack) || "")
          .split(
            `
`,
          )
          .slice(0, 4)
          .join(" | "),
        corrigido: S.corrected,
        pontos: h,
        parametros: shellParams(t),
        navegador: navigator.userAgent,
      });
    } catch {
      l = o;
    }
    $("shellNote").innerHTML =
      `<div style="color:var(--warn);margin-top:6px">⚠ ${o}</div><details style="margin-top:6px"><summary style="cursor:pointer">Diagnóstico para enviar</summary><textarea readonly style="width:100%;height:110px;font:11px monospace;margin-top:4px">${l.replace(/</g, "&lt;")}</textarea><button id="cpDiag" style="margin-top:4px">Copiar diagnóstico</button></details>`;
    const s = $("cpDiag");
    return (
      s &&
        (s.onclick = async () => {
          try {
            (await navigator.clipboard.writeText(l), (s.textContent = "Copiado"));
          } catch {
            s.textContent = "Selecione o texto e copie";
          }
        }),
      null
    );
  } finally {
    (!e || e === S.genSeq) && ($("busy").style.display = "none");
  }
}
(($("genShell").onclick = () => makeShell()),
  ($("showLimb").onchange = draw),
  ($("contact").onchange = () => {
    (($("contactLegend").style.display = $("contact").checked ? "block" : "none"),
      $("contact").checked && ($("showLimb").checked = !1),
      draw());
  }));
const CP1252 = {
  "€": 128,
  "‚": 130,
  ƒ: 131,
  "„": 132,
  "…": 133,
  "†": 134,
  "‡": 135,
  ˆ: 136,
  "‰": 137,
  Š: 138,
  "‹": 139,
  Œ: 140,
  Ž: 142,
  "‘": 145,
  "’": 146,
  "“": 147,
  "”": 148,
  "•": 149,
  "–": 150,
  "—": 151,
  "˜": 152,
  "™": 153,
  š: 154,
  "›": 155,
  œ: 156,
  ž: 158,
  Ÿ: 159,
};
function pdfEsc(t) {
  let e = "";
  for (const n of String(t)) {
    let o = n.charCodeAt(0);
    o > 255 && (o = CP1252[n] || 63);
    const l = String.fromCharCode(o);
    e += l === "(" || l === ")" || l === "\\" ? "\\" + l : l;
  }
  return e;
}
function pdfW(t, e) {
  let n = 0;
  for (const o of String(t))
    n += /[ilI.,;:'|!]/.test(o) ? 0.28 : /[mwMW@]/.test(o) ? 0.85 : /[A-Z0-9]/.test(o) ? 0.64 : 0.52;
  return n * e;
}
class PdfPage {
  constructor() {
    this.c = "";
  }
  rect(e, n, o, l, s) {
    this.c += `${s.map((v) => v.toFixed(3)).join(" ")} rg ${e} ${n} ${o} ${l} re f
`;
  }
  line(e, n, o, l, s, v = 0.6) {
    this.c += `${s.map((h) => h.toFixed(3)).join(" ")} RG ${v} w ${e} ${n} m ${o} ${l} l S
`;
  }
  text(e, n, o, l, s, v = [0.11, 0.09, 0.19]) {
    this.c += `BT /${s ? "F2" : "F1"} ${o} Tf ${v.map((h) => h.toFixed(3)).join(" ")} rg ${e} ${n} Td (${pdfEsc(l)}) Tj ET
`;
  }
  image(e, n, o, l, s) {
    this.c += `q ${l} 0 0 ${s} ${n} ${o} cm /${e} Do Q
`;
  }
}
function makePDF(t, e) {
  const n = (U) => {
      const j = new Uint8Array(U.length);
      for (let Q = 0; Q < U.length; Q++) j[Q] = U.charCodeAt(Q) & 255;
      return j;
    },
    o = [],
    l = [];
  let s = 0;
  const v = (U) => {
    (o.push(U), (s += U.length));
  };
  v(
    n(`%PDF-1.4
%âãÏÓ
`),
  );
  const h = e.length,
    u = 5 + h,
    x = 4 + h + t.length * 2,
    T = (U, j) => {
      ((l[U] = s),
        j instanceof Uint8Array
          ? v(j)
          : v(
              n(`${U} 0 obj
${j}
endobj
`),
            ));
    };
  (T(1, "<< /Type /Catalog /Pages 2 0 R >>"),
    T(2, `<< /Type /Pages /Kids [${t.map((U, j) => u + j * 2 + " 0 R").join(" ")}] /Count ${t.length} >>`),
    T(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
    T(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"));
  const b = e.map((U, j) => `/${U.name} ${5 + j} 0 R`).join(" ");
  (e.forEach((U, j) => {
    const Q = 5 + j,
      G = n(`${Q} 0 obj
<< /Type /XObject /Subtype /Image /Width ${U.w} /Height ${U.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${U.bytes.length} >>
stream
`),
      O = n(`
endstream
endobj
`),
      B = new Uint8Array(G.length + U.bytes.length + O.length);
    (B.set(G), B.set(U.bytes, G.length), B.set(O, G.length + U.bytes.length), T(Q, B));
  }),
    t.forEach((U, j) => {
      const Q = u + j * 2,
        G = n(U.c);
      T(
        Q,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${b} >> >> /Contents ${Q + 1} 0 R >>`,
      );
      const O = n(`${Q + 1} 0 obj
<< /Length ${G.length} >>
stream
`),
        B = n(`
endstream
endobj
`),
        Z = new Uint8Array(O.length + G.length + B.length);
      (Z.set(O), Z.set(G, O.length), Z.set(B, O.length + G.length), T(Q + 1, Z));
    }));
  const y = s;
  let L = `xref
0 ${x + 1}
0000000000 65535 f 
`;
  for (let U = 1; U <= x; U++)
    L +=
      String(l[U]).padStart(10, "0") +
      ` 00000 n 
`;
  v(
    n(
      L +
        `trailer
<< /Size ${x + 1} /Root 1 0 R >>
startxref
${y}
%%EOF
`,
    ),
  );
  const C = new Uint8Array(s);
  let W = 0;
  for (const U of o) (C.set(U, W), (W += U.length));
  return C;
}
function jpegOf(t, e = 0.88) {
  const n = t.toDataURL("image/jpeg", e),
    o = atob(n.split(",")[1]),
    l = new Uint8Array(o.length);
  for (let s = 0; s < o.length; s++) l[s] = o.charCodeAt(s);
  return { bytes: l, w: t.width, h: t.height };
}
function captureViews(t, e = {}) {
  const n = {
      yaw: cam.yaw,
      pitch: cam.pitch,
      dist: cam.dist,
      target: cam.target.slice(),
      basis: cam.basis && cam.basis.map((u) => u.slice()),
    },
    o = S.clean,
    l = $("showLimb").checked,
    s = $("contact").checked,
    v = $("devMap") ? $("devMap").checked : !1;
  ((S.clean = !0),
    ($("showLimb").checked = !1),
    ($("contact").checked = !!e.contact),
    $("devMap") && ($("devMap").checked = !1));
  const h = [];
  for (const [u, x, T] of t) {
    (setView(u), (cam.yaw += x), (cam.pitch += T), draw());
    const b = glc.width,
      y = glc.height,
      L = Math.min(b, y),
      C = document.createElement("canvas");
    ((C.width = 640), (C.height = 640));
    const W = C.getContext("2d");
    ((W.fillStyle = "#fff"),
      W.fillRect(0, 0, 640, 640),
      W.drawImage(glc, (b - L) / 2, (y - L) / 2, L, L, 0, 0, 640, 640),
      ov.width === b && ov.height === y && W.drawImage(ov, (b - L) / 2, (y - L) / 2, L, L, 0, 0, 640, 640),
      h.push(jpegOf(C)));
  }
  return (
    Object.assign(cam, n),
    (S.clean = o),
    ($("showLimb").checked = l),
    ($("contact").checked = s),
    $("devMap") && ($("devMap").checked = v),
    draw(),
    h
  );
}
const CONTACT_COL = (t) =>
  t < -900 ? null : t < -0.3 ? "#3f73e6" : t < 2.5 ? "#4dab6b" : t < 5 ? "#f0c540" : "#db4d3f";
function contactRegion(t) {
  return t < -25 ? "perna" : t < 50 ? "calcanhar" : "pé";
}
function contactMapImage() {
  const t = S.shell;
  if (!t || !t.grid || !t.heat) return null;
  const { NI: e, NJ: n, In: o, iS: l } = t.grid,
    s = e * n,
    v = t.heat,
    h = (gt, Ut) => v[s + gt * n + Ut],
    u = (n - 1) / 2,
    x = Math.floor(u),
    T = u - x,
    b = (gt, Ut) => [o[(gt * n + Ut) * 3], o[(gt * n + Ut) * 3 + 1], o[(gt * n + Ut) * 3 + 2]],
    y = [],
    L = new Float64Array(e);
  let C = 0;
  for (let gt = 0; gt < e; gt++) {
    const Ut = [0];
    for (let ot = 1; ot < n; ot++) Ut.push(Ut[ot - 1] + V3.len(V3.sub(b(gt, ot), b(gt, ot - 1))));
    const qt = Ut[x] + (Ut[Math.min(n - 1, x + 1)] - Ut[x]) * T;
    if ((y.push(Ut.map((ot) => ot - qt)), gt > 0)) {
      const ot = V3.add(V3.mul(b(gt - 1, x), 1 - T), V3.mul(b(gt - 1, Math.min(n - 1, x + 1)), T)),
        At = V3.add(V3.mul(b(gt, x), 1 - T), V3.mul(b(gt, Math.min(n - 1, x + 1)), T));
      C += V3.len(V3.sub(At, ot));
    }
    L[gt] = C;
  }
  let W = 1e9,
    U = -1e9;
  for (const gt of y) for (const Ut of gt) ((W = Math.min(W, Ut)), (U = Math.max(U, Ut)));
  const j = U - W,
    Q = L[e - 1],
    G = 46,
    O = Math.min(760 / j, 1100 / Q),
    B = Math.round(j * O + 2 * G),
    Z = Math.round(Q * O + 2 * G + 20),
    rt = document.createElement("canvas");
  ((rt.width = B), (rt.height = Z));
  const D = rt.getContext("2d");
  ((D.fillStyle = "#fff"), D.fillRect(0, 0, B, Z));
  const kt = (gt, Ut) => [G + (y[gt][Ut] - W) * O, G + L[gt] * O],
    Bt = {};
  for (let gt = 0; gt < e - 1; gt++) {
    const Ut = contactRegion(l[gt][0]);
    for (let qt = 0; qt < n - 1; qt++) {
      const ot = [h(gt, qt), h(gt + 1, qt), h(gt + 1, qt + 1), h(gt, qt + 1)].filter((Qt) => Qt > -900);
      if (!ot.length) continue;
      const At = ot.reduce((Qt, ae) => Qt + ae, 0) / ot.length,
        Vt = CONTACT_COL(At),
        oe = kt(gt, qt),
        It = kt(gt + 1, qt),
        Zt = kt(gt + 1, qt + 1),
        Me = kt(gt, qt + 1);
      ((D.fillStyle = Vt),
        (D.strokeStyle = Vt),
        (D.lineWidth = 0.6),
        D.beginPath(),
        D.moveTo(...oe),
        D.lineTo(...It),
        D.lineTo(...Zt),
        D.lineTo(...Me),
        D.closePath(),
        D.fill(),
        D.stroke());
      const _t = (Bt[Ut] = Bt[Ut] || { n: 0, pres: 0, ok: 0, folga: 0, folga5: 0, min: 1e9 });
      (_t.n++, (_t.min = Math.min(_t.min, At)));
      const ue = Math.abs(
          V3.norm(V3.cross(V3.sub(b(gt + 1, qt + 1), b(gt, qt)), V3.sub(b(gt, qt + 1), b(gt + 1, qt))))[2],
        ),
        De = ue > 0.75 && b(gt, qt)[2] < -20;
      At < -0.3 ? (De ? _t.ok++ : _t.pres++) : At < 2.5 ? _t.ok++ : At < 5 ? _t.folga++ : _t.folga5++;
    }
  }
  ((D.strokeStyle = "#3a2f5c"), (D.lineWidth = 1.4), D.beginPath());
  const wt = [];
  for (let gt = 0; gt < n; gt++) wt.push([0, gt]);
  for (let gt = 1; gt < e; gt++) wt.push([gt, n - 1]);
  for (let gt = n - 2; gt >= 0; gt--) wt.push([e - 1, gt]);
  for (let gt = e - 2; gt >= 1; gt--) wt.push([gt, 0]);
  (wt.forEach(([gt, Ut], qt) => {
    const ot = kt(gt, Ut);
    qt ? D.lineTo(...ot) : D.moveTo(...ot);
  }),
    D.closePath(),
    D.stroke(),
    (D.font = "600 17px Helvetica, Arial, sans-serif"),
    (D.textBaseline = "middle"));
  let Kt = null;
  for (let gt = 0; gt < e; gt++) {
    const Ut = contactRegion(l[gt][0]);
    if (Kt && Ut !== Kt) {
      ((D.strokeStyle = "rgba(40,30,70,.55)"), D.setLineDash([6, 5]), (D.lineWidth = 1.2), D.beginPath());
      for (let qt = 0; qt < n; qt++) {
        const ot = kt(gt, qt);
        qt ? D.lineTo(...ot) : D.moveTo(...ot);
      }
      (D.stroke(), D.setLineDash([]));
    }
    Kt = Ut;
  }
  const Gt = (gt, Ut) => {
    const qt = kt(Ut, 0),
      ot = kt(Ut, n - 1);
    ((D.fillStyle = "#3a2f5c"), (D.textAlign = "right"), D.fillText(gt, Math.min(qt[0], ot[0]) - 8, qt[1]));
  };
  for (const gt of ["perna", "calcanhar", "pé"]) {
    const Ut = [];
    for (let qt = 0; qt < e; qt++) contactRegion(l[qt][0]) === gt && Ut.push(qt);
    Ut.length && Gt(gt, Ut[Math.floor(Ut.length / 2)]);
  }
  let nt = "lado A",
    ge = "lado B";
  try {
    const gt = S.frame,
      Ut = V3.cross(gt.Y, gt.Z),
      qt = Math.sign(V3.dot(V3.sub(S.L.ML, S.L.MM), Ut)) || 1,
      ot = Math.floor(e * 0.3);
    ((nt = Math.sign(o[ot * n * 3]) === qt ? "lateral" : "medial"), (ge = nt === "lateral" ? "medial" : "lateral"));
  } catch {}
  return (
    (D.font = "600 18px Helvetica, Arial, sans-serif"),
    (D.fillStyle = "#6B3FD6"),
    (D.textAlign = "left"),
    D.fillText("◀ " + nt, G, 18),
    (D.textAlign = "right"),
    D.fillText(ge + " ▶", B - G, 18),
    (D.textAlign = "center"),
    (D.fillStyle = "#3a2f5c"),
    (D.font = "15px Helvetica, Arial, sans-serif"),
    D.fillText("topo da AFO", B / 2, G - 14),
    D.fillText("ponta", B / 2, Z - 18),
    (t.log.rivets || []).forEach((gt, Ut) => {
      const qt = Math.max(0, Math.min(e - 1, gt.a)),
        ot = Math.floor(gt.jf),
        At = gt.jf - ot,
        Vt = Math.min(n - 1, ot + 1),
        oe = kt(qt, ot),
        It = kt(qt, Vt),
        Zt = [oe[0] + (It[0] - oe[0]) * At, oe[1]];
      ((D.fillStyle = "#fff"),
        (D.strokeStyle = "#B8661A"),
        (D.lineWidth = 2.5),
        D.beginPath(),
        D.arc(Zt[0], Zt[1], 7, 0, 7),
        D.fill(),
        D.stroke(),
        (D.fillStyle = "#B8661A"),
        (D.font = "700 14px Helvetica, Arial, sans-serif"),
        (D.textAlign = "left"),
        D.fillText("R" + (Ut + 1), Zt[0] + 10, Zt[1]));
    }),
    { img: jpegOf(rt, 0.9), st: Bt, side0: nt, side1: ge, aspect: B / Z }
  );
}
async function logoJpeg() {
  try {
    const t = new Image();
    ((t.src = "assets/eita-afo-simbolo.png"), await t.decode());
    const e = document.createElement("canvas");
    e.width = e.height = 160;
    const n = e.getContext("2d");
    return ((n.fillStyle = "#fff"), n.fillRect(0, 0, 160, 160), n.drawImage(t, 0, 0, 160, 160), jpegOf(e, 0.92));
  } catch {
    return null;
  }
}
async function buildReport(t) {
  if (!S.shell) return null;
  const e = S.shell.log,
    n = S.shell.params,
    o = n.mat === "nylon" ? "Nylon" : "PP",
    l = DENS[n.mat] || 0.9,
    s = S.meas || {},
    v = $("orient") ? $("orient").value : "anat",
    h = captureViews([
      ["lat", 0.15, 0.08],
      ["back", 0, 0.1],
      ["med", -0.15, 0.08],
    ]),
    u = await logoJpeg(),
    x = h.map((ot, At) => Object.assign({ name: "Im" + (At + 1) }, ot));
  u && x.push(Object.assign({ name: "Lg" }, u));
  const T = readPatient(),
    b = (ot) => (ot && String(ot).trim() ? String(ot).trim() : "—"),
    y = (ot, At, Vt) => {
      if (((ot = String(ot)), pdfW(ot, At) <= Vt)) return ot;
      for (; ot.length > 1 && pdfW(ot + "…", At) > Vt; ) ot = ot.slice(0, -1);
      return ot + "…";
    },
    L = new PdfPage(),
    C = [L],
    W = [0.42, 0.25, 0.84],
    U = [0.11, 0.09, 0.19],
    j = [0.36, 0.33, 0.45],
    Q = [0.88, 0.86, 0.93];
  (L.rect(0, 792, 595, 50, [0.97, 0.96, 0.99]),
    L.rect(0, 790, 595, 2.5, W),
    u && L.image("Lg", 36, 800, 34, 34),
    L.text(u ? 78 : 36, 820, 18, "EITA!", !0, [0.07, 0.07, 0.07]),
    L.text((u ? 78 : 36) + pdfW("EITA! ", 18), 820, 18, "AFO", !0, [0.584, 0.376, 0.992]),
    L.text(
      u ? 78 : 36,
      805,
      9,
      "Relatório de fabricação · " +
        (e.artic && !e.artic.fail ? "AFO articulada" : "AFO rígida posterior") +
        " · Lab.EITA / UFG",
      !1,
      j,
    ));
  const G = new Date();
  (L.text(
    430,
    820,
    9,
    G.toLocaleDateString("pt-BR") + " " + G.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    !1,
    j,
  ),
    L.text(430, 806, 9, y(T.pName || (S.patient && S.patient.name) || baseName(), 9, 128), !0, U));
  {
    let ot = 776;
    (L.text(36, ot, 10.5, "Paciente", !0, W), (ot -= 6), L.line(36, ot, 559, ot, Q), (ot -= 13));
    const At = ageText(T.pBirth),
      Vt = T.pBirth ? new Date(T.pBirth + "T12:00:00").toLocaleDateString("pt-BR") : "",
      oe =
        T.pSide === "D"
          ? "direito"
          : T.pSide === "E"
            ? "esquerdo"
            : S.frame && S.frame.side
              ? S.frame.side + " (pelo scan)"
              : "—",
      It = (Zt, Me, _t, ue) => {
        (L.text(Zt, ot, 7.6, _t, !1, j), L.text(Zt, ot - 10, 9, y(b(ue), 9, Me - 6), !0, U));
      };
    (It(36, 170, "Nome", T.pName),
      It(206, 100, "Prontuário / código", T.pId),
      It(306, 175, "Nascimento", Vt ? Vt + (At ? " · " + At : "") : ""),
      It(481, 78, "Sexo", { F: "feminino", M: "masculino", O: "outro" }[T.pSex] || ""),
      (ot -= 25),
      It(36, 100, "Peso", T.pWeight ? String(T.pWeight).replace(".", ",") + " kg" : ""),
      It(136, 100, "Altura", T.pHeight ? T.pHeight + " cm" : ""),
      It(236, 110, "Nº do calçado", T.pShoe),
      It(346, 213, "Membro", oe),
      (ot -= 25),
      It(36, 260, "Diagnóstico", T.pDiag),
      It(304, 255, "Objetivo / indicação", T.pGoal),
      (ot -= 25),
      It(36, 260, "Profissional responsável", T.pProf),
      It(304, 255, "Observações", (T.pNotes || "").replace(/\s+/g, " ")),
      (ot -= 18));
  }
  const O = 150,
    B = (595 - 3 * O - 24) / 2;
  (h.forEach((ot, At) => {
    L.image("Im" + (At + 1), B + At * (O + 12), 498, O, O);
  }),
    L.text(B, 488, 8, "Vistas: lateral · posterior · medial (sem a perna)", !1, j));
  let Z = 470;
  const rt = (ot, At, Vt) => {
      let oe = Z;
      (L.text(ot, oe, 10.5, At, !0, W), (oe -= 6), L.line(ot, oe, ot + 255, oe, Q), (oe -= 13));
      for (const [It, Zt] of Vt) {
        L.text(ot, oe, 8.8, It, !1, j);
        const Me = String(Zt);
        (L.text(ot + 255 - pdfW(Me, 8.8), oe, 8.8, Me, !0, U), (oe -= 13.2));
      }
      return oe;
    },
    D = (ot, At = 1) =>
      ot == null || isNaN(ot) ? "—" : (Math.abs(+ot) < 0.5 * 10 ** -At ? 0 : +ot).toFixed(At).replace(".", ","),
    kt = rt(36, "Scan e postura", [
      ["Arquivo do scan", S.name.slice(0, 30)],
      [
        "Lado",
        S.frame.side === "R" || S.frame.side === "D"
          ? "direito"
          : S.frame.side === "L" || S.frame.side === "E"
            ? "esquerdo"
            : String(S.frame.side),
      ],
      ["Correção de postura", S.corrected ? "aplicada" : "não aplicada"],
      ["Ângulo perna-pé (°)", D(s.sag, 0)],
      ["Plantiflexão (°)", D(s.pf, 0)],
      ["Inversão (°)", D(s.inv, 0)],
      ["Largura bimaleolar (mm)", D(s.bimal, 0)],
      ["Largura do antepé (mm)", D(s.forefoot, 0)],
      ["Calcâneo–antepé (mm)", D(s.footLen, 0)],
    ]),
    Bt = rt(304, "Casca", [
      ["Material", o],
      ["Espessura / reforço no tornozelo", D(n.t) + " / +" + D(n.tAnk) + " mm"],
      ["Folga geral", D(n.clear) + " mm"],
      ["Alívio dos maléolos", D(n.relD) + " mm"],
      [
        "Alívios manuais",
        S.reliefs.length
          ? S.reliefs.map((ot, At) => "A" + (At + 1) + " " + D(ot.d, 1) + "/" + ot.r).join(" · ")
          : "nenhum",
      ],
      ["Linha de corte tornozelo / panturrilha", n.thAnk + "° / " + n.thCalf + "°"],
      ["Bordas calcanhar / antepé / dedos", n.hHeel + " / " + n.hFore + " / " + n.hToe + " mm"],
      ["Ajustes manuais da linha de corte", S.trimAdj && S.trimAdj.some((ot) => ot.some((At) => At)) ? "sim" : "não"],
      ["Preenchimento do arco", n.archFill != null ? Math.round(n.archFill * 100) + " %" : "—"],
      [
        "Rebites",
        e.rivets && e.rivets.length
          ? e.rivets.length +
            " pontos · " +
            (n.rvMode === "furo" ? "furo-guia Ø" + D(n.rvD) + " mm" : "marcados para furar")
          : "não indicados",
      ],
      [
        "Tipo",
        e.artic && !e.artic.fail
          ? "articulada · corte " + D(e.artic.gap, 1) + " mm · furos Ø" + D(n.artD) + " mm"
          : "rígida (peça única)",
      ],
      ["Folga para crescimento", n.grow ? D(n.grow, 0) + " mm na ponta" : "não"],
      [
        "Calço / cunha",
        e.wedge && !e.wedge.fail
          ? (n.lift ? D(n.lift, 0) + " mm (" + (n.liftReg === "toda" ? "sola toda" : "calcanhar") + ")" : "sem calço") +
            (n.wedge ? " · cunha " + D(n.wedge, 0) + "° " + n.wedgeSide : "")
          : "não",
      ],
      ["Identificação em relevo", e.engrave && !e.engrave.skipped ? y(e.engrave.lines.join(" / "), 8.8, 140) : "não"],
    ]);
  Z = Math.min(kt, Bt) - 14;
  const wt = e.stiff,
    Kt = rt(36, "Resultado", [
      ["Massa estimada (100 % de preenchimento)", D(e.volume * l, 0) + " g"],
      ["Volume (mL)", D(e.volume, 1)],
      ["Dimensões (L × C × A)", e.bbox.map((ot) => Math.round(ot)).join(" × ") + " mm"],
      ["Espessura mínima", e.thick ? D(e.thick[0]) + " mm" : "—"],
      ["Contato com a pele (0–2,5 mm)", e.contact ? Math.round(e.contact.ok * 100) + " %" : "—"],
      ["Pontos de pressão", e.contact ? Math.round(e.contact.pressao * 100) + " %" : "—"],
      [
        "Rigidez em dorsiflexão (estimativa)",
        wt
          ? (() => {
              const ot = stiffEstimate(wt.EI);
              return ot ? D(ot.K, 2) + " N·m/° (" + D(ot.lo, 2) + "–" + D(ot.hi, 2) + ") · " + wt.cls : wt.cls;
            })()
          : "—",
      ],
      ["E·I da seção mais fraca (N·m2)", wt ? D(wt.EI, 2) : "—"],
      ["Verificação da malha", e.check ? e.check + " faces cruzadas" : "sem cruzamentos"],
      ["Triângulos", e.tris.toLocaleString("pt-BR")],
    ]),
    Gt = rt(304, "Impressão", [
      ["Orientação do STL", v === "anat" ? "anatômica" : v === "pe" ? "em pé" : "deitada"],
      ["Preenchimento", "100 % ou 6+ perímetros"],
      ["Altura de camada", "0,2–0,3 mm"],
      ["Mesa", n.mat === "nylon" ? "adesivo para nylon; secar o filamento" : "fita/placa de PP; sem brim fino"],
      ["Suportes", "sob a sola e a borda da ponta"],
      ["Acabamento", "lixar bordas; conferir fendas"],
    ]);
  Z = Math.min(Kt, Gt) - 10;
  let nt = L;
  {
    const ot = contactMapImage();
    if (ot) {
      ((nt = new PdfPage()),
        C.push(nt),
        nt.rect(0, 820, 595, 22, [0.97, 0.96, 0.99]),
        nt.text(36, 826, 9.5, "EITA! AFO · " + y(T.pName || baseName(), 9, 300) + " · continuação", !0, W));
      let At = 800;
      (nt.text(36, At, 10.5, "Mapa de contato (face interna × pele)", !0, W),
        (At -= 6),
        nt.line(36, At, 559, At, Q),
        (At -= 6),
        x.push(Object.assign({ name: "Cm" }, ot.img)));
      const Vt = Math.min(470, 250 / ot.aspect),
        oe = Vt * ot.aspect;
      (nt.image("Cm", 36 + (250 - oe) / 2, At - Vt, oe, Vt),
        nt.text(
          36,
          At - Vt - 12,
          7.6,
          "Face interna planificada, vista de dentro da AFO. Linhas tracejadas: limites das regiões.",
          !1,
          j,
        ),
        captureViews(
          [
            ["front", 0, 0.15],
            ["top", 0, 0],
          ],
          { contact: !0 },
        ).forEach((ae, Et) => x.push(Object.assign({ name: "Cv" + (Et + 1) }, ae))));
      const Zt = 304,
        Me = 124;
      (nt.image("Cv1", Zt, At - Me, Me, Me),
        nt.image("Cv2", Zt + Me + 7, At - Me, Me, Me),
        nt.text(Zt, At - Me - 11, 7.6, "Vistas por dentro: pela frente · por cima", !1, j));
      let _t = At - Me - 30;
      (nt.text(Zt, _t, 8, "Região", !0, j),
        nt.text(Zt + 72, _t, 8, "Pressão", !0, j),
        nt.text(Zt + 122, _t, 8, "Contato", !0, j),
        nt.text(Zt + 172, _t, 8, "Folga 2,5–5", !0, j),
        nt.text(Zt + 222, _t, 8, "> 5 mm", !0, j),
        (_t -= 13));
      const ue = (ae, Et) => (Et ? Math.round((ae / Et) * 100) + " %" : "—");
      for (const ae of ["perna", "calcanhar", "pé"]) {
        const Et = ot.st[ae];
        Et &&
          (nt.text(Zt, _t, 8.8, ae, !1, U),
          nt.text(
            Zt + 72,
            _t,
            8.8,
            ue(Et.pres, Et.n),
            Et.pres / Et.n > 0.03,
            Et.pres / Et.n > 0.03 ? [0.2, 0.36, 0.82] : U,
          ),
          nt.text(Zt + 122, _t, 8.8, ue(Et.ok, Et.n), !1, U),
          nt.text(Zt + 172, _t, 8.8, ue(Et.folga, Et.n), !1, U),
          nt.text(Zt + 222, _t, 8.8, ue(Et.folga5, Et.n), Et.folga5 / Et.n > 0.15, U),
          (_t -= 13.2));
      }
      _t -= 6;
      const De = [
        [[0.25, 0.45, 0.9], "pressão (AFO dentro da pele, mais de 0,3 mm)"],
        [[0.3, 0.67, 0.42], "contato, até 2,5 mm"],
        [[0.94, 0.77, 0.25], "folga de 2,5 a 5 mm"],
        [[0.86, 0.3, 0.25], "folga acima de 5 mm"],
      ];
      for (const [ae, Et] of De) (nt.rect(Zt, _t - 3, 9, 9, ae), nt.text(Zt + 14, _t, 8.4, Et, !1, U), (_t -= 12.5));
      _t -= 4;
      const Qt = [];
      for (const ae of ["perna", "calcanhar", "pé"]) {
        const Et = ot.st[ae];
        Et &&
          (Et.pres / Et.n > 0.03 && Qt.push("pressão no " + ae + ": use um alívio manual ou mais folga"),
          Et.folga5 / Et.n > 0.2 && ae !== "pé" && Qt.push("folga grande no " + ae + ": confira o scan ou a folga"));
      }
      for (const ae of Qt.slice(0, 3)) (nt.text(Zt, _t, 8, "• " + y(ae, 8, 250), !1, U), (_t -= 11));
      (nt.text(Zt, _t - 2, 7.6, "Inclui a folga geral e os alívios. Pressão no apoio plantar conta", !1, j),
        nt.text(Zt, _t - 12, 7.6, "como contato (é onde a criança pisa).", !1, j),
        (_t -= 10),
        (Z = Math.min(At - Vt - 28, _t - 18)));
    }
  }
  {
    const ot = safetyChecks();
    let At = Z - 4;
    const Vt = 30 + Math.max(1, ot.length) * 12;
    (At - Vt < 48 && ((nt = new PdfPage()), C.push(nt), (At = 780)),
      nt.text(36, At, 10.5, "Checagem de segurança", !0, W),
      (At -= 6),
      nt.line(36, At, 559, At, Q),
      (At -= 13),
      ot.length ||
        (nt.text(36, At, 8.8, "Nenhum problema encontrado pelas verificações automáticas.", !1, [0.15, 0.47, 0.31]),
        (At -= 12)));
    for (const oe of ot) {
      const It = oe.n === "alerta" ? [0.62, 0.18, 0.08] : oe.n === "info" ? j : [0.55, 0.33, 0.03];
      (nt.text(36, At, 8.6, oe.n === "alerta" ? "ALERTA" : oe.n === "info" ? "info" : "atenção", !0, It),
        nt.text(92, At, 8.6, y(oe.t, 8.6, 467), !1, U),
        (At -= 12));
    }
    Z = At - 8;
  }
  {
    const ot = (e.rivets ? e.rivets.length * 13.2 + 30 : 0) + 40;
    Z - ot < 48 &&
      ((nt = new PdfPage()),
      C.push(nt),
      nt.text(36, 800, 10, "EITA! AFO · " + y(T.pName || baseName(), 9, 300) + " (continuação)", !0, W),
      (Z = 780));
  }
  if (e.rivets && e.rivets.length) {
    let ot = Z - 4;
    const At = nt;
    (At.text(36, ot, 10.5, "Pontos de rebite (R1, R2… nas vistas)", !0, W),
      (ot -= 6),
      At.line(36, ot, 559, ot, Q),
      (ot -= 13),
      e.rivets.forEach((Vt, oe) => {
        const It = ot - oe * 13.2;
        (At.text(36, It, 8.8, "R" + (oe + 1) + " · " + Vt.name + ", " + Vt.lado, !0, U),
          At.text(
            200,
            It,
            8.8,
            rivetText(Vt) +
              " · " +
              (Vt.joint ? "eixo da articulação ± " + D(n.artGap / 2 + n.artArm, 1) + " mm" : Vt.edge + " mm da borda") +
              " · " +
              ((Vt.mode || n.rvMode) === "furo"
                ? "furo Ø" + D(Vt.d || n.rvD) + " mm"
                : "marca para broca Ø" + D(Vt.d || n.rvD) + " mm"),
            !1,
            j,
          ));
      }),
      (Z = ot - e.rivets.length * 13.2 - 6));
  }
  const ge = calibFit(),
    gt =
      "Estimativas geradas por modelo computacional a partir do scan. Confira a adaptação clínica antes da entrega; " +
      (ge
        ? "rigidez calibrada com " + ge.n + " AFOs ensaiadas em bancada."
        : "a rigidez não substitui ensaio de bancada.");
  {
    const ot = pairFicha(),
      At = ot && ot.resultado,
      Vt = shellStats();
    if (At && Vt) {
      Z - 95 < 48 &&
        nt === L &&
        ((nt = new PdfPage()),
        C.push(nt),
        nt.text(36, 800, 10, "EITA! AFO · " + y(T.pName || baseName(), 9, 300) + " (continuação)", !0, W),
        (Z = 780));
      let It = Z - 4;
      const Zt = sideLetter() === "D" ? "Direito (este)" : "Esquerdo (este)",
        Me = ot.lado === "D" ? "Direito" : "Esquerdo";
      (nt.text(36, It, 10.5, "Par de AFOs", !0, W), (It -= 6), nt.line(36, It, 559, It, Q), (It -= 13));
      const _t = [36, 230, 330, 430];
      (nt.text(_t[0], It, 8, "", !0, j),
        nt.text(_t[1], It, 8, Zt, !0, j),
        nt.text(_t[2], It, 8, Me, !0, j),
        nt.text(_t[3], It, 8, "Diferença", !0, j),
        (It -= 13));
      const ue = (De, Qt, ae, Et, Pt = 0) => {
        (nt.text(_t[0], It, 8.8, De, !1, U),
          nt.text(_t[1], It, 8.8, Qt == null ? "—" : D(Qt, Pt) + Et, !0, U),
          nt.text(_t[2], It, 8.8, ae == null ? "—" : D(ae, Pt) + Et, !1, U),
          nt.text(
            _t[3],
            It,
            8.8,
            Qt == null || ae == null ? "—" : (Qt - ae >= 0 ? "+" : "") + D(Qt - ae, Pt) + Et,
            !1,
            j,
          ),
          (It -= 13.2));
      };
      (ue("Massa estimada", Vt.massa_g, At.massa_g, " g"),
        ue("Espessura mínima", Vt.espMin_mm, At.espMin_mm, " mm", 1),
        ue("E·I da seção mais fraca", Vt.EI, At.EI, " N·m2", 1),
        nt.text(_t[0], It, 8.8, "Rigidez (classe)", !1, U),
        nt.text(_t[1], It, 8.8, Vt.rigidez || "—", !0, U),
        nt.text(_t[2], It, 8.8, At.rigidez || "—", !1, U),
        (It -= 13.2),
        (Z = It - 6));
    }
  }
  if (S.cmp) {
    const ot = S.cmp,
      At = cmpRows(ot),
      Vt = cmpAdvice(ot),
      oe = 28 + At.length * 13.2 + Vt.length * 12 + 40;
    Z - oe < 48 &&
      nt === L &&
      ((nt = new PdfPage()),
      C.push(nt),
      nt.text(36, 800, 10, "EITA! AFO · " + y(T.pName || baseName(), 9, 300) + " (continuação)", !0, W),
      (Z = 780));
    let It = Z - 4;
    (nt.text(36, It, 10.5, "Comparação com a AFO real escaneada", !0, W),
      (It -= 6),
      nt.line(36, It, 559, It, Q),
      (It -= 13),
      nt.text(
        36,
        It,
        8.8,
        "Peça: " +
          y(ot.nome, 8.8, 260) +
          " · alinhamento (mediana) " +
          D(ot.erroMediano, 2) +
          " mm · desvio absoluto médio " +
          D(ot.absMedia, 1) +
          " mm, P95 " +
          D(ot.absP95, 1) +
          " mm",
        !1,
        j,
      ),
      (It -= 15),
      nt.text(36, It, 8, "Região", !0, j),
      nt.text(260, It, 8, "Desvio médio (mm)", !0, j),
      nt.text(380, It, 8, "Faixa P5 a P95 (mm)", !0, j),
      (It -= 13));
    for (const Zt of At)
      (nt.text(36, It, 8.8, Zt[0], !1, U),
        nt.text(260, It, 8.8, Zt[1], !0, U),
        nt.text(380, It, 8.8, Zt[2], !1, U),
        (It -= 13.2));
    (nt.text(
      36,
      It,
      7.6,
      "Positivo = superfície real para fora do projeto (na face interna: mais justa na pele).",
      !1,
      j,
    ),
      (It -= 13));
    for (const Zt of Vt) (nt.text(36, It, 8.4, "• " + y(Zt, 8.4, 520), !1, U), (It -= 12));
    Z = It - 6;
  }
  nt.line(36, Z, 559, Z, Q);
  {
    const ot = gt.split(" ");
    let At = "";
    for (; ot.length && pdfW(At + " " + ot[0], 8) < 523; ) At += (At ? " " : "") + ot.shift();
    (nt.text(36, Z - 14, 8, At, !1, j), ot.length && nt.text(36, Z - 25, 8, y(ot.join(" "), 8, 523), !1, j));
  }
  (nt !== L && nt.text(36, 30, 7.5, "EITA! AFO · Lab.EITA / UFG", !1, j),
    L.text(
      36,
      30,
      7.5,
      "EITA! AFO · © 2026 Lab.EITA — Laboratório de Estudos Inventivos em Tecnologias Assistivas · Universidade Federal de Goiás · Autor: Pedro Henrique Gonçalves",
      !1,
      j,
    ));
  const Ut = makePDF(C, x);
  if (t) return Ut;
  const qt = await saveFile(baseName() + "_relatorio_AFO.pdf", Ut, "application/pdf");
  qt && ($("expnote").textContent = "Relatório salvo em " + qt + ".");
}
const ORIENT_TXT = {
  anat: "referencial anatômico (origem no tornozelo)",
  pe: "em pé, sola na mesa (Z = 0 na mesa)",
  deitada: "deitada, face posterior na mesa (Z = 0 na mesa)",
};
$("expPdf").onclick = () => buildReport();
let expForce = !1;
$("expAfo").onclick = async () => {
  if (!S.shell) return;
  const t = safetyChecks().filter((l) => l.n === "alerta");
  if (t.length && !expForce) {
    (($("expConfirm").innerHTML =
      `<div class="box"><b>${t.length} alerta(s) de segurança:</b><ul style="margin:4px 0 6px 16px;padding:0">${t.map((l) => "<li>" + l.t + "</li>").join("")}</ul><div class="row" style="gap:8px"><button type="button" id="expGo" class="primary">Exportar mesmo assim</button><button type="button" id="expNo">Voltar e ajustar</button></div></div>`),
      ($("expGo").onclick = () => {
        ((expForce = !0), ($("expConfirm").innerHTML = ""), $("expAfo").click());
      }),
      ($("expNo").onclick = () => {
        $("expConfirm").innerHTML = "";
      }));
    return;
  }
  ((expForce = !1), ($("expConfirm").innerHTML = ""));
  const e = $("orient") ? $("orient").value : "anat",
    n = stlAFO(S.shell.shell.V, S.shell.shell.F, printXf(e, S.shell.shell.V), "EITA AFO " + baseName()),
    o = await saveFile(baseName() + "_AFO.stl", n, "model/stl");
  o && S.shell.check && S.shell.check.n
    ? ($("expnote").innerHTML =
        '<b style="color:var(--warn)">STL salvo com ' +
        S.shell.check.n +
        " faces cruzadas</b> — confira no fatiador; ajuste os parâmetros e gere de novo se o fatiador acusar erro.")
    : o &&
      ($("expnote").textContent =
        "STL da AFO salvo em " +
        o +
        " (" +
        S.shell.log.tris.toLocaleString("pt-BR") +
        " triângulos)" +
        (/\.zip$/.test(o) ? " — descompacte para fatiar." : "."));
};
// Fichas no armazém do núcleo (nucleo/ficha.js; E4d), mesma chave e mesmos formatos da v0.14.
const FICHAS = EITA.criarArmazemFichas({
    chave: "eitaAFO.fichas.v1",
    formatoFicha: "EITA! AFO ficha",
    formatoBase: "EITA! AFO base",
    versaoApp: "0.14",
    prefixoBase: "base_EITA_AFO",
    rotulo: "EITA! AFO",
  }),
  shellInputIds = () =>
    Array.from(document.querySelectorAll("#s5 input[id],#s5 select[id],#s4 input[id],#orient"))
      .filter(
        (t) =>
          t.type !== "file" && !["showLimb", "contact", "autoGen", "devMap", "calM", "calA", "calLab"].includes(t.id),
      )
      .map((t) => t.id);
function readInputs() {
  const t = {};
  for (const e of shellInputIds()) {
    const n = $(e);
    t[e] = n.type === "checkbox" ? n.checked : n.value;
  }
  return t;
}
function writeInputs(t) {
  for (const [e, n] of Object.entries(t || {})) {
    const o = $(e);
    o && (o.type === "checkbox" ? (o.checked = !!n) : ((o.value = n), o._range && (o._range.value = n)));
  }
}
function shellStats() {
  if (!S.shell) return null;
  const t = S.shell.log,
    e = DENS[S.shell.params.mat] || 0.9;
  return {
    massa_g: +(t.volume * e).toFixed(0),
    volume_cm3: +t.volume.toFixed(1),
    espMin_mm: t.thick ? t.thick[0] : null,
    contato: t.contact ? +t.contact.ok.toFixed(3) : null,
    pressao: t.contact ? +t.contact.pressao.toFixed(3) : null,
    rigidez: t.stiff ? t.stiff.cls : null,
    EI: t.stiff ? t.stiff.EI : null,
    cruzamentos: t.check || 0,
  };
}
function fichaBase() {
  const t = (($("pId") && $("pId").value) || ($("pName") && $("pName").value) || "").trim();
  return t
    ? t
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    : "";
}
function fichaKey() {
  const t = fichaBase(),
    e = sideLetter();
  return t ? t + "_" + (e || "x") : (S.patient && S.patient.id) || "p" + Date.now().toString(36);
}
function pairFicha() {
  const t = fichaBase(),
    e = sideLetter();
  if (!t || !e) return null;
  const n = e === "D" ? "E" : "D";
  return FICHAS.listar().find((o) => o.id === t + "_" + n) || null;
}
function pairCopy() {
  const t = pairFicha();
  if (!t) {
    status("Não há ficha salva do outro lado para este paciente (mesmo nome ou prontuário, lado oposto).");
    return;
  }
  const e = ["pTop"],
    n = Object.assign({}, t.entradas || {});
  for (const o of e) delete n[o];
  (writeInputs(n),
    status(
      "Parâmetros da AFO do lado " +
        (t.lado === "D" ? "direito" : "esquerdo") +
        " aplicados (pontos, linha de corte e alívios continuam os deste lado).",
    ),
    window.__regenNow && S.shell && window.__regenNow());
}
function collectFicha() {
  const t = {};
  for (const e in S.L0) t[e] = V3.add(S.L0[e], S.offset).map((n) => +n.toFixed(3));
  return {
    formato: "EITA! AFO ficha",
    versaoApp: "0.14",
    id: fichaKey(),
    lado: sideLetter(),
    resultado: shellStats(),
    nome: $("pName").value.trim(),
    obs: $("pNotes").value,
    paciente: readPatient(),
    atualizado: new Date().toISOString(),
    scan: S.name,
    pontos: t,
    corrigido: !!S.corrected,
    entradas: readInputs(),
    linhaCorte: S.trimAdj,
    alivios: S.reliefs.map((e) => ({ p: V3.add(e.p, S.offset).map((n) => +n.toFixed(3)), d: e.d, r: e.r })),
    comparacao: S.cmp ? (({ dev: e, ...n }) => n)(S.cmp) : null,
    versoes: S.versions.map((e) => ({
      rotulo: e.label,
      data: e.date,
      entradas: e.inputs,
      linhaCorte: e.trimAdj,
      alivios: e.reliefs,
      resultado: e.stats,
    })),
  };
}
let delPend = null;
function renderFichas() {
  const t = $("fList");
  if (!t) return;
  const e = FICHAS.listar();
  if (!e.length) {
    t.innerHTML = '<div class="note">Nenhuma ficha salva neste navegador.</div>';
    return;
  }
  t.innerHTML = e
    .map(
      (n, o) =>
        `<div class="frow"><div><b>${esc(n.nome || "(sem nome)")}</b><small>${n.lado ? (n.lado === "D" ? "direito" : "esquerdo") + " · " : ""}${new Date(n.atualizado).toLocaleDateString("pt-BR")} · ${esc(n.scan || "")} · ${n.versoes ? n.versoes.length : 0} versões</small></div><button type="button" data-open="${o}">Abrir</button><button type="button" data-del="${o}" title="Excluir">${delPend === n.id ? "Confirmar" : "×"}</button></div>`,
    )
    .join("");
  for (const n of t.querySelectorAll("[data-open]")) n.onclick = () => openFicha(FICHAS.listar()[+n.dataset.open]);
  for (const n of t.querySelectorAll("[data-del]"))
    n.onclick = () => {
      // confirmação em dois cliques: dentro do claude.ai a página não pode abrir caixas de diálogo (confirm)
      const o = FICHAS.listar()[+n.dataset.del];
      if (delPend !== o.id) {
        delPend = o.id;
        renderFichas();
        status(`Clique em "Confirmar" para excluir a ficha "${esc(o.nome || "")}" deste navegador.`);
        setTimeout(() => {
          delPend === o.id && ((delPend = null), renderFichas());
        }, 5e3);
        return;
      }
      (FICHAS.excluir(+n.dataset.del), (delPend = null), renderFichas(), status("Ficha excluída deste navegador."));
    };
}
function saveFicha() {
  const t = collectFicha();
  if (!t.nome) {
    (status("Dê um nome ou identificação à ficha antes de salvar."), $("pName").focus());
    return;
  }
  S.patient = { id: t.id, name: t.nome };
  (status(
      FICHAS.salvar(t)
        ? 'Ficha "' + esc(t.nome) + '" salva neste navegador. Use "Exportar ficha" para guardar uma cópia em arquivo.'
        : 'Não foi possível salvar no navegador; use "Exportar ficha".',
    ),
    renderFichas());
}
async function exportFicha() {
  const t = collectFicha(),
    e = (t.nome || baseName()).replace(/[^\w\-]+/g, "_"),
    n = await saveFile(e + "_ficha_AFO.json", JSON.stringify(t, null, 1), "application/json");
  n && status("Ficha exportada em " + n + ".");
}
let pendingFicha = null;
function openFicha(t) {
  if (!FICHAS.ehFicha(t)) {
    status("Arquivo de ficha não reconhecido.");
    return;
  }
  if (
    (writePatient(t.paciente || { pName: t.nome || "", pNotes: t.obs || "" }),
    ($("pBadge").textContent = t.nome ? "· " + t.nome : ""),
    (S.patient = { id: t.id, name: t.nome }),
    (S.versions = (t.versoes || []).map((e) => ({
      label: e.rotulo,
      date: e.data,
      inputs: e.entradas,
      trimAdj: e.linhaCorte || null,
      reliefs: e.alivios || [],
      stats: e.resultado,
      mesh: null,
    }))),
    renderVersions(),
    !S.V || (t.scan && S.name !== t.scan))
  ) {
    ((pendingFicha = t),
      status(
        `Ficha "${esc(t.nome)}" aberta. Carregue o scan <b>${esc(t.scan || "")}</b> (etapa 1) para aplicar pontos e parâmetros.`,
      ));
    return;
  }
  applyFicha(t);
}
async function applyFicha(t) {
  ((pendingFicha = null), S.corrected && resetCorrection());
  for (const [e, n] of Object.entries(t.pontos || {})) window.AFO.setLandmark(e, n);
  (writeInputs(t.entradas),
    t.corrigido && applyCorrection(),
    (S.trimAdj = t.linhaCorte || null),
    (S.reliefs = (t.alivios || []).map((e) => ({ p: V3.sub(e.p, S.offset), d: e.d, r: e.r }))),
    renderReliefs(),
    trimInfo(),
    LM.every((e) => S.L[e.id]) && (await makeShell()),
    status(`Ficha "${esc(t.nome || "")}" aplicada: pontos, correção e parâmetros restaurados.`));
}
function renderVersions() {
  const t = $("vList");
  if (t) {
    if (!S.versions.length) {
      t.innerHTML = '<div class="note">Nenhuma versão guardada.</div>';
      return;
    }
    t.innerHTML = S.versions
      .map((e, n) => {
        const o = e.stats || {};
        return `<div class="frow${S.refIdx === n ? " sel" : ""}"><div><b>${esc(e.label)}</b><small>${new Date(e.date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · ${o.massa_g ?? "—"} g · ${o.rigidez || "—"}</small></div><button type="button" data-ov="${n}">${S.refIdx === n ? "Ocultar" : "Sobrepor"}</button><button type="button" data-rs="${n}">Restaurar</button></div>`;
      })
      .join("");
    for (const e of t.querySelectorAll("[data-ov]")) e.onclick = () => overlayVersion(+e.dataset.ov);
    for (const e of t.querySelectorAll("[data-rs]")) e.onclick = () => restoreVersion(+e.dataset.rs);
  }
}
function saveVersion() {
  if (!S.shell) {
    status("Gere a casca antes de guardar uma versão.");
    return;
  }
  const t = S.versions.length + 1;
  (S.versions.push({
    label: "V" + t,
    date: new Date().toISOString(),
    inputs: readInputs(),
    trimAdj: S.trimAdj ? S.trimAdj.map((e) => e.slice()) : null,
    reliefs: S.reliefs.map((e) => ({ p: V3.add(e.p, S.offset), d: e.d, r: e.r })),
    stats: shellStats(),
    mesh: { V: S.shell.shell.V, F: S.shell.shell.F },
  }),
    renderVersions(),
    status("Versão V" + t + " guardada. Salve a ficha para mantê-la depois de fechar a página."));
}
function setRef(t, e, n) {
  const o = S.frame,
    l = V3.cross(o.Y, o.Z),
    s = new Float32Array(t.V.length);
  for (let T = 0; T < s.length; T += 3) {
    const b = t.V[T],
      y = t.V[T + 1],
      L = t.V[T + 2];
    for (let C = 0; C < 3; C++) s[T + C] = o.AJC[C] + l[C] * b + o.Y[C] * y + o.Z[C] * L;
  }
  (gl.bindBuffer(gl.ARRAY_BUFFER, buf.rpos),
    gl.bufferData(gl.ARRAY_BUFFER, s, gl.STATIC_DRAW),
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.rnor),
    gl.bufferData(gl.ARRAY_BUFFER, normaisDeVertices(s, t.F), gl.STATIC_DRAW));
  const v = t.F instanceof Uint32Array ? t.F : Uint32Array.from(t.F);
  (gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.ridx), gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, v, gl.STATIC_DRAW));
  let h = 0;
  const u = t.V,
    x = v;
  for (let T = 0; T < x.length; T += 3) {
    const b = x[T] * 3,
      y = x[T + 1] * 3,
      L = x[T + 2] * 3;
    h +=
      (u[b] * (u[y + 1] * u[L + 2] - u[y + 2] * u[L + 1]) -
        u[b + 1] * (u[y] * u[L + 2] - u[y + 2] * u[L]) +
        u[b + 2] * (u[y] * u[L + 1] - u[y + 1] * u[L])) /
      6;
  }
  ((S.refShell = { nIdx: v.length, label: e, vol: Math.abs(h) / 1e3, stats: n }), refInfo(), draw());
}
function refInfo() {
  const t = $("refInfo");
  if (!t) return;
  if (!S.refShell) {
    t.textContent = "";
    return;
  }
  const e = S.refShell,
    n = S.shell ? S.shell.log.volume : null;
  t.innerHTML =
    `<span style="color:#e0892a">■</span> Referência: <b>${e.label}</b> · ${e.vol.toFixed(1)} cm³` +
    (n != null ? ` · atual ${n.toFixed(1)} cm³ (${n >= e.vol ? "+" : ""}${(n - e.vol).toFixed(1)})` : "");
}
async function overlayVersion(t) {
  if (S.refIdx === t) {
    ((S.refIdx = null), (S.refShell = null), refInfo(), renderVersions(), draw());
    return;
  }
  const e = S.versions[t];
  if (!e.mesh) {
    const n = readInputs(),
      o = S.trimAdj,
      l = S.reliefs;
    (writeInputs(e.inputs),
      (S.trimAdj = e.trimAdj),
      (S.reliefs = (e.reliefs || []).map((s) => ({ p: V3.sub(s.p, S.offset), d: s.d, r: s.r }))));
    try {
      const s = anatXf(),
        v = S.V.length / 3,
        h = new Float64Array(S.V.length);
      for (let b = 0; b < v; b++) {
        const y = s([S.V[b * 3], S.V[b * 3 + 1], S.V[b * 3 + 2]]);
        ((h[b * 3] = y[0]), (h[b * 3 + 1] = y[1]), (h[b * 3 + 2] = y[2]));
      }
      const u = {};
      for (const b in S.L) u[b] = s(S.L[b]);
      const x = shellParams();
      x.reliefs = S.reliefs.map((b) => ({ p: s(b.p), d: b.d, r: b.r }));
      const T = generateShell(h, S.F, u, x);
      e.mesh = { V: T.shell.V, F: T.shell.F };
    } finally {
      (writeInputs(n), (S.trimAdj = o), (S.reliefs = l));
    }
  }
  ((S.refIdx = t), setRef(e.mesh, e.label, e.stats), renderVersions());
}
async function restoreVersion(t) {
  const e = S.versions[t];
  (writeInputs(e.inputs),
    (S.trimAdj = e.trimAdj ? e.trimAdj.map((n) => n.slice()) : null),
    (S.reliefs = (e.reliefs || []).map((n) => ({ p: V3.sub(n.p, S.offset), d: n.d, r: n.r }))),
    renderReliefs(),
    trimInfo(),
    await makeShell(),
    status("Versão " + e.label + " restaurada."));
}
async function loadRefStl(t) {
  try {
    const e = await t.arrayBuffer(),
      n = lerSTL(e),
      o = soldar(n);
    if (!S.frame) {
      status("Marque os pontos antes de carregar uma AFO de referência.");
      return;
    }
    ((S.refIdx = null),
      setRef({ V: o.V, F: o.F }, t.name, null),
      renderVersions(),
      status(
        'AFO de referência carregada. Ela precisa estar no referencial anatômico (exportação padrão "Referencial anatômico").',
      ));
  } catch (e) {
    status("Não foi possível ler o STL de referência: " + (e.message || e));
  }
}
function jacobiEig(t) {
  const e = t.length,
    n = t.map((v) => v.slice()),
    o = Array.from({ length: e }, (v, h) => Array.from({ length: e }, (u, x) => (h === x ? 1 : 0)));
  for (let v = 0; v < 60; v++) {
    let h = 0;
    for (let u = 0; u < e; u++) for (let x = u + 1; x < e; x++) h += n[u][x] * n[u][x];
    if (h < 1e-18) break;
    for (let u = 0; u < e; u++)
      for (let x = u + 1; x < e; x++) {
        if (Math.abs(n[u][x]) < 1e-30) continue;
        const T = (n[x][x] - n[u][u]) / (2 * n[u][x]),
          b = Math.sign(T || 1) / (Math.abs(T) + Math.sqrt(T * T + 1)),
          y = 1 / Math.sqrt(b * b + 1),
          L = b * y;
        for (let C = 0; C < e; C++) {
          const W = n[C][u],
            U = n[C][x];
          ((n[C][u] = y * W - L * U), (n[C][x] = L * W + y * U));
        }
        for (let C = 0; C < e; C++) {
          const W = n[u][C],
            U = n[x][C];
          ((n[u][C] = y * W - L * U), (n[x][C] = L * W + y * U));
        }
        for (let C = 0; C < e; C++) {
          const W = o[C][u],
            U = o[C][x];
          ((o[C][u] = y * W - L * U), (o[C][x] = L * W + y * U));
        }
      }
  }
  const l = n.map((v, h) => v[h]),
    s = l.map((v, h) => h).sort((v, h) => l[h] - l[v]);
  return { val: s.map((v) => l[v]), vec: s.map((v) => o.map((h) => h[v])) };
}
function fitSim(t, e, n) {
  const o = t.length;
  let l = [0, 0, 0],
    s = [0, 0, 0];
  for (let Bt = 0; Bt < o; Bt++) for (let wt = 0; wt < 3; wt++) ((l[wt] += t[Bt][wt] / o), (s[wt] += e[Bt][wt] / o));
  const v = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  let h = 0;
  for (let Bt = 0; Bt < o; Bt++) {
    const wt = V3.sub(t[Bt], l),
      Kt = V3.sub(e[Bt], s);
    h += V3.dot(wt, wt) / o;
    for (let Gt = 0; Gt < 3; Gt++) for (let nt = 0; nt < 3; nt++) v[Gt][nt] += (wt[Gt] * Kt[nt]) / o;
  }
  const [[u, x, T], [b, y, L], [C, W, U]] = v,
    j = [
      [u + y + U, L - W, C - T, x - b],
      [L - W, u - y - U, x + b, C + T],
      [C - T, x + b, -u + y - U, L + W],
      [x - b, C + T, L + W, -u - y + U],
    ],
    Q = jacobiEig(j),
    [G, O, B, Z] = Q.vec[0],
    rt = [
      [G * G + O * O - B * B - Z * Z, 2 * (O * B - G * Z), 2 * (O * Z + G * B)],
      [2 * (O * B + G * Z), G * G - O * O + B * B - Z * Z, 2 * (B * Z - G * O)],
      [2 * (O * Z - G * B), 2 * (B * Z + G * O), G * G - O * O - B * B + Z * Z],
    ];
  let D = 1;
  if (n) {
    let Bt = 0;
    for (let wt = 0; wt < o; wt++) {
      const Kt = V3.sub(t[wt], l),
        Gt = V3.sub(e[wt], s);
      Bt += V3.dot(Gt, matV(rt, Kt)) / o;
    }
    ((D = Bt / h), (D > 0.8 && D < 1.25) || (D = 1));
  }
  const kt = V3.sub(s, V3.mul(matV(rt, l), D));
  return { R: rt, s: D, t: kt };
}
function matV(t, e) {
  return [
    t[0][0] * e[0] + t[0][1] * e[1] + t[0][2] * e[2],
    t[1][0] * e[0] + t[1][1] * e[1] + t[1][2] * e[2],
    t[2][0] * e[0] + t[2][1] * e[1] + t[2][2] * e[2],
  ];
}
function matM(t, e) {
  return t.map((n) => [0, 1, 2].map((o) => n[0] * e[0][o] + n[1] * e[1][o] + n[2] * e[2][o]));
}
function compose(t, e) {
  return { R: matM(t.R, e.R), s: t.s * e.s, t: V3.add(V3.mul(matV(t.R, e.t), t.s), t.t) };
}
function applyT(t, e) {
  return V3.add(V3.mul(matV(t.R, e), t.s), t.t);
}
function alignScan(t, e, n = {}) {
  const o = (G, O) => {
    const B = G.length / 3,
      Z = Math.max(1, Math.floor(B / O)),
      rt = [];
    for (let D = 0; D < B; D += Z) rt.push([G[D * 3], G[D * 3 + 1], G[D * 3 + 2]]);
    return rt;
  };
  let l = t,
    s = null;
  if (n.F) {
    const G = n.F,
      O = G.length / 3,
      B = new Float64Array(t.length + O * 3),
      Z = normaisDeVertices(t, G);
    ((s = new Float32Array(B.length)), s.set(Z), B.set(t));
    for (let rt = 0; rt < O; rt++) {
      const D = G[rt * 3] * 3,
        kt = G[rt * 3 + 1] * 3,
        Bt = G[rt * 3 + 2] * 3;
      for (let nt = 0; nt < 3; nt++) B[t.length + rt * 3 + nt] = (t[D + nt] + t[kt + nt] + t[Bt + nt]) / 3;
      const wt = [t[kt] - t[D], t[kt + 1] - t[D + 1], t[kt + 2] - t[D + 2]],
        Kt = [t[Bt] - t[D], t[Bt + 1] - t[D + 1], t[Bt + 2] - t[D + 2]],
        Gt = V3.norm(V3.cross(wt, Kt));
      ((s[t.length + rt * 3] = Gt[0]), (s[t.length + rt * 3 + 1] = Gt[1]), (s[t.length + rt * 3 + 2] = Gt[2]));
    }
    l = B;
  }
  const v = nnGrid(l, 3),
    h = o(t, 6e3),
    u = o(e, 700),
    x = o(e, 2500),
    T = (G) => {
      const O = G.length;
      let B = [0, 0, 0];
      for (const D of G) for (let kt = 0; kt < 3; kt++) B[kt] += D[kt] / O;
      const Z = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];
      for (const D of G) {
        const kt = V3.sub(D, B);
        for (let Bt = 0; Bt < 3; Bt++) for (let wt = 0; wt < 3; wt++) Z[Bt][wt] += (kt[Bt] * kt[wt]) / O;
      }
      const rt = jacobiEig(Z);
      return { m: B, ax: rt.vec, val: rt.val };
    },
    b = T(h),
    y = T(o(e, 6e3)),
    L = (G, O, B, Z, rt, D, kt = !0) => {
      let Bt = G,
        wt = 0;
      for (let Kt = 0; Kt < B; Kt++) {
        const Gt = [];
        for (const gt of O) {
          const Ut = applyT(Bt, gt),
            [qt, ot] = v(Ut[0], Ut[1], Ut[2], D);
          if (qt >= 0) {
            let At = [l[qt * 3], l[qt * 3 + 1], l[qt * 3 + 2]];
            if (s && Kt >= 2 && kt) {
              const Vt = [s[qt * 3], s[qt * 3 + 1], s[qt * 3 + 2]];
              At = V3.sub(Ut, V3.mul(Vt, V3.dot(V3.sub(Ut, At), Vt)));
            }
            Gt.push([ot, Ut, At]);
          }
        }
        if (Gt.length < 20) return { T: Bt, err: 1e9 };
        Gt.sort((gt, Ut) => gt[0] - Ut[0]);
        const nt = Gt.slice(0, Math.max(10, Math.floor(Gt.length * Z)));
        wt = nt[Math.floor(nt.length / 2)][0];
        const ge = fitSim(
          nt.map((gt) => gt[1]),
          nt.map((gt) => gt[2]),
          rt && Kt >= B / 3,
        );
        if (((Bt = compose(ge, Bt)), wt < 1e-9)) break;
      }
      return { T: Bt, err: wt };
    },
    C = (G) =>
      G[0][0] * (G[1][1] * G[2][2] - G[1][2] * G[2][1]) -
      G[0][1] * (G[1][0] * G[2][2] - G[1][2] * G[2][0]) +
      G[0][2] * (G[1][0] * G[2][1] - G[1][1] * G[2][0]),
    W = [];
  for (const G of [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [-1, -1, -1],
    [-1, 1, 1],
    [1, -1, 1],
    [1, 1, -1],
  ]) {
    const O = y.ax.map((rt, D) => V3.mul(rt, G[D])),
      B = b.ax,
      Z = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];
    for (let rt = 0; rt < 3; rt++)
      for (let D = 0; D < 3; D++) for (let kt = 0; kt < 3; kt++) Z[D][kt] += B[rt][D] * O[rt][kt];
    C(Z) < 0 || W.push(L({ R: Z, s: 1, t: V3.sub(b.m, matV(Z, y.m)) }, u, 25, 0.7, !1, 40));
  }
  (n.T0 && W.push(L(n.T0, u, 10, 0.7, !1, 20)), W.sort((G, O) => G.err - O.err));
  const U = (G, O) => {
      const B = Math.cos(O),
        Z = Math.sin(O),
        [rt, D, kt] = G;
      return [
        [B + rt * rt * (1 - B), rt * D * (1 - B) - kt * Z, rt * kt * (1 - B) + D * Z],
        [D * rt * (1 - B) + kt * Z, B + D * D * (1 - B), D * kt * (1 - B) - rt * Z],
        [kt * rt * (1 - B) - D * Z, kt * D * (1 - B) + rt * Z, B + kt * kt * (1 - B)],
      ];
    },
    j = (G) => {
      const O = L(G, x, 30, 0.9, !1, 8),
        B = L(O.T, x, 25, 0.9, !1, 8, !1);
      return B.err <= O.err ? B : O;
    };
  let Q = null;
  for (const G of W.slice(0, 2).filter((O, B) => B === 0 || O.err < 1.6 * W[0].err)) {
    let O = j(L(G.T, u, 15, 0.8, !1, 15).T);
    for (let B = 0; B < 3; B++) {
      let Z = !1;
      for (const rt of [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ])
        for (const D of [-0.07, 0.07]) {
          const kt = U(rt, D),
            Bt = { R: kt, s: 1, t: V3.sub(b.m, matV(kt, b.m)) },
            wt = L(compose(Bt, O.T), x, 8, 0.9, !1, 8, !1);
          wt.err < O.err * 0.97 && ((O = wt), (Z = !0));
        }
      for (const rt of [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ])
        for (const D of [-2, 2]) {
          const kt = {
              R: [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1],
              ],
              s: 1,
              t: V3.mul(rt, D),
            },
            Bt = L(compose(kt, O.T), x, 8, 0.9, !1, 8, !1);
          Bt.err < O.err * 0.97 && ((O = Bt), (Z = !0));
        }
      if (!Z) break;
    }
    (n.dbg && console.log("cand", G.err, "->", O.err), (!Q || O.err < Q.err) && (Q = O));
  }
  return (n.scale && (Q = L(Q.T, x, 30, 0.9, !0, 8, !1)), Q);
}
function compareReal(t, e, n) {
  if (!S.shell) {
    status("Gere a casca antes de comparar com a AFO real.");
    return;
  }
  S.cmpSrc = { V: t, F: e, name: n };
  const o = S.shell,
    l = o.shell.V,
    s = alignScan(l, t, { F: o.shell.F, T0: S.cmpT || null }),
    v = s.T;
  S.cmpT = v;
  const h = new Float64Array(t.length);
  for (let j = 0; j < t.length; j += 3) {
    const Q = applyT(v, [t[j], t[j + 1], t[j + 2]]);
    ((h[j] = Q[0]), (h[j + 1] = Q[1]), (h[j + 2] = Q[2]));
  }
  const u = nnGrid(h, 3),
    x = normaisDeVertices(l, o.shell.F),
    T = l.length / 3,
    b = new Float32Array(T).fill(-999),
    y = o.grid.NI * o.grid.NJ,
    L = {},
    C = (j, Q) => {
      (L[j] = L[j] || []).push(Q);
    };
  for (let j = 0; j < T; j++) {
    const Q = [l[j * 3], l[j * 3 + 1], l[j * 3 + 2]],
      [G, O] = u(Q[0], Q[1], Q[2], 8);
    if (G < 0 || O > 6) continue;
    const B = [x[j * 3], x[j * 3 + 1], x[j * 3 + 2]],
      Z = [h[G * 3], h[G * 3 + 1], h[G * 3 + 2]],
      rt = V3.dot(V3.sub(Z, Q), B);
    if (((b[j] = rt), j < 2 * y)) {
      const D = j < y ? "ext" : "int",
        kt = Q[2],
        Bt = Q[1],
        wt = kt > 30 ? "perna" : Bt < 25 ? "calcanhar" : "pé";
      (C(D + ":" + wt, rt), C(D, rt), C("all", Math.abs(rt)));
    }
  }
  const W = (j) => {
      if (!j || !j.length) return null;
      const Q = j.slice().sort((O, B) => O - B),
        G = j.reduce((O, B) => O + B, 0) / j.length;
      return {
        n: j.length,
        media: +G.toFixed(2),
        p5: +Q[Math.floor(0.05 * (Q.length - 1))].toFixed(2),
        p95: +Q[Math.floor(0.95 * (Q.length - 1))].toFixed(2),
      };
    },
    U = {
      nome: n,
      escala: +(1 / v.s).toFixed(4),
      erroMediano: +s.err.toFixed(2),
      cobertura: +(Array.from(b).filter((j) => j > -900).length / T).toFixed(3),
      regioes: {},
    };
  for (const j in L) j !== "all" && (U.regioes[j] = W(L[j]));
  return (
    (U.absP95 = W(L.all) ? W(L.all).p95 : null),
    (U.absMedia = W(L.all) ? W(L.all).media : null),
    (S.cmp = { ...U, dev: b }),
    (S.refIdx = null),
    setRef({ V: Float32Array.from(h), F: e }, n + " (alinhada)", null),
    renderVersions(),
    uploadDev(),
    ($("devMap").checked = !0),
    ($("contact").checked = !1),
    renderCmp(),
    draw(),
    status('AFO real alinhada ao modelo. Veja o mapa de desvio e a tabela em "Versões e comparação".'),
    U
  );
}
function uploadDev() {
  if (!S.shell || !S.cmp || !S.cmp.dev) return;
  const t = S.shell.dispMap,
    e = S.cmp.dev;
  let n = e;
  (t && ((n = new Float32Array(e.length + t.length)), n.set(e), t.forEach((o, l) => (n[e.length + l] = e[o]))),
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.adev),
    gl.bufferData(gl.ARRAY_BUFFER, n, gl.STATIC_DRAW));
}
function cmpRows(t) {
  const e = (l) => {
      if (l == null) return "—";
      const s = Math.round(l * 10) / 10 || 0;
      return (s > 0 ? "+" : "") + s.toFixed(1).replace(".", ",");
    },
    n = t.regioes,
    o = (l, s) => (n[s] ? [l, e(n[s].media), e(n[s].p5) + " a " + e(n[s].p95)] : null);
  return [
    o("Face interna · perna", "int:perna"),
    o("Face interna · calcanhar", "int:calcanhar"),
    o("Face interna · pé", "int:pé"),
    o("Face externa · perna", "ext:perna"),
    o("Face externa · calcanhar", "ext:calcanhar"),
    o("Face externa · pé", "ext:pé"),
  ].filter(Boolean);
}
function cmpAdvice(t) {
  const e = t.regioes,
    n = [],
    o = (v) => (e[v] ? e[v].media : null);
  for (const [v, h] of [
    ["int:perna", "perna"],
    ["int:calcanhar", "calcanhar"],
    ["int:pé", "pé"],
  ]) {
    const u = o(v);
    u != null &&
      (u > 0.6 &&
        n.push(
          `face interna do ${h} ${u.toFixed(1).replace(".", ",")} mm para dentro (mais justa que o projeto) — aumente a folga nessa região`,
        ),
      u < -0.6 &&
        n.push(
          `face interna do ${h} ${(-u).toFixed(1).replace(".", ",")} mm para fora (mais folgada) — reduza a folga nessa região`,
        ));
  }
  const l = e["ext:perna"],
    s = e["int:perna"];
  return (
    l &&
      s &&
      l.media < -0.4 &&
      s.media > 0.4 &&
      n.push(
        "as faces externa e interna da perna se deslocaram para o centro — sinal de contração do material na impressão; compense com escala no fatiador (ex.: 101–102 % no PP) ou mais folga",
      ),
    n
  );
}
function renderCmp() {
  const t = $("cmpInfo");
  if (!t) return;
  const e = S.cmp;
  if (!e) {
    ((t.innerHTML = ""), ($("devLegend").style.display = "none"));
    return;
  }
  ((t.innerHTML =
    `<table class="m"><tr><td>Peça real</td><td>${e.nome.replace(/</g, "&lt;")}</td></tr><tr><td>Erro do alinhamento (mediana)</td><td>${e.erroMediano.toFixed(2).replace(".", ",")} mm</td></tr><tr><td>Desvio absoluto médio / P95</td><td>${(e.absMedia ?? 0).toFixed(1).replace(".", ",")} / ${(e.absP95 ?? 0).toFixed(1).replace(".", ",")} mm</td></tr>` +
    cmpRows(e)
      .map((n) => `<tr><td>${n[0]}</td><td>${n[1]} mm <small>(${n[2]})</small></td></tr>`)
      .join("") +
    "</table>" +
    (cmpAdvice(e).length
      ? '<div class="note"><b>Sugestões:</b><ul style="margin:4px 0 0 16px;padding:0">' +
        cmpAdvice(e)
          .map((n) => "<li>" + n + "</li>")
          .join("") +
        "</ul></div>"
      : '<div class="note" style="color:var(--ok)">✓ Peça real dentro de ±0,6 mm do projeto em média.</div>')),
    ($("devLegend").style.display = $("devMap").checked ? "block" : "none"));
}
async function loadRealAfo(t) {
  try {
    if (!S.shell) {
      status("Gere a casca antes de comparar com a AFO real.");
      return;
    }
    (status("Alinhando a AFO real ao modelo…"), await new Promise((o) => setTimeout(o, 30)));
    const e = lerSTL(await t.arrayBuffer()),
      n = soldar(e);
    compareReal(n.V, n.F, t.name);
  } catch (e) {
    status("Não foi possível comparar: " + (e.message || e));
  }
}
const CAL_KEY = "eitaAFO.calib.v1";
function calibList() {
  try {
    return JSON.parse(localStorage.getItem(CAL_KEY) || "[]");
  } catch {
    return [];
  }
}
function calibStore(t) {
  try {
    localStorage.setItem(CAL_KEY, JSON.stringify(t));
  } catch {}
}
function calibFit(t = calibList()) {
  const e = t.filter((x) => x.EI > 0 && x.K > 0);
  if (e.length < 2) return null;
  const n = e.reduce((x, T) => x + Math.log(T.K / T.EI), 0) / e.length,
    o = Math.exp(n),
    l = e.map((x) => x.K / (o * x.EI) - 1),
    s = Math.sqrt(l.reduce((x, T) => x + T * T, 0) / Math.max(1, e.length - 1)),
    v = e.reduce((x, T) => x + T.K, 0) / e.length,
    h = e.reduce((x, T) => x + (T.K - v) ** 2, 0),
    u = e.reduce((x, T) => x + (T.K - o * T.EI) ** 2, 0);
  return { c: o, n: e.length, rms: s, r2: h > 0 ? 1 - u / h : null };
}
function stiffEstimate(t) {
  const e = calibFit();
  if (!e || !(t > 0)) return null;
  const n = e.c * t,
    o = Math.max(e.rms, 0.1);
  return { K: n, lo: n * (1 - o), hi: n * (1 + o), n: e.n, rms: e.rms };
}
function renderCalib() {
  const t = $("calList");
  if (!t) return;
  const e = calibList(),
    n = calibFit(e);
  t.innerHTML =
    (e.length
      ? '<table class="m">' +
        e
          .map(
            (o, l) =>
              `<tr><td>${(o.rotulo || "AFO " + (l + 1)).replace(/</g, "&lt;")}<small> · E·I ${o.EI.toFixed(1).replace(".", ",")}</small></td><td>${o.K.toFixed(2).replace(".", ",")} N·m/° <button type="button" class="mini" data-cdel="${l}" title="Excluir">×</button></td></tr>`,
          )
          .join("") +
        "</table>"
      : '<div class="note">Nenhuma medição de bancada registrada.</div>') +
    (n
      ? `<div class="note">Modelo calibrado com ${n.n} AFOs: K = ${n.c.toFixed(4).replace(".", ",")} × E·I · erro típico ±${Math.round(n.rms * 100)}%${n.r2 != null ? " · R² " + n.r2.toFixed(2).replace(".", ",") : ""}${n.n < 4 ? " — use pelo menos 4 AFOs para uma estimativa confiável." : ""}</div>`
      : '<div class="note">Registre ao menos 2 AFOs medidas para calibrar.</div>');
  for (const o of t.querySelectorAll("[data-cdel]"))
    o.onclick = () => {
      const l = calibList();
      (l.splice(+o.dataset.cdel, 1), calibStore(l), renderCalib(), S.shell && showStiff());
    };
}
function calibAdd() {
  if (!S.shell || !S.shell.log.stiff || !(S.shell.log.stiff.EI > 0)) {
    status("Gere a casca da AFO que foi medida em bancada antes de registrar.");
    return;
  }
  const t = +$("calM").value,
    e = +$("calA").value;
  if (!(t > 0) || !(e > 0)) {
    status("Informe o momento (N·m) e o ângulo (°) medidos.");
    return;
  }
  const n = calibList();
  (n.push({
    rotulo: ($("calLab").value || $("pId").value || $("pName").value || baseName()).trim(),
    EI: S.shell.log.stiff.EI,
    K: t / e,
    M: t,
    ang: e,
    mat: S.shell.params.mat,
    t: S.shell.params.t,
    data: new Date().toISOString(),
  }),
    calibStore(n),
    ($("calM").value = ""),
    ($("calA").value = ""),
    ($("calLab").value = ""),
    renderCalib(),
    showStiff(),
    status("Medição registrada na calibração."));
}
async function calibExport() {
  const t = await saveFile(
    "calibracao_rigidez_AFO.json",
    JSON.stringify({ formato: "EITA! AFO calibração", medicoes: calibList() }, null, 1),
    "application/json",
  );
  t && status("Calibração exportada em " + t + ".");
}
async function calibImport(t) {
  try {
    const e = JSON.parse(await t.text());
    if (e.formato !== "EITA! AFO calibração") throw new Error("arquivo não reconhecido");
    const n = calibList();
    for (const o of e.medicoes || []) n.some((l) => l.data === o.data && l.EI === o.EI) || n.push(o);
    (calibStore(n), renderCalib(), showStiff(), status("Calibração importada: " + n.length + " medições."));
  } catch (e) {
    status("Não foi possível importar: " + e.message);
  }
}
function showStiff() {
  const t = $("stiffEst");
  if (!t) return;
  const e = S.shell && S.shell.log.stiff;
  if (!e) {
    t.textContent = "";
    return;
  }
  if (!(e.EI > 0)) {
    t.textContent =
      "AFO articulada: a rigidez depende da articulação usada (dorsiflexão livre, batente em flexão plantar).";
    return;
  }
  const n = stiffEstimate(e.EI);
  t.innerHTML = n
    ? `Esta AFO: <b>${n.K.toFixed(2).replace(".", ",")} N·m/°</b> (faixa ${n.lo.toFixed(2).replace(".", ",")}–${n.hi.toFixed(2).replace(".", ",")}) · classe ${e.cls}`
    : `Esta AFO: E·I ${e.EI.toFixed(1).replace(".", ",")} N·m² · classe ${e.cls} (sem calibração, só a classe)`;
}
const PRESETS = {
  padrao: {
    nome: "AFO rígida — marcha (padrão)",
    v: {
      pT: 4,
      pTA: 1,
      pClr: 1,
      pRel: 3,
      pThA: 60,
      pThC: 95,
      pHH: 30,
      pHF: 14,
      pHT: 3,
      pArch: 50,
      pPM: 3,
      pTipM: 8,
      pFl: 2,
    },
  },
  reforcada: {
    nome: "AFO rígida reforçada (criança maior / espasticidade)",
    v: {
      pT: 5,
      pTA: 1.5,
      pClr: 1,
      pRel: 3.5,
      pThA: 55,
      pThC: 90,
      pHH: 34,
      pHF: 16,
      pHT: 4,
      pArch: 60,
      pPM: 3,
      pTipM: 8,
      pFl: 2,
    },
  },
  leve: {
    nome: "AFO rígida leve (criança pequena)",
    v: {
      pT: 3,
      pTA: 1,
      pClr: 1,
      pRel: 2.5,
      pThA: 65,
      pThC: 95,
      pHH: 26,
      pHF: 12,
      pHT: 3,
      pArch: 50,
      pPM: 2,
      pTipM: 6,
      pFl: 1.5,
    },
  },
  noturna: {
    nome: "AFO de posicionamento (noturna)",
    v: {
      pT: 4,
      pTA: 0.5,
      pClr: 1.5,
      pRel: 3,
      pThA: 70,
      pThC: 100,
      pHH: 32,
      pHF: 16,
      pHT: 5,
      pArch: 40,
      pPM: 4,
      pTipM: 10,
      pFl: 2.5,
    },
  },
};
function applyPreset(t) {
  const e = PRESETS[t];
  e &&
    (writeInputs(e.v),
    status("Predefinição aplicada: " + e.nome + ". Confira e ajuste para o paciente."),
    window.__regenNow && S.shell && window.__regenNow());
}
function checkLandmarks() {
  const t = $("lmCheck");
  if (!t) return;
  if (!S.frame || !LM.every((b) => S.L[b.id])) {
    t.innerHTML = "";
    return;
  }
  const e = S.L,
    n = S.frame,
    o = n.Z,
    l = n.Y,
    s = [],
    v = (b, y) => V3.len(V3.sub(b, y)),
    h = V3.sub(e.ML, e.MM),
    u = V3.len(V3.rej(h, o));
  ((u < 25 || u > 110) && s.push(`distância entre maléolos de ${u.toFixed(0)} mm (esperado 25–110)`),
    V3.dot(V3.sub(e.MM, e.ML), o) < -15 &&
      s.push("o maléolo medial está mais de 15 mm abaixo do lateral (normalmente é o contrário)"));
  const x = V3.mid(e.M1, e.M5);
  (V3.dot(V3.sub(x, e.CA), l) < 40 && s.push("M1/M5 muito perto do calcâneo"),
    V3.dot(V3.sub(e.CA, V3.mid(e.ML, e.MM)), o) > -15 &&
      s.push("CA não está abaixo dos maléolos — confira se foi marcado na planta do calcanhar"),
    V3.dot(V3.sub(e.PX, V3.mid(e.ML, e.MM)), o) < 40 &&
      s.push("PX está baixo demais (marque perto do topo do scan, na frente da perna)"),
    V3.dot(V3.sub(e.M1, e.M5), h) > 0 && s.push("M1 e M5 parecem trocados (M1 deve ficar do lado do maléolo medial)"),
    v(e.M1, e.M5) < 15 && s.push("M1 e M5 quase no mesmo lugar"),
    (t.innerHTML = s.length
      ? '<div class="warnbox"><b>Confira os pontos:</b><ul>' +
        s.map((b) => "<li>" + b + "</li>").join("") +
        "</ul></div>"
      : '<div class="note" style="color:var(--ok)">✓ Pontos coerentes entre si.</div>'));
}
let shellWorker = null,
  workerOK = null,
  workerSeq = 0;
const workerWait = new Map();
function makeWorker() {
  if (workerOK === !1) return null;
  if (shellWorker) return shellWorker;
  try {
    const e = EITA.afo.textoDoWorker(),
      n = new Worker(URL.createObjectURL(new Blob([e], { type: "text/javascript" })));
    return (
      (n.onmessage = (o) => {
        const { id: l, R: s, err: v } = o.data,
          h = workerWait.get(l);
        h && (workerWait.delete(l), v ? h.rej(new Error(v)) : h.res(s));
      }),
      (n.onerror = (o) => {
        workerOK = !1;
        for (const l of workerWait.values()) l.rej(new Error("worker"));
        workerWait.clear();
        try {
          n.terminate();
        } catch {}
        shellWorker = null;
      }),
      (shellWorker = n),
      n
    );
  } catch {
    return ((workerOK = !1), null);
  }
}
async function generateShellAsync(t, e, n, o) {
  const l = makeWorker();
  if (l)
    try {
      const s = ++workerSeq,
        v = await new Promise((h, u) => {
          (workerWait.set(s, { res: h, rej: u }), l.postMessage({ id: s, A: t, F: e, L: n, P: o }));
        });
      return ((workerOK = !0), v);
    } catch (s) {
      if (workerOK !== !0 || /worker/.test(s.message)) workerOK = !1;
      else throw s;
    }
  return generateShell(t, e, n, o);
}
function anatInv(t) {
  return deAnatomico(S.frame, t);
}
function pressureClusters() {
  const t = S.shell;
  if (!t || !t.grid || !t.heat) return [];
  const { NI: e, NJ: n, In: o } = t.grid,
    l = e * n,
    s = t.heat,
    v = -0.3,
    h = (y) => [o[y * 3], o[y * 3 + 1], o[y * 3 + 2]],
    u = (y, L) => {
      const C = Math.max(0, y - 1),
        W = Math.min(e - 1, y + 1),
        U = Math.max(0, L - 1),
        j = Math.min(n - 1, L + 1);
      return V3.norm(V3.cross(V3.sub(h(W * n + L), h(C * n + L)), V3.sub(h(y * n + j), h(y * n + U))));
    },
    x = new Uint8Array(l);
  for (let y = 2; y < e - 2; y++)
    for (let L = 2; L < n - 2; L++) {
      const C = y * n + L;
      s[l + C] < v && s[l + C] > -50 && ((Math.abs(u(y, L)[2]) > 0.75 && o[C * 3 + 2] < -20) || (x[C] = 1));
    }
  const T = new Uint8Array(l),
    b = [];
  for (let y = 0; y < l; y++) {
    if (!x[y] || T[y]) continue;
    const L = [y],
      C = [];
    for (T[y] = 1; L.length; ) {
      const O = L.pop();
      C.push(O);
      const B = Math.floor(O / n),
        Z = O % n;
      for (const [rt, D] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
      ]) {
        const kt = B + rt,
          Bt = Z + D;
        if (kt < 0 || Bt < 0 || kt >= e || Bt >= n) continue;
        const wt = kt * n + Bt;
        x[wt] && !T[wt] && ((T[wt] = 1), L.push(wt));
      }
    }
    if (C.length < 3) continue;
    let W = 0,
      U = [0, 0, 0],
      j = 0,
      Q = C[0];
    for (const O of C) {
      const B = -s[l + O];
      ((W += B), (U = V3.add(U, V3.mul(h(O), B))), s[l + O] < j && ((j = s[l + O]), (Q = O)));
    }
    U = V3.mul(U, 1 / W);
    let G = 0;
    for (const O of C) G = Math.max(G, V3.len(V3.sub(h(O), U)));
    b.push({ c: U, worst: j, n: C.length, ext: G, z: U[2], y: U[1] });
  }
  return b.sort((y, L) => y.worst - L.worst);
}
async function autoRelief() {
  if (!S.shell) {
    status("Gere a casca antes.");
    return;
  }
  let t = 0;
  for (let n = 0; n < 3; n++) {
    const o = pressureClusters();
    if (!o.length) break;
    for (const l of o.slice(0, 8)) {
      const s = anatInv(l.c),
        v = V3.sub(s, [0, 0, 0]),
        h = S.reliefs.find((x) => V3.len(V3.sub(x.p, v)) < Math.max(8, x.r * 0.6)),
        u = Math.min(5, Math.ceil((-l.worst + 0.8) * 2) / 2);
      h
        ? ((h.d = Math.min(8, +(h.d + u * 0.6).toFixed(1))),
          (h.r = Math.min(35, Math.max(h.r, Math.round(l.ext + 10)))))
        : (S.reliefs.push({ p: v, d: Math.max(1, u), r: Math.max(10, Math.min(30, Math.round(l.ext + 10))), auto: !0 }),
          t++);
    }
    (renderReliefs(), await makeShell());
  }
  const e = pressureClusters();
  (status(
    t || e.length
      ? `Alívio automático: ${t} alívio(s) criado(s)${e.length ? `; ainda há ${e.length} ponto(s) de pressão — ajuste a profundidade na lista ou aumente a folga geral` : " e nenhum ponto de pressão restante"}. Confira os alívios A1, A2… no modelo.`
      : "Nenhum ponto de pressão relevante fora do apoio plantar.",
  ),
    draw());
}
function safetyChecks() {
  const t = [],
    e = (h, u) => t.push({ n: h, t: u });
  if (!S.shell) return t;
  const n = S.shell,
    o = n.log,
    l = n.params;
  (o.check && e("alerta", `${o.check} faces cruzadas na malha — o fatiador pode errar nessa região`),
    o.thick &&
      o.thick[0] < Math.max(2.5, 0.8 * l.t) &&
      e("alerta", `espessura mínima de ${o.thick[0].toFixed(1).replace(".", ",")} mm (projeto: ${l.t} mm)`));
  try {
    const h = anatXf(),
      u = h(S.L.ML),
      x = h(S.L.MM),
      T = pressureClusters(),
      b = {},
      y = {};
    for (const L of T) {
      const C = V3.len(V3.sub(L.c, u)),
        W = V3.len(V3.sub(L.c, x));
      if (Math.min(C, W) < 18) {
        const U = C < W ? "lateral" : "medial";
        b[U] = Math.max(b[U] || 0, -L.worst);
      } else {
        const U = L.z > 20 ? "na perna" : L.z > -25 ? "no tornozelo/calcanhar" : "no pé",
          j = (y[U] = y[U] || { n: 0, mx: 0 });
        (j.n++, (j.mx = Math.max(j.mx, -L.worst)));
      }
    }
    for (const L in b)
      e(
        "alerta",
        `pressão sobre o maléolo ${L} (até ${b[L].toFixed(1).replace(".", ",")} mm) — aumente o alívio dos maléolos ou use o alívio automático`,
      );
    for (const L in y) {
      const C = y[L];
      e(
        "atenção",
        `${C.n} ponto${C.n > 1 ? "s" : ""} de pressão ${L} (até ${C.mx.toFixed(1).replace(".", ",")} mm) — use o alívio automático`,
      );
    }
  } catch {}
  const s = o.rivets || [];
  for (const h of s)
    (h.holeFail && e("atenção", `furo de ${h.name} (${h.lado}) não coube na malha — ficou sem furo; marque à mão`),
      !h.joint && h.edge < 8 && e("atenção", `rebite de ${h.name} a ${h.edge} mm da borda (recomendado ≥ 8 mm)`));
  for (let h = 0; h < s.length; h++)
    for (let u = h + 1; u < s.length; u++) {
      const x = V3.len(V3.sub(s[h].pO, s[u].pO));
      x < 12 && e("atenção", `R${h + 1} e R${u + 1} a ${x.toFixed(0)} mm um do outro`);
    }
  if (o.artic)
    if (o.artic.fail) e("alerta", "articulação pedida mas não aplicada: " + o.artic.fail);
    else
      for (const h of o.artic.joints)
        h.frente < 12 &&
          e(
            "atenção",
            `pouco material à frente do eixo no lado ${h.lado} (${h.frente} mm) — avance a linha de corte do tornozelo`,
          );
  return (
    o.wedge &&
      !o.wedge.fail &&
      o.wedge.tmax > 15 &&
      e("atenção", `calço/cunha com até ${o.wedge.tmax.toFixed(0)} mm — confira se cabe no calçado`),
    o.wedge && o.wedge.fail && e("atenção", "calço/cunha pedido mas a sola não tem área plana suficiente"),
    o.stiff &&
      o.stiff.cls === "flexível" &&
      e(
        "atenção",
        "rigidez estimada flexível — para AFO rígida, avance a linha de corte do tornozelo ou aumente a espessura",
      ),
    o.engrave && o.engrave.skipped && e("info", "identificação em relevo não coube na panturrilha"),
    l.engrave &&
      !engraveText(l.engText).some((h) => /[A-Z0-9]{2,}/.test(h.replace(/\s/g, ""))) &&
      e("info", "identificação sem código do paciente — preencha o prontuário"),
    !S.corrected &&
      S.meas &&
      Math.abs(S.meas.pf || 0) > 10 &&
      e(
        "atenção",
        `pé sem correção de postura (${Math.abs(S.meas.pf).toFixed(0)}° de ${S.meas.pf > 0 ? "equino" : "dorsiflexão"})`,
      ),
    $("lmCheck") && $("lmCheck").querySelector("li") && e("atenção", "pontos anatômicos com aviso na etapa 2"),
    o.contact &&
      o.contact.ok < 0.35 &&
      e("atenção", `contato baixo com a pele (${Math.round(o.contact.ok * 100)} %) — confira a folga geral`),
    t
  );
}
function renderSafety() {
  const t = $("safety");
  if (!t) return;
  if (!S.shell) {
    t.innerHTML = "";
    return;
  }
  const e = safetyChecks(),
    n = e.filter((l) => l.n === "alerta").length,
    o = { alerta: "⛔", atenção: "⚠", info: "ℹ" };
  t.innerHTML =
    '<div class="sub-h" style="margin-top:4px">Checagem antes de exportar</div>' +
    (e.length
      ? '<ul class="safe">' +
        e
          .map(
            (l) =>
              `<li class="${l.n === "alerta" ? "a" : l.n === "info" ? "i" : "w"}"><span>${o[l.n]}</span>${l.t}</li>`,
          )
          .join("") +
        "</ul>"
      : '<div class="note" style="color:var(--ok)">✓ Nenhum problema encontrado.</div>') +
    (n
      ? `<div class="note" style="color:var(--warn)">${n} alerta(s): o STL só é salvo depois de confirmar.</div>`
      : "");
}
async function dbExport() {
  const t = FICHAS.listar().length,
    c = calibList(),
    b = FICHAS.exportarBase(new Date(), { calibracao: c }),
    o = await saveFile(b.nome, b.conteudo, "application/json");
  o && status("Base exportada: " + t + " fichas e " + c.length + " medições de bancada em " + o + ".");
}
async function dbImport(t) {
  try {
    const e = JSON.parse(await t.text()),
      { novas: l, atualizadas: s } = FICHAS.importarBase(e),
      v = calibList();
    let h = 0;
    for (const u of e.calibracao || []) v.some((x) => x.data === u.data && x.EI === u.EI) || (v.push(u), h++);
    (calibStore(v),
      renderFichas(),
      renderCalib(),
      S.shell && showStiff(),
      status(`Base importada: ${l} fichas novas, ${s} atualizadas, ${h} medições de bancada.`));
  } catch (e) {
    status("Não foi possível importar a base: " + esc(e.message));
  }
}
const TOUR = [
  {
    sel: null,
    t: "Bem-vindo ao EITA! AFO",
    h: "Este passo a passo mostra o caminho do scan da perna até o STL da AFO e o relatório. Leva 1 minuto. Você pode reabrir quando quiser pelo botão <b>?</b> no topo.",
  },
  {
    sel: "#s0",
    t: "Ficha do paciente",
    h: "Preencha nome, prontuário, nascimento, peso e diagnóstico. Esses dados vão para o relatório em PDF. A ficha também guarda pontos, parâmetros e versões (não guarda o scan).",
  },
  {
    sel: "#s1",
    t: "1 · Carregar o scan",
    h: "Abra o STL ou OBJ da perna (da ponta dos dedos até abaixo do joelho). O scan deve cobrir a parte de trás da perna e o calcanhar.",
  },
  {
    sel: "#s2",
    t: "2 · Marcar os pontos",
    h: "Clique no modelo para marcar, nesta ordem:<ul><li><b>ML / MM</b> — centro dos maléolos lateral e medial</li><li><b>CA</b> — planta do calcanhar</li><li><b>M1 / M5</b> — cabeças do 1º e 5º metatarsos</li><li><b>PX</b> — frente da perna, perto do topo</li></ul>A ferramenta avisa se algum ponto parecer fora do lugar.",
  },
  { sel: "#s3", t: "3 · Medidas", h: "Ângulos e larguras calculados pelos pontos. Confira com o exame físico." },
  {
    sel: "#s4",
    t: "4 · Correção de postura",
    h: "Leva o pé para o ângulo alvo (90° na maioria dos casos). Em deformidades fixas, use o ângulo alcançável no exame.",
  },
  {
    sel: "#s5",
    t: "5 · Casca da AFO",
    h: "Escolha material e espessura, linha de corte, rebites, calço, articulação e identificação em relevo. A casca é atualizada ao mudar os campos. Use o <b>mapa de contato</b> para ver pressão e folga.",
  },
  {
    sel: "#view",
    t: "Visualização",
    h: "Arraste para girar, use a roda para aproximar e o botão direito para mover. Os botões acima trocam a vista (frente, lateral, posterior…).",
  },
  {
    sel: "#s6",
    t: "6 · Exportar",
    h: "Baixe o STL da AFO (na orientação de impressão) e o relatório em PDF com dados do paciente, parâmetros, rebites e comparações.",
  },
];
let tourI = 0,
  tourPrev = null;
const tourRestore = () => {
  tourPrev && (tourPrev.classList.add("collapsed"), (tourPrev = null));
};
function tourShow(t) {
  tourI = t;
  let e = document.getElementById("tour");
  e ||
    ((e = document.createElement("div")),
    (e.id = "tour"),
    (e.innerHTML = '<div class="spot"></div><div class="card" role="dialog" aria-live="polite"></div>'),
    document.body.appendChild(e));
  const n = TOUR[t],
    o = e.querySelector(".spot"),
    l = e.querySelector(".card"),
    s = n.sel ? document.querySelector(n.sel) : null;
  (tourRestore(),
    s && s.classList.contains("collapsed") && s.id !== "s0" && (s.classList.remove("collapsed"), (tourPrev = s)),
    s && s.scrollIntoView && s.scrollIntoView({ block: "nearest" }));
  const v = s ? s.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  (Object.assign(
    o.style,
    s
      ? {
          left: v.left - 6 + "px",
          top: v.top - 6 + "px",
          width: v.width + 12 + "px",
          height: Math.min(v.height, innerHeight - v.top - 12) + 12 + "px",
          display: "block",
        }
      : { left: "50%", top: "50%", width: "0px", height: "0px" },
  ),
    (l.innerHTML = `<div class="k">Passo ${t + 1} de ${TOUR.length}</div><h3>${n.t}</h3><div>${n.h}</div><div class="bt"><button type="button" class="skip">Pular</button>${t ? '<button type="button" class="prev">Voltar</button>' : ""}<button type="button" class="primary next">${t === TOUR.length - 1 ? "Começar" : "Próximo"}</button></div>`));
  const h = 340,
    u = l.offsetHeight || 220;
  let x, T;
  (s
    ? v.right + h + 24 < innerWidth
      ? ((x = v.right + 16), (T = Math.min(Math.max(12, v.top), innerHeight - u - 12)))
      : ((x = Math.max(12, Math.min(innerWidth - h - 12, v.left + v.width / 2 - h / 2))),
        (T = Math.min(innerHeight - u - 12, Math.max(12, v.top + 60))))
    : ((x = (innerWidth - h) / 2), (T = (innerHeight - u) / 2)),
    (l.style.left = x + "px"),
    (l.style.top = T + "px"),
    (l.querySelector(".skip").onclick = tourEnd),
    (l.querySelector(".next").onclick = () => (t < TOUR.length - 1 ? tourShow(t + 1) : tourEnd())));
  const b = l.querySelector(".prev");
  (b && (b.onclick = () => tourShow(t - 1)), l.querySelector(".next").focus());
}
function tourEnd() {
  tourRestore();
  const t = document.getElementById("tour");
  t && t.remove();
  try {
    localStorage.setItem("eitaAFO.tour", "1");
  } catch {}
}
(document.addEventListener("keydown", (t) => {
  document.getElementById("tour") &&
    (t.key === "Escape" && tourEnd(),
    t.key === "ArrowRight" && tourI < TOUR.length - 1 && tourShow(tourI + 1),
    t.key === "ArrowLeft" && tourI > 0 && tourShow(tourI - 1));
}),
  addEventListener("resize", () => {
    document.getElementById("tour") && tourShow(tourI);
  }),
  (window.AFO = {
    S,
    cam,
    draw,
    screenOf: (t) => {
      const e = matrices(),
        n = project(t, e);
      return [n[0], n[1]];
    },
    loadBuffer,
    setLandmark: (t, e) => {
      setLandmark(t, V3.sub(e, S.offset));
      const n = LM.find((o) => !S.L[o.id]);
      ((S.active = n ? n.id : null), renderLM(), update());
    },
    applyCorrection,
    resetCorrection,
    setView,
    exportData,
    stl: () => stlAFO(S.V, S.F, anatXf(), "t"),
    makeShell,
    afoStl: (t) => stlAFO(S.shell.shell.V, S.shell.shell.F, printXf(t || "anat", S.shell.shell.V), "t"),
    report: () => buildReport(!0),
  }),
  (() => {
    const t = ["s1", "s2", "s3", "s4", "s5", "s6"].map((b) => $(b)),
      e = (b, y) => {
        b.classList.contains("off") ||
          (b.classList.remove("collapsed"), (n = b.id), y && b.scrollIntoView({ behavior: "smooth", block: "start" }));
      };
    let n = "s1";
    for (const b of t)
      b.querySelector("h2").addEventListener("click", () => {
        if (b.classList.contains("off")) return;
        const y = b.classList.contains("collapsed");
        (b.classList.toggle("collapsed"), y && (n = b.id));
      });
    for (const b of document.querySelectorAll("#stepper button"))
      b.onclick = () => {
        const y = $(b.dataset.s);
        if (!y.classList.contains("off")) {
          for (const L of t) L !== y && L.id !== "s5" && L.classList.add("collapsed");
          e(y, !0);
        }
      };
    for (const b of document.querySelectorAll("label.ctl")) {
      const y = b.querySelector("input[type=number]");
      if (!y) continue;
      const L = document.createElement("input");
      ((L.type = "range"),
        (L.min = y.min),
        (L.max = y.max),
        (L.step = y.step || 1),
        (L.value = y.value),
        (L.tabIndex = -1),
        L.setAttribute("aria-hidden", "true"),
        b.appendChild(L),
        (y._range = L),
        L.addEventListener("input", () => {
          ((y.value = L.value), y.dispatchEvent(new Event("input", { bubbles: !0 })));
        }),
        L.addEventListener("change", () => y.dispatchEvent(new Event("change", { bubbles: !0 }))),
        y.addEventListener("input", () => {
          L.value = y.value;
        }));
    }
    let o = null;
    const l = () => {
      (clearTimeout(o),
        (o = setTimeout(() => {
          $("autoGen").checked && S.shell && LM.every((b) => S.L[b.id]) && makeShell();
        }, 650)));
    };
    ((window.__regenNow = () => {
      (clearTimeout(o), S.shell && LM.every((b) => S.L[b.id]) && makeShell());
    }),
      ($("trimEdit").onclick = () => {
        if (((S.trimEdit = !S.trimEdit), $("trimEdit").classList.toggle("on", S.trimEdit), S.trimEdit)) {
          S.relMode = !1;
          const b = $("relAdd");
          (b && b.classList.remove("on"),
            S.shell
              ? status('Arraste as alças roxas na borda. Clique em "Editar no modelo" de novo para sair.')
              : status("Gere a casca para editar a linha de corte."));
        }
        draw();
      }),
      ($("relAdd").onclick = () => {
        ((S.relMode = !S.relMode),
          $("relAdd").classList.toggle("on", S.relMode),
          S.relMode &&
            ((S.trimEdit = !1),
            $("trimEdit").classList.remove("on"),
            status("Clique na perna para marcar o centro de um alívio.")),
          draw());
      }),
      $("s0")
        .querySelector("h2")
        .addEventListener("click", () => $("s0").classList.toggle("collapsed")),
      ($("fSave").onclick = saveFicha),
      ($("fExp").onclick = exportFicha),
      ($("fImpB").onclick = () => $("fImp").click()),
      ($("fImp").onchange = async () => {
        const b = $("fImp").files[0];
        if (b) {
          try {
            openFicha(JSON.parse(await b.text()));
          } catch (y) {
            status("Não foi possível ler a ficha: " + esc(y.message));
          }
          $("fImp").value = "";
        }
      }),
      $("pName").addEventListener("input", () => {
        $("pBadge").textContent = $("pName").value ? "· " + $("pName").value : "";
      }));
    const s = () => {
      const b = $("engPrev");
      b && (b.textContent = $("pEng").checked ? engraveText(engraveAuto()).join(" / ") || "—" : "desligado");
    };
    ($("pBirth").addEventListener("input", updAge),
      $("s0").addEventListener("change", (b) => {
        (s(), ["pId", "pName", "pSide"].includes(b.target.id) && $("pEng").checked && !$("pEngT").value.trim() && l());
      }),
      $("s5").addEventListener("input", (b) => {
        b.target.id === "pEngT" && s();
      }),
      $("pEng").addEventListener("change", s),
      setInterval(s, 1500),
      s(),
      ($("presetGo").onclick = () => applyPreset($("preset").value)),
      ($("pairB").onclick = pairCopy),
      ($("relAuto").onclick = autoRelief),
      setInterval(() => {
        S.shell && $("s6") && !$("s6").classList.contains("collapsed") && renderSafety();
      }, 2e3),
      ($("dbExp").onclick = dbExport),
      ($("dbImpB").onclick = () => $("dbImp").click()),
      ($("dbImp").onchange = () => {
        const b = $("dbImp").files[0];
        (b && dbImport(b), ($("dbImp").value = ""));
      }),
      setInterval(() => {
        const b = $("pairInfo");
        if (!b) return;
        const y = pairFicha();
        b.innerHTML = y
          ? `Par encontrado: ficha do lado <b>${y.lado === "D" ? "direito" : "esquerdo"}</b> (${new Date(y.atualizado).toLocaleDateString("pt-BR")}${y.resultado && y.resultado.massa_g ? " · " + y.resultado.massa_g + " g" : ""}).`
          : "Salve uma ficha para cada lado com o mesmo nome ou prontuário; as duas ficam ligadas e o relatório compara o par.";
      }, 1500),
      ($("realB").onclick = () => $("realFile").click()),
      ($("realFile").onchange = () => {
        const b = $("realFile").files[0];
        (b && loadRealAfo(b), ($("realFile").value = ""));
      }),
      ($("realClr").onclick = () => {
        ((S.cmp = null),
          (S.cmpSrc = null),
          (S.cmpT = null),
          (S.refShell = null),
          (S.refIdx = null),
          ($("devMap").checked = !1),
          refInfo(),
          renderVersions(),
          renderCmp(),
          draw());
      }),
      ($("devMap").onchange = () => {
        ($("devMap").checked && ($("contact").checked = !1), renderCmp(), draw());
      }),
      $("contact").addEventListener("change", () => {
        $("contact").checked && $("devMap").checked && (($("devMap").checked = !1), renderCmp(), draw());
      }),
      ($("calAdd").onclick = calibAdd),
      ($("calExp").onclick = calibExport),
      ($("calImpB").onclick = () => $("calImp").click()),
      ($("calImp").onchange = () => {
        const b = $("calImp").files[0];
        (b && calibImport(b), ($("calImp").value = ""));
      }),
      renderCalib(),
      ($("vSave").onclick = saveVersion),
      ($("refB").onclick = () => $("refFile").click()),
      ($("refFile").onchange = () => {
        const b = $("refFile").files[0];
        (b && loadRefStl(b), ($("refFile").value = ""));
      }),
      renderFichas(),
      ($("trimReset").onclick = () => {
        ((S.trimAdj = null), trimInfo(), draw(), window.__regenNow());
      }),
      $("s5").addEventListener("change", (b) => {
        [
          "showLimb",
          "contact",
          "autoGen",
          "refFile",
          "realFile",
          "devMap",
          "calImp",
          "calM",
          "calA",
          "calLab",
        ].includes(b.target.id) ||
          b.target.closest("#relList") ||
          l();
      }),
      $("s5").addEventListener("input", (b) => {
        b.target.type === "range" && l();
      }));
    const v = {
        s1: () => !!S.V,
        s2: () => LM.every((b) => S.L[b.id]),
        s3: () => !!S.frame,
        s4: () => !!S.corrected,
        s5: () => !!S.shell,
        s6: () => !1,
      },
      h = {};
    let u = null,
      x = !1;
    const T = () => {
      for (const b of t) {
        const y = b.classList.contains("off");
        if (h[b.id] && !y && b.id === "s2") {
          for (const L of t) L !== b && L.classList.add("collapsed");
          e(b, !1);
        }
        if (h[b.id] && !y && b.id === "s4") {
          for (const L of t) L.classList.add("collapsed");
          ($("s3").classList.remove("collapsed"), e(b, !1));
        }
        ((h[b.id] = y), b.classList.toggle("done", v[b.id]()));
      }
      (S.corrected && !x && ($("s4").classList.add("collapsed"), $("s3").classList.add("collapsed"), e($("s5"), !1)),
        (x = !!S.corrected));
      for (const b of document.querySelectorAll("#stepper button")) {
        const y = $(b.dataset.s);
        (b.classList.toggle("locked", y.classList.contains("off")),
          b.classList.toggle("done", v[y.id]()),
          b.classList.toggle("cur", n === y.id));
      }
      for (const b of document.querySelectorAll("label.ctl")) {
        const y = b.querySelector("input[type=number]");
        y &&
          y._range &&
          document.activeElement !== y._range &&
          y._range.value !== y.value &&
          (y._range.value = y.value);
      }
      if (S.shell !== u) {
        u = S.shell;
        const b = $("resultCard");
        if (!S.shell) b.style.display = "none";
        else {
          const y = S.shell.log,
            L = $("mat").value,
            C = DENS[L] || 1;
          (($("rcMass").textContent = (y.volume * C).toFixed(0)),
            ($("rcVol").textContent = y.volume.toFixed(0)),
            ($("rcThk").textContent = y.thick ? y.thick[0].toFixed(1) : "—"),
            ($("rcMat").textContent = (L === "pp" ? "PP" : "Nylon") + " · " + $("pT").value + " mm"));
          const W = y.contact || {},
            U = (j) => (j == null ? "—" : Math.round(j * 100) + "%");
          (($("rcTable").innerHTML =
            `<tr><td>Contato com a pele (0–2,5 mm)</td><td>${U(W.ok)}</td></tr><tr><td>Pontos de pressão</td><td>${U(W.pressao)}</td></tr>${
              y.stiff
                ? `<tr><td>Rigidez (estimativa)</td><td>${(() => {
                    const j = stiffEstimate(y.stiff.EI);
                    return j ? j.K.toFixed(2).replace(".", ",") + " N·m/° · " + y.stiff.cls : y.stiff.cls;
                  })()}</td></tr>`
                : ""
            }<tr><td>Triângulos</td><td>${y.tris.toLocaleString("pt-BR")}</td></tr><tr><td>Malha</td><td>${y.check ? '<span class="flag w">' + y.check + " faces cruzadas</span>" : '<span class="flag o">sem cruzamentos</span>'}</td></tr>` +
            (y.tipFallback
              ? '<tr><td colspan=2 style="text-align:left;font:12px var(--f-body);color:var(--warn)">Antepé muito desviado: ponta pelo contorno dos dedos.</td></tr>'
              : "")),
            (b.style.display = "block"));
        }
      }
    };
    (setInterval(T, 300), T());
  })(),
  resize(),
  renderLM(),
  ($("helpB").onclick = () => tourShow(0)));
try {
  localStorage.getItem("eitaAFO.tour") || setTimeout(() => tourShow(0), 600);
} catch {}
