/* EITA! OLHO — interface (padrão visual Lab.EITA): foto, íris, escala, limpeza, relevo, prótese, exportação,
   ficha do paciente e relatório. Processamento em modulos/olho/processamento.js; casca, downloads, zip, STL,
   PDF, ficha e blocos do 3D vêm do núcleo (window.EITA). Mesmo comportamento e mesmos arquivos da v0.2.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
"use strict";
const E = window.EITA, O = E.olho, UI = E.ui;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const { TAU, NT, NR, TEX, HM, fmt } = O;

/* ------------------------------------------------------------------ estado */
const S = {
  img: null, W: 0, H: 0, px: null,            // foto (canvas com o balanço de branco aplicado; RGBA original)
  wb: [1, 1, 1],
  iris: null, pup: null,                      // {x,y,r} em px da foto
  ruler: null, rulerPts: [],
  mode: "edit",                               // edit | wb | ruler
  view: { z: 1, tx: 0, ty: 0 },
  tab: "photo",
  unw: null, clean: null, mask: null,         // íris desenrolada (NT x NR x 3)
  tex: null, texD: null, hm: null,            // textura (canvas + RGBA lido de volta) e mapa de alturas
  meshes: null, dirty: true,
};
const foto = () => ({ px: S.px, W: S.W, H: S.H, wb: S.wb });
const rgbaCanvas = (d, w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"), id = g.createImageData(w, h); id.data.set(d); g.putImageData(id, 0, 0); return c; };

/* ------------------------------------------------------------- casca (núcleo) */
const CASCA = UI.criarCasca(), status = (t) => CASCA.status(t), busy = CASCA.ocupado, save = CASCA.salvar;
const num = (id) => parseFloat($(id).value);

const STEPS = [["s1", "Foto"], ["s2", "Íris"], ["s3", "Escala"], ["s4", "Limpeza"], ["s5", "Relevo"], ["s6", "Prótese"], ["s7", "Exportar"]];
const ETP = UI.criarEtapas({ etapas: STEPS, status, rolagem: "auto", aoAbrir(id) {
  if (id === "s4" || id === "s5") setTab("iris");
  if (id === "s6" || id === "s7") { if (S.meshes) setTab("3d"); }
  if (id === "s2" || id === "s3") setTab("photo");
} });
const openSection = ETP.abrir, enableUpTo = ETP.habilitarAte;
/* liga número <-> range */
function pair(n, r) { $(r).oninput = () => { $(n).value = $(r).value; changed(); }; $(n).addEventListener("input", () => { $(r).value = $(n).value; }); }
[["specThr", "specThrR"], ["cBri", "cBriR"], ["cCon", "cConR"], ["cSat", "cSatR"], ["hDepth", "hDepthR"], ["hDetail", "hDetailR"], ["hTrans", "hTransR"], ["sShell", "sShellR"]].forEach((p) => pair(...p));

/* --------------------------------------------------------------- parâmetros (lidos da página) */
const limpezaP = () => ({ upOn: $("upOn").checked, upA: num("upA"), upB: num("upB"), loOn: $("loOn").checked, loA: num("loA"), loB: num("loB"), specOn: $("specOn").checked, specThr: num("specThr"), cBri: num("cBri"), cCon: num("cCon"), cSat: num("cSat") });
const relevoP = () => ({ hDetail: num("hDetail"), hSmooth: num("hSmooth"), hBase: num("hBase"), hDepth: num("hDepth"), hInv: $("hInv").checked, hLimbus: $("hLimbus").checked, hTrans: num("hTrans") });
const pupilaP = () => ({ pupMode: $("pupMode").value, hBase: num("hBase"), pPup: num("pPup"), pupH: num("pupH") });
const formaP = () => ({ sW: num("sW"), sH: num("sH"), protSide: $("protSide").value, sDx: num("sDx"), sDy: num("sDy"), sRF: num("sRF"), sRB: num("sRB"), sT: num("sT"), sIns: num("sIns"), sMode: $("sMode").value, sShell: num("sShell") });
const protParams = () => O.parametrosProtese({ espelhar: $("photoSide").value !== $("protSide").value, Di: num("pIris"), Dp: num("pPup") });
const geomParams = () => O.geometria(formaP(), num("pIris"), num("pPup"));

/* --------------------------------------------------------------- carregar foto */
UI.soltavel($("drop"), $("file"), (f) => loadFile(f));
$("view").addEventListener("dragover", (e) => e.preventDefault());
$("view").addEventListener("drop", (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith("image")) loadFile(f); });
$("demo").onclick = () => loadURL("assets/olho-exemplo.jpg", "foto de exemplo (sintética)");

function loadFile(f) { const u = URL.createObjectURL(f); loadURL(u, f.name); }
async function loadURL(url, name) {
  let im;
  try { im = await UI.carregarImagem(url, 1800); } catch (e) { status("Não consegui abrir essa imagem. Use JPG ou PNG."); return; }
  S.img = im.canvas; S.W = im.width; S.H = im.height; S.px = im.data; S.photoName = name;
  S.wb = [1, 1, 1]; S.iris = S.pup = null; S.ruler = null; S.meshes = null;
  $("imgInfo").textContent = `${name} · ${S.W} × ${S.H} px${S.W < im.original[0] ? " (reduzida)" : ""}`;
  $("empty").hidden = true;
  fitView(); setTab("photo");
  enableUpTo(2); openSection("s2");
  detect();
}
window.__eitaLoad = loadURL; // usado nos testes

/* ---------------------------------------------------- detecção íris/pupila */
function detect(seed) {
  if (!S.img) return;
  busy(true, "Procurando a íris…");
  setTimeout(() => {
    const r = O.detectarIrisPupila(foto(), seed);
    S.pup = r.pup; S.iris = r.iris;
    busy(false);
    afterCircles(true);
    status('Íris e pupila detectadas. Confira os círculos (<b style="color:#2f6fdb">azul</b> = borda da íris, <b style="color:#e2483d">vermelho</b> = pupila) e ajuste se precisar. Depois siga para a escala (etapa 3).');
    onPhotoReady();
  }, 30);
}
$("detect").onclick = () => detect();
$("concentric").onchange = () => { if ($("concentric").checked && S.iris) { S.pup.x = S.iris.x; S.pup.y = S.iris.y; } changed(); };

function afterCircles(first) {
  if (S.iris && S.pup && S.pup.r >= S.iris.r * 0.92) S.pup.r = S.iris.r * 0.6;
  enableUpTo(7);
  updateTables(); changed();
  if (first) drawPhoto();
}

