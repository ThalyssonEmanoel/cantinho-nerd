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

## Condições de Ordem Paranormal

Condições afetam personagens durante o combate e exploração:

| Condição | Efeito |
|----------|--------|
| **Agarrado** | Deslocamento 0. Escapa com teste de Atletismo ou Acrobacia (CD = 10 + FOR do oponente). |
| **Caído** | Deslocamento pela metade. Ataques corpo a corpo contra você têm vantagem. Seus ataques à distância têm desvantagem. Levantar gasta metade do deslocamento. |
| **Inconsciente** | Incapacitado, não pode se mover ou falar. Solta o que está segurando e cai. Ataques contra você têm vantagem. Ataques corpo a corpo são críticos automáticos. |
| **Paralisado** | Incapacitado, não pode se mover ou falar. Testes de Reflexos falham automaticamente. Ataques contra você têm vantagem. |
| **Envenenado** | Desvantagem em testes de atributo e ataques. |
| **Cego** | Falha automaticamente em testes que exigem visão. Ataques têm desvantagem. Ataques contra você têm vantagem. |
| **Surdo** | Falha automaticamente em testes que exigem audição. |
| **Enfraquecido** | Dano corpo a corpo reduzido pela metade. |
| **Apavorado** | Desvantagem em testes enquanto a fonte do medo estiver visível. Não pode se aproximar da fonte. |
| **Atordoado** | Incapacitado, não pode se mover. Fala de forma confusa. Testes de Reflexos falham automaticamente. Ataques contra você têm vantagem. |
| **Exausto** | Desvantagem em todos os testes. Deslocamento reduzido pela metade. |
| **Sangrando** | Perde 1d6 PV no início de cada turno. Para com teste de Medicina (CD 15) ou cura mágica. |

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

## Rituais de Ordem Paranormal

### Rituais Pré-definidos (Exemplos do Livro)

#### Círculo 1

| Nome | Elemento | Execução | Alcance | Custo | Descrição |
|------|----------|-----------|---------|-------|------------|
| **Amaldiçoar Tecnologia** | Energia | Ação padrão | Toque | 1 PE | Desativa um dispositivo eletrônico por 1 rodada. |
| **Aura de Medo** | Morte | Ação padrão | Pessoal | 1 PE | Emana uma aura de 3m. Criaturas hostis fazem teste de Vontade (CD 12) ou ficam apavoradas por 1 rodada. |
| **Comunicação Paranormal** | Conhecimento | Ação padrão | Pessoal | 1 PE | Envia uma mensagem telepática curta para alguém que você conhece, independente da distância. |
| **Detectar Ameaça** | Conhecimento | Ação padrão | 9m | 1 PE | Revela criaturas hostis e armadilhas em 9m por 1 minuto. |
| **Lâmina de Sangue** | Sangue | Ação padrão | Pessoal | 1 PE | Cria uma arma corpo a corpo (1d6 de dano) por 1 cena. |
| **Luz do Conhecimento** | Conhecimento | Ação livre | Toque | 1 PE | Objeto tocado emite luz por 1 hora. |
| **Percepção Paranormal** | Energia | Ação padrão | Pessoal | 1 PE | Detecta presença paranormal em 9m por 1 minuto. |
| **Proteção Espiritual** | Morte | Ação padrão | Toque | 1 PE | Alvo ganha +2 em Defesa contra ataques paranormais por 1 cena. |
| **Rajada de Energia** | Energia | Ação padrão | 30m | 1 PE | Ataque à distância: 2d6 de dano de energia. |
| **Sentir Emoções** | Conhecimento | Ação padrão | 9m | 1 PE | Sente as emoções de uma criatura por 1 minuto. |

#### Círculo 2

