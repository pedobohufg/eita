/* EITA! CRÂNIO — ficha unificada (avaliação + órtese) e leitura das fichas e bases da versão completa antiga
   ("EITA! Crânio ficha"/"EITA! Crânio base", legado/cranio-ortese). Puro: navegador e Node.
   A ficha da plataforma continua "EITA! CRÂNIO ficha" (chave eitaCRANIO.fichas.v1): paciente, medições por data
   e, desde a versão 0.3, a parte da órtese em `ortese` (scan de referência, pontos, plano, valores dos campos
   cro-* da página antiga, correções manuais, versões e o resultado da última casca gerada).
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */

export const FORMATO_FICHA = "EITA! CRÂNIO ficha";
export const FORMATO_BASE = "EITA! CRÂNIO base";
export const VERSAO_APP = "0.3";
export const FORMATO_FICHA_ANTIGA = "EITA! Crânio ficha";
export const FORMATO_BASE_ANTIGA = "EITA! Crânio base";
// campos do paciente na página (ids); os sete primeiros já existiam na versão 0.2
export const CAMPOS_PACIENTE = ["pName", "pId", "pBirth", "pSex", "pGest", "pDiag", "pProf", "pNotes", "pPeso", "pPC", "pLado", "pObj"];
// campos pt-* da ficha antiga → ids da página
const DE_ANTIGA = { "pt-name": "pName", "pt-id": "pId", "pt-birth": "pBirth", "pt-sex": "pSex", "pt-ga": "pGest", "pt-weight": "pPeso", "pt-hc": "pPC", "pt-side": "pLado", "pt-diag": "pDiag", "pt-goal": "pObj", "pt-prof": "pProf", "pt-notes": "pNotes" };
const SEXO = { Feminino: "F", Masculino: "M", Outro: "O" };
const LADO = { Direito: "D", Esquerdo: "E", "Bilateral / posterior": "B" };
export const NOMES_LADO = { D: "Direito", E: "Esquerdo", B: "Bilateral / posterior" };

const txt = (v) => (v == null ? "" : String(v).trim());
export const ehFichaAntiga = (f) => !!f && f.formato === FORMATO_FICHA_ANTIGA;
export const ehBaseAntiga = (b) => !!b && b.formato === FORMATO_BASE_ANTIGA;

// Campos da órtese criados na E3c-4 (estilo do laboratório). Numa ficha que não os tem (página antiga ou v0.3), valem
// os equivalentes ao comportamento antigo: topo da faixa igual atrás e na frente, furos em toda a casca.
export function completarEntradas(e) {
  const o = Object.assign({}, e || {});
  if (o["cro-type"] == null) return o;   // ficha sem os campos da órtese: ficam os da página (protocolo atual)
  if (o["cro-bandtop-back"] == null) o["cro-bandtop-back"] = o["cro-bandtop"] != null ? o["cro-bandtop"] : "55";
  if (o["cro-hole-zone"] == null) o["cro-hole-zone"] = "all";
  if (o["cro-front-arc"] == null) o["cro-front-arc"] = "0";
  if (o["cro-cheek-wall"] == null) o["cro-cheek-wall"] = "off";   // apoio copiando o rosto e descida curta atrás da orelha
  if (o["cro-cheek-foam"] == null) o["cro-cheek-foam"] = "0";
  if (o["cro-ear-back"] == null) o["cro-ear-back"] = "0";
  return o;
}
// Valores dos campos da página antiga (todos os cro-* de projeto): base para fichas e predefinições que só citam
// parte deles, para que a casca saia como na página antiga.
export const PADRAO_ANTIGO = Object.freeze({ "cro-indic": "auto", "cro-age": "", "cro-ic-target": "0,85", "cro-mode": "passive", "cro-relief": "100", "cro-relief-max": "6", "cro-comp-max": "1,5",
  "cro-type": "closed", "cro-bandtop": "55", "cro-bandtop-back": "55", "cro-c0": "2", "cro-t": "3", "cro-hb": "-12", "cro-occ-drop": "8", "cro-cheek": "on", "cro-cheek-w": "30", "cro-mast": "on", "cro-mast-w": "24",
  "cro-res": "normal", "cro-split": "coronal", "cro-grow-src": "age", "cro-grow-m": "4", "cro-grow-rate": "0,8", "cro-grow-contact": "30", "cro-grow-vertex": "2", "cro-ear-mode": "auto", "cro-ear-clear": "8",
  "cro-ear-az-r": "100", "cro-ear-az-l": "100", "cro-ear-w-r": "24", "cro-ear-w-l": "24", "cro-ear-top-r": "14", "cro-ear-top-l": "14", "cro-hf": "4", "cro-occ-w": "50", "cro-cheek-depth": "32",
  "cro-cheek-gap": "6", "cro-cheek-clear": "1,5", "cro-mast-depth": "24", "cro-mast-gap": "4", "cro-hole-d": "4", "cro-pitch": "10", "cro-margin": "8", "cro-split-pos": "-35", "cro-gap": "2", "cro-hole-zone": "all", "cro-front-arc": "0",
  "cro-cheek-wall": "off", "cro-cheek-foam": "0", "cro-ear-back": "0" });
