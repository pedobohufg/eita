"""Teste de ponta a ponta da Plataforma EITA no navegador (opcional, precisa de Playwright + Chrome).
   Monta dist/plataforma e percorre: paciente novo no portal → OLHO com os dados preenchidos → salvar ficha →
   voltar → prótese ligada → reabrir a ficha pelo portal; paciente sem prontuário → MAMILO → ligado pelo
   vínculo pendente; AFO (legado) com a ponte; exportar a base; importar a base e uma base antiga num
   navegador limpo; excluir paciente. Dados fictícios.
   Uso: python3 testes/navegador/teste_plataforma.py [caminho-do-chrome]
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados."""
import asyncio, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import three_local   # three.js r128 local no lugar do CDN (EITA! CRÂNIO)

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CHROME = sys.argv[1] if len(sys.argv) > 1 else "/usr/bin/google-chrome"
URL = "http://localhost:8768/"

def ok(cond, msg):
    if not cond: raise AssertionError(msg)
    print("  ✓", msg)

async def esperar_status(pg, trecho, t=90000):
    await pg.wait_for_function(f"document.getElementById('status') && document.getElementById('status').textContent.includes({json.dumps(trecho)})", timeout=t)

async def main():
    subprocess.run(["node", "ferramentas/montar.mjs", "plataforma-sem-legado"], cwd=RAIZ, check=True)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8768"], cwd=os.path.join(RAIZ, "dist", "plataforma"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); erros = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
            ctx = await b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
            await three_local.ligar(ctx)
            pg = await ctx.new_page()
            pg.on("pageerror", lambda e: erros.append(str(e)))
            pg.on("console", lambda m: m.type == "error" and "404" not in m.text and erros.append(m.text))
            print("portal: paciente novo")
            await pg.goto(URL + "index.html")
            await pg.click("#novo")
            await pg.fill("#dNome", "Paciente Teste"); await pg.fill("#dCodigo", "T-01"); await pg.fill("#dNasc", "2018-06-15"); await pg.select_option("#dSexo", "F")
            await pg.fill("#dProf", "Dra. Fulana"); await pg.click("#fDados button[type=submit]")
            ok("Paciente Teste" in await pg.text_content("#lista"), "paciente na lista")

            print("OLHO: ficha nova com os dados do portal")
            await pg.click("[data-novo=olho]"); await pg.wait_for_url("**/olho/index.html")
            await esperar_status(pg, "Nova ficha para")
            ok(await pg.input_value("#pName") == "Paciente Teste" and await pg.input_value("#pId") == "T-01" and await pg.input_value("#pProf") == "Dra. Fulana", "dados preenchidos no OLHO")
            ok(await pg.locator("#top .eita-voltar").count() == 1, "botão ‹ Pacientes no OLHO")
            await pg.click("#stepper button[data-s=s1]"); await pg.click("#demo"); await esperar_status(pg, "Íris e pupila detectadas")
            await pg.evaluate("document.getElementById('fSave').click()"); await esperar_status(pg, "salva neste navegador")
            await pg.click("#top .eita-voltar"); await pg.wait_for_url("**/index.html")
            await pg.wait_for_selector(".prot")   # o portal volta com o paciente aberto
            await pg.screenshot(path=os.path.join(RAIZ, "dist", "plataforma-paciente.png"))
            ok("Prótese ocular" in await pg.text_content(".prots"), "prótese ocular ligada ao paciente")

            print("OLHO: reabrir a ficha pelo portal")
            await pg.click(".prot button"); await pg.wait_for_url("**/olho/index.html")
            await esperar_status(pg, "Ficha \"Paciente Teste\" aberta")
            ok(await pg.input_value("#pId") == "T-01", "ficha aberta no OLHO")
            await pg.click("#top .eita-voltar"); await pg.wait_for_url("**/index.html")

            print("MAMILO: paciente sem prontuário nem nascimento (vínculo pendente)")
            await pg.click("#novo"); await pg.fill("#dNome", "Bebê Sem Registro"); await pg.click("#fDados button[type=submit]")
            await pg.click("[data-novo=mamilo]"); await pg.wait_for_url("**/mamilo/index.html")
            await esperar_status(pg, "Nova ficha para", 120000)
            ok(await pg.input_value("#pName") == "Bebê Sem Registro", "nome preenchido no MAMILO")
            await pg.evaluate("document.getElementById('fSave').click()"); await esperar_status(pg, "salva neste navegador")
            await pg.click("#top .eita-voltar"); await pg.wait_for_url("**/index.html")
            await pg.wait_for_selector("#lista .pac")
            nomes = await pg.locator("#lista .pac b").all_text_contents()
            ok(sorted(nomes) == ["Bebê Sem Registro", "Paciente Teste"], f"sem paciente duplicado ({nomes})")
            await pg.locator("#lista .pac", has_text="Bebê").click()
            ok("aréola" in (await pg.text_content(".prots")).lower(), "MAMILO ligado ao paciente sem prontuário")

            print("AFO (modulos/afo, desde a E4e): ficha nova, salvar, voltar e reabrir pelo portal")
            await pg.locator("#lista .pac", has_text="Paciente Teste").click()
            await pg.click("[data-novo=afo]"); await pg.wait_for_url("**/afo/index.html")
            await esperar_status(pg, "Nova ficha para")
            ok(await pg.input_value("#pName") == "Paciente Teste" and await pg.input_value("#pBirth") == "2018-06-15", "dados preenchidos no AFO")
            await pg.evaluate("document.getElementById('fSave').click()"); await esperar_status(pg, "salva neste navegador")
            await pg.click("#top .eita-voltar"); await pg.wait_for_url("**/index.html")
            await pg.locator("#lista .pac", has_text="Paciente Teste").click()
            ok("afo" in (await pg.text_content(".prots")).lower(), "AFO ligada ao paciente")
            await pg.click(".prots [data-ficha^='afo|']"); await pg.wait_for_url("**/afo/index.html")
            await esperar_status(pg, "aberta")
            ok(await pg.input_value("#pName") == "Paciente Teste", "ficha do AFO reaberta pelo portal")
            await pg.click("#top .eita-voltar"); await pg.wait_for_url("**/index.html")

            print("CRÂNIO: ficha nova com os dados do portal, medição e volta")
            await pg.click("[data-novo=cranio]"); await pg.wait_for_url("**/cranio/index.html")
            await esperar_status(pg, "Nova ficha para")
            ok(await pg.input_value("#pName") == "Paciente Teste" and await pg.input_value("#pBirth") == "2018-06-15", "dados preenchidos no CRÂNIO")
            await pg.click("#stepper button[data-s=s2]"); await pg.click("#registrar"); await esperar_status(pg, "Ficha atualizada")
            await pg.click("#top .eita-voltar"); await pg.wait_for_url("**/index.html"); await pg.wait_for_selector(".prot")
            ok("1 medição" in await pg.text_content(".prots"), "avaliação craniana ligada ao paciente")

            print("base: exportar")
            await pg.click("#sBase h2")
            async with pg.expect_download() as d: await pg.click("#exp")
            caminho = await (await d.value).path(); base = json.load(open(caminho))
            ok((await d.value).suggested_filename.startswith("base_EITA_"), "nome do arquivo sem nome de paciente")
            ok(base["formato"] == "EITA base v1" and len(base["pacientes"]) == 2 and len(base["fichas"]["olho"]) == 1 and len(base["fichas"]["mamilo"]) == 1 and len(base["fichas"]["cranio"]) == 1 and len(base["fichas"]["afo"]) == 1, "base com 2 pacientes e 4 fichas")
            await pg.screenshot(path=os.path.join(RAIZ, "dist", "plataforma-teste.png"))

            print("base: importar num navegador limpo (base única e base antiga do OLHO)")
            ctx2 = await b.new_context(viewport={"width": 1440, "height": 900}); await three_local.ligar(ctx2); pg2 = await ctx2.new_page()
            pg2.on("pageerror", lambda e: erros.append(str(e)))
            await pg2.goto(URL + "index.html")
            ok("Nenhum paciente" in await pg2.text_content("#lista"), "navegador limpo")
            await pg2.click("#sBase h2"); await pg2.set_input_files("#imp", caminho); await pg2.wait_for_selector("#impInfo .okbox")
            ok(len(await pg2.locator("#lista .pac").all()) == 2, "2 pacientes importados")
            antiga = os.path.join(RAIZ, "dist", "base-olho-antiga.json")
            json.dump({"formato": "EITA! OLHO base", "exportado": "2026-11-01T00:00:00Z", "fichas": [{**base["fichas"]["olho"][0], "id": "outra-pessoa_E", "nome": "Outra Pessoa", "paciente": {**base["fichas"]["olho"][0]["paciente"], "pName": "Outra Pessoa", "pId": "X-9"}}]}, open(antiga, "w"))
            await pg2.set_input_files("#imp", antiga); await pg2.wait_for_function("document.getElementById('impInfo').textContent.includes('base do EITA! OLHO')")
            ok(len(await pg2.locator("#lista .pac").all()) == 3, "base antiga do OLHO criou o paciente que faltava")
            await ctx2.close()

            print("excluir paciente (dois cliques)")
            await pg.locator("#lista .pac", has_text="Bebê").click()
            await pg.click("#excluir"); ok(await pg.text_content("#excluir") == "Clique de novo para excluir", "pede confirmação")
            await pg.click("#excluir"); await esperar_status(pg, "foram excluídos")
            ok(json.loads(await pg.evaluate("localStorage.getItem('eitaMAMILO.fichas.v1')")) == [], "ficha do MAMILO apagada junto")
            ok(len(await pg.locator("#lista .pac").all()) == 1, "sobrou 1 paciente")
            await b.close()
    finally:
        srv.terminate()
    assert not erros, erros
    print("OK — plataforma sem erros no console")

asyncio.run(main())
