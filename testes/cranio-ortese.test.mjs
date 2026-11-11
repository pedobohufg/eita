// EITA! CRÂNIO · órtese (E3c-2): o cálculo puro de modulos/cranio/ortese.js dá exatamente as saídas do window.CROCore do
// EITA! Crânio "UI v8" (legado/cranio-ortese) rodado no Node — grades, análise, orelhas, linha de corte, cores, mapa,
// casca e STL — nos três cenários de testes/navegador/comparar_cranio.py, na cabeça sintética. Contra a referência do
// Chrome (testes/referencia/cranio-ortese-ui8.json) tudo é igual, menos as folgas médias da casca (stats.gap), que podem
// diferir no último bit (o Chrome soma/arredonda outra coisa no motor; ver docs/E3c-CRANIO.md, E3c-1).
// Também: crescimento pela curva OMS igual ao da página antiga, e alinhamento pelos 5 pontos (conferido bit a bit
// com o three.js r128 na E3c-2; aqui, pela invariância a rotação e translação do scan).
// © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as O from "../modulos/cranio/ortese.js";
import { legadoCROCore, comoCROCore, carregarCabeca, coletar, htmlLegado, CENARIOS } from "./apoio/pipeline-cranio.mjs";

const REF = JSON.parse(fs.readFileSync(new URL("referencia/cranio-ortese-ui8.json", import.meta.url), "utf8"));
const { pos, meta } = carregarCabeca();
const NOVO = coletar(comoCROCore(O), pos, meta.zRef);

test("órtese: saídas idênticas às do CROCore do legado no Node (3 cenários)", () => {
  const L = coletar(legadoCROCore(), pos, meta.zRef);
  assert.deepEqual(Object.keys(NOVO), Object.keys(L));
  for (const k of Object.keys(L)) assert.equal(NOVO[k], L[k], k);
  for (const c of ["A", "B", "C"]) assert.ok(!NOVO[c + "/erro"], c);
});

test("órtese: igual à referência do Chrome (folgas médias até o último bit)", () => {
  const chaves = Object.keys(REF).filter((k) => k[0] !== "_");
  assert.deepEqual(Object.keys(NOVO).sort(), chaves.sort());
  for (const k of chaves) {
    if (!k.endsWith("/casca.json")) { assert.equal(NOVO[k], REF[k], k); continue; }
    const a = JSON.parse(NOVO[k]), b = JSON.parse(REF[k]);
    for (const z of ["contact", "neutral", "relief"]) assert.ok(Math.abs(a.gap[z] - b.gap[z]) <= 1e-12 * Math.abs(b.gap[z]), `${k} gap.${z}`);
    a.gap = b.gap; assert.deepEqual(a, b, k);
  }
  // o que a cabeça sintética tem: alívio no parieto-occipital D, casca fechada sem defeitos
  const an = JSON.parse(NOVO["A/analise.json"]), A1 = an.peaks.find((p) => p.label === "A1"), st = JSON.parse(NOVO["A/casca.json"]);
  assert.match(A1.region, /parieto-occipital D/); assert.ok(A1.mag < -5);
  assert.deepEqual(st.mesh, { pinch: 0, dropped: 0 });
});

test("órtese: STL pelo núcleo com o cabeçalho antigo", () => {
  const an = O.analisar(pos, meta.zRef), g = O.gerarOrtese(an, meta.zRef, CENARIOS.C.P, pos);
  const buf = O.stlDaOrtese(g.tris), dv = new DataView(buf);
  assert.equal(new TextDecoder().decode(new Uint8Array(buf, 0, 17)), "Lab.EITA CRO (mm)"); assert.equal(new Uint8Array(buf, 17, 63).every((b) => b === 0), true);
  assert.equal(dv.getUint32(80, true), g.stats.triangles); assert.equal(buf.byteLength, 84 + 50 * g.stats.triangles);
});

test("crescimento pela curva OMS: o mesmo valor que o campo da página antiga recebia", () => {
  const html = htmlLegado(), a = html.indexOf("  const HC_M = ["), b = html.indexOf("  function syncGrowth()");
  const L = new Function(html.slice(a, b) + "\nconst fN = (n, d) => Number.isFinite(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d }) : '—';\nreturn { hcAt, fN };")();
  for (let idade = 0; idade <= 26; idade += 0.5) {
    assert.equal(O.perimetroCefalicoOMS(idade), L.hcAt(idade), "idade " + idade);
    for (const m of [1, 2, 3, 4, 5, 6, 8, 12]) {
      const c = O.crescimentoPelaIdade(idade, m);
      if (!(idade > 0)) { assert.equal(c, null); continue; }
      const dC = L.hcAt(idade + m) - L.hcAt(idade), g = dC * 10 / (2 * Math.PI);
      assert.equal(c.cm, dC); assert.equal(c.raioMm, g);
      assert.equal(c.taxa, parseFloat(L.fN(g / m, 2).replace(",", ".")), `idade ${idade}, ${m} meses`);
    }
  }
  assert.equal(O.crescimentoPelaIdade(5, 0), null);
});

