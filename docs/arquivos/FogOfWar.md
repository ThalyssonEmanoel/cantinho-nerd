# Fog of War & Sistema de Visibilidade

## Visão Geral

Sistema completo de névoa de guerra (Fog of War) e controle de visibilidade que permite ao DM ocultar tokens e áreas do mapa, revelando-os gradualmente conforme os jogadores exploram.

## Funcionalidades

### 1. Fog of War Dinâmico
- Névoa escura cobre todo o mapa
- Revelação automática ao redor dos tokens dos jogadores
- Raio de visão customizável por token
- Gradiente suave nas bordas da visão
- DM vê tudo sem fog

### 2. Tokens Ocultos
- DM pode ocultar/revelar tokens individualmente
- Tokens ocultos não aparecem para jogadores
- Ícone de olho indica status (vermelho = oculto)
- Toggle rápido no painel de controles

### 3. Raio de Visão Customizado
- Cada token pode ter raio de visão diferente
- Padrão: 150px
- Configurável por token
- Útil para diferentes raças/classes

### 4. Áreas Reveladas Permanentemente
- DM pode revelar áreas específicas
- Áreas reveladas permanecem visíveis
- Útil para salas já exploradas
- Função SQL para gerenciar

## Como Usar

### Ativar Fog of War

1. **DM** clica no botão de olho (Eye) na toolbar
2. Fog é ativado para toda a sessão
3. Jogadores veem apenas ao redor de seus tokens
4. DM continua vendo tudo normalmente

### Ocultar/Revelar Tokens

1. Selecione o token (apenas DM)
2. Clique no ícone de olho no painel de controles
3. Token fica oculto (vermelho) ou visível (cinza)
4. Jogadores não veem tokens ocultos

### Ajustar Raio de Visão

1. Selecione o token do jogador
2. No painel de controles, ajuste o valor em px
3. Pressione Enter ou clique fora para aplicar
4. Visão do jogador se expande/contrai

## Estrutura do Banco de Dados

### Tabela: board_tokens (campos adicionados)
```sql
is_hidden BOOLEAN DEFAULT false
vision_radius INTEGER DEFAULT 150
```

### Tabela: fog_of_war
```sql
id UUID PRIMARY KEY
session_id UUID
x INTEGER
y INTEGER
width INTEGER
height INTEGER
revealed BOOLEAN
created_at TIMESTAMPTZ
```

### Tabela: sessions (campos adicionados)
```sql
fog_enabled BOOLEAN DEFAULT false
default_vision_radius INTEGER DEFAULT 150
```

## Funções SQL

### is_token_visible
Verifica se um token está visível para um jogador específico.

```sql
SELECT is_token_visible(
  p_token_id UUID,
  p_player_id UUID,
  p_session_id UUID
) RETURNS BOOLEAN;
```

**Lógica:**
1. DM vê tudo → TRUE
2. Fog desabilitado → verifica apenas is_hidden
3. Token oculto → FALSE
4. Token do próprio jogador → TRUE
5. Dentro do raio de visão → TRUE
6. Fora do raio → FALSE

### reveal_fog_area
Revela uma área permanentemente (DM apenas).

```sql
SELECT reveal_fog_area(
  p_session_id UUID,
  p_dm_id UUID,
  p_x INTEGER,
  p_y INTEGER,
  p_width INTEGER,
  p_height INTEGER
) RETURNS BOOLEAN;
```

### clear_all_fog
Remove toda a névoa, revelando o mapa inteiro.

```sql
SELECT clear_all_fog(
  p_session_id UUID,
  p_dm_id UUID
) RETURNS BOOLEAN;
```

## Algoritmo de Visibilidade

### Cálculo de Distância
```typescript
const distance = Math.sqrt(
  Math.pow((tokenX + tokenWidth/2) - (playerX + playerWidth/2), 2) +
  Math.pow((tokenY + tokenHeight/2) - (playerY + playerHeight/2), 2)
);

const isVisible = distance <= visionRadius;
```

### Renderização do Fog
```typescript
1. Desenhar fog completo (preto 85% opacidade)
2. Para cada token do jogador:
   - Criar gradiente radial
   - Desenhar círculo de visão
   - Usar destination-out para "apagar" fog
3. Revelar áreas permanentes
```

## Casos de Uso

### Caso 1: Exploração de Masmorra
```
- DM ativa Fog of War
- Jogadores entram na masmorra
- Veem apenas 150px ao redor
- Conforme andam, mapa é revelado
- Monstros ocultos aparecem quando próximos
```

