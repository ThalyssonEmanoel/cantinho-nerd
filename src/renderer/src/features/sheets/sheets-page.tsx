import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Swords, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'
import { errorMessage } from '@/lib/db/errors'
import type { SheetSummaryRow } from '@/lib/sheet'
import { useAuthStore } from '@/stores/auth-store'
import { sheetRepository } from './repository'

/**
 * Fichas (seção 5.7): os personagens de todas as mesas em que a pessoa está — os dela e,
 * nas mesas que mestra, os dos jogadores. Criar personagem é dentro da mesa, porque a
 * ficha nasce do sistema daquela sessão.
 */
export function SheetsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const userId = useAuthStore((state) => state.userId)
  const [sheets, setSheets] = useState<SheetSummaryRow[]>([])
  const [loading, setLoading] = useState(true)

  const apply = useCallback((list: SheetSummaryRow[]) => {
    setSheets(list)
    setLoading(false)
  }, [])

  const fail = useCallback((error: unknown) => {
    setLoading(false)
    toast.error('Não consegui carregar as fichas', { description: errorMessage(error) })
  }, [])

  // O `then` não é enfeite: setState direto no corpo do efeito dispara renderização em
  // cascata, e o lint cobra isso com razão.
  useEffect(() => {
    void sheetRepository.list().then(apply, fail)
  }, [apply, fail])

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <PageHeader
        title="Fichas"
        description="Os personagens das mesas em que você está. Para criar um, entre na mesa."
      />

      {loading && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Carregando…
        </p>
      )}

      {!loading && sheets.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="space-y-3 py-8 text-center">
            <p className="text-muted-foreground text-sm">
              Nenhuma ficha ainda. O personagem é criado dentro de uma mesa, com o sistema que o
              mestre escolheu.
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => void navigate('/player')}>
                <UserRound className="size-4" />
                Entrar numa mesa
              </Button>
              <Button variant="outline" onClick={() => void navigate('/gm')}>
                <Swords className="size-4" />
                Minhas sessões
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {sheets.map((sheet) => (
          <Card key={sheet.id}>
            <CardContent className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() =>
                  void navigate(`/session/${sheet.sessionId ?? ''}/sheets/${sheet.id}`)
                }
              >
                <p className="truncate font-medium">
                  {sheet.name === '' ? 'Personagem sem nome' : sheet.name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {sheet.ownerId === userId ? 'Seu personagem' : sheet.ownerName} ·{' '}
                  {sheet.sessionName} · {sheet.templateName} v{sheet.templateVersion}
                </p>
              </button>

              {sheet.bars.hp !== undefined && (
                <Badge variant="outline">
                  {sheet.bars.hp.current} / {sheet.bars.hp.max}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
