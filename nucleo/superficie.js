/* EITA núcleo · superfície — leitura de scans (STL, OBJ, PLY), fechamento de furos pequenos, transformações e busca do
   ponto mais próximo na malha (grade espacial). Usado pelo EITA! NARIZ·ORELHA (E5). Puro: navegador e Node.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import { lerSTL } from "./malha.js";
import { distancia2Triangulo } from "./volume.js";

// ------------------------------------------------------------------ leitura
// OBJ (texto): v x y z / f a b c … (índices 1-based, negativos relativos; polígonos em leque) → sopa de triângulos
export function lerOBJ(buf) {
  const txt = typeof buf === "string" ? buf : new TextDecoder().decode(buf), v = [], out = [];
  for (const linha of txt.split(/\r?\n/)) {
    const p = linha.trim().split(/\s+/);
    if (p[0] === "v" && p.length >= 4) v.push(+p[1], +p[2], +p[3]);
    else if (p[0] === "f" && p.length >= 4) {
      const idx = p.slice(1).map((s) => { const n = parseInt(s.split("/")[0], 10); return n < 0 ? v.length / 3 + n : n - 1; });
      for (let k = 1; k + 1 < idx.length; k++) for (const i of [idx[0], idx[k], idx[k + 1]]) out.push(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]);
    }
  }
  if (!out.length) throw new Error("OBJ sem faces");
  return new Float32Array(out);
}
// PLY ASCII ou binário (little/big endian): elemento vertex (x, y, z) e face (lista de índices) → sopa de triângulos
export function lerPLY(buf) {
  const u8 = new Uint8Array(buf);
  let fimCab = -1;
  for (let i = 0; i < Math.min(u8.length - 10, 65536); i++) if (u8[i] === 101 && new TextDecoder().decode(u8.subarray(i, i + 10)) === "end_header") { fimCab = i + 10; break; }
  if (fimCab < 0) throw new Error("PLY sem cabeçalho");
  while (u8[fimCab] === 13 || u8[fimCab] === 10) { fimCab++; if (u8[fimCab - 1] === 10) break; }
  const cab = new TextDecoder().decode(u8.subarray(0, fimCab)).split(/\r?\n/);
  let formato = "ascii"; const elems = [];
  for (const l of cab) {
    const p = l.trim().split(/\s+/);
    if (p[0] === "format") formato = p[1];
    else if (p[0] === "element") elems.push({ nome: p[1], n: +p[2], props: [] });
    else if (p[0] === "property" && elems.length) elems[elems.length - 1].props.push(p[1] === "list" ? { lista: true, tc: p[2], ti: p[3], nome: p[4] } : { tipo: p[1], nome: p[2] });
  }
  const TAM = { char: 1, uchar: 1, int8: 1, uint8: 1, short: 2, ushort: 2, int16: 2, uint16: 2, int: 4, uint: 4, int32: 4, uint32: 4, float: 4, float32: 4, double: 8, float64: 8 };
  const V = [], out = [];
  if (formato === "ascii") {
    const tok = new TextDecoder().decode(u8.subarray(fimCab)).split(/\s+/).filter(Boolean); let t = 0;
    for (const e of elems) for (let r = 0; r < e.n; r++) {
      const reg = {};
      for (const p of e.props) { if (p.lista) { const n = +tok[t++]; reg[p.nome] = tok.slice(t, t + n).map(Number); t += n; } else reg[p.nome] = +tok[t++]; }
      if (e.nome === "vertex") V.push(reg.x, reg.y, reg.z);
      else if (e.nome === "face") { const ix = reg.vertex_indices || reg.vertex_index; if (ix) for (let k = 1; k + 1 < ix.length; k++) for (const i of [ix[0], ix[k], ix[k + 1]]) out.push(V[i * 3], V[i * 3 + 1], V[i * 3 + 2]); }
    }
  } else {
    const le = formato === "binary_little_endian", dv = new DataView(buf instanceof ArrayBuffer ? buf : u8.buffer, u8.byteOffset); let o = fimCab;
    const ler = (tipo) => {
      let v;
      switch (tipo) {
        case "char": case "int8": v = dv.getInt8(o); break; case "uchar": case "uint8": v = dv.getUint8(o); break;
        case "short": case "int16": v = dv.getInt16(o, le); break; case "ushort": case "uint16": v = dv.getUint16(o, le); break;
        case "int": case "int32": v = dv.getInt32(o, le); break; case "uint": case "uint32": v = dv.getUint32(o, le); break;
        case "float": case "float32": v = dv.getFloat32(o, le); break; default: v = dv.getFloat64(o, le);
      }
      o += TAM[tipo]; return v;
    };
    for (const e of elems) {
      const ix = e.props.findIndex((p) => p.nome === "x"), iy = e.props.findIndex((p) => p.nome === "y"), iz = e.props.findIndex((p) => p.nome === "z");
      for (let r = 0; r < e.n; r++) {
        if (e.nome === "vertex") { const reg = e.props.map((p) => ler(p.tipo)); V.push(reg[ix], reg[iy], reg[iz]); continue; }
        let ind = null;
        for (const p of e.props) {
          if (p.lista) { const n = ler(p.tc), l = []; for (let k = 0; k < n; k++) l.push(ler(p.ti)); if (p.nome === "vertex_indices" || p.nome === "vertex_index") ind = l; }
          else ler(p.tipo);
        }
        if (e.nome === "face" && ind) for (let k = 1; k + 1 < ind.length; k++) for (const i of [ind[0], ind[k], ind[k + 1]]) out.push(V[i * 3], V[i * 3 + 1], V[i * 3 + 2]);
      }
    }
  }
  if (!out.length) throw new Error("PLY sem faces (nuvem de pontos não serve: exporte a malha)");
  return new Float32Array(out);
}
// pelo nome do arquivo → sopa de triângulos
export function lerMalha(nome, buf) {
  if (/\.obj$/i.test(nome)) return lerOBJ(buf);
  if (/\.ply$/i.test(nome)) return lerPLY(buf);
  if (/\.stl$/i.test(nome)) return lerSTL(buf);
  throw new Error("formato não reconhecido (use STL, OBJ ou PLY)");
}
// unidade provável pela maior dimensão (cabeça/rosto: ~100–300 mm) → fator para mm (1, 10 ou 1000)
export function fatorProvavel(sopa) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < sopa.length; i++) { const v = sopa[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
  const d = hi - lo;
  return d < 1 ? 1000 : d < 40 ? 10 : 1;
}

// ------------------------------------------------------------------ furos
// Fecha os furos cujo contorno tem até perimetroMax (mm), com um leque a partir do centro do furo.
// O contorno externo de um scan aberto (grande) fica como está. → { V, F, fechados, abertos }
export function fecharFuros(malha, perimetroMax = 40) {
  const { V, F } = malha, dirigidas = new Set(), chave = (a, b) => a * 4294967296 + b;
  for (let t = 0; t < F.length; t += 3) for (let k = 0; k < 3; k++) dirigidas.add(chave(F[t + k], F[t + (k + 1) % 3]));
  const prox = new Map(), dupla = new Set();
  for (let t = 0; t < F.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = F[t + k], b = F[t + (k + 1) % 3];
    if (dirigidas.has(chave(b, a))) continue;
    if (prox.has(a)) dupla.add(a); else prox.set(a, b);
  }
  const V2 = Array.from(V), F2 = Array.from(F), visto = new Set(); let fechados = 0, abertos = 0;
  for (const ini of prox.keys()) {
    if (visto.has(ini)) continue;
    const laco = []; let v = ini, ok = true;
    while (!visto.has(v)) { visto.add(v); laco.push(v); if (dupla.has(v)) ok = false; v = prox.get(v); if (v === undefined) { ok = false; break; } }
    if (!ok || v !== ini || laco.length < 3) { abertos++; continue; }
    let per = 0, cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < laco.length; i++) {
      const a = laco[i] * 3, b = laco[(i + 1) % laco.length] * 3;
      per += Math.hypot(V[a] - V[b], V[a + 1] - V[b + 1], V[a + 2] - V[b + 2]); cx += V[a]; cy += V[a + 1]; cz += V[a + 2];
    }
    if (per > perimetroMax) { abertos++; continue; }
    const c = V2.length / 3; V2.push(cx / laco.length, cy / laco.length, cz / laco.length);
    for (let i = 0; i < laco.length; i++) F2.push(laco[(i + 1) % laco.length], laco[i], c);
    fechados++;
  }
  return { V: new Float64Array(V2), F: new Uint32Array(F2), fechados, abertos };
}

// ------------------------------------------------------------------ transformações
// referencial ortonormal { o, U, V, W }: local = [(p−o)·U, (p−o)·V, (p−o)·W]
export const paraLocal = (R, p) => { const x = p[0] - R.o[0], y = p[1] - R.o[1], z = p[2] - R.o[2]; return [x * R.U[0] + y * R.U[1] + z * R.U[2], x * R.V[0] + y * R.V[1] + z * R.V[2], x * R.W[0] + y * R.W[1] + z * R.W[2]]; };
export const deLocal = (R, q) => [0, 1, 2].map((i) => R.o[i] + q[0] * R.U[i] + q[1] * R.V[i] + q[2] * R.W[i]);
// aplica fn(x, y, z) → [x, y, z] a todos os vértices (Float64Array nova)
export function transformarVertices(V, fn) {
  const out = new Float64Array(V.length);
  for (let i = 0; i < V.length; i += 3) { const p = fn(V[i], V[i + 1], V[i + 2]); out[i] = p[0]; out[i + 1] = p[1]; out[i + 2] = p[2]; }
  return out;
}

// ------------------------------------------------------------------ ponto mais próximo
// Grade espacial dos triângulos (passo em mm). buscar(p, raioMax) → { d, t } (distância e triângulo) ou null.
export function criarBuscaProxima(malha, passo = 4) {
  const { V, F } = malha, nt = F.length / 3, T = new Float64Array(nt * 9), cel = new Map();
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) { const v = F[t * 3 + k] * 3; T[t * 9 + k * 3] = V[v]; T[t * 9 + k * 3 + 1] = V[v + 1]; T[t * 9 + k * 3 + 2] = V[v + 2]; }
  const ch = (i, j, k) => (i + 4096) * 67108864 + (j + 4096) * 8192 + (k + 4096);
  for (let t = 0; t < nt; t++) {
    const lo = [0, 1, 2].map((q) => Math.floor(Math.min(T[t * 9 + q], T[t * 9 + 3 + q], T[t * 9 + 6 + q]) / passo));
    const hi = [0, 1, 2].map((q) => Math.floor(Math.max(T[t * 9 + q], T[t * 9 + 3 + q], T[t * 9 + 6 + q]) / passo));
    for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) { const c = ch(i, j, k); let l = cel.get(c); if (!l) cel.set(c, (l = [])); l.push(t); }
  }
  function buscar(p, raioMax = 20) {
    const ci = Math.floor(p[0] / passo), cj = Math.floor(p[1] / passo), ck = Math.floor(p[2] / passo);
    let melhor = Infinity, mt = -1;
    for (let r = 0; r * passo <= raioMax + passo; r++) {
      for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) for (let k = ck - r; k <= ck + r; k++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj), Math.abs(k - ck)) !== r) continue;
        const l = cel.get(ch(i, j, k)); if (!l) continue;
        for (const t of l) { const d = distancia2Triangulo(T, t, p[0], p[1], p[2]); if (d < melhor) { melhor = d; mt = t; } }
      }
      if (mt >= 0 && Math.sqrt(melhor) <= r * passo) break;
    }
    return mt >= 0 && Math.sqrt(melhor) <= raioMax ? { d: Math.sqrt(melhor), t: mt } : null;
  }
  // ponto mais próximo (coordenadas), para o ajuste de simetria
  function pontoMaisProximo(p, raioMax) {
    const r = buscar(p, raioMax); if (!r) return null;
    const o = r.t * 9, a = [T[o], T[o + 1], T[o + 2]], b = [T[o + 3], T[o + 4], T[o + 5]], c = [T[o + 6], T[o + 7], T[o + 8]];
    // projeção pelo mesmo algoritmo: busca no triângulo por baricentro restrito (passos de refino)
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
    const d00 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2], d01 = ab[0] * ac[0] + ab[1] * ac[1] + ab[2] * ac[2], d11 = ac[0] * ac[0] + ac[1] * ac[1] + ac[2] * ac[2];
    const d20 = ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2], d21 = ap[0] * ac[0] + ap[1] * ac[1] + ap[2] * ac[2], den = d00 * d11 - d01 * d01 || 1;
    let v = (d11 * d20 - d01 * d21) / den, w = (d00 * d21 - d01 * d20) / den;
    if (v < 0) v = 0; if (w < 0) w = 0; if (v + w > 1) { const s = v + w; v /= s; w /= s; }
    const nx = ab[1] * ac[2] - ab[2] * ac[1], ny = ab[2] * ac[0] - ab[0] * ac[2], nz = ab[0] * ac[1] - ab[1] * ac[0], ln = Math.hypot(nx, ny, nz) || 1;
    return { p: [a[0] + v * ab[0] + w * ac[0], a[1] + v * ab[1] + w * ac[1], a[2] + v * ab[2] + w * ac[2]], d: r.d, n: [nx / ln, ny / ln, nz / ln] };
  }
  return { buscar, pontoMaisProximo, triangulos: nt };
}
