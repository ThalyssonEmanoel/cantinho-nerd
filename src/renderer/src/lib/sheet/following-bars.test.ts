import { describe, expect, it } from 'vitest'
import { createComponent } from './factory'
import { followingBarChanges } from './following-bars'
import type { SheetComponent, SheetSchema } from './types'
import type { SheetValues } from './values'

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

function lifeBar(
  extra: Partial<Extract<SheetComponent, { type: 'resource' }>> = {}
): SheetComponent {
  return component('resource', 'vida', {
    maxFormula: '=10 + 5 * nivel - dano_max',
    maxValue: undefined,
    followsMax: true,
    ...extra
  })
}

const life = lifeBar()
const level = component('number', 'nivel')
const damage = component('number', 'dano_max')
const other = component('number', 'outro')

function schemaWith(...components: SheetComponent[]): SheetSchema {
  return { formatVersion: 1, tabs: [{ id: 'tab', label: 'Geral', components }] }
}

const schema = schemaWith(life, level, damage, other)

function values(current: number, nivel = 0, danoMax = 0): SheetValues {
  return { c_vida: { current }, c_nivel: nivel, c_dano_max: danoMax, c_outro: 0 }
}

describe('barra que acompanha o máximo', () => {
  it('subir de nível sobe o atual junto: a ficha nasce no 0 e continua cheia', () => {
    expect(followingBarChanges(schema, values(10), 'c_nivel', 5, 'player')).toEqual([
      { id: 'c_vida', value: { current: 35 } }
    ])
  })

  it('o dano levado continua igual', () => {
    // Máximo 35, atual 20: 15 de dano. No nível 6, máximo 40 e atual 25: os mesmos 15.
    const [change] = followingBarChanges(schema, values(20, 5), 'c_nivel', 6, 'player')
    expect(change?.value.current).toBe(25)
  })

  it('dano na vida máxima tira dos dois, e curar devolve', () => {
    expect(followingBarChanges(schema, values(20, 5), 'c_dano_max', 5, 'player')).toEqual([
      { id: 'c_vida', value: { current: 15 } }
    ])
    expect(followingBarChanges(schema, values(15, 5, 5), 'c_dano_max', 2, 'player')).toEqual([
      { id: 'c_vida', value: { current: 18 } }
    ])
  })

  it('não mexe na barra quando o máximo não muda', () => {
    expect(followingBarChanges(schema, values(20, 5), 'c_outro', 9, 'player')).toEqual([])
    expect(followingBarChanges(schema, values(20, 5), 'c_nivel', 5, 'player')).toEqual([])
    expect(followingBarChanges(schema, values(20, 5), 'nao_existe', 9, 'player')).toEqual([])
  })

  it('editar a própria barra não dispara nada', () => {
    expect(followingBarChanges(schema, values(20, 5), 'c_vida', { current: 3 }, 'player')).toEqual(
      []
    )
  })

  it('digitar 13 passando pelo 1 não apaga o dano levado', () => {
    // Nível 12: máximo 70, atual 20, ou seja, 50 de dano.
    let state = values(20, 12)

    for (const typed of [1, 13]) {
      const [change] = followingBarChanges(schema, state, 'c_nivel', typed, 'player')
      state = { ...state, c_nivel: typed, c_vida: change?.value ?? { current: 0 } }
    }

    // Nível 13: máximo 75, e os mesmos 50 de dano. Com piso em zero, daria 60.
    expect(state['c_vida']).toEqual({ current: 25 })
  })

  it('pode ficar negativo, como a vida da planilha', () => {
    const [change] = followingBarChanges(schema, values(3, 5), 'c_dano_max', 10, 'player')
    expect(change?.value.current).toBe(-7)
  })

  it('barra sem a opção não acompanha: é a regra de sempre, "barra antiga não é curada"', () => {
    const plain = schemaWith(lifeBar({ followsMax: undefined }), level, damage)
    expect(followingBarChanges(plain, values(10), 'c_nivel', 5, 'player')).toEqual([])
  })

  it('barra só do mestre não muda pela mão do jogador, mas muda pela do mestre', () => {
    const gmBar = schemaWith(lifeBar({ editableBy: 'gm' }), level, damage)
    expect(followingBarChanges(gmBar, values(10), 'c_nivel', 5, 'player')).toEqual([])
    expect(followingBarChanges(gmBar, values(10), 'c_nivel', 5, 'gm')).toEqual([
      { id: 'c_vida', value: { current: 35 } }
    ])
  })

  it('fórmula de máximo com erro não mexe na barra', () => {
    const broken = schemaWith(lifeBar({ maxFormula: '=nao_existe + nivel' }), level)
    expect(followingBarChanges(broken, values(10), 'c_nivel', 5, 'player')).toEqual([])
  })

  it('preserva o que mais estiver guardado na barra', () => {
    const fixed: SheetValues = { c_vida: { current: 10, max: 99 }, c_nivel: 0 }
    expect(followingBarChanges(schema, fixed, 'c_nivel', 1, 'player')[0]?.value).toEqual({
      current: 15,
      max: 99
    })
  })

  it('edição dentro de tabela também conta', () => {
    const classes = component('table', 'classes', {
      columns: [{ id: 'col_nivel', key: 'nivel', label: 'Nível', kind: 'number' }],
      rows: [{ id: 'r1', key: 'c1', label: '' }]
    })
    const bar = component('resource', 'vida', {
      maxFormula: '=10 + soma(classes.nivel)',
      maxValue: undefined,
      followsMax: true
    })
    const state: SheetValues = {
      c_vida: { current: 10 },
      c_classes: [{ id: 'r1', key: 'c1', cells: { nivel: 0 } }]
    }

    expect(
      followingBarChanges(
        schemaWith(bar, classes),
        state,
        'c_classes',
        [{ id: 'r1', key: 'c1', cells: { nivel: 3 } }],
        'player'
      )
    ).toEqual([{ id: 'c_vida', value: { current: 13 } }])
  })
})
