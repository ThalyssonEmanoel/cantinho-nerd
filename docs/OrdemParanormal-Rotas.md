# Ordem Paranormal — Documentação de Rotas e Implementação

## Contexto

O Cantinho Nerd atualmente suporta apenas D&D 5e. A proposta é transformar o site em uma
plataforma multi-sistema, onde o primeiro novo sistema a ser adicionado é **Ordem Paranormal RPG**
(sistema brasileiro criado por Cellbit, publicado pela Jambô Editora).

A implementação deve reutilizar ao máximo a infraestrutura já existente (Supabase, realtime,
sessões, tokens, chat, dados) e adicionar apenas o que é específico do sistema.

---

## Visão Geral da Mudança de Arquitetura

Hoje o site assume que toda sessão é D&D. Com a adição de múltiplos sistemas, o fluxo passa a ser:

```
Login → RoleSelection → DmLobby (escolhe sistema ao criar sessão)
                              ↓
                    GameBoard (carrega ferramentas do sistema correto)
                              ↓
                    CharacterSheet (ficha do sistema correto)
```

A tabela `sessions` receberá uma nova coluna `system` (`'dnd5e' | 'ordem_paranormal' | ...`).

---

## Rotas da Aplicação

### Rotas Existentes (sem alteração)

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/` | `Index.tsx` | Ponto de entrada — login, seleção de role, lobby, jogo |
| `/join/:sessionId` | `JoinPage.tsx` | Entrada direta por link compartilhado |
| `*` | `NotFound.tsx` | Página 404 |

### Novas Rotas Propostas

Nenhuma rota nova de página é necessária — o sistema é determinado pela sessão, não pela URL.
A diferenciação acontece dentro dos componentes existentes com base em `session.system`.

---

## Banco de Dados — Alterações Necessárias

### 1. Coluna `system` na tabela `sessions`

```sql
ALTER TABLE sessions
ADD COLUMN system TEXT NOT NULL DEFAULT 'dnd5e';
```

Valores válidos: `'dnd5e'`, `'ordem_paranormal'`

### 2. Tabela `character_sheets` (já existe, mas não está no schema tipado)

A tabela já armazena a ficha como JSON (`data: Json`). A ficha de Ordem Paranormal será um
objeto diferente salvo nessa mesma tabela — o campo `system` da sessão indica qual schema de
ficha esperar.

Estrutura atual (já funciona):
```sql
-- Já existe, apenas documentando
CREATE TABLE character_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, player_id)
);
```

### 3. Atualizar `types.ts` do Supabase

Adicionar `character_sheets` e `session_messages` ao schema tipado (atualmente usam `as any`).

---

## Componentes — O que Muda e o que é Novo

### Componentes Existentes com Alteração Mínima

| Componente | Alteração |
|-----------|-----------|
| `DmLobby.tsx` | Adicionar seletor de sistema ao criar sessão |
| `GameBoard.tsx` | Passar `session.system` para `CharacterSheet` |
| `DiceRoller.tsx` | Adicionar dados específicos de OP (d4, d6, d8, d10, d12, d20 — já existem; adicionar lógica de **Dados de Esforço** e **Dados de Pânico**) |

### Componente Novo Principal

| Componente | Arquivo | Descrição |
|-----------|---------|-----------|
| `CharacterSheetOP.tsx` | `src/components/CharacterSheetOP.tsx` | Ficha completa de Ordem Paranormal |

### Lógica de Seleção de Ficha (em `GameBoard.tsx`)

```tsx
// Onde hoje renderiza <CharacterSheet />
{charSheetTarget && (
  session?.system === 'ordem_paranormal'
    ? <CharacterSheetOP ... />
    : <CharacterSheet ... />
)}
```

---

## Ficha de Ordem Paranormal — Estrutura de Dados

### Interface `OPSheetData`

```typescript
export interface OPSheetData {
  // ── Identidade ──────────────────────────────
  nomePersonagem: string;
  nomeJogador: string;
  classe: OPClasse;           // Mundano, Ocultista, Combatente, Especialista
  origem: string;             // Policial, Médico, Hacker, etc.
  nex: number;                // 5% a 99% (Nível de Exposição ao Paranormal)
  trilha: OPTrilha;           // Sobrevivência, Sanidade, Morte
  
