/* EITA núcleo · volume — grades regulares de campo escalar (campo de distância com sinal: negativo dentro),
   campo a partir de uma malha aberta ou fechada (dentro/fora por raios + distância exata perto da superfície),
   operações booleanas suaves e extração da superfície por marching cubes (tabela gerada aqui, sem tabelas
   copiadas: a superfície sai sempre fechada e orientada para fora).
   Usado pelo EITA! NARIZ·ORELHA (E5) para próteses com reentrâncias e moldes multipartes. Puro: navegador e Node.
   Grade: { nx, ny, nz, o: [x0, y0, z0] (centro da célula 0), h (mm), f: Float32Array } — índice i + nx·(j + ny·k).
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */

// ------------------------------------------------------------------ grade
export function criarGrade(min, max, h, folga = 0) {
  const o = [0, 1, 2].map((q) => min[q] - folga);
  const n = [0, 1, 2].map((q) => Math.max(2, Math.ceil((max[q] + folga - o[q]) / h) + 1));
  const total = n[0] * n[1] * n[2];
  if (total > 40e6) throw new Error(`grade grande demais (${(total / 1e6).toFixed(0)} milhões de células): aumente o passo`);
  return { nx: n[0], ny: n[1], nz: n[2], o, h, f: new Float32Array(total) };
}
export const gradeVazia = (g) => ({ nx: g.nx, ny: g.ny, nz: g.nz, o: g.o.slice(), h: g.h, f: new Float32Array(g.f.length) });
// f(x, y, z) em cada célula
export function preencherGrade(g, fn) {
  const { nx, ny, nz, o, h, f } = g;
  let n = 0;
  for (let k = 0; k < nz; k++) { const z = o[2] + k * h; for (let j = 0; j < ny; j++) { const y = o[1] + j * h; for (let i = 0; i < nx; i++) f[n++] = fn(o[0] + i * h, y, z, i, j, k); } }
  return g;
}
// valor interpolado (trilinear) na posição p; fora da grade → fora
export function amostrarGrade(g, x, y, z, fora = 1e3) {
  const { nx, ny, nz, o, h, f } = g;
  const a = (x - o[0]) / h, b = (y - o[1]) / h, c = (z - o[2]) / h;
  if (!(a >= 0 && b >= 0 && c >= 0 && a <= nx - 1 && b <= ny - 1 && c <= nz - 1)) return fora;
  const i = Math.min(nx - 2, Math.floor(a)), j = Math.min(ny - 2, Math.floor(b)), k = Math.min(nz - 2, Math.floor(c));
  const u = a - i, v = b - j, w = c - k, s = nx, t = nx * ny, q = i + s * j + t * k;
  const l = (p, d) => f[p] * (1 - d) + f[p + 1] * d;
  const y0 = l(q, u) * (1 - v) + l(q + s, u) * v, y1 = l(q + t, u) * (1 - v) + l(q + t + s, u) * v;
  return y0 * (1 - w) + y1 * w;
}

// ------------------------------------------------------------------ operações de campo
export const uniao = (a, b) => Math.min(a, b);
export const intersecao = (a, b) => Math.max(a, b);
export const diferenca = (a, b) => Math.max(a, -b);
// união suave (raio r, mm): arredonda o encontro das duas formas
export function uniaoSuave(a, b, r) {
  if (!(r > 0)) return Math.min(a, b);
  const t = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / r));
  return b * (1 - t) + a * t - r * t * (1 - t);
}
// distância aproximada a um elipsoide de semieixos r (Quilez), ponto já no referencial do elipsoide
export function elipsoide(x, y, z, rx, ry, rz) {
  const k0 = Math.hypot(x / rx, y / ry, z / rz), k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz));
  return k1 > 0 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
}

