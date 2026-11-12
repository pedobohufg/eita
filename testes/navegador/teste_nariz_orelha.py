"""Teste de ponta a ponta do EITA! NARIZ·ORELHA (opcional: Playwright + Chrome e cópia local do three.js r128, ver
   three_local.py). Usa os rostos sintéticos (testes/fixtures/rosto_sem_orelha.*, rosto_sem_nariz.*; gerados por
   ferramentas/rosto_sintetico.mjs).
   Para cada caso: abre uma ficha com os pontos (e o contorno da orelha sadia), abre o scan com o mesmo nome (os pontos
   são aplicados), calcula o plano com o refinamento, gera a prótese e o molde, baixa o pacote .zip e confere:
   STLs binários fechados (cada aresta em dois triângulos), peças esperadas, PDF, ficha; marcação por duplo clique.
   Uso: python3 testes/navegador/teste_nariz_orelha.py [pasta]   (padrão: dist/nariz-orelha, montada antes)
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados."""
import asyncio, gzip, io, json, os, struct, subprocess, sys, zipfile
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import three_local

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CHROME = "/usr/bin/google-chrome"
PORTA = 8781
falhas = []
def ok(c, msg):
    print(("ok   " if c else "FALHA ") + msg)
    if not c: falhas.append(msg)

def stl_fechado(b):
    n = struct.unpack("<I", b[80:84])[0]
    if len(b) != 84 + 50 * n: return False, n
    arestas = {}
    for t in range(n):
        o = 84 + 50 * t + 12
        v = [tuple(round(x, 4) for x in struct.unpack("<3f", b[o + 12 * k:o + 12 * k + 12])) for k in range(3)]
        for k in range(3):
            a, c = v[k], v[(k + 1) % 3]
            arestas[(a, c)] = arestas.get((a, c), 0) + 1
    return all(arestas.get((c, a), 0) == m for (a, c), m in arestas.items()), n

