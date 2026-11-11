// EITA! CRÂNIO — medidas no plano axial e vistas do scan (modulos/cranio/vistas.js) e ficha unificada / fichas
// antigas (modulos/cranio/fichas.js). A igualdade com a página antiga no navegador está em
// testes/navegador/teste_cranio_scan.py.
// © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";
import * as V from "../modulos/cranio/vistas.js";
import * as FX from "../modulos/cranio/fichas.js";
import * as O from "../modulos/cranio/ortese.js";
import { lerSTL } from "../nucleo/malha.js";

// prisma de seção elíptica (semieixos a em x, b em y), de z0 a z1, com n lados, em triângulos soltos
function prismaEliptico(a, b, z0, z1, n = 720) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * 2 * Math.PI, t1 = ((i + 1) / n) * 2 * Math.PI, p0 = [a * Math.cos(t0), b * Math.sin(t0)], p1 = [a * Math.cos(t1), b * Math.sin(t1)];
    out.push(p0[0], p0[1], z0, p1[0], p1[1], z0, p1[0], p1[1], z1, p0[0], p0[1], z0, p1[0], p1[1], z1, p0[0], p0[1], z1);
  }
  return new Float32Array(out);
}

test("medidas no plano: elipse conhecida (AP, LL, diagonais a 30°, perímetro, área e índices)", () => {
  const a = 60, b = 75, pos = prismaEliptico(a, b, -20, 20), md = V.medidasNoPlano(pos, null, 0.37);
  const r30 = 1 / Math.sqrt((Math.sin(Math.PI / 6) / a) ** 2 + (Math.cos(Math.PI / 6) / b) ** 2);   // raio da elipse a 30° do eixo y
  assert.ok(Math.abs(md.AP - 2 * b) < 0.01 && Math.abs(md.LL - 2 * a) < 0.01, `AP ${md.AP}, LL ${md.LL}`);
  assert.ok(Math.abs(md.D1 - 2 * r30) < 0.05 && Math.abs(md.D2 - 2 * r30) < 0.05, `D1 ${md.D1}, D2 ${md.D2}, esperado ${2 * r30}`);
  assert.ok(md.cva < 1e-6 && md.cvai < 1e-6, "elipse simétrica: CVA e CVAI nulos");
  assert.ok(Math.abs(md.ci - (100 * a) / b) < 0.01, "índice cefálico = LL/AP × 100");
  assert.ok(Math.abs(md.area - Math.PI * a * b) / (Math.PI * a * b) < 1e-3, "área da elipse");
  assert.ok(Math.abs(md.radii.right - a) < 0.01 && Math.abs(md.radii.ant - b) < 0.01, "raios a partir da origem");
  assert.equal(V.medidasNoPlano(pos, null, 50).AP, null, "plano fora da malha: sem medidas");
});

test("medidas no plano: cabeça sintética alinhada pelos 5 pontos (assimetria parieto-occipital D)", () => {
  const cab = JSON.parse(fs.readFileSync(new URL("./fixtures/cabeca_sintetica.json", import.meta.url)));
  const bruto = lerSTL(zlib.gunzipSync(fs.readFileSync(new URL("./fixtures/cabeca_sintetica.stl.gz", import.meta.url))).buffer.slice(0));
  const { pos, centro } = O.prepararScan(bruto, 1), pts = {};
  for (const [k, p] of Object.entries(cab.pontos_mm)) pts[k] = p.map((v, q) => v - centro[q]);
  const al = O.alinharPorPontos(pos, pts), md = V.medidasNoPlano(al.pos, null, al.zRef);
  // achatamento posterior direito: a diagonal D2 (ant. esq. → post. dir.) é a mais curta
  assert.ok(md.D1 > md.D2 + 0.5, `D1 ${md.D1.toFixed(1)} > D2 ${md.D2.toFixed(1)}`);
  assert.ok(md.AP > 140 && md.AP < 170 && md.LL > 120 && md.LL < 150, `AP ${md.AP.toFixed(1)}, LL ${md.LL.toFixed(1)}`);
  assert.ok(md.cvai > 3 && md.cvai < 10, `CVAI ${md.cvai.toFixed(2)} %`);
});

test("vistas: rasterizador ortogonal (fundo, sombreamento, projeção e cores por vértice)", () => {
  const pos = prismaEliptico(30, 40, 0, 50, 90), R = V.rasterizar({ pos }, V.VISTAS.front, { W: 120, H: 120, ss: 2 });
  assert.equal(R.dados.length, 240 * 240 * 4);
  const px = (x, y) => Array.from(R.dados.slice((y * 240 + x) * 4, (y * 240 + x) * 4 + 3));
  assert.deepEqual(px(2, 2), [243, 246, 247], "canto com a cor de fundo");
  assert.notDeepEqual(px(120, 120), [243, 246, 247], "centro com a malha");
  const c = R.proj(0, 0, 25); assert.ok(Math.abs(c[0] - 60) < 1e-6 && Math.abs(c[1] - 60) < 1e-6, "centro da caixa no meio da imagem");
  const col = new Float32Array(pos.length).fill(0); for (let i = 0; i < col.length; i += 3) col[i] = 1;
  const Rc = V.rasterizar({ pos, col }, V.VISTAS.front, { W: 120, H: 120, ss: 2 }), q = (120 * 240 + 120) * 4;
  assert.ok(Rc.dados[q] > 0 && Rc.dados[q + 1] === 0 && Rc.dados[q + 2] === 0, "cor por vértice (vermelho)");
});

