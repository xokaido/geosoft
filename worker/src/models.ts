import catalog from './workers_ai_models.generated.json'

export type WorkerAiModel = (typeof catalog.models)[number]

export const MODELS: WorkerAiModel[] = catalog.models

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
