export const MODELS = [
  {
    id: '@cf/meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B',
    type: 'text',
    vision: false,
  },
  {
    id: '@cf/meta/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B',
    type: 'text',
    vision: false,
  },
  {
    id: '@cf/meta/llama-3.2-11b-vision-instruct',
    name: 'Llama 3.2 11B Vision',
    type: 'text',
    vision: true,
  },
  {
    id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    name: 'Llama 3.3 70B Fast',
    type: 'text',
    vision: false,
  },
  {
    id: '@cf/google/gemma-3-12b-it',
    name: 'Gemma 3 12B',
    type: 'text',
    vision: false,
  },
  {
    id: '@cf/mistral/mistral-7b-instruct-v0.1',
    name: 'Mistral 7B',
    type: 'text',
    vision: false,
  },
  {
    id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    name: 'DeepSeek R1 32B',
    type: 'text',
    vision: false,
  },
  {
    id: '@cf/qwen/qwen2.5-coder-32b-instruct',
    name: 'Qwen 2.5 Coder 32B',
    type: 'text',
    vision: false,
  },
] as const

export type ModelId = (typeof MODELS)[number]['id']

export function isVisionModel(model: string): boolean {
  return MODELS.some((m) => m.id === model && m.vision)
}

export function isAllowedModel(model: string): boolean {
  return MODELS.some((m) => m.id === model)
}
