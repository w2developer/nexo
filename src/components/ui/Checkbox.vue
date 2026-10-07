<script setup>
import { Check } from '@lucide/vue'
import { cn } from '../../utils/cn'

// Gerencia o estado boolean
const modelValue = defineModel({ type: Boolean, default: false })

const props = defineProps({
    id: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    class: { type: String, default: '' },
})

// Alterna o valor
const toggle = () => {
    if (!props.disabled) modelValue.value = !modelValue.value
}
</script>

<template>
    <button
        type="button"
        role="checkbox"
        :id="props.id"
        :aria-checked="modelValue"
        :disabled="props.disabled"
        @click="toggle"
        :class="
            cn(
                'peer h-4 w-4 shrink-0 rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                modelValue
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-primary bg-transparent',
                props.class,
            )
        "
    >
        <Check v-if="modelValue" class="h-3 w-3" />
    </button>
</template>
