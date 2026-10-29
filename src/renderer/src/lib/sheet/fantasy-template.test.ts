import { describe, expect, it } from 'vitest'
import { createSeededEngine, rollFormula } from '../dice'
import { evaluateFormula, toBoolean, type FormulaContext, type FormulaValue } from '../formula'
import {
  computeSheet,
  createInitialValues,
  createRowFormulaContext,
  createSheetContext,
  readFormulaValue
} from './context'
import { createFantasySchema, createFantasyTemplateFile } from './fantasy-template'
import { MAX_IMPORT_BYTES, parseTemplateFile } from './schema'
import { allComponents, findComponentByKey, type SheetComponent } from './types'
import { validateSchema } from './validate'
import { isTableValue, type SheetValues } from './values'

/**
 * A ficha padrão de fantasia (docs/FichaPadrao.md) passa pelo mesmo caminho que um modelo
 * feito à mão no construtor: importação, validação e fórmulas. As contas esperadas aqui
 * vêm do documento, e não do gerador, para um erro de digitação nos dados aparecer.
 */

const schema = createFantasySchema()

const RACES = ['Humano', 'Elfo', 'Anão', 'Demônio', 'Mutante', 'Descendente de Anjo']
const CLASSES = [
  'Guerreiro',
  'Monge',
  'Clérigo',
  'Ladino',
  'Arqueiro',
  'Descendente de Satã',
  'Mago',
  'Feiticeiro'
]

function component(key: string): SheetComponent {
  const found = findComponentByKey(schema, key)
  if (found === undefined) throw new Error(`Componente "${key}" não existe no modelo.`)
  return found
}

function optionId(key: string, label: string): string {
  const found = component(key)
  if (found.type !== 'select') throw new Error(`"${key}" não é uma lista.`)
  const option = found.options.find((item) => item.label === label)
  if (option === undefined) throw new Error(`"${key}" não tem a opção "${label}".`)
  return option.id
}

interface SheetSetup {
  raca?: string
  classe?: string
  nivel?: number
  /** Valores por chave; texto em lista de opções é o rótulo da opção. */
  fields?: Record<string, string | number | boolean>
  /** Habilidades marcadas (chaves das linhas da tabela da classe). */
  chosen?: readonly string[]
}

function sheet(setup: SheetSetup = {}): SheetValues {
  const values = createInitialValues(schema)
  const set = (key: string, value: string | number | boolean): void => {
    const target = component(key)
    values[target.id] =
      target.type === 'select' && typeof value === 'string' ? optionId(key, value) : value
  }

  if (setup.raca !== undefined) set('raca', setup.raca)
  if (setup.classe !== undefined) set('classe', setup.classe)
  if (setup.nivel !== undefined) set('nivel', setup.nivel)
  for (const [key, value] of Object.entries(setup.fields ?? {})) set(key, value)

  if (setup.chosen !== undefined) {
    const table = component(abilityTableKey(setup.classe ?? 'Guerreiro'))
    const rows = values[table.id]
    if (!isTableValue(rows)) throw new Error('A tabela de habilidades não tem linhas.')
    values[table.id] = rows.map((row) => ({
      ...row,
      cells: { ...row.cells, esc: setup.chosen?.includes(row.key ?? '') === true }
    }))
  }

  return values
}

function abilityTableKey(classLabel: string): string {
  const table = allComponents(schema).find(
    (item) => item.type === 'table' && item.visibleWhen === `classe == "${classLabel}"`
  )
  if (table === undefined) throw new Error(`Sem tabela de habilidades para ${classLabel}.`)
  return table.key
}

function read(values: SheetValues, ...path: string[]): FormulaValue | undefined {
  const { context } = createSheetContext(schema, values)
  const { value, error } = readFormulaValue(context, path)
  if (error !== undefined) throw new Error(`${path.join('.')}: ${error.message}`)
  return value
}

function isVisible(item: SheetComponent, context: FormulaContext): boolean {
  if (item.visibleWhen === undefined) return true
  const result = evaluateFormula(item.visibleWhen, context)
  if (!result.ok) throw new Error(`${item.key} → visibilidade: ${result.error.message}`)
  return toBoolean(result.value)
}

