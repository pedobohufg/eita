"""Tour do EITA! AFO em duas montagens (precisa de Playwright + Chrome): abre sozinho na primeira visita; em cada
   passo, mesmo texto, mesmo destaque (posição e tamanho) e mesma posição do cartão; seções recolhidas abertas e
   fechadas de novo; teclas → ← Esc; grava "já visto" e não abre na segunda visita; botão "?" reabre.
   Diferença esperada desde a E4d: o passo 3 diz "STL" (antes "STL ou OBJ"; a página só aceita STL).
   Uso: python3 testes/navegador/tour_afo.py ANTES DEPOIS
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados."""
import asyncio, json, subprocess, sys, time
from playwright.async_api import async_playwright
from comparar_afo import CHROME, RELOGIO

ESTADO = """() => { const t = document.getElementById('tour'); if (!t) return null; const s = t.querySelector('.spot').style, c = t.querySelector('.card');
  return { k: c.querySelector('.k').innerText, h3: c.querySelector('h3').innerText, txt: c.innerText, spot: [s.left, s.top, s.width, s.height], card: [c.style.left, c.style.top],
    recolhidas: [...document.querySelectorAll('section.collapsed')].map(x => x.id), foco: document.activeElement && document.activeElement.className }; }"""

async def rodar(pasta, porta, b):
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(porta)], cwd=pasta, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); out = {}; erros = []
    try:
        pg = await b.new_page(viewport={"width": 1440, "height": 900}); await pg.add_init_script(RELOGIO)
        pg.on("pageerror", lambda e: erros.append(str(e)))
        await pg.goto(f"http://localhost:{porta}/index.html"); await pg.evaluate("localStorage.clear()"); await pg.reload()
        await pg.wait_for_timeout(1200)
        out["inicial/recolhidas"] = await pg.evaluate("[...document.querySelectorAll('section.collapsed')].map(x => x.id)")
        for i in range(12):
            e = await pg.evaluate(ESTADO)
            if not e: break
            out[f"passo{i}"] = e
            await pg.evaluate("document.querySelector('#tour .next').click()"); await pg.wait_for_timeout(150)
        out["fim/visto"] = await pg.evaluate("localStorage.getItem('eitaAFO.tour')")
        out["fim/recolhidas"] = await pg.evaluate("[...document.querySelectorAll('section.collapsed')].map(x => x.id)")
        await pg.evaluate("document.getElementById('helpB').click()"); await pg.wait_for_timeout(150)
        await pg.keyboard.press("ArrowRight"); await pg.keyboard.press("ArrowRight"); out["teclas/→→"] = (await pg.evaluate(ESTADO))["k"]
        await pg.keyboard.press("ArrowLeft"); out["teclas/←"] = (await pg.evaluate(ESTADO))["k"]
        await pg.evaluate("document.querySelector('#tour .prev').click()"); out["voltar"] = (await pg.evaluate(ESTADO))["k"]
        await pg.set_viewport_size({"width": 900, "height": 700}); await pg.wait_for_timeout(300); out["redimensionar"] = await pg.evaluate(ESTADO)
        await pg.keyboard.press("Escape"); out["esc"] = await pg.evaluate(ESTADO)
        await pg.reload(); await pg.wait_for_timeout(1200); out["segunda_visita"] = await pg.evaluate(ESTADO)
        await pg.close()
    finally:
        srv.terminate()
    return out, erros

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
        A, eA = await rodar(sys.argv[1], 8797, b); B, eB = await rodar(sys.argv[2], 8798, b); await b.close()
    falhas = []
    for k in sorted(set(A) | set(B), key=lambda k: (len(k), k)):
        a, c = A.get(k), B.get(k)
        if k == "passo2" and a and c: a = dict(a, txt=a["txt"].replace("STL ou OBJ", "STL"))
        igual = a == c; print(("OK    " if igual else "DIFERE"), k, json.dumps(c, ensure_ascii=False)[:150])
        if not igual: falhas.append(k); print("       antes:", json.dumps(a, ensure_ascii=False)[:150])
    print("erros:", eA, eB); assert not falhas and not eB, falhas
    assert len([k for k in B if k.startswith("passo")]) == 9
    print("OK — mesmo tour")

if __name__ == "__main__":
    asyncio.run(main())
