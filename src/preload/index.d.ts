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
  readCachedAsset: (key: string) => Promise<Uint8Array | null>
  writeCachedAsset: (key: string, data: Uint8Array) => Promise<boolean>
  assetCacheSize: () => Promise<number>
  clearAssetCache: () => Promise<number>
  openSheetWindow: (sessionId: string, sheetId: string) => Promise<boolean>
  onDeepLink: (callback: (link: DeepLink) => void) => () => void
}

declare global {
  interface Window {
    api: CantinhoApi
  }
}
