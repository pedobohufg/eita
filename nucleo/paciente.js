/* EITA núcleo · paciente — ficha única do paciente (formato "EITA paciente v1") e base única ("EITA base v1").
   Puro: roda no navegador e no Node; quem chama lê e grava o armazenamento.

   Desenho (etapa E3): cada paciente tem os dados comuns (nome, código, nascimento, sexo, profissional,
   alergias, observações) e a lista das suas próteses. Cada prótese é um vínculo com a ficha completa
   que continua guardada pelo próprio módulo (AFO, OLHO, MAMILO), com os pontos, parâmetros e resultados.
   O portal sincroniza: liga cada ficha de módulo a um paciente (pelo código/prontuário ou por nome +
   nascimento) e cria o paciente quando não há correspondente.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import { novoIdFicha } from "./ficha.js";

export const FORMATO_PACIENTE = "EITA paciente v1";
export const FORMATO_BASE = "EITA base v1";
export const CHAVE_PACIENTES = "eita.pacientes.v1";

// módulos conhecidos: onde guardam as fichas e como se chamam os arquivos
export const MODULOS = Object.freeze({
  afo: { nome: "EITA! AFO", peca: "órtese tornozelo-pé (AFO)", chave: "eitaAFO.fichas.v1", formatoFicha: "EITA! AFO ficha", formatoBase: "EITA! AFO base", pagina: "afo/index.html", externo: "https://claude.ai/artifact/Kod5SXvjeJGGCfs4jzWwxr" },
  olho: { nome: "EITA! OLHO", peca: "prótese ocular", chave: "eitaOLHO.fichas.v1", formatoFicha: "EITA! OLHO ficha", formatoBase: "EITA! OLHO base", pagina: "olho/index.html" },
  mamilo: { nome: "EITA! MAMILO", peca: "prótese de aréola e papila", chave: "eitaMAMILO.fichas.v1", formatoFicha: "EITA! MAMILO ficha", formatoBase: "EITA! MAMILO base", pagina: "mamilo/index.html" },
  cranio: { nome: "EITA! CRÂNIO", peca: "avaliação craniana e órtese", chave: "eitaCRANIO.fichas.v1", formatoFicha: "EITA! CRÂNIO ficha", formatoBase: "EITA! CRÂNIO base", pagina: "cranio/index.html" },
  "nariz-orelha": { nome: "EITA! NARIZ·ORELHA", peca: "prótese nasal ou auricular", chave: "eitaNARIZORELHA.fichas.v1", formatoFicha: "EITA! NARIZ·ORELHA ficha", formatoBase: "EITA! NARIZ·ORELHA base", pagina: "nariz-orelha/index.html" },
});
export const CHAVE_CALIBRACAO_AFO = "eitaAFO.calib.v1";
export const CAMPOS = ["nome", "codigo", "nascimento", "sexo", "profissional", "alergias", "observacoes"];

const txt = (v) => (v == null ? "" : String(v).trim());
export const normalizarTexto = (s) => txt(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ");
const vazio = () => Object.fromEntries(CAMPOS.map((c) => [c, ""]));

// ------------------------------------------------------------------ fichas dos módulos
// dados comuns do paciente numa ficha de módulo (todos usam os ids pName, pId, pBirth… da página)
export function dadosDaFicha(f) {
  const p = (f && f.paciente) || {};
  return { nome: txt(p.pName || f.nome), codigo: txt(p.pId), nascimento: txt(p.pBirth), sexo: txt(p.pSex), profissional: txt(p.pProf), alergias: txt(p.pAlerg), observacoes: "" };
}
// lado e arquivo de origem de uma ficha, para a lista de próteses
export function resumoProtese(modulo, f) {
  if (modulo === "cranio") {   // avaliação, não peça: em vez de lado e arquivo, o número de medições e a última data (e o scan da órtese, desde a E3c-3)
    const md = (f.medicoes || []).map((x) => x.data).filter(Boolean).sort(), n = md.length, sc = f.ortese && f.ortese.scan && txt(f.ortese.scan.nome);
    const med = n ? `${n} medição${n > 1 ? "ões" : ""}, a última em ${md[n - 1].split("-").reverse().join("/")}` : "sem medições";
    return { modulo, fichaId: f.id, peca: MODULOS.cranio.peca, lado: "", atualizado: f.atualizado || "", arquivo: sc ? `${med} · órtese (${sc})` : med, nome: txt(f.nome) };
  }
  if (modulo === "nariz-orelha") {   // (E5) a peça depende do tipo; o arquivo é o scan
    const peca = f.tipo === "nariz" ? "prótese nasal" : f.tipo === "orelha" ? "prótese auricular" : MODULOS[modulo].peca;
    return { modulo, fichaId: f.id, peca, lado: f.tipo === "orelha" && (f.lado === "D" || f.lado === "E") ? f.lado : "", atualizado: f.atualizado || "", arquivo: txt(f.scan && f.scan.nome), nome: txt(f.nome) };
  }
  const lado = modulo === "afo" ? f.lado : modulo === "olho" ? f.olho : (f.lados && f.lados.protese) || (f.paciente && f.paciente.pLado);
  const arquivo = modulo === "afo" ? f.scan : modulo === "olho" ? f.foto && f.foto.nome : f.foto && f.foto.arquivo;
  return { modulo, fichaId: f.id, peca: MODULOS[modulo].peca, lado: lado === "D" || lado === "E" ? lado : "", atualizado: f.atualizado || "", arquivo: txt(arquivo), nome: txt(f.nome) };
}

// ------------------------------------------------------------------ pacientes
export function novoPaciente(dados = {}, agora = new Date()) {
  const d = vazio(); for (const c of CAMPOS) if (dados[c] != null) d[c] = txt(dados[c]);
  const t = agora.toISOString();
  return { formato: FORMATO_PACIENTE, id: novoIdFicha("p"), criado: t, atualizado: t, dados: d, proteses: [] };
}
export const ehPaciente = (p) => !!p && p.formato === FORMATO_PACIENTE && typeof p.id === "string";
// mesmo paciente? o código (prontuário) decide quando os dois têm; senão, nome + nascimento (os dois preenchidos)
export function mesmoPaciente(a, b) {
  const ca = normalizarTexto(a.codigo), cb = normalizarTexto(b.codigo);
  if (ca && cb) return ca === cb;
  if (a.nome && b.nome && a.nascimento && b.nascimento) return normalizarTexto(a.nome) === normalizarTexto(b.nome) && a.nascimento === b.nascimento;
  return false;
}
// completa só os campos vazios; devolve true se mudou algo
function completar(destino, origem) { let mudou = false; for (const c of CAMPOS) if (!destino[c] && origem[c]) { destino[c] = origem[c]; mudou = true; } return mudou; }
const chaveVinculo = (v) => v.modulo + ":" + v.fichaId;

// Liga as fichas dos módulos aos pacientes. fichas = { afo: [...], olho: [...], mamilo: [...] }.
// pendentes = [{ pacienteId, modulo, desde }]: o portal abriu aquele módulo para aquele paciente; uma ficha
// nova desse módulo, salva depois de "desde", vai para esse paciente mesmo sem código nem nascimento.
// → { pacientes (nova lista), criados, vinculadas, removidas, pendentesUsados }
export function sincronizar(pacientes, fichas, agora = new Date(), pendentes = []) {
  const P = pacientes.filter(ehPaciente).map((p) => ({ ...p, dados: { ...vazio(), ...p.dados }, proteses: (p.proteses || []).map((v) => ({ ...v })) }));
  const existe = new Map(); for (const m of Object.keys(MODULOS)) for (const f of fichas[m] || []) if (f && f.formato === MODULOS[m].formatoFicha) existe.set(m + ":" + f.id, { m, f });
  let removidas = 0, vinculadas = 0, criados = 0; const ligadas = new Set(), t = agora.toISOString();
  for (const p of P) {
    const antes = p.proteses.length;
    p.proteses = p.proteses.filter((v) => existe.has(chaveVinculo(v)) && !ligadas.has(chaveVinculo(v)));
    p.proteses.forEach((v) => ligadas.add(chaveVinculo(v)));
    if (p.proteses.length !== antes) { removidas += antes - p.proteses.length; p.atualizado = t; }
    for (const v of p.proteses) if (completar(p.dados, dadosDaFicha(existe.get(chaveVinculo(v)).f))) p.atualizado = t;
  }
  // fichas ainda sem paciente, da mais antiga para a mais nova (o paciente nasce com os dados da primeira)
  const soltas = [...existe.entries()].filter(([k]) => !ligadas.has(k)).map(([, x]) => x).sort((a, b) => String(a.f.atualizado).localeCompare(String(b.f.atualizado)));
  const usados = [];
  for (const { m, f } of soltas) {
    const d = dadosDaFicha(f);
    const pend = pendentes.find((x) => x.modulo === m && String(f.atualizado) >= String(x.desde) && P.some((q) => q.id === x.pacienteId) && !usados.includes(x));
    if (pend) usados.push(pend);
    let p = pend ? P.find((q) => q.id === pend.pacienteId) : P.find((q) => mesmoPaciente(q.dados, d));
    if (!p) { p = novoPaciente(d, agora); P.push(p); criados++; }
    else completar(p.dados, d);
    p.proteses.push({ modulo: m, fichaId: f.id }); p.atualizado = t; vinculadas++;
  }
  return { pacientes: P, criados, vinculadas, removidas, pendentesUsados: usados };
}
// próteses de um paciente, com o resumo de cada ficha (mais recente primeiro)
export function protesesDoPaciente(p, fichas) {
  const out = [];
  for (const v of p.proteses || []) { const f = (fichas[v.modulo] || []).find((x) => x.id === v.fichaId); if (f) out.push(resumoProtese(v.modulo, f)); }
  return out.sort((a, b) => String(b.atualizado).localeCompare(String(a.atualizado)));
}
// junta o paciente "sai" no "fica" (próteses e campos vazios); devolve a nova lista
export function juntarPacientes(pacientes, idFica, idSai, agora = new Date()) {
  const fica = pacientes.find((p) => p.id === idFica), sai = pacientes.find((p) => p.id === idSai);
  if (!fica || !sai || fica === sai) return pacientes;
  const novo = { ...fica, dados: { ...fica.dados }, proteses: [...fica.proteses], atualizado: agora.toISOString() };
  completar(novo.dados, sai.dados);
  if (sai.dados.observacoes && novo.dados.observacoes !== sai.dados.observacoes) novo.dados.observacoes = [novo.dados.observacoes, sai.dados.observacoes].filter(Boolean).join("\n");
  for (const v of sai.proteses) if (!novo.proteses.some((w) => chaveVinculo(w) === chaveVinculo(v))) novo.proteses.push(v);
  return pacientes.filter((p) => p !== sai).map((p) => (p === fica ? novo : p));
}
// pacientes cujo nome ou código contém o texto (sem acentos, sem maiúsculas)
export function buscarPacientes(pacientes, texto) {
  const q = normalizarTexto(texto); if (!q) return pacientes;
  return pacientes.filter((p) => normalizarTexto(p.dados.nome).includes(q) || normalizarTexto(p.dados.codigo).includes(q));
}
export const ordenarPacientes = (pacientes) => [...pacientes].sort((a, b) => normalizarTexto(a.dados.nome || a.dados.codigo).localeCompare(normalizarTexto(b.dados.nome || b.dados.codigo), "pt-BR"));

// ------------------------------------------------------------------ base única e bases antigas
export function montarBase({ pacientes, fichas, calibracaoAFO = [] }, agora = new Date()) {
  return { formato: FORMATO_BASE, exportado: agora.toISOString(), pacientes, fichas: Object.fromEntries(Object.keys(MODULOS).map((m) => [m, fichas[m] || []])), calibracaoAFO };
}
// Lê qualquer arquivo de base ou ficha do Lab.EITA → { tipo, pacientes, fichas, calibracaoAFO }.
// Aceita: base única; bases do AFO, OLHO e MAMILO; fichas avulsas dos três módulos.
export function lerArquivoEITA(o) {
  const vazio_ = { pacientes: [], fichas: {}, calibracaoAFO: [] };
  if (!o || typeof o !== "object") throw new Error("o arquivo não é um JSON do Lab.EITA");
  if (o.formato === FORMATO_BASE) return { tipo: "base única", pacientes: (o.pacientes || []).filter(ehPaciente), fichas: o.fichas || {}, calibracaoAFO: o.calibracaoAFO || [] };
  if (o.formato === FORMATO_PACIENTE) return { ...vazio_, tipo: "paciente", pacientes: [o] };
  for (const [m, M] of Object.entries(MODULOS)) {
    if (o.formato === M.formatoBase) return { ...vazio_, tipo: "base do " + M.nome, fichas: { [m]: o.fichas || [] }, calibracaoAFO: m === "afo" ? o.calibracao || [] : [] };
    if (o.formato === M.formatoFicha) return { ...vazio_, tipo: "ficha do " + M.nome, fichas: { [m]: [o] } };
  }
  throw new Error("formato não reconhecido" + (o.formato ? ` ("${o.formato}")` : ""));
}
// mescla fichas de um módulo: fica a versão mais recente de cada id; ordem: mais recente primeiro
export function mesclarFichas(atual, novas, formatoFicha) {
  const m = new Map(atual.map((f) => [f.id, f])); let n = 0, a = 0;
  for (const f of novas || []) { if (!f || f.formato !== formatoFicha) continue; const x = m.get(f.id); if (!x) { m.set(f.id, f); n++; } else if (new Date(f.atualizado) > new Date(x.atualizado)) { m.set(f.id, f); a++; } }
  return { lista: [...m.values()].sort((x, y) => new Date(y.atualizado) - new Date(x.atualizado)), novas: n, atualizadas: a };
}
// mescla pacientes: fica o registro mais recente de cada id, com a união das próteses
export function mesclarPacientes(atual, novos) {
  const m = new Map(atual.map((p) => [p.id, p])); let n = 0, a = 0;
  for (const p of novos || []) {
    if (!ehPaciente(p)) continue; const x = m.get(p.id);
    if (!x) { m.set(p.id, p); n++; continue; }
    const recente = new Date(p.atualizado) > new Date(x.atualizado) ? p : x, outro = recente === p ? x : p;
    const proteses = [...recente.proteses]; for (const v of outro.proteses) if (!proteses.some((w) => chaveVinculo(w) === chaveVinculo(v))) proteses.push(v);
    m.set(p.id, { ...recente, proteses }); if (recente === p) a++;
  }
  return { lista: [...m.values()], novos: n, atualizados: a };
}
// medições de bancada do AFO: mesma regra do EITA! AFO (mesma data e mesmo EI = repetida)
export function mesclarCalibracaoAFO(atual, novas) {
  const l = [...atual]; let n = 0;
  for (const u of novas || []) if (!l.some((x) => x.data === u.data && x.EI === u.EI)) { l.push(u); n++; }
  return { lista: l, novas: n };
}
