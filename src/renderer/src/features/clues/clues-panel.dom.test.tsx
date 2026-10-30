import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Clue } from '@/lib/session/clues'
import type { SessionDetail } from '@/lib/db/sessions'

/**
 * Aba Pistas (Fase 13): o que o mestre vê (as notas e a lista inteira, com para quem cada
 * pista está revelada) e o que o jogador vê (só o que foi revelado para ele).
 */

const db = vi.hoisted(() => ({
  listClues: vi.fn(),
  fetchNotes: vi.fn(),
  saveNotes: vi.fn(),
  updateClue: vi.fn()
}))

vi.mock('@/lib/db/clues', () => ({
  listClues: db.listClues,
  updateClue: db.updateClue,
  deleteClue: vi.fn(),
  createClue: vi.fn()
}))
vi.mock('@/lib/db/notes', () => ({
  fetchNotes: db.fetchNotes,
  saveNotes: db.saveNotes,
  MAX_NOTES_LENGTH: 20000
}))
// As imagens não são baixadas aqui: a promessa nunca resolve de propósito.
vi.mock('@/lib/db/assets', () => ({
  assetUrl: () => new Promise(() => {}),
  uploadAsset: vi.fn(),
  removeAssets: vi.fn()
}))

const { CluesPanel } = await import('./clues-panel')
const { useCluesStore } = await import('./clues-store')
const { useSessionStore } = await import('@/features/session/session-store')

function session(role: 'gm' | 'player'): SessionDetail {
  return {
    id: 'mesa',
    name: 'Mesa de sexta',
    inviteId: 'k3x9p2m7ab',
    gmId: 'ana',
    gmName: 'Ana',
    role,
    characterTemplateId: null,
    activeMapId: null,
    scale: { metersPerSquare: 1.5, diagonal: 'simple' },
    defaultVisionM: 9,
    diceRules: { critical: { kind: 'natural' }, criticalFailureOnOne: true },
    conditions: [],
    updatedAt: 'x',
    members: [
      {
        userId: 'ana',
        role: 'gm',
        displayName: 'Ana',
        username: 'ana',
        avatarPath: null,
        joinedAt: '1'
      },
      {
        userId: 'bruno',
        role: 'player',
        displayName: 'Bruno',
        username: 'bruno',
        avatarPath: null,
        joinedAt: '2'
      }
    ]
  }
}

function clue(partial: Partial<Clue> & { id: string }): Clue {
  return {
    sessionId: 'mesa',
    title: 'A carta rasgada',
    body: 'Assinada por R.',
    imagePath: null,
    revealAll: false,
    revealedTo: [],
    sortOrder: 1,
    updatedAt: '2026-10-30T12:00:00Z',
    ...partial
  }
}

let container: HTMLElement
let root: Root

beforeEach(() => {
  db.listClues.mockResolvedValue([])
  db.fetchNotes.mockResolvedValue('')
  db.updateClue.mockImplementation(async (id: string, patch: Record<string, unknown>) => ({
    ...clue({ id }),
    ...patch
  }))

  container = document.createElement('div')
  document.body.append(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useCluesStore.getState().close()
  useSessionStore.setState({ session: null })
  vi.clearAllMocks()
})

async function render(role: 'gm' | 'player', clues: Clue[], notes = ''): Promise<void> {
  useSessionStore.setState({ session: session(role) })
  useCluesStore.setState({ sessionId: 'mesa', clues, notes, loading: false, unseen: [] })

  root = createRoot(container)
  await act(async () => {
    root.render(<CluesPanel />)
  })
}

describe('CluesPanel', () => {
  it('o mestre vê as notas e para quem cada pista está revelada', async () => {
    await render(
      'gm',
      [
        clue({ id: 'p1', revealedTo: ['bruno'] }),
        clue({ id: 'p2', title: 'O anel', sortOrder: 2 })
      ],
      'o prefeito é o vilão'
    )

    const text = container.textContent ?? ''
    expect(text).toContain('Minhas notas')
    expect(text).toContain('A carta rasgada')
    expect(text).toContain('Revelada para Bruno')
    expect(text).toContain('O anel')
    expect(text).toContain('Só você')
    expect(container.querySelector('textarea')?.value).toBe('o prefeito é o vilão')
  })

  it('o olho revela a pista para a mesa', async () => {
    await render('gm', [clue({ id: 'p1' })])

    const reveal = container.querySelector<HTMLButtonElement>('[aria-label="Revelar para a mesa"]')
    expect(reveal).not.toBeNull()

    await act(async () => reveal?.click())
    expect(db.updateClue).toHaveBeenCalledWith('p1', { revealAll: true })
  })

  it('pista revelada ganha o botão de esconder', async () => {
    await render('gm', [clue({ id: 'p1', revealAll: true })])
    expect(container.querySelector('[aria-label="Esconder de todos"]')).not.toBeNull()
  })

  it('o jogador vê o texto da pista e não vê as notas', async () => {
    await render('player', [clue({ id: 'p1', revealAll: true })])

    const text = container.textContent ?? ''
    expect(text).toContain('A carta rasgada')
    expect(text).toContain('Assinada por R.')
    expect(text).not.toContain('Minhas notas')
    expect(container.querySelector('textarea')).toBeNull()
    // Nem o rótulo de quem pode ver: isso é conversa do mestre com ele mesmo.
    expect(text).not.toContain('Revelada para')
  })

  it('abrir a aba marca as pistas novas como vistas', async () => {
    useCluesStore.setState({ unseen: ['p1'] })
    await render('player', [clue({ id: 'p1', revealAll: true })])
    expect(useCluesStore.getState().unseen).toEqual([])
  })

  it('sem pista, cada um lê o estado vazio que lhe cabe', async () => {
    await render('player', [])
    expect(container.textContent).toContain('Quando o mestre revelar')

    await act(async () => root.unmount())
    await render('gm', [])
    expect(container.textContent).toContain('Guarde aqui o que você vai revelar')
  })
})
