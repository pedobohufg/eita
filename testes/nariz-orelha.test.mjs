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

test("campo de malha: scan fechado atrás (tampa) conta como dentro abaixo da pele", () => {
  // caixa fechada de z = −5 a 0 (a "pele" é a face de cima; a de baixo é a tampa), e a grade vai até z = −8
  const V = [], F = [], q = (x, y, z) => { V.push(x, y, z); return V.length / 3 - 1; };
  const c = [[-20, -20, -5], [20, -20, -5], [20, 20, -5], [-20, 20, -5], [-20, -20, 0], [20, -20, 0], [20, 20, 0], [-20, 20, 0]].map((p) => q(...p));
  for (const [a, b, d, e] of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) F.push(c[a], c[b], c[d], c[a], c[d], c[e]);
  const malha = { V: new Float64Array(V), F: new Uint32Array(F) };
  const g = N.criarGrade([-10, -10, -8], [10, 10, 3], 0.5);
  const r = N.campoDeMalha(g, N.triangulosNaCaixa(malha, [-12, -12, -10], [12, 12, 5]), { banda: 3, final: "dentro" });
  assert.equal(r.reparadas, 0);
  const em = (x, y, z) => N.amostrarGrade(g, x, y, z);
  assert.ok(em(0, 0, -7) < 0 && em(3, -4, -6) < 0, "abaixo da tampa continua dentro");
  assert.ok(em(0, 0, 1) > 0 && Math.abs(em(0, 0, -1) + 1) < 0.05, "pele em z = 0");
});

test("modelo do próprio paciente: refinar pelo rosto desfaz um desalinhamento de 4° e 3 mm", () => {
  const { info, malha } = rosto("rosto_sem_nariz");
  const a = (4 * Math.PI) / 180, T0 = { R: [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]], s: 1, t: [2, -1.5, 1.8] };
  const fora = P.transformarModelo(malha, T0);
  const L = Math.hypot(...info.pontos.n.map((v, i) => v - info.pontos.sn[i]));
  const r = P.refinarModelo(fora, malha, { centro: info.pontos.n, raio: 90, excluir: [{ c: info.pontos.n.map((v, i) => 0.4 * v + 0.6 * info.pontos.sn[i]), r: 0.75 * L }] });
  const volta = P.transformarModelo(fora, r.T);
  let mx = 0; for (let i = 0; i < volta.V.length; i += 3 * 37) mx = Math.max(mx, Math.hypot(volta.V[i] - malha.V[i], volta.V[i + 1] - malha.V[i + 1], volta.V[i + 2] - malha.V[i + 2]));
  assert.ok(r.rms < 0.1 && mx < 0.3, `rms ${r.rms}, desvio máx ${mx}`);
});

test("escultura: elevar a ponta aumenta a projeção, a prótese continua fechada e com as narinas; desfazer volta", async () => {
  const { info, malha } = rosto("rosto_sem_nariz");
  const plano = P.planoSagital(info.pontos), base = { tipo: "nariz", malha, pontos: info.pontos, plano };
  const a = await P.gerarProtese(base);
  const pad = P.narizPadrao(info.pontos), gesto = [];
  for (let i = 0; i < 4; i++) gesto.push({ t: "+", u: 0, v: pad.alturaPonta, r: 7, f: 0.5 });
  const esc = { o: [a.g.o[0], a.g.o[1]], h: 0.5, nx: Math.round((a.g.nx * a.g.h) / 0.5), ny: Math.round((a.g.ny * a.g.h) / 0.5), tracos: [gesto] };
  const b = await P.gerarProtese(Object.assign({}, base, { escultura: esc }));
  assert.ok(b.medidas.projecao > a.medidas.projecao + 1.2, `projeção ${a.medidas.projecao} → ${b.medidas.projecao}`);
  assert.ok(b.medidas.fechada); assert.equal(variedade(b.malha), 0);
  assert.deepEqual(topologia(b.malha), { componentes: 1, genero: 2 });
  const c = P.campoEscultura(esc); assert.ok(Math.abs(P.valorEscultura(c, 0, pad.alturaPonta) - 2) < 0.05, "4 toques de 0,5 mm no centro");
  P.aplicarToque(c, { t: "s", u: 0, v: pad.alturaPonta, r: 7, f: 1 }); assert.ok(P.valorEscultura(c, 0, pad.alturaPonta) < 2, "suavizar baixa o pico");
  const vazio = await P.gerarProtese(Object.assign({}, base, { escultura: Object.assign({}, esc, { tracos: [] }) }));
  assert.ok(Math.abs(vazio.medidas.volume - a.medidas.volume) < 1e-9, "sem traços, igual à original");
});

