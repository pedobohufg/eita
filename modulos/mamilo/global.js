/* EITA! MAMILO — expõe núcleo + processamento em window.EITA, com os mesmos nomes da v0.2,
   para que a interface (ui.js) continue funcionando durante a migração; as partes de navegador do núcleo ficam em EITA.ui.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import * as N from "../../nucleo/index.js";
import * as M from "./processamento.js";
import * as UI from "../../nucleo/interface/index.js";

const E = Object.assign({}, N, M);
E.lab = N.paraLab;                                          // nome antigo
E.stl = (malha, transformar) => N.stl(malha, transformar, M.CABECALHO_STL);
E.marcadorSVG = (bits) => N.marcadorSVG(bits, "EITA!Mamilo");
E.ui = UI;                                                  // casca, imagem no navegador, vista 3D
globalThis.EITA = E;
export default E;
