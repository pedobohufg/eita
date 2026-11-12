// Ficha única do paciente (nucleo/paciente.js): correspondência, sincronização com as fichas dos módulos,
// juntar pacientes e leitura das bases antigas. Etapa E3. Dados fictícios.
// © 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados.
import test from "node:test";
import assert from "node:assert/strict";
import * as N from "../nucleo/index.js";

const T0 = new Date("2026-11-10T12:00:00Z");
const afo = (id, p, extra = {}) => ({ formato: "EITA! AFO ficha", id, nome: p.pName || p.pId, paciente: p, lado: "D", scan: "perna.stl", atualizado: "2026-11-01T10:00:00.000Z", ...extra });
const olho = (id, p, extra = {}) => ({ formato: "EITA! OLHO ficha", id, nome: p.pName || p.pId, paciente: p, olho: "E", foto: { nome: "olho.jpg" }, atualizado: "2026-11-02T10:00:00.000Z", ...extra });
const mamilo = (id, p, extra = {}) => ({ formato: "EITA! MAMILO ficha", id, nome: p.pName, paciente: p, lados: { foto: "D", protese: "E" }, foto: { arquivo: "f.jpg" }, atualizado: "2026-11-03T10:00:00.000Z", ...extra });

test("correspondência: código decide; sem código, nome + nascimento (sem acento, sem maiúsculas)", () => {
  const a = { nome: "Ana Lúcia", codigo: "P-1", nascimento: "2010-05-01" };
  assert.ok(N.mesmoPaciente(a, { nome: "outra", codigo: " p-1 ", nascimento: "" }));
  assert.ok(!N.mesmoPaciente(a, { nome: "Ana Lúcia", codigo: "P-2", nascimento: "2010-05-01" }), "códigos diferentes = pacientes diferentes");
  assert.ok(N.mesmoPaciente({ ...a, codigo: "" }, { nome: "ana  lucia", codigo: "", nascimento: "2010-05-01" }));
  assert.ok(!N.mesmoPaciente({ ...a, codigo: "" }, { nome: "Ana Lúcia", codigo: "", nascimento: "" }), "só o nome não basta");
});

test("sincronizar: liga as fichas dos três módulos, cria pacientes e completa campos vazios", () => {
  const fichas = {
    afo: [afo("joao_D", { pName: "João Silva", pId: "HC-10", pBirth: "2015-03-02", pSex: "M" })],
    olho: [olho("hc-10_E", { pName: "Joao Silva", pId: "hc-10", pProf: "Dra. X" }), olho("maria_E", { pName: "Maria", pId: "" })],
    mamilo: [mamilo("m1", { pName: "Rita Souza", pId: "", pBirth: "1970-01-01", pAlerg: "látex" })],
  };
  const r = N.sincronizar([], fichas, T0);
  assert.equal(r.criados, 3); assert.equal(r.vinculadas, 4);
  const joao = r.pacientes.find((p) => p.dados.codigo === "HC-10");
  assert.deepEqual(joao.proteses.map((v) => v.modulo).sort(), ["afo", "olho"]);
  assert.equal(joao.dados.profissional, "Dra. X"); assert.equal(joao.dados.sexo, "M");
  assert.equal(r.pacientes.find((p) => p.dados.nome === "Rita Souza").dados.alergias, "látex");
  const de = N.protesesDoPaciente(joao, fichas);
  assert.deepEqual(de.map((x) => [x.modulo, x.lado, x.arquivo]), [["olho", "E", "olho.jpg"], ["afo", "D", "perna.stl"]]);
  // de novo: nada muda
  const r2 = N.sincronizar(r.pacientes, fichas, T0);
  assert.equal(r2.criados + r2.vinculadas + r2.removidas, 0); assert.equal(r2.pacientes.length, 3);
  // ficha apagada no módulo: o vínculo sai, o paciente fica
  const r3 = N.sincronizar(r.pacientes, { ...fichas, afo: [] }, T0);
  assert.equal(r3.removidas, 1); assert.deepEqual(r3.pacientes.find((p) => p.dados.codigo === "HC-10").proteses.map((v) => v.modulo), ["olho"]);
});

