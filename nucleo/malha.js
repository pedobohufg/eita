/* EITA núcleo · malha — sólidos fechados a partir de campos de altura, STL binário e volume.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */

export function indicesAdaptativos(xs, zonaFina, passoGrosso) {
  const dx = xs[1] - xs[0], salto = Math.max(1, Math.round(passoGrosso / dx)), out = [];
  for (let i = 0; i < xs.length; i++) if (Math.abs(xs[i]) <= zonaFina || i % salto === 0 || i === 0 || i === xs.length - 1) out.push(i);
  return out;
};

// sólido fechado entre dois campos de altura (grade idx×idx), com faces planas opcionais em leque
export function solido(xs, idx, n, Zb, Zt, mask, cimaPlano, baixoPlano) {
  const m = idx.length, no = (a, b) => idx[a] * n + idx[b];
  const cel = new Uint8Array((m - 1) * (m - 1));
  const usado = new Uint8Array(m * m);
  for (let j = 0; j < m - 1; j++) for (let i = 0; i < m - 1; i++)
    if (mask[no(j, i)] && mask[no(j + 1, i)] && mask[no(j, i + 1)] && mask[no(j + 1, i + 1)]) {
      cel[j * (m - 1) + i] = 1; usado[j * m + i] = usado[(j + 1) * m + i] = usado[j * m + i + 1] = usado[(j + 1) * m + i + 1] = 1;
    }
  const vid = new Int32Array(m * m).fill(-1); let nv = 0;
  for (let q = 0; q < m * m; q++) if (usado[q]) vid[q] = nv++;
  const extra = 2;
  const V = new Float32Array((2 * nv + extra) * 3);
  for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
    const v = vid[j * m + i]; if (v < 0) continue;
    const g = no(j, i), x = xs[idx[i]], y = xs[idx[j]];
    V.set([x, y, Zt[g]], 3 * v); V.set([x, y, Zb[g]], 3 * (v + nv));
  }
  const F = [];
  const tri = (a, b, c) => { F.push(a, b, c); };
  // laço do contorno (máscara retangular)
  let laco = null;
  if (cimaPlano || baixoPlano) {
    let j0 = m, j1 = -1, i0 = m, i1 = -1, cnt = 0;
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) if (usado[j * m + i]) { cnt++; if (j < j0) j0 = j; if (j > j1) j1 = j; if (i < i0) i0 = i; if (i > i1) i1 = i; }
    if (cnt === (j1 - j0 + 1) * (i1 - i0 + 1)) {
      laco = [];
      for (let i = i0; i < i1; i++) laco.push(vid[j0 * m + i]);
      for (let j = j0; j < j1; j++) laco.push(vid[j * m + i1]);
      for (let i = i1; i > i0; i--) laco.push(vid[j1 * m + i]);
      for (let j = j1; j > j0; j--) laco.push(vid[j * m + i0]);
    }
  }
  let prox = 2 * nv;
  const leque = (off, cima) => {
    let sx = 0, sy = 0, sz = 0;
    for (const v of laco) { sx += V[3 * (v + off)]; sy += V[3 * (v + off) + 1]; sz += V[3 * (v + off) + 2]; }
    const c = prox++; V.set([sx / laco.length, sy / laco.length, sz / laco.length], 3 * c);
    for (let t = 0; t < laco.length; t++) { const a = laco[t] + off, b = laco[(t + 1) % laco.length] + off; if (cima) tri(c, a, b); else tri(c, b, a); }
  };
  if (cimaPlano && laco) leque(0, true);
  else for (let j = 0; j < m - 1; j++) for (let i = 0; i < m - 1; i++) if (cel[j * (m - 1) + i]) { const a = vid[j * m + i], b = vid[j * m + i + 1], c = vid[(j + 1) * m + i], d = vid[(j + 1) * m + i + 1]; tri(a, b, d); tri(a, d, c); }
  if (baixoPlano && laco) leque(nv, false);
  else for (let j = 0; j < m - 1; j++) for (let i = 0; i < m - 1; i++) if (cel[j * (m - 1) + i]) { const a = vid[j * m + i] + nv, b = vid[j * m + i + 1] + nv, c = vid[(j + 1) * m + i] + nv, d = vid[(j + 1) * m + i + 1] + nv; tri(a, d, b); tri(a, c, d); }
  const ativo = (j, i) => j >= 0 && i >= 0 && j < m - 1 && i < m - 1 && cel[j * (m - 1) + i];
  for (let j = 0; j < m - 1; j++) for (let i = 0; i < m - 1; i++) {
    if (!cel[j * (m - 1) + i]) continue;
    const lados = [[-1, 0, [0, 0], [0, 1]], [1, 0, [1, 1], [1, 0]], [0, -1, [1, 0], [0, 0]], [0, 1, [0, 1], [1, 1]]];
    for (const [dj, di, A, B] of lados) {
      if (ativo(j + dj, i + di)) continue;
      const pa = vid[(j + A[0]) * m + i + A[1]], pb = vid[(j + B[0]) * m + i + B[1]];
      tri(pa, pb + nv, pb); tri(pa, pa + nv, pb + nv);
    }
  }
  return { V: V.subarray(0, 3 * prox), F: Uint32Array.from(F) };
};

