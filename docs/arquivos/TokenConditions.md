# Sistema de Condições

## Visão Geral

O sistema de condições permite aplicar e gerenciar 12 condições diferentes nos tokens do tabuleiro, com durações opcionais e efeitos mecânicos vinculados.

## Condições Disponíveis

### 1. 🤝 Agarrado
- **Efeito**: Velocidade 0, não pode se mover
- **Uso**: Quando uma criatura está sendo segurada ou presa

### 2. 🔻 Caído
- **Efeito**: Desvantagem em ataques, ataques corpo a corpo contra você têm vantagem
- **Uso**: Quando uma criatura está no chão

### 3. ☠️ Envenenado
- **Efeito**: Desvantagem em testes de atributo e ataques
- **Uso**: Venenos, toxinas, doenças

### 4. 👁️ Cego
- **Efeito**: Falha automaticamente em testes visuais, ataques têm desvantagem
- **Uso**: Escuridão mágica, cegueira temporária

### 5. 👂 Surdo
- **Efeito**: Falha automaticamente em testes auditivos
- **Uso**: Explosões, magias de silêncio

### 6. 💪 Enfraquecido
- **Efeito**: Desvantagem em testes de Força
- **Uso**: Magias de debuff, fadiga

### 7. 😱 Apavorado
- **Efeito**: Desvantagem em testes enquanto a fonte do medo estiver visível
- **Uso**: Magias de medo, habilidades assustadoras

### 8. 😵 Atordoado
- **Efeito**: Incapacitado, não pode se mover, fala de forma confusa
- **Uso**: Golpes na cabeça, magias de atordoamento

### 9. 😓 Exausto
- **Efeito**: Penalidades crescentes por nível de exaustão
- **Uso**: Falta de descanso, ambientes extremos

### 10. 😴 Inconsciente
- **Efeito**: Incapacitado, não pode se mover ou falar, cai objetos
- **Uso**: Sono mágico, nocaute, HP 0

### 11. 🧊 Paralisado
- **Efeito**: Incapacitado, não pode se mover ou falar, falha em testes de FOR/DES
- **Uso**: Magias de paralisia, venenos paralisantes

### 12. 🩸 Sangrando
- **Efeito**: Perde HP no início de cada turno
- **Uso**: Ferimentos graves, ataques cortantes

## Funcionalidades

### Aplicar Condições
1. Selecione o token
2. Clique nos ícones de condição acima do token
3. Escolha a condição desejada
4. Defina duração (opcional, em turnos)
5. Confirme

### Visualização
- Ícones aparecem acima do token
- Máximo de 5 ícones visíveis (+ contador se houver mais)
- Duração exibida em badge dourado
- Hover mostra nome e turnos restantes

### Gerenciamento
- **Decrementar manualmente**: Botão -1 ao lado da condição
- **Decrementar automático**: Ao avançar rodada no tracker de iniciativa
- **Remover**: Botão X ao lado da condição
- **Permanente**: Deixe duração vazia

### Permissões
- **DM**: Pode gerenciar condições de qualquer token
- **Jogador**: Pode gerenciar apenas condições do próprio token
- **Todos**: Podem visualizar todas as condições

## Integração com Iniciativa

Quando o DM avança para a próxima rodada no tracker de iniciativa:
1. Todas as condições com duração são decrementadas em 1 turno
2. Condições com duração 0 são removidas automaticamente
3. Condições permanentes (sem duração) não são afetadas

## Estrutura do Banco de Dados

### Tabela: token_conditions
```sql
id UUID PRIMARY KEY
session_id UUID
token_id UUID
condition_name TEXT
duration INTEGER       -- null = permanente
description TEXT
icon TEXT
created_at TIMESTAMPTZ
```

### Função: decrement_condition_durations
```sql
-- Chamada automaticamente ao avançar rodada
decrement_condition_durations(p_session_id UUID)
```

## Uso no Jogo

### Exemplo 1: Aplicar Envenenado por 3 turnos
1. Selecione o token do jogador
2. Clique nos ícones de condição
3. Escolha "☠️ Envenenado"
4. Digite "3" na duração
5. Clique em "Adicionar"

### Exemplo 2: Aplicar Caído (permanente até remover)
1. Selecione o token
2. Clique nos ícones de condição
3. Escolha "🔻 Caído"
4. Deixe duração vazia
5. Clique em "Adicionar"

### Exemplo 3: Remover condição manualmente
1. Clique nos ícones de condição do token
2. Clique no X ao lado da condição desejada

## Próximas Melhorias

- [ ] Aplicar efeitos mecânicos automaticamente (desvantagem, etc)
- [ ] Integração com fichas de personagem
- [ ] Condições customizadas
- [ ] Notificações quando condições expiram
- [ ] Histórico de condições aplicadas/removidas
- [ ] Efeitos visuais nos tokens (borda colorida, etc)
- [ ] Condições específicas de Ordem Paranormal
- [ ] Empilhamento de condições (ex: Exaustão níveis 1-6)
