# Plataforma EITA — instruções para o Claude

- Idioma: português do Brasil em código (nomes), comentários, mensagens de commit e documentação.
- Núcleo em `nucleo/` (ES modules puros, sem dependências, rodam no navegador e no Node). O que depende do navegador (DOM, canvas, WebGL) fica em `nucleo/interface/` e não faz nada na importação. Código específico de cada prótese em `modulos/<nome>/`.
- Refatoração que não deve mudar resultado: montar a versão anterior numa pasta e rodar `testes/navegador/comparar_saidas.py ANTES dist/mamilo`, `comparar_olho.py ANTES dist/olho` ou `comparar_afo.py legado/afo dist/afo` + `caminhos_afo.py legado/afo dist/afo` (PDF, STL, PNG, ficha e telas idênticos).
- Migração do AFO (E4): seguir `docs/E4-AFO.md`. No Node, a casca do AFO é comparada com `testes/referencia/afo-v0.14-node.json` (o Chrome 153 difere do Node no último bit de sin/cos/exp/pow; ver a E4c no roteiro).
- O empacotador (`ferramentas/montar.mjs`) entende `export function/const/let/class NOME`, `export default` e `export * from`; uma declaração por `export const`.
- Antes de qualquer commit: `npm test`. Os testes de regressão do MAMILO e do OLHO exigem STL idênticos à referência; se a mudança de resultado for intencional, regenerar `testes/referencia/` e dizer por quê no commit.
- Publicação: `node ferramentas/montar.mjs <modulo>` gera `dist/<modulo>/`; a plataforma (portal + módulos) sai de `node ferramentas/montar.mjs plataforma-sem-legado` em `dist/plataforma/` e é publicada no artefato "Plataforma EITA" (capacidade `downloads`; STL só dentro de .zip). Não publicar arquivo que não tenha sido lido por inteiro.
- As páginas de módulo precisam manter os ids comuns (`top`, `status`, `busy`, `s0`, `fList` com `data-open`, `pName`, `pId`, `pBirth`, `pSex`, `pProf`, `pAlerg`): a `modulos/portal/ponte.js` depende deles.
- Dentro do claude.ai não há `confirm()`/`alert()`: confirmar com dois cliques.
- Nunca incluir dados de pacientes (fichas, fotos, bases) no repositório. Nomes de arquivo gerados usam código ou iniciais.
- Cabeçalho de autoria nos arquivos: "© 2026 Lab.EITA/UFG. Autor: Pedro Henrique Gonçalves. Todos os direitos reservados."
- `legado/` é só referência; não editar.
- Plano e etapas: `docs/PLANO.md`.
