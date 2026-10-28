# Prompt — RPG Mesa (mesa virtual de RPG com fichas modulares)

Você vai construir comigo, do zero, um **app desktop de mesa virtual de RPG** chamado **RPG Mesa** (nome provisório). Usando TypeScript, React, Electron e Supabase durante o projeto. Escreva comentários em português explicando o *porquê* das partes não óbvias.

## Como vamos trabalhar

- Construa **uma fase por vez** (seção 11). Nunca implemente várias fases de uma vez.
- No fim de cada fase: rode lint, typecheck e testes; liste os critérios de aceite cumpridos; me dê um roteiro curto de teste manual; NÃO FAÇA COMMITS. **Pare e espere** eu testar antes de seguir.
- Se uma decisão de produto não estiver neste prompt, **pergunte** em vez de inventar.
- Na Fase 0, salve este prompt em `docs/ESPECIFICACAO.md` e crie um `CLAUDE.md` com as regras da seção 3, para que as próximas conversas sigam o mesmo padrão.
- Caso pare em alguma etapa, marque onde parou para que eu tenha um contexto

---

## 1. Visão

App para Windows (Linux depois), instalado pelo usuário, para um grupo privado de 10–15 amigos, sem fins comerciais. Fluxo: a pessoa baixa o instalador num site, instala, cria conta, e o mestre manda um link + senha da sessão para os outros entrarem.

**Diferencial: construtor de fichas sem código.** O mestre monta o modelo de ficha do sistema dele (Ordem Paranormal, D&D, sistema próprio…) arrastando componentes numa grade, como numa planilha, com fórmulas e botões de rolagem. Os jogadores preenchem fichas criadas a partir desse modelo. **O app não conhece as regras de nenhum sistema**: tudo que é específico vem dos modelos.

Em volta disso: tabuleiro com mapas e tokens, grade, névoa de guerra, desenho, régua, dados, chat, iniciativa, bestiário e encontros, tudo sincronizado em tempo real.

## 2. Tecnologias

| Parte | Escolha | Observação |
|---|---|---|
| App desktop | Electron + electron-vite (template React + TS) | |
| Linguagem | TypeScript (strict) | |
| Interface | React, Tailwind CSS, shadcn/ui, lucide-react | tema escuro padrão |
| Estado | Zustand | um store por área |
| Rotas | React Router com **HashRouter** | BrowserRouter quebra no app empacotado (`file://`) |
| Tabuleiro | Konva (react-konva) | arrastar, redimensionar (Transformer), camadas, desenho |
| Construtor de fichas | react-grid-layout | grade arrastável, sem compactação automática |
| Listas ordenáveis | dnd-kit | |
| Dados | @dice-roller/rpg-dice-roller | com gerador criptográfico (`crypto.getRandomValues`) |
| Fórmulas | interpretador próprio (seção 5.4) | **nunca** `eval` / `new Function` |
| Validação | zod | modelos importados, entradas |
| Backend | Supabase: Auth, Postgres + RLS, Realtime, Storage, Edge Functions | plano grátis |
| Migrações | Supabase CLI (`supabase/migrations`, `supabase db push`) | sem Docker, direto no projeto na nuvem |
| Testes | Vitest | |
| Instalador | electron-builder (NSIS), registra o protocolo `rpgmesa://` | |
| Atualização | electron-updater + GitHub Releases | |
| Site | HTML estático no GitHub Pages | download + página de convite |

## 3. Regras de código (copiar para o CLAUDE.md)

- Identificadores, tabelas e arquivos em inglês; **textos da interface em português do Brasil**; comentários em português.
- Organização por feature: `src/renderer/src/features/<area>/`. Acesso ao banco só por funções em `src/renderer/src/lib/db/` (componentes não chamam `supabase.from` direto).
- Lógica pura (fórmulas, dados, migração de fichas, posicionamento, permissões) fora dos componentes, com testes Vitest.
- Toda mudança de banco é uma **nova** migração em `supabase/migrations/`; nunca editar migração já aplicada. Gerar tipos com `supabase gen types`.
- `.env` fora do Git com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; `.env.example` no Git.
- Mensagens de erro amigáveis em português (toast); atualização otimista com reversão se o banco recusar.
- Scripts: `dev`, `dev:p2` (segunda instância com outro perfil, para testar mestre e jogador no mesmo PC), `lint`, `typecheck`, `test`, `build:win`.

---

## 4. Fluxo, contas e sessões

```
Login (nome + senha)
   └─> Escolha de papel: Mestre ou Aventureiro
         ├─> Mestre: lobby do mestre → cria sessão (nome, senha, sistema) → tabuleiro
         └─> Jogador: lobby do jogador → cola o link/ID da sessão → senha → tabuleiro
```

