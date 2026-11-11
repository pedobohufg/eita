/* EITA! CRÂNIO — interface (padrão visual Lab.EITA). Une a calculadora da plataforma (medidas, resultados
   classificados, esquema, acompanhamento por data, relatório PDF) e a versão completa antiga (legado/cranio-ortese):
   scan 3D com pontos de referência e alinhamento, medidas no plano axial, mapa de pressão com correção manual,
   geração da órtese craniana, protocolos, versões e verificação.
   Cálculo: modulos/cranio/processamento.js (índices), ortese.js (análise e casca), vistas.js (medidas no plano e
   vistas do relatório), fichas.js (ficha unificada e fichas antigas). Visualização 3D com three.js r128 (CDN).
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
"use strict";
const E = window.EITA, C = E.cranio, O = C.ortese, V = C.vistas, FX = C.fichas, UI = E.ui;
const $ = (id) => document.getElementById(id);
const esc = E.escaparHTML, fmt = C.fmt;
const CASCA = UI.criarCasca(), status = CASCA.status, salvar = CASCA.salvar;
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const dataBR = (iso) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR") : "");
const COR = { a: "#6B3FD6", b: "#A35F1F", sev: ["#25774F", "#86650A", "#B04E0C", "#B3261E", "#80195C"], cabeca: "#ECE8F6", contorno: "#A79FBF", tinta: "#1C1730", sutil: "#5B5573" };

const S = { unidade: "mm", fichaId: null, medicoes: [], m: {}, origem: null };

// confirmação em dois cliques (no claude.ai não há confirm()): true no segundo clique, em até 5 s
const PEND = {};
function doisCliques(chave, botao, rotulo, aviso) {
  if (PEND[chave]) { clearTimeout(PEND[chave].t); botao.textContent = PEND[chave].txt; delete PEND[chave]; return true; }
  const txt = botao.textContent; botao.textContent = rotulo;
  PEND[chave] = { txt, t: setTimeout(() => { botao.textContent = txt; delete PEND[chave]; }, 5000) };
  status(aviso, true); return false;
}
// entrega de arquivo: capacidade "downloads" do claude.ai (STL vai dentro de .zip) ou link comum → nome entregue ou false
async function entregar(nome, dados, tipo) {
  const dl = await UI.capacidadeDownloads();
  if (dl) {
    const p = await E.embalarParaDownload(nome, dados, tipo), r = await UI.salvarPelaCapacidade(dl, p.nome, p.dados);
    if (r.ok) { status(`Arquivo entregue: <b>${esc(p.nome)}</b>${p.nome !== nome ? " (descompacte para usar o STL)" : ""}.`); return p.nome; }
    if (r.codigo === "declined") { status("Download cancelado."); return false; }
    if (r.codigo === "rate_limited") { status("Já há uma confirmação de download aberta. Responda a ela e tente de novo.", true); return false; }
  }
  if (UI.baixarPorLink(nome, new Blob([dados], { type: tipo || "application/octet-stream" }))) { status(`Download iniciado: <b>${esc(nome)}</b>.`); return nome; }
  status("Este visualizador bloqueou o download. Abra a página no claude.ai.", true); return false;
}

/* ------------------------------------------------------------------ etapas, seções e vistas */
const ETP = UI.criarEtapas({ etapas: [["s1", "Scan 3D"], ["s2", "Medidas"], ["s3", "Acompanhamento"], ["s4", "Pressão"], ["s5", "Órtese"], ["s6", "Relatório"]], status,
  bloqueada: "Abra o scan 3D (etapa 1) para analisar a pressão e gerar a órtese.",
  aoAbrir: (id) => { if (id === "s1" || id === "s4" || id === "s5") mostrarVista("3d"); else if (id === "s3" || id === "s6" || (id === "s2" && !S3.pos)) mostrarVista("res"); } });
ETP.montar();
let vistaAtual = "res";
function mostrarVista(v) {
  vistaAtual = v; $("conteudo").hidden = v !== "res"; $("v3d").hidden = v !== "3d";
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("cur", b.dataset.v === v));
  if (v === "3d") { iniciar3D(); ajustarTamanho(); }
}
document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => mostrarVista(b.dataset.v)));

/* ------------------------------------------------------------------ medidas */
$("med").innerHTML = C.MEDIDAS.map((x) => `<label>${x.nome}<span class="sg">${x.sigla}</span><span class="inp"><input id="${x.id}" type="text" inputmode="decimal" autocomplete="off" value="${C.EXEMPLO[x.k]}"><span class="u" data-unidade>mm</span></span><span class="dica" id="h-${x.id}"></span></label>`).join("");
$("mData").value = hoje();
function lerMedidas() {
  const m = {}; let erro = false;
  for (const x of C.MEDIDAS) {
    const el = $(x.id), v = C.validar(x, el.value, S.unidade), h = $("h-" + x.id);
    el.setAttribute("aria-invalid", v.estado === "err" ? "true" : "false"); h.textContent = v.msg; h.dataset.estado = v.estado;
    m[x.k] = v.mm; if (v.estado === "err") erro = true;
  }
  return { m, erro };
}
const paraEntrada = (n) => String(Math.round(n * 100) / 100).replace(".", ",");
function mudarUnidade(u) {
  if (u === S.unidade) return;
  const f = u === "cm" ? 0.1 : 10;
  for (const x of C.MEDIDAS) { const el = $(x.id), n = C.lerNumero(el.value); if (n > 0) el.value = paraEntrada(n * f); }
  S.unidade = u; document.querySelectorAll("#uni button").forEach((b) => b.classList.toggle("on", b.dataset.u === u));
  document.querySelectorAll("[data-unidade]").forEach((s) => (s.textContent = u)); render();
}
function preencher(mm) {   // valores em mm (ou vazio)
  if (S.unidade !== "mm") mudarUnidade("mm");
  for (const x of C.MEDIDAS) $(x.id).value = mm && mm[x.k] > 0 ? paraEntrada(mm[x.k]) : mm && typeof mm[x.k] === "string" ? mm[x.k] : "";
  render();
}
function mostrarOrigem() {
  const o = S.origem;
  const mx = o && o.maiorAssimetria;
  $("origemMed").textContent = o ? `Medidas tiradas do scan ${o.scan} no plano axial z = ${fmt(o.planoZ, 1)} mm${o.alinhado ? "" : " (modelo não alinhado: valores indicativos)"}.${mx ? ` Maior assimetria do scan: CVAI ${fmt(mx.cvai, 1)} % a ${mx.dz > 0 ? "+" : ""}${fmt(mx.dz, 0)} mm do plano de referência.` : ""}` : "";
}
C.MEDIDAS.forEach((x) => $(x.id).addEventListener("input", () => { if (S.origem) { S.origem = null; mostrarOrigem(); } render(); }));
document.querySelectorAll("#uni button").forEach((b) => (b.onclick = () => mudarUnidade(b.dataset.u)));
$("exemplo").onclick = () => { S.origem = null; mostrarOrigem(); preencher(C.EXEMPLO); $("dA").focus(); };
$("limpar").onclick = () => { S.origem = null; mostrarOrigem(); preencher(null); $("dA").focus(); };

/* ------------------------------------------------------------------ resultados */
$("cartoes").innerHTML = C.CARTOES.map((c) => {
  const s = C.ESCALAS[c.k], span = s.max - s.min, lim = [s.min, ...s.cortes, s.max];
  const barra = s.nomes.map((n, i) => `<div data-sev="${s.sev[i]}" title="${n}" style="width:${((lim[i + 1] - lim[i]) / span) * 100}%"></div>`).join("");
  const marcas = s.cortes.map((v) => `<span class="marca" style="left:${((v - s.min) / span) * 100}%">${String(v).replace(".", ",")}</span>`).join("");
  return `<div class="cartao"><div class="topo"><div><h3>${c.rotulo}</h3><div class="ttl2">${c.titulo}</div></div><span class="pill" id="p-${c.k}" data-sev="none">Sem dados</span></div><div class="num"><span id="v-${c.k}">—</span><small>${c.unidade}</small></div><div class="escala"><div class="barra">${barra}</div>${marcas}<span class="ponteiro" id="pt-${c.k}" hidden></span></div><div class="formula">${c.formula}</div></div>`;
}).join("") + `<div class="cartao"><div class="razao"><span class="ttl2">Razão entre as diagonais (menor ÷ maior)</span><b id="v-ratio">—</b></div><div class="ttl2" id="longer"></div></div>`;
function cartao(k, a) {
  const s = C.ESCALAS[k], p = $("p-" + k), pt = $("pt-" + k);
  if (!a) { $("v-" + k).textContent = "—"; p.textContent = "Sem dados"; p.dataset.sev = "none"; pt.hidden = true; return; }
  $("v-" + k).textContent = fmt(a.valor, 1); p.textContent = a.classe; p.dataset.sev = String(a.sev);
  pt.style.left = Math.min(1, Math.max(0, (a.valor - s.min) / (s.max - s.min))) * 100 + "%"; pt.hidden = false;
}
// esquema do crânio em vista superior (SVG com cores explícitas: serve também para o PDF)
function svgCranio(m, r) {
  const cx = 130, cy = 160, temCab = m.l > 0 && m.w > 0, L = temCab ? m.l : 165, W = temCab ? m.w : 138;
  const k = 232 / Math.max(L, W), rx = (W * k) / 2, ry = (L * k) / 2, st = `fill="${COR.cabeca}" stroke="${COR.contorno}" stroke-width="1.5"`;
  let h = `<ellipse ${st} cx="${cx}" cy="${cy}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}"${temCab ? "" : ' stroke-dasharray="5 4"'}/>`;
  h += `<ellipse ${st} cx="${(cx - rx).toFixed(1)}" cy="${(cy + ry * 0.06).toFixed(1)}" rx="5" ry="14"/><ellipse ${st} cx="${(cx + rx).toFixed(1)}" cy="${(cy + ry * 0.06).toFixed(1)}" rx="5" ry="14"/>`;
  h += `<path ${st} d="M${cx - 9} ${(cy - ry + 1).toFixed(1)} L${cx} ${(cy - ry - 14).toFixed(1)} L${cx + 9} ${(cy - ry + 1).toFixed(1)}"/>`;
  const eixo = `stroke="${COR.contorno}" stroke-width="1" stroke-dasharray="3 4" fill="none"`;
  h += `<line ${eixo} x1="${cx}" y1="${(cy - ry).toFixed(1)}" x2="${cx}" y2="${(cy + ry).toFixed(1)}"/><line ${eixo} x1="${(cx - rx).toFixed(1)}" y1="${cy}" x2="${(cx + rx).toFixed(1)}" y2="${cy}"/>`;
  const txt = (x, y, cor, anc, t, tam = 11) => `<text x="${x}" y="${y}" text-anchor="${anc}" fill="${cor}" stroke="#fff" stroke-width="3" paint-order="stroke" font-family="IBM Plex Mono, monospace" font-size="${tam}" font-weight="500">${t}</text>`;
  const diag = (len, s, cor, tag, anc) => { const half = (len * k) / 2, dx = half * 0.5, dy = half * 0.8660254, x1 = cx + s * dx, y1 = cy - dy, x2 = cx - s * dx, y2 = cy + dy; return `<line stroke="${cor}" stroke-width="2.6" stroke-linecap="round" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>` + txt((x1 + (s < 0 ? -6 : 6)).toFixed(1), (y1 - 2).toFixed(1), cor, anc, tag + " " + fmt(len, 1)); };
  if (m.a > 0) h += diag(m.a, -1, COR.a, "A", "end");
  if (m.b > 0) h += diag(m.b, 1, COR.b, "B", "start");
  h += txt(cx, 12, COR.sutil, "middle", "FRONTAL", 10) + txt(cx, 294, COR.sutil, "middle", "OCCIPITAL", 10);
  return h;
}
// gráfico do CVAI ao longo das medições (faixas de classificação ao fundo)
function desenharGrafico(cv, medicoes) {
  const g = cv.getContext("2d"), W = cv.width, H = cv.height, l = [...medicoes].sort((a, b) => a.data.localeCompare(b.data)).map((x) => ({ ...x, r: C.calcular(x.mm) })).filter((x) => x.r.cvai != null);
  g.clearRect(0, 0, W, H); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
  const pad = { l: 64, r: 30, t: 24, b: 56 }, vmax = Math.max(14, ...l.map((x) => x.r.cvai + 1)), E_ = C.ESCALAS.cvai;
  const t0 = new Date(l[0].data).getTime(), t1 = Math.max(t0 + 864e5, new Date(l[l.length - 1].data).getTime());
  const X = (d) => pad.l + ((new Date(d).getTime() - t0) / (t1 - t0)) * (W - pad.l - pad.r), Y = (v) => H - pad.b - (v / vmax) * (H - pad.t - pad.b);
  const lim = [0, ...E_.cortes, vmax];
  for (let i = 0; i < E_.nomes.length; i++) { g.fillStyle = COR.sev[E_.sev[i]] + "22"; g.fillRect(pad.l, Y(Math.min(lim[i + 1], vmax)), W - pad.l - pad.r, Y(lim[i]) - Y(Math.min(lim[i + 1], vmax))); }
  g.font = "500 22px 'IBM Plex Mono', monospace"; g.fillStyle = COR.sutil; g.textAlign = "right"; g.textBaseline = "middle";
  for (const v of [0, ...E_.cortes]) { g.fillText(String(v).replace(".", ","), pad.l - 10, Y(v)); g.strokeStyle = "#E1DCEC"; g.beginPath(); g.moveTo(pad.l, Y(v)); g.lineTo(W - pad.r, Y(v)); g.stroke(); }
  g.textAlign = "center"; g.textBaseline = "top";
  l.forEach((x, i) => { if (l.length <= 8 || i === 0 || i === l.length - 1 || i % Math.ceil(l.length / 6) === 0) { g.textAlign = i === 0 ? "left" : i === l.length - 1 ? "right" : "center"; g.fillText(dataBR(x.data).slice(0, 5) + (i === 0 || i === l.length - 1 ? "/" + x.data.slice(2, 4) : ""), X(x.data) + (i === 0 ? -8 : i === l.length - 1 ? 8 : 0), H - pad.b + 12); } });
  g.strokeStyle = COR.a; g.lineWidth = 4; g.beginPath(); l.forEach((x, i) => (i ? g.lineTo(X(x.data), Y(x.r.cvai)) : g.moveTo(X(x.data), Y(x.r.cvai)))); g.stroke();
  for (const x of l) { g.fillStyle = "#fff"; g.beginPath(); g.arc(X(x.data), Y(x.r.cvai), 9, 0, 7); g.fill(); g.strokeStyle = COR.a; g.lineWidth = 4; g.stroke(); }
}

function render() {
  const { m } = lerMedidas(); S.m = m;
  const A = C.avaliar(m), r = A.r;
  for (const k of ["cvai", "cva", "ci"]) cartao(k, A[k]);
  $("v-ratio").textContent = r.ratio != null ? fmt(r.ratio, 1) + " %" : "—";
  $("longer").textContent = C.fraseDiagonais(r);
  $("fig").innerHTML = svgCranio(m, r);
  $("resumo").textContent = C.resumo(m);
  renderHistorico();
}

