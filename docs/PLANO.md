# Plataforma EITA — plano de arquitetura (v0.1, 10/11/2026)

*Lab.EITA / UFG.* A proposta é um sistema único para as próteses e órteses do laboratório. Já existem módulos para AFO, olho e mamilo; nariz, orelha e face são os próximos. Todos compartilham um núcleo comum e usam uma ficha única do paciente.

## 1. Inventário dos apps existentes

Levantamento feito no código publicado em 10/11/2026: EITA! AFO v0.14 (~236 KB, arquivo único), EITA! OLHO v0.1 (~54 KB) e EITA! MAMILO v0.2-web (~134 KB).

| Recurso | AFO | OLHO | MAMILO | Observação |
|---|---|---|---|---|
| Layout Lab.EITA (topo, etapas, painel de seções, status, ocupado) | ✔ | ✔ | ✔ | três cópias do mesmo CSS, com pequenas diferenças |
| Downloads pela plataforma + zip com CRC32 | ✔ | ✔ | ✔ | três implementações; só o MAMILO comprime (deflate) |
| STL binário | ✔ | ✔ | ✔ | |
| Relatório PDF (gerador próprio) | ✔ | — | ✔ | o MAMILO usa uma cópia adaptada do gerador do AFO |
| Ficha do paciente + base do laboratório | ✔ | — | ✔ | formatos diferentes ("EITA! AFO ficha" × "EITA! MAMILO ficha") |
| Visualizador WebGL próprio | ✔ | ✔ | ✔ | três versões |
| Zoom/arrasto na foto ou no modelo | ✔ | ✔ | ✔ | |
| Escala | scan em mm | diâmetro da íris ou régua de 2 pontos | marcador ArUco v2 | candidato a um módulo único de calibração |
| Cor | — | clique em área neutra | anel cinza do marcador | idem |
| Espelhamento do lado | detecção pelo scan | ✔ | ✔ | |
| Campo de altura → sólido | — | ✔ (íris) | ✔ (prótese e moldes) | |
| Moldes em 2 partes | — | — | ✔ | |
| Checagem de segurança | ✔ | — | ✔ | |
| Tour de ajuda | ✔ | — | — | |

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
  afo/  olho/  mamilo/    migrados dos apps atuais
  nariz/  orelha/  face/  novos
portal/                   lista de pacientes, histórico de próteses, abre o módulo
```

**Ficha única** (formato "EITA ficha v1"):
- `paciente`: identificação, nascimento, profissional responsável, alergias, observações. São os campos comuns.
- `proteses[]`: uma entrada por peça, com `modulo` (afo/olho/mamilo/…), `lado`/região, `versao`, `entradas` (parâmetros e pontos), `resultado` (medidas, volume, massa), `arquivos` (nomes dos scans e das fotos usados) e `data`.
- Cada módulo acrescenta só os seus campos clínicos, como GMFCS no AFO, cavidade no olho e radioterapia no mamilo.
- Importadores convertem as fichas antigas do AFO e do MAMILO.

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
| E1b | Partes de interface que ainda estão no `ui.js` do MAMILO: casca (layout), ficha/base, PDF, visualizador 3D |
| E2 | OLHO migrado para o núcleo (o menor), servindo de teste da migração |
| E3 | Portal + ficha única + importadores das fichas do AFO e do MAMILO |
| E4 | AFO migrado (sem mudar os resultados: comparar STL e PDF antes e depois) |
| E5 | Módulo NARIZ/ORELHA: revisão de literatura, captura 3D e moldes multipartes |

## 6. Situação do repositório (10/11/2026)
- `nucleo/` — processamento comum, em ES modules, sem dependências.
- `modulos/mamilo/` — processamento específico (`processamento.js`), interface (`ui.js`, ainda a mesma da v0.2), `index.html` e imagens.
- `ferramentas/montar.mjs` — gera `dist/<modulo>/` com um `app.js` único, pronto para publicar como artefato.
- `testes/` — `npm test`: 15 testes (núcleo + MAMILO). O teste de regressão confere que os STL saem idênticos, byte a byte, aos da v0.2 publicada. Há também um teste de navegador opcional (Playwright).
- `legado/` — código dos apps publicados (AFO v0.14, OLHO v0.1, MAMILO v0.2) como referência para a migração.
