/* EITA! NARIZ·ORELHA · cor — cores da pele medidas numa foto (calibrada pelo marcador do Lab.EITA, como no MAMILO) em
   pontos escolhidos por região, e a diferença de cada região para a base (CIELAB): o que a pintura intrínseca precisa
   acrescentar. Não é uma receita de pigmentos (depende da linha de silicone e dos pigmentos do laboratório): diz em que
   direção e quanto cada região se afasta da base. Puro: navegador e Node.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import { hex } from "../../nucleo/base.js";
import { rgbParaLab, medianaCanais } from "../../nucleo/imagem.js";

// regiões em que se mede a cor; a primeira é a base (cor de massa do silicone)
export const ZONAS_COR = {
  nariz: [
    { id: "base", nome: "Base (pele da região)", dica: "bochecha junto do nariz ou pele do dorso que restou" },
    { id: "ponta", nome: "Ponta", dica: "costuma ser mais vermelha" },
    { id: "asas", nome: "Asas e sulco alar", dica: "rubor e sombra do sulco" },
    { id: "dorso", nome: "Dorso", dica: "mais claro ou mais amarelado" },
    { id: "borda", nome: "Margem (pele em volta)", dica: "onde a borda da prótese termina: a transição tem de sumir" },
  ],
  orelha: [
    { id: "base", nome: "Base (orelha sadia, face lateral)", dica: "cor média da orelha do outro lado" },
    { id: "helice", nome: "Hélice (borda)", dica: "costuma ser mais vermelha" },
    { id: "concha", nome: "Concha", dica: "mais escura (sombra) ou rosada" },
    { id: "lobulo", nome: "Lóbulo", dica: "mais claro ou mais rosado" },
    { id: "borda", nome: "Margem (pele em volta)", dica: "pele junto da raiz da orelha" },
  ],
};

// cor mediana num disco de raio r (px) em torno de (x, y) da imagem { data, width, height } → { hex, rgb, lab, n }
export function amostrarCor(img, x, y, r) {
  const w = img.width, h = img.height, idx = [];
  for (let j = Math.max(0, Math.floor(y - r)); j <= Math.min(h - 1, Math.ceil(y + r)); j++)
    for (let i = Math.max(0, Math.floor(x - r)); i <= Math.min(w - 1, Math.ceil(x + r)); i++)
      if ((i - x) ** 2 + (j - y) ** 2 <= r * r) idx.push(j * w + i);
  if (!idx.length) return null;
  const rgb = medianaCanais(img, idx).map((v) => Math.round(v));
  const lab = rgbParaLab(rgb[0], rgb[1], rgb[2]).map((v) => +v.toFixed(1));
  return { hex: hex(rgb), rgb, lab, n: idx.length };
}

// ΔE (CIE76) e a diferença de cada componente para a base, com as direções em palavras
// L*: claridade; a*: vermelho (+) / verde (−); b*: amarelo (+) / azul (−). Limiar de percepção ≈ 2 (ΔE).
export function compararCor(base, z) {
  const dL = z.lab[0] - base.lab[0], da = z.lab[1] - base.lab[1], db = z.lab[2] - base.lab[2], dE = Math.hypot(dL, da, db);
  const dicas = [];
  if (da > 1.5) dicas.push(`mais vermelha (a* +${da.toFixed(1)})`); else if (da < -1.5) dicas.push(`menos vermelha (a* ${da.toFixed(1)})`);
  if (db > 1.5) dicas.push(`mais amarela (b* +${db.toFixed(1)})`); else if (db < -1.5) dicas.push(`menos amarela (b* ${db.toFixed(1)})`);
  if (dL > 2) dicas.push(`mais clara (L* +${dL.toFixed(1)})`); else if (dL < -2) dicas.push(`mais escura (L* ${dL.toFixed(1)})`);
  return { dL: +dL.toFixed(1), da: +da.toFixed(1), db: +db.toFixed(1), dE: +dE.toFixed(1), dicas, igual: dE < 2 };
}

// texto curto para a pintura intrínseca de uma região, a partir da comparação com a base
export function sugestaoPintura(c) {
  if (c.igual) return "igual à base (ΔE < 2): sem pintura própria";
  const p = [];
  if (c.da > 1.5) p.push("vermelho/rosado");
  if (c.db > 1.5) p.push("amarelo/ocre");
  if (c.dL < -2) p.push(c.da > 1.5 ? "um toque de marrom" : "marrom/sombra");
  if (c.dL > 2) p.push("branco/opaco, pouco");
  if (c.da < -1.5 && !p.length) p.push("menos vermelho que a base: base mais clara ou um toque de verde-oliva");
  if (c.db < -1.5 && !p.length) p.push("menos amarelo: um toque de azul ou cinza");
  return `ΔE ${c.dE.toString().replace(".", ",")}: ${p.join(" + ") || "ajuste fino"}, em camada fina, esfumando até a base`;
}
