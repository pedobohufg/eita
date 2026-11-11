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
  assert.ok(Math.abs(md.largura - 2 * a) < 0.01 && Math.abs(md.ciTransversal - (100 * a) / b) < 0.01, "largura transversal e IC por ela");
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
  // campos criados na E3c-4: numa ficha antiga completa, valem os equivalentes ao comportamento antigo
  assert.deepEqual(FX.completarEntradas({ "cro-type": "band", "cro-bandtop": "60" }), { "cro-type": "band", "cro-bandtop": "60", "cro-bandtop-back": "60", "cro-hole-zone": "all", "cro-front-arc": "0" });
  assert.deepEqual(FX.completarEntradas({ "cro-indic": "brachy" }), { "cro-indic": "brachy" }, "sem os campos da casca: fica o padrão da página");
  assert.equal(f.ortese.entradas["cro-bandtop-back"], undefined, "a ficha de teste não tem cro-type");
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

test("assimetria por altura: acha o nível de maior CVAI (cabeça sintética, achatamento acima do plano)", () => {
  const cab = JSON.parse(fs.readFileSync(new URL("./fixtures/cabeca_sintetica.json", import.meta.url)));
  const bruto = lerSTL(zlib.gunzipSync(fs.readFileSync(new URL("./fixtures/cabeca_sintetica.stl.gz", import.meta.url))).buffer.slice(0));
  const { pos, centro } = O.prepararScan(bruto, 1), pts = {};
  for (const [k, p] of Object.entries(cab.pontos_mm)) pts[k] = p.map((v, q) => v - centro[q]);
  const al = O.alinharPorPontos(pos, pts), pf = V.perfilDeAssimetria(al.pos, null, al.zRef, { de: -10, ate: 50, passo: 5 });
  assert.ok(pf.niveis.length >= 8 && pf.referencia, `${pf.niveis.length} níveis`);
  assert.ok(pf.maior.cvai >= pf.referencia.cvai && pf.niveis.every((n) => n.cvai <= pf.maior.cvai));
  assert.ok(Math.abs(pf.referencia.cvai - V.medidasNoPlano(al.pos, null, al.zRef).cvai) < 1e-9, "o nível 0 é o plano de referência");
  // prisma elíptico: simétrico, CVAI ~0 em todas as alturas; níveis fora da malha ficam de fora
  const pr = V.perfilDeAssimetria(prismaEliptico(60, 75, -15, 15), null, 0, { de: -30, ate: 30, passo: 10 });
  assert.deepEqual(pr.niveis.map((n) => n.dz), [-10, 0, 10]); assert.ok(pr.maior.cvai < 1e-6);
});

test("pontos automáticos (E3c-4): cabeça sintética em posição qualquer → eixos do alinhamento a poucos graus dos verdadeiros", async () => {
  const P = await import("../modulos/cranio/pontos.js");
  const cab = JSON.parse(fs.readFileSync(new URL("./fixtures/cabeca_sintetica.json", import.meta.url)));
  const bruto = lerSTL(zlib.gunzipSync(fs.readFileSync(new URL("./fixtures/cabeca_sintetica.stl.gz", import.meta.url))).buffer.slice(0));
  // gira e desloca o scan (e muda a ordem dos vértices de metade dos triângulos: a normal do corte vem invertida)
  const ang = [0.5, -0.3, 2.2], R = (v) => { let [x, y, z] = v; [y, z] = [y * Math.cos(ang[0]) - z * Math.sin(ang[0]), y * Math.sin(ang[0]) + z * Math.cos(ang[0])]; [x, z] = [x * Math.cos(ang[1]) + z * Math.sin(ang[1]), -x * Math.sin(ang[1]) + z * Math.cos(ang[1])]; [x, y] = [x * Math.cos(ang[2]) - y * Math.sin(ang[2]), x * Math.sin(ang[2]) + y * Math.cos(ang[2])]; return [x + 30, y - 12, z + 400]; };
  const mov = new Float32Array(bruto.length);
  for (let t = 0; t < bruto.length; t += 9) { const ordem = (t / 9) % 2 ? [0, 6, 3] : [0, 3, 6]; ordem.forEach((o, i) => mov.set(R([bruto[t + o], bruto[t + o + 1], bruto[t + o + 2]]), t + i * 3)); }
  const prep = O.prepararScan(mov, 1), r = P.detectarPontos(prep.pos);
  assert.ok(r, "achou os pontos");
  const ref = {}; for (const [k, p] of Object.entries(cab.pontos_mm)) ref[k] = R(p).map((v, q) => v - prep.centro[q]);
  const a1 = O.alinharPorPontos(prep.pos, r.pontos), a2 = O.alinharPorPontos(prep.pos, ref);
  for (let c = 0; c < 3; c++) { const u = [0, 1, 2].map((q) => a1.rotacao[c + q * 4]), v = [0, 1, 2].map((q) => a2.rotacao[c + q * 4]); const g = Math.acos(Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2])) / O.GRAU; assert.ok(g < 4, `eixo ${"xyz"[c]}: ${g.toFixed(1)}°`); }
  assert.ok(Math.hypot(...r.pontos.vertex.map((v, q) => v - ref.vertex[q])) < 10, "vértice");
  assert.ok(Math.hypot(...r.pontos.posterior.map((v, q) => v - ref.posterior[q])) < 12, "opistocrânio");
});

test("correção do pescoço (E3c-4): tira o corte plano e as abas soltas", async () => {
  const P = await import("../modulos/cranio/pontos.js");
  const cab = JSON.parse(fs.readFileSync(new URL("./fixtures/cabeca_sintetica.json", import.meta.url)));
  const bruto = lerSTL(zlib.gunzipSync(fs.readFileSync(new URL("./fixtures/cabeca_sintetica.stl.gz", import.meta.url))).buffer.slice(0));
  const { pos, centro } = O.prepararScan(bruto, 1), pts = {}; for (const [k, p] of Object.entries(cab.pontos_mm)) pts[k] = p.map((v, q) => v - centro[q]);
  const al = O.alinharPorPontos(pos, pts), sc = P.semCortePlano(al.pos);
  assert.ok(sc && sc.removidos > 100 && sc.pos.length < al.pos.length, "a tampa plana do pescoço sai");
  // aba solta acrescentada atrás da cabeça, 25 mm fora da calota: sai; o resto fica
  const an = O.analisar(al.pos, al.zRef), r0 = O.amostrarGrade(an.rho, 180, 10) + 25, aba = [];
  for (let i = 0; i < 20; i++) { const th = (175 + i * 0.5) * O.GRAU, ph = 10 * O.GRAU, th2 = th + 0.5 * O.GRAU; const P1 = [r0 * Math.cos(ph) * Math.sin(th), r0 * Math.cos(ph) * Math.cos(th), al.zRef + r0 * Math.sin(ph)], P2 = [r0 * Math.cos(ph) * Math.sin(th2), r0 * Math.cos(ph) * Math.cos(th2), al.zRef + r0 * Math.sin(ph)], P3 = [P1[0], P1[1], P1[2] + 3]; aba.push(...P1, ...P2, ...P3); }
  const comAba = new Float32Array(al.pos.length + aba.length); comAba.set(al.pos); comAba.set(aba, al.pos.length);
  const sa = P.semAbas(comAba, al.zRef, { analise: an });
  assert.equal(sa.removidos, 20); assert.equal(sa.pos.length, al.pos.length);
  assert.equal(P.semCortePlano(new Float32Array(9 * 0)), null);
});
