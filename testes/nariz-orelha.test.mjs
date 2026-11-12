// EITA! NARIZ·ORELHA (E5) e as partes novas do núcleo: volume (campo de distância + marching cubes), decimar,
// superfície (leitura de OBJ/PLY, furos, ponto mais próximo). Rosto sintético: ferramentas/rosto_sintetico.mjs.
// © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";
import * as N from "../nucleo/index.js";
import * as P from "../modulos/nariz-orelha/processamento.js";

// gênero de uma malha fechada (número de "furos passantes"), por componente
function topologia(m) {
  const E = new Set();
  for (let t = 0; t < m.F.length; t += 3) for (let k = 0; k < 3; k++) { const a = m.F[t + k], b = m.F[t + (k + 1) % 3]; E.add(a < b ? a * 4294967296 + b : b * 4294967296 + a); }
  const comp = N.filtrarComponentes(m.V, m.F, 0).componentes, chi = m.V.length / 3 - E.size + m.F.length / 3;
  return { componentes: comp, genero: (2 * comp - chi) / 2 };
}
// todo vértice com um só leque de triângulos (variedade)
function variedade(m) {
  const nv = m.V.length / 3, fv = Array.from({ length: nv }, () => []);
  for (let t = 0; t < m.F.length; t += 3) for (let k = 0; k < 3; k++) fv[m.F[t + k]].push(t);
  let ruins = 0;
  for (let v = 0; v < nv; v++) {
    if (!fv[v].length) continue;
    const prox = new Map(); for (const t of fv[v]) { const i = [m.F[t], m.F[t + 1], m.F[t + 2]], k = i.indexOf(v); prox.set(i[(k + 1) % 3], i[(k + 2) % 3]); }
    let ciclos = 0; const vis = new Set();
    for (const a of prox.keys()) { if (vis.has(a)) continue; ciclos++; let x = a; while (x !== undefined && !vis.has(x)) { vis.add(x); x = prox.get(x); } }
    if (ciclos > 1 || prox.size !== fv[v].length) ruins++;
  }
  return ruins;
}
function rosto(caso) {
  const info = JSON.parse(fs.readFileSync(new URL(`./fixtures/${caso}.json`, import.meta.url)));
  const b = zlib.gunzipSync(fs.readFileSync(new URL(`./fixtures/${caso}.stl.gz`, import.meta.url)));
  const m = N.soldar(N.lerSTL(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)));
  const f = N.fecharFuros(m, 40);
  return { info, malha: { V: f.V, F: f.F }, furos: f.fechados };
}

test("marching cubes: superfície fechada, orientada para fora e variedade, também em campo aleatório", () => {
  const g = N.criarGrade([-12, -12, -12], [12, 12, 12], 0.5);
  N.preencherGrade(g, (x, y, z) => Math.hypot(x, y, z) - 10);
  const m = N.extrairSuperficie(g);
  assert.ok(N.verificarFechada(m).fechada);
  assert.ok(Math.abs(N.volume(m) / ((4 / 3) * Math.PI * 1000) - 1) < 0.005, "volume da esfera");
  assert.deepEqual(topologia(m), { componentes: 1, genero: 0 });
  for (let s0 = 1; s0 < 25; s0++) {
    const r = N.criarGrade([0, 0, 0], [6, 6, 6], 1); let s = s0;
    N.preencherGrade(r, () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; });
    const a = N.extrairSuperficie(r);
    assert.ok(N.verificarFechada(a).fechada, "fechada " + s0);
    assert.ok(N.volume(a) > 0, "orientada " + s0);
    assert.equal(variedade(a), 0, "variedade " + s0);
  }
});

