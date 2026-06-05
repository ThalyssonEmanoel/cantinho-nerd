# Sistema de Iniciativa - Planejamento v2

## Visão Geral
Sistema automático de iniciativa onde jogadores rolam seus testes e a ordem é montada automaticamente em tempo real.

## Funcionalidades

### 1. Início do Combate (Mestre)
- [ ] Botão "Iniciar Combate" no GameBoard (visível apenas para o mestre)
- [ ] Ao clicar, envia broadcast para todos os jogadores
- [ ] Abre automaticamente o painel de iniciativa para todos

### 2. Rolagem de Iniciativa (Jogadores)
- [ ] Cada jogador vê um botão "Rolar Iniciativa" no painel
- [ ] Sistema detecta automaticamente o bônus de iniciativa da ficha:
  - **D&D 5e**: Modificador de Destreza
  - **Ordem Paranormal**: AGI + bônus de perícia Iniciativa (se treinado)
- [ ] Jogador pode adicionar bônus extra (vantagem, itens, etc)
- [ ] Rola automaticamente e envia para o banco
- [ ] Aparece em tempo real na lista para todos

### 3. Lista de Iniciativa (Todos)
- [ ] Ordenada automaticamente do maior para o menor
- [ ] Mostra:
  - Posição (#1, #2, #3...)
  - Nome do personagem/criatura
  - Valor da iniciativa
  - Avatar/token
  - Indicador de turno ativo (destaque dourado)
  - HP atual (se configurado)
- [ ] Atualiza em tempo real via Supabase Realtime

### 4. Controles do Mestre
#### Navegação de Turnos
- [ ] Botão "Próximo Turno" (avança para o próximo da lista)
- [ ] Botão "Turno Anterior" (volta para o anterior)
- [ ] Ao chegar no último e avançar: incrementa rodada e volta pro primeiro
- [ ] Contador de rodadas visível para todos

#### Reordenação Manual
- [ ] Drag & drop para reordenar a lista
- [ ] Botões ↑ ↓ para mover combatente
- [ ] Casos de uso:
  - Jogador caído vai para o final
  - Efeito de magia coloca alguém em primeiro
  - Criatura com iniciativa atrasada

#### Gerenciamento
- [ ] Botão "Limpar Combate" (remove todos e reseta rodada)
- [ ] Botão "Remover" em cada entrada (X vermelho)
- [ ] Adicionar combatente manualmente (para monstros/NPCs)

### 5. Monstros/NPCs
**NOTA**: Implementar DEPOIS de organizar sistema de fichas de monstros

Funcionalidades futuras:
- [ ] Mestre adiciona monstros da ficha/bestiário
- [ ] Sistema rola iniciativa automaticamente baseado na ficha
- [ ] Agrupa monstros iguais (ex: "Goblin x3")
- [ ] Opção de rolar iniciativa individual ou em grupo

## Estrutura de Dados

### Tabela: `combat_initiative`
```sql
CREATE TABLE combat_initiative (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  
  -- Identificação
  combatant_type TEXT NOT NULL, -- 'player', 'monster', 'npc'
  player_id UUID REFERENCES players(id), -- Se for jogador
  character_name TEXT NOT NULL,
  avatar_url TEXT,
  
  -- Iniciativa
  initiative_roll INTEGER NOT NULL,
  initiative_bonus INTEGER DEFAULT 0,
  initiative_total INTEGER NOT NULL, -- roll + bonus
  
  -- Ordem e estado
  turn_order INTEGER NOT NULL, -- Posição na lista (1, 2, 3...)
  is_active BOOLEAN DEFAULT false, -- Turno atual
  
  -- Combate
  hp_current INTEGER,
  hp_max INTEGER,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_combat_initiative_session ON combat_initiative(session_id);
CREATE INDEX idx_combat_initiative_order ON combat_initiative(session_id, turn_order);
```

### Tabela: `combat_state`
```sql
CREATE TABLE combat_state (
  session_id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT false,
  current_round INTEGER DEFAULT 1,
  started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Fluxo de Uso

### Cenário 1: Início Normal
1. Mestre clica "Iniciar Combate"
2. Sistema cria `combat_state` com `is_active = true`
3. Broadcast enviado para todos
4. Jogadores veem painel com botão "Rolar Iniciativa"
5. Cada jogador rola (sistema pega bônus da ficha automaticamente)
6. Lista se monta em tempo real
7. Mestre clica "Começar" quando todos rolaram
8. Sistema define o primeiro como ativo

### Cenário 2: Reordenação
1. Durante combate, jogador é derrubado
2. Mestre arrasta o token para o final da lista
3. Sistema recalcula `turn_order` de todos
4. Atualiza em tempo real para todos

### Cenário 3: Fim do Combate
1. Mestre clica "Limpar Combate"
2. Sistema deleta todas entradas de `combat_initiative`
3. Atualiza `combat_state` com `is_active = false`
4. Painel fecha para todos

## Componentes

### `InitiativePanel.tsx` (novo)
- Painel principal que substitui o atual
- Mostra lista ordenada
- Controles de navegação
- Drag & drop para reordenar

### `InitiativeRollButton.tsx` (novo)
- Botão para jogador rolar iniciativa
- Detecta bônus da ficha automaticamente
- Dialog para bônus extra

### `CombatControls.tsx` (novo)
- Controles do mestre (próximo, anterior, limpar)
- Contador de rodadas
- Botão de iniciar combate

## Integrações

### Com Fichas
- Busca bônus de iniciativa automaticamente:
  - D&D 5e: `dex_modifier` da ficha
  - Ordem Paranormal: `agi + reflexos_bonus` da ficha

### Com Tokens
- Sincroniza HP do token com a iniciativa
- Destaca token do turno ativo no mapa

### Com Condições
- Ao avançar rodada, decrementa duração das condições
- Mostra ícones de condições na lista de iniciativa

## Prioridades de Implementação

### Fase 1 (Essencial)
1. Estrutura de dados (tabelas SQL)
2. Botão "Iniciar Combate" do mestre
3. Rolagem de iniciativa dos jogadores
4. Lista ordenada em tempo real
5. Navegação básica (próximo/anterior)
6. Limpar combate

### Fase 2 (Importante)
1. Reordenação manual (drag & drop)
2. Contador de rodadas
3. Sincronização com HP dos tokens
4. Adicionar combatente manual

### Fase 3 (Futuro)
1. Sistema de monstros/NPCs
2. Agrupamento de criaturas
3. Integração com bestiário
4. Histórico de combate

## Notas Técnicas

- Usar Supabase Realtime para sincronização
- Políticas RLS permissivas (controle no frontend)
- Animações suaves com Framer Motion
- Drag & drop com `@dnd-kit/core`
- Toast notifications para feedback