/* ------------------------------------------------------------------ acompanhamento */
let apagarPend = null;
function idadeNa(data) {
  const nasc = $("pBirth").value; if (!nasc) return "";
  const g = $("pGest").value, d = C.idadeCorrigidaDias(nasc, data, g), real = C.idadeEmDias(nasc, data);
  return C.idadeTextoDias(d) + (d !== real && isFinite(d) ? " (corr.)" : "");
}
function renderHistorico() {
  const l = [...S.medicoes].sort((a, b) => b.data.localeCompare(a.data)), dataAtual = $("mData").value;
  if (!l.length) { $("histBox").innerHTML = '<div class="note" style="margin-top:0">Nenhuma medição registrada. Informe as medidas e clique em <b>Registrar medição</b>.</div>'; $("evol").textContent = ""; $("grafBox").hidden = true; return; }
  $("histBox").innerHTML = `<table class="hist"><thead><tr><th>Data</th><th>Idade</th><th>CVA</th><th>CVAI</th><th>IC</th><th></th></tr></thead><tbody>${l.map((x) => { const r = C.calcular(x.mm); return `<tr class="${x.data === dataAtual ? "cur" : ""}"><td><a href="#" data-ver="${esc(x.id)}">${dataBR(x.data)}</a>${x.origem ? ' <span title="Medida do scan" style="color:var(--accent)">3D</span>' : ""}</td><td>${esc(idadeNa(x.data))}</td><td class="n">${r.cva != null ? fmt(r.cva, 1) : "—"}</td><td class="n">${r.cvai != null ? fmt(r.cvai, 1) : "—"}</td><td class="n">${r.ci != null ? fmt(r.ci, 1) : "—"}</td><td><button type="button" data-apagar="${esc(x.id)}" title="Excluir medição">${apagarPend === x.id ? "Confirmar" : "×"}</button></td></tr>`; }).join("")}</tbody></table>`;
  $("histBox").querySelectorAll("[data-ver]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); const x = S.medicoes.find((y) => y.id === a.dataset.ver); if (x) { $("mData").value = x.data; preencher(x.mm); S.origem = x.origem || null; mostrarOrigem(); status(`Medição de ${dataBR(x.data)} carregada.`); } }));
  $("histBox").querySelectorAll("[data-apagar]").forEach((b) => (b.onclick = () => {
    const id = b.dataset.apagar;
    if (apagarPend !== id) { apagarPend = id; renderHistorico(); setTimeout(() => { if (apagarPend === id) { apagarPend = null; renderHistorico(); } }, 5000); return; }
    S.medicoes = S.medicoes.filter((x) => x.id !== id); apagarPend = null; autoSalvar(); render(); status("Medição excluída.");
  }));
  const ev = C.evolucao(S.medicoes), s = (v, d = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + fmt(Math.abs(v), d);
  $("evol").innerHTML = ev ? `De ${dataBR(ev.desde)} a ${dataBR(ev.ate)}: CVAI ${ev.cvai != null ? s(ev.cvai) + " pontos" : "—"}, CVA ${ev.cva != null ? s(ev.cva) + " mm" : "—"}, índice cefálico ${ev.ci != null ? s(ev.ci) : "—"}.` : "Com duas medições ou mais, a evolução aparece aqui e no gráfico.";
  const comCvai = S.medicoes.filter((x) => C.calcular(x.mm).cvai != null);
  $("grafBox").hidden = comCvai.length < 2; if (comCvai.length >= 2) desenharGrafico($("graf"), comCvai);
}
$("mData").addEventListener("change", renderHistorico);
$("registrar").onclick = () => {
  const { m, erro } = lerMedidas(), data = $("mData").value;
  if (erro || !C.MEDIDAS.some((x) => m[x.k] > 0)) { status("Confira as medidas: há valores inválidos ou vazios.", true); return; }
  if (!data) { status("Informe a data da medição.", true); $("mData").focus(); return; }
  const mm = Object.fromEntries(C.MEDIDAS.map((x) => [x.k, m[x.k] > 0 ? m[x.k] : null]));
  const i = S.medicoes.findIndex((x) => x.data === data), novo = { id: i >= 0 ? S.medicoes[i].id : "md" + Date.now().toString(36), data, mm, unidade: S.unidade };
  if (S.origem) novo.origem = Object.assign({}, S.origem);
  if (i >= 0) S.medicoes[i] = novo; else S.medicoes.push(novo);
  const gravou = autoSalvar();
  render(); ETP.feito("s2");
  status(`Medição de ${dataBR(data)} registrada${novo.origem ? " (do scan)" : ""}${i >= 0 ? " (substituiu a do mesmo dia)" : ""}.${gravou ? " Ficha atualizada neste navegador." : ' Dê um nome ou código na <b>Ficha do paciente</b> e clique em <b>Salvar ficha</b> para guardar.'}`);
};

/* ================================================================== scan 3D (three.js r128) */
const T = window.THREE, TEM3D = !!(T && T.OrbitControls);
const S3 = { arquivo: "", unidade: "", pos: null, alinhado: false, pontos: {}, alinhamento: null, armado: false, pendente: null, eixo: "axial", z: 0, caixa: null, maxDim: 100, versoes: [], medidas: null };
const PONTOS = { anterior: { nome: "Glabela", cor: 0x34D399 }, posterior: { nome: "Opistocrânio", cor: 0x38BDF8 }, left: { nome: "Eúrio E", cor: 0xFBBF24 }, right: { nome: "Eúrio D", cor: 0xFB923C }, vertex: { nome: "Vértice", cor: 0xE879F9 } };
const COR_MED = { AP: "#38BDF8", LL: "#FBBF24", D1: "#34D399", D2: "#FB923C" };
let cena = null, camera, desenhista, controles, malha = null, planoMesh = null, linhasCorte = null, grupoMedidas, marcadores = {};
function iniciar3D() {
  if (cena || !TEM3D) return !!cena;
  const caixa = $("cena");
  cena = new T.Scene(); cena.background = new T.Color(0xF4F2F9);
  camera = new T.PerspectiveCamera(45, 1, 1, 5000); camera.position.set(0, -6, 300); camera.up.set(0, 0, 1);
  desenhista = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); desenhista.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  caixa.appendChild(desenhista.domElement);
  controles = new T.OrbitControls(camera, desenhista.domElement); controles.enableDamping = true;
  cena.add(new T.AmbientLight(0xffffff, 0.7));
  const l1 = new T.DirectionalLight(0xffffff, 0.9); l1.position.set(150, 200, 250); cena.add(l1);
  const l2 = new T.DirectionalLight(0xffffff, 0.4); l2.position.set(-150, -100, -200); cena.add(l2);
  grupoMedidas = new T.Group(); cena.add(grupoMedidas); CRO.grupo = new T.Group(); cena.add(CRO.grupo);
  if (window.ResizeObserver) new ResizeObserver(ajustarTamanho).observe($("v3d"));
  window.addEventListener("resize", ajustarTamanho);
  ligarCliques();
  (function animar() { requestAnimationFrame(animar); if (vistaAtual !== "3d") return; controles.update(); desenhista.render(cena, camera); })();
  ajustarTamanho();
  return true;
}
function ajustarTamanho() {
  if (!desenhista) return;
  const c = $("v3d"), w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
  camera.aspect = w / h; camera.updateProjectionMatrix(); desenhista.setSize(w, h);
}
function descartar(o) { if (!o) return; if (o.parent) o.parent.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }
function esvaziar(g) { while (g.children.length) descartar(g.children[0]); }
const D2R = Math.PI / 180;

// troca a malha mostrada (nova: scan recém-aberto, enquadra a câmera e refaz o plano)
function trocarMalha(pos, nova) {
  S3.pos = pos;
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
  if (!malha) { malha = new T.Mesh(g, new T.MeshStandardMaterial({ color: 0x8DB4C7, roughness: 0.4, metalness: 0.1, side: T.DoubleSide })); cena.add(malha); }
  else { malha.geometry.dispose(); malha.geometry = g; }
  S3.caixa = O.caixaEnvolvente(pos); S3.maxDim = Math.max(...[0, 1, 2].map((q) => S3.caixa.max[q] - S3.caixa.min[q]));
  if (nova) {
    descartar(planoMesh);
    planoMesh = new T.Mesh(new T.PlaneGeometry(S3.maxDim * 1.5, S3.maxDim * 1.5), new T.MeshBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.15, side: T.DoubleSide, depthWrite: false }));
    planoMesh.renderOrder = 2; cena.add(planoMesh);
    const s = g.boundingSphere; camera.position.set(0, -s.radius * 0.06, s.radius * 2.8); controles.target.copy(s.center); controles.update();
  }
}
async function abrirSTL(arq) {
  if (!TEM3D) { status("O visualizador 3D não carregou (three.js indisponível). As medidas manuais e o relatório continuam funcionando.", true); return; }
  if (!/\.stl$/i.test(arq.name)) { status("Escolha um arquivo .stl.", true); return; }
  CASCA.ocupado(true, "Lendo o scan…"); await UI.espera(30);
  try {
    const bruto = E.lerSTL(await arq.arrayBuffer()), sel = $("stl-scale-unit"), NOMES_U = { 1: "milímetros", 10: "centímetros", 1000: "metros" };
    // unidade: a da ficha aberta (se houver); senão a escolhida; sem escolha, a provável pelo tamanho do modelo
    const daFicha = S3.pendente && S3.pendente.scan && S3.pendente.scan.unidade, provavel = V.unidadeProvavel(bruto);
    let avisoU = "";
    if (daFicha && NOMES_U[daFicha]) sel.value = daFicha;
    else if (!S3.unidadeEscolhida && provavel && provavel !== sel.value) { sel.value = provavel; avisoU = ` Unidade ajustada para <b>${NOMES_U[provavel]}</b> pelo tamanho do modelo; se não for, troque a unidade e abra o arquivo de novo.`; }
    else if (provavel && provavel !== sel.value) avisoU = ` <b>Atenção:</b> pelo tamanho, o arquivo parece estar em ${NOMES_U[provavel]}, não em ${NOMES_U[sel.value]}. Confira a unidade.`;
    const u = sel.value, { pos } = O.prepararScan(bruto, parseFloat(u) || 1);
    mostrarVista("3d"); iniciar3D();
    S3.arquivo = arq.name; S3.unidade = u; S3.alinhado = false; S3.alinhamento = null; S3.zRef0 = null; limparPerfil();
    trocarMalha(pos, true); limparPontos(); resetCRO(); ajustarFaixaPlano();
    ["btn-arm-mark", "btn-clear-marks"].forEach((id) => ($(id).disabled = false));
    $("doScan").hidden = false; $("vazio3d").hidden = true; ETP.liberar(["s4", "s5"]); croHabilitar(true);
    $("scanInfo").innerHTML = `<b>${esc(arq.name)}</b>: ${(pos.length / 9).toLocaleString("pt-BR")} triângulos, ${[0, 1, 2].map((q) => fmt(S3.caixa.max[q] - S3.caixa.min[q], 0)).join(" × ")} mm. Marque os 5 pontos e alinhe.`;
    status(`Scan <b>${esc(arq.name)}</b> aberto. Marque os 5 pontos de referência e toque em <b>Alinhar aos eixos anatômicos</b>.${avisoU}`, !!avisoU && avisoU.includes("Atenção"));
    if (S3.pendente) {
      const want = S3.pendente.scan && S3.pendente.scan.nome;
      if (want === arq.name) { CASCA.ocupado(false); await UI.espera(30); aplicarOrtese(S3.pendente); }
      else if (want) status(`Scan aberto, mas a ficha aberta é do scan <b>${esc(want)}</b>: os pontos e o plano da ficha não foram aplicados.`, true);
    }
  } catch (e) { console.error(e); status("Não consegui ler o STL: " + esc(e.message), true); }
  CASCA.ocupado(false); atualizarEstado();
}
UI.soltavel($("stlDrop"), $("stl-file"), abrirSTL);
$("stl-scale-unit").addEventListener("change", () => { S3.unidadeEscolhida = true; });

/* ------------------------------------------------------------------ pontos de referência e alinhamento */
function marcarPonto(k, p) {
  S3.pontos[k] = [p[0], p[1], p[2]];
  descartar(marcadores[k]);
  const m = new T.Mesh(new T.SphereGeometry(S3.maxDim * 0.015, 16, 16), new T.MeshBasicMaterial({ color: PONTOS[k].cor }));
  m.position.set(p[0], p[1], p[2]); cena.add(m); marcadores[k] = m;
  listarPontos();
}
function limparPontos() { Object.keys(marcadores).forEach((k) => descartar(marcadores[k])); marcadores = {}; S3.pontos = {}; listarPontos(); }
function listarPontos() {
  const hex = (c) => "#" + c.toString(16).padStart(6, "0");
  $("landmark-status-list").innerHTML = O.PONTOS_DE_REFERENCIA.map((k) => `<li class="${S3.pontos[k] ? "ok" : ""}"><i style="background:${hex(PONTOS[k].cor)}"></i>${PONTOS[k].nome}: ${S3.pontos[k] ? "marcado" : "pendente"}</li>`).join("");
  const n = O.PONTOS_DE_REFERENCIA.filter((k) => S3.pontos[k]).length;
  $("btn-align-mesh").disabled = n < 5;
  $("why-align").textContent = !S3.pos ? "Abra o STL do scan primeiro." : n < 5 ? `Faltam ${5 - n} ponto(s) de referência.` : "";
}
$("btn-arm-mark").onclick = () => {
  if (!S3.pos) return;
  S3.armado = !S3.armado; const k = $("landmark-select").value;
  $("btn-arm-mark").textContent = S3.armado ? "Duplo clique na malha…" : "Marcar na malha";
  status(S3.armado ? `Dê duplo clique na malha sobre o ponto <b>${PONTOS[k].nome}</b>.` : "Marcação cancelada.");
  if (S3.armado) mostrarVista("3d");
};
$("btn-clear-marks").onclick = () => { limparPontos(); status("Pontos de referência apagados."); };
function alinhar() {
  const r = O.alinharPorPontos(S3.pos, S3.pontos); if (!r) return false;
  S3.alinhamento = {}; O.PONTOS_DE_REFERENCIA.forEach((k) => (S3.alinhamento[k] = S3.pontos[k].map((v) => +v.toFixed(4))));
  trocarMalha(r.pos, false); limparPontos(); S3.alinhado = true; S3.zRef0 = r.zRef; limparPerfil(); resetCRO();
  ajustarFaixaPlano();
  if (S3.eixo === "axial") { const sl = $("plane-offset"); sl.value = Math.min(parseFloat(sl.max), Math.max(parseFloat(sl.min), r.zRef)); lerPlano(); }
  ETP.feito("s1"); atualizarEstado();
  return true;
}
$("btn-align-mesh").onclick = () => { if (alinhar()) status("Modelo alinhado aos eixos anatômicos. O plano axial está na altura glabela–opistocrânio: extraia as medidas (etapa 2) ou analise a pressão (etapa 4)."); };

