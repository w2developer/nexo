<script setup>
import { cn } from '../../utils/cn'
import { cva } from 'class-variance-authority'

const badgeVariants = cva(
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    {
        variants: {
            variant: {
                default:
                    'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
                secondary: 'border-transparent bg-muted text-foreground hover:bg-muted/80',
                destructive: 'border-transparent bg-red-500 text-white hover:bg-red-500/80',
                outline: 'text-foreground border-border',
                success: 'border-transparent bg-green-500/10 text-green-600',
                ghost: 'border-transparent bg-transparent text-foreground'
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
)

const props = defineProps({
    variant: { type: String, default: 'default' },
    class: { type: String, default: '' },
})
</script>

<template>
    <div :class="cn(badgeVariants({ variant }), props.class)">
        <slot />
    </div>
</template>
