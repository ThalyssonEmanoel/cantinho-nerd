import type { BoardTool } from './types'

/**
 * Atalhos de teclado da mesa (Fase 13).
 *
 * Função pura de propósito: o teclado é fácil de errar (atalho disparando enquanto a
 * pessoa digita no chat, letra que vira ferramenta com Ctrl apertado) e isso tudo se
 * prova em teste, sem tela. A lista `SHORTCUTS` também é o que a tela de ajuda mostra —
 * uma fonte só, para a ajuda não mentir.
 */

export type ShortcutAction =
  | { kind: 'tool'; tool: BoardTool }
  | { kind: 'zoom'; in: boolean }
  | { kind: 'fit' }
  | { kind: 'delete' }
  | { kind: 'escape' }
  | { kind: 'undo' }
  | { kind: 'chat' }
  | { kind: 'turn' }
  | { kind: 'help' }

export interface ShortcutContext {
  /** O foco está num campo de texto: atalho de letra não vale. */
  typing: boolean
  /** Há uma janela aberta: ela cuida do próprio Esc, e o tabuleiro não reage. */
  modal: boolean
}

/** O que a tela de ajuda mostra, e também de onde sai a tabela de teclas. */
export interface ShortcutHelp {
  keys: string
  what: string
  /** Onde o atalho funciona, para a ajuda deixar claro. */
  where: 'board' | 'session' | 'app'
}

export const SHORTCUTS: readonly ShortcutHelp[] = [
  { keys: 'V', what: 'Selecionar', where: 'board' },
  { keys: 'H', what: 'Mãozinha (arrastar o mapa)', where: 'board' },
  { keys: 'R', what: 'Régua', where: 'board' },
  { keys: 'D', what: 'Desenho', where: 'board' },
  { keys: 'E', what: 'Borracha', where: 'board' },
  { keys: 'Espaço', what: 'Mãozinha enquanto segurar', where: 'board' },
  { keys: '+ / −', what: 'Aproximar e afastar', where: 'board' },
  { keys: 'F', what: 'Caber na tela', where: 'board' },
  { keys: 'Alt + arrastar', what: 'Soltar o token fora da grade', where: 'board' },
  { keys: 'Shift + clique', what: 'Somar à seleção', where: 'board' },
  { keys: 'Del', what: 'Excluir o que está selecionado', where: 'board' },
  { keys: 'Ctrl + Z', what: 'Desfazer meu último traço', where: 'board' },
  { keys: 'Esc', what: 'Limpar a seleção, fechar a janela aberta', where: 'board' },
  { keys: 'Enter', what: 'Escrever no chat', where: 'session' },
  { keys: 'N', what: 'Próximo turno (mestre) ou encerrar o meu', where: 'session' },
  { keys: 'F1 ou ?', what: 'Esta ajuda', where: 'app' }
]

/** Teclas de ferramenta, na ordem da especificação (seção 11, Fase 13). */
const TOOL_KEYS: Record<string, BoardTool> = {
  v: 'select',
  h: 'pan',
  r: 'ruler',
  d: 'draw',
  e: 'erase'
}

/**
 * O campo está com o foco? Atalho de letra não pode roubar o que se digita.
 *
 * Olha os campos do elemento em vez de `instanceof HTMLElement`: assim a função é pura o
 * bastante para rodar nos testes de lógica, que não têm DOM nenhum.
 */
export function isTypingTarget(target: unknown): boolean {
  if (target === null || typeof target !== 'object') return false

  const element = target as { tagName?: unknown; isContentEditable?: unknown }
  if (element.isContentEditable === true) return true

  const tag = typeof element.tagName === 'string' ? element.tagName.toUpperCase() : ''
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * O atalho daquela tecla, ou `null` se aquela combinação não é atalho nenhum.
 *
 * Com uma janela aberta, nada vale: o diálogo cuida do Esc dele, e o tabuleiro atrás não
 * pode reagir ao que se digita na janela.
 */
export function shortcutFor(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>,
  context: ShortcutContext
): ShortcutAction | null {
  if (context.modal) return null

  const key = event.key
  const control = event.ctrlKey || event.metaKey

  // Desfazer é o único atalho com modificador.
  if (control && !event.shiftKey && !event.altKey && key.toLowerCase() === 'z') {
    return context.typing ? null : { kind: 'undo' }
  }
  if (control || event.altKey) return null

  // Esc vale até digitando: é como se sai de um campo.
  if (key === 'Escape') return { kind: 'escape' }
  if (context.typing) return null

  if (key === 'Delete') return { kind: 'delete' }
  if (key === 'Enter') return { kind: 'chat' }
  if (key === 'F1' || key === '?') return { kind: 'help' }
  if (key === '+' || key === '=') return { kind: 'zoom', in: true }
  if (key === '-' || key === '_') return { kind: 'zoom', in: false }

  const lower = key.toLowerCase()
  if (lower === 'f') return { kind: 'fit' }
  if (lower === 'n') return { kind: 'turn' }

  const tool = TOOL_KEYS[lower]
  return tool === undefined ? null : { kind: 'tool', tool }
}