| Nome | Elemento | Execução | Alcance | Custo | Descrição |
|------|----------|-----------|---------|-------|------------|
| **Amplificar Dor** | Sangue | Ação padrão | 30m | 2 PE | Alvo sofre 3d6 de dano e fica enfraquecido por 1 rodada (Fortitude CD 15 reduz pela metade). |
| **Animar Objeto** | Energia | Ação padrão | 9m | 2 PE | Anima um objeto inanimado que obedece seus comandos por 1 cena. |
| **Armadura de Sangue** | Sangue | Ação padrão | Pessoal | 2 PE | Ganha 10 PV temporários e +2 em Defesa por 1 cena. |
| **Criar Ilusão** | Conhecimento | Ação padrão | 30m | 2 PE | Cria uma ilusão visual e sonora em área de 6m por 1 minuto. |
| **Descarnar** | Morte | Ação completa | Pessoal | 2 PE | Seu espírito deixa o corpo por 1 cena. Corpo fica inconsciente. |
| **Escudo de Energia** | Energia | Reação | Pessoal | 2 PE | Ganha +5 em Defesa contra um ataque. |
| **Invocar Medo** | Morte | Ação padrão | 30m | 2 PE | Alvo faz teste de Vontade (CD 15) ou fica apavorado por 1d4 rodadas. |
| **Leitura de Mente** | Conhecimento | Ação padrão | 9m | 2 PE | Lê pensamentos superficiais de uma criatura por 1 minuto. |
| **Regeneração** | Sangue | Ação padrão | Toque | 2 PE | Alvo recupera 3d8+3 PV. |
| **Velocidade Sobrenatural** | Energia | Ação bônus | Pessoal | 2 PE | Deslocamento dobrado e +2 em Reflexos por 1 cena. |

#### Círculo 3

| Nome | Elemento | Execução | Alcance | Custo | Descrição |
|------|----------|-----------|---------|-------|------------|
| **Controlar Mente** | Conhecimento | Ação padrão | 30m | 3 PE | Controla ações de uma criatura por 1 rodada (Vontade CD 17 resiste). |
| **Criar Zumbi** | Morte | Ação completa | 9m | 3 PE | Anima um cadáver como zumbi sob seu controle por 1 dia. |
| **Drenar Vida** | Sangue | Ação padrão | Toque | 3 PE | Causa 5d8 de dano e você recupera metade como PV. |
| **Explosão de Energia** | Energia | Ação padrão | 30m | 3 PE | Explosão em área de 6m causa 6d6 de dano (Reflexos CD 17 reduz pela metade). |
| **Invisibilidade** | Conhecimento | Ação padrão | Toque | 3 PE | Alvo fica invisível por 1 cena ou até atacar. |
| **Invocar Criatura** | Morte | Ação completa | 9m | 3 PE | Invoca uma criatura paranormal (NEX até 25%) que obedece por 1 cena. |
| **Muralha de Energia** | Energia | Ação padrão | 30m | 3 PE | Cria uma barreira de 6m x 3m que bloqueia passagem por 1 cena. |
| **Possessão** | Morte | Ação completa | Toque | 3 PE | Tenta possuir uma criatura (Vontade CD 17 resiste). Dura 1 cena. |
| **Teletransporte** | Energia | Ação padrão | Pessoal | 3 PE | Teleporta até 30m para local visível. |
| **Visão do Passado** | Conhecimento | Ação completa | Toque | 3 PE | Vê eventos passados de um objeto ou local (até 1 semana atrás). |

#### Círculo 4

| Nome | Elemento | Execução | Alcance | Custo | Descrição |
|------|----------|-----------|---------|-------|------------|
| **Chuva de Sangue** | Sangue | Ação padrão | 60m | 4 PE | Área de 12m sofre 8d6 de dano (Fortitude CD 19 reduz pela metade). |
| **Dominar Criatura** | Conhecimento | Ação padrão | 30m | 4 PE | Controla uma criatura por 1 hora (Vontade CD 19 resiste). |
| **Forma Paranormal** | Morte | Ação completa | Pessoal | 4 PE | Transforma-se em criatura paranormal por 1 cena. Ganha habilidades da criatura. |
| **Invocar Entidade** | Morte | Ação completa | 9m | 4 PE | Invoca uma entidade paranormal (NEX até 50%) que obedece por 1 cena. |
| **Parar o Tempo** | Energia | Ação padrão | Pessoal | 4 PE | Tempo para por 1 rodada. Apenas você pode agir. |
| **Portal Dimensional** | Energia | Ação completa | 9m | 4 PE | Cria portal para local conhecido (até 1km). Dura 1 minuto. |
| **Ressurreição** | Sangue | 1 hora | Toque | 4 PE | Traz de volta à vida uma criatura morta há até 1 dia. |
| **Tempestade de Energia** | Energia | Ação padrão | 60m | 4 PE | Área de 12m sofre 10d6 de dano de energia (Reflexos CD 19 reduz pela metade). |
| **Transformação** | Sangue | Ação completa | Pessoal | 4 PE | Transforma-se em outra criatura por 1 hora. |
| **Visão Verdadeira** | Conhecimento | Ação padrão | Pessoal | 4 PE | Vê através de ilusões, invisibilidade e escuridão por 1 cena. |