/* ---------------------------------------------------------------- escala (núcleo: calibracao.js) */
let scaleMode = "hvid";
document.querySelectorAll("#scaleMode button").forEach((b) => b.onclick = () => {
  scaleMode = b.dataset.v;
  document.querySelectorAll("#scaleMode button").forEach((x) => x.classList.toggle("on", x === b));
  $("hvidBox").hidden = scaleMode !== "hvid"; $("rulerBox").hidden = scaleMode !== "ruler";
  changed();
});
$("rulerBtn").onclick = () => { setMode("ruler"); S.rulerPts = []; status("Clique no primeiro ponto da régua."); };
function mmPerPx() {
  if (scaleMode === "ruler" && S.ruler) return E.escalaPorRegua(S.ruler[0], S.ruler[1], num("rulerMM"));
  if (!S.iris) return NaN;
  return E.escalaPorDiametro(num("hvid"), S.iris.r);
}
function measured() {
  const k = mmPerPx();
  return { iris: S.iris ? 2 * S.iris.r * k : NaN, pup: S.pup ? 2 * S.pup.r * k : NaN, k };
}
function updateTables() {
  if (!S.iris) return;
  const m = measured();
  $("circTab").innerHTML = `<tr><td>Íris (raio)</td><td>${fmt(S.iris.r, 1)} px</td></tr><tr><td>Pupila (raio)</td><td>${fmt(S.pup.r, 1)} px</td></tr><tr><td>Pupila / íris</td><td>${fmt(S.pup.r / S.iris.r, 2)}</td></tr><tr><td>Descentração da pupila</td><td>${fmt(Math.hypot(S.pup.x - S.iris.x, S.pup.y - S.iris.y) * m.k, 2)} mm</td></tr>`;
  $("scaleTab").innerHTML = `<tr><td>Escala</td><td>${fmt(m.k * 1000, 1)} µm/px</td></tr><tr><td>Íris medida</td><td>${fmt(m.iris, 2)} mm</td></tr><tr><td>Pupila medida</td><td>${fmt(m.pup, 2)} mm</td></tr>`;
  if ($("pIrisAuto").checked && Number.isFinite(m.iris)) $("pIris").value = m.iris.toFixed(2);
  if ($("pPupAuto").checked && Number.isFinite(m.pup)) $("pPup").value = clamp(m.pup, 1.5, 8).toFixed(2);
}
$("wbBtn").onclick = () => { setMode("wb"); status("Clique numa área branca ou cinza neutra da foto."); };
$("wbReset").onclick = () => { S.wb = [1, 1, 1]; $("wbInfo").textContent = "Balanço de branco zerado."; S.px && refreshImgCanvas(); changed(); };
function pickWB(x, y) {
  S.wb = E.ganhosBranco(S.px, S.W, S.H, x, y, 5);
  $("wbInfo").textContent = `Ganhos R/G/B: ${S.wb.map((v) => fmt(v, 2)).join(" / ")}`;
  refreshImgCanvas(); changed();
}
function refreshImgCanvas() { // aplica balanço de branco na visualização
  const g = S.img.getContext("2d"), id = g.createImageData(S.W, S.H);
  id.data.set(E.aplicarGanhos(S.px, S.wb)); g.putImageData(id, 0, 0); drawPhoto();
}

/* ------------------------------------------------- íris, textura e relevo */
let recompT = 0;
function changed() {
  updateTables(); S.dirty = true;
  clearTimeout(recompT); recompT = setTimeout(recompute, 120);
  drawPhoto();
}
function recompute() {
  if (!S.iris) return;
  S.unw = O.desenrolar(foto(), S.iris, S.pup);
  const cl = O.limparIris(S.unw, limpezaP()); S.clean = cl.c; S.mask = cl.mask;
  const pp = protParams();
  S.tex = rgbaCanvas(O.textura(S.clean, pp), TEX, TEX);
  S.texD = S.tex.getContext("2d").getImageData(0, 0, TEX, TEX).data;   // lido de volta do canvas, como na v0.2
  S.hm = O.mapaAltura(S.texD, pp, relevoP());
  updateMirrorNote(); checkShell();
  if (S.tab === "iris") drawIris();
  if (S.tab === "3d") { scheduleBuild(); }
}
function updateMirrorNote() {
  const m = protParams().mirror;
  $("mirrorNote").innerHTML = m ? "A íris da foto será <b>espelhada</b> (foto de um olho, prótese do outro), como fazem os ocularistas." : "Mesmo olho da foto: a íris <b>não</b> será espelhada.";
}
document.querySelectorAll("#s4 input, #s5 input, #s5 select, #s6 input, #s6 select, #s1 select, #hvid, #rulerMM").forEach((el) => {
  el.addEventListener(el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input", () => {
    if (el.id === "pIris") $("pIrisAuto").checked = false;
    if (el.id === "pPup") $("pPupAuto").checked = false;
    changed();
  });
});

