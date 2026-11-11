/* EITA núcleo · interface/casca — layout Lab.EITA: status, aviso de "ocupado", downloads, etapas e seções.
   Só navegador. Nada acontece na importação: tudo é criado pelas funções, com os ids da página.
   Ids padrão da casca (ver modulos/mamilo/index.html): status, busy, busyT, stepper, panel.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */

export const espera = (ms = 20) => new Promise((r) => setTimeout(r, ms));
// número com vírgula decimal ("—" se vazio)
export const formatar = (v, d = 1) => (v == null || isNaN(v) ? "—" : Number(v).toFixed(d).replace(".", ","));

// Capacidade "downloads" do claude.ai (null fora dele). Pedida uma vez; se falhar, é pedida de novo na próxima chamada.
let pedidoDownloads = null;
export function capacidadeDownloads() {
  if (!pedidoDownloads) {
    let w = null; try { w = globalThis.window; } catch (e) {}
    if (!(w && w.claude && w.claude.use)) return Promise.resolve(null);
    pedidoDownloads = w.claude.use("downloads").catch(() => null).then((ns) => { if (!ns) pedidoDownloads = null; return ns; });
  }
  return pedidoDownloads;
}
// Entrega pela capacidade. → { ok: true } ou { ok: false, codigo: "declined" | "rate_limited" | …, erro }
export async function salvarPelaCapacidade(dl, nome, dados) {
  try { await dl.save({ filename: nome, data: dados }); return { ok: true }; }
  catch (e) { return { ok: false, codigo: e && e.code, erro: e }; }
}
// Download comum por link (fora do claude.ai). → true se o clique foi disparado.
export function baixarPorLink(nome, dados, documento = globalThis.document) {
  try {
    const blob = dados instanceof Blob ? dados : new Blob([dados]);
    const url = URL.createObjectURL(blob), a = documento.createElement("a");
    a.href = url; a.download = nome; documento.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return true;
  } catch (e) { return false; }
}

// Linha de status, aviso de ocupado e entrega de arquivos (capacidade "downloads" do claude.ai, ou link comum).
export function criarCasca({ ids = {}, documento = globalThis.document } = {}) {
  const I = Object.assign({ status: "status", ocupado: "busy", ocupadoTexto: "busyT" }, ids);
  const $ = (id) => documento.getElementById(id);
  function status(msg, aviso) { const s = $(I.status); s.innerHTML = msg; s.classList.toggle("warn", !!aviso); }
  function ocupado(on, txt) { $(I.ocupado).style.display = on ? "grid" : "none"; if (txt) $(I.ocupadoTexto).textContent = txt; }
  capacidadeDownloads();
  async function salvar(nome, dados) {
    const dl = await capacidadeDownloads();
    if (dl) {
      const r = await salvarPelaCapacidade(dl, nome, dados);
      if (r.ok) { status(`Arquivo entregue: <b>${nome}</b>`); return true; }
      if (r.codigo === "declined") { status("Download cancelado."); return false; }
      if (r.codigo === "rate_limited") { status("Já há uma confirmação de download aberta. Responda a ela e tente de novo.", true); return false; }
    }
    if (baixarPorLink(nome, dados, documento)) { status(`Download iniciado: <b>${nome}</b>`); return true; }
    status("Este visualizador bloqueou o download. Abra a página no claude.ai.", true); return false;
  }
  return { $, status, ocupado, salvar };
}

// Barra de etapas + painel de seções recolhíveis. etapas: [[idSecao, nome], …].
// aoAbrir(id, semVista) é chamado depois de abrir uma seção (o módulo troca a vista ali).
// bloqueada: mensagem quando a seção ainda está desativada (classe "off").
// rolagem: "smooth" ou "auto" ao trazer a seção para a vista.
export function criarEtapas({ etapas, aoAbrir = () => {}, bloqueada, status, rolagem = "smooth", ids = {}, documento = globalThis.document }) {
  const I = Object.assign({ etapas: "stepper", painel: "panel" }, ids);
  const $ = (id) => documento.getElementById(id), barra = $(I.etapas), feitas = new Set(), validas = new Set(etapas.map((e) => e[0]));
  const marcarAtual = (id) => barra.querySelectorAll("button").forEach((b) => b.classList.toggle("cur", b.dataset.s === id));
  function montar() {
    barra.innerHTML = etapas.map(([id, nome], i) => `<button type="button" data-s="${id}" class="${feitas.has(id) ? "done" : ""}"><span class="n">${i + 1}</span>${nome}</button>`).join("");
    barra.querySelectorAll("button").forEach((b) => (b.onclick = () => abrir(b.dataset.s)));
  }
  function abrir(id, semVista) {
    const sec = $(id); if (sec.classList.contains("off")) { if (bloqueada) status(bloqueada, true); return; }
    documento.querySelectorAll(`#${I.painel} section`).forEach((s) => s.classList.toggle("collapsed", s.id !== id));
    marcarAtual(id);
    sec.scrollIntoView(rolagem === "smooth" ? { block: "nearest", behavior: "smooth" } : { block: "nearest" });
    aoAbrir(id, semVista);
  }
  documento.querySelectorAll(`#${I.painel} section > h2`).forEach((h) => h.addEventListener("click", () => {
    const s = h.parentElement; if (s.classList.contains("off")) return;
    if (s.classList.contains("collapsed")) abrir(s.id); else s.classList.add("collapsed");
  }));
  // marca a etapa como concluída (seções fora da barra, como a ficha, são ignoradas)
  function feito(id) { if (!validas.has(id)) return; feitas.add(id); montar(); const cur = documento.querySelector(`#${I.painel} section:not(.collapsed)`); if (cur) marcarAtual(cur.id); }
  function liberar(lista) { lista.forEach((id) => $(id).classList.remove("off")); }
  // progresso linear: libera as n primeiras seções e marca como feitas as n − 1 primeiras
  function habilitarAte(n) {
    etapas.forEach(([id], i) => {
      $(id).classList.toggle("off", i >= n);
      const b = barra.querySelector(`button[data-s=${id}]`); if (b) b.classList.toggle("done", i < n - 1);
    });
  }
  return { montar, abrir, feito, liberar, habilitarAte, feitas };
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
