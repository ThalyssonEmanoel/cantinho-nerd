import { useCallback, useRef, useState } from 'react'
import { Camera, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/user-avatar'
import { useAppInfo } from '@/hooks/use-app-info'
import {
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  validateBio,
  validateDisplayName
} from '@/lib/account/credentials'
import { errorMessage } from '@/lib/db/errors'
import {
  fetchProfile,
  removeAvatarFile,
  updateProfile,
  uploadAvatar,
  type Profile
} from '@/lib/db/profiles'
import { sha256Hex, validateImageFile } from '@/lib/image/upload'
import { useAuthStore } from '@/stores/auth-store'
import { AvatarCropper } from './avatar-cropper'

/** Perfil (seção 9): nome de exibição, bio e avatar com recorte circular. */
export function ProfilePage(): React.JSX.Element {
  const info = useAppInfo()
  const profile = useAuthStore((state) => state.profile)
  const userId = useAuthStore((state) => state.userId)
  const profileError = useAuthStore((state) => state.profileError)
  const [retrying, setRetrying] = useState(false)

  async function retry(): Promise<void> {
    if (userId === null) return
    setRetrying(true)
    try {
      const loaded = await fetchProfile(userId)
      if (loaded !== null) useAuthStore.getState().setProfile(loaded)
    } catch (error) {
      toast.error('Ainda não consegui carregar o perfil', { description: errorMessage(error) })
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <PageHeader title="Perfil" description="Como os outros jogadores veem você." />

      {profile === null ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              {profileError ?? 'Seu perfil ainda não carregou.'}
            </p>
            <Button variant="outline" size="sm" disabled={retrying} onClick={() => void retry()}>
              <RefreshCw className="size-4" />
              Tentar de novo
            </Button>
          </CardContent>
        </Card>
      ) : (
        // A `key` recomeça os rascunhos quando o perfil de outra conta entra.
        <ProfileForm key={profile.id} profile={profile} />
      )}

      <Card>
        <CardContent className="text-muted-foreground space-y-1 text-sm">
          <p>Versão: {info?.version ?? '…'}</p>
          <p>Plataforma: {info?.platform ?? '…'}</p>
          <p>Perfil de dados: {info?.profile ?? '…'}</p>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-sm">
        Para excluir as suas sessões ou a conta inteira, vá em{' '}
        <Link to="/settings" className="text-foreground underline underline-offset-2">
          Configurações
        </Link>
        .
      </p>
    </div>
  )
}

function ProfileForm({ profile }: { profile: Profile }): React.JSX.Element {
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [bio, setBio] = useState(profile.bio)
  const [saving, setSaving] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const nameError = validateDisplayName(displayName, { required: true })
  const bioError = validateBio(bio)
  const dirty = displayName.trim() !== profile.displayName || bio !== profile.bio
  const cancelCrop = useCallback(() => setPendingFile(null), [])

  async function save(): Promise<void> {
    if (nameError !== null || bioError !== null) return

    const store = useAuthStore.getState()
    const previous = profile
    // Otimista: o nome novo já aparece no topo; se o banco recusar, volta o antigo.
    store.setProfile({ ...profile, displayName: displayName.trim(), bio })
    setSaving(true)
    try {
      store.setProfile(await updateProfile(profile.id, { displayName, bio }))
      toast.success('Perfil salvo')
    } catch (error) {
      store.setProfile(previous)
      toast.error('Não consegui salvar o perfil', { description: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  function chooseFile(file: File | undefined): void {
    if (file === undefined) return
    const problem = validateImageFile(file)
    if (problem !== null) {
      toast.error('Essa imagem não serve', { description: problem })
      return
    }
    setPendingFile(file)
  }

  async function saveAvatar(image: Blob): Promise<void> {
    const oldPath = profile.avatarPath
    const path = await uploadAvatar(profile.id, image, await sha256Hex(image))
    try {
      useAuthStore.getState().setProfile(await updateProfile(profile.id, { avatarPath: path }))
    } catch (error) {
      // O arquivo subiu mas o perfil não mudou: tira o arquivo para não sobrar lixo.
      if (path !== oldPath) void removeAvatarFile(path)
      throw new Error(errorMessage(error), { cause: error })
    }
    if (oldPath !== null && oldPath !== path) void removeAvatarFile(oldPath)
    setPendingFile(null)
    toast.success('Foto atualizada')
  }

  async function removeAvatar(): Promise<void> {
    const oldPath = profile.avatarPath
    if (oldPath === null) return
    setAvatarBusy(true)
    try {
      useAuthStore.getState().setProfile(await updateProfile(profile.id, { avatarPath: null }))
      void removeAvatarFile(oldPath)
      toast.success('Foto removida')
    } catch (error) {
      toast.error('Não consegui remover a foto', { description: errorMessage(error) })
    } finally {
      setAvatarBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 sm:flex-row">
        <div className="flex flex-col items-center gap-2">
          <UserAvatar
            displayName={profile.displayName}
            avatarPath={profile.avatarPath}
            className="size-24 text-2xl"
          />
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              chooseFile(event.target.files?.[0])
              // Limpa para que escolher o mesmo arquivo de novo dispare a troca outra vez.
              event.target.value = ''
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={avatarBusy}
            onClick={() => fileInput.current?.click()}
          >
            <Camera className="size-4" />
            Trocar foto
          </Button>
          {profile.avatarPath !== null && (
            <Button
              variant="ghost"
              size="sm"
              disabled={avatarBusy}
              onClick={() => void removeAvatar()}
            >
              <Trash2 className="size-4" />
              Remover
            </Button>
          )}
        </div>

        <form
          className="flex-1 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <div className="space-y-1">
            <p className="text-sm font-medium">@{profile.username}</p>
            <p className="text-muted-foreground text-xs">
              O nome de usuário é o seu login e não pode ser trocado.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="display-name">Nome de exibição</Label>
            <Input
              id="display-name"
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              value={displayName}
              aria-invalid={nameError !== null}
              onChange={(event) => setDisplayName(event.target.value)}
            />
            {nameError !== null && <p className="text-destructive text-xs">{nameError}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="bio">Bio</Label>
              <span className="text-muted-foreground text-xs">
                {bio.length}/{BIO_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              id="bio"
              rows={3}
              maxLength={BIO_MAX_LENGTH}
              placeholder="Mestre de terror nas horas vagas, jogador de bardo o resto do tempo."
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
          </div>

          <Button type="submit" disabled={!dirty || saving || nameError !== null}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </form>
      </CardContent>

      <AvatarCropper file={pendingFile} onCancel={cancelCrop} onConfirm={saveAvatar} />
    </Card>
  )
}
