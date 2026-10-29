import { getSupabase } from './client'
import { FriendlyError } from './errors'
import { deleteSession, listMySessions, removeMember, type SessionSummary } from './sessions'

/**
 * Excluir dados da conta (seção 9).
 *
 * - "Excluir todas as minhas sessões": as que mestro somem (dados e imagens); das que jogo,
 *   eu saio — a ficha fica com o mestre daquela mesa, como quando alguém sai.
 * - "Excluir conta": tudo isso, mais modelos, bestiário, galeria, avatar e o usuário. Apagar
 *   o usuário do Auth precisa da chave secreta, que só existe no servidor: quem faz é a Edge
 *   Function `delete-account`. O resto vai pela cascata do banco a partir do perfil.
 *
 * Os arquivos do Storage não têm cascata (10.2): o app apaga os que pode antes, e a Edge
 * Function confere de novo com a chave de serviço.
 */

const ASSETS_BUCKET = 'assets'
const AVATAR_BUCKET = 'avatars'
const DELETE_ACCOUNT_FUNCTION = 'delete-account'

export interface DeleteSessionsOutcome {
  /** Mesas que eu mestrava e que sumiram. */
  deleted: number
  /** Mesas de que eu saí. */
  left: number
  /** Nomes das que não deram certo (sem internet no meio, por exemplo). */
  failed: string[]
}

/** Separa as mesas que mestro (excluir) das que jogo (sair). */
export function splitMySessions(sessions: readonly SessionSummary[]): {
  mastered: SessionSummary[]
  playing: SessionSummary[]
} {
  return {
    mastered: sessions.filter((session) => session.role === 'gm'),
    playing: sessions.filter((session) => session.role !== 'gm')
  }
}

export async function deleteMySessions(userId: string): Promise<DeleteSessionsOutcome> {
  const { mastered, playing } = splitMySessions(await listMySessions(userId))
  const outcome: DeleteSessionsOutcome = { deleted: 0, left: 0, failed: [] }

  // Uma mesa que falha não impede as outras: no fim a tela diz quais ficaram.
  for (const session of mastered) {
    try {
      await deleteSession(session.id)
      outcome.deleted += 1
    } catch {
      outcome.failed.push(session.name)
    }
  }
  for (const session of playing) {
    try {
      await removeMember(session.id, userId)
      outcome.left += 1
    } catch {
      outcome.failed.push(session.name)
    }
  }
  return outcome
}

/** Apaga uma pasta do Storage (sem subpastas). Falha aqui não impede o resto. */
async function removeFolder(bucket: string, prefix: string): Promise<void> {
  const storage = getSupabase().storage.from(bucket)
  const { data, error } = await storage.list(prefix, { limit: 1000 })
  if (error !== null || data.length === 0) return
  await storage.remove(data.map((file) => `${prefix}/${file.name}`))
}

/** O que a Edge Function respondeu, em português. */
export function describeDeleteAccountError(status: number | null): string {
  if (status === 404) {
    return 'A exclusão de conta ainda não foi instalada no servidor (Edge Function "delete-account"). Avise quem cuida do Supabase da mesa.'
  }
  if (status === 401) return 'Sua sessão expirou. Entre de novo e tente outra vez.'
  if (status === null) return 'Sem conexão com o servidor. Confira a internet e tente de novo.'
  return 'O servidor não conseguiu excluir a conta. Tente de novo daqui a pouco.'
}

/**
 * Exclui a conta inteira. Primeiro as mesas e os arquivos que o próprio app pode apagar;
 * depois a Edge Function apaga o usuário (e, pela cascata, todo o resto).
 */
export async function deleteMyAccount(userId: string): Promise<void> {
  await deleteMySessions(userId)
  await removeFolder(ASSETS_BUCKET, `users/${userId}/gallery`)
  await removeFolder(AVATAR_BUCKET, userId)

  const { error } = await getSupabase().functions.invoke(DELETE_ACCOUNT_FUNCTION, {
    method: 'POST'
  })
  if (error !== null) {
    const context = (error as { context?: unknown }).context
    const status =
      context instanceof Response ? context.status : error.name === 'FunctionsFetchError' ? null : 500
    throw new FriendlyError(describeDeleteAccountError(status), { cause: error })
  }
}
