import { describe, expect, it } from 'vitest'
import { visibleBars } from '../board/tokens'
import { rollInitiative } from '../combat/initiative'
import { createSeededEngine, rollFormula } from '../dice'
import { evaluateFormula, toBoolean, type FormulaContext, type FormulaValue } from '../formula'
import {
  computeSheet,
  createInitialValues,
  createRowFormulaContext,
  createSheetContext,
  readFormulaValue
} from './context'
import { createTemplate } from './factory'
import {
  createBlankSchema,
  createBlankTemplateFile,
  createGeraltSchema,
  createGeraltTemplateFile
} from './geralt-template'
import { followingBarChanges } from './following-bars'
import { holdsValue } from './permissions'
import { MAX_IMPORT_BYTES, parseSheetRecord, parseTemplateFile } from './schema'
import {
  createSheetRecord,
  mergedValues,
  patchFields,
  rejectedPatchFields,
  type SheetRecord
} from './sheet-record'
import { allComponents, findComponentByKey, type SheetComponent } from './types'
import { validateSchema } from './validate'
import { isTableValue, type SheetValue, type SheetValues, type TableRowValue } from './values'

/**
 * A planilha "Ficha do Geralt Wolf Vengerberg" como modelo de ficha.
 *
 * Duas conferências separadas, de propósito:
 * - "como foi baixada": a ficha nova tem de dar os mesmos números que estão guardados no
 *   arquivo, célula por célula (o nome da célula está em cada linha).
 * - "como a planilha calcula": as fórmulas originais transcritas aqui em JavaScript, comparadas
 *   com o modelo em vários valores. A primeira só testa o caso do arquivo, zerado.
 */

const schema = createGeraltSchema()

function component(key: string): SheetComponent {
  const found = findComponentByKey(schema, key)
  if (found === undefined) throw new Error(`Componente "${key}" não existe no modelo.`)
  return found
}

function fresh(): SheetValues {
  return createInitialValues(schema)
}

function read(values: SheetValues, path: string): FormulaValue | undefined {
  const { context } = createSheetContext(schema, values)
  const { value, error } = readFormulaValue(context, path.split('.'))
  if (error !== undefined) throw new Error(`${path}: ${error.message}`)
  return value
}

/** Devolve a linha fixa de uma tabela, para o teste poder mexer nas células dela. */
function rowOf(values: SheetValues, tableKey: string, rowKey: string): TableRowValue {
  const rows = values[component(tableKey).id]
  if (!isTableValue(rows)) throw new Error(`"${tableKey}" não é tabela.`)
  const row = rows.find((item) => item.key === rowKey)
  if (row === undefined) throw new Error(`"${tableKey}" não tem a linha "${rowKey}".`)
  return row
}

function setCells(
  values: SheetValues,
  tableKey: string,
  rowKey: string,
  cells: Record<string, string | number | boolean>
): void {
  const id = component(tableKey).id
  const rows = values[id]
  if (!isTableValue(rows)) throw new Error(`"${tableKey}" não é tabela.`)
  values[id] = rows.map((row) =>
    row.key === rowKey ? { ...row, cells: { ...row.cells, ...cells } } : row
  )
}

function set(values: SheetValues, key: string, value: string | number | boolean): void {
  const target = component(key)
  if (target.type === 'select' && typeof value === 'string') {
    const option = target.options.find((item) => item.label === value)
    if (option === undefined) throw new Error(`"${key}" não tem a opção "${value}".`)
    values[target.id] = option.id
    return
  }
  values[target.id] = value
}

function setLevels(values: SheetValues, ...levels: number[]): void {
  levels.forEach((level, index) => setCells(values, 'classes', `c${index + 1}`, { nivel: level }))
}

function isVisible(item: SheetComponent, context: FormulaContext): boolean {
  if (item.visibleWhen === undefined) return true
  const result = evaluateFormula(item.visibleWhen, context)
  if (!result.ok) throw new Error(`${item.key} → visibilidade: ${result.error.message}`)
  return toBoolean(result.value)
}

const ATTRIBUTE_KEYS = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma']

const SKILL_ROWS = [
  'acrobacia',
  'arcanismo',
  'atletismo',
  'atuacao',
  'enganacao',
  'furtividade',
  'historia',
  'intimidacao',
  'intuicao',
  'investigacao',
  'lidar_com_animais',
  'medicina',
  'natureza',
  'percepcao',
  'persuasao',
  'prestidigitacao',
  'religiao',
  'sobrevivencia',
  'tecnologia'
]

describe('a ficha entra no app', () => {
  it('passa pela importação da biblioteca', () => {
    const text = JSON.stringify(createGeraltTemplateFile())
    expect(text.length).toBeLessThan(MAX_IMPORT_BYTES)

    const parsed = parseTemplateFile(text)
    expect(parsed.ok ? null : parsed.message).toBeNull()
  })

  it('o Validar do construtor não acusa nada', () => {
    const report = validateSchema(schema)
    expect(report.issues.map((issue) => issue.message)).toEqual([])
  })

  it('tem as 12 abas da planilha, na mesma ordem', () => {
    expect(schema.tabs.map((tab) => tab.label)).toEqual([
      'Personagem',
      'Classe',
      'Combate',
      'Magias',
      'Heranças e Aprim.',
      'Pertences',
      'Ofícios',
      'Runas',
      'Familiar',
      'Companheiro Animal',
      'Mecha (Tec.)',
      'Servo (Tec.)'
    ])
  })

  it('liga os papéis da mesa: token, dano e combate', () => {
    const roles = Object.fromEntries(
      allComponents(schema)
        .filter((item) => item.role !== undefined)
        .map((item) => [item.role, item.key])
    )
    expect(roles).toEqual({
      name: 'nome',
      portrait: 'retrato',
      hp: 'vida',
      bar2: 'mana',
      bar3: 'ki',
      initiative: 'iniciativa',
      defense: 'ca_total'
    })
  })

  it('nenhum componente sai da grade nem pisa em outro da mesma aba', () => {
    for (const tab of schema.tabs) {
      const taken = new Map<string, string>()
      for (const item of tab.components) {
        expect(item.layout.x + item.layout.w, `${tab.label}: ${item.key}`).toBeLessThanOrEqual(12)
        for (let x = item.layout.x; x < item.layout.x + item.layout.w; x += 1) {
          for (let y = item.layout.y; y < item.layout.y + item.layout.h; y += 1) {
            const other = taken.get(`${x},${y}`)
            expect(other, `${tab.label}: ${item.key} em cima de ${other} (${x},${y})`).toBe(
              undefined
            )
            taken.set(`${x},${y}`, item.key)
          }
        }
      }
    }
  })
})

