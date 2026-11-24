<script setup>
import { watch, onMounted, onUnmounted } from 'vue'
import { X } from '@lucide/vue'
import { cva } from 'class-variance-authority'
import { cn } from '../../utils/cn'
import Button from './Button.vue'

const isOpen = defineModel({ type: Boolean, default: false })

const props = defineProps({
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    size: { type: String, default: 'md' },
})

const close = () => {
    isOpen.value = false
}

const handleKeydown = (e) => {
    if (e.key === 'Escape' && isOpen.value) {
        close()
    }
}

watch(isOpen, (val) => {
    if (val) {
        document.body.style.overflow = 'hidden'
    } else {
        document.body.style.overflow = ''
    }
})

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = ''
})

const modalVariants = cva(
    // Adicionado shadow-2xl, flex-col e max-h-[90vh] para controle interno
    'relative w-full rounded-xl border border-border bg-background p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh]',
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
        <!-- Overlay separado do painel para evitar encavalamento de transições -->
        <Transition
            enter-active-class="transition-opacity duration-200 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-200 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <div
                v-if="isOpen"
                class="fixed inset-0 z-[100] bg-black/60"
                @mousedown="close"
            />
        </Transition>

        <!-- Painel Central -->
        <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 scale-95 translate-y-2"
            enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 scale-100 translate-y-0"
            leave-to-class="opacity-0 scale-95 translate-y-2"
        >
            <!-- Wrapper fixo que não bloqueia cliques, usado apenas para alinhamento -->
            <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
                
                <!-- O modal em si que recebe os eventos de clique -->
                <div :class="cn(modalVariants({ size }), 'pointer-events-auto')">
                    
                    <!-- Cabeçalho (shrink-0 impede que amasse caso o conteúdo cresça) -->
                    <div class="mb-4 flex items-start justify-between gap-4 shrink-0">
                        <div>
                            <h2 v-if="title" class="text-lg font-semibold text-foreground tracking-tight">
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
                            class="-mt-1 -mr-1 h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                            <X class="h-4 w-4" />
                        </Button>
                    </div>

                    <!-- Conteúdo Central com controle de overflow -->
                    <div class="overflow-y-auto pr-1 -mr-1 space-y-4">
                        <slot />
                    </div>

                    <!-- Rodapé -->
                    <div
                        v-if="$slots.footer"
                        class="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-border pt-4 shrink-0"
                    >
                        <slot name="footer" />
                    </div>
                </div>

            </div>
        </Transition>
    </Teleport>
</template>