test("campo de malha: distância exata perto da superfície, dentro/fora certo, furo reparado", () => {
  const g0 = N.criarGrade([-12, -12, -12], [12, 12, 12], 0.4); N.preencherGrade(g0, (x, y, z) => Math.hypot(x, y, z) - 10);
  const esf = N.extrairSuperficie(g0);
  const g = N.criarGrade([-13, -13, -13], [13, 13, 13], 0.5);
  N.campoDeMalha(g, N.triangulosNaCaixa(esf, [-20, -20, -20], [20, 20, 20]), { banda: 3, final: "livre" });
  let erro = 0, sinal = 0;
  N.preencherGrade(N.gradeVazia(g), (x, y, z, i, j, k) => { const c = i + g.nx * (j + g.ny * k), e = Math.hypot(x, y, z) - 10; if (Math.abs(e) < 2.5) erro = Math.max(erro, Math.abs(e - g.f[c])); if (Math.abs(e) > 0.05 && Math.sign(e) !== Math.sign(g.f[c])) sinal++; return 0; });
  assert.ok(erro < 0.05, "erro " + erro);
  assert.equal(sinal, 0);
  // calota aberta com furo (scan): o lado de dentro continua certo
  const F = [];
  for (let t = 0; t < esf.F.length; t += 3) {
    const c = [0, 1, 2].map((q) => (esf.V[esf.F[t] * 3 + q] + esf.V[esf.F[t + 1] * 3 + q] + esf.V[esf.F[t + 2] * 3 + q]) / 3);
    if (c[2] > 0 && Math.hypot(c[0] - 3, c[1]) > 2) F.push(esf.F[t], esf.F[t + 1], esf.F[t + 2]);
  }
  const g2 = N.criarGrade([-8, -8, -2], [8, 8, 13], 0.5);
  const r = N.campoDeMalha(g2, N.triangulosNaCaixa({ V: esf.V, F: new Uint32Array(F) }, [-20, -20, -20], [20, 20, 20]), { banda: 3, final: "dentro" });
  assert.ok(r.reparadas > 0);
  let ruins = 0;
  N.preencherGrade(N.gradeVazia(g2), (x, y, z, i, j, k) => { const c = i + g2.nx * (j + g2.ny * k), e = Math.hypot(x, y, z) - 10; if (z > 2 && Math.abs(e) > 0.3 && Math.sign(e) !== Math.sign(g2.f[c])) ruins++; return 0; });
  assert.ok(ruins < 20, "células com sinal errado: " + ruins);
});

test("decimar: malha fechada, desvio dentro da tolerância e muito menos triângulos nas faces planas", () => {
  const fn = (x, y, z) => Math.max(Math.max(Math.abs(x) - 25, Math.abs(y) - 25, Math.abs(z) - 15), -(Math.hypot(Math.hypot(x, y) - 12, z) - 5));
  const g = N.criarGrade([-30, -30, -20], [30, 30, 20], 0.5); N.preencherGrade(g, fn);
  const m = N.extrairSuperficie(g), d = N.decimar(m, { tolerancia: 0.02 });
  assert.ok(N.verificarFechada(d).fechada);
  assert.equal(variedade(d), 0);
  assert.deepEqual(topologia(d), topologia(m));
  assert.ok(d.F.length < m.F.length / 5, `${d.F.length / 3} de ${m.F.length / 3}`);
  let mx = 0; for (let i = 0; i < d.V.length; i += 3) mx = Math.max(mx, Math.abs(fn(d.V[i], d.V[i + 1], d.V[i + 2])));
  assert.ok(mx < 0.03, "desvio " + mx);
  assert.ok(Math.abs(N.volume(d) - N.volume(m)) / N.volume(m) < 0.001);
});

