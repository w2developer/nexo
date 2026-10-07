<script setup>
import { cn } from '../../utils/cn'
const props = defineProps({ class: { type: String, default: '' } })
</script>
<template>
    <div
        :class="
            cn('rounded-lg border border-border bg-background text-foreground shadow', props.class)
        "
    >
        <slot></slot>
    </div>
</template>
