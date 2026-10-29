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
  main/      processo principal: janela, segurança (CSP, navegação), deep link, instância única, IPC,
             cache em disco das imagens do Storage (asset-cache)
  preload/   ponte mínima via contextBridge (window.api)
  shared/    lógica pura usada pelos dois lados (deep link, CSP, política de navegação)
  renderer/src/
    app/         router (HashRouter), layout, ponte do deep link, portão de login (require-auth)
    features/    uma pasta por área (auth, profile, sheet-builder, board, formula-guide, …)
    components/  componentes compartilhados (seletor de cor, avatar…); `ui/` é o shadcn
    lib/         utilidades e lógica pura
      db/        ÚNICO lugar que fala com o Supabase: cliente, auth, perfis, modelos, erros
      account/   regras de nome de usuário, senha e e-mail interno
      image/     recorte do avatar (conta pura) e preparo para o Storage (WebP, hash)
      color/     conversões e paleta do seletor de cor
      chat/      bandeja de dados, comandos /r e /w, links, linha do tempo do chat, som
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

- **Tabuleiro em coordenadas do mapa.** O tamanho lógico de um mapa é o tamanho da imagem;
  posições e tamanhos de token são sempre nessas coordenadas, nunca em pixels de tela. A
  câmera (zoom e deslocamento) é de cada pessoa e só traduz tela ↔ mapa. É o que faz três
  janelas diferentes mostrarem o mesmo tabuleiro.
- **Token oculto é filtrado no banco** (RLS), não na tela. Como um `UPDATE` que o RLS passa
  a esconder simplesmente não chega ao jogador, ocultar um token também manda um
  `token-gone` pelo canal — senão ele ficaria para sempre na tela de quem já não pode vê-lo.
- **O arrasto de token oculto não é transmitido** (6.3): o broadcast de posição sai só para
  token visível, no máximo ~20 por segundo.
- **Cache das imagens em disco**, no processo principal: o nome do arquivo no Storage é o
  hash do conteúdo, então o mesmo nome nunca aponta para outra imagem e o cache nunca
  precisa ser invalidado. A chave vem do renderer e é validada (`isSafeAssetKey`) antes de
  virar caminho em disco.
- **Imagem da galeria é copiada para a pasta da sessão** ao virar token: o jogador lê os
  arquivos da mesa, mas não a galeria do mestre (evita spoiler, seção 8).

## Ambiente desta máquina

- Windows 11, npm (o bun não está instalado).
- O Node fica em `C:\Program Files\nodejs` e pode não estar no PATH de um shell novo —
  nesse caso, use `$env:Path = "C:\Program Files\nodejs;$env:Path"` antes dos comandos.
- Shell lançado pelo host de extensões do VS Code vem com `ELECTRON_RUN_AS_NODE=1`; os
  scripts em `scripts/` já removem isso, mas se um dia o Electron subir "como Node"
  (erro `Cannot read properties of undefined (reading 'isPackaged')`), é essa variável.
- O npm desta máquina **bloqueia scripts de instalação** (avisa
  `install-scripts ... not yet covered by allowScripts`). A CLI do Supabase e o Konva não
  dependem disso; se algum pacote precisar, use `npm install-scripts ls` e aprove.
- Na Fase 6 o `node_modules` estava defasado (sem `@supabase/supabase-js` nem a CLI, que o
  `package.json` já declarava): se o typecheck acusar "Cannot find module" num pacote que
  está no `package.json`, é só rodar `npm install`.
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

**Fase 4 (Contas e Supabase) — aprovada; o Thalysson liberou a Fase 5.** 432 testes.

A migração da Fase 4 foi aplicada **pelo SQL Editor do painel**, não pelo `db push` (a CLI
falhou ao criar o papel temporário `cli_login_postgres`; passar `--password` resolve). Por
isso o histórico da CLI não sabe dela: antes do próximo push, rodar
`npx supabase migration repair --status applied 20261028140000 --password <senha>`.
O login é só nome + senha: o Thalysson pediu explicitamente "nada de e-mail"; o e-mail
interno do Auth é invisível e nenhuma tela o menciona.

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

