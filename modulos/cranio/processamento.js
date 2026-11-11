/* EITA! CRÂNIO — cálculo da assimetria craniana (puro: roda no navegador e no Node).
   Mesmas fórmulas, limiares e textos da "Calculadora de Assimetria Craniana" publicada (legado/cranio):
   CVA = |A − B| (mm); CVAI = |A − B| ÷ maior diagonal × 100 (%); índice cefálico = largura ÷ comprimento × 100.
   Os limiares variam entre serviços e publicações; a interpretação depende da avaliação clínica.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */

export const MEDIDAS = Object.freeze([
  { k: "a", id: "dA", nome: "Diagonal A", sigla: "D1", dica: "Diagonal a 30° da linha média, em um sentido.", faixa: [80, 260] },
  { k: "b", id: "dB", nome: "Diagonal B", sigla: "D2", dica: "A outra diagonal, no sentido oposto.", faixa: [80, 260] },
  { k: "l", id: "len", nome: "Comprimento", sigla: "AP", dica: "Da glabela ao opistocrânio.", faixa: [100, 260] },
  { k: "w", id: "wid", nome: "Largura", sigla: "LL", dica: "Largura máxima entre os dois euríon.", faixa: [80, 200] },
]);
export const EXEMPLO = Object.freeze({ a: "148", b: "138", l: "165", w: "138" });

// escalas de classificação: limites (cortes), nomes e gravidade (0 = normal … 4 = muito grave)
export const ESCALAS = Object.freeze({
  cvai: { min: 0, max: 14, cortes: [3.5, 6.25, 8.75, 11], nomes: ["Normal", "Leve", "Moderada", "Grave", "Muito grave"], sev: [0, 1, 2, 3, 4] },
  cva: { min: 0, max: 16, cortes: [3, 6, 12], nomes: ["Normal", "Leve", "Moderada", "Grave"], sev: [0, 1, 2, 3] },
  ci: { min: 65, max: 95, cortes: [76, 81, 85.5], nomes: ["Dolicocefálico", "Mesocefálico", "Braquicefálico", "Hiperbraquicefálico"], sev: [1, 0, 1, 2] },
});
export const CARTOES = Object.freeze([
  { k: "cvai", rotulo: "CVAI", titulo: "Índice de assimetria da volta craniana", formula: "|A − B| ÷ maior diagonal × 100", unidade: "%" },
  { k: "cva", rotulo: "CVA", titulo: "Assimetria da volta craniana", formula: "|A − B|", unidade: "mm" },
  { k: "ci", rotulo: "Índice cefálico", titulo: "Forma do crânio", formula: "largura ÷ comprimento × 100", unidade: "" },
]);

