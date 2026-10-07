<script setup>
import { computed } from 'vue'
import { cva } from 'class-variance-authority'
import { cn } from '../../utils/cn'

// Define variantes
const buttonVariants = cva(
    'inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
                destructive: 'bg-red-500 text-white shadow-sm hover:bg-red-500/90',
                outline: 'border border-border bg-background shadow-sm hover:bg-muted',
                ghost: 'hover:bg-muted hover:text-foreground',
            },
            size: {
                default: 'h-9 px-4 py-2',
                sm: 'h-8 rounded-md px-3 text-xs',
                lg: 'h-10 rounded-md px-8',
                icon: 'h-9 w-9',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
)

// Propriedades
const props = defineProps({
    variant: {
        type: String,
        default: 'default',
    },
    size: {
        type: String,
        default: 'default',
    },
    as: {
        type: String,
        default: 'button',
    },
    class: {
        type: String,
        default: '',
    },
})

// Mescla classes
const buttonClass = computed(() => {
    return cn(buttonVariants({ variant: props.variant, size: props.size }), props.class)
})
</script>

<template>
    <component :is="as" :class="buttonClass">
        <slot></slot>
    </component>
</template>
