/* EITA! NARIZ·ORELHA — interface (página modulos/nariz-orelha/index.html). Usa window.EITA (núcleo + EITA.narizOrelha)
   e o three.js r128 (CDN) para a cena 3D. Processamento em processamento.js; projeto em docs/E5-NARIZ-ORELHA.md.
   © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados. */
const E = window.EITA, UI = E.ui, NO = E.narizOrelha, T = window.THREE;
const CASCA = UI.criarCasca(), $ = CASCA.$, status = CASCA.status;
const esc = E.escaparHTML, fmt = NO.fmt;
const FORMATO_FICHA = "EITA! NARIZ·ORELHA ficha", FORMATO_BASE = "EITA! NARIZ·ORELHA base";
const FICHAS = E.criarArmazemFichas({ chave: "eitaNARIZORELHA.fichas.v1", formatoFicha: FORMATO_FICHA, formatoBase: FORMATO_BASE, versaoApp: NO.VERSAO, prefixoBase: "base_EITA_NARIZ_ORELHA", rotulo: "EITA! NARIZ·ORELHA" });
const ocupado = async (on, txt) => { CASCA.ocupado(on, txt); if (on) await UI.espera(30); };

// ------------------------------------------------------------------ estado
const S = {
  tipo: "orelha", lado: "D", scan: null, scanNome: "", fator: 1, pontos: {}, ponto: "exD", contorno: [], plano: null, residuo: null,
  modo: null, imas: [], modelo: null, modeloNome: "", paresM: [], paresR: [], modeloT: null,
  protese: null, molde: null, fichaId: null, pendente: null,
};
const CORES = { exD: "#2B5FD0", exE: "#C2281F", n: "#6B3FD6", sn: "#25774F", enD: "#5d86e6", enE: "#e2635a" };
const PARAM_NARIZ = ["comprimento", "largura", "projecao", "alturaPonta", "nasolabial", "dorso", "larguraPonta", "narina", "profNarina"];
const idNariz = (k) => "nz" + k[0].toUpperCase() + k.slice(1);

// ------------------------------------------------------------------ etapas
const ETP = UI.criarEtapas({
  etapas: [["s1", "Prótese e scan"], ["s2", "Pontos"], ["s3", "Forma"], ["s4", "Prótese"], ["s5", "Molde"], ["s6", "Arquivos"]],
  bloqueada: "Conclua as etapas anteriores primeiro.", status,
});
ETP.montar();
ETP.habilitarAte(1);
const IDS_ETAPAS = ["s1", "s2", "s3", "s4", "s5", "s6"];
// libera as n primeiras etapas e marca como feitas as anteriores (pelo mesmo registro que ETP.feito usa)
function avancar(n) { ETP.habilitarAte(n); IDS_ETAPAS.slice(0, n - 1).forEach((id) => ETP.feitas.add(id)); ETP.montar(); }

