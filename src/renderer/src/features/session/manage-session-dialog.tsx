import { useEffect, useState } from 'react'
import { Copy, Dices, Eye, EyeOff, RefreshCw, UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { UserAvatar } from '@/components/user-avatar'
import { errorMessage } from '@/lib/db/errors'
import {
  fetchSessionPassword,
  regenerateInvite,
  removeMember,
  renameSession,
  setSessionPassword,
  setSessionTemplate,
  type SessionDetail,
  type SessionMember
} from '@/lib/db/sessions'
import {
  generateFriendlyPassword,
  validateSessionName,
  validateSessionPassword
} from '@/lib/session/invite'
import type { SheetTemplateSummary } from '@/lib/sheet'
import { templateRepository } from '@/features/sheet-templates/repository'
import { copyInvite } from './copy-invite'
import { useSessionStore } from './session-store'

interface ManageSessionDialogProps {
  open: boolean
  session: SessionDetail
  onClose: () => void
}

/**
 * O que o mestre muda na sessão (4.3): convite novo, senha, sistema, nome e jogadores.
 * Excluir a sessão fica no lobby, longe do dia a dia da mesa.
 */
export function ManageSessionDialog({
  open,
  session,
  onClose
}: ManageSessionDialogProps): React.JSX.Element {
  const [password, setPassword] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [name, setName] = useState(session.name)
  const [templates, setTemplates] = useState<SheetTemplateSummary[]>([])
  const [confirmInvite, setConfirmInvite] = useState(false)
  const [removing, setRemoving] = useState<SessionMember | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let active = true
    void fetchSessionPassword(session.id).then(
      (value) => {
        if (active) setPassword(value)
      },
      (error: unknown) => {
        if (active) toast.error('Não consegui ler a senha', { description: errorMessage(error) })
      }
    )
    void templateRepository.list().then(
      (list) => {
        if (active) {
          setTemplates(
            list.filter((item) => item.kind === 'character' && item.publishedVersion !== null)
          )
        }
      },
      () => {}
    )
    return () => {
      active = false
    }
  }, [open, session.id])

  async function run(action: () => Promise<void>, success: string): Promise<void> {
    setBusy(true)
    try {
      await action()
      await useSessionStore.getState().reload()
      toast.success(success)
    } catch (error) {
      toast.error('Não deu certo', { description: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const passwordError = newPassword === '' ? null : validateSessionPassword(newPassword)
  const nameError = validateSessionName(name)
  const players = session.members.filter((member) => member.role === 'player')

  return (
    <>
      <Dialog
        open={open}
        title="Gerenciar a sessão"
        description={session.name}
        onClose={onClose}
        className="max-w-xl"
        footer={<Button onClick={onClose}>Fechar</Button>}
      >
        <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
          <Section title="Convite">
            <div className="flex flex-wrap items-center gap-2">
              <code className="bg-muted rounded px-2 py-1 font-mono text-sm">
                {session.inviteId}
              </code>
              <Button variant="outline" size="sm" onClick={() => void copyInvite(session)}>
                <Copy className="size-4" />
                Copiar convite
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setConfirmInvite(true)}
              >
                <RefreshCw className="size-4" />
                Gerar novo convite
              </Button>
            </div>
          </Section>

          <Section title="Senha">
            <div className="flex items-center gap-2">
              <code className="bg-muted min-w-32 rounded px-2 py-1 font-mono text-sm">
                {password === null ? '…' : showPassword ? password : '•'.repeat(password.length)}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Esconder a senha' : 'Mostrar a senha'}
                title={showPassword ? 'Esconder' : 'Mostrar'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Senha nova"
                value={newPassword}
                aria-label="Senha nova"
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setNewPassword(generateFriendlyPassword())}
                aria-label="Sugerir uma senha"
                title="Sugerir uma senha"
              >
                <Dices className="size-4" />
              </Button>
              <Button
                variant="outline"
                disabled={busy || newPassword === '' || passwordError !== null}
                onClick={() =>
                  void run(async () => {
                    await setSessionPassword(session.id, newPassword)
                    setPassword(newPassword)
                    setNewPassword('')
                  }, 'Senha trocada')
                }
              >
                Trocar
              </Button>
            </div>
            {passwordError !== null && <p className="text-destructive text-xs">{passwordError}</p>}
            <p className="text-muted-foreground text-xs">
              Não use uma senha pessoal: ela vai no convite e você consegue vê-la aqui.
            </p>
          </Section>

          <Section title="Sistema">
            <Select
              value={session.characterTemplateId ?? ''}
              disabled={busy}
              aria-label="Sistema da sessão"
              onChange={(event) =>
                void run(
                  () =>
                    setSessionTemplate(
                      session.id,
                      event.target.value === '' ? null : event.target.value
                    ),
                  'Sistema trocado'
                )
              }
            >
              <option value="">Escolher depois</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} (v{template.publishedVersion})
                </option>
              ))}
            </Select>
            <p className="text-muted-foreground text-xs">
              Os personagens novos usam a última versão publicada deste modelo. As fichas que já
              existem continuam no modelo em que nasceram.
            </p>
          </Section>

          <Section title="Nome">
            <div className="flex gap-2">
              <Input
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
              />
              <Button
                variant="outline"
                disabled={busy || nameError !== null || name.trim() === session.name}
                onClick={() => void run(() => renameSession(session.id, name), 'Nome trocado')}
              >
                Salvar
              </Button>
            </div>
          </Section>

          <Section title={`Jogadores (${players.length})`}>
            {players.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Ninguém entrou ainda. Copie o convite e mande para a galera.
              </p>
            )}
            <ul className="divide-y rounded-md border">
              {players.map((member) => (
                <li key={member.userId} className="flex items-center gap-2 px-3 py-2">
                  <UserAvatar
                    displayName={member.displayName}
                    avatarPath={member.avatarPath}
                    className="size-7 text-xs"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {member.displayName}{' '}
                    <span className="text-muted-foreground">@{member.username}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setRemoving(member)}
                  >
                    <UserMinus className="size-4" />
                    Remover
                  </Button>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </Dialog>

      <Dialog
        open={confirmInvite}
        title="Gerar um convite novo?"
        description="O link e o código antigos param de funcionar na hora. Quem já está na mesa continua."
        onClose={() => setConfirmInvite(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmInvite(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setConfirmInvite(false)
                void run(async () => {
                  await regenerateInvite(session.id)
                }, 'Convite novo gerado')
              }}
            >
              Gerar
            </Button>
          </>
        }
      />

      <Dialog
        open={removing !== null}
        title={`Remover ${removing?.displayName ?? ''} da mesa?`}
        description="A ficha dele continua guardada com você. Ele pode voltar com o convite e a senha."
        onClose={() => setRemoving(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const member = removing
                setRemoving(null)
                if (member !== null) {
                  void run(() => removeMember(session.id, member.userId), 'Jogador removido')
                }
              }}
            >
              Remover
            </Button>
          </>
        }
      />
    </>
  )
}

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="space-y-2">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}
