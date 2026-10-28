import { getSupabase } from './client'
import { describeDbError, FriendlyError, type DbErrorLike } from './errors'

/**
 * Sessões, membros e convites (seções 4.3 a 4.5). Quem pode o quê é decidido no banco
 * (RLS e RPCs); aqui só se pede e se traduz o erro.
 */

export type SessionRole = 'gm' | 'player'

export interface SessionSummary {
  id: string
  name: string
  inviteId: string
  gmId: string
  gmName: string
  role: SessionRole
  characterTemplateId: string | null
  updatedAt: string
}

export interface SessionMember {
  userId: string
  role: SessionRole
  displayName: string
  username: string
  avatarPath: string | null
  joinedAt: string
}

export interface SessionDetail extends SessionSummary {
  members: SessionMember[]
}

export interface InvitePreview {
  sessionId: string
  name: string
  gmName: string
  isMember: boolean
}

const SESSION_COLUMNS =
  'id, name, invite_id, gm_id, character_template_id, updated_at, gm:profiles!sessions_gm_id_fkey(display_name)'

function fail(error: DbErrorLike): FriendlyError {
  return new FriendlyError(describeDbError(error), { cause: error })
}

const asRole = (value: string): SessionRole => (value === 'gm' ? 'gm' : 'player')

interface SessionRowLike {
  id: string
  name: string
  invite_id: string
  gm_id: string
  character_template_id: string | null
  updated_at: string
  gm: { display_name: string } | null
}

function summaryFrom(row: SessionRowLike, role: SessionRole): SessionSummary {
  return {
    id: row.id,
    name: row.name,
    inviteId: row.invite_id,
    gmId: row.gm_id,
    gmName: row.gm?.display_name ?? '',
    role,
    characterTemplateId: row.character_template_id,
    updatedAt: row.updated_at
  }
}

