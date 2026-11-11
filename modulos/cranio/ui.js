/* EITA! CRÂNIO — interface (padrão visual Lab.EITA): medidas, resultados classificados, esquema, ficha do
   paciente com as medições por data (acompanhamento), gráfico da evolução e relatório PDF.
   Cálculo em modulos/cranio/processamento.js (mesmo da calculadora publicada); casca, ficha e PDF do núcleo.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
"use strict";
const E = window.EITA, C = E.cranio, UI = E.ui;
const $ = (id) => document.getElementById(id);
const esc = E.escaparHTML, fmt = C.fmt;
const CASCA = UI.criarCasca(), status = CASCA.status, salvar = CASCA.salvar;
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const dataBR = (iso) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR") : "");
const COR = { a: "#6B3FD6", b: "#A35F1F", sev: ["#25774F", "#86650A", "#B04E0C", "#B3261E", "#80195C"], cabeca: "#ECE8F6", contorno: "#A79FBF", tinta: "#1C1730", sutil: "#5B5573" };

const S = { unidade: "mm", fichaId: null, medicoes: [], m: {} };

/* ------------------------------------------------------------------ etapas e seções */
const ETP = UI.criarEtapas({ etapas: [["s1", "Medidas"], ["s2", "Acompanhamento"], ["s3", "Relatório"]], status });
ETP.montar();

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
C.MEDIDAS.forEach((x) => $(x.id).addEventListener("input", render));
document.querySelectorAll("#uni button").forEach((b) => (b.onclick = () => mudarUnidade(b.dataset.u)));
$("exemplo").onclick = () => { preencher(C.EXEMPLO); $("dA").focus(); };
$("limpar").onclick = () => { preencher(null); $("dA").focus(); };

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
  $("histBox").innerHTML = `<table class="hist"><thead><tr><th>Data</th><th>Idade</th><th>CVA</th><th>CVAI</th><th>IC</th><th></th></tr></thead><tbody>${l.map((x) => { const r = C.calcular(x.mm); return `<tr class="${x.data === dataAtual ? "cur" : ""}"><td><a href="#" data-ver="${esc(x.id)}">${dataBR(x.data)}</a></td><td>${esc(idadeNa(x.data))}</td><td class="n">${r.cva != null ? fmt(r.cva, 1) : "—"}</td><td class="n">${r.cvai != null ? fmt(r.cvai, 1) : "—"}</td><td class="n">${r.ci != null ? fmt(r.ci, 1) : "—"}</td><td><button type="button" data-apagar="${esc(x.id)}" title="Excluir medição">${apagarPend === x.id ? "Confirmar" : "×"}</button></td></tr>`; }).join("")}</tbody></table>`;
  $("histBox").querySelectorAll("[data-ver]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); const x = S.medicoes.find((y) => y.id === a.dataset.ver); if (x) { $("mData").value = x.data; preencher(x.mm); status(`Medição de ${dataBR(x.data)} carregada.`); } }));
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
  if (i >= 0) S.medicoes[i] = novo; else S.medicoes.push(novo);
  const gravou = autoSalvar();
  render(); ETP.feito("s1");
  status(`Medição de ${dataBR(data)} registrada${i >= 0 ? " (substituiu a do mesmo dia)" : ""}.${gravou ? " Ficha atualizada neste navegador." : ' Dê um nome ou código na <b>Ficha do paciente</b> e clique em <b>Salvar ficha</b> para guardar.'}`);
};