/* ------------------------------------------------------------------ plano de corte e medidas */
function ajustarFaixaPlano() {
  if (!S3.caixa) return;
  S3.eixo = $("plane-axis").value; const q = S3.eixo === "coronal" ? 1 : S3.eixo === "sagittal" ? 0 : 2, a = S3.caixa.min[q], b = S3.caixa.max[q];
  const sl = $("plane-offset"); sl.min = a; sl.max = b; sl.step = (b - a) / 200; sl.value = (a + b) / 2;
  lerPlano();
}
function lerPlano() { S3.z = parseFloat($("plane-offset").value); $("plane-offset-val").textContent = fmt(S3.z, 1) + " mm"; mostrarPlano(); }
$("plane-axis").addEventListener("change", () => { ajustarFaixaPlano(); atualizarEstado(); });
$("plane-offset").addEventListener("input", () => { lerPlano(); if (CRO.an) croResumo(); });
$("show-intersection").addEventListener("change", mostrarPlano);
// corte da malha num plano (só para mostrar): eixo 0 = x (sagital), 1 = y (coronal), 2 = z (axial)
function corteGeral(pos, q, d) {
  const out = [];
  for (let t = 0; t < pos.length; t += 9) {
    const v = [0, 3, 6].map((o) => pos[t + o + q] - d), pts = [];
    for (const [i, j] of [[0, 1], [1, 2], [2, 0]]) if ((v[i] <= 0 && v[j] > 0) || (v[i] > 0 && v[j] <= 0)) { const k = v[i] / (v[i] - v[j]); for (let c = 0; c < 3; c++) pts.push(pos[t + i * 3 + c] + (pos[t + j * 3 + c] - pos[t + i * 3 + c]) * k); }
    if (pts.length >= 6) out.push(...pts.slice(0, 6));
  }
  return out;
}
function rotulo3D(texto, cor, largura) {
  const cv = document.createElement("canvas"); cv.width = 320; cv.height = 72; const g = cv.getContext("2d");
  g.fillStyle = "rgba(28,23,48,0.86)"; g.beginPath(); if (g.roundRect) g.roundRect(4, 4, 312, 64, 14); else g.rect(4, 4, 312, 64); g.fill();
  g.strokeStyle = cor; g.lineWidth = 4; g.stroke(); g.fillStyle = "#fff"; g.font = "bold 32px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(texto, 160, 38);
  const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), depthTest: false, transparent: true })); sp.renderOrder = 1001;
  const w = largura || S3.maxDim * 0.24; sp.scale.set(w, w * 72 / 320, 1); return sp;
}
function mostrarPlano() {
  if (!planoMesh || !S3.caixa) return;
  planoMesh.position.set(0, 0, 0); planoMesh.rotation.set(0, 0, 0);
  if (S3.eixo === "axial") planoMesh.position.z = S3.z;
  else if (S3.eixo === "coronal") { planoMesh.rotation.x = Math.PI / 2; planoMesh.position.y = S3.z; }
  else { planoMesh.rotation.y = Math.PI / 2; planoMesh.position.x = S3.z; }
  descartar(linhasCorte); linhasCorte = null; esvaziar(grupoMedidas); S3.medidas = null;
  if (!$("show-intersection").checked) { legenda(); return; }
  const q = S3.eixo === "coronal" ? 1 : S3.eixo === "sagittal" ? 0 : 2, pts = corteGeral(S3.pos, q, S3.z);
  if (pts.length) { const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(new Float32Array(pts), 3)); linhasCorte = new T.LineSegments(g, new T.LineBasicMaterial({ color: 0x1C1730, transparent: true, opacity: 0.6 })); cena.add(linhasCorte); }
  if (S3.eixo === "axial") {
    const md = V.medidasNoPlano(S3.pos, null, S3.z); S3.medidas = md;
    const eu = md.eurios ? { er: { x: md.eurios[0][0], y: md.eurios[0][1] }, el: { x: md.eurios[1][0], y: md.eurios[1][1] } } : {};
    for (const [nome, a, b] of [["AP", "ant", "post"], ["LL", "er", "el"], ["D1", "d1a", "d1p"], ["D2", "d2a", "d2p"]]) {
      const ha = md.hit[a] || eu[a], hb = md.hit[b] || eu[b]; if (!ha || !hb) continue;
      const g = new T.BufferGeometry().setFromPoints([new T.Vector3(ha.x, ha.y, S3.z), new T.Vector3(hb.x, hb.y, S3.z)]);
      const l = new T.LineSegments(g, new T.LineBasicMaterial({ color: COR_MED[nome], depthTest: false })); l.renderOrder = 999; grupoMedidas.add(l);
      const sp = rotulo3D(`${nome} ${fmt(nome === "LL" ? md.largura : md[nome], 1)} mm`, COR_MED[nome], S3.maxDim * 0.2); sp.position.set(ha.x, ha.y, S3.z + S3.maxDim * 0.05); grupoMedidas.add(sp);
    }
  }
  legenda();
}
function legenda() {
  const lg = $("legend");
  if (CRO.an && $("cro-show-map").checked) { lg.innerHTML = `<b style="font-family:var(--f-body)">Mapa de pressão</b><span class="barraCor"></span><span class="ext"><span>−${CRO.range} alívio</span><span>+${CRO.range} contato (mm)</span></span>`; lg.hidden = false; return; }
  if (S3.medidas) { lg.innerHTML = Object.entries(COR_MED).map(([k, c]) => `<div><i style="background:${c}"></i>${k}${(k === "LL" ? S3.medidas.largura : S3.medidas[k]) != null ? " " + fmt(k === "LL" ? S3.medidas.largura : S3.medidas[k], 1) + " mm" : ""}</div>`).join(""); lg.hidden = false; return; }
  lg.hidden = true;
}
$("btn-extract-3d").onclick = () => {
  if (!S3.pos) return;
  if (S3.eixo !== "axial") { status('Mude o corte para <b>Axial</b> para extrair as medidas.', true); return; }
  const md = V.medidasNoPlano(S3.pos, null, S3.z);
  if (!md.AP && !md.D1) { status("As linhas de medida não cruzaram a malha. Confira a altura do plano ou se o modelo está vazio.", true); return; }
  const r1 = (v) => (v ? Number(v.toFixed(1)) : "");
  preencher({ a: r1(md.D1), b: r1(md.D2), l: r1(md.AP), w: r1(md.largura) });
  const pf = calcularPerfil(), mx = pf && pf.maior, z0 = S3.zRef0 != null ? S3.zRef0 : S3.z;
  S.origem = { scan: S3.arquivo, planoZ: +S3.z.toFixed(3), alinhado: S3.alinhado };
  if (mx) S.origem.maiorAssimetria = { dz: mx.dz, cvai: +mx.cvai.toFixed(2), cva: +mx.cva.toFixed(2), D1: +mx.D1.toFixed(1), D2: +mx.D2.toFixed(1) };
  mostrarOrigem();
  const ehMax = mx && Math.abs(z0 + mx.dz - S3.z) < 1;
  status(`Medidas extraídas do scan no plano z = ${fmt(S3.z, 1)} mm: D1 ${fmt(md.D1 || 0, 1)}, D2 ${fmt(md.D2 || 0, 1)}, AP ${fmt(md.AP || 0, 1)}, LL ${fmt(md.largura || 0, 1)} mm.` +
    (mx && !ehMax ? ` A maior assimetria está ${mx.dz > 0 ? "+" : ""}${fmt(mx.dz, 0)} mm do plano de referência (CVAI ${fmt(mx.cvai, 1)} %): veja <b>Assimetria por altura</b>.` : "") + " Confira em <b>Resultados</b> e registre a medição.");
};
// ------------------------------------------------------------------ assimetria por altura (E3c-4)
// planos paralelos ao de referência (glabela–opistocrânio do alinhamento; sem alinhamento, o plano atual)
function limparPerfil() { S3.perfil = null; $("perfil").hidden = true; $("perfilBox").hidden = true; }
function calcularPerfil() {
  if (!S3.pos || S3.eixo !== "axial") return null;
  const z0 = S3.zRef0 != null ? S3.zRef0 : S3.z, pf = V.perfilDeAssimetria(S3.pos, null, z0, { de: -10, ate: 50, passo: 5 });
  pf.z0 = z0; S3.perfil = pf; mostrarPerfil(); return pf;
}
function tabelaPerfil(pf, comAtual) {
  if (!pf || !pf.niveis.length) return '<div class="note">Sem níveis válidos.</div>';
  const E_ = C.ESCALAS.cvai, vmax = Math.max(12, ...pf.niveis.map((n) => n.cvai));
  return `<table class="perf"><thead><tr><th>Altura</th><th>CVAI</th><th>CVA</th><th>D1 / D2</th><th>IC</th></tr></thead><tbody>${pf.niveis.map((n) => {
    const sev = E_.sev[C.classificar(E_, n.cvai)], atual = comAtual && Math.abs(pf.z0 + n.dz - S3.z) < 2.5;
    return `<tr class="${n === pf.maior ? "max" : ""}${atual ? " atual" : ""}" title="${n === pf.maior ? "maior assimetria" : ""}"><td>${n.dz > 0 ? "+" : ""}${fmt(n.dz, 0)} mm</td><td data-sev="${sev}"><span class="bar" style="width:${(36 * n.cvai) / vmax}px"></span>${fmt(n.cvai, 1)} %</td><td>${fmt(n.cva, 1)}</td><td>${fmt(n.D1, 1)} / ${fmt(n.D2, 1)}</td><td>${fmt(n.ci, 1)}</td></tr>`;
  }).join("")}</tbody></table><div class="note">Alturas em relação ao plano ${S3.zRef0 != null ? "glabela–opistocrânio" : "atual (modelo não alinhado)"}; destacada a de maior CVAI${comAtual ? "; ● = plano atual" : ""}. CVAI ${E_.nomes.map((nm, i) => nm.toLowerCase() + (i < E_.cortes.length ? " < " + String(E_.cortes[i]).replace(".", ",") : "")).join(", ")}.</div>`;
}
function mostrarPerfil() {
  const pf = S3.perfil; if (!pf) { limparPerfil(); return; }
  $("perfil").hidden = false; $("perfilTab").innerHTML = tabelaPerfil(pf, true);
  $("perfilBox").hidden = false; const mx = pf.maior;
  $("perfilRes").innerHTML = (mx ? `<div class="ttl2" style="margin-bottom:6px">Maior assimetria a <b>${mx.dz > 0 ? "+" : ""}${fmt(mx.dz, 0)} mm</b> do plano de referência: CVAI <b>${fmt(mx.cvai, 1)} %</b> (${C.ESCALAS.cvai.nomes[C.classificar(C.ESCALAS.cvai, mx.cvai)].toLowerCase()}), CVA ${fmt(mx.cva, 1)} mm.</div>` : "") + tabelaPerfil(pf, false);
}
$("btn-perfil-max").onclick = () => {
  const pf = S3.perfil; if (!pf || !pf.maior) return;
  const sl = $("plane-offset"); sl.value = pf.z0 + pf.maior.dz; lerPlano(); $("btn-extract-3d").click();
};

/* ================================================================== órtese craniana (mapa de pressão + casca) */
const CRO = { an: null, zRef: 0, range: 3, casco: null, tris: null, stale: false, icTouched: false, tool: "none", earMan: { r: false, l: false }, polar: null, lastParams: null, lastStats: null, lastLines: null, grupo: null };
const fN = (n, d) => (Number.isFinite(n) ? n.toLocaleString("pt-BR", { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d }) : "—");
const numOf = (id, d) => { const v = parseFloat(String($(id).value).replace(",", ".")); return Number.isFinite(v) ? v : d; };
const POLAR_EDGE = -10, POLAR_S = 340, POLAR_M = 16;
const KIND_LABEL = { contact: "Contato", relief: "Alívio", zero: "Anulado" };
const sgn = (v) => (v < 0 ? "−" : "+") + fN(Math.abs(v), 0);

