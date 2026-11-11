"""Teste de ponta a ponta do EITA! CRÂNIO com scan (opcional, precisa de Playwright + Chrome e de uma cópia local
   do three.js r128; ver three_local.py). Usa a cabeça sintética (testes/fixtures/cabeca_sintetica.*).
   1) Mesma ficha da versão antiga ("EITA! Crânio ficha": 5 pontos, plagiocefalia aos 6 meses, modo ativo, faixa de topo
      aberto, valvas sagitais, sem apoio na bochecha, 2 correções manuais) aberta na página antiga
      (legado/cranio-ortese) e na nova (dist/cranio), seguida do scan com o mesmo nome: as duas alinham, posicionam
      o plano, analisam e reaplicam as correções sozinhas. Depois: gerar a órtese e exportar o STL.
      Confere: STL da órtese idêntico (bytes), resumo técnico idêntico, mapa em vista superior idêntico (pixels) e
      D1/D2/AP/LL extraídos do plano iguais (a página antiga usa raios do three.js; a nova, o corte da malha).
   2) Na página nova: pontos automáticos, alinhamento e correção do pescoço ao abrir um scan sem ficha; ficha salva com o projeto da órtese, unidade deduzida do tamanho do modelo, relatório PDF com as vistas do modelo, "limpar
      correções" em dois cliques, marcação de ponto por duplo clique e importação de uma base antiga com protocolo.
   Uso: python3 testes/navegador/teste_cranio_scan.py
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados."""
import asyncio, gzip, json, os, re, subprocess, sys, time
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import three_local

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CHROME = "/usr/bin/google-chrome"
PORTA = 8772
RELOGIO = """(() => { const T = Date.UTC(2026, 10, 11, 15, 0, 0), D = Date;
  class F extends D { constructor(...a) { a.length ? super(...a) : super(T); } static now() { return T; } }
  globalThis.Date = F; Math.random = (() => { let s = 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })(); })();"""
STL = gzip.decompress(open(os.path.join(RAIZ, "testes", "fixtures", "cabeca_sintetica.stl.gz"), "rb").read())
CABECA = json.load(open(os.path.join(RAIZ, "testes", "fixtures", "cabeca_sintetica.json")))
NOME_STL = "cabeca_sintetica.stl"
# campos da página antiga sem os criados na E3c-4 (topo atrás, zona dos furos), que a ficha antiga não tem
PADRAO_ANTIGO = {k: v for k, v in json.loads(subprocess.run(["node", "-e", "import('./modulos/cranio/fichas.js').then((m) => console.log(JSON.stringify(m.PADRAO_ANTIGO)))"], cwd=RAIZ, capture_output=True, text=True, check=True).stdout).items() if k not in ("cro-bandtop-back", "cro-hole-zone")}
# os pontos da ficha ficam no referencial do scan já centrado (prepararScan: centro da caixa em float32)
def _centro():
    import numpy as np
    v = np.frombuffer(STL, dtype=np.uint8, count=len(STL) - 84, offset=84).reshape(-1, 50)[:, 12:48].copy().view("<f4").reshape(-1, 3)
    return [(float(v[:, q].min()) + float(v[:, q].max())) * 0.5 for q in range(3)]
CENTRO = _centro()
PONTOS = {k: [round(p[q] - CENTRO[q], 4) for q in range(3)] for k, p in CABECA["pontos_mm"].items()}
FICHA = {"formato": "EITA! Crânio ficha", "versaoApp": "1.0", "id": "ts-01", "nome": "Teste Scan",
         "paciente": {"pt-name": "Teste Scan", "pt-id": "TS-01", "pt-sex": "Feminino", "pt-birth": "2026-03-01", "pt-eval": "2026-09-01", "pt-ga": "39", "pt-side": "Direito"},
         "atualizado": "2026-11-11T12:00:00.000Z", "scan": {"nome": NOME_STL, "unidade": "1"}, "alinhamento": PONTOS, "planoZ": None,
         # como nas fichas reais da página antiga, todos os campos cro-* (os valores padrão dela) + os do cenário
         "entradas": dict(PADRAO_ANTIGO, **{"cro-indic": "plagio", "cro-age": "6", "cro-mode": "active", "cro-type": "band", "cro-split": "sagittal", "cro-cheek": "off"}),
         "edicoes": [{"kind": "relief", "th": 150, "ph": 15, "radiusMm": 25, "mm": 3, "label": "M1"}, {"kind": "contact", "th": 220, "ph": 20, "radiusMm": 20, "mm": 2, "label": "M2"}],
         "earMan": None, "analisado": True, "gerada": True, "resultado": None, "versoes": []}