test("sincronizar: vínculo pendente leva a ficha nova ao paciente criado no portal, mesmo sem código", () => {
  const p = N.novoPaciente({ nome: "Bebê sem registro" }, T0);
  const f = olho("p1abc", { pName: "Bebê" }, { atualizado: "2026-11-10T12:05:00.000Z" });
  const sem = N.sincronizar([p], { olho: [f] }, T0);
  assert.equal(sem.criados, 1, "sem o pendente, vira outro paciente");
  const com = N.sincronizar([p], { olho: [f] }, T0, [{ pacienteId: p.id, modulo: "olho", desde: "2026-11-10T12:00:00.000Z" }]);
  assert.equal(com.criados, 0); assert.equal(com.pendentesUsados.length, 1);
  assert.deepEqual(com.pacientes[0].proteses, [{ modulo: "olho", fichaId: "p1abc" }]);
  const antiga = N.sincronizar([p], { olho: [{ ...f, atualizado: "2026-11-01T00:00:00.000Z" }] }, T0, [{ pacienteId: p.id, modulo: "olho", desde: "2026-11-10T12:00:00.000Z" }]);
  assert.equal(antiga.criados, 1, "ficha anterior ao pedido não é levada");
});

test("juntar pacientes, busca e ordem", () => {
  const a = N.novoPaciente({ nome: "Ana", codigo: "1" }, T0), b = N.novoPaciente({ nome: "Ana B.", nascimento: "2000-01-01", observacoes: "obs b" }, T0);
  a.proteses = [{ modulo: "afo", fichaId: "x" }]; b.proteses = [{ modulo: "olho", fichaId: "y" }, { modulo: "afo", fichaId: "x" }];
  const l = N.juntarPacientes([a, b], a.id, b.id, T0);
  assert.equal(l.length, 1); assert.equal(l[0].dados.nascimento, "2000-01-01"); assert.equal(l[0].dados.observacoes, "obs b");
  assert.deepEqual(l[0].proteses.map((v) => v.fichaId), ["x", "y"]);
  const c = N.novoPaciente({ nome: "Éder", codigo: "Z9" }, T0);
  assert.deepEqual(N.buscarPacientes([a, c], "eder").map((p) => p.id), [c.id]); assert.deepEqual(N.buscarPacientes([a, c], "z9").map((p) => p.id), [c.id]);
  assert.deepEqual(N.ordenarPacientes([c, a]).map((p) => p.dados.nome), ["Ana", "Éder"]);
});

test("arquivos: base única, bases e fichas antigas; mesclas", () => {
  assert.equal(N.lerArquivoEITA({ formato: "EITA! AFO base", fichas: [1], calibracao: [{ data: "d", EI: 2 }] }).calibracaoAFO.length, 1);
  assert.deepEqual(Object.keys(N.lerArquivoEITA({ formato: "EITA! OLHO ficha", id: "a" }).fichas), ["olho"]);
  assert.equal(N.lerArquivoEITA({ formato: "EITA! MAMILO base", fichas: [] }).tipo, "base do EITA! MAMILO");
  assert.throws(() => N.lerArquivoEITA({ formato: "outra coisa" }), /não reconhecido/);
  const p = N.novoPaciente({ nome: "X" }, T0), base = N.montarBase({ pacientes: [p], fichas: { olho: [olho("o", { pName: "X" })] }, calibracaoAFO: [] }, T0);
  const lida = N.lerArquivoEITA(JSON.parse(JSON.stringify(base)));
  assert.equal(lida.tipo, "base única"); assert.equal(lida.pacientes[0].id, p.id); assert.deepEqual(Object.keys(lida.fichas), ["afo", "olho", "mamilo", "cranio", "nariz-orelha"]);
  const f1 = olho("o", { pName: "X" }), f2 = { ...f1, atualizado: "2026-12-01T00:00:00.000Z" };
  assert.deepEqual(N.mesclarFichas([f1], [f2, { formato: "x" }], "EITA! OLHO ficha").atualizadas, 1);
  const p2 = { ...p, atualizado: "2027-01-01T00:00:00.000Z", dados: { ...p.dados, nome: "X novo" }, proteses: [{ modulo: "afo", fichaId: "k" }] };
  const mp = N.mesclarPacientes([{ ...p, proteses: [{ modulo: "olho", fichaId: "o" }] }], [p2]);
  assert.equal(mp.lista[0].dados.nome, "X novo"); assert.equal(mp.lista[0].proteses.length, 2);
  assert.equal(N.mesclarCalibracaoAFO([{ data: "a", EI: 1 }], [{ data: "a", EI: 1 }, { data: "b", EI: 1 }]).novas, 1);
});
