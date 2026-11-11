/* EITA! CRÂNIO — expõe núcleo + cálculo do CRÂNIO em window.EITA (EITA.cranio) e as partes de navegador
   do núcleo em EITA.ui, para a interface (modulos/cranio/ui.js).
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import * as N from "../../nucleo/index.js";
import * as C from "./processamento.js";
import * as UI from "../../nucleo/interface/index.js";

const E = Object.assign({}, N);
E.cranio = C;
E.ui = UI;
globalThis.EITA = E;
export default E;
