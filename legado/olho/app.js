/* EITA! OLHO — © 2026 Lab.EITA/UFG. Todos os direitos reservados. */
'use strict';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ estado */
const S = {
  img: null, W: 0, H: 0, px: null,            // foto (RGBA)
  wb: [1, 1, 1],
  iris: null, pup: null,                      // {x,y,r} em px da foto
  ruler: null, rulerPts: [],
  mode: 'edit',                               // edit | wb | ruler
  view: { z: 1, tx: 0, ty: 0 },
  tab: 'photo',
  unw: null, clean: null, mask: null,         // íris desenrolada (NT x NR x 3)
  tex: null, hm: null,                        // textura (canvas) e mapa de alturas (Float32)
  meshes: null, dirty: true,
};
const NT = 1024, NR = 256;                   // grade da íris desenrolada
const TEX = 1024, HM = 512;                   // textura e mapa de alturas

/* ------------------------------------------------------------- utilidades UI */
function status(t) { $('status').innerHTML = t; }
function busy(on, t) { $('busy').style.display = on ? 'grid' : 'none'; if (t) $('busyT').textContent = t; }
const num = id => parseFloat($(id).value);
function fmt(v, d = 2) { return Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '—'; }

const STEPS = [['s1', 'Foto'], ['s2', 'Íris'], ['s3', 'Escala'], ['s4', 'Limpeza'], ['s5', 'Relevo'], ['s6', 'Prótese'], ['s7', 'Exportar']];
function buildStepper() {
  const nav = $('stepper'); nav.innerHTML = '';
  STEPS.forEach(([id, name], i) => {
    const b = document.createElement('button'); b.type = 'button';
    b.innerHTML = `<span class="n">${i + 1}</span>${name}`;
    b.onclick = () => openSection(id);
    b.dataset.s = id; nav.appendChild(b);
  });
}
function openSection(id) {
  const s = $(id); if (s.classList.contains('off')) return;
  document.querySelectorAll('#panel section').forEach(x => x.classList.toggle('collapsed', x.id !== id));
  document.querySelectorAll('#stepper button').forEach(b => b.classList.toggle('cur', b.dataset.s === id));
  s.scrollIntoView({ block: 'nearest' });
  if (id === 's4' || id === 's5') setTab('iris');
  if (id === 's6' || id === 's7') { if (S.meshes) setTab('3d'); }
  if (id === 's2' || id === 's3') setTab('photo');
}
document.querySelectorAll('#panel section>h2').forEach(h => h.onclick = () => {
  const s = h.parentElement; if (s.classList.contains('off')) return;
  if (s.classList.contains('collapsed')) openSection(s.id); else s.classList.add('collapsed');
});
function enableUpTo(n) {
  STEPS.forEach(([id], i) => {
    $(id).classList.toggle('off', i >= n);
    const b = document.querySelector(`#stepper button[data-s=${id}]`);
    if (b) b.classList.toggle('done', i < n - 1);
  });
}
/* liga número <-> range */
function pair(n, r) { $(r).oninput = () => { $(n).value = $(r).value; changed(); }; $(n).addEventListener('input', () => { $(r).value = $(n).value; }); }
[['specThr', 'specThrR'], ['cBri', 'cBriR'], ['cCon', 'cConR'], ['cSat', 'cSatR'], ['hDepth', 'hDepthR'], ['hDetail', 'hDetailR'], ['hTrans', 'hTransR'], ['sShell', 'sShellR']].forEach(p => pair(...p));

/* --------------------------------------------------------------- carregar foto */
$('drop').onclick = () => $('file').click();
$('file').onchange = e => { if (e.target.files[0]) loadFile(e.target.files[0]); };
['dragover', 'dragenter'].forEach(ev => $('drop').addEventListener(ev, e => { e.preventDefault(); $('drop').classList.add('hover'); }));
['dragleave', 'drop'].forEach(ev => $('drop').addEventListener(ev, e => { e.preventDefault(); $('drop').classList.remove('hover'); }));
$('drop').addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) loadFile(f); });
$('view').addEventListener('dragover', e => e.preventDefault());
$('view').addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image')) loadFile(f); });
$('demo').onclick = () => loadURL('assets/olho-exemplo.jpg', 'foto de exemplo (sintética)');

function loadFile(f) { const u = URL.createObjectURL(f); loadURL(u, f.name); }
function loadURL(url, name) {
  const im = new Image();
  im.onload = () => setImage(im, name);
  im.onerror = () => status('Não consegui abrir essa imagem. Use JPG ou PNG.');
  im.src = url;
}
window.__eitaLoad = loadURL; // usado nos testes
function setImage(im, name) {
  const maxS = 1800, k = Math.min(1, maxS / Math.max(im.naturalWidth, im.naturalHeight));
  const W = Math.round(im.naturalWidth * k), H = Math.round(im.naturalHeight * k);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0, W, H);
  S.img = c; S.W = W; S.H = H; S.px = g.getImageData(0, 0, W, H).data; S.photoName = name;
  S.wb = [1, 1, 1]; S.iris = S.pup = null; S.ruler = null; S.meshes = null;
  $('imgInfo').textContent = `${name} · ${W} × ${H} px${k < 1 ? ' (reduzida)' : ''}`;
  $('empty').hidden = true;
  fitView(); setTab('photo');
  enableUpTo(2); openSection('s2');
  detect();
}

/* --------------------------------------------------------------- amostragem */
function sample(x, y, out) { // bilinear com balanço de branco, 0..1
  const W = S.W, H = S.H, p = S.px;
  x = clamp(x, 0, W - 1.001); y = clamp(y, 0, H - 1.001);
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
  const i00 = (y0 * W + x0) * 4, i10 = i00 + 4, i01 = i00 + W * 4, i11 = i01 + 4;
  for (let c = 0; c < 3; c++) {
    const v = (p[i00 + c] * (1 - fx) + p[i10 + c] * fx) * (1 - fy) + (p[i01 + c] * (1 - fx) + p[i11 + c] * fx) * fy;
    out[c] = Math.min(1, v / 255 * S.wb[c]);
  }
  return out;
}

