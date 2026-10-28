/**
 * Cores do seletor de cor (cor de destaque, cor da barra e, mais para frente, grade e
 * desenho). Funções puras: o componente só desenha, a conta fica aqui e tem teste.
 *
 * O formato salvo é sempre `#rrggbb` minúsculo, que é o que o CSS entende e o que cabe no
 * limite de 40 caracteres dos modelos.
 */

export interface Hsv {
  /** Matiz, de 0 a 360. */
  h: number
  /** Saturação, de 0 a 1. */
  s: number
  /** Brilho, de 0 a 1. */
  v: number
}

export interface ColorPreset {
  name: string
  hex: string
}

/**
 * Paleta pronta. Tons médios (o "500" do Tailwind), que leem bem como texto e como barra
 * sobre o fundo escuro do app. A ordem segue o círculo das cores, com o cinza no fim.
 */
export const COLOR_PRESETS: readonly ColorPreset[] = [
  { name: 'Vermelho', hex: '#ef4444' },
  { name: 'Laranja', hex: '#f97316' },
  { name: 'Âmbar', hex: '#f59e0b' },
  { name: 'Amarelo', hex: '#eab308' },
  { name: 'Lima', hex: '#84cc16' },
  { name: 'Verde', hex: '#22c55e' },
  { name: 'Esmeralda', hex: '#10b981' },
  { name: 'Verde-água', hex: '#14b8a6' },
  { name: 'Ciano', hex: '#06b6d4' },
  { name: 'Azul-céu', hex: '#0ea5e9' },
  { name: 'Azul', hex: '#3b82f6' },
  { name: 'Anil', hex: '#6366f1' },
  { name: 'Violeta', hex: '#8b5cf6' },
  { name: 'Roxo', hex: '#a855f7' },
  { name: 'Magenta', hex: '#d946ef' },
  { name: 'Rosa', hex: '#ec4899' },
  { name: 'Carmim', hex: '#f43f5e' },
  { name: 'Cinza', hex: '#71717a' }
]

const SHORT_HEX = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i
const LONG_HEX = /^#?([0-9a-f]{6})$/i

/**
 * Aceita `#abc`, `abc`, `#aabbcc` e `aabbcc` (maiúsculas ou não) e devolve `#aabbcc`.
 * Qualquer outra coisa devolve `null` — quem chama decide o que fazer com texto inválido.
 */
export function normalizeHex(input: string): string | null {
  const text = input.trim()

  const short = SHORT_HEX.exec(text)
  if (short !== null) {
    const [, r, g, b] = short
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }

  const long = LONG_HEX.exec(text)
  if (long !== null) return `#${long[1]}`.toLowerCase()

  return null
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex)
  if (normalized === null) return null
  const value = Number.parseInt(normalized.slice(1), 16)
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
}

export function rgbToHex(r: number, g: number, b: number): string {
  const channel = (value: number): string =>
    Math.round(clamp(value, 0, 255))
      .toString(16)
      .padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

export function hexToHsv(hex: string): Hsv | null {
  const rgb = hexToRgb(hex)
  if (rgb === null) return null

  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
  }

  return {
    h: (h * 60 + 360) % 360,
    s: max === 0 ? 0 : delta / max,
    v: max
  }
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = (((h % 360) + 360) % 360) / 60
  const sat = clamp(s, 0, 1)
  const val = clamp(v, 0, 1)

  const chroma = val * sat
  const x = chroma * (1 - Math.abs((hue % 2) - 1))
  const m = val - chroma

  const [r, g, b] =
    hue < 1
      ? [chroma, x, 0]
      : hue < 2
        ? [x, chroma, 0]
        : hue < 3
          ? [0, chroma, x]
          : hue < 4
            ? [0, x, chroma]
            : hue < 5
              ? [x, 0, chroma]
              : [chroma, 0, x]

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}

/** Nome da cor da paleta, ou `null` se for uma cor personalizada. */
export function presetName(hex: string | undefined): string | null {
  if (hex === undefined) return null
  const normalized = normalizeHex(hex)
  return COLOR_PRESETS.find((preset) => preset.hex === normalized)?.name ?? null
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