def ok(c, msg):
    if not c: raise AssertionError(msg)
    print("  ✓", msg)

async def pagina(b, url, erros):
    pg = await b.new_page(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    await three_local.ligar(pg); await pg.add_init_script(RELOGIO)
    pg.on("pageerror", lambda e: erros.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and "404" not in m.text and erros.append(m.text))
    await pg.goto(url); await pg.wait_for_timeout(500)
    return pg

async def clicar(pg, id_):
    await pg.evaluate(f"document.getElementById('{id_}').click()")

async def esperar_texto(pg, id_, trecho, t=60000):
    await pg.wait_for_function(f"(document.getElementById('{id_}').textContent || '').includes({json.dumps(trecho)})", timeout=t)

async def fluxo(pg, ids):
    """abre a ficha antiga, depois o scan; gera e exporta a órtese; extrai as medidas → dados para comparar"""
    await pg.evaluate("document.getElementById('stl-scale-unit').value = '1'")
    await pg.set_input_files("#" + ids["ficha"], files=[{"name": "ficha_teste.json", "mimeType": "application/json", "buffer": json.dumps(FICHA).encode()}])
    await pg.wait_for_timeout(300)
    await pg.set_input_files("#stl-file", files=[{"name": NOME_STL, "mimeType": "model/stl", "buffer": STL}])
    await esperar_texto(pg, "cro-summary", "Correções manuais aplicadas: 2")
    await clicar(pg, "btn-cro-generate")
    await esperar_texto(pg, "cro-summary", "Órtese (", 120000)
    async with pg.expect_download(timeout=60000) as d: await clicar(pg, "btn-cro-export")
    stl = open(await (await d.value).path(), "rb").read()
    resumo = await pg.text_content("#cro-summary")
    polar = await pg.evaluate("(() => { const c = document.getElementById('cro-polar'); return Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data.slice(0)).join(','); })()")
    await clicar(pg, "btn-extract-3d"); await pg.wait_for_timeout(200)
    med = [float((await pg.input_value("#" + i)).replace(",", ".")) for i in ids["medidas"]]
    zplano = await pg.input_value("#plane-offset")
    return {"stl": stl, "resumo": resumo, "polar": polar, "med": med, "z": zplano, "nome": (await d.value).suggested_filename}

async def main():
    subprocess.run(["node", "ferramentas/montar.mjs", "cranio"], cwd=RAIZ, check=True)
    if not three_local.disponivel(): sys.exit("three.js r128 local não encontrado (ver testes/navegador/three_local.py)")
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORTA)], cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); erros = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
            print("página antiga (legado/cranio-ortese)")
            pa = await pagina(b, f"http://localhost:{PORTA}/legado/cranio-ortese/index.html", erros)
            A = await fluxo(pa, {"ficha": "f-imp", "medidas": ["inp-dA", "inp-dB", "inp-len", "inp-wid"]})
            print(f"  órtese: {len(A['stl'])} B; plano z = {A['z']}; medidas {A['med']}")
            print("página nova (dist/cranio)")
            pn = await pagina(b, f"http://localhost:{PORTA}/dist/cranio/index.html", erros)
            N = await fluxo(pn, {"ficha": "fImp", "medidas": ["dA", "dB", "len", "wid"]})
            print(f"  órtese: {len(N['stl'])} B; plano z = {N['z']}; medidas {N['med']}")
            ok(A["z"] == N["z"], "mesmo plano axial depois do alinhamento (zRef no passo do controle)")
            ok(A["stl"] == N["stl"], "STL da órtese idêntico ao da página antiga")
            ok(N["nome"].startswith("TS-01_ortese_craniana_") and N["nome"].endswith(".stl"), f"nome do STL com o código ({N['nome']})")
            semIC = lambda t: "\n".join(l for l in t.splitlines() if not l.startswith("Índice cefálico no plano"))
            ok(semIC(A["resumo"]) == semIC(N["resumo"]), "resumo técnico idêntico (menos a linha do índice cefálico)")
            icN = await pn.evaluate("window.__eitaCranio.CRO.an.ic"); icA = re.search(r"Índice cefálico no plano: ([0-9,]+)", A["resumo"]).group(1)
            ok(f"Índice cefálico no plano: {icN:.2f}".replace(".", ",") in N["resumo"], f"IC da análise pela largura transversal ({icN:.3f}; a página antiga dava {icA})")
            ok(A["polar"] == N["polar"], "mapa em vista superior idêntico (pixels)")
            ok(all(abs(a - n) < 0.051 for a, n in zip(A["med"][:3], N["med"][:3])), "D1, D2 e AP do scan iguais (±0,05 mm)")
            ok(N["med"][3] >= A["med"][3] - 0.05, f"LL = largura transversal máxima, não menor que a corda a 90° da página antiga ({N['med'][3]} × {A['med'][3]})")
            await pa.close()

            print("página nova: perfil de assimetria, ficha, relatório, dois cliques, duplo clique e base antiga")
            ok(await pn.evaluate("!document.getElementById('perfil').hidden && !document.getElementById('perfilBox').hidden") and await pn.locator("#perfilTab tr.max").count() == 1, "assimetria por altura com o nível de maior CVAI destacado")
            mx = await pn.evaluate("window.__eitaCranio.S3.perfil.maior")
            await clicar(pn, "btn-perfil-max"); await pn.wait_for_timeout(200)
            ok(abs(float(await pn.input_value("#plane-offset")) - mx["z"]) < 1 and "Maior assimetria do scan" in await pn.text_content("#origemMed"), f"medir na altura de maior assimetria (+{mx['dz']} mm, CVAI {mx['cvai']:.1f} %)")
            await clicar(pn, "fSave"); await pn.wait_for_timeout(200)
            f = json.loads(await pn.evaluate("localStorage.getItem('eitaCRANIO.fichas.v1')"))[0]
            o = f.get("ortese") or {}
            ok(f["formato"] == "EITA! CRÂNIO ficha" and f["versaoApp"] == "0.3" and f["paciente"]["pSex"] == "F" and f["paciente"]["pLado"] == "D", "ficha convertida (sexo e lado)")
            ok(o.get("scan", {}).get("nome") == NOME_STL and o.get("analisado") and o.get("gerada") and len(o.get("edicoes", [])) == 2 and o["entradas"]["cro-indic"] == "plagio" and o["entradas"]["cro-hole-zone"] == "all" and o["entradas"]["cro-bandtop-back"] == "55" and o.get("alinhamento"), "ficha com o projeto da órtese")
            ok(f.get("origem", {}).get("formato") == "EITA! Crânio ficha", "origem da ficha registrada")
            await clicar(pn, "registrar"); await pn.wait_for_timeout(200)
            f = json.loads(await pn.evaluate("localStorage.getItem('eitaCRANIO.fichas.v1')"))[0]
            ok(f["medicoes"][0].get("origem", {}).get("scan") == NOME_STL, "medição registrada com a origem no scan")
            async with pn.expect_download(timeout=120000) as d: await clicar(pn, "expPdf")
            pdf = open(await (await d.value).path(), "rb").read(); paginas = len(re.findall(rb"/Type /Page\b", pdf))
            open(os.path.join(RAIZ, "dist", "cranio-scan-relatorio.pdf"), "wb").write(pdf)
            ok(all(t in pdf for t in (b"Modelo escaneado", b"Planejamento da", b"metros de projeto", b"Modelo gerado")) and paginas >= 3, f"relatório com o scan ({paginas} páginas, {len(pdf) // 1024} kB)")
            await clicar(pn, "btn-cro-clear-edits")
            ok(await pn.text_content("#btn-cro-clear-edits") == "Confirmar", "limpar correções pede confirmação")
            await clicar(pn, "btn-cro-clear-edits")
            ok(await pn.evaluate("window.__eitaCranio.CRO.an.edits.length") == 0 and "desatualizada" in await pn.text_content("#cro-summary"), "correções removidas e órtese desatualizada")
            await pn.click("#tabs button[data-v='3d']"); await pn.wait_for_timeout(300)
            await pn.screenshot(path=os.path.join(RAIZ, "dist", "cranio-scan-teste.png"))
            # duplo clique: novo scan, vértice no centro da vista de cima
            P = await pn.evaluate("(() => { document.getElementById('fNew').click(); return window.__eitaCranio.readParams(); })()")
            ok(P["type"] == "band" and P["bandTop"] == 40 and P["bandTopBack"] == 70 and P["split"] == "lateralL" and P["holeZone"] == "ap" and P["mast"] == "off", "protocolo Lab.EITA como padrão da página (campos da ficha nova)")
            await pn.evaluate("document.getElementById('stl-scale-unit').value = '1000'")   # padrão antigo (metros), sem escolha do usuário
            await pn.set_input_files("#stl-file", files=[{"name": "outra.stl", "mimeType": "model/stl", "buffer": STL}])
            await esperar_texto(pn, "status", "sugeridos automaticamente")
            ok(await pn.input_value("#stl-scale-unit") == "1" and "ajustada para" in await pn.text_content("#status"), "unidade deduzida do tamanho (mm)")
            st = await pn.evaluate("({ al: window.__eitaCranio.S3.alinhado, n: Object.keys(window.__eitaCranio.S3.pontos).length, dA: document.getElementById('dA').value, corr: window.__eitaCranio.S3.correcao })")
            ok(st["al"] and st["n"] == 5 and st["dA"] != "" and st["corr"] and st["corr"]["corte"] > 0, f"scan sem ficha: pontos automáticos, alinhamento, medidas e correção do pescoço ({st['corr']})")
            await pn.evaluate("document.getElementById('landmark-select').value = 'vertex'"); await clicar(pn, "btn-arm-mark")
            cx = await pn.evaluate("(() => { const r = document.querySelector('#cena canvas').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
            await pn.mouse.dblclick(cx[0], cx[1]); await pn.wait_for_timeout(200)
            v = await pn.evaluate("window.__eitaCranio.S3.pontos.vertex")
            ok(v and v[2] > 60, f"vértice marcado por duplo clique (z = {v and round(v[2], 1)} mm)")
            ok("realinhar" in await pn.text_content("#status"), "ponto corrigido sobre os automáticos: pede para realinhar")
            base = {"formato": "EITA! Crânio base", "exportado": "2026-11-01T10:00:00.000Z", "fichas": [dict(FICHA, id="ts-02", nome="Outro")], "protocolos": {"Serviço X": {"cro-c0": "2,5"}}}
            await pn.set_input_files("#dbImp", files=[{"name": "base_antiga.json", "mimeType": "application/json", "buffer": json.dumps(base).encode()}])
            await esperar_texto(pn, "status", "versão antiga")
            ok(len(json.loads(await pn.evaluate("localStorage.getItem('eitaCRANIO.fichas.v1')"))) == 2 and "Serviço X" in await pn.evaluate("localStorage.getItem('eitaCRANIO.protocolos.v1')"), "base antiga importada com o protocolo")
            async with pn.expect_download(timeout=60000) as d: await clicar(pn, "dbExp")
            bb = json.loads(open(await (await d.value).path(), encoding="utf8").read())
            ok(bb["formato"] == "EITA! CRÂNIO base" and "Serviço X" in bb.get("protocolos", {}), "base exportada com os protocolos")
            await b.close()
    finally:
        srv.terminate()
    assert not erros, erros
    print("OK — CRÂNIO com scan: igual à página antiga e sem erros no console")

if __name__ == "__main__":
    asyncio.run(main())
