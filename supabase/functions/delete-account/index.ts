// Edge Function do Supabase (Deno): exclui a conta de quem chama (seção 9).
//
// Apagar um usuário do Auth precisa da chave de serviço, que só existe aqui no servidor — o
// app nunca a vê. A função só apaga a conta do próprio dono do token que chegou: não recebe
// id nenhum no corpo, então não dá para pedir a exclusão de outra pessoa.
//
// Ordem:
//   1. confere o token e descobre quem é;
//   2. apaga os arquivos do Storage dessa pessoa (a galeria, o avatar e as pastas das mesas
//      que ela mestra) — o Storage não tem cascata; o app já tentou, aqui é a garantia;
//   3. apaga o usuário. O resto (perfil, mesas que ela mestra, fichas, modelos, bestiário,
//      mensagens…) vai pela cascata do banco a partir de `profiles`.
//
// Instalação (uma vez): `npx supabase functions deploy delete-account`.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem em toda Edge Function.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

// O app é Electron (origem `file://` ou o servidor de desenvolvimento): o navegador faz a
// pergunta de CORS antes do POST com cabeçalhos próprios.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  })
}

/** Apaga os arquivos de uma pasta e das subpastas dela. */
async function removeFolder(admin: SupabaseClient, bucket: string, prefix: string): Promise<void> {
  const storage = admin.storage.from(bucket)
  const { data, error } = await storage.list(prefix, { limit: 1000 })
  if (error !== null || data === null || data.length === 0) return

  const files: string[] = []
  for (const entry of data) {
    const path = `${prefix}/${entry.name}`
    // Pasta no Storage aparece sem `id`.
    if (entry.id === null) await removeFolder(admin, bucket, path)
    else files.push(path)
  }
  if (files.length > 0) await storage.remove(files)
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return reply(405, { error: 'Use POST.' })

  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (token === '') return reply(401, { error: 'Sem login.' })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data: who, error: whoError } = await admin.auth.getUser(token)
  if (whoError !== null || who.user === null) return reply(401, { error: 'Login inválido.' })
  const userId = who.user.id

  try {
    await removeFolder(admin, 'assets', `users/${userId}`)
    await removeFolder(admin, 'avatars', userId)

    const { data: sessions } = await admin.from('sessions').select('id').eq('gm_id', userId)
    for (const session of sessions ?? []) {
      await removeFolder(admin, 'assets', `sessions/${session.id as string}`)
    }
  } catch (error) {
    // Arquivo que sobrar não impede a exclusão: sem dono, ele não é mais alcançável pelo app.
    console.error('Falha ao apagar arquivos da conta', userId, error)
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError !== null) {
    console.error('Falha ao apagar o usuário', userId, deleteError)
    return reply(500, { error: 'Não consegui apagar a conta.' })
  }

  return reply(200, { ok: true })
})