// ------------------------------------------------------------------ cena 3D
let render, cena, camera, controles, mScan, grpPontos, linhaContorno, mPlano, mProtese, grpMolde, mModelo, grpPares, grpImas;
const cena3d = $("cena");
function iniciar3D() {
  if (render) return true;
  if (!T) { status("A biblioteca 3D (three.js) não carregou: confira a conexão com a internet.", true); return false; }
  render = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  render.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); render.setClearColor(0xf7f5fc, 1);
  cena3d.appendChild(render.domElement);
  cena = new T.Scene();
  camera = new T.PerspectiveCamera(35, 1, 1, 5000);
  cena.add(new T.HemisphereLight(0xffffff, 0x8a7fa8, 0.75));
  const l1 = new T.DirectionalLight(0xffffff, 0.6); l1.position.set(1, 1.2, 1.5); camera.add(l1); cena.add(camera);
  controles = new T.OrbitControls(camera, render.domElement); controles.enableDamping = true; controles.dampingFactor = 0.12;
  grpPontos = new T.Group(); grpPares = new T.Group(); grpImas = new T.Group(); grpMolde = new T.Group();
  cena.add(grpPontos, grpPares, grpImas, grpMolde);
  new ResizeObserver(redimensionar).observe(cena3d);
  redimensionar(); ligarCliques();
  (function loop() { requestAnimationFrame(loop); controles.update(); render.render(cena, camera); })();
  return true;
}
function redimensionar() { if (!render) return; const w = cena3d.clientWidth || 600, h = cena3d.clientHeight || 400; render.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
function geometria(m) {
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.BufferAttribute(m.V instanceof Float32Array ? m.V : Float32Array.from(m.V), 3));
  g.setIndex(new T.BufferAttribute(m.F instanceof Uint32Array ? m.F : Uint32Array.from(m.F), 1));
  g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
const material = (cor, opac = 1) => new T.MeshStandardMaterial({ color: cor, roughness: 0.75, metalness: 0, side: T.DoubleSide, transparent: opac < 1, opacity: opac });
function limpar(obj) { if (!obj) return; if (obj.parent) obj.parent.remove(obj); obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
const raioMarca = () => (mScan ? Math.max(0.8, mScan.geometry.boundingSphere.radius / 110) : 1.5);
function esfera(p, cor, r = raioMarca()) { const m = new T.Mesh(new T.SphereGeometry(r, 14, 10), new T.MeshBasicMaterial({ color: cor })); m.position.set(p[0], p[1], p[2]); return m; }

// eixos do rosto (depois do plano): lateral (D→E), cima, frente
function eixos() {
  if (!S.plano || !S.pontos.n || !S.pontos.sn || !S.pontos.exD || !S.pontos.exE) return null;
  const R = NO.referencial({ tipo: "nariz", pontos: S.pontos, plano: S.plano });
  return { lat: S.plano.n, cima: R.V, frente: R.W, centro: S.pontos.n };
}
function enquadrar(dir) {
  if (!mScan) return;
  let c, r;
  if (dir === "molde" && grpMolde.children.length) { const sp = new T.Box3().setFromObject(grpMolde).getBoundingSphere(new T.Sphere()); c = sp.center; r = sp.radius * 1.05; }
  else {
    const bs = (mProtese && $("vProtese").checked && S.modo == null && dir !== "fit" ? mProtese : mScan).geometry.boundingSphere;
    c = mProtese && dir !== "fit" ? mProtese.geometry.boundingSphere.center : bs.center;
    r = dir === "fit" ? mScan.geometry.boundingSphere.radius : Math.max(45, bs.radius * 1.4);
  }
  const ex = eixos();
  let d = [0, 0, 1], up = [0, 1, 0];
  if (ex) {
    const neg = (v) => v.map((x) => -x);
    up = ex.cima;
    const tresQuartos = (S.tipo === "orelha" ? (S.lado === "D" ? neg(ex.lat) : ex.lat) : ex.frente).map((v, i) => v + 0.6 * ex.cima[i] + 0.5 * (S.tipo === "orelha" ? ex.frente[i] : ex.lat[i]));
    d = { frente: ex.frente, D: neg(ex.lat), E: ex.lat, cima: ex.cima, baixo: neg(ex.cima), fit: ex.frente, molde: tresQuartos.map((v) => v / Math.hypot(...tresQuartos)) }[dir] || ex.frente;
    if (dir === "cima" || dir === "baixo") up = ex.frente;
  } else d = { frente: [0, 0, 1], D: [-1, 0, 0], E: [1, 0, 0], cima: [0, 1, 0], baixo: [0, -1, 0], fit: [0, 0, 1] }[dir] || [0, 0, 1];
  const dist = r / Math.tan((camera.fov * Math.PI) / 360) * 1.05;
  camera.up.set(up[0], up[1], up[2]);
  camera.position.set(c.x + d[0] * dist, c.y + d[1] * dist, c.z + d[2] * dist);
  camera.near = Math.max(0.5, dist / 100); camera.far = dist * 20; camera.updateProjectionMatrix();
  controles.target.copy(c); controles.update();
}
document.querySelectorAll("#vistas3d [data-view]").forEach((b) => (b.onclick = () => enquadrar(b.dataset.view)));
function aplicarCamadas() {
  if (mScan) { mScan.visible = $("vRosto").checked; const o = +$("opacidade").value / 100; mScan.material.opacity = o; mScan.material.transparent = o < 1; mScan.material.depthWrite = o >= 1; }
  if (mProtese) mProtese.visible = $("vProtese").checked;
  grpMolde.visible = $("vMolde").checked;
  if (mModelo) mModelo.visible = $("vModelo").checked;
  [grpPontos, grpPares, grpImas].forEach((g) => (g.visible = $("vPontos").checked)); if (linhaContorno) linhaContorno.visible = $("vPontos").checked; if (mPlano) mPlano.visible = $("vPontos").checked;
  posicionarPecas();
}
["vRosto", "vProtese", "vMolde", "vModelo", "vPontos", "vExplodir", "opacidade"].forEach((id) => $(id).addEventListener("input", aplicarCamadas));

// ------------------------------------------------------------------ marcas
function desenharPontos() {
  if (!render) return;
  [...grpPontos.children].forEach(limpar);
  for (const [k, p] of Object.entries(S.pontos)) if (p) grpPontos.add(esfera(p, CORES[k] || "#6B3FD6"));
  limpar(linhaContorno); linhaContorno = null;
  if (S.contorno.length) {
    for (const p of S.contorno) grpPontos.add(esfera(p, "#d99a00", raioMarca() * 0.75));
    if (S.contorno.length > 1) { const g = new T.BufferGeometry().setFromPoints(S.contorno.concat(S.contorno.length > 2 ? [S.contorno[0]] : []).map((p) => new T.Vector3(...p))); linhaContorno = new T.Line(g, new T.LineBasicMaterial({ color: 0xd99a00, depthTest: false })); linhaContorno.renderOrder = 5; cena.add(linhaContorno); }
  }
  [...grpImas.children].forEach(limpar);
  for (const p of S.imas) grpImas.add(esfera(p, "#1f2937", raioMarca() * 0.9));
  [...grpPares.children].forEach(limpar);
  S.paresM.forEach((p, i) => grpPares.add(esfera(p, "#0075BE", raioMarca() * 0.8)));
  S.paresR.forEach((p, i) => grpPares.add(esfera(p, "#25774F", raioMarca() * 0.8)));
  aplicarCamadas();
}
function desenharPlano() {
  limpar(mPlano); mPlano = null;
  if (!S.plano || !mScan) return;
  const ex = eixos(); if (!ex) return;
  const r = mScan.geometry.boundingSphere.radius * 0.9, c = S.pontos.n, n = S.plano.n;
  const p0 = c.map((v, i) => v - (n[0] * c[0] + n[1] * c[1] + n[2] * c[2] - S.plano.d) * n[i]);
  const g = new T.BufferGeometry(), q = [];
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) q.push(...p0.map((v, i) => v + a * r * ex.frente[i] + b * r * ex.cima[i]));
  g.setAttribute("position", new T.BufferAttribute(new Float32Array(q), 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  mPlano = new T.Mesh(g, new T.MeshBasicMaterial({ color: 0x6b3fd6, transparent: true, opacity: 0.12, side: T.DoubleSide, depthWrite: false }));
  cena.add(mPlano);
}
function listarPontos() {
  const ks = Object.keys(NO.PONTOS);
  $("listaPontos").innerHTML = ks.map((k) => `<li data-k="${k}" class="${S.pontos[k] ? "ok" : ""}${S.ponto === k ? " cur" : ""}"><i style="background:${S.pontos[k] ? CORES[k] : "transparent"}"></i>${esc(NO.PONTOS[k])}</li>`).join("");
  $("listaPontos").querySelectorAll("li").forEach((li) => (li.onclick = () => { S.ponto = li.dataset.k; S.modo = "ponto"; listarPontos(); status(`Dê duplo clique no modelo para marcar: <b>${esc(NO.PONTOS[S.ponto])}</b>.`); }));
  const falta = NO.faltando(S.pontos), cont = S.tipo !== "orelha" || S.contorno.length >= 5;
  $("calcPlano").disabled = !!falta.length || !cont;
  $("whyPlano").textContent = falta.length ? `Faltam: ${falta.map((k) => NO.PONTOS[k].split(" (")[0].toLowerCase()).join(", ")}.` : !cont ? `Marque o contorno da orelha sadia (${S.contorno.length} de pelo menos 5 pontos).` : "";
  $("contornoInfo").innerHTML = `Pontos na pele em volta da orelha <b>${S.lado === "D" ? "esquerda" : "direita"}</b> (a sadia), rente à raiz e envolvendo toda a orelha vista de lado: 8 a 16 pontos, em volta, na ordem. Marcados: <b>${S.contorno.length}</b>.`;
}
function ligarCliques() {
  const el = render.domElement, rc = new T.Raycaster();
  el.addEventListener("dblclick", (e) => {
    if (!S.modo) return;
    const r = el.getBoundingClientRect();
    rc.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const alvo = S.modo === "parModelo" ? mModelo : mScan; if (!alvo) return;
    const h = rc.intersectObject(alvo, false)[0]; if (!h) return;
    const p = [h.point.x, h.point.y, h.point.z].map((v) => +v.toFixed(3));
    if (S.modo === "ponto") {
      S.pontos[S.ponto] = p;
      const prox = Object.keys(NO.PONTOS).find((k) => !S.pontos[k] && NO.PONTOS_OBRIGATORIOS.includes(k));
      status(`Marcado: <b>${esc(NO.PONTOS[S.ponto])}</b>.${prox ? ` Próximo: ${esc(NO.PONTOS[prox])} (duplo clique).` : S.tipo === "orelha" && S.contorno.length < 5 ? " Agora o contorno da orelha sadia." : " Toque em <b>Calcular o plano</b>."}`);
      if (prox) S.ponto = prox; else S.modo = null;
    } else if (S.modo === "contorno") { S.contorno.push(p); status(`Contorno: ${S.contorno.length} ponto(s). Continue em volta da orelha; toque em <b>Marcar contorno</b> de novo para terminar.`); }
    else if (S.modo === "ima") { S.imas.push(p); $("imasInfo").innerHTML = `${S.imas.length} ímã(s) marcado(s): cada um abre um nicho de ${fmt(+$("imaDiam").value, 1)} × ${fmt(+$("imaProf").value, 1)} mm na face interna.`; }
    else if (S.modo === "parModelo") { S.paresM.push(p); S.modo = "parRosto"; status(`Par ${S.paresM.length}: agora o mesmo ponto no <b>rosto</b> (duplo clique).`); }
    else if (S.modo === "parRosto") { S.paresR.push(p); S.modo = null; status(`Par ${S.paresR.length} marcado.${S.paresR.length >= 3 ? " Já dá para alinhar." : " Marque outro par (Ponto no modelo)."}`); listarPares(); }
    desenharPontos(); listarPontos(); invalidar("pontos");
  });
}
$("marcar").onclick = () => { if (!mScan) return; S.modo = "ponto"; status(`Dê duplo clique no modelo para marcar: <b>${esc(NO.PONTOS[S.ponto])}</b>.`); };
$("limparPontos").onclick = () => { S.pontos = {}; S.ponto = "exD"; S.plano = null; desenharPontos(); desenharPlano(); listarPontos(); invalidar("pontos"); };
$("marcarContorno").onclick = () => {
  if (S.modo === "contorno") { S.modo = null; $("marcarContorno").classList.remove("on"); listarPontos(); status(`Contorno com ${S.contorno.length} pontos.`); return; }
  S.modo = "contorno"; $("marcarContorno").classList.add("on"); enquadrar(S.lado === "D" ? "E" : "D");
  status("Dê duplo clique na pele em volta da orelha sadia, ponto a ponto, envolvendo a orelha inteira. Toque de novo em <b>Marcar contorno</b> para terminar.");
};
$("desfazerContorno").onclick = () => { S.contorno.pop(); desenharPontos(); listarPontos(); invalidar("pontos"); };
$("limparContorno").onclick = () => { S.contorno = []; desenharPontos(); listarPontos(); invalidar("pontos"); };

// ------------------------------------------------------------------ etapa 1: tipo e scan
function aplicarTipo() {
  document.querySelectorAll("#tipoSeg button").forEach((b) => b.classList.toggle("on", b.dataset.tipo === S.tipo));
  $("ladoBox").hidden = S.tipo !== "orelha"; $("contornoBox").hidden = S.tipo !== "orelha";
  const fontes = S.tipo === "orelha" ? [["espelho", "Espelho da orelha sadia"], ["modelo", "Modelo importado (alinhado por pontos)"]] : [["parametrico", "Nariz paramétrico"], ["modelo", "Modelo importado (alinhado por pontos)"]];
  const atual = $("fonte").value;
  $("fonte").innerHTML = fontes.map(([v, t]) => `<option value="${v}">${t}</option>`).join("");
  if (fontes.some((f) => f[0] === atual)) $("fonte").value = atual;
  aplicarFonte();
  const par = NO.PARAMETROS_PADRAO[S.tipo];
  $("pAba").value = par.aba; $("pBorda").value = par.bordaEsp; $("pBase").value = par.baseEsp; $("pOco").checked = par.oco; $("pParede").value = par.parede; $("paredeBox").hidden = !par.oco;
  $("ajInfo").textContent = S.tipo === "orelha" ? 'Deslocamentos no plano do lado da cabeça ("frente/trás" e "cima/baixo") e para fora da pele; giro em torno do eixo lateral.' : 'No nariz, o primeiro deslocamento é para os lados; giro em torno do eixo de frente.';
  listarPontos();
}
function aplicarFonte() {
  const f = $("fonte").value;
  $("paramNariz").hidden = f !== "parametrico"; $("modeloBox").hidden = f !== "modelo";
}
document.querySelectorAll("#tipoSeg button").forEach((b) => (b.onclick = () => { S.tipo = b.dataset.tipo; aplicarTipo(); invalidar("tipo"); }));
$("lado").onchange = () => { S.lado = $("lado").value; listarPontos(); invalidar("tipo"); };
$("fonte").onchange = () => { aplicarFonte(); invalidar("forma"); };
$("pOco").onchange = () => { $("paredeBox").hidden = !$("pOco").checked; };
UI.soltavel($("scanDrop"), $("scanFile"), abrirScan);
async function abrirScan(arq) {
  await ocupado(true, "Lendo o scan…");
  try {
    const buf = await arq.arrayBuffer(), sopa = E.lerMalha(arq.name, buf);
    const u = $("unidade").value, f = u === "auto" ? E.fatorProvavel(sopa) : +u;
    if (f !== 1) for (let i = 0; i < sopa.length; i++) sopa[i] *= f;
    await ocupado(true, "Soldando a malha…");
    let m = E.soldar(sopa, 1e-4), furos = null;
    if ($("furos").checked) { const r = E.fecharFuros(m, 40); m = { V: r.V, F: r.F }; furos = r; }
    S.scan = m; S.scanNome = arq.name; S.fator = f; S.protese = null; S.molde = null;
    if (!iniciar3D()) { await ocupado(false); return; }
    limpar(mScan); mScan = new T.Mesh(geometria({ V: Float32Array.from(m.V), F: m.F }), material(0xe9cdb8)); cena.add(mScan);
    limpar(mProtese); mProtese = null; [...grpMolde.children].forEach(limpar);
    $("vazio3d").hidden = true;
    const bs = mScan.geometry.boundingSphere;
    $("scanInfo").innerHTML = `<b>${esc(arq.name)}</b>: ${(m.F.length / 3).toLocaleString("pt-BR")} triângulos, cerca de ${fmt(bs.radius * 2, 0)} mm${f !== 1 ? ` (convertido ×${f} para mm)` : ""}.${furos ? ` Furos fechados: ${furos.fechados}${furos.abertos ? `; bordas abertas maiores: ${furos.abertos}` : ""}.` : ""}`;
    avancar(2);
    if (S.pendente) { aplicarProjeto(S.pendente); S.pendente = null; }
    desenharPontos(); desenharPlano(); listarPontos(); enquadrar("frente");
    ETP.abrir("s2"); S.modo = S.plano ? null : "ponto";
    if (!S.plano) { S.ponto = Object.keys(NO.PONTOS).find((k) => !S.pontos[k]) || "exD"; listarPontos(); status(`Scan aberto. Dê duplo clique no modelo para marcar: <b>${esc(NO.PONTOS[S.ponto])}</b>.`); }
    else status("Scan aberto com os pontos da ficha. Confira e siga para a forma.");
    autoSalvar();
  } catch (e) { status("Não foi possível ler o scan: " + esc(e.message), true); }
  await ocupado(false);
}

// ------------------------------------------------------------------ etapa 2: plano
function excluirRegioes() {
  if (S.tipo === "orelha") {
    const c = S.contorno.reduce((s, p) => s.map((v, i) => v + p[i] / S.contorno.length), [0, 0, 0]);
    const r = Math.max(...S.contorno.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]))) + 15;
    return [{ c, r }];
  }
  const L = Math.hypot(...S.pontos.n.map((v, i) => v - S.pontos.sn[i]));
  return [{ c: S.pontos.n.map((v, i) => (v + S.pontos.sn[i]) / 2), r: 0.8 * L }];
}
$("calcPlano").onclick = async () => {
  await ocupado(true, "Calculando o plano sagital…");
  try {
    let P = NO.planoSagital(S.pontos), txt = "";
    if ($("refinar").checked) {
      await ocupado(true, "Refinando pela simetria do rosto…");
      const ex = Math.hypot(...S.pontos.exD.map((v, i) => v - S.pontos.exE[i]));
      const r = NO.refinarPlano(S.scan, P, { centro: S.pontos.n, raio: 1.6 * ex, excluir: excluirRegioes() });
      const ang = (Math.acos(Math.min(1, Math.abs(r.plano.n[0] * P.n[0] + r.plano.n[1] * P.n[1] + r.plano.n[2] * P.n[2]))) * 180) / Math.PI;
      if (r.residuo != null) { txt = ` Refinado pela simetria: giro de ${fmt(ang, 1)}°, ${r.iteracoes} iterações, resíduo ${fmt(r.residuo, 2)} mm.`; if (ang < 8) P = r.plano; else txt = ` O refinamento mudaria o plano em ${fmt(ang, 1)}° e foi descartado: confira os pontos.`; S.residuo = r.residuo; }
    }
    S.plano = P; desenharPlano();
    $("planoInfo").innerHTML = `Plano calculado.${txt}`;
    avancar(4); preencherNarizPadrao(false); ETP.abrir("s3");
    status("Plano sagital pronto." + txt + " Confira a forma e gere a prótese (etapa 4).");
    autoSalvar();
  } catch (e) { status("Erro no plano: " + esc(e.message), true); }
  await ocupado(false);
};

