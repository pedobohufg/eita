// Módulo AFO: regressão no Node contra o EITA! AFO v0.14 publicado. A casca gerada pelo cálculo puro
// (modulos/afo/anatomia.js e casca.js) tem de dar os mesmos STL, byte a byte, e o mesmo log que o código publicado rodado
// no Node (testes/referencia/afo-v0.14-node.json, de ferramentas/referencia_afo_node.mjs). Contra o Chrome
// (afo-v0.14.json) a perna sai idêntica e a casca só pode diferir no último bit (o Chrome 153 calcula sin/cos/exp/pow
// de outro jeito); a igualdade com o navegador é conferida por testes/navegador/comparar_afo.py.
// Se um Node novo mudar a matemática, este teste acusa: regenerar a referência do Node e conferir no navegador.
// Também: o texto do Worker roda e dá a mesma casca.
// © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import E from "../modulos/afo/global.js";
import { executar, carregarPerna, CENARIOS, jsonCasca } from "./apoio/pipeline-afo.mjs";

const REF = JSON.parse(fs.readFileSync(new URL("referencia/afo-v0.14.json", import.meta.url), "utf8"));
const NODE = JSON.parse(fs.readFileSync(new URL("referencia/afo-v0.14-node.json", import.meta.url), "utf8"));
const perna = carregarPerna();
const R = {};

for (const [nome, correcao] of Object.entries(CENARIOS)) {
  test(`regressão ${nome}: STL da AFO (3 orientações) e da perna idênticos ao AFO v0.14 no Node`, () => {
    const params = JSON.parse(REF[nome + "/casca.json"]).params;
    const r = (R[nome] = executar(E, { params, correcao, perna }));
    for (const [arq, h] of Object.entries(r.stl)) assert.equal(h, NODE[`${nome}/${arq}`], `${nome}/${arq}`);
    assert.equal(r.stl["perna.stl"], REF[nome + "/perna.stl"], "perna igual à do Chrome");
    assert.equal(jsonCasca(r.log, params), NODE[nome + "/casca.json"], "log da casca");
    assert.equal(r.log.check, 0); assert.equal(r.log.tris, 73976);
  });
}

test("cenário B: correção aplicada sem pular a inversão; perna deslocada", () => {
  const r = R.B || executar(E, { params: JSON.parse(REF["B/casca.json"]).params, correcao: CENARIOS.B, perna });
  assert.equal(r.S.invSkipped, false); assert.equal(r.S.corrected, true);
  const m = E.afo.medir(r.S.L, r.S.frame);
  assert.ok(Math.abs(m.sag - 95) < 1.5, "ângulo perna-pé " + m.sag); assert.ok(Math.abs(m.inv - 3) < 1.5, "inversão " + m.inv);
});

test("Worker: o texto montado por textoDoWorker() gera a mesma casca", async () => {
  const r = R.A || executar(E, { params: JSON.parse(REF["A/casca.json"]).params, perna });
  const A = E.afo, xf = A.paraAnatomico(r.S.frame), n = r.S.V.length / 3, anat = new Float64Array(r.S.V.length);
  for (let j = 0; j < n; j++) { const q = xf([r.S.V[j * 3], r.S.V[j * 3 + 1], r.S.V[j * 3 + 2]]); anat.set(q, j * 3); }
  const pts = {}; for (const k in r.S.L) pts[k] = xf(r.S.L[k]);
  const P = Object.assign(JSON.parse(REF["A/casca.json"]).params, { selfCheck: true });
  // roda o texto num contexto isolado, como o Worker (sem nada da página)
  let resposta = null;
  const ctx = vm.createContext({ performance, self: { postMessage: (m) => (resposta = m) } });
  vm.runInContext(A.textoDoWorker(), ctx);
  ctx.self.onmessage({ data: { id: 1, A: anat, F: r.S.F, L: pts, P } });
  assert.ok(resposta && !resposta.err, resposta && resposta.err);
  const direto = A.gerarCasca(anat, r.S.F, pts, Object.assign({}, P));
  assert.deepEqual([...resposta.R.shell.F], [...direto.shell.F]);
  assert.deepEqual([...resposta.R.shell.V], [...direto.shell.V]);
  // a lista do Worker cobre tudo que generateShell usa
  for (const f of A.FUNCOES_DO_WORKER) assert.equal(typeof f, "function");
});

test("vista: o alvo da câmera cai no centro da tela; câmera olha para o alvo; mul4 em precisão dupla", () => {
  const A = E.afo, cam = { target: [10, -5, 30], dist: 400, yaw: 0.6, pitch: 0.15, fov: 35 / A.GRAU, basis: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] };
  const v = A.vetoresCamera(cam);
  assert.ok(Math.abs(A.V3.len(A.V3.sub(v.eye, cam.target)) - 400) < 1e-9);
  assert.ok(A.V3.dot(A.V3.norm(A.V3.sub(cam.target, v.eye)), v.f) > 1 - 1e-12);
  const m = A.matrizesCamera(cam, 1200, 800), [x, y] = A.projetar(cam.target, m, 1200, 800);
  assert.ok(Math.abs(x - 600) < 1e-6 && Math.abs(y - 400) < 1e-6, `${x}, ${y}`);
  assert.ok(Array.isArray(m.mvp) && m.mvp.length === 16);
  // ponto acima do alvo (eixo Z da base) aparece mais alto na tela
  assert.ok(A.projetar([10, -5, 60], m, 1200, 800)[1] < 400);
});
