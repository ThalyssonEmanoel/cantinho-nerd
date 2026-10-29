/**
 * Sons da mesa, sintetizados com Web Audio: nada de arquivo de som para empacotar, e a CSP
 * não precisa liberar nada.
 */

let context: AudioContext | null = null

/** Notas curtas: [frequência em Hz, início em segundos]. */
function playNotes(notes: ReadonlyArray<readonly [number, number]>, length: number): void {
  // Sem Web Audio (testes, ambiente estranho): fica em silêncio, sem erro.
  if (typeof AudioContext === 'undefined') return
  try {
    context ??= new AudioContext()
    const now = context.currentTime
    const gain = context.createGain()
    gain.connect(context.destination)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length)

    for (const [frequency, start] of notes) {
      const oscillator = context.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, now + start)
      oscillator.connect(gain)
      oscillator.start(now + start)
      oscillator.stop(now + start + 0.35)
    }
  } catch {
    // Áudio bloqueado pelo sistema: o aviso visual continua.
  }
}

/** "Plim" do sussurro (7.2): duas notas subindo, discreto, mas dá para ouvir com música. */
export function playWhisperChime(): void {
  playNotes(
    [
      [880, 0],
      [1320, 0.12]
    ],
    0.5
  )
}

/** "Sua vez!" (7.3): três notas, para não confundir com o sussurro. */
export function playTurnChime(): void {
  playNotes(
    [
      [660, 0],
      [880, 0.1],
      [1320, 0.2]
    ],
    0.65
  )
}