test("leitura de OBJ e PLY (texto e binário), furos e distância 2D", () => {
  const cubo = { V: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1], Q: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]] };
  const obj = cubo.V.reduce((s, _, i) => (i % 3 ? s : s + `v ${cubo.V[i]} ${cubo.V[i + 1]} ${cubo.V[i + 2]}\n`), "") + cubo.Q.map((q) => "f " + q.map((i) => i + 1).join(" ")).join("\n");
  const a = N.soldar(N.lerOBJ(new TextEncoder().encode(obj).buffer));
  assert.ok(N.verificarFechada(a).fechada); assert.ok(Math.abs(N.volume(a) - 1) < 1e-9);
  const cab = (f) => `ply\nformat ${f} 1.0\nelement vertex 8\nproperty float x\nproperty float y\nproperty float z\nelement face 6\nproperty list uchar int vertex_indices\nend_header\n`;
  const ply = cab("ascii") + cubo.V.reduce((s, _, i) => (i % 3 ? s : s + `${cubo.V[i]} ${cubo.V[i + 1]} ${cubo.V[i + 2]}\n`), "") + cubo.Q.map((q) => "4 " + q.join(" ")).join("\n");
  assert.ok(Math.abs(N.volume(N.soldar(N.lerPLY(new TextEncoder().encode(ply).buffer))) - 1) < 1e-9);
  const h = new TextEncoder().encode(cab("binary_little_endian")), bin = new ArrayBuffer(h.length + 8 * 12 + 6 * 17), u8 = new Uint8Array(bin), dv = new DataView(bin);
  u8.set(h); let o = h.length;
  for (const v of cubo.V) { dv.setFloat32(o, v, true); o += 4; }
  for (const q of cubo.Q) { dv.setUint8(o++, 4); for (const i of q) { dv.setInt32(o, i, true); o += 4; } }
  assert.ok(Math.abs(N.volume(N.soldar(N.lerMalha("cubo.ply", bin))) - 1) < 1e-9);
  // furo: tira uma face do cubo (2 triângulos) e fecha
  const s = N.soldar(N.lerOBJ(new TextEncoder().encode(obj).buffer)), sem = { V: s.V, F: s.F.slice(6) };
  assert.ok(!N.verificarFechada(sem).fechada);
  const f = N.fecharFuros(sem, 10); assert.equal(f.fechados, 1); assert.ok(N.verificarFechada(f).fechada); assert.ok(Math.abs(N.volume(f) - 1) < 1e-9);
  // distância 2D da máscara ≈ distância ao disco
  const nx = 61, mask = new Uint8Array(nx * nx); for (let j = 0; j < nx; j++) for (let i = 0; i < nx; i++) mask[i + nx * j] = Math.hypot(i - 30, j - 30) <= 15 ? 1 : 0;
  const d = N.distanciaMascara2D(mask, nx, nx, 0.5);
  for (const [i, j] of [[30, 30], [50, 30], [30, 55], [40, 40]]) assert.ok(Math.abs(d[i + nx * j] - (Math.hypot(i - 30, j - 30) - 15) * 0.5) < 0.6, `${i},${j}`);
  assert.ok(Math.abs(N.distanciaPoligono(0, 0, [[-1, -1], [1, -1], [1, 1], [-1, 1]]) + 1) < 1e-12);
});

test("plano sagital: pontos e refinamento pela simetria (de 6° e 4 mm de erro para menos de 0,05° e 0,05 mm)", () => {
  for (const caso of ["rosto_sem_orelha", "rosto_sem_nariz"]) {
    const { info, malha } = rosto(caso);
    const p0 = P.planoSagital(info.pontos);
    assert.ok(Math.abs(p0.n[0] - 1) < 1e-6 && Math.abs(p0.d) < 0.01, caso);
    const a = (6 * Math.PI) / 180, pert = { n: [Math.cos(a), Math.sin(a) * 0.6, -Math.sin(a) * 0.8], d: -4 };
    const excl = caso === "rosto_sem_orelha" ? [{ c: [78, 8, -9], r: 45 }] : [{ c: info.pontos.sn, r: 35 }];
    const r = P.refinarPlano(malha, pert, { centro: info.pontos.n, raio: 120, excluir: excl });
    assert.ok(Math.acos(Math.min(1, Math.abs(r.plano.n[0]))) * 180 / Math.PI < 0.05, caso + " ângulo");
    assert.ok(Math.abs(r.plano.d) < 0.05, caso + " posição " + r.plano.d);
    assert.ok(r.residuo < 0.1);
  }
});

test("orelha: espelho da sadia, prótese fechada e maciça, aba, molde de 3 partes separáveis", async () => {
  const { info, malha, furos } = rosto("rosto_sem_orelha");
  assert.equal(furos, 1, "o furo de scan atrás da hélice é fechado");
  const plano = P.planoSagital(info.pontos);
  const pr = await P.gerarProtese({ tipo: "orelha", lado: "D", malha, pontos: info.pontos, plano, contorno: info.contornoOrelhaEsquerda });
  const m = pr.medidas;
  assert.ok(m.fechada); assert.equal(variedade(pr.malha), 0);
  assert.deepEqual(topologia(pr.malha), { componentes: 1, genero: 0 });
  assert.ok(m.altura > 60 && m.altura < 75, "altura " + m.altura);       // orelha sintética: 62 mm + aba
  assert.ok(m.projecao > 15 && m.projecao < 22, "projeção " + m.projecao);
  assert.ok(m.volume > 7 && m.volume < 15, "volume " + m.volume);
  assert.ok(Math.abs(m.degrauContorno) < 1, "rosto simétrico: sem degrau no contorno");
  assert.ok(!m.limiteGrade);
  assert.equal(pr.avisos.filter((a) => a.n === "alerta").length, 0);
  // a orelha espelhada fica onde estaria a direita: x ≈ −70
  const naCena = P.malhaParaScan(pr.malha, pr.R); let cx = 0; for (let i = 0; i < naCena.V.length; i += 3) cx += naCena.V[i]; cx /= naCena.V.length / 3;
  assert.ok(cx < -65 && cx > -90, "lado " + cx);
  const mo = await P.gerarMolde(pr, {});
  assert.deepEqual(mo.pecas.map((p) => p.nome), ["base", "externa-A", "externa-B"]);
  for (const p of mo.pecas) { assert.ok(p.fechada, p.nome); assert.equal(variedade(p.malha), 0, p.nome); assert.equal(topologia(p.malha).componentes, 1, p.nome); }
  assert.equal(topologia(mo.pecas[0].malha).genero, 0, "base sem furos");
  assert.equal(mo.pecas.slice(1).reduce((s, p) => s + topologia(p.malha).genero, 0) >= 1, true, "canal de injeção atravessa a externa");
  assert.ok(mo.retencoes < 1, "retenções " + mo.retencoes);
  assert.equal(mo.chaves.length, 4);
});

