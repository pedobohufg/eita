#!/usr/bin/env node
/* Rosto sintético para testes do EITA! NARIZ·ORELHA (sem dados de paciente).
   Cabeça elipsoidal com órbitas, nariz e orelhas feitas de formas simples; gera dois casos:
     rosto_sem_orelha — falta a orelha direita (anotia); a esquerda tem hélice, concha e o vão atrás da orelha
                        (reentrância), e um furo de scan atrás da hélice, como na fotogrametria;
     rosto_sem_nariz  — rinectomia total (cavidade no lugar do nariz), com as duas orelhas.
   O scan é aberto (sem a nuca e o pescoço), em mm; eixos: x para a esquerda do paciente, y para cima, z para a frente.
   Saída: testes/fixtures/<caso>.stl.gz + <caso>.json (pontos de referência e contorno da orelha sadia).
   Uso: node ferramentas/rosto_sintetico.mjs
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import * as V from "../nucleo/volume.js";
import { decimar } from "../nucleo/decimar.js";
import { stl } from "../nucleo/malha.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const smin = V.uniaoSuave, dif = (a, b, r) => -smin(-a, b, r);
const cap = (p, a, b, r) => { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]; const t = Math.max(0, Math.min(1, (ab[0] * ap[0] + ab[1] * ap[1] + ab[2] * ap[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2))); return Math.hypot(ap[0] - t * ab[0], ap[1] - t * ab[1], ap[2] - t * ab[2]) - r; };

function cabeca(x, y, z) {
  let f = V.elipsoide(x, y - 10, z, 72, 95, 92);
  for (const s of [-1, 1]) f = dif(f, V.elipsoide(x - s * 33, y - 32, z - 84, 16, 9, 11), 4);   // órbitas
  f = smin(f, V.elipsoide(x, y + 52, z - 70, 30, 22, 20), 8);                                       // queixo/boca
  return f;
}
function nariz(x, y, z) {
  let f = cap([x, y, z], [0, 34, 87], [0, 2, 104], 5.5);
  f = smin(f, V.elipsoide(x, y + 1, z - 104, 9, 8.5, 8), 4);
  for (const s of [-1, 1]) f = smin(f, V.elipsoide(x - s * 12, y + 6, z - 97, 6.5, 6.5, 7.5), 3);
  for (const s of [-1, 1]) f = Math.max(f, -V.elipsoide(x - s * 5.5, y + 12, z - 100, 3, 3.2, 5.5));   // narinas
  return f;
}
// orelha no lado s (+1 esquerda, −1 direita): placa elíptica inclinada 25° para trás, hélice e concha
function orelha(x, y, z, s) {
  const A = [s * 70, 8, 4], b = [s * Math.sin(25 * Math.PI / 180), 0, -Math.cos(25 * Math.PI / 180)], n = [s * Math.cos(25 * Math.PI / 180), 0, Math.sin(25 * Math.PI / 180)];
  const p = [x - A[0], y - A[1], z - A[2]], u = p[0] * b[0] + p[2] * b[2] - 14, t = p[1], q = p[0] * n[0] + p[2] * n[2];
  let f = V.elipsoide(u, t, q - 2, 17, 31, 3.5);
  const e = (Math.hypot(u / 15, t / 29) - 1) * 15;
  f = smin(f, Math.hypot(e, q - 4) - 2.8, 1.5);
  f = Math.max(f, -V.elipsoide(u + 5, t + 4, q - 5.5, 7, 9, 4));
  return f;
}
function gerar(caso) {
  const semOrelha = caso === "rosto_sem_orelha";
  const fn = (x, y, z) => {
    let f = cabeca(x, y, z);
    if (semOrelha) f = smin(f, nariz(x, y, z), 2.5);
    else f = dif(f, V.elipsoide(x, y - 8, z - 90, 11, 16, 14), 3);   // cavidade da rinectomia
    f = smin(f, orelha(x, y, z, 1), 1.2);
    if (!semOrelha) f = smin(f, orelha(x, y, z, -1), 1.2);
    return f;
  };
  const g = V.criarGrade([-95, -90, -75], [95, 110, 120], 0.9);
  V.preencherGrade(g, fn);
  let m = V.extrairSuperficie(g);
  m = decimar(m, { tolerancia: 0.05 });
  // scan aberto: sem nuca, sem pescoço e sem o alto da cabeça; furo atrás da hélice esquerda
  const F = [];
  for (let t = 0; t < m.F.length; t += 3) {
    const c = [0, 1, 2].map((q) => (m.V[m.F[t] * 3 + q] + m.V[m.F[t + 1] * 3 + q] + m.V[m.F[t + 2] * 3 + q]) / 3);
    if (c[2] < -55 || c[1] < -70 || c[1] > 85) continue;
    if (semOrelha && Math.hypot(c[0] - 80, c[1] - 18, c[2] + 20) < 3) continue;
    F.push(m.F[t], m.F[t + 1], m.F[t + 2]);
  }
  m = { V: m.V, F: new Uint32Array(F) };
  // pontos: raio vindo de fora até a superfície (marcha no campo)
  const raio = (o, d) => { let t = 0, f = fn(o[0], o[1], o[2]); while (t < 400) { const p = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t]; f = fn(...p); if (f < 0.01) return p.map((v) => +v.toFixed(3)); t += Math.max(0.02, f * 0.5); } throw new Error("raio não achou a superfície"); };
  const frente = (x, y) => raio([x, y, 200], [0, 0, -1]);
  const pontos = { exD: frente(-47, 31), exE: frente(47, 31), enD: frente(-17, 31), enE: frente(17, 31), n: frente(0, 36), sn: frente(0, semOrelha ? -15 : -12) };
  const contorno = [];
  for (let i = 0; i < 14; i++) { const a = (i / 14) * 2 * Math.PI, zz = -9 + 20 * Math.cos(a), yy = 8 + 35 * Math.sin(a); contorno.push(raio([150, yy, zz], [-1, 0, 0])); }
  const buf = Buffer.from(stl(m, null, "EITA rosto sintetico " + caso));
  fs.writeFileSync(path.join(RAIZ, "testes/fixtures", caso + ".stl.gz"), zlib.gzipSync(buf, { level: 9 }));
  const info = { caso, descricao: semOrelha ? "falta a orelha direita; furo de scan atrás da hélice esquerda" : "rinectomia total", unidade: "mm", eixos: "x esquerda do paciente, y cima, z frente", triangulos: F.length / 3, pontos, contornoOrelhaEsquerda: contorno };
  fs.writeFileSync(path.join(RAIZ, "testes/fixtures", caso + ".json"), JSON.stringify(info, null, 1));
  console.log(`${caso}: ${F.length / 3} triângulos, ${(buf.length / 1e6).toFixed(1)} MB`);
}
gerar("rosto_sem_orelha");
gerar("rosto_sem_nariz");
