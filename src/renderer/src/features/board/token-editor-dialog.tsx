import { useRef, useState } from 'react'
import { Eye, EyeOff, Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  clampTokenSize,
  DEFAULT_TOKEN_CROP,
  TOKEN_KIND_LABELS,
  type BoardToken,
  type TokenBars,
  type TokenCrop
} from '@/lib/board'
import type { TokenPatch } from '@/lib/db/board-rows'
import { errorMessage } from '@/lib/db/errors'
import type { SessionRole } from '@/lib/db/sessions'
import { applyTokenPatch, removeTokens, uploadTokenImage } from './board-actions'
import { TokenCropEditor } from './token-crop-editor'
import { useAssetImage } from './use-asset-image'

interface TokenEditorDialogProps {
  /** Token a editar. O pai monta este componente com `key={token.id}`, então o estado
   * inicial já vem do token certo — sem efeito sincronizando props com estado. */
  token: BoardToken
  role: SessionRole
  onClose: () => void
  /** Abre a ficha ligada ao token (6.3). */
  onOpenSheet: (sheetId: string) => void
}

/**
 * Propriedades de um token (6.3): nome, tamanho, imagem, enquadramento e — só para o
 * mestre — oculto, nome visível, barras visíveis e visão.
 */
export function TokenEditorDialog({
  token,
  role,
  onClose,
  onOpenSheet
}: TokenEditorDialogProps): React.JSX.Element {
  const [name, setName] = useState(token.name)
  const [size, setSize] = useState(String(token.size))
  const [vision, setVision] = useState(token.visionM === null ? '' : String(token.visionM))
  const [crop, setCrop] = useState<TokenCrop>(token.crop)
  const [imagePath, setImagePath] = useState<string | null>(token.imagePath)
  // Token sem ficha tem vida própria, editável aqui (6.3).
  const [hp, setHp] = useState(String(token.bars.hp?.current ?? 0))
  const [hpMax, setHpMax] = useState(String(token.bars.hp?.max ?? 0))
  const [saving, setSaving] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const preview = useAssetImage(imagePath)

  const isGm = role === 'gm'
  /** Com ficha, as barras vêm dela pelos papéis (5.6) e não se editam no token. */
  const ownHp = isGm && token.sheetId === null

  function barsPatch(): TokenBars | undefined {
    if (!ownHp) return undefined
    const max = Math.max(0, Number(hpMax.replace(',', '.')) || 0)
    if (max <= 0) return {}
    return { hp: { current: Math.max(0, Math.min(max, Number(hp.replace(',', '.')) || 0)), max } }
  }

  async function save(extra: TokenPatch = {}): Promise<void> {
    setSaving(true)
    try {
      await applyTokenPatch(token, {
        name,
        size: clampTokenSize(Number(size.replace(',', '.')) || 1),
        crop,
        imagePath,
        ...(isGm
          ? { visionM: vision.trim() === '' ? null : Number(vision.replace(',', '.')) || 0 }
          : {}),
        ...(ownHp ? { bars: barsPatch() } : {}),
        ...extra
      })
      onClose()
    } catch (error) {
      toast.error('Não consegui salvar o token', { description: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  /** Oculto, nome e barras mudam na hora: são interruptores, não formulário. */
  async function toggle(patch: TokenPatch): Promise<void> {
    try {
      await applyTokenPatch(token, patch)
    } catch (error) {
      toast.error('Não consegui mudar o token', { description: errorMessage(error) })
    }
  }

  async function handleFile(file: File | undefined): Promise<void> {
    if (file === undefined || token === null) return
    setSaving(true)
    try {
      const path = await uploadTokenImage(token.sessionId, file)
      setImagePath(path)
      setCrop(DEFAULT_TOKEN_CROP)
    } catch (error) {
      toast.error('Não consegui enviar a imagem', { description: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    try {
      await removeTokens([token])
      onClose()
    } catch (error) {
      toast.error('Não consegui excluir o token', { description: errorMessage(error) })
    }
  }

  return (
    <Dialog
      open
      title={token.name === '' ? 'Token' : token.name}
      description={`${TOKEN_KIND_LABELS[token.kind]} · ${token.size} quadrado(s)`}
      onClose={onClose}
      className="max-w-xl"
      footer={
        <>
          <Button variant="destructive" disabled={saving} onClick={() => void handleDelete()}>
            <Trash2 className="size-4" />
            Excluir
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-[11rem_1fr]">
        <div className="space-y-2">
          {imagePath === null ? (
            <div className="bg-muted/40 text-muted-foreground flex h-44 items-center justify-center rounded-full border border-dashed text-xs">
              sem imagem
            </div>
          ) : (
            <TokenCropEditor imagePath={imagePath} crop={crop} onChange={setCrop} />
          )}

          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={saving}
              onClick={() => fileInput.current?.click()}
            >
              <Upload className="size-3.5" />
              Trocar a foto
            </Button>
            {imagePath !== null && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Tirar a imagem"
                onClick={() => {
                  setImagePath(null)
                  setCrop(DEFAULT_TOKEN_CROP)
                }}
              >
                <ImageIcon className="size-3.5" />
              </Button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              void handleFile(file)
            }}
          />
          {preview.failed && (
            <p className="text-destructive text-xs">A imagem deste token não carregou.</p>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="token-nome">Nome</Label>
            <Input
              id="token-nome"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="token-tamanho">Tamanho (quadrados)</Label>
              <Input
                id="token-tamanho"
                inputMode="decimal"
                value={size}
                onChange={(event) => setSize(event.target.value)}
              />
            </div>
            {isGm && (
              <div className="space-y-1.5">
                <Label htmlFor="token-visao">Visão (metros)</Label>
                <Input
                  id="token-visao"
                  inputMode="decimal"
                  placeholder="da ficha"
                  value={vision}
                  onChange={(event) => setVision(event.target.value)}
                />
              </div>
            )}
          </div>

          {ownHp && (
            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="token-vida">Vida</Label>
                <Input
                  id="token-vida"
                  inputMode="numeric"
                  value={hp}
                  onChange={(event) => setHp(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="token-vida-max">Vida máxima</Label>
                <Input
                  id="token-vida-max"
                  inputMode="numeric"
                  placeholder="0 = sem barra"
                  value={hpMax}
                  onChange={(event) => setHpMax(event.target.value)}
                />
              </div>
            </div>
          )}

          {isGm && (
            <div className="space-y-2 border-t pt-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={token.hidden}
                  onChange={(event) => void toggle({ hidden: event.target.checked })}
                />
                {token.hidden ? (
                  <EyeOff className="text-destructive size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
                Oculto (o jogador nem recebe este token)
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={token.showName}
                  onChange={(event) => void toggle({ showName: event.target.checked })}
                />
                Mostrar o nome aos jogadores
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={token.showBars}
                  onChange={(event) => void toggle({ showBars: event.target.checked })}
                />
                Mostrar as barras aos jogadores
              </label>
            </div>
          )}

          {token.sheetId !== null && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onOpenSheet(token.sheetId as string)}
            >
              Abrir a ficha
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  )
}
