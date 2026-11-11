// Cálculo da órtese craniana no Node, nos mesmos cenários e com as mesmas saídas de testes/navegador/comparar_cranio.py
// (cenários em testes/apoio/cranio-ortese.json). Serve para o legado (window.CROCore recortado de
// legado/cranio-ortese/index.html) e para o módulo (modulos/cranio/ortese.js, pelos nomes antigos via comoCROCore).
// © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados.
import fs from "node:fs";
import vm from "node:vm";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { lerSTL } from "../../nucleo/malha.js";

const RAIZ = new URL("../../", import.meta.url);
export const CONFIG = JSON.parse(fs.readFileSync(new URL("testes/apoio/cranio-ortese.json", RAIZ), "utf8"));
export const CENARIOS = CONFIG.cenarios;

// html do EITA! Crânio "UI v8" e o window.CROCore dele, executado num contexto isolado
export const htmlLegado = () => fs.readFileSync(new URL("legado/cranio-ortese/index.html", RAIZ), "utf8");
export function legadoCROCore() {
  const html = htmlLegado(), a = html.indexOf("window.CROCore = (function () {"), b = html.indexOf("})();", a);
  if (a < 0 || b < 0) throw new Error("CROCore não encontrado no legado");
  const ctx = { window: {} };
  vm.runInNewContext(html.slice(a, b + 5), ctx);
  return ctx.window.CROCore;
}
// o módulo com os nomes do CROCore antigo
export function comoCROCore(O) {
  const C = {};
  for (const [antigo, novo] of Object.entries(CONFIG.nomes)) { if (!(novo in O)) throw new Error("falta " + novo); C[antigo] = O[novo]; }
  return C;
}

// cabeça sintética: posições soltas (Float32Array), como o STLLoader as entrega
export function carregarCabeca() {
  const bin = zlib.gunzipSync(fs.readFileSync(new URL("testes/fixtures/cabeca_sintetica.stl.gz", RAIZ)));
  const meta = JSON.parse(fs.readFileSync(new URL("testes/fixtures/cabeca_sintetica.json", RAIZ), "utf8"));
  return { pos: lerSTL(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)), meta };
}

export const hex = (x) => {
  const u = ArrayBuffer.isView(x) ? new Uint8Array(x.buffer, x.byteOffset, x.byteLength) : new Uint8Array(x);   // ArrayBuffer de outro contexto (vm) também
  return "sha256:" + crypto.createHash("sha256").update(u).digest("hex") + " (" + u.length + " B)";
};

// mesmas chaves e mesmos textos que o COLETAR de comparar_cranio.py
export function coletar(C, pos, zRef, cenarios = CENARIOS) {
  const o = {};
  o["funcoes.json"] = JSON.stringify({
    ganho: [0, 2, 3.9, 4, 5, 6, 7.5, 8, 9, 10, 14].map((a) => C.expectedIcGain(a)),
    alvo: [[0.95, 0], [0.95, 5], [0.92, 9], [0.86, 6], [0.80, 3], [1.0, 12]].map((p) => C.defaultIcTarget(p[0], p[1])),
    crescimento: [[-3, 0], [-1, 20], [0, 50], [1, 70], [2, 80], [5, 89]].map((p) => C.growthReserve(p[0], p[1], { growMonths: 4, growRate: 0.8, growContactPct: 30, growVertex: 2 })),
    regioes: [[0, 0], [30, 10], [90, 0], [135, 20], [180, 5], [225, 30], [270, -10], [330, 40], [10, 70]].map((p) => C.regionName(p[0], p[1])),
    cores: [-5, -1, -0.2, 0, 0.5, 2, 4].map((d) => C.colorRGB(d, 3, 0.7)),
    grade: C.G });
  for (const [nome, cen] of Object.entries(cenarios)) {
    const an = C.analyze(pos, zRef);
    if (an.error) { o[nome + "/erro"] = an.error; continue; }
    C.setIndication(an, cen.indicacao);
    for (const e of cen.edicoes) {
      if (e.pico != null) { const p = an.peaks[e.pico]; C.addEdit(an, { kind: "zero", th: p.th, ph: p.ph, radiusMm: 30, mm: 0 }); }
      else if (e.remover != null) C.removeEdit(an, e.remover);
      else C.addEdit(an, e);
    }
    const P = cen.P, range = Math.max(2, Math.ceil(an.maxAbs));
    o[nome + "/analise.json"] = JSON.stringify({ filled: an.filled, cheekCoverage: an.cheekCoverage, ic: an.ic, width: an.width, length: an.length,
      mirrorMax: an.mirrorMax, maxAbs: an.maxAbs, ears: an.ears, mode: an.mode, usePl: an.usePl, useBr: an.useBr, icTarget: an.icTarget, kx: an.kx, ky: an.ky,
      age: an.age, peaks: an.peaks, edits: an.edits, editSeq: an.editSeq, amostra: [[0, 0], [140, 12], [220, 12], [95, -10], [17.3, 55.1]].map((q) => [C.sampleGrid(an.rho, q[0], q[1]), C.sampleGrid(an.dev, q[0], q[1])]) });
    for (const k of ["rho", "devMirror", "rsNoEar", "devBase", "dev"]) o[nome + "/" + k] = hex(an[k]);
    o[nome + "/orelhas.json"] = JSON.stringify(C.resolveEars(an, P));
    o[nome + "/linha_corte.json"] = JSON.stringify(C.trimLine(an, P, 240));
    o[nome + "/cores_malha"] = hex(C.vertexColors(pos, an, zRef, range));
    o[nome + "/mapa_superior"] = hex(C.polarImage(an, range, 340, -10, 16));
    const g = C.generate(an, zRef, P, pos);
    o[nome + "/casca.json"] = JSON.stringify(g.stats);
    o[nome + "/ortese.stl"] = hex(C.toBinarySTL(g.tris));
  }
  return o;
}
