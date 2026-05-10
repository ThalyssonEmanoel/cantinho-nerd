# Bestiário & Builder de Encontros

## Visão Geral

Sistema completo de gerenciamento de criaturas e encontros que permite ao DM criar, salvar e spawnar grupos de monstros no mapa com um único clique.

## Funcionalidades

### 1. Bestiário
- Criar e gerenciar criaturas customizadas
- Stat blocks completos (HP, CA, atributos)
- Suporte para D&D 5e e Ordem Paranormal
- Busca e filtros
- Imagens customizadas
- Templates compartilháveis

### 2. Builder de Encontros
- Montar encontros com múltiplas criaturas
- Definir quantidade de cada criatura
- Marcar criaturas como ocultas
- Salvar encontros para reutilizar
- Classificação de dificuldade
- Spawn automático no mapa

### 3. Spawn Inteligente
- Posicionamento automático em grade 4x4
- HP sincronizado do bestiário
- Tokens ocultos opcionais
- Numeração automática (Goblin 1, Goblin 2, etc)
- Transação atômica (tudo ou nada)

## Como Usar

### Criar Criatura no Bestiário

1. **Abrir Bestiário**: Clique no botão de livro (BookOpen) na toolbar
2. **Nova Criatura**: Clique em "Nova Criatura"
3. **Preencher Dados**:
   - Nome (obrigatório)
   - Tipo (humanoide, morto-vivo, etc)
   - Tamanho (minúsculo a colossal)
   - HP Máximo (obrigatório)
   - CA/Defesa
   - Velocidade
   - CR/NEX
   - URL da imagem
   - Descrição
4. **Salvar**: Clique em "Salvar"

### Criar Encontro

1. **Abrir Builder**: Clique no botão de espadas (Swords) na toolbar
2. **Novo Encontro**: Clique em "Novo Encontro"
3. **Configurar**:
   - Nome do encontro
   - Descrição
   - Dificuldade (fácil, médio, difícil, mortal)
4. **Adicionar Criaturas**:
   - Clique nas criaturas disponíveis
   - Ajuste quantidade
   - Toggle olho para ocultar
5. **Salvar**: Clique em "Salvar Encontro"

### Spawnar Encontro

1. Abra o Builder de Encontros
2. Encontre o encontro desejado
3. Clique em "Spawnar"
4. Criaturas aparecem no mapa em grade

## Estrutura do Banco de Dados

### Tabela: bestiary_creatures
```sql
id UUID PRIMARY KEY
dm_id UUID -- Dono da criatura
name TEXT -- Nome da criatura
system TEXT -- 'dnd5e' ou 'ordem_paranormal'
creature_type TEXT -- Tipo (aberração, morto-vivo, etc)
size TEXT -- Tamanho

-- Stats básicos
hp_max INTEGER
ac INTEGER -- CA (D&D) ou Defesa (OP)
speed INTEGER

-- Atributos D&D 5e
strength, dexterity, constitution
intelligence, wisdom, charisma

-- Atributos Ordem Paranormal
agility, force, intellect
presence, vigor, nex

-- Arrays
resistances TEXT[]
immunities TEXT[]
vulnerabilities TEXT[]

-- JSON
abilities JSONB -- Habilidades especiais
attacks JSONB -- Ataques

-- Metadata
description TEXT
image_url TEXT
challenge_rating TEXT -- CR ou NEX
is_template BOOLEAN -- Compartilhável
created_at, updated_at TIMESTAMPTZ
```

### Tabela: saved_encounters
```sql
id UUID PRIMARY KEY
dm_id UUID
session_id UUID
name TEXT
description TEXT
system TEXT
creatures JSONB -- Array de criaturas
difficulty TEXT -- fácil, médio, difícil, mortal
created_at, updated_at TIMESTAMPTZ
```

### Estrutura de creatures JSONB
```json
[
  {
    "creature_id": "uuid-da-criatura",
    "count": 3,
    "hidden": false
  },
  {
    "creature_id": "uuid-outra-criatura",
    "count": 1,
    "hidden": true
  }
]
```

## Funções SQL

### spawn_encounter
Spawna um encontro salvo no mapa.

```sql
SELECT * FROM spawn_encounter(
  p_encounter_id UUID,
  p_session_id UUID,
  p_dm_id UUID,
  p_start_x INTEGER DEFAULT 500,
  p_start_y INTEGER DEFAULT 500
);
```

**Retorna:**
- `success`: TRUE/FALSE
- `tokens_created`: Número de tokens criados
- `message`: Mensagem de resultado

**Comportamento:**
1. Verifica se é DM da sessão
2. Busca encontro salvo
3. Para cada criatura no encontro:
   - Busca dados do bestiário
   - Cria N tokens (baseado em count)
   - Posiciona em grade 4x4
   - Aplica HP do bestiário
   - Aplica visibilidade (hidden)
   - Numera automaticamente

## Exemplos de Uso

### Exemplo 1: Emboscada de Goblins
```typescript
// 1. Criar Goblin no bestiário
{
  name: "Goblin",
  hp_max: 7,
  ac: 15,
  speed: 30,
  challenge_rating: "1/4"
}

// 2. Criar encontro
{
  name: "Emboscada de Goblins",
  difficulty: "médio",
  creatures: [
    { creature_id: "goblin-uuid", count: 4, hidden: false }
  ]
}

// 3. Spawnar
// Resultado: 4 tokens (Goblin 1, Goblin 2, Goblin 3, Goblin 4)
// Posicionados em grade 4x4
// Cada um com 7 HP
```

### Exemplo 2: Boss com Lacaios
```typescript
{
  name: "Chefe Orc e Guardas",
  difficulty: "difícil",
  creatures: [
    { creature_id: "orc-chefe-uuid", count: 1, hidden: false },
    { creature_id: "orc-guarda-uuid", count: 6, hidden: false }
  ]
}

// Resultado: 7 tokens
// 1x Chefe Orc 1
// 6x Orc Guarda 1-6
```

