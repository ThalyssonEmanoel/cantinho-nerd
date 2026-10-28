import { useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { Check, ChevronDown, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  clamp,
  COLOR_PRESETS,
  hexToHsv,
  hsvToHex,
  normalizeHex,
  presetName,
  type Hsv
} from '@/lib/color/color'
import { cn } from '@/lib/utils'

/** Ponto de partida da cor personalizada quando ainda não há cor escolhida. */
const FALLBACK_COLOR = '#a78bfa'

const HUE_GRADIENT =
  'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)'

interface ColorPickerProps {
  /** Cor atual (`#rrggbb`). `undefined` é "sem cor": vale o padrão do tema. */
  value: string | undefined
  onChange: (value: string | undefined) => void
  /** Texto do botão quando não há cor escolhida. */
  emptyLabel?: string
  /** O que a amostra mostra quando não há cor (ex.: a cor primária do tema). */
  emptyPreview?: string
  'aria-label'?: string
}

/**
 * Botão que abre uma paleta de cores: as prontas, uma área para escolher qualquer cor e o
 * código hex para quem já sabe qual quer.
 *
 * Usa o `popover` nativo do Chromium: ele desenha por cima de tudo (o painel de
 * propriedades rola e cortaria uma caixa comum), fecha com Esc e com clique fora sem
 * código nosso, e o posicionamento por âncora do CSS o mantém colado no botão.
 */
export function ColorPicker({
  value,
  onChange,
  emptyLabel = 'Padrão',
  emptyPreview = 'transparent',
  'aria-label': ariaLabel
}: ColorPickerProps): React.JSX.Element {
  const reactId = useId()
  // `useId` traz caracteres que não valem num nome de âncora do CSS.
  const safeId = reactId.replace(/[^a-zA-Z0-9_-]/g, '')
  const popoverId = `color-picker-${safeId}`
  const anchorName = `--color-picker-${safeId}`

  const popoverRef = useRef<HTMLDivElement>(null)
  const [hsv, setHsv] = useState<Hsv>(() => startingHsv(value))
  const [hexText, setHexText] = useState(() => hsvToHex(startingHsv(value)))

  const normalized = value === undefined ? null : normalizeHex(value)
  const name = presetName(value)
  const triggerText = value === undefined || value === '' ? emptyLabel : (name ?? value)
  const draftHex = hsvToHex(hsv)

  function close(): void {
    const popover = popoverRef.current
    // O jsdom dos testes não implementa a API de popover.
    if (popover !== null && typeof popover.hidePopover === 'function') popover.hidePopover()
  }

  function pick(next: string | undefined): void {
    onChange(next)
    close()
  }

  /** Começa a cor personalizada a partir da cor atual sempre que a paleta abre. */
  function syncFromValue(): void {
    const start = startingHsv(value)
    setHsv(start)
    setHexText(hsvToHex(start))
  }

  function updateDraft(next: Hsv): void {
    setHsv(next)
    setHexText(hsvToHex(next))
  }

  /** Aplica o que foi digitado no campo hex; texto inválido volta para a cor atual. */
  function commitHexText(): void {
    const parsed = normalizeHex(hexText)
    if (parsed === null) {
      setHexText(draftHex)
      return
    }
    const parsedHsv = hexToHsv(parsed)
    if (parsedHsv !== null) setHsv(parsedHsv)
    setHexText(parsed)
    if (parsed !== normalized) onChange(parsed)
  }

  const triggerStyle: CSSProperties = { anchorName }
  const popoverStyle: CSSProperties = {
    positionAnchor: anchorName,
    // Abre embaixo do botão, alinhado à esquerda dele; sem espaço, vira para cima.
    positionArea: 'bottom span-right',
    positionTryFallbacks: 'flip-block, flip-inline, flip-block flip-inline',
    inset: 'auto',
    margin: 0,
    marginBlock: 4
  }

  return (
    <>
      <button
        type="button"
        popoverTarget={popoverId}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        style={triggerStyle}
        className={cn(
          'border-input bg-background/40 flex h-9 w-full items-center gap-2 rounded-md border px-2.5 text-left text-sm shadow-xs outline-none transition-[color,box-shadow]',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
        )}
      >
        <Swatch color={value === undefined || value === '' ? emptyPreview : value} />
        <span
          className={cn('min-w-0 flex-1 truncate', value === undefined && 'text-muted-foreground')}
        >
          {triggerText}
        </span>
        <ChevronDown className="text-muted-foreground size-4 shrink-0" />
      </button>

      <div
        id={popoverId}
        ref={popoverRef}
        popover="auto"
        role="dialog"
        aria-label="Escolher cor"
        style={popoverStyle}
        onToggle={(event) => {
          // `newState` vem do ToggleEvent nativo que o popover dispara ao abrir e fechar.
          const nativeEvent = event.nativeEvent as Event & { newState?: string }
          if (nativeEvent.newState === 'open') syncFromValue()
        }}
        className="bg-popover text-popover-foreground w-64 space-y-3 rounded-lg border p-3 shadow-xl"
      >
        <div className="grid grid-cols-6 gap-1.5">
          {COLOR_PRESETS.map((preset) => {
            const selected = normalized === preset.hex
            return (
              <button
                key={preset.hex}
                type="button"
                title={preset.name}
                aria-label={preset.name}
                aria-pressed={selected}
                onClick={() => pick(preset.hex)}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-md transition-transform hover:scale-110',
                  selected && 'ring-foreground ring-offset-popover ring-2 ring-offset-2'
                )}
                style={{ backgroundColor: preset.hex }}
              >
                {selected && <Check className="size-3.5 text-white drop-shadow" />}
              </button>
            )
          })}
        </div>

        <div className="space-y-2 border-t pt-3">
          <p className="text-muted-foreground text-xs font-medium">Cor personalizada</p>

          <SaturationArea
            hsv={hsv}
            onDraft={updateDraft}
            onCommit={(next) => onChange(hsvToHex(next))}
          />
          <HueSlider
            hsv={hsv}
            onDraft={updateDraft}
            onCommit={(next) => onChange(hsvToHex(next))}
          />

          <div className="flex items-center gap-2">
            <Swatch color={draftHex} large />
            <Input
              className="h-8 font-mono text-xs"
              value={hexText}
              spellCheck={false}
              aria-label="Código hex da cor"
              onChange={(event) => setHexText(event.target.value)}
              onBlur={commitHexText}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitHexText()
              }}
            />
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          disabled={value === undefined}
          onClick={() => pick(undefined)}
        >
          <RotateCcw className="size-3.5" />
          Usar o padrão ({emptyLabel.toLowerCase()})
        </Button>
      </div>
    </>
  )
}