/* ------------------------------------------------------------ vista da foto */
const pc = $("pc");
function canvasSize(cv) {
  const r = $("view").getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return { w, h, dpr };
}
function fitView() {
  const { w, h } = canvasSize(pc);
  const z = Math.min(w / S.W, h / S.H) * 0.92;
  S.view = { z, tx: (w - S.W * z) / 2, ty: (h - S.H * z) / 2 };
}
function toImg(e) {
  const r = pc.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const sx = (e.clientX - r.left) * dpr, sy = (e.clientY - r.top) * dpr;
  return { x: (sx - S.view.tx) / S.view.z, y: (sy - S.view.ty) / S.view.z, sx, sy };
}
function drawPhoto() {
  if (S.tab !== "photo" || !S.img) return;
  const { w, h, dpr } = canvasSize(pc), g = pc.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
  const { z, tx, ty } = S.view;
  g.setTransform(z, 0, 0, z, tx, ty); g.imageSmoothingQuality = "high";
  g.drawImage(S.img, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const T = (p) => [p.x * z + tx, p.y * z + ty];
  if (S.iris) {
    const [ix, iy] = T(S.iris), [px, py] = T(S.pup), ir = S.iris.r * z, pr = S.pup.r * z;
    // setores de pálpebra
    g.fillStyle = "rgba(240,140,30,.33)";
    for (const [a, b] of O.setoresPalpebra(limpezaP())) {
      g.beginPath(); g.arc(ix, iy, ir, -a * Math.PI / 180, -b * Math.PI / 180, true); g.arc(px, py, pr, -b * Math.PI / 180, -a * Math.PI / 180, false); g.closePath(); g.fill();
    }
    g.lineWidth = 2 * dpr;
    g.strokeStyle = "#2f6fdb"; g.beginPath(); g.arc(ix, iy, ir, 0, TAU); g.stroke();
    g.strokeStyle = "#e2483d"; g.beginPath(); g.arc(px, py, pr, 0, TAU); g.stroke();
    const cross = (x, y, c) => { g.strokeStyle = c; g.beginPath(); g.moveTo(x - 9 * dpr, y); g.lineTo(x + 9 * dpr, y); g.moveTo(x, y - 9 * dpr); g.lineTo(x, y + 9 * dpr); g.stroke(); };
    cross(ix, iy, "#2f6fdb"); cross(px, py, "#e2483d");
    const knob = (x, y, c) => { g.fillStyle = "#fff"; g.strokeStyle = c; g.beginPath(); g.arc(x, y, 6 * dpr, 0, TAU); g.fill(); g.stroke(); };
    knob(ix + ir, iy, "#2f6fdb"); knob(px - pr, py, "#e2483d");
  }
  if (S.ruler || S.rulerPts.length) {
    const pts = S.ruler || S.rulerPts; g.strokeStyle = "#d98a00"; g.fillStyle = "#d98a00"; g.lineWidth = 2 * dpr;
    g.beginPath(); pts.forEach((p, i) => { const [x, y] = T(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    pts.forEach((p) => { const [x, y] = T(p); g.beginPath(); g.arc(x, y, 4 * dpr, 0, TAU); g.fill(); });
  }
}
function setMode(m) { S.mode = m; pc.classList.toggle("pick", m !== "edit"); $("wbBtn").classList.toggle("on", m === "wb"); $("rulerBtn").classList.toggle("on", m === "ruler"); if (S.tab !== "photo") setTab("photo"); }
let drag = null;
pc.addEventListener("pointerdown", (e) => {
  if (!S.img) return;
  const p = toImg(e), dpr = window.devicePixelRatio || 1, tol = 10 * dpr / S.view.z;
  if (S.mode === "wb") { pickWB(p.x, p.y); setMode("edit"); status("Balanço de branco aplicado."); return; }
  if (S.mode === "ruler") {
    S.rulerPts.push({ x: p.x, y: p.y });
    if (S.rulerPts.length === 2) { S.ruler = S.rulerPts.slice(); S.rulerPts = []; setMode("edit"); status("Régua marcada. Informe a distância em mm entre os dois pontos."); changed(); }
    else status("Agora clique no segundo ponto da régua.");
    drawPhoto(); return;
  }
  let target = null;
  if (S.iris) {
    const dI = Math.hypot(p.x - S.iris.x, p.y - S.iris.y), dP = Math.hypot(p.x - S.pup.x, p.y - S.pup.y);
    if (dP < tol * 1.2) target = "pc";
    else if (dI < tol * 1.2) target = "ic";
    else if (Math.abs(dP - S.pup.r) < tol) target = "pr";
    else if (Math.abs(dI - S.iris.r) < tol) target = "ir";
  }
  drag = { target, x: e.clientX, y: e.clientY, tx: S.view.tx, ty: S.view.ty, p0: p, i0: S.iris && { ...S.iris }, q0: S.pup && { ...S.pup } };
  pc.setPointerCapture(e.pointerId);
});
pc.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const p = toImg(e), dpr = window.devicePixelRatio || 1;
  const conc = $("concentric").checked;
  switch (drag.target) {
    case "ic": S.iris.x = drag.i0.x + p.x - drag.p0.x; S.iris.y = drag.i0.y + p.y - drag.p0.y; if (conc) { S.pup.x = S.iris.x; S.pup.y = S.iris.y; } break;
    case "pc": if (!conc) { S.pup.x = drag.q0.x + p.x - drag.p0.x; S.pup.y = drag.q0.y + p.y - drag.p0.y; } break;
    case "ir": S.iris.r = Math.max(S.pup.r * 1.15, Math.hypot(p.x - S.iris.x, p.y - S.iris.y)); break;
    case "pr": S.pup.r = clamp(Math.hypot(p.x - S.pup.x, p.y - S.pup.y), 2, S.iris.r * 0.88); break;
    default: S.view.tx = drag.tx + (e.clientX - drag.x) * dpr; S.view.ty = drag.ty + (e.clientY - drag.y) * dpr; drawPhoto(); return;
  }
  updateTables(); drawPhoto();
});
pc.addEventListener("pointerup", () => { if (drag && drag.target) changed(); drag = null; });
pc.addEventListener("dblclick", (e) => { if (S.img) { const p = toImg(e); detect(p); } });
pc.addEventListener("wheel", (e) => {
  if (!S.img) return; e.preventDefault();
  const p = toImg(e), f = Math.exp(-e.deltaY * 0.0015), z = clamp(S.view.z * f, 0.05, 40);
  S.view.tx = p.sx - p.x * z; S.view.ty = p.sy - p.y * z; S.view.z = z; drawPhoto();
}, { passive: false });

/* ---------------------------------------------------------- vista da íris */
const shadeHM = (h) => rgbaCanvas(O.sombrearRelevo(h, protParams(), pupilaP()), HM, HM);
function drawIris() {
  const cv = $("ic"), { w, h, dpr } = canvasSize(cv), g = cv.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
  if (!S.clean) return;
  const pad = 20 * dpr, top = 84 * dpr, bottomPad = 100 * dpr;
  const label = (t, x, y) => { g.fillStyle = "#5B5573"; g.font = `600 ${11 * dpr}px "IBM Plex Mono", monospace`; g.fillText(t, x, y); };
  // faixa desenrolada: original em cima, limpa embaixo
  const stripW = w - 2 * pad, stripH = Math.min((h - top - bottomPad) * 0.16, stripW / NT * NR * 0.5);
  const mk = (arr, mask) => rgbaCanvas(O.desenroladaRGBA(arr, mask), NT, NR);
  let y = top;
  label("ÍRIS DESENROLADA — FOTO (rosa = reflexo removido, laranja = setor substituído)   0° → 360°", pad, y - 8 * dpr);
  g.drawImage(mk(S.unw, S.mask), pad, y, stripW, stripH); y += stripH + 26 * dpr;
  label("ÍRIS DESENROLADA — LIMPA E CORRIGIDA", pad, y - 8 * dpr);
  g.drawImage(mk(S.clean), pad, y, stripW, stripH); y += stripH + 34 * dpr;
  // textura e relevo
  const side = Math.min((w - 3 * pad) / 2, h - y - bottomPad);
  if (side > 40) {
    label(`TEXTURA DA PRÓTESE (Ø ${fmt(num("pIris"), 1)} mm${protParams().mirror ? ", espelhada" : ""})`, pad, y - 8 * dpr);
    g.fillStyle = "#e9e4dc"; g.fillRect(pad, y, side, side);
    g.drawImage(S.tex, pad, y, side, side);
    label("RELEVO (iluminação rasante)", 2 * pad + side, y - 8 * dpr);
    g.drawImage(shadeHM(S.hm), 2 * pad + side, y, side, side);
  }
}

/* -------------------------------------------------------------- abas */
document.querySelectorAll("#tabs button").forEach((b) => b.onclick = () => setTab(b.dataset.t));
function setTab(t) {
  S.tab = t;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("cur", b.dataset.t === t));
  $("pc").hidden = t !== "photo"; $("ic").hidden = t !== "iris"; $("gl").hidden = t !== "3d"; $("tools3d").hidden = t !== "3d";
  if (!S.img) return;
  if (t === "photo") drawPhoto();
  if (t === "iris") { if (S.dirty) recompute(); drawIris(); status("Confira a íris desenrolada: reflexos (rosa) e setores de pálpebra (laranja) devem cobrir só o que não é íris. Ajuste na etapa 4 e o relevo na etapa 5."); }
  if (t === "3d") { if (!S.meshes) buildModel(); else drawGL(); }
}
window.addEventListener("resize", () => { if (S.tab === "photo") drawPhoto(); else if (S.tab === "iris") drawIris(); else drawGL(); });

/* ============================================================ GEOMETRIA 3D */
$("sMode").addEventListener("change", () => { const sh = $("sMode").value === "shell"; $("shellBox").hidden = !sh; $("solidBox").hidden = sh; });
function checkShell() {
  const r = O.verificarCasca(geomParams(), formaP());
  $("shellWarn").innerHTML = r.avisos.length ? `<div class="warnbox">${r.avisos.join("<br>")}</div>` : `<div class="okbox">${r.ok}</div>`;
  return { minT: r.minT, minR: r.minR };
}
const buildMeshes = (hi) => O.malhas(geomParams(), formaP(), { hm: S.hm, tex: S.texD, hi, hTrans: num("hTrans"), pupila: pupilaP() });

/* ------------------------------------------------------------ visualizador (blocos WebGL do núcleo) */
const gl = $("gl").getContext("webgl", { antialias: true, preserveDrawingBuffer: true });
let prog, cam = { yaw: -0.5, pitch: 0.45, dist: 70, tx: 0, ty: 0 }, glBufs = {};
function initGL() {
  if (!gl || prog) return;
  const vs = `attribute vec3 p;attribute vec3 n;attribute vec3 c;uniform mat4 mvp;uniform mat4 mv;varying vec3 vn;varying vec3 vc;varying vec3 vp;
  void main(){gl_Position=mvp*vec4(p,1.);vn=(mv*vec4(n,0.)).xyz;vp=(mv*vec4(p,1.)).xyz;vc=c;}`;
  const fs = `precision mediump float;varying vec3 vn;varying vec3 vc;varying vec3 vp;uniform float useC;
  void main(){vec3 N=normalize(vn);if(!gl_FrontFacing)N=-N;vec3 V=normalize(-vp);
  vec3 L1=normalize(vec3(.4,.6,1.)),L2=normalize(vec3(-.7,-.2,.5));vec3 base=mix(vec3(.82,.80,.86),vc,useC);
  float d=max(dot(N,L1),0.)*.75+max(dot(N,L2),0.)*.25;vec3 H=normalize(L1+V);float sp=pow(max(dot(N,H),0.),60.)*.35;
  gl_FragColor=vec4(base*(.28+.8*d)+vec3(sp),1.);}`;
  prog = UI.compilarPrograma(gl, vs, fs);
}
function upload(name, m) {
  if (!gl) return;
  if (glBufs[name]) UI.apagarMalha(gl, glBufs[name]);
  glBufs[name] = UI.enviarMalha(gl, m.pos, E.normaisDeFace(m.pos), m.col);
}
function drawGL() {
  if (!gl || S.tab !== "3d" || !S.meshes) return;
  initGL();
  const cv = $("gl"), { w, h } = canvasSize(cv);
  gl.viewport(0, 0, w, h); gl.clearColor(0.957, 0.949, 0.976, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
  gl.useProgram(prog);
  const P = UI.perspectiva(0.6, w / h, 1, 500), m = UI.multiplicar4;
  const zc = -geomParams().depth / 2 - 2;
  const MV = m(UI.translacao(cam.tx, cam.ty, -cam.dist), m(UI.rotacaoX(cam.pitch), m(UI.rotacaoY(cam.yaw), UI.translacao(0, 0, -zc))));
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, "mvp"), false, m(P, MV));
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, "mv"), false, MV);
  gl.uniform1f(gl.getUniformLocation(prog, "useC"), $("vC").checked ? 1 : 0);
  const vis = { sclera: $("vS").checked, iris: $("vI").checked, pupil: $("vP").checked };
  for (const k of ["sclera", "iris", "pupil"]) { const b = glBufs[k]; if (!b || !vis[k]) continue; UI.desenharMalha(gl, prog, b); }
}
(() => {
  const cv = $("gl"); let d = null;
  cv.addEventListener("pointerdown", (e) => { d = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY;
    if (d.pan) { cam.tx += dx * cam.dist * 0.0012; cam.ty -= dy * cam.dist * 0.0012; } else { cam.yaw += dx * 0.008; cam.pitch = clamp(cam.pitch + dy * 0.008, -3.1, 3.1); }
    drawGL();
  });
  cv.addEventListener("pointerup", () => d = null);
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  cv.addEventListener("wheel", (e) => { e.preventDefault(); cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.0012), 15, 300); drawGL(); }, { passive: false });
})();
const VIEWS = { front: [0, 0], three: [-0.55, 0.45], side: [-1.5708, 0.05], back: [Math.PI, 0] };
document.querySelectorAll("#tools3d button").forEach((b) => b.onclick = () => { const v = VIEWS[b.dataset.v]; cam.yaw = v[0]; cam.pitch = v[1]; cam.tx = cam.ty = 0; drawGL(); });
["vS", "vI", "vP", "vC"].forEach((id) => $(id).onchange = drawGL);