**Fase 5 (Sessões e convites) — aprovada; o Thalysson liberou a Fase 6.**

Falta o `db push` da migração `20261029120000_sessions_and_sheets.sql` (depois do
`migration repair` acima) e o `npm run db:types`.

- Migração: `sessions`, `session_secrets`, `session_members`, `sheets`, `sheet_gm_data`, RLS
  com `is_member`/`is_gm` (security definer, senão as políticas entram em recursão), as
  RPCs `create_session`, `join_session` (bcrypt do pgcrypto), `invite_preview`,
  `set_session_password`, `regenerate_invite`, `create_character_sheet`, `patch_sheet` e
  `rewrite_sheet`, as tabelas na publicação do Realtime e as políticas em
  `realtime.messages` para o canal privado `session:<id>`. Testada no PGlite com o fluxo
  inteiro (convite, senha, isolamento, permissão campo a campo, migração, canal, cascata).
- `lib/db/sessions.ts`, `lib/db/sheets.ts` (o `SheetRepository` do Supabase),
  `lib/db/sheet-rows.ts` (mapeamento puro), `lib/db/realtime.ts` (canal + presença),
  `lib/session/invite.ts` (senha amigável e texto do convite).
- `features/session/`: a sessão é rota "mãe" (`session-layout.tsx`) com o store que guarda
  o snapshot e o canal; dentro, a mesa (`session-table-page.tsx`, tabuleiro na Fase 6) e a
  ficha (`session-sheet-page.tsx`). Trocar entre as duas não derruba o canal nem a presença.
- Lobbies do mestre e do jogador, tela de convite, "Gerenciar" (convite novo, senha,
  sistema, nome, remover jogador). A tela "Fichas" lista os personagens de todas as mesas.
- Bug do construtor corrigido junto: clicar num componente da grade não abria as
  propriedades desde a Fase 2.

Decisões e armadilhas registradas:

- **A react-draggable troca o `onMouseDown` do filho pelo dela** (o código dela avisa:
  "will always be blocked"). Seleção na grade é no `onPointerDown`, que vem antes.
- **O hash da senha da sessão fica em `session_secrets`**, não em `sessions` como na 10.1:
  os membros leem a sessão, e com o hash dava para quebrar a senha fora do app. Nem o
  mestre recebe o hash (privilégio por coluna); ele lê só o texto.
- **`patch_sheet` decide no servidor quem grava cada campo** e em qual tabela, pelo esquema
  da versão da ficha — a mesma regra de `lib/sheet/permissions.ts`. Campo proibido levanta
  42501 com os ids no `detail`, e o app vira `SheetPermissionError` (reversão na tela).
- **O cache (`computed`, `summary`) vai junto com o patch**, calculado no app (o banco não
  sabe calcular fórmulas). Se o banco devolveu valores que outra pessoa mudou no meio, o app
  recalcula e regrava só o cache: é determinístico, converge numa volta. O cache dos campos
  só-do-mestre mora em `sheet_gm_data.computed`, senão vazaria para o jogador.
- **Só o mestre migra fichas de versão** (`rewrite_sheet`): só ele vê a ficha inteira,
  inclusive `orphaned`. Concorrência otimista pelo `updated_at` (40001 → relê e tenta de
  novo). O mestre migra as desatualizadas ao abrir a mesa.
- **Tempo real numa ficha aberta**: `applyRemote` aplica o que veio do banco e, por cima, o
  que esta tela tem pendente **ou em voo** (`inFlight`) — sem isso, o eco de uma gravação
  alheia "voltava" o que a pessoa acabou de digitar.
- **Removido ou saiu da mesa: a ficha fica com o mestre** (o RLS exige ser membro para o
  dono ler). Voltando com o convite, a ficha reaparece. Só o mestre exclui fichas.
