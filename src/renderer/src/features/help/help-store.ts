import { create } from 'zustand'

/**
 * A tela de ajuda está aberta? (Fase 13)
 *
 * Um store de três linhas, e não estado de componente, porque quem pede a ajuda está longe
 * de quem a desenha: o atalho F1 no tabuleiro, o botão "?" na barra e o item da navegação
 * do app — todos abrem a mesma janela, que vive na casca do app.
 *
 * Fora do `app-store` de propósito: aquele é persistido, e "a ajuda estava aberta" não é
 * preferência para guardar entre sessões.
 */
interface HelpState {
  open: boolean
  openHelp: () => void
  closeHelp: () => void
}

export const useHelpStore = create<HelpState>()((set) => ({
  open: false,
  openHelp: () => set({ open: true }),
  closeHelp: () => set({ open: false })
}))