let buildT = 0;
function scheduleBuild() { clearTimeout(buildT); buildT = setTimeout(buildModel, 350); }
function buildModel() {
  if (!S.iris) return;
  if (S.dirty || !S.tex) recompute();
  busy(true, "Gerando o modelo 3D…");
  setTimeout(() => {
    S.meshes = buildMeshes(false);
    S.dirty = false;
    for (const k of ["sclera", "iris", "pupil"]) upload(k, S.meshes[k]);
    busy(false);
    if (S.tab !== "3d") setTab("3d"); else drawGL();
    const t = S.meshes.sclera.ntri + S.meshes.iris.ntri + S.meshes.pupil.ntri;
    status(`Modelo gerado: ${(t / 1000).toFixed(0)} mil triângulos (prévia). Arraste para girar, Shift ou botão direito para mover, roda para zoom. Ao exportar, a íris é gerada na resolução escolhida.`);
  }, 30);
}
$("build").onclick = () => { setTab("3d"); buildModel(); };

/* ---------------------------------------------------------------- exportação */
const stlBytes = (parts) => E.stlTriangulos(parts, O.CABECALHO_STL);
const canvasPNG = (cv) => new Promise((res) => cv.toBlob((b) => b.arrayBuffer().then((a) => res(new Uint8Array(a))), "image/png"));
function heightPNG(h) { const r = O.alturaRGBA(h); return { c: rgbaCanvas(r.data, HM, HM), mx: r.mx }; }
const unwPNG = (arr) => rgbaCanvas(O.desenroladaRGBA(arr), NT, NR);
function params() {
  const ids = ["photoSide", "protSide", "hvid", "rulerMM", "specOn", "specThr", "upOn", "upA", "upB", "loOn", "loA", "loB", "cBri", "cCon", "cSat", "hBase", "hDepth", "hDetail", "hSmooth", "hInv", "hLimbus", "pupMode", "pupH", "pIris", "pPup", "hTrans", "sMode", "sShell", "sW", "sH", "sT", "sRF", "sRB", "sIns", "sDx", "sDy", "res"];
  const o = { app: "EITA! OLHO v0.2", data: new Date().toISOString(), escala: scaleMode, foto: { largura: S.W, altura: S.H, iris_px: S.iris, pupila_px: S.pup, regua_px: S.ruler, balanco_branco: S.wb } };
  ids.forEach((id) => { const el = $(id); o[id] = el.type === "checkbox" ? el.checked : (el.type === "number" ? parseFloat(el.value) : el.value); });
  o.medidas_mm = measured();
  return o;
}
async function buildPackage() {
  if (S.dirty || !S.tex) recompute();
  const M = buildMeshes($("res").value === "h");
  const stl = { esc: stlBytes([M.sclera]), iri: stlBytes([M.iris]), pup: stlBytes([M.pupil]) };
  const all = stlBytes([M.sclera, M.iris, M.pupil]);
  const hp = heightPNG(S.hm), p = params();
  p.altura_max_mapa_mm = hp.mx; p.triangulos = { esclera: M.sclera.ntri, iris: M.iris.ntri, pupila: M.pupil.ntri };
  p.volume_mm3 = { esclera: M.sclera.vol, iris: M.iris.vol, pupila: M.pupil.vol };
  const enc = new TextEncoder();
  const leia = `EITA! OLHO — Lab.EITA/UFG\nGerado em ${new Date().toLocaleString("pt-BR")}\n\nUnidades: milímetros. Eixo Z = frente da prótese. Origem no centro da íris.\n\nesclera.stl            casca com o encaixe da íris (rebaixo de ${p.sIns} mm)\niris.stl               íris em relevo (anel entre a pupila e o limbo)\npupila.stl             pupila\nprotese_completa.stl   as três peças juntas, já alinhadas\niris_textura.png       cor da íris, ${TEX}×${TEX} px = Ø ${fmt(p.pIris, 2)} mm (fundo transparente)\niris_relevo.png        mapa de alturas, branco = ${fmt(hp.mx, 3)} mm acima da esclera\niris_desenrolada.png   íris limpa, desenrolada (0° a 360°, limbo em cima)\nparametros.json        todos os ajustes usados\nrelatorio.pdf          relatório de fabricação (paciente, medidas e parâmetros)\nficha.json             ficha do paciente (abrir no EITA! OLHO com a mesma foto)\n\nÍris Ø ${fmt(p.pIris, 2)} mm · pupila Ø ${fmt(p.pPup, 2)} mm · ${p.protSide === "D" ? "olho direito" : "olho esquerdo"}${protParams().mirror ? " (íris espelhada da foto)" : ""}\n\nProtótipo de pesquisa: o verso é uma calota esférica genérica. O encaixe na cavidade, o acabamento\ne a camada transparente continuam com o ocularista.\n`;
  const files = [
    { name: "protese_completa.stl", data: all }, { name: "esclera.stl", data: stl.esc }, { name: "iris.stl", data: stl.iri }, { name: "pupila.stl", data: stl.pup },
    { name: "iris_textura.png", data: await canvasPNG(S.tex) }, { name: "iris_relevo.png", data: await canvasPNG(hp.c) }, { name: "iris_desenrolada.png", data: await canvasPNG(unwPNG(S.clean)) },
    { name: "parametros.json", data: enc.encode(JSON.stringify(p, null, 2)) }, { name: "LEIAME.txt", data: enc.encode(leia) },
  ];
  files.push(...await extraPackageFiles(M));
  return { zip: await E.zip(Object.fromEntries(files.map((f) => [f.name, f.data]))), M, files };
}
window.__eitaPackage = buildPackage; // usado nos testes
$("exp").onclick = async () => {
  if (!S.iris) return;
  busy(true, "Gerando os arquivos…");
  await new Promise((r) => setTimeout(r, 30));
  try {
    const { zip, M } = await buildPackage();
    busy(false);
    const ok = await save(`${exportBase()}.zip`, zip);
    const t = M.sclera.ntri + M.iris.ntri + M.pupil.ntri;
    $("expInfo").innerHTML = `<div class="${ok ? "okbox" : "note"}">${ok ? "Pacote salvo." : "Pacote gerado."} ${(zip.size / 1048576).toFixed(1)} MB · ${(t / 1000).toFixed(0)} mil triângulos.</div>`;
    if (ok) status("Pacote salvo. Abra o protese_completa.stl no fatiador, ou as peças separadas para multicolor.");
  } catch (e) { busy(false); status("Erro ao gerar os arquivos: " + e.message); }
};
$("expTex").onclick = async () => { if (!S.tex) recompute(); if (S.tex) save("iris_textura.png", await new Promise((r) => S.tex.toBlob(r, "image/png"))); };

