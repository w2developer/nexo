<script setup>
import { ref } from 'vue'
import { cn } from '../../utils/cn'

const props = defineProps({
    content: { type: String, required: true },
    position: { type: String, default: 'top' }, // top, bottom, right, left
})

const isVisible = ref(false)
</script>

<template>
    <div
        class="relative inline-block"
        @mouseenter="isVisible = true"
        @mouseleave="isVisible = false"
        @focus="isVisible = true"
        @blur="isVisible = false"
    >
        <!-- Elemento Gatilho -->
        <slot />

        <!-- Conteúdo do Tooltip -->
        <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
        >
            <div
                v-show="isVisible"
                :class="
                    cn(
                        'absolute z-50 rounded-md bg-foreground px-3 py-1.5 text-xs text-background shadow-md whitespace-nowrap pointer-events-none',
                        position === 'top' &&
                            'bottom-full left-1/2 -translate-x-1/2 -translate-y-2',
                        position === 'bottom' && 'top-full left-1/2 -translate-x-1/2 translate-y-2',
                        position === 'right' && 'left-full top-1/2 -translate-y-1/2 translate-x-2',
                        position === 'left' && 'right-full top-1/2 -translate-y-1/2 -translate-x-2',
                    )
                "
            >
                {{ content }}

                <!-- Pequena seta invisível para dar espaçamento -->
                <div
                    :class="
                        cn(
                            'absolute h-2 w-2 rotate-45 bg-foreground',
                            position === 'top' &&
                                'top-full left-1/2 -translate-x-1/2 -translate-y-1',
                            position === 'bottom' &&
                                'bottom-full left-1/2 -translate-x-1/2 translate-y-1',
                            position === 'right' &&
                                'right-full top-1/2 -translate-y-1/2 translate-x-1',
                            position === 'left' &&
                                'left-full top-1/2 -translate-y-1/2 -translate-x-1',
                        )
                    "
                />
            </div>
        </Transition>
    </div>
</template>
