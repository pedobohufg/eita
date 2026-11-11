/* EITA! CRÂNIO — expõe núcleo + cálculo do CRÂNIO em window.EITA (EITA.cranio) e as partes de navegador
   do núcleo em EITA.ui, para a interface (modulos/cranio/ui.js). Desde a E3c-2, o cálculo da órtese craniana
   (modulos/cranio/ortese.js, o antigo window.CROCore) fica em EITA.cranio.ortese; desde a E3c-3, as medidas no plano e
   as vistas do scan (vistas.js) em EITA.cranio.vistas e a ficha unificada (fichas.js) em EITA.cranio.fichas; desde a E3c-4, os pontos automáticos e a correção do
   pescoço (pontos.js) em EITA.cranio.pontos.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import * as N from "../../nucleo/index.js";
import * as C from "./processamento.js";
import * as ORTESE from "./ortese.js";
import * as VISTAS from "./vistas.js";
import * as FICHAS from "./fichas.js";
import * as PONTOS from "./pontos.js";
import * as UI from "../../nucleo/interface/index.js";

const E = Object.assign({}, N);
E.cranio = Object.assign({}, C, { ortese: ORTESE, vistas: VISTAS, fichas: FICHAS, pontos: PONTOS });
E.ui = UI;
globalThis.EITA = E;
export default E;
