# Plataforma EITA — instruções para o Claude

- Idioma: português do Brasil em código (nomes), comentários, mensagens de commit e documentação.
- Núcleo em `nucleo/` (ES modules puros, sem dependências, rodam no navegador e no Node). O que depende do navegador (DOM, canvas, WebGL) fica em `nucleo/interface/` e não faz nada na importação. Código específico de cada prótese em `modulos/<nome>/`.
- Refatoração que não deve mudar resultado: montar a versão anterior numa pasta e rodar `testes/navegador/comparar_saidas.py ANTES dist/mamilo` ou `comparar_olho.py ANTES dist/olho` (PDF, STL, PNG, ficha e telas idênticos).
- O empacotador (`ferramentas/montar.mjs`) entende `export function/const/let/class NOME`, `export default` e `export * from`; uma declaração por `export const`.
- Antes de qualquer commit: `npm test`. Os testes de regressão do MAMILO e do OLHO exigem STL idênticos à referência; se a mudança de resultado for intencional, regenerar `testes/referencia/` e dizer por quê no commit.
- Publicação: `node ferramentas/montar.mjs <modulo>` gera `dist/<modulo>/`; é essa pasta que vira artefato no claude.ai (capacidade `downloads`; STL só dentro de .zip).
- Nunca incluir dados de pacientes (fichas, fotos, bases) no repositório. Nomes de arquivo gerados usam código ou iniciais.
- Cabeçalho de autoria nos arquivos: "© 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados."
- `legado/` é só referência; não editar.
- Plano e etapas: `docs/PLANO.md`.
