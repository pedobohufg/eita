/* EITA! MAMILO — expõe núcleo + processamento em window.EITA, com os mesmos nomes da v0.2,
   para que a interface (ui.js) continue funcionando sem mudanças durante a migração.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import * as N from "../../nucleo/index.js";
import * as M from "./processamento.js";

const E = Object.assign({}, N, M);
E.lab = N.paraLab;                                          // nome antigo
E.stl = (malha, transformar) => N.stl(malha, transformar, M.CABECALHO_STL);
E.marcadorSVG = (bits) => N.marcadorSVG(bits, "EITA!Mamilo");
globalThis.EITA = E;
export default E;
