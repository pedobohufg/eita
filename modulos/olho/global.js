/* EITA! OLHO — expõe núcleo + processamento do OLHO em window.EITA (EITA.olho) e as partes de navegador
   do núcleo em EITA.ui, para a interface (modulos/olho/ui.js).
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import * as N from "../../nucleo/index.js";
import * as O from "./processamento.js";
import * as UI from "../../nucleo/interface/index.js";

const E = Object.assign({}, N);
E.olho = O;
E.ui = UI;
globalThis.EITA = E;
export default E;
