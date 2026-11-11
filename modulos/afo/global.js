/* EITA! AFO — expõe o núcleo em window.EITA, as partes de navegador do núcleo em EITA.ui e o cálculo puro do AFO
   (vetores, anatomia e casca) em EITA.afo, para a interface (modulos/afo/ui.js). Desde a E4b a interface usa do
   núcleo a malha (STL, solda, componentes, normais), o .zip e a entrega de arquivos; desde a E4c o cálculo vem de
   modulos/afo/{vetor,anatomia,casca}.js. As demais partes entram nas próximas etapas da E4.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import * as N from "../../nucleo/index.js";
import * as UI from "../../nucleo/interface/index.js";
import * as VETOR from "./vetor.js";
import * as ANATOMIA from "./anatomia.js";
import * as CASCA from "./casca.js";

const E = Object.assign({}, N);
E.ui = UI;
E.afo = Object.assign({}, VETOR, ANATOMIA, CASCA);
globalThis.EITA = E;
export default E;
