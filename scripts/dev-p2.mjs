import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { cleanElectronEnv, forwardExit } from './clean-electron-env.mjs'

/**
 * Segunda instância para testar mestre e jogador no mesmo PC.
 *
 * Em vez de subir outro servidor do Vite, reaproveita o do `npm run dev` que já está
 * rodando — assim as duas janelas compartilham o HMR e não há dois builds escrevendo em
 * `out/` ao mesmo tempo. O perfil `p2` dá a ela outro diretório de dados (login e
 * preferências próprios) e a deixa fora da instância única.
 */
const require = createRequire(import.meta.url)
// O pacote `electron` exporta o caminho do executável.
const electronPath = require('electron')

const env = cleanElectronEnv({
  RPGMESA_PROFILE: 'p2',
  ELECTRON_RENDERER_URL: process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5173'
})

console.log('Abrindo a segunda instância (perfil p2). O `npm run dev` precisa estar rodando.')

forwardExit(spawn(electronPath, ['.'], { stdio: 'inherit', env }))