// ------------------------------------------------------------------ distância ponto-triângulo (Ericson, ponto mais próximo)
// T: Float64Array com 9 números por triângulo; devolve a distância ao quadrado
export function distancia2Triangulo(T, t, px, py, pz) {
  const o = t * 9, ax = T[o], ay = T[o + 1], az = T[o + 2], bx = T[o + 3], by = T[o + 4], bz = T[o + 5], cx = T[o + 6], cy = T[o + 7], cz = T[o + 8];
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let qx, qy, qz;
  if (d1 <= 0 && d2 <= 0) { qx = ax; qy = ay; qz = az; }
  else {
    const bpx = px - bx, bpy = py - by, bpz = pz - bz;
    const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { qx = bx; qy = by; qz = bz; }
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); qx = ax + v * abx; qy = ay + v * aby; qz = az + v * abz; }
      else {
        const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
        const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) { qx = cx; qy = cy; qz = cz; }
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); qx = ax + w * acx; qy = ay + w * acy; qz = az + w * acz; }
          else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); qx = bx + w * (cx - bx); qy = by + w * (cy - by); qz = bz + w * (cz - bz); }
            else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; qx = ax + abx * v + acx * w; qy = ay + aby * v + acy * w; qz = az + abz * v + acz * w; }
          }
        }
      }
    }
  }
  const dx = px - qx, dy = py - qy, dz = pz - qz;
  return dx * dx + dy * dy + dz * dz;
}

// triângulos de uma malha indexada { V, F } (já no referencial da grade) → Float64Array, 9 por triângulo,
// só os que tocam a caixa [min, max] (folga incluída)
export function triangulosNaCaixa(malha, min, max) {
  const { V, F } = malha, sel = [];
  for (let t = 0; t < F.length; t += 3) {
    const a = F[t] * 3, b = F[t + 1] * 3, c = F[t + 2] * 3;
    let fora = false;
    for (let q = 0; q < 3 && !fora; q++) {
      const lo = Math.min(V[a + q], V[b + q], V[c + q]), hi = Math.max(V[a + q], V[b + q], V[c + q]);
      if (hi < min[q] || lo > max[q]) fora = true;
    }
    if (!fora) sel.push(t);
  }
  const T = new Float64Array(sel.length * 9);
  sel.forEach((t, n) => { for (let k = 0; k < 3; k++) { const v = F[t + k] * 3; T[n * 9 + k * 3] = V[v]; T[n * 9 + k * 3 + 1] = V[v + 1]; T[n * 9 + k * 3 + 2] = V[v + 2]; } });
  return T;
}

