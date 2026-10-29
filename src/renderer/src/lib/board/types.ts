import type { TokenCondition } from './conditions'

/**
 * Tabuleiro: mapas, tokens, grade e escala (seções 6.1 a 6.3).
 *
 * Tudo aqui é lógica pura, em **coordenadas lógicas do mapa** — as mesmas que vão para o
 * banco. O tamanho lógico de um mapa é o tamanho da imagem dele, então três janelas de
 * tamanhos diferentes mostram os tokens nas mesmas posições (10.1).
 */

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Rect extends Point, Size {}

/** Grade do mapa (6.2). `size` e os deslocamentos estão em pixels da imagem. */
export interface GridSettings {
  enabled: boolean
  size: number
  offsetX: number
  offsetY: number
  color: string
  opacity: number
}

export const DEFAULT_GRID: GridSettings = {
  enabled: true,
  size: 70,
  offsetX: 0,
  offsetY: 0,
  color: '#ffffff',
  opacity: 0.25
}

export const MIN_GRID_SIZE = 8
export const MAX_GRID_SIZE = 600

/** Regra de diagonal da mesa (6.2). */
export type DiagonalRule = 'simple' | 'alternating' | 'real'

/** Escala da mesa (6.2): quantos metros tem um quadrado, e como contar diagonal. */
export interface SessionScale {
  metersPerSquare: number
  diagonal: DiagonalRule
}

export const DEFAULT_SCALE: SessionScale = { metersPerSquare: 1.5, diagonal: 'simple' }

export const DIAGONAL_LABELS: Record<DiagonalRule, string> = {
  simple: 'Simples (cada quadrado conta 1)',
  alternating: 'Alternada (1-2-1)',
  real: 'Real (distância em linha reta)'
}

export type TokenKind = 'player' | 'monster' | 'npc' | 'object'

export const TOKEN_KIND_LABELS: Record<TokenKind, string> = {
  player: 'Jogador',
  monster: 'Monstro',
  npc: 'NPC',
  object: 'Objeto'
}

/** Moldura colorida por tipo (6.3). */
export const TOKEN_KIND_COLORS: Record<TokenKind, string> = {
  player: '#38bdf8',
  monster: '#f87171',
  npc: '#a78bfa',
  object: '#fbbf24'
}

export type BarKey = 'hp' | 'bar2' | 'bar3'

export interface BarValue {
  current: number
  max: number
}

/** Barras do token, copiadas da ficha pelos papéis (5.6). */
export type TokenBars = Partial<Record<BarKey, BarValue>>

/** Reenquadramento da imagem dentro do círculo (6.3), em frações do lado do token. */
export interface TokenCrop {
  /** 1 = a imagem cobre o círculo; 4 = quatro vezes mais perto. */
  zoom: number
  offsetX: number
  offsetY: number
}

export const DEFAULT_TOKEN_CROP: TokenCrop = { zoom: 1, offsetX: 0, offsetY: 0 }

export interface BoardMap {
  id: string
  sessionId: string
  name: string
  imagePath: string
  width: number
  height: number
  grid: GridSettings
  sortOrder: number
}

export interface BoardToken {
  id: string
  sessionId: string
  mapId: string
  sheetId: string | null
  kind: TokenKind
  ownerId: string
  name: string
  imagePath: string | null
  crop: TokenCrop
  /** Canto superior esquerdo, em coordenadas do mapa. */
  x: number
  y: number
  /** Lado em quadrados da grade. */
  size: number
  z: number
  hidden: boolean
  showName: boolean
  showBars: boolean
  visionM: number | null
  bars: TokenBars
  /** Condições com ícone e duração (6.3). */
  conditions: TokenCondition[]
}

export const MIN_TOKEN_SIZE = 0.5
export const MAX_TOKEN_SIZE = 10
