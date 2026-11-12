import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GRID, type BoardMap } from '@/lib/board'
import { buttonByText, byLabel, click, typeInto } from '@/test/dom-helpers'

/** A barra da névoa do mestre (6.4). */

const db = vi.hoisted(() => ({ updateMapFog: vi.fn(async () => {}), listMaps: vi.fn(async () => []) }))

/** A mesa de mentira: a barra lê a visão dos jogadores dela. */
const session = vi.hoisted(() => {
  const state = {
    session: { defaultVisionM: 0 },
    broadcast: vi.fn(),
    reload: vi.fn(async () => {})
  }
  const useSessionStore = Object.assign(
    (selector: (value: typeof state) => unknown) => selector(state),
    { getState: () => state }
  )
  return { state, useSessionStore, setSessionDefaultVision: vi.fn(async () => {}) }
})

vi.mock('@/lib/db/maps', () => db)
vi.mock('@/lib/db/tokens', () => ({ listTokens: vi.fn(async () => []), moveToken: vi.fn() }))
vi.mock('@/lib/db/drawings', () => ({ listDrawings: () => Promise.resolve([]) }))
vi.mock('@/lib/db/sessions', () => ({ setSessionDefaultVision: session.setSessionDefaultVision }))
vi.mock('@/features/session/session-store', () => ({ useSessionStore: session.useSessionStore }))

const { FogBar } = await import('./fog-bar')
const { useBoardStore } = await import('./board-store')

const map: BoardMap = {
  id: 'm1',
  sessionId: 's1',
  name: 'Cripta',
  imagePath: 'x',
  width: 1000,
  height: 800,
  grid: { ...DEFAULT_GRID, size: 50 },
  fog: { enabled: false, shapes: [] },
  sortOrder: 0
}

let container: HTMLElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  useBoardStore.setState({ maps: [map], openMapId: 'm1', tool: 'fog' })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
  useBoardStore.getState().close()
  useBoardStore.setState({ tool: 'select' })
  vi.clearAllMocks()
})

function render(): void {
  act(() => root.render(<FogBar map={map} />))
}

describe('FogBar', () => {
  it('só aparece com a ferramenta da névoa', () => {
    useBoardStore.setState({ tool: 'select' })
    render()
    expect(container.textContent).toBe('')
  })

  it('liga a névoa do mapa, e avisa que, desligada, os jogadores veem tudo', async () => {
    render()
    expect(container.textContent).toContain('os jogadores veem o mapa inteiro')
    await act(async () => buttonByText(container, 'Névoa desligada').click())
    expect(db.updateMapFog).toHaveBeenCalledWith('m1', { enabled: true, shapes: [] })
    expect(container.textContent).toContain('Névoa ligada')
  })

  it('escolher pincel mostra os tamanhos; revelar ou cobrir', () => {
    render()
    expect(container.querySelector('[aria-label="Tamanho do pincel"]')).toBeNull()
    click(byLabel(container, 'Pincel'))
    click(byLabel(container, 'Pincel grande'))
    click(buttonByText(container, 'Cobrir'))
    const state = useBoardStore.getState()
    expect([state.fogKind, state.fogBrush, state.fogMode]).toEqual(['brush', 2, 'cover'])
  })

  it('revelar tudo pede confirmação', async () => {
    render()
    click(buttonByText(container, 'Revelar tudo'))
    expect(db.updateMapFog).not.toHaveBeenCalled()
    await act(async () => buttonByText(document.body.querySelector('[role="dialog"]') ?? document.body, 'Revelar tudo').click())
    expect(db.updateMapFog).toHaveBeenCalledWith('m1', {
      enabled: false,
      shapes: [{ mode: 'reveal', kind: 'rect', points: [0, 0, 1000, 800], radius: 0 }]
    })
  })
})

describe('visão dos jogadores (decisão 86)', () => {
  const field = (): HTMLInputElement =>
    byLabel<HTMLInputElement>(container, 'Visão dos jogadores em metros')

  async function leave(input: HTMLInputElement): Promise<void> {
    await act(async () => {
      input.focus()
      input.blur()
    })
  }

  afterEach(() => {
    session.state.session.defaultVisionM = 0
  })

  it('começa em 0, e com a névoa ligada a barra diz que eles só veem o revelado', () => {
    useBoardStore.setState({ maps: [{ ...map, fog: { enabled: true, shapes: [] } }] })
    render()
    expect(field().value).toBe('0')
    expect(container.textContent).toContain('só enxergam o que você revelar')
  })

  it('o mestre ajusta daqui mesmo: grava ao sair do campo e avisa os jogadores', async () => {
    render()
    typeInto(field(), '4,5')
    // Digitando não grava nada: "4,5" passaria por "4".
    expect(session.setSessionDefaultVision).not.toHaveBeenCalled()
    await leave(field())
    expect(session.setSessionDefaultVision).toHaveBeenCalledWith('s1', 4.5)
    expect(session.state.broadcast).toHaveBeenCalledWith('session-changed', {})
  })

  it('número que não é número não grava e o campo volta ao valor da mesa', async () => {
    render()
    typeInto(field(), 'longe')
    await leave(field())
    expect(session.setSessionDefaultVision).not.toHaveBeenCalled()
    expect(field().value).toBe('0')
  })

  it('com uma distância, a barra diz quanto cada jogador enxerga', () => {
    session.state.session.defaultVisionM = 3
    useBoardStore.setState({ maps: [{ ...map, fog: { enabled: true, shapes: [] } }] })
    render()
    expect(field().value).toBe('3')
    expect(container.textContent).toContain('enxerga 3 m em volta dele')
  })
})
