/* EITA núcleo · pdf — gerador de PDF próprio (sem dependências) e layout de relatório Lab.EITA.
   Origem: gerador do EITA! AFO, adaptado no EITA! MAMILO v0.2. Puro: roda no navegador e no Node.
   Página A4 em pontos (595 × 842), origem no canto inferior esquerdo. Fontes Helvetica (WinAnsi);
   imagens em JPEG ({ bytes, w, h }, ver interface/imagem-navegador.js → jpegDe).
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */

const CP1252 = { "€": 128, "‚": 130, "ƒ": 131, "„": 132, "…": 133, "†": 134, "‡": 135, "ˆ": 136, "‰": 137, "Š": 138, "‹": 139, "Œ": 140, "Ž": 142, "‘": 145, "’": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151, "˜": 152, "™": 153, "š": 154, "›": 155, "œ": 156, "ž": 158, "Ÿ": 159 };
const SUBST = { "→": "->", "≥": ">=", "≤": "<=", "⚠": "!", "≈": "~" };

// Cores padrão dos relatórios Lab.EITA (RGB 0–1).
export const CORES_PDF = Object.freeze({ roxo: [0.42, 0.25, 0.84], tinta: [0.11, 0.09, 0.19], sutil: [0.36, 0.33, 0.45], linha: [0.88, 0.86, 0.93], fundo: [0.97, 0.96, 0.99], marca: [0.584, 0.376, 0.992], preto: [0.07, 0.07, 0.07] });

