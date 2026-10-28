import { Link, useLocation } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'

export function NotFoundPage(): React.JSX.Element {
  const location = useLocation()

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-5xl">🎲</p>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Essa tela não existe</h1>
        <p className="text-muted-foreground text-sm">
          A rota <code className="bg-muted rounded px-1">{location.pathname}</code> não foi
          encontrada.
        </p>
      </div>
      <Link to="/role" className={buttonVariants({ variant: 'outline' })}>
        Voltar ao início
      </Link>
    </div>
  )
}