describe('como foi baixada: a ficha nova dá os números guardados na planilha', () => {
  const values = fresh()

  it('calcula tudo sem #ERRO', () => {
    expect([...computeSheet(schema, values).errors.keys()]).toEqual([])
  })

  it.each([
    // PERSONAGEM
    ['nivel_total', 0], // C7
    ['proficiencia', 1], // AM7
    ['forca.mod', -1], // R14
    ['destreza.mod', -1], // V14
    ['constituicao.mod', -1], // Z14
    ['inteligencia.mod', -1], // R20
    ['sabedoria.mod', -1], // V20
    ['carisma.mod', -1], // Z20
    ['pv_total', 2], // P26
    ['passiva_intuicao', 9], // R32
    ['passiva_investigacao', 9], // V32
    ['passiva_percepcao', 9], // Z32
    ['classes.c1.maximo', '/ 0'], // V8
    ['classes.c2.maximo', '/ 0'], // V9
    ['classes.c3.maximo', '/ 0'], // V10
    ['classes.c1.atual', 1], // T8
    // COMBATE
    ['vida', 2], // AF8
    ['vida.max', 2], // AJ8
    ['dano_normal', 0], // T8
    ['ca_total', 9], // AD18
    ['ca_base', 10], // T19
    ['combate_nivel', 0], // T13
    ['combate_proficiencia', 1], // Z13
    ['recurso1_nome', '???'], // AM22
    ['recurso2_nome', '???'], // AM28
    // MAGIAS
    ['magia_cd', 8], // U35
    ['magia_acerto', 0], // U42
    ['custo_truques', 0], // C31
    ['custo_c1', 2], // AO31
    ['custo_c2', 3], // C43
    ['custo_c3', 5], // AO43
    ['custo_c4', 6], // C55
    ['custo_c5', 7], // AO55
    ['custo_c6', 9], // C67
    ['custo_c7', 12], // AO67
    ['custo_c8', 16], // C79
    ['custo_c9', 21], // AO79
    // PERTENCES
    ['riqueza_total', 0], // S7
    // OFÍCIOS
    ['preparo_total', -1], // L8
    ['producao_total', 0], // AE8
    // RUNAS
    ['pulso_base', 'D2'], // AK9
    ['pulso_dado', '0D6'], // AO9
    ['runa_cd', 10], // AL14
    ['runa_acerto', 2], // AL21
    // FAMILIAR
    ['fam_for', 8], // R12
    ['fam_dex', 16], // V12
    ['fam_con', 11], // Z12
    ['fam_int', 3], // R18
    ['fam_sab', 14], // V18
    ['fam_car', 7], // Z18
    ['fam_for_mod', -1], // R10
    ['fam_dex_mod', 3], // V10
    ['fam_con_mod', 0], // Z10
    ['fam_int_mod', -4], // R16
    ['fam_sab_mod', 2], // V16
    ['fam_car_mod', -2], // Z16
    ['fam_nd', 0], // L23
    ['fam_ca', 13], // AG22
    ['fam_vida.max', 9], // V23
    ['fam_tier', 1], // AF28
    ['fam_cd', 11], // AA37
    ['fam_runa_usos_max', 0], // P39
    ['fam_runa_dano', '0D6'], // H44
    ['fam_elo_mental', '100ft'], // AJ41
    ['fam_pericias.furtividade.total', 4], // AJ8
    ['fam_pericias.percepcao.total', 3], // AJ9
    ['fam_ataques.ataque.acerto', 3], // Z43
    ['fam_ataques.ataque.dano', '1d4 +3'], // AB43
    ['fam_salvaguardas.forca.total', -1], // AR24
    ['fam_salvaguardas.destreza.total', 3], // AR25
    ['fam_salvaguardas.constituicao.total', 0], // AR26
    ['fam_salvaguardas.inteligencia.total', -4], // AR27
    ['fam_salvaguardas.sabedoria.total', 2], // AR28
    ['fam_salvaguardas.carisma.total', -2], // AR29
    // COMPANHEIRO ANIMAL
    ['comp_for.mod', 0], // R10
    ['comp_car.mod', 0], // Z16
    ['comp_ca', 10], // AI24
    ['comp_salvaguardas.forca.total', 0], // AR26
    ['comp_salvaguardas.carisma.total', 0], // AR31
    // MECHA
    ['mecha_for.mod', 0], // R10
    ['mecha_con.mod', 0], // AQ5
    ['mecha_des', 6], // R18
    ['mecha_des_mod', -2], // R16
    ['mecha_energia_max', 10], // AE22
    ['mecha_vida_atual', 0], // S42
    // SERVO
    ['servo_for.mod', 0], // R10
    ['servo_dex.mod', 0], // V10
    ['servo_con.mod', 0], // Z10
    ['servo_int', '-'], // R18
    ['servo_sab', '-'], // V18
    ['servo_car', '-'], // Z18
    ['servo_int_mod', '-'], // R16
    ['servo_sab_mod', '-'], // V16
    ['servo_car_mod', '-'], // Z16
    ['servo_nivel', 1], // L23
    ['servo_pericias.p1.total', '-'], // AL8
    ['servo_pericias.p2.total', '-'], // AL9
    ['servo_pericias.p3.total', '-'], // AL10
    ['servo_salvaguardas.forca.total', 0], // AR24
    ['servo_salvaguardas.destreza.total', 0], // AR25
    ['servo_salvaguardas.constituicao.total', 0], // AR26
    ['servo_salvaguardas.inteligencia.total', '-'], // AR27
    ['servo_salvaguardas.sabedoria.total', '-'], // AR28
    ['servo_salvaguardas.carisma.total', '-'], // AR29
    ['servo_resistencias', ''], // X39
    [
      'servo_imunidades',
      'Dano necrótico, psíquico e venenoso, condições Enfeitiçado e Amedrontado.'
    ] // X40
  ])('%s = %s', (path, expected) => {
    expect(read(values, path)).toBe(expected)
  })

  it('todas as perícias e salvaguardas dão −1, com o atributo certo em cada uma', () => {
    for (const skill of SKILL_ROWS) {
      expect(read(values, `pericias.${skill}.total`), skill).toBe(-1) // AP14 a AP32
      expect(read(values, `combate_${skill}`), skill).toBe(-1) // COMBATE!G24 a M32
    }
    for (const attribute of ATTRIBUTE_KEYS) {
      expect(read(values, `salvaguardas.${attribute}.total`), attribute).toBe(-1) // AA25 a AA30
    }
  })

  it('as listas começam na opção que a planilha tinha', () => {
    expect(read(values, 'vida_atributo')).toBe('CON') // AA9
    expect(read(values, 'ca_atributo')).toBe('DEX') // V19
    expect(read(values, 'magia_atributo')).toBe('INT') // V32
    expect(read(values, 'preparo_atributo')).toBe('INT') // F9
    expect(read(values, 'mecha_tipo')).toBe('Completo') // K23
    expect(read(values, 'mecha_tamanho')).toBe('Pequeno') // W20
    expect(read(values, 'classes.c1.dado')).toBe(6) // O8
    expect(read(values, 'comp_pericias.p1.atributo')).toBe('FOR') // AJ8
  })

  it('traz o que estava escrito na ficha do Geralt', () => {
    expect(read(values, 'nome')).toBe('Geralt Wolf Vengerberg')
    expect(read(values, 'classes.c1.nome')).toBe('Combatente') // H8
    expect(read(values, 'classes.c2.nome')).toBe('Classe 2') // H9
    expect(values[component('notas_combate').id]).toContain('Empurrar - A propriedade de maestria')
    expect(read(values, 'fam_runa_nome')).toBe('ATAQUE ELEMENTAL') // C35
    expect(values[component('fam_runa_efeito').id]).toContain('Sinergia [Rubi]')

    const weapons = values[component('armas').id]
    expect(isTableValue(weapons) ? weapons.map((row) => row.cells) : []).toEqual([
      {
        arma: 'Lança Longa',
        acerto: 0,
        margem: 20,
        mult: '2x',
        dano: '1d12',
        tipo: 'p/ 1d8 r',
        propriedades: 'Duas mãos, extensão 2, híbrida (1d6 cortante), pesada'
      },
      {
        arma: 'Machadinha',
        acerto: 0,
        margem: 20,
        mult: '2x',
        dano: '1d6',
        tipo: 'r',
        propriedades: 'Leve, arremesso (20/60 pés)'
      }
    ])

    const crafts = values[component('oficios_menores').id]
    expect(isTableValue(crafts) ? crafts[0]?.cells : null).toEqual({
      nome: 'Guia',
      nivel: 0,
      doutrinas: 'Piloto'
    })
  })

  it('as armas e o ofício do Geralt são do jogador: dá para remover', () => {
    const weapons = values[component('armas').id]
    expect(isTableValue(weapons) ? weapons.map((row) => row.key) : []).toEqual([
      undefined,
      undefined
    ])
    expect(rowOf(values, 'classes', 'c1').key).toBe('c1')
  })
})