test("fichas antigas: ficha e base da versão completa → ficha unificada", () => {
  const antiga = { formato: "EITA! Crânio ficha", versaoApp: "1.0", id: "p-023", nome: "Maria S.", atualizado: "2026-10-01T10:00:00.000Z",
    paciente: { "pt-name": "Maria S.", "pt-id": "P-023", "pt-sex": "Feminino", "pt-birth": "2026-02-10", "pt-eval": "2026-09-30", "pt-ga": "34", "pt-weight": "7.2", "pt-hc": "42", "pt-side": "Bilateral / posterior", "pt-diag": "braquicefalia", "pt-goal": "reduzir IC", "pt-prof": "Dra. X", "pt-notes": "obs" },
    scan: { nome: "maria.stl", unidade: "1000" }, alinhamento: { anterior: [0, 70, 2] }, planoZ: 3.5, entradas: { "cro-indic": "brachy" }, edicoes: [{ kind: "relief", th: 10, ph: 5, radiusMm: 25, mm: 3, label: "E1" }],
    earMan: { r: true, l: false }, analisado: true, gerada: false, resultado: null, versoes: [{ rotulo: "V1", data: "2026-09-30T10:00:00.000Z", entradas: {}, edicoes: [] }] };
  const f = FX.converterFichaAntiga(antiga);
  assert.equal(f.formato, "EITA! CRÂNIO ficha"); assert.equal(f.versaoApp, FX.VERSAO_APP); assert.equal(f.id, "p-023"); assert.equal(f.atualizado, antiga.atualizado);
  assert.deepEqual(f.paciente, { pName: "Maria S.", pId: "P-023", pBirth: "2026-02-10", pSex: "F", pGest: "34", pDiag: "braquicefalia", pProf: "Dra. X", pNotes: "obs", pPeso: "7.2", pPC: "42", pLado: "B", pObj: "reduzir IC" });
  assert.deepEqual(f.medicoes, []);
  assert.deepEqual(f.ortese.scan, { nome: "maria.stl", unidade: "1000" }); assert.equal(f.ortese.planoZ, 3.5); assert.equal(f.ortese.avaliacao, "2026-09-30");
  assert.equal(f.ortese.edicoes.length, 1); assert.deepEqual(f.ortese.earMan, { r: true, l: false }); assert.equal(f.ortese.versoes.length, 1);
  assert.deepEqual(f.origem, { formato: "EITA! Crânio ficha", versaoApp: "1.0" });
  assert.notEqual(f.ortese.edicoes[0], antiga.edicoes[0], "cópia, não a mesma referência");
  const b = FX.converterBaseAntiga({ formato: "EITA! Crânio base", exportado: "2026-10-02T00:00:00.000Z", fichas: [antiga, { formato: "outra" }], protocolos: { A: { "cro-c0": "2" } } });
  assert.equal(b.formato, "EITA! CRÂNIO base"); assert.equal(b.fichas.length, 1); assert.deepEqual(b.protocolos, { A: { "cro-c0": "2" } });
  assert.deepEqual(FX.mesclarProtocolos({ A: { x: 1 } }, { A: { x: 2 }, B: { y: 1 } }), { A: { x: 1 }, B: { y: 1 } }, "os protocolos deste navegador prevalecem");
  assert.throws(() => FX.converterFichaAntiga({ formato: "EITA! CRÂNIO ficha" }));
});

test("idade em meses para a órtese (como a página antiga: meses de calendário; corrigida em prematuros)", () => {
  assert.deepEqual(FX.idadeEmMeses("2026-03-15", "2026-09-14", ""), { meses: 5, corrigida: null });
  assert.deepEqual(FX.idadeEmMeses("2026-03-15", "2026-09-15", "39"), { meses: 6, corrigida: null });
  assert.deepEqual(FX.idadeEmMeses("2026-03-15", "2026-09-15", "32"), { meses: 6, corrigida: Math.round(6 - (8 * 7) / 30.44) });
  assert.equal(FX.idadeEmMeses("", "2026-09-15", ""), null);
});

test("unidade provável do STL pelo tamanho (cabeça de ~10 a ~40 cm)", () => {
  const cab = prismaEliptico(60, 75, 0, 160, 36);
  assert.equal(V.unidadeProvavel(cab), "1");
  assert.equal(V.unidadeProvavel(cab.map((v) => v / 10)), "10");
  assert.equal(V.unidadeProvavel(cab.map((v) => v / 1000)), "1000");
  assert.equal(V.unidadeProvavel(cab.map((v) => v * 100)), null);
});
