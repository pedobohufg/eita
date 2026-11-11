/* EITA! AFO · anatomia — referencial do tornozelo, pontos plantares, medidas e correção de postura. Puro (sem estado e
   sem DOM): roda no navegador e no Node. Movido de ui.js na E4c; só corrigirPostura() (deform na v0.14) mudou (devolve o aviso em vez de gravar no estado).
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
import { V3, GRAU, degrauSuave } from "./vetor.js";

export function centroideSecao(t, e, n, o = 3) {
  let l = 0,
    s = 0,
    v = 0,
    h = 0;
  for (let u = 0; u < t.length; u += 3) {
    const x = (t[u] - e[0]) * n[0] + (t[u + 1] - e[1]) * n[1] + (t[u + 2] - e[2]) * n[2];
    Math.abs(x) < o && ((l += t[u]), (s += t[u + 1]), (v += t[u + 2]), h++);
  }
  return h > 10 ? [l / h, s / h, v / h] : e.slice();
}
export function calcularReferencial(t, e) {
  if (!(t.ML && t.MM && t.PX)) return null;
  const n = V3.mid(t.ML, t.MM),
    o = V3.norm(V3.sub(t.PX, n)),
    l = centroideSecao(e, t.PX, o),
    s = V3.norm(V3.sub(l, n)),
    v = V3.norm(V3.rej(V3.sub(t.ML, t.MM), s));
  let h = V3.cross(s, v),
    u = "direito",
    x = 1;
  if (t.CA && t.M1 && t.M5) {
    const T = V3.sub(V3.mid(t.M1, t.M5), t.CA);
    V3.dot(h, T) < 0 && ((h = V3.mul(h, -1)), (u = "esquerdo"), (x = -1));
  } else u = "?";
  return { AJC: n, PC: l, X: v, Y: h, Z: s, side: u, h: x };
}
export function acrescentarPlantares(t, e, n) {
  if (!n || !t.CA || !t.M1 || !t.M5) return;
  const o = V3.norm(V3.sub(V3.mid(t.M1, t.M5), t.CA));
  let l = V3.norm(V3.cross(n.X, o));
  -V3.dot(l, n.Z) - V3.dot(l, n.Y) < 0 && (l = V3.mul(l, -1));
  for (const s of ["CA", "M1", "M5"]) {
    const v = t[s];
    let h = -1 / 0,
      u = -1;
    for (let x = 0; x < e.length; x += 3) {
      const T = e[x] - v[0],
        b = e[x + 1] - v[1],
        y = e[x + 2] - v[2];
      if (T * T + b * b + y * y > 625 || Math.abs(T * n.X[0] + b * n.X[1] + y * n.X[2]) > 12) continue;
      const L = T * l[0] + b * l[1] + y * l[2];
      L > h && ((h = L), (u = x));
    }
    t[s + "p"] = u >= 0 ? [e[u], e[u + 1], e[u + 2]] : v.slice();
  }
}
export const pontoPlantar = (t, e) => t[e + "p"] || t[e];
export function medir(t, e) {
  const n = {};
  if (!e) return n;
  if (((n.bimal = V3.len(V3.sub(t.ML, t.MM))), (n.legLen = V3.len(V3.sub(e.PC, e.AJC))), t.CA && t.M1 && t.M5)) {
    const o = pontoPlantar(t, "CA"),
      l = pontoPlantar(t, "M1"),
      s = pontoPlantar(t, "M5"),
      v = V3.mid(l, s),
      h = V3.sub(v, o),
      u = V3.norm(h);
    ((n.footLen = V3.len(h)),
      (n.forefoot = V3.len(V3.sub(t.M1, t.M5))),
      (n.sag = Math.atan2(V3.dot(h, e.Y), V3.dot(h, e.Z)) * GRAU),
      (n.pf = n.sag - 90));
    let x = V3.norm(V3.cross(V3.sub(s, o), V3.sub(l, o)));
    x = V3.mul(x, e.h);
    const T = V3.norm(V3.rej(e.Z, u)),
      b = V3.norm(V3.rej(x, u)),
      y = V3.norm(V3.rej(V3.rej(e.X, u), T));
    ((n.inv = Math.atan2(V3.dot(b, y), V3.dot(b, T)) * GRAU), (n.heelDrop = -V3.dot(V3.sub(o, e.AJC), e.Z)), (n.fh = u));
  }
  return n;
}
// → { V: vértices corrigidos, invSkipped: inversão medida acima de 35° (não corrigida) }; os pontos n são deslocados junto.
export function corrigirPostura(t, e, n, o, l, s, v, h) {
  const u = new Float64Array(t),
    x = t.length / 3,
    T = (Q, G, O, B) => {
      for (let Z = 0; Z < x; Z++) {
        const rt = [u[Z * 3], u[Z * 3 + 1], u[Z * 3 + 2]],
          D = B(rt);
        if (D <= 0) continue;
        const kt = V3.add(G, V3.rot(V3.sub(rt, G), Q, O * D));
        ((u[Z * 3] = kt[0]), (u[Z * 3 + 1] = kt[1]), (u[Z * 3 + 2] = kt[2]));
      }
      for (const Z in n) {
        const rt = B(n[Z]);
        rt > 0 && (n[Z] = V3.add(G, V3.rot(V3.sub(n[Z], G), Q, O * rt)));
      }
    },
    b = (Q) => V3.dot(V3.sub(Q, o.AJC), o.Z),
    y = (l.sag - s) / GRAU,
    L = (Q) => 1 - degrauSuave(-h / 2, h / 2, b(Q));
  if (Math.abs(y) > 1e-4) {
    const Q = (O) => {
        const B = {
            CA: V3.rot(V3.sub(pontoPlantar(n, "CA"), o.AJC), o.X, O),
            M1: V3.rot(V3.sub(pontoPlantar(n, "M1"), o.AJC), o.X, O),
            M5: V3.rot(V3.sub(pontoPlantar(n, "M5"), o.AJC), o.X, O),
          },
          Z = V3.sub(V3.mid(B.M1, B.M5), B.CA);
        return Math.abs(Math.atan2(V3.dot(Z, o.Y), V3.dot(Z, o.Z)) * GRAU - s);
      },
      G = Q(y) < Q(-y) ? y : -y;
    T(o.X, o.AJC, G, L);
  }
  const C = medir(n, o);
  const invSkipped = !(Math.abs(C.inv) <= 35);
  const W = invSkipped ? 0 : (C.inv - v) / GRAU,
    U = -C.heelDrop / 2,
    j = (Q) => 1 - degrauSuave(U - h / 2, U + h / 2, b(Q));
  if (Math.abs(W) > 1e-4) {
    const Q = C.fh,
      G = (B) => {
        const Z = { ...n };
        for (const rt of ["M1", "M5", "M1p", "M5p"])
          n[rt] && (Z[rt] = V3.add(pontoPlantar(n, "CA"), V3.rot(V3.sub(n[rt], pontoPlantar(n, "CA")), Q, B)));
        return Math.abs(medir(Z, o).inv - v);
      },
      O = G(W) < G(-W) ? W : -W;
    T(Q, pontoPlantar(n, "CA"), O, j);
  }
  return { V: u, invSkipped };
}
export function basePrincipal(t) {
  const e = t.length / 3,
    n = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
  for (let h = 0; h < t.length; h += 3)
    for (let u = 0; u < 3; u++) for (let x = 0; x < 3; x++) n[u][x] += (t[h + u] * t[h + x]) / e;
  let o = [1, 1, 1];
  for (let h = 0; h < 60; h++)
    o = V3.norm([
      n[0][0] * o[0] + n[0][1] * o[1] + n[0][2] * o[2],
      n[1][0] * o[0] + n[1][1] * o[1] + n[1][2] * o[2],
      n[2][0] * o[0] + n[2][1] * o[1] + n[2][2] * o[2],
    ]);
  const l = o;
  let s = V3.norm(V3.cross(l, Math.abs(l[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
  const v = V3.cross(l, s);
  return [s, v, l];
}
// Mudança de referencial: cena → anatômico (origem no centro do tornozelo; X lateral·medial, Y para a frente, Z para cima)
// e o inverso, a partir do referencial calculado por calcularReferencial (antes anatXf()/anatInv() liam S.frame).
export function paraAnatomico(t) {
  const e = V3.cross(t.Y, t.Z);
  return (n) => {
    const o = V3.sub(n, t.AJC);
    return [V3.dot(o, e), V3.dot(o, t.Y), V3.dot(o, t.Z)];
  };
}
export function deAnatomico(e, t) {
  const n = V3.cross(e.Y, e.Z);
  return V3.add(e.AJC, V3.add(V3.add(V3.mul(n, t[0]), V3.mul(e.Y, t[1])), V3.mul(e.Z, t[2])));
}
