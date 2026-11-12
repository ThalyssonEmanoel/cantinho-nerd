import { useEffect, useState } from 'react'
import type { UpdateStatus } from '@shared/update'

/**
 * O estado da atualização automática, vindo do processo principal (decisão 78).
 *
 * `null` enquanto a primeira resposta não chega — ou para sempre, se a ponte do preload
 * não tiver as funções (nos testes que não dublam a atualização): a tela abre mesmo assim.
 */
export function useUpdateStatus(): UpdateStatus | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null)

  useEffect(() => {
    const api = window.api
    if (typeof api?.getUpdateStatus !== 'function' || typeof api.onUpdateStatus !== 'function') {
      return
    }

    let active = true
    // Um aviso que chegar antes da resposta da pergunta é mais novo que ela.
    let heard = false

    const stop = api.onUpdateStatus((next) => {
      heard = true
      if (active) setStatus(next)
    })

    api
      .getUpdateStatus()
      .then((first) => {
        if (active && !heard) setStatus(first)
      })
      .catch((error: unknown) => console.warn('Não consegui ler o estado da atualização:', error))

    return () => {
      active = false
      stop()
    }
  }, [])

  return status
}