- DELETE do `postgres_changes` chega só com o id e sem filtro: trate pelo id.
- Fichas locais das Fases 2 e 3 (localStorage) não aparecem mais: toda ficha nasce numa
  sessão. Os dados continuam no armazenamento, sem uso.
- Comandos longos com muitas aspas no Bash desta máquina às vezes quebram o parser
  ("unexpected EOF"): para editar arquivos, prefira a ferramenta de edição.

Pendências, de propósito:

- Capa da sessão: precisa do bucket `assets` (Fase 6). A exclusão da sessão já tenta apagar
  `assets/sessions/<id>/…`, e hoje não encontra nada.
- Sem limite de tentativas de senha no `join_session` (bcrypt custo 8 já atrasa; entre
  amigos, basta por ora).
- `npm audit`: 2 vulnerabilidades altas no `mathjs` da biblioteca de dados (já existiam; a
  correção sugerida quebra a biblioteca). Agora modelos de um mestre rodam fórmulas no PC
  dos jogadores: avaliar antes da Fase 7, quando as rolagens vão para a mesa.
- O teste definitivo do deep link no Windows é com o app instalado (`npm run build:win`).

**Fase 6 (Tabuleiro e tokens) — aprovada; o Thalysson liberou a Fase 7.** 575 testes.

Falta aplicar a migração `20261029140000_maps_tokens_and_galleries.sql` (ver abaixo) e
rodar `npm run db:types`. O Konva entrou como dependência: `konva@10.8.0` e
`react-konva@19.3.0` (versões com mais de duas semanas de publicadas).

- Migração: `maps`, `tokens`, `gallery_images`, `sessions.active_map_id`, o bucket privado
  `assets` com as políticas de 10.2, o gatilho que copia `bars` da ficha para os tokens
  (5.6), o gatilho `guard_token_update` (o que o jogador pode mudar no próprio token) e a
  RPC `reorder_maps`. `maps` e `tokens` entraram na publicação do Realtime.
- `lib/board/`: câmera (zoom no cursor, caber na tela, foco, limites do arrasto), grade
  (encaixe, deslocamento, linhas só do visível), distância em quadrados e metros com as
  três regras de diagonal, tokens (cor da vida, lugar livre, numeração automática) e o
  recorte normalizado da imagem do token.
- `lib/db/`: `maps.ts`, `tokens.ts`, `gallery.ts`, `assets.ts` (download com cache e
  cópia dentro do bucket) e `board-rows.ts` (conversão linha ↔ objeto, testada).
- `features/board/`: `board-canvas` (Konva), `token-shape`, barra de ferramentas,
  biblioteca de mapas, grade e escala, janela do token com reenquadramento, galeria, menu
  de contexto, lightbox e o store do tabuleiro.
- `main/asset-cache.ts` + dois canais de IPC: cache em disco das imagens do Storage.

Decisões e armadilhas registradas:

- **Token sem ficha tem vida própria** (6.3), editável na janela dele; com ficha, as barras
  vêm dela pelos papéis e o gatilho do banco é que as mantém em dia.
- **Colocar e arrastar encaixam diferente, e os dois estão certos:** colocar usa o quadrado
  em que o ponto caiu (clicou dentro, cai ali); arrastar leva o canto do token para o canto
  mais perto. Alt solta livre.
- **Com o mapa inteiro à vista não há o que arrastar:** o limitador centraliza o mapa menor
  que a janela. Para testar o arrasto, aproxime primeiro.
- **`guard_token_update` é gatilho, não política:** no Postgres a política de UPDATE não
  consegue comparar a linha velha com a nova, então é ele que decide o que o jogador pode
  mudar no próprio token.
- **Efeito que copia prop para estado é erro de lint** (`set-state-in-effect`): a janela do
  token é montada com `key={token.id}` e a de grade só existe quando aberta, então o estado
  inicial já vem certo. O `useAssetImage` guarda o resultado **junto com o caminho**, para
  "carregando" sair de uma conta, e não de um `setState` dentro do efeito.