interface DraftProps {
  hsv: Hsv
  /** Enquanto arrasta: só a pré-visualização da paleta muda. */
  onDraft: (next: Hsv) => void
  /** Ao soltar: a cor vai para o modelo (um passo só no Desfazer). */
  onCommit: (next: Hsv) => void
}

/** Quadrado de saturação (horizontal) e brilho (vertical) da matiz atual. */
function SaturationArea({ hsv, onDraft, onCommit }: DraftProps): React.JSX.Element {
  function fromPointer(event: PointerEvent<HTMLDivElement>): Hsv | null {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    return {
      h: hsv.h,
      s: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      v: 1 - clamp((event.clientY - rect.top) / rect.height, 0, 1)
    }
  }

  return (
    <div
      className="relative h-28 cursor-crosshair touch-none rounded-md"
      style={{
        backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }),
        backgroundImage:
          'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)'
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        const next = fromPointer(event)
        if (next !== null) onDraft(next)
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        const next = fromPointer(event)
        if (next !== null) onDraft(next)
      }}
      onPointerUp={(event) => {
        // Só conta o soltar de um arrasto que começou aqui.
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        const next = fromPointer(event)
        onCommit(next ?? hsv)
      }}
    >
      <span
        className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
        style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
      />
    </div>
  )
}

/** Faixa com todas as matizes. */
function HueSlider({ hsv, onDraft, onCommit }: DraftProps): React.JSX.Element {
  function fromPointer(event: PointerEvent<HTMLDivElement>): Hsv | null {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return null
    return { ...hsv, h: clamp((event.clientX - rect.left) / rect.width, 0, 1) * 360 }
  }

  return (
    <div
      className="relative h-3 cursor-pointer touch-none rounded-full"
      style={{ backgroundImage: HUE_GRADIENT }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        const next = fromPointer(event)
        if (next !== null) onDraft(next)
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        const next = fromPointer(event)
        if (next !== null) onDraft(next)
      }}
      onPointerUp={(event) => {
        // Só conta o soltar de um arrasto que começou aqui.
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        const next = fromPointer(event)
        onCommit(next ?? hsv)
      }}
    >
      <span
        className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
        style={{
          left: `${(hsv.h / 360) * 100}%`,
          backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 })
        }}
      />
    </div>
  )
}

function Swatch({ color, large = false }: { color: string; large?: boolean }): React.JSX.Element {
  return (
    <span
      className={cn(
        'shrink-0 rounded-sm border border-white/15',
        large ? 'size-8 rounded-md' : 'size-5'
      )}
      // Fundo xadrez por baixo: "sem cor" aparece como transparente, e não como preto.
      style={{
        background: `linear-gradient(${color}, ${color}), repeating-conic-gradient(#3f3f46 0% 25%, #27272a 0% 50%) 50% / 8px 8px`
      }}
    />
  )
}

function startingHsv(value: string | undefined): Hsv {
  const parsed = value === undefined ? null : normalizeHex(value)
  return hexToHsv(parsed ?? FALLBACK_COLOR) ?? { h: 262, s: 0.45, v: 0.98 }
}
