"""Compara o cálculo da órtese craniana de duas montagens do EITA! Crânio no navegador (opcional, precisa de
   Playwright + Chrome). Usa a cabeça sintética (testes/fixtures/cabeca_sintetica.*, já no referencial anatômico)
   e o objeto window.CROCore da página (sem cliques e sem three.js): análise por espelhamento, orelhas,
   indicação, correções manuais, mapa de cores (malha e vista superior), linha de corte, casca → STL, com o
   relógio e o sorteio congelados. Três cenários:
     A — plagiocefalia automática, parâmetros padrão da página (capacete fechado, valvas coronais, furos);
     B — "ambas" aos 6 meses com IC alvo 0,82, modo ativo, faixa de topo aberto, valvas sagitais, sem apoios,
         orelha D marcada à mão, 3 correções manuais (uma removida), resolução alta;
     C — braquicefalia aos 3 meses (alvo pela idade), orelhas manuais, sem furos e sem divisão.
   Uso: python3 testes/navegador/comparar_cranio.py ANTES DEPOIS [--api EXPR]
        python3 testes/navegador/comparar_cranio.py PASTA [--api EXPR] (compara com testes/referencia/cranio-ortese-ui8.json)
        python3 testes/navegador/comparar_cranio.py ANTES --referencia (grava a referência)
   ANTES/DEPOIS: pastas com index.html (ex.: legado/cranio-ortese, dist/cranio). --api: expressão JS que dá o
   objeto com as funções do CROCore na página nova (padrão: window.CROCore, ou EITA.cranio.ortese se a página não
   tiver CROCore — desde a E3c-2 o cálculo é modulos/cranio/ortese.js, com nomes em português, traduzidos aqui).
   Cenários e nomes: testes/apoio/cranio-ortese.json.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados."""
import asyncio, base64, gzip, json, os, subprocess, sys, time
from playwright.async_api import async_playwright

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CHROME = "/usr/bin/google-chrome"
REFERENCIA = os.path.join(RAIZ, "testes", "referencia", "cranio-ortese-ui8.json")
RELOGIO = """(() => { const T = Date.UTC(2026, 10, 11, 15, 0, 0), D = Date;
  class F extends D { constructor(...a) { a.length ? super(...a) : super(T); } static now() { return T; } }
  globalThis.Date = F; Math.random = (() => { let s = 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const t0 = performance.now(); performance.now = () => t0; })();"""
STL = gzip.decompress(open(os.path.join(RAIZ, "testes", "fixtures", "cabeca_sintetica.stl.gz"), "rb").read())
CABECA = json.load(open(os.path.join(RAIZ, "testes", "fixtures", "cabeca_sintetica.json")))

# cenários (A, B, C) e nomes antigos → novos: testes/apoio/cranio-ortese.json, os mesmos do teste no Node
CONFIG = json.load(open(os.path.join(RAIZ, "testes", "apoio", "cranio-ortese.json"), encoding="utf-8"))
CENARIOS, NOMES = CONFIG["cenarios"], CONFIG["nomes"]