### Sistema de Criação de Rituais Customizados

Jogadores e mestres podem criar rituais personalizados seguindo estas diretrizes:

#### Estrutura Base
```typescript
interface OPRitualCustom extends OPRitual {
  criador: string;        // Nome do jogador/mestre que criou
  aprovadoPorMestre: boolean;
  dataCriacao: string;
}
```

#### Regras de Balanceamento

**Custo em PE por Círculo:**
- Círculo 1: 1-2 PE
- Círculo 2: 2-3 PE
- Círculo 3: 3-4 PE
- Círculo 4: 4-5 PE

**Dano Base por Círculo:**
- Círculo 1: 2d6
- Círculo 2: 3d6 ou 4d6
- Círculo 3: 6d6 ou 5d8
- Círculo 4: 8d6 ou 10d6

**Duração Sugerida:**
- Instantâneo: efeitos de dano direto
- 1 rodada: efeitos de controle rápido
- 1 cena: buffs e debuffs
- 1 hora: transformações e invocações
- Permanente: apenas rituais de círculo 4+ com custo alto

**Elementos e Temas:**
- **Morte**: necromancia, medo, espíritos, possessão
- **Sangue**: cura, dano vital, transformação corporal
- **Energia**: raios, escudos, teletransporte, velocidade
- **Conhecimento**: ilusões, telepatia, detecção, visões

#### Aprovação do Mestre
Todo ritual customizado deve ser aprovado pelo mestre antes de ser usado em jogo. O mestre pode:
- Ajustar custo em PE
- Modificar duração ou alcance
- Adicionar limitações ou efeitos colaterais
- Vetar rituais que quebrem o balanço da campanha

---

## Equipamentos e Itens de Ordem Paranormal

### Armas Corpo a Corpo

| Nome | Dano | Crítico | Tipo | Alcance | Peso | Preço |
|------|------|----------|------|---------|------|-------|
| Faca | 1d4 | 19/x2 | Cortante | — | 0,5kg | R$ 50 |
| Cassetete | 1d6 | 20/x2 | Contundente | — | 1kg | R$ 80 |
| Taco de Beisebol | 1d6 | 20/x2 | Contundente | — | 1kg | R$ 100 |
| Machado | 1d8 | 20/x3 | Cortante | — | 3kg | R$ 200 |
| Espada | 1d8 | 19/x2 | Cortante | — | 2kg | R$ 500 |
| Motosserra | 2d6 | 20/x2 | Cortante | — | 5kg | R$ 800 |
| Lança | 1d8 | 20/x3 | Perfurante | 3m | 2kg | R$ 150 |
| Katana | 1d10 | 18/x2 | Cortante | — | 1,5kg | R$ 2.000 |

### Armas de Fogo

| Nome | Dano | Crítico | Tipo | Alcance | Munição | Peso | Preço |
|------|------|----------|------|---------|----------|------|-------|
| Revólver .38 | 2d6 | 20/x2 | Balístico | 15m | 6 | 1kg | R$ 1.500 |
| Pistola 9mm | 2d6 | 20/x2 | Balístico | 15m | 15 | 1kg | R$ 2.000 |
| Escopeta | 3d6 | 20/x2 | Balístico | 12m | 6 | 4kg | R$ 3.000 |
| Rifle | 2d8 | 20/x3 | Balístico | 60m | 10 | 5kg | R$ 4.000 |
| Submetralhadora | 2d6 | 20/x2 | Balístico | 30m | 30 | 3kg | R$ 5.000 |
| Fuzil de Assalto | 2d8 | 20/x2 | Balístico | 90m | 30 | 4kg | R$ 8.000 |
| Sniper | 3d8 | 19/x3 | Balístico | 300m | 5 | 6kg | R$ 12.000 |

### Armaduras e Proteção

| Nome | Defesa | Proteção | Penalidade | Peso | Preço |
|------|--------|----------|------------|------|-------|
| Roupa Comum | 10 | 0 | — | — | R$ 100 |
| Jaqueta de Couro | 11 | 1 | — | 2kg | R$ 500 |
| Colete à Prova de Balas (Leve) | 12 | 2 | — | 3kg | R$ 2.000 |
| Colete Tático | 13 | 3 | -1 Agilidade | 5kg | R$ 5.000 |
| Armadura Pesada | 15 | 5 | -2 Agilidade | 10kg | R$ 10.000 |

### Equipamentos Gerais

