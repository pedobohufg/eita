/* EITA! NARIZ·ORELHA — expõe núcleo + processamento do módulo em window.EITA (EITA.narizOrelha) e as partes de
   navegador do núcleo em EITA.ui, para a interface (modulos/nariz-orelha/ui.js).
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import * as N from "../../nucleo/index.js";
import * as P from "./processamento.js";
import * as UI from "../../nucleo/interface/index.js";

const E = Object.assign({}, N);
E.narizOrelha = Object.assign({}, P);
E.ui = UI;
globalThis.EITA = E;
export default E;
