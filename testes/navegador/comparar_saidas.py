"""Compara as saídas de duas montagens do MAMILO no navegador (opcional, precisa de Playwright + Chrome).
   Abre cada pasta com o relógio congelado, carrega o exemplo sintético, gera o relatório PDF e o pacote .zip
   e confere que tudo sai idêntico, byte a byte. Serve para refatorações de interface que não devem mudar
   nenhum resultado (ex.: etapa E1b).
   Uso: python3 testes/navegador/comparar_saidas.py PASTA_ANTES PASTA_DEPOIS [caminho-do-chrome]
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados."""
import asyncio, hashlib, os, subprocess, sys, time, zipfile
from playwright.async_api import async_playwright

CHROME = sys.argv[3] if len(sys.argv) > 3 else "/usr/bin/google-chrome"
RELOGIO = """(() => { const T = Date.UTC(2026, 10, 10, 15, 0, 0), D = Date;
  class F extends D { constructor(...a) { a.length ? super(...a) : super(T); } static now() { return T; } }
  globalThis.Date = F; Math.random = (() => { let s = 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })(); })();"""

async def saidas(pasta, porta, b):
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(porta)], cwd=pasta, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); erros = []; out = {}
    try:
        pg = await b.new_page(viewport={"width": 1440, "height": 900}, accept_downloads=True)
        await pg.add_init_script(RELOGIO)
        pg.on("pageerror", lambda e: erros.append(str(e)))
        pg.on("console", lambda m: m.type == "error" and erros.append(m.text))
        await pg.goto(f"http://localhost:{porta}/index.html")
        await pg.wait_for_function("document.getElementById('status').textContent.includes('Exemplo sintético')", timeout=90000)
        await pg.click("#s0 > h2"); await pg.fill("#pName", "Paciente Teste"); await pg.fill("#pId", "T01"); await pg.fill("#pAlerg", "látex")
        await pg.select_option("#pRadio", "recente")
        await pg.click("#stepper button[data-s='s5']"); await pg.wait_for_timeout(2500)
        await pg.click("#stepper button[data-s='s6']")
        async with pg.expect_download(timeout=120000) as d: await pg.click("#expPdf")
        out["relatorio-avulso.pdf"] = open(await (await d.value).path(), "rb").read()
        async with pg.expect_download(timeout=180000) as d: await pg.click("#exp")
        z = zipfile.ZipFile(await (await d.value).path())
        for n in z.namelist(): out["zip/" + n] = z.read(n)
        async with pg.expect_download(timeout=30000) as d: await pg.evaluate("document.getElementById('fExp').click()")
        out["ficha.json"] = open(await (await d.value).path(), "rb").read()
        await pg.screenshot(path=os.path.join(pasta, "..", os.path.basename(pasta.rstrip("/")) + "-tela.png"))
        # vista 3D: cada modo e cada vista, depois de girar e dar zoom
        gl = pg.locator("#gl"); cx, cy = 900, 500
        await pg.mouse.move(cx, cy); await pg.mouse.down(); await pg.mouse.move(cx + 80, cy + 30, steps=5); await pg.mouse.up()
        await pg.mouse.wheel(0, -300); await pg.wait_for_timeout(300)
        out["tela/3d-girada.png"] = await gl.screenshot()
        for m in ["molde", "corte", "prot"]:
            await pg.click(f"#tools3d button[data-m='{m}']"); await pg.wait_for_timeout(800)
            out[f"tela/3d-{m}.png"] = await gl.screenshot()
        for v in ["front", "three", "side", "pap"]:
            await pg.click(f"#tools3d button[data-v='{v}']"); await pg.wait_for_timeout(500)
            out[f"tela/3d-vista-{v}.png"] = await gl.screenshot()
        await pg.click("#tabs button[data-t='photo']"); await pg.wait_for_timeout(300)
        out["tela/foto.png"] = await pg.locator("#pc").screenshot()
        await pg.click("#tabs button[data-t='lat']"); await pg.wait_for_timeout(300)
        out["tela/lateral.png"] = await pg.locator("#lc").screenshot()
        # ficha: salvar no navegador, exportar a base e importá-la numa página limpa
        await pg.evaluate("document.getElementById('fSave').click()")
        out["ficha/lista.html"] = (await pg.inner_html("#fList")).encode()
        async with pg.expect_download(timeout=30000) as d: await pg.evaluate("document.getElementById('dbExp').click()")
        base = await (await d.value).path(); out["ficha/base.json"] = open(base, "rb").read()
        out["ficha/nome-base.txt"] = (await d.value).suggested_filename.encode()
        pg2 = await b.new_page(viewport={"width": 1440, "height": 900}); await pg2.add_init_script(RELOGIO)
        pg2.on("pageerror", lambda e: erros.append(str(e)))
        await pg2.goto(f"http://localhost:{porta}/index.html"); await pg2.evaluate("localStorage.clear()")
        await pg2.wait_for_function("document.getElementById('status').textContent.includes('Exemplo sintético')", timeout=90000)
        await pg2.set_input_files("#dbImp", base); await pg2.wait_for_timeout(500)
        out["ficha/status-importar.txt"] = (await pg2.text_content("#status")).encode()
        out["ficha/lista-importada.html"] = (await pg2.inner_html("#fList")).encode()
        await pg2.evaluate("document.querySelector('#fList [data-open]').click()"); await pg2.wait_for_timeout(1500)
        out["ficha/status-abrir.txt"] = (await pg2.text_content("#status")).encode()
        out["ficha/nome-aberto.txt"] = (await pg2.input_value("#pName")).encode()
        await pg2.close()
        await pg.close()
    finally:
        srv.terminate()
    return out, erros

async def main():
    antes, depois = sys.argv[1], sys.argv[2]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
        A, eA = await saidas(antes, 8771, b)
        B, eB = await saidas(depois, 8772, b)
        await b.close()
    falhas = []
    for n in sorted(set(A) | set(B)):
        a, c = A.get(n), B.get(n)
        igual = a == c
        print(f"{'OK   ' if igual else 'DIFERE'} {n:38s} {len(a or b''):>9} {len(c or b''):>9}  {hashlib.sha1(c or b'').hexdigest()[:10]}")
        if not igual: falhas.append(n)
    if eA or eB: print("erros no console:", eA, eB)
    assert not falhas and not eB, (falhas, eB)
    print("OK — saídas idênticas")

asyncio.run(main())