/* ---------------------------------------------------- detecção íris/pupila */
function grayDown(maxW) {
  const k = Math.min(1, maxW / S.W), w = Math.round(S.W * k), h = Math.round(S.H * k);
  const g = new Float32Array(w * h), o = [0, 0, 0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    sample((x + .5) / k - .5, (y + .5) / k - .5, o);
    g[y * w + x] = 0.3 * o[0] + 0.59 * o[1] + 0.11 * o[2];
  }
  return { g, w, h, k };
}
function blur1(src, w, h, s, wrapX = false) { // gaussiano separável
  if (s < 0.3) return src.slice();
  const r = Math.ceil(s * 3), ker = new Float32Array(2 * r + 1); let sum = 0;
  for (let i = -r; i <= r; i++) { ker[i + r] = Math.exp(-i * i / (2 * s * s)); sum += ker[i + r]; }
  for (let i = 0; i < ker.length; i++) ker[i] /= sum;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0; for (let i = -r; i <= r; i++) { let xx = x + i; xx = wrapX ? ((xx % w) + w) % w : clamp(xx, 0, w - 1); a += src[y * w + xx] * ker[i + r]; }
    tmp[y * w + x] = a;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0; for (let i = -r; i <= r; i++) { const yy = clamp(y + i, 0, h - 1); a += tmp[yy * w + x] * ker[i + r]; }
    out[y * w + x] = a;
  }
  return out;
}
function bil(g, w, h, x, y) {
  x = clamp(x, 0, w - 1.001); y = clamp(y, 0, h - 1.001);
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
  return (g[i] * (1 - fx) + g[i + 1] * fx) * (1 - fy) + (g[i + w] * (1 - fx) + g[i + w + 1] * fx) * fy;
}
/* operador integro-diferencial (Daugman): maior salto de brilho médio ao longo do círculo */
function bestCircle(G, cx0, cy0, span, step, rmin, rmax, angs) {
  const { g, w, h } = G; let best = { s: -1e9 };
  const ca = angs.map(Math.cos), sa = angs.map(Math.sin), na = angs.length;
  const nr = Math.max(3, Math.floor(rmax - rmin) + 1), M = new Float32Array(nr);
  for (let cy = cy0 - span; cy <= cy0 + span; cy += step) for (let cx = cx0 - span; cx <= cx0 + span; cx += step) {
    for (let k = 0; k < nr; k++) {
      const r = rmin + k; let a = 0;
      for (let j = 0; j < na; j++) a += bil(g, w, h, cx + r * ca[j], cy - r * sa[j]);
      M[k] = a / na;
    }
    for (let k = 2; k < nr - 2; k++) {
      const d = (M[k + 1] + M[k + 2] - M[k - 1] - M[k - 2]) / 4;
      if (d > best.s) best = { s: d, x: cx, y: cy, r: rmin + k };
    }
  }
  return best;
}
function detect(seed) {
  if (!S.img) return;
  busy(true, 'Procurando a íris…');
  setTimeout(() => {
    const G = grayDown(420); G.g = blur1(G.g, G.w, G.h, 1.2);
    const { w, h, k } = G;
    // 1) chute da pupila: região mais escura (ou o ponto clicado)
    let gx, gy;
    if (seed) { gx = seed.x * k; gy = seed.y * k; }
    else {
      const B = blur1(G.g, w, h, w / 45); let mn = 1e9;
      for (let y = Math.round(h * .12); y < h * .88; y++) for (let x = Math.round(w * .12); x < w * .88; x++) if (B[y * w + x] < mn) { mn = B[y * w + x]; gx = x; gy = y; }
    }
    const full = []; for (let i = 0; i < 48; i++) full.push(i / 48 * TAU);
    const lat = []; for (let i = 0; i < 40; i++) { const t = (-40 + i * 80 / 19) * Math.PI / 180; if (i < 20) lat.push(t); else lat.push(Math.PI + (-40 + (i - 20) * 80 / 19) * Math.PI / 180); }
    // 2) íris primeiro (maior contraste, só arcos laterais: pálpebras cobrem em cima e embaixo)
    let I = bestCircle(G, Math.round(gx), Math.round(gy), Math.round(w / 18), 2, Math.max(6, w * .04), Math.min(w, h) * .48, lat);
    I = bestCircle(G, I.x, I.y, 2, 0.5, I.r * .9, I.r * 1.1, lat);
    // 3) pupila dentro da íris
    let P = bestCircle(G, Math.round(I.x), Math.round(I.y), Math.max(2, Math.round(I.r * .18)), 1, Math.max(2, I.r * .12), I.r * .75, full);
    P = bestCircle(G, P.x, P.y, 1.5, 0.5, Math.max(2, P.r * .8), P.r * 1.2, full);
    S.pup = { x: P.x / k, y: P.y / k, r: P.r / k };
    S.iris = { x: I.x / k, y: I.y / k, r: I.r / k };
    busy(false);
    afterCircles(true);
    status('Íris e pupila detectadas. Confira os círculos (<b style="color:#2f6fdb">azul</b> = borda da íris, <b style="color:#e2483d">vermelho</b> = pupila) e ajuste se precisar. Depois siga para a escala (etapa 3).');
    if (window.onPhotoReady) window.onPhotoReady();
  }, 30);
}
$('detect').onclick = () => detect();
$('concentric').onchange = () => { if ($('concentric').checked && S.iris) { S.pup.x = S.iris.x; S.pup.y = S.iris.y; } changed(); };

function afterCircles(first) {
  if (S.iris && S.pup && S.pup.r >= S.iris.r * 0.92) S.pup.r = S.iris.r * 0.6;
  enableUpTo(7);
  updateTables(); changed();
  if (first) drawPhoto();
}

/* ---------------------------------------------------------------- escala */
let scaleMode = 'hvid';
document.querySelectorAll('#scaleMode button').forEach(b => b.onclick = () => {
  scaleMode = b.dataset.v;
  document.querySelectorAll('#scaleMode button').forEach(x => x.classList.toggle('on', x === b));
  $('hvidBox').hidden = scaleMode !== 'hvid'; $('rulerBox').hidden = scaleMode !== 'ruler';
  changed();
});
$('rulerBtn').onclick = () => { setMode('ruler'); S.rulerPts = []; status('Clique no primeiro ponto da régua.'); };
function mmPerPx() {
  if (scaleMode === 'ruler' && S.ruler) return num('rulerMM') / Math.hypot(S.ruler[1].x - S.ruler[0].x, S.ruler[1].y - S.ruler[0].y);
  if (!S.iris) return NaN;
  return num('hvid') / (2 * S.iris.r);
}
function measured() {
  const k = mmPerPx();
  return { iris: S.iris ? 2 * S.iris.r * k : NaN, pup: S.pup ? 2 * S.pup.r * k : NaN, k };
}
function updateTables() {
  if (!S.iris) return;
  const m = measured();
  $('circTab').innerHTML = `<tr><td>Íris (raio)</td><td>${fmt(S.iris.r, 1)} px</td></tr><tr><td>Pupila (raio)</td><td>${fmt(S.pup.r, 1)} px</td></tr><tr><td>Pupila / íris</td><td>${fmt(S.pup.r / S.iris.r, 2)}</td></tr><tr><td>Descentração da pupila</td><td>${fmt(Math.hypot(S.pup.x - S.iris.x, S.pup.y - S.iris.y) * m.k, 2)} mm</td></tr>`;
  $('scaleTab').innerHTML = `<tr><td>Escala</td><td>${fmt(m.k * 1000, 1)} µm/px</td></tr><tr><td>Íris medida</td><td>${fmt(m.iris, 2)} mm</td></tr><tr><td>Pupila medida</td><td>${fmt(m.pup, 2)} mm</td></tr>`;
  if ($('pIrisAuto').checked && Number.isFinite(m.iris)) $('pIris').value = m.iris.toFixed(2);
  if ($('pPupAuto').checked && Number.isFinite(m.pup)) $('pPup').value = clamp(m.pup, 1.5, 8).toFixed(2);
}
$('wbBtn').onclick = () => { setMode('wb'); status('Clique numa área branca ou cinza neutra da foto.'); };
$('wbReset').onclick = () => { S.wb = [1, 1, 1]; $('wbInfo').textContent = 'Balanço de branco zerado.'; S.px && refreshImgCanvas(); changed(); };
function pickWB(x, y) {
  const p = S.px, W = S.W; let r = 0, g = 0, b = 0, n = 0;
  for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) {
    const xx = clamp(Math.round(x + i), 0, S.W - 1), yy = clamp(Math.round(y + j), 0, S.H - 1), o = (yy * W + xx) * 4;
    r += p[o]; g += p[o + 1]; b += p[o + 2]; n++;
  }
  r /= n; g /= n; b /= n; const m = Math.max(r, g, b);
  S.wb = [m / Math.max(r, 1), m / Math.max(g, 1), m / Math.max(b, 1)].map(v => clamp(v, 0.5, 2.5));
  $('wbInfo').textContent = `Ganhos R/G/B: ${S.wb.map(v => fmt(v, 2)).join(' / ')}`;
  refreshImgCanvas(); changed();
}
function refreshImgCanvas() { // aplica balanço de branco na visualização
  const g = S.img.getContext('2d'), id = g.createImageData(S.W, S.H), d = id.data, p = S.px;
  for (let i = 0; i < d.length; i += 4) { d[i] = Math.min(255, p[i] * S.wb[0]); d[i + 1] = Math.min(255, p[i + 1] * S.wb[1]); d[i + 2] = Math.min(255, p[i + 2] * S.wb[2]); d[i + 3] = 255; }
  g.putImageData(id, 0, 0); drawPhoto();
}

