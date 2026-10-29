import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Creature, Encounter } from '@/lib/bestiary'
import type { SheetSchema, SheetTemplate } from '@/lib/sheet'
import { buttonByText, byLabel, click, typeInto } from '@/test/dom-helpers'

/**
 * As telas do mestre (seção 8): bestiário, editor da criatura, encontros e o painel da
 * mesa. Banco e ações são dublados; aqui se confere o que a tela mostra e o que ela pede.
 */

const db = vi.hoisted(() => ({
  listCreatures: vi.fn(),
  getCreature: vi.fn(),
  updateCreature: vi.fn(async () => ({})),
  duplicateCreature: vi.fn(async () => ({})),
  deleteCreature: vi.fn(async () => {}),
  listEncounters: vi.fn(),
  saveEncounter: vi.fn(async () => ({})),
  deleteEncounter: vi.fn(async () => {})
}))
const templates = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn() }))
const actions = vi.hoisted(() => ({
  newCreature: vi.fn(),
  pullPlayersToMap: vi.fn(async () => 2),
  spawnCreature: vi.fn(async () => ({ placed: 1, skipped: 0 })),
  spawnEncounter: vi.fn(async () => ({ placed: 3, skipped: 0 }))
}))

vi.mock('@/lib/db/bestiary', () => db)
vi.mock('@/features/sheet-templates/repository', () => ({ templateRepository: templates }))
vi.mock('./bestiary-actions', () => actions)
vi.mock('@/lib/db/gallery', () => ({
  listGallery: vi.fn(async () => []),
  GALLERY_KIND_LABELS: { monster: 'Monstros', npc: 'NPCs', object: 'Objetos' }
}))
vi.mock('@/lib/db/maps', () => ({ listMaps: vi.fn(async () => []) }))
vi.mock('@/lib/db/tokens', () => ({ listTokens: vi.fn(async () => []), moveToken: vi.fn() }))
vi.mock('@/lib/db/drawings', () => ({ listDrawings: () => Promise.resolve([]) }))

const { BestiaryPage } = await import('./bestiary-page')
const { CreatureEditorPage } = await import('./creature-editor-page')
const { GmToolsPanel } = await import('./gm-tools-panel')
const { useBoardStore } = await import('@/features/board/board-store')

function schema(label: string): SheetSchema {
  return {
    formatVersion: 1,
    tabs: [
      {
        id: 't',
        label: 'Stat block',
        components: [
          {
            id: 'c_defesa',
            type: 'number',
            key: 'defesa',
            label,
            defaultValue: 12,
            editableBy: 'gm',
            visibleTo: 'all',
            layout: { x: 0, y: 0, w: 3, h: 2 }
          }
        ]
      }
    ]
  }
}

const template: SheetTemplate = {
  id: 'tpl',
  name: 'Bicho',
  kind: 'creature',
  draftSchema: schema('Defesa'),
  versions: [
    { version: 1, schema: schema('Defesa'), publishedAt: '' },
    { version: 2, schema: schema('Defesa nova'), publishedAt: '' }
  ],
  createdAt: '',
  updatedAt: ''
}

function creature(partial: Partial<Creature> & { id: string; name: string }): Creature {
  return {
    kind: 'monster',
    tags: [],
    templateId: 'tpl',
    templateVersion: 1,
    values: { c_defesa: 14 },
    imagePath: null,
    tokenSize: 1,
    updatedAt: '',
    ...partial
  }
}

const goblin = creature({ id: 'goblin', name: 'Goblin', tags: ['floresta', 'fraco'] })
const orc = creature({ id: 'orc', name: 'Orc', tags: ['floresta'] })
const innkeeper = creature({ id: 'npc', name: 'Estalajadeiro', kind: 'npc', tags: ['cidade'] })
const ambush: Encounter = {
  id: 'e1',
  name: 'Emboscada',
  groups: [{ creatureId: 'goblin', count: 3, hidden: true }],
  updatedAt: ''
}

let container: HTMLElement
let root: Root

beforeEach(() => {
  db.listCreatures.mockResolvedValue([goblin, orc, innkeeper])
  db.listEncounters.mockResolvedValue([ambush])
  db.getCreature.mockResolvedValue(goblin)
  templates.get.mockResolvedValue(template)
  templates.list.mockResolvedValue([
    { id: 'tpl', name: 'Bicho', kind: 'creature', publishedVersion: 2, componentCount: 1, updatedAt: '' },
    { id: 'pc', name: 'Personagem', kind: 'character', publishedVersion: 1, componentCount: 1, updatedAt: '' },
    { id: 'draft', name: 'Rascunho', kind: 'creature', publishedVersion: null, componentCount: 0, updatedAt: '' }
  ])
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
  useBoardStore.getState().close()
  vi.clearAllMocks()
})

async function render(path: string): Promise<void> {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/bestiary" element={<BestiaryPage />} />
          <Route path="/bestiary/:creatureId" element={<CreatureEditorPage />} />
          <Route path="/table" element={<GmToolsPanel />} />
        </Routes>
      </MemoryRouter>
    )
  })
}

const names = (): string[] =>
  [...container.querySelectorAll('p.truncate.font-medium')].map((node) => node.textContent ?? '')

/** Campo pelo id (os do editor têm `<label for>`, não `aria-label`). */
function field(id: string): HTMLInputElement {
  const element = container.querySelector<HTMLInputElement>(`#${id}`)
  if (element === null) throw new Error(`Nada com id=${id}`)
  return element
}