function croHabilitar(on) { $("btn-cro-analyze").disabled = !on; $("btn-cro-generate").disabled = !on; }
function setTool(t) { CRO.tool = t; $("cro-tool").value = t; const c = t === "none" ? "" : "crosshair"; if (desenhista) desenhista.domElement.style.cursor = c; $("cro-polar").style.cursor = c; }
function resetCRO() {
  descartar(CRO.casco); CRO.casco = null; if (CRO.grupo) esvaziar(CRO.grupo);
  CRO.an = null; CRO.tris = null; CRO.stale = false; CRO.lastParams = null; CRO.lastStats = null; CRO.lastLines = null; CRO.polar = null; CRO.earMan = { r: false, l: false };
  setTool("none");
  if (malha) { if (malha.geometry.getAttribute("color")) malha.geometry.deleteAttribute("color"); malha.material.vertexColors = false; malha.material.color.set(0x8DB4C7); malha.material.needsUpdate = true; malha.visible = true; }
  $("btn-cro-export").disabled = true; $("cro-polar").hidden = true; $("cro-lists").innerHTML = ""; $("cro-ic-info").textContent = "";
  $("cro-summary").textContent = 'Posicione o plano axial na altura glabela–opistocrânio e toque em "Analisar pressão".';
  legenda();
}
function aplicarCamadas() {
  if (malha) {
    malha.visible = $("cro-show-head").checked;
    const usar = !!(CRO.an && $("cro-show-map").checked), mat = malha.material;
    if (mat.vertexColors !== usar) { mat.vertexColors = usar; mat.color.set(usar ? 0xffffff : 0x8DB4C7); mat.needsUpdate = true; }
  }
  if (CRO.casco) { CRO.casco.visible = $("cro-show-helmet").checked; CRO.casco.material.opacity = numOf("cro-opacity", 75) / 100; CRO.casco.material.color.set(CRO.stale ? 0x9A8F7A : 0x6B3FD6); }
  if (CRO.grupo) CRO.grupo.visible = $("cro-show-marks").checked;
  legenda();
}
function syncGrowth() {
  const src = $("cro-grow-src").value, age = numOf("cro-age", 0), m = Math.max(0, numOf("cro-grow-m", 4));
  const rateEl = $("cro-grow-rate"), byAge = src === "age" && age > 0 && m > 0;
  rateEl.readOnly = byAge;
  let info;
  if (byAge) {
    const g = O.crescimentoPelaIdade(age, m);
    rateEl.value = fN(g.raioMm / m, 2);
    info = "Perímetro cefálico (mediana OMS) dos " + fN(age, 0) + " aos " + fN(age + m, 0) + " meses: +" + fN(g.cm, 1) + " cm ≈ " + fN(g.raioMm, 1) + " mm de raio.";
  } else if (src === "age") info = "Informe a idade (meses) para calcular o crescimento pela curva OMS; enquanto isso vale o valor manual.";
  else info = "Valor manual: " + fN(m * numOf("cro-grow-rate", 0), 1) + " mm de reserva radial.";
  $("cro-grow-info").textContent = info;
}
function indicOpts() { const age = numOf("cro-age", 0); return { mode: $("cro-indic").value, age: age > 0 ? age : undefined, icTarget: CRO.icTouched ? numOf("cro-ic-target", undefined) : undefined }; }
function readParams() {
  syncGrowth();
  const g = (id, d, lo, hi) => Math.min(hi, Math.max(lo, numOf(id, d)));
  return {
    type: $("cro-type").value, bandTop: g("cro-bandtop", 55, 20, 85), bandTopBack: g("cro-bandtop-back", 55, 20, 85),
    mode: $("cro-mode").value,
    relief: g("cro-relief", 100, 0, 200) / 100, reliefMax: g("cro-relief-max", 6, 0, 15), compMax: g("cro-comp-max", 1.5, 0, 4),
    c0: g("cro-c0", 2, 0, 8), t: g("cro-t", 3, 1.5, 8),
    growMonths: g("cro-grow-m", 4, 0, 12), growRate: g("cro-grow-rate", 0.8, 0, 3),
    growContactPct: g("cro-grow-contact", 30, 0, 100), growVertex: g("cro-grow-vertex", 2, 0, 8),
    hf: g("cro-hf", 4, -20, 30), hb: g("cro-hb", -12, -40, 20),
    earMode: $("cro-ear-mode").value, earClear: g("cro-ear-clear", 8, 2, 20),
    earWR: g("cro-ear-w-r", 24, 10, 45), earWL: g("cro-ear-w-l", 24, 10, 45), earTopR: g("cro-ear-top-r", 14, -30, 50), earTopL: g("cro-ear-top-l", 14, -30, 50),
    earAzR: g("cro-ear-az-r", 100, 60, 140), earAzL: g("cro-ear-az-l", 100, 60, 140), earManR: CRO.earMan.r, earManL: CRO.earMan.l,
    cheek: $("cro-cheek").value, cheekWidth: g("cro-cheek-w", 30, 10, 50), cheekDepth: g("cro-cheek-depth", 32, 10, 60),
    cheekGap: g("cro-cheek-gap", 6, 0, 20), cheekClear: g("cro-cheek-clear", 1.5, 0, 6),
    holeD: g("cro-hole-d", 4, 0, 8), pitch: g("cro-pitch", 10, 5, 25), margin: g("cro-margin", 8, 2, 20), holeZone: $("cro-hole-zone").value, holeArc: 50,
    split: $("cro-split").value, splitPos: g("cro-split-pos", -35, -80, 80), gap: g("cro-gap", 2, 1.5, 6),
    occDrop: g("cro-occ-drop", 8, 0, 30), occWidth: g("cro-occ-w", 50, 20, 90), occSoft: 0.6,
    mast: $("cro-mast").value, mastWidth: g("cro-mast-w", 24, 8, 50), mastDepth: g("cro-mast-depth", 24, 5, 50), mastGap: g("cro-mast-gap", 4, 0, 20), legRound: 0.45,
    res: $("cro-res").value
  };
}
const dirOf = (th, ph) => new T.Vector3(Math.cos(ph * D2R) * Math.sin(th * D2R), Math.cos(ph * D2R) * Math.cos(th * D2R), Math.sin(ph * D2R));
function croMarcadores(an, zRef) {
  esvaziar(CRO.grupo); const md = S3.maxDim;
  an.peaks.forEach((p) => {
    const dir = dirOf(p.th, p.ph), hex = p.type === "P" ? "#E0291F" : "#2563EB", pt = new T.Vector3(0, 0, zRef).addScaledVector(dir, p.rho);
    const b = new T.Mesh(new T.SphereGeometry(md * 0.018, 16, 16), new T.MeshBasicMaterial({ color: hex, depthTest: false })); b.position.copy(pt); b.renderOrder = 1000; CRO.grupo.add(b);
    const sp = rotulo3D(p.label + "  " + (p.mag > 0 ? "+" : "−") + fN(Math.abs(p.mag), 1) + " mm", hex); sp.position.copy(pt).addScaledVector(dir, md * 0.075); CRO.grupo.add(sp);
  });
  an.edits.forEach((e) => {
    const dir = dirOf(e.th, e.ph), hex = "#D97706", pt = new T.Vector3(0, 0, zRef).addScaledVector(dir, e.rho), s = md * 0.03;
    const b = new T.Mesh(new T.BoxGeometry(s, s, s), new T.MeshBasicMaterial({ color: hex, depthTest: false })); b.position.copy(pt); b.renderOrder = 1000; CRO.grupo.add(b);
    const sp = rotulo3D(e.label + "  " + (e.kind === "zero" ? "anulado" : (e.kind === "contact" ? "+" : "−") + fN(e.mm, 1) + " mm"), hex); sp.position.copy(pt).addScaledVector(dir, md * 0.075); CRO.grupo.add(sp);
  });
  // linha de corte (borda) pré-visualizada sobre a cabeça e as orelhas usadas no projeto
  const P = readParams(), tl = O.linhaDeCorte(an, P, 240), arr = new Float32Array(tl.line.length * 3);
  tl.line.forEach((q, i) => { const dir = dirOf(q.th, q.ph), r = O.amostrarGrade(an.rho, q.th, q.ph) + 3; arr[i * 3] = dir.x * r; arr[i * 3 + 1] = dir.y * r; arr[i * 3 + 2] = zRef + dir.z * r; });
  const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.BufferAttribute(arr, 3));
  const linha = new T.LineLoop(geo, new T.LineBasicMaterial({ color: 0xF5B301 })); linha.renderOrder = 999; CRO.grupo.add(linha);
  ["R", "L"].forEach((s) => {
    const e = tl.ears[s]; if (!e) return;
    const th = s === "R" ? e.az : 360 - e.az, ph = Math.atan2(e.top, O.amostrarGrade(an.rho, th, 0)) / D2R;
    const dir = dirOf(th, ph), pt = new T.Vector3(0, 0, zRef).addScaledVector(dir, O.amostrarGrade(an.rho, th, ph) + 3);
    const b = new T.Mesh(new T.SphereGeometry(md * 0.014, 12, 12), new T.MeshBasicMaterial({ color: "#15803D", depthTest: false })); b.position.copy(pt); b.renderOrder = 1000; CRO.grupo.add(b);
    const sp = rotulo3D("Orelha " + (s === "R" ? "D" : "E") + "  arco " + sgn(e.top) + " mm", "#15803D"); sp.position.copy(pt).addScaledVector(dir, md * 0.06); CRO.grupo.add(sp);
  });
}
function croTrimLines(an, P) {
  const ears = O.resolverOrelhas(an, P), L = [];
  ["R", "L"].forEach((s) => { const e = ears[s]; L.push("Orelha " + (s === "R" ? "D" : "E") + ": " + e.src + " (az " + fN(e.az, 0) + "°, arco " + sgn(e.top) + " mm)"); });
  if (["R", "L"].some((s) => ears[s].src !== "detectada" && ears[s].src !== "manual")) L.push('⚠ Detecção da orelha duvidosa ou ausente: use "Marcar D/E" e clique no topo de cada orelha na malha 3D.');
  if (P.cheek === "off") L.push("Apoio na bochecha: desativado");
  else {
    if (P.mast === "on") L.push("Aba atrás da orelha: " + fN(P.mastWidth, 0) + " mm de largura, até " + fN(P.mastDepth, 0) + " mm abaixo do plano");
    L.push("Apoio na bochecha: " + fN(P.cheekWidth, 0) + " mm de largura, até " + fN(P.cheekDepth, 0) + " mm abaixo do plano");
    if (an.cheekCoverage < 0.7) L.push("⚠ A malha cobre só " + fN(an.cheekCoverage * 100, 0) + "% da região da bochecha: o apoio usa dados extrapolados. Verifique se o escaneamento inclui face e orelhas.");
  }
  return L;
}
function polarGeom() { const c = POLAR_S / 2, R = POLAR_S / 2 - POLAR_M; return { c, R, rOf: (ph) => R * (90 - ph) / (90 - POLAR_EDGE) }; }
function croPolar(an, range) {
  const cv = $("cro-polar"), Sz = POLAR_S, ctx = cv.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.putImageData(new ImageData(O.mapaSuperior(an, range, Sz, POLAR_EDGE, POLAR_M), Sz, Sz), 0, 0);
  const { c, R, rOf } = polarGeom();
  ctx.strokeStyle = "rgba(19,35,42,0.35)"; ctx.lineWidth = 1; ctx.font = "10px sans-serif"; ctx.fillStyle = "rgba(19,35,42,0.7)";
  [60, 30, 0].forEach((ph) => { ctx.beginPath(); ctx.arc(c, c, rOf(ph), 0, Math.PI * 2); ctx.stroke(); ctx.fillText(ph + "°", c + 3, c - rOf(ph) + 11); });
  ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(c, c - R); ctx.lineTo(c, c + R); ctx.moveTo(c - R, c); ctx.lineTo(c + R, c); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = "#13232A"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#13232A"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
  ctx.fillText("FRONTAL", c, 11); ctx.fillText("OCCIPITAL", c, Sz - 3);
  ctx.textAlign = "right"; ctx.fillText("D", Sz - 3, c - 4); ctx.textAlign = "left"; ctx.fillText("E", 3, c - 4);
  an.peaks.forEach((p) => {
    const x = c + rOf(p.ph) * Math.sin(p.th * D2R), y = c - rOf(p.ph) * Math.cos(p.th * D2R);
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = p.type === "P" ? "#B3261E" : "#1D4ED8"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = "#13232A"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"; ctx.fillText(p.label, x, y + 4);
  });
  an.edits.forEach((e) => {
    const x = c + rOf(e.ph) * Math.sin(e.th * D2R), y = c - rOf(e.ph) * Math.cos(e.th * D2R);
    ctx.beginPath(); ctx.rect(x - 9, y - 9, 18, 18); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#D97706"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = "#13232A"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.fillText(e.label, x, y + 3.5);
  });
  const gx = 40, gw = Sz - 80, gy = Sz + 14, grad = ctx.createLinearGradient(gx, 0, gx + gw, 0);
  for (let k = 0; k <= 10; k++) { const col = O.corDoDesvio(-range + (2 * range) * k / 10, range, 1); grad.addColorStop(k / 10, "rgb(" + Math.round(col[0] * 255) + "," + Math.round(col[1] * 255) + "," + Math.round(col[2] * 255) + ")"); }
  ctx.fillStyle = grad; ctx.fillRect(gx, gy, gw, 12); ctx.strokeStyle = "#93A8B1"; ctx.lineWidth = 1; ctx.strokeRect(gx, gy, gw, 12);
  ctx.fillStyle = "#13232A"; ctx.font = "11px sans-serif";
  ctx.textAlign = "left"; ctx.fillText("−" + range + " mm alívio", gx, gy + 28); ctx.textAlign = "center"; ctx.fillText("0", gx + gw / 2, gy + 28); ctx.textAlign = "right"; ctx.fillText("+" + range + " mm contato", gx + gw, gy + 28);
  ctx.textAlign = "center"; ctx.fillStyle = "#47606A"; ctx.font = "10px sans-serif"; ctx.fillText("Vista superior · D = direita do paciente", Sz / 2, Sz + 52);
  cv.hidden = false;
  return true;
}
function indicLabel(an) { if (an.usePl && an.useBr) return "Plagiocefalia + braquicefalia"; if (an.useBr) return "Braquicefalia (alvo de índice cefálico)"; return "Plagiocefalia (espelho sagital)"; }
function croResumo(extra) {
  const an = CRO.an; if (!an) return;
  const L = [];
  L.push("Plano de referência: z = " + fN(CRO.zRef, 1) + " mm");
  L.push("Indicação: " + indicLabel(an) + (an.mode === "auto" ? " (automática)" : ""));
  L.push("Índice cefálico no plano: " + fN(an.ic, 2) + (an.useBr ? " → alvo " + fN(an.icTarget, 2) : ""));
  L.push("Desvio radial máx. do alvo: " + fN(an.maxAbs, 1) + " mm");
  const P = an.peaks.filter((p) => p.type === "P"), A = an.peaks.filter((p) => p.type === "A");
  L.push(""); L.push("Contato / pressão:");
  if (!P.length) L.push("  nenhum ponto ≥ 1,0 mm");
  P.forEach((p) => L.push("  " + p.label + "  +" + fN(p.mag, 1) + " mm  " + p.region + "  (az " + fN(p.th, 0) + "°, el " + fN(p.ph, 0) + "°)"));
  L.push("Alívio / vazio:");
  if (!A.length) L.push("  nenhum ponto ≥ 1,0 mm");
  A.forEach((p) => L.push("  " + p.label + "  −" + fN(Math.abs(p.mag), 1) + " mm  " + p.region + "  (az " + fN(p.th, 0) + "°, el " + fN(p.ph, 0) + "°)"));
  if (an.edits.length) L.push("Correções manuais aplicadas: " + an.edits.length);
  L.push(""); croTrimLines(an, readParams()).forEach((l) => L.push(l));
  if (Math.abs(CRO.zRef - S3.z) > 0.05) L.push("ℹ O plano axial atual difere do usado na análise (z = " + fN(CRO.zRef, 1) + " mm).");
  const ex = extra || (CRO.stale ? ['⚠ Órtese desatualizada: o mapa ou os parâmetros mudaram. Toque em "Gerar órtese".'] : CRO.lastLines);
  if (ex) { L.push(""); ex.forEach((l) => L.push(l)); }
  $("cro-summary").textContent = L.join("\n");
}
function croListas() {
  const an = CRO.an, box = $("cro-lists"); if (!an) { box.innerHTML = ""; return; }
  let h = '<div class="lst-h">Pontos detectados automaticamente</div>';
  if (!an.peaks.length) h += '<div class="lst-r muted">Nenhum ponto ≥ 1,0 mm.</div>';
  an.peaks.forEach((p, i) => { h += `<div class="lst-r"><span class="chip ${p.type === "P" ? "chip-p" : "chip-a"}">${esc(p.label)}</span><span class="lst-t">${p.type === "P" ? "+" : "−"}${fN(Math.abs(p.mag), 1)} mm · ${esc(p.region)}</span><button type="button" class="lst-b" data-act="zero" data-i="${i}" title="Anula o desvio ao redor deste ponto (falso positivo)">Anular</button></div>`; });
  h += '<div class="lst-h">Correções manuais</div>';
  if (!an.edits.length) h += '<div class="lst-r muted">Nenhuma. Escolha uma ferramenta acima e clique na malha 3D ou no mapa.</div>';
  an.edits.forEach((e) => { h += `<div class="lst-r"><span class="chip chip-e">${esc(e.label)}</span><span class="lst-t">${KIND_LABEL[e.kind]}${e.kind === "zero" ? "" : " " + fN(e.mm, 1) + " mm"} · raio ${fN(e.radiusMm, 0)} mm · ${esc(e.region)}</span><button type="button" class="lst-b" data-act="del" data-id="${e.id}">Remover</button></div>`; });
  box.innerHTML = h;
}
function croDesatualizar() { if (CRO.casco && !CRO.stale) { CRO.stale = true; $("btn-cro-export").disabled = true; } }
// redesenha tudo a partir do estado atual da análise (após indicação, correção ou nova análise)
function croRefresh() {
  const an = CRO.an; if (!an || !malha) return;
  CRO.range = Math.max(2, Math.ceil(an.maxAbs));
  malha.geometry.setAttribute("color", new T.BufferAttribute(O.coresDosVertices(S3.pos, an, CRO.zRef, CRO.range), 3));
  croMarcadores(an, CRO.zRef); croPolar(an, CRO.range); croDesatualizar(); croResumo(); croListas();
  $("cro-ic-info").textContent = "IC medido no plano de referência: " + fN(an.ic, 2) + " (largura " + fN(an.width, 0) + " mm × comprimento " + fN(an.length, 0) + " mm). " +
    (an.useBr ? "Alvo " + fN(an.icTarget, 2) + (an.age && !CRO.icTouched ? " (início aos " + fN(an.age, 0) + " meses: redução esperada ≈ " + fN(O.ganhoEsperadoIC(an.age) * 100, 1) + " pontos)" : "") + "." : "Alvo de IC inativo nesta indicação.");
  aplicarCamadas(); atualizarEstado();
}
function syncIcField() { const an = CRO.an; if (an && !CRO.icTouched) $("cro-ic-target").value = fN(an.icTarget, 2); }
function applyIndication() { const an = CRO.an; if (!an) return; O.definirIndicacao(an, indicOpts()); syncIcField(); croRefresh(); }
// semConfirmar: chamada pela ficha (aplica sem pedir confirmação); botao: o que recebe o segundo clique
function runAnalysis(botao, semConfirmar) {
  if (!S3.pos) return false;
  if (S3.eixo !== "axial") { status('Selecione o corte <b>Axial</b> (etapa 2) e posicione-o na altura glabela–opistocrânio antes de analisar.', true); return false; }
  if (!semConfirmar) {
    const b = botao || $("btn-cro-analyze");
    if (!S3.alinhado && !doisCliques("semAlinhar", b, "Confirmar: analisar sem alinhar", "O modelo ainda não foi alinhado pelos pontos de referência; a análise depende do eixo sagital correto. Toque de novo para continuar assim mesmo.")) return false;
    if (CRO.an && CRO.an.edits.length && !doisCliques("reanalisar", b, "Confirmar: descartar correções", `Analisar de novo descarta as ${CRO.an.edits.length} correções manuais. Toque de novo para continuar.`)) return false;
  }
  const zRef = S3.z, an = O.analisar(S3.pos, zRef);
  if (an.error) { status(esc(an.error), true); return false; }
  CRO.an = an; CRO.zRef = zRef;
  O.definirIndicacao(an, indicOpts()); syncIcField();
  $("cro-show-map").checked = true;
  croRefresh(); ETP.feito("s4");
  status("Mapa de pressão gerado (vermelho = contato, azul = alívio). Use a correção manual para ajustar; depois, gere a órtese (etapa 5).");
  return true;
}
async function runGenerate() {
  if (!CRO.an && !runAnalysis($("btn-cro-generate"))) return;
  const an = CRO.an, P = readParams();
  $("btn-cro-generate").disabled = true; CASCA.ocupado(true, "Gerando a órtese…"); await UI.espera(30);
  try {
    const res = O.gerarOrtese(an, CRO.zRef, P, S3.pos);
    descartar(CRO.casco);
    const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.BufferAttribute(res.tris, 3)); geo.computeVertexNormals();
    CRO.casco = new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0x6B3FD6, roughness: 0.55, metalness: 0.05, side: T.DoubleSide, transparent: true, opacity: numOf("cro-opacity", 75) / 100, depthWrite: false }));
    CRO.casco.renderOrder = 2; cena.add(CRO.casco);
    CRO.tris = res.tris; CRO.stale = false; $("cro-show-helmet").checked = true;
    const s = res.stats, gp = s.gap || {};
    const lines = [
      "Órtese (" + (P.type === "band" ? "faixa de topo aberto" : "capacete fechado") + ", modo " + (P.mode === "active" ? "ativo" : "passivo") + (/^lateral/.test(P.split) ? ", peça inteira com fenda lateral " + (P.split === "lateralR" ? "D" : "E") : "") + "):",
      "  triângulos " + s.triangles.toLocaleString("pt-BR") + " · volume " + fN(s.volume_cm3, 1) + " cm³",
      "  massa ≈ " + fN(s.mass_g, 0) + " g (PA12, ρ≈1,01 g/cm³, sem forro)",
      "  dimensões " + s.size.map((v) => fN(v, 0)).join(" × ") + " mm",
      "  reserva de crescimento: " + fN(P.growMonths, 0) + " meses × " + fN(P.growRate, 1) + " mm/mês = " + fN(P.growMonths * P.growRate, 1) + " mm (contato " + fN(P.growContactPct, 0) + "%) + " + fN(P.growVertex, 1) + " mm no vértice",
      "  borda: " + (P.cheek === "off" ? "sem apoio na bochecha" : "apoio na bochecha até " + fN(P.cheekDepth, 0) + " mm abaixo do plano") + "; orelhas D/E: " + (s.ears ? s.ears.R.src + " / " + s.ears.L.src : "—"),
      "  folga média à cabeça: contato " + fN(gp.contact, 1) + " · neutra " + fN(gp.neutral, 1) + " · alívio " + fN(gp.relief, 1) + " mm"
    ];
    if (s.interference) { const itf = s.interference.mm; lines.push("  interferência máx. com a malha: " + fN(itf, 1) + " mm" + (itf > 0.5 ? "  ⚠ revisar (orelhas/borda/ruído da malha)" : "  (negativo = folga)")); }
    CRO.lastParams = P; CRO.lastStats = s; CRO.lastLines = lines;
    croResumo(); aplicarCamadas(); $("btn-cro-export").disabled = false; ETP.feito("s5");
    status("Órtese gerada. Confira a verificação e exporte o STL.");
  } catch (err) { console.error(err); status("Falha ao gerar a órtese: " + esc(err && err.message ? err.message : String(err)), true); }
  CASCA.ocupado(false); $("btn-cro-generate").disabled = false; atualizarEstado();
}

