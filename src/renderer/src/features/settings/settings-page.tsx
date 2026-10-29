import { useEffect, useState } from 'react'
import { Bell, Eraser, HardDrive, Info, Loader2, LogOut, Play, Trash2, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAppInfo } from '@/hooks/use-app-info'
import { useSignOut } from '@/hooks/use-sign-out'
import { confirmationMatches, formatBytes } from '@/lib/account/deletion'
import { playTurnChime, playWhisperChime } from '@/lib/chat/sound'
import { deleteMyAccount, deleteMySessions } from '@/lib/db/account'
import { errorMessage } from '@/lib/db/errors'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'

type Danger = 'sessions' | 'account'

/**
 * Configurações (Fase 12): sons, cache de imagens, versão, sair e — no fim, separado — as
 * duas exclusões da seção 9, cada uma confirmada digitando o nome de usuário.
 */
export function SettingsPage(): React.JSX.Element {
  const info = useAppInfo()
  const { leaving, leave } = useSignOut()
  const userId = useAuthStore((state) => state.userId)
  const username = useAuthStore((state) => state.profile?.username ?? '')
  const whisperSound = useAppStore((state) => state.whisperSound)
  const turnSound = useAppStore((state) => state.turnSound)
  const [cacheBytes, setCacheBytes] = useState<number | null>(null)
  const [clearing, setClearing] = useState(false)
  const [danger, setDanger] = useState<Danger | null>(null)

  useEffect(() => {
    let active = true
    void window.api
      ?.assetCacheSize()
      .then((bytes) => {
        if (active) setCacheBytes(bytes)
      })
      .catch(() => {
        if (active) setCacheBytes(0)
      })
    return () => {
      active = false
    }
  }, [])

  async function clearCache(): Promise<void> {
    setClearing(true)
    try {
      const freed = await window.api.clearAssetCache()
      setCacheBytes(0)
      toast.success(`Cache limpo: ${formatBytes(freed)} liberados`, {
        description: 'As imagens são baixadas de novo quando aparecerem.'
      })
    } catch (error) {
      toast.error('Não consegui limpar o cache', { description: errorMessage(error) })
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <PageHeader title="Configurações" description="Preferências deste computador e da sua conta." />

      <Card>
        <CardContent className="space-y-3">
          <h2 className="flex items-center gap-2 font-medium">
            <Bell className="text-muted-foreground size-4" />
            Sons
          </h2>
          <SoundRow
            label="Sussurro recebido no chat"
            checked={whisperSound}
            onChange={(value) => useAppStore.getState().setWhisperSound(value)}
            onTest={playWhisperChime}
          />
          <SoundRow
            label='"Sua vez!" no combate'
            checked={turnSound}
            onChange={(value) => useAppStore.getState().setTurnSound(value)}
            onTest={playTurnChime}
          />
          <p className="text-muted-foreground text-xs">
            Valem para este computador, não para a conta.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <h2 className="flex items-center gap-2 font-medium">
            <HardDrive className="text-muted-foreground size-4" />
            Imagens guardadas
          </h2>
          <p className="text-muted-foreground text-sm">
            Mapas e tokens ficam guardados neste computador para não serem baixados de novo a
            cada sessão.{' '}
            {cacheBytes === null ? 'Medindo…' : `Hoje ocupam ${formatBytes(cacheBytes)}.`}
          </p>
          <Button
            variant="outline"
            disabled={clearing || cacheBytes === 0}
            onClick={() => void clearCache()}
          >
            {clearing ? <Loader2 className="size-4 animate-spin" /> : <Eraser className="size-4" />}
            Limpar o cache de imagens
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h2 className="flex items-center gap-2 font-medium">
            <Info className="text-muted-foreground size-4" />
            Versão
          </h2>
          <p className="text-sm">
            Cantinho Nerd {info === null ? '' : `versão ${info.version}`}
            {info !== null && info.profile !== 'default' && (
              <span className="text-muted-foreground"> · perfil {info.profile}</span>
            )}
          </p>
          <p className="text-muted-foreground text-sm">
            O app não se atualiza sozinho. Quando chegar um instalador novo, é só instalar por
            cima: contas, mesas e fichas ficam no servidor e não se perdem.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-sm">
            Conectado como <strong>{username === '' ? '…' : username}</strong>.
          </p>
          <Button variant="outline" disabled={leaving} onClick={() => void leave()}>
            {leaving ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            Sair
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardContent className="space-y-4">
          <h2 className="text-destructive font-medium">Excluir dados</h2>
          <div className="flex flex-wrap items-start gap-3">
            <p className="text-muted-foreground min-w-0 flex-1 text-sm">
              <strong className="text-foreground">Excluir todas as minhas sessões.</strong> As
              mesas que você mestra somem para todo mundo, com mapas e fichas. Das mesas em que
              você joga, você sai (a sua ficha fica com o mestre delas).
            </p>
            <Button variant="outline" className="text-destructive" onClick={() => setDanger('sessions')}>
              <Trash2 className="size-4" />
              Excluir minhas sessões
            </Button>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <p className="text-muted-foreground min-w-0 flex-1 text-sm">
              <strong className="text-foreground">Excluir a conta.</strong> Tudo acima, mais os
              seus modelos de ficha, bestiário, galeria, avatar e o login. Não tem como desfazer.
            </p>
            <Button variant="destructive" onClick={() => setDanger('account')}>
              <UserX className="size-4" />
              Excluir a conta
            </Button>
          </div>
        </CardContent>
      </Card>

      {danger !== null && userId !== null && (
        <DangerDialog
          danger={danger}
          username={username}
          onClose={() => setDanger(null)}
          onConfirm={async () => {
            if (danger === 'sessions') {
              const outcome = await deleteMySessions(userId)
              useAppStore.setState({ lastSession: null })
              if (outcome.failed.length > 0) {
                toast.warning('Algumas mesas ficaram', {
                  description: `Tente de novo: ${outcome.failed.join(', ')}.`
                })
              } else {
                toast.success(
                  `${outcome.deleted} mesa(s) excluída(s), e você saiu de ${outcome.left}.`
                )
              }
              setDanger(null)
              return
            }
            await deleteMyAccount(userId)
            toast.success('Sua conta foi excluída.')
            await leave()
          }}
        />
      )}
    </div>
  )
}

function SoundRow({
  label,
  checked,
  onChange,
  onTest
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  onTest: () => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-primary size-4"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        {label}
      </label>
      <Button variant="ghost" size="sm" onClick={onTest} aria-label={`Ouvir: ${label}`}>
        <Play className="size-3.5" />
        Ouvir
      </Button>
    </div>
  )
}

/** Confirmação das exclusões: só libera o botão com o nome de usuário digitado (seção 9). */
function DangerDialog({
  danger,
  username,
  onClose,
  onConfirm
}: {
  danger: Danger
  username: string
  onClose: () => void
  onConfirm: () => Promise<void>
}): React.JSX.Element {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const matches = confirmationMatches(typed, username)

  async function confirm(): Promise<void> {
    setBusy(true)
    try {
      await onConfirm()
    } catch (error) {
      toast.error(
        danger === 'account' ? 'Não consegui excluir a conta' : 'Não consegui excluir as sessões',
        { description: errorMessage(error) }
      )
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      title={danger === 'account' ? 'Excluir a sua conta?' : 'Excluir todas as suas sessões?'}
      description={
        danger === 'account'
          ? 'Some tudo: mesas que você mestra, fichas, modelos, bestiário, galeria e o login. Não tem como desfazer.'
          : 'As mesas que você mestra somem para todo mundo; das outras, você sai. Não tem como desfazer.'
      }
      onClose={() => {
        if (!busy) onClose()
      }}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={!matches || busy} onClick={() => void confirm()}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {danger === 'account' ? 'Excluir a conta' : 'Excluir as sessões'}
          </Button>
        </>
      }
    >
      <label className="block space-y-1.5 text-sm">
        <span>
          Para confirmar, digite o seu nome de usuário: <strong>{username}</strong>
        </span>
        <Input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoFocus
          aria-label="Nome de usuário para confirmar"
          disabled={busy}
        />
      </label>
    </Dialog>
  )
}
