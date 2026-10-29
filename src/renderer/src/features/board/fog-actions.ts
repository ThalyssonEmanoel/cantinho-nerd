import {
  addFogShape,
  coverAll,
  fogBytes,
  MAX_FOG_BYTES,
  revealAll,
  undoFogShape,
  type BoardMap,
  type FogShape,
  type FogState
} from '@/lib/board'
import { FriendlyError } from '@/lib/db/errors'
import { updateMapFog } from '@/lib/db/maps'
import { beginFogWrite, endFogWrite, useBoardStore } from './board-store'

/**
 * Editar a névoa do mapa (6.4) — só o mestre.
 *
 * A névoa é gravada inteira a cada área nova, então as gravações vão **em fila**: com duas
 * em voo, a mais velha chegando depois apagaria a área mais nova. A tela já mostra a névoa
 * nova antes de o banco confirmar; se ele recusar, volta ao que o banco tem.
 */

let queue: Promise<unknown> = Promise.resolve()

function currentMap(mapId: string): BoardMap | null {
  return useBoardStore.getState().maps.find((map) => map.id === mapId) ?? null
}

/** Grava a névoa nova do mapa (otimista, em fila). */
export function saveFog(map: BoardMap, next: FogState): Promise<void> {
  if (fogBytes(next) > MAX_FOG_BYTES) {
    return Promise.reject(
      new FriendlyError(
        'A névoa deste mapa ficou detalhada demais. Use "Revelar tudo" ou "Cobrir tudo" e refaça com retângulos maiores.'
      )
    )
  }

  const previous = currentMap(map.id)?.fog ?? map.fog
  useBoardStore.getState().setMapFogLocally(map.id, next)
  beginFogWrite(map.id)

  const write = queue.then(async () => {
    try {
      await updateMapFog(map.id, next)
    } catch (error) {
      // Recusou: a tela volta para o que estava antes desta gravação.
      useBoardStore.getState().setMapFogLocally(map.id, previous)
      throw error
    } finally {
      endFogWrite(map.id)
    }
  })
  // A fila segue mesmo se esta gravação falhar.
  queue = write.catch(() => {})
  return write
}

function fogOf(map: BoardMap): FogState {
  return currentMap(map.id)?.fog ?? map.fog
}

export function setFogEnabled(map: BoardMap, enabled: boolean): Promise<void> {
  return saveFog(map, { ...fogOf(map), enabled })
}

export function addFogArea(map: BoardMap, shape: FogShape): Promise<void> {
  return saveFog(map, addFogShape(fogOf(map), shape, { width: map.width, height: map.height }))
}

export function undoFogArea(map: BoardMap): Promise<void> {
  return saveFog(map, undoFogShape(fogOf(map)))
}

export function revealWholeMap(map: BoardMap): Promise<void> {
  return saveFog(map, revealAll(fogOf(map), { width: map.width, height: map.height }))
}

export function coverWholeMap(map: BoardMap): Promise<void> {
  return saveFog(map, coverAll(fogOf(map)))
}
