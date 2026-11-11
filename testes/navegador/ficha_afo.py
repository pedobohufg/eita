"""Ficha do EITA! AFO em duas montagens (precisa de Playwright + Chrome): salvar, listar, exportar e importar a base e a
   ficha devem dar o mesmo resultado; na DEPOIS, excluir pede dois cliques (sem confirm()) e nomes com HTML aparecem
   como texto. Uso: python3 testes/navegador/ficha_afo.py ANTES DEPOIS     (ex.: legado/afo dist/afo)
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados."""
import asyncio, base64, json, subprocess, sys, time
from playwright.async_api import async_playwright
from comparar_afo import CHROME, RELOGIO, STL, PONTOS
from caminhos_afo import GANCHOS, PREPARAR

NOME = 'Teste <i>Sintético</i> & "aspas"'

async def clique(pg, sel):
    await pg.evaluate("(s) => document.querySelector(s).click()", sel); await pg.wait_for_timeout(300)

async def rodar(pasta, porta, b, depois):
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(porta)], cwd=pasta, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); out = {}; erros = []; dialogos = []
    try:
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        await pg.add_init_script(RELOGIO); await pg.add_init_script("window.__comCapacidade = true;" + GANCHOS)
        pg.on("pageerror", lambda e: erros.append(str(e)))
        pg.on("dialog", lambda d: (dialogos.append(d.message), asyncio.ensure_future(d.accept())))
        await pg.goto(f"http://localhost:{porta}/index.html"); await pg.evaluate("localStorage.clear()"); await pg.reload()
        await pg.evaluate("() => { const t = document.getElementById('autoGen'); if (t) t.checked = false; }")
        for id_, v in (("pName", NOME), ("pId", "T01"), ("pBirth", "2015-03-20")):
            await pg.evaluate("([i, v]) => { const e = document.getElementById(i); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }", [id_, v])
        out["idade"] = await pg.evaluate("document.getElementById('pAge') ? document.getElementById('pAge').innerText : ''")
        await pg.evaluate(PREPARAR, {"stl": base64.b64encode(STL).decode(), "pontos": PONTOS})
        txt = lambda id_: pg.evaluate(f"document.getElementById('{id_}').innerText")
        await clique(pg, "#fSave"); out["salvar/status"] = await txt("status"); out["lista"] = await txt("fList")
        fichas = await pg.evaluate("JSON.parse(localStorage.getItem('eitaAFO.fichas.v1'))")
        f = fichas[0]; out["ficha/chaves"] = list(f.keys()); out["ficha/id"] = f["id"]; out["ficha/formato"] = f["formato"]
        out["ficha/sem_data"] = json.dumps({k: v for k, v in f.items() if k != "atualizado"}, sort_keys=True)
        await clique(pg, "#fExp"); await pg.wait_for_timeout(500)
        await clique(pg, "#dbExp"); await pg.wait_for_timeout(500)
        salvos = await pg.evaluate("window.__salvos")
        out["arquivos"] = [s["filename"] for s in salvos]
        base = json.loads(base64.b64decode(salvos[-1]["b64"])); ficha_arq = base64.b64decode(salvos[0]["b64"])
        out["base/chaves"] = list(base.keys()); out["base/n"] = [len(base["fichas"]), len(base["calibracao"]), base["formato"], base["versaoApp"]]
        out["exportar/status"] = await txt("status")
        # importar a base num navegador vazio
        await pg.evaluate("localStorage.removeItem('eitaAFO.fichas.v1')")
        await pg.set_input_files("#dbImp", files=[{"name": "base.json", "mimeType": "application/json", "buffer": base64.b64decode(salvos[-1]["b64"])}])
        await pg.wait_for_timeout(800); out["importar/status"] = await txt("status"); out["importar/lista"] = await txt("fList")
        await pg.set_input_files("#dbImp", files=[{"name": "x.json", "mimeType": "application/json", "buffer": b'{"formato":"outra coisa"}'}])
        await pg.wait_for_timeout(500); out["importar_errado/status"] = await txt("status")
        # abrir a ficha exportada
        await pg.set_input_files("#fImp", files=[{"name": "f.json", "mimeType": "application/json", "buffer": ficha_arq}])
        await pg.wait_for_timeout(3000); out["abrir/status"] = await txt("status")
        if depois:
            await clique(pg, "[data-del='0']"); out["d/1o_clique"] = [await txt("fList"), await txt("status"), len(await pg.evaluate("JSON.parse(localStorage.getItem('eitaAFO.fichas.v1'))"))]
            await clique(pg, "[data-del='0']"); out["d/2o_clique"] = [await txt("fList"), await txt("status"), len(await pg.evaluate("JSON.parse(localStorage.getItem('eitaAFO.fichas.v1'))"))]
            out["d/html_na_lista"] = await pg.evaluate("document.getElementById('fList').innerHTML")
        await pg.close()
    finally:
        srv.terminate()
    return out, erros, dialogos

async def main():
    a, c = sys.argv[1], sys.argv[2]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
        A, eA, dA = await rodar(a, 8795, b, False); B, eB, dB = await rodar(c, 8796, b, True)
        await b.close()
    falhas = []
    for k in sorted(set(A) | set(B)):
        if k.startswith("d/"): print("NOVO  ", k, json.dumps(B[k], ensure_ascii=False)[:200]); continue
        igual = A.get(k) == B.get(k); print(("OK    " if igual else "DIFERE"), k, json.dumps(B.get(k), ensure_ascii=False)[:160])
        if not igual: falhas.append(k); print("       antes:", json.dumps(A.get(k), ensure_ascii=False)[:160])
    print("diálogos:", dA, dB, "erros:", eA, eB)
    assert not dB and not eB
    assert B["d/1o_clique"][2] == 1 and "Confirmar" in B["d/1o_clique"][0] and B["d/2o_clique"][2] == 0
    # diferenças esperadas desde a E4d: nome com HTML escapado na mensagem; mensagem de base inválida do núcleo
    assert set(falhas) <= {"salvar/status", "importar_errado/status"}, falhas
    print("OK — ficha igual ao publicado (salvo as diferenças esperadas:", falhas, ")")

if __name__ == "__main__":
    asyncio.run(main())
