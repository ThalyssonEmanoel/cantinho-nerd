import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { applyNavigationGuards } from './security'

let mainWindow: BrowserWindow | null = null

/** Janelas de ficha abertas, por `<sessão>:<ficha>` — abrir a mesma duas vezes só foca. */
const sheetWindows = new Map<string, BrowserWindow>()

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Carrega o renderer numa rota do HashRouter (dev e empacotado têm caminhos diferentes). */
function loadRoute(window: BrowserWindow, route: string): void {
  const devOrigin = getDevOrigin()
  if (devOrigin !== undefined) {
    void window.loadURL(`${devOrigin}#${route}`)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), { hash: route })
  }
}

/**
 * Abre a ficha numa janela separada (Fase 13), para quem joga com dois monitores.
 *
 * Os ids vêm do renderer, então são conferidos aqui antes de virar rota: a janela nova
 * carrega o mesmo arquivo do app, com a mesma ponte e as mesmas travas de navegação, e
 * compartilha o login porque está na mesma sessão do Electron.
 */
export function createSheetWindow(sessionId: unknown, sheetId: unknown): boolean {
  if (typeof sessionId !== 'string' || !UUID.test(sessionId)) return false
  if (typeof sheetId !== 'string' || !UUID.test(sheetId)) return false

  const key = `${sessionId}:${sheetId}`
  const existing = sheetWindows.get(key)
  if (existing !== undefined && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore()
    existing.focus()
    return true
  }

  const window = new BrowserWindow({
    width: 980,
    height: 900,
    minWidth: 640,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0f',
    title: 'Ficha — Cantinho Nerd',
    parent: mainWindow ?? undefined,
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

  sheetWindows.set(key, window)
  window.on('ready-to-show', () => window.show())
  window.on('closed', () => sheetWindows.delete(key))

  applyNavigationGuards(window, getDevOrigin())
  loadRoute(window, `/window/session/${sessionId}/sheets/${sheetId}`)
  return true
}

/** Traz a janela existente para a frente (usado pela instância única e pelo deep link). */
export function focusMainWindow(): void {
  const window = mainWindow
  if (window === null) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}
