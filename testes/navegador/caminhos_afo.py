"""Confere, em duas montagens do EITA! AFO, os caminhos que o comparar_afo.py não percorre (precisa de Playwright + Chrome):
   - o Worker da casca é criado e responde sem erro (o texto dele é montado das próprias funções);
   - downloads pela capacidade "downloads" do claude.ai (simulada): nomes entregues e conteúdo de cada arquivo
     (o STL vai dentro de .zip; compara-se o conteúdo descompactado, não os bytes do .zip);
   - download recusado ("declined") e download por link (sem a capacidade);
   - leitura de STL na comparação com a AFO real (a própria e uma cópia girada e deslocada, para o alinhamento
     trabalhar) e na AFO de referência (textos de #cmpInfo e #refInfo).
   Uso: python3 testes/navegador/caminhos_afo.py ANTES DEPOIS     (ex.: legado/afo dist/afo)
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados."""
import asyncio, base64, hashlib, io, json, os, subprocess, sys, time, zipfile
from playwright.async_api import async_playwright
from comparar_afo import CHROME, RELOGIO, STL, PONTOS

GANCHOS = """(() => {
  window.__w = { criados: 0, respostas: 0, erros: [] };
  const W = window.Worker;
  window.Worker = class extends W { constructor(...a) { super(...a); window.__w.criados++;
    this.addEventListener('message', () => window.__w.respostas++); this.addEventListener('error', (e) => window.__w.erros.push(String(e.message))); } };
  window.__links = [];
  const clique = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__links.push(this.download); return; } return clique.call(this); };
  window.__salvos = []; window.__modo = 'ok';
  if (window.__comCapacidade) window.claude = { use: async (n) => n === 'downloads' ? { save: async ({ filename, data }) => {
    if (window.__modo === 'declined') { const e = new Error('x'); e.code = 'declined'; throw e; }
    const u = new Uint8Array(await new Response(data).arrayBuffer()); let s = '';
    for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192));
    window.__salvos.push({ filename, b64: btoa(s) }); } } : null };
})();"""

PREPARAR = """async ({ stl, pontos }) => {
  const bin = Uint8Array.from(atob(stl), c => c.charCodeAt(0));
  await window.AFO.loadBuffer(bin.buffer, 'perna_sintetica.stl');
  for (const k of ['ML', 'MM', 'CA', 'M1', 'M5', 'PX']) window.AFO.setLandmark(k, pontos[k]);
  await window.AFO.makeShell();
  return document.getElementById('stats').innerText; }"""

async def clicar(pg, id_):
    await pg.evaluate(f"document.getElementById('{id_}').click()")
    await pg.wait_for_timeout(800)
    if id_ == "expAfo" and await pg.evaluate("!!document.getElementById('expGo')"):
        await pg.evaluate("document.getElementById('expGo').click()"); await pg.wait_for_timeout(800)

def girar_stl(b, ang=0.35, desl=(12.0, -30.0, 7.5)):
    """STL binário girado em torno de um eixo inclinado e deslocado (normais recalculadas pelo leitor)."""
    import math, struct
    n = struct.unpack_from("<I", b, 80)[0]; out = bytearray(b[:84])
    k = [0.3, 0.5, 0.81]; m = math.sqrt(sum(x * x for x in k)); k = [x / m for x in k]; c, s_ = math.cos(ang), math.sin(ang)
    def rot(v):
        d = sum(a * x for a, x in zip(k, v)); cr = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]]
        return [v[i] * c + cr[i] * s_ + k[i] * d * (1 - c) + desl[i] for i in range(3)]
    for t in range(n):
        o = 84 + t * 50; f = struct.unpack_from("<12fH", b, o)
        vs = [rot(f[3 + 3 * j: 6 + 3 * j]) for j in range(3)]
        out += struct.pack("<12fH", 0, 0, 0, *vs[0], *vs[1], *vs[2], 0)
    return bytes(out)