### 4.1 Conta (nome + senha)
- Cadastro e login só com **nome de usuário + senha** (nome único, sem diferenciar maiúsculas; senha mín. 8 caracteres). Campo de nome de exibição separado.
- **Implementação: use o Supabase Auth por baixo**, não uma tabela própria de senhas. Gere um e-mail interno a partir do nome (ex.: `nome@usuarios.rpgmesa.app`), com confirmação de e-mail desligada; o usuário nunca vê esse e-mail. Motivo: o Auth guarda a senha com hash forte e com salt (SHA-256 puro é fácil de quebrar) e dá a cada usuário uma identidade (`auth.uid()`) que o RLS usa para proteger os dados. Sem isso, qualquer um com o app poderia ler ou apagar tudo.
- Se o Supabase recusar o formato do e-mail interno, use outro domínio fictício e me avise.
- Sem recuperação de senha por e-mail na v1: quem esquecer pede para mim, e eu redefino pelo painel do Supabase.
- Sessão de login persistente ("continuar conectado"); logout.

### 4.2 Escolha de papel
- Depois do login: **Mestre** ou **Aventureiro**. O papel não é fixo na conta: a mesma pessoa pode mestrar uma sessão e jogar em outra. Dá para trocar de lobby a qualquer momento.
- O app lembra a última sessão aberta e oferece "Voltar para <sessão>".

### 4.3 Lobby do mestre
- Lista as sessões que ele criou: entrar, **copiar convite**, excluir (confirmação).
- Criar sessão: nome, senha da sessão, **sistema** (= modelo de ficha de personagem da biblioteca dele; pode escolher depois), capa opcional.
- Acesso aos **Meus modelos de ficha** e à biblioteca do mestre (bestiário, encontros, galerias).
- Na sessão: trocar a senha, gerar novo ID de convite (o link antigo para de funcionar), remover jogador.

### 4.4 Lobby do jogador
- Entrar numa sessão nova colando o **link ou o ID** → tela de senha → tabuleiro.
- Lista das sessões de que já participa, para voltar (sem pedir senha de novo). Sair de uma sessão.

### 4.5 Convite e link direto
- A senha da sessão é verificada **no servidor** (RPC `join_session(invite_id, password)`), guardada com `crypt()`/bcrypt do pgcrypto.
- O mestre pode ver e copiar a senha a qualquer momento. Guarde-a também numa tabela que só o mestre lê. Gere por padrão uma senha amigável (ex.: `lobo-azul-42`) e mostre o aviso "não use uma senha pessoal".
- Link direto: deep link `rpgmesa://join/<inviteId>` abre o app direto na tela de senha (equivale à rota interna `/join/:inviteId`). Use instância única: se o app já estiver aberto, o link vai para a janela existente. Se não houver login, guarde o convite e continue depois do login.
- WhatsApp e Discord não deixam clicar em links `rpgmesa://`. Por isso, na fase de distribuição, o convite passa a ser `https://<site>/join?id=<inviteId>`: a página tenta abrir o app e, se ele não abrir, mostra "Baixar o app" e o ID para colar.
- "Copiar convite" gera um texto pronto: nome da sessão, link, senha.

---

## 5. Fichas (o coração do projeto)

### 5.1 Modelos de ficha (biblioteca do mestre)
- Criar, renomear, duplicar, excluir (bloqueado se em uso), exportar e importar `.json` (validado com zod, com limite de tamanho).
- Tipo: `character` (fichas dos jogadores) ou `creature` (monstros e NPCs do bestiário).
- **Rascunho × publicado:** o mestre edita um rascunho e clica em **Publicar**, que cria uma versão imutável. Jogadores sempre usam a última versão publicada.
- Vem com um modelo de exemplo genérico ("Exemplo d20"), sem conteúdo oficial de nenhum livro.

### 5.2 Construtor (editor visual)
- Layout: paleta de componentes à esquerda, ficha no centro, painel de propriedades à direita. Barra superior: nome, Desfazer/Refazer, Visualizar como jogador, Validar, Publicar, Exportar.
- Grade de 12 colunas: arrastar da paleta, mover, redimensionar com encaixe. Os itens ficam onde foram soltos.
- Abas (criar, renomear, reordenar, excluir), cada uma com sua grade.
- Selecionar → propriedades. Duplicar. Excluir avisa se a chave é usada em fórmulas.
- Desfazer/Refazer (Ctrl+Z / Ctrl+Y).
- Cada componente tem uma **chave** para as fórmulas, gerada do rótulo (`Força` → `forca`), única e editável. Renomear a chave atualiza as fórmulas que a usam. Os valores são salvos pelo **id imutável** do componente, não pela chave.
- **Visualizar como jogador** com valores de teste e fórmulas funcionando.
- **Validar** (também roda ao publicar): chave duplicada, fórmula inválida, referência inexistente, dependência circular, campo visível ao jogador que depende de campo só do mestre, papel `hp` ausente (aviso), papel repetido.
- Sem componentes aninhados na v1: o agrupamento é feito com abas, títulos de seção e tabelas.