describe('como a planilha calcula: as fórmulas originais, em vários valores', () => {
  /** `ROUNDUP(MIN(LvlTotal,20)/4,0)+1` */
  const proficiency = (level: number): number => Math.ceil(Math.min(level, 20) / 4) + 1
  /** `FLOOR((v-10)/2,1)` */
  const modifier = (value: number): number => Math.floor((value - 10) / 2)

  it('proficiência (PERSONAGEM!AM7), do nível 0 ao 25', () => {
    for (let level = 0; level <= 25; level += 1) {
      const values = fresh()
      setLevels(values, level)
      expect(read(values, 'proficiencia'), `nível ${level}`).toBe(proficiency(level))
    }
  })

  it('nível total soma as três classes (PERSONAGEM!C7)', () => {
    const values = fresh()
    setLevels(values, 3, 2, 1)
    expect(read(values, 'nivel_total')).toBe(6)
    expect(read(values, 'combate_nivel')).toBe(6)
  })

  it('modificador de atributo (PERSONAGEM!R14), do 1 ao 30', () => {
    for (let value = 1; value <= 30; value += 1) {
      const values = fresh()
      set(values, 'forca', value)
      expect(read(values, 'forca.mod'), `FOR ${value}`).toBe(modifier(value))
    }
  })

  it('perícia (PERSONAGEM!AP14), com proficiência, especialização e bônus', () => {
    /** `VLOOKUP(...)+AO14+((Prof.*(AN14+MIN(1,AM14)))+MAX((AM14-1),0))*AN14` */
    const skill = (
      mod: number,
      etc: number,
      prof: number,
      marked: boolean,
      exp: number
    ): number => {
      const on = marked ? 1 : 0
      return mod + etc + (prof * (on + Math.min(1, exp)) + Math.max(exp - 1, 0)) * on
    }

    for (const level of [0, 1, 5, 9, 13, 17]) {
      for (const marked of [false, true]) {
        for (const exp of [0, 1, 2, 3]) {
          for (const etc of [-2, 0, 3]) {
            const values = fresh()
            setLevels(values, level)
            set(values, 'destreza', 14)
            setCells(values, 'pericias', 'acrobacia', { prof: marked, exp, etc })
            const where = `nível ${level}, prof ${marked}, exp ${exp}, etc ${etc}`
            expect(read(values, 'pericias.acrobacia.total'), where).toBe(
              skill(2, etc, proficiency(level), marked, exp)
            )
          }
        }
      }
    }
  })

  it('trocar o atributo da perícia troca o modificador (a lista AJ14)', () => {
    const values = fresh()
    set(values, 'carisma', 18)
    setCells(values, 'pericias', 'acrobacia', { atributo: 'o_car' })
    expect(read(values, 'pericias.acrobacia.total')).toBe(4)
  })

  it('salvaguarda (COMBATE!AA25): a mesma regra, sem o Etc', () => {
    const values = fresh()
    setLevels(values, 5)
    set(values, 'constituicao', 16)
    setCells(values, 'salvaguardas', 'constituicao', { prof: true, exp: 2 })
    // +3 de CON + (3 × (1 + 1) + 1) de proficiência.
    expect(read(values, 'salvaguardas.constituicao.total')).toBe(3 + 7)
    // As outras linhas não mudam: cada uma olha o próprio atributo.
    expect(read(values, 'salvaguardas.forca.total')).toBe(-1)
  })

  it('perícias passivas somam 10 à perícia certa (PERSONAGEM!R32, V32, Z32)', () => {
    const values = fresh()
    set(values, 'sabedoria', 16)
    set(values, 'inteligencia', 14)
    expect(read(values, 'passiva_intuicao')).toBe(13)
    expect(read(values, 'passiva_investigacao')).toBe(12)
    expect(read(values, 'passiva_percepcao')).toBe(13)
  })

  describe('vida total (PERSONAGEM!P26)', () => {
    /** A fórmula original, com o REGEXEXTRACT trocado pelo número do dado. */
    function life(input: {
      dice: [number, number, number]
      levels: [number, number, number]
      mod: number
      half: boolean
      perLevel: number
      fixed: number
    }): number {
      const { dice, levels, mod, half, perLevel, fixed } = input
      const total = levels[0] + levels[1] + levels[2]
      return (
        dice[0] +
        (dice[0] / 2 + 1) * (levels[0] - 1) +
        (dice[1] / 2 + 1) * levels[1] +
        (dice[2] / 2 + 1) * levels[2] +
        Math.trunc(mod / (half ? 2 : 1)) * total +
        fixed +
        perLevel * total
      )
    }

    it.each([
      { dice: [6, 6, 6], levels: [0, 0, 0], con: 8, half: false, perLevel: 0, fixed: 0 },
      { dice: [10, 6, 6], levels: [1, 0, 0], con: 14, half: false, perLevel: 0, fixed: 0 },
      { dice: [10, 8, 6], levels: [5, 3, 0], con: 16, half: false, perLevel: 1, fixed: 2 },
      { dice: [12, 10, 8], levels: [4, 3, 2], con: 18, half: true, perLevel: 0, fixed: 0 },
      // O ROUNDDOWN corta para o zero: −3 / 2 vira −1, e não −2.
      { dice: [8, 8, 8], levels: [3, 0, 0], con: 5, half: true, perLevel: 0, fixed: 0 },
      { dice: [6, 6, 6], levels: [6, 0, 0], con: 3, half: false, perLevel: -1, fixed: 5 }
    ] as const)('$dice nos níveis $levels, CON $con, metade $half', (input) => {
      const values = fresh()
      set(values, 'constituicao', input.con)
      set(values, 'vida_metade', input.half)
      set(values, 'pv_por_nivel', input.perLevel)
      set(values, 'pv_fixo', input.fixed)
      input.dice.forEach((die, index) => {
        setCells(values, 'classes', `c${index + 1}`, {
          dado: `o_d${die}`,
          nivel: input.levels[index] ?? 0
        })
      })

      expect(read(values, 'pv_total')).toBe(
        life({
          dice: [...input.dice],
          levels: [...input.levels],
          mod: modifier(input.con),
          half: input.half,
          perLevel: input.perLevel,
          fixed: input.fixed
        })
      )
    })

    it('o atributo da vida pode ser outro (a lista AA9)', () => {
      const values = fresh()
      setLevels(values, 2)
      set(values, 'vida_atributo', 'SAB')
      set(values, 'sabedoria', 20)
      // 6 + 4 × 1 + 5 × 2
      expect(read(values, 'pv_total')).toBe(20)
    })
  })

  describe('vida no combate (COMBATE!AF8 e AJ8)', () => {
    function setup(): SheetValues {
      const values = fresh()
      setLevels(values, 5)
      set(values, 'constituicao', 14)
      values[component('vida').id] = { current: 20 }
      return values
    }

    /** Edita um campo como a ficha faz: grava ele e as barras que acompanham o máximo. */
    function edit(values: SheetValues, key: string, value: SheetValue): void {
      const id = component(key).id
      const bars = followingBarChanges(schema, values, id, value, 'player')
      values[id] = value
      for (const bar of bars) values[bar.id] = bar.value
    }

    /** Muda a classe pela tabela, que é por onde a ficha muda o nível e o dado. */
    function editClass(values: SheetValues, cells: Record<string, string | number>): void {
      const rows = values[component('classes').id]
      if (!isTableValue(rows)) throw new Error('não é tabela')
      edit(
        values,
        'classes',
        rows.map((row) => (row.key === 'c1' ? { ...row, cells: { ...row.cells, ...cells } } : row))
      )
    }

    it('a ficha nasce no nível 0, e preencher a classe e a CON deixa a vida cheia', () => {
      const values = fresh()
      expect(read(values, 'vida')).toBe(2)
      expect(read(values, 'vida.max')).toBe(2)

      editClass(values, { nivel: 5, dado: 'o_d10' })
      edit(values, 'constituicao', 14)

      // 10 + 6 × 4 + 2 × 5. Na planilha, AF8 = AJ8 − T8, e o dano continua 0.
      expect(read(values, 'vida.max')).toBe(44)
      expect(read(values, 'vida')).toBe(44)
      expect(read(values, 'dano_normal')).toBe(0)
    })

    it('subir de nível ferido sobe a vida atual o mesmo tanto, e o dano fica igual', () => {
      const values = fresh()
      editClass(values, { nivel: 5, dado: 'o_d10' })
      edit(values, 'constituicao', 14)
      values[component('vida').id] = { current: 30 }
      expect(read(values, 'dano_normal')).toBe(14)

      editClass(values, { nivel: 6 })

      expect(read(values, 'vida.max')).toBe(52)
      expect(read(values, 'vida')).toBe(38)
      expect(read(values, 'dano_normal')).toBe(14)
    })

    it('trocar o nível digitando, passando pelo 1, não cura ninguém', () => {
      const values = fresh()
      editClass(values, { nivel: 12, dado: 'o_d10' })
      edit(values, 'constituicao', 14)
      const max = read(values, 'vida.max') as number
      values[component('vida').id] = { current: 10 }
      const damage = max - 10

      editClass(values, { nivel: 1 })
      editClass(values, { nivel: 13 })

      expect(read(values, 'dano_normal')).toBe(damage)
    })

    it('dano na vida máxima tira do máximo e também do atual, como manda o comentário de X8', () => {
      const values = setup()
      // 6 + 4 × 4 + 2 × 5 = 32 de vida total; a barra foi posta em 20 (12 de dano normal).
      expect(read(values, 'pv_total')).toBe(32)
      expect(read(values, 'dano_normal')).toBe(12)

      edit(values, 'dano_vida_maxima', 5)

      // Na planilha: AJ8 = 32 − 5 e AF8 = 27 − 12.
      expect(read(values, 'vida.max')).toBe(27)
      expect(read(values, 'vida')).toBe(15)
      expect(read(values, 'dano_normal')).toBe(12)

      edit(values, 'dano_vida_maxima', 0)
      expect(read(values, 'vida.max')).toBe(32)
      expect(read(values, 'vida')).toBe(20)
    })

    it('qualquer sequência de edições dá o que a planilha daria: AF8 = P26 − X8 − T8', () => {
      const values = fresh()
      editClass(values, { nivel: 3 })
      values[component('vida').id] = { current: (read(values, 'vida.max') as number) - 7 }
      const typedDamage = 7 // T8: a planilha guarda este número, e ele nunca muda aqui.

      const edits: (() => void)[] = [
        () => edit(values, 'constituicao', 16),
        () => editClass(values, { nivel: 8 }),
        () => edit(values, 'pv_fixo', 4),
        () => edit(values, 'pv_por_nivel', 2),
        () => edit(values, 'dano_vida_maxima', 6),
        () => edit(values, 'vida_metade', true),
        () => editClass(values, { dado: 'o_d12' }),
        () =>
          edit(
            values,
            'vida_atributo',
            component('vida_atributo').type === 'select' ? 'o_sab' : ''
          ),
        () => edit(values, 'sabedoria', 18),
        () => edit(values, 'dano_vida_maxima', 2),
        () => editClass(values, { nivel: 2 })
      ]

      for (const [index, run] of edits.entries()) {
        run()
        const lifeTotal = read(values, 'pv_total') as number
        const onMaximum = read(values, 'dano_vida_maxima') as number
        expect(read(values, 'vida'), `depois da edição ${index}`).toBe(
          lifeTotal - onMaximum - typedDamage
        )
      }
    })

    it('só a vida acompanha o máximo: nas outras barras, a planilha digita o atual', () => {
      const values = fresh()
      expect(followingBarChanges(schema, values, component('ki_max').id, 5, 'player')).toEqual([])
      expect(followingBarChanges(schema, values, component('mana_max').id, 5, 'player')).toEqual([])
      expect(followingBarChanges(schema, values, component('fam_nivel').id, 5, 'player')).toEqual(
        []
      )
      expect(
        followingBarChanges(schema, values, component('comp_vida_max').id, 5, 'player')
      ).toEqual([])
    })

    it('a vida do familiar soma metade da vida máxima, já com o dano (FAMILIAR!V23)', () => {
      const values = setup()
      set(values, 'fam_nivel', 2)
      set(values, 'dano_vida_maxima', 5)
      // 9 + CON 0 × 2 + piso(27 / 2)
      expect(read(values, 'fam_vida.max')).toBe(9 + 13)
    })
  })

  describe('classe de armadura (COMBATE!AD18)', () => {
    /** `MIN(IF(ISNUMBER(AA21),AA21,9999),VLOOKUP(V19,...))+Y19+AA19+T19` */
    const armor = (mod: number, limit: number | null, equip: number, others: number): number =>
      Math.min(limit ?? 9999, mod) + equip + others + 10

    it.each([
      { dex: 18, limit: '', equip: 0, others: 0, expected: armor(4, null, 0, 0) },
      { dex: 18, limit: '2', equip: 3, others: 1, expected: armor(4, 2, 3, 1) },
      { dex: 18, limit: '0', equip: 6, others: 0, expected: armor(4, 0, 6, 0) },
      { dex: 8, limit: '2', equip: 0, others: 0, expected: armor(-1, 2, 0, 0) },
      // "Qualquer coisa que não seja um numero" remove o limite (comentário de AA21).
      { dex: 18, limit: 'sem limite', equip: 0, others: 0, expected: armor(4, null, 0, 0) }
    ])('DEX $dex, limite "$limit"', ({ dex, limit, equip, others, expected }) => {
      const values = fresh()
      set(values, 'destreza', dex)
      set(values, 'ca_limite', limit)
      set(values, 'ca_equip', equip)
      set(values, 'ca_outros', others)
      expect(read(values, 'ca_total')).toBe(expected)
    })

    it('o atributo da armadura pode ser outro (a lista V19)', () => {
      const values = fresh()
      set(values, 'ca_atributo', 'SAB')
      set(values, 'sabedoria', 16)
      expect(read(values, 'ca_total')).toBe(13)
    })
  })

  it('magias (MAGIAS!U35 e U42), com a proficiência e o atributo escolhido', () => {
    const values = fresh()
    setLevels(values, 9)
    set(values, 'magia_atributo', 'CAR')
    set(values, 'carisma', 16)
    expect(read(values, 'magia_cd')).toBe(3 + 8 + 4)
    expect(read(values, 'magia_acerto')).toBe(3 + 4)
  })

  it('riqueza (PERTENCES!S7): cada moeda vale o que a fórmula diz, e as joias não entram', () => {
    const values = fresh()
    set(values, 'moeda_platina', 2)
    set(values, 'moeda_ouro', 7)
    set(values, 'moeda_prata', 5)
    set(values, 'moeda_cobre', 30)
    set(values, 'moeda_electro', 3)
    values[component('joias').id] = [{ id: 'j1', cells: { nome: 'Rubi', valor: 500 } }]
    expect(read(values, 'riqueza_total')).toBeCloseTo(7 + 20 + 0.5 + 0.3 + 1.5)
  })

  it('ofícios: preparo (L8), produção (AE8) e PO/dia (AB13)', () => {
    const values = fresh()
    setLevels(values, 9)
    set(values, 'preparo_nivel', 2)
    set(values, 'preparo_espec', 1)
    set(values, 'preparo_atributo', 'SAB')
    set(values, 'sabedoria', 14)
    // ROUNDDOWN(4 / 2) + 2 + 1 + 2
    expect(read(values, 'preparo_total')).toBe(7)

    set(values, 'producao_natural', 1)
    set(values, 'producao_ajudantes', 2)
    set(values, 'producao_instrucao', 3)
    set(values, 'producao_outros', 4)
    expect(read(values, 'producao_total')).toBe(10)
    set(values, 'producao_esquema', true)
    expect(read(values, 'producao_total')).toBe(11)

    values[component('oficios_maiores').id] = [
      { id: 'o1', cells: { nome: 'Forja', nivel: 0 } },
      { id: 'o2', cells: { nome: 'Alquimia', nivel: 1 } },
      { id: 'o3', cells: { nome: 'Joalheria', nivel: 4 } }
    ]
    const { context } = createSheetContext(schema, values)
    const income = context.resolveList(['oficios_maiores', 'po_dia'])
    expect(income).toEqual([0, 5, 8])
  })

  it('runas: dados de pulso (AK9, AO9), CD (AL14) e acerto (AL21), em todos os níveis', () => {
    for (let level = 0; level <= 20; level += 1) {
      const prof = proficiency(level)
      const values = fresh()
      setLevels(values, level)

      expect(read(values, 'pulso_base'), `nível ${level}`).toBe(`D${prof * 2}`)
      expect(read(values, 'pulso_dado'), `nível ${level}`).toBe(
        `${Math.floor(prof / 2)}D${prof % 2 === 0 ? 4 : 6}`
      )
      const half = Math.max(1, Math.floor(level / 2))
      expect(read(values, 'runa_cd'), `nível ${level}`).toBe(8 + prof + half)
      expect(read(values, 'runa_acerto'), `nível ${level}`).toBe(prof + half)
    }
  })

  describe('familiar, do nível de conjuração 0 ao 9', () => {
    const IF = (condition: boolean, value: number): number => (condition ? value : 0)
    /** A coluna INT. da tabela de aprimoramentos. */
    const INT_COLUMN = [7, 8, 9, 10, 11, 12, 13, 14, 15]
    const ND_COLUMN = ['0', '1/4', '1/2', '1', '2', '3', '4', '5', '6']

    it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])('nível %i', (level) => {
      const values = fresh()
      setLevels(values, 8)
      set(values, 'constituicao', 14)
      set(values, 'fam_nivel', level)

      const prof = proficiency(8)
      const physical = IF(level > 3, 2) + IF(level > 5, 2) + IF(level > 8, 2)
      const strength = 8 + physical // R12
      const dexterity = 16 + physical // V12
      const constitution = 11 + physical // Z12
      const charisma = 7 + IF(level > 4, 2) + IF(level > 6, 2) + IF(level > 8, 2) // Z18
      const intelligence = level > 0 ? (INT_COLUMN[level - 1] as number) : 3 // R18

      expect(read(values, 'fam_for')).toBe(strength)
      expect(read(values, 'fam_dex')).toBe(dexterity)
      expect(read(values, 'fam_con')).toBe(constitution)
      expect(read(values, 'fam_int')).toBe(intelligence)
      expect(read(values, 'fam_sab')).toBe(14)
      expect(read(values, 'fam_car')).toBe(charisma)

      const nd = level > 0 ? ND_COLUMN[level - 1] : 0 // L23
      expect(read(values, 'fam_nd')).toBe(nd)
      expect(read(values, 'fam_ca')).toBe(10 + modifier(dexterity) + Math.ceil(level / 2)) // AG22
      expect(read(values, 'fam_tier')).toBe(1 + IF(level > 3, 1) + IF(level > 7, 1)) // AF28
      expect(read(values, 'fam_elo_mental')).toBe(`${100 + 10 * level}ft`) // AJ41

      // V23: 9 + CON × nível + ROUNDDOWN(vida máxima / 2). Nível 8 com CON 14: vida 6+4×7+2×8.
      const casterLife = 6 + 4 * 7 + 2 * 8
      expect(read(values, 'fam_vida.max')).toBe(
        9 + modifier(constitution) * level + (level > 0 ? Math.floor(casterLife / 2) : 0)
      )

      // P39: só do nível 4 em diante, e +1 quando o ND passa de 4 (nível 8 e 9).
      expect(read(values, 'fam_runa_usos_max')).toBe(
        level > 3 ? Math.floor(prof / 2) + IF(level >= 8, 1) : 0
      )
      // H44: `...&"D"&IF(ISEVEN(Prof.),4,6)+IF(AO5>4,2)`: o + vem antes do & na precedência.
      expect(read(values, 'fam_runa_dano')).toBe(
        `${Math.floor(prof / 2)}D${(prof % 2 === 0 ? 4 : 6) + IF(level > 4, 2)}`
      )

      const best = Math.max(modifier(strength), modifier(dexterity))
      expect(read(values, 'fam_ataques.ataque.acerto')).toBe(IF(level > 0, prof) + best) // Z43
      expect(read(values, 'fam_ataques.ataque.dano')).toBe(`1d4 +${best}`) // AB43
    })

    it('o aumento soma por cima do que o nível dá, sem apagar a fórmula', () => {
      const values = fresh()
      set(values, 'fam_nivel', 4)
      set(values, 'fam_for_aumento', 3)
      set(values, 'fam_sab_aumento', 2)
      expect(read(values, 'fam_for')).toBe(8 + 2 + 3)
      expect(read(values, 'fam_for_mod')).toBe(1)
      expect(read(values, 'fam_sab')).toBe(16)
    })

    it('salvaguarda (AR24) e perícias (AJ8, AJ9) somam a proficiência do conjurador', () => {
      const values = fresh()
      setLevels(values, 5)
      setCells(values, 'fam_salvaguardas', 'destreza', { prof: true })
      expect(read(values, 'fam_salvaguardas.destreza.total')).toBe(3 + 3)
      expect(read(values, 'fam_salvaguardas.forca.total')).toBe(-1)
      expect(read(values, 'fam_pericias.furtividade.total')).toBe(3 + 3)
      expect(read(values, 'fam_pericias.percepcao.total')).toBe(2 + 3)
    })

    it('CD usa o modificador do invocador (AA37)', () => {
      const values = fresh()
      setLevels(values, 5)
      set(values, 'fam_mod_conjuracao', 4)
      expect(read(values, 'fam_cd')).toBe(10 + 3 + 4)
    })

    it('o dado de dano é editável, porque depende do familiar (comentário de AB43)', () => {
      const values = fresh()
      setCells(values, 'fam_ataques', 'ataque', { dado: '1d6' })
      expect(read(values, 'fam_ataques.ataque.dano')).toBe('1d6 +3')
    })

    it('dano com modificador negativo não fica "+-1", que a planilha mostraria', () => {
      const values = fresh()
      // A DEX-base é 16: só um aumento negativo faz FOR e DEX ficarem as duas abaixo de 10.
      set(values, 'fam_dex_aumento', -10)
      expect(read(values, 'fam_ataques.ataque.dano')).toBe('1d4 -1')
    })
  })

  describe('companheiro animal', () => {
    it('perícia soma a proficiência ao atributo escolhido (AM8)', () => {
      const values = fresh()
      setLevels(values, 5)
      set(values, 'comp_car', 16)
      setCells(values, 'comp_pericias', 'p1', { atributo: 'o_car' })
      expect(read(values, 'comp_pericias.p1.total')).toBe(3 + 3)
      expect(read(values, 'comp_pericias.p2.total')).toBe(3 + 0)
    })

    it('a caixa Prof das salvaguardas funciona (na planilha ela aponta para a célula errada)', () => {
      const values = fresh()
      setLevels(values, 5)
      set(values, 'comp_dex', 14)
      setCells(values, 'comp_salvaguardas', 'destreza', { prof: true })
      expect(read(values, 'comp_salvaguardas.destreza.total')).toBe(2 + 3)
      expect(read(values, 'comp_salvaguardas.forca.total')).toBe(0)
    })
  })

  describe('mecha', () => {
    it('a Destreza vem do personagem, com −2 só no completo (R18)', () => {
      const values = fresh()
      set(values, 'destreza', 15)
      expect(read(values, 'mecha_des')).toBe(13)
      expect(read(values, 'mecha_des_mod')).toBe(1)
      set(values, 'mecha_tipo', 'Parcial')
      expect(read(values, 'mecha_des')).toBe(15)
    })

    it('vida atual é o máximo menos o dano (S42)', () => {
      const values = fresh()
      set(values, 'mecha_vida_max', 40)
      set(values, 'mecha_dano', 12)
      expect(read(values, 'mecha_vida_atual')).toBe(28)
    })

    it('avisa quando a energia usada passa da máxima (a validação de Z38)', () => {
      const warning = component('mecha_energia_aviso')
      const values = fresh()
      const visibleWith = (): boolean =>
        isVisible(warning, createSheetContext(schema, values).context)

      set(values, 'mecha_energia_usada', 10)
      expect(visibleWith()).toBe(false)
      set(values, 'mecha_energia_usada', 11)
      expect(visibleWith()).toBe(true)
    })
  })

  describe('servo, do neuron 0 ao 6', () => {
    const NEURONS = [0, 1, 2, 3, 4, 5, 6]

    it.each(NEURONS)('neuron %i', (neuron) => {
      const values = fresh()
      set(values, 'servo_neuron', neuron)
      set(values, 'servo_nivel', 3)
      set(values, 'servo_for', 14)

      // R18: `IF(AO5=0,"-",6+AO5)`, e R16 cai no "-" pelo IFERROR.
      const mind = neuron === 0 ? '-' : 6 + neuron
      const mindMod = neuron === 0 ? '-' : Math.floor((6 + neuron - 10) / 2)
      for (const key of ['int', 'sab', 'car']) {
        expect(read(values, `servo_${key}`)).toBe(mind)
        expect(read(values, `servo_${key}_mod`)).toBe(mindMod)
      }

      // AL8.
      const skill = neuron > 1 ? Math.ceil((neuron + 2) / 4 + (neuron === 6 ? 1 : 0)) + 3 : '-'
      expect(read(values, 'servo_pericias.p1.total')).toBe(skill)

      // AR24 a AR29.
      expect(read(values, 'servo_salvaguardas.forca.total')).toBe(2)
      const mindSave = mindMod === '-' ? '-' : mindMod + 3
      expect(read(values, 'servo_salvaguardas.inteligencia.total')).toBe(mindSave)
      expect(read(values, 'servo_salvaguardas.carisma.total')).toBe(mindSave)

      // X39 e X40.
      expect(read(values, 'servo_resistencias')).toBe(neuron < 4 ? '' : 'Psíquico')
      expect(read(values, 'servo_imunidades')).toBe(
        `Dano necrótico${neuron > 3 ? '' : ', psíquico'} e venenoso, condições Enfeitiçado e Amedrontado.`
      )
    })
  })
})

