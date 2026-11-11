/* EITA! AFO — expõe o núcleo em window.EITA e as partes de navegador do núcleo em EITA.ui, para a interface
   (modulos/afo/ui.js). Na E4a a interface ainda não usa o núcleo; as partes entram a partir da E4b.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import * as N from "../../nucleo/index.js";
import * as UI from "../../nucleo/interface/index.js";

const E = Object.assign({}, N);
E.ui = UI;
globalThis.EITA = E;
export default E;
