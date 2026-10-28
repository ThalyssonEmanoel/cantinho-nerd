import { describe, expect, it } from 'vitest'
import { canOpenExternally, isInternalNavigation } from './navigation-policy'

describe('canOpenExternally', () => {
  it('libera http e https', () => {
    expect(canOpenExternally('https://exemplo.com/mapa.png')).toBe(true)
    expect(canOpenExternally('http://localhost:5173')).toBe(true)
  })

  it('bloqueia esquemas perigosos ou internos', () => {
    expect(canOpenExternally('file:///C:/Windows/System32/cmd.exe')).toBe(false)
    expect(canOpenExternally('javascript:alert(1)')).toBe(false)
    expect(canOpenExternally('rpgmesa://join/abc123')).toBe(false)
    expect(canOpenExternally('ms-settings:')).toBe(false)
  })

  it('não lança com texto que não é URL', () => {
    expect(canOpenExternally('clique aqui')).toBe(false)
  })
})

describe('isInternalNavigation', () => {
  it('permite o app empacotado (file://)', () => {
    expect(isInternalNavigation('file:///C:/app/resources/renderer/index.html')).toBe(true)
  })

  it('permite o servidor de dev quando ele é informado', () => {
    expect(isInternalNavigation('http://localhost:5173/index.html', 'http://localhost:5173')).toBe(
      true
    )
  })

  it('bloqueia outra origem mesmo em dev', () => {
    expect(isInternalNavigation('https://exemplo.com', 'http://localhost:5173')).toBe(false)
    expect(isInternalNavigation('http://localhost:9999', 'http://localhost:5173')).toBe(false)
  })

  it('bloqueia o servidor de dev quando não estamos em dev', () => {
    expect(isInternalNavigation('http://localhost:5173/index.html')).toBe(false)
  })
})
