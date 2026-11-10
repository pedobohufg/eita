/* EITA! OLHO — ficha do paciente e relatório. © 2026 Lab.EITA/UFG. Todos os direitos reservados. */
'use strict';

/* ================================================================ FICHA */
const FICHA_KEY = 'eitaOLHO.fichas.v1';
const PAT_IDS = ['pName', 'pId', 'pBirth', 'pSex', 'pEye', 'pSurg', 'pSurgDate', 'pDiag', 'pImpl', 'pPrev', 'pProf', 'pNotes'];
const INPUT_IDS = ['photoSide', 'protSide', 'hvid', 'rulerMM', 'concentric', 'specOn', 'specThr', 'upOn', 'upA', 'upB', 'loOn', 'loA', 'loB', 'cBri', 'cCon', 'cSat',
  'hBase', 'hDepth', 'hDetail', 'hSmooth', 'hInv', 'hTrans', 'hLimbus', 'pupMode', 'pupH', 'pIrisAuto', 'pIris', 'pPupAuto', 'pPup',
  'sW', 'sH', 'sMode', 'sRF', 'sShell', 'sT', 'sRB', 'sIns', 'sDx', 'sDy', 'res'];
const SURG = { enucleacao: 'enucleação', evisceracao: 'evisceração', exenteracao: 'exenteração', congenita: 'anoftalmia / microftalmia congênita', phthisis: 'olho atrófico (phthisis bulbi)', outra: 'outra' };
const PREV = { nenhuma: 'nenhuma (primeira prótese)', conformador: 'conformador', pre: 'pré-fabricada', medida: 'sob medida (PMMA)', outra: 'outra' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let pendingFicha = null;

function ageText(d) {
  if (!d) return '';
  const b = new Date(d + 'T12:00:00'), n = new Date();
  if (isNaN(b)) return '';
  let m = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
  if (n.getDate() < b.getDate()) m--;
  if (m < 0) return '';
  if (m < 24) return m + ' meses';
  return Math.floor(m / 12) + ' anos' + (m % 12 ? ' e ' + (m % 12) + ' ' + (m % 12 > 1 ? 'meses' : 'mês') : '');
}
function readPatient() { const o = {}; PAT_IDS.forEach(id => { o[id] = $(id).value.trim(); }); return o; }
function writePatient(p) {
  PAT_IDS.forEach(id => { if (id !== 'pEye') $(id).value = (p && p[id]) || ''; });
  if (p && p.pEye) { $('pEye').value = p.pEye; }
  updAge();
}
function updAge() {
  const a = ageText($('pBirth').value);
  $('pAge').textContent = a ? 'Idade: ' + a : '';
  const n = $('pName').value.trim() || $('pId').value.trim();
  $('pBadge').textContent = n ? '· ' + n : '';
}
function readInputs() {
  const o = {};
  INPUT_IDS.forEach(id => { const el = $(id); if (el) o[id] = el.type === 'checkbox' ? el.checked : el.value; });
  return o;
}
function writeInputs(o) {
  // primeiro as caixas "usar o medido", para não sobrescreverem os diâmetros
  ['pIrisAuto', 'pPupAuto'].forEach(id => { if (id in (o || {})) $(id).checked = !!o[id]; });
  for (const [id, v] of Object.entries(o || {})) {
    const el = $(id); if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
    const r = $(id + 'R'); if (r) r.value = v;
  }
  $('sMode').dispatchEvent(new Event('change'));
  $('pEye').value = $('protSide').value;
}
function slug(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function fichaBase() { return slug(($('pId').value || $('pName').value || '').trim()); }
function fichaKey() { const b = fichaBase(); return b ? b + '_' + $('protSide').value : 'p' + Date.now().toString(36); }
function fichaList() { try { return JSON.parse(localStorage.getItem(FICHA_KEY) || '[]'); } catch (e) { return []; } }
function fichaStore(l) { try { localStorage.setItem(FICHA_KEY, JSON.stringify(l)); return true; } catch (e) { return false; } }
function exportBase() {
  const b = fichaBase() || 'eita-olho';
  return `${b}_${$('protSide').value === 'D' ? 'OD' : 'OE'}_${new Date().toISOString().slice(0, 10)}`;
}
function thumb() {
  if (!S.tex) return null;
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const g = c.getContext('2d'); g.fillStyle = '#ece6dc'; g.fillRect(0, 0, 96, 96); g.drawImage(S.tex, 4, 4, 88, 88);
  return c.toDataURL('image/jpeg', 0.8);
}
function resultSummary() {
  if (!S.iris) return null;
  const m = measured(), pp = protParams();
  return { iris_medida_mm: +m.iris.toFixed(2), pupila_medida_mm: +m.pup.toFixed(2), iris_mm: pp.Di, pupila_mm: pp.Dp, espelhada: pp.mirror };
}
function collectFicha() {
  return {
    formato: 'EITA! OLHO ficha', versaoApp: '0.2', id: fichaKey(), olho: $('protSide').value,
    nome: $('pName').value.trim() || $('pId').value.trim(), paciente: readPatient(), atualizado: new Date().toISOString(),
    foto: S.img ? { nome: S.photoName || '', largura: S.W, altura: S.H } : null,
    estado: S.iris ? { iris: S.iris, pupila: S.pup, regua: S.ruler, balancoBranco: S.wb, escala: scaleMode } : null,
    entradas: readInputs(), resultado: resultSummary(), miniatura: thumb(),
  };
}
function saveFicha(silent) {
  const f = collectFicha();
  if (!f.nome) { if (!silent) { status('Dê um nome ou código à ficha antes de salvar.'); openSection('s0'); $('pName').focus(); } return false; }
  const l = fichaList(), i = l.findIndex(x => x.id === f.id);
  if (i >= 0) l[i] = f; else l.unshift(f);
  let ok = fichaStore(l);
  if (!ok) { f.miniatura = null; if (i >= 0) l[i] = f; else l[0] = f; ok = fichaStore(l); }
  S.patient = { id: f.id, name: f.nome };
  if (!silent) status(ok ? `Ficha "${esc(f.nome)}" salva neste navegador. Use "Exportar" para guardar uma cópia em arquivo.` : 'Não foi possível salvar no navegador; use "Exportar".');
  renderFichas();
  return ok;
}
function autoUpdateFicha() { // ao exportar, atualiza a ficha se ela já existe
  const id = fichaKey();
  if (fichaBase() && fichaList().some(x => x.id === id)) saveFicha(true);
}
function renderFichas() {
  const box = $('fList'), l = fichaList(), cur = S.patient && S.patient.id;
  if (!l.length) { box.innerHTML = '<div class="note">Nenhuma ficha salva neste navegador.</div>'; return; }
  box.innerHTML = l.map((f, i) => `<div class="frow${f.id === cur ? ' cur' : ''}">${f.miniatura ? `<img src="${f.miniatura}" alt="">` : '<img alt="">'}<div><b>${esc(f.nome || '(sem nome)')}</b><small>${f.olho === 'E' ? 'OE' : 'OD'} · ${new Date(f.atualizado).toLocaleDateString('pt-BR')}${f.foto && f.foto.nome ? ' · ' + esc(f.foto.nome) : ''}</small></div><button type="button" data-open="${i}">Abrir</button><button type="button" data-del="${i}" title="Excluir">×</button></div>`).join('');
  box.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openFicha(fichaList()[+b.dataset.open]));
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    const l2 = fichaList(), f = l2[+b.dataset.del];
    if (!confirm(`Excluir a ficha "${f.nome || ''}" deste navegador?`)) return;
    l2.splice(+b.dataset.del, 1); fichaStore(l2); renderFichas();
  });
}
function openFicha(f) {
  if (!f || f.formato !== 'EITA! OLHO ficha') { status('Arquivo de ficha não reconhecido.'); return; }
  writePatient(f.paciente || { pName: f.nome || '' });
  writeInputs(f.entradas);
  S.patient = { id: f.id, name: f.nome };
  renderFichas(); openSection('s0');
  const same = S.img && f.foto && f.foto.largura === S.W && f.foto.altura === S.H && (!f.foto.nome || f.foto.nome === S.photoName);
  if (same) { applyState(f); return; }
  if (S.iris) changed();
  pendingFicha = f;
  status(`Ficha "${esc(f.nome)}" aberta: dados do paciente e ajustes restaurados.${f.foto && f.foto.nome ? ` Carregue a foto <b>${esc(f.foto.nome)}</b> (etapa 1) para restaurar também os círculos, a escala e o balanço de branco.` : ''}`);
}
function applyState(f) {
  pendingFicha = null;
  const e = f.estado;
  if (e) {
    const btn = document.querySelector(`#scaleMode button[data-v="${e.escala || 'hvid'}"]`); if (btn) btn.click();
    if (e.balancoBranco) { S.wb = e.balancoBranco.slice(); $('wbInfo').textContent = `Ganhos R/G/B: ${S.wb.map(v => fmt(v, 2)).join(' / ')}`; refreshImgCanvas(); }
    if (f.foto && f.foto.largura === S.W && f.foto.altura === S.H) {
      S.iris = { ...e.iris }; S.pup = { ...e.pupila }; S.ruler = e.regua ? e.regua.map(p => ({ ...p })) : null;
    }
  }
  writeInputs(f.entradas);
  afterCircles(true);
  status(`Ficha "${esc(f.nome)}" aplicada: círculos, escala, cor e parâmetros da prótese restaurados.`);
}
window.onPhotoReady = () => {
  if (!pendingFicha) return;
  const f = pendingFicha;
  if (f.foto && (f.foto.largura !== S.W || f.foto.altura !== S.H)) {
    pendingFicha = null; writeInputs(f.entradas); changed();
    status(`A foto carregada não é a mesma da ficha "${esc(f.nome)}" (${f.foto.largura} × ${f.foto.altura} px). Os ajustes foram mantidos, mas a íris e a pupila foram detectadas de novo — confira os círculos.`);
    return;
  }
  applyState(f);
};
function newFicha() {
  writePatient({}); S.patient = null; pendingFicha = null; $('pEye').value = $('protSide').value;
  renderFichas(); status('Ficha em branco. Preencha os dados do paciente e salve.'); $('pName').focus();
}
async function exportFicha() {
  const f = collectFicha();
  if (!f.nome) { status('Dê um nome ou código à ficha antes de exportar.'); $('pName').focus(); return; }
  if (await save(`${fichaBase()}_${f.olho === 'E' ? 'OE' : 'OD'}_ficha_OLHO.json`, new Blob([JSON.stringify(f, null, 1)], { type: 'application/json' }))) status('Ficha exportada.');
}
function readJSONFile(file) { return file.text().then(t => JSON.parse(t)); }
async function importFichaFile(file) {
  try {
    const j = await readJSONFile(file);
    if (j && j.formato === 'EITA! OLHO base') { mergeBase(j); return; }
    openFicha(j);
  } catch (e) { status('Não consegui ler esse arquivo de ficha.'); }
}
function mergeBase(j) {
  const l = fichaList(); let add = 0, upd = 0;
  for (const f of j.fichas || []) {
    if (!f || f.formato !== 'EITA! OLHO ficha') continue;
    const i = l.findIndex(x => x.id === f.id);
    if (i < 0) { l.push(f); add++; }
    else if (new Date(f.atualizado) > new Date(l[i].atualizado)) { l[i] = f; upd++; }
  }
  l.sort((a, b) => new Date(b.atualizado) - new Date(a.atualizado));
  status(fichaStore(l) ? `Base importada: ${add} ficha(s) nova(s), ${upd} atualizada(s).` : 'Não foi possível gravar a base neste navegador (espaço cheio?).');
  renderFichas();
}
async function dbExport() {
  const l = fichaList();
  if (!l.length) { status('Não há fichas salvas neste navegador.'); return; }
  const j = { formato: 'EITA! OLHO base', exportado: new Date().toISOString(), fichas: l };
  if (await save(`eita-olho_base_${new Date().toISOString().slice(0, 10)}.json`, new Blob([JSON.stringify(j)], { type: 'application/json' }))) status(`Base exportada com ${l.length} ficha(s).`);
}