/* ------------------------------------------------------------------ ficha (núcleo: ficha.js) */
const PAT_IDS = ["pName", "pId", "pBirth", "pSex", "pGest", "pDiag", "pProf", "pNotes"];
const FICHAS = E.criarArmazemFichas({ chave: "eitaCRANIO.fichas.v1", formatoFicha: "EITA! CRÂNIO ficha", formatoBase: "EITA! CRÂNIO base", versaoApp: "0.2", prefixoBase: "base_EITA_CRANIO", rotulo: "EITA! CRÂNIO" });
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
function coletar() {
  if (!S.fichaId) S.fichaId = E.novoIdFicha("c");
  const P = lerPaciente();
  return { formato: "EITA! CRÂNIO ficha", versaoApp: "0.2", id: S.fichaId, nome: P.pName || P.pId, paciente: P, atualizado: new Date().toISOString(), medicoes: [...S.medicoes].sort((a, b) => a.data.localeCompare(b.data)), atual: { mm: S.m, unidade: S.unidade, data: $("mData").value } };
}
function salvarFicha(silencioso) {
  const f = coletar();
  if (!f.nome) { if (!silencioso) { status("Dê um nome ou código à ficha antes de salvar.", true); ETP.abrir("s0"); $("pName").focus(); } return false; }
  const ok = FICHAS.salvar(f); renderFichas();
  if (!silencioso) status(ok ? `Ficha "${esc(f.nome)}" salva neste navegador, com ${f.medicoes.length} medição(ões).` : 'Não foi possível salvar no navegador; use "Exportar".', !ok);
  return ok;
}
const autoSalvar = () => (($("pName").value.trim() || $("pId").value.trim()) ? salvarFicha(true) : false);
function renderFichas() {
  const l = FICHAS.listar(), box = $("fList");
  if (!l.length) { box.innerHTML = '<div class="note">Nenhuma ficha salva neste navegador.</div>'; return; }
  box.innerHTML = l.map((f, i) => `<div class="frow${f.id === S.fichaId ? " cur" : ""}"><div><b>${esc(f.nome || "(sem nome)")}</b><small>${(f.medicoes || []).length} medição(ões) · ${new Date(f.atualizado).toLocaleDateString("pt-BR")}</small></div><button type="button" data-open="${i}">Abrir</button><button type="button" data-del="${i}" title="Excluir">${delPend === f.id ? "Confirmar" : "×"}</button></div>`).join("");
  box.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => abrirFicha(FICHAS.listar()[+b.dataset.open])));
  box.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => {
    const f = FICHAS.listar()[+b.dataset.del];
    if (delPend !== f.id) { delPend = f.id; renderFichas(); status(`Clique em "Confirmar" para excluir a ficha "${esc(f.nome || "")}" deste navegador.`); setTimeout(() => { if (delPend === f.id) { delPend = null; renderFichas(); } }, 5000); return; }
    FICHAS.excluir(+b.dataset.del); delPend = null; if (f.id === S.fichaId) S.fichaId = null; renderFichas(); status("Ficha excluída deste navegador.");
  }));
}
function abrirFicha(f) {
  if (!FICHAS.ehFicha(f)) { status("Arquivo de ficha não reconhecido.", true); return; }
  S.fichaId = f.id; S.medicoes = (f.medicoes || []).map((x) => ({ ...x }));
  escreverPaciente(f.paciente || { pName: f.nome });
  const ult = [...S.medicoes].sort((a, b) => b.data.localeCompare(a.data))[0];
  $("mData").value = ult ? ult.data : hoje(); preencher(ult ? ult.mm : f.atual && f.atual.mm);
  renderFichas(); ETP.abrir("s0");
  status(`Ficha "${esc(f.nome)}" aberta: ${S.medicoes.length} medição(ões)${ult ? `, a última de ${dataBR(ult.data)}` : ""}.`);
}
function novaFicha() { S.fichaId = null; S.medicoes = []; escreverPaciente({}); $("mData").value = hoje(); preencher(C.EXEMPLO); renderFichas(); status("Ficha em branco. Preencha os dados do paciente, as medidas e registre."); $("pName").focus(); }
async function exportarFicha() { const f = coletar(); if (!f.nome) { status("Dê um nome ou código à ficha antes de exportar.", true); return; } if (await salvar(`${E.nomeArquivo(f.paciente.pId || E.iniciais(f.paciente.pName) || "paciente")}_ficha_CRANIO.json`, new Blob([JSON.stringify(f, null, 1)], { type: "application/json" }))) status("Ficha exportada."); }
async function importarArquivo(arq, base) {
  try {
    const j = JSON.parse(await arq.text());
    if (j && j.formato === FICHAS.formatoBase) { const r = FICHAS.importarBase(j); renderFichas(); status(`Base importada: ${r.novas} ficha(s) nova(s), ${r.atualizadas} atualizada(s).`); return; }
    if (j && j.formato === FICHAS.formatoFicha) { if (base) { const r = FICHAS.importarBase({ formato: FICHAS.formatoBase, fichas: [j] }); renderFichas(); status(`Ficha importada (${r.novas} nova, ${r.atualizadas} atualizada).`); } else abrirFicha(j); return; }
    status("Arquivo não reconhecido como ficha ou base do EITA! CRÂNIO.", true);
  } catch (e) { status("Não consegui ler esse arquivo.", true); }
}
async function exportarBase() { if (!FICHAS.listar().length) { status("Não há fichas salvas neste navegador."); return; } const b = FICHAS.exportarBase(); if (await salvar(b.nome, new Blob([b.conteudo], { type: "application/json" }))) status(`Base exportada com ${FICHAS.listar().length} ficha(s).`); }
$("fSave").onclick = () => salvarFicha(false);
$("fNew").onclick = novaFicha;
$("fExp").onclick = exportarFicha;
$("fImpB").onclick = () => $("fImp").click();
$("fImp").onchange = () => { const f = $("fImp").files[0]; $("fImp").value = ""; if (f) importarArquivo(f, false); };
$("dbExp").onclick = exportarBase;
$("dbImpB").onclick = () => $("dbImp").click();
$("dbImp").onchange = () => { const f = $("dbImp").files[0]; $("dbImp").value = ""; if (f) importarArquivo(f, true); };

