import { describe, expect, it } from 'vitest'
import {
  COLOR_PRESETS,
  hexToHsv,
  hexToRgb,
  hsvToHex,
  normalizeHex,
  presetName,
  rgbToHex
} from './color'

describe('normalizeHex', () => {
  it('aceita as formas curta e longa, com ou sem #', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc')
    expect(normalizeHex('abc')).toBe('#aabbcc')
    expect(normalizeHex('#A78BFA')).toBe('#a78bfa')
    expect(normalizeHex('  a78bfa  ')).toBe('#a78bfa')
  })

  it('recusa o que não é hex de 3 ou 6 dígitos', () => {
    expect(normalizeHex('')).toBeNull()
    expect(normalizeHex('#12')).toBeNull()
    expect(normalizeHex('#12345')).toBeNull()
    expect(normalizeHex('red')).toBeNull()
    expect(normalizeHex('#ggg')).toBeNull()
  })
})

describe('conversões', () => {
  it('hex ↔ rgb', () => {
    expect(hexToRgb('#ef4444')).toEqual({ r: 239, g: 68, b: 68 })
    expect(rgbToHex(239, 68, 68)).toBe('#ef4444')
    expect(rgbToHex(300, -5, 127.6)).toBe('#ff0080')
  })

  it('cores puras têm a matiz certa', () => {
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 })
    expect(hexToHsv('#00ff00')).toEqual({ h: 120, s: 1, v: 1 })
    expect(hexToHsv('#0000ff')).toEqual({ h: 240, s: 1, v: 1 })
  })

  it('cinza não tem saturação, e preto não tem brilho', () => {
    expect(hexToHsv('#808080')?.s).toBe(0)
    expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 })
  })

  it('ida e volta mantém todas as cores da paleta', () => {
    for (const preset of COLOR_PRESETS) {
      const hsv = hexToHsv(preset.hex)
      expect(hsv).not.toBeNull()
      expect(hsvToHex(hsv!)).toBe(preset.hex)
    }
  })

  it('matiz fora de 0–360 dá a volta, e s/v são limitados', () => {
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe('#ff0000')
    expect(hsvToHex({ h: -120, s: 1, v: 1 })).toBe('#0000ff')
    expect(hsvToHex({ h: 0, s: 2, v: -1 })).toBe('#000000')
  })
})

describe('presetName', () => {
  it('reconhece a cor da paleta mesmo escrita de outro jeito', () => {
    expect(presetName('#EF4444')).toBe('Vermelho')
    expect(presetName('#123456')).toBeNull()
    expect(presetName(undefined)).toBeNull()
  })
})
