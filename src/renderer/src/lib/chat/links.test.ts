import { describe, expect, it } from 'vitest'
import { splitLinks } from './links'

describe('splitLinks', () => {
  it('texto sem link fica inteiro', () => {
    expect(splitLinks('oi, mesa')).toEqual([{ kind: 'text', text: 'oi, mesa' }])
  })

  it('separa o link do texto em volta', () => {
    expect(splitLinks('mapa em https://exemplo.com/mapa.png ok')).toEqual([
      { kind: 'text', text: 'mapa em ' },
      { kind: 'link', url: 'https://exemplo.com/mapa.png' },
      { kind: 'text', text: ' ok' }
    ])
  })

  it('a pontuação do fim da frase não entra no link', () => {
    expect(splitLinks('veja http://x.com/a.')).toEqual([
      { kind: 'text', text: 'veja ' },
      { kind: 'link', url: 'http://x.com/a' },
      { kind: 'text', text: '.' }
    ])
  })

  it('só http e https viram link (nada de javascript: nem file:)', () => {
    expect(splitLinks('javascript:alert(1) file:///c:/x')).toEqual([
      { kind: 'text', text: 'javascript:alert(1) file:///c:/x' }
    ])
  })

  it('HTML é texto: os sinais ficam fora do link', () => {
    const segments = splitLinks('<a href="https://x.com">x</a>')
    expect(segments.find((segment) => segment.kind === 'link')).toEqual({
      kind: 'link',
      url: 'https://x.com'
    })
  })
})
