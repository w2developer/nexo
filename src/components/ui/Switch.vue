<script setup>
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
        role="switch"
        :id="props.id"
        :aria-checked="modelValue"
        :disabled="props.disabled"
        @click="toggle"
        :class="
            cn(
                'peer inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                modelValue ? 'bg-primary' : 'bg-muted-foreground/30',
                props.class,
            )
        "
    >
        <!-- Bolinha animada -->
        <span
            :class="
                cn(
                    'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
                    modelValue ? 'translate-x-5' : 'translate-x-0',
                )
            "
        />
    </button>
</template>