- **O jsdom não faz layout nem tem canvas:** os testes de montagem do tabuleiro forçam
  `clientWidth/clientHeight` e o `setup-dom` dá um contexto 2D de mentira para o Konva. É o
  canário de quebra da react-konva com o React 19.
- O bundle do renderer foi de 3,34 MB para **5,30 MB** com o Konva. Dividir é da Fase 13.

Pendências, de propósito:

- Névoa de guerra é da Fase 11 (a coluna `fog` do mapa já existe), desenho e régua da Fase 8,
  condições e dano/cura da Fase 9, bestiário e "puxar jogadores" da Fase 10.
- Reações com emoji (6.3) estão na Fase 8, junto com ping e régua.
- O teste de 60 fps com mapa de 4096 px e 50 tokens é da Fase 13.

**Fase 7 (Dados e chat) — aprovada; o Thalysson liberou a Fase 8.** 638 testes no total.

Falta aplicar a migração `20261029180000_dice_and_chat.sql` (`npx supabase db push
--password <senha>`) e rodar `npm run db:types`.

- Migração: `rolls`, `messages` e `dice_macros`, com RLS. Rolagem secreta só para autor e
  mestre; sussurro só para autor, destinatário e mestre; só o mestre apaga (limpar chat e
  histórico); favoritas são de cada um, por mesa. `rolls` e `messages` na publicação do
  Realtime. Testada no PGlite em cima das migrações 4 a 6 (sussurro do mestre para a Carla
  não chega ao Bruno, secreta some para os outros jogadores, cascata com a sessão).
- `lib/chat/`: `tray.ts` (dados clicados → `2d6 + 1d20 + 3`, vantagem/desvantagem, regra de
  crítico da mesa em `settings.dice`), `commands.ts` (`/r`, `/w` com nome de várias palavras,
  sem acento, nome de usuário ou "mestre"), `links.ts` (só http/https vira clique),
  `feed.ts` (mensagens e rolagens numa linha, sem eco duplicado) e `sound.ts` (Web Audio).
- `lib/db/chat.ts` + `chat-rows.ts` (conversão testada; o `result` de cada rolagem é
  conferido dado a dado, porque vem do app de outra pessoa).
- `features/chat/`: store (abre com a sessão, no mesmo canal), painel, bandeja e
  `roll-result.tsx` (usado também pelo painel local do construtor).
- A mesa ganhou abas Chat / Mesa no painel da direita, com contador de não lidas (também no
  botão de recolher). A ficha dentro da mesa rola para o chat e mostra o chat ao lado.
- Gerenciar ganhou a regra de crítico da bandeja (natural, margem, nenhuma; falha no 1).

Decisões e armadilhas registradas:

- **Privacidade é do RLS, inclusive no tempo real**: o store do chat não filtra nada. Quem
  não pode ver um sussurro ou uma rolagem secreta nem recebe o evento.
- **Limpar o chat manda `feed-cleared` pelo canal**: os DELETE chegam um a um e só com o id;
  o aviso esvazia a tela de todos de uma vez.
- **Eco do tempo real**: o próprio item entra na tela assim que a gravação volta, e o INSERT
  que chega depois é deduplicado por tipo + id (e não conta como não lido).
- Não lidas contam só o que chega de outra pessoa com nenhum painel de chat à vista
  (`watch` conta os painéis: a mesa e a ficha têm cada uma o seu).
- `/r` e a bandeja usam a regra de crítico da mesa; os botões da ficha, a do próprio botão.
- Texto do chat é sempre texto puro; o link abre pelo `openExternal` do processo principal,
  que só aceita http/https.

Pendências, de propósito:

- "Aplicar como dano/cura nos selecionados" a partir de uma rolagem do chat é da Fase 9.
- Os comandos são só `/r` e `/w` (7.2); rolagem secreta é pela caixa da bandeja.
- O histórico abre com as últimas 150 mensagens e 150 rolagens; o resto continua no banco.

**Fase 8 (Desenho, régua, ping e reações) — aprovada; o Thalysson liberou a Fase 9.** 716 testes.

