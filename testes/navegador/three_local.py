"""Apoio aos testes de navegador do EITA! CRÂNIO: serve o three.js r128 (three.min.js, OrbitControls e STLLoader)
   a partir de uma cópia local, no lugar dos CDN (cdnjs e jsdelivr), que ficam fora do alcance nos testes.
   A cópia é o código-fonte da tag r128 do three.js (build/ e examples/js/), por exemplo:
     git clone --depth 1 --branch r128 --filter=blob:none --sparse https://github.com/mrdoob/three.js /tmp/three-r128
     git -C /tmp/three-r128 sparse-checkout set build examples/js/controls examples/js/loaders
   Pasta: variável de ambiente EITA_THREE_R128 (padrão /tmp/three-r128). Sem a cópia, os scripts são entregues
   vazios (a página roda sem o visualizador 3D) e `disponivel()` devolve False. As fontes do Google vêm vazias.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados."""
import os

PASTA = os.environ.get("EITA_THREE_R128", "/tmp/three-r128")
ARQUIVOS = {
    "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js": "build/three.min.js",
    "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js": "examples/js/controls/OrbitControls.js",
    "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/STLLoader.js": "examples/js/loaders/STLLoader.js",
}

def disponivel():
    return all(os.path.exists(os.path.join(PASTA, a)) for a in ARQUIVOS.values())

async def ligar(pagina):
    async def servir(rota):
        url = rota.request.url
        if url in ARQUIVOS:
            f = os.path.join(PASTA, ARQUIVOS[url])
            corpo = open(f, "rb").read() if os.path.exists(f) else b""
            await rota.fulfill(status=200, body=corpo, headers={"content-type": "application/javascript", "access-control-allow-origin": "*"})
        else:   # fontes e o resto: resposta vazia (sem erro no console)
            await rota.fulfill(status=200, body=b"", headers={"content-type": "text/css" if "fonts.googleapis" in url else "application/octet-stream", "access-control-allow-origin": "*"})
    for padrao in ("https://cdnjs.cloudflare.com/**", "https://cdn.jsdelivr.net/**", "https://fonts.googleapis.com/**", "https://fonts.gstatic.com/**"):
        await pagina.route(padrao, servir)