/* ================================================================ FICHA (núcleo: ficha.js) */
const PAT_IDS = ["pName", "pId", "pBirth", "pSex", "pEye", "pSurg", "pSurgDate", "pDiag", "pImpl", "pPrev", "pProf", "pNotes"];
const INPUT_IDS = ["photoSide", "protSide", "hvid", "rulerMM", "concentric", "specOn", "specThr", "upOn", "upA", "upB", "loOn", "loA", "loB", "cBri", "cCon", "cSat",
  "hBase", "hDepth", "hDetail", "hSmooth", "hInv", "hTrans", "hLimbus", "pupMode", "pupH", "pIrisAuto", "pIris", "pPupAuto", "pPup",
  "sW", "sH", "sMode", "sRF", "sShell", "sT", "sRB", "sIns", "sDx", "sDy", "res"];
const SURG = { enucleacao: "enucleação", evisceracao: "evisceração", exenteracao: "exenteração", congenita: "anoftalmia / microftalmia congênita", phthisis: "olho atrófico (phthisis bulbi)", outra: "outra" };
const PREV = { nenhuma: "nenhuma (primeira prótese)", conformador: "conformador", pre: "pré-fabricada", medida: "sob medida (PMMA)", outra: "outra" };
const FICHAS = E.criarArmazemFichas({ chave: "eitaOLHO.fichas.v1", formatoFicha: "EITA! OLHO ficha", formatoBase: "EITA! OLHO base", rotulo: "EITA! OLHO",
  nomeBase: (d) => `eita-olho_base_${d.toISOString().slice(0, 10)}.json` });
const esc = E.escaparHTML, ageText = (d) => E.idadeTexto(d, new Date(), { meses: true });
let pendingFicha = null;

