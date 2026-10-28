/**
 * Deep link do app: `rpgmesa://join/<inviteId>`.
 *
 * Fica em `shared/` porque os dois lados precisam dele: o processo principal recebe o
 * link do Windows (argv ou evento `open-url`) e o renderer traduz para a rota `/join/:inviteId`.
 * É lógica pura, sem Electron, para poder ser testada com Vitest.
 */

const PROTOCOL = 'rpgmesa:'

/**
 * O id de convite é gerado pelo servidor; aceitamos apenas o formato esperado para não
 * repassar texto arbitrário vindo de fora do app para dentro da rota.
 */
const INVITE_ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/

export interface JoinDeepLink {
  kind: 'join'
  inviteId: string
}

export type DeepLink = JoinDeepLink

export function parseDeepLink(raw: string): DeepLink | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }

  if (url.protocol !== PROTOCOL) return null

  // Em `rpgmesa://join/abc` o "join" vira host e o id vira caminho; em `rpgmesa:join/abc`
  // tudo cai no caminho. Normalizamos os dois casos numa lista de segmentos.
  const segments = [url.hostname, ...url.pathname.split('/')].filter((segment) => segment !== '')
  const [action, inviteId] = segments
  if (action?.toLowerCase() !== 'join' || inviteId === undefined) return null

  let decoded: string
  try {
    decoded = decodeURIComponent(inviteId)
  } catch {
    return null
  }

  if (!INVITE_ID_PATTERN.test(decoded)) return null

  return { kind: 'join', inviteId: decoded }
}

/**
 * No Windows o link chega como um argumento da linha de comando, misturado com as flags
 * do Chromium, então procuramos o primeiro argumento que seja um deep link válido.
 */
export function findDeepLinkInArgv(argv: readonly string[]): DeepLink | null {
  for (const arg of argv) {
    const link = parseDeepLink(arg)
    if (link) return link
  }
  return null
}

export function buildJoinDeepLink(inviteId: string): string {
  return `rpgmesa://join/${encodeURIComponent(inviteId)}`
}

/**
 * Lê o que o jogador colou no lobby: o deep link, o link do site
 * (`https://<site>/join?id=<inviteId>`, que será o formato do convite na Fase 12) ou o id
 * puro. Devolve null quando não dá para extrair um id válido.
 */
export function extractInviteId(raw: string): string | null {
  const text = raw.trim()
  if (text === '') return null

  const deepLink = parseDeepLink(text)
  if (deepLink !== null) return deepLink.inviteId

  try {
    const url = new URL(text)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const id = url.searchParams.get('id')
      return id !== null && INVITE_ID_PATTERN.test(id) ? id : null
    }
  } catch {
    // Não é URL: provavelmente é o id colado direto, tratado abaixo.
  }

  return INVITE_ID_PATTERN.test(text) ? text : null
}
