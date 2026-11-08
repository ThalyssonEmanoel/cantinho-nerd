import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createComponent,
  createInitialValues,
  createSheetContext,
  type SheetComponent,
  type SheetSchema,
  type SheetValues
} from '@/lib/sheet'
import { SheetView } from './sheet-view'
import { TableView } from './table-view'

/** O caminho da foto vem do Storage; aqui importa só que a imagem certa foi pedida. */
vi.mock('@/hooks/use-asset-image', () => ({
  useAssetImage: (path: string | null) => ({
    image: path === null || path === '' ? null : { src: `blob:${path}` },
    loading: false,
    failed: false
  })
}))

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

function component<T extends SheetComponent['type']>(
  type: T,
  key: string,
  extra: Partial<Extract<SheetComponent, { type: T }>> = {}
): SheetComponent {
  return {
    ...createComponent(type, { takenKeys: [] }),
    id: `c_${key}`,
    key,
    label: key,
    ...extra
  } as SheetComponent
}

function schemaWith(...components: SheetComponent[]): SheetSchema {
  return { formatVersion: 1, tabs: [{ id: 'tab', label: 'Geral', components }] }
}

interface Options {
  values?: SheetValues
  onChange?: (id: string, value: unknown) => void
  onRoll?: (request: { label: string; formula: string }) => void
}

function renderSheet(schema: SheetSchema, options: Options = {}): HTMLElement {
  const values = options.values ?? createInitialValues(schema)
  const { context } = createSheetContext(schema, values)
  return render(
    <SheetView
      schema={schema}
      tabId="tab"
      values={values}
      context={context}
      options={{
        audience: 'player',
        onChange: options.onChange ?? vi.fn(),
        onRoll: options.onRoll ?? vi.fn()
      }}
    />
  )
}

/** Digita no campo do jeito que o React percebe (o setter nativo dispara o `onChange`). */
function type(input: HTMLInputElement, text: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('barra que acompanha o máximo', () => {
  const schema = schemaWith(
    component('resource', 'vida', {
      maxFormula: '=20 - dano_max',
      maxValue: undefined,
      followsMax: true
    }),
    component('number', 'dano_max', { defaultValue: 0 })
  )

  it('editar o que muda o máximo grava o campo e a barra, cada um no seu patch', () => {
    const onChange = vi.fn()
    const container = renderSheet(schema, {
      onChange,
      values: { c_vida: { current: 12 }, c_dano_max: 0 }
    })

    // O primeiro campo numérico é o da barra; o segundo é o do dano na vida máxima.
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="number"]')
    type(inputs[1] as HTMLInputElement, '5')

    expect(onChange.mock.calls).toEqual([
      ['c_dano_max', 5],
      ['c_vida', { current: 7 }]
    ])
  })

  it('editar a barra não mexe no número', () => {
    const onChange = vi.fn()
    const container = renderSheet(schema, {
      onChange,
      values: { c_vida: { current: 12 }, c_dano_max: 0 }
    })

    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="number"]')
    type(inputs[0] as HTMLInputElement, '9')

    expect(onChange.mock.calls).toEqual([['c_vida', { current: 9 }]])
  })

  it('atual negativo mostra a barra vazia, e não cheia', () => {
    const container = renderSheet(schema, { values: { c_vida: { current: -5 }, c_dano_max: 0 } })
    const fill = [...container.querySelectorAll<HTMLElement>('div')].find(
      (item) => item.style.backgroundColor !== '' || item.style.width !== ''
    )
    expect(fill?.style.width).toBe('0%')
  })
})

describe('parágrafo', () => {
  it('mostra o texto inteiro, com a quebra de linha, e não vira campo editável', () => {
    const container = renderSheet(
      schemaWith(
        component('heading', 'regra', {
          label: 'Projeção de Energia',
          text: 'Primeira linha.\nSegunda linha.',
          level: 'paragraph'
        })
      )
    )

    const paragraph = container.querySelector('p')
    expect(paragraph?.textContent).toBe('Primeira linha.\nSegunda linha.')
    expect(paragraph?.className).toContain('whitespace-pre-wrap')
    expect(container.textContent).toContain('Projeção de Energia')
    expect(container.querySelector('input, textarea')).toBeNull()
  })
})

