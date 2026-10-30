import { describe, expect, it } from 'vitest'
import {
  canSeeClue,
  losesAccess,
  clueHeadline,
  clueProblem,
  clueReveal,
  isRevealed,
  MAX_CLUE_TARGETS,
  nextClueOrder,
  revealLabel,
  sortClues,
  toggleClueTarget,
  type Clue
} from './clues'

function clue(partial: Partial<Clue> = {}): Clue {
  return {
    id: 'pista-1',
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

const members = [
  { userId: 'ana', displayName: 'Ana' },
  { userId: 'bruno', displayName: 'Bruno' },
  { userId: 'carla', displayName: 'Carla' }
]

describe('para quem a pista está revelada', () => {
  it('nasce só do mestre', () => {
    expect(clueReveal(clue())).toBe('hidden')
    expect(isRevealed(clue())).toBe(false)
  })

  it('com gente escolhida, é "some"; para a mesa, "all"', () => {
    expect(clueReveal(clue({ revealedTo: ['ana'] }))).toBe('some')
    expect(clueReveal(clue({ revealAll: true }))).toBe('all')
  })

  it('canSeeClue responde o mesmo que o banco responderia', () => {
    const some = clue({ revealedTo: ['ana'] })
    expect(canSeeClue(some, 'ana')).toBe(true)
    expect(canSeeClue(some, 'bruno')).toBe(false)
    expect(canSeeClue(some, null)).toBe(false)
    expect(canSeeClue(clue({ revealAll: true }), 'bruno')).toBe(true)
    expect(canSeeClue(clue(), 'ana')).toBe(false)
  })
})

describe('rótulo que o mestre lê', () => {
  it('diz para quem está revelada', () => {
    expect(revealLabel(clue(), members)).toBe('Só você')
    expect(revealLabel(clue({ revealAll: true }), members)).toBe('Revelada para a mesa')
    expect(revealLabel(clue({ revealedTo: ['ana'] }), members)).toBe('Revelada para Ana')
    expect(revealLabel(clue({ revealedTo: ['ana', 'bruno'] }), members)).toBe(
      'Revelada para Ana e Bruno'
    )
    expect(revealLabel(clue({ revealedTo: ['ana', 'bruno', 'carla'] }), members)).toBe(
      'Revelada para Ana, Bruno e Carla'
    )
  })

  it('quem saiu da mesa não some da conta', () => {
    expect(revealLabel(clue({ revealedTo: ['fantasma'] }), members)).toBe(
      'Revelada para 1 pessoa(s)'
    )
  })
})

describe('escolher destinos', () => {
  it('liga e desliga sem repetir', () => {
    const first = toggleClueTarget(clue(), 'ana')
    expect(first.revealedTo).toEqual(['ana'])

    const twice = toggleClueTarget(first, 'ana')
    expect(twice.revealedTo).toEqual([])
  })

  it('escolher gente desliga "para a mesa"', () => {
    const picked = toggleClueTarget(clue({ revealAll: true }), 'ana')
    expect(picked.revealAll).toBe(false)
    expect(picked.revealedTo).toEqual(['ana'])
  })

  it('a lista tem teto', () => {
    const many = Array.from({ length: MAX_CLUE_TARGETS }, (_item, index) => `p${index}`)
    const full = toggleClueTarget(clue({ revealedTo: many }), 'mais-um')
    expect(full.revealedTo).toHaveLength(MAX_CLUE_TARGETS)
  })
})

describe('o que dá para salvar', () => {
  it('pista vazia não vale', () => {
    expect(clueProblem({ title: '  ', body: '', imagePath: null })).toMatch(/título/)
  })

  it('só imagem vale, só texto vale', () => {
    expect(clueProblem({ title: '', body: '', imagePath: 'sessions/x/clues/a.webp' })).toBeNull()
    expect(clueProblem({ title: '', body: 'um sussurro', imagePath: null })).toBeNull()
  })

  it('texto gigante é recusado antes de ir ao banco', () => {
    expect(clueProblem({ title: 'a'.repeat(200), body: '', imagePath: null })).toMatch(/título/)
    expect(clueProblem({ title: 'ok', body: 'b'.repeat(5000), imagePath: null })).toMatch(/texto/)
  })
})

describe('quem perde o acesso', () => {
  it('tirar "para a mesa" tira de todos', () => {
    expect(losesAccess({ revealAll: true, revealedTo: [] }, { revealAll: false, revealedTo: [] })).toBe(
      true
    )
  })

  it('tirar uma pessoa da lista tira dela', () => {
    expect(
      losesAccess({ revealAll: false, revealedTo: ['ana', 'bruno'] }, { revealAll: false, revealedTo: ['ana'] })
    ).toBe(true)
  })

  it('revelar mais não tira de ninguém', () => {
    expect(
      losesAccess({ revealAll: false, revealedTo: ['ana'] }, { revealAll: false, revealedTo: ['ana', 'bruno'] })
    ).toBe(false)
    expect(losesAccess({ revealAll: false, revealedTo: ['ana'] }, { revealAll: true, revealedTo: [] })).toBe(
      false
    )
  })

  it('trocar a lista por "para a mesa" não tira de quem estava nela', () => {
    expect(
      losesAccess({ revealAll: false, revealedTo: ['ana'] }, { revealAll: true, revealedTo: [] })
    ).toBe(false)
  })
})

describe('lista', () => {
  it('o título da lista cai para o texto e depois para a imagem', () => {
    expect(clueHeadline(clue())).toBe('A carta rasgada')
    expect(clueHeadline(clue({ title: '' }))).toBe('Assinada por R.')
    expect(clueHeadline(clue({ title: '', body: '' }))).toBe('Pista sem título')
    expect(clueHeadline(clue({ title: '', body: '', imagePath: 'x' }))).toBe('Imagem')
  })

  it('texto comprido é cortado', () => {
    const long = clueHeadline(clue({ title: '', body: 'z'.repeat(100) }))
    expect(long.endsWith('…')).toBe(true)
    expect(long.length).toBeLessThanOrEqual(61)
  })

  it('ordena pela posição, com o id como desempate', () => {
    const list = [
      clue({ id: 'b', sortOrder: 2 }),
      clue({ id: 'a', sortOrder: 2 }),
      clue({ id: 'c', sortOrder: 1 })
    ]
    expect(sortClues(list).map((item) => item.id)).toEqual(['c', 'a', 'b'])
  })

  it('a pista nova entra no fim', () => {
    expect(nextClueOrder([clue({ sortOrder: 3 }), clue({ sortOrder: 7 })])).toBe(8)
    expect(nextClueOrder([])).toBe(1)
  })
})