| Nome | Descrição | Peso | Preço |
|------|------------|------|-------|
| Mochila | Carrega até 20kg | 1kg | R$ 100 |
| Lanterna | Ilumina 9m por 8 horas | 0,5kg | R$ 50 |
| Corda (10m) | Suporta 200kg | 2kg | R$ 80 |
| Kit de Primeiros Socorros | +2 em testes de Medicina, 5 usos | 1kg | R$ 200 |
| Kit de Ferramentas | +2 em testes de Tecnologia | 2kg | R$ 300 |
| Algemas | Prende uma criatura | 0,5kg | R$ 150 |
| Celular | Comunicação, câmera, internet | 0,2kg | R$ 1.000 |
| Laptop | Pesquisa, hacking, análise | 2kg | R$ 3.000 |
| Câmera Profissional | Grava vídeo e áudio em alta qualidade | 1kg | R$ 2.500 |
| Detector de Movimento | Alerta quando algo se move em 15m | 0,5kg | R$ 800 |
| Gravador de Áudio | Grava até 12 horas | 0,2kg | R$ 400 |
| Binóculos | Enxerga até 1km | 0,5kg | R$ 500 |
| Kit de Disfarce | +2 em testes de Enganação para disfarces | 2kg | R$ 600 |
| Lockpick | +2 em testes de Crime para arrombar fechaduras | 0,2kg | R$ 300 |

### Itens Paranormais

| Nome | Efeito | Preço |
|------|--------|-------|
| Amuleto de Proteção | +1 em testes de resistência contra efeitos paranormais | R$ 5.000 |
| Cristal de Energia | Armazena 5 PE que podem ser usados em rituais | R$ 8.000 |
| Livro Ocultista | +2 em testes de Ocultismo | R$ 3.000 |
| Sal Grosso (1kg) | Cria barreira contra espíritos (linha de 3m) | R$ 100 |
| Água Benta (1L) | Causa 1d6 de dano em criaturas paranormais | R$ 500 |
| Símbolo de Proteção | Quando desenhado, impede entrada de criaturas paranormais (NEX até 25%) em área de 3m | R$ 2.000 |
| Medidor de Paranormalidade | Detecta presença paranormal em 30m | R$ 10.000 |

### Sistema de Criação de Itens Customizados

Jogadores e mestres podem criar itens personalizados:

#### Estrutura Base
```typescript
interface OPItemCustom extends OPItem {
  categoria: 'arma' | 'armadura' | 'equipamento' | 'paranormal';
  efeito?: string;
  criador: string;
  aprovadoPorMestre: boolean;
}
```

#### Regras de Balanceamento para Armas

**Armas Corpo a Corpo:**
- Leve (1 mão): 1d4 a 1d6
- Média (1 mão): 1d6 a 1d8
- Pesada (2 mãos): 1d10 a 2d6

**Armas de Fogo:**
- Pistola: 2d6, alcance 15-30m
- Rifle: 2d8, alcance 60-90m
- Escopeta: 3d6, alcance 9-12m (curto)
- Automática: +1d6 de dano, gasta 3x munição

**Crítico:**
- Padrão: 20/x2
- Perfurante: 19-20/x2
- Pesada: 20/x3

#### Regras para Armaduras

**Defesa Base:**
- Leve: 11-12 (sem penalidade)
- Média: 13-14 (-1 AGI)
- Pesada: 15-16 (-2 AGI)

**Proteção:**
- Cada ponto reduz dano recebido em 1
- Máximo recomendado: 5

#### Itens Paranormais

Devem ter:
- Efeito claro e mensurável
- Custo proporcional ao poder
- Limitações de uso (cargas, por dia, etc.)
- Aprovação obrigatória do mestre

---

## Sistema de Criação de Monstros e Criaturas

### Estrutura de Criatura Paranormal

```typescript
interface OPCreature {
  // Identidade
  nome: string;
  tipo: 'Paranormal' | 'Humano' | 'Animal' | 'Constructo';
  nex: number;              // 5% a 99% (poder da criatura)
  descricao: string;
  
  // Atributos
  agi: number;
  for: number;
  int: number;
  pre: number;
  vig: number;
  
  // Combate
  pv: number;
  defesa: number;
  protecao: number;
  deslocamento: number;
  
  // Ataques
  ataques: OPAtaque[];
  
  // Habilidades Especiais
  habilidades: string[];
  resistencias: string[];   // ex: "Resistente a balístico"
  vulnerabilidades: string[]; // ex: "Vulnerável a fogo"
  
  // Rituais (se aplicável)
  rituais?: OPRitual[];
  pe?: number;
  
  // Loot
  tesouro: string;          // O que dropa ao morrer
  
  // Meta
  criador: string;
  aprovadoPorMestre: boolean;
}
```