describe('imagem fixa', () => {
  const retrato = component('image', 'retrato')

  it('mostra a imagem embutida no modelo', () => {
    const container = renderSheet(
      schemaWith(component('figure', 'roda', { src: 'data:image/png;base64,AAAA' }))
    )
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA')
  })

  it('repete a foto do campo de imagem da ficha', () => {
    const schema = schemaWith(retrato, component('figure', 'copia', { sourceFormula: '=retrato' }))
    const container = renderSheet(schema, { values: { c_retrato: 'sessions/1/portraits/a.webp' } })

    const shown = [...container.querySelectorAll('img')].map((image) => image.getAttribute('src'))
    expect(shown).toEqual(['blob:sessions/1/portraits/a.webp', 'blob:sessions/1/portraits/a.webp'])
  })

  it('sem foto ainda, não quebra: fica a moldura vazia', () => {
    const schema = schemaWith(retrato, component('figure', 'copia', { sourceFormula: '=retrato' }))
    const container = renderSheet(schema, { values: { c_retrato: '' } })
    expect(container.querySelector('img')).toBeNull()
  })

  it('não oferece trocar a imagem: quem troca é o campo de imagem', () => {
    const container = renderSheet(
      schemaWith(component('figure', 'roda', { src: 'data:image/png;base64,AAAA' }))
    )
    expect(container.querySelector('input[type="file"]')).toBeNull()
    expect(container.querySelector('button')).toBeNull()
  })
})

describe('campo calculado com texto longo', () => {
  it('deixa a caixa crescer, em vez de cortar o texto', () => {
    const text = 'Dano necrótico, psíquico e venenoso, condições Enfeitiçado e Amedrontado.'
    const container = renderSheet(
      schemaWith(component('computed', 'imunidades', { formula: `="${text}"` }))
    )

    const box = container.querySelector('.rounded-md')
    expect(box?.textContent).toBe(text)
    expect(box?.className).toContain('min-h-9')
    expect(box?.className.split(' ')).not.toContain('h-9')
    expect(box?.className).toContain('text-sm')
  })

  it('número continua em destaque', () => {
    const container = renderSheet(schemaWith(component('computed', 'ca', { formula: '=12' })))
    const box = container.querySelector('.rounded-md')
    expect(box?.textContent).toBe('12')
    expect(box?.className).toContain('text-base')
  })
})

