import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // O processo principal monta a Content-Security-Policy com o domínio do Supabase,
  // mas não recebe as variáveis VITE_* automaticamente (elas são do renderer).
  // Por isso injetamos o valor em tempo de build.
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      define: {
        'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL ?? '')
      }
    },
    preload: {
      // Com `sandbox: true` o preload só consegue dar `require` nos módulos embutidos do
      // Electron — nada de node_modules. Por isso aqui NÃO usamos o externalizeDepsPlugin:
      // tudo que o preload importar precisa ser empacotado junto, deixando fora só
      // 'electron'. Externalizar uma dependência aqui faria o preload falhar em silêncio,
      // e o renderer ficaria sem `window.api`.
      build: {
        rollupOptions: {
          external: ['electron']
        }
      }
    },
    renderer: {
      resolve: {
        alias: {
          '@': resolve('src/renderer/src'),
          '@shared': resolve('src/shared')
        }
      },
      // Porta fixa: o `dev:p2` aponta para http://localhost:5173. Com strictPort o Vite
      // falha em vez de escolher outra porta em silêncio, o que deixaria a segunda
      // instância apontando para o lugar errado.
      server: {
        port: 5173,
        strictPort: true
      },
      plugins: [react(), tailwindcss()]
    }
  }
})