// ------------------------------------------------------------------ etapa 3: forma
function preencherNarizPadrao(forcar) {
  if (!S.pontos.n || !S.pontos.exD) return;
  const p = NO.narizPadrao(S.pontos);
  for (const k of PARAM_NARIZ) { const el = $(idNariz(k)); if (forcar || el.value === "") el.value = k === "narina" ? Math.round(p[k] * 100) : p[k]; }
}
$("nzPadrao").onclick = () => { preencherNarizPadrao(true); invalidar("forma"); status("Parâmetros do nariz recalculados pelo rosto."); };
function lerNariz() { const o = {}; for (const k of PARAM_NARIZ) { const v = parseFloat($(idNariz(k)).value); if (Number.isFinite(v)) o[k] = k === "narina" ? v / 100 : v; } return o; }
const lerAjuste = () => ({ du: +$("ajU").value || 0, dv: +$("ajV").value || 0, dw: +$("ajW").value || 0, giro: +$("ajGiro").value || 0, escala: +$("ajEscala").value || 100 });
UI.soltavel($("modeloDrop"), $("modeloFile"), async (arq) => {
  await ocupado(true, "Lendo o modelo…");
  try {
    const sopa = E.lerMalha(arq.name, await arq.arrayBuffer()), u = $("unidade").value, f = u === "auto" ? E.fatorProvavel(sopa) : +u;
    if (f !== 1) for (let i = 0; i < sopa.length; i++) sopa[i] *= f;
    S.modelo = E.soldar(sopa, 1e-4); S.modeloNome = arq.name; S.paresM = []; S.paresR = []; S.modeloT = null;
    // posição inicial: centro do modelo na região do defeito, para facilitar a marcação
    let c = [0, 0, 0]; const nv = S.modelo.V.length / 3; for (let i = 0; i < S.modelo.V.length; i += 3) c = c.map((v, q) => v + S.modelo.V[i + q] / nv);
    const alvo = regiaoDefeito(), d = alvo.map((v, i) => v - c[i]);
    S.modeloT = { R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], s: 1, t: d };
    mostrarModelo(); listarPares();
    status(`Modelo <b>${esc(arq.name)}</b> aberto (${(S.modelo.F.length / 3).toLocaleString("pt-BR")} triângulos), colocado perto da região do defeito. Marque os pares de pontos.`);
  } catch (e) { status("Não foi possível ler o modelo: " + esc(e.message), true); }
  await ocupado(false);
});
function regiaoDefeito() {
  if (S.tipo === "nariz") return S.pontos.n.map((v, i) => (v + S.pontos.sn[i]) / 2 + (eixos() ? eixos().frente[i] * 15 : 0));
  const c = S.contorno.length ? S.contorno.reduce((s, p) => s.map((v, i) => v + p[i] / S.contorno.length), [0, 0, 0]) : S.pontos.n;
  return S.plano ? NO.espelhar(S.plano, c) : c;
}
function modeloNaCena() { return S.modelo && S.modeloT ? NO.transformarModelo(S.modelo, S.modeloT) : null; }
function mostrarModelo() {
  limpar(mModelo); mModelo = null;
  const m = modeloNaCena(); if (!m) return;
  mModelo = new T.Mesh(geometria({ V: Float32Array.from(m.V), F: m.F }), material(0x8fb3e8, 0.85)); cena.add(mModelo); aplicarCamadas();
}
function listarPares() {
  $("pares").innerHTML = S.paresM.map((p, i) => `<div>Par ${i + 1}: modelo ✓ · rosto ${S.paresR[i] ? "✓" : "…"}</div>`).join("");
  $("alinharModelo").disabled = Math.min(S.paresM.length, S.paresR.length) < 3;
}
$("parModelo").onclick = () => { if (!mModelo) { status("Abra o modelo primeiro.", true); return; } if (S.paresM.length > S.paresR.length) S.paresM.pop(); S.modo = "parModelo"; status(`Par ${S.paresM.length + 1}: duplo clique no ponto do <b>modelo</b>.`); desenharPontos(); };
$("parRosto").onclick = () => { if (S.paresR.length >= S.paresM.length) { status("Marque primeiro o ponto no modelo.", true); return; } S.modo = "parRosto"; status("Duplo clique no mesmo ponto no <b>rosto</b>."); };
$("parLimpar").onclick = () => { S.paresM = []; S.paresR = []; desenharPontos(); listarPares(); };
$("alinharModelo").onclick = () => {
  try {
    const n = Math.min(S.paresM.length, S.paresR.length);
    // os pontos do modelo foram marcados na posição atual da cena: compõe com a transformação atual
    const inv = (p) => { const T0 = S.modeloT, q = p.map((v, i) => v - T0.t[i]); return [0, 1, 2].map((j) => (T0.R[0][j] * q[0] + T0.R[1][j] * q[1] + T0.R[2][j] * q[2]) / T0.s); };
    const orig = S.paresM.slice(0, n).map(inv), r = NO.alinharModelo(orig, S.paresR.slice(0, n), true);
    S.modeloT = r.T; S.paresM = S.paresM.slice(0, n).map((p) => E.aplicarTransformacao(r.T, inv(p)));
    mostrarModelo(); desenharPontos(); invalidar("forma");
    status(`Modelo alinhado: erro médio de ${fmt(r.erro, 2)} mm nos ${n} pares, escala ${fmt(r.T.s * 100, 1)} %.${r.erro > 3 ? " Erro alto: confira os pares." : ""}`, r.erro > 3);
  } catch (e) { status("Não foi possível alinhar: " + esc(e.message), true); }
};
["ajU", "ajV", "ajW", "ajGiro", "ajEscala"].concat(PARAM_NARIZ.map(idNariz)).forEach((id) => $(id).addEventListener("change", () => invalidar("forma")));

