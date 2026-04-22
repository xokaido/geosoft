<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../i18n'

export type UiModel = {
  id: string
  name: string
  task: string
  vision: boolean
  chatEligible: boolean
  deprecated: boolean
}

const props = defineProps<{
  models: UiModel[]
  modelId: string
}>()

const emit = defineEmits<{
  'update:modelId': [value: string]
}>()

const { t } = useI18n()

const taskRank = (task: string) => {
  const order = [
    'Google Gemini',
    'OpenAI GPT',
    'Anthropic Claude',
    'Text Generation',
    'Text Embeddings',
    'Text Classification',
    'Text-to-Image',
    'Image-to-Text',
    'Automatic Speech Recognition',
    'Text-to-Speech',
    'Translation',
    'Summarization',
    'Object Detection',
    'Image Classification',
    'Voice Activity Detection',
  ]
  const i = order.indexOf(task)
  return i === -1 ? 999 : i
}

const grouped = computed(() => {
  const map = new Map<string, UiModel[]>()
  for (const m of props.models) {
    if (!map.has(m.task)) map.set(m.task, [])
    map.get(m.task)!.push(m)
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.name.localeCompare(b.name))
  }
  return [...map.entries()].sort((a, b) => {
    const d = taskRank(a[0]) - taskRank(b[0])
    return d !== 0 ? d : a[0].localeCompare(b[0])
  })
})

function label(m: UiModel): string {
  let s = m.name
  if (m.deprecated) s += ` (${t('models.deprecated')})`
  if (m.chatEligible && m.vision) s += ` — ${t('models.vision_badge')}`
  return s
}

function onChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  emit('update:modelId', v)
}
</script>

<template>
  <label class="wrap">
    <span class="label">{{ t('models.label') }}</span>
    <select class="select" :value="modelId" @change="onChange">
      <option disabled value="">{{ t('models.placeholder') }}</option>
      <optgroup v-for="[task, list] in grouped" :key="task" :label="task">
        <option
          v-for="m in list"
          :key="m.id"
          :value="m.id"
          :disabled="!m.chatEligible"
          :title="!m.chatEligible ? task : undefined"
        >
          {{ label(m) }}
        </option>
      </optgroup>
    </select>
  </label>
</template>

<style scoped>
.wrap {
  display: grid;
  gap: 8px;
}
.label {
  font-size: 12px;
  color: var(--muted);
}
.select {
  width: 100%;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 10px;
  padding: 10px 10px;
}
</style>
