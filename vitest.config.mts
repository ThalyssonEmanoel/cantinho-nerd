import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  test: {
    projects: [
      {
        // Lógica pura (fórmulas, dados, modelos, permissões): não precisa de DOM.
        extends: true,
        test: {
          name: 'logica',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.dom.test.ts', 'src/**/*.dom.test.tsx']
        }
      },
      {
        // Testes de montagem de componente: provam que a tela sobe sem quebrar.
        extends: true,
        test: {
          name: 'componentes',
          environment: 'jsdom',
          include: ['src/**/*.dom.test.{ts,tsx}'],
          setupFiles: ['./src/renderer/src/test/setup-dom.ts']
        }
      }
    ]
  }
})
