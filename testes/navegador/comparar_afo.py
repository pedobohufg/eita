"""Compara as saídas de duas montagens do EITA! AFO no navegador (opcional, precisa de Playwright + Chrome).
   Usa a perna sintética (testes/fixtures/perna_sintetica.*) e o objeto window.AFO da página (sem cliques):
   carrega o scan, marca os 6 pontos, gera a casca e coleta o STL da AFO (referencial anatômico e "em pé"),
   o STL da perna, os pontos e medidas (exportData) e o relatório PDF, com o relógio e o sorteio congelados.
   Dois cenários: (A) sem correção; (B) correção de postura (95°, inversão 3°, faixa 25 mm).
   Uso: python3 testes/navegador/comparar_afo.py ANTES DEPOIS [--salvar PASTA]
        python3 testes/navegador/comparar_afo.py ANTES --referencia   (grava testes/referencia/afo-v0.14.json)
   ANTES/DEPOIS: pastas com index.html do AFO (ex.: legado/afo, dist/afo).
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados."""
import asyncio, base64, gzip, hashlib, json, os, subprocess, sys, time
from playwright.async_api import async_playwright

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CHROME = "/usr/bin/google-chrome"
RELOGIO = """(() => { const T = Date.UTC(2026, 10, 10, 15, 0, 0), D = Date;
  class F extends D { constructor(...a) { a.length ? super(...a) : super(T); } static now() { return T; } }
  globalThis.Date = F; Math.random = (() => { let s = 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const t0 = performance.now(); performance.now = () => t0; })();"""
STL = gzip.decompress(open(os.path.join(RAIZ, "testes", "fixtures", "perna_sintetica.stl.gz"), "rb").read())
PONTOS = json.load(open(os.path.join(RAIZ, "testes", "fixtures", "perna_sintetica.json")))["pontos_mm"]

COLETAR = """async ({ stl, pontos, correcao }) => {
  const hex = async (u) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', u))].map(b => b.toString(16).padStart(2, '0')).join('');
  const b64 = (u) => { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); };
  const bin = Uint8Array.from(atob(stl), c => c.charCodeAt(0));
  await window.AFO.loadBuffer(bin.buffer, 'perna_sintetica.stl');
  for (const k of ['ML', 'MM', 'CA', 'M1', 'M5', 'PX']) window.AFO.setLandmark(k, pontos[k]);
  if (correcao) window.AFO.applyCorrection(correcao);
  await window.AFO.makeShell();
  const o = {}, S = window.AFO.S, u8 = (x) => new Uint8Array(x instanceof ArrayBuffer ? x : x.buffer);
  if (!S.shell) return { erro: document.getElementById('status').textContent };
  for (const or of ['anat', 'pe', 'deitada']) { const u = u8(window.AFO.afoStl(or)); o['afo_' + or + '.stl'] = 'sha256:' + await hex(u) + ' (' + u.length + ' B)'; }
  const p = u8(window.AFO.stl()); o['perna.stl'] = 'sha256:' + await hex(p) + ' (' + p.length + ' B)';
  o['dados.json'] = JSON.stringify(window.AFO.exportData());
  o['casca.json'] = JSON.stringify({ log: S.shell.log, params: S.shell.params }, (k, v) => (k === 'ms' || k === 'checkMs') ? undefined : typeof v === 'number' ? +v.toPrecision(12) : v);   // sem os tempos de processamento
  const pdf = await window.AFO.report(); if (pdf) o['relatorio.pdf'] = b64(u8(pdf));
  o['status'] = document.getElementById('status').textContent;
  return o; }"""

async def saidas(pasta, porta, b):
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(porta)], cwd=pasta, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); erros = []; out = {}
    try:
        for nome, corr in (("A", None), ("B", {"tSag": 95, "tCor": 3, "band": 25})):
            pg = await b.new_page(viewport={"width": 1440, "height": 900})
            await pg.add_init_script(RELOGIO)
            pg.on("pageerror", lambda e: erros.append(str(e)))
            pg.on("console", lambda m: m.type == "error" and "404" not in m.text and erros.append(m.text))
            await pg.goto(f"http://localhost:{porta}/index.html"); await pg.evaluate("localStorage.clear()"); await pg.reload()
            await pg.evaluate("() => { const t = document.getElementById('autoGen'); if (t) t.checked = false; }")
            r = await pg.evaluate(COLETAR, {"stl": base64.b64encode(STL).decode(), "pontos": PONTOS, "correcao": corr})
            for k, v in r.items(): out[f"{nome}/{k}"] = (v if isinstance(v, str) else json.dumps(v)).encode()
            await pg.screenshot(path=os.path.join("/tmp", f"afo-{os.path.basename(pasta.rstrip('/'))}-{nome}.png"))
            await pg.close()
    finally:
        srv.terminate()
    return out, erros

async def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
        A, eA = await saidas(args[0], 8791, b)
        B, eB = (await saidas(args[1], 8792, b)) if len(args) > 1 else (None, [])
        await b.close()
    if "--referencia" in sys.argv:
        ref = {k: v.decode() for k, v in A.items() if not k.endswith(".pdf")}
        ref.update({k: "sha256:" + hashlib.sha256(v).hexdigest() for k, v in A.items() if k.endswith(".pdf")})
        json.dump({"_gerado_com": "EITA! AFO v0.14 publicado (legado/afo), perna sintética, Chrome", **ref}, open(os.path.join(RAIZ, "testes", "referencia", "afo-v0.14.json"), "w"), ensure_ascii=False, indent=1)
        for k, v in A.items():
            if k.endswith(".pdf"): open(os.path.join("/tmp", "afo-ref-" + k.replace("/", "_")), "wb").write(base64.b64decode(v))
        for k, v in A.items(): print(k, (v[:110].decode("latin1") if not k.endswith(".pdf") else f"{len(v)} b64"))
        print("erros:", eA); return
    falhas = []
    for n in sorted(set(A) | set(B)):
        a, c = A.get(n), B.get(n); igual = a == c
        print(f"{'OK   ' if igual else 'DIFERE'} {n:28s} {len(a or b''):>9} {len(c or b''):>9}")
        if not igual: falhas.append(n)
    if eA or eB: print("erros no console:", eA, eB)
    assert not falhas and not eB, (falhas, eB)
    print("OK — saídas idênticas")

if __name__ == "__main__":
    asyncio.run(main())
