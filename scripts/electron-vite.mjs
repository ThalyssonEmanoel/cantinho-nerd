import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { cleanElectronEnv, forwardExit } from './clean-electron-env.mjs'

// O `exports` do electron-vite não expõe a pasta bin, então resolvemos pelo caminho.
const cli = fileURLToPath(
  new URL('../node_modules/electron-vite/bin/electron-vite.js', import.meta.url)
)

forwardExit(
  spawn(process.execPath, [cli, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: cleanElectronEnv()
  })
)
