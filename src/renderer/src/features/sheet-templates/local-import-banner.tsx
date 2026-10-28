import { useEffect, useState } from 'react'
import { CloudUpload, HardDrive, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { errorMessage } from '@/lib/db/errors'
import { importTemplateWithVersions } from '@/lib/db/sheet-templates'
import {
  createLocalTemplateRepository,
  planLocalImport,
  relinkLocalSheets,
  removeLocalTemplates,
  type SheetTemplate
} from '@/lib/sheet'

const DISMISSED_KEY = 'cantinho-nerd:local-import:dismissed'

/** Os modelos completos que ainda estão só neste computador. */
async function readLocalTemplates(): Promise<SheetTemplate[]> {
  const local = createLocalTemplateRepository()
  const summaries = await local.list()
  const templates = await Promise.all(summaries.map((summary) => local.get(summary.id)))
  return templates.filter((template): template is SheetTemplate => template !== null)
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

interface LocalImportBannerProps {
  /** Chamado depois que modelos subiram, para a lista da biblioteca recarregar. */
  onImported: () => void
}

/**
 * Oferece enviar para a conta os modelos montados antes das contas existirem (Fases 2 e 3),
 * que ficaram só no armazenamento local desta máquina. Nada é apagado sem subir antes.
 */
export function LocalImportBanner({
  onImported
}: LocalImportBannerProps): React.JSX.Element | null {
  const [templates, setTemplates] = useState<SheetTemplate[]>([])
  const [busy, setBusy] = useState(false)
  const [hidden, setHidden] = useState(wasDismissed)

  useEffect(() => {
    if (hidden) return
    let active = true
    void readLocalTemplates().then((found) => {
      if (active) setTemplates(planLocalImport(found).upload)
    })
    return () => {
      active = false
    }
  }, [hidden])

  if (hidden || templates.length === 0) return null

  async function handleImport(): Promise<void> {
    setBusy(true)
    const idMap = new Map<string, string>()
    let failure: unknown = null

    // Um por vez: se um falhar no meio, os que já subiram não são enviados de novo.
    for (const template of templates) {
      try {
        idMap.set(template.id, await importTemplateWithVersions(template))
      } catch (error) {
        failure = error
        break
      }
    }

    if (idMap.size > 0) {
      relinkLocalSheets(idMap)
      // O exemplo intocado também sai: a conta já tem o dela.
      const all = await readLocalTemplates()
      const plan = planLocalImport(all)
      removeLocalTemplates([...idMap.keys(), ...plan.skip.map((template) => template.id)])
      onImported()
    }

    const remaining = templates.filter((template) => !idMap.has(template.id))
    setTemplates(remaining)
    setBusy(false)

    if (failure !== null) {
      toast.error('Nem todos os modelos subiram', {
        description: `${idMap.size} de ${templates.length} enviados. ${errorMessage(failure)}`
      })
    } else {
      toast.success(
        idMap.size === 1
          ? 'Modelo enviado para a sua conta'
          : `${idMap.size} modelos enviados para a sua conta`,
        { description: 'As fichas deste computador continuam ligadas a eles.' }
      )
    }
  }

  function dismiss(): void {
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Sem armazenamento a oferta volta na próxima vez; não é problema.
    }
    setHidden(true)
  }

  const names = templates.map((template) => template.name)
  const listed =
    names.length <= 3
      ? names.join(', ')
      : `${names.slice(0, 3).join(', ')} e mais ${names.length - 3}`

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="flex flex-wrap items-center gap-3">
        <HardDrive className="text-primary size-5 shrink-0" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">
            {templates.length === 1
              ? 'Há 1 modelo salvo só neste computador'
              : `Há ${templates.length} modelos salvos só neste computador`}
          </p>
          <p className="text-muted-foreground truncate" title={names.join(', ')}>
            De antes das contas: {listed}. Envie para a sua conta para não perdê-los.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={dismiss}
            title="Os modelos continuam guardados neste computador."
          >
            Dispensar
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void handleImport()}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CloudUpload className="size-4" />
            )}
            Enviar para a conta
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
