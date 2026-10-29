import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TOKEN_CROP, type BoardToken } from '@/lib/board'
import type { CombatEntry, CombatLogEntry } from '@/lib/combat'
import type { SessionDetail } from '@/lib/db/sessions'
import { buttonByText, byLabel, click, typeInto } from '@/test/dom-helpers'

/**
 * A interface do combate (7.3): o tracker, a faixa do turno, o "Sua vez!", a barra de
 * dano/cura, a janela de condições e o dano/cura a partir do chat. As ações em si (banco)
 * são dubladas: aqui se confere o que a tela pede e o que ela mostra para cada um.
 */

const actions = vi.hoisted(() => ({
  startCombat: vi.fn(async () => {}),
  endCombat: vi.fn(async () => {}),
  addTokensToCombat: vi.fn(async () => 1),
  removeParticipant: vi.fn(async () => {}),
  rollInitiatives: vi.fn(async () => [] as string[]),
  setInitiative: vi.fn(async () => {}),
  reorderParticipants: vi.fn(async () => {}),
  nextTurn: vi.fn(async () => {}),
  endMyTurn: vi.fn(async () => {}),
  applyHp: vi.fn(async () => []),
  clearCombatLog: vi.fn(async () => {})
}))
const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn()
}))
const board = vi.hoisted(() => ({ applyTokenPatch: vi.fn(async () => {}) }))

vi.mock('./combat-actions', () => actions)
vi.mock('sonner', () => ({ toast }))
vi.mock('@/features/board/board-actions', () => board)
vi.mock('@/lib/db/drawings', () => ({ listDrawings: () => Promise.resolve([]) }))
vi.mock('@/lib/db/maps', () => ({ listMaps: vi.fn(async () => []) }))
vi.mock('@/lib/db/tokens', () => ({ listTokens: vi.fn(async () => []), moveToken: vi.fn() }))

const { CombatPanel } = await import('./combat-panel')
const { TurnBanner, TurnNotifier } = await import('./turn-banner')
const { RollApply } = await import('./roll-apply')
const { SelectionBar } = await import('@/features/board/selection-bar')
const { ConditionsDialog } = await import('@/features/board/conditions-dialog')
const { ConditionsSettings } = await import('@/features/session/conditions-settings')
const { useCombatStore } = await import('./combat-store')
const { useBoardStore } = await import('@/features/board/board-store')
const { useSessionStore } = await import('@/features/session/session-store')
const { useAuthStore } = await import('@/stores/auth-store')

function session(role: 'gm' | 'player'): SessionDetail {
  return {
    id: 's1',
    name: 'Mesa',
    inviteId: 'x',
    gmId: 'ana',
    gmName: 'Ana',
    role,
    characterTemplateId: null,
    activeMapId: 'm1',
    scale: { metersPerSquare: 1.5, diagonal: 'simple' },
    diceRules: { critical: { kind: 'natural' }, criticalFailureOnOne: true },
    conditions: [
      { key: 'caido', name: 'Caído', icon: '🔻' },
      { key: 'atordoado', name: 'Atordoado', icon: '💫' }
    ],
    defaultVisionM: 9,
    updatedAt: '',
    members: [
      {
        userId: 'ana',
        role: 'gm',
        displayName: 'Ana',
        username: 'ana',
        avatarPath: null,
        joinedAt: ''
      },
      {
        userId: 'bruno',
        role: 'player',
        displayName: 'Bruno',
        username: 'bruno',
        avatarPath: null,
        joinedAt: ''
      }
    ]
  }
}

function entry(partial: Partial<CombatEntry> & { id: string }): CombatEntry {
  return {
    sessionId: 's1',
    tokenId: `t-${partial.id}`,
    name: partial.id,
    imagePath: null,
    ownerId: 'ana',
    kind: 'monster',
    hidden: false,
    showName: true,
    initiative: null,
    sortOrder: 0,
    ...partial
  }
}