// ------------------------------------------------------------------ etapa 4: prótese
function lerParametros() {
  return { passo: +$("passo").value || 0.5, aba: +$("pAba").value, bordaEsp: +$("pBorda").value, baseEsp: +$("pBase").value, oco: $("pOco").checked, parede: +$("pParede").value };
}
function lerMolde() {
  return { parede: +$("mParede").value, base: +$("mBase").value, topo: +$("mTopo").value, dividir: $("mDividir").checked, anguloDivisao: +$("mAngulo").value, deslocDivisao: +$("mDesloc").value || 0, chaveRaio: +$("mChave").value, folga: +$("mFolga").value, canal: +$("mCanal").value, respiros: +$("mRespiros").value, respiro: +$("mRespiro").value };
}
function escreverMolde(o) {
  const v = Object.assign({}, NO.MOLDE_PADRAO, o || {});
  $("mParede").value = v.parede; $("mBase").value = v.base; $("mTopo").value = v.topo; $("mDividir").checked = v.dividir; $("mAngulo").value = v.anguloDivisao; $("mDesloc").value = v.deslocDivisao;
  $("mChave").value = v.chaveRaio; $("mFolga").value = v.folga; $("mCanal").value = v.canal; $("mRespiros").value = v.respiros; $("mRespiro").value = v.respiro; aplicarDivisao();
}
const aplicarDivisao = () => { $("angBox").hidden = $("desBox").hidden = !$("mDividir").checked; };
$("mDividir").onchange = aplicarDivisao;
$("marcarIma").onclick = () => {
  if (S.modo === "ima") { S.modo = null; $("marcarIma").classList.remove("on"); status(`${S.imas.length} ímã(s) marcado(s).`); return; }
  S.modo = "ima"; $("marcarIma").classList.add("on"); status("Dê duplo clique na pele (ou no pilar do implante) onde vai cada ímã. Toque de novo em <b>Marcar ímãs</b> para terminar.");
};
$("limparImas").onclick = () => { S.imas = []; $("imasInfo").textContent = "Sem ímãs marcados, a prótese sai para adesivo."; desenharPontos(); invalidar("forma"); };
function doadora() {
  const f = $("fonte").value, d = { tipo: f, ajuste: lerAjuste() };
  if (f === "parametrico") d.nariz = lerNariz();
  if (f === "modelo") { const m = modeloNaCena(); if (!m) throw new Error("abra e alinhe o modelo importado (etapa 3)"); d.modelo = m; }
  return d;
}
$("gerarProtese").onclick = async () => {
  if (!S.plano) { status("Calcule o plano (etapa 2) antes.", true); return; }
  S.modo = null;
  await ocupado(true, "Gerando a prótese…");
  try {
    const t0 = performance.now();
    S.protese = await NO.gerarProtese({
      tipo: S.tipo, lado: S.lado, malha: S.scan, pontos: S.pontos, plano: S.plano, contorno: S.contorno, doadora: doadora(),
      imas: S.imas.map((p) => ({ p })), imaDiam: +$("imaDiam").value, imaProf: +$("imaProf").value, parametros: lerParametros(), molde: lerMolde(),
      aoProgresso: async (t) => { CASCA.ocupado(true, t); await UI.espera(15); },
    });
    S.molde = null; [...grpMolde.children].forEach(limpar); $("medidasMolde").innerHTML = ""; $("avisosMolde").innerHTML = "";
    $("gerarProtese").textContent = "Gerar a prótese";
    mostrarProtese(); mostrarMedidas(); avancar(6);
    $("vProtese").checked = true; aplicarCamadas(); enquadrar("frente");
    status(`Prótese gerada em ${fmt((performance.now() - t0) / 1000, 1)} s: ${fmt(S.protese.medidas.volume, 1)} mL. Confira de vários ângulos; depois gere o molde (etapa 5).`);
    autoSalvar(); checar();
  } catch (e) { console.error(e); status("Não foi possível gerar a prótese: " + esc(e.message), true); }
  await ocupado(false);
};
function mostrarProtese() {
  limpar(mProtese); mProtese = null;
  if (!S.protese) return;
  const m = NO.malhaParaScan(S.protese.malha, S.protese.R);
  mProtese = new T.Mesh(geometria(m), material(0xd98c6e)); cena.add(mProtese);
}
function mostrarMedidas() {
  const m = S.protese.medidas, L = [];
  if (S.tipo === "orelha") L.push(["Altura (com a aba)", fmt(m.altura, 1) + " mm"], ["Largura (com a aba)", fmt(m.largura, 1) + " mm"], ["Projeção máxima sobre a pele", fmt(m.projecao, 1) + " mm"]);
  else L.push(["Comprimento n–sn (parâmetro)", fmt(m.comprimentoNariz, 1) + " mm"], ["Largura alar (parâmetro)", fmt(m.larguraNariz, 1) + " mm"], ["Projeção da ponta (parâmetro)", fmt(m.projecaoPonta, 1) + " mm"], ["Ângulo nasolabial", fmt(m.nasolabial, 0) + "°"], ["Extensão com a aba (alt. × larg.)", `${fmt(m.altura, 0)} × ${fmt(m.largura, 0)} mm`]);
  L.push(["Volume de silicone", fmt(m.volume, 1) + " mL"], ["Massa (silicone ≈ 1,1 g/mL)", fmt(m.massa, 1) + " g"], ["Área de contato com a pele", fmt(m.areaBase / 100, 1) + " cm²"], ["Borda / raiz da aba", `${fmt(S.protese.parametros.bordaEsp, 2)} / ${fmt(S.protese.parametros.baseEsp, 1)} mm`], ["Malha", `${m.triangulos.toLocaleString("pt-BR")} triângulos${m.fechada ? ", fechada" : ", ABERTA"}`]);
  $("medidas").innerHTML = L.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("");
  $("avisosProtese").innerHTML = S.protese.avisos.map((a) => `<li class="${a.n === "alerta" ? "alerta" : a.n === "info" ? "ok" : ""}">${esc(a.t)}</li>`).join("") + `<li class="ok">${esc(NO.REFERENCIAS[S.tipo])}</li>`;
}

