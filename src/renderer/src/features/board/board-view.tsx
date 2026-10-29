import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpToLine,
  CircleDot,
  Crosshair,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Images,
  Loader2,
  Maximize,
  ScrollText,
  Settings2,
  Swords,
  Trash2,
  UserPlus
} from 'lucide-react'
import { toast } from 'sonner'
import { nextZ, toWorld, type BoardToken, type Point, type Reaction } from '@/lib/board'
import { errorMessage } from '@/lib/db/errors'
import { useAuthStore } from '@/stores/auth-store'
import { useSessionStore } from '@/features/session/session-store'
import { addTokensToCombat, removeParticipant } from '@/features/combat/combat-actions'
import { useCombatStore } from '@/features/combat/combat-store'
import { TurnBanner } from '@/features/combat/turn-banner'
import {
  applyTokenPatch,
  focusEveryone,
  placeBlankToken,
  placeGalleryToken,
  placeMyToken,
  removeTokens
} from './board-actions'
import { BoardCanvas } from './board-canvas'
import { BoardMenu, type MenuItem } from './board-menu'
import { BoardToolbar } from './board-toolbar'
import { useBoardStore } from './board-store'
import { ConditionsDialog } from './conditions-dialog'
import { DrawingBar } from './drawing-bar'
import { FogBar } from './fog-bar'
import { sendReaction, undoLastDrawing } from './drawing-actions'
import { GalleryPicker } from './gallery-picker'
import { GridSettingsDialog } from './grid-settings-dialog'
import { ImageLightbox } from './image-lightbox'
import { SelectionBar } from './selection-bar'
import { TokenEditorDialog } from './token-editor-dialog'

/**
 * O tabuleiro montado (seção 6): barra, mapa, menus e as janelas que mexem no token.
 *
 * Esta é a tela que junta as peças; a lógica de cada ação está em `board-actions`, e o
 * estado em `board-store`.
 */
