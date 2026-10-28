import { Dices, MessageSquare, ScrollText, Swords, Users } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { PhaseNotice } from '@/components/phase-notice'
import { Badge } from '@/components/ui/badge'

const panels = [
  { icon: Dices, label: 'Dados' },
  { icon: MessageSquare, label: 'Chat' },
  { icon: Swords, label: 'Combate' },
  { icon: ScrollText, label: 'Fichas' },
  { icon: Users, label: 'Jogadores' }
]

/** Casca da sessão: tabuleiro no centro e painéis à direita (seções 6 e 7). */
export function SessionPage(): React.JSX.Element {
  const { sessionId } = useParams<{ sessionId: string }>()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <span className="text-sm font-medium">Sessão</span>
        <code className="bg-muted rounded px-1 text-xs">{sessionId}</code>
        <Badge variant="secondary" className="ml-auto">
          offline
        </Badge>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_18rem] divide-x">
        <div className="bg-muted/20 relative overflow-hidden p-4">
          <div className="text-muted-foreground flex h-full items-center justify-center rounded-lg border border-dashed text-sm">
            Tabuleiro (Konva) — mapas, tokens, grade, névoa, desenho
          </div>
        </div>

        <aside className="flex flex-col divide-y overflow-auto">
          {panels.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 px-3 py-2.5 text-sm">
              <Icon className="text-muted-foreground size-4" />
              {label}
            </div>
          ))}
          <div className="p-3">
            <PhaseNotice
              phase="Fase 6"
              title="Tabuleiro"
              items={[
                'Mapas por sessão, com ativação e preparação sem ativar',
                'Câmera por mapa: zoom no cursor, mãozinha e caber na tela',
                'Coordenadas compartilhadas: todos veem a mesma posição',
                'Tokens com barras vindas da ficha pelos papéis'
              ]}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