/** As mesas de que a pessoa participa, mestrando ou jogando, mais recentes primeiro. */
export async function listMySessions(userId: string): Promise<SessionSummary[]> {
  const { data, error } = await getSupabase()
    .from('session_members')
    .select(`role, session:sessions!session_members_session_id_fkey(${SESSION_COLUMNS})`)
    .eq('user_id', userId)
  if (error !== null) throw fail(error)

  return data
    .flatMap((row) => (row.session === null ? [] : [summaryFrom(row.session, asRole(row.role))]))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** A sessão com os membros. `null` se não existe ou se a pessoa não está nela. */
export async function fetchSession(
  sessionId: string,
  userId: string
): Promise<SessionDetail | null> {
  const { data, error } = await getSupabase()
    .from('sessions')
    .select(
      `${SESSION_COLUMNS}, session_members(user_id, role, joined_at, profile:profiles!session_members_user_id_fkey(display_name, username, avatar_path))`
    )
    .eq('id', sessionId)
    .maybeSingle()
  if (error !== null) throw fail(error)
  if (data === null) return null

  const members: SessionMember[] = data.session_members
    .map((member) => ({
      userId: member.user_id,
      role: asRole(member.role),
      displayName: member.profile?.display_name ?? '',
      username: member.profile?.username ?? '',
      avatarPath: member.profile?.avatar_path ?? null,
      joinedAt: member.joined_at
    }))
    // Mestre primeiro, depois na ordem em que chegaram.
    .sort((a, b) =>
      a.role === b.role ? a.joinedAt.localeCompare(b.joinedAt) : a.role === 'gm' ? -1 : 1
    )

  const me = members.find((member) => member.userId === userId)
  if (me === undefined) return null
  return { ...summaryFrom(data, me.role), members }
}

/** A senha da sessão, para o mestre ver e copiar (4.5). */
export async function fetchSessionPassword(sessionId: string): Promise<string> {
  const { data, error } = await getSupabase()
    .from('session_secrets')
    .select('password')
    .eq('session_id', sessionId)
    .maybeSingle()
  if (error !== null) throw fail(error)
  if (data === null) throw new FriendlyError('Só o mestre vê a senha da sessão.')
  return data.password
}

export interface CreateSessionInput {
  name: string
  password: string
  templateId: string | null
}

export async function createSession(
  input: CreateSessionInput
): Promise<{ id: string; inviteId: string }> {
  const { data, error } = await getSupabase().rpc('create_session', {
    p_name: input.name.trim(),
    p_password: input.password,
    ...(input.templateId === null ? {} : { p_template_id: input.templateId })
  })
  if (error !== null) throw fail(error)
  const result = data as { id: string; invite_id: string }
  return { id: result.id, inviteId: result.invite_id }
}

export async function renameSession(sessionId: string, name: string): Promise<void> {
  await updateSession(sessionId, { name: name.trim() })
}

/** Troca o sistema (modelo de personagem) da mesa. `null` = escolher depois. */
export async function setSessionTemplate(
  sessionId: string,
  templateId: string | null
): Promise<void> {
  await updateSession(sessionId, { character_template_id: templateId })
}

async function updateSession(
  sessionId: string,
  change: { name?: string; character_template_id?: string | null }
): Promise<void> {
  const { data, error } = await getSupabase()
    .from('sessions')
    .update(change)
    .eq('id', sessionId)
    .select('id')
  if (error !== null) throw fail(error)
  if (data.length === 0) throw new FriendlyError('Só o mestre muda a sessão.')
}

export async function setSessionPassword(sessionId: string, password: string): Promise<void> {
  const { error } = await getSupabase().rpc('set_session_password', {
    p_session_id: sessionId,
    p_password: password
  })
  if (error !== null) throw fail(error)
}

/** Novo id de convite: o link antigo para de funcionar (4.3). */
export async function regenerateInvite(sessionId: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('regenerate_invite', { p_session_id: sessionId })
  if (error !== null) throw fail(error)
  return data
}

/** Tira um jogador da mesa (mestre) ou sai dela (o próprio jogador). */
export async function removeMember(sessionId: string, userId: string): Promise<void> {
  const { data, error } = await getSupabase()
    .from('session_members')
    .delete()
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .select('user_id')
  if (error !== null) throw fail(error)
  if (data.length === 0) throw new FriendlyError('Não deu para tirar essa pessoa da mesa.')
}

/**
 * Exclui a sessão. Membros, senha e fichas vão junto pela cascata do banco; os arquivos
 * do Storage não têm cascata (10.2), então saem antes, pela API.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await removeSessionFiles(sessionId)
  const { data, error } = await getSupabase()
    .from('sessions')
    .delete()
    .eq('id', sessionId)
    .select('id')
  if (error !== null) throw fail(error)
  if (data.length === 0) throw new FriendlyError('Só o mestre exclui a sessão.')
}

/** Pasta de arquivos da sessão no bucket `assets` (mapas, tokens, retratos — Fase 6). */
const ASSETS_BUCKET = 'assets'

async function removeSessionFiles(sessionId: string): Promise<void> {
  const storage = getSupabase().storage.from(ASSETS_BUCKET)
  for (const folder of ['maps', 'tokens', 'portraits']) {
    const prefix = `sessions/${sessionId}/${folder}`
    const { data, error } = await storage.list(prefix, { limit: 1000 })
    // Antes da Fase 6 o bucket nem existe: não há o que apagar.
    if (error !== null || data.length === 0) continue
    await storage.remove(data.map((file) => `${prefix}/${file.name}`))
  }
}

export async function invitePreview(inviteId: string): Promise<InvitePreview | null> {
  const { data, error } = await getSupabase().rpc('invite_preview', { p_invite_id: inviteId })
  if (error !== null) throw fail(error)
  if (data === null) return null
  const preview = data as {
    session_id: string
    name: string
    gm_name: string | null
    is_member: boolean
  }
  return {
    sessionId: preview.session_id,
    name: preview.name,
    gmName: preview.gm_name ?? '',
    isMember: preview.is_member
  }
}

/** Entra na mesa com a senha (conferida no servidor). Devolve o id da sessão. */
export async function joinSession(inviteId: string, password: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('join_session', {
    p_invite_id: inviteId,
    p_password: password
  })
  if (error !== null) throw fail(error)
  return data
}

/** O modelo é o sistema de alguma mesa ou já tem fichas? Então não pode ser excluído (5.1). */
export async function isTemplateInUse(templateId: string): Promise<boolean> {
  const supabase = getSupabase()
  const [sessions, sheets] = await Promise.all([
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('character_template_id', templateId),
    supabase
      .from('sheets')
      .select('id', { count: 'exact', head: true })
      .eq('template_id', templateId)
  ])
  if (sessions.error !== null) throw fail(sessions.error)
  if (sheets.error !== null) throw fail(sheets.error)
  return (sessions.count ?? 0) > 0 || (sheets.count ?? 0) > 0
}