### 5.3 Componentes da paleta
Propriedades comuns: rótulo, chave, dica, **quem edita** (jogador ou só mestre), **quem vê** (todos ou só mestre), **condição de visibilidade** (fórmula opcional, ex.: mostrar "Rituais" só se `classe == "Ocultista"`), papel (5.6), cor de destaque.

| Componente | Propriedades específicas | Valor salvo |
|---|---|---|
| Texto curto / Texto longo | placeholder, máx. caracteres | string |
| Número | mín, máx, passo, padrão | number |
| Caixa de seleção | padrão | boolean (vale 1/0 em fórmulas) |
| Lista de opções | opções com rótulo e valor numérico opcional | opção escolhida |
| Imagem | círculo ou retângulo | caminho no Storage |
| Título / seção | texto fixo decorativo | — |
| Atributo | mín, máx, fórmula do modificador usando `valor` (ex.: `piso((valor-10)/2)`) | number |
| Barra de recurso | máximo fixo ou por fórmula, cor, botões +/− | `{ current, max }` |
| Marcadores (bolinhas) | quantidade fixa ou por fórmula | number |
| Campo calculado | fórmula, formato (inteiro, com sinal "+2") | — (cache) |
| Botão de rolagem | fórmula de rolagem, regra de crítico, rótulo | — |
| Tabela / lista | colunas (texto, número, caixa, lista, calculado, botão de rolagem); linhas fixas do mestre e/ou o jogador pode adicionar; reordenar | `[{ id, cells }]` |

Exemplos de tabela: perícias (linhas fixas: Acrobacia, Furtividade…; colunas atributo, treino, bônus, total, rolar) e inventário (o jogador adiciona: item, peso, quantidade).

### 5.4 Linguagem de fórmulas
- Campo calculado começa com `=`: `=piso((forca - 10) / 2)`.
- Referências: `forca` (valor), `forca.mod` (modificador do atributo), `vida` (atual) e `vida.max`, `pericias.furtividade.total` (tabela.linha.coluna), `soma(inventario.peso)`, `contar(inventario)`. Dentro de uma tabela, colunas calculadas usam as colunas da própria linha pelo nome.
- Lista de opções devolve o valor numérico da opção, se houver; senão, o texto.
- Operadores: `+ - * / % ^`, parênteses, `== != < <= > >=`, `e`, `ou`, `nao`; textos entre aspas.
- Funções em português, com alias em inglês: `piso/floor`, `teto/ceil`, `arred/round`, `min`, `max`, `abs`, `se/if(cond, a, b)`, `soma/sum`, `contar/count`.
- Erro nunca quebra a ficha: o campo mostra `#ERRO`, com o motivo no tooltip.
- Recálculo por grafo de dependências; ciclos são detectados.
- Implementação: tokenizer + parser (Pratt) + avaliador em TypeScript puro, com testes.

### 5.5 Fórmulas de rolagem e crítico
- Notação: `2d6+3`, `1d20+5`, `4d6kh3`, `2d20kl1`, `3d6!`, `1d100`, `d20`.
- Trechos entre chaves são calculados antes da rolagem: `1d20 + {forca.mod} + {proficiencia}`, `{agilidade}d20kh1 + {pericias.furtividade.total}`.
- Cada chave pode devolver número ou texto, então dá para expressar regras como "atributo 0 → rola 2d20 e fica com o pior": `{se(agilidade == 0, 2, agilidade)}d20{se(agilidade == 0, "kl1", "kh1")}`.
- Regra de crítico por botão: nenhuma, natural (d20 mantido = 20) ou margem (d20 mantido ≥ `{margem}`, ex.: 19). Falha crítica no 1: liga/desliga. Na bandeja de dados livre, o padrão é natural 20/1 (configurável na sessão).
- Gerador aleatório criptográfico e injetável nos testes.

### 5.6 Papéis (ligação ficha ↔ mesa)
Como as fichas são dinâmicas, o app não sabe o que é "Vida" ou "Defesa". O mestre marca no construtor qual componente cumpre cada papel (no máximo um por papel):

