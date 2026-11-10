# Plataforma EITA — instruções para o Claude

- Idioma: português do Brasil em código (nomes), comentários, mensagens de commit e documentação.
- Núcleo em `nucleo/` (ES modules puros, sem dependências, rodam no navegador e no Node). Código específico de cada prótese em `modulos/<nome>/`.
- Antes de qualquer commit: `npm test`. O teste de regressão do MAMILO exige STL idênticos à referência; se a mudança de resultado for intencional, regenerar `testes/referencia/` e dizer por quê no commit.
- Publicação: `node ferramentas/montar.mjs <modulo>` gera `dist/<modulo>/`; é essa pasta que vira artefato no claude.ai (capacidade `downloads`; STL só dentro de .zip).
- Nunca incluir dados de pacientes (fichas, fotos, bases) no repositório. Nomes de arquivo gerados usam código ou iniciais.
- Cabeçalho de autoria nos arquivos: "© 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados."
- `legado/` é só referência; não editar.
- Plano e etapas: `docs/PLANO.md`.
