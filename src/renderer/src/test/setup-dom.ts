/**
 * Preparação do ambiente jsdom para os testes de montagem.
 *
 * O jsdom não implementa ResizeObserver nem matchMedia, e a grade do construtor usa o
 * primeiro para medir a largura do container. Sem os dois, a montagem quebraria por motivo
 * de ambiente, e não por bug nosso.
 */

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
