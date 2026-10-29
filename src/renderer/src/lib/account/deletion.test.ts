import { describe, expect, it } from 'vitest'
import { confirmationMatches, formatBytes } from './deletion'

describe('confirmar digitando o nome', () => {
  it('confere sem diferença de maiúscula nem espaço', () => {
    expect(confirmationMatches('  Thalysson ', 'thalysson')).toBe(true)
    expect(confirmationMatches('thalyson', 'thalysson')).toBe(false)
    expect(confirmationMatches('', '')).toBe(false)
  })
})

describe('tamanho do cache', () => {
  it('em B, KB e MB, com vírgula', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(850 * 1024)).toBe('850 KB')
    expect(formatBytes(12.44 * 1024 * 1024)).toBe('12,4 MB')
    expect(formatBytes(380 * 1024 * 1024)).toBe('380 MB')
  })
})
