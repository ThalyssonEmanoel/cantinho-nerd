import { removeAssets } from './assets'
import { getSupabase } from './client'
import { describeDbError, FriendlyError, type DbErrorLike } from './errors'

/**
 * Galeria de imagens do mestre (seção 8): monstros, NPCs e objetos, reutilizáveis entre
 * sessões. Só o dono lê — é o que evita spoiler para os jogadores.
 *
 * A Fase 10 usa a mesma tabela no bestiário; aqui ela serve para colocar um token no mapa
 * sem ficha.
 */

export type GalleryKind = 'monster' | 'npc' | 'object'

export const GALLERY_KIND_LABELS: Record<GalleryKind, string> = {
  monster: 'Monstros',
  npc: 'NPCs',
  object: 'Objetos'
}

export interface GalleryImage {
  id: string
  kind: GalleryKind
  name: string
  imagePath: string
  tokenSize: number
}

const COLUMNS = 'id, kind, name, image_path, token_size'

function fail(error: DbErrorLike): FriendlyError {
  return new FriendlyError(describeDbError(error), { cause: error })
}

function fromRow(row: {
  id: string
  kind: string
  name: string
  image_path: string
  token_size: number
}): GalleryImage {
  return {
    id: row.id,
    kind: (['monster', 'npc', 'object'] as const).includes(row.kind as GalleryKind)
      ? (row.kind as GalleryKind)
      : 'object',
    name: row.name,
    imagePath: row.image_path,
    tokenSize: Number(row.token_size)
  }
}

export async function listGallery(): Promise<GalleryImage[]> {
  const { data, error } = await getSupabase()
    .from('gallery_images')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
  if (error !== null) throw fail(error)
  return data.map(fromRow)
}

export interface AddGalleryImageInput {
  kind: GalleryKind
  name: string
  imagePath: string
  tokenSize?: number
}

export async function addGalleryImage(input: AddGalleryImageInput): Promise<GalleryImage> {
  const { data, error } = await getSupabase()
    .from('gallery_images')
    .insert({
      kind: input.kind,
      name: input.name.trim(),
      image_path: input.imagePath,
      ...(input.tokenSize === undefined ? {} : { token_size: input.tokenSize })
    })
    .select(COLUMNS)
    .single()
  if (error !== null) throw fail(error)
  return fromRow(data)
}

export async function updateGalleryImage(
  id: string,
  change: { name?: string; tokenSize?: number }
): Promise<void> {
  const { error } = await getSupabase()
    .from('gallery_images')
    .update({
      ...(change.name === undefined ? {} : { name: change.name.trim() }),
      ...(change.tokenSize === undefined ? {} : { token_size: change.tokenSize })
    })
    .eq('id', id)
  if (error !== null) throw fail(error)
}

export async function removeGalleryImage(image: GalleryImage): Promise<void> {
  const { error } = await getSupabase().from('gallery_images').delete().eq('id', image.id)
  if (error !== null) throw fail(error)

  // A mesma imagem pode estar em outro item da galeria (o nome é o hash do conteúdo).
  const { count } = await getSupabase()
    .from('gallery_images')
    .select('id', { count: 'exact', head: true })
    .eq('image_path', image.imagePath)
  if ((count ?? 0) === 0) await removeAssets([image.imagePath])
}
