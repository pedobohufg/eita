# E4 — EITA! AFO sobre o núcleo (roteiro)

*Plataforma EITA · Lab.EITA/UFG · preparado em 10/11/2026 (fim da E3b).*

## Objetivo
Migrar o EITA! AFO v0.14 (`legado/afo/index.html`, arquivo único de 238 KB; ~195 KB de JavaScript minificado, 142 funções nomeadas) para `modulos/afo/`, sobre o núcleo, **sem mudar nenhum resultado**, e então colocá-lo na plataforma publicada (hoje o portal abre o AFO como app à parte).

## Já pronto (E4, preparação)
- **Perna sintética** (sem dados de paciente): `ferramentas/perna_sintetica.py` → `testes/fixtures/perna_sintetica.stl.gz` (85 192 triângulos, perna direita, maléolos, calcanhar, pé de sola plana) e `perna_sintetica.json` (os 6 pontos ML, MM, CA, M1, M5, PX presos à malha).
- **Referência do AFO publicado:** `testes/navegador/comparar_afo.py` usa o objeto `window.AFO` da própria página (sem cliques: `loadBuffer`, `setLandmark`, `applyCorrection`, `makeShell`, `afoStl`, `stl`, `exportData`, `report`), com relógio, sorteio e `performance.now` congelados, em dois cenários — (A) sem correção; (B) correção 95°, inversão 3°, faixa 25 mm. Compara: STL da AFO (anatômico, em pé, deitada), STL da perna, pontos e medidas, log e parâmetros da casca (sem os tempos), relatório PDF e a mensagem final. Duas rodadas do publicado saem idênticas. Referência gravada em `testes/referencia/afo-v0.14.json`.
  - `python3 testes/navegador/comparar_afo.py legado/afo dist/afo` → tem de dar "saídas idênticas" a cada passo da migração.
- Resultado do publicado na perna sintética (cenário A): lado direito detectado; casca de 306 g, 340 cm³, espessura mínima 3,8 mm, 73 976 triângulos, sem cruzamentos.

## Inventário (funções do legado, por destino)
| Grupo | Funções | Destino |
|---|---|---|
| Malha e STL | parseSTL, weld, componentsFilter, boundaryEdges, splitCrease, computeNormals, toBinarySTL | `nucleo/malha.js` (leitura de STL e solda são novas no núcleo; STL indexado já existe) |
| Anatomia e correção | setLandmark, sectionCentroid, computeFrame, addPlantar, measure, deform, anatXf, anatInv, pcaBasis, checkLandmarks | `modulos/afo/anatomia.js` (puro) |
| Casca (roda num Worker) | binCenters, fillSmooth, legCenterline, footAxis, pctl, gauss1, generateShell (com a interna `qt`, 52 KB), meshCheck, engraveText, STROKE_FONT, nnGrid | `modulos/afo/casca.js` (puro); Worker montado a partir do bundle (hoje é montado com `toString()` das funções) |
| Alinhamento e comparação | jacobiEig, nnGrid, fitSim, matV, matM, compose, applyT, alignScan, compareReal, cmpRows, cmpAdvice | `modulos/afo/comparacao.js`; `jacobiEig`/`fitSim` são candidatos ao núcleo |
| Segurança e alívios | pressureClusters, autoRelief, safetyChecks, contactRegion, contactMapImage | `modulos/afo/` |
| Rigidez | calibList, calibStore, calibFit, stiffEstimate, renderCalib, calibAdd, calibExport, calibImport, showStiff | `modulos/afo/rigidez.js` (chave `eitaAFO.calib.v1` mantida) |
| Visualizador | sh, prog, uploadMesh, uploadGhost, camVectors, matrices, mul4, project, fit, resize, bindAttr, draw, gridWorld, draw* (alças, rebites, alívios), rayFromEvent, raycast, onPick, setView, captureViews | `modulos/afo/vista.js` sobre os blocos de `nucleo/interface/vista3d.js` (programa, malhas, matrizes) |
| Saída | getDownloads, crc32, makeZip, saveFile, printXf | `nucleo` (`casca.salvar`, `zip`); regra do AFO: STL vai dentro de .zip quando há a capacidade downloads |
| Ficha | patientCode, ageText, readPatient, writePatient, updAge, readInputs, writeInputs, fichaBase, fichaKey, pairFicha, pairCopy, collectFicha, fichaList, fichaStore, renderFichas, saveFicha, exportFicha, openFicha, applyFicha, dbExport, dbImport | `nucleo/ficha.js` (armazém) + o que é do AFO (par D/E, versões) |
| Relatório | pdfEsc, pdfW, makePDF, jpegOf, logoJpeg, buildReport | `nucleo/pdf.js` (gerador idêntico ao do MAMILO/OLHO; conferir a troca → ≥ ≤) + conteúdo do AFO |
| Versões | renderVersions, saveVersion, setRef, refInfo, overlayVersion, restoreVersion, loadRefStl | `modulos/afo/` |
| Tour | tourShow, tourEnd | `nucleo/interface/tour.js` (o plano já previa o tour na casca comum) |
| Diversos | status, renderLM, fmt, update, applyCorrection, resetCorrection, exportData, clearShell, engraveAuto, sideLetter, shellParams, shellStats, applyPreset, makeWorker, generateShellAsync | interface do AFO |

## Passos sugeridos (cada um termina com `comparar_afo.py` idêntico + `npm test`)
1. **E4a — fonte legível:** separar a página em `modulos/afo/index.html` + `modulos/afo/ui.js` (o script como está), com a ponte (`ids` comuns já existem: `top`, `status`, `busy`, `s0`, `fList` com `data-open`, `pName`…); montar `dist/afo/`; comparar. Ler o código inteiro nesta etapa (também é a condição para publicar).
2. **E4b — núcleo de malha e saída:** STL (leitura/escrita), solda, componentes, normais, zip e downloads do núcleo.
3. **E4c — cálculo puro:** anatomia/correção e casca em módulos puros testáveis no Node (teste de regressão no Node como no MAMILO e no OLHO: STL da casca idêntico ao do navegador, se não houver canvas no caminho).
4. **E4d — interface:** ficha, PDF e visualizador sobre o núcleo; tour para `nucleo/interface/`.
5. **E4e — plataforma:** AFO entra em `PLATAFORMA.modulos` (deixa de ser legado); republicar a Plataforma EITA.

## Cuidados
- A casca roda num Worker criado a partir do texto das funções (`makeWorker`). Ao modularizar, o Worker precisa receber o mesmo código (gerar o script do Worker a partir do bundle do módulo, ou um arquivo `casca-worker.js` montado junto).
- `performance.now()` entra no log (`ms`, `checkMs`); fora isso, o resultado é determinístico.
- O AFO usa `confirm()` em "Excluir ficha" (não funciona dentro do claude.ai): trocar por dois cliques, como nos outros módulos (mudança de comportamento, não de resultado).
- A conversa que fizer a E4 deve começar nova (o arquivo do AFO sozinho ocupa ~120 mil tokens de contexto).
