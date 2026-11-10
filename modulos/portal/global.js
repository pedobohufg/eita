/* Plataforma EITA — portal: expõe o núcleo em window.EITA (ficha única em nucleo/paciente.js) e as partes
   de navegador em EITA.ui, para a interface (modulos/portal/ui.js).
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import * as N from "../../nucleo/index.js";
import * as UI from "../../nucleo/interface/index.js";

const E = Object.assign({}, N);
E.ui = UI;
globalThis.EITA = E;
export default E;
