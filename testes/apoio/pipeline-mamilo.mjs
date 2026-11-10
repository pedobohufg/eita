// Executa o fluxo completo do módulo MAMILO sobre as fixtures e devolve um resumo determinístico.
// Usado para garantir que a reorganização do código não muda nenhum resultado (teste de regressão).
import fs from "node:fs";
import zlib from "node:zlib";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES = path.join(AQUI, "..", "fixtures");

export function abrirFixture(nome) {
  const meta = JSON.parse(fs.readFileSync(path.join(FIXTURES, nome + ".json"), "utf8"));
  const rgb = zlib.gunzipSync(fs.readFileSync(path.join(FIXTURES, nome + ".rgb.gz")));
  const w = meta._largura, h = meta._altura, data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++, j += 3) { data[4 * i] = rgb[j]; data[4 * i + 1] = rgb[j + 1]; data[4 * i + 2] = rgb[j + 2]; data[4 * i + 3] = 255; }
  return { img: { data, width: w, height: h }, verdade: meta };
}

const sha = (buf) => crypto.createHash("sha256").update(new Uint8Array(buf)).digest("hex");
const r = (v, d = 4) => (v == null ? null : +Number(v).toFixed(d));

export function frontal(E, nome) {
  const { img, verdade } = abrirFixture(nome);
  const mk = E.detectarMarcador(img);
  if (!mk) return { nome, erro: "sem marcador" };
  const k = mk.lado_px / 20;
  const cal = E.calibrarCor(img, mk.cantos), im = cal.img;
  const sc = E.mapaScore(im);
  const { seg } = E.segmentarAuto(im, mk.cantos, sc);
  let fonte = "foto";
  if (seg.papila) {
    const rr = E.refinarPapila(sc, im.width, im.height, seg.papila), f = rr.pap.diam_px / seg.papila.diam_px;
    if (f > 0.5 && f < 1.6 && rr.frac > 0.6) { seg.papila = rr.pap; fonte = "refinada"; }
  }
  const pal = E.paleta(im, seg);
  return {
    nome, verdade, k, im, seg,
    resumo: {
      k: r(k), ref: cal.ref, fonte_papila: fonte,
      areola_maior_mm: r(seg.areola.eixo_maior_px / k), areola_menor_mm: r(seg.areola.eixo_menor_px / k),
      angulo_graus: r(seg.areola.angulo_graus, 3), papila_mm: r(seg.papila.diam_px / k), paleta: pal
    }
  };
}

export function lateral(E, nome) {
  const { img, verdade } = abrirFixture(nome);
  const L = E.analisarLateral(img, {});
  return { verdade, L, resumo: { projecao_mm: L.projecao_mm, largura_base_mm: L.largura_base_mm, forma_n: L.forma_n, raio_ajuste_mm: L.raio_ajuste_mm, avisos: L.avisos } };
}

export function malhas(E, F, L, resolucao = 0.3) {
  const p = { ...E.PARAMETROS, resolucao_mm: resolucao, textura_papila: { ...E.PARAMETROS.textura_papila } };
  const G = E.geometria(F.im, F.seg, F.k, p, L, null);
  const X = E.exportarConjunto(G, p);
  const hashes = {};
  for (const [n, b] of Object.entries(X.arquivos)) hashes[n] = sha(b);
  return { G, X, resumo: { n: G.n, volume_ml: r(X.volume_ml, 5), papila_proj_mm: r(G.papila_proj_mm), stl_sha256: hashes } };
}

export function resumoCompleto(E) {
  const out = { frontal: {}, lateral: null, malhas: null, corpo_de_prova: null };
  const fs_ = {};
  for (const n of ["claro_A", "escuro", "cor_quente_v2_anel_cinza"]) { fs_[n] = frontal(E, n); out.frontal[n] = fs_[n].resumo; }
  const L = lateral(E, "lateral_0"); out.lateral = L.resumo;
  out.malhas = malhas(E, fs_.claro_A, L.L).resumo;
  const C = E.corpoDeProva(0.3), Xc = E.exportarConjunto(C.G, { ...E.PARAMETROS });
  out.corpo_de_prova = { volume_ml: r(Xc.volume_ml, 5), stl_sha256: Object.fromEntries(Object.entries(Xc.arquivos).map(([n, b]) => [n, sha(b)])) };
  return out;
}