/** A caixa de seleção pelo texto do rótulo que a envolve. */
function checkbox(text: string): HTMLInputElement {
  const label = [...container.querySelectorAll('label')].find((item) =>
    (item.textContent ?? '').includes(text)
  )
  const input = label?.querySelector<HTMLInputElement>('input[type="checkbox"]')
  if (input === null || input === undefined) throw new Error(`Nenhuma caixa "${text}"`)
  return input
}

describe('bestiário', () => {
  it('lista, busca sem acento e filtra por tag e tipo', async () => {
    await render('/bestiary')
    expect(names()).toEqual(['Estalajadeiro', 'Goblin', 'Orc'])

    typeInto(byLabel(container, 'Buscar criatura'), 'GOB')
    expect(names()).toEqual(['Goblin'])

    typeInto(byLabel(container, 'Buscar criatura'), '')
    click(buttonByText(byLabel(container, 'Filtrar por tag'), 'floresta'))
    expect(names()).toEqual(['Goblin', 'Orc'])
  })

  it('duplicar e excluir (com confirmação)', async () => {
    await render('/bestiary')
    await act(async () => byLabel(container, 'Duplicar Goblin').click())
    expect(db.duplicateCreature).toHaveBeenCalledWith(goblin)

    click(byLabel(container, 'Excluir Orc'))
    expect(db.deleteCreature).not.toHaveBeenCalled()
    await act(async () => buttonByText(document.body, 'Excluir').click())
    expect(db.deleteCreature).toHaveBeenCalledWith('orc')
  })

  it('criatura nova só oferece modelos de criatura publicados', async () => {
    await render('/bestiary')
    await act(async () => buttonByText(container, 'Nova criatura').click())
    const options = [...document.body.querySelectorAll('option')].map((item) => item.textContent)
    expect(options).toContain('Bicho (v2)')
    expect(options).not.toContain('Personagem (v1)')
    expect(options.some((text) => text?.startsWith('Rascunho'))).toBe(false)
  })

  it('o encontro novo é salvo com os grupos', async () => {
    await render('/bestiary')
    await act(async () => buttonByText(container, 'Encontros').click())
    expect(container.textContent).toContain('3 criatura(s) · 3× Goblin (oculta)')

    click(buttonByText(container, 'Novo encontro'))
    typeInto(byLabel(document.body, 'Nome do encontro'), 'Patrulha')
    typeInto(byLabel(document.body, 'Quantidade do grupo 1'), '4')
    await act(async () => buttonByText(document.body, 'Salvar').click())
    const [id, name, groups] = db.saveEncounter.mock.calls[0] as unknown as [string | null, string, unknown]
    expect(id).toBeNull()
    expect(name).toBe('Patrulha')
    expect(groups).toEqual([{ creatureId: 'goblin', count: 4, hidden: false }])
  })
})

describe('editor da criatura', () => {
  it('mostra o stat block da versão dela e salva nome, tags e valores', async () => {
    await render('/bestiary/goblin')
    expect(container.textContent).toContain('Defesa')
    expect(container.textContent).toContain('versão nova (v2)')
    expect(buttonByText(container, 'Salvar').disabled).toBe(true)

    typeInto(field('creature-name'), 'Goblin Chefe')
    typeInto(field('creature-tags'), 'Floresta, chefe, floresta')
    await act(async () => buttonByText(container, 'Salvar').click())

    expect(db.updateCreature).toHaveBeenCalledWith(
      'goblin',
      expect.objectContaining({
        name: 'Goblin Chefe',
        tags: ['floresta', 'chefe'],
        templateVersion: 1,
        values: { c_defesa: 14 }
      })
    )
  })

  it('atualizar o stat block leva para a versão nova sem perder o preenchido', async () => {
    await render('/bestiary/goblin')
    click(buttonByText(container, 'Atualizar o stat block'))
    expect(container.textContent).toContain('Defesa nova')
    await act(async () => buttonByText(container, 'Salvar').click())
    expect(db.updateCreature).toHaveBeenCalledWith(
      'goblin',
      expect.objectContaining({ templateVersion: 2, values: { c_defesa: 14 } })
    )
  })
})

describe('painel do mestre na mesa', () => {
  it('sem mapa aberto, nada é colocado', async () => {
    await render('/table')
    expect(buttonByText(container, 'Puxar jogadores').disabled).toBe(true)
    expect(container.textContent).toContain('Abra um mapa')
  })

  it('puxa jogadores, coloca encontro e criatura avulsa com as opções marcadas', async () => {
    useBoardStore.setState({ openMapId: 'm1' })
    await render('/table')

    click(checkbox('Reagrupar quem já está no mapa'))
    await act(async () => buttonByText(container, 'Puxar jogadores').click())
    expect(actions.pullPlayersToMap).toHaveBeenCalledWith(true)

    await act(async () => byLabel(container, 'Colocar o encontro Emboscada').click())
    expect(actions.spawnEncounter).toHaveBeenCalledWith(ambush, [goblin, orc, innkeeper], {
      addToCombat: false
    })

    typeInto(byLabel(container, 'Buscar no bestiário'), 'orc')
    await act(async () => byLabel(container, 'Colocar Orc').click())
    expect(actions.spawnCreature).toHaveBeenCalledWith(orc, { hidden: false, addToCombat: false })
  })
})