function token(partial: Partial<BoardToken> & { id: string }): BoardToken {
  return {
    sessionId: 's1',
    mapId: 'm1',
    sheetId: null,
    kind: 'monster',
    ownerId: 'ana',
    name: partial.id,
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

/** Mesa montada: quem olha, o combate e o tabuleiro. */
function prepare(role: 'gm' | 'player', userId: string): void {
  useSessionStore.setState({ session: session(role) })
  useAuthStore.setState({ userId })
  useCombatStore.setState({
    sessionId: 's1',
    state: { active: true, round: 2, turnEntryId: 'lia' },
    entries: [
      entry({ id: 'sombra', sortOrder: 1, hidden: true, initiative: 18 }),
      entry({ id: 'goblin', sortOrder: 2, initiative: 15 }),
      entry({ id: 'lia', sortOrder: 3, ownerId: 'bruno', kind: 'player', initiative: 12 }),
      entry({ id: 'novato', sortOrder: 4 })
    ],
    log: []
  })
}

let container: HTMLElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
  useCombatStore.getState().close()
  useBoardStore.getState().close()
  useSessionStore.setState({ session: null })
  vi.clearAllMocks()
})

function render(element: React.JSX.Element): void {
  act(() => root.render(element))
}

/** Clique que espera a ação terminar: enquanto ela roda, os botões ficam desligados. */
async function clickAndWait(element: Element): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('tracker (CombatPanel)', () => {
  it('sem combate: o jogador só lê; o mestre inicia', () => {
    useSessionStore.setState({ session: session('player') })
    render(<CombatPanel />)
    expect(container.textContent).toContain('Nenhum combate em andamento')
    expect(container.textContent).not.toContain('Iniciar combate')

    useSessionStore.setState({ session: session('gm') })
    render(<CombatPanel />)
    click(buttonByText(container, 'Iniciar combate'))
    expect(actions.startCombat).toHaveBeenCalled()
  })

  it('a vez fica destacada, com a rodada', () => {
    prepare('player', 'bruno')
    render(<CombatPanel />)
    expect(container.textContent).toContain('Rodada 2')
    const current = container.querySelector('[aria-current="step"]')
    expect(current?.textContent).toContain('lia')
    expect(current?.textContent).toContain('(você)')
  })

  it('o jogador vê as iniciativas e, na vez dele, encerra o turno', () => {
    prepare('player', 'bruno')
    render(<CombatPanel />)
    expect(container.querySelector('input')).toBeNull()
    expect(container.textContent).toContain('15')
    click(buttonByText(container, 'Encerrar meu turno'))
    expect(actions.endMyTurn).toHaveBeenCalled()
    expect(container.textContent).not.toContain('Próximo turno')
  })

  it('fora da vez dele, o jogador não tem botão', () => {
    prepare('player', 'carla')
    render(<CombatPanel />)
    expect(container.textContent).not.toContain('Encerrar meu turno')
  })

  it('o mestre edita a iniciativa e grava ao sair do campo', () => {
    prepare('gm', 'ana')
    render(<CombatPanel />)
    const input = byLabel<HTMLInputElement>(container, 'Iniciativa de goblin')
    expect(input.value).toBe('15')
    typeInto(input, '9')
    act(() => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(actions.setInitiative).toHaveBeenCalledWith('goblin', 9)
  })

  it('"Rolar iniciativa" rola só para quem ainda não tem', () => {
    prepare('gm', 'ana')
    render(<CombatPanel />)
    click(buttonByText(container, 'Rolar iniciativa'))
    const [rolled] = actions.rollInitiatives.mock.calls[0] as unknown as [CombatEntry[]]
    expect(rolled.map((item) => item.id)).toEqual(['novato'])
  })

  it('o mestre adiciona os selecionados no mapa', () => {
    prepare('gm', 'ana')
    useBoardStore.setState({
      tokens: [token({ id: 'orc' }), token({ id: 'lobo' })],
      selection: ['orc']
    })
    render(<CombatPanel />)
    click(buttonByText(container, 'Adicionar'))
    click(buttonByText(container, 'Os selecionados no mapa'))
    expect(actions.addTokensToCombat).toHaveBeenCalledWith(['orc'])
  })

  it('"todos do mapa" deixa os objetos de fora', () => {
    prepare('gm', 'ana')
    useBoardStore.setState({
      tokens: [token({ id: 'orc' }), token({ id: 'porta', kind: 'object' })]
    })
    render(<CombatPanel />)
    click(buttonByText(container, 'Adicionar'))
    click(buttonByText(container, 'Todos do mapa aberto'))
    expect(actions.addTokensToCombat).toHaveBeenCalledWith(['orc'])
  })

  it('encerrar pede confirmação; o mestre passa o turno', async () => {
    prepare('gm', 'ana')
    render(<CombatPanel />)
    await clickAndWait(buttonByText(container, 'Próximo turno'))
    expect(actions.nextTurn).toHaveBeenCalled()

    click(buttonByText(container, 'Encerrar'))
    expect(actions.endCombat).not.toHaveBeenCalled()
    click(buttonByText(document.body, 'Encerrar combate'))
    expect(actions.endCombat).toHaveBeenCalled()
  })

  it('o log mostra quem, em quem, quanto e antes → depois', () => {
    prepare('player', 'bruno')
    const line: CombatLogEntry = {
      id: 'l1',
      actorId: 'ana',
      tokenId: 't-goblin',
      tokenName: 'Goblin 1',
      tokenOwnerId: 'ana',
      kind: 'damage',
      amount: 7,
      before: 12,
      after: 5,
      tokenHidden: false,
      barsHidden: false,
      nameHidden: false,
      createdAt: '2026-10-29T20:15:00Z'
    }
    useCombatStore.setState({ log: [line] })
    render(<CombatPanel />)
    expect(container.textContent).toContain('Ana: 7 de dano em Goblin 1 (12 → 5)')
    expect(container.textContent).not.toContain('Limpar')
  })
})

describe('faixa do turno e "Sua vez!"', () => {
  it('o jogador da vez vê "Sua vez!" e encerra o turno pela faixa', () => {
    prepare('player', 'bruno')
    render(<TurnBanner />)
    expect(container.textContent).toContain('Sua vez!')
    click(buttonByText(container, 'Encerrar meu turno'))
    expect(actions.endMyTurn).toHaveBeenCalled()
  })

  it('a vez de um oculto aparece só como "alguém" para o jogador', () => {
    prepare('player', 'carla')
    useCombatStore.setState({
      state: { active: true, round: 1, turnEntryId: 'nao-chegou' }
    })
    render(<TurnBanner />)
    expect(container.textContent).toContain('Vez de alguém')
  })

  it('sem combate, nada', () => {
    useCombatStore.setState({ state: { active: false, round: 0, turnEntryId: null } })
    render(<TurnBanner />)
    expect(container.textContent).toBe('')
  })

  it('o aviso "Sua vez!" sai uma vez quando a vez chega ao jogador', () => {
    prepare('player', 'bruno')
    useCombatStore.setState({ state: { active: true, round: 2, turnEntryId: 'goblin' } })
    render(<TurnNotifier />)
    expect(toast.success).not.toHaveBeenCalled()

    act(() => useCombatStore.setState({ state: { active: true, round: 2, turnEntryId: 'lia' } }))
    expect(toast.success).toHaveBeenCalledWith('Sua vez!', expect.anything())

    // A mesma vez, de novo (outro evento chegando), não repete o aviso.
    act(() => useCombatStore.setState({ log: [] }))
    expect(toast.success).toHaveBeenCalledTimes(1)
  })

  it('o mestre não recebe "Sua vez!"', () => {
    prepare('gm', 'ana')
    useCombatStore.setState({ state: { active: true, round: 1, turnEntryId: 'goblin' } })
    render(<TurnNotifier />)
    expect(toast.success).not.toHaveBeenCalled()
  })
})

describe('dano e cura', () => {
  it('o jogador aplica só nos próprios selecionados; Enter é dano', () => {
    useSessionStore.setState({ session: session('player') })
    useBoardStore.setState({
      tokens: [token({ id: 'meu', ownerId: 'bruno' }), token({ id: 'goblin' })],
      selection: ['meu', 'goblin']
    })
    render(<SelectionBar role="player" userId="bruno" />)
    expect(container.textContent).toContain('vale para 1 de 2')
    expect(container.textContent).not.toContain('Adicionar ao combate')

    const input = byLabel<HTMLInputElement>(container, 'Valor de dano ou cura')
    typeInto(input, '7')
    act(() => input.form?.requestSubmit())
    expect(actions.applyHp).toHaveBeenCalledWith(['meu'], 'damage', 7)
  })

  it('cura, e valor inválido não vai para o banco', async () => {
    useBoardStore.setState({ tokens: [token({ id: 'goblin' })], selection: ['goblin'] })
    render(<SelectionBar role="gm" userId="ana" />)

    click(buttonByText(container, 'Cura'))
    expect(actions.applyHp).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()

    typeInto(byLabel(container, 'Valor de dano ou cura'), '2,5')
    await clickAndWait(buttonByText(container, 'Cura'))
    expect(actions.applyHp).toHaveBeenCalledWith(['goblin'], 'heal', 2.5)

    click(buttonByText(container, 'Adicionar ao combate'))
    expect(actions.addTokensToCombat).toHaveBeenCalledWith(['goblin'])
  })

  it('pelo chat: o total da rolagem vai para os selecionados', () => {
    useSessionStore.setState({ session: session('gm') })
    useAuthStore.setState({ userId: 'ana' })
    useBoardStore.setState({
      tokens: [token({ id: 'goblin' }), token({ id: 'orc' })],
      selection: ['goblin', 'orc']
    })
    render(<RollApply total={9} />)
    click(buttonByText(container, 'Dano (2)'))
    expect(actions.applyHp).toHaveBeenCalledWith(['goblin', 'orc'], 'damage', 9)
  })

  it('pelo chat, sem seleção: os botões ficam desligados', () => {
    useSessionStore.setState({ session: session('gm') })
    render(<RollApply total={9} />)
    expect(buttonByText(container, 'Dano').disabled).toBe(true)
  })
})

describe('condições', () => {
  it('liga, dá duração e grava no token', () => {
    const goblin = token({
      id: 'goblin',
      conditions: [{ key: 'velha', name: 'Velha', icon: '👴', rounds: null }]
    })
    render(
      <ConditionsDialog
        token={goblin}
        available={session('gm').conditions}
        onClose={() => {}}
      />
    )
    // A que saiu da lista da mesa continua aparecendo, para dar para tirar.
    expect(document.body.textContent).toContain('Velha')

    click(buttonByText(document.body, 'Atordoado'))
    typeInto(byLabel(document.body, 'Rodadas de Atordoado'), '2')
    click(buttonByText(document.body, 'Velha'))
    click(buttonByText(document.body, 'Salvar'))

    expect(board.applyTokenPatch).toHaveBeenCalledWith(goblin, {
      conditions: [{ key: 'atordoado', name: 'Atordoado', icon: '💫', rounds: 2 }]
    })
  })

  it('a lista da mesa: nome repetido trava o salvar; nova entra no fim', () => {
    const onSave = vi.fn()
    render(
      <ConditionsSettings conditions={session('gm').conditions} busy={false} onSave={onSave} />
    )
    const save = (): HTMLButtonElement => buttonByText(container, 'Salvar condições')
    expect(save().disabled).toBe(true)

    click(buttonByText(container, 'Adicionar condição'))
    const names = container.querySelectorAll<HTMLInputElement>('[aria-label="Nome da condição"]')
    typeInto(names[names.length - 1] as HTMLInputElement, 'caído')
    expect(container.textContent).toContain('duas condições')
    expect(save().disabled).toBe(true)

    typeInto(names[names.length - 1] as HTMLInputElement, 'Sangrando')
    click(save())
    expect(onSave).toHaveBeenCalledWith([
      { key: 'caido', name: 'Caído', icon: '🔻' },
      { key: 'atordoado', name: 'Atordoado', icon: '💫' },
      { key: '', name: 'Sangrando', icon: '⭐' }
    ])
  })
})