async def caso(nav, nome, tipo, base):
    info = json.load(open(os.path.join(RAIZ, "testes", "fixtures", nome + ".json")))
    stl = gzip.decompress(open(os.path.join(RAIZ, "testes", "fixtures", nome + ".stl.gz"), "rb").read())
    ctx = await nav.new_context(viewport={"width": 1400, "height": 900}, accept_downloads=True)
    pg = await ctx.new_page()
    erros = []
    pg.on("pageerror", lambda e: erros.append(str(e)))
    await three_local.ligar(pg)
    await pg.goto(base + "/index.html")
    await pg.wait_for_function("window.THREE && window.EITA && window.EITA.narizOrelha")
    ficha = {"formato": "EITA! NARIZ·ORELHA ficha", "versaoApp": "0.1", "id": "t-" + tipo, "nome": "Teste " + tipo,
             "paciente": {"pName": "Teste " + tipo, "pId": "T-" + tipo.upper(), "pRadio": "sim", "pAlerg": "látex"},
             "atualizado": "2026-11-12T10:00:00.000Z", "scan": {"nome": nome + ".stl"}, "tipo": tipo, "lado": "D",
             "pontos": info["pontos"], "contorno": info.get("contornoOrelhaEsquerda", []) if tipo == "orelha" else [],
             "fonte": "espelho" if tipo == "orelha" else "parametrico", "parametros": {"passo": 0.7}}
    await pg.set_input_files("#fImp", files=[{"name": "ficha.json", "mimeType": "application/json", "buffer": json.dumps(ficha).encode()}])
    await pg.wait_for_function("document.getElementById('pName').value.startsWith('Teste')")
    ok("Abra o scan" in await pg.inner_text("#status"), f"{tipo}: ficha aberta pede o scan")
    await pg.set_input_files("#scanFile", files=[{"name": nome + ".stl", "mimeType": "model/stl", "buffer": stl}])
    await pg.wait_for_function("!document.getElementById('calcPlano').disabled", timeout=60000)
    ok(await pg.locator("#listaPontos li.ok").count() == 6, f"{tipo}: 6 pontos aplicados da ficha")
    await pg.click("#calcPlano")
    await pg.wait_for_function("!document.getElementById('s3').classList.contains('off')", timeout=60000)
    txt = await pg.inner_text("#planoInfo")
    ok("Refinado pela simetria" in txt, f"{tipo}: plano refinado ({txt.strip()[:90]})")
    await pg.click("[data-s=s4]")
    await pg.click("#gerarProtese")
    try: await pg.wait_for_function("document.getElementById('medidas').rows.length > 3", timeout=180000)
    except Exception: print("status:", await pg.inner_text("#status"), erros); raise
    med = await pg.inner_text("#medidas")
    ok("fechada" in med, f"{tipo}: prótese fechada")
    ok("Volume de silicone" in med, f"{tipo}: medidas da prótese")
    # esculpir: elevar arrastando no meio da prótese, ver a prévia mudar e aplicar
    ok(await pg.is_visible("#escBox"), f"{tipo}: painel de escultura aparece com a prótese")
    med0 = await pg.inner_text("#medidas")
    await pg.click("#escFerr [data-esc='+']")
    await pg.fill("#escForca", "0.4")
    cb = await pg.locator("#cena canvas").bounding_box(); cx, cy = cb["x"] + cb["width"] / 2, cb["y"] + cb["height"] / 2
    await pg.mouse.move(cx - 15, cy); await pg.mouse.down()
    for k in range(12): await pg.mouse.move(cx - 15 + 3 * k, cy + (k % 3))
    await pg.mouse.up()
    ok(await pg.is_enabled("#escAplicar"), f"{tipo}: traço registrado, aplicar habilitado")
    await pg.click("[data-s=s5]"); await pg.click("#gerarMolde")
    ok("Aplicar a escultura" in await pg.inner_text("#status"), f"{tipo}: molde espera a escultura ser aplicada")
    await pg.click("[data-s=s4]"); await pg.click("#escAplicar")
    await pg.wait_for_function("document.getElementById('escAplicar').disabled", timeout=180000)
    med1 = await pg.inner_text("#medidas")
    mudou = [l for l, a in zip(med1.splitlines(), med0.splitlines()) if l != a]
    ok(mudou and "fechada" in med1, f"{tipo}: escultura aplicada, prótese fechada ({'; '.join(m.replace(chr(9), ' ') for m in mudou)[:120]})")
    await pg.click("[data-s=s5]")
    await pg.click("#gerarMolde")
    await pg.wait_for_function("document.getElementById('medidasMolde').rows.length > 2", timeout=240000)
    mm = await pg.inner_text("#medidasMolde")
    ok("ABERTA" not in mm, f"{tipo}: peças do molde fechadas")
    await pg.click("[data-s=s6]")
    async with pg.expect_download(timeout=240000) as d:
        await pg.click("#baixarPacote")
    z = zipfile.ZipFile(io.BytesIO(open(await (await d.value).path(), "rb").read()))
    nomes = z.namelist()
    pecas = ["base", "externa-A", "externa-B"]
    ok(all(any(n.endswith(f"_molde_{p}.stl") for n in nomes) for p in pecas), f"{tipo}: pacote com as 3 peças ({len(nomes)} arquivos)")
    for n in nomes:
        if n.endswith(".stl"):
            f, nt = stl_fechado(z.read(n)); ok(f and nt > 100, f"{tipo}: {n.split('_', 2)[-1]} fechado ({nt} triângulos)")
    pdf = next(n for n in nomes if n.endswith(".pdf")); ok(z.read(pdf)[:5] == b"%PDF-" and len(z.read(pdf)) > 20000, f"{tipo}: relatório PDF ({len(z.read(pdf)) // 1024} kB)")
    open(f"/tmp/nariz_orelha_{tipo}.pdf", "wb").write(z.read(pdf))
    fj = json.loads(z.read(next(n for n in nomes if n.endswith(".json"))))
    ok(fj["tipo"] == tipo and fj["resultado"]["molde"]["pecas"][0]["nome"] == "base" and fj["plano"]["n"][0] > 0.999, f"{tipo}: ficha com projeto e resultado")
    ok(any(n.startswith("T-" + tipo.upper()) for n in nomes), f"{tipo}: nomes de arquivo pelo código do paciente")
    chk = await pg.inner_text("#checagens")
    ok("irradiada" in chk and "látex" in chk, f"{tipo}: checagens clínicas da ficha")
    # marcação por duplo clique (vista de frente: o meio da tela cai no rosto)
    await pg.click("[data-s=s2]"); await pg.click("#listaPontos li[data-k=enD]"); await pg.click("#vistas3d [data-view=fit]")
    await pg.wait_for_timeout(300)
    caixa = await pg.locator("#cena canvas").bounding_box()
    await pg.mouse.dblclick(caixa["x"] + caixa["width"] / 2, caixa["y"] + caixa["height"] * 0.45)
    ok("Marcado" in await pg.inner_text("#status"), f"{tipo}: ponto marcado por duplo clique")
    await pg.screenshot(path=f"/tmp/nariz_orelha_{tipo}.png")
    ok(not erros, f"{tipo}: sem erro de JavaScript {erros[:2]}")
    await ctx.close()

async def main():
    pasta = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, "dist", "nariz-orelha")
    if not three_local.disponivel(): print("sem three.js local: pulando"); return
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORTA), "-d", pasta], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        await asyncio.sleep(0.8)
        async with async_playwright() as p:
            nav = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
            for nome, tipo in (("rosto_sem_orelha", "orelha"), ("rosto_sem_nariz", "nariz")):
                await caso(nav, nome, tipo, f"http://localhost:{PORTA}")
            await nav.close()
    finally:
        srv.terminate()
    print("FALHAS:", len(falhas)); sys.exit(1 if falhas else 0)

asyncio.run(main())
