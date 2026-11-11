"""Visualizador do EITA! AFO em duas montagens (precisa de Playwright + Chrome): marcar os 6 pontos clicando sobre a
   perna, girar e aproximar com o mouse — mesmos pontos, mesma câmera, mesma tela e mesma projeção (screenOf).
   A tela logo depois de carregar não é comparada: varia de uma rodada para outra (transições da página).
   Uso: python3 testes/navegador/vista_afo.py ANTES DEPOIS
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados."""
import asyncio, base64, hashlib, subprocess, sys, time, json
from playwright.async_api import async_playwright
from comparar_afo import CHROME, RELOGIO, STL, PONTOS
async def rodar(pasta, porta, b):
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(porta)], cwd=pasta, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1); out = {}
    try:
        pg = await b.new_page(viewport={"width": 1440, "height": 900}); await pg.add_init_script(RELOGIO)
        await pg.goto(f"http://localhost:{porta}/index.html"); await pg.evaluate("localStorage.setItem('eitaAFO.tour','1')"); await pg.reload()
        await pg.evaluate("async (s) => { const u = Uint8Array.from(atob(s), c => c.charCodeAt(0)); await window.AFO.loadBuffer(u.buffer, 'p.stl'); }", base64.b64encode(STL).decode())
        await pg.wait_for_timeout(500)
        await pg.wait_for_timeout(300)
        box = await pg.evaluate("(() => { const r = document.getElementById('gl').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
        for k in ["ML", "MM", "CA", "M1", "M5", "PX"]:
            xy = await pg.evaluate("(p) => { const o = window.AFO.S.offset; return window.AFO.screenOf([p[0]-o[0], p[1]-o[1], p[2]-o[2]]); }", PONTOS[k])
            await pg.mouse.click(box[0] + xy[0], box[1] + xy[1]); await pg.wait_for_timeout(250)
        out["pontos_clicados"] = await pg.evaluate("JSON.stringify(window.AFO.S.L)")
        await pg.mouse.move(box[0] + 300, box[1] + 300); await pg.mouse.down(); await pg.mouse.move(box[0] + 380, box[1] + 330, steps=5); await pg.mouse.up()
        await pg.mouse.wheel(0, -300); await pg.wait_for_timeout(300)
        out["camera"] = await pg.evaluate("JSON.stringify({y: window.AFO.cam.yaw, p: window.AFO.cam.pitch, d: window.AFO.cam.dist})")
        out["tela_girada"] = hashlib.sha256(await pg.screenshot()).hexdigest()
        out["screenOf"] = await pg.evaluate("JSON.stringify(window.AFO.screenOf([10, 20, 30]))")
        await pg.close()
    finally: srv.terminate()
    return out
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
        A = await rodar(sys.argv[1], 8801, b); B = await rodar(sys.argv[2], 8802, b); await b.close()
    for k in A: print("OK    " if A[k] == B[k] else "DIFERE", k, B[k][:120])
    assert A == B and len(json.loads(B["pontos_clicados"])) >= 6, "vista diferente"
    print("OK — mesma vista")
if __name__ == "__main__":
    asyncio.run(main())
