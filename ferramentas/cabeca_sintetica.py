"""Gera a cabeça sintética usada nos testes do EITA! Crânio (sem dados de paciente):
   calota elipsoidal de bebê com plagiocefalia posicional conhecida (achatamento parieto-occipital DIREITO),
   orelhas, face, queixo, nariz e pescoço, em mm, como superfície implícita suave extraída por marching cubes.
   Já vem no referencial anatômico do EITA! Crânio: x = direita do paciente, y = anterior, z = superior,
   com o plano glabela–opistocrânio em z = 0 (origem na linha média).
   Também calcula os 5 pontos de referência (anterior, posterior, left, right, vertex), presos ao vértice
   mais próximo da malha, e o achatamento medido na própria malha.
   Saída: testes/fixtures/cabeca_sintetica.stl.gz e testes/fixtures/cabeca_sintetica.json
   Uso: python3 ferramentas/cabeca_sintetica.py   (precisa de numpy e scikit-image)
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados."""
import gzip, json, os, struct
import numpy as np
from skimage.measure import marching_cubes

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
H = 2.0                                   # passo da grade (mm)
xs = np.arange(-84, 84 + H, H); ys = np.arange(-96, 100 + H, H); zs = np.arange(-140, 96 + H, H)
X, Y, Z = np.meshgrid(xs, ys, zs, indexing="ij")
DEG = np.pi / 180

def capsula(p0, p1, r0, r1):
    a, b = np.array(p0, float), np.array(p1, float); d = b - a; L2 = d @ d
    t = np.clip(((X - a[0]) * d[0] + (Y - a[1]) * d[1] + (Z - a[2]) * d[2]) / L2, 0, 1)
    cx, cy, cz = a[0] + t * d[0], a[1] + t * d[1], a[2] + t * d[2]
    return np.sqrt((X - cx) ** 2 + (Y - cy) ** 2 + (Z - cz) ** 2) - (r0 + (r1 - r0) * t)
def elipsoide(c, r):
    k0 = np.sqrt(((X - c[0]) / r[0]) ** 2 + ((Y - c[1]) / r[1]) ** 2 + ((Z - c[2]) / r[2]) ** 2)
    return (k0 - 1) * min(r)
def uniao(a, b, k):        # união suave (polinomial)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1); return b * (1 - h) + a * h - k * h * (1 - h)
def intersecao(a, b, k):   # interseção suave
    return -uniao(-a, -b, k)
def direcao(th, ph):       # azimute θ (0° = anterior, +90° = direita), elevação φ
    return np.array([np.cos(ph * DEG) * np.sin(th * DEG), np.cos(ph * DEG) * np.cos(th * DEG), np.sin(ph * DEG)])

CALOTA = {"centro": (0, -4, 8), "raios": (64, 76, 70)}            # largura 128, comprimento 152 mm
ACHAT = {"azimute": 140, "elevacao": 12, "distancia": 60, "suave": 10}   # plano que achata o parieto-occipital D
d = elipsoide(CALOTA["centro"], CALOTA["raios"])
n = direcao(ACHAT["azimute"], ACHAT["elevacao"]); c0 = np.array(CALOTA["centro"], float)
plano = (X - c0[0]) * n[0] + (Y - c0[1]) * n[1] + (Z - c0[2]) * n[2] - ACHAT["distancia"]
d = intersecao(d, plano, ACHAT["suave"])
d = uniao(d, elipsoide((0, 28, -42), (47, 46, 44)), 16)            # face
d = uniao(d, elipsoide((0, 44, -76), (33, 28, 22)), 10)            # queixo
d = uniao(d, elipsoide((0, 74, -30), (8, 10, 14)), 5)              # nariz
d = uniao(d, capsula((0, -12, -62), (0, -12, -150), 38, 38), 16)   # pescoço
ORELHA = {"centro_x": 67, "y": -8, "z": -12, "raios": (7, 14, 22)}
for s in (1, -1):                                                  # orelhas (simétricas)
    d = uniao(d, elipsoide((s * ORELHA["centro_x"], ORELHA["y"], ORELHA["z"]), ORELHA["raios"]), 3)
d = np.maximum(d, -(Z + 132))                                      # corte do scan no pescoço
V, F, _, _ = marching_cubes(d, level=0.0, spacing=(H, H, H))
V = V + np.array([xs[0], ys[0], zs[0]])
F = F[:, [0, 2, 1]]                                                # normais para fora

# pontos de referência (presos à malha)
def extremo(filtro, eixo, sinal):
    i = np.where(filtro)[0]; return i[np.argmax(sinal * V[i, eixo])]
med = np.abs(V[:, 0]) < 2.5
k = {"anterior": extremo(med & (np.abs(V[:, 2]) < 3) & (V[:, 1] > 0), 1, 1),
     "posterior": extremo(med & (np.abs(V[:, 2]) < 3) & (V[:, 1] < 0), 1, -1),
     "left": extremo((V[:, 2] > 12) & (V[:, 2] < 40), 0, -1),
     "right": extremo((V[:, 2] > 12) & (V[:, 2] < 40), 0, 1),
     "vertex": extremo(np.abs(V[:, 0]) < 4, 2, 1)}
pontos = {nome: [round(float(c), 4) for c in V[i]] for nome, i in k.items()}

# achatamento medido: raio médio num cone de 6° a partir de (0, 0, 0), lado D × espelho E
def raio_medio(th, ph):
    u = direcao(th, ph); r = np.linalg.norm(V, axis=1); cosang = (V @ u) / np.maximum(r, 1e-9)
    sel = (cosang > np.cos(6 * DEG)) & ((V @ u) > 0); return float(np.mean(r[sel]))
rD, rE = raio_medio(ACHAT["azimute"], ACHAT["elevacao"]), raio_medio(360 - ACHAT["azimute"], ACHAT["elevacao"])

buf = bytearray(b"EITA! Cranio - cabeca sintetica de teste (Lab.EITA/UFG) - mm".ljust(80, b" ")) + struct.pack("<I", len(F))
for f in F:
    a, b, c = V[f[0]], V[f[1]], V[f[2]]; nn = np.cross(b - a, c - a); nn = nn / (np.linalg.norm(nn) or 1)
    buf += struct.pack("<12fH", *nn, *a, *b, *c, 0)
os.makedirs(os.path.join(RAIZ, "testes", "fixtures"), exist_ok=True)
with gzip.GzipFile(os.path.join(RAIZ, "testes", "fixtures", "cabeca_sintetica.stl.gz"), "wb", 9, mtime=0) as g: g.write(bytes(buf))
info = {"_origem": "ferramentas/cabeca_sintetica.py (sintética, sem dados de paciente)",
        "referencial": "x = direita do paciente, y = anterior, z = superior; mm; plano glabela–opistocrânio em z = 0",
        "triangulos": int(len(F)), "zRef": round((pontos["anterior"][2] + pontos["posterior"][2]) / 2, 4),
        "pontos_mm": pontos,
        "assimetria": {"descricao": "achatamento parieto-occipital direito (plagiocefalia posicional à direita)", "plano": ACHAT,
                       "raio_D_mm": round(rD, 2), "raio_E_espelho_mm": round(rE, 2), "diferenca_mm": round(rE - rD, 2)},
        "calota": CALOTA, "orelhas": ORELHA}
json.dump(info, open(os.path.join(RAIZ, "testes", "fixtures", "cabeca_sintetica.json"), "w"), ensure_ascii=False, indent=1)
print(len(V), "vértices", len(F), "triângulos"); print(json.dumps(info, ensure_ascii=False)[:900])