// ------------------------------------------------------------------ etapa 5: molde
const CORES_PECAS = { base: 0x7aa2e3, "externa-A": 0x8fcf9f, "externa-B": 0xe8cf7a, externa: 0x8fcf9f };
$("gerarMolde").onclick = async () => {
  if (!S.protese) return;
  await ocupado(true, "Gerando o molde…");
  try {
    const t0 = performance.now();
    S.molde = await NO.gerarMolde(S.protese, Object.assign(lerMolde(), { aoProgresso: async (t) => { CASCA.ocupado(true, t); await UI.espera(15); } }));
    [...grpMolde.children].forEach(limpar);
    for (const p of S.molde.pecas) { const m = new T.Mesh(geometria(NO.malhaParaScan(p.malha, S.protese.R)), material(CORES_PECAS[p.nome] || 0xcccccc)); m.userData.nome = p.nome; grpMolde.add(m); }
    $("vMolde").checked = true; $("vExplodir").checked = true; aplicarCamadas();
    const B = S.molde.bloco;
    $("medidasMolde").innerHTML = [["Bloco (larg. × alt. × prof.)", `${fmt(B.u1 - B.u0, 0)} × ${fmt(B.v1 - B.v0, 0)} × ${fmt(B.w1 - B.w0, 0)} mm`]].concat(S.molde.pecas.map((p) => [`Peça ${p.nome}`, `${fmt(p.volume, 1)} mL · ${p.triangulos.toLocaleString("pt-BR")} tri.${p.fechada ? "" : " ABERTA"}`]), [["Retenções (silicone flexiona)", fmt(S.molde.retencoes, 2) + " mL"], ["Canal / respiros", `${S.molde.canais.filter((c) => c.tipo === "injeção").length} / ${S.molde.canais.filter((c) => c.tipo === "respiro").length}`]]).map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("");
    $("avisosMolde").innerHTML = S.molde.avisos.map((a) => `<li class="${a.n === "alerta" ? "alerta" : a.n === "info" ? "ok" : ""}">${esc(a.t)}</li>`).join("");
    ETP.feito("s5"); enquadrar("fit");
    status(`Molde gerado em ${fmt((performance.now() - t0) / 1000, 1)} s: ${S.molde.pecas.length} peças. As peças aparecem afastadas na direção de retirada (desmarque "Separar peças" para vê-las montadas). Baixe os arquivos na etapa 6.`);
    autoSalvar(); checar();
  } catch (e) { console.error(e); status("Não foi possível gerar o molde: " + esc(e.message), true); }
  await ocupado(false);
};
function posicionarPecas() {
  if (!S.protese || !grpMolde.children.length) return;
  const W = S.protese.R.W, sep = $("vExplodir").checked ? 1 : 0, alt = S.molde ? S.molde.bloco.w1 - S.molde.bloco.w0 : 30;
  for (const m of grpMolde.children) {
    const k = m.userData.nome === "base" ? -0.6 : m.userData.nome === "externa-B" ? 1.25 : 0.9;
    m.position.set(W[0] * k * alt * sep, W[1] * k * alt * sep, W[2] * k * alt * sep);
    if (m.userData.nome === "externa-B" && sep && S.molde) { const a = (S.molde.opcoes.anguloDivisao * Math.PI) / 180, R = S.protese.R, d = [0, 1, 2].map((i) => Math.cos(a) * R.U[i] + Math.sin(a) * R.V[i]); m.position.add(new T.Vector3(...d.map((v) => v * 12))); }
  }
}

