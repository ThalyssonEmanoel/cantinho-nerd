import { useRef, useState } from 'react'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { blobToDataUrl, prepareImageForUpload, validateImageFile } from '@/lib/image/upload'
import { MAX_FIGURE_SRC_LENGTH, type SheetComponent } from '@/lib/sheet'
import { PropertyField, PropertyGroup } from './property-field'

type FigureComponent = Extract<SheetComponent, { type: 'figure' }>

/** Maior lado guardado no modelo: dá para ler um diagrama e o modelo continua leve. */
const MAX_FIGURE_SIDE = 1600

interface FigurePropertiesProps {
  component: FigureComponent
  onChange: (change: Partial<FigureComponent>) => void
}

/** Propriedades da imagem fixa (5.3): de onde ela vem e como cabe no espaço. */
export function FigureProperties({
  component,
  onChange
}: FigurePropertiesProps): React.JSX.Element {
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)

  async function embed(file: File): Promise<void> {
    const problem = validateImageFile(file)
    if (problem !== null) {
      toast.error(problem)
      return
    }

    setBusy(true)
    try {
      const { blob } = await prepareImageForUpload(file, MAX_FIGURE_SIDE)
      const src = await blobToDataUrl(blob)
      if (src.length > MAX_FIGURE_SRC_LENGTH) {
        toast.error('A imagem é grande demais para ir dentro do modelo.', {
          description: 'Use uma mais simples: ela vai junto em cada ficha aberta.'
        })
        return
      }
      onChange({ src })
    } catch (error) {
      toast.error('Não consegui usar essa imagem', {
        description: error instanceof Error ? error.message : undefined
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <PropertyGroup title="Imagem fixa">
      <PropertyField
        label="Imagem do modelo"
        hint="Vai dentro do modelo: uma versão nova chega a todas as fichas, e o jogador não troca."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            Escolher
          </Button>
          {component.src !== undefined && (
            <Button variant="ghost" size="sm" onClick={() => onChange({ src: undefined })}>
              <Trash2 className="size-3.5" />
              Tirar
            </Button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file !== undefined) void embed(file)
          }}
        />
      </PropertyField>

      <PropertyField
        label="Repetir uma imagem da ficha"
        hint="A chave de um campo de imagem, como =retrato. Mostra a foto dele aqui também."
      >
        <Input
          className="font-mono text-xs"
          value={component.sourceFormula ?? ''}
          placeholder="=retrato"
          onChange={(event) =>
            onChange({
              sourceFormula: event.target.value.trim() === '' ? undefined : event.target.value
            })
          }
        />
      </PropertyField>

      <PropertyField label="Encaixe">
        <Select
          value={component.fit}
          onChange={(event) =>
            onChange({ fit: event.target.value === 'cover' ? 'cover' : 'contain' })
          }
        >
          <option value="contain">Inteira, sem cortar</option>
          <option value="cover">Preenchendo, cortando as sobras</option>
        </Select>
      </PropertyField>
    </PropertyGroup>
  )
}
