// Alinhamento do núcleo (nucleo/alinhamento.js): mesmos números que as funções do EITA! AFO v0.14 publicado
// (jacobiEig, fitSim, compose, applyT recortadas de legado/afo/index.html) e propriedades básicas.
// © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados.
import test from "node:test";
import assert from "node:assert/strict";
import * as N from "../nucleo/index.js";
import { legadoAFO } from "./apoio/legado-afo.mjs";

const L = legadoAFO();
let semente = 7;
const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647) * 2 - 1;
const pontos = (n, k = 50) => Array.from({ length: n }, () => [rnd() * k, rnd() * k, rnd() * k]);

test("alinhamento: autovalores e ajuste idênticos ao AFO v0.14", () => {
  for (let caso = 0; caso < 20; caso++) {
    const M = Array.from({ length: 4 }, () => Array(4).fill(0));
    for (let i = 0; i < 4; i++) for (let j = i; j < 4; j++) M[i][j] = M[j][i] = rnd() * 10;
    const a = N.autovaloresSimetrica(M), b = L.jacobiEig(M);
    assert.deepEqual([a.valores, a.vetores], [b.val, b.vec]);
    const P = pontos(30), Q = P.map((p) => [p[0] * 1.1 + rnd(), p[2] - 3 + rnd(), -p[1] + 5 + rnd()]);
    for (const escala of [false, true]) {
      const x = N.ajustarSimilaridade(P, Q, escala), y = L.fitSim(P, Q, escala);
      assert.deepEqual(x, y);
      const T2 = N.comporTransformacoes(x, x);
      assert.deepEqual(T2, L.compose(y, y));
      assert.deepEqual(N.aplicarTransformacao(T2, P[0]), L.applyT(L.compose(y, y), P[0]));
    }
  }
});

test("alinhamento: recupera rotação, escala e translação conhecidas", () => {
  const c = Math.cos(0.7), s = Math.sin(0.7), R = [[c, -s, 0], [s, c, 0], [0, 0, 1]], T = { R, s: 1.1, t: [4, -2, 9] };
  const P = pontos(40), Q = P.map((p) => N.aplicarTransformacao(T, p));
  const x = N.ajustarSimilaridade(P, Q, true);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) assert.ok(Math.abs(x.R[i][j] - R[i][j]) < 1e-9);
  assert.ok(Math.abs(x.s - 1.1) < 1e-9);
  for (const p of P.slice(0, 5)) { const d = N.aplicarTransformacao(x, p), e = N.aplicarTransformacao(T, p); assert.ok(Math.hypot(d[0] - e[0], d[1] - e[1], d[2] - e[2]) < 1e-9); }
  // escala fora de 0,8–1,25 não é aceita
  assert.equal(N.ajustarSimilaridade(P, P.map((p) => p.map((v) => v * 2)), true).s, 1);
});