| Papel | Componente | Usado em |
|---|---|---|
| `name` | texto curto | nome do token |
| `portrait` | imagem | imagem padrão do token |
| `hp` | barra de recurso | barra de vida do token, dano/cura, log de combate |
| `bar2`, `bar3` | barra de recurso | barras extras no token (ex.: Sanidade, PE) |
| `initiative` | botão de rolagem ou número (número → `1d20 + valor`) | rolar iniciativa |
| `defense` | número/calculado | tracker e card do token (CA/Defesa) |
| `vision` | número/calculado, em metros | raio de visão na névoa |

Ao salvar, o cliente calcula os campos e grava junto `computed` (cache dos calculados) e `bars` (resumo dos papéis). O banco copia `bars` para os tokens ligados à ficha. Assim, todos veem as barras no mapa sem ter acesso à ficha.

### 5.7 Ficha do jogador
- Na sessão, o jogador cria o personagem a partir do modelo da sessão (v1: um por jogador por sessão; o banco já permite vários).
- Mesmo renderizador do construtor, em modo de preenchimento, respeitando quem edita, quem vê, visibilidade condicional e fórmulas.
- **Salvamento automático campo a campo** (RPC de patch em jsonb), com indicador "Salvando…/Salvo". Nunca sobrescreva a ficha inteira: se o mestre aplicar dano enquanto o jogador edita o inventário, nenhum dos dois pode perder a alteração.
- Mudanças chegam em tempo real. Botões de rolagem mandam o resultado para o chat da sessão com rótulo ("Furtividade: 17").
- Campos "só mestre" ficam numa tabela separada que só o mestre lê, para que o jogador nem receba esses dados.
- Nova versão do modelo: componentes novos recebem o padrão; valores de componentes removidos ficam guardados (ocultos).
- O mestre abre, consulta e edita a ficha de qualquer jogador (aba Fichas).

---

## 6. Tabuleiro

### 6.1 Mapas e câmera
- **Biblioteca de mapas por sessão:** o mestre envia vários, renomeia, reordena, exclui e **ativa** um (todos passam a ver). O mestre pode abrir um mapa **sem ativar**, para prepará-lo; os jogadores só enxergam o mapa ativo (garantido no RLS).
- Upload: converter para WebP e limitar o maior lado a 4096 px antes de enviar.
- **Coordenadas compartilhadas:** cada mapa tem um tamanho lógico (o da imagem). Posições e tamanhos são salvos nessas coordenadas, nunca em pixels de tela, então todos veem as mesmas posições em qualquer monitor. Isso substitui o tabuleiro fixo de 1920×1080 com o mesmo objetivo, sem distorcer mapas que não são 16:9.
- Câmera individual: **zoom** (roda do mouse centrada no cursor, botões +/−, "caber na tela") e **mãozinha** (ferramenta, barra de espaço ou botão do meio). A câmera é lembrada por mapa. O mestre pode **focar a câmera de todos** num ponto.
- Tokens, desenhos, grade e névoa pertencem a cada mapa.
- Janela mínima de 1280×720; painéis recolhíveis quando a janela é pequena.

### 6.2 Grade e escala
- Só o mestre configura, e todos veem igual: ligar/desligar, tamanho da célula, deslocamento X/Y (para alinhar com a grade desenhada no mapa), cor e opacidade.
- Tokens encaixam na grade ao soltar (Alt solta livre).
- Escala da sessão: metros por quadrado (padrão **1,5 m**) e regra de diagonal (simples, alternada 1-2-1 ou real).

### 6.3 Tokens
- Tipos: **jogador** (cada um adiciona o seu, ligado à ficha), **monstro** e **NPC** (exclusivos do mestre, da galeria de cada tipo ou do bestiário) e **objeto**. Moldura colorida por tipo.
- Arrastar (os outros veem o movimento ao vivo, e a posição é salva ao soltar), **redimensionar** em quadrados, **renomear** (salvo no banco), **trocar a foto**, **reenquadrar a imagem** dentro do círculo (arrastar/zoom, sem reenviar) e **ampliar a imagem** em tela cheia.
- **Ocultar/revelar** (mestre): o token oculto não chega aos jogadores (RLS) e o mestre o vê semitransparente. O arrasto de token oculto não é transmitido.
- Mostrar o nome aos jogadores (liga/desliga, ex.: "???") e mostrar as barras aos jogadores (configurável por token).
- **Barras de status:** HP verde (>50%), amarela (>25%) ou vermelha, mais `bar2`/`bar3` opcionais, vindas da ficha pelos papéis. Um token sem ficha pode ter HP editável no próprio token.
- **Condições:** ícones sobre o token (lista configurável por sessão: Caído, Atordoado…), com duração opcional em rodadas.
- **Reações com emoji** (👍 😮 😱 ⚔️ 🎉 💀 ✨ ❤️): animação curta, transmitida em tempo real, não salva.
- Seleção por clique, Shift+clique ou caixa (mestre). Menu de contexto: ficha, renomear, imagem, condições, dano/cura, iniciativa, ocultar, trazer para frente, excluir.
- O jogador mexe só nos próprios tokens; o mestre mexe em todos. Excluir o token de um monstro instanciado exclui a ficha-instância dele.