describe('tabela', () => {
  function table(extra: Partial<Extract<SheetComponent, { type: 'table' }>>): SheetComponent {
    return component('table', 'armas', {
      label: 'Armas',
      columns: [
        { id: 'col_arma', key: 'arma', label: 'Arma', kind: 'text' },
        { id: 'col_dano', key: 'dano', label: 'Dano', kind: 'text' },
        { id: 'col_oculta', key: 'oculta', label: 'Oculta', kind: 'text', hidden: true },
        {
          id: 'col_rolar',
          key: 'rolar',
          label: 'Rolar dano',
          kind: 'rollButton',
          formula: '{dano}'
        }
      ],
      playerCanAddRows: true,
      ...extra
    })
  }

  function renderTable(component_: SheetComponent, onRoll = vi.fn()): HTMLElement {
    const schema = schemaWith(component_)
    const values = createInitialValues(schema)
    const { context } = createSheetContext(schema, values)
    return render(
      <TableView
        component={component_ as Extract<SheetComponent, { type: 'table' }>}
        context={context}
        values={values}
        options={{ audience: 'player', onChange: vi.fn(), onRoll }}
      />
    )
  }

  const rows = [
    { id: 'r1', key: 'r1', label: '', starter: true, cells: { arma: 'Lança', dano: '1d12' } },
    { id: 'r2', key: 'r2', label: '', starter: true, cells: { arma: 'Machadinha', dano: '1d6' } }
  ]

  it('coluna oculta não aparece nem no cabeçalho nem na linha', () => {
    const container = renderTable(
      table({ rows: [{ ...(rows[0] as (typeof rows)[0]), cells: { arma: 'Lança', oculta: 'x' } }] })
    )

    expect(container.textContent).not.toContain('Oculta')
    const typed = [...container.querySelectorAll('input')].map((input) => input.value)
    expect(typed).toContain('Lança')
    expect(typed).not.toContain('x')
  })

  it('linha inicial pode ser removida e reordenada', () => {
    const container = renderTable(table({ rows }))
    expect(container.querySelectorAll('[aria-label="Remover linha"]').length).toBe(2)
    expect(container.querySelectorAll('[aria-label="Reordenar linha"]').length).toBe(2)
  })

  it('rolagem sem rótulo de linha usa o nome digitado na primeira coluna de texto', () => {
    const onRoll = vi.fn()
    const container = renderTable(table({ rows }), onRoll)

    const buttons = [...container.querySelectorAll('button')].filter((button) =>
      (button.textContent ?? '').includes('Rolar dano')
    )
    act(() => {
      buttons[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onRoll.mock.calls[0]?.[0]).toMatchObject({
      label: 'Machadinha: Rolar dano',
      formula: '{dano}'
    })
  })

  it('o texto que não coube na célula aparece ao passar o mouse', () => {
    const container = renderTable(table({ rows }))
    const titles = [...container.querySelectorAll('input')].map((input) => input.title)
    expect(titles).toContain('Machadinha')
  })

  it('a dica da coluna aparece no cabeçalho, e o botão não repete o nome ali', () => {
    const container = renderTable(
      table({
        rows,
        columns: [
          { id: 'col_arma', key: 'arma', label: 'Arma', kind: 'text', hint: 'Nome da arma' },
          { id: 'col_rolar', key: 'rolar', label: 'Rolar', kind: 'rollButton', formula: '1d20' }
        ]
      })
    )

    const header = container.querySelector('.bg-muted\\/50')
    expect(header?.textContent).toContain('Arma')
    expect(header?.textContent).not.toContain('Rolar')
    expect(header?.querySelector('[title="Nome da arma"]')).not.toBeNull()
    // O nome continua no botão de cada linha.
    expect([...container.querySelectorAll('button')].map((item) => item.textContent)).toContain(
      'Rolar'
    )
  })

  describe('tabela que só o mestre edita', () => {
    const reference = table({
      editableBy: 'gm',
      rows: [],
      playerCanAddRows: false,
      columns: [
        { id: 'col_nivel', key: 'nivel', label: 'Nível', kind: 'number' },
        { id: 'col_efeito', key: 'efeito', label: 'Efeito', kind: 'text' }
      ]
    })
    const withRow = {
      ...reference,
      rows: [
        { id: 'r1', key: 'r1', label: '', cells: { nivel: 8, efeito: 'Desvantagem em ataques' } }
      ]
    } as SheetComponent

    function renderFor(audience: 'gm' | 'player', readOnly = false): HTMLElement {
      const schema = schemaWith(withRow)
      const values = createInitialValues(schema)
      const { context } = createSheetContext(schema, values)
      return render(
        <TableView
          component={withRow as Extract<SheetComponent, { type: 'table' }>}
          context={context}
          values={values}
          options={{ audience, readOnly, onChange: vi.fn() }}
        />
      )
    }

    it('para o jogador é texto, e não caixa apagada', () => {
      const container = renderFor('player')
      expect(container.querySelector('input')).toBeNull()
      expect(container.textContent).toContain('Desvantagem em ataques')
      expect(container.textContent).toContain('8')
    })

    it('o mestre continua editando', () => {
      const container = renderFor('gm')
      const inputs = [...container.querySelectorAll('input')]
      expect(inputs.map((input) => input.value)).toEqual(['8', 'Desvantagem em ataques'])
      expect(inputs.every((input) => !input.disabled)).toBe(true)
    })

    it('na grade do construtor continua mostrando o campo', () => {
      const container = renderFor('gm', true)
      expect(container.querySelectorAll('input').length).toBe(2)
    })
  })
})
