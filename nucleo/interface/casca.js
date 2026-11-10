/* EITA núcleo · interface/casca — layout Lab.EITA: status, aviso de "ocupado", downloads, etapas e seções.
   Só navegador. Nada acontece na importação: tudo é criado pelas funções, com os ids da página.
   Ids padrão da casca (ver modulos/mamilo/index.html): status, busy, busyT, stepper, panel.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */

export const espera = (ms = 20) => new Promise((r) => setTimeout(r, ms));
// número com vírgula decimal ("—" se vazio)
export const formatar = (v, d = 1) => (v == null || isNaN(v) ? "—" : Number(v).toFixed(d).replace(".", ","));

// Linha de status, aviso de ocupado e entrega de arquivos (capacidade "downloads" do claude.ai, ou link comum).
export function criarCasca({ ids = {}, documento = globalThis.document } = {}) {
  const I = Object.assign({ status: "status", ocupado: "busy", ocupadoTexto: "busyT" }, ids);
  const $ = (id) => documento.getElementById(id);
  function status(msg, aviso) { const s = $(I.status); s.innerHTML = msg; s.classList.toggle("warn", !!aviso); }
  function ocupado(on, txt) { $(I.ocupado).style.display = on ? "grid" : "none"; if (txt) $(I.ocupadoTexto).textContent = txt; }
  let dl = null;
  try { const w = globalThis.window; if (w && w.claude && w.claude.use) w.claude.use("downloads").then((ns) => { dl = ns; }).catch(() => {}); } catch (e) {}
  async function salvar(nome, dados) {
    if (dl) {
      try { await dl.save({ filename: nome, data: dados }); status(`Arquivo entregue: <b>${nome}</b>`); return true; }
      catch (e) {
        if (e && e.code === "declined") { status("Download cancelado."); return false; }
        if (e && e.code === "rate_limited") { status("Já há uma confirmação de download aberta. Responda a ela e tente de novo.", true); return false; }
      }
    }
    try {
      const blob = dados instanceof Blob ? dados : new Blob([dados]);
      const url = URL.createObjectURL(blob), a = documento.createElement("a");
      a.href = url; a.download = nome; documento.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      status(`Download iniciado: <b>${nome}</b>`); return true;
    } catch (e) { status("Este visualizador bloqueou o download. Abra a página no claude.ai.", true); return false; }
  }
  return { $, status, ocupado, salvar };
}

// Barra de etapas + painel de seções recolhíveis. etapas: [[idSecao, nome], …].
// aoAbrir(id, semVista) é chamado depois de abrir uma seção (o módulo troca a vista ali).
// bloqueada: mensagem quando a seção ainda está desativada (classe "off").
export function criarEtapas({ etapas, aoAbrir = () => {}, bloqueada, status, ids = {}, documento = globalThis.document }) {
  const I = Object.assign({ etapas: "stepper", painel: "panel" }, ids);
  const $ = (id) => documento.getElementById(id), barra = $(I.etapas), feitas = new Set(), validas = new Set(etapas.map((e) => e[0]));
  const marcarAtual = (id) => barra.querySelectorAll("button").forEach((b) => b.classList.toggle("cur", b.dataset.s === id));
  function montar() {
    barra.innerHTML = etapas.map(([id, nome], i) => `<button type="button" data-s="${id}" class="${feitas.has(id) ? "done" : ""}"><span class="n">${i + 1}</span>${nome}</button>`).join("");
    barra.querySelectorAll("button").forEach((b) => (b.onclick = () => abrir(b.dataset.s)));
  }
  function abrir(id, semVista) {
    const sec = $(id); if (sec.classList.contains("off")) { status(bloqueada, true); return; }
    documento.querySelectorAll(`#${I.painel} section`).forEach((s) => s.classList.toggle("collapsed", s.id !== id));
    marcarAtual(id);
    sec.scrollIntoView({ block: "nearest", behavior: "smooth" });
    aoAbrir(id, semVista);
  }
  documento.querySelectorAll(`#${I.painel} section > h2`).forEach((h) => h.addEventListener("click", () => {
    const s = h.parentElement; if (s.classList.contains("off")) return;
    if (s.classList.contains("collapsed")) abrir(s.id); else s.classList.add("collapsed");
  }));
  // marca a etapa como concluída (seções fora da barra, como a ficha, são ignoradas)
  function feito(id) { if (!validas.has(id)) return; feitas.add(id); montar(); const cur = documento.querySelector(`#${I.painel} section:not(.collapsed)`); if (cur) marcarAtual(cur.id); }
  function liberar(lista) { lista.forEach((id) => $(id).classList.remove("off")); }
  return { montar, abrir, feito, liberar, feitas };
}

// Área de soltar arquivo (clique, teclado, arrastar) ligada a um <input type=file>.
export function soltavel(z, f, fn) {
  z.addEventListener("click", () => f.click());
  z.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); f.click(); } });
  z.addEventListener("dragover", (e) => { e.preventDefault(); z.classList.add("hover"); });
  z.addEventListener("dragleave", () => z.classList.remove("hover"));
  z.addEventListener("drop", (e) => { e.preventDefault(); z.classList.remove("hover"); const a = e.dataTransfer.files[0]; if (a) fn(a); });
  f.addEventListener("change", () => { const a = f.files[0]; if (a) fn(a); f.value = ""; });
}
