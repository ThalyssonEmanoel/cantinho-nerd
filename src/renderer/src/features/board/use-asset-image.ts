import { useEffect, useState } from 'react'
import { assetUrl } from '@/lib/db/assets'

/**
 * Imagem do Storage pronta para desenhar (mapa, token, galeria).
 *
 * Os elementos ficam num cache por caminho: dez tokens com a mesma imagem compartilham um
 * `HTMLImageElement`, e o Konva desenha o mesmo bitmap em todos — é o que segura o
 * tabuleiro em 60 fps com muitos tokens.
 */

const images = new Map<string, Promise<HTMLImageElement>>()

function loadImage(path: string): Promise<HTMLImageElement> {
  const existing = images.get(path)
  if (existing !== undefined) return existing

  const promise = assetUrl(path).then(
    (url) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('Não consegui abrir a imagem.'))
        image.src = url
      })
  )

  // Falha não fica guardada: voltou a internet, a próxima tentativa funciona.
  images.set(
    path,
    promise.catch((error: unknown) => {
      images.delete(path)
      throw error
    })
  )
  return images.get(path) as Promise<HTMLImageElement>
}

export interface AssetImage {
  image: HTMLImageElement | null
  loading: boolean
  failed: boolean
}

/** O resultado é guardado junto com o caminho dele, e não num `loading` solto: trocar de
 * imagem já devolve "carregando" sem precisar de um `setState` dentro do efeito. */
interface Loaded {
  path: string
  image: HTMLImageElement | null
  failed: boolean
}

export function useAssetImage(path: string | null | undefined): AssetImage {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const wanted = path === null || path === undefined || path === '' ? null : path

  useEffect(() => {
    if (wanted === null) return

    let active = true
    void loadImage(wanted).then(
      (image) => {
        if (active) setLoaded({ path: wanted, image, failed: false })
      },
      () => {
        if (active) setLoaded({ path: wanted, image: null, failed: true })
      }
    )

    return () => {
      active = false
    }
  }, [wanted])

  const current = loaded !== null && loaded.path === wanted ? loaded : null

  return {
    image: current?.image ?? null,
    loading: wanted !== null && current === null,
    failed: current?.failed ?? false
  }
}

/** Esquece a imagem de um caminho (depois de trocar a foto do token, por exemplo). */
export function forgetImage(path: string): void {
  images.delete(path)
}