test("nariz paramétrico: oco com narinas abertas para dentro, aba fina, molde", async () => {
  const { info, malha } = rosto("rosto_sem_nariz");
  const plano = P.planoSagital(info.pontos), pad = P.narizPadrao(info.pontos);
  assert.ok(Math.abs(pad.largura - P.narizPadrao(info.pontos).largura) < 1e-9 && pad.largura > 30 && pad.largura < 38, "largura pela distância intercantal");
  const pr = await P.gerarProtese({ tipo: "nariz", malha, pontos: info.pontos, plano });
  assert.ok(pr.medidas.fechada); assert.equal(variedade(pr.malha), 0);
  assert.deepEqual(topologia(pr.malha), { componentes: 1, genero: 2 }, "as duas narinas atravessam até o oco");
  const macico = await P.gerarProtese({ tipo: "nariz", malha, pontos: info.pontos, plano, parametros: { oco: false } });
  assert.deepEqual(topologia(macico.malha), { componentes: 1, genero: 0 }, "maciço: narinas cegas");
  assert.ok(macico.medidas.volume > pr.medidas.volume * 1.3);
  // borda afinada: os vértices perto da borda da aba ficam a ≈ 0,3 mm da pele
  const B = pr.borda; let perto = 0, n = 0;
  for (let i = 0; i < pr.malha.V.length; i += 3) {
    const a = (pr.malha.V[i] - B.g.o[0]) / B.g.h, b = (pr.malha.V[i + 1] - B.g.o[1]) / B.g.h, c = Math.round(a) + B.g.nx * Math.round(b);
    if (B.dAba[c] > B.La - 0.6 && B.dAba[c] < B.La - 0.1 && B.permitida[c]) { n++; if (pr.malha.V[i + 2] - B.pele[c] < 0.55) perto++; }
  }
  assert.ok(n > 20 && perto / n > 0.9, `${perto}/${n}`);
  const mo = await P.gerarMolde(pr, { dividir: false });
  assert.deepEqual(mo.pecas.map((p) => p.nome), ["base", "externa"]);
  for (const p of mo.pecas) { assert.ok(p.fechada, p.nome); assert.equal(variedade(p.malha), 0, p.nome); }
  assert.equal(topologia(mo.pecas[1].malha).genero, 3, "externa: canal + 2 respiros");
});

test("nariz paramétrico: perfil, largura e ângulo nasolabial seguem os parâmetros", () => {
  const p = { comprimento: 48, largura: 34, projecao: 19, alturaPonta: 7.7, nasolabial: 100, dorso: 0, larguraPonta: 17, narina: 1, profNarina: 10 };
  const topo = P.narizTopo(p);
  let mx = -Infinity, vMx = 0; for (let v = 0; v <= 48; v += 0.25) { const t = topo(0, v); if (t > mx) { mx = t; vMx = v; } }
  assert.ok(Math.abs(mx - 19) < 0.5 && Math.abs(vMx - 7.7) < 2, `ponta ${mx} em ${vMx}`);
  let larg = 0; for (let u = 0; u < 30; u += 0.1) if (topo(u, 5) > 0.5) larg = u;
  assert.ok(Math.abs(2 * larg - 34) < 3, "largura alar " + 2 * larg);
  const f = P.narizParametrico(p);
  assert.ok(f(0, 2, 5) < 0 && f(0, -1, 5) > 0, "base do nariz pelo ângulo nasolabial");
  const g = P.narizParametrico(Object.assign({}, p, { nasolabial: 115 }));
  assert.ok(g(0, 2, 10) > 0, "ângulo maior: columela sobe mais rápido");
});
