<script setup>
import { X, CheckCircle2, AlertCircle, Info } from '@lucide/vue'
import { useToast } from '../../composables/useToast'
import { cn } from '../../utils/cn'

// Consome o estado global
const { toasts, remove } = useToast()

// Dicionário de estilos
const variantStyles = {
    default: 'bg-background border-border text-foreground',
    success: 'bg-green-50 border-green-200 text-green-800',
    destructive: 'bg-red-50 border-red-200 text-red-800',
}

// Dicionário de ícones
const variantIcons = {
    default: Info,
    success: CheckCircle2,
    destructive: AlertCircle,
}
</script>

<template>
    <div
        class="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px] gap-2 pointer-events-none"
    >
        <TransitionGroup
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="translate-x-full opacity-0"
            enter-to-class="translate-x-0 opacity-100"
            leave-active-class="transition-all duration-200 ease-in absolute w-full"
            leave-from-class="translate-x-0 opacity-100"
            leave-to-class="translate-x-full opacity-0"
            move-class="transition-all duration-300"
        >
            <div
                v-for="t in toasts"
                :key="t.id"
                :class="
                    cn(
                        'pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 shadow-lg',
                        variantStyles[t.variant] || variantStyles.default,
                    )
                "
            >
                <div class="flex items-start gap-3 w-full">
                    <component
                        :is="variantIcons[t.variant] || variantIcons.default"
                        class="h-5 w-5 shrink-0 mt-0.5"
                    />
                    <div class="flex-1 grid gap-1">
                        <h3 class="text-sm font-semibold leading-none tracking-tight">
                            {{ t.title }}
                        </h3>
                        <p v-if="t.description" class="text-[0.8rem] opacity-90">
                            {{ t.description }}
                        </p>
                    </div>
                    <button
                        @click="remove(t.id)"
                        class="inline-flex shrink-0 rounded-md p-1 opacity-50 hover:opacity-100 focus:outline-none"
                    >
                        <X class="h-4 w-4" />
                    </button>
                </div>
            </div>
        </TransitionGroup>
    </div>
</template>