export function stl(malha, transformar, cabecalho = "Lab.EITA/UFG") {
  const { V, F } = malha, nt = F.length / 3, buf = new ArrayBuffer(84 + 50 * nt), dv = new DataView(buf);
  const cab = String(cabecalho).slice(0, 80); for (let i = 0; i < cab.length; i++) dv.setUint8(i, cab.charCodeAt(i) & 0x7f);
  dv.setUint32(80, nt, true);
  const p = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let t = 0; t < nt; t++) {
    let o = 84 + 50 * t;
    for (let k = 0; k < 3; k++) { const v = F[3 * t + k]; let x = V[3 * v], y = V[3 * v + 1], z = V[3 * v + 2]; if (transformar) [x, y, z] = transformar(x, y, z); p[3 * k] = x; p[3 * k + 1] = y; p[3 * k + 2] = z; }
    if (transformar && transformar.inverte) { for (let c = 0; c < 3; c++) { const tmp = p[3 + c]; p[3 + c] = p[6 + c]; p[6 + c] = tmp; } }
    const ux = p[3] - p[0], uy = p[4] - p[1], uz = p[5] - p[2], vx = p[6] - p[0], vy = p[7] - p[1], vz = p[8] - p[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
    dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true); o += 12;
    for (let k = 0; k < 9; k++) { dv.setFloat32(o, p[k], true); o += 4; }
  }
  return buf;
};

export function volume(malha) {
  const { V, F } = malha; let s = 0;
  for (let t = 0; t < F.length; t += 3) {
    const a = 3 * F[t], b = 3 * F[t + 1], c = 3 * F[t + 2];
    s += V[a] * (V[b + 1] * V[c + 2] - V[b + 2] * V[c + 1]) - V[a + 1] * (V[b] * V[c + 2] - V[b + 2] * V[c]) + V[a + 2] * (V[b] * V[c + 1] - V[b + 1] * V[c]);
  }
  return s / 6;
};

// Confere se a malha é um sólido fechado e bem orientado: cada aresta orientada (a→b) aparece
// exatamente uma vez e a aresta inversa (b→a) também aparece exatamente uma vez.
export function verificarFechada(malha) {
  const { F } = malha, conta = new Map();
  const chave = (a, b) => a * 4294967296 + b;
  for (let t = 0; t < F.length; t += 3) for (let k = 0; k < 3; k++) {
    const c = chave(F[t + k], F[t + (k + 1) % 3]); conta.set(c, (conta.get(c) || 0) + 1);
  }
  let abertas = 0, repetidas = 0;
  for (const [c, n] of conta) {
    if (n > 1) repetidas++;
    const a = Math.floor(c / 4294967296), b = c % 4294967296;
    if (!conta.has(chave(b, a))) abertas++;
  }
  return { fechada: abertas === 0 && repetidas === 0, arestas_abertas: abertas, arestas_repetidas: repetidas, triangulos: F.length / 3 };
}

// ------------------------------------------------------------------ malhas em "sopa de triângulos" (EITA! OLHO)
// { pos: Float32Array (9 por triângulo), col: Float32Array (cor por vértice), vol (mm³), ntri }

