
# Cantinho Nerd - Mesa Virtual de RPG

Fala, galera! Esse é o **Cantinho Nerd**, uma mesa virtual de RPG feita especialmente pro nosso grupo de amigos jogar D&D e outros sistemas de forma remota. Nada de coisa super profissional — é só um projeto feito com carinho pra gente se divertir nas sessões sem precisar depender de plataformas pagas ou cheias de anúncio.

---

## O que esse projeto faz?

Basicamente, é uma VTT (Virtual Tabletop) simples onde o mestre pode criar sessões e os jogadores podem entrar pra jogar. Agora o projeto suporta múltiplos sistemas por sessão:

- **D&D 5e** — Sistema clássico de fantasia medieval
- **Ordem Paranormal RPG** — Sistema brasileiro de horror paranormal (Cellbit/Jambô Editora)

Dá pra:

### Tabuleiro/Mapa
- Upload de mapas customizados
- Tokens de personagens e monstros que você arrasta pelo mapa
- Grade sobreposta configurável (pra contar casas de movimento)
- Ferramentas de desenho (lápis, formas, régua pra medir distâncias)
- Zoom in/out no mapa

### Sistema de Dados
- Rolagem de todos os dados clássicos (d4, d6, d8, d10, d12, d20, d100)
- Fórmulas customizadas tipo `2d6+3` ou `1d20+5`
- Detecção automática de **crítico** e **falha crítica** no d20
- As rolagens aparecem em tempo real pra todo mundo na sessão
- Histórico de rolagens salvo no banco
- **Ordem Paranormal:** Rolagem de Pânico (1d20 com tabela de efeitos), Dado de Esforço da classe, Referência de dificuldades (CD 10/15/20/25/30)

### Chat
- Chat em tempo real durante a sessão
- Sistema de sussurro (whisper) pra mandar mensagens privadas pro mestre ou outro jogador

### Ficha de Personagem

#### D&D 5e
- Ficha completa com atributos (FOR/DES/CON/INT/SAB/CAR)
- Perícias, testes de resistência, proficiências
- Sistema de magias com espaços por nível
- Inventário, ataques, equipamentos
- Raças, classes e subclasses do PHB
- Cálculo automático de CA, HP, bônus de proficiência

#### Ordem Paranormal RPG
- Ficha completa com atributos (AGI/FOR/INT/PRE/VIG)
- 28 perícias com 4 níveis de proficiência (sem treino, treinado, veterano, expert)
- Sistema de NEX (Nível de Exposição ao Paranormal) de 5% a 99%
- 4 classes: Mundano, Ocultista, Combatente, Especialista
- Recursos: PV (Pontos de Vida), PS (Pontos de Sanidade), PE (Pontos de Esforço)
- **Aba de Combate:** Ataques, defesa, proteção, deslocamento, morte iminente, 12 condições (agarrado, caído, envenenado, etc.)
- **Aba de Rituais:** Lista de rituais com círculo (1-4), elemento (Morte/Sangue/Energia/Conhecimento), custo em PE, criação de rituais customizados
- **Aba de Inventário:** Equipamentos, armas, armaduras, itens paranormais, dinheiro em R$, criação de itens customizados
- **Aba de Bestiário (Mestre):** Criação e gerenciamento de criaturas paranormais com NEX, PV, defesa, ataques e habilidades especiais

### Recursos específicos de Ordem Paranormal
- Seleção de sistema ao criar sessão no lobby do mestre
- Rolagem de Pânico no painel de dados (1d20 com lookup na tabela de efeitos)
- Rolagem de Dado de Esforço baseado na classe do personagem
- Referência rápida de dificuldades (Fácil 10, Médio 15, Difícil 20, Absurdo 25, Impossível 30)
- Sistema de condições de combate (12 condições com efeitos mecânicos)
- Criação de rituais, itens e criaturas customizados (com aprovação do mestre)
- Cálculo automático de PV máximo baseado em classe, VIG e NEX
- Cálculo automático de PE máximo baseado em classe e NEX