// "148,5" → 148.5; vazio ou inválido → NaN
export function lerNumero(s) { const t = String(s == null ? "" : s).trim().replace(",", "."); if (!t) return NaN; const n = Number(t); return isFinite(n) ? n : NaN; }
// número com 1 casa no padrão brasileiro (como a calculadora original)
export const fmt = (n, d = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
export function classificar(escala, v) { let i = 0; while (i < escala.cortes.length && v >= escala.cortes[i]) i++; return i; }

// medidas em mm { a, b, l, w } (NaN/0 = ausente) → { cva, cvai, ratio, longer, ci } (só o que dá para calcular)
export function calcular(m) {
  const r = {};
  if (m.a > 0 && m.b > 0) {
    const mx = Math.max(m.a, m.b), mn = Math.min(m.a, m.b), diff = mx - mn;
    r.cva = diff; r.cvai = (diff / mx) * 100; r.ratio = (mn / mx) * 100; r.longer = m.a === m.b ? null : m.a > m.b ? "A" : "B";
  }
  if (m.l > 0 && m.w > 0) r.ci = (m.w / m.l) * 100;
  return r;
}
// valor digitado (na unidade "mm" ou "cm") → { mm, estado: ""|"warn"|"err", msg }
export function validar(medida, texto, unidade = "mm") {
  const raw = String(texto == null ? "" : texto).trim(); let mm = NaN, msg = medida.dica, estado = "";
  if (raw) {
    const n = lerNumero(raw);
    if (!(n > 0)) { estado = "err"; msg = "Digite um número maior que zero."; }
    else {
      mm = unidade === "cm" ? n * 10 : n;
      if (mm < medida.faixa[0] || mm > medida.faixa[1]) { estado = "warn"; const f = unidade === "cm" ? 10 : 1; msg = `Valor incomum. Faixa usual: ${fmt(medida.faixa[0] / f, 0)} a ${fmt(medida.faixa[1] / f, 0)} ${unidade}. Confira a unidade.`; }
    }
  }
  return { mm: estado === "err" ? NaN : mm, estado, msg };
}
// classificação de cada índice calculado → { cvai: {valor, classe, sev}, … }
export function avaliar(m) {
  const r = calcular(m), out = { r };
  for (const k of ["cvai", "cva", "ci"]) if (r[k] != null) { const E = ESCALAS[k], i = classificar(E, r[k]); out[k] = { valor: r[k], classe: E.nomes[i], sev: E.sev[i] }; }
  return out;
}
// resumo em texto (o mesmo da calculadora original)
export function resumo(m) {
  const A = avaliar(m), r = A.r, linhas = [];
  if (m.a > 0 || m.b > 0 || m.l > 0 || m.w > 0) {
    const p = [];
    if (m.a > 0) p.push("Diagonal A " + fmt(m.a, 1) + " mm");
    if (m.b > 0) p.push("Diagonal B " + fmt(m.b, 1) + " mm");
    if (m.l > 0) p.push("Comprimento " + fmt(m.l, 1) + " mm");
    if (m.w > 0) p.push("Largura " + fmt(m.w, 1) + " mm");
    linhas.push(p.join(" | "));
  }
  if (r.cva != null) { linhas.push("CVA: " + fmt(r.cva, 1) + " mm (" + A.cva.classe.toLowerCase() + ")"); linhas.push("CVAI: " + fmt(r.cvai, 1) + " % (" + A.cvai.classe.toLowerCase() + ")"); }
  if (r.ci != null) linhas.push("Índice cefálico: " + fmt(r.ci, 1) + " (" + A.ci.classe.toLowerCase() + ")");
  return linhas.length ? linhas.join("\n") : "Informe as medidas para gerar o resumo.";
}
// frase sobre a diagonal mais longa
export function fraseDiagonais(r) {
  if (r.cva == null) return "Informe as duas diagonais.";
  if (r.longer == null) return "As duas diagonais têm o mesmo valor.";
  return "A diagonal " + r.longer + " é a mais longa, por " + fmt(r.cva, 1) + " mm.";
}

// ------------------------------------------------------------------ acompanhamento (recurso da plataforma)
// idade corrigida para prematuros (nascidos antes de 37 semanas): idade − (40 − semanas), em dias
export function idadeEmDias(nascimento, data) { if (!nascimento || !data) return NaN; return Math.round((new Date(data + "T12:00:00") - new Date(nascimento + "T12:00:00")) / 864e5); }
export function idadeCorrigidaDias(nascimento, data, semanas) {
  const d = idadeEmDias(nascimento, data); if (!isFinite(d)) return NaN;
  const s = lerNumero(semanas); return s > 0 && s < 37 ? d - Math.round((40 - s) * 7) : d;
}
// dias → "4 meses e 12 dias" / "1 ano e 2 meses"
export function idadeTextoDias(dias) {
  if (!isFinite(dias)) return "";
  if (dias < 0) return "antes do termo";
  const meses = Math.floor(dias / 30.4375), resto = Math.round(dias - meses * 30.4375);
  if (meses < 1) return dias + (dias === 1 ? " dia" : " dias");
  if (meses < 24) return meses + (meses === 1 ? " mês" : " meses") + (resto ? " e " + resto + (resto === 1 ? " dia" : " dias") : "");
  const a = Math.floor(meses / 12), mm = meses % 12; return a + " anos" + (mm ? " e " + mm + (mm === 1 ? " mês" : " meses") : "");
}
// variação entre a primeira e a última medição → { cvai, cva, ci } (diferenças) ou null
export function evolucao(medicoes) {
  const l = [...medicoes].filter((x) => x && x.data).sort((a, b) => a.data.localeCompare(b.data)); if (l.length < 2) return null;
  const p = calcular(l[0].mm), u = calcular(l[l.length - 1].mm), d = {};
  for (const k of ["cvai", "cva", "ci"]) if (p[k] != null && u[k] != null) d[k] = u[k] - p[k];
  return { desde: l[0].data, ate: l[l.length - 1].data, ...d };
}
