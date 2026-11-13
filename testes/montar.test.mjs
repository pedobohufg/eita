// Montagem da plataforma com o núcleo compartilhado (E5b): nucleo.js na raiz publica todo o nucleo/ e os app.js da
// plataforma não carregam cópia dele; os apps avulsos continuam autocontidos.
// © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { montarPlataforma, montar, PLATAFORMA, NUCLEO } from "../ferramentas/montar.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eita-montar-"));
const { destino } = montarPlataforma(tmp, { semLegado: true });
const ler = (...p) => fs.readFileSync(path.join(destino, ...p), "utf8");

test("nucleo.js publica todos os arquivos de nucleo/ e roda sem DOM", () => {
  const ctx = { window: {} };
  vm.runInNewContext(ler(NUCLEO.arquivo), ctx);
  const N = ctx.window[NUCLEO.global];
  assert.ok(N, "window." + NUCLEO.global);
  for (const r of ["nucleo/index.js", "nucleo/malha.js", "nucleo/volume.js", "nucleo/interface/index.js"]) assert.ok(N[r], r);
  assert.equal(typeof N["nucleo/index.js"].lerSTL, "function");
});

test("app.js da plataforma sem cópia do núcleo e página carregando nucleo.js antes do app.js", () => {
  for (const [m, pre] of [[".", ""], ...PLATAFORMA.modulos.map((x) => [x, "../"])]) {
    const js = ler(m, "app.js"), html = ler(m, "index.html");
    assert.ok(!/^\/\/ ── nucleo\//m.test(js), m + ": núcleo dentro do app.js");
    assert.ok(js.includes(`window.${NUCLEO.global}`), m + ": usa o núcleo compartilhado");
    const i = html.indexOf(`<script src="${pre}${NUCLEO.arquivo}"></script>`), j = html.indexOf('<script src="app.js"></script>');
    assert.ok(i >= 0 && i < j, m + ": nucleo.js antes do app.js");
  }
});

test("app avulso continua autocontido", () => {
  const { destino: d } = montar("olho", tmp, "olho-avulso");
  const js = fs.readFileSync(path.join(d, "app.js"), "utf8");
  assert.ok(/^\/\/ ── nucleo\/malha\.js/m.test(js));
  assert.ok(!js.includes(NUCLEO.global));
});
