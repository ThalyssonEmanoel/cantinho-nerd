import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * Cache em disco das imagens (10.2) e a limpeza pela tela de Configurações. O Electron é
 * dublado: a pasta de dados vira uma pasta temporária.
 */

const paths = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({ app: { getPath: () => paths.userData } }))

const cache = await import('./asset-cache')

beforeAll(async () => {
  paths.userData = await mkdtemp(join(tmpdir(), 'cantinho-cache-'))
})

afterAll(async () => {
  await rm(paths.userData, { recursive: true, force: true })
})

describe('cache de imagens', () => {
  it('guarda, mede e limpa', async () => {
    expect(await cache.writeCachedAsset('abc.webp', new Uint8Array(1000))).toBe(true)
    expect(await cache.writeCachedAsset('def.webp', new Uint8Array(500))).toBe(true)
    expect(await cache.assetCacheSize()).toBe(1500)

    expect(await cache.clearAssetCache()).toBe(1500)
    expect(await cache.assetCacheSize()).toBe(0)
    expect(await cache.readCachedAsset('abc.webp')).toBeNull()
    expect(await readdir(join(paths.userData, 'asset-cache'))).toEqual([])
  })

  it('limpar não sai da pasta do cache', async () => {
    const outside = join(paths.userData, 'importante.txt')
    await writeFile(outside, 'não apague')
    await cache.clearAssetCache()
    expect(await readdir(paths.userData)).toContain('importante.txt')
  })
})
