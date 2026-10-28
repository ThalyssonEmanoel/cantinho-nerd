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
| `npm run db:login`  | autoriza a CLI do Supabase (abre o navegador; uma vez por máquina)              |
| `npm run db:link`   | liga a CLI ao projeto (pede a senha do banco; uma vez por máquina)              |
| `npm run db:push`   | aplica no banco as migrações de `supabase/migrations/` que faltam               |
| `npm run db:types`  | regenera `lib/db/database.types.ts` a partir do banco real                      |

## Arquitetura

```
scripts/     wrappers do npm (ambiente limpo para subir o Electron)
supabase/    config.toml da CLI e migrations/ (uma por mudança de banco, nunca editar a aplicada)
src/
  main/      processo principal: janela, segurança (CSP, navegação), deep link, instância única, IPC
  preload/   ponte mínima via contextBridge (window.api)
  shared/    lógica pura usada pelos dois lados (deep link, CSP, política de navegação)
  renderer/src/
    app/         router (HashRouter), layout, ponte do deep link, portão de login (require-auth)
    features/    uma pasta por área (auth, profile, sheet-builder, formula-guide, …)
    components/  componentes compartilhados (seletor de cor, avatar…); `ui/` é o shadcn
    lib/         utilidades e lógica pura
      db/        ÚNICO lugar que fala com o Supabase: cliente, auth, perfis, modelos, erros
      account/   regras de nome de usuário, senha e e-mail interno
      image/     recorte do avatar (conta pura) e preparo para o Storage (WebP, hash)
      color/     conversões e paleta do seletor de cor
      formula/   motor de fórmulas: tokenizer, parser (Pratt), avaliador, grafo de dependências
      dice/      motor de dados: interpolação dos `{…}`, rolagem, regras de crítico, geradores
      sheet/     modelo de ficha: tipos, zod, chaves, validação, contexto de fórmulas, repositório
    test/        preparação do jsdom e ajudantes dos testes de montagem
    hooks/       hooks compartilhados
    stores/      Zustand, um store por área (app, auth)
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
- **Login por nome + senha em cima do Supabase Auth**: o app monta o e-mail interno
  `nome@usuarios.rpgmesa.app` (`lib/account/credentials.ts`). Esse domínio **não pode mudar**
  depois que existirem contas. O perfil nasce por gatilho no banco, e o nome de usuário sai
  do e-mail — não dos metadados —, então perfil e login nunca divergem.
- **O cliente do Supabase é criado na primeira chamada**, não ao importar: telas e testes
  que não falam com o banco sobem sem `.env`. Os testes nunca devem chegar ao cliente de
  verdade (o Vitest carrega o `.env` real); dublê `lib/db/*` com `vi.mock`.
- **Tipos do banco** em `lib/db/database.types.ts`: gerados com `npm run db:types`. Na Fase 4
  foram escritos à mão no mesmo formato (a CLI ainda não estava ligada ao projeto).

## Ambiente desta máquina

- Windows 11, npm (o bun não está instalado).
- O Node fica em `C:\Program Files\nodejs` e pode não estar no PATH de um shell novo —
  nesse caso, use `$env:Path = "C:\Program Files\nodejs;$env:Path"` antes dos comandos.
- Shell lançado pelo host de extensões do VS Code vem com `ELECTRON_RUN_AS_NODE=1`; os
  scripts em `scripts/` já removem isso, mas se um dia o Electron subir "como Node"
  (erro `Cannot read properties of undefined (reading 'isPackaged')`), é essa variável.
- O npm desta máquina é o 10.9 (conferido na Fase 4), que roda scripts de instalação
  normalmente — o `postinstall` da CLI do Supabase baixou o binário sem pedir nada. Se um
  dia o npm virar 11 e passar a bloquear esses scripts, use `npm install-scripts ls` e
  aprove explicitamente.
- Ao adicionar pacote, prefira uma versão publicada há pelo menos duas semanas (proteção
  contra pacote comprometido recém-publicado).
- Projeto Supabase: `https://bpxtvjlkkuxkxhxyjlbl.supabase.co` (livre para remodelar). O
  `.env` já tem a URL e a chave anon. Ainda existem lá as tabelas do app antigo
  (`sessions`, `players`, `character_sheets`, `board_tokens`… e o bucket `vtt-assets`): a
  migração da Fase 5 precisa apagar a `sessions` antiga antes de criar a nova.
- A CLI do Supabase é dependência de desenvolvimento (`npx supabase …`). `db:login` e
  `db:link` pedem as credenciais do Thalysson: rodar só com ele.

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

**Fase 3 (Ficha preenchível) — aprovada; o Thalysson liberou a Fase 4.** 287 testes.

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

**Fase 4 (Contas e Supabase) — implementada, aguardando teste.** 432 testes no total.

Falta um passo que só o Thalysson pode dar (credenciais dele): no painel do Supabase,
desligar "Confirm email" e pôr senha mínima 8; depois `npm run db:login`, `db:link`,
`db:push` e `db:types`. Sem o `db:push` o login dá erro, porque as tabelas não existem.

- `supabase/migrations/20261028140000_accounts_and_sheet_templates.sql`: `profiles` (com
  gatilho no `auth.users`), `sheet_templates`, `sheet_template_versions`, RLS, as RPCs
  `publish_sheet_template` e `seed_example_template` e o bucket público `avatars`. Testada
  num Postgres em WebAssembly (PGlite) com um esqueleto do `auth`/`storage`: cadastro,
  isolamento entre contas, versão imutável, anônimo bloqueado e cascata ao apagar a conta.
- `lib/db/`: cliente (preguiçoso), `auth.ts` (cadastro/login/logout, nunca lança),
  `auth-storage.ts` ("continuar conectado": localStorage ou sessionStorage), `profiles.ts`
  (perfil e avatar), `sheet-templates.ts` (o `TemplateRepository` do Supabase) e
  `errors.ts` (todo erro do Supabase vira português antes de chegar na tela).
- `stores/auth-store.ts` + `app/require-auth.tsx`: estado do login e o portão das rotas.
  `loading` cobre a leitura da sessão e a busca do perfil; o portão espera em vez de
  expulsar. Sem login, vai para `/login` levando `from` para voltar depois (já serve ao
  convite que abre o app sem ninguém logado, Fase 5).
- `features/auth/login-page.tsx` (Entrar / Criar conta), `features/profile/` (nome de
  exibição, bio, avatar com recorte circular em WebP de 256 px, nome = hash).
- Modelos de ficha agora na conta. O "Exemplo d20" entra uma vez por conta (marca
  `example_seeded` no perfil). Modelos que estavam só no localStorage (Fases 2 e 3)
  aparecem num aviso na biblioteca para subir à conta, com as versões; as fichas locais
  são religadas aos ids novos.

Pedidos do Thalysson feitos junto com a Fase 4:

- Cursor de mãozinha em tudo que é clicável (regra global em `globals.css`).
- Bug do Rótulo perdendo o foco a cada tecla: a `key` do painel de propriedades incluía a
  chave da fórmula, que acompanha o rótulo — cada letra remontava o painel. Agora só o
  campo Chave remonta (`KeyField`). Há teste que falha com o código antigo.
- Seletor de cor (`components/color-picker.tsx`) nos campos "Cor de destaque" e "Cor":
  paleta pronta + área de cor personalizada + hex. Feito à mão: o `react-colorful` voltou a
  publicar versões em 2026 depois de anos parado, padrão de pacote comprometido.
- Guia de fórmulas (`features/formula-guide/`), na navegação e no botão "Guia" do
  construtor. Cada exemplo é calculado ao vivo sobre uma ficha de exemplo de verdade, e
  `guide-sample.test.ts` confere todos — o guia não pode mentir sobre o motor.

Decisões e armadilhas registradas:

- **CHECK com resultado NULL passa no Postgres.** `jsonb_typeof(x -> 'tabs') = 'array'`
  deixava entrar esquema sem `tabs`; por isso o `coalesce(…, false)` na migração.
- **O construtor grava em fila.** Com rede no meio, duas gravações em voo podiam chegar
  fora de ordem e o rascunho velho venceria. E sair da tela grava o pendente (`flush`)
  antes do `reset` — antes, a última alteração feita a menos de 600 ms se perdia.
- **Nome vazio não é gravado** (o banco recusa); fica valendo o último nome bom.
- O repositório local de fichas guarda em memória os esquemas das versões publicadas
  (imutáveis): o patch não busca o modelo na rede a cada campo. Abrir a ficha busca de
  novo, para notar modelo excluído.
- O seletor de cor usa o `popover` nativo + âncora do CSS (Chromium 156 no Electron 45):
  conferido no Electron de verdade que abre colado ao botão e vira para cima sem espaço.
- Arrastar na área de cor personalizada só grava ao soltar, para não encher o Desfazer.
- Logout: limpa o estado e navega para `/login` no mesmo instante (sem `from`), porque quem
  entrar depois pode ser outra conta.

Pendências, de propósito:

- Excluir sessões e excluir conta são da Fase 12 (o aviso no Perfil diz isso).
- As tabelas do app antigo continuam no banco; a Fase 5 trata a `sessions` que colide.
- `npm audit` acusa 2 vulnerabilidades altas no `mathjs` que a biblioteca de dados puxa.
  Já existiam; a correção sugerida rebaixa a biblioteca (quebra). Avaliar antes da Fase 5,
  quando modelos de um mestre passam a rodar fórmulas no PC dos jogadores.

**Próxima fase: 5 — Sessões e convites.** Só começar depois do ok dele.