describe('botões de rolagem', () => {
  const engine = createSeededEngine(11)

  /** Roda todos os botões da ficha nos valores dados, inclusive os das linhas de tabela. */
  function rollEverything(values: SheetValues): { label: string; error: string | null }[] {
    const result = computeSheet(schema, values)
    const rolled: { label: string; error: string | null }[] = []

    for (const item of allComponents(schema)) {
      if (!isVisible(item, result.context)) continue

      if (item.type === 'rollButton') {
        const outcome = rollFormula(item.formula, {
          context: result.context,
          critical: item.critical,
          engine
        })
        rolled.push({ label: item.key, error: outcome.ok ? null : outcome.error.message })
      }

      if (item.type !== 'table') continue
      const rows = values[item.id]
      if (!isTableValue(rows)) continue

      for (const row of rows) {
        const rowName = row.key ?? row.id
        const context = createRowFormulaContext(result.context, item, rowName)
        for (const column of item.columns) {
          if (column.kind !== 'rollButton') continue
          const outcome = rollFormula(column.formula ?? '', {
            context,
            ...(column.critical === undefined ? {} : { critical: column.critical }),
            engine
          })
          rolled.push({
            label: `${item.key}.${rowName}.${column.key}`,
            error: outcome.ok ? null : outcome.error.message
          })
        }
      }
    }

    return rolled
  }

  it.each([0, 1, 5, 9, 13, 17, 20])('todos rolam no nível %i, sem nenhum erro', (level) => {
    const values = fresh()
    setLevels(values, level)
    set(values, 'fam_nivel', Math.min(level, 9))
    set(values, 'servo_neuron', Math.min(level, 6))

    const rolled = rollEverything(values)
    expect(rolled.filter((item) => item.error !== null)).toEqual([])
    // Sanidade: 19 perícias, 6 + 6 + 6 + 6 salvaguardas, os atributos e os demais.
    expect(rolled.length).toBeGreaterThan(50)
  })

  function rollCell(
    values: SheetValues,
    tableKey: string,
    rowName: string,
    columnKey: string
  ): ReturnType<typeof rollFormula> {
    const table = component(tableKey)
    if (table.type !== 'table') throw new Error('não é tabela')
    const column = table.columns.find((item) => item.key === columnKey)
    const { context } = createSheetContext(schema, values)
    return rollFormula(column?.formula ?? '', {
      context: createRowFormulaContext(context, table, rowName),
      ...(column?.critical === undefined ? {} : { critical: column.critical }),
      criticalFailureOnOne: column?.criticalFailureOnOne ?? false,
      engine
    })
  }

  it('perícia rola 1d20 + o total', () => {
    const values = fresh()
    set(values, 'destreza', 16)
    const rolled = rollCell(values, 'pericias', 'acrobacia', 'rolar')
    expect(rolled.ok ? rolled.roll.notation : '').toBe('1d20 + 3')
  })

  it('dado de vida rola o dado da classe', () => {
    const values = fresh()
    setCells(values, 'classes', 'c1', { dado: 'o_d10' })
    const rolled = rollCell(values, 'classes', 'c1', 'rolar')
    expect(rolled.ok ? rolled.roll.notation : '').toBe('1d10')
  })

  it('a Lança Longa do Geralt ataca e fere', () => {
    const values = fresh()
    const rows = values[component('armas').id]
    const lance = isTableValue(rows) ? (rows[0]?.id ?? '') : ''

    const attack = rollCell(values, 'armas', lance, 'atacar')
    expect(attack.ok ? attack.roll.notation : '').toBe('1d20 + 0')

    const damage = rollCell(values, 'armas', lance, 'rolar_dano')
    expect(damage.ok ? damage.roll.notation : '').toBe('1d12')
  })

  it('a margem da arma decide o crítico, e arma nova sem margem usa 20', () => {
    const table = component('armas')
    if (table.type !== 'table') throw new Error('não é tabela')
    const attack = table.columns.find((column) => column.key === 'atacar')
    expect(attack?.critical).toEqual({ kind: 'margin', threshold: 'se(margem > 0, margem, 20)' })

    const weapon = (id: string, margem: number): TableRowValue => ({
      id,
      cells: { arma: id, acerto: 0, margem, mult: '', dano: '1d4', tipo: '', propriedades: '' }
    })
    const values = fresh()
    values[table.id] = [weapon('nova', 0), weapon('afiada', 19)]

    /** Rola até sair o valor pedido no d20 e diz se aquele valor foi crítico. */
    function outcomeOn(rowName: string, face: number): string {
      const context = createRowFormulaContext(
        createSheetContext(schema, values).context,
        table as Extract<SheetComponent, { type: 'table' }>,
        rowName
      )
      for (let seed = 0; seed < 2000; seed += 1) {
        const rolled = rollFormula(attack?.formula ?? '', {
          context,
          ...(attack?.critical === undefined ? {} : { critical: attack.critical }),
          engine: createSeededEngine(seed)
        })
        if (rolled.ok && rolled.roll.dice[0]?.value === face) return rolled.roll.outcome
      }
      throw new Error(`O d20 nunca deu ${face}.`)
    }

    expect(outcomeOn('nova', 19)).toBe('normal')
    expect(outcomeOn('nova', 20)).toBe('critical')
    expect(outcomeOn('afiada', 18)).toBe('normal')
    expect(outcomeOn('afiada', 19)).toBe('critical')
  })

  it('pulso sem dados (proficiência 1) rola 0, em vez de dar erro', () => {
    const values = fresh()
    const pulse = component('rolar_pulso')
    if (pulse.type !== 'rollButton') throw new Error('não é botão')
    const { context } = createSheetContext(schema, values)
    const rolled = rollFormula(pulse.formula, { context, engine })
    expect(rolled.ok ? rolled.roll.total : null).toBe(0)
  })

  it('pulso com dados rola a quantidade e os lados certos', () => {
    const values = fresh()
    setLevels(values, 13) // Proficiência 5: 2D6.
    const pulse = component('rolar_pulso')
    if (pulse.type !== 'rollButton') throw new Error('não é botão')
    const { context } = createSheetContext(schema, values)
    const rolled = rollFormula(pulse.formula, { context, engine })
    expect(rolled.ok ? rolled.roll.notation : '').toBe('2d6')
  })
})

