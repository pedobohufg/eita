// Malha lida de arquivo (núcleo, E4b): as funções do núcleo dão exatamente o mesmo resultado que as do EITA! AFO v0.14
// publicado (lidas de legado/afo/index.html), na perna sintética. Também a regra do .zip para a capacidade "downloads".
// © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";
import * as N from "../nucleo/index.js";

const RAIZ = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("legado/afo/index.html", RAIZ), "utf8");
// recorta "function nome(...) { … }" (ou "const nome={ … }") do script publicado, contando chaves
function recortar(inicio) {
  const a = html.indexOf(inicio); assert.ok(a >= 0, inicio);
  let i = html.indexOf("{", a + inicio.length - 1), n = 0;
  for (; i < html.length; i++) { if (html[i] === "{") n++; else if (html[i] === "}" && --n === 0) break; }
  return html.slice(a, i + 1);
}
const NOMES = ["parseSTL", "weld", "componentsFilter", "boundaryEdges", "splitCrease", "computeNormals", "toBinarySTL"];
const L = new Function(recortar("const V3={") + ";\n" + NOMES.map((n) => recortar(`function ${n}(`)).join("\n") + `\nreturn { ${NOMES.join(", ")} };`)();

const bin = zlib.gunzipSync(fs.readFileSync(new URL("testes/fixtures/perna_sintetica.stl.gz", RAIZ)));
const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
const iguais = (a, b, msg) => { assert.equal(a.constructor, b.constructor, msg); assert.ok(Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength)), msg); };

test("malha: lerSTL, soldar, componentes, bordas e normais idênticos ao AFO v0.14", () => {
  const s = N.lerSTL(buf); iguais(s, L.parseSTL(buf), "lerSTL");
  const w = N.soldar(s), wl = L.weld(s); iguais(w.V, wl.V, "soldar V"); iguais(w.F, wl.F, "soldar F");
  assert.equal(w.F.length / 3, 84852);
  // com um fragmento solto acrescentado, para o filtro ter o que remover
  const frag = new Float32Array([0, 0, 500, 1, 0, 500, 0, 1, 500]), s2 = new Float32Array(s.length + 9); s2.set(s); s2.set(frag, s.length);
  const w2 = N.soldar(s2), c = N.filtrarComponentes(w2.V, w2.F, 0.02), cl = L.componentsFilter(w2.V, w2.F, 0.02);
  iguais(c.V, cl.V, "componentes V"); iguais(c.F, cl.F, "componentes F");
  assert.deepEqual([c.componentes, c.mantidos], [cl.comps, cl.kept]); assert.deepEqual([c.componentes, c.mantidos], [2, 1]);
  assert.equal(N.contarArestasDeBorda(w.F), L.boundaryEdges(w.F)); assert.equal(N.contarArestasDeBorda(w2.F), 3);
  iguais(N.normaisDeVertices(w.V, w.F), L.computeNormals(w.V, w.F), "normais");
});

test("malha: separarVincos idêntico ao AFO v0.14 (com e sem quinas)", () => {
  const w = N.soldar(N.lerSTL(buf)), V32 = Float32Array.from(w.V);
  for (const ang of [55, 20]) {
    const r = N.separarVincos(V32, w.F, ang), rl = L.splitCrease(V32, w.F, ang);
    iguais(r.V, rl.V, "V " + ang); iguais(r.F, rl.F, "F " + ang); assert.deepEqual(r.mapa, rl.map);
  }
  // cubo: todas as quinas a 90°, cada vértice vira 3
  const cubo = N.soldar(new Float32Array([0,0,0, 1,1,0, 1,0,0, 0,0,0, 0,1,0, 1,1,0, 0,0,1, 1,0,1, 1,1,1, 0,0,1, 1,1,1, 0,1,1, 0,0,0, 1,0,0, 1,0,1, 0,0,0, 1,0,1, 0,0,1, 0,1,0, 1,1,1, 1,1,0, 0,1,0, 0,1,1, 1,1,1, 0,0,0, 0,0,1, 0,1,1, 0,0,0, 0,1,1, 0,1,0, 1,0,0, 1,1,0, 1,1,1, 1,0,0, 1,1,1, 1,0,1]));
  const r = N.separarVincos(Float32Array.from(cubo.V), cubo.F, 55), rl = L.splitCrease(Float32Array.from(cubo.V), cubo.F, 55);
  assert.equal(r.V.length / 3, 24); iguais(r.V, rl.V, "cubo V"); iguais(r.F, rl.F, "cubo F"); assert.deepEqual(r.mapa, rl.map);
  assert.equal(N.separarVincos(Float32Array.from(cubo.V), cubo.F, 100).mapa, null);
});

test("malha: stl() do núcleo grava o mesmo STL que o toBinarySTL do AFO v0.14", () => {
  const w = N.soldar(N.lerSTL(buf)), xf = ([x, y, z]) => [0.6 * x - 0.8 * z + 3, y - 7, 0.8 * x + 0.6 * z];
  const cab = "EITA AFO perna_sintetica — cabeçalho longo o bastante para passar de setenta e nove caracteres";
  const a = new Uint8Array(N.stl(w, (x, y, z) => xf([x, y, z]), cab.slice(0, 79))), b = new Uint8Array(L.toBinarySTL(w.V, w.F, xf, cab));
  assert.ok(Buffer.from(a).equals(Buffer.from(b)));
  // e relê o que gravou
  const rel = N.soldar(N.lerSTL(a.buffer)); assert.equal(rel.F.length, w.F.length); assert.equal(N.contarArestasDeBorda(rel.F), 0);
});

test("malha: lerSTL aceita ASCII e recusa lixo", () => {
  const txt = "solid t\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1.5e0 -2\nendloop\nendfacet\nendsolid t\n";
  const u = new TextEncoder().encode(txt);
  assert.deepEqual([...N.lerSTL(u.buffer)], [0, 0, 0, 1, 0, 0, 0, 1.5, -2]);
  assert.throws(() => N.lerSTL(new TextEncoder().encode("nada aqui").buffer), /não reconhecido/);
});

test("saída: STL vai dentro de .zip; PDF e JSON vão direto", async () => {
  const stl = new Uint8Array(N.stl(N.soldar(N.lerSTL(buf)), null, "t"));
  const z = await N.embalarParaDownload("caso_AFO.stl", stl.buffer, "model/stl");
  assert.equal(z.nome, "caso_AFO.zip"); assert.equal(z.dados.type, "application/zip");
  // lê o .zip (um arquivo): cabeçalho local, nome, método, conteúdo
  const u = new Uint8Array(await z.dados.arrayBuffer()), dv = new DataView(u.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  const met = dv.getUint16(8, true), tc = dv.getUint32(18, true), tn = dv.getUint16(26, true);
  assert.equal(new TextDecoder().decode(u.subarray(30, 30 + tn)), "caso_AFO.stl");
  const corpo = u.subarray(30 + tn, 30 + tn + tc), dados = met === 8 ? zlib.inflateRawSync(corpo) : Buffer.from(corpo);
  assert.ok(dados.equals(Buffer.from(stl)));
  for (const [nome, tipo] of [["r.pdf", "application/pdf"], ["f.json", "application/json"], ["a.ZIP", undefined]]) {
    const r = await N.embalarParaDownload(nome, "x", tipo); assert.equal(r.nome, nome); assert.equal(r.dados.type, tipo || "application/octet-stream");
  }
});
