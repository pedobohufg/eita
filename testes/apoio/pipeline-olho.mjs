// Executa o fluxo do módulo OLHO (puro, sem navegador) sobre a foto de exemplo com os parâmetros padrão
// da página e devolve um resumo determinístico (círculos, medidas, volumes e SHA-256 dos STL).
// © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados.
import crypto from "node:crypto";
import { abrirFixture } from "./pipeline-mamilo.mjs";

// valores iniciais da página (modulos/olho/index.html)
export const PADRAO = {
  photoSide: "E", protSide: "D", hvid: 11.7,
  limpeza: { upOn: false, upA: 45, upB: 135, loOn: false, loA: 225, loB: 315, specOn: true, specThr: 0.72, cBri: 0, cCon: 1, cSat: 1 },
  relevo: { hDetail: 0.5, hSmooth: 0.03, hBase: 0.3, hDepth: 0.15, hInv: false, hLimbus: false, hTrans: 1.0 },
  pupila: { pupMode: "dome", pupH: 0.25 },
  forma: { sW: 22, sH: 20, sDx: 0, sDy: 0.5, sRF: 16, sRB: 22, sT: 4.5, sIns: 0.8, sMode: "shell", sShell: 1.5 },
};
const sha = (u) => crypto.createHash("sha256").update(u).digest("hex");

export function executar(E, P = PADRAO) {
  const O = E.olho, { img } = abrirFixture("olho_exemplo");
  const foto = { px: img.data, W: img.width, H: img.height, wb: [1, 1, 1] };
  const { iris, pup } = O.detectarIrisPupila(foto);
  if (pup.r >= iris.r * 0.92) pup.r = iris.r * 0.6;
  const k = E.escalaPorDiametro(P.hvid, iris.r), m = { iris: 2 * iris.r * k, pup: 2 * pup.r * k, k };
  const Di = parseFloat(m.iris.toFixed(2)), Dp = parseFloat(Math.max(1.5, Math.min(8, m.pup)).toFixed(2));   // "usar o medido na foto"
  const prot = O.parametrosProtese({ espelhar: P.photoSide !== P.protSide, Di, Dp });
  const u = O.desenrolar(foto, iris, pup), cl = O.limparIris(u, P.limpeza);
  const tex = O.textura(cl.c, prot), hm = O.mapaAltura(tex, prot, P.relevo);
  const F = { ...P.forma, protSide: P.protSide }, G = O.geometria(F, Di, Dp);
  const M = O.malhas(G, F, { hm, tex, hi: false, hTrans: P.relevo.hTrans, pupila: { ...P.pupila, hBase: P.relevo.hBase, pPup: Dp } });
  const stl = (partes) => sha(E.stlTriangulos(partes, O.CABECALHO_STL));
  return {
    foto: { largura: img.width, altura: img.height, iris_px: iris, pupila_px: pup },
    medidas_mm: m, pIris: Di, pPup: Dp,
    altura_max_mapa_mm: O.alturaRGBA(hm).mx,
    triangulos: { esclera: M.sclera.ntri, iris: M.iris.ntri, pupila: M.pupil.ntri },
    volume_mm3: { esclera: M.sclera.vol, iris: M.iris.vol, pupila: M.pupil.vol },
    stl: { "protese_completa.stl": stl([M.sclera, M.iris, M.pupil]), "esclera.stl": stl([M.sclera]), "iris.stl": stl([M.iris]), "pupila.stl": stl([M.pupil]) },
    casca: O.verificarCasca(G, F), malhas: M,
  };
}
