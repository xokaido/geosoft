export const CHAT_IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const CHAT_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

export type ChatImageUploadErrorKey = 'invalid_type' | 'too_large' | 'upload'

function extensionMime(name: string): string | null {
  const n = name.toLowerCase()
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg'
  if (n.endsWith('.png')) return 'image/png'
  if (n.endsWith('.webp')) return 'image/webp'
  if (n.endsWith('.gif')) return 'image/gif'
  return null
}

function allowedMime(type: string): boolean {
  return (CHAT_IMAGE_MIME_TYPES as readonly string[]).includes(type)
}

/** Keep files that look like allowed images (MIME or extension, for drag/drop). */
export function pickChatImageFiles(files: File[] | FileList | null | undefined): File[] {
  if (!files?.length) return []
  return Array.from(files as File[]).filter((f) => {
    if (allowedMime(f.type)) return true
    const guess = extensionMime(f.name)
    return guess !== null
  })
}

function validateChatImageFile(file: File): ChatImageUploadErrorKey | null {
  const type = allowedMime(file.type) ? file.type : extensionMime(file.name) || ''
  if (!allowedMime(type)) return 'invalid_type'
  if (file.size > CHAT_IMAGE_MAX_BYTES) return 'too_large'
  return null
}

/** Upload one or more images to /api/upload; validates like the file picker. */
export async function uploadChatImageFiles(
  files: File[]
): Promise<{ urls: string[] } | { error: ChatImageUploadErrorKey }> {
  for (const file of files) {
    const err = validateChatImageFile(file)
    if (err) return { error: err }
  }
  const urls: string[] = []
  for (const file of files) {
    const fd = new FormData()
    fd.set('file', file)
    const r = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' })
    if (!r.ok) return { error: 'upload' }
    const j = (await r.json()) as { url?: string }
    if (!j.url) return { error: 'upload' }
    urls.push(j.url)
  }
  return { urls }
}
