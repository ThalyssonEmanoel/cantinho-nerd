import { describe, expect, it } from 'vitest'
import { buildContentSecurityPolicy } from './csp'

const SUPABASE = 'https://bpxtvjlkkuxkxhxyjlbl.supabase.co'

describe('buildContentSecurityPolicy', () => {
  it('em produção não libera eval nem script inline', () => {
    const csp = buildContentSecurityPolicy({ isDev: false, supabaseUrl: SUPABASE })
    expect(csp).toContain("script-src 'self'")
    expect(csp).not.toContain('unsafe-eval')
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'")
  })

  it('libera o Supabase em https e wss para as conexões', () => {
    const csp = buildContentSecurityPolicy({ isDev: false, supabaseUrl: SUPABASE })
    expect(csp).toContain(`connect-src 'self' ${SUPABASE} wss://bpxtvjlkkuxkxhxyjlbl.supabase.co`)
  })

  it('permite imagens do Supabase, data: e blob:', () => {
    const csp = buildContentSecurityPolicy({ isDev: false, supabaseUrl: SUPABASE })
    expect(csp).toContain(`img-src 'self' data: blob: ${SUPABASE}`)
  })

  it('em dev libera o servidor do Vite e o websocket do HMR', () => {
    const csp = buildContentSecurityPolicy({
      isDev: true,
      supabaseUrl: SUPABASE,
      devOrigin: 'http://localhost:5173'
    })
    expect(csp).toContain('http://localhost:5173')
    expect(csp).toContain('ws://localhost:5173')
    expect(csp).toContain('unsafe-eval')
  })

  it('não quebra sem Supabase configurado (antes da Fase 4)', () => {
    const csp = buildContentSecurityPolicy({ isDev: false })
    expect(csp).toContain("connect-src 'self'")
    expect(csp).toContain("default-src 'self'")
  })

  it('ignora URL inválida em vez de gerar diretiva quebrada', () => {
    const csp = buildContentSecurityPolicy({ isDev: false, supabaseUrl: 'nao-e-url' })
    expect(csp).toContain("connect-src 'self';")
  })

  it('bloqueia plugins, iframes, base e formulários', () => {
    const csp = buildContentSecurityPolicy({ isDev: false })
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-src 'none'")
    expect(csp).toContain("base-uri 'none'")
    expect(csp).toContain("form-action 'none'")
  })
})
