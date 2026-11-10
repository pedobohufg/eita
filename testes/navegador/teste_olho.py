"""Teste de fumaça do EITA! OLHO no navegador (opcional, precisa de Playwright + Chrome):
   monta o módulo, abre dist/olho, carrega o exemplo, gera o modelo 3D e baixa o pacote e o relatório.
   Uso: python3 testes/navegador/teste_olho.py [caminho-do-chrome]
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados."""
import asyncio, json, os, subprocess, sys, time, zipfile
from playwright.async_api import async_playwright

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CHROME = sys.argv[1] if len(sys.argv) > 1 else "/usr/bin/google-chrome"

async def main():
    subprocess.run(["node", "ferramentas/montar.mjs", "olho"], cwd=RAIZ, check=True)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8767"], cwd=os.path.join(RAIZ, "dist", "olho"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); erros = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
            pg = await b.new_page(viewport={"width": 1440, "height": 900}, accept_downloads=True)
            pg.on("pageerror", lambda e: erros.append(str(e)))
            pg.on("console", lambda m: m.type == "error" and "404" not in m.text and erros.append(m.text))
            await pg.goto("http://localhost:8767/index.html")
            await pg.click("#demo")
            await pg.wait_for_function("document.getElementById('status').textContent.includes('Íris e pupila detectadas')", timeout=60000)
            await pg.click("#stepper button[data-s='s6']"); await pg.click("#build")
            await pg.wait_for_function("document.getElementById('status').textContent.includes('Modelo gerado')", timeout=60000)
            await pg.click("#stepper button[data-s='s7']")
            async with pg.expect_download(timeout=180000) as d: await pg.click("#exp")
            z = zipfile.ZipFile(await (await d.value).path()); nomes = sorted(z.namelist()); print("pacote:", (await d.value).suggested_filename, nomes)
            assert {"protese_completa.stl", "esclera.stl", "iris.stl", "pupila.stl", "iris_textura.png", "parametros.json", "relatorio.pdf", "ficha.json"} <= set(nomes)
            print("medidas:", json.loads(z.read("parametros.json"))["medidas_mm"])
            async with pg.expect_download(timeout=120000) as d: await pg.click("#expPdf")
            pdf = open(await (await d.value).path(), "rb").read(); assert pdf.startswith(b"%PDF-1.4"), "PDF"
            print("relatório:", (await d.value).suggested_filename, len(pdf), "B")
            await pg.screenshot(path=os.path.join(RAIZ, "dist", "olho-teste.png"))
            await b.close()
    finally:
        srv.terminate()
    assert not erros, erros
    print("OK — sem erros no console")

asyncio.run(main())
