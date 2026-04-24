export const CHAT_IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const CHAT_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

export type ChatImageUploadErrorKey = 'invalid_type' | 'too_large' | 'upload'
export type UploadStatus = 'queued' | 'uploading' | 'done' | 'error'

export type UploadProgressUpdate = {
  id: string
  file: File
  index: number
  total: number
  status: UploadStatus
  loaded: number
  size: number
  percent: number
  url?: string
}

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

function uploadOneWithProgress(
  file: File,
  opts: {
    onProgress?: (loaded: number, total: number) => void
  }
): Promise<{ url: string } | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/upload')
    xhr.withCredentials = true

    xhr.upload.onprogress = (e) => {
      if (!opts.onProgress) return
      const total = e.total && Number.isFinite(e.total) ? e.total : file.size
      opts.onProgress(e.loaded, total)
    }
    xhr.onerror = () => resolve(null)
    xhr.onabort = () => resolve(null)
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) return resolve(null)
      try {
        const j = JSON.parse(xhr.responseText) as { url?: string }
        if (!j.url) return resolve(null)
        resolve({ url: j.url })
      } catch {
        resolve(null)
      }
    }

    const fd = new FormData()
    fd.set('file', file)
    xhr.send(fd)
  })
}

/** Upload one or more images to /api/upload; validates like the file picker. */
export async function uploadChatImageFilesWithProgress(
  files: File[],
  onUpdate?: (u: UploadProgressUpdate) => void
): Promise<{ urls: string[] } | { error: ChatImageUploadErrorKey }> {
  for (const file of files) {
    const err = validateChatImageFile(file)
    if (err) return { error: err }
  }
  const urls: string[] = []
  const total = files.length
  for (let index = 0; index < files.length; index++) {
    const file = files[index]
    const id = crypto.randomUUID()
    onUpdate?.({
      id,
      file,
      index,
      total,
      status: 'queued',
      loaded: 0,
      size: file.size,
      percent: 0,
    })
    onUpdate?.({
      id,
      file,
      index,
      total,
      status: 'uploading',
      loaded: 0,
      size: file.size,
      percent: 0,
    })
    const result = await uploadOneWithProgress(file, {
      onProgress(loaded, totalBytes) {
        const pct =
          totalBytes > 0 ? Math.max(0, Math.min(100, Math.round((loaded / totalBytes) * 100))) : 0
        onUpdate?.({
          id,
          file,
          index,
          total,
          status: 'uploading',
          loaded,
          size: totalBytes,
          percent: pct,
        })
      },
    })
    if (!result?.url) {
      onUpdate?.({
        id,
        file,
        index,
        total,
        status: 'error',
        loaded: 0,
        size: file.size,
        percent: 0,
      })
      return { error: 'upload' }
    }
    urls.push(result.url)
    onUpdate?.({
      id,
      file,
      index,
      total,
      status: 'done',
      loaded: file.size,
      size: file.size,
      percent: 100,
      url: result.url,
    })
  }
  return { urls }
}
