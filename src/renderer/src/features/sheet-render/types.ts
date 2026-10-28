import type { CriticalRule } from '@/lib/dice'
import type { FormulaContext } from '@/lib/formula'
import { canEditComponent, canSeeComponent, type SheetComponent, type SheetValue } from '@/lib/sheet'

/** Quem está olhando a ficha. A regra em si vive em `lib/sheet/permissions`. */
export type { SheetAudience } from '@/lib/sheet'

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
  audience: 'gm' | 'player'
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
  return canEditComponent(component, options.audience)
}

export function canSee(component: SheetComponent, options: SheetRenderOptions): boolean {
  return canSeeComponent(component, options.audience)
}