### 6.4 Névoa de guerra (mestre)
- Liga/desliga por mapa. Revela círculos em volta dos tokens dos jogadores (raio = papel `vision`, ou valor do token, ou padrão da sessão, em metros convertidos pela escala).
- O mestre revela ou cobre áreas manualmente (retângulo e pincel); as áreas ficam salvas no mapa.
- O mestre vê através da névoa (semitransparente). Tokens de monstros sob a névoa não são desenhados para os jogadores. A névoa é aplicada no cliente; para esconder de verdade, usa-se "ocultar".

### 6.5 Desenho, régua e ping
- **Lápis, linha, círculo, retângulo e borracha**, com cor e espessura configuráveis. O traço aparece ao vivo enquanto é desenhado e é salvo ao terminar.
- A borracha apaga **traços inteiros** que tocar. O jogador apaga só os seus.
- **Ctrl+Z** desfaz os meus últimos traços. Botão "apagar meus desenhos". O mestre tem "limpar todos os desenhos".
- **Régua** em metros (escala e diagonal da sessão); os outros veem a medição enquanto ela existe.
- **Ping:** Alt+clique mostra um pulso no ponto para todos.

---

## 7. Dados, chat e combate

### 7.1 Dados
- Bandeja com **d4, d6, d8, d10, d12, d20 e d100**: clicar monta a rolagem (2× d6 = 2d6), com quantidade e modificador. Campo de **fórmula livre** (`2d6+3`, `1d20+5`).
- Vantagem e desvantagem rápidas. Fórmulas favoritas por sessão.
- **Rolagem secreta:** só o autor e o mestre veem.
- O resultado mostra cada dado (descartados riscados), o total e o destaque de **crítico / falha crítica** (5.5).
- Rolagens aparecem em tempo real para todos e ficam no **histórico**; o mestre tem um botão para excluir o histórico.

### 7.2 Chat
- Chat em tempo real com histórico salvo. As rolagens também aparecem no chat.
- **Sussurro** para um jogador ou para o mestre. O mestre vê todos os sussurros, e a interface informa isso aos jogadores.
- Comandos `/r 2d6+3` e `/w Nome mensagem`.
- Só texto puro (nunca HTML). Links abrem no navegador padrão.
- Contador de não lidas e som opcional ao receber sussurro. O mestre pode limpar o chat.

### 7.3 Combate
- **Tracker de iniciativa:** iniciar combate e adicionar participantes (selecionados, todos do mapa ou só jogadores); **rolar iniciativa** pelo papel `initiative` (criatura sem ficha usa `1d20`); editar valores; reordenar arrastando.
- Turno ativo destacado na lista e no mapa (brilho no token); o dono recebe o aviso "Sua vez!". **Próximo Turno** (mestre) ou "Encerrar meu turno" (jogador da vez); **contador de rodadas**. As durações das condições diminuem no turno do token. Participantes ocultos aparecem só para o mestre. Encerrar combate limpa o tracker.
- **Dano/cura:** selecionar token(s), informar o valor e clicar em Dano ou Cura. Altera o recurso de papel `hp`, limitado entre 0 e o máximo. Também dá para clicar numa rolagem do chat e escolher "aplicar como dano/cura nos selecionados". O mestre aplica em qualquer token; o jogador só nos próprios.
- **Log de combate:** quem aplicou, em quem, quanto, valor antes → depois e hora. Entradas sobre tokens ocultos só o mestre vê. O mestre pode limpar o log.

---

## 8. Ferramentas do mestre