  // ── Atributos (3 a 5 pontos base) ───────────
  agi: number;  // Agilidade
  for: number;  // Força
  int: number;  // Intelecto
  pre: number;  // Presença
  vig: number;  // Vigor
  
  // ── Perícias ────────────────────────────────
  pericias: Record<string, OPProficiencia>; // 0 = sem treino, 1 = treinado, 2 = veterano, 3 = expert
  
  // ── Pontos de Vida e Sanidade ────────────────
  maxPV: number;
  pvAtual: number;
  maxPS: number;              // Pontos de Sanidade
  psAtual: number;
  maxPE: number;              // Pontos de Esforço
  peAtual: number;
  
  // ── Defesa e Deslocamento ────────────────────
  defesa: number;
  deslocamento: number;       // padrão 9m
  
  // ── Proteção ────────────────────────────────
  protecao: number;           // redução de dano
  
  // ── Rituais ─────────────────────────────────
  rituais: OPRitual[];
  
  // ── Habilidades de Classe ────────────────────
  habilidades: string;
  
  // ── Equipamentos e Inventário ────────────────
  equipamentos: OPItem[];
  dinheiro: number;           // em reais (R$)
  
  // ── Ataques ─────────────────────────────────
  ataques: OPAtaque[];
  
  // ── Pânico ──────────────────────────────────
  panico: number;             // 0 a 5 (nível de pânico atual)
  
  // ── Anotações ───────────────────────────────
  anotacoes: string;
  
  // ── Morte e Trauma ───────────────────────────
  morteIminente: boolean;
  traumas: string[];
}

type OPClasse = 'Mundano' | 'Ocultista' | 'Combatente' | 'Especialista';
type OPTrilha = 'Sobrevivência' | 'Sanidade' | 'Morte';
type OPProficiencia = 0 | 1 | 2 | 3;

interface OPRitual {
  nome: string;
  circulo: number;            // 1 a 5
  elemento: string;           // Morte, Sangue, Energia, Conhecimento, etc.
  execucao: string;           // Ação, Ação Bônus, Reação, etc.
  alcance: string;
  custo: string;              // ex: "2 PE"
  descricao: string;
}

interface OPItem {
  nome: string;
  qtd: number;
  peso: number;
  descricao: string;
}