function readPatient() { const o = {}; PAT_IDS.forEach((id) => { o[id] = $(id).value.trim(); }); return o; }
function writePatient(p) {
  PAT_IDS.forEach((id) => { if (id !== "pEye") $(id).value = (p && p[id]) || ""; });
  if (p && p.pEye) { $("pEye").value = p.pEye; }
  updAge();
}
function updAge() {
  const a = ageText($("pBirth").value);
  $("pAge").textContent = a ? "Idade: " + a : "";
  const n = $("pName").value.trim() || $("pId").value.trim();
  $("pBadge").textContent = n ? "· " + n : "";
}
function readInputs() {
  const o = {};
  INPUT_IDS.forEach((id) => { const el = $(id); if (el) o[id] = el.type === "checkbox" ? el.checked : el.value; });
  return o;
}
function writeInputs(o) {
  // primeiro as caixas "usar o medido", para não sobrescreverem os diâmetros
  ["pIrisAuto", "pPupAuto"].forEach((id) => { if (id in (o || {})) $(id).checked = !!o[id]; });
  for (const [id, v] of Object.entries(o || {})) {
    const el = $(id); if (!el) continue;
    if (el.type === "checkbox") el.checked = !!v; else el.value = v;
    const r = $(id + "R"); if (r) r.value = v;
  }
  $("sMode").dispatchEvent(new Event("change"));
  $("pEye").value = $("protSide").value;
}
// identificador legível para nomes de arquivo: código ou nome, sem acentos, minúsculo, com hífens
function slug(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function fichaBase() { return slug(($("pId").value || $("pName").value || "").trim()); }
function fichaKey() { const b = fichaBase(); return b ? b + "_" + $("protSide").value : "p" + Date.now().toString(36); }
function exportBase() {
  const b = fichaBase() || "eita-olho";
  return `${b}_${$("protSide").value === "D" ? "OD" : "OE"}_${new Date().toISOString().slice(0, 10)}`;
}
function thumb() {
  if (!S.tex) return null;
  const c = document.createElement("canvas"); c.width = c.height = 96;
  const g = c.getContext("2d"); g.fillStyle = "#ece6dc"; g.fillRect(0, 0, 96, 96); g.drawImage(S.tex, 4, 4, 88, 88);
  return c.toDataURL("image/jpeg", 0.8);
}
function resultSummary() {
  if (!S.iris) return null;
  const m = measured(), pp = protParams();
  return { iris_medida_mm: +m.iris.toFixed(2), pupila_medida_mm: +m.pup.toFixed(2), iris_mm: pp.Di, pupila_mm: pp.Dp, espelhada: pp.mirror };
}
function collectFicha() {
  return {
    formato: "EITA! OLHO ficha", versaoApp: "0.2", id: fichaKey(), olho: $("protSide").value,
    nome: $("pName").value.trim() || $("pId").value.trim(), paciente: readPatient(), atualizado: new Date().toISOString(),
    foto: S.img ? { nome: S.photoName || "", largura: S.W, altura: S.H } : null,
    estado: S.iris ? { iris: S.iris, pupila: S.pup, regua: S.ruler, balancoBranco: S.wb, escala: scaleMode } : null,
    entradas: readInputs(), resultado: resultSummary(), miniatura: thumb(),
  };
}
function saveFicha(silent) {
  const f = collectFicha();
  if (!f.nome) { if (!silent) { status("Dê um nome ou código à ficha antes de salvar."); openSection("s0"); $("pName").focus(); } return false; }
  let ok = FICHAS.salvar(f);
  if (!ok) { f.miniatura = null; ok = FICHAS.salvar(f); }   // navegador cheio: tenta sem a miniatura
  S.patient = { id: f.id, name: f.nome };
  if (!silent) status(ok ? `Ficha "${esc(f.nome)}" salva neste navegador. Use "Exportar" para guardar uma cópia em arquivo.` : 'Não foi possível salvar no navegador; use "Exportar".');
  renderFichas();
  return ok;
}
function autoUpdateFicha() { // ao exportar, atualiza a ficha se ela já existe
  const id = fichaKey();
  if (fichaBase() && FICHAS.listar().some((x) => x.id === id)) saveFicha(true);
}
function renderFichas() {
  const box = $("fList"), l = FICHAS.listar(), cur = S.patient && S.patient.id;
  if (!l.length) { box.innerHTML = '<div class="note">Nenhuma ficha salva neste navegador.</div>'; return; }
  box.innerHTML = l.map((f, i) => `<div class="frow${f.id === cur ? " cur" : ""}">${f.miniatura ? `<img src="${f.miniatura}" alt="">` : '<img alt="">'}<div><b>${esc(f.nome || "(sem nome)")}</b><small>${f.olho === "E" ? "OE" : "OD"} · ${new Date(f.atualizado).toLocaleDateString("pt-BR")}${f.foto && f.foto.nome ? " · " + esc(f.foto.nome) : ""}</small></div><button type="button" data-open="${i}">Abrir</button><button type="button" data-del="${i}" title="Excluir">×</button></div>`).join("");
  box.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => openFicha(FICHAS.listar()[+b.dataset.open]));
  box.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => {
    const f = FICHAS.listar()[+b.dataset.del];
    if (!confirm(`Excluir a ficha "${f.nome || ""}" deste navegador?`)) return;
    FICHAS.excluir(+b.dataset.del); renderFichas();
  });
}
function openFicha(f) {
  if (!FICHAS.ehFicha(f)) { status("Arquivo de ficha não reconhecido."); return; }
  writePatient(f.paciente || { pName: f.nome || "" });
  writeInputs(f.entradas);
  S.patient = { id: f.id, name: f.nome };
  renderFichas(); openSection("s0");
  const same = S.img && f.foto && f.foto.largura === S.W && f.foto.altura === S.H && (!f.foto.nome || f.foto.nome === S.photoName);
  if (same) { applyState(f); return; }
  if (S.iris) changed();
  pendingFicha = f;
  status(`Ficha "${esc(f.nome)}" aberta: dados do paciente e ajustes restaurados.${f.foto && f.foto.nome ? ` Carregue a foto <b>${esc(f.foto.nome)}</b> (etapa 1) para restaurar também os círculos, a escala e o balanço de branco.` : ""}`);
}
function applyState(f) {
  pendingFicha = null;
  const e = f.estado;
  if (e) {
    const btn = document.querySelector(`#scaleMode button[data-v="${e.escala || "hvid"}"]`); if (btn) btn.click();
    if (e.balancoBranco) { S.wb = e.balancoBranco.slice(); $("wbInfo").textContent = `Ganhos R/G/B: ${S.wb.map((v) => fmt(v, 2)).join(" / ")}`; refreshImgCanvas(); }
    if (f.foto && f.foto.largura === S.W && f.foto.altura === S.H) {
      S.iris = { ...e.iris }; S.pup = { ...e.pupila }; S.ruler = e.regua ? e.regua.map((p) => ({ ...p })) : null;
    }
  }
  writeInputs(f.entradas);
  afterCircles(true);
  status(`Ficha "${esc(f.nome)}" aplicada: círculos, escala, cor e parâmetros da prótese restaurados.`);
}
function onPhotoReady() {
  if (!pendingFicha) return;
  const f = pendingFicha;
  if (f.foto && (f.foto.largura !== S.W || f.foto.altura !== S.H)) {
    pendingFicha = null; writeInputs(f.entradas); changed();
    status(`A foto carregada não é a mesma da ficha "${esc(f.nome)}" (${f.foto.largura} × ${f.foto.altura} px). Os ajustes foram mantidos, mas a íris e a pupila foram detectadas de novo — confira os círculos.`);
    return;
  }
  applyState(f);
}
function newFicha() {
  writePatient({}); S.patient = null; pendingFicha = null; $("pEye").value = $("protSide").value;
  renderFichas(); status("Ficha em branco. Preencha os dados do paciente e salve."); $("pName").focus();
}
async function exportFicha() {
  const f = collectFicha();
  if (!f.nome) { status("Dê um nome ou código à ficha antes de exportar."); $("pName").focus(); return; }
  if (await save(`${fichaBase()}_${f.olho === "E" ? "OE" : "OD"}_ficha_OLHO.json`, new Blob([JSON.stringify(f, null, 1)], { type: "application/json" }))) status("Ficha exportada.");
}
const readJSONFile = (file) => file.text().then((t) => JSON.parse(t));
async function importFichaFile(file) {
  try {
    const j = await readJSONFile(file);
    if (j && j.formato === FICHAS.formatoBase) { mergeBase(j); return; }
    openFicha(j);
  } catch (e) { status("Não consegui ler esse arquivo de ficha."); }
}
function mergeBase(j) {
  const r = FICHAS.importarBase({ formato: FICHAS.formatoBase, fichas: j.fichas || [] });
  status(r.gravou ? `Base importada: ${r.novas} ficha(s) nova(s), ${r.atualizadas} atualizada(s).` : "Não foi possível gravar a base neste navegador (espaço cheio?).");
  renderFichas();
}
async function dbExport() {
  const n = FICHAS.listar().length;
  if (!n) { status("Não há fichas salvas neste navegador."); return; }
  const b = FICHAS.exportarBase();
  if (await save(b.nome, new Blob([b.conteudo], { type: "application/json" }))) status(`Base exportada com ${n} ficha(s).`);
}

$("fSave").onclick = () => saveFicha(false);
$("fNew").onclick = newFicha;
$("fExp").onclick = exportFicha;
$("fImpB").onclick = () => $("fImp").click();
$("fImp").onchange = () => { const f = $("fImp").files[0]; if (f) importFichaFile(f); $("fImp").value = ""; };
$("dbExp").onclick = dbExport;
$("dbImpB").onclick = () => $("dbImp").click();
$("dbImp").onchange = async () => {
  const f = $("dbImp").files[0]; $("dbImp").value = ""; if (!f) return;
  try { const j = await readJSONFile(f); if (j.formato === FICHAS.formatoBase) mergeBase(j); else if (j.formato === FICHAS.formatoFicha) mergeBase({ fichas: [j] }); else status("Arquivo de base não reconhecido."); }
  catch (e) { status("Não consegui ler esse arquivo de base."); }
};
["pBirth", "pName", "pId"].forEach((id) => $(id).addEventListener("input", updAge));
$("pEye").addEventListener("change", () => { $("protSide").value = $("pEye").value; $("protSide").dispatchEvent(new Event("change")); });
$("protSide").addEventListener("change", () => { $("pEye").value = $("protSide").value; });
$("pEye").value = $("protSide").value;