- **Galerias** de imagens (Monstros, NPCs, Objetos), reutilizáveis entre sessões. É possível colocar um token direto da galeria, sem ficha.
- **Bestiário:** criaturas (monstro ou NPC) usando um modelo do tipo `creature`, com stat block totalmente dinâmico conforme o mestre modelou (HP, CA/Defesa, atributos, ataques, habilidades, botões de rolagem). Criar, editar, duplicar, excluir, buscar e filtrar por tags; imagem e tamanho padrão do token.
  - Ao colocar no mapa, cada token ganha uma **ficha-instância** (cópia), então Goblin 1 e Goblin 2 têm vida separada.
  - A imagem é copiada para a pasta da sessão. Os jogadores não têm acesso à galeria do mestre, o que evita spoilers.
- **Builder de encontros:** monta grupos (criatura + quantidade + "começa oculta"), salva para reutilizar e **spawna tudo com um clique** no mapa aberto. Posiciona em grade, sem sobreposição, perto do centro da visão do mestre, com **numeração automática** (Goblin 1, Goblin 2…, continuando se já houver goblins no mapa). Opção de adicionar ao combate.
- **Puxar jogadores:** coloca o token de todos os jogadores da sessão no mapa aberto, em grade e sem sobreposição; quem já está no mapa é ignorado (opção de reagrupar). O HP vem da ficha automaticamente pelos papéis.
- **Fichas dos jogadores:** aba para abrir e consultar a ficha de qualquer jogador da sessão.

## 9. Perfil

- Ver nome e avatar; editar a **bio**, o nome de exibição e o avatar (upload com recorte circular).
- **Excluir todas as minhas sessões:** apaga as sessões que mestro (dados e imagens) e me tira das que jogo.
- **Excluir conta:** tudo acima, mais fichas, bibliotecas, imagens e o usuário, via Edge Function (precisa da chave secreta, que fica só no servidor).
- As duas ações pedem **confirmação digitando o nome**.

---

## 10. Backend, tempo real e segurança

### 10.1 Tabelas (Postgres) e acesso (RLS)

| Tabela | Campos principais | Quem acessa |
|---|---|---|
| `profiles` | id (= `auth.uid()`), username, display_name, avatar_path, bio | logados leem; dono edita |
| `sheet_templates` | id, owner_id, name, kind, draft_schema | dono |
| `sheet_template_versions` | template_id, version, schema (imutável) | dono; membros das sessões que usam o modelo leem |
| `sessions` | id, gm_id, name, invite_id, password_hash, character_template_id, active_map_id, settings (escala, diagonal, condições, crítico, visão padrão) | membros leem; mestre edita |
| `session_secrets` | session_id, password (texto, para o mestre copiar) | só mestre |
| `session_members` | session_id, user_id, role (`gm`/`player`), joined_at | membros leem; entrada só via RPC; mestre remove; jogador sai |
| `maps` | id, session_id, name, image_path, width, height, grid, fog, sort_order | mestre todos; jogador só o ativo |
| `sheets` | id, session_id, owner_id, template_id, template_version, kind (`character`/`creature_instance`), values, computed, bars, orphaned | dono + mestre (instâncias: só mestre); escrita via RPC de patch |
| `sheet_gm_data` | sheet_id, values | só mestre |
| `tokens` | id, session_id, map_id, sheet_id, kind, owner_id, name, image_path, image_crop, x, y, size, z, hidden, show_name, show_bars, vision_m, bars, conditions | mestre todos; jogador vê os não ocultos do mapa ativo e edita os próprios |
| `drawings` | id, map_id, author_id, tool, points, color, width | membros veem; autor cria/apaga; mestre apaga qualquer um |
| `rolls` | id, session_id, author_id, label, formula, result, total, outcome, secret | membros (secretas: autor + mestre); mestre apaga |
| `messages` | id, session_id, author_id, recipient_id, body | públicas: membros; sussurro: autor, destinatário e mestre |
| `combat_state` / `combat_entries` / `combat_log` | rodada, turno, participantes, iniciativa, entradas do log | membros leem (ocultos só mestre); escrita pelo mestre e por RPC |
| `creatures`, `encounters`, `gallery_images`, `dice_macros` | biblioteca do mestre / favoritos do usuário | dono |

- RLS ligado em **todas** as tabelas, com funções auxiliares `is_member(session_id)` e `is_gm(session_id)`.
- RPCs atômicas: `create_session`, `join_session`, `regenerate_invite`, `set_session_password`, `patch_sheet` (aplica só os campos alterados e copia `bars` para os tokens), `apply_hp_change`, `combat_next_turn`, `combat_end_my_turn`, `spawn_encounter`, `pull_players`, `delete_my_sessions`.

