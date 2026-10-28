import type {
  AppInfo,
  DeepLink,
  OpenTextFileRequest,
  SaveTextFileRequest,
  TextFileResult
} from '../shared/ipc'

export interface CantinhoApi {
  getAppInfo: () => Promise<AppInfo>
  openExternal: (url: string) => Promise<boolean>
  takePendingDeepLink: () => Promise<DeepLink | null>
  saveTextFile: (request: SaveTextFileRequest) => Promise<TextFileResult>
  openTextFile: (request?: OpenTextFileRequest) => Promise<TextFileResult>
  onDeepLink: (callback: (link: DeepLink) => void) => () => void
}

declare global {
  interface Window {
    api: CantinhoApi
  }
}