// Protocolo do laboratório (E3c-4; padrão da página desde então): faixa de topo aberto inclinado (40° na frente,
// 70° atrás), borda frontal na altura da glabela até ±40° (acima dos olhos), borda de trás baixa, apoio pré-auricular, sem aba atrás da orelha, peça inteira com fenda lateral E e
// furos só na frente e atrás. A superfície interna segue a cabeça (folga de 2 mm + reserva de crescimento), menos nos
// apoios da bochecha, que são lisos com 3 mm para espuma; atrás da orelha a borda desce numa curva de 35°.
export const PROTOCOLO_LABEITA = Object.freeze({ "cro-type": "band", "cro-bandtop": "40", "cro-bandtop-back": "70", "cro-hf": "0", "cro-front-arc": "40", "cro-hb": "-30", "cro-occ-drop": "10", "cro-cheek": "on", "cro-cheek-depth": "45",
  "cro-mast": "off", "cro-split": "lateralL", "cro-gap": "2", "cro-hole-zone": "ap", "cro-c0": "2",
  "cro-cheek-wall": "on", "cro-cheek-foam": "3", "cro-ear-back": "35" });

// Ficha antiga → ficha da plataforma (sem medições: a página antiga não as guardava na ficha).
// O id é mantido (importar de novo atualiza a mesma ficha); `origem` registra de onde veio.
export function converterFichaAntiga(f, agora = new Date()) {
  if (!ehFichaAntiga(f)) throw new Error("não é uma ficha da versão antiga do EITA! Crânio");
  const pa = f.paciente || {}, p = {};
  for (const [a, n] of Object.entries(DE_ANTIGA)) p[n] = txt(pa[a]);
  p.pSex = SEXO[p.pSex] || (["F", "M", "O"].includes(p.pSex) ? p.pSex : "");
  p.pLado = LADO[p.pLado] || (NOMES_LADO[p.pLado] ? p.pLado : "");
  if (!p.pName && f.nome) p.pName = txt(f.nome);
  const ortese = {
    scan: f.scan && (f.scan.nome || f.scan.unidade) ? { nome: txt(f.scan.nome), unidade: txt(f.scan.unidade) } : null,
    alinhamento: f.alinhamento || null, planoZ: typeof f.planoZ === "number" ? f.planoZ : null,
    entradas: completarEntradas(f.entradas), edicoes: (f.edicoes || []).map((e) => Object.assign({}, e)),
    earMan: f.earMan ? { r: !!f.earMan.r, l: !!f.earMan.l } : null, analisado: !!f.analisado, gerada: !!f.gerada,
    resultado: f.resultado || null, versoes: (f.versoes || []).map((v) => Object.assign({}, v)), avaliacao: txt(pa["pt-eval"]),
    correcao: false   // a página antiga usava o scan inteiro (sem a correção do pescoço)
  };
  return { formato: FORMATO_FICHA, versaoApp: VERSAO_APP, id: txt(f.id) || "c" + agora.getTime().toString(36), nome: txt(f.nome) || p.pName || p.pId,
    paciente: p, atualizado: f.atualizado || agora.toISOString(), medicoes: [], atual: null, ortese,
    origem: { formato: FORMATO_FICHA_ANTIGA, versaoApp: txt(f.versaoApp) } };
}
// Base antiga → { formato: base da plataforma, fichas convertidas, protocolos }
export function converterBaseAntiga(b, agora = new Date()) {
  if (!ehBaseAntiga(b)) throw new Error("não é uma base da versão antiga do EITA! Crânio");
  const fichas = (b.fichas || []).filter(ehFichaAntiga).map((f) => converterFichaAntiga(f, agora));
  return { formato: FORMATO_BASE, versaoApp: VERSAO_APP, exportado: b.exportado || agora.toISOString(), fichas, protocolos: Object.assign({}, b.protocolos || {}) };
}
// Protocolos (predefinições da órtese): os do arquivo entram, os deste navegador prevalecem nos nomes repetidos
export const mesclarProtocolos = (atuais, novos) => Object.assign({}, novos || {}, atuais || {});

// Idade em meses para a órtese, como a página antiga: meses de calendário entre o nascimento e a avaliação e,
// para prematuros (IG < 37 semanas), a idade corrigida arredondada. → { meses, corrigida | null } ou null
export function idadeEmMeses(nascimento, avaliacao, semanas) {
  if (!nascimento) return null;
  const d0 = new Date(nascimento + "T12:00:00"), d1 = avaliacao ? new Date(avaliacao + "T12:00:00") : new Date();
  if (isNaN(d0) || isNaN(d1)) return null;
  let m = (d1.getFullYear() - d0.getFullYear()) * 12 + d1.getMonth() - d0.getMonth(); if (d1.getDate() < d0.getDate()) m--;
  const ig = parseFloat(semanas);
  const corrigida = ig > 0 && ig < 37 ? Math.max(0, Math.round(m - (40 - ig) * 7 / 30.44)) : null;
  return { meses: m, corrigida };
}
