import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TOKEN_CROP, type BoardToken } from '@/lib/board'
import type { CombatEntry } from '@/lib/combat'
import { diceEngines } from '@/lib/dice'
import { createExampleSchema, createInitialValues, type SheetRecord } from '@/lib/sheet'

/**
 * As ações do combate (7.3). O ponto delicado é a iniciativa: ela sai da ficha de cada
 * participante, pelo papel `initiative`, e quem não tem ficha (ou tem fórmula quebrada)
 * rola 1d20 — sem travar o resto da mesa.
 */

const db = vi.hoisted(() => ({
  fetchCombat: vi.fn(async () => ({
    state: { active: true, round: 1, turnEntryId: null },
    entries: []
  })),
  fetchCombatLog: vi.fn(async () => []),
  setInitiatives: vi.fn(async () => {}),
  removeFromCombat: vi.fn(async () => {}),
  clearCombatLog: vi.fn(async () => {}),
  applyHpChange: vi.fn(async () => [])
}))
const tokens = vi.hoisted(() => ({ listTokensByIds: vi.fn() }))
const sheets = vi.hoisted(() => ({ get: vi.fn(), schemaOf: vi.fn() }))
const broadcast = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db/combat', () => db)
vi.mock('@/lib/db/tokens', () => tokens)
vi.mock('@/features/sheets/repository', () => ({ sheetRepository: sheets }))
vi.mock('@/features/session/session-store', () => ({
  useSessionStore: { getState: () => ({ broadcast }) }
}))

const actions = await import('./combat-actions')
const { useCombatStore } = await import('./combat-store')

function entry(id: string, tokenId: string, name = id): CombatEntry {
  return {
    id,
    sessionId: 's1',
    tokenId,
    name,
    imagePath: null,
    ownerId: 'ana',
    kind: 'monster',
    hidden: false,
    showName: true,
    initiative: null,
    sortOrder: 0
  }
}

function token(id: string, sheetId: string | null): BoardToken {
  return {
    id,
    sessionId: 's1',
    mapId: 'm1',
    sheetId,
    kind: 'player',
    ownerId: 'bruno',
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
    bars: {},
    conditions: []
  }
}

beforeEach(() => {
  useCombatStore.setState({ sessionId: 's1' })
})

afterEach(() => {
  useCombatStore.getState().close()
  vi.clearAllMocks()
})

describe('rolar a iniciativa', () => {
  it('pela ficha (papel Iniciativa) e 1d20 para quem não tem ficha', async () => {
    const schema = createExampleSchema()
    const values = createInitialValues(schema)
    tokens.listTokensByIds.mockResolvedValue([token('t-lia', 'ficha-lia'), token('t-gob', null)])
    sheets.get.mockResolvedValue({ values, gmValues: {} } as unknown as SheetRecord)
    sheets.schemaOf.mockResolvedValue(schema)

    const problems = await actions.rollInitiatives(
      [entry('e-lia', 't-lia'), entry('e-gob', 't-gob')],
      diceEngines.max
    )

    expect(problems).toEqual([])
    expect(sheets.get).toHaveBeenCalledWith('ficha-lia')
    const [sessionId, rolled] = db.setInitiatives.mock.calls[0] as unknown as [
      string,
      Record<string, number>
    ]
    expect(sessionId).toBe('s1')
    // O goblin sem ficha rolou 1d20 (no máximo, 20); a Lia, 1d20 + modificador.
    expect(rolled['e-gob']).toBe(20)
    expect(typeof rolled['e-lia']).toBe('number')
  })

  it('ficha que não abre ou fórmula quebrada: 1d20, e o mestre é avisado', async () => {
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
    tokens.listTokensByIds.mockResolvedValue([token('t1', 'ficha-1'), token('t2', 'ficha-2')])
    sheets.get.mockImplementation(async (id: string) => {
      if (id === 'ficha-2') throw new Error('sem rede')
      return { values: createInitialValues(broken), gmValues: {} } as unknown as SheetRecord
    })
    sheets.schemaOf.mockResolvedValue(broken)

    const problems = await actions.rollInitiatives(
      [entry('e1', 't1', 'Lia'), entry('e2', 't2', 'Bruno')],
      diceEngines.min
    )

    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^Lia:/)
    expect(db.setInitiatives).toHaveBeenCalledWith('s1', { e1: 1, e2: 1 })
  })
})

describe('outras ações', () => {
  it('tirar do combate some da tela na hora', async () => {
    useCombatStore.setState({ entries: [entry('e1', 't1'), entry('e2', 't2')] })
    db.fetchCombat.mockResolvedValueOnce({
      state: { active: true, round: 1, turnEntryId: null },
      entries: [entry('e2', 't2')]
    } as never)

    const removing = actions.removeParticipant('e1')
    expect(useCombatStore.getState().entries.map((item) => item.id)).toEqual(['e2'])
    await removing
    expect(db.removeFromCombat).toHaveBeenCalledWith('e1')
  })

  it('a iniciativa digitada aparece antes de o banco confirmar', async () => {
    useCombatStore.setState({ entries: [entry('e1', 't1')] })
    let resolve!: () => void
    db.setInitiatives.mockReturnValueOnce(new Promise<void>((ok) => (resolve = ok)))

    const saving = actions.setInitiative('e1', 17)
    expect(useCombatStore.getState().entries[0]?.initiative).toBe(17)
    resolve()
    await saving
  })

  it('limpar o log avisa os outros pelo canal', async () => {
    await actions.clearCombatLog()
    expect(db.clearCombatLog).toHaveBeenCalledWith('s1')
    expect(broadcast).toHaveBeenCalledWith('combat-log-cleared', {})
  })

  it('sem mesa aberta, nada sai para o banco', async () => {
    useCombatStore.getState().close()
    await expect(actions.applyHp(['t1'], 'damage', 3)).rejects.toThrow('Nenhuma mesa aberta.')
    expect(db.applyHpChange).not.toHaveBeenCalled()
  })
})
