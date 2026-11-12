import { useState } from 'react'
import { Info, Loader2, RefreshCw, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { AppInfo } from '@shared/ipc'
import { canCheckForUpdate, describeUpdate } from '@shared/update'
import { useUpdateStatus } from './use-update-status'

/**
 * Versão e atualização, na tela de Configurações (decisão 82): o estado de agora, o botão de
 * procurar e, com a versão baixada, o de reiniciar.
 */
export function UpdateSection({ info }: { info: AppInfo | null }): React.JSX.Element {
  const status = useUpdateStatus()
  const [asking, setAsking] = useState(false)

  async function check(): Promise<void> {
    setAsking(true)
    try {
      // O resultado também chega pelo aviso do processo principal; aqui é só esperar.
      await window.api.checkForUpdate()
    } catch {
      toast.error('Não consegui procurar atualização agora.')
    } finally {
      setAsking(false)
    }
  }

  async function install(): Promise<void> {
    const started = await window.api.installUpdate().catch(() => false)
    if (!started) toast.error('Não há versão baixada para instalar.')
  }

  const busy = asking || status?.state === 'checking'

  return (
    <Card>
      <CardContent className="space-y-3">
        <h2 className="flex items-center gap-2 font-medium">
          <Info className="text-muted-foreground size-4" />
          Versão e atualizações
        </h2>
        <p className="text-sm">
          Cantinho Nerd {info === null ? '' : `versão ${info.version}`}
          {info !== null && info.profile !== 'default' && (
            <span className="text-muted-foreground"> · perfil {info.profile}</span>
          )}
        </p>

        <p className="text-sm" role="status">
          {status === null ? 'Conferindo a atualização…' : describeUpdate(status)}
        </p>

        {status?.state === 'downloading' && (
          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full transition-[width]"
              style={{ width: `${status.percent}%` }}
            />
          </div>
        )}

        {status?.state === 'ready' ? (
          <Button onClick={() => void install()}>
            <RotateCw className="size-4" />
            Reiniciar e atualizar
          </Button>
        ) : (
          status !== null &&
          status.state !== 'disabled' && (
            <Button
              variant="outline"
              disabled={busy || !canCheckForUpdate(status)}
              onClick={() => void check()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Procurar atualização
            </Button>
          )
        )}

        <p className="text-muted-foreground text-xs">
          O app procura versão nova ao abrir e a cada 4 horas, baixa sozinho e instala quando você
          fechar. Ele nunca reinicia sozinho no meio de uma sessão. Contas, mesas e fichas ficam no
          servidor e não se perdem na atualização.
        </p>
      </CardContent>
    </Card>
  )
}
