# Plataforma EITA — plano de arquitetura (v0.1, 10/11/2026)

*Lab.EITA / UFG.* A proposta é um sistema único para as próteses e órteses do laboratório. Já existem módulos para AFO, olho, mamilo e crânio (assimetria craniana); nariz, orelha e face são os próximos. Todos compartilham um núcleo comum e usam uma ficha única do paciente.

## 1. Inventário dos apps existentes

Levantamento feito no código publicado em 10/11/2026: EITA! AFO v0.14 (~236 KB, arquivo único), EITA! OLHO v0.2 (~56 KB + ~28 KB de ficha e relatório) e EITA! MAMILO v0.2-web (~134 KB). *Correção na E2: o OLHO publicado já tinha ficha, base e PDF num segundo arquivo (`ficha.js`), que tinha ficado fora do primeiro levantamento.* *Acréscimo na E3b: a "Calculadora de Assimetria Craniana" (EITA! CRÂNIO, ~26 KB, https://claude.ai/artifact/TNoE7VCMhWDsKWW42cbk4d) também estava fora do levantamento; é uma calculadora (CVA, CVAI e índice cefálico), sem ficha, sem arquivos e sem o visual Lab.EITA.*

| Recurso | AFO | OLHO | MAMILO | CRÂNIO (calculadora) | Observação |
|---|---|---|---|---|---|
| Layout Lab.EITA (topo, etapas, painel de seções, status, ocupado) | ✔ | ✔ | ✔ | — (visual próprio) | três cópias do mesmo CSS, com pequenas diferenças |
| Downloads pela plataforma + zip com CRC32 | ✔ | ✔ | ✔ | — | três implementações; só o MAMILO comprime (deflate) |
| STL binário | ✔ | ✔ | ✔ | — | |
| Relatório PDF (gerador próprio) | ✔ | ✔ | ✔ | — (resumo para copiar) | três cópias do mesmo gerador; o OLHO sem a troca de → ≥ ≤ |
| Ficha do paciente + base do laboratório | ✔ | ✔ | ✔ | — | formatos diferentes ("EITA! AFO ficha", "EITA! OLHO ficha", "EITA! MAMILO ficha") |
| Visualizador WebGL próprio | ✔ | ✔ | ✔ | — (esquema SVG) | três versões |
| Zoom/arrasto na foto ou no modelo | ✔ | ✔ | ✔ | — | |
| Escala | scan em mm | diâmetro da íris ou régua de 2 pontos | marcador ArUco v2 | medidas digitadas (mm/cm) | candidato a um módulo único de calibração |
| Cor | — | clique em área neutra | anel cinza do marcador | — | idem |
| Espelhamento do lado | detecção pelo scan | ✔ | ✔ | — | |
| Campo de altura → sólido | — | ✔ (íris) | ✔ (prótese e moldes) | — | |
| Moldes em 2 partes | — | — | ✔ | — | |
| Checagem de segurança | ✔ | — | ✔ | classificação CVA/CVAI/IC | |
| Tour de ajuda | ✔ | — | — | — | |

**Conclusão:** cerca de metade do código de cada app é infraestrutura repetida. Hoje uma correção feita no zip, no PDF ou no download precisa ser repetida três vezes.

## 2. Arquitetura proposta

```
eita-nucleo/              (biblioteca comum, ES modules)
  casca/                  layout Lab.EITA: topo, etapas, painel, status, ocupado, tour
  paciente/               ficha única, armazenamento, base do laboratório, importadores das fichas antigas
  saida/                  downloads, zip (deflate), STL, PDF (layout de relatório), PNG
  imagem/                 abrir/reduzir, Lab, desfoque, Otsu, morfologia, componentes
  calibracao/             marcador v2 (escala + cor), régua de 2 pontos, medida de referência
  vista3d/                visualizador WebGL, vistas predefinidas, captura de imagens para o relatório
  malha/                  campo de altura → sólido, verificação de estanqueidade, volume, moldes
  seguranca/              checagens comuns (pele, radioterapia, alergias…) + checagens do módulo
modulos/
  afo/  olho/  mamilo/  cranio/    migrados dos apps atuais
  nariz/  orelha/  face/  novos
portal/                   lista de pacientes, histórico de próteses, abre o módulo
```

**Ficha única** (formato "EITA ficha v1"):
- `paciente`: identificação, nascimento, profissional responsável, alergias, observações. São os campos comuns.
- `proteses[]`: uma entrada por peça, com `modulo` (afo/olho/mamilo/…), `lado`/região, `versao`, `entradas` (parâmetros e pontos), `resultado` (medidas, volume, massa), `arquivos` (nomes dos scans e das fotos usados) e `data`.
- Cada módulo acrescenta só os seus campos clínicos, como GMFCS no AFO, cavidade no olho e radioterapia no mamilo.
- Importadores convertem as fichas antigas do AFO, do OLHO e do MAMILO.

## Decisões tomadas (10/11/2026)
- **Dados:** **um único app** (um artefato com o portal e todos os módulos), com as fichas guardadas só no navegador. A base do laboratório continua sendo trocada por arquivo.
- **Código:** **repositório no GitHub** (`pedobohufg/eita`) com o núcleo e os módulos, mais um script de montagem (`ferramentas/montar.mjs`).
- **Projeto no claude.ai:** "Plataforma EITA" (criado em 10/11/2026).

## 3. Decisões que mudam a arquitetura (contexto)

1. **Onde ficam os dados dos pacientes.** Cada artefato do claude.ai roda numa origem própria, e o armazenamento do navegador não é compartilhado entre apps. Há três opções:
   - (a) **um único artefato** com o portal e todos os módulos (mesma origem e mesma base no navegador; nada sai do computador);
   - (b) **base compartilhada na plataforma** (capacidade `db` dos artefatos: a equipe vê as mesmas fichas em qualquer computador, mas dados de saúde passam a ficar armazenados fora do navegador, o que exige avaliação de LGPD e do CEP);
   - (c) **apps separados**, com o arquivo da base do laboratório levado entre eles, como hoje.
2. **Onde fica o código-fonte.** Um repositório (por exemplo, no GitHub do laboratório) com o núcleo e os módulos e um script que monta cada app. É o mais sustentável. Hoje o código vive só dentro dos artefatos.
3. **Ordem de migração.** O AFO é o maior e o mais avançado. Migrá-lo por último reduz o risco.

## 4. Desafios técnicos dos novos módulos
- **Nariz e orelha** têm reentrâncias. O gerador de moldes atual (campo de altura, 2 partes) não serve. Eles precisam de malha 3D completa, linha de partição, moldes de 3 ou mais partes e operações booleanas em malha.
- **Captura 3D:** a foto plana não basta. É preciso scanner ou fotogrametria (vários ângulos), espelhamento do lado sadio ou modelo estatístico de forma.
- **Retenção:** adesivo, implantes osseointegrados com ímã ou clipe, ou armação de óculos. Cada uma muda a face interna da prótese.
- **Regulatório:** cada tipo de prótese pode ter enquadramento próprio. Os módulos devem poder ser validados separadamente.

## 5. Etapas sugeridas
| Etapa | Entrega |
|---|---|
| E0 ✔ | Decisões da seção 3; nome; projeto e repositório criados |
| E1a ✔ | Núcleo de processamento extraído do MAMILO (`nucleo/`: base, imagem, geometria plana, calibração, malha, saída) + módulo `modulos/mamilo/` + montagem + testes (regressão byte a byte contra a v0.2) |
| E1b ✔ | Interface comum extraída do MAMILO: `nucleo/pdf.js` (gerador + layout de relatório), `nucleo/ficha.js` (armazém de fichas e base), `nucleo/interface/` (casca, imagem no navegador, vista 3D). PDF, STL, ficha e telas 3D idênticos à E1a |
| E2 ✔ | OLHO v0.2 sobre o núcleo: `modulos/olho/` (processamento puro + interface). Núcleo ganhou gaussiano exato, escala por diâmetro/régua, balanço de branco por clique, sólidos de revolução, STL de triângulos, tabela de PDF configurável, idade em meses, blocos WebGL. Pacote, PDF, ficha e telas idênticos ao publicado em dois cenários |
| E3 ✔ | Portal de pacientes + ficha única (`nucleo/paciente.js`, "EITA paciente v1" e "EITA base v1") + ponte para os módulos (`modulos/portal/ponte.js`) + importadores das bases e fichas antigas do AFO, OLHO e MAMILO. Plataforma montada como um só app (`dist/plataforma/`) e publicada como artefato |
| E3b ✔ | EITA! CRÂNIO como quarto módulo (`modulos/cranio/`): mesmos cálculos, limiares e resumo da calculadora publicada (testados contra o código dela), no visual Lab.EITA, com ficha do paciente, medições por data (acompanhamento, idade corrigida para prematuros, gráfico do CVAI), relatório PDF e ligação com o portal. Plataforma republicada com o CRÂNIO |
| E4 ✔ | AFO migrado sem mudar os resultados (11/11/2026). E4a: `modulos/afo/` com o script legível. E4b: malha, STL, .zip e downloads do núcleo. E4c: vetores, anatomia e casca em módulos puros, regressão no Node (`testes/afo.test.mjs`). E4d: ficha, PDF, tour (`nucleo/interface/tour.js`) e câmera (`modulos/afo/vista.js`) sobre o núcleo; exclusão em dois cliques; HTML escapado. E4e: AFO dentro da plataforma (deixa de ser legado); republicação do artefato pendente (ver `docs/E4-AFO.md`). Detalhes, achados (inclusive a matemática do Chrome 153) e pendências em `docs/E4-AFO.md` |
| E5 | Módulo NARIZ/ORELHA: revisão de literatura, captura 3D e moldes multipartes |

## 6. Situação do repositório (11/11/2026, após a E4)
- `nucleo/` — processamento comum, em ES modules, sem dependências: imagem (inclui gaussiano exato), calibração (marcador v2; diâmetro de referência; régua de 2 pontos; balanço de branco por clique), malha (campos de altura, sólidos de revolução, STL), zip, **PDF** (gerador + layout de relatório) e **ficha** (armazém no navegador, base do laboratório).
- `nucleo/interface/` — partes de navegador: casca Lab.EITA (status, ocupado, downloads, etapas, área de soltar), abrir fotos/JPEG, visualizador WebGL e seus blocos (programa, malhas, matrizes) — o OLHO monta a própria câmera sobre esses blocos.
- `modulos/portal/` — portal de pacientes (`ui.js`, `index.html`) e `ponte.js`.
- `modulos/cranio/` — `processamento.js` (CVA, CVAI, índice cefálico, classificação, resumo, idade corrigida, evolução; puro), `ui.js` (medidas, cartões, esquema, ficha com medições por data, gráfico, PDF), `index.html` e imagens. O símbolo do módulo é provisório (desenhado nesta etapa).
- `modulos/olho/` — `processamento.js` (detecção da íris/pupila, íris desenrolada e limpa, textura, relevo, casca e malhas; puro), `ui.js` (interface, ficha e relatório; antes `app.js` + `ficha.js`), `index.html` e imagens.
- `modulos/mamilo/` — processamento específico (`processamento.js`), interface (`ui.js`, 880 → 650 linhas: ficou só o que é do MAMILO — editor da foto, perfil lateral, cena 3D, conteúdo do relatório, checagens), `index.html` e imagens.
- `modulos/mamilo/pigmentacao.js` (10/11/2026) — etapa 6 "Pigmentação" do MAMILO: cores por zona medidas na foto (perfil radial da aréola), mapa de pigmentação em escala 1:1 (prótese e molde espelhado), receita de pigmentos por camada guardada na ficha e no relatório, e máscara de pintura (STL) que assenta no molde frontal sobre a borda da aréola. No portal, a receita vai junto da ficha do MAMILO (`pigmentacao`).
- `ferramentas/montar.mjs` — gera `dist/<modulo>/` com um `app.js` único, pronto para publicar como artefato.
- `testes/` — `npm test`: 38 testes (núcleo, PDF/ficha, ficha única, MAMILO, OLHO e CRÂNIO; o CRÂNIO é comparado com as funções da calculadora publicada). OLHO: detecção, medidas, esclera e pupila idênticas à v0.2 publicada (STL byte a byte); a íris tem referência própria no Node porque, no navegador, a textura volta do canvas com alfa pré-multiplicado na borda do limbo. O teste de regressão confere que os STL saem idênticos, byte a byte, aos da v0.2 publicada, e o gerador de PDF é comparado byte a byte com o da v0.2. No navegador (opcional, Playwright): `teste_mamilo.py`, `teste_olho.py` e `teste_cranio.py` (fumaça), `teste_plataforma.py` (portal → módulos → portal, bases), `comparar_saidas.py` e `comparar_olho.py` (duas montagens → arquivos e telas idênticos).
- Mudanças de comportamento do OLHO na E2 (os arquivos gerados não mudam): o download funciona também fora do claude.ai (link comum, como no MAMILO); o pacote .zip passa a ser comprimido (deflate); no PDF, os símbolos → ≥ ≤ ⚠ ≈ viram -> >= <= ! ~ em vez de "?"; a base exportada continua com o mesmo formato e nome.
- `legado/` — código dos apps publicados (AFO v0.14 com imagens e `sobre.html`, OLHO v0.2, MAMILO v0.2, calculadora de assimetria craniana) como referência para a migração.
- `modulos/afo/` (E4) — `vetor.js`, `anatomia.js`, `casca.js` (geração da casca e texto do Worker) e `vista.js` (câmera), puros; `ui.js` (interface do AFO v0.14 sobre o núcleo: malha/STL, .zip/downloads, ficha, PDF e tour), `index.html`, `sobre.html` e imagens. Entra na plataforma como os demais módulos (`PLATAFORMA.modulos`).
- Núcleo, novidades da E4: `lerSTL`, `soldar`, `filtrarComponentes`, `contarArestasDeBorda`, `separarVincos`, `normaisDeVertices`; `embalarParaDownload` (STL só dentro de .zip); `capacidadeDownloads`/`salvarPelaCapacidade`/`baixarPorLink`; `exportarBase(agora, extras)`; `criarTour`; `compilarPrograma(…, { verificar })`.
- Testes da E4: `npm test` 51 com o MAMILO de pigmentação (inclui `malha-stl.test.mjs` contra as funções do AFO publicado e `afo.test.mjs`, regressão da casca no Node); no navegador `comparar_afo.py`, `caminhos_afo.py`, `ficha_afo.py`, `tour_afo.py`, `vista_afo.py` (sempre `legado/afo` × montagem nova) e `teste_plataforma.py` com o AFO.
- Próximo: **E5** (NARIZ/ORELHA).

## 7. Ficha única e portal (E3, 10/11/2026)
- **Formato:** cada paciente ("EITA paciente v1") guarda os dados comuns — nome, prontuário/código, nascimento, sexo, profissional, alergias, observações — e a lista das próteses, cada uma um vínculo `{modulo, fichaId}` com a ficha completa que continua no módulo (pontos, parâmetros, resultados). Assim os módulos não mudaram, e o AFO legado funciona igual.
- **Sincronização:** ao abrir o portal (e ao voltar de um módulo), cada ficha de módulo sem paciente é ligada a um: primeiro pelo pedido pendente ("abri o OLHO para este paciente"), depois pelo prontuário, depois por nome + nascimento; sem correspondência, nasce um paciente novo. Campos vazios do paciente são completados pelas fichas; o portal nunca sobrescreve um campo já preenchido. Ficha apagada no módulo → o vínculo sai.
- **Ponte** (`ponte.js`, acrescentada pela montagem em cada página de módulo): botão "‹ Pacientes"; abre a ficha pedida pelo portal ou preenche nome, prontuário, nascimento, sexo, profissional e alergias numa ficha nova. Usa só os ids comuns das páginas Lab.EITA.
- **Base única** ("EITA base v1"): pacientes + fichas dos módulos (AFO, OLHO, MAMILO, CRÂNIO) + medições de bancada do AFO. O portal importa também as bases e fichas antigas de cada módulo (migração dos apps publicados à parte).
- **Juntar** pacientes duplicados; **excluir** apaga o paciente e as fichas dele (confirmação em dois cliques: o claude.ai recusa `confirm()`; o OLHO passou a usar a mesma confirmação).
- **Publicação:** artefato "Plataforma EITA" (https://claude.ai/artifact/CthWngqti2LVBFsk3wTTwW), privado, com a capacidade `downloads`. Montado com `node ferramentas/montar.mjs plataforma-sem-legado`: portal, MAMILO, OLHO e CRÂNIO (desde a E3b). O AFO legado não foi incluído porque o arquivo publicado (240 KB) não pôde ser revisado inteiro nesta etapa; localmente (`plataforma`) ele entra com a ponte e passa no teste.
- **Limites conhecidos:** as fichas ficam só no navegador (a plataforma pode apagar esse armazenamento; exportar a base é a cópia de segurança); os apps antigos publicados à parte guardam as fichas deles separadamente (cada artefato tem seu armazenamento) — trazê-las é exportar a base em cada um e importar no portal.
