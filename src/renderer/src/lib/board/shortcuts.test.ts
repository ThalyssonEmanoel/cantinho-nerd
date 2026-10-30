import { describe, expect, it } from 'vitest'
import { isTypingTarget, shortcutFor, SHORTCUTS, type ShortcutContext } from './shortcuts'

const free: ShortcutContext = { typing: false, modal: false }

function press(
  key: string,
  modifiers: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>> = {}
): Parameters<typeof shortcutFor>[0] {
  return {
    key,
    ctrlKey: modifiers.ctrlKey ?? false,
    metaKey: modifiers.metaKey ?? false,
    shiftKey: modifiers.shiftKey ?? false,
    altKey: modifiers.altKey ?? false
  }
}

describe('ferramentas', () => {
  it('as letras da especificação escolhem a ferramenta', () => {
    expect(shortcutFor(press('v'), free)).toEqual({ kind: 'tool', tool: 'select' })
    expect(shortcutFor(press('h'), free)).toEqual({ kind: 'tool', tool: 'pan' })
    expect(shortcutFor(press('r'), free)).toEqual({ kind: 'tool', tool: 'ruler' })
    expect(shortcutFor(press('d'), free)).toEqual({ kind: 'tool', tool: 'draw' })
    expect(shortcutFor(press('e'), free)).toEqual({ kind: 'tool', tool: 'erase' })
  })

  it('maiúscula vale igual', () => {
    expect(shortcutFor(press('V'), free)).toEqual({ kind: 'tool', tool: 'select' })
  })

  it('letra que não é atalho não faz nada', () => {
    expect(shortcutFor(press('q'), free)).toBeNull()
  })
})

describe('câmera', () => {
  it('mais e menos aproximam e afastam', () => {
    expect(shortcutFor(press('+'), free)).toEqual({ kind: 'zoom', in: true })
    // Teclado sem numérico: o "+" sai no "=".
    expect(shortcutFor(press('='), free)).toEqual({ kind: 'zoom', in: true })
    expect(shortcutFor(press('-'), free)).toEqual({ kind: 'zoom', in: false })
  })

  it('F cabe na tela', () => {
    expect(shortcutFor(press('f'), free)).toEqual({ kind: 'fit' })
  })
})

describe('mesa', () => {
  it('Enter vai para o chat e N passa o turno', () => {
    expect(shortcutFor(press('Enter'), free)).toEqual({ kind: 'chat' })
    expect(shortcutFor(press('n'), free)).toEqual({ kind: 'turn' })
  })

  it('Del, Esc e Ctrl+Z', () => {
    expect(shortcutFor(press('Delete'), free)).toEqual({ kind: 'delete' })
    expect(shortcutFor(press('Escape'), free)).toEqual({ kind: 'escape' })
    expect(shortcutFor(press('z', { ctrlKey: true }), free)).toEqual({ kind: 'undo' })
    expect(shortcutFor(press('z', { metaKey: true }), free)).toEqual({ kind: 'undo' })
  })

  it('F1 e ? abrem a ajuda', () => {
    expect(shortcutFor(press('F1'), free)).toEqual({ kind: 'help' })
    expect(shortcutFor(press('?', { shiftKey: true }), free)).toEqual({ kind: 'help' })
  })
})

describe('quando o atalho não deve valer', () => {
  const typing: ShortcutContext = { typing: true, modal: false }

  it('digitando, letra é letra', () => {
    expect(shortcutFor(press('v'), typing)).toBeNull()
    expect(shortcutFor(press('Enter'), typing)).toBeNull()
    expect(shortcutFor(press('Delete'), typing)).toBeNull()
    expect(shortcutFor(press('-'), typing)).toBeNull()
  })

  it('digitando, Esc continua valendo (é como se sai do campo)', () => {
    expect(shortcutFor(press('Escape'), typing)).toEqual({ kind: 'escape' })
  })

  it('digitando, Ctrl+Z é do campo, não do tabuleiro', () => {
    expect(shortcutFor(press('z', { ctrlKey: true }), typing)).toBeNull()
  })

  it('com janela aberta, nada vale — nem Esc (o diálogo cuida dele)', () => {
    const modal: ShortcutContext = { typing: false, modal: true }
    expect(shortcutFor(press('v'), modal)).toBeNull()
    expect(shortcutFor(press('Escape'), modal)).toBeNull()
    expect(shortcutFor(press('Delete'), modal)).toBeNull()
  })

  it('atalho de janela do sistema (Ctrl+R, Alt+F4…) passa batido', () => {
    expect(shortcutFor(press('r', { ctrlKey: true }), free)).toBeNull()
    expect(shortcutFor(press('f', { altKey: true }), free)).toBeNull()
    expect(shortcutFor(press('v', { metaKey: true }), free)).toBeNull()
  })
})

describe('isTypingTarget', () => {
  it('reconhece campo de texto e área editável', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true)
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true)
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true)
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true)
    expect(isTypingTarget({ tagName: 'DIV' })).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('tabela da ajuda', () => {
  it('cobre todas as teclas que a especificação pede', () => {
    const keys = SHORTCUTS.map((item) => item.keys).join(' | ')
    for (const expected of ['V', 'H', 'R', 'D', 'E', 'Del', 'Esc', 'F', 'Enter', 'N']) {
      expect(keys).toContain(expected)
    }
    expect(keys).toContain('+')
  })

  it('cada linha diz onde o atalho vale', () => {
    for (const item of SHORTCUTS) {
      expect(['board', 'session', 'app']).toContain(item.where)
      expect(item.what.length).toBeGreaterThan(3)
    }
  })
})
