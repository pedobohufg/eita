"""Teste do EITA! CRÂNIO no navegador (opcional, precisa de Playwright + Chrome): monta o módulo, confere o
   resultado do exemplo (igual ao da calculadora publicada), registra duas medições em datas diferentes, vê o
   gráfico da evolução, salva a ficha, gera o relatório PDF e exclui uma medição (dois cliques).
   Uso: python3 testes/navegador/teste_cranio.py [caminho-do-chrome]
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados."""
import asyncio, json, os, subprocess, sys, time
from playwright.async_api import async_playwright

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CHROME = sys.argv[1] if len(sys.argv) > 1 else "/usr/bin/google-chrome"

def ok(c, msg):
    if not c: raise AssertionError(msg)
    print("  ✓", msg)

async def main():
    subprocess.run(["node", "ferramentas/montar.mjs", "cranio"], cwd=RAIZ, check=True)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8770"], cwd=os.path.join(RAIZ, "dist", "cranio"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); erros = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME)
            pg = await b.new_page(viewport={"width": 1440, "height": 900}, accept_downloads=True)
            pg.on("pageerror", lambda e: erros.append(str(e)))
            pg.on("console", lambda m: m.type == "error" and "404" not in m.text and erros.append(m.text))
            await pg.goto("http://localhost:8770/index.html")
            ok(await pg.text_content("#resumo") == "Diagonal A 148,0 mm | Diagonal B 138,0 mm | Comprimento 165,0 mm | Largura 138,0 mm\nCVA: 10,0 mm (moderada)\nCVAI: 6,8 % (moderada)\nÍndice cefálico: 83,6 (braquicefálico)", "resumo do exemplo igual ao da calculadora")
            ok(await pg.text_content("#p-cvai") == "Moderada" and await pg.text_content("#v-ci") == "83,6", "cartões classificados")
            await pg.click("#uni button[data-u=cm]"); ok(await pg.input_value("#dA") == "14,8", "troca para cm"); await pg.click("#uni button[data-u=mm]")
            await pg.click("#s0 > h2"); await pg.fill("#pName", "Bebê Teste"); await pg.fill("#pId", "CR-01"); await pg.fill("#pBirth", "2026-03-01"); await pg.fill("#pGest", "34")
            await pg.click("#stepper button[data-s=s1]")
            await pg.fill("#mData", "2026-07-01"); await pg.click("#registrar")
            await pg.fill("#mData", "2026-10-01")
            for i, v in (("dA", "144"), ("dB", "139"), ("len", "160"), ("wid", "132")): await pg.fill("#" + i, v)
            await pg.click("#registrar")
            ok("registrada" in await pg.text_content("#status") and "Ficha atualizada" in await pg.text_content("#status"), "medições registradas e ficha salva sozinha")
            ok(await pg.is_visible("#grafBox"), "gráfico da evolução aparece com 2 medições")
            f = json.loads(await pg.evaluate("localStorage.getItem('eitaCRANIO.fichas.v1')"))[0]
            ok(f["formato"] == "EITA! CRÂNIO ficha" and len(f["medicoes"]) == 2 and f["paciente"]["pId"] == "CR-01", "ficha com 2 medições")
            await pg.click("#stepper button[data-s=s2]")
            ok("corr." in await pg.text_content("#histBox"), "idade corrigida (prematuro de 34 semanas)")
            ok("CVAI −" in await pg.text_content("#evol"), "evolução calculada")
            await pg.screenshot(path=os.path.join(RAIZ, "dist", "cranio-teste.png"))
            await pg.click("#stepper button[data-s=s3]")
            async with pg.expect_download(timeout=60000) as d: await pg.click("#expPdf")
            pdf = open(await (await d.value).path(), "rb").read(); nome = (await d.value).suggested_filename
            ok(pdf.startswith(b"%PDF-1.4") and b"Acompanhamento \\(2 medi" in pdf and nome.startswith("CR-01_CRANIO_"), f"relatório {nome} ({len(pdf)} B)")
            open(os.path.join(RAIZ, "dist", "cranio-relatorio.pdf"), "wb").write(pdf)
            await pg.click("#stepper button[data-s=s2]")
            await pg.click("#histBox [data-apagar]"); ok(await pg.text_content("#histBox [data-apagar]") == "Confirmar", "exclusão pede confirmação")
            await pg.click("#histBox [data-apagar]")
            ok(len(json.loads(await pg.evaluate("localStorage.getItem('eitaCRANIO.fichas.v1')"))[0]["medicoes"]) == 1, "medição excluída da ficha")
            await b.close()
    finally:
        srv.terminate()
    assert not erros, erros
    print("OK — CRÂNIO sem erros no console")

asyncio.run(main())