/* ================================================================ RELATÓRIO PDF (núcleo: pdf.js) */
const pdfW = E.larguraTexto, fit = E.cortarTexto;
function sq(n = 640, bg = "#ffffff") { const c = document.createElement("canvas"); c.width = c.height = n; const g = c.getContext("2d"); g.fillStyle = bg; g.fillRect(0, 0, n, n); return [c, g]; }
const jpegOf = (cv, q = 0.9) => UI.jpegDe(cv, q);
/* imagens do relatório */
function imgPhoto() {
  const I = S.iris, P = S.pup, half = I.r * 1.7, [c, g] = sq();
  g.drawImage(S.img, I.x - half, I.y - half, 2 * half, 2 * half, 0, 0, 640, 640);
  const k = 640 / (2 * half), T = (p) => [(p.x - I.x + half) * k, (p.y - I.y + half) * k];
  g.lineWidth = 3;
  g.strokeStyle = "#2f6fdb"; g.beginPath(); g.arc(...T(I), I.r * k, 0, TAU); g.stroke();
  g.strokeStyle = "#e2483d"; g.beginPath(); g.arc(...T(P), P.r * k, 0, TAU); g.stroke();
  return jpegOf(c);
}
function imgTexture() { const [c, g] = sq(640, "#ece6dc"); g.drawImage(S.tex, 24, 24, 592, 592); return jpegOf(c); }
function imgRelief() { const [c, g] = sq(); g.drawImage(shadeHM(S.hm), 24, 24, 592, 592); return jpegOf(c); }
function img3D(views) {
  if (!gl) return [];
  if (S.dirty || !S.meshes) { recompute(); S.meshes = buildMeshes(false); S.dirty = false; for (const k of ["sclera", "iris", "pupil"]) upload(k, S.meshes[k]); }
  const c0 = { ...cam }, tab = S.tab, vis = ["vS", "vI", "vP", "vC"].map((id) => $(id).checked);
  ["vS", "vI", "vP", "vC"].forEach((id) => $(id).checked = true);
  S.tab = "3d";
  const out = [], cv = $("gl");
  for (const [yaw, pitch] of views) {
    Object.assign(cam, { yaw, pitch, tx: 0, ty: 0, dist: 40 }); drawGL();
    const w = cv.width, h = cv.height, m = Math.min(w, h), [c, g] = sq(640, "#f4f2f9");
    g.drawImage(cv, (w - m) / 2, (h - m) / 2, m, m, 0, 0, 640, 640);
    out.push(jpegOf(c));
  }
  Object.assign(cam, c0); ["vS", "vI", "vP", "vC"].forEach((id, i) => $(id).checked = vis[i]);
  S.tab = tab; if (tab === "3d") drawGL();
  return out;
}

