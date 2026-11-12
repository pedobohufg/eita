/* EITA núcleo · decimar — simplificação de malha fechada por colapso de arestas com erro quadrático (Garland–Heckbert).
   Preserva a topologia (condição de enlace), não deixa triângulo virar do avesso e para quando o erro passaria da
   tolerância (mm): as faces planas (laterais de um molde) ficam com poucos triângulos e as curvas, com o necessário.
   Puro: navegador e Node. Entrada e saída: { V, F } (malha indexada).
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */

// fila de prioridade (mínimo) em vetores tipados que crescem
function criarFila() {
  let cap = 1024, n = 0, custo = new Float64Array(cap), a = new Int32Array(cap), b = new Int32Array(cap), sa = new Int32Array(cap), sb = new Int32Array(cap);
  const troca = (i, j) => {
    let t = custo[i]; custo[i] = custo[j]; custo[j] = t;
    let u = a[i]; a[i] = a[j]; a[j] = u; u = b[i]; b[i] = b[j]; b[j] = u; u = sa[i]; sa[i] = sa[j]; sa[j] = u; u = sb[i]; sb[i] = sb[j]; sb[j] = u;
  };
  return {
    get tamanho() { return n; },
    por(c, va, vb, ta, tb) {
      if (n === cap) {
        cap *= 2; const g = (x, T) => { const y = new T(cap); y.set(x); return y; };
        custo = g(custo, Float64Array); a = g(a, Int32Array); b = g(b, Int32Array); sa = g(sa, Int32Array); sb = g(sb, Int32Array);
      }
      let i = n++; custo[i] = c; a[i] = va; b[i] = vb; sa[i] = ta; sb[i] = tb;
      while (i > 0) { const p = (i - 1) >> 1; if (custo[p] <= custo[i]) break; troca(i, p); i = p; }
    },
    tirar() {
      const r = [custo[0], a[0], b[0], sa[0], sb[0]];
      n--; if (n > 0) {
        troca(0, n); let i = 0;
        for (;;) { const l = 2 * i + 1, d = l + 1; let m = i; if (l < n && custo[l] < custo[m]) m = l; if (d < n && custo[d] < custo[m]) m = d; if (m === i) break; troca(i, m); i = m; }
      }
      return r;
    }
  };
}