def conteudo(nome, b):
    if nome.endswith(".zip"):
        z = zipfile.ZipFile(io.BytesIO(b))
        return {i.filename: hashlib.sha256(z.read(i)).hexdigest() for i in z.infolist()}
    return hashlib.sha256(b).hexdigest()

async def rodar(pasta, porta, b):
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(porta)], cwd=pasta, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); out = {}; erros = []
    try:
        for cap in (True, False):
            pg = await b.new_page(viewport={"width": 1440, "height": 900})
            await pg.add_init_script(RELOGIO)
            await pg.add_init_script(f"window.__comCapacidade = {str(cap).lower()};" + GANCHOS)
            pg.on("pageerror", lambda e: erros.append(str(e)))
            await pg.goto(f"http://localhost:{porta}/index.html"); await pg.evaluate("localStorage.clear()"); await pg.reload()
            await pg.evaluate("() => { const t = document.getElementById('autoGen'); if (t) t.checked = false; }")
            out[f"{cap}/stats"] = await pg.evaluate(PREPARAR, {"stl": base64.b64encode(STL).decode(), "pontos": PONTOS})
            for id_ in ("expStl", "expJson", "expAfo"):
                await clicar(pg, id_); out[f"{cap}/{id_}/expnote"] = await pg.evaluate("document.getElementById('expnote').innerText")
            out[f"{cap}/links"] = await pg.evaluate("window.__links")
            salvos = await pg.evaluate("window.__salvos")
            out[f"{cap}/salvos"] = [(s["filename"], conteudo(s["filename"], base64.b64decode(s["b64"]))) for s in salvos]
            w = await pg.evaluate("window.__w"); out[f"{cap}/worker"] = w
            if cap:
                await pg.evaluate("window.__modo = 'declined'"); await clicar(pg, "expStl")
                out["declined/expnote"] = await pg.evaluate("document.getElementById('expnote').innerText")
                # o próprio STL da AFO (referencial anatômico) como "AFO real" e como "AFO de referência"
                afo = [s for s in salvos if s["filename"].endswith("_AFO.zip")][0]
                inner = zipfile.ZipFile(io.BytesIO(base64.b64decode(afo["b64"])))
                stl = inner.read(inner.infolist()[0])
                for inp, info in (("realFile", "cmpInfo"), ("refFile", "refInfo")):
                    await pg.set_input_files(f"#{inp}", files=[{"name": "afo_real.stl", "mimeType": "model/stl", "buffer": stl}])
                    await pg.wait_for_timeout(4000)
                    out[f"{inp}/{info}"] = await pg.evaluate(f"document.getElementById('{info}').innerText")
                # a mesma peça girada e deslocada, como um scan da AFO impressa: o alinhamento tem de trabalhar
                await pg.set_input_files("#realFile", files=[{"name": "afo_girada.stl", "mimeType": "model/stl", "buffer": girar_stl(stl)}])
                await pg.wait_for_timeout(6000)
                out["realFile_girada/cmpInfo"] = await pg.evaluate("document.getElementById('cmpInfo').innerText")
                out["status_final"] = await pg.evaluate("document.getElementById('status').innerText")
            await pg.close()
    finally:
        srv.terminate()
    return out, erros

async def main():
    a, c = sys.argv[1], sys.argv[2]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
        A, eA = await rodar(a, 8793, b); B, eB = await rodar(c, 8794, b)
        await b.close()
    falhas = []
    for k in sorted(set(A) | set(B)):
        igual = A.get(k) == B.get(k)
        print(("OK    " if igual else "DIFERE"), k, json.dumps(B.get(k), ensure_ascii=False)[:150])
        if not igual: falhas.append(k); print("       antes:", json.dumps(A.get(k), ensure_ascii=False)[:150])
    for out in (A, B):
        for cap in (True, False):
            w = out[f"{cap}/worker"]; assert w["criados"] >= 1 and w["respostas"] >= 1 and not w["erros"], ("worker", w)
    if eA or eB: print("erros:", eA, eB)
    assert not falhas and not eB, falhas
    print("OK — mesmos caminhos")

if __name__ == "__main__":
    asyncio.run(main())
