// Testes do gerador de PDF, do layout de relatório e do armazém de fichas (node --test). Etapa E1b.
// © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as N from "../nucleo/index.js";
import * as UI from "../nucleo/interface/index.js";

// gerador original (EITA! MAMILO v0.2 publicado), extraído do código legado para comparação byte a byte
function geradorLegado() {
  const src = fs.readFileSync(new URL("../legado/mamilo-v0.2/app.js", import.meta.url), "utf8");
  const ini = src.indexOf("const CP1252 = {"), fim = src.indexOf("function jpegOf(");
  assert.ok(ini > 0 && fim > ini, "trecho do gerador não encontrado no legado");
  const ctx = {}; vm.runInNewContext(src.slice(ini, fim) + "\nthis.R = { PdfPage, makePDF, pdfW, corta, quebra, pdfEsc };", ctx);
  return ctx.R;
}
function pagina(Classe) {
  const p = new Classe();
  p.rect(0, 792, 595, 50, [0.97, 0.96, 0.99]); p.line(36, 700, 559, 700, [0.88, 0.86, 0.93]);
  p.text(36, 760, 10.5, "Aréola × papila → ≥ 3 mm (teste) \\ “aspas” — ç ã é 🙂", true, [0.42, 0.25, 0.84]);
  p.text(36, 740, 8.8, "Paciente não identificada", false); p.image("Im1", 36, 400, 160, 160);
  return p;
}
const jpegFalso = { name: "Im1", bytes: Uint8Array.from({ length: 300 }, (_, i) => (i * 37) & 255), w: 10, h: 10 };

test("pdf: gerador idêntico ao da v0.2 (texto, acentos, substituições, imagem, várias páginas)", () => {
  const A = geradorLegado();
  const antigo = A.makePDF([pagina(A.PdfPage), pagina(A.PdfPage)], [jpegFalso]);
  const novo = N.montarPDF([pagina(N.PaginaPDF), pagina(N.PaginaPDF)], [jpegFalso]);
  assert.deepEqual(Buffer.from(novo), Buffer.from(antigo));
  for (const [t, s, w] of [["Prontuário 123 — Maria", 9, 60], ["iiiiMMMM", 8.8, 30], ["curto", 9, 300]]) {
    assert.equal(N.larguraTexto(t, s), A.pdfW(t, s)); assert.equal(N.cortarTexto(t, s, w), A.corta(t, s, w));
  }
  const longo = "Radioterapia há menos de 6 meses: avalie a pele e a liberação médica antes do uso do adesivo de grau médico.";
  assert.deepEqual(N.quebrarTexto(longo, 8.6, 200), [...A.quebra(longo, 8.6, 200)]);
});

test("pdf: estrutura válida (xref aponta para os objetos)", () => {
  const u = N.montarPDF([pagina(N.PaginaPDF)], [jpegFalso]), s = Buffer.from(u).toString("latin1");
  assert.ok(s.startsWith("%PDF-1.4") && s.trimEnd().endsWith("%%EOF"));
  const xref = +s.match(/startxref\n(\d+)/)[1]; assert.equal(s.slice(xref, xref + 4), "xref");
  const offs = [...s.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => +m[1]);
  offs.forEach((o, i) => assert.ok(s.startsWith(`${i + 1} 0 obj`, o), "objeto " + (i + 1)));
});

test("pdf: relatório quebra página, repete o cabeçalho de continuação e numera as páginas", () => {
  const R = N.criarRelatorioPDF({ app: ["EITA!", "TESTE"], subtitulo: "Relatório de teste", dataTexto: "10/11/2026 12:00", pacienteTexto: "T01", logo: null });
  R.secao("Paciente"); R.campo(36, 200, "Nome", ""); R.y -= 25;
  const linhas = Array.from({ length: 12 }, (_, i) => ["item " + i, i + " mm"]);
  for (let k = 0; k < 6; k++) R.par("Tabela " + k, linhas, "Outra " + k, linhas.slice(0, 3));
  R.cores("Cores", [["Pele", "#c08a70"]]);
  R.seguranca([{ n: "alerta", t: "Teste de alerta." }, { n: "info", t: "Teste de informação." }]);
  R.avisoFinal("Protótipo de pesquisa.");
  const s = Buffer.from(R.finalizar([])).toString("latin1"), n = R.paginas.length;
  assert.ok(n >= 2, "deveria ter quebrado a página");
  assert.equal((s.match(/\/Type \/Page /g) || []).length, n);
  assert.ok(s.includes(`(p\xe1gina ${n} de ${n})`));
  assert.ok(s.includes("(EITA! TESTE \xb7 T01 \xb7 continua\xe7\xe3o)"));
  assert.ok(R.paginas[0].c.includes("(\x97)"), "campo vazio vira travessão");
  assert.ok(s.includes("(ALERTA)") && s.includes("(Checagem de seguran\xe7a)"));
});