// Sólido de revolução: perfil(θ, i) → [[r, z], …] para cada um dos nT ângulos; corDe(ponto, k, i) → [r,g,b].
// fechado = o perfil volta ao primeiro ponto. Triângulos degenerados são descartados e a orientação
// é ajustada para volume positivo (normais para fora).
export function revolucao(nT, perfil, corDe, fechado) {
  const TAU = 2 * Math.PI, rows = []; let nP = 0;
  for (let i = 0; i < nT; i++) { const th = i / nT * TAU, p = perfil(th, i); nP = p.length; rows.push(p.map(([r, z]) => [r * Math.cos(th), r * Math.sin(th), z])); }
  const nSeg = fechado ? nP : nP - 1;
  const pos = new Float32Array(nT * nSeg * 18), col = new Float32Array(nT * nSeg * 18);
  let n = 0;
  const put = (a, b, c, ca, cb, cc) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * cx + cy * cy + cz * cz < 1e-14) return;
    pos.set(a, n); pos.set(b, n + 3); pos.set(c, n + 6);
    col.set(ca, n); col.set(cb, n + 3); col.set(cc, n + 6); n += 9;
  };
  const cols = corDe ? rows.map((row, i) => row.map((p, k) => corDe(p, k, i))) : null;
  const def = [0.8, 0.8, 0.8];
  for (let i = 0; i < nT; i++) {
    const i2 = (i + 1) % nT;
    for (let k = 0; k < nSeg; k++) {
      const k2 = (k + 1) % nP;
      const a = rows[i][k], b = rows[i][k2], c = rows[i2][k2], d = rows[i2][k];
      const A = cols ? cols[i][k] : def, B = cols ? cols[i][k2] : def, C = cols ? cols[i2][k2] : def, D = cols ? cols[i2][k] : def;
      put(a, b, c, A, B, C); put(a, c, d, A, C, D);
    }
  }
  const P = pos.subarray(0, n), Cc = col.subarray(0, n);
  let vol = 0;
  for (let t = 0; t < n; t += 9) vol += P[t] * (P[t + 4] * P[t + 8] - P[t + 5] * P[t + 7]) - P[t + 1] * (P[t + 3] * P[t + 8] - P[t + 5] * P[t + 6]) + P[t + 2] * (P[t + 3] * P[t + 7] - P[t + 4] * P[t + 6]);
  if (vol < 0) {
    for (let t = 0; t < n; t += 9) for (let q = 0; q < 3; q++) {
      let s = P[t + 3 + q]; P[t + 3 + q] = P[t + 6 + q]; P[t + 6 + q] = s;
      s = Cc[t + 3 + q]; Cc[t + 3 + q] = Cc[t + 6 + q]; Cc[t + 6 + q] = s;
    }
  }
  return { pos: P.slice(), col: Cc.slice(), vol: Math.abs(vol) / 6, ntri: n / 9 };
}
// normal de face repetida nos 3 vértices (para o visualizador)
export function normaisDeFace(pos) {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < pos.length; t += 9) {
    const ux = pos[t + 3] - pos[t], uy = pos[t + 4] - pos[t + 1], uz = pos[t + 5] - pos[t + 2], vx = pos[t + 6] - pos[t], vy = pos[t + 7] - pos[t + 1], vz = pos[t + 8] - pos[t + 2];
    let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx; const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
    for (let q = 0; q < 3; q++) { n[t + q * 3] = x; n[t + q * 3 + 1] = y; n[t + q * 3 + 2] = z; }
  }
  return n;
}
// STL binário de uma ou mais malhas em sopa de triângulos (cabeçalho completado com espaços)
export function stlTriangulos(partes, cabecalho = "Lab.EITA/UFG") {
  let n = 0; partes.forEach((p) => (n += p.pos.length / 9));
  const buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
  for (let i = 0; i < 80; i++) dv.setUint8(i, i < cabecalho.length ? cabecalho.charCodeAt(i) & 127 : 32);
  dv.setUint32(80, n, true); let o = 84;
  for (const p of partes) {
    const P = p.pos;
    for (let t = 0; t < P.length; t += 9) {
      const ux = P[t + 3] - P[t], uy = P[t + 4] - P[t + 1], uz = P[t + 5] - P[t + 2], vx = P[t + 6] - P[t], vy = P[t + 7] - P[t + 1], vz = P[t + 8] - P[t + 2];
      let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx; const l = Math.hypot(x, y, z) || 1;
      dv.setFloat32(o, x / l, true); dv.setFloat32(o + 4, y / l, true); dv.setFloat32(o + 8, z / l, true); o += 12;
      for (let q = 0; q < 9; q++) { dv.setFloat32(o, P[t + q], true); o += 4; }
      dv.setUint16(o, 0, true); o += 2;
    }
  }
  return new Uint8Array(buf);
}