interface OPAtaque {
  nome: string;
  bonus: string;
  dano: string;
  tipo: string;               // Balístico, Cortante, Contundente, etc.
  critico: string;            // ex: "20 / x2"
  alcance: string;
}
```

---

## Dados de Ordem Paranormal — Regras Especiais

O sistema usa os mesmos dados físicos (d4 a d20), mas com mecânicas próprias:

### Dados de Esforço (PE)
- Cada classe tem um **Dado de Esforço** diferente:
  - Mundano: d6
  - Especialista: d8
  - Combatente: d10
  - Ocultista: d6

### Teste de Perícia
- Rola **1d20 + atributo vinculado**
- Dificuldade: Fácil (10), Médio (15), Difícil (20), Absurdo (25), Impossível (30)
- O `DiceRoller` deve exibir essas dificuldades como referência

### Dado de Pânico
- Quando PS chega a 0 ou em situações de horror, rola **1d20**
- Resultado determina o efeito de pânico (tabela de 1 a 20)
- O `DiceRoller` deve ter um botão "Rolar Pânico" quando o sistema for OP

### Morte Iminente
- Quando PV chega a 0, o personagem entra em **Morte Iminente**
- A cada rodada rola 1d20: 1-9 = perde 1 PV (morre se chegar a -5), 10-20 = estabiliza

---

## Perícias de Ordem Paranormal

```typescript
export const OP_PERICIAS: { nome: string; atributo: keyof OPAtributos; label: string }[] = [
  { nome: 'acrobacia',        atributo: 'agi', label: 'Acrobacia' },
  { nome: 'adestramento',     atributo: 'pre', label: 'Adestramento' },
  { nome: 'atletismo',        atributo: 'for', label: 'Atletismo' },
  { nome: 'atualidades',      atributo: 'int', label: 'Atualidades' },
  { nome: 'ciencias',         atributo: 'int', label: 'Ciências' },
  { nome: 'crime',            atributo: 'agi', label: 'Crime' },
  { nome: 'diplomacia',       atributo: 'pre', label: 'Diplomacia' },
  { nome: 'enganacao',        atributo: 'pre', label: 'Enganação' },
  { nome: 'fortitude',        atributo: 'vig', label: 'Fortitude' },
  { nome: 'furtividade',      atributo: 'agi', label: 'Furtividade' },
  { nome: 'iniciativa',       atributo: 'agi', label: 'Iniciativa' },
  { nome: 'intimidacao',      atributo: 'pre', label: 'Intimidação' },
  { nome: 'intuicao',         atributo: 'pre', label: 'Intuição' },
  { nome: 'investigacao',     atributo: 'int', label: 'Investigação' },
  { nome: 'luta',             atributo: 'for', label: 'Luta' },
  { nome: 'medicina',         atributo: 'int', label: 'Medicina' },
  { nome: 'ocultismo',        atributo: 'int', label: 'Ocultismo' },
  { nome: 'percepcao',        atributo: 'pre', label: 'Percepção' },
  { nome: 'pilotagem',        atributo: 'agi', label: 'Pilotagem' },
  { nome: 'pontaria',         atributo: 'agi', label: 'Pontaria' },
  { nome: 'profissao',        atributo: 'int', label: 'Profissão' },
  { nome: 'reflexos',         atributo: 'agi', label: 'Reflexos' },
  { nome: 'religiao',         atributo: 'int', label: 'Religião' },
  { nome: 'resiliencia',      atributo: 'pre', label: 'Resiliência' },
  { nome: 'sobrevivencia',    atributo: 'int', label: 'Sobrevivência' },
  { nome: 'tatica',           atributo: 'int', label: 'Tática' },
  { nome: 'tecnologia',       atributo: 'int', label: 'Tecnologia' },
  { nome: 'vontade',          atributo: 'pre', label: 'Vontade' },
];
```

---

## Classes de Ordem Paranormal

```typescript
export const OP_CLASSES: Record<OPClasse, OPClasseData> = {
  'Mundano': {
    dadoVida: 20,
    dadoEsforco: 6,
    atributosPrimarios: ['agi', 'for', 'int', 'pre', 'vig'], // todos
    descricao: 'Pessoa comum sem poderes paranormais. Mais PV, sem rituais.',
    habilidades: 'Sortudo (rerrola 1 dado por cena), Especialista (dobra bônus em 2 perícias)',
  },
  'Ocultista': {
    dadoVida: 8,
    dadoEsforco: 6,
    atributosPrimarios: ['int', 'pre'],
    descricao: 'Usa rituais e magia paranormal. Menos PV, mais poder arcano.',
    habilidades: 'Acesso a rituais, Magia Paranormal, Foco em PE',
  },
  'Combatente': {
    dadoVida: 16,
    dadoEsforco: 10,
    atributosPrimarios: ['for', 'agi', 'vig'],
    descricao: 'Especialista em combate físico e tático.',
    habilidades: 'Ataque Extra, Manobras de Combate, Resistência',
  },
  'Especialista': {
    dadoVida: 12,
    dadoEsforco: 8,
    atributosPrimarios: ['agi', 'int'],
    descricao: 'Habilidoso em perícias específicas. Equilibrado.',
    habilidades: 'Especialização, Truques, Habilidades de Trilha',
  },
};
```

---

## Plano de Implementação — Ordem de Execução

### Fase 1 — Infraestrutura (sem UI nova)
1. Rodar migration SQL: adicionar coluna `system` em `sessions`
2. Atualizar `types.ts` com `character_sheets` e `session_messages`
3. Criar arquivo `src/lib/systems.ts` com constantes e tipos dos sistemas

### Fase 2 — Seleção de Sistema no Lobby
4. Atualizar `DmLobby.tsx`: adicionar seletor de sistema (D&D 5e / Ordem Paranormal)
5. Atualizar `createSession` para salvar `system` no banco

### Fase 3 — Ficha de Ordem Paranormal
6. Criar `src/components/CharacterSheetOP.tsx` com todas as abas:
   - **Principal**: identidade, atributos, perícias
   - **Combate**: PV, PS, PE, defesa, ataques, morte iminente
   - **Rituais**: lista de rituais com círculo e elemento
   - **Inventário**: equipamentos, dinheiro
7. Atualizar `GameBoard.tsx` para renderizar a ficha correta por sistema

### Fase 4 — Dados Específicos de OP
8. Atualizar `DiceRoller.tsx`:
   - Adicionar botão "Rolar Pânico" (visível apenas em sessões OP)
   - Adicionar tabela de dificuldades como referência rápida
   - Exibir dado de esforço da classe do personagem

### Fase 5 — Polimento
9. Atualizar `RoleSelection.tsx` para mostrar o sistema da sessão ao entrar
10. Documentar o sistema no README principal

---

## Arquivos a Criar

```
src/
├── components/
│   └── CharacterSheetOP.tsx       ← ficha completa de Ordem Paranormal
├── lib/
│   └── systems.ts                 ← tipos, constantes e helpers multi-sistema
```

## Arquivos a Modificar

```
src/
├── components/
│   ├── DmLobby.tsx                ← seletor de sistema na criação
│   ├── GameBoard.tsx              ← renderiza ficha correta por sistema
│   └── DiceRoller.tsx             ← mecânicas específicas de OP
├── integrations/supabase/
│   └── types.ts                   ← adicionar character_sheets e session_messages
docs/
└── OrdemParanormal-Rotas.md       ← este arquivo
```

---

## SQL — Migration Completa

```sql
-- 1. Adicionar sistema à tabela de sessões
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS system TEXT NOT NULL DEFAULT 'dnd5e';

