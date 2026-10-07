<script setup>
import { cn } from '../../utils/cn'
const props = defineProps({ class: { type: String, default: '' } })
</script>

<template>
    <thead :class="cn('[&_tr]:border-b border-border', props.class)">
        <slot />
    </thead>
</template>
