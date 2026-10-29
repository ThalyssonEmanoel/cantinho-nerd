/**
 * Links no chat (seção 7.2): o texto é sempre texto puro, e só os endereços http/https
 * viram clique — que abre no navegador padrão, pelo processo principal.
 */

export type TextSegment = { kind: 'text'; text: string } | { kind: 'link'; url: string }

const URL_PATTERN = /https?:\/\/[^\s<>"]+/gi

/** Pontuação colada no fim do link costuma ser da frase: "veja https://x.com." */
const TRAILING = /[.,;:!?)\]}'"]+$/

export function splitLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  let last = 0

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index
    let url = match[0]
    const trailing = TRAILING.exec(url)?.[0] ?? ''
    url = url.slice(0, url.length - trailing.length)
    if (url.length <= 'https://'.length) continue

    if (start > last) segments.push({ kind: 'text', text: text.slice(last, start) })
    segments.push({ kind: 'link', url })
    last = start + url.length
  }

  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) })
  return segments
}
