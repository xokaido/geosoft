/**
 * Curated [OpenRouter](https://openrouter.ai/models) chat models (Gemini, GPT, Claude).
 * IDs are OpenRouter `model` strings passed through to `/api/v1/chat/completions`.
 */
export type ChatModelMeta = {
  id: string
  slug: string
  name: string
  task: string
  vision: boolean
  chatEligible: boolean
  deprecated: boolean
}

export const MODELS: ChatModelMeta[] = [
  {
    id: 'google/gemini-2.5-flash',
    slug: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    task: 'Google Gemini',
    vision: true,
    chatEligible: true,
    deprecated: false,
  },
  {
    id: 'google/gemini-3.1-pro-preview',
    slug: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro (preview)',
    task: 'Google Gemini',
    vision: true,
    chatEligible: true,
    deprecated: false,
  },
  {
    id: 'openai/gpt-5.4-mini',
    slug: 'gpt-5.4-mini',
    name: 'GPT-5.4 Mini',
    task: 'OpenAI GPT',
    vision: true,
    chatEligible: true,
    deprecated: false,
  },
  {
    id: 'openai/gpt-5.4',
    slug: 'gpt-5.4',
    name: 'GPT-5.4',
    task: 'OpenAI GPT',
    vision: true,
    chatEligible: true,
    deprecated: false,
  },
  {
    id: '~anthropic/claude-opus-latest',
    slug: 'claude-opus-latest',
    name: 'Claude Opus (latest)',
    task: 'Anthropic Claude',
    vision: true,
    chatEligible: true,
    deprecated: false,
  },
  {
    id: 'anthropic/claude-sonnet-4.6',
    slug: 'claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    task: 'Anthropic Claude',
    vision: true,
    chatEligible: true,
    deprecated: false,
  },
]

export function getModelMeta(id: string): ChatModelMeta | undefined {
  return MODELS.find((m) => m.id === id)
}

export function isAllowedModel(id: string): boolean {
  return MODELS.some((m) => m.id === id)
}

export function isChatModel(id: string): boolean {
  return MODELS.some((m) => m.id === id && m.chatEligible)
}

export function isVisionModel(id: string): boolean {
  const m = getModelMeta(id)
  return !!m?.vision
}
