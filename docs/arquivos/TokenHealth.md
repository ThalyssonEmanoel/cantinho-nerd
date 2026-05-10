# Sistema de HP/PE/PS nos Tokens

## Visão Geral

O sistema de overlay de vida permite que tokens no tabuleiro exibam barras de HP (Pontos de Vida), PE (Pontos de Esforço) e PS (Pontos de Sanidade) diretamente sobre eles, com controles para aplicar dano e cura.

## Funcionalidades Implementadas

### 1. Barras de Status
- **HP (Pontos de Vida)**: Barra vermelha/amarela/verde baseada na porcentagem
  - Verde: > 66%
  - Amarelo: 33-66%
  - Vermelho: < 33%
- **PE (Pontos de Esforço)**: Barra azul (apenas Ordem Paranormal)
- **PS (Pontos de Sanidade)**: Barra roxa (apenas Ordem Paranormal)

### 2. Controles de Dano/Cura
- Botões de Dano e Cura aparecem quando o token está selecionado
- Input numérico para especificar quantidade
- Aplicação instantânea com atualização em tempo real
- Apenas DM ou dono do token pode editar

### 3. Log de Combate
- Registro automático de todas as ações de dano/cura
- Exibe quem aplicou, em qual token, e a mudança de HP
- Sincronizado em tempo real para todos os jogadores
- Histórico das últimas 50 ações

## Como Configurar HP nos Tokens

### Opção 1: Via Banco de Dados (Recomendado para setup inicial)

Execute o SQL abaixo para adicionar HP a um token específico:

```sql
-- Atualizar HP de um token específico
UPDATE board_tokens 
SET 
  hp_current = 50,
  hp_max = 50,
  pe_current = 10,  -- Opcional (Ordem Paranormal)
  pe_max = 10,      -- Opcional (Ordem Paranormal)
  ps_current = 15,  -- Opcional (Ordem Paranormal)
  ps_max = 15       -- Opcional (Ordem Paranormal)
WHERE id = 'TOKEN_ID_AQUI';

-- Atualizar HP de todos os tokens de jogadores em uma sessão
UPDATE board_tokens 
SET hp_current = 30, hp_max = 30
WHERE session_id = 'SESSION_ID_AQUI' 
  AND token_type = 'player';

-- Atualizar HP de todos os monstros em uma sessão
UPDATE board_tokens 
SET hp_current = 20, hp_max = 20
WHERE session_id = 'SESSION_ID_AQUI' 
  AND token_type = 'monster';
```

### Opção 2: Via Interface (Futuro)

Planejado para próximas versões:
- Painel de configuração de token ao clicar com botão direito
- Sincronização automática com fichas de personagem
- Importação de HP da ficha ao adicionar token ao mapa

## Estrutura do Banco de Dados

### Tabela: board_tokens (campos adicionados)
```sql
hp_current INTEGER  -- HP atual do token
hp_max INTEGER      -- HP máximo do token
pe_current INTEGER  -- PE atual (Ordem Paranormal)
pe_max INTEGER      -- PE máximo (Ordem Paranormal)
ps_current INTEGER  -- PS atual (Ordem Paranormal)
ps_max INTEGER      -- PS máximo (Ordem Paranormal)
```

### Tabela: token_health_logs
```sql
id UUID PRIMARY KEY
session_id UUID
token_id UUID
player_id UUID
player_name TEXT
action_type TEXT      -- 'damage' ou 'healing'
amount INTEGER        -- Quantidade de dano/cura
hp_before INTEGER     -- HP antes da ação
hp_after INTEGER      -- HP depois da ação
created_at TIMESTAMPTZ
```

## Uso no Jogo

1. **Visualizar HP**: Barras aparecem automaticamente sobre tokens que têm HP configurado
2. **Aplicar Dano**:
   - Selecione o token
   - Clique em "Dano"
   - Digite o valor
   - Confirme
3. **Aplicar Cura**:
   - Selecione o token
   - Clique em "Cura"
   - Digite o valor
   - Confirme
4. **Ver Histórico**: Clique no botão "Log de Combate" na toolbar

## Permissões

- **DM**: Pode editar HP de qualquer token
- **Jogador**: Pode editar apenas HP do próprio token
- **Todos**: Podem visualizar barras de HP de todos os tokens

## Próximas Melhorias

- [ ] Sincronização automática com fichas de personagem
- [ ] Configuração de HP via interface (sem SQL)
- [ ] Animações de dano/cura
- [ ] Efeitos visuais quando HP chega a 0
- [ ] Integração com sistema de morte iminente (Ordem Paranormal)
- [ ] Barras de condições (envenenado, atordoado, etc)