// ------------------------------------------------------------------ malhas indexadas lidas de arquivo (EITA! AFO)
// { V: coordenadas (3 por vértice), F: Uint32Array (3 índices por triângulo) }, a mesma forma usada por stl() e volume().

// Lê STL binário ou ASCII → sopa de triângulos (Float32Array, 9 números por triângulo).
// Binário só quando o tamanho bate exatamente com o número de triângulos do cabeçalho.
export function lerSTL(buf) {
  const dv = new DataView(buf);
  if (buf.byteLength >= 84) {
    const nt = dv.getUint32(80, true);
    if (84 + nt * 50 === buf.byteLength) {
      const out = new Float32Array(nt * 9);
      for (let t = 0; t < nt; t++) { const o = 84 + t * 50 + 12; for (let k = 0; k < 9; k++) out[t * 9 + k] = dv.getFloat32(o + k * 4, true); }
      return out;
    }
  }
  const texto = new TextDecoder().decode(buf), re = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g, v = [];
  let m;
  while ((m = re.exec(texto))) v.push(+m[1], +m[2], +m[3]);
  if (v.length < 9 || v.length % 9) throw new Error("Arquivo STL não reconhecido");
  return new Float32Array(v);
}

// Solda os vértices de uma sopa de triângulos numa grade de passo tol (mm) e descarta triângulos degenerados.
// → { V: Float64Array, F: Uint32Array }. A ordem dos vértices é a da primeira ocorrência.
export function soldar(sopa, tol = 1e-4) {
  const mapa = new Map(), V = [], nt = sopa.length / 9, idx = new Uint32Array(nt * 3);
  for (let i = 0; i < nt * 3; i++) {
    const x = sopa[i * 3], y = sopa[i * 3 + 1], z = sopa[i * 3 + 2];
    const chave = Math.round(x / tol) + "_" + Math.round(y / tol) + "_" + Math.round(z / tol);
    let k = mapa.get(chave);
    if (k === undefined) { k = V.length / 3; mapa.set(chave, k); V.push(x, y, z); }
    idx[i] = k;
  }
  const F = [];
  for (let t = 0; t < nt; t++) { const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2]; if (a !== b && b !== c && a !== c) F.push(a, b, c); }
  return { V: new Float64Array(V), F: new Uint32Array(F) };
}

// Partes conectadas (união-busca pelos triângulos): mantém as que têm pelo menos fracao × (triângulos da maior)
// e reindexa os vértices na ordem de uso. → { V: Float64Array, F, componentes, mantidos }
export function filtrarComponentes(V, F, fracao) {
  const nv = V.length / 3, pai = new Int32Array(nv);
  for (let i = 0; i < nv; i++) pai[i] = i;
  const raiz = (i) => { while (pai[i] !== i) { pai[i] = pai[pai[i]]; i = pai[i]; } return i; };
  const unir = (a, b) => { a = raiz(a); b = raiz(b); if (a !== b) pai[a] = b; };
  for (let t = 0; t < F.length; t += 3) { unir(F[t], F[t + 1]); unir(F[t + 1], F[t + 2]); }
  const tam = new Map();
  for (let t = 0; t < F.length; t += 3) { const r = raiz(F[t]); tam.set(r, (tam.get(r) || 0) + 1); }
  const maior = Math.max(...tam.values()), ficam = new Set([...tam].filter(([, n]) => n >= fracao * maior).map(([r]) => r));
  const Fsel = [];
  for (let t = 0; t < F.length; t += 3) if (ficam.has(raiz(F[t]))) Fsel.push(F[t], F[t + 1], F[t + 2]);
  const novo = new Int32Array(nv).fill(-1), V2 = [], F2 = new Uint32Array(Fsel.length);
  for (let i = 0; i < Fsel.length; i++) {
    const v = Fsel[i];
    if (novo[v] < 0) { novo[v] = V2.length / 3; V2.push(V[v * 3], V[v * 3 + 1], V[v * 3 + 2]); }
    F2[i] = novo[v];
  }
  return { V: new Float64Array(V2), F: F2, componentes: tam.size, mantidos: ficam.size };
}

