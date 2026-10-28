import type { CriticalRule } from '@/lib/dice'
import type { FormulaContext } from '@/lib/formula'
import type { SheetComponent, SheetValue } from '@/lib/sheet'

/** Quem está olhando a ficha. Define o que aparece e o que dá para editar (5.3, 5.7). */
export type SheetAudience = 'gm' | 'player'

/** Pedido de rolagem saindo de um botão da ficha. Quem rola é a tela, não o componente. */
export interface RollRequest {
  label: string
  formula: string
  critical: CriticalRule
  criticalFailureOnOne: boolean
  /** Contexto da própria linha quando o botão está numa tabela. */
  context: FormulaContext
}

export interface SheetRenderCallbacks {
  onChange?: (componentId: string, value: SheetValue) => void
  onRoll?: (request: RollRequest) => void
}

export interface SheetRenderOptions extends SheetRenderCallbacks {
  audience: SheetAudience
  /** Desliga a edição inteira (modo construtor, ou ficha de outro jogador). */
  readOnly?: boolean
  /**
   * Aplica a condição de visibilidade das fórmulas. No construtor fica desligado, senão o
   * mestre não conseguiria selecionar um componente que está escondido.
   */
  applyConditionalVisibility?: boolean
}

export function canEdit(component: SheetComponent, options: SheetRenderOptions): boolean {
  if (options.readOnly === true) return false
  if (options.audience === 'gm') return true
  return component.editableBy === 'player'
}

export function canSee(component: SheetComponent, options: SheetRenderOptions): boolean {
  return options.audience === 'gm' || component.visibleTo === 'all'
}
