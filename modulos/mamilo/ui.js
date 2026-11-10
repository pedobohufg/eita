/* EITA! MAMILO — interface (padrão visual Lab.EITA). Casca, PDF, ficha e vista 3D vêm do núcleo (window.EITA).
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
(function () {
"use strict";
const E = window.EITA;
const $ = (id) => document.getElementById(id);
const fmt = E.ui.formatar, espera = () => E.ui.espera(20);
const BITS_ID7 = [[1, 1, 0, 0], [0, 1, 0, 0], [1, 1, 1, 1], [0, 0, 1, 0]];
const COR = { areola: "#1fae63", papila: "#2f6fdb", marc: "#d99a00", accent: "#6B3FD6", brand: "#9560FD", ink: "#1C1730", muted: "#5B5573", line: "#E1DCEC" };

const S = { frontal: null, lateral: null, aba: "photo", p: Object.assign({}, E.PARAMETROS, { textura_papila: Object.assign({}, E.PARAMETROS.textura_papila) }), forma: 4, projForcada: false, cache: {}, prev: null, modo3d: "prot", vol: null, exemplo: false };

// ------------------------------------------------------------------ casca Lab.EITA (núcleo): status, ocupado, downloads
const UI = E.ui, CASCA = UI.criarCasca(), status = CASCA.status, ocupado = CASCA.ocupado, salvar = CASCA.salvar;
const { carregarImagem, lerArquivo, paraCanvas } = UI;

// ------------------------------------------------------------------ etapas e seções
const ETAPAS = [["s1", "Foto"], ["s2", "Contornos"], ["s3", "Escala e cor"], ["s4", "Lateral"], ["s5", "Prótese"], ["s6", "Exportar"]];
const ETP = E.ui.criarEtapas({ etapas: ETAPAS, status, bloqueada: "Carregue a foto frontal primeiro (etapa 1).", aoAbrir(id, semVista) {
  if (!semVista) {
    if (id === "s1" || id === "s2") { mudarAba("photo"); if (id === "s2") enquadrar("areola"); }
    if (id === "s3") { mudarAba("photo"); enquadrar("tudo"); }
    if (id === "s4") mudarAba("lat");
    if (id === "s5" || id === "s6") mudarAba("3d");
  }
  if (id === "sCorpo") desenharCorpo();
} });
const montarStepper = ETP.montar, abrir = ETP.abrir, feito = ETP.feito;
function liberar() { ETP.liberar(["s2", "s3", "s4", "s5", "s6"]); }

// ------------------------------------------------------------------ abas da vista
function mudarAba(t) {
  S.aba = t;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("cur", b.dataset.t === t));
  $("pc").hidden = t !== "photo"; $("lc").hidden = t !== "lat"; $("gl").hidden = t !== "3d";
  $("toolsFoto").hidden = t !== "photo" || !S.frontal; $("tools3d").hidden = t !== "3d" || !S.frontal;
  $("empty").hidden = !!S.frontal;
  if (t === "photo") desenharFoto();
  if (t === "lat") desenharLateral();
  if (t === "3d") { if (iniciar3D()) { if (!S.prev) atualizarPrevia(); else desenhar3D(); } }
  legenda();
}
document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => { if (!S.frontal) return; mudarAba(b.dataset.t); }));
function legenda() {
  const L = $("legend");
  if (!S.frontal) { L.hidden = true; return; }
  L.hidden = false;
  if (S.aba === "photo") {
    const a = S.frontal.seg.areola, k = S.frontal.k;
    L.innerHTML = `<div><i style="background:${COR.areola}"></i>aréola ${fmt(a.eixo_maior_px / k)} × ${fmt(a.eixo_menor_px / k)} mm</div><div><i style="background:${COR.papila}"></i>papila Ø ${fmt(S.frontal.seg.papila.diam_px / k)} mm</div><div><i style="background:${COR.marc}"></i>marcador ${fmt(S.p.marcador_mm)} mm · ${fmt(k, 2)} px/mm</div>`;
  } else if (S.aba === "lat") {
    L.innerHTML = S.lateral ? `<div><i style="background:${COR.accent}"></i>perfil · projeção ${fmt(S.lateral.projecao_mm)} mm</div><div><i style="background:${COR.line};border:1px dashed ${COR.muted}"></i>linha de base da mama</div>` : `<div>sem foto lateral · projeção digitada ${fmt(S.p.papila_proj_mm)} mm</div>`;
  } else {
    const G = S.prev;
    L.innerHTML = G ? (S.modo3d === "molde" ? `<div>molde frontal (em cima) e contramolde</div><div>bloco ${fmt(2 * (G.ext - 1), 0)} × ${fmt(2 * (G.ext - 1), 0)} mm</div>` : `<div>prótese ${fmt(2 * G.a * G.rho_out)} × ${fmt(2 * G.b * G.rho_out)} mm</div><div>papila Ø ${fmt(G.papila_diam_mm)} × ${fmt(G.papila_proj_mm)} mm</div>${S.vol ? `<div>silicone ${fmt(S.vol, 2)} mL</div>` : ""}`) : "";
  }
}

// ------------------------------------------------------------------ 1. foto frontal
const soltavel = (zona, input, fn) => E.ui.soltavel($(zona), $(input), fn);
soltavel("drop1", "file1", async (f) => { S.exemplo = false; await processarFrontal(await lerArquivo(f), f.name); });
$("demo1").onclick = () => carregarExemplo();

async function processarFrontal(src, nome) {
  ocupado(true, "Abrindo a imagem…"); await espera();
  try {
    const orig = await carregarImagem(src, 2000);
    ocupado(true, "Procurando o marcador…"); await espera();
    const mk = E.detectarMarcador(orig);
    let cantos;
    if (mk) cantos = mk.cantos;
    else { const l = Math.min(orig.width, orig.height) * 0.12, x = orig.width * 0.06, y = orig.height * 0.06; cantos = [[x, y], [x + l, y], [x + l, y + l], [x, y + l]]; }
    S.frontal = { nome, orig, cantos, marcadorAuto: !!mk, editado: false };
    ocupado(true, "Calibrando a cor e medindo…"); await espera();
    recalibrar(); segmentar();
    S.prev = null; S.vol = null; S.cache = {};
    liberar(); feito("s1");
    const [ow, oh] = orig.original;
    $("imgInfo").innerHTML = `<b>${nome}</b> · ${ow} × ${oh} px${orig.width !== ow ? ` (processada em ${orig.width} × ${orig.height})` : ""}`;
    atualizarTudo();
    mudarAba("photo"); enquadrar("areola");
    if (!mk) { abrir("s3", true); mudarAba("photo"); enquadrar("tudo"); status("Marcador não encontrado. Arraste os quatro cantos amarelos sobre o quadrado preto e confira a escala na etapa 3.", true); }
    else { abrir("s2", true); status(S.exemplo ? "Exemplo sintético carregado. Confira os contornos e siga as etapas, ou carregue a sua foto na etapa 1." : "Foto processada. Confira os contornos da aréola e da papila (etapa 2)."); }
    ocupado(false);
    if (pendingFicha && (!pendingFicha.foto || pendingFicha.foto.arquivo === nome)) aplicarFicha(pendingFicha);
    return true;
  } catch (e) { ocupado(false); status("Falha ao processar a foto: " + e.message, true); return false; }
}
function recalibrar() {
  const fr = S.frontal, lados = E.ladosQuad(fr.cantos), lado = lados.reduce((a, b) => a + b, 0) / 4;
  fr.k = lado / S.p.marcador_mm; fr.persp = (Math.max(...lados) - Math.min(...lados)) / lado;
  const cal = E.calibrarCor(fr.orig, fr.cantos);
  fr.img = cal.img; fr.refCor = cal.ref; fr.canvas = paraCanvas(fr.img);
  fr.score = E.mapaScore(fr.img); S.cache = {};
}
function segmentar() {
  const fr = S.frontal, w = fr.img.width, h = fr.img.height;
  try { fr.seg = E.segmentarAuto(fr.img, fr.marcadorAuto ? fr.cantos : null, fr.score).seg; fr.segAuto = true; }
  catch (e) { const r = Math.min(w, h) * 0.18; fr.seg = { areola: { cx: w / 2, cy: h / 2, eixo_maior_px: 2 * r, eixo_menor_px: 2 * r, angulo_graus: 0 }, papila: null }; fr.segAuto = false; }
  if (!fr.seg.papila) { const a = fr.seg.areola; fr.seg.papila = { cx: a.cx, cy: a.cy, diam_px: 0.3 * a.eixo_menor_px }; fr.papFonte = "estimada por proporção"; }
  else {
    fr.papFonte = "foto";
    const r = E.refinarPapila(fr.score, w, h, fr.seg.papila), q = r.pap.diam_px / fr.seg.papila.diam_px;
    if (q > 0.5 && q < 1.6 && r.frac > 0.6) { fr.seg.papila = r.pap; fr.papFonte = "foto, borda refinada"; }
  }
  fr.paleta = E.paleta(fr.img, fr.seg);
}
$("detect").onclick = () => { if (!S.frontal) return; ocupado(true, "Detectando…"); setTimeout(() => { segmentar(); S.frontal.editado = false; ocupado(false); aposEdicao(false, true); enquadrar("areola"); status("Detecção automática refeita."); }, 20); };

// ------------------------------------------------------------------ 2/3. editor da foto (zoom, arrasto, alças)
const ED = { s: 1, ox: 0, oy: 0, modo: "areola", arr: null, pan: null };
function enquadrar(modo) {
  ED.modo = modo; $("fitAr").classList.toggle("cur", modo === "areola"); $("fitAll").classList.toggle("cur", modo === "tudo");
  const fr = S.frontal; if (!fr) return;
  const cv = $("pc"), W = cv.clientWidth || 800, H = cv.clientHeight || 600, a = fr.seg.areola;
  if (modo === "areola") { const r = Math.max(a.eixo_maior_px, a.eixo_menor_px) * 0.82; ED.s = Math.min(W, H - 110) / (2 * r); ED.ox = W / 2 - a.cx * ED.s; ED.oy = (H + 10) / 2 - a.cy * ED.s; }
  else { ED.s = Math.min(W / fr.img.width, (H - 110) / fr.img.height) * 0.96; ED.ox = (W - fr.img.width * ED.s) / 2; ED.oy = (H - fr.img.height * ED.s) / 2 + 8; }
  desenharFoto();
}
$("fitAr").onclick = () => enquadrar("areola"); $("fitAll").onclick = () => enquadrar("tudo");
$("marcBtn").onclick = () => { mudarAba("photo"); enquadrar("tudo"); status("Arraste os quatro cantos amarelos sobre o quadrado preto do marcador."); };
function alcas() {
  const fr = S.frontal, a = fr.seg.areola, p = fr.seg.papila, t = (a.angulo_graus * Math.PI) / 180;
  const h = [
    { id: "ac", x: a.cx, y: a.cy, cor: COR.areola, tipo: "anel" },
    { id: "a1", x: a.cx + Math.cos(t) * a.eixo_maior_px / 2, y: a.cy + Math.sin(t) * a.eixo_maior_px / 2, cor: COR.areola, tipo: "cheio" },
    { id: "a2", x: a.cx - Math.sin(t) * a.eixo_menor_px / 2, y: a.cy + Math.cos(t) * a.eixo_menor_px / 2, cor: COR.areola, tipo: "vazado" },
    { id: "pc", x: p.cx, y: p.cy, cor: COR.papila, tipo: "cheio" },
    { id: "pr", x: p.cx + p.diam_px / 2, y: p.cy, cor: COR.papila, tipo: "vazado" }
  ];
  fr.cantos.forEach((c, i) => h.push({ id: "m" + i, x: c[0], y: c[1], cor: COR.marc, tipo: "cheio" }));
  return h;
}
function desenharFoto() {
  const fr = S.frontal, cv = $("pc"); if (S.aba !== "photo") return;
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
  cv.width = W * dpr; cv.height = H * dpr; const x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
  if (!fr) return;
  x.save(); x.translate(ED.ox, ED.oy); x.scale(ED.s, ED.s);
  x.shadowColor = "rgba(60,30,130,.18)"; x.shadowBlur = 18 / ED.s; x.drawImage(fr.canvas, 0, 0); x.shadowBlur = 0;
  const a = fr.seg.areola, p = fr.seg.papila, ang = (a.angulo_graus * Math.PI) / 180, lw = 2 / ED.s;
  x.lineWidth = lw; x.strokeStyle = COR.areola; x.beginPath(); x.ellipse(a.cx, a.cy, a.eixo_maior_px / 2, a.eixo_menor_px / 2, ang, 0, 2 * Math.PI); x.stroke();
  const m = 1 + (2 * S.p.margem_mm * fr.k) / Math.min(a.eixo_maior_px, a.eixo_menor_px);
  x.setLineDash([5 / ED.s, 4 / ED.s]); x.globalAlpha = 0.75; x.beginPath(); x.ellipse(a.cx, a.cy, a.eixo_maior_px / 2 * m, a.eixo_menor_px / 2 * m, ang, 0, 2 * Math.PI); x.stroke(); x.setLineDash([]); x.globalAlpha = 1;
  x.strokeStyle = COR.papila; x.beginPath(); x.arc(p.cx, p.cy, p.diam_px / 2, 0, 2 * Math.PI); x.stroke();
  x.strokeStyle = COR.marc; x.beginPath(); fr.cantos.forEach((c, i) => (i ? x.lineTo(c[0], c[1]) : x.moveTo(c[0], c[1]))); x.closePath(); x.stroke();
  x.restore();
  for (const h of alcas()) {
    const X = h.x * ED.s + ED.ox, Y = h.y * ED.s + ED.oy;
    if (X < -20 || Y < -20 || X > W + 20 || Y > H + 20) continue;
    if (h.tipo === "anel") { x.lineWidth = 6; x.strokeStyle = "rgba(255,255,255,.85)"; x.beginPath(); x.arc(X, Y, 15, 0, 2 * Math.PI); x.stroke(); x.lineWidth = 3; x.strokeStyle = h.cor; x.stroke(); continue; }
    x.beginPath(); x.arc(X, Y, 6.5, 0, 2 * Math.PI);
    x.fillStyle = h.tipo === "cheio" ? h.cor : "#fff"; x.fill(); x.lineWidth = 2; x.strokeStyle = h.tipo === "cheio" ? "#fff" : h.cor; x.stroke();
  }
  // régua de 10 mm
  const l10 = 10 * fr.k * ED.s; if (l10 > 20 && l10 < W * 0.6) {
    const x0 = 34, y0 = 86; x.fillStyle = "rgba(255,255,255,.92)"; x.strokeStyle = COR.line; x.lineWidth = 1;
    x.beginPath(); x.roundRect ? x.roundRect(x0 - 10, y0 - 18, l10 + 20, 30, 8) : x.rect(x0 - 10, y0 - 18, l10 + 20, 30); x.fill(); x.stroke();
    x.fillStyle = COR.ink; x.fillRect(x0, y0, l10, 3); x.fillRect(x0, y0 - 4, 1.5, 7); x.fillRect(x0 + l10 - 1.5, y0 - 4, 1.5, 7);
    x.font = "500 11px IBM Plex Mono, monospace"; x.textAlign = "center"; x.fillText("10 mm", x0 + l10 / 2, y0 - 5); x.textAlign = "left";
  }
}
(function () {
  const cv = $("pc");
  const pos = (e) => { const r = cv.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top; return [(sx - ED.ox) / ED.s, (sy - ED.oy) / ED.s, sx, sy]; };
  const achar = (sx, sy) => { let melhor = null, d = 16; for (const h of alcas()) { let dd = Math.hypot(h.x * ED.s + ED.ox - sx, h.y * ED.s + ED.oy - sy); if (h.tipo === "anel") dd = Math.abs(dd - 15) + 1; if (dd < d) { d = dd; melhor = h; } } return melhor; };
  cv.addEventListener("pointerdown", (e) => {
    if (!S.frontal) return; const [, , sx, sy] = pos(e); const h = achar(sx, sy);
    cv.setPointerCapture(e.pointerId);
    if (h) ED.arr = h.id; else { ED.pan = [sx, sy, ED.ox, ED.oy]; cv.style.cursor = "grabbing"; }
  });
  cv.addEventListener("pointermove", (e) => {
    if (!S.frontal) return;
    const [x, y, sx, sy] = pos(e);
    if (ED.pan) { ED.ox = ED.pan[2] + sx - ED.pan[0]; ED.oy = ED.pan[3] + sy - ED.pan[1]; desenharFoto(); return; }
    if (!ED.arr) { cv.classList.toggle("alca", !!achar(sx, sy)); return; }
    const fr = S.frontal, a = fr.seg.areola, p = fr.seg.papila, id = ED.arr;
    if (id === "ac") { const dx = x - a.cx, dy = y - a.cy; a.cx = x; a.cy = y; p.cx += dx; p.cy += dy; }
    else if (id === "a1") { const dx = x - a.cx, dy = y - a.cy; a.eixo_maior_px = Math.max(2 * Math.hypot(dx, dy), a.eixo_menor_px); a.angulo_graus = (((Math.atan2(dy, dx) * 180) / Math.PI) % 180 + 180) % 180; }
    else if (id === "a2") { const t = (a.angulo_graus * Math.PI) / 180; a.eixo_menor_px = Math.min(2 * Math.abs(-Math.sin(t) * (x - a.cx) + Math.cos(t) * (y - a.cy)), a.eixo_maior_px); }
    else if (id === "pc") { p.cx = x; p.cy = y; }
    else if (id === "pr") { p.diam_px = Math.max(4, 2 * Math.hypot(x - p.cx, y - p.cy)); }
    else if (id[0] === "m") fr.cantos[+id[1]] = [x, y];
    desenharFoto(); sincronizarCampos(); legenda();
  });
  const fim = () => { cv.style.cursor = ""; if (ED.pan) { ED.pan = null; return; } if (!ED.arr) return; const m = ED.arr[0] === "m"; ED.arr = null; aposEdicao(m); };
  cv.addEventListener("pointerup", fim); cv.addEventListener("pointercancel", fim);
  cv.addEventListener("wheel", (e) => { if (!S.frontal) return; e.preventDefault(); const [, , sx, sy] = pos(e); const f = Math.exp(-e.deltaY * 0.0015); ED.ox = sx - (sx - ED.ox) * f; ED.oy = sy - (sy - ED.oy) * f; ED.s *= f; desenharFoto(); }, { passive: false });
  window.addEventListener("resize", () => { if (S.aba === "photo") desenharFoto(); if (S.aba === "lat") desenharLateral(); if (S.aba === "3d") desenhar3D(); });
})();
function aposEdicao(marcador, auto) {
  const fr = S.frontal; if (!auto) fr.editado = true;
  if (marcador) { fr.marcadorAuto = false; recalibrar(); }
  fr.paleta = E.paleta(fr.img, fr.seg);
  atualizarTudo(); desenharFoto(); agendarPrevia();
  if (!auto) feito("s2");
}
function sincronizarCampos() {
  const fr = S.frontal; if (!fr) return; const a = fr.seg.areola, k = fr.k;
  const set = (id, v, d) => { if (document.activeElement !== $(id)) $(id).value = (+v).toFixed(d); };
  set("cMaior", a.eixo_maior_px / k, 1); set("cMenor", a.eixo_menor_px / k, 1); set("cAng", a.angulo_graus, 0); set("cPap", fr.seg.papila.diam_px / k, 1);
}
for (const [id, fn] of [["cMaior", (v) => (S.frontal.seg.areola.eixo_maior_px = v * S.frontal.k)], ["cMenor", (v) => (S.frontal.seg.areola.eixo_menor_px = v * S.frontal.k)], ["cAng", (v) => (S.frontal.seg.areola.angulo_graus = ((v % 180) + 180) % 180)], ["cPap", (v) => (S.frontal.seg.papila.diam_px = v * S.frontal.k)]])
  $(id).addEventListener("change", () => { const v = parseFloat($(id).value); if (!S.frontal || isNaN(v) || (v <= 0 && id !== "cAng")) return; fn(v); aposEdicao(); });
$("marcMM").addEventListener("change", () => { const v = parseFloat($("marcMM").value); if (v > 5) { S.p.marcador_mm = v; if (S.frontal) { recalibrar(); aposEdicao(false, true); } } });

// ------------------------------------------------------------------ 4. lateral
soltavel("drop3", "file3", async (f) => processarLateral(await lerArquivo(f), f.name));
$("demo3").onclick = () => processarLateral("assets/mamilo-exemplo-lateral.jpg", "exemplo-lateral.jpg");
$("sem3").onclick = () => { S.lateral = null; S.projForcada = false; atualizarTudo(); agendarPrevia(); desenharLateral(); status("Sem foto lateral: a projeção e a forma da papila vêm dos valores digitados."); };
$("cProj").addEventListener("change", () => { const v = parseFloat($("cProj").value); if (v >= 0) { S.p.papila_proj_mm = v; S.projForcada = !!S.lateral; atualizarTudo(); agendarPrevia(); } });
$("cForma").addEventListener("change", () => { const v = parseFloat($("cForma").value); if (v >= 1.2) { S.forma = v; if (S.lateral) S.lateral.forma_n = v; atualizarTudo(); agendarPrevia(); } });
async function processarLateral(src, nome) {
  ocupado(true, "Analisando o perfil…"); await espera();
  try {
    const img = await carregarImagem(src, 1600);
    const r = E.analisarLateral(img, { marcador_mm: S.p.marcador_mm });
    r.canvas = img.canvas; r.nome = nome;
    S.lateral = r; S.projForcada = false; S.forma = r.forma_n;
    feito("s4"); atualizarTudo(); agendarPrevia(); mudarAba("lat");
    status(`Perfil analisado: projeção da papila de <b>${fmt(r.projecao_mm)} mm</b>.${r.avisos.length ? " " + r.avisos[0] : ""}`, r.avisos.length > 0);
  } catch (e) { status(e.message, true); }
  ocupado(false);
}
function desenharLateral() {
  const cv = $("lc"); if (S.aba !== "lat") return;
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight; if (!W) return;
  cv.width = W * dpr; cv.height = H * dpr; const x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
  const L = S.lateral;
  if (!L) { x.fillStyle = COR.muted; x.font = "500 15px Instrument Sans, sans-serif"; x.textAlign = "center"; x.fillText("Sem foto lateral. Carregue uma na etapa 4 ou use a projeção digitada.", W / 2, H / 2); x.textAlign = "left"; return; }
  // foto à esquerda
  const fotoW = Math.min(W * 0.36, 380), fh = Math.min((fotoW * L.canvas.height) / L.canvas.width, H - 150), fw = (fh * L.canvas.width) / L.canvas.height;
  const fx = 24, fy = 70;
  x.save(); x.shadowColor = "rgba(60,30,130,.18)"; x.shadowBlur = 16; x.drawImage(L.canvas, fx, fy, fw, fh); x.restore();
  const d = L._debug, k = L.px_por_mm, ef = fw / L.canvas.width, esq = L.lado_corpo === "esquerda";
  x.strokeStyle = COR.brand; x.lineWidth = 2; x.beginPath();
  d.linhas.forEach((ln, i) => { const bx = esq ? d.borda[i] : L.canvas.width - 1 - d.borda[i]; const X = fx + bx * ef, Y = fy + ln * ef; i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.stroke();
  // gráfico à direita
  const gx = fx + fw + 40, gw = W - gx - 30, gy = 80, gh = H - 200; if (gw < 160) return;
  const c = d.centro, ys = [], xb = [], xbase = [];
  for (let i = 0; i < d.linhas.length; i++) { const y = (d.linhas[i] - d.linhas[c]) / k; if (Math.abs(y) <= 22) { ys.push(y); xb.push(d.borda[i] / k); xbase.push(d.base[i] / k); } }
  const xmin = Math.min(...xbase, ...xb) - 1, xmax = Math.max(...xb) + 1, s = Math.min(gw / 44, gh / (xmax - xmin));
  const X = (y) => gx + gw / 2 + y * s, Y = (v) => gy + gh - (v - xmin) * s;
  x.fillStyle = "#fff"; x.strokeStyle = COR.line; x.lineWidth = 1; x.beginPath(); x.roundRect ? x.roundRect(gx - 12, gy - 40, gw + 24, gh + 80, 10) : x.rect(gx - 12, gy - 40, gw + 24, gh + 80); x.fill(); x.stroke();
  x.strokeStyle = "#EEEAF6"; for (let g = -20; g <= 20; g += 5) { x.beginPath(); x.moveTo(X(g), gy - 10); x.lineTo(X(g), gy + gh); x.stroke(); }
  x.fillStyle = COR.muted; x.font = "11px IBM Plex Mono, monospace"; x.textAlign = "center"; for (let g = -20; g <= 20; g += 10) x.fillText(g + " mm", X(g), gy + gh + 18);
  x.setLineDash([5, 4]); x.strokeStyle = COR.muted; x.lineWidth = 1.2; x.beginPath(); ys.forEach((y, i) => (i ? x.lineTo(X(y), Y(xbase[i])) : x.moveTo(X(y), Y(xbase[i])))); x.stroke(); x.setLineDash([]);
  x.strokeStyle = COR.accent; x.lineWidth = 2.5; x.beginPath(); ys.forEach((y, i) => (i ? x.lineTo(X(y), Y(xb[i])) : x.moveTo(X(y), Y(xb[i])))); x.stroke();
  const i0 = ys.findIndex((y) => y >= 0), top = Y(xb[i0]), bot = Y(xbase[i0]);
  x.strokeStyle = COR.ink; x.lineWidth = 1; x.beginPath(); x.moveTo(X(0) + 18, top); x.lineTo(X(0) + 18, bot); x.moveTo(X(0) + 13, top); x.lineTo(X(0) + 23, top); x.moveTo(X(0) + 13, bot); x.lineTo(X(0) + 23, bot); x.stroke();
  x.textAlign = "left"; x.fillStyle = COR.ink; x.font = "600 14px IBM Plex Mono, monospace"; x.fillText(`${fmt(L.projecao_mm)} mm`, X(0) + 28, (top + bot) / 2 + 5);
  x.font = "600 13px Instrument Sans, sans-serif"; x.fillText("Perfil da papila (rotacionado)", gx, gy - 16);
  x.fillStyle = COR.muted; x.font = "12px Instrument Sans, sans-serif"; x.fillText(`largura na base ${fmt(L.largura_base_mm)} mm · forma ${fmt(L.forma_n, 2)}`, gx + 210, gy - 16);
}

// ------------------------------------------------------------------ 5. parâmetros
const PARES = [["pCentro", "esp_centro_mm", 2], ["pBorda", "esp_borda_mm", 2], ["pMargem", "margem_mm", 1], ["pRelevo", "relevo_amp_mm", 2], ["pRaio", "raio_mama_mm", 0]];
for (const [id, ch, d] of PARES) {
  const n = $(id), r = $(id + "R"); n.value = S.p[ch].toFixed(d); r.value = S.p[ch];
  const aplicar = (v) => { if (isNaN(v)) return; S.p[ch] = v; n.value = v.toFixed(d); r.value = v; atualizarTudo(); agendarPrevia(); if (ch === "margem_mm") desenharFoto(); };
  r.addEventListener("input", () => aplicar(parseFloat(r.value)));
  n.addEventListener("change", () => aplicar(E.clamp(parseFloat(n.value), +r.min, +r.max)));
}
$("pInv").addEventListener("change", (e) => { S.p.relevo_inverter = e.target.checked; agendarPrevia(); });
const TXP = [["txInt", "intensidade", 1], ["txLob", "lobulo_mm", 1], ["txSul", "sulco_mm", 2], ["txOst", "ostios", 0], ["txRug", "ruga_amp_mm", 2], ["txBas", "sulco_basal_mm", 2]];
for (const [id, ch, d] of TXP) {
  const n = $(id), r = $(id + "R"), T = S.p.textura_papila; n.value = T[ch].toFixed(d); r.value = T[ch];
  const aplicar = (v) => { if (isNaN(v)) return; T[ch] = d === 0 ? Math.round(v) : v; n.value = T[ch].toFixed(d); r.value = T[ch]; agendarPrevia(); };
  r.addEventListener("input", () => aplicar(parseFloat(r.value)));
  n.addEventListener("change", () => aplicar(E.clamp(parseFloat(n.value), +r.min, +r.max)));
}
$("txOn").addEventListener("change", (e) => { S.p.textura_papila.ativa = e.target.checked; $("txBox").style.opacity = e.target.checked ? 1 : 0.5; agendarPrevia(); });
$("txVar").onclick = () => { S.p.textura_papila.semente = (S.p.textura_papila.semente * 7919 + 13) % 100003; agendarPrevia(); status("Nova variação da textura da papila."); };
$("txZoom").onclick = () => { mudarAba("3d"); vistaPapila(); };
function lados() {
  S.p.espelhar = $("photoSide").value !== $("protSide").value;
  const nome = (v) => (v === "D" ? "direita" : "esquerda");
  $("mirrorNote").textContent = S.p.espelhar ? `A foto é da mama ${nome($("photoSide").value)} e a prótese é para a ${nome($("protSide").value)}: o modelo será espelhado.` : "Foto e prótese do mesmo lado: sem espelhamento.";
  agendarPrevia();
}
$("photoSide").addEventListener("change", lados); $("protSide").addEventListener("change", lados);

function lateralEfetiva() { return S.lateral ? { forma_n: S.lateral.forma_n, projecao_mm: S.lateral.projecao_mm } : { forma_n: S.forma, projecao_mm: S.p.papila_proj_mm }; }
function geometria(res) { const fr = S.frontal; const p = Object.assign({}, S.p, { resolucao_mm: res, papila_proj_forcada: !S.lateral || S.projForcada }); return E.geometria(fr.img, fr.seg, fr.k, p, lateralEfetiva(), S.cache); }
let tPrev = null;
function agendarPrevia() { if (!S.frontal) return; S.prev = null; clearTimeout(tPrev); tPrev = setTimeout(() => { if (S.aba === "3d") atualizarPrevia(); }, 200); }
function atualizarPrevia() { if (!S.frontal) return; S.prev = geometria(S.p.textura_papila.ativa ? 0.2 : 0.3); montarCena(); legenda(); feito("s5"); }

// ------------------------------------------------------------------ resumo (tabelas, cores, avisos)
function atualizarTudo() {
  const fr = S.frontal; if (!fr) return;
  const a = fr.seg.areola, k = fr.k, L = S.lateral;
  sincronizarCampos();
  $("segTab").innerHTML = `<tr><td>Contornos</td><td>${fr.editado ? "ajustados" : fr.segAuto ? "automáticos" : "manuais"}</td></tr><tr><td>Papila</td><td>${fr.editado ? "ajustada" : fr.papFonte}</td></tr><tr><td>Área da aréola</td><td>${fmt((Math.PI * a.eixo_maior_px * a.eixo_menor_px) / 4 / k / k / 100, 2)} cm²</td></tr>`;
  $("scaleTab").innerHTML = `<tr><td>Marcador</td><td>${fr.marcadorAuto ? "detectado" : "cantos manuais"}</td></tr><tr><td>Escala</td><td>${fmt(k, 2)} px/mm</td></tr><tr><td>Perspectiva</td><td>${fmt(fr.persp * 100, 1)} %</td></tr>`;
  $("sw").innerHTML = [["aréola", fr.paleta.areola], ["papila", fr.paleta.papila], ["pele", fr.paleta.pele]].map(([n, h]) => `<div><i style="background:${h}"></i>${n} ${h}</div>`).join("");
  const sat = fr.refCor && /SATURADO/.test(fr.refCor);
  $("corInfo").innerHTML = !fr.refCor ? `<div class="warnbox">Cor sem calibração: o marcador não teve contraste suficiente.</div>` : sat ? `<div class="warnbox">O branco do marcador estourou na foto. Reduza a exposição ou use o marcador v2 com anel cinza.</div>` : `<div class="okbox">Cor calibrada pelo ${fr.refCor}.</div>`;
  if (fr.persp > 0.05) $("corInfo").innerHTML += `<div class="warnbox">O marcador aparece em perspectiva (${fmt(fr.persp * 100, 0)} %). Fotografe com o celular paralelo à pele.</div>`;
  if (fr.k) feito("s3");
  if (L) {
    $("cProj").value = (S.projForcada ? S.p.papila_proj_mm : L.projecao_mm).toFixed(1); $("cForma").value = L.forma_n.toFixed(2);
    $("latNota").textContent = S.projForcada ? "Projeção digitada (substitui a medida da foto lateral)." : "Valores medidos na foto lateral. Editar a projeção substitui a medida.";
    $("latTab").innerHTML = `<tr><td>Foto</td><td>${L.nome}</td></tr><tr><td>Projeção medida</td><td>${fmt(L.projecao_mm)} mm</td></tr><tr><td>Largura na base</td><td>${fmt(L.largura_base_mm)} mm</td></tr><tr><td>Ajuste da forma (RMS)</td><td>${fmt(L.rms_ajuste_mm, 2)} mm</td></tr>`;
    const dpf = fr.seg.papila.diam_px / k, av = [...L.avisos];
    if (L.largura_base_mm < 0.6 * dpf || L.largura_base_mm > 2 * dpf) av.push("A largura da papila no perfil não bate com a foto frontal. Confira as duas fotos.");
    $("latInfo").innerHTML = av.map((t) => `<div class="warnbox">${t}</div>`).join("");
  } else {
    $("cProj").value = S.p.papila_proj_mm.toFixed(1); $("cForma").value = S.forma.toFixed(1);
    $("latNota").textContent = "Sem foto lateral, vale o valor digitado. Forma 4 = cilindro de topo arredondado; 2 = cúpula.";
    $("latTab").innerHTML = ""; $("latInfo").innerHTML = "";
  }
  legenda();
}

// ------------------------------------------------------------------ 3D (WebGL próprio)
const V3 = E.ui.criarVista3D($("gl"), { visivel: () => S.aba === "3d", aoFalhar: () => status("Este navegador não oferece WebGL: a visualização 3D fica indisponível, mas a exportação funciona.", true), camera: { teta: -1.2, fi: 0.95, dist: 145, alvo: [0, 0, 1] } });
const iniciar3D = V3.iniciar, desenhar3D = V3.desenhar;
document.querySelectorAll("#tools3d button[data-m]").forEach((b) => (b.onclick = () => { S.modo3d = b.dataset.m; document.querySelectorAll("#tools3d button[data-m]").forEach((x) => x.classList.toggle("cur", x === b)); montarCena(); legenda(); }));
function vistaPapila() {
  const G = S.prev; if (!G) { setTimeout(vistaPapila, 300); return; }
  const n = G.n, i = E.clamp(Math.round(((G.papila_offset_mm[0] + G.ext) / (2 * G.ext)) * (n - 1)), 0, n - 1), j = E.clamp(Math.round(((G.papila_offset_mm[1] + G.ext) / (2 * G.ext)) * (n - 1)), 0, n - 1);
  V3.alvo = [G.papila_offset_mm[0], G.papila_offset_mm[1], G.F[j * n + i] * 0.75]; V3.dist = Math.max(28, G.papila_diam_mm * 3.2); V3.fi = 0.75; V3.teta = -1.1; desenhar3D();
}
document.querySelectorAll("#tools3d button[data-v]").forEach((b) => (b.onclick = () => { const v = b.dataset.v; if (v === "pap") { vistaPapila(); return; } V3.alvo = [0, 0, 1]; V3.dist = 145; if (v === "front") { V3.fi = 0.02; V3.teta = -Math.PI / 2; } else if (v === "three") { V3.fi = 0.95; V3.teta = -1.2; } else { V3.fi = 1.5; V3.teta = -Math.PI / 2; } desenhar3D(); }));
$("vC").addEventListener("change", montarCena); $("vPele").addEventListener("change", montarCena);
const hexRgb = E.ui.hexParaRgb, malhaGL = V3.malha, triangulos = V3.triangulos, superficieSuave = V3.superficieCampo;
function montarCena() {
  if (!S.prev || !iniciar3D()) return;
  const G = S.prev, fr = S.frontal, n = G.n, idx = Array.from({ length: n }, (_, i) => i);
  V3.limpar();
  const usarCor = $("vC").checked, cA = hexRgb(fr.paleta.areola), cP = hexRgb(fr.paleta.papila), cS = hexRgb(fr.paleta.pele), neutro = [0.78, 0.74, 0.86];
  if (S.modo3d !== "molde") {
    const corte = S.modo3d === "corte", ox = G.papila_offset_mm[0], oy = G.papila_offset_mm[1], rp0 = G.papila_diam_mm / 2;
    const corDe = (q) => {
      if (!usarCor) return neutro;
      const i = E.clamp(Math.round(((q[0] + G.ext) / (2 * G.ext)) * (n - 1)), 0, n - 1), j = E.clamp(Math.round(((q[1] + G.ext) / (2 * G.ext)) * (n - 1)), 0, n - 1), rho = G.rho[j * n + i];
      if (Math.hypot(q[0] - ox, q[1] - oy) / rp0 < 1.05) return cP;
      if (rho < 0.97) return cA; if (rho > 1.05) return cS; const f = (rho - 0.97) / 0.08; return cA.map((v, k) => v * (1 - f) + cS[k] * f);
    };
    if (!corte) { V3.malhas.push(superficieSuave(G, corDe)); }
    else {
    const prot = E.solido(G.xs, idx, n, G.S, Float32Array.from(G.S, (s, q) => s + Math.max(G.T[q], 1e-3)), G.dentro, false, false);
    V3.malhas.push(triangulos(prot, (q) => {
      if (!usarCor) return neutro;
      const i = E.clamp(Math.round(((q[0] + G.ext) / (2 * G.ext)) * (n - 1)), 0, n - 1), j = E.clamp(Math.round(((q[1] + G.ext) / (2 * G.ext)) * (n - 1)), 0, n - 1), rho = G.rho[j * n + i];
      if (Math.hypot(q[0] - ox, q[1] - oy) / rp0 < 1.05) return cP;
      if (rho < 0.97) return cA; if (rho > 1.05) return cS; const f = (rho - 0.97) / 0.08; return cA.map((v, k) => v * (1 - f) + cS[k] * f);
    }, 0, corte));
    }
    if ($("vPele").checked) {
      const R = S.p.raio_mama_mm, rMax = Math.min(G.ext * 1.1, 0.9 * R), NA = 128, NR = 40, pos = [], nor = [], col = [], cs = usarCor ? cS.map((v) => v * 0.9) : [0.9, 0.88, 0.93];
      const pt = (r, t) => { const x = r * Math.cos(t), y = r * Math.sin(t), z = Math.sqrt(R * R - r * r) - R - 0.04, L = R; return [x, y, z, x / L, y / L, (z + R) / L]; };
      for (let a = 0; a < NA; a++) for (let k = 0; k < NR; k++) {
        const t0 = (2 * Math.PI * a) / NA, t1 = (2 * Math.PI * (a + 1)) / NA, r0 = (rMax * k) / NR, r1 = (rMax * (k + 1)) / NR;
        if (corte && Math.sin((t0 + t1) / 2) > 0) continue;
        for (const [r, t] of [[r0, t0], [r1, t0], [r1, t1], [r0, t0], [r1, t1], [r0, t1]]) { const v = pt(r, t); pos.push(v[0], v[1], v[2]); nor.push(v[3], v[4], v[5]); col.push(...cs); }
      }
      V3.malhas.push(malhaGL(new Float32Array(pos), new Float32Array(nor), new Float32Array(col)));
    }
  } else {
    const M = E.moldes(G, S.p.parede_molde_mm, S.p.folga_pino_mm, S.p.canal_transbordo_mm);
    V3.malhas.push(triangulos(E.solido(G.xs, idx, n, M.frente[0], M.frente[1], M.frente[2], true, false), () => [0.86, 0.83, 0.93], 16, false));
    V3.malhas.push(triangulos(E.solido(G.xs, idx, n, M.contra[0], M.contra[1], M.contra[2], false, true), () => [0.62, 0.52, 0.86], -8, false));
  }
  desenhar3D();
}

// ------------------------------------------------------------------ 6. exportar
function relatorioJSON(G, vol) {
  const fr = S.frontal, a = fr.seg.areola, k = fr.k;
  return {
    software: "EITA! MAMILO v0.2 (web) — Lab.EITA/UFG", caso: codigoArquivo(), ficha: S.fichaId || null, paciente: readPatient(), data: new Date().toISOString().slice(0, 10),
    foto: { mama: $("photoSide").value === "D" ? "direita" : "esquerda", arquivo: fr.nome }, protese: { mama: $("protSide").value === "D" ? "direita" : "esquerda", espelhada: S.p.espelhar },
    medidas: { px_por_mm: +k.toFixed(3), marcador_mm: S.p.marcador_mm, marcador: fr.marcadorAuto ? "detectado" : "cantos manuais", cor_referencia: fr.refCor || "sem calibração",
      areola_eixo_maior_mm: +(a.eixo_maior_px / k).toFixed(2), areola_eixo_menor_mm: +(a.eixo_menor_px / k).toFixed(2), areola_angulo_graus: +a.angulo_graus.toFixed(1),
      papila_diam_mm: +G.papila_diam_mm.toFixed(2), papila_proj_mm: +G.papila_proj_mm.toFixed(2), papila_proj_fonte: S.lateral && !S.projForcada ? "foto lateral" : "digitada", papila_forma_n: lateralEfetiva().forma_n,
      contornos: fr.editado ? "ajustados à mão" : "automáticos", cores: fr.paleta },
    lateral: S.lateral ? { projecao_mm: S.lateral.projecao_mm, largura_base_mm: S.lateral.largura_base_mm, forma_n: S.lateral.forma_n, rms_ajuste_mm: S.lateral.rms_ajuste_mm, avisos: S.lateral.avisos } : null,
    parametros: S.p, volume_silicone_ml: vol != null ? +vol.toFixed(3) : null,
    avisos: checagens().map((c) => c.n + ": " + c.t)
  };
}
const LEIAME = `EITA! MAMILO — pacote de fabricação (Lab.EITA/UFG)

molde_frontal.stl ...... molde com a cavidade para cima (face visível da prótese, com o relevo)
contramolde.stl ........ face que fica contra a pele, com 4 pinos de registro e canal de transbordo
protese_referencia.stl . a prótese em si, para conferência visual
segmentacao.json ....... contornos em pixels (compatível com o pipeline Python: --segmentacao)
relatorio.pdf ......... relatório de fabricação (paciente, medidas, cores, checagem de segurança)
relatorio.json ........ medidas, cores, parâmetros e avisos

Fabricação sugerida: moldes em resina SLA/DLP (camada <= 50 um), pós-cura completa, teste de inibição
da cura do silicone platinum, desmoldante, pintura intrínseca em camadas e silicone de grau médico.
Protótipo de pesquisa: não é dispositivo médico validado.
`;
$("exp").onclick = async () => {
  if (!S.frontal) return; const res = parseFloat($("res").value), caso = codigoArquivo();
  try {
    ocupado(true, "Calculando a geometria…"); await espera();
    const G = geometria(res);
    ocupado(true, "Gerando os moldes…"); await espera();
    const ex = E.exportarConjunto(G, S.p); S.vol = ex.volume_ml;
    const J = relatorioJSON(G, ex.volume_ml);
    ocupado(true, "Montando o relatório…"); await espera(); const pdf = await gerarPDF(G, ex.volume_ml);
    ocupado(true, "Compactando…"); await espera();
    const zip = await E.zip(Object.assign({}, ex.arquivos, { "relatorio.json": JSON.stringify(J, null, 2), "segmentacao.json": JSON.stringify(S.frontal.seg, null, 2), "LEIA-ME.txt": LEIAME, "relatorio.pdf": pdf }));
    ocupado(false);
    $("expInfo").innerHTML = `<div class="okbox">3 STL (malhas fechadas) · silicone ${fmt(ex.volume_ml, 2)} mL · pacote ${fmt(zip.size / 1e6, 1)} MB</div>`;
    legenda();
    if (await salvar(`EITA-Mamilo_${caso}.zip`, zip)) feito("s6");
  } catch (e) { ocupado(false); status("Falha ao exportar: " + e.message, true); }
};
$("expPdf").onclick = async () => { if (!S.frontal) return; try { ocupado(true, "Montando o relatório…"); await espera(); const G = geometria(0.2); let vol = S.vol; if (vol == null) { const n = G.n, idx = Array.from({ length: n }, (_, i) => i); vol = E.volume(E.solido(G.xs, idx, n, G.S, Float32Array.from(G.S, (s, q) => s + Math.max(G.T[q], 1e-3)), G.dentro, false, false)) / 1000; } const pdf = await gerarPDF(G, vol); ocupado(false); await salvar(`EITA-Mamilo_${codigoArquivo()}_relatorio.pdf`, new Blob([pdf], { type: "application/pdf" })); } catch (e) { ocupado(false); status("Falha ao gerar o relatório: " + e.message, true); } };


// ------------------------------------------------------------------ 0. ficha da paciente (padrão EITA! AFO)
const PAT_IDS = ["pName", "pId", "pBirth", "pLado", "pFoto", "pDiag", "pRecon", "pRadio", "pAlerg", "pGoal", "pProf", "pNotes"];
const FICHAS = E.criarArmazemFichas({ chave: "eitaMAMILO.fichas.v1", formatoFicha: "EITA! MAMILO ficha", formatoBase: "EITA! MAMILO base", versaoApp: "0.2-web", prefixoBase: "base_EITA_MAMILO", rotulo: "EITA! MAMILO" });
let pendingFicha = null;
const esc = E.escaparHTML, ageText = (d) => E.idadeTexto(d);
function readPatient() { const t = {}; for (const id of PAT_IDS) t[id] = $(id).value.trim(); return t; }
function writePatient(t) { for (const id of PAT_IDS) $(id).value = (t && t[id]) || ""; updAge(); badge(); }
function updAge() { const a = ageText($("pBirth").value); $("pAge").textContent = a ? "Idade: " + a : ""; }
function badge() { const n = $("pName").value.trim(); $("pBadge").textContent = n ? "· " + n : ""; }
function patientCode() { return E.codigoPaciente($("pId").value.trim(), $("pName").value.trim()); }
function codigoArquivo() { return E.nomeArquivo($("caso").value || patientCode() || "caso"); }
function fichaId() { if (!S.fichaId) S.fichaId = E.novoIdFicha("m"); return S.fichaId; }
function collectFicha() {
  const fr = S.frontal;
  return {
    formato: "EITA! MAMILO ficha", versaoApp: "0.2-web", id: fichaId(), nome: $("pName").value.trim(), codigo: patientCode(), atualizado: new Date().toISOString(),
    paciente: readPatient(),
    foto: fr ? { arquivo: fr.nome, largura: fr.img.width, altura: fr.img.height } : null,
    segmentacao: fr ? JSON.parse(JSON.stringify(fr.seg)) : null, cantos: fr ? fr.cantos.map((c) => c.map((v) => +v.toFixed(2))) : null,
    marcadorAuto: fr ? fr.marcadorAuto : null, editado: fr ? fr.editado : false,
    lateral: S.lateral ? { arquivo: S.lateral.nome, projecao_mm: S.lateral.projecao_mm, forma_n: S.lateral.forma_n, largura_base_mm: S.lateral.largura_base_mm } : null,
    projForcada: S.projForcada, forma: S.forma,
    lados: { foto: $("photoSide").value, protese: $("protSide").value },
    parametros: JSON.parse(JSON.stringify(S.p)),
    resultado: S.vol ? { volume_ml: +S.vol.toFixed(3) } : null
  };
}
const fichaList = FICHAS.listar;
let delPend = null;
function renderFichas() {
  const el = $("fList"), l = fichaList();
  if (!l.length) { el.innerHTML = '<div class="note">Nenhuma ficha salva neste navegador.</div>'; return; }
  el.innerHTML = l.map((f, i) => `<div class="frow"><div><b>${esc(f.nome || "(sem nome)")}</b><small>${f.paciente && f.paciente.pLado ? (f.paciente.pLado === "D" ? "direita · " : "esquerda · ") : ""}${new Date(f.atualizado).toLocaleDateString("pt-BR")} · ${esc(f.foto ? f.foto.arquivo : "sem foto")}</small></div><button type="button" data-open="${i}">Abrir</button><button type="button" class="del" data-del="${i}" title="Excluir">${delPend === f.id ? "Confirmar" : "×"}</button></div>`).join("");
  el.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => openFicha(fichaList()[+b.dataset.open])));
  el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => {
    const l2 = fichaList(), f = l2[+b.dataset.del];
    if (delPend !== f.id) { delPend = f.id; renderFichas(); status(`Clique em "Confirmar" para excluir a ficha "${esc(f.nome)}" deste navegador.`, true); setTimeout(() => { if (delPend === f.id) { delPend = null; renderFichas(); } }, 5000); return; }
    FICHAS.excluir(+b.dataset.del); delPend = null; renderFichas(); status("Ficha excluída deste navegador.");
  }));
}
function saveFicha() {
  const f = collectFicha();
  if (!f.nome && !f.paciente.pId) { status("Dê um nome ou prontuário à ficha antes de salvar.", true); $("pName").focus(); return; }
  if (!f.nome) f.nome = f.paciente.pId;
  const ok = FICHAS.salvar(f);
  status(ok ? `Ficha "${esc(f.nome)}" salva neste navegador. Use "Exportar" para guardar uma cópia em arquivo.` : 'Não foi possível salvar no navegador; use "Exportar".', !ok);
  renderFichas();
}
async function exportFicha() { const f = collectFicha(); await salvar(((f.codigo || "ficha").replace(/[^\w-]+/g, "_")) + "_ficha_MAMILO.json", JSON.stringify(f, null, 1)); }
function sincronizarControles() {
  for (const [id, ch, d] of PARES) { $(id).value = S.p[ch].toFixed(d); $(id + "R").value = S.p[ch]; }
  const T = S.p.textura_papila; for (const [id, ch, d] of TXP) { $(id).value = (+T[ch]).toFixed(d); $(id + "R").value = T[ch]; }
  $("txOn").checked = !!T.ativa; $("txBox").style.opacity = T.ativa ? 1 : 0.5; $("pInv").checked = !!S.p.relevo_inverter; $("marcMM").value = S.p.marcador_mm;
}
function openFicha(f) {
  if (!FICHAS.ehFicha(f)) { status("Arquivo de ficha não reconhecido.", true); return; }
  S.fichaId = f.id; writePatient(f.paciente || { pName: f.nome });
  if (f.lados) { $("photoSide").value = f.lados.foto; $("protSide").value = f.lados.protese; }
  if (f.parametros) { S.p = Object.assign({}, E.PARAMETROS, f.parametros, { textura_papila: Object.assign({}, E.PARAMETROS.textura_papila, f.parametros.textura_papila || {}) }); sincronizarControles(); }
  lados();
  if (f.foto && (!S.frontal || S.frontal.nome !== f.foto.arquivo)) { pendingFicha = f; abrir("s1"); status(`Ficha "${esc(f.nome)}" aberta. Carregue a foto <b>${esc(f.foto.arquivo)}</b> (etapa 1) para aplicar os contornos e as medidas.`); return; }
  aplicarFicha(f);
}
function aplicarFicha(f) {
  pendingFicha = null; const fr = S.frontal;
  if (fr && f.segmentacao && f.foto && fr.img.width === f.foto.largura && fr.img.height === f.foto.altura) {
    fr.seg = JSON.parse(JSON.stringify(f.segmentacao)); fr.editado = !!f.editado;
    if (f.cantos && !f.marcadorAuto) { fr.cantos = f.cantos; fr.marcadorAuto = false; recalibrar(); }
    fr.paleta = E.paleta(fr.img, fr.seg);
  } else if (fr && f.foto) status("A foto carregada tem outro tamanho que a da ficha: os contornos foram refeitos automaticamente.", true);
  if (f.lateral && (!S.lateral || S.lateral.nome !== f.lateral.arquivo)) { S.lateral = null; S.p.papila_proj_mm = f.lateral.projecao_mm; S.forma = f.lateral.forma_n; S.projForcada = false; }
  else if (!f.lateral) { S.forma = f.forma || S.forma; }
  if (f.projForcada && S.lateral) S.projForcada = true;
  S.prev = null; atualizarTudo(); desenharFoto(); agendarPrevia(); feito("s0");
  status(`Ficha "${esc(f.nome || "")}" aplicada: contornos, medidas e parâmetros restaurados.`);
}
async function dbExport() { const b = FICHAS.exportarBase(); await salvar(b.nome, b.conteudo); }
async function dbImport(file) {
  try { const r = FICHAS.importarBase(JSON.parse(await file.text())); renderFichas(); status(`Base importada: ${r.novas} fichas novas e ${r.atualizadas} atualizadas.`); }
  catch (e) { status("Não foi possível importar a base: " + e.message, true); }
}
$("fSave").onclick = saveFicha; $("fExp").onclick = exportFicha; $("fImpB").onclick = () => $("fImp").click();
$("fImp").onchange = async () => { const f = $("fImp").files[0]; if (f) { try { openFicha(JSON.parse(await f.text())); } catch (e) { status("Não foi possível ler a ficha: " + e.message, true); } $("fImp").value = ""; } };
$("dbExp").onclick = dbExport; $("dbImpB").onclick = () => $("dbImp").click(); $("dbImp").onchange = () => { const f = $("dbImp").files[0]; if (f) dbImport(f); $("dbImp").value = ""; };
$("pName").addEventListener("input", badge); $("pBirth").addEventListener("input", updAge);
$("pLado").addEventListener("change", () => { const v = $("pLado").value; if (v) { $("protSide").value = v; lados(); } });
$("s0").addEventListener("change", () => atualizarTudo());
renderFichas();

// ------------------------------------------------------------------ checagem de segurança
function checagens() {
  const out = [], P = readPatient(), fr = S.frontal;
  if (P.pRadio === "curso") out.push({ n: "alerta", t: "Radioterapia em curso: não use adesivo nem prótese sobre a pele irradiada sem liberação da equipe." });
  if (P.pRadio === "recente") out.push({ n: "alerta", t: "Radioterapia há menos de 6 meses: avalie a pele e a liberação médica antes do uso do adesivo." });
  if (P.pAlerg) out.push({ n: /silic|adesiv|cola|esparadrap|látex|latex|acril/i.test(P.pAlerg) ? "alerta" : "atenção", t: "Alergia ou sensibilidade informada (" + P.pAlerg + "): faça teste de contato com o silicone e o adesivo antes da entrega." });
  if (fr) {
    if (!fr.marcadorAuto) out.push({ n: "atenção", t: "Marcador não detectado automaticamente: confira a escala com uma régua." });
    if (fr.persp > 0.05) out.push({ n: "atenção", t: `Marcador em perspectiva (${fmt(fr.persp * 100, 0)} %): as medidas podem ter erro.` });
    if (!fr.refCor) out.push({ n: "atenção", t: "Cor sem calibração: use as cores apenas como orientação." });
    else if (/SATURADO/.test(fr.refCor)) out.push({ n: "atenção", t: "Branco do marcador saturado: cor pouco confiável." });
    if (fr.papFonte === "estimada por proporção" && !fr.editado) out.push({ n: "atenção", t: "Papila não detectada: o diâmetro foi estimado. Confira na etapa 2." });
  }
  if (!S.lateral) out.push({ n: "info", t: `Sem foto lateral: projeção da papila digitada (${fmt(S.p.papila_proj_mm)} mm).` });
  else if (fr) { const dpf = fr.seg.papila.diam_px / fr.k; if (S.lateral.largura_base_mm < 0.6 * dpf || S.lateral.largura_base_mm > 2 * dpf) out.push({ n: "atenção", t: "A largura da papila no perfil não bate com a foto frontal." }); }
  if (S.p.textura_papila.ativa && parseFloat($("res").value) > 0.1) out.push({ n: "info", t: "Textura da papila ativa com malha acima de 0,10 mm: os óstios podem não aparecer no molde." });
  if (!P.pProf) out.push({ n: "info", t: "Profissional responsável não informado na ficha." });
  return out;
}

// ------------------------------------------------------------------ relatório em PDF (gerador e layout do núcleo: nucleo/pdf.js)
const { jpegDe: jpegOf } = E.ui, corta = E.cortarTexto;
const logoJpeg = () => E.ui.logoJpeg("assets/eita-mamilo-simbolo.png");
function imgContornos() {
  const fr = S.frontal, a = fr.seg.areola, p = fr.seg.papila, r = Math.max(a.eixo_maior_px, a.eixo_menor_px) * 0.8, c = document.createElement("canvas"); c.width = c.height = 600; const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, 600, 600); x.drawImage(fr.canvas, a.cx - r, a.cy - r, 2 * r, 2 * r, 0, 0, 600, 600);
  const s = 600 / (2 * r); x.save(); x.translate(300, 300); x.scale(s, s); x.translate(-a.cx, -a.cy); x.lineWidth = 3 / s;
  x.strokeStyle = COR.areola; x.beginPath(); x.ellipse(a.cx, a.cy, a.eixo_maior_px / 2, a.eixo_menor_px / 2, (a.angulo_graus * Math.PI) / 180, 0, 7); x.stroke();
  x.strokeStyle = COR.papila; x.beginPath(); x.arc(p.cx, p.cy, p.diam_px / 2, 0, 7); x.stroke(); x.restore();
  const l10 = 10 * fr.k * s; x.fillStyle = "rgba(255,255,255,.9)"; x.fillRect(16, 556, l10 + 70, 30); x.fillStyle = "#1C1730"; x.fillRect(26, 570, l10, 4); x.font = "600 16px Helvetica, Arial"; x.fillText("10 mm", 34 + l10, 578);
  return jpegOf(c);
}
function imgTopo(G) {
  const fr = S.frontal, n = G.n, R = 600, c = document.createElement("canvas"); c.width = c.height = R; const x = c.getContext("2d"), im = x.createImageData(R, R);
  const ext = Math.max(G.a, G.b) * G.rho_out * 1.12, dx = G.xs[1] - G.xs[0], hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const cA = hx(fr.paleta.areola), cP = hx(fr.paleta.papila), cS = hx(fr.paleta.pele), ox = G.papila_offset_mm[0], oy = G.papila_offset_mm[1], rp0 = G.papila_diam_mm / 2;
  const F = (i, j) => G.F[E.clamp(j, 0, n - 1) * n + E.clamp(i, 0, n - 1)];
  for (let py = 0; py < R; py++) for (let px = 0; px < R; px++) {
    const X = -ext + (2 * ext * px) / R, Y = ext - (2 * ext * py) / R, i = Math.round((X - G.xs[0]) / dx), j = Math.round((Y - G.xs[0]) / dx), o = 4 * (py * R + px);
    const q = E.clamp(j, 0, n - 1) * n + E.clamp(i, 0, n - 1);
    const gx = (F(i + 1, j) - F(i - 1, j)) / (2 * dx) * 2.5, gy = (F(i, j + 1) - F(i, j - 1)) / (2 * dx) * 2.5, nl = Math.hypot(gx, gy, 1);
    const sh = 0.45 + 0.6 * Math.max(0, (gx * 0.45 - gy * 0.5 + 0.74) / (nl * 1.0)), rho = G.rho[q];
    let c0 = !G.dentro[q] ? cS.map((v) => v * 0.55 + 115) : Math.hypot(X - ox, Y - oy) / rp0 < 1.03 ? cP : rho < 0.97 ? cA : cS;
    const k = G.dentro[q] ? sh : 1; im.data[o] = E.clamp(c0[0] * k, 0, 255); im.data[o + 1] = E.clamp(c0[1] * k, 0, 255); im.data[o + 2] = E.clamp(c0[2] * k, 0, 255); im.data[o + 3] = 255;
  }
  x.putImageData(im, 0, 0); return jpegOf(c);
}
function imgCorte(G) {
  const c = document.createElement("canvas"); c.width = 900; c.height = 600; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 900, 600);
  const n = G.n, j0 = E.clamp(Math.round((G.papila_offset_mm[1] - G.xs[0]) / (G.xs[1] - G.xs[0])), 0, n - 1), L = Math.max(G.a, G.b) * G.rho_out + 3;
  let zmin = 1e9, zmax = -1e9; for (let i = 0; i < n; i++) { if (Math.abs(G.xs[i]) > L) continue; zmin = Math.min(zmin, G.S[j0 * n + i]); zmax = Math.max(zmax, G.F[j0 * n + i]); }
  const s = Math.min(820 / (2 * L), 440 / (zmax - zmin) / 2.5), X = (v) => 450 + v * s, Y = (z) => 520 - (z - zmin) * s * 2.5;
  x.strokeStyle = "#EEEAF6"; x.lineWidth = 1; for (let g = -Math.floor(L / 5) * 5; g <= L; g += 5) { x.beginPath(); x.moveTo(X(g), 40); x.lineTo(X(g), 530); x.stroke(); }
  x.fillStyle = S.frontal.paleta.areola; x.beginPath(); let ini = false;
  for (let i = 0; i < n; i++) { if (Math.abs(G.xs[i]) > L) continue; const q = j0 * n + i; if (!G.dentro[q]) continue; ini ? x.lineTo(X(G.xs[i]), Y(G.F[q])) : (x.moveTo(X(G.xs[i]), Y(G.F[q])), (ini = true)); }
  for (let i = n - 1; i >= 0; i--) { if (Math.abs(G.xs[i]) > L) continue; const q = j0 * n + i; if (G.dentro[q]) x.lineTo(X(G.xs[i]), Y(G.S[q])); }
  x.fill(); x.strokeStyle = "#A79FBF"; x.lineWidth = 2; x.beginPath(); ini = false;
  for (let i = 0; i < n; i++) { if (Math.abs(G.xs[i]) > L) continue; const v = [X(G.xs[i]), Y(G.S[j0 * n + i])]; ini ? x.lineTo(...v) : (x.moveTo(...v), (ini = true)); } x.stroke();
  x.fillStyle = "#5B5573"; x.font = "30px Helvetica, Arial"; x.fillText("escala vertical 2,5×", 24, 40); x.fillText("linhas a cada 5 mm", 24, 585);
  return jpegOf(c);
}
async function gerarPDF(G, vol) {
  const fr = S.frontal, P = readPatient(), J = relatorioJSON(G, vol), m = J.medidas, T = S.p.textura_papila;
  const imgs = [Object.assign({ name: "Im1" }, imgContornos()), Object.assign({ name: "Im2" }, imgTopo(G)), Object.assign({ name: "Im3" }, imgCorte(G))];
  const lg = await logoJpeg(); if (lg) imgs.push(Object.assign({ name: "Lg" }, lg));
  const SUT = E.CORES_PDF.sutil, d = (v, k = 1) => (v == null || isNaN(v) ? "—" : (+v).toFixed(k).replace(".", ","));
  const agora = new Date();
  const R = E.criarRelatorioPDF({ app: ["EITA!", "MAMILO"], subtitulo: "Relatório de fabricação · prótese externa de aréola e papila · Lab.EITA / UFG", logo: lg ? "Lg" : null,
    dataTexto: agora.toLocaleDateString("pt-BR") + " " + agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    pacienteTexto: P.pName || patientCode() || "paciente não identificada", pacienteContinuacao: P.pName || patientCode() || "" });
  // paciente
  R.secao("Paciente");
  const nasc = P.pBirth ? new Date(P.pBirth + "T12:00:00").toLocaleDateString("pt-BR") : "", idade = ageText(P.pBirth);
  const RECON = { nenhuma: "sem reconstrução", implante: "implante / expansor", retalho: "retalho autólogo", "nipple-sparing": "mastectomia poupadora", outra: "outra" };
  const RADIO = { nao: "não fez", concluida: "concluída há 6 meses ou mais", recente: "concluída há menos de 6 meses", curso: "em curso" };
  R.campo(36, 200, "Nome", P.pName); R.campo(236, 100, "Prontuário / código", P.pId); R.campo(336, 140, "Nascimento", nasc ? nasc + (idade ? " · " + idade : "") : ""); R.campo(476, 83, "Fototipo", P.pFoto); R.y -= 25;
  R.campo(36, 200, "Mama da prótese", J.protese.mama + (J.protese.espelhada ? " (foto da " + J.foto.mama + ", espelhada)" : "")); R.campo(236, 323, "Diagnóstico / cirurgia", P.pDiag); R.y -= 25;
  R.campo(36, 200, "Reconstrução", RECON[P.pRecon]); R.campo(236, 160, "Radioterapia", RADIO[P.pRadio]); R.campo(396, 163, "Alergias / sensibilidade", P.pAlerg); R.y -= 25;
  R.campo(36, 260, "Objetivo / indicação", P.pGoal); R.campo(304, 255, "Profissional responsável", P.pProf); R.y -= 25;
  R.campo(36, 523, "Observações", (P.pNotes || "").replace(/\s+/g, " ")); R.y -= 22;
  // imagens
  const L = R.pg, iw = 160, gap = (523 - 3 * iw) / 2, iy = R.y - iw;
  L.image("Im1", 36, iy, iw, iw); L.image("Im2", 36 + iw + gap, iy, iw, iw); L.image("Im3", 36 + 2 * (iw + gap), iy + (iw - (iw * 600) / 900) / 2, iw, (iw * 600) / 900);
  L.text(36, iy - 11, 7.6, "Contornos na foto calibrada", false, SUT); L.text(36 + iw + gap, iy - 11, 7.6, "Prótese, vista de frente (relevo)", false, SUT); L.text(36 + 2 * (iw + gap), iy - 11, 7.6, "Corte pela papila", false, SUT);
  R.y = iy - 30;
  R.par("Fotografia e medidas", [["Foto frontal", corta(fr.nome, 8.8, 140)], ["Escala", d(m.px_por_mm, 2) + " px/mm"], ["Marcador", m.marcador], ["Referência de cor", m.cor_referencia], ["Aréola (eixos)", d(m.areola_eixo_maior_mm) + " × " + d(m.areola_eixo_menor_mm) + " mm"], ["Ângulo da aréola", d(m.areola_angulo_graus, 0) + "°"], ["Papila, diâmetro", d(m.papila_diam_mm) + " mm"], ["Papila, projeção", d(m.papila_proj_mm) + " mm (" + m.papila_proj_fonte + ")"], ["Forma da papila (expoente)", d(m.papila_forma_n, 2)], ["Contornos", m.contornos]],
    "Prótese", [["Espessura no centro", d(S.p.esp_centro_mm, 2) + " mm"], ["Borda afinada", d(S.p.esp_borda_mm, 2) + " mm"], ["Margem além da aréola", d(S.p.margem_mm) + " mm"], ["Microrrelevo da foto", d(S.p.relevo_amp_mm, 2) + " mm" + (S.p.relevo_inverter ? " (invertido)" : "")], ["Raio da mama (verso)", d(S.p.raio_mama_mm, 0) + " mm"], ["Textura da papila", T.ativa ? "sim · intensidade " + d(T.intensidade) : "não"], ["Lóbulos / sulcos", T.ativa ? d(T.lobulo_mm) + " / " + d(T.sulco_mm, 2) + " mm" : "—"], ["Óstios / rugas / sulco basal", T.ativa ? T.ostios + " / " + d(T.ruga_amp_mm, 2) + " / " + d(T.sulco_basal_mm, 2) + " mm" : "—"], ["Espelhada", J.protese.espelhada ? "sim" : "não"]]);
  const dimA = 2 * G.a * G.rho_out, dimB = 2 * G.b * G.rho_out;
  R.par("Resultado", [["Dimensões da prótese", d(dimA) + " × " + d(dimB) + " mm"], ["Altura total no centro", d(G.papila_proj_mm + S.p.esp_centro_mm) + " mm"], ["Volume de silicone", vol != null ? d(vol, 2) + " mL" : "—"], ["Massa estimada (1,1 g/mL)", vol != null ? d(vol * 1.1, 1) + " g" : "—"], ["Bloco dos moldes", d(2 * (G.ext - 1), 0) + " × " + d(2 * (G.ext - 1), 0) + " mm"], ["Resolução da malha", d(parseFloat($("res").value), 2) + " mm"], ["Malhas", "sólidos fechados"]],
    "Fabricação", [["Moldes", "SLA/DLP, camada <= 0,05 mm"], ["Pós-cura", "completa + teste de cura"], ["Desmoldante", "antes da pintura"], ["Pintura", "intrínseca, em camadas"], ["Silicone", "platinum, grau médico"], ["Fixação", "adesivo de grau médico"], ["Acabamento", "aparar a borda fina"]]);
  R.cores("Cores de referência (pigmentação)", [["Aréola", m.cores.areola], ["Papila", m.cores.papila], ["Pele ao redor", m.cores.pele]]);
  R.seguranca(checagens());
  R.avisoFinal("Medidas obtidas por fotografia calibrada e modelo computacional. Protótipo de pesquisa, não validado clinicamente: confira as medidas, a cor e a adaptação na paciente antes da entrega. A prótese não substitui a avaliação da equipe de saúde.");
  return R.finalizar(imgs);
}

// ------------------------------------------------------------------ ferramentas: marcador e corpo de prova
const SVGM = E.marcadorSVG(BITS_ID7);
$("marcVista").innerHTML = SVGM.replace(/<\?xml[^>]*>/, "");
$("marcDl").onclick = () => salvar("EITA-Mamilo_marcador_v2.svg", SVGM);
let CORPO = null;
function desenharCorpo() {
  if (!CORPO) CORPO = E.corpoDeProva(0.1);
  const cv = $("cvCorpo"), G = CORPO.G, n = G.n, Wd = 520; cv.width = Wd; cv.height = Wd;
  const x = cv.getContext("2d"), img = x.createImageData(Wd, Wd), ext = G.ext, dx = G.xs[1] - G.xs[0];
  const Fv = (i, j) => G.F[E.clamp(j, 0, n - 1) * n + E.clamp(i, 0, n - 1)];
  for (let py = 0; py < Wd; py++) for (let px = 0; px < Wd; px++) {
    const X = -ext + (2 * ext * px) / Wd, Y = ext - (2 * ext * py) / Wd, i = Math.round((X + ext) / dx), j = Math.round((Y + ext) / dx), o = 4 * (py * Wd + px);
    if (Math.hypot(X, Y) > 22.5) { img.data[o] = 244; img.data[o + 1] = 242; img.data[o + 2] = 249; img.data[o + 3] = 255; continue; }
    const gx = ((Fv(i + 1, j) - Fv(i - 1, j)) / (2 * dx)) * 6, gy = ((Fv(i, j + 1) - Fv(i, j - 1)) / (2 * dx)) * 6, nl = Math.hypot(gx, gy, 1);
    const s = Math.max(0, (gx * 0.5 - gy * 0.5 + 0.7) / (nl * 1.0488)), v = 70 + 175 * s;
    img.data[o] = v * 0.86; img.data[o + 1] = v * 0.8; img.data[o + 2] = v; img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const P = (X, Y) => [((X + ext) / (2 * ext)) * Wd, ((ext - Y) / (2 * ext)) * Wd];
  x.font = "600 11px IBM Plex Mono, monospace"; x.textAlign = "center";
  [[0.1, 200], [0.2, 240], [0.3, 300], [0.5, 340]].forEach(([h, a]) => { const [u, v] = P(13.8 * Math.cos((a * Math.PI) / 180), 13.8 * Math.sin((a * Math.PI) / 180)); x.fillStyle = COR.accent; x.fillText(h + "", u, v); });
  [[0.1, -8], [0.2, -4], [0.3, 0], [0.4, 4], [0.5, 8]].forEach(([p, X]) => { const [u, v] = P(X, 9.2); x.fillStyle = COR.accent; x.fillText(String(p), u, v); });
  [["Q1 0,10", 45], ["Q2 0,15", 135], ["Q3 0,20", 225], ["Q4 0,30", 315]].forEach(([t, a]) => { const [u, v] = P(29.5 * Math.cos((a * Math.PI) / 180), 29.5 * Math.sin((a * Math.PI) / 180)); x.fillStyle = COR.ink; x.fillText(t, u, v); });
  x.textAlign = "left";
}
$("corpoDl").onclick = async () => {
  try {
    ocupado(true, "Gerando os moldes do corpo de prova…"); await espera();
    if (!CORPO) CORPO = E.corpoDeProva(0.1);
    const ex = E.exportarConjunto(CORPO.G, Object.assign({}, E.PARAMETROS), 23.5);
    const mapa = await new Promise((ok) => $("cvCorpo").toBlob(ok, "image/png"));
    ocupado(true, "Compactando…"); await espera();
    const arq = Object.fromEntries(Object.entries(ex.arquivos).map(([k, v]) => ["corpo_de_prova_" + k, v]));
    arq["corpo_de_prova.json"] = JSON.stringify(CORPO.espec, null, 2); if (mapa) arq["corpo_de_prova_mapa.png"] = await mapa.arrayBuffer();
    const zip = await E.zip(arq); ocupado(false);
    await salvar("EITA-Mamilo_corpo-de-prova.zip", zip);
  } catch (e) { ocupado(false); status("Falha: " + e.message, true); }
};

// ------------------------------------------------------------------ início
async function carregarExemplo() {
  S.exemplo = true;
  const ok = await processarFrontal("assets/mamilo-exemplo-frontal.jpg", "exemplo-frontal.jpg (sintética)");
  if (ok) { await processarLateral("assets/mamilo-exemplo-lateral.jpg", "exemplo-lateral.jpg (sintética)"); mudarAba("photo"); abrir("s2", true); status("Exemplo sintético carregado. Confira os contornos e siga as etapas, ou carregue a sua foto na etapa 1."); }
}
montarStepper(); lados(); mudarAba("photo");
carregarExemplo();
})();
