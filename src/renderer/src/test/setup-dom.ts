/**
 * Preparação do ambiente jsdom para os testes de montagem.
 *
 * O jsdom não implementa ResizeObserver nem matchMedia, e a grade do construtor usa o
 * primeiro para medir a largura do container. Sem os dois, a montagem quebraria por motivo
 * de ambiente, e não por bug nosso.
 */

// Sem isto o React avisa, a cada montagem, que o ambiente não suporta `act(...)`.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}

if (typeof globalThis.matchMedia !== 'function') {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof globalThis.matchMedia
}

// A ponte do preload não existe num teste: as telas que a usam recebem um dublê.
if (!('api' in globalThis)) {
  Object.defineProperty(globalThis, 'api', {
    value: {
      getAppInfo: async () => ({ version: '0.0.0-test', profile: 'test', platform: 'test' }),
      openExternal: async () => true,
      takePendingDeepLink: async () => null,
      saveTextFile: async () => ({ status: 'canceled' as const }),
      openTextFile: async () => ({ status: 'canceled' as const }),
      onDeepLink: () => () => {}
    },
    writable: true
  })
}

/**
 * O jsdom não tem canvas de verdade: `getContext('2d')` devolve null, e o Konva recusa
 * subir sem contexto. Este dublê aceita qualquer chamada de desenho sem fazer nada — o que
 * se quer dos testes de montagem é saber que a árvore do tabuleiro monta, não conferir
 * pixel.
 */
function fakeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const values: Record<string, unknown> = {}

  const target = {
    canvas,
    measureText: () => ({ width: 0 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    createImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => null,
    getLineDash: () => [],
    isPointInPath: () => false
  }

  return new Proxy(target, {
    get: (object, property) => {
      if (property in object) return object[property as keyof typeof object]
      if (property in values) return values[property as string]
      // Qualquer outro método de desenho é um no-op.
      return () => undefined
    },
    set: (_object, property, value) => {
      values[property as string] = value
      return true
    }
  }) as unknown as CanvasRenderingContext2D
}

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function getContext(
    this: HTMLCanvasElement
  ): CanvasRenderingContext2D {
    return fakeContext(this)
  } as unknown as typeof HTMLCanvasElement.prototype.getContext

  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,'
}
