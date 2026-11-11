#!/usr/bin/env node
/* Grava testes/referencia/afo-v0.14-node.json: o EITA! AFO v0.14 publicado (funções recortadas de legado/afo/index.html)
   rodado no Node, na perna sintética, nos cenários A e B de comparar_afo.py, com os parâmetros da casca gravados na
   referência do Chrome (afo-v0.14.json). Por que existe: o Chrome 153 calcula sin, cos, atan2, exp, pow… com
   resultados que às vezes diferem do Node no último bit, e a casca do próprio AFO publicado muda nos últimos algarismos
   conforme o motor. A malha, o STL e a mudança de referencial vêm do núcleo (iguais ao legado: testes/malha-stl.test.mjs).
   Uso: node ferramentas/referencia_afo_node.mjs
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import fs from "node:fs";
import N from "../modulos/afo/global.js";
import { legadoAFO } from "../testes/apoio/legado-afo.mjs";
import { executar, carregarPerna, CENARIOS, jsonCasca } from "../testes/apoio/pipeline-afo.mjs";

const REF = new URL("../testes/referencia/", import.meta.url);
const CHROME = JSON.parse(fs.readFileSync(new URL("afo-v0.14.json", REF), "utf8"));
const L = legadoAFO();
const legado = Object.assign({}, N, { afo: Object.assign({}, N.afo, L, { deform: (...a) => ({ V: L.deform(...a), invSkipped: L.S.invSkipped }) }) });
const out = { _gerado_com: "EITA! AFO v0.14 publicado (legado/afo, funções puras) no Node " + process.version + ", perna sintética; parâmetros de afo-v0.14.json" };
const perna = carregarPerna();
for (const [nome, correcao] of Object.entries(CENARIOS)) {
  const params = JSON.parse(CHROME[nome + "/casca.json"]).params, r = executar(legado, { params, correcao, perna });
  for (const [arq, h] of Object.entries(r.stl)) out[`${nome}/${arq}`] = h;
  out[`${nome}/casca.json`] = jsonCasca(r.log, params);
  console.log(nome, Object.entries(r.stl).map(([a, h]) => `${a} ${h === CHROME[nome + "/" + a] ? "= Chrome" : "≠ Chrome (último bit)"}`).join("; "));
}
fs.writeFileSync(new URL("afo-v0.14-node.json", REF), JSON.stringify(out, null, 1) + "\n");
