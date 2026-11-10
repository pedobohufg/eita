"""Compara as saídas de duas montagens do EITA! OLHO no navegador (opcional, precisa de Playwright + Chrome).
   Abre cada pasta com o relógio e o sorteio congelados, carrega a foto de exemplo e percorre dois cenários
   (padrão; e olho esquerdo espelhado, verso maciço, régua, balanço de branco, setor de pálpebra, pupila plana).
   Em cada um compara o pacote (STL, PNG, JSON, LEIAME, ficha, PDF), o relatório avulso, a ficha salva no
   navegador e as telas (foto, íris, 3D). Uso:
     python3 testes/navegador/comparar_olho.py PASTA_ANTES PASTA_DEPOIS [caminho-do-chrome]
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados."""
import asyncio, base64, hashlib, subprocess, sys, time
from playwright.async_api import async_playwright

CHROME = sys.argv[3] if len(sys.argv) > 3 else "/usr/bin/google-chrome"
RELOGIO = """(() => { const T = Date.UTC(2026, 10, 10, 15, 0, 0), D = Date;
  class F extends D { constructor(...a) { a.length ? super(...a) : super(T); } static now() { return T; } }
  globalThis.Date = F; Math.random = (() => { let s = 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })(); })();"""
# define valores pelo DOM (como o usuário), disparando input e change
DEFINIR = """(pares) => { for (const [id, v] of pares) { const el = document.getElementById(id);
  if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
  el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } }"""
COLETAR = """async () => {
  const hex = async (u) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', u))].map(b => b.toString(16).padStart(2, '0')).join('');
  const b64 = (u) => { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); };
  const out = {};
  const { files } = await window.__eitaPackage();
  for (const f of files) { const u = new Uint8Array(f.data); out['pacote/' + f.name] = /\\.(stl|png)$/.test(f.name) ? 'sha256:' + await hex(u) + ' (' + u.length + ' B)' : b64(u); }
  const pdf = await window.__eitaReport(); out['relatorio.pdf'] = b64(new Uint8Array(pdf));
  return out; }"""

async def cenario(pg, nome, passos):
    out = {}
    await pg.goto(pg.url_base + "/index.html"); await pg.evaluate("localStorage.clear()")
    await pg.reload()
    await pg.click("#demo")
    await pg.wait_for_function("document.getElementById('status').textContent.includes('Íris e pupila detectadas')", timeout=60000)
    await pg.evaluate(DEFINIR, [["pName", "Paciente Teste"], ["pId", "T-01"], ["pBirth", "2025-02-20"], ["pSex", "F"], ["pSurg", "evisceracao"], ["pPrev", "conformador"], ["pNotes", "Teste automático: motilidade boa, sem secreção; prótese anterior pré-fabricada com desconforto nasal."]])
    await passos(pg)
    await pg.wait_for_timeout(600)
    r = await pg.evaluate(COLETAR)
    for k, v in r.items(): out[f"{nome}/{k}"] = v.encode()
    await pg.evaluate("document.getElementById('fSave').click()")
    out[f"{nome}/localStorage"] = (await pg.evaluate("localStorage.getItem('eitaOLHO.fichas.v1')") or "").encode()
    out[f"{nome}/idade"] = (await pg.text_content("#pAge") or "").encode()
    for aba, cv in [("photo", "#pc"), ("iris", "#ic"), ("3d", "#gl")]:
        await pg.click(f"#tabs button[data-t='{aba}']"); await pg.wait_for_timeout(2500 if aba == "3d" else 800)
        out[f"{nome}/tela-{aba}.png"] = await pg.locator(cv).screenshot()
    await pg.mouse.move(900, 450); await pg.mouse.down(); await pg.mouse.move(960, 480, steps=4); await pg.mouse.up(); await pg.mouse.wheel(0, -200)
    await pg.wait_for_timeout(300); out[f"{nome}/tela-3d-girada.png"] = await pg.locator("#gl").screenshot()
    await pg.click("#tools3d button[data-v='side']"); await pg.wait_for_timeout(300); out[f"{nome}/tela-3d-lado.png"] = await pg.locator("#gl").screenshot()
    return out

async def padrao(pg): pass

async def variado(pg):
    await pg.evaluate(DEFINIR, [["protSide", "E"], ["sMode", "solid"], ["upOn", True], ["pupMode", "flat"], ["hInv", True], ["hLimbus", True], ["cSat", "1.2"], ["sDx", "1"]])
    await pg.click("#stepper button[data-s='s3']"); await pg.wait_for_timeout(300)
    await pg.click("#scaleMode button[data-v='ruler']")
    await pg.click("#rulerBtn"); await pg.mouse.click(700, 600); await pg.mouse.click(820, 610)
    await pg.evaluate(DEFINIR, [["rulerMM", "8"]])
    await pg.click("#wbBtn"); await pg.mouse.click(640, 420)

async def saidas(pasta, porta, b):
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(porta)], cwd=pasta, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); erros = []; out = {}
    try:
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        pg.url_base = f"http://localhost:{porta}"
        await pg.add_init_script(RELOGIO)
        pg.on("pageerror", lambda e: erros.append(str(e)))
        pg.on("console", lambda m: m.type == "error" and erros.append(m.text))
        pg.on("dialog", lambda d: asyncio.ensure_future(d.dismiss()))
        out.update(await cenario(pg, "A", padrao))
        out.update(await cenario(pg, "B", variado))
        await pg.close()
    finally:
        srv.terminate()
    return out, erros

async def main():
    antes, depois = sys.argv[1], sys.argv[2]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
        A, eA = await saidas(antes, 8781, b)
        B, eB = await saidas(depois, 8782, b)
        await b.close()
    falhas = []
    for n in sorted(set(A) | set(B)):
        a, c = A.get(n), B.get(n); igual = a == c
        info = (c or b"")[:60].decode("latin1") if (c or b"").startswith(b"sha256") else hashlib.sha1(c or b"").hexdigest()[:10]
        print(f"{'OK   ' if igual else 'DIFERE'} {n:34s} {len(a or b''):>9} {len(c or b''):>9}  {info}")
        if not igual: falhas.append(n)
    eA = [e for e in eA if "404" not in e]; eB = [e for e in eB if "404" not in e]
    if eA or eB: print("erros no console:", eA, eB)
    if "--salvar" in sys.argv:
        import json, os
        os.makedirs("/tmp/olho-cmp", exist_ok=True)
        for lado, D in (("antes", A), ("depois", B)):
            for k, v in D.items(): open(f"/tmp/olho-cmp/{lado}__{k.replace('/', '__')}", "wb").write(v)
    assert not falhas and not eB, (falhas, eB)
    print("OK — saídas idênticas")

asyncio.run(main())
