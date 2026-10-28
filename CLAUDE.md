# Cantinho Nerd — regras do projeto

Mesa virtual de RPG em Electron, para um grupo privado de amigos. O diferencial é o
**construtor de fichas sem código**: o mestre monta o modelo de ficha do sistema dele
numa grade, com fórmulas e botões de rolagem. **O app não conhece as regras de nenhum
sistema** — tudo que é específico vem dos modelos.

A especificação completa é [docs/ESPECIFICACAO.md](docs/ESPECIFICACAO.md), incluindo as
fases do projeto (seção 11). Leia-a antes de qualquer tarefa não trivial.

## Como trabalhar

- **Uma fase por vez** (seção 11 da especificação). Nunca implemente várias fases de uma vez.
- No fim de cada fase: rodar `lint`, `typecheck` e `test`; listar os critérios de aceite
  cumpridos; dar um roteiro curto de teste manual; **não fazer commits**. Parar e esperar
  o teste do Thalysson antes de seguir.
- Se uma decisão de produto não estiver na especificação, **perguntar** em vez de inventar.
- Ao parar no meio de uma fase, atualizar a seção "Onde paramos" no fim deste arquivo.

## Regras de código

- Identificadores, tabelas e arquivos em **inglês**; textos da interface em **português do
  Brasil**; comentários em **português**, explicando o _porquê_ do que não é óbvio.
- Organização por feature: `src/renderer/src/features/<area>/`. Acesso ao banco só por
  funções em `src/renderer/src/lib/db/` — componentes nunca chamam `supabase.from` direto.
- Lógica pura (fórmulas, dados, migração de fichas, posicionamento, permissões) fora dos
  componentes, com testes Vitest.
- Toda mudança de banco é uma **nova** migração em `supabase/migrations/`; nunca editar
  migração já aplicada. Tipos gerados com `supabase gen types`.
- `.env` fora do Git (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); `.env.example` no Git.
  Só a chave pública (anon) vai para o app; a secreta fica nas Edge Functions.
- Mensagens de erro amigáveis em português via toast (`sonner`); atualização otimista com
  reversão se o banco recusar.
- Nunca `eval`, `new Function` ou `dangerouslySetInnerHTML`. JSON importado é validado com zod.
- Arquivos em kebab-case; componentes React em PascalCase.

## Comandos

| Comando             | O que faz                                                                       |
| ------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`       | app em desenvolvimento (HMR)                                                    |
| `npm run dev:p2`    | **segunda** instância, perfil de dados separado — exige o `npm run dev` rodando |
| `npm run lint`      | ESLint                                                                          |
| `npm run typecheck` | TypeScript nos dois lados (node + web)                                          |
| `npm test`          | Vitest                                                                          |
| `npm run build:win` | instalador NSIS em `dist/`                                                      |

## Arquitetura

```
scripts/     wrappers do npm (ambiente limpo para subir o Electron)
src/
  main/      processo principal: janela, segurança (CSP, navegação), deep link, instância única, IPC
  preload/   ponte mínima via contextBridge (window.api)
  shared/    lógica pura usada pelos dois lados (deep link, CSP, política de navegação)
  renderer/src/
    app/         router (HashRouter), layout, ponte do deep link
    features/    uma pasta por área (auth, lobby-gm, lobby-player, session, sheet-builder, …)
    components/  componentes compartilhados; `ui/` é o shadcn
    lib/         utilidades e, a partir da Fase 4, `db/` (acesso ao Supabase)
      formula/   motor de fórmulas: tokenizer, parser (Pratt), avaliador, grafo de dependências
      dice/      motor de dados: interpolação dos `{…}`, rolagem, regras de crítico, geradores
      sheet/     modelo de ficha: tipos, zod, chaves, validação, contexto de fórmulas, repositório
    test/        preparação do jsdom para os testes de montagem
    hooks/       hooks compartilhados
    stores/      Zustand, um store por área
```

Decisões que não são óbvias:

- **HashRouter**, não BrowserRouter: no app empacotado o renderer vem de `file://`.
- **CSP vem do processo principal** (`src/main/security.ts`), não de uma meta tag, para
  valer também no servidor de desenvolvimento sem manter dois textos iguais.
- **`sandbox: true`** no renderer, então o preload é CommonJS: o `package.json` **não** tem
  `"type": "module"`.
- **O preload não pode externalizar dependências.** No sandbox ele só dá `require` nos
  módulos embutidos do Electron, então `electron.vite.config.ts` usa
  `external: ['electron']` no preload em vez do `externalizeDepsPlugin` — tudo o que o
  preload importar é empacotado junto. Externalizar ali faz o preload morrer em silêncio e
  o renderer fica sem `window.api` (já aconteceu na Fase 0).