// ------------------------------------------------------------------ correção manual
function markEar(side, th, z) {
  const isR = side === "r";
  if (isR !== (th < 180)) { status("Clique na orelha " + (isR ? "direita (lado D do paciente)" : "esquerda (lado E do paciente)") + ".", true); return; }
  const u = isR ? th : 360 - th, clr = numOf("cro-ear-clear", 8);
  $("cro-ear-az-" + side).value = fN(u, 0);
  if (z != null) $("cro-ear-top-" + side).value = fN(z + clr, 0);
  CRO.earMan[side] = true;
  croMarcadores(CRO.an, CRO.zRef); croDesatualizar(); croResumo(); aplicarCamadas();
  status("Orelha " + (isR ? "D" : "E") + " marcada: azimute " + fN(u, 0) + "°" + (z != null ? ", topo " + fN(z, 0) + " mm do plano (arco " + sgn(z + clr) + " mm)" : "") + ". Ajuste a largura da janela se precisar.");
  setTool("none"); atualizarEstado();
}
function addManualEdit(th, ph) {
  const an = CRO.an, kind = CRO.tool;
  if (!an || kind === "none") return;
  if (kind.indexOf("ear-") === 0) { status("Marque a orelha clicando sobre ela na malha 3D."); return; }
  const radiusMm = Math.min(80, Math.max(8, numOf("cro-edit-r", 25))), mm = Math.min(10, Math.max(0.5, numOf("cro-edit-mm", 3)));
  const ed = O.acrescentarCorrecao(an, { kind, th, ph, radiusMm, mm });
  croRefresh();
  status(esc(ed.label) + ": " + KIND_LABEL[kind].toLowerCase() + (kind === "zero" ? "" : " " + fN(mm, 1) + " mm") + " em " + esc(ed.region) + ".");
}
function ligarCliques() {
  const el = desenhista.domElement, rc = new T.Raycaster();
  const acerto = (e) => { const r = el.getBoundingClientRect(); rc.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera); return malha ? rc.intersectObject(malha, false)[0] : null; };
  el.addEventListener("dblclick", (e) => {
    if (!S3.armado || !malha) return;
    const h = acerto(e); if (!h) return;
    const k = $("landmark-select").value; marcarPonto(k, [h.point.x, h.point.y, h.point.z]);
    S3.armado = false; $("btn-arm-mark").textContent = "Marcar na malha";
    const prox = O.PONTOS_DE_REFERENCIA.find((q) => !S3.pontos[q]); if (prox) $("landmark-select").value = prox;
    status(`Ponto <b>${PONTOS[k].nome}</b> marcado.${prox ? ` Próximo: ${PONTOS[prox].nome}.` : " Os 5 pontos estão marcados: toque em <b>Alinhar aos eixos anatômicos</b>."}`);
  });
  let down = null;
  el.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
  el.addEventListener("pointerup", (e) => {
    const d = down; down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;      // arraste = girar a câmera
    if (CRO.tool === "none" || !CRO.an || !malha || S3.armado) return;
    if (!malha.visible) { status('Ative "Cabeça" para editar sobre a malha.'); return; }
    const h = acerto(e); if (!h) return;
    const p = malha.worldToLocal(h.point.clone()), zz = p.z - CRO.zRef, r = Math.hypot(p.x, p.y, zz) || 1;
    let th = Math.atan2(p.x, p.y) / D2R; if (th < 0) th += 360;
    if (CRO.tool.indexOf("ear-") === 0) { markEar(CRO.tool.slice(4), th, zz); return; }
    addManualEdit(th, Math.asin(Math.max(-1, Math.min(1, zz / r))) / D2R);
  });
}
$("cro-polar").addEventListener("click", (e) => {
  if (CRO.tool === "none" || !CRO.an) return;
  const cv = $("cro-polar"), rect = cv.getBoundingClientRect();
  const px = (e.clientX - rect.left) * cv.width / rect.width, py = (e.clientY - rect.top) * cv.height / rect.height, { c, R } = polarGeom();
  const dx = (px - c) / R, dy = (c - py) / R, rn = Math.hypot(dx, dy); if (rn > 1) return;
  let th = Math.atan2(dx, dy) / D2R; if (th < 0) th += 360;
  if (CRO.tool.indexOf("ear-") === 0) { markEar(CRO.tool.slice(4), th, null); return; }
  addManualEdit(th, 90 - rn * (90 - POLAR_EDGE));
});
$("cro-lists").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-act]"), an = CRO.an; if (!b || !an) return;
  if (b.dataset.act === "del") O.removerCorrecao(an, parseInt(b.dataset.id, 10));
  else { const p = an.peaks[parseInt(b.dataset.i, 10)]; if (!p) return; O.acrescentarCorrecao(an, { kind: "zero", th: p.th, ph: p.ph, radiusMm: 30, mm: 0 }); }
  croRefresh();
});
$("btn-cro-undo").onclick = () => { const an = CRO.an; if (!an || !an.edits.length) return; O.removerCorrecao(an, an.edits[an.edits.length - 1].id); croRefresh(); };
$("btn-cro-clear-edits").onclick = () => {
  const an = CRO.an; if (!an || !an.edits.length) return;
  if (!doisCliques("limparCorrecoes", $("btn-cro-clear-edits"), "Confirmar", `Toque em <b>Confirmar</b> para remover as ${an.edits.length} correções manuais.`)) return;
  O.limparCorrecoes(an); croRefresh(); status("Correções manuais removidas.");
};
["r", "l"].forEach((s) => ($("btn-cro-mark-ear-" + s).onclick = () => {
  if (!CRO.an) { status("Analise a pressão antes de marcar a orelha.", true); return; }
  setTool("ear-" + s); mostrarVista("3d");
  status("Clique no TOPO da orelha " + (s === "r" ? "direita (D)" : "esquerda (E)") + " do paciente na malha 3D (ou no azimute do mapa em vista superior).");
}));
$("btn-cro-ear-auto").onclick = () => {
  CRO.earMan = { r: false, l: false };
  if (CRO.an) { croMarcadores(CRO.an, CRO.zRef); croDesatualizar(); croResumo(); aplicarCamadas(); }
  status("Orelhas: voltou à detecção automática."); atualizarEstado();
};
$("cro-tool").addEventListener("change", () => {
  setTool($("cro-tool").value);
  status(CRO.tool === "none" ? "Edição de pressão desativada." : 'Ferramenta "' + esc($("cro-tool").selectedOptions[0].textContent) + '": clique na malha 3D ou no mapa em vista superior.');
  if (CRO.tool !== "none") mostrarVista("3d");
});
$("cro-indic").addEventListener("change", applyIndication);
$("cro-ic-target").addEventListener("change", () => { CRO.icTouched = true; applyIndication(); });
// qualquer parâmetro de projeto alterado invalida a órtese já gerada
document.querySelectorAll("#cro-params input, #cro-params select, #cro-indic, #cro-age, #cro-ic-target, #cro-mode, #cro-relief, #cro-relief-max, #cro-comp-max").forEach((el) => el.addEventListener("change", () => {
  syncGrowth();
  if (CRO.an) { croMarcadores(CRO.an, CRO.zRef); croDesatualizar(); croResumo(); aplicarCamadas(); }
  atualizarEstado();
}));
$("cro-age").addEventListener("change", () => { syncGrowth(); applyIndication(); });
$("btn-cro-ic-auto").onclick = () => { CRO.icTouched = false; applyIndication(); };
$("btn-cro-analyze").onclick = () => { runAnalysis($("btn-cro-analyze")); };
$("btn-cro-generate").onclick = runGenerate;
["cro-show-head", "cro-show-map", "cro-show-helmet", "cro-show-marks"].forEach((id) => $(id).addEventListener("change", aplicarCamadas));
$("cro-opacity").addEventListener("input", aplicarCamadas);
// vírgula decimal padronizada
document.querySelectorAll(".cro-sec").forEach((sec) => sec.addEventListener("change", (e) => { const t = e.target; if (t.matches && t.matches("input[inputmode=decimal]") && /^-?\d+\.\d+$/.test(t.value.trim())) t.value = t.value.trim().replace(".", ","); }, true));
const codigoArquivo = () => E.nomeArquivo($("pId").value.trim() || E.iniciais($("pName").value.trim()) || "cranio");
$("btn-cro-export").onclick = async () => {
  if (!CRO.tris || CRO.stale) return;
  const nome = `${codigoArquivo()}_ortese_craniana_${E.dataCompacta(new Date())}.stl`;
  const r = await entregar(nome, O.stlDaOrtese(CRO.tris), "model/stl");
  if (r) $("why-export").textContent = "";
};

// ------------------------------------------------------------------ campos condicionais, orelhas, verificação e estado
function conditionals() {
  const v = (id) => $(id).value, hide = (id, h) => { const r = $("row-" + id); if (r) r.classList.toggle("is-hidden", h); };
  hide("cro-bandtop", v("cro-type") !== "band"); hide("cro-bandtop-back", v("cro-type") !== "band");
  hide("cro-comp-max", v("cro-mode") !== "active");
  const an = CRO.an, noBr = v("cro-indic") === "plagio" || (v("cro-indic") === "auto" && an && !an.useBr);
  hide("cro-ic-target", !!noBr); $("btn-cro-ic-auto").parentElement.classList.toggle("is-hidden", !!noBr); $("cro-ic-info").classList.toggle("is-hidden", !!noBr);
  const ck = v("cro-cheek") === "off", ms = v("cro-mast") === "off", sp = v("cro-split") === "none";
  ["cro-cheek-w", "cro-cheek-depth", "cro-cheek-gap"].forEach((id) => hide(id, ck));
  ["cro-mast-w", "cro-mast-depth", "cro-mast-gap"].forEach((id) => hide(id, ms));
  ["cro-split-pos", "cro-gap"].forEach((id) => hide(id, sp)); hide("cro-split-pos", sp || /^lateral/.test(v("cro-split")));
}
function earInfo() {
  const el = $("cro-ear-info"), an = CRO.an;
  if (!an) { el.style.color = ""; el.textContent = "Analise a pressão para detectar as orelhas."; return; }
  const ears = O.resolverOrelhas(an, readParams()), part = (s) => (s === "R" ? "D" : "E") + ": " + ears[s].src + " (az " + fN(ears[s].az, 0) + "°, arco " + sgn(ears[s].top) + " mm)";
  const bad = ["R", "L"].some((s) => ears[s].src !== "detectada" && ears[s].src !== "manual");
  el.style.color = bad ? "var(--warn)" : ""; el.textContent = part("R") + " · " + part("L") + (bad ? " — ⚠ detecção duvidosa: marque as orelhas." : "");
}
function renderChecklist() {
  const ul = $("cro-check"), s = CRO.lastStats, P = CRO.lastParams, an = CRO.an;
  if (!s || !P) { ul.innerHTML = '<li class="ck-na">Gere a órtese para ver a verificação.</li>'; return; }
  const it = [], add = (st, t, d) => it.push('<li class="ck-' + st + '">' + t + (d ? "<small>" + d + "</small>" : "") + "</li>");
  add(S3.alinhado ? "ok" : "bad", "Modelo alinhado e plano na altura glabela–opistocrânio", S3.alinhado ? "" : "Alinhe o modelo na etapa 1.");
  add("ok", "Pressão analisada", an && an.edits && an.edits.length ? an.edits.length + " correção(ões) manual(is) aplicada(s): confira o mapa." : "");
  add(CRO.stale ? "warn" : "ok", "Órtese atualizada com os parâmetros atuais", CRO.stale ? "Os parâmetros mudaram: gere novamente." : "");
  const e = s.ears, okE = e && ["R", "L"].every((k) => e[k].src === "detectada" || e[k].src === "manual");
  add(okE ? "ok" : "warn", "Orelhas D/E conferidas", e ? "D: " + esc(e.R.src) + " · E: " + esc(e.L.src) : "");
  if (P.cheek !== "off") add(an && an.cheekCoverage >= 0.7 ? "ok" : "warn", "Região da bochecha coberta pelo escaneamento", an ? fN(an.cheekCoverage * 100, 0) + "% de cobertura" + (an.cheekCoverage < 0.7 ? ": o apoio usa dados extrapolados." : "") : "");
  if (s.interference) { const m = s.interference.mm; add(m <= 0.5 ? "ok" : m <= 2 ? "warn" : "bad", "Sem interferência com a cabeça", "Máx. " + fN(m, 1) + " mm" + (m > 0.5 ? " (revisar orelhas, borda ou ruído da malha)." : " (negativo = folga).")); }
  add(P.c0 >= 1 ? "ok" : "warn", "Folga/forro de " + fN(P.c0, 1) + " mm", P.c0 >= 1 ? "" : "Abaixo de 1 mm: pouco espaço para o forro.");
  add(P.t >= 2.5 ? "ok" : "warn", "Espessura da casca de " + fN(P.t, 1) + " mm", P.t >= 2.5 ? "" : "Abaixo de 2,5 mm: confirme a resistência do material.");
  add(P.growMonths * P.growRate > 0 ? "ok" : "warn", "Reserva de crescimento", P.growMonths * P.growRate > 0 ? fN(P.growMonths, 0) + " meses × " + fN(P.growRate, 1) + " mm/mês" : "Sem reserva: a cabeça não terá espaço para crescer.");
  if (s.mesh) add(s.mesh.pinch === 0 && s.mesh.dropped === 0 ? "ok" : "bad", "Malha fechada (pronta para impressão)", s.mesh.pinch === 0 && s.mesh.dropped === 0 ? "" : s.mesh.pinch + " vértice(s) de borda irregular e " + s.mesh.dropped + " triângulo(s) descartado(s): gere em resolução maior.");
  ul.innerHTML = it.join("");
}
// estado do fluxo (antes um setInterval de 400 ms; agora chamado depois de cada ação)
function atualizarEstado() {
  const tem = !!S3.pos, an = !!CRO.an, gen = !!CRO.lastStats && !CRO.stale;
  const w = (id, t) => { if ($(id).textContent !== t) $(id).textContent = t; };
  w("why-extract", !tem ? "" : S3.eixo !== "axial" ? 'Use o corte "Axial" para extrair.' : !S3.alinhado ? "Modelo não alinhado: as medidas ficam indicativas. Alinhe na etapa 1." : "");
  w("why-analyze", !tem ? "Abra o STL do scan na etapa 1." : !S3.alinhado ? "Alinhe o modelo aos eixos anatômicos (etapa 1)." : "");
  w("why-generate", !tem ? "Abra o STL do scan na etapa 1." : !an ? "Analise a pressão primeiro (etapa 4)." : CRO.stale ? "Parâmetros alterados: gere novamente." : "");
  w("why-export", CRO.tris && !CRO.stale ? "" : "Gere a órtese primeiro.");
  listarPontos(); earInfo(); conditionals(); renderChecklist();
}
["cro-ear-mode", "cro-ear-az-r", "cro-ear-az-l", "cro-ear-top-r", "cro-ear-top-l", "cro-ear-w-r", "cro-ear-w-l", "cro-ear-clear"].forEach((id) => $(id).addEventListener("input", earInfo));
["s4", "s5"].forEach((id) => $(id).addEventListener("input", conditionals));

// ------------------------------------------------------------------ vistas da câmera
$("vistas3d").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-view]"); if (!b) return;
  if (!malha) { status("Abra um scan para usar as vistas."); return; }
  const g = malha.geometry; g.computeBoundingSphere();
  const s = g.boundingSphere, c = s.center, d = s.radius * 2.8, v = b.dataset.view, DIR = { front: [0, 1, 0], back: [0, -1, 0], right: [1, 0, 0], left: [-1, 0, 0], top: [0, -0.02, 1] };
  camera.up.set(0, 0, 1);
  if (v === "flip") camera.position.set(2 * c.x - camera.position.x, 2 * c.y - camera.position.y, camera.position.z);
  else if (v === "fit") { const o = camera.position.clone().sub(c); if (o.length() < 1e-6) o.set(0, -0.02, 1); o.normalize().multiplyScalar(d); camera.position.copy(c).add(o); }
  else { const k = DIR[v]; camera.position.set(c.x + k[0] * d, c.y + k[1] * d, c.z + k[2] * d); if (!S3.alinhado) status("Modelo ainda não alinhado: as vistas seguem os eixos originais do STL."); }
  controles.target.copy(c); controles.update();
});

