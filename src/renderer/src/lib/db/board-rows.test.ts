import { describe, expect, it } from 'vitest'
import { DEFAULT_GRID, DEFAULT_TOKEN_CROP } from '@/lib/board'
import {
  barsFromJson,
  gridFromJson,
  mapFromRow,
  tokenFromRow,
  tokenPatchToRow,
  type MapRow,
  type TokenRow
} from './board-rows'

const mapRow: MapRow = {
  id: 'map-1',
  session_id: 'sessao-1',
  name: 'Taverna',
  image_path: 'sessions/sessao-1/maps/abc.webp',
  width: 2000,
  height: 1500,
  grid: { enabled: true, size: 64, offsetX: 10, offsetY: 0, color: '#ff0000', opacity: 0.5 },
  sort_order: 2
}

const tokenRow: TokenRow = {
  id: 'token-1',
  session_id: 'sessao-1',
  map_id: 'map-1',
  sheet_id: 'ficha-1',
  kind: 'player',
  owner_id: 'bruno',
  name: 'Lia',
  image_path: 'sessions/sessao-1/tokens/def.webp',
  image_crop: { zoom: 2, offsetX: 0.1, offsetY: 0 },
  x: 120,
  y: 80,
  size: 1,
  z: 3,
  hidden: false,
  show_name: true,
  show_bars: true,
  vision_m: 9,
  bars: { hp: { current: 7, max: 16 } }
}

describe('mapFromRow', () => {
  it('traz a grade normalizada', () => {
    const map = mapFromRow(mapRow)
    expect(map.name).toBe('Taverna')
    expect(map.grid).toEqual({
      enabled: true,
      size: 64,
      offsetX: 10,
      offsetY: 0,
      color: '#ff0000',
      opacity: 0.5
    })
  })

  it('grade estragada no jsonb volta para o padrão', () => {
    expect(gridFromJson(null)).toEqual(DEFAULT_GRID)
    expect(gridFromJson('grade')).toEqual(DEFAULT_GRID)
    expect(gridFromJson({ size: 'grande' })).toEqual(DEFAULT_GRID)
    // Tamanho absurdo é limitado, não aceito.
    expect(gridFromJson({ size: 100000 }).size).toBe(600)
  })
})

describe('tokenFromRow', () => {
  it('converte a linha inteira', () => {
    const token = tokenFromRow(tokenRow)
    expect(token).toMatchObject({
      id: 'token-1',
      kind: 'player',
      name: 'Lia',
      x: 120,
      y: 80,
      visionM: 9
    })
    expect(token.crop.zoom).toBe(2)
    expect(token.bars.hp).toEqual({ current: 7, max: 16 })
  })

  it('tipo desconhecido vira objeto, e recorte estragado vira o padrão', () => {
    const token = tokenFromRow({ ...tokenRow, kind: 'dragão', image_crop: 'nada' })
    expect(token.kind).toBe('object')
    expect(token.crop).toEqual(DEFAULT_TOKEN_CROP)
  })

  it('numérico que o Postgres manda como texto continua número', () => {
    // `double precision` pode chegar como string pelo driver.
    const token = tokenFromRow({
      ...tokenRow,
      x: '12.5' as unknown as number,
      size: '2' as unknown as number
    })
    expect(token.x).toBe(12.5)
    expect(token.size).toBe(2)
  })

  it('barra sem número é descartada', () => {
    expect(barsFromJson({ hp: { current: 1 } })).toEqual({})
    expect(barsFromJson({ hp: { current: 1, max: 2 }, bar2: 'x' })).toEqual({
      hp: { current: 1, max: 2 }
    })
    expect(barsFromJson(null)).toEqual({})
  })
})

describe('tokenPatchToRow', () => {
  it('manda só o que mudou, com os nomes do banco', () => {
    expect(tokenPatchToRow({ x: 10, y: 20 })).toEqual({ x: 10, y: 20 })
    expect(tokenPatchToRow({ showName: false })).toEqual({ show_name: false })
    expect(tokenPatchToRow({ imagePath: null })).toEqual({ image_path: null })
  })

  it('patch vazio não manda nada', () => {
    expect(tokenPatchToRow({})).toEqual({})
  })

  it('a vida de um token sem ficha vai como barras (6.3)', () => {
    expect(tokenPatchToRow({ bars: { hp: { current: 4, max: 9 } } })).toEqual({
      bars: { hp: { current: 4, max: 9 } }
    })
    // Máximo zerado = sem barra nenhuma.
    expect(tokenPatchToRow({ bars: {} })).toEqual({ bars: {} })
  })
})
