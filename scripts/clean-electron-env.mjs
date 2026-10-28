/**
 * Ambiente limpo para subir o Electron.
 *
 * O VS Code exporta `ELECTRON_RUN_AS_NODE=1` para os processos filhos do host de extensões
 * (e o mesmo acontece em alguns terminais integrados). Com essa variável, o `electron.exe`
 * roda como Node puro: a janela nunca abre e `require('electron')` devolve apenas o caminho
 * do binário, o que estoura com "Cannot read properties of undefined (reading 'isPackaged')".
 * `ELECTRON_NO_ATTACH_CONSOLE` some junto porque esconde a saída do processo no Windows.
 */
export function cleanElectronEnv(extra = {}) {
  const env = { ...process.env, ...extra }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_NO_ATTACH_CONSOLE
  return env
}

/** Repassa o código de saída (ou o sinal) do processo filho, para o npm não mentir no CI. */
export function forwardExit(child) {
  child.on('exit', (code, signal) => {
    if (signal !== null) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })
}
