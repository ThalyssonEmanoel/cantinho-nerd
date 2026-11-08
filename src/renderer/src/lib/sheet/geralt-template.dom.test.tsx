import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GridCanvas } from '@/features/sheet-builder/grid-canvas'
import { SheetView } from '@/features/sheet-render/sheet-view'
import {
  createInitialValues,
  createPreviewValues,
  createSheetContext,
  parseTemplateFile,
  type SheetSchema,
  type SheetValue,
  type SheetValues
} from '@/lib/sheet'
import { typeInto } from '@/test/dom-helpers'
import type { TemplateFile } from './schema'
import { createBlankTemplateFile, createGeraltTemplateFile } from './geralt-template'

/**
 * Os modelos da planilha montados de verdade, aba por aba, pelo mesmo caminho do botão Importar.
 *
 * Os testes de lógica leem os valores; este olha o que a tela escreve. Fórmula quebrada numa
 * coluna só apareceria aqui, como `#ERRO` no meio da ficha.
 */

function imported(file: TemplateFile): SheetSchema {
  const parsed = parseTemplateFile(JSON.stringify(file))
  if (!parsed.ok) throw new Error(parsed.message)
  return parsed.value.schema
}

const schema = imported(createGeraltTemplateFile())
const blankSchema = imported(createBlankTemplateFile())

const TABS = schema.tabs.map((tab) => [tab.label, tab.id] as const)

const roots: { unmount: () => void; container: HTMLElement }[] = []

function render(element: React.ReactNode): HTMLElement {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(element)
  })
  roots.push({ unmount: () => root.unmount(), container })
  return container
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount())
    root.container.remove()
  }
})

function renderTab(
  tabId: string,
  audience: 'gm' | 'player',
  values: SheetValues,
  model: SheetSchema = schema
): HTMLElement {
  const { context } = createSheetContext(model, values)
  return render(
    <SheetView
      schema={model}
      tabId={tabId}
      values={values}
      context={context}
      options={{
        audience,
        applyConditionalVisibility: true,
        onChange: vi.fn(),
        onRoll: vi.fn(),
        uploadImage: vi.fn(async () => undefined)
      }}
    />
  )
}

describe('na ficha', () => {
  it.each(TABS)('%s abre sem #ERRO para o jogador', (_label, tabId) => {
    const container = renderTab(tabId, 'player', createInitialValues(schema))
    expect(container.textContent).not.toContain('#ERRO')
    expect(container.textContent).not.toContain('Nada para mostrar')
  })

  it.each(TABS)('%s abre sem #ERRO para o mestre', (_label, tabId) => {
    expect(renderTab(tabId, 'gm', createInitialValues(schema)).textContent).not.toContain('#ERRO')
  })

  it('Personagem mostra o Geralt e a vida calculada', () => {
    const container = renderTab('tab_personagem', 'player', createInitialValues(schema))
    const typed = [...container.querySelectorAll('input')].map((input) => input.value)
    expect(typed).toContain('Geralt Wolf Vengerberg')
    expect(typed).toContain('Combatente')
    expect(container.textContent).toContain('Acrobacia')
    expect(container.textContent).toContain('Tecnologia')
  })

  it('Combate traz as armas do Geralt, removíveis, e a nota de maestria', () => {
    const container = renderTab('tab_combate', 'player', createInitialValues(schema))
    const typed = [...container.querySelectorAll('input')].map((input) => input.value)
    expect(typed).toContain('Lança Longa')
    expect(typed).toContain('Machadinha')
    expect(container.querySelectorAll('[aria-label="Remover linha"]').length).toBe(2)
    expect(container.querySelector('textarea')?.value).toContain('Empurrar - A propriedade')
  })

  it('Magias mostra a roda dos elementos embutida no modelo', () => {
    const container = renderTab('tab_magias', 'player', createInitialValues(schema))
    const wheel = container.querySelector('img')
    expect(wheel?.getAttribute('src')?.startsWith('data:image/webp;base64,')).toBe(true)
  })

  it('as tabelas de referência são texto para o jogador', () => {
    const container = renderTab('tab_familiar', 'player', createInitialValues(schema))
    expect(container.textContent).toContain('MAGIA FAMILIAR, TIER 3')
    const typed = [...container.querySelectorAll('input')].map((input) => input.value)
    expect(typed).not.toContain('MAGIA FAMILIAR, TIER 3')
  })

  it('as regras dos comentários da planilha ficam à vista no Familiar', () => {
    const container = renderTab('tab_familiar', 'player', createInitialValues(schema))
    expect(container.textContent).toContain('Emanação Energética')
    expect(container.textContent).toContain('cone de 15 pés')
  })
})