- **Os scripts passam por `scripts/*.mjs`** só para limpar `ELECTRON_RUN_AS_NODE`: o VS Code
  exporta essa variável para processos filhos de extensões, e com ela o `electron.exe` roda
  como Node puro — a janela nunca abre.
- **Perfis de dados** (`RPGMESA_PROFILE`): a segunda instância usa outro `userData` e não
  participa da instância única, senão não dava para testar mestre e jogador no mesmo PC.
- O deep link `rpgmesa://join/<id>` é traduzido para a rota `/join/:inviteId`.

## Ambiente desta máquina

- Windows 11, npm (o bun não está instalado).
- O Node fica em `C:\Program Files\nodejs` e pode não estar no PATH de um shell novo —
  nesse caso, use `$env:Path = "C:\Program Files\nodejs;$env:Path"` antes dos comandos.
- Shell lançado pelo host de extensões do VS Code vem com `ELECTRON_RUN_AS_NODE=1`; os
  scripts em `scripts/` já removem isso, mas se um dia o Electron subir "como Node"
  (erro `Cannot read properties of undefined (reading 'isPackaged')`), é essa variável.
- O npm 11 bloqueia scripts de instalação por padrão. O Electron 45 não depende de
  `postinstall` (baixa o binário sob demanda), mas se algum pacote precisar,
  use `npm install-scripts ls` e aprove explicitamente.
- Projeto Supabase: `https://bpxtvjlkkuxkxhxyjlbl.supabase.co` (livre para remodelar).
  A chave anon ainda precisa ser preenchida no `.env` antes da Fase 4.

## Onde paramos

**Fase 0 (Fundação) — aprovada pelo Thalysson, que liberou a fase seguinte.**

**Fase 1 (Motor de fórmulas e dados) — aprovada; o Thalysson liberou a fase seguinte.**
Sem interface, 133 testes Vitest cobrindo os dois motores.

- `lib/formula/`: linguagem da seção 5.4 completa (operadores, `e`/`ou`/`nao`, funções em
  português com alias em inglês, referências `forca.mod`, `vida.max`,
  `pericias.furtividade.total`, `soma(inventario.peso)`, `contar(inventario)`), grafo de
  dependências com ordenação topológica e detecção de ciclo, e `evaluateEntries` para
  recalcular tudo na ordem certa (vira o `computed` da ficha na Fase 3).
- `lib/dice/`: interpolação dos `{…}` antes de rolar, rolagem com
  `@dice-roller/rpg-dice-roller`, dados individuais com marca de descartado, regras de
  crítico (nenhuma / natural / margem, com margem podendo vir de um campo) e falha
  crítica no 1. Gerador criptográfico por padrão, injetável nos testes.

Regras que o motor segue e que a interface deve respeitar:

- **Nada lança exceção.** Toda a API devolve `{ ok: true, value }` ou
  `{ ok: false, error }` com mensagem em português — é o que vira `#ERRO` com tooltip no
  campo (seção 5.4). Erro em um campo não derruba os outros.
- Um campo que **existe mas está vazio** deve resolver para o padrão dele (0 ou `""`).
  `undefined` no contexto significa "essa chave não existe" e vira erro na ficha.
- O crítico olha só os **d20 mantidos**: o dado descartado por vantagem não conta.

Pendências conhecidas, de propósito:

- `build/icon.ico` não existe: o instalador usa o ícone padrão do Electron até a Fase 12.
- `electron-updater` está instalado mas não configurado (Fase 12).
- A biblioteca de dados carrega o mathjs: o peso disso só aparece no bundle quando a
  interface começar a rolar dados (Fases 3 e 7). Medir lá.

**Fase 2 (Construtor de fichas) — aprovada; o Thalysson liberou a fase seguinte.**

- `lib/sheet/`: modelo (13 componentes, abas, papéis), zod para importar, chaves
  (`Força` → `forca`) com renomeação que reescreve as fórmulas, validação da 5.2,
  contexto de fórmulas a partir da ficha (atributo `.mod`, barra `.max`, tabela
  `linha.coluna`, `soma`/`contar`), `computed`/`bars`, migração entre versões e o
  repositório atrás de interface (hoje no `localStorage`).
- `features/sheet-builder/`: paleta, grade de 12 colunas (react-grid-layout), abas,
  propriedades, Desfazer/Refazer (Ctrl+Z/Ctrl+Y), Validar, Publicar, Exportar e
  "Ver como jogador" com rolagens de verdade.
- `features/sheet-render/`: renderizador usado pelo construtor **e** pela Fase 3 — a
  diferença entre pré-visualizar e preencher é só o `SheetRenderOptions`.
