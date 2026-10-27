
# Cantinho Nerd - Mesa Virtual de RPG

Fala, galera! Esse é o **Cantinho Nerd**, uma mesa virtual de RPG (VTT — *Virtual Tabletop*) feita especialmente pro nosso grupo de amigos jogar de forma remota. Nada de coisa super profissional — é só um projeto feito com carinho pra gente se divertir nas sessões sem depender de plataformas pagas ou cheias de anúncio.

O mestre cria a sessão, compartilha o link e a senha, e todo mundo joga junto no mesmo tabuleiro, com tudo sincronizado em tempo real: tokens, desenhos, dados, chat, iniciativa, condições e fichas.

Sistemas suportados (escolhidos por sessão):

- **D&D 5e** — o clássico de fantasia medieval
- **Ordem Paranormal RPG** — o sistema brasileiro de horror paranormal (Cellbit / Jambô Editora)

---

## Sumário

- [Como funciona o fluxo](#como-funciona-o-fluxo)
- [Funcionalidades](#funcionalidades)
- [Sistemas e fichas](#sistemas-e-fichas)
- [Tecnologias usadas](#tecnologias-usadas)
- [Banco de dados (Supabase)](#banco-de-dados-supabase)
- [Como rodar localmente](#como-rodar-localmente)
- [Scripts disponíveis](#scripts-disponíveis)
- [Deploy](#deploy)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Documentação extra](#documentação-extra)

---

## Como funciona o fluxo

```
Login (nome + senha)
   └─> Escolha de papel: Mestre ou Aventureiro
         ├─> Mestre: lobby do mestre → cria sessão (nome, senha, sistema) → tabuleiro
         └─> Jogador: lobby do jogador → cola o link/ID da sessão → senha → tabuleiro
```

- **Login simples:** cada jogador cria uma conta com nome e senha. A senha é guardada como hash SHA-256 na tabela `players` (não usa o Supabase Auth).
- **Sessão persistente:** a sessão ativa fica salva no navegador, então dar F5 não te tira da mesa.
- **Link direto:** a rota `/join/:sessionId` leva direto pra tela de senha da sessão.
- **Lobby do mestre:** lista as sessões já criadas, permite voltar a elas, copiar o link de convite ou excluí-las.
- **Lobby do jogador:** entrar em uma nova sessão (por link ou ID) ou voltar para sessões que você já participa.

### Rotas

| Rota | Página | Descrição |
|------|--------|-----------|
| `/` | `Index.tsx` | Login, escolha de papel, lobbies e tabuleiro |
| `/join/:sessionId` | `JoinPage.tsx` | Entrada direta por link compartilhado |
| `*` | `NotFound.tsx` | Página 404 |

---

## Funcionalidades

### Tabuleiro / Mapa
- **Tabuleiro virtual fixo (1920×1080)** escalado pra caber em qualquer tela — todo mundo vê exatamente as mesmas posições, independentemente do tamanho do monitor ou do celular.
- **Biblioteca de mapas por sessão:** o mestre faz upload de vários mapas, troca o mapa ativo e exclui os que não usa mais.
- **Zoom dinâmico** (roda do mouse ou botões) e **modo "mãozinha"** pra arrastar o mapa.
- **Grade sobreposta** — só o mestre liga/desliga e ajusta o tamanho; todos veem a mesma grade.
- **Fog of War** (mestre): névoa que cobre o mapa e revela apenas o raio de visão em volta dos tokens dos jogadores.
- Interface responsiva com menu próprio para celular.

### Tokens
- **Tipos de token:** jogador (cada um adiciona o seu), **Monstros** e **NPCs** (exclusivos do mestre, cada um com sua galeria de imagens).
- Arrastar pelo mapa, redimensionar, renomear (salvo no banco), trocar a foto e **reenquadrar a imagem** dentro do círculo sem precisar reenviar.
- **Ampliar imagem** do token pra ver em tamanho cheio.
- **Ocultar/revelar** tokens (mestre) — tokens ocultos não aparecem pros jogadores.
- **Reações com emoji** nos tokens (👍 😮 😱 ⚔️ 🎉 💀 ✨ ❤️), transmitidas em tempo real.
- **Barras de status** sobre o token: HP (verde/amarelo/vermelho conforme a porcentagem).

### Desenho e medição
- **Ferramentas de desenho:** lápis, linha, círculo, retângulo e **borracha**.
- Cores e espessura configuráveis; desenhos sincronizados entre todos.
- **Ctrl+Z** desfaz seus últimos traços; botão para apagar **só os seus desenhos**; o mestre pode limpar todos os desenhos da sessão.
- **Régua** que mede distâncias em **metros** (1 quadrado = 1,5 m).

### Combate
- **Tracker de iniciativa:** ordem de combate, destaque do turno ativo, botão "Próximo Turno" e contador de rodadas.
- **Log de combate** registrando cada dano/cura aplicado (quem aplicou, em quem e quanto).

### Ferramentas do mestre
- **Puxar Jogadores:** coloca o token de todos os jogadores da sessão no mapa de uma vez, em grade e sem sobreposição, opcionalmente sincronizando HP das fichas.
- **Bestiário:** cria e gerencia criaturas (stat block com HP, CA/Defesa, atributos, ataques e habilidades tudo dinâmico conforme ele modulou a ficha do monstro).
- **Builder de Encontros:** monta grupos de criaturas do bestiário com quantidade, marca quais começam ocultas, salva para reutilizar e **spawna tudo no mapa com um clique** (com numeração automática: Goblin 1, Goblin 2...).
- **Fichas dos Jogadores:** o mestre abre e consulta a ficha de qualquer jogador da sessão.

### Dados
- Todos os dados clássicos: d4, d6, d8, d10, d12, d20 e d100, com quantidade e modificador.
- **Fórmulas customizadas** como `2d6+3` ou `1d20+5`.
- Detecção automática de **crítico** e **falha crítica** no d20.
- Rolagens aparecem em tempo real pra todo mundo e ficam salvas no **histórico** — que o mestre pode limpar pelo botão de excluir histórico.

### Chat
- Chat em tempo real durante a sessão.
- **Sussurro (whisper)** para mandar mensagens privadas pra um jogador ou pro mestre (o mestre vê todas as mensagens).

### Perfil
- Visualização do nome e avatar, com edição da bio do jogador.
- Excluir todas as suas sessões ou excluir a conta (com confirmação digitando o nome).

---

## Sistemas e fichas

As fichas ficam salvas por jogador e por sessão (tabela `character_sheets`), e a imagem escolhida na ficha vira a imagem do token.

### D&D 5e
Abas: **Principal**, **Combate**, **Armadura**, **Magias** e **Inventário**.

- Atributos (FOR/DES/CON/INT/SAB/CAR) com modificadores, perícias, testes de resistência e proficiências.
- **12 classes** do PHB com subclasses, **raças** (Humano, Elfos, Anões, Halflings, Gnomos, Meio-Elfo, Meio-Orc, Tiefling, Draconato) e **antecedentes** (Acólito, Criminoso, Herói do Povo, Nobre, Sábio, Soldado...), aplicando os bônus automaticamente.
- Espaços de magia por nível para conjuradores completos, meio-conjuradores e magia do pacto.
- Cálculo automático de CA (armadura, escudo e classe), HP e bônus de proficiência.
- Ataques, equipamentos e inventário.

### Ordem Paranormal RPG
Abas: **Principal**, **Combate**, **Rituais**, **Habilidades**, **Inventário** e **Bestiário** (só para o mestre).

- Atributos AGI/FOR/INT/PRE/VIG e **28 perícias** com 4 níveis (sem treino, treinado, veterano, expert).
- **NEX** de 5% a 99%, **4 classes** (Mundano, Ocultista, Combatente, Especialista) e trilhas.
- **Origens** do livro, cada uma com perícias treinadas e poder próprio.
- **Regra opcional de idade:** faixas etárias (de criança a idoso) que alteram NEX, PE, defesa, deslocamento e limites de atributo, com desvantagens obrigatórias.
- Cálculo automático de **PV, PE e Sanidade** máximos (classe, atributos e NEX) e de **Defesa**.
- **Combate:** ataques, defesa, proteção, deslocamento, morte iminente e condições.
- **Rituais:** criação de rituais com círculo, elemento (Morte, Sangue, Energia, Conhecimento), execução, alcance e custo; botão **Lançar** que permite amplificar, desconta o PE da ficha e registra o lançamento.
- **Habilidades:** lista de habilidades da classe e habilidades gerais.
- **Inventário:** armas, armaduras, itens paranormais e dinheiro em R$, com criação de itens customizados.

As regras e tabelas de Ordem Paranormal (classes, perícias, origens, tabela de pânico, fórmulas de PV/PE/SAN etc.) ficam centralizadas em [src/lib/systems.ts](src/lib/systems.ts).

---

## Tecnologias usadas

| O que | Pra que |
|-------|---------|
| **React 18 + TypeScript** | Frontend da aplicação |
| **Vite** (plugin SWC) | Build rápido e dev server |
| **React Router** | Rotas (`/` e `/join/:sessionId`) |
| **Tailwind CSS** | Estilização |
| **shadcn/ui + Radix UI** | Componentes de UI acessíveis e customizáveis |
| **lucide-react** | Ícones |
| **Framer Motion** | Animações |
| **Supabase** | Banco Postgres, Realtime, Storage e funções RPC |
| **TanStack React Query** | Gerenciamento de estado do servidor |
| **Sonner** | Notificações (toasts) |
| **React Hook Form + Zod** | Formulários e validação |
| **Vitest + Testing Library** | Testes unitários |
| **Playwright** | Testes end-to-end |
| **ESLint** | Lint |
| **Vercel** | Hospedagem |

---

## Banco de dados (Supabase)

O Supabase é usado como backend completo. Os tipos gerados ficam em [src/integrations/supabase/types.ts](src/integrations/supabase/types.ts).

**Tabelas principais**

| Tabela | Conteúdo |
|--------|----------|
| `players` | Contas (nome, hash da senha, avatar, bio) |
| `sessions` | Sessões (mestre, senha, sistema, mapas, mapa ativo, grade, fog) |
| `session_participants` | Quem participa de cada sessão |
| `board_tokens` | Tokens no tabuleiro (posição, tamanho, imagem, HP/PE/PS, visibilidade) |
| `board_drawings` | Desenhos e formas do canvas |
| `dice_rolls` | Histórico de rolagens |
| `session_messages` | Chat e sussurros |
| `character_sheets` | Fichas de personagem |
| `initiative_tracker` | Ordem de iniciativa e turno atual |
| `token_conditions` | Condições aplicadas nos tokens |
| `token_health_logs` | Log de dano/cura |
| `bestiary_creatures` / `saved_encounters` | Bestiário e encontros salvos |
| `fog_of_war` | Áreas reveladas da névoa |
| `ritual_casts` | Registro de rituais lançados |

**Funções RPC:** `spawn_encounter`, `pull_players_to_map`, `pull_players_to_map_with_stats`, `decrement_condition_durations`.

**Storage:** bucket `vtt-assets` para mapas, imagens de monstros/NPCs e fotos de tokens.

> As migrations do banco não ficam versionadas no repositório (a pasta `supabase/` está no `.gitignore`); há um backup compactado em `supabase.7z`.

---

## Como rodar localmente

1. **Instale as dependências:**
```bash
npm install
# ou
bun install
```

2. **Configure as variáveis de ambiente:**
Crie um arquivo `.env` na raiz com as credenciais do seu projeto Supabase:
```env
VITE_SUPABASE_URL=sua_url_aqui
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica_aqui
```

3. **Rode o projeto:**
```bash
npm run dev
```

4. **Acesse no navegador:**
```
http://localhost:8080/
```

---

## Scripts disponíveis

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Sobe o servidor de desenvolvimento na porta 8080 |
| `npm run build` | Gera o build de produção em `dist/` |
| `npm run build:dev` | Build em modo desenvolvimento |
| `npm run preview` | Serve o build localmente |
| `npm run lint` | Roda o ESLint |
| `npm test` | Roda os testes com Vitest |
| `npm run test:watch` | Vitest em modo watch |

---

## Deploy

O projeto está configurado para a **Vercel**. O [vercel.json](vercel.json) redireciona todas as rotas para o `index.html`, o que permite abrir links como `/join/:sessionId` diretamente. Basta configurar as mesmas variáveis de ambiente (`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`) no painel da Vercel.

---

## Estrutura do projeto

```
cantinho-nerd/
├── src/
│   ├── components/
│   │   ├── GameBoard.tsx            # Tabuleiro principal (mapa, tokens, toolbar)
│   │   ├── LoginScreen.tsx          # Login/cadastro
│   │   ├── RoleSelection.tsx        # Escolha entre Mestre e Aventureiro
│   │   ├── DmLobby.tsx              # Lobby do mestre (criar/gerenciar sessões)
│   │   ├── PlayerLobby.tsx          # Lobby do jogador
│   │   ├── JoinSession.tsx          # Entrada com senha da sessão
│   │   ├── DrawingCanvas.tsx        # Lápis, formas, borracha, Ctrl+Z
│   │   ├── MeasureRuler.tsx         # Régua em metros
│   │   ├── GridOverlay.tsx          # Grade
│   │   ├── FogOfWar.tsx             # Névoa de guerra
│   │   ├── DiceRoller.tsx           # Rolador de dados
│   │   ├── DiceLog.tsx              # Histórico de rolagens
│   │   ├── ChatPanel.tsx            # Chat e sussurros
│   │   ├── InitiativeTracker.tsx    # Iniciativa e turnos
│   │   ├── TokenHealthBar.tsx       # Barras de HP/PE/PS
│   │   ├── TokenConditions.tsx      # Aplicar condições
│   │   ├── CombatLogPanel.tsx       # Log de combate
│   │   ├── CombatCalculator.tsx     # Calculadora de combate
│   │   ├── PullPlayersModal.tsx     # Puxar jogadores para o mapa
│   │   ├── BestiaryManager.tsx      # Bestiário
│   │   ├── EncounterBuilder.tsx     # Builder de encontros
│   │   ├── CharacterSheet.tsx       # Ficha de D&D 5e
│   │   ├── CharacterSheetOP.tsx     # Ficha de Ordem Paranormal
│   │   ├── RitualCast.tsx           # Lançamento de rituais (OP)
│   │   ├── ProfileSettings.tsx      # Perfil do jogador
│   │   └── ui/                      # Componentes shadcn/ui
│   ├── pages/                       # Index, JoinPage, NotFound
│   ├── lib/
│   │   ├── auth-context.tsx         # Jogador logado e papel (mestre/jogador)
│   │   └── systems.ts               # Dados e regras dos sistemas
│   ├── hooks/                       # Custom hooks
│   ├── integrations/supabase/       # Cliente e tipos do Supabase
│   └── test/                        # Setup e testes do Vitest
├── docs/                            # Documentação, planilha e referências usadas nas fichas
├── public/                          # Arquivos estáticos
└── vercel.json                      # Configuração de deploy
```

---

## Documentação extra

- [docs/arquivos/](docs/arquivos/) — guias detalhados das funcionalidades: [combate](docs/arquivos/CombatSystems.md), [HP nos tokens](docs/arquivos/TokenHealth.md), [condições](docs/arquivos/TokenConditions.md), [puxar jogadores](docs/arquivos/PullPlayers.md), [bestiário e encontros](docs/arquivos/BestiaryEncounters.md) e [fog of war](docs/arquivos/FogOfWar.md).
- [docs/Features/](docs/Features/) — lista de bugs conhecidos, ajustes e ideias de melhorias (incluindo o planejamento da implementação de Ordem Paranormal em `Features - 4.md`).
- `docs/Ficha D&D (1).xlsx` — planilha de referência usada para automatizar a ficha de D&D.

---

## Diversão

Esse projeto tem a finalidade de melhorar a experiência dos meus amigos ao jogar RPG. É um projeto simples, feito no meu tempo livre — então bugs podem aparecer, mas a diversão é garantida. 🎲
