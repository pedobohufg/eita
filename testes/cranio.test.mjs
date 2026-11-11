// EITA! CRÂNIO: mesmos cálculos e classificações da calculadora publicada (legado/cranio) e acompanhamento.
// © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as C from "../modulos/cranio/processamento.js";

// funções da calculadora publicada, executadas a partir do código legado
function legado() {
  const src = fs.readFileSync(new URL("../legado/cranio/index.html", import.meta.url), "utf8");
  const ini = src.indexOf("  function parse(s) {"), fim = src.indexOf("  window.__calc");
  assert.ok(ini > 0 && fim > ini);
  const ctx = {}; vm.runInNewContext(src.slice(src.indexOf("  var SPECS"), src.indexOf("  var CARDS")) + src.slice(ini, fim) + "\nthis.L = { parse, fmt, classify, compute, SPECS };", ctx);
  return ctx.L;
}
const L = legado();

test("cálculo e classificação idênticos à calculadora publicada", () => {
  const casos = [{ a: 148, b: 138, l: 165, w: 138 }, { a: 140, b: 140, l: 150, w: 125 }, { a: 120.4, b: 131.9, l: 140, w: 120 }, { a: 0, b: 130, l: 150, w: 0 }, { a: 160, b: 141, l: 0, w: 0 }];
  for (const m of casos) {
    assert.deepEqual(JSON.parse(JSON.stringify(C.calcular(m))), JSON.parse(JSON.stringify(L.compute(m))));
  }
  for (const [k, ks] of [["cvai", "cvai"], ["cva", "cva"], ["ci", "ci"]]) {
    for (const [a, b] of [["cortes", "cuts"], ["nomes", "names"], ["sev", "sev"]]) assert.deepEqual(C.ESCALAS[k][a], [...L.SPECS[ks][b]]);
    for (let v = C.ESCALAS[k].min - 1; v <= C.ESCALAS[k].max + 1; v += 0.25) assert.equal(C.classificar(C.ESCALAS[k], v), L.classify(L.SPECS[ks], v), `${k} ${v}`);
  }
  for (const s of ["148", "148,5", " 12.25 ", "", "abc", "-3", "1e3"]) assert.ok(Object.is(C.lerNumero(s), L.parse(s)) || (isNaN(C.lerNumero(s)) && isNaN(L.parse(s))), s);
});

test("resumo do exemplo, igual ao da calculadora", () => {
  const m = { a: 148, b: 138, l: 165, w: 138 };
  assert.equal(C.resumo(m), "Diagonal A 148,0 mm | Diagonal B 138,0 mm | Comprimento 165,0 mm | Largura 138,0 mm\nCVA: 10,0 mm (moderada)\nCVAI: 6,8 % (moderada)\nÍndice cefálico: 83,6 (braquicefálico)");
  assert.equal(C.fraseDiagonais(C.calcular(m)), "A diagonal A é a mais longa, por 10,0 mm.");
  assert.equal(C.resumo({}), "Informe as medidas para gerar o resumo.");
});

test("validação: unidade, erro e faixa usual", () => {
  const A = C.MEDIDAS[0];
  assert.deepEqual(C.validar(A, "14,8", "cm"), { mm: 148, estado: "", msg: A.dica });
  assert.equal(C.validar(A, "0", "mm").estado, "err"); assert.ok(isNaN(C.validar(A, "x").mm));
  assert.match(C.validar(A, "30", "mm").msg, /Faixa usual: 80 a 260 mm/);
  assert.match(C.validar(A, "3", "cm").msg, /Faixa usual: 8 a 26 cm/);
});

test("acompanhamento: idade corrigida e evolução", () => {
  assert.equal(C.idadeEmDias("2026-01-01", "2026-03-02"), 60);
  assert.equal(C.idadeCorrigidaDias("2026-01-01", "2026-05-01", "32"), 120 - 56);
  assert.equal(C.idadeCorrigidaDias("2026-01-01", "2026-05-01", "39"), 120, "a termo: sem correção");
  assert.equal(C.idadeTextoDias(130), "4 meses e 8 dias"); assert.equal(C.idadeTextoDias(20), "20 dias"); assert.equal(C.idadeTextoDias(800), "2 anos e 2 meses");
  const e = C.evolucao([{ data: "2026-06-01", mm: { a: 146, b: 140, l: 160, w: 135 } }, { data: "2026-02-01", mm: { a: 148, b: 138, l: 165, w: 138 } }]);
  assert.equal(e.desde, "2026-02-01"); assert.ok(e.cvai < 0 && Math.abs(e.cva - -4) < 1e-9);
  assert.equal(C.evolucao([{ data: "2026-01-01", mm: {} }]), null);
});
