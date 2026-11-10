/* EITA núcleo · interface/imagem-navegador — abrir fotos, canvas e JPEG no navegador.
   Só navegador (usa Image, canvas e FileReader); nada acontece na importação.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */

// abre uma imagem (URL ou dataURL) reduzida para no máximo maxLado px → { data, width, height, canvas, original }
export async function carregarImagem(src, maxLado) {
  const img = new Image(); img.decoding = "async";
  await new Promise((ok, erro) => { img.onload = ok; img.onerror = () => erro(new Error("Não foi possível abrir a imagem.")); img.src = src; });
  const f = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * f), h = Math.round(img.naturalHeight * f);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h);
  return { data: d.data, width: w, height: h, canvas: c, original: [img.naturalWidth, img.naturalHeight] };
}
export const lerArquivo = (f) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); });
// { data, width, height } (RGBA) → canvas
export function paraCanvas(img) { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0); return c; }
// <img> carregado (não falha: em erro devolve a imagem vazia)
export async function elementoImagem(src) { const i = new Image(); await new Promise((ok) => { i.onload = ok; i.onerror = ok; i.src = src; }); return i; }
// canvas → { bytes, w, h } em JPEG, pronto para o PDF (nucleo/pdf.js)
export function jpegDe(c, q = 0.88) { const d = c.toDataURL("image/jpeg", q), b = atob(d.split(",")[1]), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return { bytes: u, w: c.width, h: c.height }; }
// símbolo do app em JPEG quadrado sobre fundo branco (cabeçalho do relatório); null se não carregar
export async function logoJpeg(src, lado = 160) { try { const i = new Image(); i.src = src; await i.decode(); const c = document.createElement("canvas"); c.width = c.height = lado; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, lado, lado); x.drawImage(i, 0, 0, lado, lado); return jpegDe(c, 0.92); } catch (e) { return null; } }