/* ------------------------------------------------- desenrolar e limpar a íris */
function unwrap() {
  const I = S.iris, P = S.pup, u = new Float32Array(NT * NR * 3), o = [0, 0, 0];
  for (let t = 0; t < NT; t++) {
    const th = t / NT * TAU, c = Math.cos(th), s = Math.sin(th);
    const px = P.x + P.r * c, py = P.y - P.r * s, ix = I.x + I.r * c, iy = I.y - I.r * s;
    for (let j = 0; j < NR; j++) {
      const rr = j / (NR - 1);
      sample(px + (ix - px) * rr, py + (iy - py) * rr, o);
      const k = (j * NT + t) * 3; u[k] = o[0]; u[k + 1] = o[1]; u[k + 2] = o[2];
    }
  }
  return u;
}
const lum = (a, k) => 0.3 * a[k] + 0.59 * a[k + 1] + 0.11 * a[k + 2];
function cleanIris(u) {
  const c = u.slice(), mask = new Uint8Array(NT * NR);
  // setores de pálpebra: copia do ângulo espelhado no eixo horizontal (θ → −θ)
  const sect = [];
  if ($('upOn').checked) sect.push([num('upA'), num('upB')]);
  if ($('loOn').checked) sect.push([num('loA'), num('loB')]);
  for (const [a, b] of sect) {
    const fe = 6;
    for (let t = 0; t < NT; t++) {
      const deg = t / NT * 360;
      const inside = Math.min(deg - a, b - deg);
      if (inside < -fe) continue;
      const wgt = clamp((inside + fe) / (2 * fe), 0, 1);
      const ts = ((NT - t) % NT);
      for (let j = 0; j < NR; j++) {
        const k = (j * NT + t) * 3, ks = (j * NT + ts) * 3;
        for (let q = 0; q < 3; q++) c[k + q] = c[k + q] * (1 - wgt) + u[ks + q] * wgt;
        if (wgt > 0.5) mask[j * NT + t] = 2;
      }
    }
  }
  // reflexos: claros demais → interpola ao longo do anel
  if ($('specOn').checked) {
    const thr = num('specThr'), m2 = new Uint8Array(NT * NR);
    for (let i = 0; i < NT * NR; i++) if (lum(c, i * 3) > thr) m2[i] = 1;
    // dilata 2 px
    const m3 = m2.slice();
    for (let j = 0; j < NR; j++) for (let t = 0; t < NT; t++) if (m2[j * NT + t])
      for (let dj = -4; dj <= 4; dj++) for (let dt = -5; dt <= 5; dt++) { const jj = j + dj; if (jj < 0 || jj >= NR) continue; m3[jj * NT + ((t + dt + NT) % NT)] = 1; }
    for (let j = 0; j < NR; j++) {
      const row = j * NT; let any = false, all = true;
      for (let t = 0; t < NT; t++) { if (m3[row + t]) any = true; else all = false; }
      if (!any || all) continue;
      for (let t = 0; t < NT; t++) {
        if (!m3[row + t]) continue;
        let l = 1, r = 1; while (m3[row + ((t - l + NT) % NT)]) l++; while (m3[row + ((t + r) % NT)]) r++;
        const kl = (row + ((t - l + NT) % NT)) * 3, kr = (row + ((t + r) % NT)) * 3, f = l / (l + r), k = (row + t) * 3;
        for (let q = 0; q < 3; q++) c[k + q] = c[kl + q] * (1 - f) + c[kr + q] * f;
        mask[row + t] = mask[row + t] || 1;
      }
    }
  }
  // cor
  const bri = num('cBri'), con = num('cCon'), sat = num('cSat');
  for (let i = 0; i < NT * NR; i++) {
    const k = i * 3, L = lum(c, k);
    for (let q = 0; q < 3; q++) {
      let v = L + (c[k + q] - L) * sat;
      v = (v - 0.5) * con + 0.5 + bri;
      c[k + q] = clamp(v, 0, 1);
    }
  }
  return { c, mask };
}
function protParams() {
  const mirror = $('photoSide').value !== $('protSide').value;
  const Di = num('pIris'), Dp = num('pPup');
  return { mirror, Di, Dp, rpn: clamp(Dp / Di, 0.1, 0.8) };
}
function sampleUnw(c, th, rho, out) { // th em rad, rho 0..1
  let t = (th / TAU) * NT; t = ((t % NT) + NT) % NT;
  const j = clamp(rho, 0, 1) * (NR - 1);
  const t0 = Math.floor(t), t1 = (t0 + 1) % NT, ft = t - t0, j0 = Math.min(NR - 2, Math.floor(j)), fj = j - j0;
  for (let q = 0; q < 3; q++) {
    const a = c[(j0 * NT + t0) * 3 + q], b = c[(j0 * NT + t1) * 3 + q], d = c[((j0 + 1) * NT + t0) * 3 + q], e = c[((j0 + 1) * NT + t1) * 3 + q];
    out[q] = (a * (1 - ft) + b * ft) * (1 - fj) + (d * (1 - ft) + e * ft) * fj;
  }
  return out;
}
/* textura no plano da prótese: X para a direita, Y para cima, raio 1 = limbo */
function buildTexture(c) {
  const { mirror, rpn } = protParams();
  const cv = document.createElement('canvas'); cv.width = cv.height = TEX;
  const g = cv.getContext('2d'), id = g.createImageData(TEX, TEX), d = id.data, o = [0, 0, 0];
  const pupC = [0.035, 0.035, 0.04];
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    let X = (x + .5) / TEX * 2 - 1; const Y = 1 - (y + .5) / TEX * 2;
    const r = Math.hypot(X, Y), k = (y * TEX + x) * 4;
    if (r > 1 + 1.5 / TEX) { d[k + 3] = 0; continue; }
    if (mirror) X = -X;
    const th = Math.atan2(Y, X);
    if (r < rpn) { d[k] = pupC[0] * 255; d[k + 1] = pupC[1] * 255; d[k + 2] = pupC[2] * 255; }
    else {
      sampleUnw(c, th, (r - rpn) / (1 - rpn), o);
      const pe = clamp((r - rpn) * TEX / 2 / 1.2, 0, 1); // borda suave da pupila
      for (let q = 0; q < 3; q++) d[k + q] = (o[q] * pe + pupC[q] * (1 - pe)) * 255;
    }
    d[k + 3] = clamp((1 + 1.5 / TEX - r) * TEX / 3, 0, 1) * 255;
  }
  g.putImageData(id, 0, 0);
  return cv;
}
/* mapa de alturas (mm acima da face anterior da esclera) */
function buildHeight(tex) {
  const { rpn, Di } = protParams();
  const s = TEX / HM, g = tex.getContext('2d').getImageData(0, 0, TEX, TEX).data;
  const L = new Float32Array(HM * HM), R = new Float32Array(HM * HM);
  let sum = 0, n = 0;
  for (let y = 0; y < HM; y++) for (let x = 0; x < HM; x++) {
    const X = (x + .5) / HM * 2 - 1, Y = 1 - (y + .5) / HM * 2, r = Math.hypot(X, Y);
    R[y * HM + x] = r;
    const tx = Math.min(TEX - 1, Math.floor((x + .5) * s)), ty = Math.min(TEX - 1, Math.floor((y + .5) * s)), k = (ty * TEX + tx) * 4;
    const v = (0.3 * g[k] + 0.59 * g[k + 1] + 0.11 * g[k + 2]) / 255;
    L[y * HM + x] = v;
    if (r > rpn && r < 1) { sum += v; n++; }
  }
  const mean = sum / Math.max(1, n);
  for (let i = 0; i < L.length; i++) if (R[i] <= rpn + 0.01 || R[i] >= 0.995) L[i] = mean;
  const mmpx = Di / HM;
  const big = blur1(L, HM, HM, num('hDetail') / mmpx);
  let D = new Float32Array(HM * HM), ss = 0; n = 0;
  for (let i = 0; i < L.length; i++) { D[i] = L[i] - big[i]; if (R[i] > rpn && R[i] < 1) { ss += D[i] * D[i]; n++; } }
  const sd = Math.sqrt(ss / Math.max(1, n)) || 1;
  D = blur1(D, HM, HM, num('hSmooth') / mmpx);
  const base = num('hBase'), depth = num('hDepth'), sign = $('hInv').checked ? -1 : 1, limb = $('hLimbus').checked;
  const trans = num('hTrans'), Ri = Di / 2;
  const h = new Float32Array(HM * HM);
  for (let i = 0; i < h.length; i++) {
    const r = R[i];
    if (r >= 1) { h[i] = 0; continue; }
    let v = base + depth * sign * clamp(D[i] / (2.2 * sd), -1, 1);
    if (limb) v += 0.08 * Math.exp(-(((r - 0.93) / 0.025) ** 2));
    const dmm = (1 - r) * Ri;                                   // distância ao limbo (mm)
    if (trans > 0.01) { const t = clamp(dmm / trans, 0, 1); v *= t * t * (3 - 2 * t); }   // nasce da esclera
    else v = Math.max(0.02, v) * Math.sqrt(clamp((1 - r) / 0.025, 0, 1));
    h[i] = Math.max(0, v);
  }
  return h;
}
function hAt(h, X, Y) { // X,Y em raio normalizado
  return bil(h, HM, HM, (X + 1) / 2 * HM - .5, (1 - Y) / 2 * HM - .5);
}

