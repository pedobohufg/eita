/* EITA! MAMILO · pigmentação — cores por zona medidas na foto (perfil radial da aréola) e
   máscara de pintura que encaixa no molde frontal para a pintura intrínseca em camadas.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import { hex } from "../../nucleo/base.js";
import { medianaCanais } from "../../nucleo/imagem.js";
import { indicesAdaptativos, solido, stl } from "../../nucleo/malha.js";
import { CABECALHO_STL, moldes } from "./processamento.js";

// Zonas na ordem em que entram no molde (o que se vê primeiro é pintado primeiro).
export const ZONAS_PIGMENTO = [
  { id: "papila", nome: "Papila", camada: "1ª — no fundo da cavidade da papila" },
  { id: "areola_centro", nome: "Aréola (centro)", camada: "2ª — metade interna da aréola" },
  { id: "areola_borda", nome: "Aréola (borda)", camada: "3ª — metade externa, esfumando até a máscara" },
  { id: "base", nome: "Base (pele)", camada: "4ª — preenchimento, levemente translúcida" },
  { id: "extrinseca", nome: "Ajuste externo", camada: "depois de desmoldar — tinta de silicone + selante" }
];

// Cor mediana por anel elíptico da aréola (rho = 1 na borda), fora da papila, mais papila e pele.
// Devolve as faixas (para desenhar o degradê) e as cores por zona (para a receita).
export function perfilCorRadial(img, seg, nFaixas = 8) {
  const w = img.width, h = img.height, a = seg.areola, p = seg.papila;
  const th = (a.angulo_graus * Math.PI) / 180, c = Math.cos(th), s = Math.sin(th);
  const A2 = a.eixo_maior_px / 2, B2 = a.eixo_menor_px / 2, rp = p.diam_px / 2;
  const R = Math.max(A2, B2) * 1.4, ROUT = 1.3;
  const faixas = Array.from({ length: nFaixas }, () => []), pap = [], centro = [], borda = [], trans = [], pele = [];
  let rhoPap = Infinity;   // menor rho alcançado fora da papila (início do degradê)
  for (let y = Math.max(0, (a.cy - R) | 0); y < Math.min(h, a.cy + R); y++) for (let x = Math.max(0, (a.cx - R) | 0); x < Math.min(w, a.cx + R); x++) {
    const dx = x - a.cx, dy = y - a.cy, xr = dx * c + dy * s, yr = -dx * s + dy * c;
    const rho = Math.sqrt((xr / A2) ** 2 + (yr / B2) ** 2), dp = Math.hypot(x - p.cx, y - p.cy), i = y * w + x;
    if (dp < 0.8 * rp) { pap.push(i); continue; }
    if (dp < 1.25 * rp) continue;                       // transição papila/aréola fica de fora
    if (rho < 1) {
      rhoPap = Math.min(rhoPap, rho);
      faixas[Math.min(nFaixas - 1, Math.floor(rho * nFaixas))].push(i);
      (rho < 0.55 ? centro : borda).push(i);
    } else if (rho < 1.12) trans.push(i);
    else if (rho < ROUT + 0.15) pele.push(i);
  }
  const cor = (idx) => (idx.length >= 20 ? hex(medianaCanais(img, idx)) : null);
  const lista = faixas.map((idx, k) => ({ rho0: k / nFaixas, rho1: (k + 1) / nFaixas, cor: cor(idx), pixels: idx.length }));
  // faixas sem pixels (encobertas pela papila) herdam a vizinha de fora
  for (let k = nFaixas - 2; k >= 0; k--) if (!lista[k].cor) lista[k].cor = lista[k + 1].cor;
  return {
    faixas: lista,
    zonas: { papila: cor(pap), areola_centro: cor(centro) || cor(borda), areola_borda: cor(borda), transicao: cor(trans), base: cor(pele) },
    rho_inicio: isFinite(rhoPap) ? +rhoPap.toFixed(3) : 0
  };
}

// Máscara de pintura: parede fina que assenta na cavidade do molde frontal exatamente sobre a borda
// da aréola (lado de fora), com duas abas para tirar. Pinta-se a aréola por dentro do anel, retira-se
// a máscara e segue-se com a base. Sai nas mesmas coordenadas do molde_frontal.stl.
export const MASCARA_PADRAO = { largura_mm: 1.0, altura_mm: 2.0, aba_mm: 4, aba_largura_mm: 3, aba_extra_mm: 1.5 };

export function mascaraPintura(G, p, opc) {
  const o = Object.assign({}, MASCARA_PADRAO, opc || {});
  const { n, xs, S, F, dentro, rho } = G, N = n * n;
  const M = moldes(G, p.parede_molde_mm, p.folga_pino_mm, p.canal_transbordo_mm);
  // abas na direção horizontal da grade (esquerda e direita da aréola)
  const ux = 1, uy = 0;
  const aMin = Math.min(G.a, G.b), dRho = o.largura_mm / aMin, rAba = 1 + (o.largura_mm + o.aba_mm) / aMin;
  const mask = new Uint8Array(N), Zb = new Float32Array(N), Zt = new Float32Array(N);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const q = j * n + i, sup = dentro[q] ? F[q] : S[q];
    const anel = rho[q] >= 1 && rho[q] <= 1 + dRho;
    const along = xs[i] * ux + xs[j] * uy, perp = Math.abs(-xs[i] * uy + xs[j] * ux);
    const aba = rho[q] > 1 && rho[q] <= rAba && perp <= o.aba_largura_mm / 2 && Math.abs(along) > 0.5 * Math.min(G.a, G.b);
    if (!anel && !aba) continue;
    mask[q] = 1; Zt[q] = sup; Zb[q] = sup - o.altura_mm - (aba ? o.aba_extra_mm : 0);
  }
  const zf = Math.max(G.a, G.b) * (1 + rAba) + 2;
  const idx = indicesAdaptativos(xs, zf, 0.5);
  const malha = solido(xs, idx, n, Zb, Zt, mask, false, false);
  const zt = M.zTop, tf = (x, y, z) => [x, y, zt - z]; tf.inverte = true;   // mesma transformação do molde frontal
  return { malha, arquivo: stl(malha, tf, CABECALHO_STL + " - mascara"), opcoes: o };
}
