import { uploadAsset } from '@/lib/db/assets'
import { createClue, deleteClue, updateClue, type CluePatch } from '@/lib/db/clues'
import { losesAccess, nextClueOrder, type Clue, type ClueDraft } from '@/lib/session/clues'
import { prepareImageForUpload, validateImageFile } from '@/lib/image/upload'
import { useSessionStore } from '@/features/session/session-store'
import { useCluesStore } from './clues-store'

/**
 * Ações das pistas (Fase 13): gravar, revelar e esconder.
 *
 * O cuidado que justifica este arquivo é o aviso pelo canal: esconder uma pista é um
 * UPDATE que o RLS passa a esconder, e por isso **não chega** a quem acabou de perder o
 * acesso. Sem o aviso, a pista ficaria para sempre na tela dele.
 */

/** Maior lado da imagem de uma pista: ela é olhada em tela cheia, mas não é um mapa. */
const MAX_CLUE_IMAGE_SIDE = 1600

export async function addClue(sessionId: string, draft: ClueDraft): Promise<Clue> {
  const clue = await createClue({
    ...draft,
    sessionId,
    sortOrder: nextClueOrder(useCluesStore.getState().clues)
  })
  useCluesStore.getState().upsertClue(clue)
  return clue
}

/**
 * Grava a pista. Quando a mudança tira o acesso de alguém, avisa pelo canal para esses
 * clientes reconferirem o que podem ver.
 */
export async function patchClue(clue: Clue, patch: CluePatch): Promise<Clue> {
  const saved = await updateClue(clue.id, patch)
  useCluesStore.getState().upsertClue(saved)

  if (losesAccess(clue, saved)) {
    useSessionStore.getState().broadcast('clue-gone', { id: clue.id })
  }
  return saved
}

/** Exclui a pista. O DELETE do tempo real chega a todos que a viam, com o id. */
export async function removeClue(clue: Clue): Promise<void> {
  await deleteClue(clue)
  useCluesStore.getState().removeClue(clue.id)
}

/** Envia a imagem da pista e devolve o caminho no Storage. */
export async function uploadClueImage(sessionId: string, file: File): Promise<string> {
  const problem = validateImageFile(file)
  if (problem !== null) throw new Error(problem)

  const prepared = await prepareImageForUpload(file, MAX_CLUE_IMAGE_SIDE)
  const path = `sessions/${sessionId}/clues/${prepared.hash}.webp`
  await uploadAsset(path, prepared.blob)
  return path
}
