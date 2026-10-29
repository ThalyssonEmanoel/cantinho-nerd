import { describe, expect, it } from 'vitest'
import { DEFAULT_TOKEN_CROP, type BoardToken } from '@/lib/board'
import { diceEngines } from '@/lib/dice'
import {
  createExampleSchema,
  createInitialValues,
  createSheetContext,
  type SheetSchema
} from '@/lib/sheet'
import {
  byTurnOrder,
  currentEntry,
  describeHpChange,
  entryLabel,
  hpTargets,
  initiativeFormula,
  isMyTurn,
  moveEntry,
  parseHpAmount,
  rollInitiative,
  type CombatEntry,
  type CombatLogEntry,
  type CombatState
} from './index'

function entry(partial: Partial<CombatEntry> & { id: string }): CombatEntry {
  return {
    sessionId: 's1',
    tokenId: `token-${partial.id}`,
    name: 'Goblin',
    imagePath: null,
    ownerId: 'mestre',
    kind: 'monster',
    hidden: false,
    showName: true,
    initiative: null,
    sortOrder: 0,
    ...partial
  }
}

describe('ordem e vez', () => {
  const entries = [
    entry({ id: 'b', sortOrder: 2, ownerId: 'bruno', kind: 'player' }),
    entry({ id: 'a', sortOrder: 1 }),
    entry({ id: 'c', sortOrder: 2 })
  ]

  it('ordena pela ordem do banco, com o id desempatando', () => {
    expect([...entries].sort(byTurnOrder).map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })

  it('acha o participante da vez e diz se é a minha', () => {
    const state: CombatState = { active: true, round: 1, turnEntryId: 'b' }
    expect(currentEntry(entries, state)?.id).toBe('b')
    expect(isMyTurn(entries, state, 'bruno')).toBe(true)
    expect(isMyTurn(entries, state, 'carla')).toBe(false)
    expect(isMyTurn(entries, { ...state, active: false }, 'bruno')).toBe(false)
    expect(currentEntry(entries, { ...state, turnEntryId: null })).toBeNull()
  })

  it('nome escondido vira ??? para o jogador, e o mestre vê o de verdade', () => {
    const hidden = entry({ id: 'x', name: 'Rei Lich', showName: false })
    expect(entryLabel(hidden, false)).toBe('???')
    expect(entryLabel(hidden, true)).toBe('Rei Lich')
    expect(entryLabel(entry({ id: 'y', name: '  ' }), true)).toBe('Sem nome')
  })

  it('arrastar leva o participante para o lugar do outro', () => {
    expect(moveEntry(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
    expect(moveEntry(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a'])
    expect(moveEntry(['a', 'b'], 'a', 'zzz')).toEqual(['a', 'b'])
  })
})

describe('iniciativa pelo papel', () => {
  it('botão de rolagem com o papel: rola a fórmula dele, com a ficha', () => {
    const schema = createExampleSchema()
    const values = createInitialValues(schema)
    expect(initiativeFormula(schema)).toBe('1d20 + {destreza.mod}')

    const mod = Number(createSheetContext(schema, values).context.resolve(['destreza', 'mod']))
    const rolled = rollInitiative(schema, values, diceEngines.max)
    expect(rolled).toMatchObject({ ok: true, value: 20 + mod })
  })

  it('número com o papel: é o bônus de 1d20', () => {
    const schema: SheetSchema = {
      formatVersion: 1,
      tabs: [
        {
          id: 't',
          label: 'Geral',
          components: [
            {
              id: 'c_ini',
              type: 'number',
              key: 'bonus',
              label: 'Bônus de iniciativa',
              defaultValue: 4,
              role: 'initiative',
              editableBy: 'player',
              visibleTo: 'all',
              layout: { x: 0, y: 0, w: 2, h: 2 }
            }
          ]
        }
      ]
    }
    expect(initiativeFormula(schema)).toBe('1d20 + {bonus}')
    expect(rollInitiative(schema, { c_ini: 4 }, diceEngines.min)).toMatchObject({ ok: true, value: 5 })
  })

  it('sem ficha ou sem o papel: 1d20', () => {
    expect(initiativeFormula(null)).toBe('1d20')
    expect(rollInitiative(null, {}, diceEngines.max)).toMatchObject({ ok: true, value: 20 })
    expect(initiativeFormula({ formatVersion: 1, tabs: [] })).toBe('1d20')
  })

  it('fórmula quebrada no modelo devolve o erro, não lança', () => {
    const schema = createExampleSchema()
    const broken = {
      ...schema,
      tabs: schema.tabs.map((tab) => ({
        ...tab,
        components: tab.components.map((component) =>
          component.role === 'initiative' && component.type === 'rollButton'
            ? { ...component, formula: '1d20 + {nao_existe}' }
            : component
        )
      }))
    }
    const rolled = rollInitiative(broken, createInitialValues(broken))
    expect(rolled.ok).toBe(false)
  })
})

describe('dano e cura', () => {
  function token(partial: Partial<BoardToken> & { id: string }): BoardToken {
    return {
      sessionId: 's1',
      mapId: 'm1',
      sheetId: null,
      kind: 'monster',
      ownerId: 'mestre',
      name: '',
      imagePath: null,
      crop: DEFAULT_TOKEN_CROP,
      x: 0,
      y: 0,
      size: 1,
      z: 0,
      hidden: false,
      showName: true,
      showBars: true,
      visionM: null,
      bars: { hp: { current: 5, max: 10 } },
      conditions: [],
      ...partial
    }
  }

  const tokens = [
    token({ id: 'goblin' }),
    token({ id: 'lia', ownerId: 'bruno', kind: 'player', sheetId: 'ficha', bars: {} }),
    token({ id: 'porta', kind: 'object', bars: {} }),
    token({ id: 'oculto', ownerId: 'bruno', hidden: true })
  ]
  const all = tokens.map((item) => item.id)

  it('o mestre aplica em qualquer selecionado que tenha vida', () => {
    expect(hpTargets(tokens, all, 'gm', 'ana').map((item) => item.id)).toEqual([
      'goblin',
      'lia',
      'oculto'
    ])
  })

  it('o jogador só nos próprios, visíveis', () => {
    expect(hpTargets(tokens, all, 'player', 'bruno').map((item) => item.id)).toEqual(['lia'])
    expect(hpTargets(tokens, ['goblin'], 'player', 'bruno')).toEqual([])
  })

  it('o valor digitado: número de 0 a 100000, vírgula vale', () => {
    expect(parseHpAmount('7')).toBe(7)
    expect(parseHpAmount(' 2,5 ')).toBe(2.5)
    expect(parseHpAmount('')).toBeNull()
    expect(parseHpAmount('-3')).toBeNull()
    expect(parseHpAmount('dez')).toBeNull()
    expect(parseHpAmount('100001')).toBeNull()
  })

  it('a linha do log, com ??? para o nome escondido', () => {
    const line: CombatLogEntry = {
      id: 'l1',
      actorId: 'ana',
      tokenId: 'goblin',
      tokenName: 'Goblin 1',
      tokenOwnerId: 'ana',
      kind: 'damage',
      amount: 7,
      before: 12,
      after: 5,
      tokenHidden: false,
      barsHidden: false,
      nameHidden: true,
      createdAt: ''
    }
    expect(describeHpChange(line, 'Ana', true)).toBe('Ana: 7 de dano em Goblin 1 (12 → 5)')
    expect(describeHpChange(line, 'Ana', false)).toBe('Ana: 7 de dano em ??? (12 → 5)')
    expect(describeHpChange({ ...line, kind: 'heal', amount: 2.5 }, '', true)).toBe(
      'Alguém: 2,5 de cura em Goblin 1 (12 → 5)'
    )
  })
})
