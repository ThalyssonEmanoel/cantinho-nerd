/**
 * Content-Security-Policy do app (seção 10.4 da especificação).
 *
 * Função pura para poder ser testada: o processo principal só a chama e devolve o
 * resultado no cabeçalho de toda resposta. A ideia é liberar o próprio app, o domínio do
 * Supabase (https e wss) e imagens em blob/data — nada além disso.
 */

export interface CspOptions {
  isDev: boolean
  /** Vem do .env (VITE_SUPABASE_URL); vazio antes da Fase 4. */
  supabaseUrl?: string
  /** URL do servidor do Vite em dev (ELECTRON_RENDERER_URL). */
  devOrigin?: string
}

function supabaseSources(supabaseUrl?: string): { https: string[]; wss: string[] } {
  if (supabaseUrl === undefined || supabaseUrl === '') return { https: [], wss: [] }
  try {
    const url = new URL(supabaseUrl)
    return { https: [url.origin], wss: [`wss://${url.host}`] }
  } catch {
    return { https: [], wss: [] }
  }
}

/** Em dev o renderer vem do servidor do Vite e o HMR fala por WebSocket. */
function devServerSources(devOrigin?: string): string[] {
  if (devOrigin === undefined || devOrigin === '') return ['http://localhost:*', 'ws://localhost:*']
  try {
    const url = new URL(devOrigin)
    return [url.origin, `ws://${url.host}`]
  } catch {
    return ['http://localhost:*', 'ws://localhost:*']
  }
}

export function buildContentSecurityPolicy({ isDev, supabaseUrl, devOrigin }: CspOptions): string {
  const supabase = supabaseSources(supabaseUrl)
  const devServer = isDev ? devServerSources(devOrigin) : []

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // Em dev o React Refresh precisa de eval; em produção, nenhum script fora do bundle.
    'script-src': isDev ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] : ["'self'"],
    // 'unsafe-inline' só para CSS: o Vite (dev) e bibliotecas como react-grid-layout e
    // konva injetam <style> em tempo de execução. Isso não libera script.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', ...supabase.https],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...supabase.https, ...supabase.wss, ...devServer],
    'media-src': ["'self'", 'blob:'],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'frame-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'none'"]
  }

  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ')
}