Falta aplicar a migração `20261029200000_drawings.sql` (junto com as das Fases 6 e 7, se
ainda não foram) e rodar `npm run db:types`. As decisões de produto que tomei estão no fim
da especificação (itens 23 a 29), para o Thalysson confirmar.

- Migração: `drawings` (id, sessão, mapa, autor, ferramenta, pontos, cor, espessura) com
  RLS — o jogador vê e desenha só no mapa ativo, apaga só os seus; o mestre vê, desenha e
  apaga em todos — e a tabela na publicação do Realtime. `is_point_list` confere os pontos
  no CHECK; o gatilho `check_drawing_map` garante que o mapa é da mesma sessão. Testada no
  PGlite em cima das migrações 4 a 7.
- `lib/board/drawing.ts` (formato, simplificação do lápis, espessura pela grade, teste da
  borracha, Ctrl+Z), `ruler.ts` (centro do quadrado, metros, texto) e `live.ts` (reações e a
  conferência de cada payload que chega pelo canal).
- `lib/db/drawings.ts` + `drawingFromRow` em `board-rows.ts`. Seis eventos novos no canal:
  `draw-live`, `draw-end`, `drawings-cleared`, `ruler`, `ping`, `reaction`.
- `features/board/`: `live-store.ts` (o passageiro: traços dos outros, réguas, pings,
  reações, e o meu rascunho), `drawing-actions.ts`, `board-layers.tsx` (camada dos desenhos
  e a de cima, com réguas e borracha), `drawing-shape.tsx`, `board-effects.tsx` (ping e
  reação em HTML), `drawing-bar.tsx` (segunda linha da barra). O menu do token ganhou a
  fileira de reações.

Decisões e armadilhas registradas:

- **O id do traço nasce no app** (`crypto.randomUUID`): é o mesmo no traço ao vivo e no
  banco, então o INSERT toma o lugar do rascunho na tela dos outros sem piscar.
- **Desfazer e apagar esperam a gravação em voo** daquele traço (`pendingSaves`): apagar
  antes de o INSERT chegar ao banco não apagaria nada. E o `board-store` lembra os ids
  apagados (`erasedDrawings`), para o eco do INSERT não ressuscitar o traço desfeito.
- **O passageiro expira sozinho** (`live-store`): o traço de quem caiu some em 5 s, a régua
  em 3 s sem notícia (quem mede reenvia a cada segundo), ping e reação no fim da animação.
  Mensagem efêmera se perde, e nada pode ficar na tela para sempre por isso.
- **O meu rascunho, a minha régua e o cursor da borracha moram no `live-store`**, não em
  estado do `BoardCanvas`: só as camadas que os desenham re-renderizam a cada pixel, e não
  os tokens.
- **Rótulo do Konva com preenchimento, contorno e `opacity`** é desenhado num canvas
  auxiliar a cada quadro (e quebra no canvas falso dos testes): a transparência vai na cor.
- Ping e reação são **HTML com animação CSS** (`globals.css`), posicionados pela câmera —
  não redesenham o canvas a cada quadro.
- Com régua, lápis ou borracha na mão, **o token não arrasta nem seleciona**: o clique é da
  ferramenta. O menu do botão direito continua valendo.
- **Reconectar agora recarrega os tokens e os desenhos** do mapa (faltava desde a Fase 6:
  o snapshot da reconexão só trazia sessão e fichas).
- O `session-store.test` chegava ao Supabase de verdade pelo chat (desde a Fase 7): agora
  `@/lib/db/chat` tem dublê lá.
- Os testes de montagem simulam o mouse no Konva de verdade (`mousedown` no
  `.konvajs-content`): no jsdom o alvo é sempre o Stage, que é o caso de desenhar e medir.

Pendências, de propósito:

- Atalhos de uma letra (R régua, D desenho, E borracha…) são da Fase 13.
- Arrastar um token mostrando a distância percorrida não está na 6.5; não foi feito.

