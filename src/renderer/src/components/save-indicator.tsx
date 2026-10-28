import { CloudCheck, CloudOff, Loader2 } from 'lucide-react'

/**
 * "Salvando… / Salvo" (5.2 e 5.7). Mesmo indicador no construtor e na ficha, porque a
 * pergunta do usuário é a mesma nos dois lugares: "já deu tempo de salvar?".
 */
export function SaveIndicator({ state }: { state: string }): React.JSX.Element | null {
  if (state === 'saving') {
    return (
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        <Loader2 className="size-3 animate-spin" />
        Salvando…
      </span>
    )
  }
  if (state === 'saved') {
    return (
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        <CloudCheck className="size-3" />
        Salvo
      </span>
    )
  }
  if (state === 'error') {
    return (
      <span className="text-destructive flex items-center gap-1 text-xs">
        <CloudOff className="size-3" />
        Falhou ao salvar
      </span>
    )
  }
  return null
}