// texto → string PDF em WinAnsi, com parênteses e barras escapados
export function textoPDF(t) {
  let e = "";
  for (let ch of String(t)) {
    if (SUBST[ch]) ch = SUBST[ch];
    for (const c2 of ch) { let o = c2.charCodeAt(0); if (o > 255) o = CP1252[c2] || 63; const l = String.fromCharCode(o); e += l === "(" || l === ")" || l === "\\" ? "\\" + l : l; }
  }
  return e;
}
// largura aproximada de um texto em Helvetica no tamanho s (pt)
export function larguraTexto(t, s) { let n = 0; for (const o of String(t)) n += /[ilI.,;:'|!]/.test(o) ? 0.28 : /[mwMW@]/.test(o) ? 0.85 : /[A-Z0-9]/.test(o) ? 0.64 : 0.52; return n * s; }
export function cortarTexto(t, s, w) { t = String(t); if (larguraTexto(t, s) <= w) return t; while (t.length > 1 && larguraTexto(t + "…", s) > w) t = t.slice(0, -1); return t + "…"; }
export function quebrarTexto(t, s, w) { const pal = String(t).split(/\s+/), lin = []; let a = ""; for (const p of pal) { if (larguraTexto(a + " " + p, s) > w && a) { lin.push(a); a = p; } else a = a ? a + " " + p : p; } if (a) lin.push(a); return lin; }

export class PaginaPDF {
  constructor() { this.c = ""; }
  rect(x, y, w, h, c) { this.c += `${c.map((v) => v.toFixed(3)).join(" ")} rg ${x} ${y} ${w} ${h} re f\n`; }
  line(x, y, x2, y2, c, w = 0.6) { this.c += `${c.map((v) => v.toFixed(3)).join(" ")} RG ${w} w ${x} ${y} m ${x2} ${y2} l S\n`; }
  text(x, y, s, t, b, c = [0.11, 0.09, 0.19]) { this.c += `BT /${b ? "F2" : "F1"} ${s} Tf ${c.map((v) => v.toFixed(3)).join(" ")} rg ${x} ${y} Td (${textoPDF(t)}) Tj ET\n`; }
  image(n, x, y, w, h) { this.c += `q ${w} 0 0 ${h} ${x} ${y} cm /${n} Do Q\n`; }
}

// páginas (PaginaPDF[]) + imagens ([{ name, bytes, w, h }]) → Uint8Array do arquivo PDF
export function montarPDF(pages, imgs) {
  const bin = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
  const partes = [], off = []; let pos = 0; const add = (u) => { partes.push(u); pos += u.length; };
  add(bin("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"));
  const ni = imgs.length, p0 = 5 + ni, tot = 4 + ni + pages.length * 2;
  const obj = (k, b) => { off[k] = pos; add(b instanceof Uint8Array ? b : bin(`${k} 0 obj\n${b}\nendobj\n`)); };
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => p0 + i * 2 + " 0 R").join(" ")}] /Count ${pages.length} >>`);
  obj(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  obj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const xo = imgs.map((m, i) => `/${m.name} ${5 + i} 0 R`).join(" ");
  imgs.forEach((m, i) => { const k = 5 + i, a = bin(`${k} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${m.w} /Height ${m.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${m.bytes.length} >>\nstream\n`), z = bin("\nendstream\nendobj\n"), u = new Uint8Array(a.length + m.bytes.length + z.length); u.set(a); u.set(m.bytes, a.length); u.set(z, a.length + m.bytes.length); obj(k, u); });
  pages.forEach((pg, i) => {
    const k = p0 + i * 2, cont = bin(pg.c);
    obj(k, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xo} >> >> /Contents ${k + 1} 0 R >>`);
    const a = bin(`${k + 1} 0 obj\n<< /Length ${cont.length} >>\nstream\n`), z = bin("\nendstream\nendobj\n"), u = new Uint8Array(a.length + cont.length + z.length); u.set(a); u.set(cont, a.length); u.set(z, a.length + cont.length); obj(k + 1, u);
  });
  const xref = pos; let x = `xref\n0 ${tot + 1}\n0000000000 65535 f \n`;
  for (let k = 1; k <= tot; k++) x += String(off[k]).padStart(10, "0") + " 00000 n \n";
  add(bin(x + `trailer\n<< /Size ${tot + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  const out = new Uint8Array(pos); let o = 0; for (const p of partes) { out.set(p, o); o += p.length; } return out;
}

// ------------------------------------------------------------------ layout de relatório Lab.EITA
// Relatório de várias páginas com cabeçalho, seções, tabelas em duas colunas, checagem de segurança e rodapé.
// app: ["EITA!", "MAMILO"]; subtitulo; dataTexto; pacienteTexto (nome ou código, no cabeçalho);
// pacienteContinuacao (nas páginas seguintes; padrão = pacienteTexto); logo: nome da imagem ou null.
export function criarRelatorioPDF({ app, subtitulo, dataTexto, pacienteTexto, pacienteContinuacao = pacienteTexto, logo }) {
  const C = CORES_PDF, [marca, nomeApp] = app, titulo = marca + " " + nomeApp;
  const L = new PaginaPDF(), R = { paginas: [L], pg: L, y: 776 };
  L.rect(0, 792, 595, 50, C.fundo); L.rect(0, 790, 595, 2.5, C.roxo);
  if (logo) L.image(logo, 36, 800, 34, 34);
  const x0 = logo ? 78 : 36; L.text(x0, 820, 18, marca, true, C.preto); L.text(x0 + larguraTexto(marca + " ", 18), 820, 18, nomeApp, true, C.marca);
  L.text(x0, 805, 9, subtitulo, false, C.sutil);
  L.text(430, 820, 9, dataTexto, false, C.sutil);
  L.text(430, 806, 9, cortarTexto(pacienteTexto, 9, 128), true, C.tinta);

  R.novaPagina = () => { const pg = new PaginaPDF(); R.paginas.push(pg); R.pg = pg; pg.rect(0, 820, 595, 22, C.fundo); pg.text(36, 826, 9.5, titulo + " · " + cortarTexto(pacienteContinuacao, 9, 300) + " · continuação", true, C.roxo); R.y = 796; };
  R.secao = (tit, x = 36, x2 = 559) => { R.pg.text(x, R.y, 10.5, tit, true, C.roxo); R.y -= 6; R.pg.line(x, R.y, x2, R.y, C.linha); R.y -= 13; };
  // campo rotulado (rótulo pequeno em cima, valor em negrito embaixo), na linha atual
  R.campo = (x, w, rot, val) => { const v = val && String(val).trim() ? String(val).trim() : "—"; R.pg.text(x, R.y, 7.6, rot, false, C.sutil); R.pg.text(x, R.y - 10, 9, cortarTexto(v, 9, w - 6), true, C.tinta); };
  const tabela = (x, tit, linhas) => { const pg = R.pg; let yy = R.y; pg.text(x, yy, 10.5, tit, true, C.roxo); yy -= 6; pg.line(x, yy, x + 255, yy, C.linha); yy -= 13; for (const [a, b] of linhas) { pg.text(x, yy, 8.8, cortarTexto(a, 8.8, 150), false, C.sutil); const s = cortarTexto(String(b), 8.8, 140); pg.text(x + 255 - larguraTexto(s, 8.8), yy, 8.8, s, true, C.tinta); yy -= 13.2; } return yy; };
  // duas tabelas lado a lado (rótulo à esquerda, valor alinhado à direita); quebra a página se não couber
  R.par = (t1, l1, t2, l2) => { const h = 26 + Math.max(l1.length, l2.length) * 13.2; if (R.y - h < 50) R.novaPagina(); const a = tabela(36, t1, l1), b = tabela(304, t2, l2); R.y = Math.min(a, b) - 12; };
  // amostras de cor: [[nome, "#rrggbb"], …]
  R.cores = (tit, lista) => {
    if (R.y - 70 < 50) R.novaPagina();
    R.pg.text(36, R.y, 10.5, tit, true, C.roxo); R.y -= 6; R.pg.line(36, R.y, 559, R.y, C.linha); R.y -= 34;
    const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    lista.forEach(([nm, h], i) => { const x = 36 + i * 176; R.pg.rect(x, R.y, 40, 24, rgb(h)); R.pg.text(x + 48, R.y + 13, 9, nm, true, C.tinta); R.pg.text(x + 48, R.y + 2, 8.4, h.toUpperCase(), false, C.sutil); });
    R.y -= 22;
  };
  // checagem de segurança: [{ n: "alerta" | "atenção" | "info", t }]
  R.seguranca = (ch) => {
    const hS = 24 + ch.reduce((s, c) => s + 11 * quebrarTexto(c.t, 8.6, 465).length + 2, 12); if (R.y - hS < 48) R.novaPagina();
    R.secao("Checagem de segurança");
    if (!ch.length) { R.pg.text(36, R.y, 8.8, "Nenhum problema encontrado pelas verificações automáticas.", false, [0.15, 0.47, 0.31]); R.y -= 12; }
    for (const c of ch) { const cor = c.n === "alerta" ? [0.62, 0.18, 0.08] : c.n === "info" ? C.sutil : [0.55, 0.33, 0.03]; const lin = quebrarTexto(c.t, 8.6, 465); if (R.y - lin.length * 11 < 46) R.novaPagina(); R.pg.text(36, R.y, 8.6, c.n === "alerta" ? "ALERTA" : c.n === "info" ? "info" : "atenção", true, cor); lin.forEach((l, k) => R.pg.text(92, R.y - k * 11, 8.6, l, false, C.tinta)); R.y -= 11 * lin.length + 2; }
  };
  R.avisoFinal = (texto) => { R.y -= 8; if (R.y < 76) R.novaPagina(); R.pg.line(36, R.y, 559, R.y, C.linha); quebrarTexto(texto, 8, 523).forEach((l, k) => R.pg.text(36, R.y - 14 - k * 11, 8, l, false, C.sutil)); };
  // rodapé com autoria e numeração; devolve o PDF pronto
  R.finalizar = (imgs) => {
    const ps = R.paginas;
    ps.forEach((p, i) => {
      if (i === 0) { p.text(36, 34, 7.2, titulo + " · © 2026 Lab.EITA — Laboratório de Estudos Inventivos em Tecnologias Assistivas · Universidade Federal de Goiás", false, C.sutil); p.text(36, 24, 7.2, "Autor: Pedro Henrique Gonçalves", false, C.sutil); }
      else p.text(36, 28, 7.2, titulo + " · Lab.EITA / UFG", false, C.sutil);
      const t = "página " + (i + 1) + " de " + ps.length; p.text(559 - larguraTexto(t, 7.2), i === 0 ? 24 : 28, 7.2, t, false, C.sutil);
    });
    return montarPDF(ps, imgs);
  };
  return R;
}