// ------------------------------------------------------------------ campo de uma malha
// Dentro/fora: raios paralelos ao eixo z, vindos de cima (z máximo, fora do objeto), com paridade das travessias.
// final: "dentro" — toda coluna que cruza a superfície tem de terminar dentro (scan do rosto: a grade vai da pele
// para dentro da cabeça); colunas incoerentes (furo no scan) ou sem travessia são refeitas pelas vizinhas.
// final: "livre" — malha recortada (um nariz isolado): coluna sem travessia fica fora; nada é reparado.
// Distância exata até banda (mm) perto da superfície, propagada pelo triângulo mais próximo das vizinhas.
// → { f (na grade g, limitado a ±banda), colunas, reparadas, triangulos }
export function campoDeMalha(g, T, { banda = 3, final = "dentro" } = {}) {
  const { nx, ny, nz, o, h } = g, nt = T.length / 9, NC = nx * ny, N = NC * nz;
  // raios ligeiramente deslocados do centro das células (evita bater exatamente em arestas e vértices)
  const dx = h * 1.234567e-4, dy = h * 2.718281e-4;
  const cont = new Int32Array(NC + 1);
  const varrer = (cb) => {
    for (let t = 0; t < nt; t++) {
      const p = t * 9, x0 = T[p], y0 = T[p + 1], x1 = T[p + 3], y1 = T[p + 4], x2 = T[p + 6], y2 = T[p + 7];
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (Math.abs(area) < 1e-12) continue;
      const i0 = Math.max(0, Math.ceil((Math.min(x0, x1, x2) - o[0] - dx) / h)), i1 = Math.min(nx - 1, Math.floor((Math.max(x0, x1, x2) - o[0] - dx) / h));
      const j0 = Math.max(0, Math.ceil((Math.min(y0, y1, y2) - o[1] - dy) / h)), j1 = Math.min(ny - 1, Math.floor((Math.max(y0, y1, y2) - o[1] - dy) / h));
      for (let j = j0; j <= j1; j++) {
        const py = o[1] + j * h + dy;
        for (let i = i0; i <= i1; i++) {
          const px = o[0] + i * h + dx;
          const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area, w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area, w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          cb(i + nx * j, w0 * T[p + 2] + w1 * T[p + 5] + w2 * T[p + 8]);
        }
      }
    }
  };
  varrer((c) => cont[c + 1]++);
  for (let c = 0; c < NC; c++) cont[c + 1] += cont[c];
  const zs = new Float64Array(cont[NC]), pos = cont.slice(0, NC);
  varrer((c, z) => { zs[pos[c]++] = z; });
  // classificação por coluna
  const dentro = new Uint8Array(N), estado = new Uint8Array(NC);   // estado: 0 sem travessia, 1 coerente, 2 incoerente
  for (let c = 0; c < NC; c++) {
    const a = cont[c], b = cont[c + 1];
    if (a === b) { estado[c] = 0; continue; }
    // "dentro": travessias abaixo da grade não contam (scan fechado atrás, como uma máscara com tampa: a coluna sai de
    // novo pela tampa, mas isso fica fora da grade e não muda nenhuma célula)
    let lista = Array.from(zs.subarray(a, b));
    if (final === "dentro") lista = lista.filter((z) => z >= o[2] - h);
    lista.sort((p, q) => q - p);
    if (!lista.length) { estado[c] = 0; continue; }
    const z = [];
    for (const v of lista) if (!z.length || z[z.length - 1] - v > h * 1e-5) z.push(v); else z.pop();   // duas travessias no mesmo ponto se anulam
    // número par de travessias com a coluna terminando fora: a última é o fundo do scan (tampa de um scan fechado) e
    // é ignorada — tudo abaixo da pele conta como dentro. Uma travessia só e nenhuma ficam como antes.
    if (final === "dentro" && z.length >= 2 && z.length % 2 === 0) z.pop();
    if (final === "dentro" && z.length % 2 === 0) { estado[c] = z.length ? 2 : 0; continue; }
    estado[c] = 1;
    let q = 0, den = false;
    for (let k = nz - 1; k >= 0; k--) {
      const zk = o[2] + k * h;
      while (q < z.length && z[q] > zk) { den = !den; q++; }
      if (den) dentro[c + NC * k] = 1;
    }
  }
  let reparadas = 0;
  if (final === "dentro") {
    let validas = 0; for (let c = 0; c < NC; c++) if (estado[c] === 1) validas++;
    if (!validas) throw new Error("nenhuma coluna da grade atravessa a superfície: confira a região e o scan");
    // reparo em anéis: cada coluna incoerente toma, célula a célula, a maioria das vizinhas já resolvidas
    const ok = new Uint8Array(NC); for (let c = 0; c < NC; c++) ok[c] = estado[c] === 1 ? 1 : 0;
    let fila = [];
    const vizinhas = (c, fn) => { const i = c % nx, j = (c / nx) | 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { if (!a && !b) continue; const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < nx && jj < ny) fn(ii + nx * jj); } };
    for (let c = 0; c < NC; c++) if (!ok[c]) { let tem = false; vizinhas(c, (v) => { if (ok[v]) tem = true; }); if (tem) fila.push(c); }
    const marcada = new Uint8Array(NC); fila.forEach((c) => (marcada[c] = 1));
    while (fila.length) {
      const prox = [], feitas = [];
      for (const c of fila) {
        const viz = []; vizinhas(c, (v) => { if (ok[v]) viz.push(v); });
        for (let k = 0; k < nz; k++) { let s = 0; for (const v of viz) s += dentro[v + NC * k]; if (2 * s > viz.length || (2 * s === viz.length && k === 0)) dentro[c + NC * k] = 1; }
        feitas.push(c); reparadas++;
      }
      for (const c of feitas) ok[c] = 1;
      for (const c of feitas) vizinhas(c, (v) => { if (!ok[v] && !marcada[v]) { marcada[v] = 1; prox.push(v); } });
      fila = prox;
    }
  }
  // distância perto da superfície
  const d = new Float32Array(N).fill(Infinity), id = new Int32Array(N).fill(-1), r0 = 1.5 * h;
  for (let t = 0; t < nt; t++) {
    const p = t * 9; let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let v = 0; v < 3; v++) for (let q = 0; q < 3; q++) { const x = T[p + v * 3 + q]; if (x < lo[q]) lo[q] = x; if (x > hi[q]) hi[q] = x; }
    const i0 = Math.max(0, Math.ceil((lo[0] - r0 - o[0]) / h)), i1 = Math.min(nx - 1, Math.floor((hi[0] + r0 - o[0]) / h));
    const j0 = Math.max(0, Math.ceil((lo[1] - r0 - o[1]) / h)), j1 = Math.min(ny - 1, Math.floor((hi[1] + r0 - o[1]) / h));
    const k0 = Math.max(0, Math.ceil((lo[2] - r0 - o[2]) / h)), k1 = Math.min(nz - 1, Math.floor((hi[2] + r0 - o[2]) / h));
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = i + nx * (j + ny * k), q = Math.sqrt(distancia2Triangulo(T, t, o[0] + i * h, o[1] + j * h, o[2] + k * h));
      if (q < d[c]) { d[c] = q; id[c] = t; }
    }
  }
  // propagação em faixa estreita (fila): cada célula passa o seu triângulo às 26 vizinhas enquanto melhora e está na banda
  const lim = banda + h;
  let fila = new Int32Array(1 << 16), ini = 0, fim = 0;
  const por = (c) => { if (fim === fila.length) { if (ini > 0) { fila.copyWithin(0, ini, fim); fim -= ini; ini = 0; } if (fim === fila.length) { const nf = new Int32Array(fila.length * 2); nf.set(fila); fila = nf; } } fila[fim++] = c; };
  const naFila = new Uint8Array(N);
  for (let c = 0; c < N; c++) if (id[c] >= 0) { por(c); naFila[c] = 1; }
  while (ini < fim) {
    const c = fila[ini++]; naFila[c] = 0;
    const t = id[c], i = c % nx, j = ((c / nx) | 0) % ny, k = (c / NC) | 0;
    for (let e = -1; e <= 1; e++) { const kk = k + e; if (kk < 0 || kk >= nz) continue; const z = o[2] + kk * h;
      for (let b = -1; b <= 1; b++) { const jj = j + b; if (jj < 0 || jj >= ny) continue; const y = o[1] + jj * h;
        for (let a = -1; a <= 1; a++) { const ii = i + a; if (ii < 0 || ii >= nx || (!a && !b && !e)) continue;
          const v = ii + nx * (jj + ny * kk); if (id[v] === t) continue;
          const q = Math.sqrt(distancia2Triangulo(T, t, o[0] + ii * h, y, z));
          if (q < d[v] - 1e-6 && q <= lim) { d[v] = q; id[v] = t; if (!naFila[v]) { naFila[v] = 1; por(v); } }   // melhora real (d é float32: sem a margem, dois triângulos quase equidistantes se alternariam sem fim)
        } } }
  }
  const f = g.f;
  for (let c = 0; c < N; c++) { const q = Math.min(banda, d[c]); f[c] = dentro[c] ? -q : q; }
  let comSuperficie = 0; for (let c = 0; c < NC; c++) if (estado[c]) comSuperficie++;
  return { f, colunas: NC, comSuperficie, reparadas, triangulos: nt };
}

