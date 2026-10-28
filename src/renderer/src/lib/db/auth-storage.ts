/**
 * Onde a sessão de login fica guardada — é isto que faz o "continuar conectado" (4.1).
 *
 * Marcado: a sessão vai para o localStorage e sobrevive a fechar o app. Desmarcado: vai
 * para o sessionStorage, que o Electron apaga quando a janela fecha. O cliente do Supabase
 * só conhece a interface de armazenamento; a escolha de qual usar acontece aqui dentro, a
 * cada gravação, então a preferência vale já no próximo login sem recriar o cliente.
 *
 * Os dois armazenamentos são separados por perfil de dados (`dev:p2`), então cada janela de
 * teste tem o próprio login.
 */

export interface KeyValueStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export interface RememberStorage {
  /** O que o supabase-js recebe em `auth.storage`. */
  storage: KeyValueStorage
  /** Grava a escolha antes do login. */
  setRemember: (remember: boolean) => void
  remembers: () => boolean
}

const REMEMBER_KEY = 'cantinho-nerd:auth:remember'

/** Armazenamento bloqueado (modo privado, cota cheia) não pode derrubar o login. */
function attempt<T>(action: () => T, fallback: T): T {
  try {
    return action()
  } catch {
    return fallback
  }
}

export function createRememberStorage(
  persistent: KeyValueStorage,
  temporary: KeyValueStorage
): RememberStorage {
  // O padrão é lembrar: num app de desktop entre amigos, é o que se espera.
  const remembers = (): boolean => attempt(() => persistent.getItem(REMEMBER_KEY) !== '0', true)

  const storage: KeyValueStorage = {
    getItem: (key) =>
      attempt(() => persistent.getItem(key), null) ?? attempt(() => temporary.getItem(key), null),

    setItem: (key, value) => {
      const [target, other] = remembers() ? [persistent, temporary] : [temporary, persistent]
      attempt(() => target.setItem(key, value), undefined)
      // Nunca deixar uma cópia velha no outro lado: ela "ressuscitaria" a sessão.
      attempt(() => other.removeItem(key), undefined)
    },

    removeItem: (key) => {
      attempt(() => persistent.removeItem(key), undefined)
      attempt(() => temporary.removeItem(key), undefined)
    }
  }

  return {
    storage,
    remembers,
    setRemember: (remember) => {
      attempt(() => persistent.setItem(REMEMBER_KEY, remember ? '1' : '0'), undefined)
    }
  }
}

/** Instância do app. Fora do navegador (testes de lógica) cai num armazenamento vazio. */
const noStorage: KeyValueStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
}

export const authStorage: RememberStorage = createRememberStorage(
  typeof localStorage === 'undefined' ? noStorage : localStorage,
  typeof sessionStorage === 'undefined' ? noStorage : sessionStorage
)