test("modelo de nariz importado: narinas abertas pela base do próprio modelo", async () => {
  const { info, malha } = rosto("rosto_sem_nariz");
  const plano = P.planoSagital(info.pontos), pad = P.narizPadrao(info.pontos);
  // o "scan antigo com o nariz": o nariz paramétrico, sem narinas, levado para o referencial do scan
  const R = P.referencial({ tipo: "nariz", pontos: info.pontos, plano });
  const modelo = P.malhaParaScan(P.malhaNariz(pad, 0.5), R);
  const base = { tipo: "nariz", malha, pontos: info.pontos, plano };
  const com = await P.gerarProtese(Object.assign({}, base, { doadora: { tipo: "modelo", modelo } }));
  const sem = await P.gerarProtese(Object.assign({}, base, { doadora: { tipo: "modelo", modelo, narinas: false } }));
  assert.ok(com.medidas.fechada && sem.medidas.fechada);
  assert.deepEqual(topologia(com.malha), { componentes: 1, genero: 2 }, "duas narinas até o oco");
  assert.equal(topologia(sem.malha).genero, 0, "sem a opção, a base fica fechada");
});

test("armação de óculos: assento raso no dorso entre os dois pontos, nichos de ímãs, prótese fechada", async () => {
  const { info, malha } = rosto("rosto_sem_nariz");
  const plano = P.planoSagital(info.pontos), base = { tipo: "nariz", malha, pontos: info.pontos, plano };
  const a = await P.gerarProtese(base);
  const T = P.narizTopo(a.nariz), v = 0.7 * a.nariz.comprimento;
  const ponto = (u) => Array.from(P.malhaParaScan({ V: new Float32Array([u, v, T(u, v)]), F: new Uint32Array([0, 0, 0]) }, a.R).V);
  const oculos = { pontos: [ponto(-6), ponto(6)], largura: 5, prof: 1.2, imas: true, imaDiam: 4, imaProf: 2 };
  const b = await P.gerarProtese(Object.assign({}, base, { oculos }));
  assert.ok(b.medidas.fechada); assert.equal(variedade(b.malha), 0);
  assert.equal(topologia(b.malha).genero, topologia(a.malha).genero, "o assento e os nichos não furam a parede");
  // altura da superfície de fora no meio da ponte: ≈ 1,2 mm mais baixa
  const topoEm = (m, u0, v0) => { let w = -Infinity; for (let i = 0; i < m.V.length; i += 3) if (Math.abs(m.V[i] - u0) < 0.6 && Math.abs(m.V[i + 1] - v0) < 0.6) w = Math.max(w, m.V[i + 2]); return w; };
  const d = topoEm(a.malha, 0, v) - topoEm(b.malha, 0, v);
  assert.ok(d > 0.8 && d < 1.6, "assento no meio " + d);
  const longe = topoEm(a.malha, 0, v + 8) - topoEm(b.malha, 0, v + 8);
  assert.ok(Math.abs(longe) < 0.3, "fora da faixa não muda " + longe);
});

test("cor: amostra mediana num disco e diferença CIELAB para a base, com as direções da pintura", async () => {
  const C = await import("../modulos/nariz-orelha/cor.js");
  const w = 40, h = 20, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4, ponta = x >= 20; data.set(ponta ? [214, 140, 124, 255] : [205, 160, 138, 255], o); }
  data.set([0, 0, 255, 255], (10 * w + 10) * 4);   // um pixel estranho não muda a mediana
  const img = { data, width: w, height: h };
  const base = C.amostrarCor(img, 10, 10, 4), ponta = C.amostrarCor(img, 30, 10, 4);
  assert.equal(base.hex, "#cda08a"); assert.equal(ponta.hex, "#d68c7c");
  const c = C.compararCor(base, ponta);
  assert.ok(c.da > 5 && !c.igual && c.dicas.some((d) => d.startsWith("mais vermelha")), JSON.stringify(c));
  assert.match(C.sugestaoPintura(c), /vermelho/);
  assert.ok(C.compararCor(base, base).igual);
  assert.equal(C.ZONAS_COR.nariz[0].id, "base"); assert.equal(C.ZONAS_COR.orelha[0].id, "base");
});

test("cabeçalho da página mostra a versão do código (VERSAO)", () => {
  const html = fs.readFileSync(new URL("../modulos/nariz-orelha/index.html", import.meta.url), "utf8");
  const m = html.match(/Próteses nasais e auriculares · v([\d.]+)/);
  assert.ok(m, "subtítulo com a versão não encontrado");
  assert.equal(m[1], P.VERSAO);
});
