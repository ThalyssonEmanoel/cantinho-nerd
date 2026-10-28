import { getSupabase } from './client'
import type { Tables } from './database.types'
import { describeDbError, FriendlyError } from './errors'

/** Perfil público da conta (seção 9), no formato que as telas usam. */
export interface Profile {
  id: string
  username: string
  displayName: string
  bio: string
  /** Caminho no bucket `avatars`, ou `null` sem foto. */
  avatarPath: string | null
}

export interface ProfileChange {
  displayName?: string
  bio?: string
  avatarPath?: string | null
}

const AVATAR_BUCKET = 'avatars'
const PROFILE_COLUMNS = 'id, username, display_name, bio, avatar_path'

/**
 * Nome do arquivo é o hash do conteúdo (10.2), então o mesmo arquivo nunca muda: dá para o
 * navegador guardar em cache por um ano.
 */
const AVATAR_CACHE_SECONDS = '31536000'

type ProfileRow = Pick<
  Tables<'profiles'>,
  'id' | 'username' | 'display_name' | 'bio' | 'avatar_path'
>

export function profileFromRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarPath: row.avatar_path
  }
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()

  if (error !== null) throw new FriendlyError(describeDbError(error), { cause: error })
  return data === null ? null : profileFromRow(data)
}

export async function updateProfile(userId: string, change: ProfileChange): Promise<Profile> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .update({
      ...(change.displayName === undefined ? {} : { display_name: change.displayName.trim() }),
      ...(change.bio === undefined ? {} : { bio: change.bio }),
      ...(change.avatarPath === undefined ? {} : { avatar_path: change.avatarPath })
    })
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single()

  if (error !== null) throw new FriendlyError(describeDbError(error), { cause: error })
  return profileFromRow(data)
}

/**
 * Envia o avatar já recortado e convertido para WebP. Devolve o caminho no bucket.
 *
 * Como o nome é o hash, mandar de novo a mesma imagem dá "já existe" — e isso é sucesso:
 * o arquivo que está lá é exatamente este.
 */
export async function uploadAvatar(userId: string, image: Blob, hash: string): Promise<string> {
  const path = `${userId}/${hash}.webp`
  const { error } = await getSupabase().storage.from(AVATAR_BUCKET).upload(path, image, {
    contentType: 'image/webp',
    cacheControl: AVATAR_CACHE_SECONDS,
    upsert: false
  })

  if (error !== null && !isAlreadyExists(error)) {
    throw new FriendlyError(describeDbError(error), { cause: error })
  }
  return path
}

/** Apaga um avatar antigo. Falhar aqui só deixa um arquivo sobrando; não vale incomodar. */
export async function removeAvatarFile(path: string): Promise<void> {
  const { error } = await getSupabase().storage.from(AVATAR_BUCKET).remove([path])
  if (error !== null) console.warn('Não consegui apagar o avatar antigo:', error)
}

/** URL pública do avatar (o bucket é público: a foto aparece para todos na mesa). */
export function avatarUrl(path: string): string {
  return getSupabase().storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl
}

function isAlreadyExists(error: {
  message?: string
  code?: string
  status?: number
  statusCode?: string | number
}): boolean {
  return (
    error.code === 'ResourceAlreadyExists' ||
    error.status === 409 ||
    String(error.statusCode) === '409' ||
    /already exists|duplicate/i.test(error.message ?? '')
  )
}
