<script setup>
import { cn } from '../../utils/cn'

// Gerencia v-model
const modelValue = defineModel({ type: [String, Number], default: '' })

const props = defineProps({
    class: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    error: { type: Boolean, default: false },
})
</script>

<template>
    <textarea
        v-model="modelValue"
        :disabled="props.disabled"
        :class="
            cn(
                'flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50',
                props.error
                    ? 'border-destructive focus-visible:ring-destructive'
                    : 'border-border focus-visible:ring-ring',
                props.class,
            )
        "
    />
</template>
