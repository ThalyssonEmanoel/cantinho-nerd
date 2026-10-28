import { NumberGenerator } from '@dice-roller/rpg-dice-roller'

/**
 * Gerador de números no formato que a biblioteca de dados espera (random-js): um objeto
 * com `next()` devolvendo um inteiro de 32 bits.
 */
export interface DiceEngine {
  next: () => number
}

/**
 * Gerador criptográfico, como pede a especificação (5.5): `crypto.getRandomValues`.
 * Existe no renderer do Electron e no Node das versões que usamos, então serve nos testes
 * também. É o padrão de todas as rolagens.
 */
export function createCryptoEngine(): DiceEngine {
  const buffer = new Int32Array(1)
  return {
    next: () => {
      globalThis.crypto.getRandomValues(buffer)
      return buffer[0] as number
    }
  }
}

/**
 * Gerador determinístico (xorshift32) para os testes: mesma semente, mesma sequência.
 * Não é para uso real — não tem qualidade criptográfica.
 */
export function createSeededEngine(seed: number): DiceEngine {
  // Semente 0 travaria o xorshift em zero para sempre.
  let state = seed === 0 ? 0x9e3779b9 : seed | 0

  return {
    next: () => {
      state ^= state << 13
      state ^= state >>> 17
      state ^= state << 5
      return state | 0
    }
  }
}

/**
 * Geradores prontos. `min` e `max` vêm da própria biblioteca e fazem todo dado cair no
 * menor ou no maior valor — é como testamos crítico e falha crítica sem sorte envolvida.
 */
export const diceEngines = {
  crypto: createCryptoEngine(),
  min: NumberGenerator.engines.min as DiceEngine,
  max: NumberGenerator.engines.max as DiceEngine,
  seeded: createSeededEngine
}

/**
 * Roda `action` com o gerador escolhido e devolve o anterior no lugar.
 *
 * A biblioteca guarda o gerador num objeto global, então trocamos só durante a rolagem
 * (que é síncrona) para um teste não contaminar o outro.
 */
export function withEngine<T>(engine: DiceEngine | undefined, action: () => T): T {
  const chosen = engine ?? diceEngines.crypto
  const previous: unknown = NumberGenerator.generator.engine
  NumberGenerator.generator.engine = chosen
  try {
    return action()
  } finally {
    NumberGenerator.generator.engine = previous
  }
}
