/* Plataforma EITA — portal de pacientes: lista, ficha única (dados comuns), próteses de cada paciente,
   abrir o módulo (AFO, OLHO, MAMILO) para um paciente, juntar e excluir pacientes, exportar e importar a base.
   Regras da ficha única em nucleo/paciente.js; a ponte para as páginas dos módulos em modulos/portal/ponte.js.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
"use strict";
const E = window.EITA, UI = E.ui, M = E.MODULOS;
const $ = (id) => document.getElementById(id);
const esc = E.escaparHTML;
const CASCA = UI.criarCasca(), status = CASCA.status, salvar = CASCA.salvar;
const SIMBOLO = { afo: "assets/eita-afo-simbolo.png", olho: "assets/eita-olho-simbolo.png", mamilo: "assets/eita-mamilo-simbolo.png", cranio: "assets/eita-cranio-simbolo.png" };
const CHAVE_PENDENTES = "eita.pendentes.v1", VALIDADE_PENDENTE = 2 * 864e5;   // 2 dias
// módulos montados junto com o portal (meta "eita-modulos"); os outros abrem pelo artefato publicado à parte
const PRESENTES = (() => { const m = document.querySelector('meta[name="eita-modulos"]'); return new Set(m ? m.content.split(",").filter(Boolean) : Object.keys(M)); })();
const presente = (m) => PRESENTES.has(m);

// ------------------------------------------------------------------ armazenamento (só neste navegador)
const ler = (k, padrao = []) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? padrao : v; } catch (e) { return padrao; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
const fichasDosModulos = () => Object.fromEntries(Object.keys(M).map((m) => [m, ler(M[m].chave).filter((f) => f && f.formato === M[m].formatoFicha)]));

let PAC = [], FICHAS = {}, atual = null, filtro = "", armado = null, semArmazenamento = false;
try { atual = sessionStorage.getItem("eita.portal.atual"); } catch (e) {}   // paciente aberto antes de ir a um módulo

function sincronizarTudo() {
  FICHAS = fichasDosModulos();
  const agora = new Date(), pend = ler(CHAVE_PENDENTES).filter((p) => agora - new Date(p.desde) < VALIDADE_PENDENTE);
  const r = E.sincronizar(ler(E.CHAVE_PACIENTES), FICHAS, agora, pend);
  PAC = r.pacientes;
  semArmazenamento = !gravar(E.CHAVE_PACIENTES, PAC);
  gravar(CHAVE_PENDENTES, pend.filter((p) => !r.pendentesUsados.includes(p)));
  if (atual && !PAC.some((p) => p.id === atual)) atual = null;
  return r;
}
const paciente = (id) => PAC.find((p) => p.id === id);
function guardar() { semArmazenamento = !gravar(E.CHAVE_PACIENTES, PAC); if (semArmazenamento) status("Este navegador não deixou gravar as fichas. Exporte a base para não perder o trabalho.", true); }

// ------------------------------------------------------------------ apresentação
const iniciais = (p) => E.iniciais(p.dados.nome) || (p.dados.codigo || "?").slice(0, 3).toUpperCase();
const idade = (d) => E.idadeTexto(d, new Date(), { meses: true });
const dataBR = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");
const LADO = { D: "direito", E: "esquerdo" }, LADO_F = { D: "direita", E: "esquerda" };
const ladoTexto = (m, l) => (!l ? "" : m === "mamilo" ? "mama " + LADO_F[l] : m === "olho" ? "olho " + LADO[l] + (l === "D" ? " (OD)" : " (OE)") : "lado " + LADO[l]);
const SEXO = { F: "feminino", M: "masculino", O: "outro" };

function renderLista() {
  const l = E.ordenarPacientes(E.buscarPacientes(PAC, filtro));
  $("conta").textContent = PAC.length ? `${PAC.length}` : "";
  if (!PAC.length) { $("lista").innerHTML = '<div class="vazio">Nenhum paciente ainda. Crie um novo, abra um módulo abaixo, ou importe uma base.</div>'; return; }
  if (!l.length) { $("lista").innerHTML = '<div class="vazio">Nenhum paciente com esse nome ou prontuário.</div>'; return; }
  $("lista").innerHTML = l.map((p) => {
    const mods = [...new Set(p.proteses.map((v) => v.modulo))];
    const sub = [p.dados.codigo, idade(p.dados.nascimento), p.proteses.length ? p.proteses.length + (p.proteses.length > 1 ? " próteses" : " prótese") : "sem próteses"].filter(Boolean).join(" · ");
    return `<button type="button" class="pac${p.id === atual ? " cur" : ""}" data-id="${esc(p.id)}"><span class="ini">${esc(iniciais(p))}</span><span class="tx"><b>${esc(p.dados.nome || p.dados.codigo || "(sem nome)")}</b><small>${esc(sub)}</small></span><span class="mods">${mods.map((m) => `<img src="${SIMBOLO[m]}" alt="${esc(M[m].nome)}" title="${esc(M[m].nome)}">`).join("")}</span></button>`;
  }).join("");
  $("lista").querySelectorAll(".pac").forEach((b) => (b.onclick = () => selecionar(b.dataset.id)));
}

function renderInicio() {
  const n = PAC.length, np = PAC.reduce((s, p) => s + p.proteses.length, 0);
  $("detalhe").innerHTML = `
  <div class="cartao boas"><h2>Plataforma EITA</h2>
    <p>Um lugar para os pacientes do laboratório e todas as próteses e órteses de cada um. Escolha um paciente à esquerda para ver as fichas e abrir o módulo certo já com os dados dele.</p>
    <p class="note">${n ? `${n} paciente${n > 1 ? "s" : ""} e ${np} ficha${np === 1 ? "" : "s"} de prótese neste navegador.` : "Ainda não há pacientes neste navegador. As fichas que você já tem nos apps EITA! AFO, OLHO e MAMILO publicados à parte ficam guardadas em cada app: para trazê-las, exporte a base em cada um e importe aqui, em <b>Base do laboratório</b>. (A calculadora de assimetria craniana antiga não guardava fichas.)"}</p>
    ${semArmazenamento ? '<div class="warnbox">Este navegador não está deixando gravar: as fichas podem se perder ao fechar a página. Exporte a base com frequência.</div>' : ""}</div>
  <div class="cartao"><h3>Módulos</h3><div class="mods3">
    ${Object.entries(M).map(([m, X]) => `<div class="mod"><img src="${SIMBOLO[m]}" alt=""><b>${esc(X.nome)}</b><small>${esc(X.peca[0].toUpperCase() + X.peca.slice(1))}</small>${presente(m) ? `<button type="button" data-abrir="${m}">Abrir sem paciente</button>` : `<a class="ext" href="${esc(X.externo)}" target="_blank" rel="noopener">Abrir o app à parte ↗</a>`}</div>`).join("")}
  </div><div class="note" style="margin-top:10px">Aberto sem paciente, o módulo funciona como antes; a ficha salva nele aparece aqui ao voltar.${[...Object.keys(M)].filter((m) => !presente(m)).map((m) => ` O ${esc(M[m].nome)} ainda roda como app à parte: as fichas dele entram aqui importando a base dele (Base do laboratório).`).join("")}</div></div>`;
  $("detalhe").querySelectorAll("[data-abrir]").forEach((b) => (b.onclick = () => abrirModulo(b.dataset.abrir, null, null)));
}

function renderPaciente(p) {
  const d = p.dados, prots = E.protesesDoPaciente(p, FICHAS), outros = E.ordenarPacientes(PAC.filter((q) => q.id !== p.id));
  const meta = [d.codigo && "prontuário " + d.codigo, d.nascimento && dataBR(d.nascimento + "T12:00:00") + (idade(d.nascimento) ? " · " + idade(d.nascimento) : ""), SEXO[d.sexo]].filter(Boolean).join(" · ");
  $("detalhe").innerHTML = `
  <div class="cartao"><div class="cab"><span class="ini">${esc(iniciais(p))}</span><div><h2>${esc(d.nome || d.codigo || "(sem nome)")}</h2><div class="meta">${esc(meta || "sem prontuário nem data de nascimento")}</div></div></div></div>
  <div class="cartao"><h3>Próteses e órteses</h3>
    ${prots.length ? `<div class="prots">${prots.map((x) => `<div class="prot"><img src="${SIMBOLO[x.modulo]}" alt=""><div class="tx"><b>${esc(x.peca[0].toUpperCase() + x.peca.slice(1))}</b><small>${esc([ladoTexto(x.modulo, x.lado), dataBR(x.atualizado)].filter(Boolean).join(" · "))}</small><small>${esc(x.arquivo || "")}</small></div><button type="button" data-ficha="${esc(x.modulo)}|${esc(x.fichaId)}">Abrir</button></div>`).join("")}</div>` : '<div class="vazio">Nenhuma ficha de prótese ainda.</div>'}
    <div class="novos">${Object.entries(M).map(([m, X]) => presente(m) ? `<button type="button" data-novo="${m}"><img src="${SIMBOLO[m]}" alt="">Nova: ${esc(X.nome.replace("EITA! ", ""))}</button>` : `<a class="ext" href="${esc(X.externo)}" target="_blank" rel="noopener" title="App à parte: a ficha volta para cá pela base dele"><img src="${SIMBOLO[m]}" alt="">${esc(X.nome.replace("EITA! ", ""))} ↗</a>`).join("")}</div>
  </div>
  <div class="cartao"><h3>Dados do paciente</h3>
    <form id="fDados" class="campos" autocomplete="off">
      <label class="w2">Nome<input id="dNome" value="${esc(d.nome)}" placeholder="ex.: Maria S."></label>
      <label>Prontuário / código<input id="dCodigo" value="${esc(d.codigo)}" placeholder="ex.: HC-0123"></label>
      <label>Nascimento<input id="dNasc" type="date" value="${esc(d.nascimento)}"></label>
      <label>Sexo<select id="dSexo"><option value="">—</option>${Object.entries(SEXO).map(([k, v]) => `<option value="${k}"${d.sexo === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>
      <label class="w2">Profissional responsável<input id="dProf" value="${esc(d.profissional)}" placeholder="nome e registro"></label>
      <label>Alergias / sensibilidade<input id="dAlerg" value="${esc(d.alergias)}" placeholder="ex.: látex, adesivo"></label>
      <label class="w4">Observações gerais<textarea id="dObs" rows="2">${esc(d.observacoes)}</textarea></label>
      <div class="w4 row" style="margin:0"><button class="primary" type="submit">Salvar dados</button><span class="note" style="margin:0">Nome, prontuário, nascimento, sexo, profissional e alergias são levados para o módulo ao abrir uma ficha por aqui.</span></div>
    </form>
  </div>
  <div class="cartao"><h3>Organizar</h3>
    <div class="row"><label class="note" style="margin:0" for="jOutro">Juntar com outro paciente (a mesma pessoa cadastrada duas vezes):</label></div>
    <div class="row"><select id="jOutro" style="padding:7px;border:1px solid var(--line-strong);border-radius:7px;min-width:260px;font:inherit"><option value="">escolha…</option>${outros.map((q) => `<option value="${esc(q.id)}">${esc((q.dados.nome || "(sem nome)") + (q.dados.codigo ? " · " + q.dados.codigo : ""))}</option>`).join("")}</select><button type="button" id="jBtn">Juntar neste</button></div>
    <div class="row" style="margin-top:14px"><button type="button" id="excluir" class="perigo">Excluir paciente e fichas</button><span class="note" style="margin:0">Apaga deste navegador o paciente e as ${prots.length} ficha${prots.length === 1 ? "" : "s"} de prótese dele. Exporte a base antes, se quiser guardar.</span></div>
  </div>`;
  $("detalhe").querySelectorAll("[data-ficha]").forEach((b) => (b.onclick = () => { const [m, id] = b.dataset.ficha.split("|"); if (presente(m)) abrirModulo(m, p, id); else status(`O ${esc(M[m].nome)} ainda roda como app à parte: abra a ficha lá. Ele entra na plataforma na etapa E4.`, true); }));
  $("detalhe").querySelectorAll("[data-novo]").forEach((b) => (b.onclick = () => abrirModulo(b.dataset.novo, p, null)));
  $("fDados").onsubmit = (e) => { e.preventDefault(); salvarDados(p.id); };
  $("jBtn").onclick = () => juntar(p.id, $("jOutro").value);
  $("excluir").onclick = () => excluir(p.id);
}

function render() {
  renderLista(); const p = atual && paciente(atual); if (p) renderPaciente(p); else renderInicio();
  try { if (p) sessionStorage.setItem("eita.portal.atual", p.id); else sessionStorage.removeItem("eita.portal.atual"); } catch (e) {}
}
function selecionar(id) { atual = id; armado = null; render(); $("detalhe").scrollTop = 0; }

// ------------------------------------------------------------------ ações
function novo() {
  const p = E.novoPaciente({}); PAC.push(p); guardar(); atual = p.id; filtro = ""; $("busca").value = "";
  render(); $("dNome").focus(); status("Paciente novo. Preencha os dados e clique em <b>Salvar dados</b>; depois escolha a prótese.");
}
function salvarDados(id) {
  const p = paciente(id); if (!p) return;
  const v = (k) => $(k).value.trim();
  const dados = { ...p.dados, nome: v("dNome"), codigo: v("dCodigo"), nascimento: v("dNasc"), sexo: v("dSexo"), profissional: v("dProf"), alergias: v("dAlerg"), observacoes: $("dObs").value.trim() };
  if (!dados.nome && !dados.codigo) { status("Informe pelo menos o nome ou o prontuário.", true); $("dNome").focus(); return; }
  const outro = dados.codigo && PAC.find((q) => q.id !== id && E.normalizarTexto(q.dados.codigo) === E.normalizarTexto(dados.codigo));
  Object.assign(p, { dados, atualizado: new Date().toISOString() }); guardar(); render();
  status(outro ? `Dados salvos. Atenção: <b>${esc(outro.dados.nome || outro.dados.codigo)}</b> tem o mesmo prontuário; se for a mesma pessoa, use <b>Juntar</b>.` : "Dados do paciente salvos neste navegador.", !!outro);
}
function abrirModulo(m, p, fichaId) {
  try { sessionStorage.setItem("eita.abrir", JSON.stringify({ modulo: m, fichaId: fichaId || null, dados: p ? p.dados : null })); } catch (e) {}
  if (p && !fichaId) { const pend = ler(CHAVE_PENDENTES).filter((x) => !(x.pacienteId === p.id && x.modulo === m)); pend.push({ pacienteId: p.id, modulo: m, desde: new Date().toISOString() }); gravar(CHAVE_PENDENTES, pend); }
  location.href = M[m].pagina;
}
function juntar(fica, sai) {
  if (!sai) { status("Escolha na lista o outro cadastro da mesma pessoa.", true); return; }
  const q = paciente(sai), nome = q && (q.dados.nome || q.dados.codigo);
  PAC = E.juntarPacientes(PAC, fica, sai); guardar(); render();
  status(`<b>${esc(nome)}</b> foi juntado a este paciente: as próteses dos dois estão aqui.`);
}
function excluir(id) {
  const p = paciente(id); if (!p) return;
  if (armado !== id) {   // confirmar com um segundo clique (a plataforma não permite caixas de diálogo)
    armado = id; const b = $("excluir"); b.classList.add("armado"); b.textContent = "Clique de novo para excluir";
    setTimeout(() => { if (armado === id) { armado = null; const b2 = $("excluir"); if (b2) { b2.classList.remove("armado"); b2.textContent = "Excluir paciente e fichas"; } } }, 5000);
    return;
  }
  for (const v of p.proteses) { const k = M[v.modulo].chave; gravar(k, ler(k).filter((f) => f.id !== v.fichaId)); }
  PAC = PAC.filter((q) => q.id !== id); guardar(); atual = null; armado = null;
  sincronizarTudo(); render(); status(`Paciente <b>${esc(p.dados.nome || p.dados.codigo || "")}</b> e as fichas dele foram excluídos deste navegador.`);
}

// ------------------------------------------------------------------ base
async function exportar() {
  sincronizarTudo();
  const base = E.montarBase({ pacientes: PAC, fichas: FICHAS, calibracaoAFO: ler(E.CHAVE_CALIBRACAO_AFO) });
  const nf = Object.values(FICHAS).reduce((s, l) => s + l.length, 0);
  if (!PAC.length && !nf) { status("Não há pacientes nem fichas neste navegador para exportar."); return; }
  const ok = await salvar(`base_EITA_${E.dataCompacta(new Date())}.json`, new Blob([JSON.stringify(base)], { type: "application/json" }));
  if (ok) status(`Base exportada: ${PAC.length} paciente${PAC.length === 1 ? "" : "s"} e ${nf} ficha${nf === 1 ? "" : "s"}. O arquivo tem dados de pacientes: guarde-o num lugar seguro.`);
}
async function importar(arquivos) {
  const linhas = []; let erros = 0;
  for (const a of arquivos) {
    try {
      const L = E.lerArquivoEITA(JSON.parse(await a.text())), partes = [];
      for (const m of Object.keys(M)) {
        if (!(L.fichas[m] || []).length) continue;
        const r = E.mesclarFichas(ler(M[m].chave), L.fichas[m], M[m].formatoFicha);
        if (!gravar(M[m].chave, r.lista)) throw new Error("o navegador não deixou gravar (espaço cheio?)");
        partes.push(`${M[m].nome.replace("EITA! ", "")}: ${r.novas} nova${r.novas === 1 ? "" : "s"}, ${r.atualizadas} atualizada${r.atualizadas === 1 ? "" : "s"}`);
      }
      if (L.calibracaoAFO.length) { const r = E.mesclarCalibracaoAFO(ler(E.CHAVE_CALIBRACAO_AFO), L.calibracaoAFO); gravar(E.CHAVE_CALIBRACAO_AFO, r.lista); partes.push(`${r.novas} medição(ões) de bancada do AFO`); }
      if (L.pacientes.length) { const r = E.mesclarPacientes(ler(E.CHAVE_PACIENTES), L.pacientes); gravar(E.CHAVE_PACIENTES, r.lista); partes.push(`pacientes: ${r.novos} novo${r.novos === 1 ? "" : "s"}, ${r.atualizados} atualizado${r.atualizados === 1 ? "" : "s"}`); }
      linhas.push(`<b>${esc(a.name)}</b> (${esc(L.tipo)}): ${esc(partes.join("; ") || "nada novo")}`);
    } catch (e) { erros++; linhas.push(`<b>${esc(a.name)}</b>: não foi possível importar (${esc(e.message)})`); }
  }
  const s = sincronizarTudo(); render();
  $("impInfo").innerHTML = `<div class="${erros ? "warnbox" : "okbox"}">${linhas.join("<br>")}${s.criados ? `<br>${s.criados} paciente${s.criados > 1 ? "s" : ""} criado${s.criados > 1 ? "s" : ""} a partir das fichas.` : ""}</div>`;
  status(erros ? "Importação com problemas: veja o resumo em Base do laboratório." : "Importação concluída.", !!erros);
}

// ------------------------------------------------------------------ início
document.querySelectorAll("#panel section > h2").forEach((h) => h.addEventListener("click", () => h.parentElement.classList.toggle("collapsed")));   // seções recolhíveis
$("busca").addEventListener("input", () => { filtro = $("busca").value; renderLista(); });
$("novo").onclick = novo;
$("exp").onclick = exportar;
$("impB").onclick = () => $("imp").click();
$("imp").onchange = () => { const l = [...$("imp").files]; $("imp").value = ""; if (l.length) importar(l); };
const dz = $("drop");
dz.addEventListener("click", () => $("imp").click());
dz.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("imp").click(); } });
dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("hover"); });
dz.addEventListener("dragleave", () => dz.classList.remove("hover"));
dz.addEventListener("drop", (e) => { e.preventDefault(); dz.classList.remove("hover"); const l = [...e.dataTransfer.files]; if (l.length) importar(l); });
function aoVoltar() {
  const r = sincronizarTudo(); render();
  if (r.vinculadas || r.criados) status(`${r.vinculadas} ficha${r.vinculadas === 1 ? "" : "s"} de prótese ligada${r.vinculadas === 1 ? "" : "s"} aos pacientes${r.criados ? ` (${r.criados} paciente${r.criados > 1 ? "s" : ""} novo${r.criados > 1 ? "s" : ""})` : ""}.`);
}
window.addEventListener("pageshow", (e) => { if (e.persisted) aoVoltar(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") aoVoltar(); });
aoVoltar();