describe('ficha padrão de fantasia', () => {
  it('passa pela importação da biblioteca', () => {
    const text = JSON.stringify(createFantasyTemplateFile())
    expect(text.length).toBeLessThan(MAX_IMPORT_BYTES)

    const parsed = parseTemplateFile(text)
    expect(parsed.ok ? null : parsed.message).toBeNull()
  })

  it('o Validar do construtor não acusa nada', () => {
    const report = validateSchema(schema)
    expect(report.issues.map((issue) => issue.message)).toEqual([])
  })

  it('tem as 9 abas da seção 7 e os papéis da mesa', () => {
    expect(schema.tabs.map((tab) => tab.label)).toEqual([
      'Resumo',
      'Atributos',
      'Habilidades',
      'Combate',
      'Magias',
      'Equipamentos',
      'Inventário',
      'Progressão',
      'Anotações'
    ])

    const roles = Object.fromEntries(
      allComponents(schema)
        .filter((item) => item.role !== undefined)
        .map((item) => [item.role, item.key])
    )
    expect(roles).toEqual({
      name: 'nome',
      portrait: 'retrato',
      hp: 'vida',
      bar2: 'energia',
      defense: 'defesa',
      initiative: 'iniciativa'
    })
  })

  it('todas as combinações de raça e classe calculam sem #ERRO e rolam', () => {
    const engine = createSeededEngine(7)

    for (const raca of RACES) {
      for (const classe of CLASSES) {
        const values = sheet({ raca, classe, nivel: 3 })
        const result = computeSheet(schema, values)
        const where = `${raca} / ${classe}`
        expect([...result.errors.keys()], where).toEqual([])

        for (const item of allComponents(schema)) {
          // A condição de visibilidade também é fórmula: quebrada, mostraria o bloco errado.
          if (!isVisible(item, result.context)) continue

          if (item.type === 'rollButton') {
            const rolled = rollFormula(item.formula, { context: result.context, engine })
            expect(rolled.ok ? null : rolled.error.message, `${where}: ${item.key}`).toBeNull()
          }

          if (item.type !== 'table') continue
          const rows = values[item.id]
          if (!isTableValue(rows)) continue

          for (const row of rows) {
            const rowName = row.key ?? row.id
            for (const column of item.columns) {
              if (column.kind === 'computed') {
                const { error } = readFormulaValue(result.context, [item.key, rowName, column.key])
                expect(error?.message, `${where}: ${item.key}.${rowName}.${column.key}`).toBe(
                  undefined
                )
              }
              if (column.kind === 'rollButton') {
                const rowContext = createRowFormulaContext(result.context, item, rowName)
                const rolled = rollFormula(column.formula ?? '', { context: rowContext, engine })
                expect(rolled.ok ? null : rolled.error.message, `${where}: ${rowName}`).toBeNull()
              }
            }
          }
        }
      }
    }
  })

  it('cada classe tem 5 habilidades de nível 1, 3 de nível 2 e 3 de nível 3', () => {
    for (const classe of CLASSES) {
      const table = component(abilityTableKey(classe))
      if (table.type !== 'table') throw new Error('não é tabela')
      const levels = table.rows.map((row) => row.cells?.nv)
      expect(levels, classe).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3])
    }
  })

  it('só a tabela de habilidades da classe escolhida aparece', () => {
    for (const classe of CLASSES) {
      const { context } = createSheetContext(schema, sheet({ classe }))
      const visibleTables = allComponents(schema)
        .filter((item) => item.key.startsWith('hab_') && isVisible(item, context))
        .map((item) => item.key)
      expect(visibleTables).toEqual([abilityTableKey(classe)])
    }
  })

  it('cada raça escolhe a quantidade de habilidades da seção 2', () => {
    const expected: Record<string, [number, number, number]> = {
      Humano: [2, 1, 1],
      Elfo: [2, 2, 2],
      Anão: [4, 1, 1],
      Demônio: [2, 1, 3],
      Mutante: [2, 3, 1],
      'Descendente de Anjo': [4, 3, 2]
    }

    for (const [raca, limits] of Object.entries(expected)) {
      const values = sheet({ raca })
      expect(
        [1, 2, 3].map((level) => read(values, `limite_n${level}`)),
        raca
      ).toEqual(limits)
    }
  })

  it('vida e energia seguem a seção 1.3, o nível e os itens equipados', () => {
    const bases: Record<string, [number, number]> = {
      Guerreiro: [18, 4],
      Monge: [14, 8],
      Clérigo: [14, 12],
      Ladino: [12, 8],
      Arqueiro: [12, 8],
      'Descendente de Satã': [14, 14],
      Mago: [10, 16],
      Feiticeiro: [12, 14]
    }

    // Humano sem o +1 escolhido: VIG 2 e ESP 2.
    for (const [classe, [hp, energy]] of Object.entries(bases)) {
      const values = sheet({ raca: 'Humano', classe })
      expect(read(values, 'vida', 'max'), classe).toBe(hp + 2 * 3)
      expect(read(values, 'energia', 'max'), classe).toBe(energy + 2 * 2)
    }

    // Anão Guerreiro nível 3: VIG 3 → 18 + 9 + 2 × 2 = 31; ESP 2 → 4 + 4 + 2 = 10.
    const dwarf = sheet({ raca: 'Anão', classe: 'Guerreiro', nivel: 3 })
    expect(read(dwarf, 'vida', 'max')).toBe(31)
    expect(read(dwarf, 'energia', 'max')).toBe(10)

    // Anel Vital só conta equipado.
    const ring = sheet({ raca: 'Humano', classe: 'Mago' })
    const items = component('itens_magicos')
    ring[items.id] = [
      { id: 'r1', cells: { item: 'Anel Vital', equipado: true, pv: 3, pe: 0, desl: 0 } },
      { id: 'r2', cells: { item: 'Amuleto Arcano', equipado: false, pv: 0, pe: 3, desl: 0 } }
    ]
    expect(read(ring, 'vida', 'max')).toBe(10 + 6 + 3)
    expect(read(ring, 'energia', 'max')).toBe(16 + 4)
  })

  it('a raça modifica os atributos depois da distribuição', () => {
    const start = sheet({ raca: 'Humano' })
    expect(read(start, 'pontos_livres')).toBe(3)
    expect(read(start, 'atributos_aviso')).toBe('Ainda há pontos para distribuir')

    const angel = sheet({ raca: 'Descendente de Anjo' })
    expect(read(angel, 'forca', 'mod')).toBe(1)
    expect(read(angel, 'espirito', 'mod')).toBe(3)
    expect(read(angel, 'vigor', 'mod')).toBe(3)

    const human = sheet({
      raca: 'Humano',
      fields: { humano_bonus: 'INT', inteligencia: 5 }
    })
    expect(read(human, 'inteligencia', 'mod')).toBe(6)
    expect(read(human, 'pontos_livres')).toBe(0)
    expect(read(human, 'atributos_aviso')).toBe('Distribuição certa')

    // O +1 escolhido como Humano não vale se a raça mudar depois.
    const changed = sheet({ raca: 'Elfo', fields: { humano_bonus: 'INT' } })
    expect(read(changed, 'inteligencia', 'mod')).toBe(2)
    expect(read(changed, 'agilidade', 'mod')).toBe(3)
  })

  it('a Defesa soma a única armadura, o escudo e o ajuste temporário', () => {
    const values = sheet({
      fields: { armadura_tipo: 'Pesada', escudo_bonus: 1, defesa_ajuste: -2 }
    })
    expect(read(values, 'defesa')).toBe(10 + 2 + 3 + 1 - 2)
    expect(read(values, 'armadura_penalidade')).toBe(
      '−2 em AGI nos testes de mobilidade e furtividade'
    )

    const custom = sheet({
      fields: { armadura_tipo: 'Personalizada', armadura_bonus_personalizado: 4 }
    })
    expect(read(custom, 'defesa')).toBe(10 + 2 + 4)
  })

  it('o Anão anda 1 a menos, nunca abaixo de 1, e as Botas do Vento somam', () => {
    expect(read(sheet({ raca: 'Elfo' }), 'deslocamento')).toBe(6)
    expect(read(sheet({ raca: 'Anão' }), 'deslocamento')).toBe(5)

    const slow = sheet({ raca: 'Anão', fields: { deslocamento_base: 1 } })
    expect(read(slow, 'deslocamento')).toBe(1)

    const boots = sheet({ raca: 'Anão' })
    boots[component('itens_magicos').id] = [
      { id: 'r1', cells: { item: 'Botas do Vento', equipado: true, pv: 0, pe: 0, desl: 1 } }
    ]
    expect(read(boots, 'deslocamento')).toBe(6)
  })

  it('o valor das habilidades usa a arma principal ou o atributo certo', () => {
    const warrior = sheet({
      classe: 'Guerreiro',
      fields: { arma1_dano: 5, dano_fisico_ajuste: 3 }
    })
    // Golpe Brutal: dano da arma + 3, mais o ajuste de dano físico (Fúria de Guerra).
    expect(read(warrior, 'hab_guerreiro', 'golpe_brutal', 'valor')).toBe(5 + 3 + 3)
    expect(read(warrior, 'hab_guerreiro', 'guarda_de_ferro', 'valor')).toBe('—')

    // Toque Sagrado é cura: o ajuste de dano físico não entra.
    const cleric = sheet({ classe: 'Clérigo', fields: { dano_fisico_ajuste: 3 } })
    expect(read(cleric, 'hab_clerigo', 'toque_sagrado', 'valor')).toBe(4 + 2)

    const mage = sheet({ classe: 'Mago', fields: { inteligencia: 4 } })
    expect(read(mage, 'hab_mago', 'meteoro_menor', 'valor')).toBe(6 + 4)
  })

  it('mostra habilidades bloqueadas, escolhidas e sem PE', () => {
    const values = sheet({ classe: 'Guerreiro', chosen: ['golpe_brutal', 'execucao'] })
    expect(read(values, 'hab_guerreiro', 'golpe_brutal', 'situacao')).toBe('Escolhida')
    expect(read(values, 'hab_guerreiro', 'investida', 'situacao')).toBe('Disponível')
    expect(read(values, 'hab_guerreiro', 'determinacao', 'situacao')).toBe('Bloqueada')
    expect(read(values, 'hab_guerreiro', 'execucao', 'situacao')).toBe('Acima do nível')

    const tired = sheet({ classe: 'Guerreiro', chosen: ['golpe_brutal'] })
    const energy = component('energia')
    tired[energy.id] = { current: 0 }
    expect(read(tired, 'hab_guerreiro', 'golpe_brutal', 'situacao')).toBe('Sem PE')
  })

  it('conta as escolhas por nível e avisa quando passam do limite da raça', () => {
    const fresh = sheet({ raca: 'Humano', classe: 'Ladino' })
    expect(read(fresh, 'escolhas_pendentes')).toBe(2)
    expect(read(fresh, 'habilidades_aviso')).toBe('Ainda há habilidades para escolher')

    const done = sheet({
      raca: 'Humano',
      classe: 'Ladino',
      chosen: ['ataque_furtivo', 'truque_sujo']
    })
    expect(read(done, 'escolhidas_n1')).toBe(2)
    expect(read(done, 'habilidades_aviso')).toBe('Escolhas em dia')

    const tooMany = sheet({
      raca: 'Humano',
      classe: 'Ladino',
      chosen: ['ataque_furtivo', 'truque_sujo', 'passo_silencioso']
    })
    expect(read(tooMany, 'habilidades_aviso')).toBe(
      'Passou do limite da raça: desmarque alguma habilidade'
    )

    const early = sheet({
      raca: 'Humano',
      classe: 'Ladino',
      chosen: ['ataque_furtivo', 'truque_sujo', 'laminas_gemeas']
    })
    expect(read(early, 'habilidades_aviso')).toBe('Há habilidade marcada acima do seu nível')

    // Ao subir para o nível 2, aparece a escolha nova sem perder as antigas.
    const levelTwo = sheet({
      raca: 'Humano',
      classe: 'Ladino',
      nivel: 2,
      chosen: ['ataque_furtivo', 'truque_sujo']
    })
    expect(read(levelTwo, 'escolhas_pendentes')).toBe(1)
  })

  it('o Feiticeiro acompanha a Instabilidade e a dificuldade do controle', () => {
    const values = sheet({
      classe: 'Feiticeiro',
      fields: { instabilidade: 1, instabilidade_voluntaria: 2, controle_para: 'Ruína Caótica' }
    })
    expect(read(values, 'dificuldade_controle')).toBe(14 + 4)
    expect(read(values, 'bonus_controle')).toBe(2 - 1)
    expect(read(values, 'dano_voluntario')).toBe(4)
    expect(read(values, 'instabilidade_efeito')).toBe('−1 no próximo teste de controle')
  })

  it('avisa quando o personagem cai a 0 PV ou abaixo de 25%', () => {
    const values = sheet({ classe: 'Guerreiro' })
    const life = component('vida')

    values[life.id] = { current: 0 }
    expect(read(values, 'estado')).toBe('Incapacitado: o mestre decide o que acontece')

    values[life.id] = { current: 5 }
    expect(read(values, 'estado')).toBe('Gravemente ferido (abaixo de 25%)')
  })

  it('o arquivo para importar está em dia com o gerador', async () => {
    const json = `${JSON.stringify(createFantasyTemplateFile(), null, 2)}\n`
    await expect(json).toMatchFileSnapshot('../../../../../docs/fichas/fantasia-padrao.json')
  })
})