async function buildReport(M) {
  if (!S.iris) return null;
  if (S.dirty || !S.tex) recompute();
  M = M || buildMeshes($("res").value === "h");
  const P = readPatient(), m = measured(), pp = protParams(), G = geomParams(), p = params();
  const shots = [imgPhoto(), imgTexture(), imgRelief(), ...img3D([[-0.55, 0.45]])];
  const imgs = shots.map((im, i) => Object.assign({ name: "Im" + (i + 1) }, im));
  const logo = await UI.logoJpeg("assets/eita-olho-simbolo.png"); if (logo) imgs.push(Object.assign({ name: "Lg" }, logo));

  const C = E.CORES_PDF, MUT = C.sutil, INK = C.tinta, ACC = C.roxo, LINE = C.linha;
  const wrap = (t, sz, w, maxL) => {
    const words = String(t).replace(/\s+/g, " ").trim().split(" "), L = []; let cur = "";
    for (const wd of words) { const tr = cur ? cur + " " + wd : wd; if (pdfW(tr, sz) > w && cur) { L.push(cur); cur = wd; } else cur = tr; }
    if (cur) L.push(cur);
    if (L.length > maxL) { L.length = maxL; L[maxL - 1] = fit(L[maxL - 1] + "…", sz, w); }
    return L;
  };
  const D = (v, d = 1) => v == null || !Number.isFinite(+v) ? "—" : (+v).toFixed(d).replace(".", ",");
  const now = new Date();
  // cabeçalho e paciente (layout Lab.EITA do núcleo)
  const R = E.criarRelatorioPDF({ app: ["EITA!", "OLHO"], subtitulo: "Relatório de fabricação · prótese ocular · Lab.EITA / UFG", logo: logo ? "Lg" : null,
    dataTexto: now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), pacienteTexto: P.pName || P.pId || "Paciente sem ficha" });
  const pg = R.pg;
  R.secao("Paciente");
  const bd = P.pBirth ? new Date(P.pBirth + "T12:00:00").toLocaleDateString("pt-BR") : "", age = ageText(P.pBirth);
  R.campo(36, 170, "Nome", P.pName); R.campo(206, 100, "Prontuário / código", P.pId); R.campo(306, 175, "Nascimento", bd ? bd + (age ? " · " + age : "") : ""); R.campo(481, 78, "Sexo", { F: "feminino", M: "masculino", O: "outro" }[P.pSex]);
  R.y -= 25;
  R.campo(36, 100, "Olho da prótese", $("protSide").value === "D" ? "direito (OD)" : "esquerdo (OE)"); R.campo(136, 170, "Cavidade", SURG[P.pSurg]);
  R.campo(306, 90, "Data da cirurgia", P.pSurgDate ? new Date(P.pSurgDate + "T12:00:00").toLocaleDateString("pt-BR") : ""); R.campo(396, 163, "Implante orbital", P.pImpl);
  R.y -= 25;
  R.campo(36, 270, "Causa da perda / diagnóstico", P.pDiag); R.campo(306, 253, "Prótese anterior", PREV[P.pPrev]);
  R.y -= 25;
  R.campo(36, 270, "Ocularista / profissional responsável", P.pProf);
  let y = R.y;
  pg.text(306, y, 7.6, "Observações", false, MUT);
  const obs = P.pNotes ? wrap(P.pNotes, 8.6, 250, 3) : ["—"];
  obs.forEach((l, i) => pg.text(306, y - 10 - i * 10.5, 8.6, l, i === 0 && !P.pNotes, INK));
  y -= 18 + Math.max(0, obs.length - 1) * 10.5;

  // imagens
  const S4 = 120, gap = (523 - 4 * S4) / 3, iy = y - 8 - S4;
  const caps = ["Foto e círculos detectados", "Textura da íris" + (pp.mirror ? " (espelhada)" : ""), "Relevo (luz rasante)", "Modelo 3D"];
  imgs.slice(0, 4).forEach((im, i) => { if (im.name === "Lg") return; const x = 36 + i * (S4 + gap); pg.image(im.name, x, iy, S4, S4); pg.text(x, iy - 10, 7.4, fit(caps[i], 7.4, S4), false, MUT); });
  y = iy - 30;

  // tabelas em duas colunas
  const table = (x, y0, title, rows) => E.tabelaPDF(pg, x, y0, title, rows, { tam: 8.6, passo: 12.6, largValor: 120 });
  const shell = checkShell(), rho = O.contornoRho(180, formaP()); let maxR = 0; for (const r of rho) maxR = Math.max(maxR, r);
  const sag = G.mode === "shell" ? -G.back(Math.min(maxR, G.RF - G.SH - 0.3)) : null;
  const yA = table(36, y, "Fotografia e medidas", [
    ["Arquivo da foto", fit(S.photoName || "—", 8.6, 120)],
    ["Olho fotografado", p.photoSide === "D" ? "direito (OD)" : "esquerdo (OE)"],
    ["Resolução usada", `${S.W} × ${S.H} px`],
    ["Escala", scaleMode === "ruler" && S.ruler ? `régua (${D(p.rulerMM, 1)} mm)` : `Ø da íris = ${D(p.hvid, 1)} mm`],
    ["Resolução da foto na íris", `${D(m.k * 1000, 1)} µm/px`],
    ["Íris medida (Ø)", D(m.iris, 2) + " mm"],
    ["Pupila medida (Ø)", D(m.pup, 2) + " mm"],
    ["Pupila / íris", D(S.pup.r / S.iris.r, 2)],
    ["Descentração da pupila", D(Math.hypot(S.pup.x - S.iris.x, S.pup.y - S.iris.y) * m.k, 2) + " mm"],
    ["Balanço de branco (R/G/B)", S.wb.every((v) => v === 1) ? "não aplicado" : S.wb.map((v) => D(v, 2)).join(" / ")],
  ]);
  const yB = table(304, y, "Prótese", [
    ["Olho", $("protSide").value === "D" ? "direito (OD)" : "esquerdo (OE)"],
    ["Íris da foto espelhada", pp.mirror ? "sim" : "não"],
    ["Íris / pupila (Ø)", `${D(pp.Di, 2)} / ${D(pp.Dp, 2)} mm`],
    ["Contorno (largura × altura)", `${D(p.sW, 1)} × ${D(p.sH, 1)} mm`],
    ["Verso", G.mode === "shell" ? `casca de ${D(G.SH, 1)} mm` : `maciço · ${D(G.T, 1)} mm no centro`],
    ["Raio anterior" + (G.mode === "shell" ? "" : " / posterior"), G.mode === "shell" ? D(G.RF, 1) + " mm" : `${D(G.RF, 1)} / ${D(G.RB, 1)} mm`],
    ["Encaixe da íris", D(G.INS, 1) + " mm"],
    ["Íris deslocada (nasal / cima)", `${D(p.sDx, 1)} / ${D(p.sDy, 1)} mm`],
    [G.mode === "shell" ? "Profundidade da casca" : "Espessura mínima na borda", G.mode === "shell" ? D(sag, 1) + " mm" : D(shell.minT, 2) + " mm"],
    ["Distância mínima íris–borda", D(shell.minR - G.RI, 1) + " mm"],
  ]);
  y = Math.min(yA, yB) - 10;
  const sect = (on, a, b) => on ? `${D(a, 0)}° a ${D(b, 0)}°` : "não";
  const yC = table(36, y, "Íris: limpeza e relevo", [
    ["Reflexos removidos", p.specOn ? `sim (limiar ${D(p.specThr, 2)})` : "não"],
    ["Setor superior substituído", sect(p.upOn, p.upA, p.upB)],
    ["Setor inferior substituído", sect(p.loOn, p.loA, p.loB)],
    ["Brilho / contraste / saturação", `${D(p.cBri, 2)} / ${D(p.cCon, 2)} / ${D(p.cSat, 2)}`],
    ["Altura base / relevo", `${D(p.hBase, 2)} / ${D(p.hDepth, 2)} mm`],
    ["Detalhes / suavização", `${D(p.hDetail, 2)} / ${D(p.hSmooth, 2)} mm`],
    ["Transição esclera–íris", D(p.hTrans, 1) + " mm" + (p.hLimbus ? " · anel do limbo" : "") + (p.hInv ? " · invertido" : "")],
    ["Pupila", { dome: `cúpula de ${D(p.pupH, 2)} mm`, flat: "plana", sunk: "rebaixada" }[p.pupMode]],
  ]);
  const vol = M.sclera.vol + M.iris.vol + M.pupil.vol;
  const yD = table(304, y, "Modelo e fabricação", [
    ["Volume esclera / íris / pupila", `${D(M.sclera.vol, 0)} / ${D(M.iris.vol, 1)} / ${D(M.pupil.vol, 1)} mm³`],
    ["Volume total", D(vol / 1000, 2) + " mL"],
    ["Resolução da íris", $("res").value === "h" ? "alta (~0,015 mm)" : "normal (~0,03 mm)"],
    ["Triângulos", (M.sclera.ntri + M.iris.ntri + M.pupil.ntri).toLocaleString("pt-BR")],
    ["Arquivos", "STL: completa + 3 peças"],
    ["Impressão", "multicolor ou peças pintadas"],
    ["Textura da íris (PNG)", `${TEX} px = Ø ${D(pp.Di, 2)} mm`],
    ["Camada transparente", "pelo ocularista"],
  ]);
  y = Math.min(yC, yD) - 6;

  // avisos (os mesmos da etapa 6)
  const warn = [...$("shellWarn").querySelectorAll(".warnbox")].flatMap((e) => e.innerHTML.split(/<br\s*\/?>/i)).map((h) => { const d = document.createElement("div"); d.innerHTML = h; return d.textContent.trim(); }).filter(Boolean);
  if (warn.length) {
    pg.text(36, y, 10.5, "Avisos", true, [0.69, 0.31, 0.05]); y -= 13;
    for (const w of warn) for (const l of wrap(w, 8.4, 520, 2)) { pg.text(36, y, 8.4, l, false, [0.55, 0.25, 0.04]); y -= 10.5; }
    y -= 4;
  }

  // prova e assinaturas
  const sy = Math.min(y - 30, 96);
  pg.text(36, sy + 30, 10.5, "Prova e entrega", true, ACC); pg.line(36, sy + 24, 559, sy + 24, LINE);
  [[36, "Data da prova"], [206, "Ajustes feitos"]].forEach(([x, l]) => pg.text(x, sy + 10, 8, l + ":", false, MUT));
  pg.line(96, sy + 9, 196, sy + 9, LINE); pg.line(272, sy + 9, 559, sy + 9, LINE);
  pg.line(36, sy - 22, 260, sy - 22, [0.6, 0.57, 0.68]); pg.line(335, sy - 22, 559, sy - 22, [0.6, 0.57, 0.68]);
  pg.text(36, sy - 32, 8, "Responsável pela modelagem", false, MUT); pg.text(335, sy - 32, 8, "Ocularista" + (P.pProf ? " · " + fit(P.pProf, 8, 160) : ""), false, MUT);

  // rodapé
  pg.line(36, 34, 559, 34, LINE);
  pg.text(36, 24, 7, "Protótipo de pesquisa. Não substitui a avaliação, o ajuste e o acabamento feitos pelo ocularista. Documento com dados de paciente: acesso restrito à equipe.", false, MUT);
  pg.text(36, 15, 7, "© 2026 Laboratório de Estudos Inventivos em Tecnologias Assistivas da Universidade Federal de Goiás (Lab.EITA/UFG) · EITA! OLHO v0.2", false, MUT);
  return E.montarPDF([pg], imgs);
}

async function extraPackageFiles(M) {
  autoUpdateFicha();
  const out = [{ name: "ficha.json", data: new TextEncoder().encode(JSON.stringify(collectFicha(), null, 1)) }];
  const pdf = await buildReport(M); if (pdf) out.push({ name: "relatorio.pdf", data: pdf });
  return out;
}
$("expPdf").onclick = async () => {
  if (!S.iris) { status("Carregue a foto e confira a íris antes de gerar o relatório."); return; }
  if (!$("pName").value.trim() && !$("pId").value.trim()) status("Dica: preencha a ficha do paciente (no topo do painel) para o relatório sair com os dados dele.");
  busy(true, "Montando o relatório…"); await new Promise((r) => setTimeout(r, 30));
  try {
    autoUpdateFicha();
    const pdf = await buildReport(); busy(false);
    if (pdf && await save(exportBase() + "_relatorio.pdf", new Blob([pdf], { type: "application/pdf" }))) {
      $("expInfo").innerHTML = '<div class="okbox">Relatório salvo.</div>'; status("Relatório salvo.");
    }
  } catch (e) { busy(false); status("Erro ao gerar o relatório: " + e.message); }
};
window.__eitaReport = buildReport; // usado nos testes

/* -------------------------------------------------------------- início */
ETP.montar(); enableUpTo(1);
document.querySelector("#stepper button").classList.add("cur");
updateMirrorNote();
renderFichas(); updAge();
