import { findComponentById, isDecorative, type SheetComponent, type SheetSchema } from './types'

/**
 * Quem vê e quem edita cada campo da ficha (seções 5.3 e 5.7).
 *
 * Fica fora dos componentes de propósito: na Fase 5 a mesma regra passa a valer no banco
 * (RLS e RPC de patch), e este arquivo é onde ela está escrita e testada de uma vez.
 */

/** Quem está olhando a ficha. */
export type SheetAudience = 'gm' | 'player'

/** Campo que o jogador nem recebe: vive na tabela separada do mestre (5.7). */
export function isGmOnly(component: SheetComponent): boolean {
  return component.visibleTo === 'gm'
}

export function canSeeComponent(component: SheetComponent, audience: SheetAudience): boolean {
  return audience === 'gm' || !isGmOnly(component)
}

export function canEditComponent(component: SheetComponent, audience: SheetAudience): boolean {
  // Não dá para editar o que não se vê: o jogador nem recebe o valor do campo do mestre.
  if (!canSeeComponent(component, audience)) return false
  return audience === 'gm' || component.editableBy === 'player'
}

/** Componentes que não guardam valor próprio e portanto não são graváveis. */
export function holdsValue(component: SheetComponent): boolean {
  if (isDecorative(component)) return false
  return component.type !== 'computed' && component.type !== 'rollButton'
}

/**
 * Este campo pode ser gravado por quem está pedindo?
 *
 * É a mesma pergunta que o RPC de patch fará no servidor. O repositório local chama esta
 * função para recusar do mesmo jeito, então a tela já aprende a lidar com a recusa agora.
 */
export function canPatchField(
  schema: SheetSchema,
  componentId: string,
  audience: SheetAudience
): boolean {
  const component = findComponentById(schema, componentId)
  if (component === undefined) return false
  if (!holdsValue(component)) return false
  return canEditComponent(component, audience)
}
