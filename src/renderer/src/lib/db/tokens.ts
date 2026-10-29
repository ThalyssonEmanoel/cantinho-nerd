import type { BoardToken, TokenCrop, TokenKind } from '@/lib/board'
import { tokenFromRow, tokenPatchToRow, type TokenPatch, type TokenRow } from './board-rows'
import { getSupabase } from './client'
import { describeDbError, FriendlyError, type DbErrorLike } from './errors'

/**
 * Tokens do mapa (6.3).
 *
 * As regras de quem mexe em quê estão no banco (RLS e o gatilho `guard_token_update`): o
 * jogador mexe só nos próprios tokens, e campos como "oculto" são do mestre. Aqui o erro
 * do banco vira mensagem em português.
 */

const TOKEN_COLUMNS =
  'id, session_id, map_id, sheet_id, kind, owner_id, name, image_path, image_crop, x, y, size, z, hidden, show_name, show_bars, vision_m, bars'

function fail(error: DbErrorLike): FriendlyError {
  return new FriendlyError(describeDbError(error), { cause: error })
}

/** Tokens de um mapa. O jogador recebe só os visíveis do mapa ativo — o RLS filtra. */
export async function listTokens(mapId: string): Promise<BoardToken[]> {
  const { data, error } = await getSupabase()
    .from('tokens')
    .select(TOKEN_COLUMNS)
    .eq('map_id', mapId)
  if (error !== null) throw fail(error)
  return (data as TokenRow[]).map(tokenFromRow)
}

export interface CreateTokenInput {
  sessionId: string
  mapId: string
  kind: TokenKind
  name: string
  x: number
  y: number
  size?: number
  z?: number
  imagePath?: string | null
  crop?: TokenCrop
  sheetId?: string | null
  hidden?: boolean
  visionM?: number | null
}

export async function createToken(input: CreateTokenInput): Promise<BoardToken> {
  const { data, error } = await getSupabase()
    .from('tokens')
    .insert({
      session_id: input.sessionId,
      map_id: input.mapId,
      kind: input.kind,
      name: input.name.trim(),
      x: input.x,
      y: input.y,
      ...(input.size === undefined ? {} : { size: input.size }),
      ...(input.z === undefined ? {} : { z: input.z }),
      ...(input.imagePath === undefined ? {} : { image_path: input.imagePath }),
      ...(input.crop === undefined ? {} : { image_crop: { ...input.crop } }),
      ...(input.sheetId === undefined ? {} : { sheet_id: input.sheetId }),
      ...(input.hidden === undefined ? {} : { hidden: input.hidden }),
      ...(input.visionM === undefined ? {} : { vision_m: input.visionM })
    })
    .select(TOKEN_COLUMNS)
    .single()
  if (error !== null) throw fail(error)
  return tokenFromRow(data as TokenRow)
}

/**
 * Altera alguns campos de um token. Devolve a linha nova para a tela não precisar
 * adivinhar o que o banco aceitou.
 */
export async function patchToken(tokenId: string, patch: TokenPatch): Promise<BoardToken | null> {
  const change = tokenPatchToRow(patch)
  if (Object.keys(change).length === 0) return null

  const { data, error } = await getSupabase()
    .from('tokens')
    .update(change)
    .eq('id', tokenId)
    .select(TOKEN_COLUMNS)
  if (error !== null) throw fail(error)

  const [row] = data as TokenRow[]
  if (row === undefined) throw new FriendlyError('Esse token não é seu para mexer.')
  return tokenFromRow(row)
}

/** Só a posição, no fim do arrasto. Separado porque é o caminho mais usado. */
export async function moveToken(tokenId: string, x: number, y: number): Promise<void> {
  const { data, error } = await getSupabase()
    .from('tokens')
    .update({ x, y })
    .eq('id', tokenId)
    .select('id')
  if (error !== null) throw fail(error)
  if (data.length === 0) throw new FriendlyError('Esse token não é seu para mover.')
}

export async function deleteToken(tokenId: string): Promise<void> {
  const { data, error } = await getSupabase()
    .from('tokens')
    .delete()
    .eq('id', tokenId)
    .select('id')
  if (error !== null) throw fail(error)
  if (data.length === 0) throw new FriendlyError('Esse token não é seu para excluir.')
}

/**
 * Exclui vários tokens de uma vez (seleção múltipla). Devolve quantos saíram: o jogador
 * pode ter selecionado token que não é dele, e o banco simplesmente não apaga aquele.
 */
export async function deleteTokens(ids: readonly string[]): Promise<number> {
  if (ids.length === 0) return 0
  const { data, error } = await getSupabase()
    .from('tokens')
    .delete()
    .in('id', ids as string[])
    .select('id')
  if (error !== null) throw fail(error)
  return data.length
}
