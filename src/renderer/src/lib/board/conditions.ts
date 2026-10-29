/**
 * Condições dos tokens (6.3): ícones sobre o token, com duração opcional em rodadas.
 *
 * A lista é de cada mesa (o mestre edita em "Gerenciar"); o app não sabe o que "Atordoado"
 * faz em sistema nenhum — é só um rótulo com ícone. No token, nome e ícone vão copiados:
 * tirar uma condição da lista não apaga a que já está num token.
 */

export interface ConditionDef {
  key: string
  name: string
  /** Um emoji (texto puro), desenhado sobre o token. */
  icon: string
}

/** A condição no token. `rounds` null = sem duração; com número, cai no turno do token. */
export interface TokenCondition extends ConditionDef {
  rounds: number | null
}

export const MAX_CONDITIONS = 40
export const MAX_CONDITION_NAME = 30
export const MAX_CONDITION_ICON = 8
export const MAX_CONDITION_ROUNDS = 99

/** Ponto de partida de toda mesa. Genérica de propósito: o mestre adapta ao sistema dele. */
export const DEFAULT_CONDITIONS: readonly ConditionDef[] = [
  { key: 'caido', name: 'Caído', icon: '🔻' },
  { key: 'atordoado', name: 'Atordoado', icon: '💫' },
  { key: 'envenenado', name: 'Envenenado', icon: '🤢' },
  { key: 'cego', name: 'Cego', icon: '🙈' },
  { key: 'surdo', name: 'Surdo', icon: '🙉' },
  { key: 'agarrado', name: 'Agarrado', icon: '🤼' },
  { key: 'contido', name: 'Contido', icon: '⛓️' },
  { key: 'paralisado', name: 'Paralisado', icon: '🧊' },
  { key: 'petrificado', name: 'Petrificado', icon: '🗿' },
  { key: 'amedrontado', name: 'Amedrontado', icon: '😨' },
  { key: 'enfeiticado', name: 'Enfeitiçado', icon: '💘' },
  { key: 'invisivel', name: 'Invisível', icon: '👻' },
  { key: 'inconsciente', name: 'Inconsciente', icon: '💤' },
  { key: 'sangrando', name: 'Sangrando', icon: '🩸' },
  { key: 'exausto', name: 'Exausto', icon: '🥵' },
  { key: 'concentrando', name: 'Concentrando', icon: '🧠' }
]

/** "Enfeitiçado" → "enfeiticado". A chave liga a condição do token à da lista. */
export function conditionKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/** Rodadas válidas: inteiro de 1 a 99. Qualquer outra coisa é "sem duração". */
export function normalizeRounds(value: unknown): number | null {
  const number = typeof value === 'string' ? Number(value.trim().replace(',', '.')) : value
  if (typeof number !== 'number' || !Number.isFinite(number)) return null
  const rounds = Math.trunc(number)
  if (rounds < 1) return null
  return Math.min(MAX_CONDITION_ROUNDS, rounds)
}

function parseDef(value: unknown): ConditionDef | null {
  const raw = asObject(value)
  if (raw === null) return null
  const name = cleanText(raw.name, MAX_CONDITION_NAME)
  const icon = cleanText(raw.icon, MAX_CONDITION_ICON)
  const key = conditionKey(typeof raw.key === 'string' && raw.key !== '' ? raw.key : name)
  if (name === '' || icon === '' || key === '') return null
  return { key, name, icon }
}

/**
 * A lista da mesa, de `sessions.settings`. Sem lista salva, vale a padrão; com lista salva
 * (mesmo vazia — o mestre tirou todas), vale a dele.
 */
export function conditionsFromSettings(settings: unknown): ConditionDef[] {
  const raw = asObject(settings)?.conditions
  if (!Array.isArray(raw)) return DEFAULT_CONDITIONS.map((item) => ({ ...item }))

  const seen = new Set<string>()
  const list: ConditionDef[] = []
  for (const item of raw) {
    const def = parseDef(item)
    if (def === null || seen.has(def.key)) continue
    seen.add(def.key)
    list.push(def)
    if (list.length === MAX_CONDITIONS) break
  }
  return list
}

/** Problema na lista que o mestre está editando, ou null se dá para salvar. */
export function conditionListProblem(list: readonly ConditionDef[]): string | null {
  if (list.length > MAX_CONDITIONS) return `No máximo ${MAX_CONDITIONS} condições.`
  const seen = new Set<string>()
  for (const item of list) {
    const name = item.name.trim()
    if (name === '') return 'Toda condição precisa de um nome.'
    if (item.icon.trim() === '') return `"${name}" precisa de um ícone (um emoji).`
    const key = conditionKey(name)
    if (key === '') return `"${name}" precisa ter pelo menos uma letra ou número.`
    if (seen.has(key)) return `Há duas condições chamadas "${name}".`
    seen.add(key)
  }
  return null
}

/** A lista pronta para `settings.conditions`, com as chaves refeitas a partir dos nomes. */
export function conditionsToSettings(list: readonly ConditionDef[]): ConditionDef[] {
  return list.map((item) => {
    const name = item.name.trim().slice(0, MAX_CONDITION_NAME)
    return { key: conditionKey(name), name, icon: item.icon.trim().slice(0, MAX_CONDITION_ICON) }
  })
}

/** As condições gravadas no token (jsonb vindo do banco). */
export function parseTokenConditions(value: unknown): TokenCondition[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const list: TokenCondition[] = []
  for (const item of value) {
    const def = parseDef(item)
    if (def === null || seen.has(def.key)) continue
    seen.add(def.key)
    list.push({ ...def, rounds: normalizeRounds(asObject(item)?.rounds) })
  }
  return list
}

/** Liga ou desliga uma condição no token (entra sem duração). */
export function toggleCondition(
  list: readonly TokenCondition[],
  def: ConditionDef
): TokenCondition[] {
  if (list.some((item) => item.key === def.key)) {
    return list.filter((item) => item.key !== def.key)
  }
  return [...list, { key: def.key, name: def.name, icon: def.icon, rounds: null }]
}

export function setConditionRounds(
  list: readonly TokenCondition[],
  key: string,
  rounds: unknown
): TokenCondition[] {
  return list.map((item) => (item.key === key ? { ...item, rounds: normalizeRounds(rounds) } : item))
}

/**
 * Uma rodada a menos (o mesmo que `tick_conditions` faz no banco ao fim do turno do token).
 * Fica aqui para os testes descreverem a regra, e para a tela poder mostrar o que vai
 * acontecer.
 */
export function tickConditions(list: readonly TokenCondition[]): TokenCondition[] {
  return list
    .filter((item) => item.rounds === null || item.rounds > 1)
    .map((item) => (item.rounds === null ? item : { ...item, rounds: item.rounds - 1 }))
}
