import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { isSafeAssetKey, MAX_CACHED_ASSET_BYTES } from '../shared/ipc'

/**
 * Cache em disco das imagens baixadas do Storage (seção 10.2).
 *
 * O nome de cada arquivo no Storage é o **hash do conteúdo**, então o mesmo nome nunca
 * aponta para outra imagem: dá para guardar para sempre e nunca invalidar. Isso economiza
 * o tráfego do plano grátis — um mapa de 3 MB é baixado uma vez, não a cada sessão.
 *
 * A chave vem do renderer, então é ela que precisa de cuidado: só nome de arquivo simples,
 * sem barra nem `..`, senão um caminho qualquer viraria escrita fora da pasta do cache.
 */

/** Teto do cache. Passando disso, os arquivos mais velhos saem. */
const MAX_CACHE_BYTES = 400 * 1024 * 1024

/** Depois de limpar, sobra folga para não ficar limpando a cada gravação. */
const PRUNE_TARGET = 0.8

let cacheDirectory: string | null = null

async function ensureDirectory(): Promise<string> {
  if (cacheDirectory !== null) return cacheDirectory
  const path = join(app.getPath('userData'), 'asset-cache')
  await mkdir(path, { recursive: true })
  cacheDirectory = path
  return path
}

export async function readCachedAsset(key: unknown): Promise<Uint8Array | null> {
  if (!isSafeAssetKey(key)) return null

  try {
    const directory = await ensureDirectory()
    const data = await readFile(join(directory, key))
    return new Uint8Array(data)
  } catch {
    // Não está no cache (ou o disco recusou): quem chamou baixa do Storage.
    return null
  }
}

export async function writeCachedAsset(key: unknown, data: unknown): Promise<boolean> {
  if (!isSafeAssetKey(key)) return false
  if (!(data instanceof Uint8Array) || data.byteLength === 0) return false
  if (data.byteLength > MAX_CACHED_ASSET_BYTES) return false

  try {
    const directory = await ensureDirectory()
    await writeFile(join(directory, key), data)
    await pruneIfNeeded(directory)
    return true
  } catch (error) {
    console.warn('Não consegui guardar a imagem no cache:', error)
    return false
  }
}

/** Limpa os mais velhos quando o cache passa do teto. */
async function pruneIfNeeded(directory: string): Promise<void> {
  const names = await readdir(directory)
  const files: { path: string; size: number; time: number }[] = []
  let total = 0

  for (const name of names) {
    try {
      const path = join(directory, name)
      const info = await stat(path)
      if (!info.isFile()) continue
      files.push({ path, size: info.size, time: info.mtimeMs })
      total += info.size
    } catch {
      // Arquivo saiu no meio do caminho; segue.
    }
  }

  if (total <= MAX_CACHE_BYTES) return

  files.sort((a, b) => a.time - b.time)
  for (const file of files) {
    if (total <= MAX_CACHE_BYTES * PRUNE_TARGET) break
    try {
      await unlink(file.path)
      total -= file.size
    } catch {
      // Em uso por outra janela; tenta o próximo.
    }
  }
}

/** Quanto o cache ocupa em disco, em bytes (tela de Configurações). */
export async function assetCacheSize(): Promise<number> {
  try {
    const directory = await ensureDirectory()
    let total = 0
    for (const name of await readdir(directory)) {
      try {
        const info = await stat(join(directory, name))
        if (info.isFile()) total += info.size
      } catch {
        // Saiu no meio do caminho.
      }
    }
    return total
  } catch {
    return 0
  }
}

/**
 * Apaga todas as imagens guardadas. Nada se perde: elas são baixadas de novo do Storage na
 * próxima vez que aparecerem. Devolve quantos bytes foram liberados.
 */
export async function clearAssetCache(): Promise<number> {
  let freed = 0
  try {
    const directory = await ensureDirectory()
    for (const name of await readdir(directory)) {
      try {
        const path = join(directory, name)
        const info = await stat(path)
        if (!info.isFile()) continue
        await unlink(path)
        freed += info.size
      } catch {
        // Em uso por outra janela; fica para a próxima limpeza.
      }
    }
  } catch (error) {
    console.warn('Não consegui limpar o cache de imagens:', error)
  }
  return freed
}