// ------------------------------------------------------------------ invalidação (mudou algo antes: a prótese e o molde ficam velhos)
function invalidar(oque) {
  if (!S.protese && !S.molde) return;
  if (oque === "tipo" || oque === "pontos") { if (S.plano && oque === "pontos") { /* o plano continua até recalcular */ } }
  $("gerarProtese").textContent = "Gerar a prótese de novo";
}

// ------------------------------------------------------------------ checagens, arquivos e relatório
function checar() {
  const P = lerPaciente();
  const ch = NO.checagens({ tipo: S.tipo, medidas: S.protese && S.protese.medidas, ficha: { radioterapia: P.pRadio, alergias: P.pAlerg }, protese: S.protese, molde: S.molde });
  $("checagens").innerHTML = ch.length ? ch.map((a) => `<li class="${a.n === "alerta" ? "alerta" : a.n === "info" ? "ok" : ""}">${esc(a.t)}</li>`).join("") : '<li class="ok">Nenhum problema encontrado pelas verificações automáticas.</li>';
  return ch;
}
function prefixo() { const P = lerPaciente(); return E.nomeArquivo((E.codigoPaciente(P.pId, P.pName) || "paciente") + "_" + (S.tipo === "nariz" ? "nariz" : "orelha_" + S.lado)); }
// peças do molde para imprimir: referencial local, com a base apoiada em z = 0
function malhaImpressao(m) { const w0 = S.molde ? S.molde.bloco.w0 : 0; return { V: Float32Array.from(m.V, (v, i) => (i % 3 === 2 ? v - w0 : v)), F: m.F }; }
async function pacote() {
  const pre = prefixo(), arqs = {};
  arqs[`${pre}_protese_no_scan.stl`] = E.stl(NO.malhaParaScan(S.protese.malha, S.protese.R), null, "EITA NARIZ-ORELHA protese (referencial do scan)");
  arqs[`${pre}_protese_impressao.stl`] = E.stl(malhaImpressao(S.protese.malha), null, "EITA NARIZ-ORELHA protese (prova)");
  if (S.molde) for (const p of S.molde.pecas) arqs[`${pre}_molde_${p.nome}.stl`] = E.stl(malhaImpressao(p.malha), null, "EITA NARIZ-ORELHA molde " + p.nome);
  arqs[`${pre}_relatorio.pdf`] = await gerarPDF();
  arqs[`${pre}_ficha.json`] = JSON.stringify(coletar(), null, 1);
  return E.zip(arqs);
}
$("baixarPacote").onclick = async () => {
  if (!S.protese) return;
  await ocupado(true, "Montando o pacote…");
  try { const z = await pacote(); await ocupado(false); await CASCA.salvar(prefixo() + "_EITA_nariz_orelha.zip", z); }
  catch (e) { console.error(e); await ocupado(false); status("Não foi possível montar o pacote: " + esc(e.message), true); }
};
$("baixarProtese").onclick = async () => {
  if (!S.protese) return;
  const z = await E.embalarParaDownload(prefixo() + "_protese_no_scan.stl", E.stl(NO.malhaParaScan(S.protese.malha, S.protese.R), null, "EITA NARIZ-ORELHA protese"));
  await CASCA.salvar(z.nome, z.dados);
};
$("baixarPdf").onclick = async () => {
  if (!S.protese) return;
  await ocupado(true, "Montando o relatório…");
  try { const pdf = await gerarPDF(); await ocupado(false); await CASCA.salvar(prefixo() + "_relatorio.pdf", new Blob([pdf], { type: "application/pdf" })); }
  catch (e) { console.error(e); await ocupado(false); status("Não foi possível montar o relatório: " + esc(e.message), true); }
};
// captura da cena numa vista, como JPEG para o PDF
async function capturar(vista, camadas) {
  const antes = { r: $("vRosto").checked, p: $("vProtese").checked, m: $("vMolde").checked, x: $("vPontos").checked, e: $("vExplodir").checked, cam: camera.position.clone(), up: camera.up.clone(), alvo: controles.target.clone() };
  $("vRosto").checked = camadas.rosto; $("vProtese").checked = camadas.protese; $("vMolde").checked = camadas.molde; $("vPontos").checked = false; $("vExplodir").checked = !!camadas.explodir; aplicarCamadas();
  enquadrar(vista);
  controles.update(); render.render(cena, camera); await UI.espera(20); render.render(cena, camera);
  const c = document.createElement("canvas"), w = 640, h = Math.round((w * render.domElement.height) / render.domElement.width);
  c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(render.domElement, 0, 0, w, h);
  $("vRosto").checked = antes.r; $("vProtese").checked = antes.p; $("vMolde").checked = antes.m; $("vPontos").checked = antes.x; $("vExplodir").checked = antes.e; aplicarCamadas();
  camera.position.copy(antes.cam); camera.up.copy(antes.up); controles.target.copy(antes.alvo); controles.update();
  return UI.jpegDe(c, 0.86);
}
async function gerarPDF() {
  const P = lerPaciente(), agora = new Date(), imgs = [], pr = S.protese, m = pr.medidas;
  const lg = await UI.logoJpeg("assets/eita-nariz-orelha-simbolo.png"); if (lg) imgs.push(Object.assign({ name: "Lg" }, lg));
  const ld = S.lado === "D" ? "D" : "E", nomeLado = { D: "lateral direita", E: "lateral esquerda" };
  const vistas = S.tipo === "orelha"
    ? [[ld, { rosto: true, protese: true }, "Prótese sobre o scan, vista " + nomeLado[ld]], ["frente", { rosto: true, protese: true }, "Prótese sobre o scan, vista de frente"], [ld, { rosto: false, protese: true }, "Prótese isolada, vista " + nomeLado[ld]]]
    : [["frente", { rosto: true, protese: true }, "Prótese sobre o scan, vista de frente"], ["D", { rosto: true, protese: true }, "Prótese sobre o scan, perfil direito"], ["baixo", { rosto: false, protese: true }, "Prótese isolada, vista de baixo (base e narinas)"]];
  if (S.molde) vistas.push(["molde", { rosto: false, protese: false, molde: true, explodir: true }, "Molde: peças afastadas na direção de retirada"]);
  const leg = vistas.map((v) => v[2]);
  for (let i = 0; i < vistas.length; i++) { const j = await capturar(vistas[i][0], vistas[i][1]); imgs.push(Object.assign({ name: "V" + i }, j)); }
  const R = E.criarRelatorioPDF({ app: ["EITA!", "NARIZ·ORELHA"], subtitulo: "Projeto de prótese " + (S.tipo === "nariz" ? "nasal" : "auricular") + " e molde · Lab.EITA / UFG", logo: lg ? "Lg" : null,
    dataTexto: agora.toLocaleDateString("pt-BR") + " " + agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), pacienteTexto: P.pName || P.pId || "paciente não identificado" });
  const SEXO = { F: "feminino", M: "masculino", O: "outro" }, ETIO = { congenita: "congênita", oncologica: "oncológica", trauma: "trauma", queimadura: "queimadura", outra: "outra" }, RET = { adesivo: "adesivo", imas: "ímãs / implantes", oculos: "armação de óculos", anatomica: "retenção anatômica" };
  R.secao("Paciente");
  R.campo(36, 200, "Nome", P.pName); R.campo(236, 100, "Prontuário / código", P.pId); R.campo(336, 80, "Nascimento", P.pBirth ? P.pBirth.split("-").reverse().join("/") : ""); R.campo(416, 60, "Sexo", SEXO[P.pSex]); R.campo(476, 83, "Etiologia", ETIO[P.pEtio]); R.y -= 25;
  R.campo(36, 120, "Radioterapia na região", P.pRadio === "sim" ? "sim" : P.pRadio === "nao" ? "não" : ""); R.campo(156, 120, "Retenção", S.imas.length ? `ímãs (${S.imas.length})` : RET[P.pRet]); R.campo(276, 140, "Alergias", P.pAlerg); R.campo(416, 143, "Profissional", P.pProf); R.y -= 25;
  if (P.pNotes) { R.campo(36, 523, "Observações", P.pNotes.replace(/\s+/g, " ")); R.y -= 25; }
  const doa = { espelho: "espelho da orelha sadia", parametrico: "nariz paramétrico", modelo: "modelo importado (" + (S.modeloNome || "") + ")" }[$("fonte").value];
  const par = pr.parametros, aj = lerAjuste();
  const l1 = [["Tipo", S.tipo === "nariz" ? "prótese nasal" : "prótese auricular " + (S.lado === "D" ? "direita" : "esquerda")], ["Forma", doa], ["Scan", S.scanNome], ["Plano sagital", S.residuo != null ? `refinado (resíduo ${fmt(S.residuo, 2)} mm)` : "pelos pontos"], ["Ajuste (mm, °, %)", `${fmt(aj.du, 1)} / ${fmt(aj.dv, 1)} / ${fmt(aj.dw, 1)} · ${fmt(aj.giro, 0)}° · ${fmt(aj.escala, 0)} %`], ["Resolução", fmt(par.passo, 1) + " mm"], ["Aba: largura", fmt(par.aba, 1) + " mm"], ["Aba: borda / raiz", `${fmt(par.bordaEsp, 2)} / ${fmt(par.baseEsp, 1)} mm`], ["Oca", par.oco ? `sim, parede ${fmt(par.parede, 1)} mm` : "não"], ["Ímãs", S.imas.length ? `${S.imas.length} (nicho ${fmt(+$("imaDiam").value, 1)} × ${fmt(+$("imaProf").value, 1)} mm)` : "—"]];
  const l2 = [["Volume de silicone", fmt(m.volume, 1) + " mL"], ["Massa (≈ 1,1 g/mL)", fmt(m.massa, 1) + " g"], ["Altura × largura (com aba)", `${fmt(m.altura, 1)} × ${fmt(m.largura, 1)} mm`], ["Projeção máxima", fmt(m.projecao, 1) + " mm"], ["Área de contato", fmt(m.areaBase / 100, 1) + " cm2"]];
  if (S.tipo === "nariz" && pr.nariz) l2.push(["Comprimento n–sn", fmt(pr.nariz.comprimento, 1) + " mm"], ["Largura alar", fmt(pr.nariz.largura, 1) + " mm"], ["Projeção da ponta", fmt(pr.nariz.projecao, 1) + " mm"], ["Ângulo nasolabial", fmt(pr.nariz.nasolabial, 0) + "°"]);
  R.par("Projeto", l1, "Prótese", l2);
  // imagens
  const larg = 255, alt = (j) => (larg * j.h) / j.w;
  const vs = imgs.filter((i) => /^V/.test(i.name));
  for (let i = 0; i < vs.length; i += 2) {
    const h = Math.max(alt(vs[i]), vs[i + 1] ? alt(vs[i + 1]) : 0); if (R.y - h - 24 < 50) R.novaPagina();
    R.pg.image(vs[i].name, 36, R.y - h, larg, alt(vs[i])); R.pg.text(36, R.y - h - 11, 7.6, leg[i], false, E.CORES_PDF.sutil);
    if (vs[i + 1]) { R.pg.image(vs[i + 1].name, 304, R.y - h, larg, alt(vs[i + 1])); R.pg.text(304, R.y - h - 11, 7.6, leg[i + 1], false, E.CORES_PDF.sutil); }
    R.y -= h + 26;
  }
  if (S.molde) {
    const o = S.molde.opcoes, B = S.molde.bloco;
    R.par("Molde", [["Partes", S.molde.pecas.map((p) => p.nome).join(", ")], ["Bloco", `${fmt(B.u1 - B.u0, 0)} × ${fmt(B.v1 - B.v0, 0)} × ${fmt(B.w1 - B.w0, 0)} mm`], ["Parede / base / topo", `${fmt(o.parede, 1)} / ${fmt(o.base, 1)} / ${fmt(o.topo, 1)} mm`], ["Chaves", `${S.molde.chaves.length + S.molde.chavesAB.length} (raio ${fmt(o.chaveRaio, 2)}, folga ${fmt(o.folga, 2)} mm)`], ["Canal / respiros", `${fmt(o.canal, 1)} mm / ${o.respiros} × ${fmt(o.respiro, 2)} mm`]],
      "Peças", S.molde.pecas.map((p) => [p.nome, `${fmt(p.volume, 1)} mL${p.fechada ? "" : " (aberta)"}`]).concat([["Retenções", fmt(S.molde.retencoes, 2) + " mL"]]));
  }
  R.seguranca(checar());
  R.avisoFinal(`${NO.REFERENCIAS[S.tipo]} Ferramenta de apoio ao projeto: a forma, a posição, a adaptação às margens, a cor e a validação da prótese dependem da avaliação clínica e do trabalho do anaplastologista. Arquivos para impressão em mm; a prótese "no scan" fica no referencial do scan original. Versão ${NO.VERSAO}.`);
  return R.finalizar(imgs);
}

