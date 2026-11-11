// EITA! AFO no Node, sem DOM: o mesmo caminho que a página percorre em comparar_afo.py (loadBuffer, 6 × setLandmark,
// applyCorrection opcional, makeShell, afoStl/stl), com os parâmetros da casca tirados da referência gravada.
// © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados.
import fs from "node:fs";
import zlib from "node:zlib";
import crypto from "node:crypto";

const RAIZ = new URL("../../", import.meta.url);
const ORDEM = ["ML", "MM", "CA", "M1", "M5", "PX"];
export const CENARIOS = { A: null, B: { tSag: 95, tCor: 3, band: 25 } };
// mesma serialização de comparar_afo.py (sem os tempos; números com 12 algarismos)
export const jsonCasca = (log, params) => JSON.stringify({ log, params }, (k, v) => (k === "ms" || k === "checkMs") ? undefined : typeof v === "number" ? +v.toPrecision(12) : v);
export const hashSTL = (buf) => { const u = new Uint8Array(buf); return "sha256:" + crypto.createHash("sha256").update(u).digest("hex") + " (" + u.length + " B)"; };

export function carregarPerna() {
  const bin = zlib.gunzipSync(fs.readFileSync(new URL("testes/fixtures/perna_sintetica.stl.gz", RAIZ)));
  const pontos = JSON.parse(fs.readFileSync(new URL("testes/fixtures/perna_sintetica.json", RAIZ), "utf8")).pontos_mm;
  return { buf: bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength), pontos };
}

// E = EITA (núcleo + E.afo); params = parâmetros da casca (os de shellParams() na página); correcao = { tSag, tCor, band } ou null
export function executar(E, { params, correcao = null, perna = carregarPerna() }) {
  const A = E.afo, V3 = A.V3, S = {};
  // loadBuffer (fragmentos removidos: a caixa "frag" vem marcada)
  let { V, F } = E.soldar(E.lerSTL(perna.buf));
  ({ V, F } = E.filtrarComponentes(V, F, 0.02));
  const h = [1e9, 1e9, 1e9], u = [-1e9, -1e9, -1e9];
  for (let i = 0; i < V.length; i += 3) for (let k = 0; k < 3; k++) { h[k] = Math.min(h[k], V[i + k]); u[k] = Math.max(u[k], V[i + k]); }
  const offset = V3.mid(h, u);
  for (let i = 0; i < V.length; i += 3) for (let k = 0; k < 3; k++) V[i + k] -= offset[k];
  Object.assign(S, { V0: new Float64Array(V), V, F, L0: {}, L: {}, corrected: false });
  const atualizar = () => { S.frame = A.calcularReferencial(S.L, S.V); if (S.frame && !S.corrected) A.acrescentarPlantares(S.L, S.V, S.frame); };
  // setLandmark + update()
  for (const k of ORDEM) { const p = V3.sub(perna.pontos[k], offset); S.L[k] = p.slice(); S.L0[k] = p.slice(); atualizar(); }
  // applyCorrection
  if (correcao) {
    const l = {}; for (const k in S.L0) l[k] = S.L0[k].slice();
    const s = A.calcularReferencial(l, S.V0); A.acrescentarPlantares(l, S.V0, s);
    const v = A.medir(l, s), r = A.corrigirPostura(S.V0, S.F, l, s, v, correcao.tSag, correcao.tCor, correcao.band);
    Object.assign(S, { V: r.V, L: l, corrected: true, invSkipped: r.invSkipped, frame: s });
    atualizar();
  }
  // makeShell (com a autocorreção de faces cruzadas)
  const xf = A.paraAnatomico(S.frame), n = S.V.length / 3, anat = new Float64Array(S.V.length);
  for (let j = 0; j < n; j++) { const q = xf([S.V[j * 3], S.V[j * 3 + 1], S.V[j * 3 + 2]]); anat[j * 3] = q[0]; anat[j * 3 + 1] = q[1]; anat[j * 3 + 2] = q[2]; }
  const pts = {}; for (const k in S.L) pts[k] = xf(S.L[k]);
  const P = JSON.parse(JSON.stringify(params));
  let c = A.gerarCasca(anat, S.F, pts, Object.assign({}, P, { selfCheck: true }));
  let cel = [], tent = 0;
  while (P.autoFix && c.log.check > 0 && tent < 3) {
    tent++; cel = cel.concat(c.log.crossCells || []);
    const g = A.gerarCasca(anat, S.F, pts, Object.assign({}, P, { selfCheck: true, fixCells: cel, fixR: [4 + 2 * tent, 8 + 3 * tent] }));
    if (g.log.check <= c.log.check) c = g;
  }
  c.log.fixTries = tent;
  const casca = c.shell, stlAFO = (V, F, t) => E.stl({ V, F }, (x, y, z) => t([x, y, z]), "t");
  const stl = {};
  for (const o of ["anat", "pe", "deitada"]) stl["afo_" + o + ".stl"] = hashSTL(stlAFO(casca.V, casca.F, A.orientacaoImpressao(o, casca.V)));
  stl["perna.stl"] = hashSTL(stlAFO(S.V, S.F, xf));
  return { S, casca: c, stl, log: c.log };
}