// Número de arestas que pertencem a um só triângulo (0 = superfície fechada).
export function contarArestasDeBorda(F) {
  const conta = new Map();
  for (let t = 0; t < F.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = F[t + k], b = F[t + (k + 1) % 3], c = a < b ? a * 4294967296 + b : b * 4294967296 + a;
    conta.set(c, (conta.get(c) || 0) + 1);
  }
  let n = 0;
  for (const c of conta.values()) if (c === 1) n++;
  return n;
}

// Duplica os vértices em quinas mais vivas que "angulo" (graus), para o sombreamento suave não borrar as quinas.
// → { V, F, mapa } — mapa[i] = vértice original do i-ésimo vértice acrescentado (null se nada mudou; aí V é o próprio).
export function separarVincos(V, F, angulo) {
  const nv = V.length / 3, nt = F.length / 3, lim = Math.cos((angulo / 180) * Math.PI), N = new Float32Array(nt * 3);
  for (let t = 0; t < nt; t++) {
    const a = F[t * 3] * 3, b = F[t * 3 + 1] * 3, c = F[t * 3 + 2] * 3;
    const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2], vx = V[c] - V[a], vy = V[c + 1] - V[a + 1], vz = V[c + 2] - V[a + 2];
    let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    const l = Math.hypot(x, y, z) || 1;
    N[t * 3] = x / l; N[t * 3 + 1] = y / l; N[t * 3 + 2] = z / l;
  }
  // cantos de cada vértice (CSR)
  const ini = new Uint32Array(nv + 1);
  for (let i = 0; i < F.length; i++) ini[F[i] + 1]++;
  for (let i = 0; i < nv; i++) ini[i + 1] += ini[i];
  const cantos = new Uint32Array(F.length), pos = ini.slice(0, nv);
  for (let i = 0; i < F.length; i++) cantos[pos[F[i]]++] = i;
  const F2 = Uint32Array.from(F), extra = [], mapa = [];
  let prox = nv;
  for (let v = 0; v < nv; v++) {
    const grupos = [];
    for (let j = ini[v]; j < ini[v + 1]; j++) {
      const canto = cantos[j], t = (canto / 3) | 0;
      let g = -1;
      for (let q = 0; q < grupos.length; q++) { const n = grupos[q].n; if (n[0] * N[t * 3] + n[1] * N[t * 3 + 1] + n[2] * N[t * 3 + 2] > lim) { g = q; break; } }
      if (g < 0) {
        grupos.push({ n: [N[t * 3], N[t * 3 + 1], N[t * 3 + 2]], id: grupos.length ? prox++ : v });
        if (grupos.length > 1) { extra.push(V[v * 3], V[v * 3 + 1], V[v * 3 + 2]); mapa.push(v); }
        g = grupos.length - 1;
      }
      F2[canto] = grupos[g].id;
    }
  }
  if (!extra.length) return { V, F, mapa: null };
  const V2 = new Float32Array(V.length + extra.length);
  V2.set(V); V2.set(extra, V.length);
  return { V: V2, F: F2, mapa };
}

// Normais por vértice (soma das normais de face, com peso pela área) → Float32Array, 3 por vértice.
// Autocontida: o AFO a copia como texto para o Worker da casca.
export function normaisDeVertices(V, F) {
  const n = new Float32Array(V.length);
  for (let t = 0; t < F.length; t += 3) {
    const a = F[t] * 3, b = F[t + 1] * 3, c = F[t + 2] * 3;
    const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2], vx = V[c] - V[a], vy = V[c + 1] - V[a + 1], vz = V[c + 2] - V[a + 2];
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    for (const i of [a, b, c]) { n[i] += x; n[i + 1] += y; n[i + 2] += z; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}