// ------------------------------------------------------------------ ficha
const CAMPOS_P = ["pName", "pId", "pBirth", "pSex", "pEtio", "pRadio", "pRet", "pAlerg", "pProf", "pNotes"];
const lerPaciente = () => Object.fromEntries(CAMPOS_P.map((k) => [k, $(k).value.trim ? $(k).value.trim() : $(k).value]));
function escreverPaciente(p) { for (const k of CAMPOS_P) { const el = $(k); el.value = (p && p[k]) || (el.tagName === "SELECT" ? el.options[0].value : ""); } atualizarCracha(); }
const atualizarCracha = () => { const P = lerPaciente(); $("pBadge").textContent = P.pName || P.pId || ""; };
CAMPOS_P.forEach((k) => $(k).addEventListener("input", atualizarCracha));
function projeto() {
  return {
    tipo: S.tipo, lado: S.lado, pontos: S.pontos, contorno: S.contorno, plano: S.plano, residuo: S.residuo, imas: S.imas,
    fonte: $("fonte").value, nariz: lerNariz(), ajuste: lerAjuste(), modelo: S.modelo ? { nome: S.modeloNome, T: S.modeloT, paresM: S.paresM, paresR: S.paresR } : null,
    parametros: lerParametros(), molde: lerMolde(), imaDiam: +$("imaDiam").value, imaProf: +$("imaProf").value,
  };
}
function coletar() {
  if (!S.fichaId) S.fichaId = E.novoIdFicha("n");
  const P = lerPaciente();
  const f = Object.assign({ formato: FORMATO_FICHA, versaoApp: NO.VERSAO, id: S.fichaId, nome: P.pName || P.pId, paciente: P, atualizado: new Date().toISOString(), scan: S.scanNome ? { nome: S.scanNome, fator: S.fator, triangulos: S.scan ? S.scan.F.length / 3 : null } : null }, projeto());
  if (S.protese) f.resultado = { medidas: S.protese.medidas, molde: S.molde ? { pecas: S.molde.pecas.map((p) => ({ nome: p.nome, volume: p.volume })), retencoes: S.molde.retencoes } : null };
  return f;
}
function aplicarProjeto(f) {
  S.tipo = f.tipo === "nariz" ? "nariz" : "orelha"; S.lado = f.lado === "E" ? "E" : "D"; $("lado").value = S.lado;
  S.pontos = Object.assign({}, f.pontos || {}); S.contorno = (f.contorno || []).map((p) => p.slice()); S.plano = f.plano || null; S.residuo = f.residuo != null ? f.residuo : null; S.imas = (f.imas || []).map((p) => p.slice());
  aplicarTipo();
  if (f.fonte) { $("fonte").value = f.fonte; aplicarFonte(); }
  if (f.nariz) for (const k of PARAM_NARIZ) if (f.nariz[k] != null) $(idNariz(k)).value = k === "narina" ? Math.round(f.nariz[k] * 100) : f.nariz[k];
  const a = f.ajuste || {}; $("ajU").value = a.du || 0; $("ajV").value = a.dv || 0; $("ajW").value = a.dw || 0; $("ajGiro").value = a.giro || 0; $("ajEscala").value = a.escala || 100;
  const p = f.parametros || {}; if (p.passo && [...$("passo").options].some((o) => +o.value === +p.passo)) $("passo").value = [...$("passo").options].find((o) => +o.value === +p.passo).value;
  if (p.aba != null) { $("pAba").value = p.aba; $("pBorda").value = p.bordaEsp; $("pBase").value = p.baseEsp; $("pOco").checked = !!p.oco; $("pParede").value = p.parede; $("paredeBox").hidden = !p.oco; }
  if (f.imaDiam) $("imaDiam").value = f.imaDiam; if (f.imaProf) $("imaProf").value = f.imaProf;
  escreverMolde(f.molde);
  if (S.scan) { desenharPontos(); desenharPlano(); listarPontos(); if (S.plano) avancar(4); }
}
function salvarFicha(silencioso) {
  const f = coletar();
  if (!f.nome) { if (!silencioso) { status("Dê um nome ou código à ficha antes de salvar.", true); $("s0").classList.remove("collapsed"); $("pName").focus(); } return false; }
  const ok = FICHAS.salvar(f); renderFichas();
  if (!silencioso) status(ok ? `Ficha "${esc(f.nome)}" salva neste navegador.` : 'Não foi possível salvar no navegador; use "Exportar".', !ok);
  return ok;
}
const autoSalvar = () => (($("pName").value.trim() || $("pId").value.trim()) ? salvarFicha(true) : false);
let delPend = null;
function renderFichas() {
  const l = FICHAS.listar(), box = $("fList");
  if (!l.length) { box.innerHTML = '<div class="note">Nenhuma ficha salva neste navegador.</div>'; return; }
  box.innerHTML = l.map((f, i) => `<div class="frow"><div><b>${esc(f.nome || "(sem nome)")}</b><small>${f.tipo === "nariz" ? "nariz" : "orelha " + (f.lado === "E" ? "esquerda" : "direita")}${f.scan ? " · " + esc(f.scan.nome) : ""} · ${new Date(f.atualizado).toLocaleDateString("pt-BR")}</small></div><button type="button" data-open="${i}">Abrir</button><button type="button" class="del" data-del="${i}" title="Excluir">${delPend === f.id ? "Confirmar" : "×"}</button></div>`).join("");
  box.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => abrirFicha(FICHAS.listar()[+b.dataset.open])));
  box.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => {
    const f = FICHAS.listar()[+b.dataset.del];
    if (delPend !== f.id) { delPend = f.id; renderFichas(); status(`Clique em "Confirmar" para excluir a ficha "${esc(f.nome || "")}" deste navegador.`); setTimeout(() => { if (delPend === f.id) { delPend = null; renderFichas(); } }, 5000); return; }
    FICHAS.excluir(+b.dataset.del); delPend = null; if (f.id === S.fichaId) S.fichaId = null; renderFichas(); status("Ficha excluída deste navegador.");
  }));
}
function abrirFicha(f) {
  if (!FICHAS.ehFicha(f)) { status("Arquivo de ficha não reconhecido.", true); return; }
  S.fichaId = f.id; escreverPaciente(f.paciente || { pName: f.nome });
  S.protese = null; S.molde = null; limpar(mProtese); mProtese = null; if (grpMolde) [...grpMolde.children].forEach(limpar);
  if (S.scan && f.scan && f.scan.nome === S.scanNome) { aplicarProjeto(f); status(`Ficha "${esc(f.nome)}" aberta com o scan atual. Gere a prótese de novo na etapa 4.`); }
  else { S.pendente = f; S.pontos = {}; S.contorno = []; S.plano = null; aplicarProjeto(Object.assign({}, f, { pontos: {}, contorno: [], plano: null })); S.pendente = f; status(`Ficha "${esc(f.nome)}" aberta.${f.scan ? ` Abra o scan <b>${esc(f.scan.nome)}</b> na etapa 1: os pontos, o contorno e o plano serão aplicados.` : ""}`); }
  renderFichas();
}
$("fSave").onclick = () => salvarFicha(false);
$("fNew").onclick = () => { S.fichaId = null; escreverPaciente({}); status("Ficha nova: preencha os dados do paciente."); };
$("fExp").onclick = async () => { const f = coletar(); await CASCA.salvar(E.nomeArquivo("ficha_" + (E.codigoPaciente(f.paciente.pId, f.paciente.pName) || "paciente")) + "_EITA_nariz_orelha.json", new Blob([JSON.stringify(f, null, 1)], { type: "application/json" })); };
$("fImpB").onclick = () => $("fImp").click();
$("fImp").onchange = async () => { const a = $("fImp").files[0]; $("fImp").value = ""; if (!a) return; try { abrirFicha(JSON.parse(await a.text())); } catch (e) { status("Arquivo inválido.", true); } };
$("dbExp").onclick = async () => { const b = FICHAS.exportarBase(); await CASCA.salvar(b.nome, new Blob([b.conteudo], { type: "application/json" })); };
$("dbImpB").onclick = () => $("dbImp").click();
$("dbImp").onchange = async () => { const a = $("dbImp").files[0]; $("dbImp").value = ""; if (!a) return; try { const r = FICHAS.importarBase(JSON.parse(await a.text())); renderFichas(); status(`Base importada: ${r.novas} ficha(s) nova(s), ${r.atualizadas} atualizada(s).`); } catch (e) { status("Não foi possível importar: " + esc(e.message), true); } };

// ------------------------------------------------------------------ início
escreverMolde({}); aplicarTipo(); renderFichas(); atualizarCracha();
if (!T) status("A biblioteca 3D (three.js) não carregou: confira a conexão com a internet e recarregue.", true);
