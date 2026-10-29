import { getSupabase } from './client'
import { describeDbError, FriendlyError } from './errors'

/**
 * Imagens do bucket privado `assets` (10.2): mapas, tokens e galeria.
 *
 * O bucket é privado, então não existe URL pública: o arquivo é baixado com a credencial de
 * quem está logado e vira uma URL de objeto na memória. Como o nome do arquivo é o **hash
 * do conteúdo**, o mesmo nome nunca aponta para outra imagem — por isso o download é
 * guardado em disco pelo processo principal e, nas próximas vezes, não gasta tráfego do
 * plano grátis.
 */

export const ASSETS_BUCKET = 'assets'

/** Cache eterno: o nome é o hash do conteúdo. */
const CACHE_SECONDS = '31536000'

/** URL de objeto por caminho. Uma só por imagem, mesmo com dez tokens usando a mesma. */
const urls = new Map<string, Promise<string>>()

/** Último pedaço do caminho (`<hash>.webp`), que é a chave do cache em disco. */
function cacheKeyOf(path: string): string | null {
  const name = path.split('/').pop() ?? ''
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) && !name.includes('..') ? name : null
}

async function readFromDisk(key: string): Promise<Blob | null> {
  try {
    const data = await window.api?.readCachedAsset(key)
    if (data === null || data === undefined || data.byteLength === 0) return null
    return new Blob([data as BlobPart], { type: 'image/webp' })
  } catch {
    // Sem ponte do preload (teste, navegador): segue direto para o Storage.
    return null
  }
}

async function saveToDisk(key: string, blob: Blob): Promise<void> {
  try {
    const buffer = await blob.arrayBuffer()
    await window.api?.writeCachedAsset(key, new Uint8Array(buffer))
  } catch {
    // Cache é otimização: falhar aqui não atrapalha nada.
  }
}

async function download(path: string): Promise<Blob> {
  const { data, error } = await getSupabase().storage.from(ASSETS_BUCKET).download(path)
  if (error !== null || data === null) {
    throw new FriendlyError(
      error === null ? 'Não consegui baixar a imagem.' : describeDbError(error),
      { cause: error }
    )
  }
  return data
}

/**
 * URL para desenhar a imagem. Resolve na mesma promessa se dois tokens pedirem a mesma
 * imagem ao mesmo tempo.
 */
export function assetUrl(path: string): Promise<string> {
  const existing = urls.get(path)
  if (existing !== undefined) return existing

  const promise = (async () => {
    const key = cacheKeyOf(path)
    const cached = key === null ? null : await readFromDisk(key)
    if (cached !== null) return URL.createObjectURL(cached)

    const blob = await download(path)
    if (key !== null) void saveToDisk(key, blob)
    return URL.createObjectURL(blob)
  })()

  // Erro não fica guardado: a próxima tentativa pode dar certo (voltou a internet).
  urls.set(
    path,
    promise.catch((error: unknown) => {
      urls.delete(path)
      throw error
    })
  )
  return urls.get(path) as Promise<string>
}

/** Envia uma imagem já em WebP. O nome é o hash, então reenviar a mesma é sucesso. */
export async function uploadAsset(path: string, image: Blob): Promise<string> {
  const { error } = await getSupabase().storage.from(ASSETS_BUCKET).upload(path, image, {
    contentType: 'image/webp',
    cacheControl: CACHE_SECONDS,
    upsert: false
  })

  if (error !== null && !isAlreadyExists(error)) {
    throw new FriendlyError(describeDbError(error), { cause: error })
  }
  return path
}

/**
 * Copia um arquivo dentro do bucket, sem baixar e subir de novo.
 *
 * É assim que a imagem da galeria do mestre vira token: a cópia vai para a pasta da sessão,
 * que os jogadores podem ler — a galeria em si fica fora do alcance deles (seção 8).
 */
export async function copyAsset(from: string, to: string): Promise<string> {
  const { error } = await getSupabase().storage.from(ASSETS_BUCKET).copy(from, to)
  if (error !== null && !isAlreadyExists(error)) {
    throw new FriendlyError(describeDbError(error), { cause: error })
  }
  return to
}

/**
 * Apaga arquivos da mesa (mapa excluído, sessão excluída). Não existe exclusão em cascata
 * no Storage: é o app que limpa (10.2).
 */
export async function removeAssets(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return
  const { error } = await getSupabase()
    .storage.from(ASSETS_BUCKET)
    .remove(paths as string[])
  if (error !== null) console.warn('Não consegui apagar arquivos do Storage:', error)

  for (const path of paths) forgetAsset(path)
}

/** Esquece a URL de uma imagem (depois de apagá-la, por exemplo). */
export function forgetAsset(path: string): void {
  const pending = urls.get(path)
  urls.delete(path)
  void pending?.then((url) => URL.revokeObjectURL(url)).catch(() => undefined)
}

export function mapImagePath(sessionId: string, hash: string): string {
  return `sessions/${sessionId}/maps/${hash}.webp`
}

export function tokenImagePath(sessionId: string, hash: string): string {
  return `sessions/${sessionId}/tokens/${hash}.webp`
}

export function galleryImagePath(userId: string, hash: string): string {
  return `users/${userId}/gallery/${hash}.webp`
}

function isAlreadyExists(error: {
  message?: string
  code?: string
  status?: number
  statusCode?: string | number
}): boolean {
  return (
    error.code === 'ResourceAlreadyExists' ||
    error.status === 409 ||
    String(error.statusCode) === '409' ||
    /already exists|duplicate/i.test(error.message ?? '')
  )
}