describe('o modelo da mesa, em branco', () => {
  const fresh = (): SheetValues => createInitialValues(blankSchema)

  it.each(TABS)('%s abre sem #ERRO para o jogador', (_label, tabId) => {
    const container = renderTab(tabId, 'player', fresh(), blankSchema)
    expect(container.textContent).not.toContain('#ERRO')
    expect(container.textContent).not.toContain('Nada para mostrar')
  })

  it.each(TABS)('%s abre sem #ERRO para o mestre', (_label, tabId) => {
    const container = renderTab(tabId, 'gm', fresh(), blankSchema)
    expect(container.textContent).not.toContain('#ERRO')
  })

  it('Personagem nasce sem nome, e a primeira classe é "Classe 1"', () => {
    const container = renderTab('tab_personagem', 'player', fresh(), blankSchema)
    const typed = [...container.querySelectorAll('input')].map((input) => input.value)
    expect(typed).toContain('Classe 1')
    expect(typed).not.toContain('Geralt Wolf Vengerberg')
    expect(typed).not.toContain('Combatente')
  })

  it('Combate nasce sem armas nem notas, e com o botão de adicionar', () => {
    const container = renderTab('tab_combate', 'player', fresh(), blankSchema)
    expect(container.textContent).toContain('Nenhuma linha.')
    expect(container.textContent).toContain('Adicionar')
    expect(container.querySelector('textarea')?.value).toBe('')
  })
})

describe('um jogador preenchendo a ficha em branco', () => {
  /** As duas abas lado a lado, com estado de verdade: cada edição recalcula como na mesa. */
  function Filling(): React.JSX.Element {
    const [values, setValues] = useState<SheetValues>(() => createInitialValues(blankSchema))
    const { context } = createSheetContext(blankSchema, values)
    const options = {
      audience: 'player' as const,
      applyConditionalVisibility: true,
      onChange: (id: string, value: SheetValue) =>
        setValues((current) => ({ ...current, [id]: value })),
      onRoll: () => undefined
    }
    return (
      <>
        {['tab_personagem', 'tab_combate'].map((tabId) => (
          <SheetView
            key={tabId}
            schema={blankSchema}
            tabId={tabId}
            values={values}
            context={context}
            options={options}
          />
        ))}
      </>
    )
  }

  /** O campo pelo rótulo: a moldura guarda o rótulo e o controle na mesma coluna. */
  function fieldNamed(container: HTMLElement, label: string): HTMLElement {
    const span = [...container.querySelectorAll('span')].find((item) => item.textContent === label)
    const frame = span?.closest<HTMLElement>('.flex-col')
    if (frame === null || frame === undefined) throw new Error(`Sem o campo "${label}".`)
    return frame
  }

  function firstClassRow(container: HTMLElement): HTMLElement {
    const name = [...container.querySelectorAll('input')].find((item) => item.value === 'Classe 1')
    const row = name?.parentElement
    if (row === null || row === undefined) throw new Error('Sem a linha da primeira classe.')
    return row
  }

  function lifeBar(container: HTMLElement): { current: string; text: string } {
    const frame = fieldNamed(container, 'Vida atual / máxima')
    return {
      current: frame.querySelector('input')?.value ?? '',
      text: frame.textContent ?? ''
    }
  }

  function damageShown(container: HTMLElement): string {
    return fieldNamed(container, 'Dano recebido: normal').querySelector('.rounded-md')
      ?.textContent as string
  }

  it('a vida acompanha o que ele digita, e não aparece dano que ninguém levou', () => {
    const container = render(<Filling />)
    expect(lifeBar(container).current).toBe('2')
    expect(lifeBar(container).text).toContain('2')

    const row = firstClassRow(container)
    typeInto(row.querySelector<HTMLInputElement>('input[type="number"]') as HTMLInputElement, '5')

    const die = firstClassRow(container).querySelector('select') as HTMLSelectElement
    act(() => {
      die.value = 'o_d10'
      die.dispatchEvent(new Event('change', { bubbles: true }))
    })

    typeInto(fieldNamed(container, 'Constituição').querySelector('input') as HTMLInputElement, '14')

    // 10 + 6 × 4 + 2 × 5: a conta da PERSONAGEM!P26, com a vida atual junto.
    expect(lifeBar(container).current).toBe('44')
    expect(lifeBar(container).text).toContain('44')
    expect(damageShown(container)).toBe('0')
  })

  it('o dano na vida máxima tira das duas, e o dano normal fica igual', () => {
    const container = render(<Filling />)
    typeInto(
      firstClassRow(container).querySelector<HTMLInputElement>(
        'input[type="number"]'
      ) as HTMLInputElement,
      '8'
    )
    const before = Number(lifeBar(container).current)

    typeInto(
      fieldNamed(container, 'Dano recebido: vida máxima').querySelector(
        'input'
      ) as HTMLInputElement,
      '5'
    )

    expect(Number(lifeBar(container).current)).toBe(before - 5)
    expect(damageShown(container)).toBe('0')
  })
})

describe('no construtor', () => {
  it.each(TABS)('%s monta na grade', (_label, tabId) => {
    const values = createPreviewValues(schema)
    const { context } = createSheetContext(schema, values)
    const container = render(
      <GridCanvas
        schema={schema}
        tabId={tabId}
        values={values}
        context={context}
        selectedId={null}
        draggingType={null}
        onSelect={vi.fn()}
        onLayoutsChange={vi.fn()}
        onDropNew={vi.fn()}
        onInteractionStart={vi.fn()}
        onInteractionEnd={vi.fn()}
      />
    )

    expect(container.textContent).not.toContain('#ERRO')
  })
})
