import { z } from 'zod'
import type { SheetRecord } from './sheet-record'
import type { SheetSchema, SheetTemplate, TemplateKind } from './types'

/**
 * Validação dos modelos importados (seção 5.1) com zod.
 *
 * Arquivo `.json` vem de fora do app — pode estar corrompido, ser de uma versão futura ou
 * ter sido editado à mão. Nada entra na biblioteca sem passar por aqui.
 */

export const TEMPLATE_FILE_FORMAT = 'cantinho-nerd/sheet-template'

/** Limite de tamanho do arquivo importado: um modelo honesto não passa nem perto disso. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024

const gridPosition = z.object({
  x: z.number().int().min(0).max(48),
  y: z.number().int().min(0).max(999),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(60)
})

const identifier = z.string().min(1).max(64)
const label = z.string().max(120)
const formula = z.string().max(2000)

const selectOption = z.object({
  id: identifier,
  label: z.string().max(120),
  value: z.number().optional()
})

const numberFormat = z.enum(['integer', 'signed', 'decimal'])

const criticalRule = z.union([
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('natural') }),
  z.object({ kind: z.literal('margin'), threshold: z.union([z.number(), z.string().max(200)]) })
])

const componentBase = {
  id: identifier,
  key: z.string().max(64),
  label,
  hint: z.string().max(400).optional(),
  editableBy: z.enum(['player', 'gm']),
  visibleTo: z.enum(['all', 'gm']),
  visibleWhen: formula.optional(),
  role: z
    .enum(['name', 'portrait', 'hp', 'bar2', 'bar3', 'initiative', 'defense', 'vision'])
    .optional(),
  accent: z.string().max(40).optional(),
  layout: gridPosition
}

const tableColumn = z.object({
  id: identifier,
  key: z.string().max(64),
  label,
  kind: z.enum(['text', 'number', 'checkbox', 'select', 'computed', 'rollButton']),
  width: z.number().min(0).max(100).optional(),
  options: z.array(selectOption).max(200).optional(),
  formula: formula.optional(),
  format: numberFormat.optional(),
  critical: criticalRule.optional(),
  criticalFailureOnOne: z.boolean().optional()
})

const tableRow = z.object({
  id: identifier,
  key: z.string().max(64),
  label,
  cells: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
})

const sheetComponent = z.discriminatedUnion('type', [
  z.object({
    ...componentBase,
    type: z.literal('text'),
    placeholder: z.string().max(120).optional(),
    maxLength: z.number().int().min(1).max(10000).optional()
  }),
  z.object({
    ...componentBase,
    type: z.literal('textarea'),
    placeholder: z.string().max(120).optional(),
    maxLength: z.number().int().min(1).max(100000).optional()
  }),
  z.object({
    ...componentBase,
    type: z.literal('number'),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    defaultValue: z.number().optional()
  }),
  z.object({ ...componentBase, type: z.literal('checkbox'), defaultValue: z.boolean() }),
  z.object({
    ...componentBase,
    type: z.literal('select'),
    options: z.array(selectOption).max(200),
    defaultOptionId: identifier.optional()
  }),
  z.object({ ...componentBase, type: z.literal('image'), shape: z.enum(['circle', 'rect']) }),
  z.object({
    ...componentBase,
    type: z.literal('heading'),
    text: z.string().max(200),
    level: z.enum(['title', 'section'])
  }),
  z.object({
    ...componentBase,
    type: z.literal('attribute'),
    min: z.number().optional(),
    max: z.number().optional(),
    defaultValue: z.number().optional(),
    modifierFormula: formula.optional()
  }),
  z.object({
    ...componentBase,
    type: z.literal('resource'),
    maxValue: z.number().optional(),
    maxFormula: formula.optional(),
    color: z.string().max(40).optional(),
    showButtons: z.boolean()
  }),
  z.object({
    ...componentBase,
    type: z.literal('markers'),
    count: z.number().int().min(0).max(100).optional(),
    countFormula: formula.optional()
  }),
  z.object({
    ...componentBase,
    type: z.literal('computed'),
    formula,
    format: numberFormat
  }),
  z.object({
    ...componentBase,
    type: z.literal('rollButton'),
    formula,
    critical: criticalRule,
    criticalFailureOnOne: z.boolean()
  }),
  z.object({
    ...componentBase,
    type: z.literal('table'),
    columns: z.array(tableColumn).max(40),
    rows: z.array(tableRow).max(400),
    playerCanAddRows: z.boolean(),
    showRowLabels: z.boolean()
  })
])

const sheetTab = z.object({
  id: identifier,
  label,
  components: z.array(sheetComponent).max(400)
})

export const sheetSchemaValidator = z.object({
  formatVersion: z.literal(1),
  tabs: z.array(sheetTab).min(1).max(40)
})

export const templateFileValidator = z.object({
  format: z.literal(TEMPLATE_FILE_FORMAT),
  fileVersion: z.literal(1),
  name: z.string().min(1).max(120),
  kind: z.enum(['character', 'creature']),
  schema: sheetSchemaValidator
})

export type TemplateFile = z.infer<typeof templateFileValidator>

/**
 * Trava de compilação: se o tipo e o validador se separarem, o typecheck acusa aqui em vez
 * de deixar passar um modelo malformado.
 */
