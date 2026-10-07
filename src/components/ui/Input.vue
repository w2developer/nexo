<script setup>
import { cn } from '../../utils/cn'

// Gerencia v-model bidirecionalmente
const modelValue = defineModel({ type: [String, Number], default: '' })

const props = defineProps({
    type: { type: String, default: 'text' },
    class: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    error: { type: Boolean, default: false },
})
</script>

<template>
    <input
        v-model="modelValue"
        :type="props.type"
        :disabled="props.disabled"
        :class="
            cn(
                'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50',
                props.error
                    ? 'border-destructive focus-visible:ring-destructive'
                    : 'border-border focus-visible:ring-ring',
                props.class,
            )
        "
    />
</template>
