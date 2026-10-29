import { describe, expect, it } from 'vitest'
import { messageFromRow, rollFromRow, rollResultJson } from './chat-rows'

describe('messageFromRow', () => {
  it('mensagem pública e sussurro', () => {
    expect(
      messageFromRow({ id: 'm1', author_id: 'a', recipient_id: null, body: 'oi', created_at: 't' })
    ).toEqual({
      kind: 'message',
      id: 'm1',
      authorId: 'a',
      recipientId: null,
      body: 'oi',
      createdAt: 't'
    })
    expect(
      messageFromRow({ id: 'm2', author_id: 'a', recipient_id: 'b', body: 'psiu' })?.recipientId
    ).toBe('b')
  })

  it('linha sem id é descartada', () => {
    expect(messageFromRow({ body: 'oi' })).toBeNull()
  })
})

describe('rollFromRow', () => {
  const row = {
    id: 'r1',
    author_id: 'a',
    label: 'Furtividade',
    formula: '1d20 + {furtividade}',
    total: '23',
    outcome: 'critical',
    secret: true,
    created_at: 't',
    result: {
      notation: '1d20 + 3',
      detail: '1d20+3: [20]+3 = 23',
      dice: [
        { sides: 20, value: 20, dropped: false, exploded: false },
        { sides: 20, value: 'x' },
        'lixo'
      ]
    }
  }

  it('monta a rolagem com o total numérico, mesmo que chegue como texto', () => {
    const roll = rollFromRow(row)
    expect(roll?.total).toBe(23)
    expect(roll?.outcome).toBe('critical')
    expect(roll?.secret).toBe(true)
    expect(roll?.notation).toBe('1d20 + 3')
  })

  it('dado malformado (de outro app ou editado à mão) fica de fora', () => {
    expect(rollFromRow(row)?.dice).toEqual([
      { sides: 20, value: 20, dropped: false, exploded: false }
    ])
  })

  it('resultado desconhecido vira normal', () => {
    expect(rollFromRow({ ...row, outcome: 'épico' })?.outcome).toBe('normal')
  })
})

describe('rollResultJson', () => {
  it('guarda notação, detalhe e cada dado (descartados e explosões)', () => {
    expect(
      rollResultJson({
        source: '2d20kh1',
        notation: '2d20kh1',
        total: 18,
        outcome: 'normal',
        detail: '2d20kh1: [18, 4d] = 18',
        dice: [
          { sides: 20, value: 18, dropped: false, exploded: false },
          { sides: 20, value: 4, dropped: true, exploded: false }
        ]
      })
    ).toEqual({
      notation: '2d20kh1',
      detail: '2d20kh1: [18, 4d] = 18',
      dice: [
        { sides: 20, value: 18, dropped: false, exploded: false },
        { sides: 20, value: 4, dropped: true, exploded: false }
      ]
    })
  })
})