type AssertAssignable<A extends B, B> = A
export type SchemaMatchesTypes = AssertAssignable<z.infer<typeof sheetSchemaValidator>, SheetSchema>

export function exportTemplateJson(template: SheetTemplate): string {
  const file: TemplateFile = {
    format: TEMPLATE_FILE_FORMAT,
    fileVersion: 1,
    name: template.name,
    kind: template.kind,
    schema: template.draftSchema
  }
  return JSON.stringify(file, null, 2)
}

export type ImportResult = { ok: true; value: TemplateFile } | { ok: false; message: string }

/** Lê e valida um `.json` exportado pelo app. Nunca lança. */
export function parseTemplateFile(text: string): ImportResult {
  if (text.trim() === '') return { ok: false, message: 'O arquivo está vazio.' }

  // `length` conta caracteres, não bytes, mas serve de teto barato antes do parse.
  if (text.length > MAX_IMPORT_BYTES) {
    return { ok: false, message: 'O arquivo é grande demais para ser um modelo de ficha.' }
  }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, message: 'Não consegui ler o arquivo: não é um JSON válido.' }
  }

  const parsed = templateFileValidator.safeParse(data)
  if (parsed.success) return { ok: true, value: parsed.data }

  const issue = parsed.error.issues[0]
  const where =
    issue === undefined || issue.path.length === 0 ? '' : ` (em ${issue.path.join('.')})`
  const detail = issue?.message ?? 'formato inesperado'
  return {
    ok: false,
    message: `Este arquivo não é um modelo de ficha do Cantinho Nerd: ${detail}${where}.`
  }
}

/** Valida um esquema solto (usado ao carregar do armazenamento local). */
export function parseSheetSchema(data: unknown): SheetSchema | null {
  const parsed = sheetSchemaValidator.safeParse(data)
  return parsed.success ? parsed.data : null
}

// ---------------------------------------------------------------------------
// Fichas preenchidas (5.7)
// ---------------------------------------------------------------------------

const cellValue = z.union([z.string(), z.number(), z.boolean()])

const sheetValue = z.union([
  cellValue,
  z.object({ current: z.number(), max: z.number().optional() }),
  z.array(
    z.object({
      id: identifier,
      key: z.string().max(64).optional(),
      cells: z.record(z.string(), cellValue)
    })
  )
])

const sheetValues = z.record(z.string(), sheetValue)
const bar = z.object({ current: z.number(), max: z.number() })

const sheetSummary = z.object({
  name: z.string().optional(),
  portrait: z.string().optional(),
  defense: z.number().optional(),
  vision: z.number().optional(),
  bars: z.object({ hp: bar.optional(), bar2: bar.optional(), bar3: bar.optional() })
})

export const sheetRecordValidator = z.object({
  id: identifier,
  templateId: identifier,
  templateName: z.string().max(120),
  templateVersion: z.number().int().min(1),
  kind: z.enum(['character', 'creature_instance']),
  ownerName: z.string().max(120),
  ownerId: identifier.optional(),
  sessionId: identifier.optional(),
  values: sheetValues,
  gmValues: sheetValues,
  computed: z.record(z.string(), cellValue),
  summary: sheetSummary,
  orphaned: sheetValues,
  createdAt: z.string(),
  updatedAt: z.string()
})

export type RecordMatchesTypes = AssertAssignable<z.infer<typeof sheetRecordValidator>, SheetRecord>

/**
 * Valida uma ficha vinda do armazenamento local. O conteúdo de `values` é jsonb livre —
 * o que se checa aqui é a forma, para uma linha corrompida não derrubar a tela.
 */
export function parseSheetRecord(data: unknown): SheetRecord | null {
  const parsed = sheetRecordValidator.safeParse(data)
  return parsed.success ? parsed.data : null
}

export function templateKindLabel(kind: TemplateKind): string {
  return kind === 'character' ? 'Personagem' : 'Criatura'
}
