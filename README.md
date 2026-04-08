
# Cantinho Nerd - Mesa Virtual de RPG

Fala, galera! Esse é o **Cantinho Nerd**, uma mesa virtual de RPG feita especialmente pro nosso grupo de amigos jogar D&D e outros sistemas de forma remota. Nada de coisa super profissional — é só um projeto feito com carinho pra gente se divertir nas sessões sem precisar depender de plataformas pagas ou cheias de anúncio.

---

## O que esse projeto faz?

Basicamente, é uma VTT (Virtual Tabletop) simples onde o mestre pode criar sessões e os jogadores podem entrar pra jogar. Dá pra:

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

### Chat
- Chat em tempo real durante a sessão
- Sistema de sussurro (whisper) pra mandar mensagens privadas pro mestre ou outro jogador

### Ficha de Personagem
- Ficha de D&D 5e integrada
- Cada jogador tem sua própria ficha
- O mestre consegue ver as fichas de todos os players

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

## Diversão

Esse projeto tem finalidade de melhorar a experiência dos meus amigos ao jogar D&D, com isso trata-se de um projeto
simples que deve ser feito no meu tempo livre. 