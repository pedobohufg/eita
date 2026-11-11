#!/usr/bin/env node
/* Monta cada módulo da Plataforma EITA como um app autocontido (um app.js só, sem dependências),
   pronto para publicar como artefato do claude.ai ou abrir direto no navegador.
   Uso: node ferramentas/montar.mjs [modulo ... | plataforma]   (padrão: cada módulo avulso e a plataforma)
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COPYRIGHT = "/* © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */";

// módulo → { entrada (ES module que publica window.EITA), scripts de interface (clássicos), estáticos }
export const MODULOS = {
  mamilo: { titulo: "EITA! MAMILO", entrada: "modulos/mamilo/global.js", interface: ["modulos/mamilo/ui.js"], estaticos: ["modulos/mamilo/index.html", "modulos/mamilo/assets"] },
  // escopo: a interface é um script de topo; a montagem a envolve numa função própria (modo estrito, sem globais)
  olho: { titulo: "EITA! OLHO", entrada: "modulos/olho/global.js", interface: ["modulos/olho/ui.js"], estaticos: ["modulos/olho/index.html", "modulos/olho/assets"], escopo: true },
  afo: { titulo: "EITA! AFO", entrada: "modulos/afo/global.js", interface: ["modulos/afo/ui.js"], estaticos: ["modulos/afo/index.html", "modulos/afo/sobre.html", "modulos/afo/assets"], escopo: true },
  cranio: { titulo: "EITA! CRÂNIO", entrada: "modulos/cranio/global.js", interface: ["modulos/cranio/ui.js"], estaticos: ["modulos/cranio/index.html", "modulos/cranio/assets"], escopo: true },
  portal: { titulo: "Plataforma EITA", entrada: "modulos/portal/global.js", interface: ["modulos/portal/ui.js"], estaticos: ["modulos/portal/index.html", "modulos/portal/assets"], escopo: true, soNaPlataforma: true },
};
// Plataforma: um só app (um artefato) com o portal na raiz e cada módulo numa subpasta. Mesma origem, então
// o portal enxerga as fichas guardadas por todos os módulos. Desde a E4e o AFO entra montado de modulos/afo
// (antes, como estava publicado, de legado/afo); "legados" fica para algum app que ainda não tenha sido migrado.
export const PLATAFORMA = { portal: "portal", modulos: ["mamilo", "olho", "cranio", "afo"], legados: {}, ponte: "modulos/portal/ponte.js" };

const RE_IMPORT = /^import\s+(.+?)\s+from\s+"(.+?)";?\s*$/gm;
const RE_EXPORT_ALL = /^export\s+\*\s+from\s+"(.+?)";?\s*$/gm;

