<script setup lang="ts">
import { onMounted } from 'vue'
import { useThemeStore } from './stores/theme'

onMounted(() => {
  useThemeStore().init()
})
</script>

<template>
  <router-view />
</template>
