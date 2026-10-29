/**
 * Excluir sessões e conta (seção 9): as duas ações pedem que a pessoa digite o próprio nome
 * de usuário, para não acontecer por um clique sem querer.
 */

/** O nome digitado confere? Sem diferença de maiúscula nem espaço nas pontas. */
export function confirmationMatches(typed: string, username: string): boolean {
  const expected = username.trim().toLowerCase()
  return expected !== '' && typed.trim().toLowerCase() === expected
}

/** "0 B", "830 KB", "12,4 MB" — o tamanho do cache de imagens. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  const megabytes = bytes / (1024 * 1024)
  const text = megabytes >= 100 ? String(Math.round(megabytes)) : megabytes.toFixed(1)
  return `${text.replace('.', ',')} MB`
}