let recompT = 0;
function changed() {
  updateTables(); S.dirty = true;
  clearTimeout(recompT); recompT = setTimeout(recompute, 120);
  drawPhoto();
}
function recompute() {
  if (!S.iris) return;
  S.unw = unwrap();
  const cl = cleanIris(S.unw); S.clean = cl.c; S.mask = cl.mask;
  S.tex = buildTexture(S.clean);
  S.hm = buildHeight(S.tex);
  updateMirrorNote(); checkShell();
  if (S.tab === 'iris') drawIris();
  if (S.tab === '3d') { scheduleBuild(); }
}
function updateMirrorNote() {
  const m = protParams().mirror;
  $('mirrorNote').innerHTML = m ? 'A íris da foto será <b>espelhada</b> (foto de um olho, prótese do outro), como fazem os ocularistas.' : 'Mesmo olho da foto: a íris <b>não</b> será espelhada.';
}
document.querySelectorAll('#s4 input, #s5 input, #s5 select, #s6 input, #s6 select, #s1 select, #hvid, #rulerMM').forEach(el => {
  el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
    if (el.id === 'pIris') $('pIrisAuto').checked = false;
    if (el.id === 'pPup') $('pPupAuto').checked = false;
    changed();
  });
});

/* ------------------------------------------------------------ vista da foto */
const pc = $('pc');
function canvasSize(cv) {
  const r = $('view').getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return { w, h, dpr };
}
function fitView() {
  const { w, h } = canvasSize(pc);
  const z = Math.min(w / S.W, h / S.H) * 0.92;
  S.view = { z, tx: (w - S.W * z) / 2, ty: (h - S.H * z) / 2 };
}
function toImg(e) {
  const r = pc.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const sx = (e.clientX - r.left) * dpr, sy = (e.clientY - r.top) * dpr;
  return { x: (sx - S.view.tx) / S.view.z, y: (sy - S.view.ty) / S.view.z, sx, sy };
}
function drawPhoto() {
  if (S.tab !== 'photo' || !S.img) return;
  const { w, h, dpr } = canvasSize(pc), g = pc.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
  const { z, tx, ty } = S.view;
  g.setTransform(z, 0, 0, z, tx, ty); g.imageSmoothingQuality = 'high';
  g.drawImage(S.img, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const T = p => [p.x * z + tx, p.y * z + ty];
  if (S.iris) {
    const [ix, iy] = T(S.iris), [px, py] = T(S.pup), ir = S.iris.r * z, pr = S.pup.r * z;
    // setores de pálpebra
    const sects = [];
    if ($('upOn').checked) sects.push([num('upA'), num('upB')]);
    if ($('loOn').checked) sects.push([num('loA'), num('loB')]);
    g.fillStyle = 'rgba(240,140,30,.33)';
    for (const [a, b] of sects) {
      g.beginPath(); g.arc(ix, iy, ir, -a * Math.PI / 180, -b * Math.PI / 180, true); g.arc(px, py, pr, -b * Math.PI / 180, -a * Math.PI / 180, false); g.closePath(); g.fill();
    }
    g.lineWidth = 2 * dpr;
    g.strokeStyle = '#2f6fdb'; g.beginPath(); g.arc(ix, iy, ir, 0, TAU); g.stroke();
    g.strokeStyle = '#e2483d'; g.beginPath(); g.arc(px, py, pr, 0, TAU); g.stroke();
    const cross = (x, y, c) => { g.strokeStyle = c; g.beginPath(); g.moveTo(x - 9 * dpr, y); g.lineTo(x + 9 * dpr, y); g.moveTo(x, y - 9 * dpr); g.lineTo(x, y + 9 * dpr); g.stroke(); };
    cross(ix, iy, '#2f6fdb'); cross(px, py, '#e2483d');
    const knob = (x, y, c) => { g.fillStyle = '#fff'; g.strokeStyle = c; g.beginPath(); g.arc(x, y, 6 * dpr, 0, TAU); g.fill(); g.stroke(); };
    knob(ix + ir, iy, '#2f6fdb'); knob(px - pr, py, '#e2483d');
  }
  if (S.ruler || S.rulerPts.length) {
    const pts = S.ruler || S.rulerPts; g.strokeStyle = '#d98a00'; g.fillStyle = '#d98a00'; g.lineWidth = 2 * dpr;
    g.beginPath(); pts.forEach((p, i) => { const [x, y] = T(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    pts.forEach(p => { const [x, y] = T(p); g.beginPath(); g.arc(x, y, 4 * dpr, 0, TAU); g.fill(); });
  }
}
function setMode(m) { S.mode = m; pc.classList.toggle('pick', m !== 'edit'); $('wbBtn').classList.toggle('on', m === 'wb'); $('rulerBtn').classList.toggle('on', m === 'ruler'); if (S.tab !== 'photo') setTab('photo'); }
let drag = null;
pc.addEventListener('pointerdown', e => {
  if (!S.img) return;
  const p = toImg(e), dpr = window.devicePixelRatio || 1, tol = 10 * dpr / S.view.z;
  if (S.mode === 'wb') { pickWB(p.x, p.y); setMode('edit'); status('Balanço de branco aplicado.'); return; }
  if (S.mode === 'ruler') {
    S.rulerPts.push({ x: p.x, y: p.y });
    if (S.rulerPts.length === 2) { S.ruler = S.rulerPts.slice(); S.rulerPts = []; setMode('edit'); status('Régua marcada. Informe a distância em mm entre os dois pontos.'); changed(); }
    else status('Agora clique no segundo ponto da régua.');
    drawPhoto(); return;
  }
  let target = null;
  if (S.iris) {
    const dI = Math.hypot(p.x - S.iris.x, p.y - S.iris.y), dP = Math.hypot(p.x - S.pup.x, p.y - S.pup.y);
    if (dP < tol * 1.2) target = 'pc';
    else if (dI < tol * 1.2) target = 'ic';
    else if (Math.abs(dP - S.pup.r) < tol) target = 'pr';
    else if (Math.abs(dI - S.iris.r) < tol) target = 'ir';
  }
  drag = { target, x: e.clientX, y: e.clientY, tx: S.view.tx, ty: S.view.ty, p0: p, i0: S.iris && { ...S.iris }, q0: S.pup && { ...S.pup } };
  pc.setPointerCapture(e.pointerId);
});
pc.addEventListener('pointermove', e => {
  if (!drag) return;
  const p = toImg(e), dpr = window.devicePixelRatio || 1;
  const conc = $('concentric').checked;
  switch (drag.target) {
    case 'ic': S.iris.x = drag.i0.x + p.x - drag.p0.x; S.iris.y = drag.i0.y + p.y - drag.p0.y; if (conc) { S.pup.x = S.iris.x; S.pup.y = S.iris.y; } break;
    case 'pc': if (!conc) { S.pup.x = drag.q0.x + p.x - drag.p0.x; S.pup.y = drag.q0.y + p.y - drag.p0.y; } break;
    case 'ir': S.iris.r = Math.max(S.pup.r * 1.15, Math.hypot(p.x - S.iris.x, p.y - S.iris.y)); break;
    case 'pr': S.pup.r = clamp(Math.hypot(p.x - S.pup.x, p.y - S.pup.y), 2, S.iris.r * 0.88); break;
    default: S.view.tx = drag.tx + (e.clientX - drag.x) * dpr; S.view.ty = drag.ty + (e.clientY - drag.y) * dpr; drawPhoto(); return;
  }
  updateTables(); drawPhoto();
});
pc.addEventListener('pointerup', () => { if (drag && drag.target) changed(); drag = null; });
pc.addEventListener('dblclick', e => { if (S.img) { const p = toImg(e); detect(p); } });
pc.addEventListener('wheel', e => {
  if (!S.img) return; e.preventDefault();
  const p = toImg(e), f = Math.exp(-e.deltaY * 0.0015), z = clamp(S.view.z * f, 0.05, 40);
  S.view.tx = p.sx - p.x * z; S.view.ty = p.sy - p.y * z; S.view.z = z; drawPhoto();
}, { passive: false });

/* ---------------------------------------------------------- vista da íris */
function drawIris() {
  const cv = $('ic'), { w, h, dpr } = canvasSize(cv), g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
  if (!S.clean) return;
  const pad = 20 * dpr, top = 84 * dpr, bottomPad = 100 * dpr;
  const label = (t, x, y) => { g.fillStyle = '#5B5573'; g.font = `600 ${11 * dpr}px "IBM Plex Mono", monospace`; g.fillText(t, x, y); };
  // faixa desenrolada: original em cima, limpa embaixo
  const stripW = w - 2 * pad, stripH = Math.min((h - top - bottomPad) * 0.16, stripW / NT * NR * 0.5);
  const mk = (arr, mask) => {
    const c = document.createElement('canvas'); c.width = NT; c.height = NR;
    const x = c.getContext('2d'), id = x.createImageData(NT, NR), d = id.data;
    for (let j = 0; j < NR; j++) for (let t = 0; t < NT; t++) {
      const k = (j * NT + t) * 3, o = ((NR - 1 - j) * NT + t) * 4; // limbo em cima
      d[o] = arr[k] * 255; d[o + 1] = arr[k + 1] * 255; d[o + 2] = arr[k + 2] * 255; d[o + 3] = 255;
      if (mask && mask[j * NT + t]) { if (mask[j * NT + t] === 1) { d[o] = 255; d[o + 1] = 40; d[o + 2] = 200; } else { d[o] = d[o] * .6 + 240 * .4; d[o + 1] = d[o + 1] * .6 + 140 * .4; d[o + 2] = d[o + 2] * .6 + 30 * .4; } }
    }
    x.putImageData(id, 0, 0); return c;
  };
  let y = top;
  label('ÍRIS DESENROLADA — FOTO (rosa = reflexo removido, laranja = setor substituído)   0° → 360°', pad, y - 8 * dpr);
  g.drawImage(mk(S.unw, S.mask), pad, y, stripW, stripH); y += stripH + 26 * dpr;
  label('ÍRIS DESENROLADA — LIMPA E CORRIGIDA', pad, y - 8 * dpr);
  g.drawImage(mk(S.clean), pad, y, stripW, stripH); y += stripH + 34 * dpr;
  // textura e relevo
  const side = Math.min((w - 3 * pad) / 2, h - y - bottomPad);
  if (side > 40) {
    label(`TEXTURA DA PRÓTESE (Ø ${fmt(num('pIris'), 1)} mm${protParams().mirror ? ', espelhada' : ''})`, pad, y - 8 * dpr);
    g.fillStyle = '#e9e4dc'; g.fillRect(pad, y, side, side);
    g.drawImage(S.tex, pad, y, side, side);
    label('RELEVO (iluminação rasante)', 2 * pad + side, y - 8 * dpr);
    g.drawImage(shadeHM(S.hm), 2 * pad + side, y, side, side);
  }
}
function shadeHM(h) {
  const c = document.createElement('canvas'); c.width = c.height = HM;
  const g = c.getContext('2d'), id = g.createImageData(HM, HM), d = id.data;
  const mmpx = num('pIris') / HM, ex = 6, L = [-0.55, 0.55, 0.62], ln = Math.hypot(...L), rpn = protParams().rpn, Di2 = num('pIris') / 2, pt = pupFn();
  for (let y = 1; y < HM - 1; y++) for (let x = 1; x < HM - 1; x++) {
    const i = y * HM + x, X = (x + .5) / HM * 2 - 1, Y = 1 - (y + .5) / HM * 2, r = Math.hypot(X, Y), o = i * 4;
    if (r > 1) { d[o + 3] = 0; continue; }
    let dx = (h[i + 1] - h[i - 1]) / (2 * mmpx) * ex, dy = -(h[i + HM] - h[i - HM]) / (2 * mmpx) * ex;
    if (r < rpn) { // cúpula da pupila
      const zz = pt(r * Di2), zx = pt(Math.hypot(X + 2 / HM, Y) * Di2);
      dx = (zx - zz) / mmpx * ex * 0.5; dy = 0;
    }
    const n = [-dx, -dy, 1], nl = Math.hypot(...n);
    const v = clamp((n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / (nl * ln), 0, 1);
    const s = 40 + 205 * v; d[o] = s; d[o + 1] = s; d[o + 2] = s; d[o + 3] = 255;
  }
  g.putImageData(id, 0, 0); return c;
}
function pupFn() { // altura da pupila (mm acima da esclera) em função do raio (mm)
  const mode = $('pupMode').value, base = num('hBase'), rp = num('pPup') / 2, ph = num('pupH');
  if (mode === 'flat') return () => base;
  if (mode === 'sunk') return () => Math.max(0.02, base - 0.15);
  return r => base + ph * Math.sqrt(clamp(1 - (r / rp) ** 2, 0, 1));
}

/* -------------------------------------------------------------- abas */
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => setTab(b.dataset.t));
function setTab(t) {
  S.tab = t;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('cur', b.dataset.t === t));
  $('pc').hidden = t !== 'photo'; $('ic').hidden = t !== 'iris'; $('gl').hidden = t !== '3d'; $('tools3d').hidden = t !== '3d';
  if (!S.img) return;
  if (t === 'photo') drawPhoto();
  if (t === 'iris') { if (S.dirty) recompute(); drawIris(); status('Confira a íris desenrolada: reflexos (rosa) e setores de pálpebra (laranja) devem cobrir só o que não é íris. Ajuste na etapa 4 e o relevo na etapa 5.'); }
  if (t === '3d') { if (!S.meshes) buildModel(); else drawGL(); }
}
window.addEventListener('resize', () => { if (S.tab === 'photo') drawPhoto(); else if (S.tab === 'iris') drawIris(); else drawGL(); });

/* ============================================================ GEOMETRIA 3D */
/* contorno genérico (prótese direita, vista de frente: +x = nasal), mm */
const OUTLINE = [[-11.1, -4.6], [-7.3, 9.4], [0.3, 11.9], [9.2, 8.1], [11.7, -0.1], [7.9, -7.7], [-2.2, -12.8], [-9.8, -10.3]];
function outlineRho(nT) {
  const W = num('sW'), H = num('sH'), side = $('protSide').value;
  const xs = OUTLINE.map(p => p[0]), ys = OUTLINE.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const nas = side === 'D' ? 1 : -1;
  const ox = num('sDx') * nas, oy = num('sDy');
  let P = OUTLINE.map(([x, y]) => [((x - x0) / (x1 - x0) - .5) * W * nas - ox, ((y - y0) / (y1 - y0) - .5) * H - oy]);
  // Catmull-Rom fechado
  const C = [], n = P.length;
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    for (let s = 0; s < 40; s++) {
      const t = s / 40, t2 = t * t, t3 = t2 * t;
      C.push([0, 1].map(q => 0.5 * ((2 * p1[q]) + (-p0[q] + p2[q]) * t + (2 * p0[q] - 5 * p1[q] + 4 * p2[q] - p3[q]) * t2 + (-p0[q] + 3 * p1[q] - 3 * p2[q] + p3[q]) * t3)));
    }
  }
  const rho = new Float32Array(nT);
  for (let i = 0; i < nT; i++) {
    const th = i / nT * TAU, dx = Math.cos(th), dy = Math.sin(th); let best = 0;
    for (let k = 0; k < C.length; k++) {
      const a = C[k], b = C[(k + 1) % C.length], ex = b[0] - a[0], ey = b[1] - a[1];
      const den = dx * ey - dy * ex; if (Math.abs(den) < 1e-12) continue;
      const t = (a[0] * ey - a[1] * ex) / den, u = (a[0] * dy - a[1] * dx) / den;
      if (t > 0 && u >= 0 && u <= 1) best = Math.max(best, t);
    }
    rho[i] = best;
  }
  return rho;
}
const sph = (r, R, RF) => Math.sqrt(Math.max(0, R * R - r * r)) - RF;
function geomParams() {
  const G = { RF: num('sRF'), RB: num('sRB'), T: num('sT'), INS: num('sIns'), RI: num('pIris') / 2, RP: num('pPup') / 2, mode: $('sMode').value, SH: num('sShell') };
  G.front = r => sph(r, G.RF, G.RF);
  G.back = G.mode === 'shell' ? r => sph(Math.min(r, G.RF - G.SH - 1e-3), G.RF - G.SH, G.RF) : r => -G.T - (G.RB - Math.sqrt(Math.max(0, G.RB * G.RB - r * r)));
  G.depth = G.mode === 'shell' ? G.SH : G.T;   // espessura no centro
  return G;
}
$('sMode').addEventListener('change', () => { const sh = $('sMode').value === 'shell'; $('shellBox').hidden = !sh; $('solidBox').hidden = sh; });
function checkShell() {
  const G = geomParams(), rho = outlineRho(180);
  let minR = 1e9, maxR = 0, minT = 1e9;
  for (let i = 0; i < rho.length; i++) {
    minR = Math.min(minR, rho[i]); maxR = Math.max(maxR, rho[i]);
    minT = Math.min(minT, G.front(rho[i]) - G.back(rho[i]));
  }
  const w = [];
  if (minR < G.RI + 1.2) w.push('A íris está muito perto da borda da casca: aumente a largura/altura ou reduza o deslocamento.');
  if (G.RI >= G.RF * 0.95) w.push('O raio da face anterior é pequeno demais para o diâmetro da íris.');
  if (G.mode === 'shell') {
    if (maxR > G.RF - G.SH - 0.3) w.push('O contorno é largo demais para essa curvatura: a casca fecharia sobre si. Aumente o raio da face anterior ou reduza largura/altura.');
    if (G.INS > G.SH - 0.4) w.push(`O encaixe da íris (${fmt(G.INS, 1)} mm) é fundo demais para uma casca de ${fmt(G.SH, 1)} mm: deixe pelo menos 0,4 mm de fundo (encaixe ≤ ${fmt(G.SH - 0.4, 1)} mm).`);
  } else if (minT < 0.8) w.push(`Na borda a peça fica com ${fmt(minT, 2)} mm. Aumente a espessura no centro ou o raio da face anterior, ou diminua o raio posterior.`);
  const ok = G.mode === 'shell' ? `Casca de ${fmt(G.SH, 1)} mm em toda a peça · altura total ≈ ${fmt(-G.back(Math.min(maxR, G.RF - G.SH - 0.3)), 1)} mm.` : `Espessura mínima na borda ≈ ${fmt(minT, 2)} mm.`;
  $('shellWarn').innerHTML = w.length ? `<div class="warnbox">${w.join('<br>')}</div>` : `<div class="okbox">${ok}</div>`;
  return { minT, minR };
}
/* varre um perfil (r,z) em volta do eixo z; cor por vértice */
function sweep(nT, prof, colorFn, closed) {
  const rows = []; let nP = 0;
  for (let i = 0; i < nT; i++) { const th = i / nT * TAU, p = prof(th, i); nP = p.length; rows.push(p.map(([r, z]) => [r * Math.cos(th), r * Math.sin(th), z])); }
  const nSeg = closed ? nP : nP - 1;
  const pos = new Float32Array(nT * nSeg * 18), col = new Float32Array(nT * nSeg * 18);
  let n = 0; const tmp = [];
  const put = (a, b, c, ca, cb, cc) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * cx + cy * cy + cz * cz < 1e-14) return;
    pos.set(a, n); pos.set(b, n + 3); pos.set(c, n + 6);
    col.set(ca, n); col.set(cb, n + 3); col.set(cc, n + 6); n += 9;
  };
  const cols = colorFn ? rows.map((row, i) => row.map((p, k) => colorFn(p, k, i))) : null;
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
  let P = pos.subarray(0, n), Cc = col.subarray(0, n);
  // orientação: volume positivo
  let vol = 0;
  for (let t = 0; t < n; t += 9) {
    vol += P[t] * (P[t + 4] * P[t + 8] - P[t + 5] * P[t + 7]) - P[t + 1] * (P[t + 3] * P[t + 8] - P[t + 5] * P[t + 6]) + P[t + 2] * (P[t + 3] * P[t + 7] - P[t + 4] * P[t + 6]);
  }
  if (vol < 0) {
    for (let t = 0; t < n; t += 9) for (let q = 0; q < 3; q++) {
      let s = P[t + 3 + q]; P[t + 3 + q] = P[t + 6 + q]; P[t + 6 + q] = s;
      s = Cc[t + 3 + q]; Cc[t + 3 + q] = Cc[t + 6 + q]; Cc[t + 6 + q] = s;
    }
  }
  return { pos: P.slice(), col: Cc.slice(), vol: Math.abs(vol) / 6, ntri: n / 9 };
}
function lin(a, b, n) { const o = []; for (let i = 0; i <= n; i++) o.push(a + (b - a) * i / n); return o; }
function buildMeshes(hi) {
  const G = geomParams(), { RF, RB, T, RI, RP, front, back } = G;
  const INS = G.mode === 'shell' ? Math.min(G.INS, G.SH - 0.4) : G.INS;
  const inset = r => sph(r, RF - INS, RF);
  const scl = [0.95, 0.92, 0.86];
  // ---------- esclera
  const nTs = hi ? 480 : 300, rho = outlineRho(nTs);
  const sclera = sweep(nTs, (th, i) => {
    const P = [];
    lin(0, RI, 10).forEach(r => P.push([r, inset(r)]));
    P.push([RI, front(RI)]);
    // borda arredondada com tangente contínua (Bézier entre a face anterior e a posterior)
    const rmax = G.mode === 'shell' ? Math.min(rho[i], RF - G.SH - 0.3) : rho[i], thick = Math.max(0.3, front(rmax) - back(rmax));
    const L = clamp(thick * 0.55, 0.25, 1.4), re = Math.max(RI + 0.3, rmax - 0.75 * L);
    lin(RI, re, 28).slice(1).forEach(r => P.push([r, front(r)]));
    const zt = front(re), zb = back(re);
    const df = (front(re + 1e-3) - front(re - 1e-3)) / 2e-3, db = (back(re + 1e-3) - back(re - 1e-3)) / 2e-3;
    let t0 = [1, df], t3 = [-1, -db]; const n0 = Math.hypot(...t0), n3 = Math.hypot(...t3); t0 = t0.map(v => v / n0); t3 = t3.map(v => v / n3);
    const P0 = [re, zt], C1 = [re + t0[0] * L, zt + t0[1] * L], P3 = [re, zb], C2 = [re - t3[0] * L, zb - t3[1] * L];
    for (let q = 1; q < 16; q++) {
      const u = q / 16, a = (1 - u) ** 3, b2 = 3 * u * (1 - u) ** 2, c = 3 * u * u * (1 - u), d = u ** 3;
      P.push([a * P0[0] + b2 * C1[0] + c * C2[0] + d * P3[0], a * P0[1] + b2 * C1[1] + c * C2[1] + d * P3[1]]);
    }
    lin(re, 0, 30).forEach(r => P.push([r, back(r)]));
    return P;
  }, () => scl, false);
  // ---------- íris
  const nTi = hi ? 1440 : 720, nRi = hi ? 260 : 130;
  const texD = S.tex.getContext('2d').getImageData(0, 0, TEX, TEX).data;
  const texAt = (x, y) => {
    const X = x / RI, Y = y / RI;
    const px = clamp(Math.round((X + 1) / 2 * TEX - .5), 0, TEX - 1), py = clamp(Math.round((1 - Y) / 2 * TEX - .5), 0, TEX - 1), k = (py * TEX + px) * 4;
    return [texD[k] / 255, texD[k + 1] / 255, texD[k + 2] / 255];
  };
  const irisSide = [0.45, 0.45, 0.48];
  const nTop = nRi + 1;
  const irisM = sweep(nTi, th => {
    const c = Math.cos(th), s = Math.sin(th), P = [];
    lin(RP, RI, nRi).forEach(r => P.push([r, front(r) + hAt(S.hm, r * c / RI, r * s / RI)]));
    P.push([RI, inset(RI)]);
    lin(RI, RP, 8).slice(1).forEach(r => P.push([r, inset(r)]));
    return P;
  }, (p, k) => {
    if (k >= nTop) return irisSide;
    const c = texAt(p[0], p[1]), tr = num('hTrans');
    if (tr <= 0.01) return c;
    const t = clamp((RI - Math.hypot(p[0], p[1])) / (tr * 0.45), 0, 1), w = t * t * (3 - 2 * t);
    return [0, 1, 2].map(q => c[q] * w + scl[q] * (1 - w));
  }, true);
  // ---------- pupila
  const nTp = hi ? 480 : 300, pupTop = pupFn();
  const pupil = sweep(nTp, () => {
    const P = [];
    lin(0, RP, hi ? 50 : 30).forEach(r => P.push([r, front(r) + pupTop(r)]));
    P.push([RP, inset(RP)]);
    lin(RP, 0, 8).slice(1).forEach(r => P.push([r, inset(r)]));
    return P;
  }, () => [0.05, 0.05, 0.06], false);
  return { sclera, iris: irisM, pupil };
}