### Caso 2: Emboscada
```
- DM coloca monstros no mapa
- Marca todos como ocultos (olho vermelho)
- Jogadores não veem os monstros
- Quando chegam perto, DM revela os tokens
- Combate inicia
```

### Caso 3: Visão no Escuro
```
- Elfo tem visão no escuro (60 pés)
- DM ajusta raio de visão para 300px
- Humano mantém 150px
- Elfo vê mais longe que o humano
```

### Caso 4: Sala Explorada
```
- Jogadores exploram sala
- DM usa reveal_fog_area() para revelar permanentemente
- Jogadores podem ver a sala mesmo de longe
- Útil para mapas grandes
```

## Configurações Recomendadas

### Raios de Visão por Situação

| Situação | Raio (px) | Equivalente |
|----------|-----------|-------------|
| Escuridão total | 0-50 | Cego |
| Luz de tocha | 100-150 | 20-30 pés |
| Visão normal | 150-200 | 30-40 pés |
| Visão no escuro | 250-300 | 50-60 pés |
| Visão verdadeira | 400+ | 80+ pés |

### Performance

- Fog é renderizado em canvas
- Atualiza apenas quando tokens se movem
- Leve para até 20 tokens
- Para mais tokens, considere desabilitar

## Limitações Atuais

### Não Implementado (Futuro)
- [ ] Linha de visão (paredes bloqueiam)
- [ ] Iluminação dinâmica (tochas, magias)
- [ ] Diferentes tipos de visão (infravisão, etc)
- [ ] Fog parcial (penumbra)
- [ ] Revelar área com ferramenta de desenho
- [ ] Histórico de áreas reveladas
- [ ] Fog por camadas (altura)

### Simplificações
- Visão é circular (não considera paredes)
- Todos os jogadores compartilham visão
- Não há diferença entre luz e escuridão
- Fog é binário (visível ou não)

## Troubleshooting

### Problema: Fog não aparece
**Causa**: Fog não está ativado
**Solução**: DM clica no botão de olho na toolbar

### Problema: Jogador não vê nada
**Causa**: Não tem token no mapa
**Solução**: Adicione token do jogador ao mapa

### Problema: Visão muito pequena
**Causa**: Raio de visão muito baixo
**Solução**: Aumente vision_radius do token

### Problema: DM vê fog
**Causa**: Bug ou não está logado como DM
**Solução**: Verifique role e recarregue página

### Problema: Performance ruim
**Causa**: Muitos tokens ou canvas muito grande
**Solução**: Reduza número de tokens ou desative fog

## Exemplos de Código

### Ocultar Token via SQL
```sql
UPDATE board_tokens
SET is_hidden = true
WHERE id = 'token-uuid';
```

### Ajustar Raio de Visão
```sql
UPDATE board_tokens
SET vision_radius = 300
WHERE owner_id = 'player-uuid'
  AND token_type = 'player';
```

### Revelar Área Retangular
```sql
SELECT reveal_fog_area(
  'session-uuid',
  'dm-uuid',
  100, -- x
  100, -- y
  500, -- width
  400  -- height
);
```

### Verificar Visibilidade
```sql
SELECT is_token_visible(
  'token-uuid',
  'player-uuid',
  'session-uuid'
);
```

## Integração com Outros Sistemas

### Com Iniciativa
- Fog não afeta ordem de iniciativa
- Tokens ocultos ainda aparecem no tracker (DM)
- Jogadores não veem tokens ocultos no tracker

### Com Condições
- Condições de tokens ocultos não são visíveis
- Cegueira pode reduzir raio de visão a 0
- Escuridão mágica pode criar áreas de fog

### Com HP
- HP de tokens ocultos não é visível
- Barras de HP aparecem apenas para tokens visíveis
- Dano em tokens ocultos não gera log para jogadores

## Melhorias Futuras Planejadas

### Curto Prazo
- [ ] Ferramenta de pincel para revelar áreas
- [ ] Atalho de teclado para toggle fog
- [ ] Indicador visual de raio de visão

### Médio Prazo
- [ ] Linha de visão com detecção de paredes
- [ ] Iluminação dinâmica (tochas, magias)
- [ ] Diferentes cores de fog (escuridão mágica)

### Longo Prazo
- [ ] Fog 3D com altura
- [ ] Visão compartilhada entre jogadores
- [ ] Replay de exploração
- [ ] Fog procedural (cavernas, florestas)
