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

/** Smaller request bodies help multi-image / vision routing; no-op for GIF. */
const DOWNSCALE_MAX_EDGE = 2048
const DOWNSCALE_JPEG_Q = 0.82
const DOWNSCALE_MIN_BYTES = 500_000

export async function prepareChatImageFileForUpload(file: File): Promise<File> {
  if (file.type === 'image/gif') return file
  if (file.size < DOWNSCALE_MIN_BYTES) return file
  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') return file
  try {
    const bmp = await createImageBitmap(file)
    const w = bmp.width
    const h = bmp.height
    const maxD = Math.max(w, h)
    const overSized = maxD > DOWNSCALE_MAX_EDGE
    const overWeight = file.size >= 1_200_000
    if (!overSized && !overWeight) {
      bmp.close()
      return file
    }
    const scale = overSized ? DOWNSCALE_MAX_EDGE / maxD : 1
    const tw = Math.max(1, Math.round(w * scale))
    const th = Math.max(1, Math.round(h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bmp.close()
      return file
    }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bmp, 0, 0, tw, th)
    bmp.close()
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, 'image/jpeg', DOWNSCALE_JPEG_Q)
    )
    if (!blob) return file
    if (blob.size >= file.size) return file
    if (blob.size > CHAT_IMAGE_MAX_BYTES) return file
    const base = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${base || 'image'}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
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
    const toSend = await prepareChatImageFileForUpload(file)
    const toSendErr = validateChatImageFile(toSend)
    if (toSendErr) {
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
      return { error: toSendErr }
    }
    onUpdate?.({
      id,
      file: toSend,
      index,
      total,
      status: 'uploading',
      loaded: 0,
      size: toSend.size,
      percent: 0,
    })
    const result = await uploadOneWithProgress(toSend, {
      onProgress(loaded, totalBytes) {
        const pct =
          totalBytes > 0 ? Math.max(0, Math.min(100, Math.round((loaded / totalBytes) * 100))) : 0
        onUpdate?.({
          id,
          file: toSend,
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
        file: toSend,
        index,
        total,
        status: 'error',
        loaded: 0,
        size: toSend.size,
        percent: 0,
      })
      return { error: 'upload' }
    }
    urls.push(result.url)
    onUpdate?.({
      id,
      file: toSend,
      index,
      total,
      status: 'done',
      loaded: toSend.size,
      size: toSend.size,
      percent: 100,
      url: result.url,
    })
  }
  return { urls }
}
