# Código legado (somente referência)

Cópias dos apps publicados como artefatos em 10/11/2026, guardadas para orientar a migração para a plataforma e para comparar resultados (STL e PDF) antes e depois. **Não editar.**

| Pasta | App | Versão | Artefato |
|---|---|---|---|
| `afo/` | EITA! AFO | v0.14 | https://claude.ai/artifact/Kod5SXvjeJGGCfs4jzWwxr |
| `cranio/` | Calculadora de Assimetria Craniana (EITA! CRÂNIO) | v1 (calculadora) | https://claude.ai/artifact/TNoE7VCMhWDsKWW42cbk4d |
| `cranio-ortese/` | EITA! Crânio — assimetria craniana e órteses cranianas | "UI v8" (arquivo `LabEITA_Calculadora_Assimetria_Ortese.html`) | não publicado; arquivo enviado pelo autor em 11/11/2026 |
| `olho/` | EITA! OLHO | v0.2 (`app.js` + `ficha.js` + `index.html`) | https://claude.ai/artifact/NSrZpWFq5LTAMqbjoxViRb |
| `mamilo-v0.2/` | EITA! MAMILO | v0.2-web | https://claude.ai/artifact/FNrKDdQZs55b4i8wRj9dcq |

O `ficha.js` (ficha, base e relatório PDF) e o `index.html` do OLHO foram acrescentados em 10/11/2026 (etapa E2): a primeira cópia trazia só o `app.js`. O `index.html` está sem o invólucro que a plataforma acrescenta ao servir a página.

Na E3 entraram em `afo/` o `sobre.html` e as imagens (`assets/`) publicados, para o AFO rodar dentro da plataforma montada localmente.


O `cranio-ortese/` (11/11/2026) é a versão completa do EITA! Crânio — STL do scan, marcos, planos de medida, análise de pressão por espelhamento e geração da órtese craniana (CRO) — que não estava entre os artefatos publicados: a E3b migrou só a calculadora. Usa three.js r128 (cdnjs/jsdelivr). As imagens embutidas são só logos (EITA! Crânio, Lab.EITA, UFG). Migração: `docs/E3c-CRANIO.md`.