/* ------------------------------------------------------------------ resumo e relatório */
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
async function gerarPDF() {
  const P = lerPaciente(), m = S.m, A = C.avaliar(m), r = A.r, dataM = $("mData").value, agora = new Date();
  const imgs = [], esq = await svgParaJpeg(svgCranio(m, r), 520, 600); if (esq) imgs.push(Object.assign({ name: "Im1" }, esq));
  const comCvai = S.medicoes.filter((x) => C.calcular(x.mm).cvai != null);
  if (comCvai.length >= 2) { const c = document.createElement("canvas"); c.width = 1200; c.height = 440; desenharGrafico(c, comCvai); imgs.push(Object.assign({ name: "Im2" }, UI.jpegDe(c, 0.9))); }
  const lg = await UI.logoJpeg("assets/eita-cranio-simbolo.png"); if (lg) imgs.push(Object.assign({ name: "Lg" }, lg));
  const R = E.criarRelatorioPDF({ app: ["EITA!", "CRÂNIO"], subtitulo: "Avaliação da assimetria craniana · Lab.EITA / UFG", logo: lg ? "Lg" : null,
    dataTexto: agora.toLocaleDateString("pt-BR") + " " + agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), pacienteTexto: P.pName || P.pId || "paciente não identificado", pacienteContinuacao: P.pName || P.pId || "" });
  const SEXO = { F: "feminino", M: "masculino", O: "outro" }, nasc = P.pBirth ? dataBR(P.pBirth) : "";
  R.secao("Paciente");
  R.campo(36, 180, "Nome", P.pName); R.campo(216, 90, "Prontuário / código", P.pId); R.campo(306, 70, "Nascimento", nasc); R.campo(376, 130, "Idade na medição", dataM ? idadeNa(dataM) : ""); R.campo(506, 53, "Sexo", SEXO[P.pSex]); R.y -= 25;
  R.campo(36, 300, "Diagnóstico", P.pDiag); R.campo(336, 100, "Idade gestacional", P.pGest ? P.pGest + " semanas" : ""); R.campo(436, 123, "Profissional", P.pProf); R.y -= 25;
  R.campo(36, 523, "Observações", (P.pNotes || "").replace(/\s+/g, " ")); R.y -= 24;
  const lin = (v, u) => (v != null ? fmt(v, 1) + u : "—"), cl = (k) => (A[k] ? A[k].classe.toLowerCase() : "—");
  R.par("Medidas" + (dataM ? " de " + dataBR(dataM) : ""), C.MEDIDAS.map((x) => [`${x.nome} (${x.sigla})`, m[x.k] > 0 ? fmt(m[x.k], 1) + " mm" : "—"]).concat([["Razão entre as diagonais", lin(r.ratio, " %")], ["Diagonal mais longa", r.longer ? r.longer + " (+" + fmt(r.cva, 1) + " mm)" : r.cva != null ? "iguais" : "—"]]),
    "Resultado", [["CVAI", lin(r.cvai, " %")], ["Classificação do CVAI", cl("cvai")], ["CVA", lin(r.cva, " mm")], ["Classificação do CVA", cl("cva")], ["Índice cefálico", lin(r.ci, "")], ["Forma do crânio", cl("ci")]]);
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
      [dataBR(x.data), E.cortarTexto(idadeNa(x.data), 8.4, 126), f1(x.mm.a) + " / " + f1(x.mm.b), f1(x.mm.l) + " / " + f1(x.mm.w), rr.cva != null ? fmt(rr.cva, 1) : "—", rr.cvai != null ? fmt(rr.cvai, 1) : "—", rr.ci != null ? fmt(rr.ci, 1) : "—"].forEach((t, i) => R.pg.text(cols[i][0], R.y, 8.4, t, i >= 4, E.CORES_PDF.tinta));
      R.y -= 11.5;
    }
    const ev = C.evolucao(l), s = (v) => (v > 0 ? "+" : v < 0 ? "-" : "") + fmt(Math.abs(v), 1);
    if (ev) { R.y -= 4; R.pg.text(36, R.y, 8.4, `Variação de ${dataBR(ev.desde)} a ${dataBR(ev.ate)}: CVAI ${ev.cvai != null ? s(ev.cvai) + " pontos" : "-"} · CVA ${ev.cva != null ? s(ev.cva) + " mm" : "-"} · índice cefálico ${ev.ci != null ? s(ev.ci) : "-"}`, true, E.CORES_PDF.roxo); R.y -= 12; }
  }
  R.avisoFinal("Critérios: CVAI normal < 3,5 %, leve 3,5 a < 6,25, moderada 6,25 a < 8,75, grave 8,75 a < 11, muito grave >= 11; CVA normal < 3 mm, leve 3 a < 6, moderada 6 a < 12, grave >= 12; índice cefálico 76 a < 81 mesocefálico, < 76 dolicocefálico, 81 a < 85,5 braquicefálico, >= 85,5 hiperbraquicefálico. Os limiares variam entre serviços e publicações. Ferramenta de apoio ao cálculo: a interpretação e a conduta dependem da avaliação clínica do paciente.");
  return R.finalizar(imgs);
}
$("expPdf").onclick = async () => {
  if (!C.calcular(S.m).cvai && !C.calcular(S.m).ci) { status("Informe as medidas antes de gerar o relatório.", true); return; }
  CASCA.ocupado(true, "Montando o relatório…"); await UI.espera(30);
  try {
    const pdf = await gerarPDF(); CASCA.ocupado(false); const P = lerPaciente();
    const nome = `${E.nomeArquivo(P.pId || E.iniciais(P.pName) || "cranio")}_CRANIO_${($("mData").value || hoje()).replace(/-/g, "")}_relatorio.pdf`;
    if (await salvar(nome, new Blob([pdf], { type: "application/pdf" }))) $("expInfo").innerHTML = '<div class="okbox">Relatório salvo.</div>';
  } catch (e) { CASCA.ocupado(false); status("Erro ao gerar o relatório: " + e.message, true); }
};
window.__eitaRelatorio = gerarPDF; // usado nos testes

/* ------------------------------------------------------------------ início */
renderFichas(); atualizarIdade(); render();
