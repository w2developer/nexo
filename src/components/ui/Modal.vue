<script setup>
import { watch, onMounted, onUnmounted, ref } from 'vue'
import { X } from '@lucide/vue'
import { cva } from 'class-variance-authority'
import { cn } from '../../utils/cn'
import Button from './Button.vue'
import { useClickOutside } from '../../composables/useClickOutside'

// Macro do Vue 3.4+ que gerencia modelValue e update:modelValue automaticamente
const isOpen = defineModel({ type: Boolean, default: false })

const props = defineProps({
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    size: { type: String, default: 'md' },
})

const modalRef = ref(null)

// Fecha o modal
const close = () => {
    isOpen.value = false
}

// Fecha ao clicar fora do painel
useClickOutside(modalRef, () => {
    if (isOpen.value) close()
})

// Fecha ao pressionar Esc
const handleKeydown = (e) => {
    if (e.key === 'Escape' && isOpen.value) {
        close()
    }
}

// Trava o scroll do body
watch(isOpen, (val) => {
    if (val) {
        document.body.style.overflow = 'hidden'
    } else {
        document.body.style.overflow = ''
    }
})

// Ciclo de vida dos eventos de teclado
onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = ''
})

// Variantes para a largura máxima do modal
const modalVariants = cva(
    'relative w-full rounded-lg border border-border bg-background p-6 shadow-lg',
    {
        variants: {
            size: {
                sm: 'sm:max-w-sm',
                md: 'sm:max-w-lg',
                lg: 'sm:max-w-2xl',
                xl: 'sm:max-w-4xl',
                full: 'sm:max-w-[calc(100vw-2rem)] sm:h-[calc(100vh-2rem)]',
            },
        },
        defaultVariants: {
            size: 'md',
        },
    },
)
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-all duration-200 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <!-- Overlay escuro -->
            <div
                v-if="isOpen"
                class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            >
                <!-- Painel do Modal com animação de escala -->
                <Transition
                    enter-active-class="transition-all duration-300 ease-out delay-75"
                    enter-from-class="scale-95 opacity-0 translate-y-4"
                    enter-to-class="scale-100 opacity-100 translate-y-0"
                    leave-active-class="transition-all duration-200 ease-in"
                    leave-from-class="scale-100 opacity-100"
                    leave-to-class="scale-95 opacity-0"
                    appear
                >
                    <div v-if="isOpen" ref="modalRef" :class="cn(modalVariants({ size }))">
                        <!-- Cabeçalho -->
                        <div class="mb-4 flex items-start justify-between">
                            <div>
                                <h2 v-if="title" class="text-lg font-semibold text-foreground">
                                    {{ title }}
                                </h2>
                                <p v-if="description" class="text-sm text-muted-foreground mt-1">
                                    {{ description }}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                @click="close"
                                class="-mt-2 -mr-2 shrink-0"
                            >
                                <X class="h-4 w-4" />
                            </Button>
                        </div>

                        <!-- Conteúdo Central -->
                        <div class="space-y-4">
                            <slot />
                        </div>

                        <!-- Rodapé (opcional via slot) -->
                        <div
                            v-if="$slots.footer"
                            class="mt-6 flex justify-end gap-3 border-t border-border pt-4"
                        >
                            <slot name="footer" />
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>
