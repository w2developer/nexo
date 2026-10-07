<script setup>
import { provide } from 'vue'

// Define a aba ativa bidirecionalmente
const activeTab = defineModel({ type: String, required: true })

// Fornece o estado globalmente para os filhos
provide('activeTab', activeTab)
</script>

<template>
    <div class="w-full">
        <slot />
    </div>
</template>