test("ficha: idade, iniciais, código e nome de arquivo", () => {
  const hoje = new Date(2026, 10, 10, 12);
  assert.equal(N.idadeTexto("1980-11-10", hoje), "46 anos"); assert.equal(N.idadeTexto("1980-11-11", hoje), "45 anos");
  assert.equal(N.idadeTexto("2030-01-01", hoje), ""); assert.equal(N.idadeTexto("", hoje), ""); assert.equal(N.idadeTexto("xx", hoje), "");
  assert.equal(N.iniciais("  Ângela  da Conceição Ávila "), "ADCA"); assert.equal(N.codigoPaciente("", "Maria Silva"), "MS"); assert.equal(N.codigoPaciente("P-12", "Maria"), "P-12");
  assert.equal(N.nomeArquivo("João / caso 2"), "Joao_caso_2"); assert.equal(N.escaparHTML('<b a="1">&'), "&lt;b a=&quot;1&quot;&gt;&amp;");
  assert.match(N.novoIdFicha("m"), /^m[0-9a-z]+$/);
});

function armazemDeTeste() {
  const mem = new Map(), arm = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
  return N.criarArmazemFichas({ chave: "teste.fichas", formatoFicha: "EITA! TESTE ficha", formatoBase: "EITA! TESTE base", versaoApp: "0.0", prefixoBase: "base_EITA_TESTE", rotulo: "EITA! TESTE", armazenamento: arm });
}
test("ficha: salvar, substituir, excluir, exportar e importar base", () => {
  const A = armazemDeTeste(), f = (id, dia, nome) => ({ formato: "EITA! TESTE ficha", id, nome, atualizado: `2026-11-${String(dia).padStart(2, "0")}T10:00:00.000Z` });
  assert.deepEqual(A.listar(), []);
  A.salvar(f("a", 1, "A")); A.salvar(f("b", 2, "B")); A.salvar(f("a", 3, "A2"));
  assert.deepEqual(A.listar().map((x) => x.nome), ["B", "A2"]);
  assert.ok(A.ehFicha(f("x", 1)) && !A.ehFicha({ formato: "outro" }) && !A.ehFicha(null));
  const b = A.exportarBase(new Date(2026, 10, 9, 12));
  assert.equal(b.nome, "base_EITA_TESTE_20261109.json");
  const base = JSON.parse(b.conteudo); assert.equal(base.formato, "EITA! TESTE base"); assert.equal(base.fichas.length, 2);
  const B = armazemDeTeste(); B.salvar(f("a", 5, "A mais nova")); B.salvar(f("c", 4, "C"));
  const r = B.importarBase({ formato: "EITA! TESTE base", fichas: [...base.fichas, { formato: "outro", id: "z" }, null] });
  assert.deepEqual(r, { novas: 1, atualizadas: 0 });
  assert.deepEqual(B.listar().map((x) => x.nome), ["A mais nova", "C", "B"]);
  assert.throws(() => B.importarBase({ formato: "EITA! AFO base" }), /não é uma base do EITA! TESTE/);
  B.excluir(1); assert.deepEqual(B.listar().map((x) => x.id), ["a", "b"]);
});

test("vista 3D: matrizes de câmera", () => {
  const I = UI.multiplicar4(UI.perspectiva(0.62, 1.5, 0.5, 1000), UI.olharPara([0, 0, 100], [0, 0, 0], [0, 1, 0]));
  const proj = (p) => { const v = [0, 1, 2, 3].map((r) => I[r] * p[0] + I[4 + r] * p[1] + I[8 + r] * p[2] + I[12 + r]); return v.map((x) => x / v[3]); };
  const c = proj([0, 0, 0]); assert.ok(Math.abs(c[0]) < 1e-6 && Math.abs(c[1]) < 1e-6 && c[2] > -1 && c[2] < 1);
  assert.ok(proj([10, 0, 0])[0] > 0 && proj([0, 10, 0])[1] > 0, "x para a direita, y para cima");
  assert.deepEqual(UI.hexParaRgb("#ff8000").map((v) => +v.toFixed(3)), [1, 0.502, 0]);
});