// ------------------------------------------------------------------ predefinições (protocolos do serviço)
const WL = ["cro-type", "cro-bandtop", "cro-bandtop-back", "cro-hole-zone", "cro-mode", "cro-relief", "cro-relief-max", "cro-comp-max", "cro-grow-src", "cro-grow-m", "cro-grow-rate", "cro-grow-contact", "cro-grow-vertex", "cro-cheek", "cro-cheek-w", "cro-cheek-depth", "cro-cheek-gap", "cro-cheek-clear", "cro-mast", "cro-mast-w", "cro-mast-depth", "cro-mast-gap", "cro-c0", "cro-t", "cro-hf", "cro-hb", "cro-occ-drop", "cro-occ-w", "cro-hole-d", "cro-pitch", "cro-margin", "cro-res", "cro-split", "cro-split-pos", "cro-gap", "cro-ear-clear"];
const DEF = {}; WL.forEach((id) => { DEF[id] = $(id).value; });
const BUILT = {   // valores que não aparecem aqui voltam ao padrão da página (protocolo Lab.EITA)
  b0: { n: "Lab.EITA (faixa inclinada, peça inteira)", v: FX.PROTOCOLO_LABEITA },
  b1: { n: "Braquicefalia", v: { "cro-indic": "brachy", "cro-mode": "passive" } },
  b2: { n: "Plagiocefalia", v: { "cro-indic": "plagio", "cro-mode": "passive" } },
  b3: { n: "Faixa de topo reto (55°)", v: { "cro-type": "band", "cro-bandtop": "55", "cro-bandtop-back": "55", "cro-split": "none" } },
  b4: { n: "Mais ventilada (furos maiores)", v: { "cro-hole-d": "5", "cro-pitch": "11", "cro-hole-zone": "all" } },
  b5: { n: "Capacete fechado (padrão da versão antiga)", v: Object.fromEntries(Object.entries(FX.PADRAO_ANTIGO).filter(([k]) => !["cro-indic", "cro-age", "cro-ic-target"].includes(k))) }
};
const CHAVE_PROTOCOLOS = "eitaCRANIO.protocolos.v1";
const lerProtocolos = () => { try { return JSON.parse(localStorage.getItem(CHAVE_PROTOCOLOS) || "{}") || {}; } catch (e) { return {}; } };
const gravarProtocolos = (p) => { try { localStorage.setItem(CHAVE_PROTOCOLOS, JSON.stringify(p)); return true; } catch (e) { return false; } };
let protocolos = lerProtocolos();
function listarProtocolos() {
  $("cro-preset").innerHTML = '<option value="">Selecione…</option>' + Object.keys(BUILT).map((k) => `<option value="${k}">${BUILT[k].n}</option>`).join("") +
    Object.keys(protocolos).map((k) => `<option value="c:${esc(k)}">★ ${esc(k)}</option>`).join("");
}
listarProtocolos();
function aplicarValores(vals) { Object.keys(vals).forEach((id) => { const el = $(id); if (!el || el.value === vals[id]) return; el.value = vals[id]; el.dispatchEvent(new Event("change", { bubbles: true })); }); }
$("cro-preset").addEventListener("change", () => {
  const k = $("cro-preset").value; if (!k) return;
  let vals, nome;
  if (k.indexOf("c:") === 0) { nome = k.slice(2); vals = Object.assign({}, DEF, protocolos[nome]); } else { nome = BUILT[k].n; vals = Object.assign({}, DEF, BUILT[k].v); }
  aplicarValores(vals); conditionals();
  status("Predefinição aplicada: " + esc(nome) + ". Revise os valores e gere a órtese.");
  $("cro-preset").value = "";
});
$("btn-cro-preset-save").onclick = () => {
  const nome = $("cro-preset-name").value.trim().replace(/[<>"]/g, "");
  if (!nome) { status("Digite um nome para o protocolo.", true); return; }
  const v = {}; WL.forEach((id) => { v[id] = $(id).value; }); protocolos[nome] = v;
  const ok = gravarProtocolos(protocolos); listarProtocolos(); $("cro-preset-name").value = "";
  status('Protocolo "' + esc(nome) + '" ' + (ok ? "salvo neste navegador (entra na base do laboratório)." : "disponível só nesta sessão (o navegador bloqueou o armazenamento)."));
};

/* ================================================================== ficha (núcleo: ficha.js) */
const PAT_IDS = FX.CAMPOS_PACIENTE;
const FICHAS = E.criarArmazemFichas({ chave: "eitaCRANIO.fichas.v1", formatoFicha: FX.FORMATO_FICHA, formatoBase: FX.FORMATO_BASE, versaoApp: FX.VERSAO_APP, prefixoBase: "base_EITA_CRANIO", rotulo: "EITA! CRÂNIO" });
let delPend = null;
const lerPaciente = () => Object.fromEntries(PAT_IDS.map((id) => [id, $(id).value.trim()]));
function escreverPaciente(p) { PAT_IDS.forEach((id) => ($(id).value = (p && p[id]) || "")); atualizarIdade(); }
function atualizarIdade() {
  const nasc = $("pBirth").value, n = $("pName").value.trim() || $("pId").value.trim();
  $("pBadge").textContent = n ? "· " + n : "";
  if (!nasc) { $("pAge").textContent = ""; renderHistorico(); return; }
  const d = C.idadeEmDias(nasc, hoje()), dc = C.idadeCorrigidaDias(nasc, hoje(), $("pGest").value);
  $("pAge").textContent = "Idade hoje: " + C.idadeTextoDias(d) + (dc !== d ? " · corrigida: " + C.idadeTextoDias(dc) : "");
  renderHistorico();
}
["pBirth", "pGest", "pName", "pId"].forEach((id) => $(id).addEventListener("input", atualizarIdade));
// idade da órtese (meses, corrigida em prematuros) a partir do nascimento e da data da medição, como na página antiga
function idadeParaOrtese() {
  const a = FX.idadeEmMeses($("pBirth").value, $("mData").value, $("pGest").value); if (!a || a.meses < 0) return;
  const m = a.corrigida != null ? a.corrigida : a.meses;
  if (m <= 36 && $("cro-age").value !== String(m)) { $("cro-age").value = String(m); $("cro-age").dispatchEvent(new Event("change", { bubbles: true })); }
}
["pBirth", "pGest", "mData"].forEach((id) => $(id).addEventListener("change", idadeParaOrtese));
// parte da órtese na ficha
const lerEntradas = () => { const o = {}; document.querySelectorAll("#s4 input[id], #s4 select[id], #s5 input[id], #s5 select[id]").forEach((el) => { if (el.type === "file" || el.type === "button") return; o[el.id] = el.type === "checkbox" ? el.checked : el.value; }); return o; };
const PADRAO_PAGINA = lerEntradas();   // valores iniciais dos campos da órtese (protocolo Lab.EITA): voltam numa ficha nova
function escreverEntradas(o) { Object.keys(o || {}).forEach((id) => { const el = $(id); if (!el) return; if (el.type === "checkbox") el.checked = !!o[id]; else el.value = o[id]; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }); }
const edicoes = () => (CRO.an ? CRO.an.edits.map((e) => ({ kind: e.kind, th: +e.th.toFixed(2), ph: +e.ph.toFixed(2), radiusMm: e.radiusMm, mm: e.mm, label: e.label })) : []);
const estatisticas = () => { try { return CRO.lastStats ? JSON.parse(JSON.stringify(CRO.lastStats)) : null; } catch (e) { return null; } };
function retrato() { return { entradas: lerEntradas(), edicoes: edicoes(), earMan: { r: !!CRO.earMan.r, l: !!CRO.earMan.l }, planoZ: S3.pos ? +S3.z.toFixed(3) : null, analisado: !!CRO.an, gerada: !!(CRO.tris && !CRO.stale), resultado: estatisticas() }; }
function coletarOrtese() {
  if (!S3.pos) {   // sem scan aberto: mantém o que veio da ficha (aguardando o scan), com os campos atuais
    if (S3.pendente) return Object.assign({}, S3.pendente, { entradas: lerEntradas(), versoes: S3.versoes });
    return S3.versoes.length ? { scan: null, alinhamento: null, planoZ: null, entradas: lerEntradas(), edicoes: [], earMan: null, analisado: false, gerada: false, resultado: null, versoes: S3.versoes } : null;
  }
  return Object.assign({ scan: { nome: S3.arquivo, unidade: S3.unidade }, alinhamento: S3.alinhamento }, retrato(), { versoes: S3.versoes });
}
function coletar() {
  if (!S.fichaId) S.fichaId = E.novoIdFicha("c");
  const P = lerPaciente(), f = { formato: FX.FORMATO_FICHA, versaoApp: FX.VERSAO_APP, id: S.fichaId, nome: P.pName || P.pId, paciente: P, atualizado: new Date().toISOString(), medicoes: [...S.medicoes].sort((a, b) => a.data.localeCompare(b.data)), atual: { mm: S.m, unidade: S.unidade, data: $("mData").value } };
  if (S.origem) f.atual.origem = Object.assign({}, S.origem);
  const o = coletarOrtese(); if (o) f.ortese = o;
  if (S.fichaOrigem) f.origem = S.fichaOrigem;
  return f;
}
function salvarFicha(silencioso) {
  const f = coletar();
  if (!f.nome) { if (!silencioso) { status("Dê um nome ou código à ficha antes de salvar.", true); ETP.abrir("s0"); $("pName").focus(); } return false; }
  const ok = FICHAS.salvar(f); renderFichas();
  if (!silencioso) status(ok ? `Ficha "${esc(f.nome)}" salva neste navegador, com ${f.medicoes.length} medição(ões)${f.ortese ? " e o projeto da órtese" : ""}.` : 'Não foi possível salvar no navegador; use "Exportar".', !ok);
  return ok;
}
const autoSalvar = () => (($("pName").value.trim() || $("pId").value.trim()) ? salvarFicha(true) : false);
function renderFichas() {
  const l = FICHAS.listar(), box = $("fList");
  if (!l.length) { box.innerHTML = '<div class="note">Nenhuma ficha salva neste navegador.</div>'; return; }
  box.innerHTML = l.map((f, i) => `<div class="frow${f.id === S.fichaId ? " cur" : ""}"><div><b>${esc(f.nome || "(sem nome)")}</b><small>${(f.medicoes || []).length} medição(ões)${f.ortese && f.ortese.scan && f.ortese.scan.nome ? " · " + esc(f.ortese.scan.nome) : ""} · ${new Date(f.atualizado).toLocaleDateString("pt-BR")}</small></div><button type="button" data-open="${i}">Abrir</button><button type="button" data-del="${i}" title="Excluir">${delPend === f.id ? "Confirmar" : "×"}</button></div>`).join("");
  box.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => abrirFicha(FICHAS.listar()[+b.dataset.open])));
  box.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => {
    const f = FICHAS.listar()[+b.dataset.del];
    if (delPend !== f.id) { delPend = f.id; renderFichas(); status(`Clique em "Confirmar" para excluir a ficha "${esc(f.nome || "")}" deste navegador.`); setTimeout(() => { if (delPend === f.id) { delPend = null; renderFichas(); } }, 5000); return; }
    FICHAS.excluir(+b.dataset.del); delPend = null; if (f.id === S.fichaId) S.fichaId = null; renderFichas(); status("Ficha excluída deste navegador.");
  }));
}
function abrirFicha(f) {
  if (FX.ehFichaAntiga(f)) f = FX.converterFichaAntiga(f);
  if (!FICHAS.ehFicha(f)) { status("Arquivo de ficha não reconhecido.", true); return; }
  S.fichaId = f.id; S.fichaOrigem = f.origem || null; S.medicoes = (f.medicoes || []).map((x) => ({ ...x }));
  escreverPaciente(f.paciente || { pName: f.nome });
  const ult = [...S.medicoes].sort((a, b) => b.data.localeCompare(a.data))[0];
  $("mData").value = ult ? ult.data : (f.ortese && f.ortese.avaliacao) || hoje(); preencher(ult ? ult.mm : f.atual && f.atual.mm);
  S.origem = ult ? ult.origem || null : (f.atual && f.atual.origem) || null; mostrarOrigem();
  renderFichas(); ETP.abrir("s0");
  let msg = `Ficha "${esc(f.nome)}" aberta: ${S.medicoes.length} medição(ões)${ult ? `, a última de ${dataBR(ult.data)}` : ""}.`;
  const o = f.ortese; S3.pendente = null; S3.versoes = o && o.versoes ? o.versoes.map((v) => ({ ...v })) : []; renderVersoes();
  if (o) {
    o.entradas = FX.completarEntradas(o.entradas);
    escreverEntradas(o.entradas);
    const want = o.scan && o.scan.nome;
    if (S3.pos && (!want || want === S3.arquivo)) { aplicarOrtese(o); return; }
    S3.pendente = o;
    if (want) msg += ` Para retomar a órtese, abra o scan <b>${esc(want)}</b> na etapa 1: os pontos, o plano, os parâmetros e as correções serão aplicados.`;
  }
  if (f.origem && f.origem.formato === FX.FORMATO_FICHA_ANTIGA) msg += " (Ficha da versão antiga do EITA! Crânio, convertida.)";
  status(msg);
}
function aplicarOrtese(o) {
  S3.pendente = null;
  try {
    if (o.alinhamento && !S3.alinhado) {
      if (o.scan && o.scan.unidade && S3.unidade && o.scan.unidade !== S3.unidade) status("Atenção: a unidade do STL é diferente da usada na ficha; confira antes de alinhar.", true);
      limparPontos(); Object.keys(o.alinhamento).forEach((k) => { if (PONTOS[k]) marcarPonto(k, o.alinhamento[k]); }); alinhar();
    }
    escreverEntradas(o.entradas);
    if (o.planoZ != null) { if ($("plane-axis").value !== "axial") { $("plane-axis").value = "axial"; ajustarFaixaPlano(); } $("plane-offset").value = o.planoZ; lerPlano(); }
    if (o.analisado && S3.alinhado) {
      if (CRO.an) CRO.an.edits = [];
      if (runAnalysis(null, true)) { escreverEntradas(o.entradas); aplicarCorrecoes(o.edicoes); if (o.earMan) CRO.earMan = { r: !!o.earMan.r, l: !!o.earMan.l }; croRefresh(); }
    }
    status("Projeto da órtese aplicado: pontos, plano, parâmetros e correções restaurados." + (o.gerada ? " Toque em <b>Gerar órtese</b> para recriar a casca." : ""));
  } catch (e) { console.error(e); status("Não foi possível aplicar todo o projeto da órtese: " + esc(e.message), true); }
  atualizarEstado();
}
function aplicarCorrecoes(lista) { if (!CRO.an) return; O.limparCorrecoes(CRO.an); (lista || []).forEach((e) => O.acrescentarCorrecao(CRO.an, { kind: e.kind, th: e.th, ph: e.ph, radiusMm: e.radiusMm, mm: e.mm })); croRefresh(); }
// versões do projeto
function renderVersoes() {
  const el = $("v-list"); if (!S3.versoes.length) { el.innerHTML = '<div class="note">Nenhuma versão guardada.</div>'; return; }
  el.innerHTML = S3.versoes.map((v, i) => `<div class="frow"><div><b>${esc(v.rotulo)}</b><small>${esc(new Date(v.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }))} · ${v.edicoes ? v.edicoes.length : 0} correções</small></div><button type="button" data-rs="${i}">Restaurar</button></div>`).join("");
  el.querySelectorAll("[data-rs]").forEach((b) => (b.onclick = () => restaurarVersao(S3.versoes[+b.dataset.rs])));
}
$("v-save").onclick = () => { const n = S3.versoes.length + 1, s = retrato(); S3.versoes.push({ rotulo: "V" + n, data: new Date().toISOString(), entradas: s.entradas, edicoes: s.edicoes, resultado: s.resultado }); renderVersoes(); status("Versão V" + n + " guardada. Salve a ficha para mantê-la depois de fechar a página."); };
function restaurarVersao(v) {
  escreverEntradas(FX.completarEntradas(v.entradas));
  if (CRO.an) { aplicarCorrecoes(v.edicoes); CRO.stale = true; status("Versão " + esc(v.rotulo) + " restaurada. Gere a órtese de novo para ver o resultado."); }
  else status("Parâmetros da versão " + esc(v.rotulo) + " restaurados. Faça a análise para reaplicar as correções manuais.");
  atualizarEstado();
}
function novaFicha() { S.fichaId = null; S.fichaOrigem = null; S.medicoes = []; S.origem = null; mostrarOrigem(); escreverPaciente({}); CRO.icTouched = false; escreverEntradas(Object.fromEntries(Object.entries(PADRAO_PAGINA).filter(([k]) => k !== "cro-preset-name"))); $("mData").value = hoje(); preencher(C.EXEMPLO); S3.versoes = []; S3.pendente = null; renderVersoes(); renderFichas(); status("Ficha em branco. Preencha os dados do paciente, as medidas e registre."); $("pName").focus(); }
async function exportarFicha() { const f = coletar(); if (!f.nome) { status("Dê um nome ou código à ficha antes de exportar.", true); return; } if (await salvar(`${E.nomeArquivo(f.paciente.pId || E.iniciais(f.paciente.pName) || "paciente")}_ficha_CRANIO.json`, new Blob([JSON.stringify(f, null, 1)], { type: "application/json" }))) status("Ficha exportada."); }
function importarBase(b) {
  const antiga = FX.ehBaseAntiga(b); if (antiga) b = FX.converterBaseAntiga(b);
  const r = FICHAS.importarBase(b);
  let np = 0; if (b.protocolos) { const antes = Object.keys(protocolos).length; protocolos = FX.mesclarProtocolos(protocolos, b.protocolos); np = Object.keys(protocolos).length - antes; gravarProtocolos(protocolos); listarProtocolos(); }
  renderFichas(); status(`Base${antiga ? " da versão antiga" : ""} importada: ${r.novas} ficha(s) nova(s), ${r.atualizadas} atualizada(s)${np ? `, ${np} protocolo(s) novo(s)` : ""}.`);
}
async function importarArquivo(arq, base) {
  try {
    const j = JSON.parse(await arq.text());
    if (j && (j.formato === FICHAS.formatoBase || FX.ehBaseAntiga(j))) { importarBase(j); return; }
    if (j && (j.formato === FICHAS.formatoFicha || FX.ehFichaAntiga(j))) {
      if (base) { const f = FX.ehFichaAntiga(j) ? FX.converterFichaAntiga(j) : j, r = FICHAS.importarBase({ formato: FICHAS.formatoBase, fichas: [f] }); renderFichas(); status(`Ficha importada (${r.novas} nova, ${r.atualizadas} atualizada).`); }
      else abrirFicha(j);
      return;
    }
    status("Arquivo não reconhecido como ficha ou base do EITA! CRÂNIO.", true);
  } catch (e) { console.error(e); status("Não consegui ler esse arquivo.", true); }
}
async function exportarBase() { if (!FICHAS.listar().length && !Object.keys(protocolos).length) { status("Não há fichas nem protocolos salvos neste navegador."); return; } const b = FICHAS.exportarBase(new Date(), { protocolos }); if (await salvar(b.nome, new Blob([b.conteudo], { type: "application/json" }))) status(`Base exportada com ${FICHAS.listar().length} ficha(s) e ${Object.keys(protocolos).length} protocolo(s).`); }
$("fSave").onclick = () => salvarFicha(false);
$("fNew").onclick = novaFicha;
$("fExp").onclick = exportarFicha;
$("fImpB").onclick = () => $("fImp").click();
$("fImp").onchange = () => { const f = $("fImp").files[0]; $("fImp").value = ""; if (f) importarArquivo(f, false); };
$("dbExp").onclick = exportarBase;
$("dbImpB").onclick = () => $("dbImp").click();
$("dbImp").onchange = () => { const f = $("dbImp").files[0]; $("dbImp").value = ""; if (f) importarArquivo(f, true); };