**Fase 9 (Combate) — implementada, aguardando teste.** 780 testes.

Falta aplicar a migração `20261029220000_combat.sql` (junto com as das Fases 6 a 8, se
ainda não foram) e rodar `npm run db:types`. As decisões de produto estão no fim da
especificação (itens 30 a 38), para o Thalysson confirmar.

- Migração: `combat_state`, `combat_entries` (nome, imagem e visibilidade copiados do token
  e mantidos pelo gatilho `sync_combat_entries`), `combat_log`, RLS (participante oculto e
  entrada escondida só para o mestre) e as RPCs `apply_hp_change`, `combat_start`,
  `combat_end`, `combat_add`, `combat_set_initiatives`, `combat_reorder`,
  `combat_next_turn` e `combat_end_my_turn` (as duas últimas por `combat_advance`, que
  também passa `tick_conditions` no token que terminou o turno). Testada no PGlite em cima
  das migrações 4 a 8 (61 checagens).
- `lib/board/conditions.ts` (lista da mesa em `settings.conditions`, condições do token,
  duração) e `lib/combat/` (ordem, vez, iniciativa pelo papel, alvos do dano/cura, texto do
  log). `lib/db/combat.ts` + `combat-rows.ts`; `tokens.conditions` agora é lido e gravado.
- `features/combat/`: store (abre com a sessão, no mesmo canal), ações, painel (tracker com
  dnd-kit e log), `turn-banner.tsx` (faixa sobre o mapa e o `TurnNotifier` do "Sua vez!",
  montado na casca da sessão) e `roll-apply.tsx` (dano/cura a partir do chat).
- `features/board/`: `selection-bar.tsx` (dano/cura e "adicionar ao combate"),
  `conditions-dialog.tsx`, ícones de condição e brilho do turno no `token-shape`, e o menu
  do token com "Condições…" e "Adicionar/Tirar do combate". Em Gerenciar, a lista de
  condições da mesa (`features/session/conditions-settings.tsx`).

Decisões e armadilhas registradas:

- **Bug da Fase 6 corrigido aqui:** `guard_token_update` recusava a cópia das barras que o
  gatilho da ficha faz quando o **jogador** grava a própria vida — com o token no mapa, ele
  não conseguia mexer na vida. Agora a mudança em `bars` passa quando vem de outro gatilho
  (`pg_trigger_depth() > 1`) ou do `apply_hp_change` (que liga `cantinho.hp_change` só na
  transação). O PGlite reproduz o bug antes da migração e confere a correção depois.
- **A vida de verdade é a da ficha.** O dano num token com ficha muda o recurso de papel
  `hp` (na tabela do mestre, se o campo é só dele) e o resumo; o gatilho leva aos tokens.
  O cache dos calculados da ficha não é refeito pelo banco (ele não calcula fórmulas): quem
  abre a ficha vê tudo recalculado dos valores.
- **Seletor do zustand não pode devolver lista nova a cada leitura** (o React 19 entra em
  laço). O `RollApply` assina só a contagem de alvos e lê a lista na hora do clique.
- **Participante que passa a oculto:** o UPDATE não chega ao jogador; o `token-gone` que a
  Fase 6 já manda também tira o participante do tracker dele.
- **Depois de cada ação do combate, o app relê o combate** (são poucas linhas): várias
  RPCs mexem em muitas de uma vez, e a tela não fica dependendo da ordem dos eventos.
- Iniciativa digitada grava ao sair do campo (gravar a cada tecla reordenaria a fila no meio
  da digitação); a `key` do campo inclui o valor, para recomeçar do que o banco tem.
- O teste do `session-store` agora dubla também `@/lib/db/combat` (abre com a sessão).

Pendências, de propósito:

- Ligar/desligar o som do "Sua vez!" fica para a tela de Configurações (Fase 12).
- O tracker mostra a inicial do nome com a cor do tipo, não a imagem do token.

**Próxima fase: 10 — Ferramentas do mestre.** Só começar depois do ok dele.
