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

test("pigmentação: cores por zona perto das cores reais da fantoma", async () => {
  const { perfilCorRadial } = await import("../modulos/mamilo/pigmentacao.js");
  const F = frontal(E, "claro_A"), P = perfilCorRadial(F.im, F.seg);
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // comparação com a paleta da v0.2, medida na mesma imagem calibrada
  const pal = F.resumo.paleta;
  assert.ok(dist(rgb(P.zonas.papila), rgb(pal.papila)) < 12, "papila " + P.zonas.papila);
  assert.ok(dist(rgb(P.zonas.areola_borda), rgb(pal.areola)) < 12, "aréola " + P.zonas.areola_borda);
  assert.ok(dist(rgb(P.zonas.base), rgb(pal.pele)) < 12, "pele " + P.zonas.base);
  assert.equal(P.faixas.length, 8); assert.ok(P.faixas.every((f) => /^#[0-9a-f]{6}$/.test(f.cor)));
});

test("pigmentação: máscara de pintura é sólido fechado, assenta no molde e fica fora da aréola", async () => {
  const { mascaraPintura } = await import("../modulos/mamilo/pigmentacao.js");
  const F = frontal(E, "claro_A"), L = lateral(E, "lateral_0");
  const p = { ...E.PARAMETROS, resolucao_mm: 0.2, textura_papila: { ...E.PARAMETROS.textura_papila } };
  for (const espelhar of [false, true]) {
    const G = E.geometria(F.im, F.seg, F.k, { ...p, espelhar }, L.L, null);
    const m = mascaraPintura(G, { ...p, espelhar });
    assert.ok(verificarFechada(m.malha).fechada, "fechada");
    // nenhum vértice da máscara dentro da aréola (rho < 1 − meio passo de grade)
    const { V } = m.malha, dx = G.xs[1] - G.xs[0], tol = dx / Math.min(G.a, G.b);
    for (let v = 0; v < V.length; v += 3) {
      const i = Math.round((V[v] - G.xs[0]) / dx), j = Math.round((V[v + 1] - G.xs[0]) / dx);
      assert.ok(G.rho[j * G.n + i] >= 1 - tol, "vértice dentro da aréola");
    }
    const dv = new DataView(m.arquivo); assert.equal(dv.getUint32(80, true), m.malha.F.length / 3);
  }
});
