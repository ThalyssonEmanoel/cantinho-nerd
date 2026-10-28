import { toast } from 'sonner'
import { errorMessage } from '@/lib/db/errors'
import { fetchSessionPassword } from '@/lib/db/sessions'
import { buildInviteText } from '@/lib/session/invite'

/**
 * "Copiar convite" (4.3 e 4.5): busca a senha (só o mestre consegue) e põe na área de
 * transferência o texto pronto para o WhatsApp, com nome, link e senha.
 */
export async function copyInvite(session: {
  id: string
  name: string
  inviteId: string
}): Promise<void> {
  try {
    const password = await fetchSessionPassword(session.id)
    await navigator.clipboard.writeText(
      buildInviteText({ sessionName: session.name, inviteId: session.inviteId, password })
    )
    toast.success('Convite copiado', {
      description: 'Cole no WhatsApp ou no Discord: vai com o link, o código e a senha.'
    })
  } catch (error) {
    toast.error('Não consegui copiar o convite', { description: errorMessage(error) })
  }
}
