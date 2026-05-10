# Resumo das Implementações de Combate

Este documento resume as três funcionalidades de combate implementadas no Cantinho Nerd.

## 1. Sistema de Iniciativa e Turnos ⚔️

### Funcionalidades
- Tracker de ordem de combate ordenado por iniciativa
- Destaque visual do token ativo (borda dourada + ícone pulsante)
- Botão "Próximo Turno" com avanço automático
- Contador de rodadas
- Sistema de HP por combatente (opcional)
- Sincronização em tempo real

### Arquivos
- `src/components/InitiativeTracker.tsx`
- `docs/initiative_tracker.sql`

### Como Usar
1. Clique no botão de espadas (Swords) na toolbar
2. DM adiciona combatentes com nome e iniciativa
3. Clique em um combatente para marcá-lo como ativo
4. Use "Próximo Turno" para avançar automaticamente
5. Ao voltar pro primeiro, a rodada incrementa

---

## 2. Overlay de HP/PE/PS nos Tokens 💚💙💜

### Funcionalidades
- Barras de HP com cores dinâmicas (verde/amarelo/vermelho)
- Barras de PE e PS para Ordem Paranormal
- Controles de dano/cura diretamente no token
- Log automático de todas as ações
- Painel de histórico de combate
- Sincronização em tempo real

### Arquivos
- `src/components/TokenHealthBar.tsx`
- `src/components/CombatLogPanel.tsx`
- `docs/token_health.sql`
- `docs/TokenHealth.md`

### Como Usar
1. Configure HP nos tokens via SQL (veja TokenHealth.md)
2. Barras aparecem automaticamente sobre tokens com HP
3. Selecione o token e clique em "Dano" ou "Cura"
4. Digite o valor e confirme
5. Veja o histórico no botão "Log de Combate"

### Configurar HP (SQL)
```sql
UPDATE board_tokens 
SET hp_current = 50, hp_max = 50
WHERE id = 'TOKEN_ID';
```

---

## 3. Sistema de Condições 🛡️

### Funcionalidades
- 12 condições pré-definidas com ícones
- Durações opcionais (em turnos)
- Ícones visuais sobre os tokens
- Painel de gerenciamento por token
- Painel de resumo de todas as condições ativas
- Decremento automático ao avançar rodada
- Sincronização em tempo real

### Condições Disponíveis
1. 🤝 Agarrado
2. 🔻 Caído
3. ☠️ Envenenado
4. 👁️ Cego
5. 👂 Surdo
6. 💪 Enfraquecido
7. 😱 Apavorado
8. 😵 Atordoado
9. 😓 Exausto
10. 😴 Inconsciente
11. 🧊 Paralisado
12. 🩸 Sangrando

### Arquivos
- `src/components/TokenConditions.tsx`
- `src/components/ConditionIcons.tsx`
- `src/components/ConditionsSummaryPanel.tsx`
- `docs/token_conditions.sql`
- `docs/TokenConditions.md`

### Como Usar
1. Selecione o token
2. Clique no botão de escudo (Shield) ou nos ícones de condição
3. Escolha a condição e defina duração (opcional)
4. Confirme
5. Ícones aparecem sobre o token
6. Veja resumo geral no botão "Condições Ativas"

### Decremento Automático
- Ao avançar rodada no tracker de iniciativa
- Todas as condições com duração são decrementadas
- Condições com duração 0 são removidas
- Condições permanentes não são afetadas

---

## Integração entre Sistemas

### Iniciativa + HP
- HP pode ser gerenciado diretamente no tracker de iniciativa
- Cada entrada pode ter HP atual/máximo

### Iniciativa + Condições
- Ao avançar rodada, condições são decrementadas automaticamente
- Função SQL: `decrement_condition_durations(session_id)`

### HP + Condições
- Condições como "Sangrando" podem causar dano automático (futuro)
- Condições como "Inconsciente" podem ser aplicadas ao chegar em HP 0 (futuro)

---

## Scripts SQL Necessários

Execute na ordem:

1. **Iniciativa**
```bash
docs/initiative_tracker.sql
```

2. **HP/PE/PS**
```bash
docs/token_health.sql
```

3. **Condições**
```bash
docs/token_conditions.sql
```

---

## Permissões

### DM
- Gerencia iniciativa (adicionar/remover/avançar)
- Edita HP de qualquer token
- Gerencia condições de qualquer token

### Jogador
- Visualiza iniciativa
- Edita HP do próprio token
- Gerencia condições do próprio token

### Todos
- Visualizam barras de HP
- Visualizam condições ativas
- Visualizam logs de combate

---

## Próximas Melhorias

### Iniciativa
- [ ] Importar iniciativa automaticamente dos tokens
- [ ] Rolar iniciativa automaticamente (1d20 + modificador)
- [ ] Marcar tokens no mapa quando turno ativo

### HP
- [ ] Sincronização automática com fichas de personagem
- [ ] Configuração de HP via interface (sem SQL)
- [ ] Animações de dano/cura
- [ ] Efeitos visuais quando HP chega a 0

### Condições
- [ ] Aplicar efeitos mecânicos automaticamente
- [ ] Condições customizadas
- [ ] Notificações quando condições expiram
- [ ] Efeitos visuais nos tokens (borda colorida)
- [ ] Integração com fichas de personagem

### Geral
- [ ] Dashboard de combate unificado
- [ ] Atalhos de teclado
- [ ] Modo de combate (ativa tudo automaticamente)
- [ ] Exportar/importar estado de combate