### 10.2 Imagens (Storage)
- Bucket público `avatars`. Bucket privado `assets` com `users/{uid}/gallery/…` (só o dono) e `sessions/{sessionId}/maps|tokens|portraits/…` (membros leem; mestre escreve; jogador escreve em `tokens/` e `portraits/`).
- Sempre converter para WebP no cliente; **nome do arquivo = hash do conteúdo** (evita duplicatas e permite cache eterno). Cache local das imagens baixadas, para economizar o tráfego do plano grátis.
- Ao excluir mapa, sessão ou conta, apagar os arquivos pela API do Storage (não existe exclusão em cascata).

### 10.3 Tempo real
- Um canal **privado** por sessão (`session:{id}`), autorizado por política que exige ser membro.
- `postgres_changes` (filtrado por sessão e respeitando o RLS) para tokens, mapas, sessão, desenhos, rolagens, mensagens, combate, fichas e membros. Eventos DELETE chegam só com o id.
- Broadcast (efêmero, não salvo): arrasto de token (~20/s, nunca de token oculto), traço em andamento, régua, ping, reações, foco de câmera.
- Presença: quem está online, mostrado no topo da sessão.
- Ao entrar, carregar um snapshot completo e depois aplicar os eventos. Ao reconectar, mostrar "Reconectando…" e recarregar o snapshot.

### 10.4 Segurança (checklist)
- Senhas de conta só no Supabase Auth; senha de sessão verificada no servidor.
- No app vai só a chave pública (anon/publishable). A chave secreta (service_role/secret) fica só nas Edge Functions e nunca no repositório.
- Electron: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, preload mínimo via `contextBridge`, bloquear navegação e janelas novas, links externos via `shell.openExternal` (só http/https), Content-Security-Policy liberando apenas o app, o domínio do Supabase (https e wss), `blob:` e `data:` para imagens.
- Conteúdo de usuário sempre como texto (sem `dangerouslySetInnerHTML`).
- Fórmulas sem `eval`; JSON importado validado com zod.
- Uploads: só imagens, no máximo 15 MB antes da compressão.
- Nenhum token do GitHub dentro do app. Se o código for privado, publicar os instaladores num repositório público só de releases.
- As rolagens são feitas no cliente, por confiança entre amigos.

---

## 11. Fases

Cada fase termina com algo que eu consigo abrir e testar.

**Fase 0 — Fundação**
- [ ] Projeto electron-vite (React + TS) com Tailwind, shadcn/ui, lucide, Zustand, HashRouter, ESLint/Prettier e Vitest.
- [ ] Estrutura de pastas, `CLAUDE.md`, `docs/ESPECIFICACAO.md`, `.gitignore`, `.env.example`, Git iniciado.
- [ ] Segurança do Electron (10.4). Telas vazias navegáveis (Login, Escolha de papel, Lobbies, Sessão, Construtor) em tema escuro.
- [ ] `npm run dev:p2` abre uma segunda instância com outro perfil de dados.
- [ ] `npm run build:win` gera um instalador que instala e abre o app.

**Fase 1 — Motor de fórmulas e dados** (sem interface)
- [ ] Linguagem de fórmulas (5.4), grafo de dependências com detecção de ciclo, fórmulas de rolagem com `{…}` e regras de crítico (5.5).
- [ ] Testes: `piso((forca-10)/2)` com 15 → 2 e com 8 → −1; `soma(inventario.peso)`; ciclo `a=b+1, b=a+1` → erro; `{agilidade}d20kh1`; o exemplo do atributo 0 → `2d20kl1`; crítico natural e por margem; fórmula inválida não lança exceção.

**Fase 2 — Construtor de fichas** (salvando localmente, atrás de uma interface de repositório)
- [ ] Tudo da seção 5.2 e 5.3, papéis (5.6), rascunho/publicar, exportar/importar.
- [ ] Aceite: consigo montar uma ficha no estilo Ordem Paranormal e outra no estilo D&D 5e, com atributos, perícias em tabela, vida com máximo calculado e botões de rolagem funcionando na visualização.

**Fase 3 — Ficha preenchível**
- [ ] Renderizador em modo de preenchimento (5.7): permissões, visibilidade condicional, tabelas, barras, marcadores, botões de rolagem (resultado num painel local por enquanto), migração entre versões, cálculo de `computed` e `bars`.

**Fase 4 — Contas e Supabase**
- [ ] Projeto Supabase + CLI; migração com `profiles`, modelos e versões, RLS, bucket `avatars`.
- [ ] Cadastro/login por nome + senha (4.1), escolha de papel (4.2), continuar conectado, logout.
- [ ] Perfil: nome de exibição, avatar e bio. Modelos de ficha passam a ser salvos no Supabase.