- `features/sheet-templates/`: biblioteca (criar, renomear, duplicar, excluir, importar).
  Trocar a implementação do repositório em `features/sheet-templates/repository.ts` é o
  único ponto que a Fase 4 precisa mexer para salvar no Supabase.

Decisões e armadilhas registradas:

- **Valores por id, fórmulas por chave.** Renomear a chave nunca perde dado do jogador.
- **Barra com máximo por fórmula** precisa de `createInitialValues`/`createPreviewValues`:
  `createDefaultValues` não conhece fórmulas e deixaria a ficha nascer com 0 de vida.
- **react-grid-layout 2.x tem API nova** (objetos `gridConfig`/`dragConfig`/`dropConfig` e
  `compactor` em vez de `compactType`). "Os itens ficam onde foram soltos" é
  `{ ...noCompactor, preventCollision: true }`.
- Na grade do construtor os campos são **só visuais** (`pointer-events: none`): o clique
  seleciona e arrasta. Preencher é no "Ver como jogador".
- A biblioteca de dados tem um `require("crypto")` **dentro** do motor `nodeCrypto`, que
  não usamos — não troque o gerador para ele no renderer, ou o app quebra.
- Testes de montagem (`*.dom.test.tsx`, ambiente jsdom) existem para pegar quebra de
  biblioteca com o React 19, como o `findDOMNode` que a react-draggable usava.

**Fase 3 (Ficha preenchível) — implementada, aguardando teste.** 287 testes no total.

- `lib/sheet/permissions.ts`: quem vê e quem edita cada campo, fora dos componentes. Na
  Fase 5 a mesma regra vira RLS e checagem no RPC; `canPatchField` é a pergunta que o
  servidor vai fazer.
- `lib/sheet/sheet-record.ts`: a ficha preenchida no formato da tabela `sheets` (10.1).
  `values` é o jsonb compartilhado, `gmValues` é a `sheet_gm_data` (o jogador **nem
  recebe**), `computed` e `summary` são o cache dos papéis que o banco copia para os
  tokens, e `orphaned` guarda o que saiu do modelo. `patchFields` aplica só os campos do
  patch; `projectSheetFor` é o que o jogador pode receber; `migrateSheetRecord` sobe a
  ficha de versão.
- `lib/sheet/sheet-repository.ts`: `SheetRepository` com `patch(id, patch, audience)` já
  na forma do RPC `patch_sheet` — recebe campos, recusa o que a plateia não pode gravar e
  devolve a ficha recalculada. Implementação local no `localStorage`; a Fase 5 troca só
  `features/sheets/repository.ts`.
- `features/sheets/`: lista de fichas, ficha preenchível e o store com o salvamento
  automático campo a campo (otimista, com reversão se o repositório recusar).

Decisões e armadilhas registradas:

- **O patch relê a ficha gravada antes de aplicar.** É isso que faz "o mestre aplica dano
  enquanto o jogador edita o inventário" não perder nada — nunca se grava a ficha inteira
  a partir de uma cópia que a tela tinha em mãos.
- **Campo editado durante a gravação continua pendente** e é reaplicado em cima do que
  voltou do repositório, senão a tela dá um pulo para trás no meio da digitação.
- **O destino de cada campo vem do modelo, não do patch:** um campo `visibleTo: 'gm'`
  sempre cai em `gmValues`, mesmo que quem chamou tenha roteado errado.
- **Barra nova nasce cheia, barra antiga não é curada** na migração: `fillResourceCurrents`
  aceita uma lista de ids justamente para isso.
- **Valor de campo removido volta sozinho** se o campo reaparecer numa versão seguinte,
  porque a chave de `orphaned` é o id imutável do componente.
- A ficha fica presa a uma **versão publicada**: modelo só com rascunho não gera ficha, e
  a tela de Fichas explica isso em vez de oferecer um botão que não funciona.
- Na tabela, **só as linhas que o jogador criou** podem ser removidas e reordenadas
  (dnd-kit); as linhas fixas vêm do modelo e as fórmulas as acham pela chave.
- O interruptor "Vendo como Jogador/Mestre" na ficha é andaime da Fase 3: na Fase 5 quem
  olha vem do login.

Pendências desta fase, de propósito:

- Tempo real, "um personagem por jogador por sessão" e a aba Fichas da sessão são da Fase 5.
- As rolagens param num painel local; vão para o chat na Fase 7.
- O campo de imagem continua só com o enquadramento (upload é da Fase 6).

**Próxima fase: 4 — Contas e Supabase** (seções 4.1, 4.2 e 9). Só começar depois do ok dele.
