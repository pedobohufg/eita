/* EITA! AFO — expõe o núcleo em window.EITA e as partes de navegador do núcleo em EITA.ui, para a interface
   (modulos/afo/ui.js). Desde a E4b a interface usa do núcleo a malha (STL, solda, componentes,
   normais), o .zip e a entrega de arquivos; as demais partes entram nas próximas etapas da E4.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import * as N from "../../nucleo/index.js";
import * as UI from "../../nucleo/interface/index.js";

const E = Object.assign({}, N);
E.ui = UI;
globalThis.EITA = E;
export default E;
