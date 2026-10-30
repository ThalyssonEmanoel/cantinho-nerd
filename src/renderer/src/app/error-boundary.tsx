import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Última rede de proteção da interface (Fase 13).
 *
 * Sem isto, um erro de renderização em qualquer tela deixa a janela **branca** no app
 * empacotado — sem console aberto, sem pista, sem saída. Aqui o erro vira uma tela com o
 * que aconteceu, um botão para recarregar e o texto para copiar e me mandar.
 *
 * É uma classe porque só classe captura erro de renderização no React.
 */
interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
  info: string | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // No app empacotado não há console aberto, mas fica no log do processo se alguém olhar.
    console.error('Erro na interface:', error, info.componentStack)
    this.setState({ info: info.componentStack ?? null })
  }

  private reload = (): void => {
    window.location.reload()
  }

  private copy = (): void => {
    const { error, info } = this.state
    const text = [error?.message ?? '', error?.stack ?? '', info ?? ''].join('\n\n')
    void navigator.clipboard?.writeText(text)
  }

  override render(): ReactNode {
    const { error } = this.state
    if (error === null) return this.props.children

    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold">Algo quebrou nesta tela</h1>
          <p className="text-muted-foreground max-w-md text-sm">
            Nada do que estava salvo se perdeu: as fichas, as mesas e os mapas estão no
            servidor. Recarregar normalmente resolve.
          </p>
        </div>

        <pre className="bg-muted/40 max-h-40 max-w-xl overflow-auto rounded-md border p-3 text-left text-xs">
          {error.message}
        </pre>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={this.reload}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            Recarregar o app
          </button>
          <button
            type="button"
            onClick={this.copy}
            className="hover:bg-accent rounded-md border px-4 py-2 text-sm transition-colors"
          >
            Copiar o erro
          </button>
        </div>
      </div>
    )
  }
}
