#!/usr/bin/env node
/* Monta cada módulo da Plataforma EITA como um app autocontido (um app.js só, sem dependências),
   pronto para publicar como artefato do claude.ai ou abrir direto no navegador.
   Uso: node ferramentas/montar.mjs [modulo ...]   (padrão: todos os listados em MODULOS)
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COPYRIGHT = "/* © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */";

// módulo → { entrada (ES module que publica window.EITA), scripts de interface (clássicos), estáticos }
export const MODULOS = {
  mamilo: { titulo: "EITA! MAMILO", entrada: "modulos/mamilo/global.js", interface: ["modulos/mamilo/ui.js"], estaticos: ["modulos/mamilo/index.html", "modulos/mamilo/assets"] },
};

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
    s = s.replace(/^export\s+((?:async\s+)?function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm, (_, tipo, nome) => { exportados.push(nome); return `${tipo} ${nome}`; });
    if (/^\s*export\s/m.test(s)) throw new Error(`forma de export não suportada em ${path.relative(RAIZ, m.abs)}`);
    const obj = `Object.assign({}, ${reexporta.concat([`{ ${exportados.join(", ")} }`]).join(", ")})`;
    partes.push(`// ── ${path.relative(RAIZ, m.abs)}\nconst ${m.nome} = (() => {\n"use strict";\n${s.trim()}\nreturn Object.freeze(${obj});\n})();`);
  }
  return `(function () {\n${partes.join("\n\n")}\n})();\n`;
}

export function montar(nome, destinoBase = path.join(RAIZ, "dist")) {
  const cfg = MODULOS[nome]; if (!cfg) throw new Error("módulo desconhecido: " + nome);
  const destino = path.join(destinoBase, nome);
  fs.rmSync(destino, { recursive: true, force: true }); fs.mkdirSync(destino, { recursive: true });
  const ui = cfg.interface.map((f) => fs.readFileSync(path.join(RAIZ, f), "utf8")).join("\n");
  const js = `/* ${cfg.titulo} — montado pela Plataforma EITA (ferramentas/montar.mjs). Não editar: edite nucleo/ e modulos/${nome}/. */\n${COPYRIGHT}\n${empacotar(cfg.entrada)}\n${ui}`;
  fs.writeFileSync(path.join(destino, "app.js"), js);
  for (const e of cfg.estaticos) fs.cpSync(path.join(RAIZ, e), path.join(destino, path.basename(e)), { recursive: true });
  return { destino, bytes: Buffer.byteLength(js) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lista = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MODULOS);
  for (const n of lista) { const r = montar(n); console.log(`${n}: ${path.relative(RAIZ, r.destino)}/app.js (${(r.bytes / 1024).toFixed(0)} kB)`); }
}
