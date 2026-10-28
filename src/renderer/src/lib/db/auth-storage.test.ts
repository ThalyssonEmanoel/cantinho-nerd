import { describe, expect, it } from 'vitest'
import { createRememberStorage, type KeyValueStorage } from './auth-storage'

function memory(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    }
  }
}

const SESSION_KEY = 'sb-projeto-auth-token'

describe('continuar conectado', () => {
  it('lembra por padrão: a sessão vai para o armazenamento que sobrevive ao fechar', () => {
    const persistent = memory()
    const temporary = memory()
    const { storage, remembers } = createRememberStorage(persistent, temporary)

    expect(remembers()).toBe(true)
    storage.setItem(SESSION_KEY, 'sessao')
    expect(persistent.data.get(SESSION_KEY)).toBe('sessao')
    expect(temporary.data.has(SESSION_KEY)).toBe(false)
  })

  it('desmarcado: a sessão fica só no armazenamento temporário', () => {
    const persistent = memory()
    const temporary = memory()
    const { storage, setRemember } = createRememberStorage(persistent, temporary)

    setRemember(false)
    storage.setItem(SESSION_KEY, 'sessao')
    expect(temporary.data.get(SESSION_KEY)).toBe('sessao')
    expect(persistent.data.has(SESSION_KEY)).toBe(false)
    expect(storage.getItem(SESSION_KEY)).toBe('sessao')
  })

  it('trocar a escolha não deixa cópia velha do outro lado', () => {
    const persistent = memory()
    const temporary = memory()
    const { storage, setRemember } = createRememberStorage(persistent, temporary)

    storage.setItem(SESSION_KEY, 'antiga')
    setRemember(false)
    // Renovação do token depois da troca: a cópia persistente precisa sumir.
    storage.setItem(SESSION_KEY, 'nova')
    expect(persistent.data.has(SESSION_KEY)).toBe(false)
    expect(storage.getItem(SESSION_KEY)).toBe('nova')
  })

  it('sair apaga dos dois lados', () => {
    const persistent = memory()
    const temporary = memory()
    const { storage } = createRememberStorage(persistent, temporary)

    persistent.data.set(SESSION_KEY, 'a')
    temporary.data.set(SESSION_KEY, 'b')
    storage.removeItem(SESSION_KEY)
    expect(storage.getItem(SESSION_KEY)).toBeNull()
  })

  it('armazenamento bloqueado não derruba nada', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
      removeItem: () => {
        throw new Error('bloqueado')
      }
    }
    const { storage, remembers, setRemember } = createRememberStorage(broken, broken)

    expect(remembers()).toBe(true)
    expect(() => setRemember(false)).not.toThrow()
    expect(() => storage.setItem(SESSION_KEY, 'x')).not.toThrow()
    expect(storage.getItem(SESSION_KEY)).toBeNull()
  })
})
