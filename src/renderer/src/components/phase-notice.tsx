import { Construction } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface PhaseNoticeProps {
  /** Fase da especificação que vai preencher esta tela (ex.: 'Fase 5'). */
  phase: string
  title: string
  items: string[]
}

/**
 * Placeholder das telas da Fase 0. Em vez de uma tela vazia, mostra o que a especificação
 * promete para aquela área — serve de lembrete do escopo enquanto as fases avançam.
 */
export function PhaseNotice({ phase, title, items }: PhaseNoticeProps): React.JSX.Element {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Construction className="text-primary size-4" />
          {title}
        </CardTitle>
        <CardDescription>Chega na {phase}.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="text-muted-foreground space-y-1.5 text-sm">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-primary/60">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