/* ------------------------------------------------------------ visualizador */
const gl = $('gl').getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
let prog, cam = { yaw: -0.5, pitch: 0.45, dist: 70, tx: 0, ty: 0 }, glBufs = {};
function initGL() {
  if (!gl || prog) return;
  const vs = `attribute vec3 p;attribute vec3 n;attribute vec3 c;uniform mat4 mvp;uniform mat4 mv;varying vec3 vn;varying vec3 vc;varying vec3 vp;
  void main(){gl_Position=mvp*vec4(p,1.);vn=(mv*vec4(n,0.)).xyz;vp=(mv*vec4(p,1.)).xyz;vc=c;}`;
  const fs = `precision mediump float;varying vec3 vn;varying vec3 vc;varying vec3 vp;uniform float useC;
  void main(){vec3 N=normalize(vn);if(!gl_FrontFacing)N=-N;vec3 V=normalize(-vp);
  vec3 L1=normalize(vec3(.4,.6,1.)),L2=normalize(vec3(-.7,-.2,.5));vec3 base=mix(vec3(.82,.80,.86),vc,useC);
  float d=max(dot(N,L1),0.)*.75+max(dot(N,L2),0.)*.25;vec3 H=normalize(L1+V);float sp=pow(max(dot(N,H),0.),60.)*.35;
  gl_FragColor=vec4(base*(.28+.8*d)+vec3(sp),1.);}`;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
}
function faceNormals(pos) {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < pos.length; t += 9) {
    const ux = pos[t + 3] - pos[t], uy = pos[t + 4] - pos[t + 1], uz = pos[t + 5] - pos[t + 2], vx = pos[t + 6] - pos[t], vy = pos[t + 7] - pos[t + 1], vz = pos[t + 8] - pos[t + 2];
    let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx; const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
    for (let q = 0; q < 3; q++) { n[t + q * 3] = x; n[t + q * 3 + 1] = y; n[t + q * 3 + 2] = z; }
  }
  return n;
}
function upload(name, m) {
  if (!gl) return;
  const mk = a => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); return b; };
  if (glBufs[name]) ['p', 'n', 'c'].forEach(k => gl.deleteBuffer(glBufs[name][k]));
  glBufs[name] = { p: mk(m.pos), n: mk(faceNormals(m.pos)), c: mk(m.col), cnt: m.pos.length / 3 };
}
function M4() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
function mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; }
function persp(f, a, n, fa) { const t = 1 / Math.tan(f / 2), o = new Float32Array(16); o[0] = t / a; o[5] = t; o[10] = (fa + n) / (n - fa); o[11] = -1; o[14] = 2 * fa * n / (n - fa); return o; }
function rotX(a) { const o = M4(), c = Math.cos(a), s = Math.sin(a); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; }
function rotY(a) { const o = M4(), c = Math.cos(a), s = Math.sin(a); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; }
function trans(x, y, z) { const o = M4(); o[12] = x; o[13] = y; o[14] = z; return o; }
function drawGL() {
  if (!gl || S.tab !== '3d' || !S.meshes) return;
  initGL();
  const cv = $('gl'), { w, h } = canvasSize(cv);
  gl.viewport(0, 0, w, h); gl.clearColor(0.957, 0.949, 0.976, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
  gl.useProgram(prog);
  const P = persp(0.6, w / h, 1, 500);
  const zc = -geomParams().depth / 2 - 2;
  const MV = mul(trans(cam.tx, cam.ty, -cam.dist), mul(rotX(cam.pitch), mul(rotY(cam.yaw), trans(0, 0, -zc))));
  // modelo em z para frente → girar para y para cima já está ok (x direita, y cima, z frente)
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'mvp'), false, mul(P, MV));
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'mv'), false, MV);
  gl.uniform1f(gl.getUniformLocation(prog, 'useC'), $('vC').checked ? 1 : 0);
  const vis = { sclera: $('vS').checked, iris: $('vI').checked, pupil: $('vP').checked };
  for (const k of ['sclera', 'iris', 'pupil']) {
    const b = glBufs[k]; if (!b || !vis[k]) continue;
    [['p', b.p], ['n', b.n], ['c', b.c]].forEach(([a, buf]) => { const l = gl.getAttribLocation(prog, a); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 0, 0); });
    gl.drawArrays(gl.TRIANGLES, 0, b.cnt);
  }
}
(() => {
  const cv = $('gl'); let d = null;
  cv.addEventListener('pointerdown', e => { d = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY;
    if (d.pan) { cam.tx += dx * cam.dist * 0.0012; cam.ty -= dy * cam.dist * 0.0012; } else { cam.yaw += dx * 0.008; cam.pitch = clamp(cam.pitch + dy * 0.008, -3.1, 3.1); }
    drawGL();
  });
  cv.addEventListener('pointerup', () => d = null);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => { e.preventDefault(); cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.0012), 15, 300); drawGL(); }, { passive: false });
})();
const VIEWS = { front: [0, 0], three: [-0.55, 0.45], side: [-1.5708, 0.05], back: [Math.PI, 0] };
document.querySelectorAll('#tools3d button').forEach(b => b.onclick = () => { const v = VIEWS[b.dataset.v]; cam.yaw = v[0]; cam.pitch = v[1]; cam.tx = cam.ty = 0; drawGL(); });
['vS', 'vI', 'vP', 'vC'].forEach(id => $(id).onchange = drawGL);