### Ferramentas extras
- Calculadora de combate
- Emojis/reações nos tokens (pra marcar quem tá stunado, em chamas, etc)
- Sistema de sessões (o mestre cria, jogadores entram por link ou código)

---

## Tecnologias usadas

| O que | Pra que |
|-------|---------|
| **React + TypeScript** | Frontend da aplicação |
| **Vite** | Build rápido e dev server |
| **Tailwind CSS** | Estilização bonita e rápida |
| **Shadcn/ui** | Componentes de UI prontos e customizáveis |
| **Supabase** | Backend (banco de dados, autenticação, realtime) |
| **Framer Motion** | Animações suaves |
| **React Query** | Gerenciamento de estado do servidor |
| **Vitest + Playwright** | Testes |

---

## Como rodar localmente

1. **Instale as dependências:**
```bash
npm install
# ou
bun install
```

2. **Configure as variáveis de ambiente:**
Crie um arquivo `.env` na raiz com suas credenciais do Supabase:
```env
VITE_SUPABASE_URL=sua_url_aqui
VITE_SUPABASE_ANON_KEY=sua_chave_aqui
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

## Estrutura do projeto

```
cantinho-nerd/
├── src/
│   ├── components/     # Componentes React
│   │   ├── GameBoard.tsx      # Tabuleiro principal
│   │   ├── DiceRoller.tsx     # Sistema de dados
│   │   ├── ChatPanel.tsx      # Chat da sessão
│   │   ├── CharacterSheet.tsx # Ficha de personagem
│   │   ├── CharacterSheetOP.tsx # Ficha de Ordem Paranormal
│   │   ├── DrawingCanvas.tsx  # Ferramentas de desenho
│   │   └── ...
│   ├── pages/          # Páginas da aplicação
│   ├── lib/            # Utilitários e contextos
│   ├── hooks/          # Custom hooks
│   └── integrations/   # Integrações (Supabase)
├── docs/               # Documentação e referências utiizadas para montar o sistema de fichas
└── public/             # Estáticos
```

---

## Coisas que ainda precisam de ajuste

Tem um arquivo `docs/Features.md` com os bugs conhecidos e ideias de melhorias.

Para detalhes completos sobre a implementação de Ordem Paranormal, consulte `docs/OrdemParanormal-Rotas.md`.

## Sistemas Suportados

### D&D 5e
- 12 classes do PHB (Bárbaro, Bardo, Clérigo, Druida, Guerreiro, Ladino, Mago, Monge, Paladino, Patrulheiro, Feiticeiro, Bruxo)
- 13 raças (Humano, Elfos, Anões, Halflings, Gnomos, Meio-Elfo, Meio-Orc, Tiefling, Draconato)
- 12 antecedentes (Acólito, Criminoso, Herói do Povo, Nobre, Sábio, Soldado, etc.)
- Sistema de magias com espaços por nível (conjuradores completos, meio-conjuradores, magia do pacto)
- Cálculo automático de CA baseado em armadura, escudo e classe

### Ordem Paranormal RPG
- 4 classes (Mundano, Ocultista, Combatente, Especialista)
- 28 perícias vinculadas a 5 atributos (AGI, FOR, INT, PRE, VIG)
- Sistema de NEX (5% a 99%) que escala PV, PE e habilidades
- 40+ rituais pré-definidos em 4 círculos (Morte, Sangue, Energia, Conhecimento)
- Sistema de criação de rituais, itens e criaturas customizados
- 12 condições de combate (agarrado, caído, inconsciente, paralisado, envenenado, cego, surdo, enfraquecido, apavorado, atordoado, exausto, sangrando)
- Tabela de Pânico (20 efeitos diferentes quando PS chega a 0)
- Sistema de Morte Iminente (rolagem 1d20 por rodada quando PV chega a 0)
- Armas, armaduras e equipamentos brasileiros (preços em R$)
- Bestiário com sistema de criação de criaturas paranormais

## Diversão

Esse projeto tem finalidade de melhorar a experiência dos meus amigos ao jogar D&D, com isso trata-se de um projeto
simples que deve ser feito no meu tempo livre. 