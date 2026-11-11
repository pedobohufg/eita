/* EITA! AFO — interface e cálculo (v0.14), separados da página publicada na E4a e reformatados (Prettier) para
   leitura, sem mudar nenhuma instrução. Nas próximas etapas da E4 as partes saem para o núcleo e para
   módulos puros de modulos/afo/ (roteiro em docs/E4-AFO.md).
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
"use strict";
const V3 = {
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
  },
  DEG = 180 / Math.PI,
  smooth = (t, e, n) => {
    const o = Math.min(1, Math.max(0, (n - t) / (e - t)));
    return o * o * (3 - 2 * o);
  };
function parseSTL(t) {
  const e = new DataView(t);
  if (t.byteLength >= 84) {
    const v = e.getUint32(80, !0);
    if (84 + v * 50 === t.byteLength) {
      const h = new Float32Array(v * 9);
      for (let u = 0; u < v; u++) {
        const x = 84 + u * 50 + 12;
        for (let T = 0; T < 9; T++) h[u * 9 + T] = e.getFloat32(x + T * 4, !0);
      }
      return h;
    }
  }
  const n = new TextDecoder().decode(t),
    o = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g,
    l = [];
  let s;
  for (; (s = o.exec(n)); ) l.push(+s[1], +s[2], +s[3]);
  if (l.length < 9 || l.length % 9) throw new Error("Arquivo STL não reconhecido");
  return new Float32Array(l);
}
function weld(t, e = 1e-4) {
  const n = new Map(),
    o = [],
    l = t.length / 9,
    s = new Uint32Array(l * 3);
  for (let h = 0; h < l * 3; h++) {
    const u = t[h * 3],
      x = t[h * 3 + 1],
      T = t[h * 3 + 2],
      b = Math.round(u / e) + "_" + Math.round(x / e) + "_" + Math.round(T / e);
    let y = n.get(b);
    (y === void 0 && ((y = o.length / 3), n.set(b, y), o.push(u, x, T)), (s[h] = y));
  }
  const v = [];
  for (let h = 0; h < l; h++) {
    const u = s[h * 3],
      x = s[h * 3 + 1],
      T = s[h * 3 + 2];
    u !== x && x !== T && u !== T && v.push(u, x, T);
  }
  return { V: new Float64Array(o), F: new Uint32Array(v) };
}
function componentsFilter(t, e, n) {
  const o = t.length / 3,
    l = new Int32Array(o);
  for (let C = 0; C < o; C++) l[C] = C;
  const s = (C) => {
      for (; l[C] !== C; ) ((l[C] = l[l[C]]), (C = l[C]));
      return C;
    },
    v = (C, W) => {
      ((C = s(C)), (W = s(W)), C !== W && (l[C] = W));
    };
  for (let C = 0; C < e.length; C += 3) (v(e[C], e[C + 1]), v(e[C + 1], e[C + 2]));
  const h = new Map();
  for (let C = 0; C < e.length; C += 3) {
    const W = s(e[C]);
    h.set(W, (h.get(W) || 0) + 1);
  }
  const u = Math.max(...h.values()),
    x = new Set([...h].filter(([, C]) => C >= n * u).map(([C]) => C)),
    T = [];
  for (let C = 0; C < e.length; C += 3) x.has(s(e[C])) && T.push(e[C], e[C + 1], e[C + 2]);
  const b = new Int32Array(o).fill(-1),
    y = [],
    L = new Uint32Array(T.length);
  for (let C = 0; C < T.length; C++) {
    const W = T[C];
    (b[W] < 0 && ((b[W] = y.length / 3), y.push(t[W * 3], t[W * 3 + 1], t[W * 3 + 2])), (L[C] = b[W]));
  }
  return { V: new Float64Array(y), F: L, comps: h.size, kept: x.size };
}
function boundaryEdges(t) {
  const e = new Map();
  for (let o = 0; o < t.length; o += 3)
    for (let l = 0; l < 3; l++) {
      const s = t[o + l],
        v = t[o + ((l + 1) % 3)],
        h = s < v ? s * 4294967296 + v : v * 4294967296 + s;
      e.set(h, (e.get(h) || 0) + 1);
    }
  let n = 0;
  for (const o of e.values()) o === 1 && n++;
  return n;
}
function splitCrease(t, e, n) {
  const o = t.length / 3,
    l = e.length / 3,
    s = Math.cos((n / 180) * Math.PI),
    v = new Float32Array(l * 3);
  for (let W = 0; W < l; W++) {
    const U = e[W * 3] * 3,
      j = e[W * 3 + 1] * 3,
      Q = e[W * 3 + 2] * 3,
      G = t[j] - t[U],
      O = t[j + 1] - t[U + 1],
      B = t[j + 2] - t[U + 2],
      Z = t[Q] - t[U],
      rt = t[Q + 1] - t[U + 1],
      D = t[Q + 2] - t[U + 2];
    let kt = O * D - B * rt,
      Bt = B * Z - G * D,
      wt = G * rt - O * Z;
    const Kt = Math.hypot(kt, Bt, wt) || 1;
    ((v[W * 3] = kt / Kt), (v[W * 3 + 1] = Bt / Kt), (v[W * 3 + 2] = wt / Kt));
  }
  const h = new Uint32Array(o + 1);
  for (let W = 0; W < e.length; W++) h[e[W] + 1]++;
  for (let W = 0; W < o; W++) h[W + 1] += h[W];
  const u = new Uint32Array(e.length),
    x = h.slice(0, o);
  for (let W = 0; W < e.length; W++) u[x[e[W]]++] = W;
  const T = Uint32Array.from(e),
    b = [],
    y = [];
  let L = o;
  for (let W = 0; W < o; W++) {
    const U = [];
    for (let j = h[W]; j < h[W + 1]; j++) {
      const Q = u[j],
        G = (Q / 3) | 0;
      let O = -1;
      for (let B = 0; B < U.length; B++) {
        const Z = U[B].n;
        if (Z[0] * v[G * 3] + Z[1] * v[G * 3 + 1] + Z[2] * v[G * 3 + 2] > s) {
          O = B;
          break;
        }
      }
      (O < 0 &&
        (U.push({ n: [v[G * 3], v[G * 3 + 1], v[G * 3 + 2]], id: U.length ? L++ : W }),
        U.length > 1 && (b.push(t[W * 3], t[W * 3 + 1], t[W * 3 + 2]), y.push(W)),
        (O = U.length - 1)),
        (T[Q] = U[O].id));
    }
  }
  if (!b.length) return { V: t, F: e, map: null };
  const C = new Float32Array(t.length + b.length);
  return (C.set(t), C.set(b, t.length), { V: C, F: T, map: y });
}
function computeNormals(t, e) {
  const n = new Float32Array(t.length);
  for (let o = 0; o < e.length; o += 3) {
    const l = e[o] * 3,
      s = e[o + 1] * 3,
      v = e[o + 2] * 3,
      h = t[s] - t[l],
      u = t[s + 1] - t[l + 1],
      x = t[s + 2] - t[l + 2],
      T = t[v] - t[l],
      b = t[v + 1] - t[l + 1],
      y = t[v + 2] - t[l + 2],
      L = u * y - x * b,
      C = x * T - h * y,
      W = h * b - u * T;
    for (const U of [l, s, v]) ((n[U] += L), (n[U + 1] += C), (n[U + 2] += W));
  }
  for (let o = 0; o < n.length; o += 3) {
    const l = Math.hypot(n[o], n[o + 1], n[o + 2]) || 1;
    ((n[o] /= l), (n[o + 1] /= l), (n[o + 2] /= l));
  }
  return n;
}
function toBinarySTL(t, e, n, o) {
  const l = e.length / 3,
    s = new ArrayBuffer(84 + l * 50),
    v = new DataView(s),
    h = (o || "EITA AFO").slice(0, 79);
  for (let x = 0; x < h.length; x++) v.setUint8(x, h.charCodeAt(x) & 127);
  v.setUint32(80, l, !0);
  const u = (x) => n([t[x * 3], t[x * 3 + 1], t[x * 3 + 2]]);
  for (let x = 0; x < l; x++) {
    const T = u(e[x * 3]),
      b = u(e[x * 3 + 1]),
      y = u(e[x * 3 + 2]),
      L = V3.norm(V3.cross(V3.sub(b, T), V3.sub(y, T)));
    let C = 84 + x * 50;
    for (const W of [L, T, b, y]) for (let U = 0; U < 3; U++) (v.setFloat32(C, W[U], !0), (C += 4));
    v.setUint16(C, 0, !0);
  }
  return s;
}
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
    gl.bufferData(gl.ARRAY_BUFFER, computeNormals(S.V0, S.F), gl.STATIC_DRAW),
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
function sectionCentroid(t, e, n, o = 3) {
  let l = 0,
    s = 0,
    v = 0,
    h = 0;
  for (let u = 0; u < t.length; u += 3) {
    const x = (t[u] - e[0]) * n[0] + (t[u + 1] - e[1]) * n[1] + (t[u + 2] - e[2]) * n[2];
    Math.abs(x) < o && ((l += t[u]), (s += t[u + 1]), (v += t[u + 2]), h++);
  }
  return h > 10 ? [l / h, s / h, v / h] : e.slice();
}
function computeFrame(t, e) {
  if (!(t.ML && t.MM && t.PX)) return null;
  const n = V3.mid(t.ML, t.MM),
    o = V3.norm(V3.sub(t.PX, n)),
    l = sectionCentroid(e, t.PX, o),
    s = V3.norm(V3.sub(l, n)),
    v = V3.norm(V3.rej(V3.sub(t.ML, t.MM), s));
  let h = V3.cross(s, v),
    u = "direito",
    x = 1;
  if (t.CA && t.M1 && t.M5) {
    const T = V3.sub(V3.mid(t.M1, t.M5), t.CA);
    V3.dot(h, T) < 0 && ((h = V3.mul(h, -1)), (u = "esquerdo"), (x = -1));
  } else u = "?";
  return { AJC: n, PC: l, X: v, Y: h, Z: s, side: u, h: x };
}
function addPlantar(t, e, n) {
  if (!n || !t.CA || !t.M1 || !t.M5) return;
  const o = V3.norm(V3.sub(V3.mid(t.M1, t.M5), t.CA));
  let l = V3.norm(V3.cross(n.X, o));
  -V3.dot(l, n.Z) - V3.dot(l, n.Y) < 0 && (l = V3.mul(l, -1));
  for (const s of ["CA", "M1", "M5"]) {
    const v = t[s];
    let h = -1 / 0,
      u = -1;
    for (let x = 0; x < e.length; x += 3) {
      const T = e[x] - v[0],
        b = e[x + 1] - v[1],
        y = e[x + 2] - v[2];
      if (T * T + b * b + y * y > 625 || Math.abs(T * n.X[0] + b * n.X[1] + y * n.X[2]) > 12) continue;
      const L = T * l[0] + b * l[1] + y * l[2];
      L > h && ((h = L), (u = x));
    }
    t[s + "p"] = u >= 0 ? [e[u], e[u + 1], e[u + 2]] : v.slice();
  }
}
const pl = (t, e) => t[e + "p"] || t[e];
function measure(t, e) {
  const n = {};
  if (!e) return n;
  if (((n.bimal = V3.len(V3.sub(t.ML, t.MM))), (n.legLen = V3.len(V3.sub(e.PC, e.AJC))), t.CA && t.M1 && t.M5)) {
    const o = pl(t, "CA"),
      l = pl(t, "M1"),
      s = pl(t, "M5"),
      v = V3.mid(l, s),
      h = V3.sub(v, o),
      u = V3.norm(h);
    ((n.footLen = V3.len(h)),
      (n.forefoot = V3.len(V3.sub(t.M1, t.M5))),
      (n.sag = Math.atan2(V3.dot(h, e.Y), V3.dot(h, e.Z)) * DEG),
      (n.pf = n.sag - 90));
    let x = V3.norm(V3.cross(V3.sub(s, o), V3.sub(l, o)));
    x = V3.mul(x, e.h);
    const T = V3.norm(V3.rej(e.Z, u)),
      b = V3.norm(V3.rej(x, u)),
      y = V3.norm(V3.rej(V3.rej(e.X, u), T));
    ((n.inv = Math.atan2(V3.dot(b, y), V3.dot(b, T)) * DEG), (n.heelDrop = -V3.dot(V3.sub(o, e.AJC), e.Z)), (n.fh = u));
  }
  return n;
}
function deform(t, e, n, o, l, s, v, h) {
  const u = new Float64Array(t),
    x = t.length / 3,
    T = (Q, G, O, B) => {
      for (let Z = 0; Z < x; Z++) {
        const rt = [u[Z * 3], u[Z * 3 + 1], u[Z * 3 + 2]],
          D = B(rt);
        if (D <= 0) continue;
        const kt = V3.add(G, V3.rot(V3.sub(rt, G), Q, O * D));
        ((u[Z * 3] = kt[0]), (u[Z * 3 + 1] = kt[1]), (u[Z * 3 + 2] = kt[2]));
      }
      for (const Z in n) {
        const rt = B(n[Z]);
        rt > 0 && (n[Z] = V3.add(G, V3.rot(V3.sub(n[Z], G), Q, O * rt)));
      }
    },
    b = (Q) => V3.dot(V3.sub(Q, o.AJC), o.Z),
    y = (l.sag - s) / DEG,
    L = (Q) => 1 - smooth(-h / 2, h / 2, b(Q));
  if (Math.abs(y) > 1e-4) {
    const Q = (O) => {
        const B = {
            CA: V3.rot(V3.sub(pl(n, "CA"), o.AJC), o.X, O),
            M1: V3.rot(V3.sub(pl(n, "M1"), o.AJC), o.X, O),
            M5: V3.rot(V3.sub(pl(n, "M5"), o.AJC), o.X, O),
          },
          Z = V3.sub(V3.mid(B.M1, B.M5), B.CA);
        return Math.abs(Math.atan2(V3.dot(Z, o.Y), V3.dot(Z, o.Z)) * DEG - s);
      },
      G = Q(y) < Q(-y) ? y : -y;
    T(o.X, o.AJC, G, L);
  }
  const C = measure(n, o);
  S.invSkipped = !(Math.abs(C.inv) <= 35);
  const W = S.invSkipped ? 0 : (C.inv - v) / DEG,
    U = -C.heelDrop / 2,
    j = (Q) => 1 - smooth(U - h / 2, U + h / 2, b(Q));
  if (Math.abs(W) > 1e-4) {
    const Q = C.fh,
      G = (B) => {
        const Z = { ...n };
        for (const rt of ["M1", "M5", "M1p", "M5p"])
          n[rt] && (Z[rt] = V3.add(pl(n, "CA"), V3.rot(V3.sub(n[rt], pl(n, "CA")), Q, B)));
        return Math.abs(measure(Z, o).inv - v);
      },
      O = G(W) < G(-W) ? W : -W;
    T(Q, pl(n, "CA"), O, j);
  }
  return u;
}
function binCenters(t, e, n, o, l) {
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
function fillSmooth(t, e) {
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
function legCenterline(t) {
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
function footAxis(t) {
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
function pctl(t, e) {
  const n = Float64Array.from(t).sort();
  return n[Math.min(n.length - 1, Math.max(0, Math.floor(e * (n.length - 1))))];
}
function gauss1(t, e, n, o, l, s) {
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
function generateShell(t, e, n, o) {
  const l = t.length / 3,
    s = {},
    v = performance.now();
  let h = null;
  if (o.dbg) {
    const a = computeNormals(t, e),
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
    const n = parseSTL(t);
    let { V: o, F: l } = weld(n);
    const s = n.length / 9;
    let v = { comps: 1, kept: 1 };
    if ($("frag").checked) {
      const y = componentsFilter(o, l, 0.02);
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
    ((S.N = computeNormals(S.V, S.F)),
      uploadGhost(),
      uploadMesh(),
      (cam.basis = pcaBasis(o)),
      (cam.yaw = 0.6),
      (cam.pitch = 0.1));
    const T = boundaryEdges(l),
      b = V3.sub(u, h);
    (($("stats").innerHTML =
      `<b>${e}</b><br>${(l.length / 3).toLocaleString("pt-BR")} triângulos (de ${s.toLocaleString("pt-BR")})<br>
${v.comps} partes conectadas; ${v.comps - v.kept} fragmentos removidos<br>
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
function pcaBasis(t) {
  const e = t.length / 3,
    n = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
  for (let h = 0; h < t.length; h += 3)
    for (let u = 0; u < 3; u++) for (let x = 0; x < 3; x++) n[u][x] += (t[h + u] * t[h + x]) / e;
  let o = [1, 1, 1];
  for (let h = 0; h < 60; h++)
    o = V3.norm([
      n[0][0] * o[0] + n[0][1] * o[1] + n[0][2] * o[2],
      n[1][0] * o[0] + n[1][1] * o[1] + n[1][2] * o[2],
      n[2][0] * o[0] + n[2][1] * o[1] + n[2][2] * o[2],
    ]);
  const l = o;
  let s = V3.norm(V3.cross(l, Math.abs(l[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
  const v = V3.cross(l, s);
  return [s, v, l];
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
  const u = deform(S.V0, S.F, l, s, v, e, n, o);
  ((S.V = u), (S.L = l), (S.corrected = !0), (S.disp = new Float32Array(u.length / 3)));
  for (let b = 0; b < S.disp.length; b++)
    S.disp[b] = Math.hypot(u[b * 3] - S.V0[b * 3], u[b * 3 + 1] - S.V0[b * 3 + 1], u[b * 3 + 2] - S.V0[b * 3 + 2]);
  ((S.N = computeNormals(S.V, S.F)), uploadMesh(), (S.frame = s), (S.meas = measure(S.L, s)));
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
      (S.N = computeNormals(S.V, S.F)),
      uploadMesh(),
      ($("corrnote").textContent = ""),
      update(),
      renderLM());
  }
}
let downloadsP = null;
function getDownloads() {
  return (
    downloadsP ||
      (downloadsP =
        window.claude && window.claude.use ? window.claude.use("downloads").catch(() => null) : Promise.resolve(null)),
    downloadsP
  );
}
getDownloads();
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let e = 0; e < 256; e++) {
    let n = e;
    for (let o = 0; o < 8; o++) n = n & 1 ? 3988292384 ^ (n >>> 1) : n >>> 1;
    t[e] = n >>> 0;
  }
  return t;
})();
function crc32(t) {
  let e = 4294967295;
  for (let n = 0; n < t.length; n++) e = CRC_T[(e ^ t[n]) & 255] ^ (e >>> 8);
  return (e ^ 4294967295) >>> 0;
}
function makeZip(t) {
  const e = new TextEncoder(),
    n = [],
    o = [];
  let l = 0;
  const s = new Date(),
    v = ((s.getHours() << 11) | (s.getMinutes() << 5) | (s.getSeconds() >> 1)) & 65535,
    h = (((s.getFullYear() - 1980) << 9) | ((s.getMonth() + 1) << 5) | s.getDate()) & 65535;
  for (const T of t) {
    const b = e.encode(T.name),
      y = T.data,
      L = crc32(y),
      C = new DataView(new ArrayBuffer(30));
    (C.setUint32(0, 67324752, !0),
      C.setUint16(4, 20, !0),
      C.setUint16(6, 2048, !0),
      C.setUint16(8, 0, !0),
      C.setUint16(10, v, !0),
      C.setUint16(12, h, !0),
      C.setUint32(14, L, !0),
      C.setUint32(18, y.length, !0),
      C.setUint32(22, y.length, !0),
      C.setUint16(26, b.length, !0),
      C.setUint16(28, 0, !0),
      n.push(new Uint8Array(C.buffer), b, y));
    const W = new DataView(new ArrayBuffer(46));
    (W.setUint32(0, 33639248, !0),
      W.setUint16(4, 20, !0),
      W.setUint16(6, 20, !0),
      W.setUint16(8, 2048, !0),
      W.setUint16(10, 0, !0),
      W.setUint16(12, v, !0),
      W.setUint16(14, h, !0),
      W.setUint32(16, L, !0),
      W.setUint32(20, y.length, !0),
      W.setUint32(24, y.length, !0),
      W.setUint16(28, b.length, !0),
      W.setUint32(42, l, !0),
      o.push(new Uint8Array(W.buffer), b),
      (l += 30 + b.length + y.length));
  }
  let u = 0;
  for (const T of o) u += T.length;
  const x = new DataView(new ArrayBuffer(22));
  return (
    x.setUint32(0, 101010256, !0),
    x.setUint16(8, t.length, !0),
    x.setUint16(10, t.length, !0),
    x.setUint32(12, u, !0),
    x.setUint32(16, l, !0),
    new Blob([...n, ...o, new Uint8Array(x.buffer)], { type: "application/zip" })
  );
}
function anatXf() {
  const t = S.frame,
    e = V3.cross(t.Y, t.Z);
  return (n) => {
    const o = V3.sub(n, t.AJC);
    return [V3.dot(o, e), V3.dot(o, t.Y), V3.dot(o, t.Z)];
  };
}
const SAVE_OK = /\.(json|txt|csv|zip|md|html|svg|png|pdf)$/i;
async function saveFile(t, e, n) {
  let o = t,
    l;
  const s = await getDownloads();
  if (s && !SAVE_OK.test(t)) {
    const v =
      typeof e == "string" ? new TextEncoder().encode(e) : new Uint8Array(e instanceof ArrayBuffer ? e : e.buffer);
    ((l = makeZip([{ name: t, data: v }])), (o = t.replace(/\.[^.]+$/, "") + ".zip"));
  } else l = new Blob([e], { type: n || "application/octet-stream" });
  if (s)
    try {
      return (await s.save({ filename: o, data: l }), o);
    } catch (v) {
      const h = v && v.code;
      return (
        ($("expnote").textContent =
          h === "declined"
            ? "Download cancelado."
            : h === "rate_limited"
              ? "Já há um pedido de download aberto — confirme ou aguarde e tente de novo."
              : "Não foi possível salvar o arquivo (" + (h || (v && v.message) || "erro") + ")."),
        !1
      );
    }
  try {
    const v = URL.createObjectURL(l),
      h = document.createElement("a");
    return (
      (h.href = v),
      (h.download = o),
      document.body.appendChild(h),
      h.click(),
      h.remove(),
      setTimeout(() => URL.revokeObjectURL(v), 4e3),
      o
    );
  } catch {
    return (($("expnote").textContent = "O download não está disponível nesta visualização."), !1);
  }
}
function baseName() {
  return (S.name || "scan").replace(/\.stl$/i, "");
}
(($("expStl").onclick = async () => {
  const t = toBinarySTL(S.V, S.F, anatXf(), "EITA AFO " + baseName()),
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
const STROKE_FONT = {
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
function engraveText(t) {
  return String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split(/\n|\|/)
    .map((e) => e.replace(/[^0-9A-Z\-\/.:#+()_ ]/g, "").trim())
    .filter(Boolean)
    .slice(0, 3);
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
function ageText(t) {
  if (!t) return "";
  const e = new Date(t + "T12:00:00"),
    n = new Date();
  if (isNaN(e)) return "";
  let o = (n.getFullYear() - e.getFullYear()) * 12 + n.getMonth() - e.getMonth();
  return (
    n.getDate() < e.getDate() && o--,
    o < 0
      ? ""
      : o < 24
        ? o + " meses"
        : Math.floor(o / 12) + " anos" + (o % 12 ? " e " + (o % 12) + " " + (o % 12 > 1 ? "meses" : "mês") : "")
  );
}
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
function meshCheck(t, e, n, o) {
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
    const y = splitCrease(b, u.shell.F, 55);
    let L = u.heat;
    if (
      (y.map &&
        ((L = new Float32Array(y.V.length / 3)),
        L.set(u.heat),
        y.map.forEach((j, Q) => (L[u.heat.length + Q] = u.heat[j]))),
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.apos),
      gl.bufferData(gl.ARRAY_BUFFER, y.V, gl.STATIC_DRAW),
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.anor),
      gl.bufferData(gl.ARRAY_BUFFER, computeNormals(y.V, y.F), gl.STATIC_DRAW),
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.aidx),
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, y.F, gl.STATIC_DRAW),
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.aheat),
      gl.bufferData(gl.ARRAY_BUFFER, L, gl.STATIC_DRAW),
      (S.shell = { ...u, nIdx: u.shell.F.length, dispMap: y.map }),
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
function printXf(t, e) {
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
    n = toBinarySTL(S.shell.shell.V, S.shell.shell.F, printXf(e, S.shell.shell.V), "EITA AFO " + baseName()),
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
const FICHA_KEY = "eitaAFO.fichas.v1",
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
  return fichaList().find((o) => o.id === t + "_" + n) || null;
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
function fichaList() {
  try {
    return JSON.parse(localStorage.getItem(FICHA_KEY) || "[]");
  } catch {
    return [];
  }
}
function fichaStore(t) {
  try {
    return (localStorage.setItem(FICHA_KEY, JSON.stringify(t)), !0);
  } catch {
    return !1;
  }
}
function renderFichas() {
  const t = $("fList");
  if (!t) return;
  const e = fichaList();
  if (!e.length) {
    t.innerHTML = '<div class="note">Nenhuma ficha salva neste navegador.</div>';
    return;
  }
  t.innerHTML = e
    .map(
      (n, o) =>
        `<div class="frow"><div><b>${(n.nome || "(sem nome)").replace(/</g, "&lt;")}</b><small>${n.lado ? (n.lado === "D" ? "direito" : "esquerdo") + " · " : ""}${new Date(n.atualizado).toLocaleDateString("pt-BR")} · ${(n.scan || "").replace(/</g, "&lt;")} · ${n.versoes ? n.versoes.length : 0} versões</small></div><button type="button" data-open="${o}">Abrir</button><button type="button" data-del="${o}" title="Excluir">×</button></div>`,
    )
    .join("");
  for (const n of t.querySelectorAll("[data-open]")) n.onclick = () => openFicha(fichaList()[+n.dataset.open]);
  for (const n of t.querySelectorAll("[data-del]"))
    n.onclick = () => {
      const o = fichaList();
      confirm('Excluir a ficha "' + (o[+n.dataset.del].nome || "") + '" deste navegador?') &&
        (o.splice(+n.dataset.del, 1), fichaStore(o), renderFichas());
    };
}
function saveFicha() {
  const t = collectFicha();
  if (!t.nome) {
    (status("Dê um nome ou identificação à ficha antes de salvar."), $("pName").focus());
    return;
  }
  S.patient = { id: t.id, name: t.nome };
  const e = fichaList(),
    n = e.findIndex((o) => o.id === t.id);
  (n >= 0 ? (e[n] = t) : e.unshift(t),
    status(
      fichaStore(e)
        ? 'Ficha "' + t.nome + '" salva neste navegador. Use "Exportar ficha" para guardar uma cópia em arquivo.'
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
  if (!t || t.formato !== "EITA! AFO ficha") {
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
        `Ficha "${t.nome}" aberta. Carregue o scan <b>${(t.scan || "").replace(/</g, "&lt;")}</b> (etapa 1) para aplicar pontos e parâmetros.`,
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
    status(`Ficha "${t.nome || ""}" aplicada: pontos, correção e parâmetros restaurados.`));
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
        return `<div class="frow${S.refIdx === n ? " sel" : ""}"><div><b>${e.label}</b><small>${new Date(e.date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · ${o.massa_g ?? "—"} g · ${o.rigidez || "—"}</small></div><button type="button" data-ov="${n}">${S.refIdx === n ? "Ocultar" : "Sobrepor"}</button><button type="button" data-rs="${n}">Restaurar</button></div>`;
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
    gl.bufferData(gl.ARRAY_BUFFER, computeNormals(s, t.F), gl.STATIC_DRAW));
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
      n = parseSTL(e),
      o = weld(n);
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
function nnGrid(t, e) {
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
      Z = computeNormals(t, G);
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
    x = computeNormals(l, o.shell.F),
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
    const e = parseSTL(await t.arrayBuffer()),
      n = weld(e);
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
    const t = [
        binCenters,
        fillSmooth,
        legCenterline,
        footAxis,
        pctl,
        gauss1,
        generateShell,
        meshCheck,
        engraveText,
        nnGrid,
        computeNormals,
      ].map((o) => o.toString()).join(`
`),
      e =
        "const V3={" +
        Object.entries(V3)
          .map(([o, l]) => o + ":" + l.toString())
          .join(",") +
        `};
const DEG=` +
        DEG +
        `;
const smooth=` +
        smooth.toString() +
        `;
const pl=` +
        pl.toString() +
        `;
const STROKE_FONT=` +
        JSON.stringify(STROKE_FONT) +
        `;
` +
        t +
        `
self.onmessage=e=>{const {id,A,F,L,P}=e.data;try{const R=generateShell(A,F,L,P);const tr=[R.shell.V.buffer,R.shell.F.buffer];if(R.heat)tr.push(R.heat.buffer);self.postMessage({id,R},tr)}catch(err){self.postMessage({id,err:String(err&&err.message||err)})}};`,
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
  const e = S.frame,
    n = V3.cross(e.Y, e.Z);
  return V3.add(e.AJC, V3.add(V3.add(V3.mul(n, t[0]), V3.mul(e.Y, t[1])), V3.mul(e.Z, t[2])));
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
  const t = fichaList(),
    e = {
      formato: "EITA! AFO base",
      versaoApp: "0.14",
      exportado: new Date().toISOString(),
      fichas: t,
      calibracao: calibList(),
    },
    n = new Date(),
    o = await saveFile(
      "base_EITA_AFO_" +
        n.getFullYear() +
        String(n.getMonth() + 1).padStart(2, "0") +
        String(n.getDate()).padStart(2, "0") +
        ".json",
      JSON.stringify(e),
      "application/json",
    );
  o &&
    status("Base exportada: " + t.length + " fichas e " + e.calibracao.length + " medições de bancada em " + o + ".");
}
async function dbImport(t) {
  try {
    const e = JSON.parse(await t.text());
    if (e.formato !== "EITA! AFO base") throw new Error("arquivo não é uma base do EITA! AFO");
    const n = fichaList(),
      o = new Map(n.map((u) => [u.id, u]));
    let l = 0,
      s = 0;
    for (const u of e.fichas || []) {
      if (!u || u.formato !== "EITA! AFO ficha") continue;
      const x = o.get(u.id);
      x ? new Date(u.atualizado) > new Date(x.atualizado) && (o.set(u.id, u), s++) : (o.set(u.id, u), l++);
    }
    const v = calibList();
    let h = 0;
    for (const u of e.calibracao || []) v.some((x) => x.data === u.data && x.EI === u.EI) || (v.push(u), h++);
    (fichaStore([...o.values()].sort((u, x) => new Date(x.atualizado) - new Date(u.atualizado))),
      calibStore(v),
      renderFichas(),
      renderCalib(),
      S.shell && showStiff(),
      status(`Base importada: ${l} fichas novas, ${s} atualizadas, ${h} medições de bancada.`));
  } catch (e) {
    status("Não foi possível importar a base: " + e.message);
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
    stl: () => toBinarySTL(S.V, S.F, anatXf(), "t"),
    makeShell,
    afoStl: (t) => toBinarySTL(S.shell.shell.V, S.shell.shell.F, printXf(t || "anat", S.shell.shell.V), "t"),
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
            status("Não foi possível ler a ficha: " + y.message);
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
