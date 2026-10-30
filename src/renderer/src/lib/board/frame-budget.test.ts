import { describe, expect, it } from 'vitest'
import {
  byDrawOrder,
  gridLines,
  isFogged,
  tokenVisibleThroughFog,
  visibleRect,
  visionCircles,
  type BoardToken,
  type FogShape,
  type FogState,
  type GridSettings,
  type SessionScale
} from './index'

/**
 * Orçamento de quadro do tabuleiro (Fase 13: "60 fps com mapa de 4096 px e 50 tokens").
 *
 * Os 60 fps de verdade dependem de GPU e janela, e só se medem com o app aberto. O que dá
 * para garantir aqui é o que roda **a cada quadro em JavaScript**: as linhas da grade, os
 * círculos de visão, o filtro de quem a névoa esconde e a ordem de desenho. Se uma destas
 * contas virar lenta numa mudança futura, este teste cai antes de o app engasgar.
 *
 * Os limites são folgados de propósito (um quadro tem 16,6 ms): o teste é rede de
 * proteção contra regressão de ordem de grandeza, não medida de desempenho fina.
 */

const MAP = { width: 4096, height: 4096 }
const VIEWPORT = { width: 1920, height: 1080 }
const grid: GridSettings = {
  enabled: true,
  size: 70,
  offsetX: 0,
  offsetY: 0,
  color: '#ffffff',
  opacity: 0.25
}
const scale: SessionScale = { metersPerSquare: 1.5, diagonal: 'simple' }

function token(index: number): BoardToken {
  return {
    id: `token-${index}`,
    sessionId: 'mesa',
    mapId: 'mapa',
    sheetId: null,
    kind: index % 5 === 0 ? 'player' : 'monster',
    ownerId: 'alguem',
    name: `Token ${index}`,
    imagePath: null,
    crop: { zoom: 1, offsetX: 0, offsetY: 0 },
    x: (index % 10) * 350,
    y: Math.floor(index / 10) * 350,
    size: 1,
    z: index,
    hidden: false,
    showName: true,
    showBars: true,
    visionM: null,
    bars: { hp: { current: 7, max: 16 } },
    conditions: []
  }
}

/** 50 tokens, como pede o critério da fase. */
const tokens = Array.from({ length: 50 }, (_item, index) => token(index))

/** Névoa com bastante área: o mestre revelando aos poucos chega fácil a isto. */
const fog: FogState = {
  enabled: true,
  shapes: Array.from({ length: 60 }, (_item, index): FogShape => {
    const x = (index % 8) * 500
    const y = Math.floor(index / 8) * 500
    return {
      kind: 'rect',
      mode: index % 4 === 0 ? 'cover' : 'reveal',
      points: [x, y, x + 480, y + 480],
      radius: 0
    }
  })
}

/** Tempo de `rounds` execuções, em milissegundos por execução. */
function perFrame(rounds: number, work: (round: number) => void): number {
  // Uma volta antes de medir, para o JIT não entrar na conta.
  work(0)
  const start = performance.now()
  for (let round = 0; round < rounds; round += 1) work(round)
  return (performance.now() - start) / rounds
}

describe('o que roda a cada quadro', () => {
  it('as linhas da grade de um mapa de 4096 px saem rápido, em qualquer zoom', () => {
    const cameras = [
      { x: 0, y: 0, scale: 1 },
      { x: -2000, y: -1500, scale: 2 },
      // Afastado o bastante para o mapa inteiro caber: é o pior caso em linhas.
      { x: 0, y: 0, scale: 0.26 }
    ]

    const cost = perFrame(300, (round) => {
      const camera = cameras[round % cameras.length] as (typeof cameras)[number]
      const view = visibleRect(camera, VIEWPORT)
      gridLines(grid, MAP, view)
    })

    expect(cost).toBeLessThan(2)
  })

  it('a grade afastada não devolve linha sem fim', () => {
    const view = visibleRect({ x: 0, y: 0, scale: 0.05 }, VIEWPORT)
    const lines = gridLines({ ...grid, size: 8 }, MAP, view)
    // O teto de segurança do `gridLines` existe justamente para este caso.
    expect(lines.vertical.length).toBeLessThanOrEqual(2000)
    expect(lines.horizontal.length).toBeLessThanOrEqual(2000)
  })

  it('visão e névoa com 50 tokens cabem no quadro', () => {
    const cost = perFrame(200, () => {
      const visions = visionCircles(tokens, grid, scale, 9)
      for (const item of tokens) tokenVisibleThroughFog(item, grid, fog, visions)
    })

    expect(cost).toBeLessThan(3)
  })

  it('um ponto na névoa é decidido na hora (o cursor pergunta isso a cada movimento)', () => {
    const visions = visionCircles(tokens, grid, scale, 9)
    const cost = perFrame(2000, (round) => {
      isFogged({ x: (round * 37) % MAP.width, y: (round * 53) % MAP.height }, fog, visions)
    })

    expect(cost).toBeLessThan(0.2)
  })

  it('ordenar os tokens para desenhar é barato', () => {
    const cost = perFrame(500, () => {
      ;[...tokens].sort(byDrawOrder)
    })

    expect(cost).toBeLessThan(0.5)
  })
})
