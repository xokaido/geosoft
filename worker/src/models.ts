import catalog from './workers_ai_models.generated.json'

export type WorkerAiModel = (typeof catalog.models)[number]

/** Slugs that are obsolete but not always marked deprecated in the catalog snapshot. */
const LEGACY_SLUG_MARKERS = [
  'llama-2-',
  'qwen1.5-',
  'tinyllama',
  'phi-2',
  'bart-large-cnn',
  'whisper-tiny-en',
  'una-cybertron',
  'starling-lm',
  'neural-chat-7b',
  'zephyr-7b-beta',
  'discolm-german',
  'deepseek-math-7b',
  'openchat-3',
  'falcon-7b-instruct',
  'llamaguard-7b',
  'deepseek-coder-6.7b',
  'meta-llama-3-8b-instruct',
  'hermes-2-pro-mistral',
  'openhermes-2.5',
  'mistral-7b-instruct-v0.2',
] as const

function isLegacySlug(slug: string): boolean {
  const s = slug.toLowerCase()
  return LEGACY_SLUG_MARKERS.some((m) => s.includes(m))
}

function keepModel(m: WorkerAiModel): boolean {
  if (m.deprecated) return false
  if (isLegacySlug(m.slug)) return false
  return true
}

export const MODELS: WorkerAiModel[] = catalog.models.filter(keepModel)

export function getModelMeta(id: string): WorkerAiModel | undefined {
  return MODELS.find((m) => m.id === id)
}

/** Model exists in the Workers AI catalog (any task type). */
export function isAllowedModel(id: string): boolean {
  return MODELS.some((m) => m.id === id)
}

/** Model supports the chat UI (`messages` + streaming). */
export function isChatModel(id: string): boolean {
  return MODELS.some((m) => m.id === id && m.chatEligible)
}

export function isVisionModel(id: string): boolean {
  const m = getModelMeta(id)
  return !!m?.vision
}
