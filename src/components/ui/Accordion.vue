<script setup>
import { provide } from 'vue'

// Controla qual item está aberto via v-model
const activeItem = defineModel({ type: String, default: '' })

const toggle = (val) => {
    activeItem.value = activeItem.value === val ? '' : val
}

// Fornece o estado e a função de toggle para os filhos
provide('accordionState', { activeItem, toggle })
</script>

<template>
    <div class="w-full">
        <slot />
    </div>
</template>