describe('na mesa', () => {
  function publishedSheet(): { record: SheetRecord; values: SheetValues } {
    const template = createTemplate({ name: 'Geralt', kind: 'character', schema })
    const record = createSheetRecord({
      template,
      version: { version: 1, schema, publishedAt: '2026-11-05T00:00:00.000Z' },
      ownerName: 'Thalysson'
    })
    return { record, values: mergedValues(record) }
  }

  it('a ficha nasce de uma versão publicada, no formato que o banco guarda', () => {
    const { record } = publishedSheet()
    expect(parseSheetRecord(record)).not.toBeNull()
    expect(record.gmValues).toEqual({})
  })

  it('o resumo que vai para o token tem nome, vida, defesa e as barras extras', () => {
    const { record } = publishedSheet()
    expect(record.summary).toEqual({
      name: 'Geralt Wolf Vengerberg',
      defense: 9,
      bars: {
        hp: { current: 2, max: 2 },
        bar2: { current: 0, max: 0 },
        bar3: { current: 0, max: 0 }
      }
    })
    // Personagem sem mana nem ki: o token mostra só a vida, sem barras vazias.
    expect(visibleBars(record.summary.bars).map((item) => item.key)).toEqual(['hp'])
  })

  it('a iniciativa rola pelo papel, com a Destreza', () => {
    const { values } = publishedSheet()
    set(values, 'destreza', 16)
    const rolled = rollInitiative(schema, values, createSeededEngine(3))
    expect(rolled.ok ? rolled.notation : '').toBe('1d20 + 3')
  })

  it('dano e cura da mesa escrevem na barra, e o "dano normal" acompanha', () => {
    const { record } = publishedSheet()
    const vida = component('vida').id
    const curado = patchFields(record, schema, { values: { [vida]: { current: 1 } } })

    expect(curado.summary.bars.hp).toEqual({ current: 1, max: 2 })
    expect(read(mergedValues(curado), 'dano_normal')).toBe(1)
  })

  it('o que o jogador edita passa pela regra de quem pode gravar cada campo', () => {
    const editable = allComponents(schema).filter((item) => holdsValue(item))
    const patch = { values: Object.fromEntries(editable.map((item) => [item.id, ''])) }

    // Só as tabelas de referência são do mestre; o resto é do jogador, como na planilha.
    expect(rejectedPatchFields(schema, patch, 'player').sort()).toEqual(
      ['c_comp_tabela', 'c_fam_tabela', 'c_mecha_aquecimento_tabela'].sort()
    )
    expect(rejectedPatchFields(schema, patch, 'gm')).toEqual([])
  })

  it('nada é só do mestre: o jogador recebe a ficha inteira', () => {
    expect(allComponents(schema).filter((item) => item.visibleTo === 'gm')).toEqual([])
  })
})

