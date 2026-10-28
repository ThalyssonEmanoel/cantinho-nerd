import type { SourceRect } from './crop'

/**
 * Preparação de imagens para o Storage (seção 10.2): só imagens, no máximo 15 MB antes da
 * compressão, sempre convertidas para WebP no cliente e nomeadas pelo hash do conteúdo.
 */

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

/** Lado do avatar salvo. Aparece no máximo a ~96 px; 256 cobre tela de alta densidade. */
export const AVATAR_SIZE = 256

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
