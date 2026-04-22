<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../i18n'

export type UiModel = {
  id: string
  name: string
  type: string
  vision: boolean
}

const props = defineProps<{
  models: UiModel[]
  modelId: string
}>()

const emit = defineEmits<{
  'update:modelId': [value: string]
}>()

const { t } = useI18n()

const textModels = computed(() => props.models.filter((m) => !m.vision))
const visionModels = computed(() => props.models.filter((m) => m.vision))

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
      <optgroup v-if="textModels.length" :label="t('models.groups.text')">
        <option v-for="m in textModels" :key="m.id" :value="m.id">
          {{ m.name }}
        </option>
      </optgroup>
      <optgroup v-if="visionModels.length" :label="t('models.groups.vision')">
        <option v-for="m in visionModels" :key="m.id" :value="m.id">
          {{ m.name }} — {{ t('models.vision_badge') }}
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