$('fSave').onclick = () => saveFicha(false);
$('fNew').onclick = newFicha;
$('fExp').onclick = exportFicha;
$('fImpB').onclick = () => $('fImp').click();
$('fImp').onchange = () => { const f = $('fImp').files[0]; if (f) importFichaFile(f); $('fImp').value = ''; };
$('dbExp').onclick = dbExport;
$('dbImpB').onclick = () => $('dbImp').click();
$('dbImp').onchange = async () => {
  const f = $('dbImp').files[0]; $('dbImp').value = ''; if (!f) return;
  try { const j = await readJSONFile(f); if (j.formato === 'EITA! OLHO base') mergeBase(j); else if (j.formato === 'EITA! OLHO ficha') mergeBase({ fichas: [j] }); else status('Arquivo de base não reconhecido.'); }
  catch (e) { status('Não consegui ler esse arquivo de base.'); }
};
['pBirth', 'pName', 'pId'].forEach(id => $(id).addEventListener('input', updAge));
$('pEye').addEventListener('change', () => { $('protSide').value = $('pEye').value; $('protSide').dispatchEvent(new Event('change')); });
$('protSide').addEventListener('change', () => { $('pEye').value = $('protSide').value; });
$('pEye').value = $('protSide').value;

/* ================================================================ PDF */
const CP1252 = { '€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135, 'ˆ': 136, '‰': 137, 'Š': 138, '‹': 139, 'Œ': 140, 'Ž': 142, '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '˜': 152, '™': 153, 'š': 154, '›': 155, 'œ': 156, 'ž': 158, 'Ÿ': 159 };
function pdfEsc(t) {
  let o = '';
  for (const ch of String(t)) {
    let c = ch.charCodeAt(0); if (c > 255) c = CP1252[ch] || 63;
    const s = String.fromCharCode(c); o += s === '(' || s === ')' || s === '\\' ? '\\' + s : s;
  }
  return o;
}
function pdfW(t, sz) { let n = 0; for (const c of String(t)) n += /[ilI.,;:'|!]/.test(c) ? 0.28 : /[mwMW@]/.test(c) ? 0.85 : /[A-Z0-9]/.test(c) ? 0.64 : 0.52; return n * sz; }
class PdfPage {
  constructor() { this.c = ''; }
  rect(x, y, w, h, col) { this.c += `${col.map(v => v.toFixed(3)).join(' ')} rg ${x} ${y} ${w} ${h} re f\n`; }
  line(x1, y1, x2, y2, col, lw = 0.6) { this.c += `${col.map(v => v.toFixed(3)).join(' ')} RG ${lw} w ${x1} ${y1} m ${x2} ${y2} l S\n`; }
  text(x, y, sz, t, bold, col = [0.11, 0.09, 0.19]) { this.c += `BT /${bold ? 'F2' : 'F1'} ${sz} Tf ${col.map(v => v.toFixed(3)).join(' ')} rg ${x} ${y} Td (${pdfEsc(t)}) Tj ET\n`; }
  image(name, x, y, w, h) { this.c += `q ${w} 0 0 ${h} ${x} ${y} cm /${name} Do Q\n`; }
}
function makePDF(pages, imgs) {
  const bin = s => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
  const parts = [], offs = []; let len = 0;
  const push = u => { parts.push(u); len += u.length; };
  push(bin('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'));
  const nI = imgs.length, first = 5 + nI, nObj = 4 + nI + pages.length * 2;
  const obj = (n, body) => { offs[n] = len; push(body instanceof Uint8Array ? body : bin(`${n} 0 obj\n${body}\nendobj\n`)); };
  const cat = (...a) => { let L = 0; a.forEach(x => L += x.length); const u = new Uint8Array(L); let o = 0; a.forEach(x => { u.set(x, o); o += x.length; }); return u; };
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${pages.map((p, i) => (first + i * 2) + ' 0 R').join(' ')}] /Count ${pages.length} >>`);
  obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const xo = imgs.map((im, i) => `/${im.name} ${5 + i} 0 R`).join(' ');
  imgs.forEach((im, i) => {
    const n = 5 + i;
    obj(n, cat(bin(`${n} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`), im.bytes, bin('\nendstream\nendobj\n')));
  });
  pages.forEach((p, i) => {
    const n = first + i * 2, c = bin(p.c);
    obj(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xo} >> >> /Contents ${n + 1} 0 R >>`);
    obj(n + 1, cat(bin(`${n + 1} 0 obj\n<< /Length ${c.length} >>\nstream\n`), c, bin('\nendstream\nendobj\n')));
  });
  const xref = len;
  let x = `xref\n0 ${nObj + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= nObj; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  push(bin(x + `trailer\n<< /Size ${nObj + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  return cat(...parts);
}
function jpegOf(cv, q = 0.9) {
  const s = atob(cv.toDataURL('image/jpeg', q).split(',')[1]), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return { bytes: u, w: cv.width, h: cv.height };
}
function sq(n = 640, bg = '#ffffff') { const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, n, n); return [c, g]; }
async function logoJpeg() {
  try {
    const im = new Image(); im.src = 'assets/eita-olho-simbolo.png'; await im.decode();
    const [c, g] = sq(160); g.drawImage(im, 0, 0, 160, 160); return jpegOf(c, 0.92);
  } catch (e) { return null; }
}
/* imagens do relatório */
function imgPhoto() {
  const I = S.iris, P = S.pup, half = I.r * 1.7, [c, g] = sq();
  g.drawImage(S.img, I.x - half, I.y - half, 2 * half, 2 * half, 0, 0, 640, 640);
  const k = 640 / (2 * half), T = p => [(p.x - I.x + half) * k, (p.y - I.y + half) * k];
  g.lineWidth = 3;
  g.strokeStyle = '#2f6fdb'; g.beginPath(); g.arc(...T(I), I.r * k, 0, TAU); g.stroke();
  g.strokeStyle = '#e2483d'; g.beginPath(); g.arc(...T(P), P.r * k, 0, TAU); g.stroke();
  return jpegOf(c);
}
function imgTexture() { const [c, g] = sq(640, '#ece6dc'); g.drawImage(S.tex, 24, 24, 592, 592); return jpegOf(c); }
function imgRelief() { const [c, g] = sq(); g.drawImage(shadeHM(S.hm), 24, 24, 592, 592); return jpegOf(c); }
function img3D(views) {
  if (!gl) return [];
  if (S.dirty || !S.meshes) { recompute(); S.meshes = buildMeshes(false); S.dirty = false; for (const k of ['sclera', 'iris', 'pupil']) upload(k, S.meshes[k]); }
  const c0 = { ...cam }, tab = S.tab, vis = ['vS', 'vI', 'vP', 'vC'].map(id => $(id).checked);
  ['vS', 'vI', 'vP', 'vC'].forEach(id => $(id).checked = true);
  S.tab = '3d';
  const out = [], cv = $('gl');
  for (const [yaw, pitch] of views) {
    Object.assign(cam, { yaw, pitch, tx: 0, ty: 0, dist: 40 }); drawGL();
    const w = cv.width, h = cv.height, m = Math.min(w, h), [c, g] = sq(640, '#f4f2f9');
    g.drawImage(cv, (w - m) / 2, (h - m) / 2, m, m, 0, 0, 640, 640);
    out.push(jpegOf(c));
  }
  Object.assign(cam, c0); ['vS', 'vI', 'vP', 'vC'].forEach((id, i) => $(id).checked = vis[i]);
  S.tab = tab; if (tab === '3d') drawGL();
  return out;
}