let buildT = 0;
function scheduleBuild() { clearTimeout(buildT); buildT = setTimeout(buildModel, 350); }
function buildModel() {
  if (!S.iris) return;
  if (S.dirty || !S.tex) recompute();
  busy(true, 'Gerando o modelo 3D…');
  setTimeout(() => {
    S.meshes = buildMeshes(false);
    S.dirty = false;
    for (const k of ['sclera', 'iris', 'pupil']) upload(k, S.meshes[k]);
    busy(false);
    if (S.tab !== '3d') setTab('3d'); else drawGL();
    const t = S.meshes.sclera.ntri + S.meshes.iris.ntri + S.meshes.pupil.ntri;
    status(`Modelo gerado: ${(t / 1000).toFixed(0)} mil triângulos (prévia). Arraste para girar, Shift ou botão direito para mover, roda para zoom. Ao exportar, a íris é gerada na resolução escolhida.`);
  }, 30);
}
$('build').onclick = () => { setTab('3d'); buildModel(); };

/* ---------------------------------------------------------------- exportação */
function stlBytes(parts) {
  let n = 0; parts.forEach(p => n += p.pos.length / 9);
  const buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
  const hdr = 'EITA! OLHO - Lab.EITA/UFG - mm'; for (let i = 0; i < 80; i++) dv.setUint8(i, i < hdr.length ? hdr.charCodeAt(i) & 127 : 32);
  dv.setUint32(80, n, true); let o = 84;
  for (const p of parts) {
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
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u) { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) { // método "store"
  const enc = new TextEncoder(), chunks = [], cd = []; let off = 0;
  const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const name = enc.encode(f.name), data = f.data, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
    h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    chunks.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    cd.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  }
  let cdSize = 0; cd.forEach(x => cdSize += x.length);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
  return new Blob([...chunks, ...cd, new Uint8Array(e.buffer)], { type: 'application/zip' });
}
const canvasPNG = cv => new Promise(res => cv.toBlob(b => b.arrayBuffer().then(a => res(new Uint8Array(a))), 'image/png'));
function heightPNG(h) {
  const c = document.createElement('canvas'); c.width = c.height = HM;
  const g = c.getContext('2d'), id = g.createImageData(HM, HM); let mx = 0; for (const v of h) mx = Math.max(mx, v);
  for (let i = 0; i < h.length; i++) { const v = h[i] / mx * 255; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0); return { c, mx };
}
function unwPNG(arr) {
  const c = document.createElement('canvas'); c.width = NT; c.height = NR;
  const g = c.getContext('2d'), id = g.createImageData(NT, NR);
  for (let j = 0; j < NR; j++) for (let t = 0; t < NT; t++) { const k = (j * NT + t) * 3, o = ((NR - 1 - j) * NT + t) * 4; id.data[o] = arr[k] * 255; id.data[o + 1] = arr[k + 1] * 255; id.data[o + 2] = arr[k + 2] * 255; id.data[o + 3] = 255; }
  g.putImageData(id, 0, 0); return c;
}
function params() {
  const ids = ['photoSide', 'protSide', 'hvid', 'rulerMM', 'specOn', 'specThr', 'upOn', 'upA', 'upB', 'loOn', 'loA', 'loB', 'cBri', 'cCon', 'cSat', 'hBase', 'hDepth', 'hDetail', 'hSmooth', 'hInv', 'hLimbus', 'pupMode', 'pupH', 'pIris', 'pPup', 'hTrans', 'sMode', 'sShell', 'sW', 'sH', 'sT', 'sRF', 'sRB', 'sIns', 'sDx', 'sDy', 'res'];
  const o = { app: 'EITA! OLHO v0.2', data: new Date().toISOString(), escala: scaleMode, foto: { largura: S.W, altura: S.H, iris_px: S.iris, pupila_px: S.pup, regua_px: S.ruler, balanco_branco: S.wb } };
  ids.forEach(id => { const el = $(id); o[id] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? parseFloat(el.value) : el.value); });
  o.medidas_mm = measured();
  return o;
}
let downloads = null;
async function getDownloads() {
  if (downloads) return downloads;
  for (let i = 0; i < 60 && !(window.claude && window.claude.use); i++) await new Promise(r => setTimeout(r, 100));
  try { if (window.claude && window.claude.use) downloads = await window.claude.use('downloads'); } catch (e) { downloads = null; }
  return downloads;
}
getDownloads().then(d => { if (!d) $('expInfo').innerHTML = '<div class="note">O download não está disponível nesta visualização. Abra a ferramenta pelo link do claude.ai.</div>'; });
async function save(name, data) {
  await getDownloads();
  if (!downloads) { status('O download não está disponível nesta visualização. Abra a ferramenta pelo link do claude.ai.'); return false; }
  try { await downloads.save({ filename: name, data }); return true; }
  catch (e) { status(e && e.code === 'declined' ? 'Download cancelado.' : 'Não foi possível salvar o arquivo (' + (e && e.code || 'erro') + ').'); return false; }
}
async function buildPackage() {
  if (S.dirty || !S.tex) recompute();
  const M = buildMeshes($('res').value === 'h');
  const stl = { esc: stlBytes([M.sclera]), iri: stlBytes([M.iris]), pup: stlBytes([M.pupil]) };
  const all = stlBytes([M.sclera, M.iris, M.pupil]);
  const hp = heightPNG(S.hm), p = params();
  p.altura_max_mapa_mm = hp.mx; p.triangulos = { esclera: M.sclera.ntri, iris: M.iris.ntri, pupila: M.pupil.ntri };
  p.volume_mm3 = { esclera: M.sclera.vol, iris: M.iris.vol, pupila: M.pupil.vol };
  const enc = new TextEncoder();
  const leia = `EITA! OLHO — Lab.EITA/UFG\nGerado em ${new Date().toLocaleString('pt-BR')}\n\nUnidades: milímetros. Eixo Z = frente da prótese. Origem no centro da íris.\n\nesclera.stl            casca com o encaixe da íris (rebaixo de ${p.sIns} mm)\niris.stl               íris em relevo (anel entre a pupila e o limbo)\npupila.stl             pupila\nprotese_completa.stl   as três peças juntas, já alinhadas\niris_textura.png       cor da íris, ${TEX}×${TEX} px = Ø ${fmt(p.pIris, 2)} mm (fundo transparente)\niris_relevo.png        mapa de alturas, branco = ${fmt(hp.mx, 3)} mm acima da esclera\niris_desenrolada.png   íris limpa, desenrolada (0° a 360°, limbo em cima)\nparametros.json        todos os ajustes usados\nrelatorio.pdf          relatório de fabricação (paciente, medidas e parâmetros)\nficha.json             ficha do paciente (abrir no EITA! OLHO com a mesma foto)\n\nÍris Ø ${fmt(p.pIris, 2)} mm · pupila Ø ${fmt(p.pPup, 2)} mm · ${p.protSide === 'D' ? 'olho direito' : 'olho esquerdo'}${protParams().mirror ? ' (íris espelhada da foto)' : ''}\n\nProtótipo de pesquisa: o verso é uma calota esférica genérica. O encaixe na cavidade, o acabamento\ne a camada transparente continuam com o ocularista.\n`;
  const files = [
    { name: 'protese_completa.stl', data: all }, { name: 'esclera.stl', data: stl.esc }, { name: 'iris.stl', data: stl.iri }, { name: 'pupila.stl', data: stl.pup },
    { name: 'iris_textura.png', data: await canvasPNG(S.tex) }, { name: 'iris_relevo.png', data: await canvasPNG(hp.c) }, { name: 'iris_desenrolada.png', data: await canvasPNG(unwPNG(S.clean)) },
    { name: 'parametros.json', data: enc.encode(JSON.stringify(p, null, 2)) }, { name: 'LEIAME.txt', data: enc.encode(leia) },
  ];
  if (window.extraPackageFiles) files.push(...await window.extraPackageFiles(M));
  return { zip: makeZip(files), M, files };
}
window.__eitaPackage = buildPackage; // usado nos testes
$('exp').onclick = async () => {
  if (!S.iris) return;
  busy(true, 'Gerando os arquivos…');
  await new Promise(r => setTimeout(r, 30));
  try {
    const { zip, M } = await buildPackage();
    busy(false);
    const ok = await save(`${window.exportBase ? window.exportBase() : 'eita-olho_' + ($('protSide').value === 'D' ? 'OD' : 'OE') + '_' + new Date().toISOString().slice(0, 10)}.zip`, zip);
    const t = M.sclera.ntri + M.iris.ntri + M.pupil.ntri;
    $('expInfo').innerHTML = `<div class="${ok ? 'okbox' : 'note'}">${ok ? 'Pacote salvo.' : 'Pacote gerado.'} ${(zip.size / 1048576).toFixed(1)} MB · ${(t / 1000).toFixed(0)} mil triângulos.</div>`;
    if (ok) status('Pacote salvo. Abra o protese_completa.stl no fatiador, ou as peças separadas para multicolor.');
  } catch (e) { busy(false); status('Erro ao gerar os arquivos: ' + e.message); }
};
$('expTex').onclick = async () => { if (!S.tex) recompute(); if (S.tex) save('iris_textura.png', await new Promise(r => S.tex.toBlob(r, 'image/png'))); };

/* -------------------------------------------------------------- início */
buildStepper(); enableUpTo(1);
document.querySelector('#stepper button').classList.add('cur');
updateMirrorNote();