**Fase 5 — Sessões e convites**
- [ ] Tabelas de sessão, membros, segredos, fichas e dados do mestre, com RLS e RPCs.
- [ ] Lobby do mestre e do jogador (4.3, 4.4), copiar convite, trocar senha, novo ID, remover jogador, sair, excluir sessão (com arquivos).
- [ ] Entrar por link/ID + senha; deep link `rpgmesa://join/<id>` com instância única, inclusive sem login. No Windows, o teste definitivo é com o app instalado.
- [ ] Canal privado + presença. O jogador cria o personagem; o mestre vê todas as fichas; salvamento campo a campo em tempo real.
- [ ] Aceite: com duas instâncias, o mestre cria e convida, o jogador entra, e os dois editam a mesma ficha ao mesmo tempo sem perder dados.

**Fase 6 — Tabuleiro e tokens**
- [ ] Mapas, tokens e galerias, com RLS e bucket `assets`; upload em WebP; cache de imagens.
- [ ] Biblioteca de mapas, ativar, preparar sem ativar; câmera (zoom, mãozinha, caber na tela, foco do mestre); grade e escala (6.1, 6.2).
- [ ] Tokens completos (6.3), exceto condições; barras vindas da ficha; reconexão com snapshot.
- [ ] Aceite: três janelas de tamanhos diferentes veem os mesmos tokens nas mesmas posições; token oculto não chega ao jogador.

**Fase 7 — Dados e chat**
- [ ] Bandeja de dados (7.1), rolagens das fichas indo para a sessão, histórico com limpeza pelo mestre.
- [ ] Chat com sussurro, comandos e não lidas (7.2).

**Fase 8 — Desenho, régua, ping e reações** (6.5 e reações do 6.3)

**Fase 9 — Combate** (7.3 completo, incluindo condições com duração)

**Fase 10 — Ferramentas do mestre** (seção 8: bestiário, fichas-instância, encontros, puxar jogadores)

**Fase 11 — Névoa de guerra** (6.4), fluida ao arrastar tokens com a névoa ligada

**Fase 12 — Distribuição e conta**
- [ ] Site no GitHub Pages: página de download do último release, com instruções para o aviso "O Windows protegeu o computador" (Mais informações → Executar assim mesmo), e a página `/join?id=` que abre o app ou mostra o download e o ID.
- [ ] O convite passa a usar o link https.
- [ ] GitHub Actions: uma tag `v*` gera o instalador e publica no GitHub Releases; atualização automática com o aviso "Nova versão: reiniciar".
- [ ] Excluir todas as minhas sessões e excluir conta (seção 9); tela de Configurações (sons, limpar cache, versão, verificar atualização, sair).

**Fase 13 — Polimento**
- [ ] Atalhos de teclado (V selecionar, H mãozinha, R régua, D desenho, E borracha, Del, Esc, +/−, F caber, Enter chat, N próximo turno) e tela de ajuda.
- [ ] Notas privadas do mestre e **Pistas** (imagem/texto revelados para todos ou para jogadores escolhidos).
- [ ] Abrir a ficha em janela separada (segundo monitor); estados vazios, carregamentos e erros; 60 fps com mapa de 4096 px e 50 tokens.

## 12. Fora do escopo da v1 (não implementar sem eu pedir)

- Celular (o Electron não roda em celular; no futuro dá para reaproveitar o React num app web/PWA ou com Capacitor) e Linux (o código já é compatível, só falta testar).
- Voz e vídeo (usamos o Discord), login com Discord, dados 3D, música ambiente.
- Névoa com paredes/linha de visão, grade hexagonal, co-mestre, componentes aninhados, backup da sessão, rolagens no servidor.
- Conteúdo oficial de livros embutido no app.

**Comece pela Fase 0: me mostre o plano e espere meu ok.**

---

# Apêndice — decisões tomadas depois do prompt

Combinado na conversa da Fase 0 (27/10/2026):

1. **Nome do produto: "Cantinho Nerd"** (não "RPG Mesa"). O esquema do deep link continua
   `rpgmesa://`, e o `appId` é `app.rpgmesa.cantinhonerd`.
2. **Projeto Supabase já existente:** `https://bpxtvjlkkuxkxhxyjlbl.supabase.co`, livre para
   remodelar — as tabelas atuais podem ser substituídas pelas migrações deste projeto.
3. **Nada é reaproveitado do projeto anterior** que vivia neste repositório (uma VTT web com
   D&D 5e e Ordem Paranormal fixos em código). O app é construído do zero conforme este
   documento. O código antigo continua no histórico do Git, se um dia fizer falta.
4. **Gerenciador de pacotes: npm** (o bun não está instalado nesta máquina).
