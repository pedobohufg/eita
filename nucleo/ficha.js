/* EITA núcleo · ficha — ficha do paciente e base do laboratório guardadas no navegador.
   Puro (o armazenamento é injetável): roda no navegador e no Node. Os dados nunca saem do navegador;
   a base é trocada entre computadores por arquivo .json exportado/importado.
   A ficha única da plataforma ("EITA ficha v1", etapa E3) será construída sobre este armazém.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */

export const escaparHTML = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const semAcentos = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "");

// idade a partir de "AAAA-MM-DD" ("" se a data for inválida ou futura): anos completos, ou, com meses = true,
// "N meses" até 2 anos e "N anos e M meses" depois (crianças: prótese ocular)
export function idadeTexto(d, agora = new Date(), { meses = false } = {}) {
  if (!d) return ""; const e = new Date(d + "T12:00:00"), n = agora; if (isNaN(e)) return "";
  let m = (n.getFullYear() - e.getFullYear()) * 12 + n.getMonth() - e.getMonth(); if (n.getDate() < e.getDate()) m--;
  if (m < 0) return "";
  if (!meses) return Math.floor(m / 12) + " anos";
  if (m < 24) return m + " meses";
  return Math.floor(m / 12) + " anos" + (m % 12 ? " e " + (m % 12) + " " + (m % 12 > 1 ? "meses" : "mês") : "");
}
// iniciais do nome (até 5 letras), para nomes de arquivo sem o nome completo
export const iniciais = (nome) => (nome ? semAcentos(nome).split(/\s+/).filter(Boolean).map((p) => p[0].toUpperCase()).join("").slice(0, 5) : "");
// código do paciente: prontuário/código, ou as iniciais do nome
export const codigoPaciente = (id, nome) => (id ? id : iniciais(nome));
// texto seguro para nome de arquivo (sem acentos; só letras, números, _ . -)
export const nomeArquivo = (t) => semAcentos(t).replace(/[^\w.-]+/g, "_");
export const novoIdFicha = (prefixo = "f") => prefixo + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const dataCompacta = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

// Armazém de fichas de um app. formatoFicha/formatoBase identificam os arquivos; rotulo aparece nas mensagens.
// nomeBase(agora) dá o nome do arquivo da base (padrão: prefixoBase_AAAAMMDD.json); sem versaoApp, o campo não é gravado.
export function criarArmazemFichas({ chave, formatoFicha, formatoBase, versaoApp, prefixoBase, rotulo, armazenamento, nomeBase }) {
  const arm = () => armazenamento || globalThis.localStorage;
  const listar = () => { try { return JSON.parse(arm().getItem(chave) || "[]"); } catch (e) { return []; } };
  const gravar = (l) => { try { arm().setItem(chave, JSON.stringify(l)); return true; } catch (e) { return false; } };
  return {
    formatoFicha, formatoBase, listar, gravar,
    ehFicha: (f) => !!f && f.formato === formatoFicha,
    // insere no topo ou substitui a de mesmo id; devolve true se gravou
    salvar(f) { const l = listar(), i = l.findIndex((x) => x.id === f.id); if (i >= 0) l[i] = f; else l.unshift(f); return gravar(l); },
    excluir(indice) { const l = listar(); l.splice(indice, 1); return gravar(l); },
    // arquivo da base completa: { nome, conteudo }
    exportarBase(agora = new Date()) {
      return { nome: nomeBase ? nomeBase(agora) : `${prefixoBase}_${dataCompacta(agora)}.json`, conteudo: JSON.stringify({ formato: formatoBase, versaoApp, exportado: agora.toISOString(), fichas: listar() }) };
    },
    // mescla uma base exportada (objeto já lido do JSON): fica a versão mais recente de cada ficha
    importarBase(b) {
      if (!b || b.formato !== formatoBase) throw new Error("o arquivo não é uma base do " + rotulo);
      const m = new Map(listar().map((f) => [f.id, f])); let novas = 0, atualizadas = 0;
      for (const f of b.fichas || []) { if (!f || f.formato !== formatoFicha) continue; const x = m.get(f.id); if (!x) { m.set(f.id, f); novas++; } else if (new Date(f.atualizado) > new Date(x.atualizado)) { m.set(f.id, f); atualizadas++; } }
      const gravou = gravar([...m.values()].sort((a, c) => new Date(c.atualizado) - new Date(a.atualizado)));
      return { novas, atualizadas, gravou };
    }
  };
}