COLETAR = """async ({ stl, zRef, cenarios, api, nomes }) => {
  let C = eval(api); if (!C) return { erro: 'objeto CROCore não encontrado: ' + api };
  if (!C.analyze && C.analisar) { const O = C; C = {}; for (const [antigo, novo] of Object.entries(nomes)) C[antigo] = O[novo]; C.analyze = (p, z) => O.analisar(p, z, { icLegado: true }); }   // modulos/cranio/ortese.js
  const hex = async (x) => { const u = x instanceof ArrayBuffer ? new Uint8Array(x) : new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
    return 'sha256:' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', u))].map(b => b.toString(16).padStart(2, '0')).join('') + ' (' + u.length + ' B)'; };
  // STL binário → posições soltas (9 floats por triângulo), como o STLLoader
  const bin = Uint8Array.from(atob(stl), c => c.charCodeAt(0)), dv = new DataView(bin.buffer), n = dv.getUint32(80, true);
  const pos = new Float32Array(n * 9);
  for (let t = 0; t < n; t++) for (let q = 0; q < 9; q++) pos[t * 9 + q] = dv.getFloat32(84 + t * 50 + 12 + q * 4, true);
  const o = {};
  o['funcoes.json'] = JSON.stringify({
    ganho: [0, 2, 3.9, 4, 5, 6, 7.5, 8, 9, 10, 14].map(a => C.expectedIcGain(a)),
    alvo: [[0.95, 0], [0.95, 5], [0.92, 9], [0.86, 6], [0.80, 3], [1.0, 12]].map(p => C.defaultIcTarget(p[0], p[1])),
    crescimento: [[-3, 0], [-1, 20], [0, 50], [1, 70], [2, 80], [5, 89]].map(p => C.growthReserve(p[0], p[1], { growMonths: 4, growRate: 0.8, growContactPct: 30, growVertex: 2 })),
    regioes: [[0, 0], [30, 10], [90, 0], [135, 20], [180, 5], [225, 30], [270, -10], [330, 40], [10, 70]].map(p => C.regionName(p[0], p[1])),
    cores: [-5, -1, -0.2, 0, 0.5, 2, 4].map(d => C.colorRGB(d, 3, 0.7)),
    grade: C.G });
  for (const [nome, cen] of Object.entries(cenarios)) {
    const an = C.analyze(pos, zRef);
    if (an.error) { o[nome + '/erro'] = an.error; continue; }
    C.setIndication(an, cen.indicacao);
    for (const e of cen.edicoes) {
      if (e.pico != null) { const p = an.peaks[e.pico]; C.addEdit(an, { kind: 'zero', th: p.th, ph: p.ph, radiusMm: 30, mm: 0 }); }
      else if (e.remover != null) C.removeEdit(an, e.remover);
      else C.addEdit(an, e);
    }
    const P = cen.P, range = Math.max(2, Math.ceil(an.maxAbs));
    o[nome + '/analise.json'] = JSON.stringify({ filled: an.filled, cheekCoverage: an.cheekCoverage, ic: an.ic, width: an.width, length: an.length,
      mirrorMax: an.mirrorMax, maxAbs: an.maxAbs, ears: an.ears, mode: an.mode, usePl: an.usePl, useBr: an.useBr, icTarget: an.icTarget, kx: an.kx, ky: an.ky,
      age: an.age, peaks: an.peaks, edits: an.edits, editSeq: an.editSeq, amostra: [[0, 0], [140, 12], [220, 12], [95, -10], [17.3, 55.1]].map(q => [C.sampleGrid(an.rho, q[0], q[1]), C.sampleGrid(an.dev, q[0], q[1])]) });
    for (const k of ['rho', 'devMirror', 'rsNoEar', 'devBase', 'dev']) o[nome + '/' + k] = await hex(an[k]);
    o[nome + '/orelhas.json'] = JSON.stringify(C.resolveEars(an, P));
    o[nome + '/linha_corte.json'] = JSON.stringify(C.trimLine(an, P, 240));
    o[nome + '/cores_malha'] = await hex(C.vertexColors(pos, an, zRef, range));
    o[nome + '/mapa_superior'] = await hex(C.polarImage(an, range, 340, -10, 16));
    const g = C.generate(an, zRef, P, pos);
    o[nome + '/casca.json'] = JSON.stringify(g.stats);
    o[nome + '/ortese.stl'] = await hex(C.toBinarySTL(g.tris));
  }
  return o; }"""

PADRAO = "window.CROCore || (window.EITA && EITA.cranio && EITA.cranio.ortese)"

async def saidas(pasta, porta, b, api):
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(porta)], cwd=pasta, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); erros = []
    try:
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        await pg.add_init_script(RELOGIO)
        # sem rede externa (three.js e fontes): o CROCore não depende delas, e o resultado não varia com a CDN
        await pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith(f"http://localhost:{porta}/") else r.abort())
        pg.on("pageerror", lambda e: erros.append(str(e)))
        pg.on("console", lambda m: m.type == "error" and "net::ERR_FAILED" not in m.text and erros.append(m.text))
        await pg.goto(f"http://localhost:{porta}/index.html"); await pg.evaluate("localStorage.clear()"); await pg.reload()
        await pg.wait_for_load_state("load")
        r = await pg.evaluate(COLETAR, {"stl": base64.b64encode(STL).decode(), "zRef": CABECA["zRef"], "cenarios": CENARIOS, "api": api, "nomes": NOMES})
        await pg.close()
    finally:
        srv.terminate()
    return {k: v.encode() for k, v in r.items()}, erros

def mostrar(A):
    for k, v in A.items(): print(f"{k:24s}", v[:150].decode())

async def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    api = sys.argv[sys.argv.index("--api") + 1] if "--api" in sys.argv else PADRAO
    if "--api" in sys.argv: args.remove(api)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME)
        A, eA = await saidas(args[0], 8793, b, PADRAO if len(args) > 1 else api)
        B, eB = (await saidas(args[1], 8794, b, api)) if len(args) > 1 else (None, [])
        await b.close()
    if "--referencia" in sys.argv:
        assert not eA and not any(k.endswith("/erro") for k in A), (eA, A)
        json.dump({"_gerado_com": "EITA! Crânio \"UI v8\" (legado/cranio-ortese), cabeça sintética, Chrome", **{k: v.decode() for k, v in A.items()}},
                  open(REFERENCIA, "w"), ensure_ascii=False, indent=1)
        mostrar(A); print("referência gravada em", os.path.relpath(REFERENCIA, RAIZ)); return
    if B is None:
        ref = json.load(open(REFERENCIA)); ref.pop("_gerado_com", None)
        B, eB, A, eA = A, eA, {k: v.encode() for k, v in ref.items()}, []
        print("comparando com", os.path.relpath(REFERENCIA, RAIZ))
    falhas = []
    for n in sorted(set(A) | set(B)):
        a, c = A.get(n), B.get(n); igual = a == c
        print(f"{'OK   ' if igual else 'DIFERE'} {n:24s} {len(a or b''):>8} {len(c or b''):>8}")
        if not igual: falhas.append(n)
    if eA or eB: print("erros no console:", eA, eB)
    assert not falhas and not eA and not eB, (falhas, eA, eB)
    print("OK — saídas idênticas")

if __name__ == "__main__":
    asyncio.run(main())
