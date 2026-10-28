import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { LoginPage } from '@/features/auth/login-page'
import { RoleChoicePage } from '@/features/auth/role-choice-page'
import { GmLobbyPage } from '@/features/lobby-gm/gm-lobby-page'
import { JoinSessionPage } from '@/features/lobby-player/join-session-page'
import { PlayerLobbyPage } from '@/features/lobby-player/player-lobby-page'
import { ProfilePage } from '@/features/profile/profile-page'
import { SessionPage } from '@/features/session/session-page'
import { SheetBuilderPage } from '@/features/sheet-builder/sheet-builder-page'
import { SheetFillPage } from '@/features/sheets/sheet-fill-page'
import { SheetsPage } from '@/features/sheets/sheets-page'
import { SheetTemplatesPage } from '@/features/sheet-templates/sheet-templates-page'
import { AppLayout } from './app-layout'
import { DeepLinkBridge } from './deep-link-bridge'
import { NotFoundPage } from './not-found-page'

/**
 * HashRouter e não BrowserRouter: no app empacotado o renderer é carregado por `file://`,
 * e aí o BrowserRouter quebra ao recarregar qualquer rota que não seja a raiz.
 */
export function AppRouter(): React.JSX.Element {
  return (
    <HashRouter>
      <DeepLinkBridge />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route path="/role" element={<RoleChoicePage />} />
          <Route path="/gm" element={<GmLobbyPage />} />
          <Route path="/player" element={<PlayerLobbyPage />} />
          <Route path="/join/:inviteId" element={<JoinSessionPage />} />
          <Route path="/templates" element={<SheetTemplatesPage />} />
          <Route path="/templates/:templateId" element={<SheetBuilderPage />} />
          <Route path="/sheets" element={<SheetsPage />} />
          <Route path="/sheets/:sheetId" element={<SheetFillPage />} />
          <Route path="/session/:sessionId" element={<SessionPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </HashRouter>
  )
}
