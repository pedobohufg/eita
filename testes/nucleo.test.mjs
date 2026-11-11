// Testes unitários do núcleo comum (node --test).
import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import * as N from "../nucleo/index.js";

test("base: clamp, percentil, mediana, resolver3", () => {
  assert.equal(N.clamp(5, 0, 3), 3); assert.equal(N.clamp(-1, 0, 3), 0);
  const v = Float32Array.from({ length: 101 }, (_, i) => i);
  assert.equal(N.mediana(v), 50); assert.equal(N.percentil(v, 90), 90);
  const x = N.resolver3([[2, 1, 0], [1, 3, 1], [0, 1, 4]], [3, 5, 5]);
  assert.deepEqual(x.map((t) => +t.toFixed(9)), [1, 1, 1]);
  assert.equal(N.hex([255, 0, 128.4]), "#ff0080");
});

test("imagem: Lab do branco e do preto", () => {
  const [L1, a1, b1] = N.rgbParaLab(255, 255, 255), [L0] = N.rgbParaLab(0, 0, 0);
  assert.ok(Math.abs(L1 - 100) < 0.01 && Math.abs(a1) < 0.05 && Math.abs(b1) < 0.05); assert.ok(Math.abs(L0) < 0.01);
});

test("imagem: Otsu separa duas populações", () => {
  const v = new Uint8Array(1000); for (let i = 0; i < 1000; i++) v[i] = i < 500 ? 40 + (i % 10) : 200 + (i % 10);
  const t = N.otsu(v); assert.ok(t >= 49 && t < 200, "limiar " + t);
});

test("imagem: rótulos, preenchimento de buracos e abertura", () => {
  const w = 40, h = 40, m = new Uint8Array(w * h);
  for (let y = 5; y < 20; y++) for (let x = 5; x < 20; x++) m[y * w + x] = 1;
  for (let y = 25; y < 35; y++) for (let x = 25; x < 35; x++) m[y * w + x] = 1;
  m[12 * w + 12] = 0;                                    // buraco
  const { comps } = N.rotular(m, w, h); assert.equal(comps.length, 2);
  const cheio = N.preencherBuracos(m, w, h); assert.equal(cheio[12 * w + 12], 1);
  m[2 * w + 2] = 1;                                     // ponto isolado some na abertura
  assert.equal(N.abertura(m, w, h, 1)[2 * w + 2], 0);
});

test("imagem: desfoque preserva a média", () => {
  const w = 64, h = 64, a = new Float32Array(w * h).map((_, i) => (i * 7919) % 255);
  const media = (x) => x.reduce((s, v) => s + v, 0) / x.length;
  for (const s of [1, 3, 8]) assert.ok(Math.abs(media(N.desfocar(a, w, h, s)) - media(a)) < 1.5);
});

test("geometria plana: área e máscara de quadrilátero", () => {
  const q = [[10, 10], [30, 10], [30, 30], [10, 30]];
  assert.equal(N.areaPoligono(q), 400);
  assert.deepEqual(N.ladosQuad(q), [20, 20, 20, 20]);
  assert.equal(N.mascaraQuad(50, 50, q, 0, 1).length, 400);
});

test("malha: caixa fechada, volume exato e STL binário", () => {
  const n = 11, xs = Float64Array.from({ length: n }, (_, i) => -5 + i);
  const idx = Array.from({ length: n }, (_, i) => i), N2 = n * n;
  const zb = new Float32Array(N2).fill(0), zt = new Float32Array(N2).fill(2), mask = new Uint8Array(N2).fill(1);
  for (const [cima, baixo] of [[false, false], [true, false], [false, true], [true, true]]) {
    const M = N.solido(xs, idx, n, zb, zt, mask, cima, baixo);
    assert.ok(N.verificarFechada(M).fechada, `fechada (${cima},${baixo})`);
    assert.ok(Math.abs(N.volume(M) - 200) < 1e-6, "volume 10×10×2");
    const buf = N.stl(M, null, "teste"); const dv = new DataView(buf);
    assert.equal(dv.getUint32(80, true), M.F.length / 3); assert.equal(buf.byteLength, 84 + 50 * (M.F.length / 3));
  }
});

test("malha: verificarFechada acusa malha aberta", () => {
  const r = N.verificarFechada({ F: Uint32Array.from([0, 1, 2]) });
  assert.equal(r.fechada, false); assert.equal(r.arestas_abertas, 3);
});

test("saída: zip legível (CRC e deflate conferidos)", async () => {
  const arquivos = { "a.txt": "olá, Lab.EITA ".repeat(200), "b.bin": new Uint8Array([1, 2, 3, 4]).buffer };
  const u8 = new Uint8Array(await (await N.zip(arquivos)).arrayBuffer()), dv = new DataView(u8.buffer);
  let fim = u8.length - 22; assert.equal(dv.getUint32(fim, true), 0x06054b50);
  const total = dv.getUint16(fim + 10, true); let p = dv.getUint32(fim + 16, true); assert.equal(total, 2);
  const lidos = {};
  for (let k = 0; k < total; k++) {
    const metodo = dv.getUint16(p + 10, true), crc = dv.getUint32(p + 16, true), tc = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
    const ini = off + 30 + dv.getUint16(off + 26, true), corpo = u8.subarray(ini, ini + tc);
    const dados = metodo === 8 ? zlib.inflateRawSync(corpo) : Buffer.from(corpo);
    assert.equal(zlib.crc32 ? zlib.crc32(dados) : crc, crc);
    lidos[nome] = dados; p += 46 + nl;
  }
  assert.equal(lidos["a.txt"].toString("utf8"), arquivos["a.txt"]);
  assert.deepEqual([...lidos["b.bin"]], [1, 2, 3, 4]);
});

test("calibração: SVG do marcador tem 20 mm e os bits do id 7", () => {
  const s = N.marcadorSVG();
  assert.match(s, /width="20" height="20" fill="#000"/);
  assert.equal((s.match(/fill="#fff"\/>/g) || []).length, 1 + N.BITS_ID7.flat().filter(Boolean).length);
  assert.match(N.marcadorSVG(undefined, "EITA! NARIZ"), /EITA! NARIZ · marcador v2/);
});

test("ficha: exportarBase acrescenta campos do app ao fim (calibração do AFO)", () => {
  const mem = new Map(), arm = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const A = N.criarArmazemFichas({ chave: "t", formatoFicha: "F", formatoBase: "B", versaoApp: "0.14", prefixoBase: "base_X", rotulo: "X", armazenamento: arm });
  A.salvar({ formato: "F", id: "a", atualizado: "2026-01-01T00:00:00Z" });
  const b = A.exportarBase(new Date("2026-11-11T12:00:00"), { calibracao: [{ EI: 1 }] });
  assert.equal(b.nome, "base_X_20261111.json");
  const o = JSON.parse(b.conteudo);
  assert.deepEqual(Object.keys(o), ["formato", "versaoApp", "exportado", "fichas", "calibracao"]);
  assert.deepEqual(o.calibracao, [{ EI: 1 }]);
  assert.deepEqual(Object.keys(JSON.parse(A.exportarBase().conteudo)), ["formato", "versaoApp", "exportado", "fichas"]);
});
