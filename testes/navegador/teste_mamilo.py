"""Teste de fumaça no navegador (opcional, precisa de Playwright + Chrome):
   monta o módulo, abre dist/mamilo, percorre as etapas e exporta o pacote.
   Uso: python3 testes/navegador/teste_mamilo.py [caminho-do-chrome]"""
import asyncio, json, os, subprocess, sys, time, zipfile
from playwright.async_api import async_playwright

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CHROME = sys.argv[1] if len(sys.argv) > 1 else "/usr/bin/google-chrome"

async def main():
    subprocess.run(["node", "ferramentas/montar.mjs", "mamilo"], cwd=RAIZ, check=True)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8766"], cwd=os.path.join(RAIZ, "dist", "mamilo"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); erros = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
            pg = await b.new_page(viewport={"width": 1440, "height": 900}, accept_downloads=True)
            pg.on("pageerror", lambda e: erros.append(str(e)))
            pg.on("console", lambda m: m.type == "error" and erros.append(m.text))
            await pg.goto("http://localhost:8766/index.html")
            await pg.wait_for_function("document.getElementById('status').textContent.includes('Exemplo sintético')", timeout=90000)
            await pg.click("#stepper button[data-s='s5']"); await pg.wait_for_timeout(3000)
            await pg.click("#stepper button[data-s='s6']")
            async with pg.expect_download(timeout=180000) as d: await pg.click("#exp")
            z = zipfile.ZipFile(await (await d.value).path())
            nomes = sorted(z.namelist()); print("pacote:", nomes)
            assert {"protese_referencia.stl", "molde_frontal.stl", "contramolde.stl", "relatorio.json", "relatorio.pdf"} <= set(nomes)
            print("medidas:", json.loads(z.read("relatorio.json"))["medidas"])
            await pg.screenshot(path=os.path.join(RAIZ, "dist", "mamilo-teste.png"))
            await b.close()
    finally:
        srv.terminate()
    assert not erros, erros
    print("OK — sem erros no console")

asyncio.run(main())
