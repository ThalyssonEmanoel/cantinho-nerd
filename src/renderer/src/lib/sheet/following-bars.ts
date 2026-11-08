import type { FormulaContext } from '../formula'
import { createSheetContext, readFormulaValue } from './context'
import { canEditComponent, type SheetAudience } from './permissions'
import { allComponents, type SheetComponent, type SheetSchema } from './types'
import { isResourceValue, type ResourceValue, type SheetValue, type SheetValues } from './values'

/**
 * Barra cujo atual acompanha o máximo (`followsMax`).
 *
 * O atual de uma barra é um valor guardado, e não uma conta. Sistemas que pensam em "dano
 * recebido" esperam outra coisa: a vida atual é o máximo menos o dano. Então, quando uma edição
 * muda o máximo, o atual muda a mesma diferença, e o dano que a pessoa já levou fica igual.
 * Subir de nível cura o que subiu; dano na vida máxima tira dos dois.
 */

export interface FollowingBarChange {
  id: string
  value: ResourceValue
}

type ResourceComponent = Extract<SheetComponent, { type: 'resource' }>

function maxOf(context: FormulaContext, bar: ResourceComponent): number | null {
  const { value, error } = readFormulaValue(context, [bar.key, 'max'])
  return error === undefined && typeof value === 'number' ? value : null
}

/**
 * O que a edição de `componentId` muda nas barras que acompanham o máximo.
 *
 * O resultado pode ficar negativo de propósito. Trocar o nível de 12 para 13 passa pelo "1"
 * enquanto se digita: com um piso em zero, esse instante apagaria o dano levado, e o 13 chegaria
 * com a vida cheia. Quem edita a barra direto continua limitado ao intervalo dela.
 *
 * Quem não pode editar a barra não a muda: a gravação seria recusada no banco inteira, e o campo
 * que a pessoa pode editar voltaria junto. Fórmula de máximo com erro também não mexe na barra.
 */
export function followingBarChanges(
  schema: SheetSchema,
  values: SheetValues,
  componentId: string,
  next: SheetValue,
  audience: SheetAudience
): FollowingBarChange[] {
  const bars = allComponents(schema).filter(
    (item): item is ResourceComponent =>
      item.type === 'resource' &&
      item.followsMax === true &&
      item.id !== componentId &&
      canEditComponent(item, audience)
  )
  if (bars.length === 0) return []

  const before = createSheetContext(schema, values).context
  const after = createSheetContext(schema, { ...values, [componentId]: next }).context

  return bars.flatMap((bar) => {
    const previousMax = maxOf(before, bar)
    const nextMax = maxOf(after, bar)
    if (previousMax === null || nextMax === null || previousMax === nextMax) return []

    const raw = values[bar.id]
    const stored = isResourceValue(raw) ? raw : { current: 0 }
    return [{ id: bar.id, value: { ...stored, current: stored.current + nextMax - previousMax } }]
  })
}