// ------------------------------------------------------------------ marching cubes
// Cantos do cubo: índice = x + 2y + 4z. Faces com os cantos em sentido anti-horário vistos de fora.
const CANTOS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const ARESTAS = [];
for (let a = 0; a < 8; a++) for (const bit of [1, 2, 4]) if (!(a & bit)) ARESTAS.push([a, a | bit, bit === 1 ? 0 : bit === 2 ? 1 : 2]);
const arestaDe = (a, b) => ARESTAS.findIndex((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a));
const FACES = (() => {
  const lista = [[0, 0, -1], [0, 1, 1], [1, 0, -1], [1, 1, 1], [2, 0, -1], [2, 1, 1]].map(([eixo, val, sinal]) => {
    const cs = [0, 1, 2, 3, 4, 5, 6, 7].filter((c) => CANTOS[c][eixo] === val);
    const [e1, e2] = [0, 1, 2].filter((q) => q !== eixo);
    const cen = [0.5, 0.5, 0.5];
    cs.sort((a, b) => Math.atan2(CANTOS[a][e2] - cen[e2], CANTOS[a][e1] - cen[e1]) - Math.atan2(CANTOS[b][e2] - cen[e2], CANTOS[b][e1] - cen[e1]));
    // confere o sentido pela normal de fora
    const p = cs.map((c) => CANTOS[c]), u = [0, 1, 2].map((q) => p[1][q] - p[0][q]), v = [0, 1, 2].map((q) => p[2][q] - p[0][q]);
    const nrm = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (nrm[eixo] * sinal < 0) cs.reverse();
    return cs;
  });
  return lista;
})();
// Para cada um dos 256 casos (bit c = canto c dentro): lista de ciclos de arestas. Em cada face, o segmento vai da
// aresta em que se sai da parte de dentro até a aresta por onde se entrou nela (dentro à esquerda, visto de fora);
// cantos de dentro em diagonal ficam separados. Como faces vizinhas percorrem a aresta comum em sentidos opostos,
// os segmentos se encadeiam em ciclos e cubos vizinhos concordam na face comum: superfície fechada.
const mesmaFace = (e1, e2) => FACES.some((cs) => [e1, e2].every((e) => cs.includes(ARESTAS[e][0]) && cs.includes(ARESTAS[e][1])));
const TABELA = (() => {
  const casos = [];
  for (let m = 0; m < 256; m++) {
    const dentro = (c) => !!(m & (1 << c)), prox = new Map();
    for (const cs of FACES) {
      for (let t = 0; t < 4; t++) {
        const p = cs[t], q = cs[(t + 1) % 4];
        if (!(dentro(p) && !dentro(q))) continue;
        let s = t; while (dentro(cs[(s + 3) % 4])) s = (s + 3) % 4;   // início da sequência de cantos de dentro que termina em p
        prox.set(arestaDe(p, q), arestaDe(cs[(s + 3) % 4], cs[s]));
      }
    }
    const ciclos = [], visto = new Set();
    for (const e0 of prox.keys()) {
      if (visto.has(e0)) continue;
      const ciclo = []; let e = e0;
      while (!visto.has(e)) { visto.add(e); ciclo.push(e); e = prox.get(e); }
      // dois vértices não consecutivos do ciclo na mesma face: a diagonal do leque poderia repetir uma aresta do cubo
      // vizinho (aresta com 4 triângulos). Nesses ciclos o leque sai de um vértice novo, no centro do ciclo.
      const n = ciclo.length;
      ciclo.centro = false;
      for (let a = 0; a < n && !ciclo.centro; a++) for (let b = a + 2; b < n; b++) { if (a === 0 && b === n - 1) continue; if (mesmaFace(ciclo[a], ciclo[b])) { ciclo.centro = true; break; } }
      ciclos.push(ciclo);
    }
    casos.push(ciclos);
  }
  return casos;
})();

