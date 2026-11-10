// Módulo MAMILO: regressão (resultados idênticos à v0.2) e precisão contra as fantomas sintéticas.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import E from "../modulos/mamilo/global.js";
import { resumoCompleto, frontal, lateral, malhas } from "./apoio/pipeline-mamilo.mjs";
import { empacotar } from "../ferramentas/montar.mjs";
import { verificarFechada } from "../nucleo/malha.js";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REF = JSON.parse(fs.readFileSync(path.join(AQUI, "referencia", "mamilo-v0.2.json"), "utf8"));
delete REF._gerado_com;

test("regressão: módulos ES dão exatamente o mesmo resultado da v0.2 (inclusive os STL, byte a byte)", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(resumoCompleto(E))), REF);
});

test("regressão: o app.js montado também dá o mesmo resultado", () => {
  const ctx = { console, Blob, TextEncoder, Response, CompressionStream };
  ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(empacotar("modulos/mamilo/global.js"), ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(resumoCompleto(ctx.EITA))), REF);
});

test("precisão: aréola, papila e ângulo nas fantomas frontais", () => {
  for (const n of ["claro_A", "escuro", "cor_quente_v2_anel_cinza"]) {
    const F = frontal(E, n), v = F.verdade, r = F.resumo;
    assert.ok(Math.abs(r.k - v.px_por_mm) / v.px_por_mm < 0.01, `${n}: escala`);
    assert.ok(Math.abs(r.areola_maior_mm - v.areola_eixo_maior_mm) < 0.3, `${n}: eixo maior ${r.areola_maior_mm}`);
    assert.ok(Math.abs(r.areola_menor_mm - v.areola_eixo_menor_mm) < 0.3, `${n}: eixo menor ${r.areola_menor_mm}`);
    assert.ok(Math.abs(r.papila_mm - v.papila_diam_mm) < 0.3, `${n}: papila ${r.papila_mm}`);
    const dAng = Math.abs(((r.angulo_graus - v.angulo_graus) % 180 + 270) % 180 - 90);
    assert.ok(dAng < 1.5 || Math.abs(r.angulo_graus - v.angulo_graus) < 1.5, `${n}: ângulo ${r.angulo_graus}`);
    assert.equal(r.ref, "anel cinza");
  }
});

test("precisão: projeção da papila na foto lateral", () => {
  const L = lateral(E, "lateral_0");
  assert.ok(Math.abs(L.resumo.projecao_mm - L.verdade.projecao_mm) < 0.2, "projeção " + L.resumo.projecao_mm);
  assert.deepEqual(L.resumo.avisos, []);
});

test("malhas: prótese, molde frontal e contramolde são sólidos fechados", () => {
  const F = frontal(E, "claro_A"), L = lateral(E, "lateral_0");
  const { X } = malhas(E, F, L.L, 0.4);
  for (const [nome, m] of Object.entries(X.malhas)) assert.ok(verificarFechada(m).fechada, nome);
  assert.ok(X.volume_ml > 0.5 && X.volume_ml < 5);
});
