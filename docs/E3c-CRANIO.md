# E3c — EITA! Crânio com órtese craniana (roteiro)

*Plataforma EITA · Lab.EITA/UFG · preparado em 11/11/2026.*

## Por que esta etapa
O módulo CRÂNIO da plataforma (E3b) foi migrado da "Calculadora de Assimetria Craniana" publicada (https://claude.ai/artifact/TNoE7VCMhWDsKWW42cbk4d), que só calcula CVA, CVAI e índice cefálico a partir de medidas digitadas. A versão completa do EITA! Crânio — com **envio do STL do scan** e **geração automática da órtese craniana** — não estava publicada como artefato e ficou fora do levantamento. O autor enviou o arquivo em 11/11/2026; está em `legado/cranio-ortese/index.html` (somente referência).

## O arquivo (`legado/cranio-ortese/index.html`, 452 KB)
- 3 scripts próprios (~204 KB), CSS (~38 KB), 9 imagens base64 (~205 KB; só logos: EITA! Crânio, Lab.EITA, UFG — **a logo oficial do EITA! Crânio substitui o símbolo provisório da E3b**).
- Dependências externas: three.js r128 (`cdnjs`), `OrbitControls` e `STLLoader` 0.128 (`cdn.jsdelivr.net/npm/three@0.128.0/examples/js/...`). Os dois hosts são permitidos nos artefatos.
- **Bloco 0 — `window.CROCore`** (36 KB, 44 funções; puro, sem DOM): análise de assimetria por espelhamento (`sampleGrid`, `analyze`, `detectPeaks`/`findPeaks`, `cephalicIndex`), detecção das orelhas (`detectEars`, `resolveEars`), indicação (`auto`/`plagio`/`brachy`/`both`; `expectedIcGain`, `defaultIcTarget`), edições manuais (`addEdit`…), mapa de cores (`vertexColors`, `polarImage`), geometria da casca (`brimFn`, `trimLine`, `growthReserve`, `innerRadius`, `makeTrimField`, `generate`, recortes `slitF`/`holeF`, `clip`) e `toBinarySTL`.
- **Bloco 1 — interface 3D e fluxo guiado "UI v8"** (107 KB, 80 funções): carga do STL, marcos (`setLandmarkPoint`…), planos de medida e linhas (`generateIntersectionGeometry`, `updateMeasurementLines`), ferramentas CRO (`runAnalysis`, `runGenerate`, `markEar`, `addManualEdit`, presets/protocolos), vistas para o relatório (`render`, `sliceZ`, `drawTop`…), **ficha própria** (`labeita_cro_fichas_v1`, formatos `"EITA! Crânio ficha"`/`"EITA! Crânio base"`, com versões e rastreio do STL/alinhamento) e presets (`labeita_cro_presets_v1`).
- **Bloco 2 — calculadora e relatório** (61 KB, 10 funções): `classify`, `drawFig`, `update`, `renderCard`, `buildReport` — a mesma calculadora da E3b, agora alimentada também pelas medidas tiradas do scan.
- Nenhum dos ids comuns da ponte (`top`, `status`, `busy`, `s0`, `fList`, `pName`…) existe na página.

## Conflito a resolver: duas fichas
- Módulo atual (E3b): `eitaCRANIO.fichas.v1`, `"EITA! CRÂNIO ficha"` v0.2 (paciente, medições por data, gráfico do CVAI).
- Versão completa: `labeita_cro_fichas_v1`, `"EITA! Crânio ficha"` (paciente, medidas, parâmetros da órtese, versões, STL de referência).
- Proposta: a ficha da plataforma passa a ter as duas partes (medições por data + órtese/versões); o módulo importa as fichas e bases antigas `"EITA! Crânio …"` (como o portal já faz com as dos outros apps).

## Passos sugeridos
1. **E3c-1 — leitura e volta rápida da função.** Ler o arquivo inteiro (condição para publicar). Guardar uma referência: `ferramentas/cabeca_sintetica.py` (cabeça sintética com assimetria conhecida, sem dados de paciente) e `testes/navegador/comparar_cranio.py` usando `window.CROCore` (análise, orelhas, casca → STL), com relógio e sorteio congelados, como no `comparar_afo.py`. Enquanto a migração não termina, a plataforma pode servir a versão completa como app "legado" (mecanismo `PLATAFORMA.legados`, com a ponte), para a equipe voltar a ter scan e órtese logo.
2. **E3c-2 — cálculo puro.** `CROCore` → `modulos/cranio/ortese.js` (puro, testado no Node; STL pelo `stl()` do núcleo; referência própria do Node se a matemática do Chrome divergir, como no AFO).
3. **E3c-3 — interface.** Unir as duas interfaces no módulo CRÂNIO: medidas manuais (atual) **ou** tiradas do scan; análise e órtese como etapas novas; three.js fica (o visualizador próprio do núcleo é mais simples); ficha unificada; relatório pelo PDF do núcleo; logo oficial; ids da ponte; exclusão em dois cliques.
4. **E3c-4 — plataforma.** Testes de ponta a ponta com scan; republicar no artefato atual.

## Cuidados
- A conversa que fizer a E3c deve começar nova (o arquivo sozinho ocupa ~120 mil tokens).
- `legado/` não se edita; as comparações são sempre `legado/cranio-ortese` × montagem nova.
