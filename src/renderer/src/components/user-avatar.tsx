import { useState } from 'react'
import { avatarUrl } from '@/lib/db/profiles'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  displayName: string
  avatarPath: string | null
  className?: string
}

/** Foto redonda da conta, com as iniciais quando não há foto (ou ela não carrega). */
export function UserAvatar({
  displayName,
  avatarPath,
  className
}: UserAvatarProps): React.JSX.Element {
  // Guarda qual caminho falhou, e não um "falhou" solto: trocar de foto tenta de novo.
  const [brokenPath, setBrokenPath] = useState<string | null>(null)
  const showImage = avatarPath !== null && avatarPath !== brokenPath

  return (
    <span
      className={cn(
        'bg-muted text-muted-foreground inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium select-none',
        className
      )}
    >
      {showImage ? (
        <img
          src={avatarUrl(avatarPath)}
          alt=""
          className="size-full object-cover"
          draggable={false}
          onError={() => setBrokenPath(avatarPath)}
        />
      ) : (
        initialsOf(displayName)
      )}
    </span>
  )
}

function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '')
  const first = words[0]?.[0] ?? '?'
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}
