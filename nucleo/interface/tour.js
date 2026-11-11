/* EITA núcleo · interface/tour — passo a passo sobre a página: destaca um elemento (spot) e mostra um cartão com
   texto e botões Pular / Voltar / Próximo. Teclas: Esc, ← e →. Origem: EITA! AFO v0.14 (E4d), mesmo comportamento.
   O visual vem do CSS da página (#tour, .spot, .card). Nada acontece na importação.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */

// passos: [{ sel: seletor CSS ou null (cartão centralizado), t: título, h: HTML do texto }]
// chave: localStorage que guarda "já visto" (gravada ao terminar ou pular).
// abrir(el): true se o elemento está recolhido e deve ser aberto durante o passo (é recolhido de novo depois).
export function criarTour({ passos, chave, abrir = () => false, recolhida = "collapsed", documento = globalThis.document }) {
  const janela = documento.defaultView;
  let atual = 0, aberto = null;
  const restaurar = () => { if (aberto) { aberto.classList.add(recolhida); aberto = null; } };
  function mostrar(i) {
    atual = i;
    let e = documento.getElementById("tour");
    if (!e) {
      e = documento.createElement("div"); e.id = "tour";
      e.innerHTML = '<div class="spot"></div><div class="card" role="dialog" aria-live="polite"></div>';
      documento.body.appendChild(e);
    }
    const p = passos[i], spot = e.querySelector(".spot"), card = e.querySelector(".card"), alvo = p.sel ? documento.querySelector(p.sel) : null;
    const W = janela.innerWidth, H = janela.innerHeight;
    restaurar();
    if (alvo && abrir(alvo)) { alvo.classList.remove(recolhida); aberto = alvo; }
    if (alvo && alvo.scrollIntoView) alvo.scrollIntoView({ block: "nearest" });
    const r = alvo ? alvo.getBoundingClientRect() : { left: W / 2, top: H / 2, width: 0, height: 0 };
    Object.assign(spot.style, alvo
      ? { left: r.left - 6 + "px", top: r.top - 6 + "px", width: r.width + 12 + "px", height: Math.min(r.height, H - r.top - 12) + 12 + "px", display: "block" }
      : { left: "50%", top: "50%", width: "0px", height: "0px" });
    card.innerHTML = `<div class="k">Passo ${i + 1} de ${passos.length}</div><h3>${p.t}</h3><div>${p.h}</div><div class="bt"><button type="button" class="skip">Pular</button>${i ? '<button type="button" class="prev">Voltar</button>' : ""}<button type="button" class="primary next">${i === passos.length - 1 ? "Começar" : "Próximo"}</button></div>`;
    const larg = 340, alt = card.offsetHeight || 220;
    let x, y;
    if (!alvo) { x = (W - larg) / 2; y = (H - alt) / 2; }
    else if (r.right + larg + 24 < W) { x = r.right + 16; y = Math.min(Math.max(12, r.top), H - alt - 12); }
    else { x = Math.max(12, Math.min(W - larg - 12, r.left + r.width / 2 - larg / 2)); y = Math.min(H - alt - 12, Math.max(12, r.top + 60)); }
    card.style.left = x + "px"; card.style.top = y + "px";
    card.querySelector(".skip").onclick = terminar;
    card.querySelector(".next").onclick = () => (i < passos.length - 1 ? mostrar(i + 1) : terminar());
    const v = card.querySelector(".prev"); if (v) v.onclick = () => mostrar(i - 1);
    card.querySelector(".next").focus();
  }
  function terminar() {
    restaurar();
    const e = documento.getElementById("tour"); if (e) e.remove();
    try { janela.localStorage.setItem(chave, "1"); } catch (e) {}
  }
  const ativo = () => !!documento.getElementById("tour");
  documento.addEventListener("keydown", (ev) => {
    if (!ativo()) return;
    if (ev.key === "Escape") terminar();
    if (ev.key === "ArrowRight" && atual < passos.length - 1) mostrar(atual + 1);
    if (ev.key === "ArrowLeft" && atual > 0) mostrar(atual - 1);
  });
  janela.addEventListener("resize", () => { if (ativo()) mostrar(atual); });
  // mostra na primeira visita (depois de espera ms); devolve true se mostrou
  function primeiraVez(espera = 600) {
    let visto = null; try { visto = janela.localStorage.getItem(chave); } catch (e) {}
    if (visto) return false; setTimeout(() => mostrar(0), espera); return true;
  }
  return { mostrar, terminar, primeiraVez, ativo };
}
