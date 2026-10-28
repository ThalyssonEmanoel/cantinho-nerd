import { Dices, ImageIcon, Minus, Plus } from 'lucide-react'
import type { FormulaContext } from '@/lib/formula'
import {
  formatComputedValue,
  isResourceValue,
  readFormulaValue,
  resolveMarkersCount,
  safeNumber,
  type SheetComponent,
  type SheetValues
} from '@/lib/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { FieldFrame } from './field-frame'
import { TableView } from './table-view'
import { canEdit, type SheetRenderOptions } from './types'

interface ComponentViewProps {
  component: SheetComponent
  context: FormulaContext
  values: SheetValues
  options: SheetRenderOptions
  /** Marcas de permissão aparecem no construtor, não na ficha do jogador. */
  showPermissions?: boolean
}

/**
 * Desenha um componente da ficha. O mesmo componente serve ao construtor (pré-visualização)
 * e ao preenchimento de verdade (Fase 3): a diferença está só nas opções.
 */
export function ComponentView({
  component,
  context,
  values,
  options,
  showPermissions = false
}: ComponentViewProps): React.JSX.Element {
  const editable = canEdit(component, options)
  const raw = values[component.id]
  const change = (value: Parameters<NonNullable<SheetRenderOptions['onChange']>>[1]): void =>
    options.onChange?.(component.id, value)

  switch (component.type) {
    case 'heading':
      return (
        <div className="flex h-full items-end">
          <span
            className={cn(
              'w-full truncate border-b pb-1',
              component.level === 'title'
                ? 'text-lg font-semibold'
                : 'text-muted-foreground text-xs font-semibold uppercase tracking-wider'
            )}
            style={component.accent === undefined ? undefined : { color: component.accent }}
          >
            {component.text}
          </span>
        </div>
      )

    case 'text':
      return (
        <FieldFrame component={component} showPermissions={showPermissions}>
          <Input
            value={typeof raw === 'string' ? raw : ''}
            placeholder={component.placeholder}
            maxLength={component.maxLength}
            disabled={!editable}
            onChange={(event) => change(event.target.value)}
          />
        </FieldFrame>
      )

    case 'textarea':
      return (
        <FieldFrame component={component} showPermissions={showPermissions}>
          <Textarea
            className="h-full resize-none"
            value={typeof raw === 'string' ? raw : ''}
            placeholder={component.placeholder}
            maxLength={component.maxLength}
            disabled={!editable}
            onChange={(event) => change(event.target.value)}
          />
        </FieldFrame>
      )

    case 'number':
      return (
        <FieldFrame component={component} showPermissions={showPermissions}>
          <Input
            type="number"
            value={safeNumber(raw, component.defaultValue ?? 0)}
            min={component.min}
            max={component.max}
            step={component.step}
            disabled={!editable}
            onChange={(event) => change(safeNumber(event.target.value))}
          />
        </FieldFrame>
      )

    case 'checkbox':
      return (
        <FieldFrame component={component} showPermissions={showPermissions}>
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={raw === true}
              disabled={!editable}
              onChange={(event) => change(event.target.checked)}
            />
            <span className="text-muted-foreground">{component.hint ?? 'Sim'}</span>
          </label>
        </FieldFrame>
      )

    case 'select':
      return (
        <FieldFrame component={component} showPermissions={showPermissions}>
          <Select
            value={typeof raw === 'string' ? raw : ''}
            disabled={!editable}
            onChange={(event) => change(event.target.value)}
          >
            {component.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </FieldFrame>
      )

    case 'image':
      return (
        <FieldFrame component={component} showPermissions={showPermissions}>
          <div
            className={cn(
              'bg-muted/40 text-muted-foreground flex h-full w-full items-center justify-center border border-dashed',
              component.shape === 'circle' ? 'rounded-full' : 'rounded-md'
            )}
            title="O envio de imagens entra na Fase 6, junto com o Storage"
          >
            <ImageIcon className="size-5" />
          </div>
        </FieldFrame>
      )

    case 'attribute': {
      const modifier = readFormulaValue(context, [component.key, 'mod'])
      return (
        <FieldFrame component={component} showPermissions={showPermissions}>
          <div className="flex h-full flex-col items-center justify-center gap-1">
            <Input
              className="h-10 text-center text-lg font-semibold"
              type="number"
              value={safeNumber(raw, component.defaultValue ?? 0)}
              min={component.min}
              max={component.max}
              disabled={!editable}
              onChange={(event) => change(safeNumber(event.target.value))}
            />
            {component.modifierFormula !== undefined && (
              <span
                className={cn(
                  'text-muted-foreground text-xs',
                  modifier.error !== undefined && 'text-destructive'
                )}
                title={modifier.error?.message}
              >
                {modifier.error === undefined
                  ? formatComputedValue(modifier.value ?? 0, 'signed')
                  : '#ERRO'}
              </span>
            )}
          </div>
        </FieldFrame>
      )
    }

    case 'resource': {
      const max = readFormulaValue(context, [component.key, 'max'])
      const maxNumber = Math.max(0, safeNumber(max.value, 0))
      const current = isResourceValue(raw) ? raw.current : 0
      const percent = maxNumber === 0 ? 0 : Math.min(100, (current / maxNumber) * 100)

      const setCurrent = (value: number): void => {
        const clamped = Math.max(0, Math.min(maxNumber === 0 ? value : maxNumber, value))
        change(
          isResourceValue(raw)
            ? { ...raw, current: clamped }
            : {
                current: clamped,
                ...(component.maxValue === undefined ? {} : { max: component.maxValue })
              }
        )
      }

      return (
        <FieldFrame component={component} showPermissions={showPermissions}>
          <div className="flex h-full flex-col justify-center gap-1">
            <div className="flex items-center gap-1">
              {component.showButtons && (
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7 shrink-0"
                  disabled={!editable}
                  onClick={() => setCurrent(current - 1)}
                  aria-label="Diminuir"
                >
                  <Minus className="size-3.5" />
                </Button>
              )}
              <Input
                className="h-7 text-center text-sm"
                type="number"
                value={current}
                disabled={!editable}
                onChange={(event) => setCurrent(safeNumber(event.target.value))}
              />
              <span className="text-muted-foreground shrink-0 text-sm">
                /{' '}
                <span
                  className={cn(max.error !== undefined && 'text-destructive')}
                  title={max.error?.message}
                >
                  {max.error === undefined ? maxNumber : '#ERRO'}
                </span>
              </span>
              {component.showButtons && (
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7 shrink-0"
                  disabled={!editable}
                  onClick={() => setCurrent(current + 1)}
                  aria-label="Aumentar"
                >
                  <Plus className="size-3.5" />
                </Button>
              )}
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-[width]"
                style={{
                  width: `${percent}%`,
                  backgroundColor: component.color ?? 'var(--color-primary)'
                }}
              />
            </div>
          </div>
        </FieldFrame>
      )
    }

    case 'markers': {
      const total = resolveMarkersCount(component, context)
      const filled = safeNumber(raw, 0)
      return (
        <FieldFrame component={component} showPermissions={showPermissions}>
          <div className="flex h-full flex-wrap content-center items-center gap-1">
            {Array.from({ length: Math.min(total, 60) }, (_unused, index) => (
              <button
                key={index}
                type="button"
                disabled={!editable}
                aria-label={`Marcador ${index + 1}`}
                className={cn(
                  'size-4 rounded-full border transition-colors',
                  index < filled ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                )}
                onClick={() => change(index + 1 === filled ? index : index + 1)}
              />
            ))}
            {total === 0 && <span className="text-muted-foreground text-xs">0 marcadores</span>}
          </div>
        </FieldFrame>
      )
    }

    case 'computed': {
      const { value, error } = readFormulaValue(context, [component.key])
      return (
        <FieldFrame component={component} showPermissions={showPermissions}>
          <div
            className={cn(
              'bg-muted/30 flex h-9 items-center justify-center rounded-md border text-base font-semibold',
              error !== undefined && 'text-destructive'
            )}
            title={error?.message ?? component.hint}
          >
            {error === undefined ? formatComputedValue(value ?? 0, component.format) : '#ERRO'}
          </div>
        </FieldFrame>
      )
    }

    case 'rollButton':
      return (
        <FieldFrame component={component} showPermissions={showPermissions}>
          <Button
            className="w-full"
            variant="secondary"
            disabled={options.onRoll === undefined}
            onClick={() =>
              options.onRoll?.({
                label: component.label,
                formula: component.formula,
                critical: component.critical,
                criticalFailureOnOne: component.criticalFailureOnOne,
                context
              })
            }
          >
            <Dices className="size-4" />
            Rolar
          </Button>
        </FieldFrame>
      )

    case 'table':
      return (
        <FieldFrame component={component} showPermissions={showPermissions}>
          <TableView component={component} context={context} values={values} options={options} />
        </FieldFrame>
      )
  }
}
