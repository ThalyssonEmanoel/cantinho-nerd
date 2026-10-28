import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/ipc'

/** Versão, plataforma e perfil de dados, vindos do processo principal pelo preload. */
export function useAppInfo(): AppInfo | null {
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    let active = true

    // Protegido porque é a primeira chamada à ponte do preload: se ela não existir, o app
    // ainda abre (sem a versão no canto) em vez de mostrar uma tela branca.
    try {
      void window.api.getAppInfo().then((value) => {
        if (active) setInfo(value)
      })
    } catch (error) {
      console.error('Ponte do preload indisponível:', error)
    }

    return () => {
      active = false
    }
  }, [])

  return info
}
