import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { applyNavigationGuards } from './security'

let mainWindow: BrowserWindow | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

/** URL do servidor do Vite quando rodando em dev; undefined no app empacotado. */
export function getDevOrigin(): string | undefined {
  return is.dev ? process.env.ELECTRON_RENDERER_URL : undefined
}

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    // A especificação pede janela mínima de 1280x720 (6.1).
    minWidth: 1280,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    // Cor de fundo igual à do tema escuro, para não piscar branco ao abrir.
    backgroundColor: '#0a0a0f',
    title: 'Cantinho Nerd',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      spellcheck: false
    }
  })

  mainWindow = window

  window.on('ready-to-show', () => window.show())
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  applyNavigationGuards(window, getDevOrigin())

  const devOrigin = getDevOrigin()
  if (devOrigin !== undefined) {
    void window.loadURL(devOrigin)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

/** Traz a janela existente para a frente (usado pela instância única e pelo deep link). */
export function focusMainWindow(): void {
  const window = mainWindow
  if (window === null) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}
