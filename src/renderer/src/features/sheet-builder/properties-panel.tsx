import { useState } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  COMPONENT_LABELS,
  isReservedKey,
  isValidKeyFormat,
  ROLE_ALLOWED_TYPES,
  ROLE_LABELS,
  allComponents,
  type ComponentRole,
  type SheetComponent,
  type SheetSchema
} from '@/lib/sheet'
import { PropertyField, PropertyGroup } from './property-field'
import { TypeProperties } from './type-properties'

interface PropertiesPanelProps {
  schema: SheetSchema
  component: SheetComponent | null
  onChange: (change: Partial<SheetComponent>) => void
  onRenameKey: (newKey: string) => void
  onDuplicate: () => void
  onDelete: () => void
  onMoveToTab: (tabId: string) => void
}

/** Painel da direita: propriedades do componente selecionado (5.2 e 5.3). */
export function PropertiesPanel({
  schema,
  component,
  onChange,
  onRenameKey,
  onDuplicate,
  onDelete,
  onMoveToTab
}: PropertiesPanelProps): React.JSX.Element {
  /*
    O campo da chave é um rascunho: só vale quando a pessoa sai dele, para a fórmula não ser
    reescrita a cada tecla. Quem sincroniza com a seleção é a `key` deste componente, posta
    pela tela do construtor — assim não precisamos de um efeito chamando setState.
  */
  const [keyDraft, setKeyDraft] = useState(component?.key ?? '')

  if (component === null) {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        <p className="mb-2 font-medium">Nada selecionado</p>
        <p>Clique num componente da ficha para ver as propriedades dele.</p>
      </div>
    )
  }

  const keyError = validateKeyDraft(keyDraft, component, schema)
  const currentTab = schema.tabs.find((tab) =>
    tab.components.some((item) => item.id === component.id)
  )

  return (
    <div className="space-y-4 p-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary">{COMPONENT_LABELS[component.type]}</Badge>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onDuplicate}
            aria-label="Duplicar"
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onDelete}
            aria-label="Excluir"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <PropertyField label="Rótulo">
        <Input
          value={component.label}
          onChange={(event) => onChange({ label: event.target.value })}
        />
      </PropertyField>

      <PropertyField
        label="Chave"
        hint="Nome usado nas fórmulas. Ao trocar, as fórmulas que a usam são atualizadas."
        error={keyError}
      >
        <Input
          className="font-mono text-xs"
          value={keyDraft}
          onChange={(event) => setKeyDraft(event.target.value)}
          onBlur={() => {
            if (keyError === undefined && keyDraft !== component.key) onRenameKey(keyDraft)
            else if (keyError !== undefined) setKeyDraft(component.key)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') setKeyDraft(component.key)
          }}
        />
      </PropertyField>

      <PropertyField label="Dica">
        <Input
          value={component.hint ?? ''}
          placeholder="Texto de ajuda"
          onChange={(event) => onChange({ hint: event.target.value })}
        />
      </PropertyField>

      <div className="grid grid-cols-2 gap-2">
        <PropertyField label="Quem edita">
          <Select
            value={component.editableBy}
            onChange={(event) =>
              onChange({ editableBy: event.target.value === 'gm' ? 'gm' : 'player' })
            }
          >
            <option value="player">Jogador</option>
            <option value="gm">Só o mestre</option>
          </Select>
        </PropertyField>

        <PropertyField label="Quem vê">
          <Select
            value={component.visibleTo}
            onChange={(event) =>
              onChange({ visibleTo: event.target.value === 'gm' ? 'gm' : 'all' })
            }
          >
            <option value="all">Todos</option>
            <option value="gm">Só o mestre</option>
          </Select>
        </PropertyField>
      </div>

      <PropertyField label="Condição de visibilidade" hint='Opcional. Ex.: classe == "Ocultista"'>
        <Input
          className="font-mono text-xs"
          value={component.visibleWhen ?? ''}
          placeholder="sempre visível"
          onChange={(event) => onChange({ visibleWhen: event.target.value })}
        />
      </PropertyField>

      <PropertyField label="Papel na mesa" hint="Liga este campo ao token e ao combate.">
        <Select
          value={component.role ?? ''}
          onChange={(event) => {
            const value = event.target.value
            onChange({ role: value === '' ? undefined : (value as ComponentRole) })
          }}
        >
          <option value="">Nenhum</option>
          {(Object.keys(ROLE_LABELS) as ComponentRole[]).map((role) => (
            <option
              key={role}
              value={role}
              disabled={!ROLE_ALLOWED_TYPES[role].includes(component.type)}
            >
              {ROLE_LABELS[role]}
              {ROLE_ALLOWED_TYPES[role].includes(component.type) ? '' : ' (não serve aqui)'}
            </option>
          ))}
        </Select>
      </PropertyField>

      <PropertyField label="Cor de destaque">
        <Input
          value={component.accent ?? ''}
          placeholder="#a78bfa"
          onChange={(event) => onChange({ accent: event.target.value })}
        />
      </PropertyField>

      <TypeProperties component={component} onChange={onChange} />

      {schema.tabs.length > 1 && (
        <PropertyGroup title="Aba">
          <PropertyField label="Mover para">
            <Select
              value={currentTab?.id ?? ''}
              onChange={(event) => onMoveToTab(event.target.value)}
            >
              {schema.tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label === '' ? 'Sem nome' : tab.label}
                </option>
              ))}
            </Select>
          </PropertyField>
        </PropertyGroup>
      )}
    </div>
  )
}

function validateKeyDraft(
  draft: string,
  component: SheetComponent,
  schema: SheetSchema
): string | undefined {
  if (draft === component.key) return undefined
  if (draft.trim() === '') return 'A chave não pode ficar vazia.'
  if (!isValidKeyFormat(draft)) return 'Use letras, números e _, começando por letra.'
  if (isReservedKey(draft)) return 'Esta palavra é reservada das fórmulas.'

  const duplicate = allComponents(schema).some(
    (item) => item.id !== component.id && item.key === draft
  )
  return duplicate ? 'Já existe um componente com esta chave.' : undefined
}
