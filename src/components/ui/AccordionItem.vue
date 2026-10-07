<script setup>
import { provide } from 'vue'
import { cn } from '../../utils/cn'

const props = defineProps({
    value: { type: String, required: true },
    class: { type: String, default: '' },
})

// Fornece o valor específico deste item para o Trigger e Content
provide('accordionItemValue', props.value)
</script>

<template>
    <div :class="cn('border-b border-border', props.class)">
        <slot />
    </div>
</template>