-- 2. Criar tabela de fichas (caso não exista)
CREATE TABLE IF NOT EXISTS character_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, player_id)
);

-- 3. Criar tabela de mensagens de chat (caso não exista)
CREATE TABLE IF NOT EXISTS session_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  player_avatar TEXT,
  content TEXT NOT NULL,
  is_whisper BOOLEAN NOT NULL DEFAULT false,
  whisper_to_player_id UUID REFERENCES players(id),
  whisper_to_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Habilitar RLS e realtime nas novas tabelas
ALTER TABLE character_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_character_sheets" ON character_sheets FOR ALL USING (true);
CREATE POLICY "allow_all_session_messages" ON session_messages FOR ALL USING (true);
```

---

## Referência Rápida — Diferenças D&D 5e vs Ordem Paranormal

| Aspecto | D&D 5e | Ordem Paranormal |
|---------|--------|-----------------|
| Atributos | FOR, DES, CON, INT, SAB, CAR | AGI, FOR, INT, PRE, VIG |
| Nível | 1–20 | NEX 5%–99% |
| Recurso de magia | Espaços de Magia | Pontos de Esforço (PE) |
| Saúde mental | — | Pontos de Sanidade (PS) |
| Magia | Magias por escola | Rituais por elemento e círculo |
| Dado de teste | 1d20 + mod | 1d20 + atributo |
| Crítico | 20 natural | 20 natural (dobra dados de dano) |
| Morte | 0 PV → testes de morte | 0 PV → Morte Iminente (rola 1d20/rodada) |
| Pânico | — | Tabela de Pânico (1d20 quando PS = 0) |
| Classes | 12 classes | 4 classes (Mundano, Ocultista, Combatente, Especialista) |