// Superfície de nível 0 da grade (negativo = dentro) → { V: Float32Array, F: Uint32Array }, fechada e com normais
// para fora. Fora da grade conta como fora. lim (opcional): [i0, i1, j0, j1, k0, k1] em células, para recortar.
export function extrairSuperficie(g, { campo = g.f, lim } = {}) {
  const { nx, ny, nz, o, h } = g, f = campo, NXY = nx * ny;
  const [i0, i1, j0, j1, k0, k1] = lim || [0, nx - 1, 0, ny - 1, 0, nz - 1];
  const val = (i, j, k) => (i < i0 || j < j0 || k < k0 || i > i1 || j > j1 || k > k1 ? 1 : (f[i + nx * (j + ny * k)] || 1e-7));
  const V = [], F = [], mapa = new Map();
  const vc = new Float64Array(8), ids = new Int32Array(12);
  const W = nx + 2, WH = (nx + 2) * (ny + 2);
  for (let k = k0 - 1; k <= k1; k++) for (let j = j0 - 1; j <= j1; j++) for (let i = i0 - 1; i <= i1; i++) {
    let m = 0;
    for (let c = 0; c < 8; c++) { const v = val(i + (c & 1), j + ((c >> 1) & 1), k + (c >> 2)); vc[c] = v; if (v < 0) m |= 1 << c; }
    if (m === 0 || m === 255) continue;
    const ciclos = TABELA[m];
    for (const ciclo of ciclos) {
      for (const e of ciclo) {
        const [a, b, eixo] = ARESTAS[e], ca = CANTOS[a];
        const gi = i + ca[0] + 1, gj = j + ca[1] + 1, gk = k + ca[2] + 1, chave = ((gk * WH + gj * W + gi) * 3) + eixo;
        let v = mapa.get(chave);
        if (v === undefined) {
          let t = vc[a] / (vc[a] - vc[b]); t = Math.min(1 - 1e-4, Math.max(1e-4, t));
          const x = o[0] + (i + ca[0]) * h, y = o[1] + (j + ca[1]) * h, z = o[2] + (k + ca[2]) * h;
          v = V.length / 3; V.push(x + (eixo === 0 ? t * h : 0), y + (eixo === 1 ? t * h : 0), z + (eixo === 2 ? t * h : 0)); mapa.set(chave, v);
        }
        ids[e] = v;
      }
      // leque no sentido inverso do ciclo: normal para fora (para o lado positivo do campo)
      if (ciclo.centro) {
        let cx = 0, cy = 0, cz = 0; for (const e of ciclo) { cx += V[ids[e] * 3]; cy += V[ids[e] * 3 + 1]; cz += V[ids[e] * 3 + 2]; }
        const c = V.length / 3, n = ciclo.length; V.push(cx / n, cy / n, cz / n);
        for (let q = 0; q < n; q++) F.push(c, ids[ciclo[(q + 1) % n]], ids[ciclo[q]]);
      } else for (let q = 1; q + 1 < ciclo.length; q++) F.push(ids[ciclo[0]], ids[ciclo[q + 1]], ids[ciclo[q]]);
    }
  }
  return { V: new Float32Array(V), F: new Uint32Array(F) };
}