### Exemplos de Criaturas do Livro

#### Zumbi de Sangue (NEX 10%)
- **PV:** 20
- **Defesa:** 10
- **Atributos:** AGI 1, FOR 3, INT 0, PRE 0, VIG 3
- **Ataque:** Mordida +5 (1d6+3 de dano)
- **Habilidades:** Morto-vivo (imune a veneno, doenças, medo)
- **Deslocamento:** 6m

#### Criatura da Montanha (NEX 25%)
- **PV:** 60
- **Defesa:** 14
- **Proteção:** 5
- **Atributos:** AGI 2, FOR 5, INT 1, PRE 2, VIG 5
- **Ataque:** Garras +8 (2d8+5 de dano)
- **Habilidades:** Regeneração (5 PV por rodada), Resistente a balístico
- **Deslocamento:** 12m

#### Entidade do Conhecimento (NEX 50%)
- **PV:** 80
- **Defesa:** 16
- **Atributos:** AGI 3, FOR 2, INT 5, PRE 4, VIG 3
- **PE:** 20
- **Rituais:** Controlar Mente, Invisibilidade, Leitura de Mente
- **Ataque:** Toque Mental +10 (3d6 de dano psíquico)
- **Habilidades:** Telepatia, Levitação, Imune a dano físico não-paranormal
- **Deslocamento:** 9m (voo)

#### O Devorador (NEX 75%)
- **PV:** 150
- **Defesa:** 18
- **Proteção:** 10
- **Atributos:** AGI 4, FOR 6, INT 3, PRE 5, VIG 6
- **Ataques:** 
  - Mandíbulas +12 (4d8+6 de dano)
  - Tentáculos +10 (3d6+6 de dano, agarrar)
- **Habilidades:** Regeneração Rápida (10 PV/rodada), Aura de Medo (9m, Vontade CD 20), Engolir (criatura agarrada sofre 4d6 de dano por rodada)
- **Deslocamento:** 15m

### Regras de Balanceamento para Criação

#### PV por NEX
- NEX 5-10%: 15-30 PV
- NEX 15-25%: 40-70 PV
- NEX 30-50%: 80-120 PV
- NEX 55-75%: 130-180 PV
- NEX 80-99%: 200+ PV

#### Defesa por NEX
- NEX 5-10%: 10-12
- NEX 15-25%: 13-15
- NEX 30-50%: 16-18
- NEX 55-75%: 19-21
- NEX 80-99%: 22+

#### Dano de Ataque por NEX
- NEX 5-10%: 1d6 a 1d8
- NEX 15-25%: 2d6 a 2d8
- NEX 30-50%: 3d6 a 3d8
- NEX 55-75%: 4d6 a 4d8
- NEX 80-99%: 5d6+

#### Habilidades Especiais

Criaturas podem ter:
- **Regeneração:** Recupera X PV por rodada
- **Resistências:** Reduz dano de um tipo pela metade
- **Imunidades:** Imune a um tipo de dano ou condição
- **Vulnerabilidades:** Recebe dano dobrado de um tipo
- **Aura:** Efeito em área ao redor da criatura
- **Multiataques:** Pode atacar múltiplas vezes por turno
- **Rituais:** Pode conjurar rituais (gasta PE)

#### Aprovação do Mestre

Toda criatura customizada deve:
1. Ter NEX apropriado para a campanha
2. Ser balanceada para o grupo (não muito fácil nem impossível)
3. Ter temática coerente com o universo de Ordem Paranormal
4. Ser aprovada pelo mestre antes de aparecer no jogo

### Ferramenta de Criação no Sistema

A ficha de Ordem Paranormal terá uma seção "Bestiário" onde o mestre pode:
- Criar novas criaturas
- Salvar criaturas customizadas
- Importar criaturas do livro
- Adicionar criaturas ao encontro atual
- Gerenciar HP e condições de criaturas em combate

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
   - **Combate**: PV, PS, PE, defesa, ataques, morte iminente, condições
   - **Rituais**: lista de rituais com círculo e elemento + criação de rituais customizados
   - **Inventário**: equipamentos, dinheiro, criação de itens customizados
   - **Bestiário** (apenas mestre): criar e gerenciar criaturas paranormais
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
