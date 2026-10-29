import type { Size, SourceRect } from './crop'

/**
 * Preparação de imagens para o Storage (seção 10.2): só imagens, no máximo 15 MB antes da
 * compressão, sempre convertidas para WebP no cliente e nomeadas pelo hash do conteúdo.
 */

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

/** Lado do avatar salvo. Aparece no máximo a ~96 px; 256 cobre tela de alta densidade. */
export const AVATAR_SIZE = 256

/** Maior lado de um mapa (6.1). Acima disso, a imagem é reduzida antes de subir. */
export const MAX_MAP_SIDE = 4096

/** Maior lado da imagem de um token. Ela nunca é desenhada grande. */
export const MAX_TOKEN_SIDE = 512

const WEBP_QUALITY = 0.9

export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!file.type.startsWith('image/')) return 'Escolha um arquivo de imagem (PNG, JPG, WebP…).'
  if (file.size > MAX_UPLOAD_BYTES) return 'A imagem passa de 15 MB. Escolha uma menor.'
  return null
}

/** SHA-256 do conteúdo, em hex: vira o nome do arquivo e evita duplicatas no Storage. */
export async function sha256Hex(data: Blob): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await data.arrayBuffer())
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Abre o arquivo escolhido como imagem. Quem chama libera a URL com `release`. */
export function loadImageFile(
  file: Blob
): Promise<{ image: HTMLImageElement; url: string; release: () => void }> {
  const url = URL.createObjectURL(file)
  const release = (): void => URL.revokeObjectURL(url)

  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ image, url, release })
    image.onerror = () => {
      release()
      reject(new Error('Não consegui abrir essa imagem.'))
    }
    image.src = url
  })
}

/** Desenha o pedaço recortado num quadrado e exporta em WebP. */
export function renderCropToWebp(
  image: CanvasImageSource,
  rect: SourceRect,
  size: number = AVATAR_SIZE
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')
  if (context === null) return Promise.reject(new Error('Sem suporte a canvas.'))

  context.imageSmoothingQuality = 'high'
  context.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, size, size)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // O Chromium sempre gera WebP; o teste do tipo pega um navegador que não gerasse.
        if (blob === null || blob.type !== 'image/webp') {
          reject(new Error('Não consegui converter a imagem para WebP.'))
        } else {
          resolve(blob)
        }
      },
      'image/webp',
      WEBP_QUALITY
    )
  })
}

/** Quanto a imagem precisa encolher para o maior lado caber em `maxSide`. */
export function scaleToFit(image: Size, maxSide: number): number {
  const longest = Math.max(image.width, image.height)
  if (longest <= 0 || maxSide <= 0) return 1
  return Math.min(1, maxSide / longest)
}

export interface PreparedImage {
  blob: Blob
  /** SHA-256 do conteúdo convertido: vira o nome do arquivo no Storage (10.2). */
  hash: string
  width: number
  height: number
}

/** Redesenha a imagem inteira num canvas e exporta em WebP. */
function renderScaledToWebp(image: CanvasImageSource, size: Size): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(size.width))
  canvas.height = Math.max(1, Math.round(size.height))

  const context = canvas.getContext('2d')
  if (context === null) return Promise.reject(new Error('Sem suporte a canvas.'))

  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null || blob.type !== 'image/webp') {
          reject(new Error('Não consegui converter a imagem para WebP.'))
        } else {
          resolve(blob)
        }
      },
      'image/webp',
      WEBP_QUALITY
    )
  })
}

/**
 * Prepara a imagem escolhida para o Storage (10.2): converte para WebP, limita o maior
 * lado e devolve o hash do conteúdo, que é o nome do arquivo.
 *
 * O tamanho que volta é o da imagem **convertida** — é ele que vira o tamanho lógico do
 * mapa, então precisa ser o do arquivo que realmente subiu.
 */
export async function prepareImageForUpload(file: Blob, maxSide: number): Promise<PreparedImage> {
  const { image, release } = await loadImageFile(file)
  try {
    const source = { width: image.naturalWidth, height: image.naturalHeight }
    const scale = scaleToFit(source, maxSide)
    const size = {
      width: Math.max(1, Math.round(source.width * scale)),
      height: Math.max(1, Math.round(source.height * scale))
    }

    const blob = await renderScaledToWebp(image, size)
    return { blob, hash: await sha256Hex(blob), width: size.width, height: size.height }
  } finally {
    release()
  }
}
