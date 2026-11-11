/* Plataforma EITA — ponte entre o portal de pacientes e as páginas dos módulos (AFO, OLHO, MAMILO, CRÂNIO).
   Script clássico, acrescentado pela montagem da plataforma no fim de cada página de módulo:
     <script src="../ponte.js" data-modulo="olho"></script>
   Não depende do código do módulo: usa só os ids comuns das páginas Lab.EITA (top, status, busy, s0, fList,
   pName, pId, pBirth, pSex, pProf, pAlerg). Faz três coisas:
   1) põe o botão "‹ Pacientes" no topo, de volta ao portal;
   2) quando o portal pediu (sessionStorage "eita.abrir"), abre a ficha daquele paciente no módulo, ou
      preenche os dados do paciente numa ficha nova;
   3) nada mais: salvar continua sendo no próprio módulo, e o portal liga a ficha ao paciente ao voltar.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
(function () {
  "use strict";
  const eu = document.currentScript, MOD = eu && eu.dataset.modulo;
  const CHAVES = { afo: "eitaAFO.fichas.v1", olho: "eitaOLHO.fichas.v1", mamilo: "eitaMAMILO.fichas.v1", cranio: "eitaCRANIO.fichas.v1" };
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // 1) voltar ao portal
  const est = document.createElement("style");
  est.textContent = ".eita-voltar{display:flex;align-items:center;gap:4px;flex:none;padding:6px 11px 6px 8px;border:1px solid var(--line-strong,#A79FBF);border-radius:999px;font:600 12.5px var(--f-body,system-ui);color:var(--accent,#6B3FD6);text-decoration:none;background:var(--surface,#fff)}.eita-voltar:hover{background:var(--accent-soft,#EFE8FF)}.eita-voltar b{font-size:17px;line-height:1;margin-top:-2px}";
  document.head.appendChild(est);
  const topo = $("top");
  if (topo) {
    const a = document.createElement("a");
    a.href = "../index.html"; a.className = "eita-voltar"; a.title = "Voltar à lista de pacientes da Plataforma EITA";
    a.innerHTML = "<b>‹</b> Pacientes";
    topo.insertBefore(a, topo.firstChild);
  }

  // 2) pedido do portal (vale uma vez)
  let pedido = null;
  try { pedido = JSON.parse(sessionStorage.getItem("eita.abrir") || "null"); sessionStorage.removeItem("eita.abrir"); } catch (e) { pedido = null; }
  if (!pedido || pedido.modulo !== MOD) return;

  // espera o módulo terminar de iniciar (o MAMILO carrega um exemplo ao abrir)
  const ocupado = () => { const b = $("busy"); return !!b && getComputedStyle(b).display !== "none"; };
  const aguardar = () => new Promise((ok) => { let calmo = 0, n = 0; const t = setInterval(() => { calmo = ocupado() ? 0 : calmo + 1; if (calmo >= 6 || ++n > 150) { clearInterval(t); ok(); } }, 100); });
  function preencher(d) {
    const mapa = { pName: d.nome, pId: d.codigo, pBirth: d.nascimento, pSex: d.sexo, pProf: d.profissional, pAlerg: d.alergias };
    for (const [id, v] of Object.entries(mapa)) {
      const el = $(id); if (!el || v == null || v === "" || el.value === v) continue;
      if (el.tagName === "SELECT" && ![...el.options].some((o) => o.value === v)) continue;
      el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
  function abrirFicha(id) {
    let l = []; try { l = JSON.parse(localStorage.getItem(CHAVES[MOD]) || "[]"); } catch (e) { l = []; }
    const i = l.findIndex((f) => f && f.id === id); if (i < 0) return false;
    const b = document.querySelector(`#fList [data-open="${i}"]`); if (!b) return false;
    b.click(); return true;
  }
  function avisar(html) { const s = $("status"); if (s) { s.innerHTML = html; s.classList.remove("warn"); } }
  function mostrarFicha() { const s0 = $("s0"); if (s0 && s0.classList.contains("collapsed")) { const h = s0.querySelector("h2"); if (h) h.click(); } }
  window.addEventListener("load", async () => {
    await aguardar();
    const nome = pedido.dados && (pedido.dados.nome || pedido.dados.codigo);
    if (pedido.fichaId && abrirFicha(pedido.fichaId)) { if (pedido.dados) preencher(pedido.dados); return; }   // o portal manda nos dados comuns
    if (pedido.dados) preencher(pedido.dados);
    mostrarFicha();
    if (nome) avisar(`Nova ficha para <b>${esc(nome)}</b>, com os dados do portal. Siga as etapas e use <b>Salvar ficha</b>: ao voltar a <b>‹ Pacientes</b>, ela aparece na lista do paciente.`);
  });
})();