async function buildReport(M) {
  if (!S.iris) return null;
  if (S.dirty || !S.tex) recompute();
  M = M || buildMeshes($('res').value === 'h');
  const P = readPatient(), m = measured(), pp = protParams(), G = geomParams(), p = params();
  const shots = [imgPhoto(), imgTexture(), imgRelief(), ...img3D([[-0.55, 0.45]])];
  const imgs = shots.map((im, i) => Object.assign({ name: 'Im' + (i + 1) }, im));
  const logo = await logoJpeg(); if (logo) imgs.push(Object.assign({ name: 'Lg' }, logo));

  const ACC = [0.42, 0.25, 0.84], INK = [0.11, 0.09, 0.19], MUT = [0.36, 0.33, 0.45], LINE = [0.88, 0.86, 0.93], BR = [0.584, 0.376, 0.992];
  const dash = v => v != null && String(v).trim() ? String(v).trim() : '—';
  const fit = (t, sz, w) => { t = String(t); if (pdfW(t, sz) <= w) return t; while (t.length > 1 && pdfW(t + '…', sz) > w) t = t.slice(0, -1); return t + '…'; };
  const wrap = (t, sz, w, maxL) => {
    const words = String(t).replace(/\s+/g, ' ').trim().split(' '), L = []; let cur = '';
    for (const wd of words) { const tr = cur ? cur + ' ' + wd : wd; if (pdfW(tr, sz) > w && cur) { L.push(cur); cur = wd; } else cur = tr; }
    if (cur) L.push(cur);
    if (L.length > maxL) { L.length = maxL; L[maxL - 1] = fit(L[maxL - 1] + '…', sz, w); }
    return L;
  };
  const D = (v, d = 1) => v == null || !Number.isFinite(+v) ? '—' : (+v).toFixed(d).replace('.', ',');
  const pg = new PdfPage(), now = new Date();

  // cabeçalho
  pg.rect(0, 792, 595, 50, [0.97, 0.96, 0.99]); pg.rect(0, 790, 595, 2.5, ACC);
  const lx = logo ? 78 : 36; if (logo) pg.image('Lg', 36, 800, 34, 34);
  pg.text(lx, 820, 18, 'EITA!', true, [0.07, 0.07, 0.07]); pg.text(lx + pdfW('EITA! ', 18), 820, 18, 'OLHO', true, BR);
  pg.text(lx, 805, 9, 'Relatório de fabricação · prótese ocular · Lab.EITA / UFG', false, MUT);
  pg.text(430, 820, 9, now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), false, MUT);
  pg.text(430, 806, 9, fit(P.pName || P.pId || 'Paciente sem ficha', 9, 128), true, INK);

  // paciente
  let y = 776;
  pg.text(36, y, 10.5, 'Paciente', true, ACC); y -= 6; pg.line(36, y, 559, y, LINE); y -= 13;
  const field = (x, w, lab, val) => { pg.text(x, y, 7.6, lab, false, MUT); pg.text(x, y - 10, 9, fit(dash(val), 9, w - 6), true, INK); };
  const bd = P.pBirth ? new Date(P.pBirth + 'T12:00:00').toLocaleDateString('pt-BR') : '', age = ageText(P.pBirth);
  field(36, 170, 'Nome', P.pName); field(206, 100, 'Prontuário / código', P.pId); field(306, 175, 'Nascimento', bd ? bd + (age ? ' · ' + age : '') : ''); field(481, 78, 'Sexo', { F: 'feminino', M: 'masculino', O: 'outro' }[P.pSex]);
  y -= 25;
  field(36, 100, 'Olho da prótese', $('protSide').value === 'D' ? 'direito (OD)' : 'esquerdo (OE)'); field(136, 170, 'Cavidade', SURG[P.pSurg]);
  field(306, 90, 'Data da cirurgia', P.pSurgDate ? new Date(P.pSurgDate + 'T12:00:00').toLocaleDateString('pt-BR') : ''); field(396, 163, 'Implante orbital', P.pImpl);
  y -= 25;
  field(36, 270, 'Causa da perda / diagnóstico', P.pDiag); field(306, 253, 'Prótese anterior', PREV[P.pPrev]);
  y -= 25;
  field(36, 270, 'Ocularista / profissional responsável', P.pProf);
  pg.text(306, y, 7.6, 'Observações', false, MUT);
  const obs = P.pNotes ? wrap(P.pNotes, 8.6, 250, 3) : ['—'];
  obs.forEach((l, i) => pg.text(306, y - 10 - i * 10.5, 8.6, l, i === 0 && !P.pNotes, INK));
  y -= 18 + Math.max(0, obs.length - 1) * 10.5;

  // imagens
  const S4 = 120, gap = (523 - 4 * S4) / 3, iy = y - 8 - S4;
  const caps = ['Foto e círculos detectados', 'Textura da íris' + (pp.mirror ? ' (espelhada)' : ''), 'Relevo (luz rasante)', 'Modelo 3D'];
  imgs.slice(0, 4).forEach((im, i) => { if (im.name === 'Lg') return; const x = 36 + i * (S4 + gap); pg.image(im.name, x, iy, S4, S4); pg.text(x, iy - 10, 7.4, fit(caps[i], 7.4, S4), false, MUT); });
  y = iy - 30;

  // tabelas em duas colunas
  const table = (x, y0, title, rows) => {
    let yy = y0; pg.text(x, yy, 10.5, title, true, ACC); yy -= 6; pg.line(x, yy, x + 255, yy, LINE); yy -= 13;
    for (const [k, v] of rows) { pg.text(x, yy, 8.6, fit(k, 8.6, 150), false, MUT); const s = fit(String(v), 8.6, 120); pg.text(x + 255 - pdfW(s, 8.6), yy, 8.6, s, true, INK); yy -= 12.6; }
    return yy;
  };
  const shell = checkShell(), rho = outlineRho(180); let maxR = 0; for (const r of rho) maxR = Math.max(maxR, r);
  const sag = G.mode === 'shell' ? -G.back(Math.min(maxR, G.RF - G.SH - 0.3)) : null;
  const yA = table(36, y, 'Fotografia e medidas', [
    ['Arquivo da foto', fit(S.photoName || '—', 8.6, 120)],
    ['Olho fotografado', p.photoSide === 'D' ? 'direito (OD)' : 'esquerdo (OE)'],
    ['Resolução usada', `${S.W} × ${S.H} px`],
    ['Escala', scaleMode === 'ruler' && S.ruler ? `régua (${D(p.rulerMM, 1)} mm)` : `Ø da íris = ${D(p.hvid, 1)} mm`],
    ['Resolução da foto na íris', `${D(m.k * 1000, 1)} \u00b5m/px`],
    ['Íris medida (Ø)', D(m.iris, 2) + ' mm'],
    ['Pupila medida (Ø)', D(m.pup, 2) + ' mm'],
    ['Pupila / íris', D(S.pup.r / S.iris.r, 2)],
    ['Descentração da pupila', D(Math.hypot(S.pup.x - S.iris.x, S.pup.y - S.iris.y) * m.k, 2) + ' mm'],
    ['Balanço de branco (R/G/B)', S.wb.every(v => v === 1) ? 'não aplicado' : S.wb.map(v => D(v, 2)).join(' / ')],
  ]);
  const yB = table(304, y, 'Prótese', [
    ['Olho', $('protSide').value === 'D' ? 'direito (OD)' : 'esquerdo (OE)'],
    ['Íris da foto espelhada', pp.mirror ? 'sim' : 'não'],
    ['Íris / pupila (Ø)', `${D(pp.Di, 2)} / ${D(pp.Dp, 2)} mm`],
    ['Contorno (largura × altura)', `${D(p.sW, 1)} × ${D(p.sH, 1)} mm`],
    ['Verso', G.mode === 'shell' ? `casca de ${D(G.SH, 1)} mm` : `maciço · ${D(G.T, 1)} mm no centro`],
    ['Raio anterior' + (G.mode === 'shell' ? '' : ' / posterior'), G.mode === 'shell' ? D(G.RF, 1) + ' mm' : `${D(G.RF, 1)} / ${D(G.RB, 1)} mm`],
    ['Encaixe da íris', D(G.INS, 1) + ' mm'],
    ['Íris deslocada (nasal / cima)', `${D(p.sDx, 1)} / ${D(p.sDy, 1)} mm`],
    [G.mode === 'shell' ? 'Profundidade da casca' : 'Espessura mínima na borda', G.mode === 'shell' ? D(sag, 1) + ' mm' : D(shell.minT, 2) + ' mm'],
    ['Distância mínima íris–borda', D(shell.minR - G.RI, 1) + ' mm'],
  ]);
  y = Math.min(yA, yB) - 10;
  const sect = (on, a, b) => on ? `${D(a, 0)}° a ${D(b, 0)}°` : 'não';
  const yC = table(36, y, 'Íris: limpeza e relevo', [
    ['Reflexos removidos', p.specOn ? `sim (limiar ${D(p.specThr, 2)})` : 'não'],
    ['Setor superior substituído', sect(p.upOn, p.upA, p.upB)],
    ['Setor inferior substituído', sect(p.loOn, p.loA, p.loB)],
    ['Brilho / contraste / saturação', `${D(p.cBri, 2)} / ${D(p.cCon, 2)} / ${D(p.cSat, 2)}`],
    ['Altura base / relevo', `${D(p.hBase, 2)} / ${D(p.hDepth, 2)} mm`],
    ['Detalhes / suavização', `${D(p.hDetail, 2)} / ${D(p.hSmooth, 2)} mm`],
    ['Transição esclera–íris', D(p.hTrans, 1) + ' mm' + (p.hLimbus ? ' · anel do limbo' : '') + (p.hInv ? ' · invertido' : '')],
    ['Pupila', { dome: `cúpula de ${D(p.pupH, 2)} mm`, flat: 'plana', sunk: 'rebaixada' }[p.pupMode]],
  ]);
  const vol = M.sclera.vol + M.iris.vol + M.pupil.vol;
  const yD = table(304, y, 'Modelo e fabricação', [
    ['Volume esclera / íris / pupila', `${D(M.sclera.vol, 0)} / ${D(M.iris.vol, 1)} / ${D(M.pupil.vol, 1)} mm³`],
    ['Volume total', D(vol / 1000, 2) + ' mL'],
    ['Resolução da íris', $('res').value === 'h' ? 'alta (~0,015 mm)' : 'normal (~0,03 mm)'],
    ['Triângulos', (M.sclera.ntri + M.iris.ntri + M.pupil.ntri).toLocaleString('pt-BR')],
    ['Arquivos', 'STL: completa + 3 peças'],
    ['Impressão', 'multicolor ou peças pintadas'],
    ['Textura da íris (PNG)', `${TEX} px = Ø ${D(pp.Di, 2)} mm`],
    ['Camada transparente', 'pelo ocularista'],
  ]);
  y = Math.min(yC, yD) - 6;

  // avisos
  const warn = [...$('shellWarn').querySelectorAll('.warnbox')].flatMap(e => e.innerHTML.split(/<br\s*\/?>/i)).map(h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent.trim(); }).filter(Boolean);
  if (warn.length) {
    pg.text(36, y, 10.5, 'Avisos', true, [0.69, 0.31, 0.05]); y -= 13;
    for (const w of warn) for (const l of wrap(w, 8.4, 520, 2)) { pg.text(36, y, 8.4, l, false, [0.55, 0.25, 0.04]); y -= 10.5; }
    y -= 4;
  }

  // prova e assinaturas
  const sy = Math.min(y - 30, 96);
  pg.text(36, sy + 30, 10.5, 'Prova e entrega', true, ACC); pg.line(36, sy + 24, 559, sy + 24, LINE);
  [[36, 'Data da prova'], [206, 'Ajustes feitos']].forEach(([x, l]) => pg.text(x, sy + 10, 8, l + ':', false, MUT));
  pg.line(96, sy + 9, 196, sy + 9, LINE); pg.line(272, sy + 9, 559, sy + 9, LINE);
  pg.line(36, sy - 22, 260, sy - 22, [0.6, 0.57, 0.68]); pg.line(335, sy - 22, 559, sy - 22, [0.6, 0.57, 0.68]);
  pg.text(36, sy - 32, 8, 'Responsável pela modelagem', false, MUT); pg.text(335, sy - 32, 8, 'Ocularista' + (P.pProf ? ' · ' + fit(P.pProf, 8, 160) : ''), false, MUT);

  // rodapé
  pg.line(36, 34, 559, 34, LINE);
  pg.text(36, 24, 7, 'Protótipo de pesquisa. Não substitui a avaliação, o ajuste e o acabamento feitos pelo ocularista. Documento com dados de paciente: acesso restrito à equipe.', false, MUT);
  pg.text(36, 15, 7, '© 2026 Laboratório de Estudos Inventivos em Tecnologias Assistivas da Universidade Federal de Goiás (Lab.EITA/UFG) · EITA! OLHO v0.2', false, MUT);
  return makePDF([pg], imgs);
}

window.extraPackageFiles = async M => {
  autoUpdateFicha();
  const out = [{ name: 'ficha.json', data: new TextEncoder().encode(JSON.stringify(collectFicha(), null, 1)) }];
  const pdf = await buildReport(M); if (pdf) out.push({ name: 'relatorio.pdf', data: pdf });
  return out;
};
$('expPdf').onclick = async () => {
  if (!S.iris) { status('Carregue a foto e confira a íris antes de gerar o relatório.'); return; }
  if (!$('pName').value.trim() && !$('pId').value.trim()) status('Dica: preencha a ficha do paciente (no topo do painel) para o relatório sair com os dados dele.');
  busy(true, 'Montando o relatório…'); await new Promise(r => setTimeout(r, 30));
  try {
    autoUpdateFicha();
    const pdf = await buildReport(); busy(false);
    if (pdf && await save(exportBase() + '_relatorio.pdf', new Blob([pdf], { type: 'application/pdf' }))) {
      $('expInfo').innerHTML = '<div class="okbox">Relatório salvo.</div>'; status('Relatório salvo.');
    }
  } catch (e) { busy(false); status('Erro ao gerar o relatório: ' + e.message); }
};
window.__eitaReport = buildReport; // usado nos testes

renderFichas(); updAge();