/* ================================================================== resumo e relatório */
$("copiar").onclick = () => {
  const t = $("resumo").textContent; let p; try { p = navigator.clipboard.writeText(t); } catch (e) { p = Promise.reject(e); }
  p.then(() => status("Resumo copiado.")).catch(() => { const rg = document.createRange(); rg.selectNodeContents($("resumo")); const s = window.getSelection(); s.removeAllRanges(); s.addRange(rg); status("Texto selecionado. Use Ctrl+C para copiar."); });
};
function svgParaJpeg(svg, w, h) {
  return new Promise((ok) => {
    const img = new Image(), url = URL.createObjectURL(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 300" width="${w}" height="${h}">${svg}</svg>`], { type: "image/svg+xml" }));
    img.onload = () => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url); ok(UI.jpegDe(c, 0.92)); };
    img.onerror = () => { URL.revokeObjectURL(url); ok(null); };
    img.src = url;
  });
}
// vistas do modelo (rasterizador de vistas.js; rótulos e régua desenhados aqui, como na página antiga)
const COR_RV = { AP: "#0284C7", LL: "#B7791F", D1: "#059669", D2: "#EA580C" };
function vistaCanvas(src, vista, o) {
  const R = V.rasterizar(src, vista, o), big = document.createElement("canvas"); big.width = R.Wb; big.height = R.Hb;
  big.getContext("2d").putImageData(new ImageData(R.dados, R.Wb, R.Hb), 0, 0);
  const cv = document.createElement("canvas"); cv.width = R.W; cv.height = R.H; const g = cv.getContext("2d"); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(big, 0, 0, R.W, R.H);
  return Object.assign(R, { canvas: cv, ctx: g });
}
function rotuloRV(g, txt, x, y, color, size, align) { g.font = "700 " + size + "px Arial, Helvetica, sans-serif"; g.textAlign = align || "center"; g.textBaseline = "middle"; g.lineWidth = size * 0.28; g.strokeStyle = "rgba(255,255,255,0.92)"; g.strokeText(txt, x, y); g.fillStyle = color; g.fillText(txt, x, y); }
function reguaRV(R, mm) { const g = R.ctx, H = R.canvas.height, len = mm * R.pxPorMm, x = 18, y = H - 20; g.strokeStyle = "#13232A"; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.moveTo(x, y - 6); g.lineTo(x, y + 6); g.moveTo(x + len, y - 6); g.lineTo(x + len, y + 6); g.stroke(); rotuloRV(g, mm / 10 + " cm", x + len / 2, y - 14, "#13232A", Math.round(R.canvas.width * 0.026)); }
function orientarRV(R, v) {
  const g = R.ctx, W = R.canvas.width, H = R.canvas.height, s = Math.round(W * 0.034), c = "#47606A";
  const m = { top: ["ANTERIOR", "POSTERIOR", "E", "D"], front: [null, null, "D", "E"], post: [null, null, "E", "D"], latR: [null, null, "POST.", "ANT."], latL: [null, null, "ANT.", "POST."] }[v]; if (!m) return;
  if (m[0]) rotuloRV(g, m[0], W / 2, s * 0.6, c, s * 0.8); if (m[1]) rotuloRV(g, m[1], W / 2, H - s * 0.6, c, s * 0.8);
  if (m[2]) rotuloRV(g, m[2], s * 1.2, H / 2, c, s * 0.9); if (m[3]) rotuloRV(g, m[3], W - s * 1.2, H / 2, c, s * 0.9);
}
function planoRV(R, z) { const g = R.ctx, W = R.canvas.width, p = R.proj(0, 0, z); g.save(); g.setLineDash([10, 7]); g.strokeStyle = "#7C3AED"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, p[1]); g.lineTo(W, p[1]); g.stroke(); g.restore(); rotuloRV(g, "z", W - 6, p[1] - 12, "#6B3FD4", Math.round(W * 0.03), "right"); }
function topoRV(R, pd, z) {
  const g = R.ctx, W = R.canvas.width, fs = Math.round(W * 0.034);
  g.strokeStyle = "#13232A"; g.lineWidth = 2; g.beginPath();
  for (let i = 0; i < pd.seg.length; i += 4) { const a = R.proj(pd.seg[i], pd.seg[i + 1], z), b = R.proj(pd.seg[i + 2], pd.seg[i + 3], z); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
  g.stroke();
  const eu = pd.eurios ? { er: { x: pd.eurios[0][0], y: pd.eurios[0][1] }, el: { x: pd.eurios[1][0], y: pd.eurios[1][1] } } : {};
  [["AP", "ant", "post"], ["LL", "er", "el"], ["D1", "d1a", "d1p"], ["D2", "d2a", "d2p"]].forEach((L) => {
    const a = pd.hit[L[1]] || eu[L[1]], b = pd.hit[L[2]] || eu[L[2]]; if (!a || !b) return;
    const pa = R.proj(a.x, a.y, z), pb = R.proj(b.x, b.y, z);
    g.strokeStyle = COR_RV[L[0]]; g.lineWidth = 3.2; g.beginPath(); g.moveTo(pa[0], pa[1]); g.lineTo(pb[0], pb[1]); g.stroke();
    [pa, pb].forEach((q) => { g.fillStyle = COR_RV[L[0]]; g.beginPath(); g.arc(q[0], q[1], 5, 0, 7); g.fill(); });
  });
  const place = { AP: ["ant", 1, 1.6], LL: ["er", 1, -1.6], D1: ["d1a", 1, -1], D2: ["d2a", -1, -1] }, val = (k) => (k === "LL" ? pd.largura : pd[k]);
  ["AP", "LL", "D1", "D2"].forEach((k) => {
    if (val(k) == null) return; const pl = place[k], h = pd.hit[pl[0]] || eu[pl[0]]; if (!h) return; const p = R.proj(h.x, h.y, z);
    rotuloRV(g, k + " " + val(k).toFixed(1) + " mm", k === "LL" ? W - 8 : p[0] + pl[1] * (k === "AP" ? 12 : fs * 2.3), p[1] + pl[2] * fs * 0.9, COR_RV[k], fs, k === "LL" ? "right" : pl[1] > 0 ? "left" : "right");
  });
  const c = R.proj(0, 0, z); g.strokeStyle = "#13232A"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(c[0] - 8, c[1]); g.lineTo(c[0] + 8, c[1]); g.moveTo(c[0], c[1] - 8); g.lineTo(c[0], c[1] + 8); g.stroke();
}
// texto corrido no PDF, com quebra de linha e de página
function paragrafo(R, texto, tam = 8.4, cor = E.CORES_PDF.tinta) { for (const l of E.quebrarTexto(texto, tam, 523)) { if (R.y < 56) R.novaPagina(); R.pg.text(36, R.y, tam, l, false, cor); R.y -= tam * 1.35; } R.y -= 4; }
// tabela simples em colunas: cols = [[x, título], …]; linhas = [[texto, …], …]
function tabelaColunas(R, cols, linhas, tam = 8.2) {
  const cab = () => { cols.forEach(([x, t]) => R.pg.text(x, R.y, 7.6, t, true, E.CORES_PDF.sutil)); R.y -= 12; };
  if (R.y < 70) R.novaPagina(); cab();
  for (const l of linhas) { if (R.y < 56) { R.novaPagina(); cab(); } l.forEach((t, i) => R.pg.text(cols[i][0], R.y, tam, E.cortarTexto(String(t), tam, (cols[i + 1] ? cols[i + 1][0] : 559) - cols[i][0] - 4), false, E.CORES_PDF.tinta)); R.y -= tam * 1.4; }
  R.y -= 4;
}
// grade de imagens com legenda: lista = [[nomeImagem, legenda], …], n por linha
function gradeImagens(R, lista, n = 4) {
  const gap = 8, w = (523 - gap * (n - 1)) / n;
  for (let i = 0; i < lista.length; i += n) {
    if (R.y - w - 16 < 48) R.novaPagina();
    lista.slice(i, i + n).forEach(([nm, cap], k) => { const x = 36 + k * (w + gap); R.pg.image(nm, x, R.y - w, w, w); R.pg.text(x, R.y - w - 10, 7.4, E.cortarTexto(cap, 7.4, w), false, E.CORES_PDF.sutil); });
    R.y -= w + 22;
  }
}
async function secoesDoScan(R, imgs) {
  const z = S3.z, pos = S3.pos, B = V.limites(pos), pd = V.medidasNoPlano(pos, null, z), N = (x) => (x == null ? "—" : fmt(x, 1)), add = (nm, cv, q = 0.88) => imgs.push(Object.assign({ name: nm }, UI.jpegDe(cv, q)));
  const ext = Math.max(B.size[0], B.size[1], B.size[2]), pxmm = 440 * 0.84 / ext;
  CASCA.ocupado(true, "Gerando as vistas do relatório…"); await UI.espera(20);
  const Rt = vistaCanvas({ pos }, V.VISTAS.top, { W: 640, H: 640, B }); topoRV(Rt, pd, z); orientarRV(Rt, "top"); reguaRV(Rt, 50); add("Vt", Rt.canvas);
  const nomes = [["front", "Frontal"], ["post", "Posterior"], ["latR", "Lateral direita"], ["latL", "Lateral esquerda"]], vistas = [], mapas = [];
  let col = null; if (CRO.an) { try { col = O.coresDosVertices(pos, CRO.an, CRO.zRef, CRO.range); } catch (e) { col = null; } }
  for (const [k, nome] of nomes) {
    await UI.espera(0);
    const R2 = vistaCanvas({ pos }, V.VISTAS[k], { W: 440, H: 440, B, scale: pxmm }); planoRV(R2, z); orientarRV(R2, k); reguaRV(R2, 50); add("V" + k, R2.canvas); vistas.push(["V" + k, nome]);
    if (col) { const R3 = vistaCanvas({ pos, col }, V.VISTAS[k], { W: 440, H: 440, B, scale: pxmm }); planoRV(R3, z); orientarRV(R3, k); add("M" + k, R3.canvas); mapas.push(["M" + k, nome + " — mapa de pressão"]); }
  }
  const casco = [];
  if (CRO.tris && !CRO.stale) {
    const hb = V.limites(CRO.tris);
    for (const [nome, k] of [["Oblíqua direita", "oblR"], ["Oblíqua esquerda", "oblL"], ["Superior", "top"], ["Posterior", "post"]]) { await UI.espera(0); const Rh = vistaCanvas({ pos: CRO.tris }, V.VISTAS[k], { W: 440, H: 440, B: hb, base: [150, 120, 230] }); reguaRV(Rh, 50); add("H" + k, Rh.canvas); casco.push(["H" + k, nome]); }
  }
  // seção: modelo escaneado
  R.novaPagina(); R.secao(`Modelo escaneado (${S3.arquivo})`);
  const lado = 250; R.pg.image("Vt", 36, R.y - lado, lado, lado); R.pg.text(36, R.y - lado - 10, 7.4, "Vista superior: contorno no plano axial z = " + N(z) + " mm", false, E.CORES_PDF.sutil);
  const rd = pd.radii, dsym = pd.cva;
  E.tabelaPDF(R.pg, 304, R.y, "Medidas no plano", [["AP (ântero-posterior)", N(pd.AP) + " mm"], ["LL (largura transversal máx.)", N(pd.largura) + " mm"], ["D1 (ant. dir. – post. esq., 30°)", N(pd.D1) + " mm"], ["D2 (ant. esq. – post. dir., 30°)", N(pd.D2) + " mm"], ["|D1 - D2|", N(dsym) + " mm"], ["CVAI (|D1-D2| / maior)", N(pd.cvai) + " %"], ["Índice cefálico (LL/AP)", N(pd.ciTransversal)], ["Perímetro do contorno", N(pd.perimeter) + " mm"], ["Área do contorno", N(pd.area / 100) + " cm²"], ["Raio ant. / post.", N(rd.ant) + " / " + N(rd.post) + " mm"], ["Raio dir. / esq.", N(rd.right) + " / " + N(rd.left) + " mm"], ["Raio D1 ant. / post.", N(rd.d1a) + " / " + N(rd.d1p) + " mm"], ["Raio D2 ant. / post.", N(rd.d2a) + " / " + N(rd.d2p) + " mm"]], { passo: 12.4 });
  R.y -= lado + 24;
  paragrafo(R, "Linha tracejada (z) nas vistas = plano axial de referência. Origem na linha glabela–opistocrânio; diagonais a ±30° do eixo AP; raio = interseção mais distante do contorno." + (S3.alinhado ? "" : " Modelo não alinhado pelos pontos de referência: medidas indicativas."), 7.8, E.CORES_PDF.sutil);
  const pf = S3.perfil && S3.eixo === "axial" ? S3.perfil : calcularPerfil();
  if (pf && pf.niveis.length) {
    if (R.y < 150) R.novaPagina();
    R.pg.text(36, R.y, 9, "Assimetria por altura", true, E.CORES_PDF.roxo); R.y -= 13;
    const E_ = C.ESCALAS.cvai;
    tabelaColunas(R, [[36, "Altura"], [100, "CVAI (%)"], [160, "Classificação"], [250, "CVA (mm)"], [310, "D1 / D2 (mm)"], [410, "AP / LL (mm)"], [510, "IC"]],
      pf.niveis.map((n) => [(n.dz > 0 ? "+" : "") + fmt(n.dz, 0) + " mm" + (n === pf.maior ? " *" : ""), fmt(n.cvai, 1), E_.nomes[C.classificar(E_, n.cvai)].toLowerCase(), fmt(n.cva, 1), fmt(n.D1, 1) + " / " + fmt(n.D2, 1), fmt(n.AP, 1) + " / " + fmt(n.largura, 1), fmt(n.ci, 1)]));
    paragrafo(R, `Planos paralelos ao ${S3.zRef0 != null ? "plano glabela-opistocrânio" : "plano atual (modelo não alinhado)"}, de 5 em 5 mm, enquanto o AP passa de 90% do maior AP. * Maior assimetria a ${(pf.maior.dz > 0 ? "+" : "") + fmt(pf.maior.dz, 0)} mm: CVAI ${fmt(pf.maior.cvai, 1)} % (${E_.nomes[C.classificar(E_, pf.maior.cvai)].toLowerCase()}).`, 7.8, E.CORES_PDF.sutil);
  }
  gradeImagens(R, vistas);
  if (mapas.length) { if (R.y < 200) R.novaPagina(); R.secao("Mapa de pressão e alívio sobre o modelo"); gradeImagens(R, mapas); paragrafo(R, "Vermelho: contato/pressão (a órtese encosta); azul: alívio (a órtese libera espaço).", 7.8, E.CORES_PDF.sutil); }
  // seção: planejamento da órtese
  const an = CRO.an;
  if (an) {
    R.novaPagina(); R.secao("Planejamento da órtese craniana (mapa de pressão)");
    paragrafo(R, `Indicação: ${indicLabel(an)}${an.mode === "auto" ? " (automática)" : ""}. Índice cefálico no plano de referência: ${fN(an.ic, 2)}${an.useBr ? " (alvo " + fN(an.icTarget, 2) + ")" : ""}.${an.age ? " Idade informada: " + fN(an.age, 0) + " meses." : ""} Desvio máximo do alvo: ${fN(an.maxAbs, 1)} mm. Plano de referência z = ${fN(CRO.zRef, 1)} mm.`);
    const cvp = $("cro-polar"); add("Pol", cvp, 0.92); const hp = 200, wp = hp * cvp.width / cvp.height;
    if (R.y - hp < 50) R.novaPagina();
    R.pg.image("Pol", 36, R.y - hp, wp, hp);
    const yTop = R.y, linhasP = an.peaks.map((p) => [p.label, p.type === "P" ? "Contato" : "Alívio", p.region, fN(Math.abs(p.mag), 1) + " mm", fN(p.th, 0) + "° / " + fN(p.ph, 0) + "°"]);
    const x0 = 36 + wp + 14, cols = [[x0, "Código"], [x0 + 40, "Tipo"], [x0 + 88, "Região"], [x0 + 228, "Desvio"], [x0 + 272, "Az. / el."]];
    cols.forEach(([x, t]) => R.pg.text(x, yTop, 7.6, t, true, E.CORES_PDF.sutil)); let yy = yTop - 12;
    if (!linhasP.length) { R.pg.text(x0, yy, 8.2, "Nenhum ponto com desvio ≥ 1,0 mm em relação ao alvo.", false, E.CORES_PDF.tinta); yy -= 12; }
    for (const l of linhasP.slice(0, 13)) { l.forEach((t, i) => R.pg.text(cols[i][0], yy, 8.2, E.cortarTexto(String(t), 8.2, (cols[i + 1] ? cols[i + 1][0] : 559) - cols[i][0] - 4), false, E.CORES_PDF.tinta)); yy -= 11.5; }
    R.y = Math.min(R.y - hp - 14, yy - 8);
    if (an.edits.length) { R.pg.text(36, R.y, 9, "Correções manuais do ortesista", true, E.CORES_PDF.roxo); R.y -= 13; tabelaColunas(R, [[36, "Código"], [80, "Ação"], [160, "Intensidade"], [230, "Raio"], [280, "Região"]], an.edits.map((e) => [e.label, { contact: "Contato", relief: "Alívio", zero: "Anulado (neutro)" }[e.kind] || "", e.kind === "zero" ? "—" : fN(e.mm, 1) + " mm", fN(e.radiusMm, 0) + " mm", e.region])); }
    const q = !CRO.stale && CRO.lastParams, s = !CRO.stale && CRO.lastStats;
    if (q && s) {
      const gp = s.gap || {}, ear = (x) => esc(x.src) + " (az " + fN(x.az, 0) + "°, arco " + (x.top < 0 ? "-" : "+") + fN(Math.abs(x.top), 0) + " mm)";
      R.pg.text(36, R.y, 9, "Parâmetros de projeto", true, E.CORES_PDF.roxo); R.y -= 13;
      paragrafo(R, `${q.type === "band" ? "Faixa de topo aberto (borda superior a " + fN(q.bandTop, 0) + "° na frente" + (q.bandTopBack != null && q.bandTopBack !== q.bandTop ? " e " + fN(q.bandTopBack, 0) + "° atrás" : "") + ")" : "Capacete fechado"}; modo ${q.mode === "active" ? "ativo (compressão máx. " + fN(q.compMax, 1) + " mm)" : "passivo"}; fator de correção ${fN(q.relief * 100, 0)}%; alívio máx. ${fN(q.reliefMax, 1)} mm; folga/forro ${fN(q.c0, 1)} mm; espessura da casca ${fN(q.t, 1)} mm; borda posterior ${fN(q.hb, 0)} mm com descida extra de ${fN(q.occDrop || 0, 0)} mm no occipício (±${fN(q.occWidth || 0, 0)}°); reserva de crescimento ${fN(q.growMonths, 0)} meses × ${fN(q.growRate, 1)} mm/mês (${fN(q.growContactPct, 0)}% nas áreas de contato; +${fN(q.growVertex, 1)} mm no vértice); borda: ${q.cheek === "off" ? "sem apoio na bochecha" : "apoio na bochecha de " + fN(q.cheekWidth, 0) + " mm de largura, até " + fN(q.cheekDepth, 0) + " mm abaixo do plano"}; orelhas ${s.ears && s.ears.R ? "D: " + ear(s.ears.R) + "; E: " + ear(s.ears.L) : "—"}; aba atrás da orelha: ${q.mast === "on" ? fN(q.mastWidth, 0) + " mm de largura, até " + fN(q.mastDepth, 0) + " mm abaixo do plano" : "sem aba"}; folga nos apoios ${fN(q.cheekClear, 1)} mm; furos Ø ${fN(q.holeD, 1)} mm, passo ${fN(q.pitch, 1)} mm${q.holeZone === "ap" ? ", só na frente e atrás" : ""}; ${q.split === "none" ? "peça inteira, sem fenda" : /^lateral/.test(q.split) ? "peça inteira com fenda lateral " + (q.split === "lateralR" ? "D" : "E") + " de " + fN(q.gap, 1) + " mm" : "duas valvas, corte " + (q.split === "coronal" ? "coronal" : "sagital") + " (" + fN(q.splitPos, 0) + " mm, fenda " + fN(q.gap, 1) + " mm)"}.`);
      R.pg.text(36, R.y, 9, "Modelo gerado", true, E.CORES_PDF.roxo); R.y -= 13;
      paragrafo(R, `Volume ${fN(s.volume_cm3, 1)} cm³ · massa estimada ${fN(s.mass_g, 0)} g (PA12, sem forro) · dimensões ${s.size.map((v) => fN(v, 0)).join(" × ")} mm · folga média à cabeça: contato ${fN(gp.contact, 1)} mm, neutra ${fN(gp.neutral, 1)} mm, alívio ${fN(gp.relief, 1)} mm · interferência máxima com a malha: ${s.interference ? fN(s.interference.mm, 1) + " mm" : "—"} · ${s.triangles.toLocaleString("pt-BR")} triângulos · malha ${s.mesh && s.mesh.pinch === 0 && s.mesh.dropped === 0 ? "fechada" : "com defeitos (gerar em resolução maior)"}.`);
      if (casco.length) { R.pg.text(36, R.y, 9, "Órtese gerada", true, E.CORES_PDF.roxo); R.y -= 13; gradeImagens(R, casco); }
    } else paragrafo(R, CRO.casco ? "A órtese gerada está desatualizada em relação aos parâmetros atuais: gere de novo para incluí-la no relatório." : "A órtese ainda não foi gerada.", 8.2, E.CORES_PDF.sutil);
  }
  CASCA.ocupado(true, "Montando o relatório…");
}
async function gerarPDF() {
  const P = lerPaciente(), m = S.m, A = C.avaliar(m), r = A.r, dataM = $("mData").value, agora = new Date();
  const imgs = [], esq = await svgParaJpeg(svgCranio(m, r), 520, 600); if (esq) imgs.push(Object.assign({ name: "Im1" }, esq));
  const comCvai = S.medicoes.filter((x) => C.calcular(x.mm).cvai != null);
  if (comCvai.length >= 2) { const c = document.createElement("canvas"); c.width = 1200; c.height = 440; desenharGrafico(c, comCvai); imgs.push(Object.assign({ name: "Im2" }, UI.jpegDe(c, 0.9))); }
  const lg = await UI.logoJpeg("assets/eita-cranio-simbolo.png"); if (lg) imgs.push(Object.assign({ name: "Lg" }, lg));
  const R = E.criarRelatorioPDF({ app: ["EITA!", "CRÂNIO"], subtitulo: "Avaliação da assimetria craniana e órtese craniana · Lab.EITA / UFG", logo: lg ? "Lg" : null,
    dataTexto: agora.toLocaleDateString("pt-BR") + " " + agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), pacienteTexto: P.pName || P.pId || "paciente não identificado", pacienteContinuacao: P.pName || P.pId || "" });
  const SEXO = { F: "feminino", M: "masculino", O: "outro" }, nasc = P.pBirth ? dataBR(P.pBirth) : "";
  R.secao("Paciente");
  R.campo(36, 180, "Nome", P.pName); R.campo(216, 90, "Prontuário / código", P.pId); R.campo(306, 70, "Nascimento", nasc); R.campo(376, 130, "Idade na medição", dataM ? idadeNa(dataM) : ""); R.campo(506, 53, "Sexo", SEXO[P.pSex]); R.y -= 25;
  R.campo(36, 300, "Diagnóstico", P.pDiag); R.campo(336, 100, "Idade gestacional", P.pGest ? P.pGest + " semanas" : ""); R.campo(436, 123, "Profissional", P.pProf); R.y -= 25;
  if (P.pPeso || P.pPC || P.pLado || P.pObj) { R.campo(36, 70, "Peso", P.pPeso ? P.pPeso.replace(".", ",") + " kg" : ""); R.campo(106, 100, "Perímetro cefálico", P.pPC ? P.pPC.replace(".", ",") + " cm" : ""); R.campo(206, 100, "Lado achatado", FX.NOMES_LADO[P.pLado] || ""); R.campo(306, 253, "Objetivo / indicação", P.pObj); R.y -= 25; }
  R.campo(36, 523, "Observações", (P.pNotes || "").replace(/\s+/g, " ")); R.y -= 24;
  const lin = (v, u) => (v != null ? fmt(v, 1) + u : "—"), cl = (k) => (A[k] ? A[k].classe.toLowerCase() : "—");
  R.par("Medidas" + (dataM ? " de " + dataBR(dataM) : "") + (S.origem ? " (do scan)" : ""), C.MEDIDAS.map((x) => [`${x.nome} (${x.sigla})`, m[x.k] > 0 ? fmt(m[x.k], 1) + " mm" : "—"]).concat([["Razão entre as diagonais", lin(r.ratio, " %")], ["Diagonal mais longa", r.longer ? r.longer + " (+" + fmt(r.cva, 1) + " mm)" : r.cva != null ? "iguais" : "—"]]),
    "Resultado", [["CVAI", lin(r.cvai, " %")], ["Classificação do CVAI", cl("cvai")], ["CVA", lin(r.cva, " mm")], ["Classificação do CVA", cl("cva")], ["Índice cefálico", lin(r.ci, "")], ["Forma do crânio", cl("ci")]]);
  if (S.origem) { const mx = S.origem.maiorAssimetria; paragrafo(R, `Medidas tiradas do scan ${S.origem.scan} no plano axial z = ${fmt(S.origem.planoZ, 1)} mm${S.origem.alinhado ? "" : " (modelo não alinhado: valores indicativos)"}; LL = largura transversal máxima.${mx ? ` Maior assimetria do scan: CVAI ${fmt(mx.cvai, 1)} % a ${mx.dz > 0 ? "+" : ""}${fmt(mx.dz, 0)} mm do plano de referência (ver "Assimetria por altura").` : ""}`, 7.8, E.CORES_PDF.sutil); }
  // esquema e evolução
  const temG = imgs.some((i) => i.name === "Im2"), h = 168;
  if (R.y - h - 20 < 50) R.novaPagina();
  if (esq) { R.pg.image("Im1", 36, R.y - h, h * (520 / 600), h); R.pg.text(36, R.y - h - 11, 7.6, "Esquema em vista superior (proporcional às medidas)", false, E.CORES_PDF.sutil); }
  if (temG) { const w = 559 - 200, hg = (w * 440) / 1200; R.pg.image("Im2", 200, R.y - hg - 10, w, hg); R.pg.text(200, R.y - hg - 21, 7.6, "Evolução do CVAI (%) nas medições registradas; faixas de classificação ao fundo", false, E.CORES_PDF.sutil); }
  R.y -= h + 30;
  // acompanhamento
  const l = [...S.medicoes].sort((a, b) => a.data.localeCompare(b.data));
  if (l.length) {
    if (R.y - 40 < 50) R.novaPagina();
    R.secao("Acompanhamento (" + l.length + " medição" + (l.length > 1 ? "ões" : "") + ")");
    const cols = [[36, "Data"], [92, "Idade"], [222, "D1 / D2 (mm)"], [304, "AP / LL (mm)"], [386, "CVA (mm)"], [442, "CVAI (%)"], [504, "IC"]];
    const cab = () => { cols.forEach(([x, t]) => R.pg.text(x, R.y, 7.6, t, true, E.CORES_PDF.sutil)); R.y -= 12; };
    cab();
    for (const x of l) {
      if (R.y < 60) { R.novaPagina(); cab(); }
      const rr = C.calcular(x.mm), f1 = (v) => (v > 0 ? fmt(v, 1) : "—");
      [dataBR(x.data) + (x.origem ? " (3D)" : ""), E.cortarTexto(idadeNa(x.data), 8.4, 126), f1(x.mm.a) + " / " + f1(x.mm.b), f1(x.mm.l) + " / " + f1(x.mm.w), rr.cva != null ? fmt(rr.cva, 1) : "—", rr.cvai != null ? fmt(rr.cvai, 1) : "—", rr.ci != null ? fmt(rr.ci, 1) : "—"].forEach((t, i) => R.pg.text(cols[i][0], R.y, 8.4, t, i >= 4, E.CORES_PDF.tinta));
      R.y -= 11.5;
    }
    const ev = C.evolucao(l), s = (v) => (v > 0 ? "+" : v < 0 ? "-" : "") + fmt(Math.abs(v), 1);
    if (ev) { R.y -= 4; R.pg.text(36, R.y, 8.4, `Variação de ${dataBR(ev.desde)} a ${dataBR(ev.ate)}: CVAI ${ev.cvai != null ? s(ev.cvai) + " pontos" : "-"} · CVA ${ev.cva != null ? s(ev.cva) + " mm" : "-"} · índice cefálico ${ev.ci != null ? s(ev.ci) : "-"}`, true, E.CORES_PDF.roxo); R.y -= 12; }
  }
  if (S3.pos) await secoesDoScan(R, imgs);
  R.avisoFinal("Critérios: CVAI normal < 3,5 %, leve 3,5 a < 6,25, moderada 6,25 a < 8,75, grave 8,75 a < 11, muito grave >= 11; CVA normal < 3 mm, leve 3 a < 6, moderada 6 a < 12, grave >= 12; índice cefálico 76 a < 81 mesocefálico, < 76 dolicocefálico, 81 a < 85,5 braquicefálico, >= 85,5 hiperbraquicefálico. Os limiares variam entre serviços e publicações. Ferramenta de apoio ao cálculo e ao projeto: a interpretação, a conduta e a validação da órtese (parâmetros iniciais, a conferir pelo ortesista) dependem da avaliação clínica do paciente.");
  return R.finalizar(imgs);
}
$("expPdf").onclick = async () => {
  if (!C.calcular(S.m).cvai && !C.calcular(S.m).ci && !S3.pos) { status("Informe as medidas antes de gerar o relatório.", true); return; }
  CASCA.ocupado(true, "Montando o relatório…"); await UI.espera(30);
  try {
    const pdf = await gerarPDF(); CASCA.ocupado(false); const P = lerPaciente();
    const nome = `${E.nomeArquivo(P.pId || E.iniciais(P.pName) || "cranio")}_CRANIO_${($("mData").value || hoje()).replace(/-/g, "")}_relatorio.pdf`;
    if (await salvar(nome, new Blob([pdf], { type: "application/pdf" }))) $("expInfo").innerHTML = '<div class="okbox">Relatório salvo.</div>';
  } catch (e) { console.error(e); CASCA.ocupado(false); status("Erro ao gerar o relatório: " + esc(e.message), true); }
};
window.__eitaRelatorio = gerarPDF; // usado nos testes
window.__eitaCranio = { S, S3, CRO, readParams };   // usado nos testes (só leitura)

/* ------------------------------------------------------------------ início */
if (!TEM3D) $("scanInfo").innerHTML = "O visualizador 3D não carregou (three.js indisponível nesta página). As medidas manuais, o acompanhamento e o relatório continuam funcionando.";
listarPontos(); syncGrowth(); conditionals(); renderVersoes(); legenda();
renderFichas(); atualizarIdade(); render();
