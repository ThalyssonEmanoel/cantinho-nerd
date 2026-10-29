import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { LoginPage } from '@/features/auth/login-page'
import { BestiaryPage } from '@/features/bestiary/bestiary-page'
import { CreatureEditorPage } from '@/features/bestiary/creature-editor-page'
import { RoleChoicePage } from '@/features/auth/role-choice-page'
import { FormulaGuidePage } from '@/features/formula-guide/formula-guide-page'
import { GmLobbyPage } from '@/features/lobby-gm/gm-lobby-page'
import { JoinSessionPage } from '@/features/lobby-player/join-session-page'
import { PlayerLobbyPage } from '@/features/lobby-player/player-lobby-page'
import { ProfilePage } from '@/features/profile/profile-page'
import { SessionLayout } from '@/features/session/session-layout'
import { SessionSheetPage } from '@/features/session/session-sheet-page'
import { SessionTablePage } from '@/features/session/session-table-page'
import { SettingsPage } from '@/features/settings/settings-page'
import { SheetBuilderPage } from '@/features/sheet-builder/sheet-builder-page'
import { SheetsPage } from '@/features/sheets/sheets-page'
import { SheetTemplatesPage } from '@/features/sheet-templates/sheet-templates-page'
import { AppLayout } from './app-layout'
import { DeepLinkBridge } from './deep-link-bridge'
import { NotFoundPage } from './not-found-page'
import { AuthBootstrap, RequireAuth } from './require-auth'

/**
 * HashRouter e não BrowserRouter: no app empacotado o renderer é carregado por `file://`,
 * e aí o BrowserRouter quebra ao recarregar qualquer rota que não seja a raiz.
 */
export function AppRouter(): React.JSX.Element {
  return (
    <HashRouter>
      <AuthBootstrap />
      <DeepLinkBridge />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        {/* Tudo daqui para baixo exige conta (4.1). Sem login, volta para a entrada. */}
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/role" element={<RoleChoicePage />} />
            <Route path="/gm" element={<GmLobbyPage />} />
            <Route path="/player" element={<PlayerLobbyPage />} />
            <Route path="/join/:inviteId" element={<JoinSessionPage />} />
            <Route path="/templates" element={<SheetTemplatesPage />} />
            <Route path="/templates/:templateId" element={<SheetBuilderPage />} />
            <Route path="/bestiary" element={<BestiaryPage />} />
            <Route path="/bestiary/:creatureId" element={<CreatureEditorPage />} />
            <Route path="/guide" element={<FormulaGuidePage />} />
            <Route path="/sheets" element={<SheetsPage />} />
            {/*
              A sessão é uma rota "mãe": o canal de tempo real e a presença ficam no layout e
              continuam abertos enquanto a pessoa vai da mesa para a ficha e volta.
            */}
            <Route path="/session/:sessionId" element={<SessionLayout />}>
              <Route index element={<SessionTablePage />} />
              <Route path="sheets/:sheetId" element={<SessionSheetPage />} />
            </Route>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </HashRouter>
  )
}
