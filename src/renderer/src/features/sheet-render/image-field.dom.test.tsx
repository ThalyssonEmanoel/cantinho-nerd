import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SheetRenderOptions } from './types'

/**
 * Campo de imagem da ficha (5.3): o retrato do personagem.
 *
 * Era o buraco que sobrou da Fase 3 ("o envio entra na Fase 6"): o campo nem clicava. O
 * teste cobre o que precisa valer agora — dá para clicar quando é seu, mostra a foto
 * guardada, e continua sendo só moldura onde não há mesa (a prévia do construtor).
 */

/*
  O jsdom não carrega imagem de verdade (um `blob:` nunca dispara `onload`), então o gancho
  que baixa do Storage é dublado: o que está em teste aqui é o campo, não o download.
*/
const asset = vi.hoisted(() => ({
  image: null as { src: string } | null,
  failed: false
}))

vi.mock('@/hooks/use-asset-image', () => ({
  useAssetImage: (path: string | null | undefined) =>
    path === null || path === undefined || path === ''
      ? { image: null, loading: false, failed: false }
      : { image: asset.image, loading: asset.image === null && !asset.failed, failed: asset.failed }
}))

const { ImageField } = await import('./image-field')

let container: HTMLElement
let root: Root

const baseOptions: SheetRenderOptions = { audience: 'player' }

/** Imagem "já carregada", como o gancho entregaria. */
function loaded(src: string): void {
  asset.image = { src }
  asset.failed = false
}

beforeEach(() => {
  asset.image = null
  asset.failed = false
  container = document.createElement('div')
  document.body.append(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

async function render(props: {
  path?: string
  editable?: boolean
  options?: Partial<SheetRenderOptions>
}): Promise<void> {
  root = createRoot(container)
  await act(async () => {
    root.render(
      <ImageField
        componentId="c_retrato"
        shape="circle"
        path={props.path ?? ''}
        editable={props.editable ?? true}
        options={{ ...baseOptions, ...props.options }}
      />
    )
  })
}

function pickButton(): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>('[aria-label="Foto do personagem"]')
}

describe('ImageField', () => {
  it('sem foto e com envio disponível, convida a pôr uma', async () => {
    await render({ options: { uploadImage: vi.fn() } })

    expect(pickButton()?.disabled).toBe(false)
    expect(container.textContent).toContain('pôr uma foto')
  })

  it('o campo abre o seletor de arquivo ao clicar', async () => {
    const click = vi.fn()
    await render({ options: { uploadImage: vi.fn() } })

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    input.click = click

    await act(async () => pickButton()?.click())
    expect(click).toHaveBeenCalled()
  })

  it('com foto, mostra a imagem guardada', async () => {
    loaded('blob:abc.webp')
    await render({ path: 'sessions/mesa/portraits/abc.webp', options: { uploadImage: vi.fn() } })

    const image = container.querySelector('img')
    expect(image).not.toBeNull()
    expect(image?.src).toContain('abc.webp')
    // Com foto, o convite sai de cena.
    expect(container.textContent).not.toContain('pôr uma foto')
  })

  it('tirar a foto limpa o valor do campo', async () => {
    const onChange = vi.fn()
    loaded('blob:abc.webp')
    await render({
      path: 'sessions/mesa/portraits/abc.webp',
      options: { uploadImage: vi.fn(), onChange }
    })

    const remove = container.querySelector<HTMLButtonElement>('[aria-label="Tirar a foto"]')
    await act(async () => remove?.click())

    expect(onChange).toHaveBeenCalledWith('c_retrato', '')
  })

  it('sem onde guardar (prévia do construtor), é só moldura', async () => {
    await render({ options: {} })

    expect(pickButton()?.disabled).toBe(true)
    expect(container.textContent).not.toContain('pôr uma foto')
    expect(container.querySelector('[aria-label="Tirar a foto"]')).toBeNull()
  })

  it('campo que não é meu não deixa trocar a foto', async () => {
    loaded('blob:abc.webp')
    await render({
      path: 'sessions/mesa/portraits/abc.webp',
      editable: false,
      options: { uploadImage: vi.fn() }
    })

    expect(pickButton()?.disabled).toBe(true)
    expect(container.querySelector('[aria-label="Tirar a foto"]')).toBeNull()
    // Mas a foto continua à vista.
    expect(container.querySelector('img')).not.toBeNull()
  })

  it('escolher um arquivo abre o enquadramento', async () => {
    await render({ options: { uploadImage: vi.fn() } })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['imagem'], 'retrato.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('Enquadrar o retrato')
    expect(dialog?.textContent).toContain('Usar esta foto')
  })

  it('recusa arquivo que não é imagem antes de abrir o enquadramento', async () => {
    await render({ options: { uploadImage: vi.fn() } })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['nada'], 'ficha.pdf', { type: 'application/pdf' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})
