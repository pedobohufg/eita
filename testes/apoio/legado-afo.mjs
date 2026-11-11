// Funções puras do EITA! AFO v0.14 publicado (legado/afo/index.html), recortadas do script minificado e montadas num
// objeto, para rodar no Node. Recorte por contagem de chaves a partir de "function nome(" ou "const nome=" — serve para
// estas declarações (conferido contra um analisador sintático na E4c), não para qualquer código.
// © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados.
import fs from "node:fs";

const html = fs.readFileSync(new URL("../../legado/afo/index.html", import.meta.url), "utf8");
function recortar(inicio, ate = "}") {
  const a = html.indexOf(inicio); if (a < 0) throw new Error("não achei " + inicio);
  let i = html.indexOf("{", a + inicio.length - 1), n = 0;
  for (; i < html.length; i++) { if (html[i] === "{") n++; else if (html[i] === "}" && --n === 0) break; }
  return html.slice(a, i + 1);
}
const FUNCOES = ["sectionCentroid", "computeFrame", "addPlantar", "measure", "deform", "binCenters", "fillSmooth", "legCenterline", "footAxis", "pctl", "gauss1", "generateShell", "meshCheck", "engraveText", "nnGrid", "computeNormals", "printXf"];
export function legadoAFO() {
  const v3 = recortar("const V3={"), m = html.slice(html.indexOf(v3)).match(/^const V3=\{[\s\S]*?\},DEG=([^,]+),smooth=(\(t,e,n\)=>\{[^}]*\});function /);
  if (!m || !m[0].startsWith(v3)) throw new Error("V3/DEG/smooth do legado não reconhecidos");
  const pl = html.match(/const pl=\(t,e\)=>t\[e\+"p"\]\|\|t\[e\];/)[0];
  const corpo = [v3 + ";", `const DEG=${m[1]};`, `const smooth=${m[2]};`, pl, recortar("const STROKE_FONT={") + ";", ...FUNCOES.map((n) => recortar(`function ${n}(`))].join("\n");
  const S = {}; // deform() do legado grava S.invSkipped
  return Object.assign(new Function("S", corpo + `\nreturn { V3, DEG, smooth, pl, STROKE_FONT, ${FUNCOES.join(", ")} };`)(S), { S });
}