export function BoardView(): React.JSX.Element {
  const navigate = useNavigate()
  const userId = useAuthStore((state) => state.userId)
  const displayName = useAuthStore((state) => state.profile?.displayName ?? '')
  const session = useSessionStore((state) => state.session)
  const sheets = useSessionStore((state) => state.sheets)

  const maps = useBoardStore((state) => state.maps)
  const openMapId = useBoardStore((state) => state.openMapId)
  const activeMapId = useBoardStore((state) => state.activeMapId)
  const tokens = useBoardStore((state) => state.tokens)
  const scale = useBoardStore((state) => state.scale)
  const loading = useBoardStore((state) => state.loading)

  const [editing, setEditing] = useState<BoardToken | null>(null)
  const [conditioning, setConditioning] = useState<BoardToken | null>(null)
  const [lightbox, setLightbox] = useState<BoardToken | null>(null)
  const [gallery, setGallery] = useState(false)
  const [gridOpen, setGridOpen] = useState(false)
  const [menu, setMenu] = useState<{
    at: Point
    items: MenuItem[]
    onReact?: (emoji: Reaction) => void
  } | null>(null)

  const role = session?.role ?? 'player'
  const map = maps.find((item) => item.id === openMapId) ?? null

  // Del apaga o que está selecionado; Esc limpa a seleção; Ctrl+Z desfaz o meu último traço.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName
        if (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        void undoLastDrawing(userId).catch((error: unknown) => {
          toast.error('Não consegui desfazer', { description: errorMessage(error) })
        })
        return
      }

      if (event.key === 'Escape') useBoardStore.getState().clearSelection()
      if (event.key !== 'Delete') return

      const state = useBoardStore.getState()
      const mine = state.tokens.filter(
        (token) =>
          state.selection.includes(token.id) && (role === 'gm' || token.ownerId === userId)
      )
      if (mine.length === 0) return
      void removeTokens(mine).catch((error: unknown) => {
        toast.error('Não consegui excluir', { description: errorMessage(error) })
      })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [role, userId])

  if (loading) {
    return (
      <div className="text-muted-foreground flex size-full items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Abrindo o tabuleiro…
      </div>
    )
  }

  if (map === null) {
    return (
      <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-3 p-6 text-center text-sm">
        <ImageIcon className="size-8 opacity-40" />
        {role === 'gm' ? (
          <p className="max-w-sm">
            Nenhum mapa aberto. Envie uma imagem em <strong>Mapas</strong>, ao lado: o tamanho
            dela vira o tamanho do tabuleiro.
          </p>
        ) : (
          <p className="max-w-sm">O mestre ainda não ativou um mapa.</p>
        )}
      </div>
    )
  }

  /** Centro da minha visão, em coordenadas do mapa: é onde o token novo cai. */
  function viewCenter(): Point {
    const state = useBoardStore.getState()
    const camera = state.cameras[map?.id ?? ''] ?? { x: 0, y: 0, scale: 1 }
    const { viewport } = state
    if (viewport.width === 0 && map !== null) return { x: map.width / 2, y: map.height / 2 }
    return toWorld(camera, { x: viewport.width / 2, y: viewport.height / 2 })
  }

  /** Nome de quem mede, pinga ou reage, pelos membros da mesa. */
  function nameOf(id: string): string {
    return session?.members.find((member) => member.userId === id)?.displayName ?? ''
  }

  const mySheet = sheets.find((sheet) => sheet.ownerId === userId)
  const myToken = tokens.find((token) => token.ownerId === userId && token.kind === 'player')

  async function handlePlaceMyToken(point?: Point): Promise<void> {
    if (map === null) return
    try {
      await placeMyToken({
        map,
        desired: point ?? viewCenter(),
        tokens,
        sheetId: mySheet?.id ?? null,
        name: mySheet?.name === undefined || mySheet.name === '' ? displayName : mySheet.name
      })
      await useBoardStore.getState().reloadTokens()
    } catch (error) {
      toast.error('Não consegui colocar seu token', { description: errorMessage(error) })
    }
  }

  async function handlePlaceBlank(point?: Point): Promise<void> {
    if (map === null) return
    try {
      await placeBlankToken({
        map,
        desired: point ?? viewCenter(),
        tokens,
        kind: 'object',
        name: '',
        hidden: false
      })
      await useBoardStore.getState().reloadTokens()
    } catch (error) {
      toast.error('Não consegui colocar o token', { description: errorMessage(error) })
    }
  }

  function tokenMenuItems(token: BoardToken): MenuItem[] {
    const canEdit = role === 'gm' || token.ownerId === userId
    const items: MenuItem[] = []

    if (token.sheetId !== null && session !== null) {
      items.push({
        label: 'Abrir a ficha',
        icon: <ScrollText className="size-3.5" />,
        onPick: () => void navigate(`/session/${session.id}/sheets/${token.sheetId as string}`)
      })
    }

    if (canEdit) {
      items.push({
        label: 'Propriedades…',
        icon: <Settings2 className="size-3.5" />,
        onPick: () => setEditing(token)
      })
      items.push({
        label: 'Condições…',
        icon: <CircleDot className="size-3.5" />,
        onPick: () => setConditioning(token)
      })
    }

    if (role === 'gm') {
      const entry = useCombatStore.getState().entries.find((item) => item.tokenId === token.id)
      items.push(
        entry === undefined
          ? {
              label: 'Adicionar ao combate',
              icon: <Swords className="size-3.5" />,
              onPick: () => {
                void addTokensToCombat([token.id]).catch((error: unknown) => {
                  toast.error('Não consegui adicionar ao combate', {
                    description: errorMessage(error)
                  })
                })
              }
            }
          : {
              label: 'Tirar do combate',
              icon: <Swords className="size-3.5" />,
              onPick: () => {
                void removeParticipant(entry.id).catch((error: unknown) => {
                  toast.error('Não consegui tirar do combate', { description: errorMessage(error) })
                })
              }
            }
      )
    }

    if (token.imagePath !== null) {
      items.push({
        label: 'Ampliar a imagem',
        icon: <Maximize className="size-3.5" />,
        onPick: () => setLightbox(token)
      })
    }

    if (role === 'gm') {
      items.push({
        label: token.hidden ? 'Revelar' : 'Ocultar',
        icon: token.hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />,
        onPick: () => {
          void applyTokenPatch(token, { hidden: !token.hidden }).catch((error: unknown) => {
            toast.error('Não consegui mudar o token', { description: errorMessage(error) })
          })
        }
      })
    }

    if (canEdit) {
      items.push({
        label: 'Trazer para frente',
        icon: <ArrowUpToLine className="size-3.5" />,
        onPick: () => {
          void applyTokenPatch(token, { z: nextZ(tokens) }).catch((error: unknown) => {
            toast.error('Não consegui trazer para frente', { description: errorMessage(error) })
          })
        }
      })
      items.push({
        label: 'Excluir',
        icon: <Trash2 className="size-3.5" />,
        destructive: true,
        onPick: () => {
          void removeTokens([token]).catch((error: unknown) => {
            toast.error('Não consegui excluir', { description: errorMessage(error) })
          })
        }
      })
    }

    return items
  }

  function boardMenuItems(world: Point): MenuItem[] {
    const items: MenuItem[] = []

    if (role === 'gm') {
      items.push({
        label: 'Focar a câmera de todos aqui',
        icon: <Crosshair className="size-3.5" />,
        onPick: () => {
          focusEveryone(world)
          useBoardStore.getState().focusOn(world)
        }
      })
      items.push({
        label: 'Colocar da galeria aqui',
        icon: <Images className="size-3.5" />,
        onPick: () => setGallery(true)
      })
      items.push({
        label: 'Token vazio aqui',
        icon: <ImageIcon className="size-3.5" />,
        onPick: () => void handlePlaceBlank(world)
      })
    } else if (myToken === undefined) {
      items.push({
        label: 'Colocar meu token aqui',
        icon: <UserPlus className="size-3.5" />,
        onPick: () => void handlePlaceMyToken(world)
      })
    }

    items.push({
      label: 'Caber na tela',
      icon: <Maximize className="size-3.5" />,
      onPick: () => useBoardStore.getState().fit()
    })

    return items
  }

  return (
    <div className="flex size-full min-h-0 flex-col">
      <BoardToolbar
        map={map}
        role={role}
        scale={scale}
        preparing={role === 'gm' && map.id !== activeMapId}
        canPlaceMyToken={myToken === undefined}
        onPlaceMyToken={() => void handlePlaceMyToken()}
        onOpenGallery={() => setGallery(true)}
        onPlaceBlank={() => void handlePlaceBlank()}
        onOpenGrid={() => setGridOpen(true)}
        onFocusEveryone={() => {
          const center = viewCenter()
          focusEveryone(center)
          toast.success('A câmera de todos foi para cá')
        }}
      />
      <DrawingBar role={role} userId={userId} />
      {role === 'gm' && <FogBar map={map} />}

      <div className="relative min-h-0 flex-1">
        <TurnBanner />
        <BoardCanvas
          map={map}
          role={role}
          userId={userId}
          onOpenToken={(token) => {
            if (role === 'gm' || token.ownerId === userId) setEditing(token)
            else setLightbox(token)
          }}
          onTokenMenu={(token, at) =>
            setMenu({
              at,
              items: tokenMenuItems(token),
              onReact:
                userId === null ? undefined : (emoji) => sendReaction(token, userId, emoji)
            })
          }
          onBoardMenu={(world, at) => setMenu({ at, items: boardMenuItems(world) })}
          nameOf={nameOf}
          defaultVisionM={session?.defaultVisionM}
        />
      </div>

      {menu !== null && (
        <BoardMenu
          at={menu.at}
          items={menu.items}
          onReact={menu.onReact}
          onClose={() => setMenu(null)}
        />
      )}

      {editing !== null && (
        <TokenEditorDialog
          key={editing.id}
          token={editing}
          role={role}
          onClose={() => setEditing(null)}
          onOpenSheet={(sheetId) => {
            setEditing(null)
            if (session !== null) void navigate(`/session/${session.id}/sheets/${sheetId}`)
          }}
        />
      )}

      <ImageLightbox
        path={lightbox?.imagePath ?? null}
        title={lightbox?.name ?? ''}
        onClose={() => setLightbox(null)}
      />

      <GalleryPicker
        open={gallery}
        onClose={() => setGallery(false)}
        onPick={async (image, hidden) => {
          await placeGalleryToken({ map, desired: viewCenter(), tokens, image, hidden })
          await useBoardStore.getState().reloadTokens()
        }}
      />

      {gridOpen && (
        <GridSettingsDialog
          open={gridOpen}
          map={map}
          scale={scale}
          onClose={() => setGridOpen(false)}
        />
      )}

      <SelectionBar role={role} userId={userId} />

      {conditioning !== null && (
        <ConditionsDialog
          key={conditioning.id}
          token={conditioning}
          available={session?.conditions ?? []}
          onClose={() => setConditioning(null)}
        />
      )}
    </div>
  )
}