describe('o modelo da mesa, em branco', () => {
  const blank = createBlankSchema()

  function blankComponent(key: string): SheetComponent {
    const found = findComponentByKey(blank, key)
    if (found === undefined) throw new Error(`Componente "${key}" não existe no modelo.`)
    return found
  }

  function readBlank(values: SheetValues, path: string): FormulaValue | undefined {
    const { context } = createSheetContext(blank, values)
    const { value, error } = readFormulaValue(context, path.split('.'))
    if (error !== undefined) throw new Error(`${path}: ${error.message}`)
    return value
  }

  it('entra na biblioteca sem nenhum aviso do Validar', () => {
    const parsed = parseTemplateFile(JSON.stringify(createBlankTemplateFile()))
    expect(parsed.ok ? null : parsed.message).toBeNull()
    expect(validateSchema(blank).issues.map((issue) => issue.message)).toEqual([])
  })

  it('não leva nada do personagem do Geralt', () => {
    const text = JSON.stringify(createBlankTemplateFile())
    for (const word of ['Geralt', 'Combatente', 'Lança', 'Machadinha', 'Empurrar', 'Piloto']) {
      expect(text, word).not.toContain(word)
    }
  })

  it('difere do modelo do Geralt só no que é do personagem', () => {
    // Parte do modelo do Geralt e apaga exatamente o que é dele: se sobrar qualquer outra
    // diferença, uma regra do sistema mudou num dos dois.
    const expected = createGeraltSchema()
    const edit = <T extends SheetComponent['type']>(
      key: string,
      type: T,
      change: (item: Extract<SheetComponent, { type: T }>) => void
    ): void => {
      const item = findComponentByKey(expected, key)
      if (item?.type !== type) throw new Error(`"${key}" não é ${type}.`)
      change(item as Extract<SheetComponent, { type: T }>)
    }

    edit('nome', 'text', (item) => {
      delete item.defaultValue
    })
    edit('notas_combate', 'textarea', (item) => {
      delete item.defaultValue
    })
    edit('armas', 'table', (item) => {
      item.rows = []
    })
    edit('oficios_menores', 'table', (item) => {
      item.rows = []
    })
    edit('classes', 'table', (item) => {
      const first = item.rows[0]
      if (first?.cells === undefined) throw new Error('A primeira classe sumiu.')
      first.cells['nome'] = 'Classe 1'
    })

    expect(blank).toEqual(expected)
  })

  it('a ficha nova nasce sem nome e com as listas do personagem vazias', () => {
    const values = createInitialValues(blank)

    expect(readBlank(values, 'nome')).toBe('')
    expect(readBlank(values, 'classes.c1.nome')).toBe('Classe 1')
    expect(readBlank(values, 'classes.c2.nome')).toBe('Classe 2')
    expect(readBlank(values, 'classes.c3.nome')).toBe('Classe 3')
    expect(values[blankComponent('armas').id]).toEqual([])
    expect(values[blankComponent('oficios_menores').id]).toEqual([])
    expect(values[blankComponent('notas_combate').id]).toBe('')
  })

  it('o que é do sistema continua vindo preenchido', () => {
    const values = createInitialValues(blank)

    expect(readBlank(values, 'fam_runa_nome')).toBe('ATAQUE ELEMENTAL')
    expect(values[blankComponent('fam_runa_efeito').id]).toContain('Sinergia [Rubi]')
    expect(readBlank(values, 'fam_tamanho')).toBe('Miúdo')
    expect(readBlank(values, 'recurso1_nome')).toBe('???')
    expect(readBlank(values, 'fam_ataques.ataque.arma')).toBe('Ataque do familiar')
    expect(readBlank(values, 'servo_pericias.p1.pericia')).toBe('Lidar com Animais')
    const wheel = blankComponent('roda_elementos')
    expect(wheel.type === 'figure' ? wheel.src?.slice(0, 22) : '').toBe('data:image/webp;base64')
  })

  it('dá os mesmos números do arquivo baixado, e calcula tudo sem #ERRO', () => {
    const values = createInitialValues(blank)

    expect([...computeSheet(blank, values).errors.keys()]).toEqual([])
    expect(readBlank(values, 'proficiencia')).toBe(1)
    expect(readBlank(values, 'pv_total')).toBe(2)
    expect(readBlank(values, 'ca_total')).toBe(9)
    expect(readBlank(values, 'runa_cd')).toBe(10)
    expect(readBlank(values, 'fam_ca')).toBe(13)
  })

  it('o resumo para o token nasce sem nome: é o jogador quem dá', () => {
    const template = createTemplate({ name: 'Mesa', kind: 'character', schema: blank })
    const record = createSheetRecord({
      template,
      version: { version: 1, schema: blank, publishedAt: '2026-11-05T00:00:00.000Z' },
      ownerName: 'Bruno'
    })

    expect(record.summary.name).toBe(undefined)
    expect(record.summary.bars.hp).toEqual({ current: 2, max: 2 })

    const named = patchFields(record, blank, { values: { c_nome: 'Ciri' } })
    expect(named.summary.name).toBe('Ciri')
  })

  it('arma que o jogador adiciona ataca, fere e usa a margem 20 sem ele preencher', () => {
    const table = blankComponent('armas')
    if (table.type !== 'table') throw new Error('não é tabela')
    const attack = table.columns.find((column) => column.key === 'atacar')
    const damage = table.columns.find((column) => column.key === 'rolar_dano')

    // Do jeito que o botão Adicionar cria: número em 0 e texto vazio.
    const values = createInitialValues(blank)
    values[table.id] = [
      {
        id: 'row_nova',
        cells: {
          arma: 'Espada',
          acerto: 5,
          margem: 0,
          mult: '',
          dano: '1d8 + 3',
          tipo: '',
          propriedades: ''
        }
      }
    ]
    const { context } = createSheetContext(blank, values)
    const rowContext = createRowFormulaContext(context, table, 'row_nova')

    const attacked = rollFormula(attack?.formula ?? '', {
      context: rowContext,
      ...(attack?.critical === undefined ? {} : { critical: attack.critical }),
      engine: createSeededEngine(5)
    })
    expect(attacked.ok ? attacked.roll.notation : '').toBe('1d20 + 5')

    const margin = evaluateFormula('se(margem > 0, margem, 20)', rowContext)
    expect(margin.ok ? margin.value : null).toBe(20)

    const hurt = rollFormula(damage?.formula ?? '', { context: rowContext })
    expect(hurt.ok ? hurt.roll.notation : '').toBe('1d8 + 3')
  })

  it('arma nova sem dano preenchido explica o problema, em vez de quebrar', () => {
    const table = blankComponent('armas')
    if (table.type !== 'table') throw new Error('não é tabela')
    const damage = table.columns.find((column) => column.key === 'rolar_dano')

    const values = createInitialValues(blank)
    values[table.id] = [{ id: 'row_nova', cells: { arma: 'Espada', dano: '' } }]
    const { context } = createSheetContext(blank, values)

    const rolled = rollFormula(damage?.formula ?? '', {
      context: createRowFormulaContext(context, table, 'row_nova')
    })
    expect(rolled.ok ? null : rolled.error.message).toBe('Fórmula de rolagem vazia.')
  })
})

describe('arquivos', () => {
  it('os arquivos para importar estão em dia com o gerador', async () => {
    // O modelo em branco foi renomeado para o nome do sistema (Runa Arcana). Com o nome
    // antigo aqui, cada rodada recriava o arquivo velho — e no CI, onde snapshot ausente é
    // falha, travava a publicação de versão.
    await expect(`${JSON.stringify(createBlankTemplateFile(), null, 2)}\n`).toMatchFileSnapshot(
      '../../../../../docs/fichas/ficha-padrao-runaarcana.json'
    )
    await expect(`${JSON.stringify(createGeraltTemplateFile(), null, 2)}\n`).toMatchFileSnapshot(
      '../../../../../docs/fichas/ficha-do-geralt.json'
    )
  })
})