// ------------------------------------------------------------------ 2D: distância com sinal a um polígono (u, v)
export function distanciaPoligono(px, py, P) {
  let d2 = Infinity, dentro = false;
  for (let a = 0, b = P.length - 1; a < P.length; b = a++) {
    const [x1, y1] = P[b], [x2, y2] = P[a];
    if ((y2 > py) !== (y1 > py) && px < ((x1 - x2) * (py - y2)) / (y1 - y2) + x2) dentro = !dentro;
    const ex = x2 - x1, ey = y2 - y1, l = ex * ex + ey * ey, t = l > 0 ? Math.max(0, Math.min(1, ((px - x1) * ex + (py - y1) * ey) / l)) : 0;
    const qx = x1 + t * ex - px, qy = y1 + t * ey - py; d2 = Math.min(d2, qx * qx + qy * qy);
  }
  return dentro ? -Math.sqrt(d2) : Math.sqrt(d2);
}
// Distância euclidiana com sinal de uma máscara 2D (nx × ny, 1 = dentro), em mm (passo h). Felzenszwalb–Huttenlocher.
export function distanciaMascara2D(mask, nx, ny, h) {
  const INF = 1e20;
  const edt = (alvo) => {
    const g = new Float64Array(nx * ny);
    for (let c = 0; c < nx * ny; c++) g[c] = mask[c] === alvo ? 0 : INF;
    const um = (f, n) => {
      const d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1); let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < n; q++) {
        let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
      return d;
    };
    const lin = new Float64Array(Math.max(nx, ny));
    for (let j = 0; j < ny; j++) { for (let i = 0; i < nx; i++) lin[i] = g[i + nx * j]; const d = um(lin.subarray(0, nx), nx); for (let i = 0; i < nx; i++) g[i + nx * j] = d[i]; }
    for (let i = 0; i < nx; i++) { for (let j = 0; j < ny; j++) lin[j] = g[i + nx * j]; const d = um(lin.subarray(0, ny), ny); for (let j = 0; j < ny; j++) g[i + nx * j] = d[j]; }
    return g;
  };
  const fora = edt(1), den = edt(0), out = new Float32Array(nx * ny);
  for (let c = 0; c < nx * ny; c++) out[c] = mask[c] ? -(Math.sqrt(den[c]) - 0.5) * h : (Math.sqrt(fora[c]) - 0.5) * h;
  return out;
}