// Empacota um grafo de ES modules em um único script clássico (cada módulo em seu próprio escopo).
export function empacotar(entrada) {
  const ordem = [], visitados = new Map();
  const id = (abs) => "__m" + visitados.size;
  function visitar(abs) {
    if (visitados.has(abs)) return visitados.get(abs);
    const meu = { abs, nome: id(abs), fonte: fs.readFileSync(abs, "utf8") };
    visitados.set(abs, meu);
    const deps = [...meu.fonte.matchAll(RE_IMPORT)].map((m) => m[2]).concat([...meu.fonte.matchAll(RE_EXPORT_ALL)].map((m) => m[1]));
    for (const d of deps) visitar(path.resolve(path.dirname(abs), d));
    ordem.push(meu);
    return meu;
  }
  visitar(path.resolve(RAIZ, entrada));
  const dep = (de, rel) => visitados.get(path.resolve(path.dirname(de.abs), rel)).nome;
  const partes = [];
  for (const m of ordem) {
    let s = m.fonte, exportados = [], reexporta = [];
    s = s.replace(RE_IMPORT, (_, alvo, rel) => {
      const d = dep(m, rel); alvo = alvo.trim();
      if (alvo.startsWith("* as ")) return `const ${alvo.slice(5).trim()} = ${d};`;
      if (alvo.startsWith("{")) return `const ${alvo.replace(/\s+as\s+/g, ": ")} = ${d};`;
      return `const ${alvo} = ${d}.default;`;
    });
    s = s.replace(RE_EXPORT_ALL, (_, rel) => { reexporta.push(dep(m, rel)); return ""; });
    s = s.replace(/^export\s+default\s+/m, () => { exportados.push("default: __padrao"); return "const __padrao = "; });
    const multipla = s.match(/^export\s+(?:const|let)\s+[A-Za-z_$][\w$]*\s*=\s*[-\w.$"']+\s*,\s*[A-Za-z_$][\w$]*\s*=/m);
    if (multipla) throw new Error(`export com várias declarações não suportado em ${path.relative(RAIZ, m.abs)}: ${multipla[0]}`);
    s = s.replace(/^export\s+((?:async\s+)?function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm, (_, tipo, nome) => { exportados.push(nome); return `${tipo} ${nome}`; });
    if (/^\s*export\s/m.test(s)) throw new Error(`forma de export não suportada em ${path.relative(RAIZ, m.abs)}`);
    const obj = `Object.assign({}, ${reexporta.concat([`{ ${exportados.join(", ")} }`]).join(", ")})`;
    partes.push(`// ── ${path.relative(RAIZ, m.abs)}\nconst ${m.nome} = (() => {\n"use strict";\n${s.trim()}\nreturn Object.freeze(${obj});\n})();`);
  }
  return `(function () {\n${partes.join("\n\n")}\n})();\n`;
}

export function montar(nome, destinoBase = path.join(RAIZ, "dist"), pasta = nome) {
  const cfg = MODULOS[nome]; if (!cfg) throw new Error("módulo desconhecido: " + nome);
  const destino = path.join(destinoBase, pasta);
  fs.rmSync(destino, { recursive: true, force: true }); fs.mkdirSync(destino, { recursive: true });
  let ui = cfg.interface.map((f) => fs.readFileSync(path.join(RAIZ, f), "utf8")).join("\n");
  if (cfg.escopo) ui = `(function () {\n${ui}\n})();\n`;
  const js = `/* ${cfg.titulo} — montado pela Plataforma EITA (ferramentas/montar.mjs). Não editar: edite nucleo/ e modulos/${nome}/. */\n${COPYRIGHT}\n${empacotar(cfg.entrada)}\n${ui}`;
  fs.writeFileSync(path.join(destino, "app.js"), js);
  for (const e of cfg.estaticos) fs.cpSync(path.join(RAIZ, e), path.join(destino, path.basename(e)), { recursive: true });
  return { destino, bytes: Buffer.byteLength(js) };
}

// acrescenta a ponte para o portal no fim de uma página de módulo
function ligarAoPortal(html, modulo) {
  const i = html.lastIndexOf("</body>"); if (i < 0) throw new Error("página sem </body>: " + modulo);
  return html.slice(0, i) + `<script src="../ponte.js" data-modulo="${modulo}"></script>\n` + html.slice(i);
}
// semLegado: deixa de fora os apps legados (o portal os abre pelo artefato publicado à parte)
export function montarPlataforma(destinoBase = path.join(RAIZ, "dist"), { semLegado = false } = {}) {
  const destino = path.join(destinoBase, "plataforma");
  const r = montar(PLATAFORMA.portal, destinoBase, "plataforma");   // portal na raiz (apaga a pasta antes)
  const legados = semLegado ? {} : PLATAFORMA.legados;
  const presentes = [...PLATAFORMA.modulos, ...Object.keys(legados)];
  const idx = path.join(destino, "index.html");
  fs.writeFileSync(idx, fs.readFileSync(idx, "utf8").replace("</head>", `<meta name="eita-modulos" content="${presentes.join(",")}">\n</head>`));
  fs.copyFileSync(path.join(RAIZ, PLATAFORMA.ponte), path.join(destino, "ponte.js"));
  const partes = [{ nome: "portal", bytes: r.bytes }];
  for (const m of PLATAFORMA.modulos) { const x = montar(m, destino, m); partes.push({ nome: m, bytes: x.bytes }); }
  for (const [m, L] of Object.entries(legados)) {
    for (const a of L.arquivos) fs.cpSync(path.join(RAIZ, L.pasta, a), path.join(destino, m, a), { recursive: true });
    partes.push({ nome: m + " (legado)", bytes: fs.statSync(path.join(destino, m, "index.html")).size });
  }
  for (const m of presentes) {
    const f = path.join(destino, m, "index.html"); fs.writeFileSync(f, ligarAoPortal(fs.readFileSync(f, "utf8"), m));
  }
  return { destino, partes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lista = process.argv.slice(2).length ? process.argv.slice(2) : [...Object.keys(MODULOS).filter((n) => !MODULOS[n].soNaPlataforma), "plataforma"];
  for (const n of lista) {
    if (n === "plataforma" || n === "plataforma-sem-legado") { const r = montarPlataforma(undefined, { semLegado: n !== "plataforma" }); console.log(`plataforma: ${path.relative(RAIZ, r.destino)}/ (${r.partes.map((p) => `${p.nome} ${(p.bytes / 1024).toFixed(0)} kB`).join(", ")})`); continue; }
    const r = montar(n); console.log(`${n}: ${path.relative(RAIZ, r.destino)}/app.js (${(r.bytes / 1024).toFixed(0)} kB)`);
  }
}
