import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  // As Edge Functions rodam no Deno do Supabase, com outros globais e imports `npm:`.
  { ignores: ['out/**', 'dist/**', 'node_modules/**', 'build/**', 'supabase/functions/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Processo principal, preload e arquivos de configuração rodam no Node.
    files: [
      'src/main/**/*.ts',
      'src/preload/**/*.ts',
      'src/shared/**/*.ts',
      'electron.vite.config.ts',
      'vitest.config.mts',
      'eslint.config.mjs',
      'scripts/**/*.mjs'
    ],
    languageOptions: { globals: { ...globals.node } }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    // `configs.flat` é a versão em flat config; `configs['recommended-latest']` ainda é o
    // formato antigo (plugins como lista de strings) e o ESLint 10 recusa.
    ...reactHooks.configs.flat['recommended-latest']
  },
  {
    files: ['src/renderer/**/*.tsx'],
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
    }
  },
  {
    // Os primitivos do shadcn/ui exportam componente + variantes (cva) no mesmo arquivo:
    // é a convenção upstream, e o CLI do shadcn vai gerar assim os próximos.
    files: ['src/renderer/src/components/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' }
  },
  {
    rules: {
      // Variáveis e parâmetros não usados podem começar com _ (ex.: _event do IPC).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  },
  prettier
)