### Exemplo 3: Criaturas Ocultas
```typescript
{
  name: "Armadilha de Sombras",
  difficulty: "mortal",
  creatures: [
    { creature_id: "sombra-uuid", count: 3, hidden: true }
  ]
}

// Resultado: 3 tokens ocultos
// Jogadores não veem até DM revelar
```

## Campos por Sistema

### D&D 5e
- **Atributos**: FOR, DES, CON, INT, SAB, CAR
- **CA**: Classe de Armadura
- **CR**: Challenge Rating (1/8, 1/4, 1/2, 1, 2, etc)
- **Velocidade**: Em pés (30, 40, etc)

### Ordem Paranormal
- **Atributos**: AGI, FOR, INT, PRE, VIG
- **Defesa**: Valor de defesa
- **NEX**: Nível de Exposição (5%, 10%, 15%, etc)
- **Velocidade**: Em metros (9m, 12m, etc)

## Posicionamento de Spawn

### Grade 4x4
```
[1] [2] [3] [4]
[5] [6] [7] [8]
[9] [10] [11] [12]
[13] [14] [15] [16]
```

- Espaçamento: 80px
- Posição inicial padrão: (500, 500)
- Tamanho dos tokens: 60x60px
- Tipo: 'monster'

### Customizar Posição
```sql
SELECT spawn_encounter(
  'encounter-uuid',
  'session-uuid',
  'dm-uuid',
  200, -- x inicial
  300  -- y inicial
);
```

## Dificuldade de Encontros

### Classificação
- **Fácil**: Verde - Jogadores vencem facilmente
- **Médio**: Amarelo - Combate equilibrado
- **Difícil**: Laranja - Jogadores podem perder recursos
- **Mortal**: Vermelho - Risco real de TPK

### Cálculo (Futuro)
- Baseado em CR/NEX total vs nível dos jogadores
- Considera número de jogadores
- Ajusta por ação econômica

## Troubleshooting

### Problema: Criatura não aparece no builder
**Causa**: Sistema diferente
**Solução**: Verifique se criatura é do mesmo sistema da sessão

### Problema: Spawn falha
**Causa**: Não é DM ou encontro não existe
**Solução**: Verifique permissões e ID do encontro

### Problema: Tokens sobrepostos
**Causa**: Muitas criaturas (mais de 16)
**Solução**: Divida em múltiplos encontros ou reposicione manualmente

### Problema: HP não sincroniza
**Causa**: Criatura foi editada após criar encontro
**Solução**: Recrie o encontro ou ajuste HP manualmente

## Melhorias Futuras

### Curto Prazo
- [ ] Importar criaturas de SRD/OGL
- [ ] Copiar/duplicar criaturas
- [ ] Exportar/importar bestiário
- [ ] Preview de encontro antes de spawnar

### Médio Prazo
- [ ] Ataques e habilidades funcionais
- [ ] Cálculo automático de dificuldade
- [ ] Templates de encontros por CR/NEX
- [ ] Histórico de encontros usados

### Longo Prazo
- [ ] IA para gerar criaturas
- [ ] Bestiário compartilhado entre DMs
- [ ] Marketplace de criaturas
- [ ] Integração com iniciativa automática

## Integração com Outros Sistemas

### Com Iniciativa
- Criaturas spawnadas podem ser adicionadas ao tracker
- HP já vem configurado
- Numeração facilita identificação

### Com Fog of War
- Criaturas podem ser spawnadas ocultas
- Útil para emboscadas e surpresas
- DM revela quando apropriado

### Com Condições
- Condições podem ser aplicadas após spawn
- Útil para criaturas com buffs/debuffs
- Ex: Goblin envenenado, Orc enfurecido

### Com HP
- HP vem do bestiário automaticamente
- Barras aparecem sobre tokens
- Dano/cura funciona normalmente

## Exemplos de Criaturas

### D&D 5e - Goblin
```json
{
  "name": "Goblin",
  "creature_type": "humanoide",
  "size": "pequeno",
  "hp_max": 7,
  "ac": 15,
  "speed": 30,
  "strength": 8,
  "dexterity": 14,
  "constitution": 10,
  "intelligence": 10,
  "wisdom": 8,
  "charisma": 8,
  "challenge_rating": "1/4"
}
```

### Ordem Paranormal - Zumbi
```json
{
  "name": "Zumbi",
  "creature_type": "morto-vivo",
  "size": "médio",
  "hp_max": 20,
  "ac": 10,
  "speed": 6,
  "agility": 0,
  "force": 2,
  "intellect": -2,
  "presence": -2,
  "vigor": 2,
  "nex": 10
}
```

## Atalhos e Dicas

### Atalhos
- **Bestiário**: Botão de livro na toolbar
- **Encontros**: Botão de espadas na toolbar
- **Spawn Rápido**: Clique em "Spawnar" no encontro

### Dicas
1. Crie criaturas base e reutilize
2. Use templates para criaturas comuns
3. Numere encontros (Emboscada 1, Emboscada 2)
4. Salve variações (Goblin Fraco, Goblin Forte)
5. Use imagens para facilitar identificação
6. Marque criaturas ocultas para surpresas
7. Teste spawn em sessão de teste primeiro

## Performance

### Limites Recomendados
- Criaturas no bestiário: Ilimitado
- Encontros salvos: Ilimitado
- Criaturas por encontro: Até 20
- Tokens no mapa: Até 50

### Otimização
- Spawn é transação única (rápido)
- Bestiário carrega sob demanda
- Imagens são lazy-loaded
- Filtros são client-side