// tolerancia: desvio máximo aceito (mm); alvo: para ao chegar neste número de triângulos (0 = só a tolerância)
export function decimar(malha, { tolerancia = 0.02, alvo = 0 } = {}) {
  const nv = malha.V.length / 3, nf0 = malha.F.length / 3;
  const V = Float64Array.from(malha.V), F = Int32Array.from(malha.F), vivaF = new Uint8Array(nf0).fill(1), vivoV = new Uint8Array(nv).fill(1);
  const versao = new Int32Array(nv), Q = new Float64Array(nv * 10), faces = Array.from({ length: nv }, () => []);
  const normal = (x0, y0, z0, x1, y1, z1, x2, y2, z2) => { const ux = x1 - x0, uy = y1 - y0, uz = z1 - z0, vx = x2 - x0, vy = y2 - y0, vz = z2 - z0; return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; };
  for (let f = 0; f < nf0; f++) {
    const a = F[f * 3], b = F[f * 3 + 1], c = F[f * 3 + 2];
    faces[a].push(f); faces[b].push(f); faces[c].push(f);
    const n = normal(V[a * 3], V[a * 3 + 1], V[a * 3 + 2], V[b * 3], V[b * 3 + 1], V[b * 3 + 2], V[c * 3], V[c * 3 + 1], V[c * 3 + 2]), l = Math.hypot(n[0], n[1], n[2]);
    if (l < 1e-14) continue;
    const x = n[0] / l, y = n[1] / l, z = n[2] / l, d = -(x * V[a * 3] + y * V[a * 3 + 1] + z * V[a * 3 + 2]);
    const q = [x * x, x * y, x * z, x * d, y * y, y * z, y * d, z * z, z * d, d * d];
    for (const v of [a, b, c]) for (let k = 0; k < 10; k++) Q[v * 10 + k] += q[k];
  }
  const facesVivas = (v) => { const l = faces[v].filter((f) => vivaF[f]); faces[v] = l; return l; };
  const erro = (q, x, y, z) => q[0] * x * x + 2 * q[1] * x * y + 2 * q[2] * x * z + 2 * q[3] * x + q[4] * y * y + 2 * q[5] * y * z + 2 * q[6] * y + q[7] * z * z + 2 * q[8] * z + q[9];
  // melhor ponto para a aresta (a, b): o ótimo da quádrica somada, ou o melhor entre as pontas e o meio
  // custo pequeno pelo comprimento (desempata as regiões planas, onde o erro é zero: colapsa primeiro as arestas
  // curtas e evita leques de valência alta)
  const PESO_COMPR = 1e-6;
  const q = new Float64Array(10);
  function melhor(a, b) {
    for (let k = 0; k < 10; k++) q[k] = Q[a * 10 + k] + Q[b * 10 + k];
    const ax = V[a * 3], ay = V[a * 3 + 1], az = V[a * 3 + 2], bx = V[b * 3], by = V[b * 3 + 1], bz = V[b * 3 + 2];
    const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2, L2 = (ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2;
    let px = mx, py = my, pz = mz, e = erro(q, mx, my, mz);
    const ea = erro(q, ax, ay, az); if (ea < e) { e = ea; px = ax; py = ay; pz = az; }
    const eb = erro(q, bx, by, bz); if (eb < e) { e = eb; px = bx; py = by; pz = bz; }
    // ótimo da quádrica (regra de Cramer), se existir e não fugir da aresta
    const a00 = q[0], a01 = q[1], a02 = q[2], a11 = q[4], a12 = q[5], a22 = q[7], r0 = -q[3], r1 = -q[6], r2 = -q[8];
    const c00 = a11 * a22 - a12 * a12, c01 = a02 * a12 - a01 * a22, c02 = a01 * a12 - a02 * a11;
    const det = a00 * c00 + a01 * c01 + a02 * c02;
    if (Math.abs(det) > 1e-10) {
      const x = (r0 * c00 + r1 * c01 + r2 * c02) / det;
      const y = (a00 * (r1 * a22 - a12 * r2) - r0 * (a01 * a22 - a12 * a02) + a02 * (a01 * r2 - r1 * a02)) / det;
      const z = (a00 * (a11 * r2 - r1 * a12) - a01 * (a01 * r2 - r1 * a02) + r0 * (a01 * a12 - a11 * a02)) / det;
      if ((x - mx) ** 2 + (y - my) ** 2 + (z - mz) ** 2 <= L2) { const eo = erro(q, x, y, z); if (eo < e) { e = eo; px = x; py = y; pz = z; } }
    }
    return { p: [px, py, pz], e: Math.max(0, e) + PESO_COMPR * L2 };
  }
  const fila = criarFila();
  const vizinhos = (v) => { const s = new Set(); for (const f of facesVivas(v)) for (let k = 0; k < 3; k++) { const w = F[f * 3 + k]; if (w !== v) s.add(w); } return s; };
  const empurrar = (a, b) => { const m = melhor(a, b); fila.por(m.e, a, b, versao[a], versao[b]); };
  for (let f = 0; f < nf0; f++) for (let k = 0; k < 3; k++) { const a = F[f * 3 + k], b = F[f * 3 + (k + 1) % 3]; if (a < b) empurrar(a, b); }
  let nf = nf0;
  const lim = tolerancia * tolerancia;
  while (fila.tamanho && (!alvo || nf > alvo)) {
    const [c, a, b, ta, tb] = fila.tirar();
    if (!vivoV[a] || !vivoV[b] || versao[a] !== ta || versao[b] !== tb) continue;
    if (c > lim) break;
    const fa = facesVivas(a), fb = facesVivas(b);
    const comuns = fa.filter((f) => F[f * 3] === b || F[f * 3 + 1] === b || F[f * 3 + 2] === b);
    if (comuns.length !== 2) continue;
    // condição de enlace: os vizinhos comuns de a e b são só os dois vértices opostos à aresta
    const na = vizinhos(a), nb = vizinhos(b); let comum = 0; for (const w of na) if (nb.has(w)) comum++;
    if (comum !== 2 || na.size <= 2 || nb.size <= 2) continue;
    const { p } = melhor(a, b);
    // nenhum triângulo restante pode virar do avesso nem degenerar
    let ok = true;
    for (const f of fa.concat(fb)) {
      if (comuns.includes(f)) continue;
      const i = [F[f * 3], F[f * 3 + 1], F[f * 3 + 2]];
      const pt = (v) => [V[v * 3], V[v * 3 + 1], V[v * 3 + 2]];
      const ant = i.map(pt), dep = i.map((v) => (v === a || v === b ? p : pt(v)));
      const n0 = normal(...ant[0], ...ant[1], ...ant[2]), n1 = normal(...dep[0], ...dep[1], ...dep[2]);
      const l0 = Math.hypot(...n0), l1 = Math.hypot(...n1);
      if (l1 < 1e-12 || n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2] < 0.2 * l0 * l1) { ok = false; break; }
    }
    if (!ok) continue;
    // colapsa b em a
    V[a * 3] = p[0]; V[a * 3 + 1] = p[1]; V[a * 3 + 2] = p[2];
    for (let k = 0; k < 10; k++) Q[a * 10 + k] += Q[b * 10 + k];
    for (const f of comuns) { vivaF[f] = 0; nf--; }
    for (const f of fb) { if (!vivaF[f]) continue; for (let k = 0; k < 3; k++) if (F[f * 3 + k] === b) F[f * 3 + k] = a; faces[a].push(f); }
    vivoV[b] = 0; faces[b] = [];
    // só as arestas de a mudam de custo (as demais quádricas e posições ficam iguais)
    versao[a]++;
    for (const w of vizinhos(a)) empurrar(a, w);
  }
  // compacta
  const novo = new Int32Array(nv).fill(-1), V2 = [], F2 = [];
  for (let f = 0; f < nf0; f++) {
    if (!vivaF[f]) continue;
    for (let k = 0; k < 3; k++) { const v = F[f * 3 + k]; if (novo[v] < 0) { novo[v] = V2.length / 3; V2.push(V[v * 3], V[v * 3 + 1], V[v * 3 + 2]); } F2.push(novo[v]); }
  }
  return { V: new Float32Array(V2), F: new Uint32Array(F2) };
}
