/* EITA núcleo · saída — pacote .zip (CRC32 + deflate-raw nativo do navegador).
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */

// ------------------------------------------------------------------ zip
const CRC = new Uint32Array(256);
for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[i] = c >>> 0; }
function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
async function deflateRaw(u8) {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const cs = new CompressionStream("deflate-raw"), w = cs.writable.getWriter(); w.write(u8); w.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
  } catch (e) { return null; }
}
export async function zip(arquivos) {
  const enc = new TextEncoder(), partes = [], central = []; let off = 0;
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const dados = typeof conteudo === "string" ? enc.encode(conteudo) : new Uint8Array(conteudo);
    const crc = crc32(dados), comp = await deflateRaw(dados), usar = comp && comp.length < dados.length;
    const corpo = usar ? comp : dados, metodo = usar ? 8 : 0, nb = enc.encode(nome);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, metodo, true);
    lh.setUint16(10, 0, true); lh.setUint16(12, 0x5b21, true); lh.setUint32(14, crc, true); lh.setUint32(18, corpo.length, true); lh.setUint32(22, dados.length, true);
    lh.setUint16(26, nb.length, true); lh.setUint16(28, 0, true);
    partes.push(new Uint8Array(lh.buffer), nb, corpo);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, metodo, true);
    ch.setUint16(12, 0, true); ch.setUint16(14, 0x5b21, true); ch.setUint32(16, crc, true); ch.setUint32(20, corpo.length, true); ch.setUint32(24, dados.length, true);
    ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), nb);
    off += 30 + nb.length + corpo.length;
  }
  const tamC = central.reduce((s, u) => s + u.length, 0), fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, Object.keys(arquivos).length, true); fim.setUint16(10, Object.keys(arquivos).length, true);
  fim.setUint32(12, tamC, true); fim.setUint32(16, off, true);
  return new Blob([...partes, ...central, new Uint8Array(fim.buffer)], { type: "application/zip" });
};