// rotação (ângulos em rad, ordem XYZ) + translação, em float64
function moverRigido(p, [ax, ay, az], t, escala = 1) {
  const [ca, sa, cb, sb, cc, sc] = [Math.cos(ax), Math.sin(ax), Math.cos(ay), Math.sin(ay), Math.cos(az), Math.sin(az)];
  const R = [[cb * cc, -cb * sc, sb], [ca * sc + sa * sb * cc, ca * cc - sa * sb * sc, -sa * cb], [sa * sc - ca * sb * cc, sa * cc + ca * sb * sc, ca * cb]];
  return [0, 1, 2].map((i) => (R[i][0] * p[0] + R[i][1] * p[1] + R[i][2] * p[2] + t[i]) * escala);
}

test("alinhamento pelos 5 pontos: o mesmo modelo, qualquer que seja a posição e a unidade do scan", () => {
  const ref = O.alinharPorPontos(pos, meta.pontos_mm);
  // eixos: glabela e opistocrânio na linha média (x = 0) e simétricos em y; vértice acima do meio dos eúrios
  const pa = O.pontoAlinhado(ref, meta.pontos_mm.anterior), pp = O.pontoAlinhado(ref, meta.pontos_mm.posterior);
  assert.ok(Math.abs(pa[0]) < 1e-9 && Math.abs(pp[0]) < 1e-9 && Math.abs(pa[1] + pp[1]) < 1e-9 && pa[1] > 0);
  const pv = O.pontoAlinhado(ref, meta.pontos_mm.vertex), pl = O.pontoAlinhado(ref, meta.pontos_mm.left), pr = O.pontoAlinhado(ref, meta.pontos_mm.right);
  assert.ok(Math.abs(pv[0] - (pl[0] + pr[0]) / 2) < 1e-9 && Math.abs(pv[1] - (pl[1] + pr[1]) / 2) < 1e-9 && pr[0] > 0);
  assert.ok(Math.abs(ref.zRef - (pa[2] + pp[2]) / 2) < 1e-9);
  // o mesmo scan girado, deslocado e em metros
  const ang = [0.3, -0.5, 1.1], t = [20, -110, 350], s = new Float32Array(pos.length);
  for (let k = 0; k < pos.length; k += 3) s.set(moverRigido([pos[k], pos[k + 1], pos[k + 2]], ang, t, 0.001), k);
  const prep = O.prepararScan(s, O.UNIDADES_STL.m), cx = O.caixaEnvolvente(prep.pos);
  for (let q = 0; q < 3; q++) assert.ok(Math.abs(cx.min[q] + cx.max[q]) < 1e-3, "centrado");
  const pts = Object.fromEntries(Object.entries(meta.pontos_mm).map(([k, p]) => [k, moverRigido(p, ang, t, 0.001).map((v, q) => v * 1000 - prep.centro[q])]));
  const al = O.alinharPorPontos(prep.pos, pts);
  let erro = 0; for (let k = 0; k < pos.length; k++) erro = Math.max(erro, Math.abs(al.pos[k] - ref.pos[k]));
  assert.ok(erro < 2e-3, "erro máximo " + erro + " mm"); assert.ok(Math.abs(al.zRef - ref.zRef) < 1e-3);
  assert.equal(O.alinharPorPontos(pos, { anterior: [0, 1, 0] }), null);
  // a análise do modelo alinhado acha o achatamento parieto-occipital direito
  const an = O.analisar(al.pos, al.zRef), A1 = an.peaks.find((p) => p.label === "A1");
  assert.match(A1.region, /parieto-occipital D/); assert.ok(Math.abs(an.ic - O.analisar(pos, meta.zRef).ic) < 0.02);   // o alinhamento inclina ~5° (E3c-2) e a largura transversal depende do referencial
});

