import { app } from 'electron'

/**
 * Perfis de dados separados.
 *
 * Para testar mestre e jogador no mesmo PC (`npm run dev:p2`) a segunda instância precisa
 * de outro diretório de userData: sem isso as duas janelas compartilhariam a sessão de
 * login do Supabase (mesmo cookie/localStorage) e seriam sempre o mesmo usuário.
 */
export const profileName = process.env.RPGMESA_PROFILE?.trim() ?? 'default'

export const isSecondaryProfile = profileName !== 'default' && profileName !== ''

/**
 * Precisa ser chamado antes do `app.whenReady()`: depois disso o Electron já criou os
 * caminhos. `sessionData` segue o `userData` automaticamente.
 */
export function applyDataProfile(): void {
  if (!isSecondaryProfile) return
  app.setPath('userData', `${app.getPath('userData')}-${profileName}`)
}
