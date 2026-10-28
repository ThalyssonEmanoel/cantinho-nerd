import { describe, expect, it } from 'vitest'
import { MAX_UPLOAD_BYTES, sha256Hex, validateImageFile } from './upload'

describe('validateImageFile', () => {
  it('aceita imagem até 15 MB (10.4)', () => {
    expect(validateImageFile({ type: 'image/png', size: 1024 })).toBeNull()
    expect(validateImageFile({ type: 'image/jpeg', size: MAX_UPLOAD_BYTES })).toBeNull()
  })

  it('recusa o que não é imagem e o que passa do limite', () => {
    expect(validateImageFile({ type: 'application/pdf', size: 10 })).toMatch(/imagem/)
    expect(validateImageFile({ type: 'image/png', size: MAX_UPLOAD_BYTES + 1 })).toMatch(/15 MB/)
  })
})

describe('sha256Hex', () => {
  it('é o hash do conteúdo: mesmo conteúdo, mesmo nome', async () => {
    const a = await sha256Hex(new Blob(['abc']))
    expect(a).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(await sha256Hex(new Blob(['abc']))).toBe(a)
    expect(await sha256Hex(new Blob(['abd']))).not.toBe(a)
  })
})
