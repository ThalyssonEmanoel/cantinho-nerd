import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { newId, safeNumber, type NumberFormat, type SheetComponent } from '@/lib/sheet'
import { PropertyField, PropertyGroup } from './property-field'
import { TableProperties } from './table-properties'

interface TypePropertiesProps {
  component: SheetComponent
  onChange: (change: Partial<SheetComponent>) => void
}

const NUMBER_FORMATS: { value: NumberFormat; label: string }[] = [
  { value: 'integer', label: 'Inteiro (2)' },
  { value: 'signed', label: 'Com sinal (+2)' },
  { value: 'decimal', label: 'Decimal (2,5)' }
]

/** Propriedades específicas de cada tipo de componente (5.3). */
export function TypeProperties({
  component,
  onChange
}: TypePropertiesProps): React.JSX.Element | null {
  /** Converte campo vazio em `undefined` para a propriedade sair do modelo. */
  const optionalNumber = (value: string): number | undefined =>
    value.trim() === '' ? undefined : safeNumber(value)

  switch (component.type) {
    case 'text':
    case 'textarea':
      return (
        <PropertyGroup title="Texto">
          <PropertyField label="Placeholder">
            <Input
              value={component.placeholder ?? ''}
              onChange={(event) => onChange({ placeholder: event.target.value })}
            />
          </PropertyField>
          <PropertyField label="Máximo de caracteres">
            <Input
              type="number"
              min={1}
              value={component.maxLength ?? ''}
              onChange={(event) => onChange({ maxLength: optionalNumber(event.target.value) })}
            />
          </PropertyField>
        </PropertyGroup>
      )

    case 'number':
      return (
        <PropertyGroup title="Número">
          <div className="grid grid-cols-3 gap-2">
            <PropertyField label="Mín.">
              <Input
                type="number"
                value={component.min ?? ''}
                onChange={(event) => onChange({ min: optionalNumber(event.target.value) })}
              />
            </PropertyField>
            <PropertyField label="Máx.">
              <Input
                type="number"
                value={component.max ?? ''}
                onChange={(event) => onChange({ max: optionalNumber(event.target.value) })}
              />
            </PropertyField>
            <PropertyField label="Passo">
              <Input
                type="number"
                value={component.step ?? ''}
                onChange={(event) => onChange({ step: optionalNumber(event.target.value) })}
              />
            </PropertyField>
          </div>
          <PropertyField label="Padrão">
            <Input
              type="number"
              value={component.defaultValue ?? ''}
              onChange={(event) => onChange({ defaultValue: optionalNumber(event.target.value) })}
            />
          </PropertyField>
        </PropertyGroup>
      )

    case 'checkbox':
      return (
        <PropertyGroup title="Caixa de seleção">
          <PropertyField label="Começa marcada" hint="Em fórmulas, marcada vale 1 e vazia vale 0.">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={component.defaultValue}
                onChange={(event) => onChange({ defaultValue: event.target.checked })}
              />
              Marcada por padrão
            </label>
          </PropertyField>
        </PropertyGroup>
      )

    case 'select': {
      const options = component.options

      const updateOption = (index: number, change: { label?: string; value?: number }): void => {
        onChange({
          options: options.map((option, position) =>
            position === index ? { ...option, ...change } : option
          )
        })
      }

      const moveOption = (index: number, direction: -1 | 1): void => {
        const target = index + direction
        if (target < 0 || target >= options.length) return
        const next = [...options]
        const [moved] = next.splice(index, 1)
        if (moved === undefined) return
        next.splice(target, 0, moved)
        onChange({ options: next })
      }

      return (
        <PropertyGroup title="Opções">
          <p className="text-muted-foreground text-xs">
            O valor numérico é opcional: quando existe, é ele que a fórmula recebe.
          </p>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={option.id} className="flex items-center gap-1">
                <Input
                  className="h-7 text-sm"
                  value={option.label}
                  onChange={(event) => updateOption(index, { label: event.target.value })}
                />
                <Input
                  className="h-7 w-16 text-sm"
                  type="number"
                  placeholder="—"
                  value={option.value ?? ''}
                  onChange={(event) =>
                    updateOption(index, {
                      value:
                        event.target.value.trim() === ''
                          ? undefined
                          : safeNumber(event.target.value)
                    })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  disabled={index === 0}
                  onClick={() => moveOption(index, -1)}
                  aria-label="Subir opção"
                >
                  <ChevronUp className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  disabled={index === options.length - 1}
                  onClick={() => moveOption(index, 1)}
                  aria-label="Descer opção"
                >
                  <ChevronDown className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={() =>
                    onChange({
                      options: options.filter((_item, position) => position !== index)
                    })
                  }
                  aria-label="Excluir opção"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                options: [...options, { id: newId('o'), label: `Opção ${options.length + 1}` }]
              })
            }
          >
            <Plus className="size-3.5" />
            Nova opção
          </Button>

          <PropertyField label="Opção padrão">
            <Select
              value={component.defaultOptionId ?? ''}
              onChange={(event) => onChange({ defaultOptionId: event.target.value })}
            >
              <option value="">Primeira da lista</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </PropertyField>
        </PropertyGroup>
      )
    }

    case 'image':
      return (
        <PropertyGroup title="Imagem">
          <PropertyField label="Formato">
            <Select
              value={component.shape}
              onChange={(event) =>
                onChange({ shape: event.target.value === 'rect' ? 'rect' : 'circle' })
              }
            >
              <option value="circle">Círculo</option>
              <option value="rect">Retângulo</option>
            </Select>
          </PropertyField>
          <p className="text-muted-foreground text-xs">
            O envio da imagem em si entra na Fase 6, junto com o Storage.
          </p>
        </PropertyGroup>
      )

    case 'heading':
      return (
        <PropertyGroup title="Título">
          <PropertyField label="Texto">
            <Input
              value={component.text}
              onChange={(event) => onChange({ text: event.target.value })}
            />
          </PropertyField>
          <PropertyField label="Tamanho">
            <Select
              value={component.level}
              onChange={(event) =>
                onChange({ level: event.target.value === 'title' ? 'title' : 'section' })
              }
            >
              <option value="section">Seção</option>
              <option value="title">Título</option>
            </Select>
          </PropertyField>
        </PropertyGroup>
      )

    case 'attribute':
      return (
        <PropertyGroup title="Atributo">
          <div className="grid grid-cols-3 gap-2">
            <PropertyField label="Mín.">
              <Input
                type="number"
                value={component.min ?? ''}
                onChange={(event) => onChange({ min: optionalNumber(event.target.value) })}
              />
            </PropertyField>
            <PropertyField label="Máx.">
              <Input
                type="number"
                value={component.max ?? ''}
                onChange={(event) => onChange({ max: optionalNumber(event.target.value) })}
              />
            </PropertyField>
            <PropertyField label="Padrão">
              <Input
                type="number"
                value={component.defaultValue ?? ''}
                onChange={(event) => onChange({ defaultValue: optionalNumber(event.target.value) })}
              />
            </PropertyField>
          </div>
          <PropertyField
            label="Fórmula do modificador"
            hint="Use `valor` para o valor do atributo. Ex.: piso((valor - 10) / 2)"
          >
            <Input
              className="font-mono text-xs"
              value={component.modifierFormula ?? ''}
              placeholder="piso((valor - 10) / 2)"
              onChange={(event) => onChange({ modifierFormula: event.target.value })}
            />
          </PropertyField>
        </PropertyGroup>
      )

    case 'resource':
      return (
        <PropertyGroup title="Barra de recurso">
          <PropertyField label="Máximo fixo" hint="Deixe vazio para usar a fórmula abaixo.">
            <Input
              type="number"
              value={component.maxValue ?? ''}
              onChange={(event) => onChange({ maxValue: optionalNumber(event.target.value) })}
            />
          </PropertyField>
          <PropertyField label="Máximo por fórmula">
            <Input
              className="font-mono text-xs"
              value={component.maxFormula ?? ''}
              placeholder="=10 + constituicao.mod * nivel"
              onChange={(event) => onChange({ maxFormula: event.target.value })}
            />
          </PropertyField>
          <PropertyField label="Cor">
            <Input
              value={component.color ?? ''}
              placeholder="#ef4444"
              onChange={(event) => onChange({ color: event.target.value })}
            />
          </PropertyField>
          <PropertyField label="Botões + e −">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={component.showButtons}
                onChange={(event) => onChange({ showButtons: event.target.checked })}
              />
              Mostrar
            </label>
          </PropertyField>
        </PropertyGroup>
      )

    case 'markers':
      return (
        <PropertyGroup title="Marcadores">
          <PropertyField label="Quantidade fixa" hint="Deixe vazio para usar a fórmula.">
            <Input
              type="number"
              min={0}
              value={component.count ?? ''}
              onChange={(event) => onChange({ count: optionalNumber(event.target.value) })}
            />
          </PropertyField>
          <PropertyField label="Quantidade por fórmula">
            <Input
              className="font-mono text-xs"
              value={component.countFormula ?? ''}
              placeholder="=nivel"
              onChange={(event) => onChange({ countFormula: event.target.value })}
            />
          </PropertyField>
        </PropertyGroup>
      )

    case 'computed':
      return (
        <PropertyGroup title="Campo calculado">
          <PropertyField label="Fórmula" hint="Começa com = e nunca usa eval.">
            <Input
              className="font-mono text-xs"
              value={component.formula}
              placeholder="=10 + destreza.mod"
              onChange={(event) => onChange({ formula: event.target.value })}
            />
          </PropertyField>
          <PropertyField label="Formato">
            <Select
              value={component.format}
              onChange={(event) => onChange({ format: event.target.value as NumberFormat })}
            >
              {NUMBER_FORMATS.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </Select>
          </PropertyField>
        </PropertyGroup>
      )

    case 'rollButton': {
      const critical = component.critical

      return (
        <PropertyGroup title="Botão de rolagem">
          <PropertyField
            label="Fórmula da rolagem"
            hint="Trechos entre { } são calculados antes de rolar."
          >
            <Input
              className="font-mono text-xs"
              value={component.formula}
              placeholder="1d20 + {forca.mod}"
              onChange={(event) => onChange({ formula: event.target.value })}
            />
          </PropertyField>

          <PropertyField label="Crítico">
            <Select
              value={critical.kind}
              onChange={(event) => {
                const kind = event.target.value
                onChange({
                  critical:
                    kind === 'margin'
                      ? { kind: 'margin', threshold: 19 }
                      : kind === 'natural'
                        ? { kind: 'natural' }
                        : { kind: 'none' }
                })
              }}
            >
              <option value="none">Nenhum</option>
              <option value="natural">Natural (d20 = 20)</option>
              <option value="margin">Margem (d20 ≥ limiar)</option>
            </Select>
          </PropertyField>

          {critical.kind === 'margin' && (
            <PropertyField
              label="Limiar da margem"
              hint="Pode ser um número ou a chave de um campo da ficha."
            >
              <Input
                value={String(critical.threshold)}
                onChange={(event) => {
                  const text = event.target.value
                  const asNumber = Number(text)
                  onChange({
                    critical: {
                      kind: 'margin',
                      threshold: text.trim() !== '' && !Number.isNaN(asNumber) ? asNumber : text
                    }
                  })
                }}
              />
            </PropertyField>
          )}

          <PropertyField label="Falha crítica no 1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={component.criticalFailureOnOne}
                onChange={(event) => onChange({ criticalFailureOnOne: event.target.checked })}
              />
              Marcar falha crítica
            </label>
          </PropertyField>
        </PropertyGroup>
      )
    }

    case 'table':
      return <TableProperties component={component} onChange={onChange} />
  }
}
