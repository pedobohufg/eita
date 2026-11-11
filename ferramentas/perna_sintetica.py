"""Gera a perna sintética usada nos testes do EITA! AFO (sem dados de paciente):
   perna direita afunilada, maléolos, calcanhar e pé com sola plana, em mm, como uma superfície implícita
   suave (união suave de cápsulas e elipsoides) extraída por marching cubes. Também calcula os 6 pontos
   anatômicos (ML, MM, CA, M1, M5, PX), presos ao vértice mais próximo da malha.
   Saída: testes/fixtures/perna_sintetica.stl.gz e testes/fixtures/perna_sintetica.json
   Uso: python3 ferramentas/perna_sintetica.py   (precisa de numpy e scikit-image)
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados."""
import gzip, json, os, struct
import numpy as np
from skimage.measure import marching_cubes

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
H = 2.0                                   # passo da grade (mm)
xs = np.arange(-75, 75 + H, H); ys = np.arange(-75, 215 + H, H); zs = np.arange(-6, 336 + H, H)
X, Y, Z = np.meshgrid(xs, ys, zs, indexing="ij")

def capsula(p0, p1, r0, r1):
    a, b = np.array(p0, float), np.array(p1, float); d = b - a; L2 = d @ d
    t = np.clip(((X - a[0]) * d[0] + (Y - a[1]) * d[1] + (Z - a[2]) * d[2]) / L2, 0, 1)
    cx, cy, cz = a[0] + t * d[0], a[1] + t * d[1], a[2] + t * d[2]
    return np.sqrt((X - cx) ** 2 + (Y - cy) ** 2 + (Z - cz) ** 2) - (r0 + (r1 - r0) * t)
def elipsoide(c, r):
    k0 = np.sqrt(((X - c[0]) / r[0]) ** 2 + ((Y - c[1]) / r[1]) ** 2 + ((Z - c[2]) / r[2]) ** 2)
    return (k0 - 1) * min(r)
def uniao(a, b, k):   # união suave (polinomial)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1); return b * (1 - h) + a * h - k * h * (1 - h)

d = capsula((0, 0, 70), (0, 6, 215), 31, 47)                     # tornozelo → panturrilha
d = uniao(d, capsula((0, 6, 215), (0, 12, 330), 47, 41), 20)      # panturrilha → joelho
d = uniao(d, elipsoide((33, 0, 74), (11, 13, 13)), 6)             # maléolo lateral (+x: perna direita)
d = uniao(d, elipsoide((-31, 5, 82), (10, 12, 12)), 6)            # maléolo medial (mais alto e anterior)
d = uniao(d, elipsoide((0, -12, 34), (34, 40, 34)), 14)           # calcanhar
d = uniao(d, elipsoide((-2, 70, 28), (40, 62, 25)), 16)           # mediopé
d = uniao(d, elipsoide((-4, 142, 17), (48, 52, 17)), 14)          # antepé
d = np.maximum(d, -Z)                                             # sola plana (z = 0)
d = np.maximum(d, Z - 326)                                        # corte no topo do scan
V, F, _, _ = marching_cubes(d, level=0.0, spacing=(H, H, H))
V = V + np.array([xs[0], ys[0], zs[0]])
F = F[:, [0, 2, 1]]                                               # normais para fora

ALVOS = {"ML": (44, 0, 74), "MM": (-41, 5, 82), "CA": (0, -40, 2), "M1": (-38, 142, 2), "M5": (42, 128, 2), "PX": (0, 55, 300)}
pontos = {}
for k, p in ALVOS.items():
    i = int(np.argmin(((V - np.array(p)) ** 2).sum(1))); pontos[k] = [round(float(c), 4) for c in V[i]]

buf = bytearray(b"EITA! AFO - perna sintetica de teste (Lab.EITA/UFG) - mm".ljust(80, b" ")) + struct.pack("<I", len(F))
for f in F:
    a, b, c = V[f[0]], V[f[1]], V[f[2]]; n = np.cross(b - a, c - a); n = n / (np.linalg.norm(n) or 1)
    buf += struct.pack("<12fH", *n, *a, *b, *c, 0)
os.makedirs(os.path.join(RAIZ, "testes", "fixtures"), exist_ok=True)
with gzip.GzipFile(os.path.join(RAIZ, "testes", "fixtures", "perna_sintetica.stl.gz"), "wb", 9, mtime=0) as g: g.write(bytes(buf))
json.dump({"_origem": "ferramentas/perna_sintetica.py (sintética, sem dados de paciente)", "triangulos": int(len(F)), "pontos_mm": pontos}, open(os.path.join(RAIZ, "testes", "fixtures", "perna_sintetica.json"), "w"), indent=1)
print(len(V), "vértices", len(F), "triângulos", pontos)
