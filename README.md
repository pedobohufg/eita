# Plataforma EITA

Sistema integrado do **Lab.EITA — Laboratório de Estudos Inventivos em Tecnologias Assistivas (UFG)** para projetar próteses e órteses a partir de fotografias e escaneamentos: órtese AFO, prótese ocular, prótese de aréola e papila e, em seguida, nariz, orelha e face.

Todos os módulos compartilham um **núcleo comum** (imagem, calibração, malhas, saída de arquivos) e, a partir da etapa E3, uma **ficha única do paciente**. Os dados dos pacientes ficam só no navegador de quem usa o app; nada vai para servidores.

## Estrutura

```
nucleo/                 processamento comum (ES modules, sem dependências)
  base.js               utilidades numéricas
  imagem.js             cor Lab, desfoque, Otsu, morfologia, componentes
  geometria-plana.js    polígonos e quadriláteros
  calibracao.js         marcador ArUco v2 (escala) e correção de cor
  malha.js              campo de altura → sólido fechado, STL, volume, verificação
  saida.js              pacote .zip
modulos/
  mamilo/               EITA! MAMILO (processamento, interface, página e imagens)
ferramentas/montar.mjs  gera dist/<modulo>/ (app.js único, pronto para publicar)
testes/                 testes automáticos (npm test) e fixtures sintéticas
legado/                 apps publicados antes da plataforma (referência para a migração)
docs/PLANO.md           arquitetura, decisões e etapas
```

## Uso

Requer Node.js 20 ou mais novo. Não há dependências para instalar.

```bash
npm test                 # testes do núcleo e dos módulos
npm run montar           # gera dist/mamilo/ (abrir dist/mamilo/index.html por um servidor local)
python3 testes/navegador/teste_mamilo.py   # opcional: teste no navegador (Playwright + Chrome)
```

## Regras do projeto

- **Resultados não mudam sem querer.** Cada módulo tem um teste de regressão que compara as medidas e os STL (byte a byte) com uma referência guardada em `testes/referencia/`. Mudança intencional de algoritmo → regenerar a referência no mesmo commit e explicar no histórico.
- **Nenhum dado de paciente no repositório** (fichas, fotos clínicas, bases). As fixtures de teste são fantomas sintéticas.
- **Nomes de arquivo gerados** usam o código do paciente ou as iniciais, nunca o nome completo.

## Autoria

© 2026 Lab.EITA / Universidade Federal de Goiás. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados.