test("índice cefálico pela largura transversal (E3c-4): paralelogramo não vira braquicefalia", () => {
  // grade sintética: elipse 75 × 60 mm (IC 0,80) cisalhada em x (plagiocefalia em paralelogramo)
  const { NT, NP, dT } = O.GRADE, rs = new Float32Array(NT * NP);
  const raio = (t, k) => { const d = [Math.sin(t), Math.cos(t)]; let lo = 0, hi = 200; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2, x = m * d[0], y = m * d[1], xs = x - k * y; (xs / 60) ** 2 + (y / 75) ** 2 > 1 ? (hi = m) : (lo = m); } return lo; };
  for (const [k, legadoMaior] of [[0, false], [0.3, true]]) {
    for (let ip = 0; ip < NP; ip++) for (let it = 0; it < NT; it++) rs[ip * NT + it] = raio(it * dT * O.GRAU, k);
    const novo = O.indiceCefalico(rs, null), velho = O.indiceCefalico(rs, null, true);
    const W = 2 * Math.hypot(60, k * 75);   // extensão em x da elipse cisalhada (x = 60 cos u + k·75 sen u)
    assert.ok(Math.abs(novo.w - W) < 0.3 && Math.abs(novo.l - 150) < 0.3, `transversal ${novo.w} × ${novo.l}`);
    if (legadoMaior) assert.ok(velho.w > novo.w + 2, `a corda oblíqua mede mais que a largura (${velho.w} × ${novo.w})`);
  }
});

test("estilo do laboratório (E3c-4): topo inclinado, fenda lateral única e furos só na frente e atrás", () => {
  const an = O.analisar(pos, meta.zRef), base = Object.assign({}, CENARIOS.A.P, { type: "band", bandTop: 40, bandTopBack: 70, split: "lateralL", gap: 2, holeZone: "ap", holeArc: 45, cheek: "off", mast: "off" });
  const g = O.gerarOrtese(an, meta.zRef, base, pos), T = g.tris;
  assert.deepEqual(g.stats.mesh, { pinch: 0, dropped: 0 });
  // borda superior: mais baixa na frente que atrás
  const topo = (az) => { let m = -90; for (let k = 0; k < T.length; k += 3) { const x = T[k], y = T[k + 1], z = T[k + 2] - meta.zRef, th = ((Math.atan2(x, y) / O.GRAU) + 360) % 360; if (O.diferencaAzimute(th, az) < 3) m = Math.max(m, Math.asin(z / Math.hypot(x, y, z)) / O.GRAU); } return m; };
  assert.ok(topo(0) < 46 && topo(180) > 64, `topo frente ${topo(0).toFixed(1)}°, atrás ${topo(180).toFixed(1)}°`);
  // fenda só do lado E: nenhum ponto da casca a menos de 0,9 mm do plano da fenda no lado E (x < 0), e há material do lado D
  let naFenda = 0, ladoD = 0;
  for (let k = 0; k < T.length; k += 3) { if (T[k] < -20 && Math.abs(T[k + 1]) < 0.9) naFenda++; if (T[k] > 20 && Math.abs(T[k + 1]) < 0.9) ladoD++; }
  assert.equal(naFenda, 0); assert.ok(ladoD > 0);
  // furos dos dois lados (frente D e frente E têm a mesma quantidade de aberturas, a menos de uma fileira)
  const furosLado = (sinal) => { const ref = O.gerarOrtese(an, meta.zRef, Object.assign({}, base, { holeD: 0 }), pos).stats.volume_cm3; return ref; };
  const semFuros = furosLado(), comFuros = g.stats.volume_cm3;
  assert.ok(semFuros - comFuros > 1, "os furos tiram material");
  const contar = (T2, s) => { let n = 0; for (let k = 0; k < T2.length; k += 9) { const x = (T2[k] + T2[k + 3] + T2[k + 6]) / 3, y = (T2[k + 1] + T2[k + 4] + T2[k + 7]) / 3; if (Math.sign(x) === s && y > 30) n++; } return n; };
  const d = contar(T, 1), e = contar(T, -1);
  assert.ok(Math.abs(d - e) / Math.max(d, e) < 0.15, `triângulos na frente D ${d} × E ${e} (os furos refinam a malha dos dois lados)`);
  // com topo igual na frente e atrás, a casca é a mesma de antes (bandTopBack ignorado)
  const igual = (P2) => O.stlDaOrtese(O.gerarOrtese(an, meta.zRef, P2, pos).tris);
  assert.deepEqual(igual(Object.assign({}, CENARIOS.A.P, { type: "band", bandTop: 55, bandTopBack: 55 })), igual(Object.assign({}, CENARIOS.A.P, { type: "band", bandTop: 55 })));
});
