import { toNumber, type FormulaValue } from '../formula'
import type { NumberFormat } from './types'

/** Formato do campo calculado (seção 5.3): inteiro, com sinal ("+2") ou decimal. */
export function formatComputedValue(value: FormulaValue, format: NumberFormat): string {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'

  switch (format) {
    case 'integer':
      return String(Math.trunc(value))
    case 'signed': {
      const rounded = Math.trunc(value)
      return rounded >= 0 ? `+${rounded}` : String(rounded)
    }
    case 'decimal':
      // Tira o zero sobrando: 2.50 vira 2,5 e 2.00 vira 2.
      return String(Number(value.toFixed(2))).replace('.', ',')
  }
}

/** Texto de um valor dentro de uma célula de tabela. */
export function formatCellValue(value: FormulaValue | undefined, format?: NumberFormat): string {
  if (value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'string') return value
  return formatComputedValue(value, format ?? 'integer')
}

/** Converte com tolerância para número, sem lançar (usado nos campos numéricos). */
export function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'string') {
    try {
      return toNumber(value)
    } catch {
      return fallback
    }
  }
  return fallback
}
