// Módulo OLHO: regressão contra a v0.2 publicada (mesma detecção, medidas e malhas) e propriedades das malhas.
// © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import E from "../modulos/olho/global.js";
import { executar, PADRAO } from "./apoio/pipeline-olho.mjs";
import { empacotar } from "../ferramentas/montar.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REF = JSON.parse(fs.readFileSync(path.join(AQUI, "referencia", "olho-v0.2.json"), "utf8"));
const R = executar(E);

test("regressão: íris e pupila detectadas, escala e diâmetros iguais aos da v0.2", () => {
  assert.deepEqual(R.foto.iris_px, REF.foto.iris_px); assert.deepEqual(R.foto.pupila_px, REF.foto.pupila_px);
  assert.deepEqual(R.medidas_mm, REF.medidas_mm); assert.equal(R.pIris, REF.pIris); assert.equal(R.pPup, REF.pPup);
  assert.equal(R.altura_max_mapa_mm, REF.altura_max_mapa_mm);
});

test("regressão: esclera e pupila idênticas à v0.2 (STL byte a byte); íris igual à referência do Node", () => {
  assert.deepEqual(R.triangulos, REF.triangulos);
  assert.equal(R.stl["esclera.stl"], REF.stl["esclera.stl"]); assert.equal(R.stl["pupila.stl"], REF.stl["pupila.stl"]);
  assert.equal(R.volume_mm3.esclera, REF.volume_mm3.esclera); assert.equal(R.volume_mm3.pupila, REF.volume_mm3.pupila);
  assert.equal(R.stl["iris.stl"], REF.node.stl["iris.stl"]); assert.equal(R.stl["protese_completa.stl"], REF.node.stl["protese_completa.stl"]);
  assert.ok(Math.abs(R.volume_mm3.iris - REF.volume_mm3.iris) < 1e-4, "íris: diferença de volume só no arredondamento do canvas");
});

test("regressão: o app.js montado dá o mesmo resultado", () => {
  const ctx = { console, Blob, TextEncoder, Response, CompressionStream }; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(empacotar("modulos/olho/global.js"), ctx);
  const r = executar(ctx.EITA);
  assert.deepEqual(r.stl, R.stl); assert.deepEqual(r.volume_mm3, R.volume_mm3);
});

test("malhas: sólidos fechados a 0,00001 mm (cada aresta usada por dois triângulos, em sentidos opostos) e volume positivo", () => {
  for (const [nome, m] of Object.entries(R.malhas)) {
    const P = m.pos, chave = (a) => [0, 1, 2].map((q) => Math.round(a[q] * 1e5) / 1e5 + 0).join(","), conta = new Map();
    for (let t = 0; t < P.length; t += 9) {
      const v = [0, 1, 2].map((q) => chave(P.subarray(t + 3 * q, t + 3 * q + 3)));
      for (let q = 0; q < 3; q++) { const a = v[q] + "|" + v[(q + 1) % 3]; conta.set(a, (conta.get(a) || 0) + 1); }
    }
    let abertas = 0; for (const [a] of conta) { const [x, y] = a.split("|"); if (!conta.has(y + "|" + x)) abertas++; }
    assert.equal(abertas, 0, nome + ": arestas abertas"); assert.ok(m.vol > 0, nome);
  }
});

test("casca: avisos para encaixe fundo e contorno largo demais; maciço fino na borda", () => {
  const O = E.olho, F = { ...PADRAO.forma, protSide: "D" };
  assert.equal(O.verificarCasca(O.geometria(F, 11.7, 4), F).avisos.length, 0);
  const fundo = { ...F, sIns: 1.4 }; assert.match(O.verificarCasca(O.geometria(fundo, 11.7, 4), fundo).avisos.join(" "), /encaixe da íris \(1,4 mm\)/);
  const largo = { ...F, sW: 32, sH: 30 }; assert.match(O.verificarCasca(O.geometria(largo, 11.7, 4), largo).avisos.join(" "), /fecharia sobre si/);
  const fino = { ...F, sMode: "solid", sT: 1.5, sRB: 60 }; assert.match(O.verificarCasca(O.geometria(fino, 11.7, 4), fino).avisos.join(" "), /Na borda a peça fica com/);
});

test("contorno: espelhado entre olho direito e esquerdo", () => {
  const O = E.olho, d = O.contornoRho(360, { ...PADRAO.forma, protSide: "D" }), e = O.contornoRho(360, { ...PADRAO.forma, protSide: "E" });
  for (let i = 0; i < 360; i += 15) assert.ok(Math.abs(d[i] - e[(540 - i) % 360]) < 0.05, "ângulo " + i);
});

test("núcleo: escala por régua, balanço de branco e gaussiano exato", () => {
  assert.equal(E.escalaPorRegua({ x: 0, y: 0 }, { x: 30, y: 40 }, 10), 0.2);
  const px = new Uint8ClampedArray(20 * 20 * 4).map((_, i) => [200, 160, 100, 255][i % 4]);
  const g = E.ganhosBranco(px, 20, 20, 10, 10); assert.deepEqual(g.map((v) => +v.toFixed(3)), [1, 1.25, 2]);
  assert.deepEqual([...E.aplicarGanhos(px, g).slice(0, 4)], [200, 200, 200, 255]);
  const imp = new Float32Array(41 * 41); imp[20 * 41 + 20] = 1;
  const b = E.desfocarGauss(imp, 41, 41, 2); assert.ok(Math.abs(b.reduce((s, v) => s + v, 0) - 1) < 1e-5);
  assert.ok(Math.abs(b[20 * 41 + 22] / b[20 * 41 + 20] - Math.exp(-4 / 8)) < 1e-5, "perfil gaussiano");
});

test("ficha: idade em meses para crianças", () => {
  const hoje = new Date(2026, 10, 10, 12);
  assert.equal(E.idadeTexto("2025-02-20", hoje, { meses: true }), "20 meses");
  assert.equal(E.idadeTexto("2020-10-01", hoje, { meses: true }), "6 anos e 1 mês");
  assert.equal(E.idadeTexto("2020-05-01", hoje, { meses: true }), "6 anos e 6 meses");
  assert.equal(E.idadeTexto("2016-11-01", hoje, { meses: true }), "10 anos");
});
