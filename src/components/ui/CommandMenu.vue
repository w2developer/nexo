<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Search } from '@lucide/vue'
import { useClickOutside } from '../../composables/useClickOutside'
import { useCommandMenu } from '../../composables/useCommandMenu'
import { cn } from '../../utils/cn'

const props = defineProps({
    actions: {
        type: Array,
        default: () => [],
    },
})

const { isOpen, toggle } = useCommandMenu()

const searchQuery = ref('')
const selectedIndex = ref(0)
const inputRef = ref(null)
const menuRef = ref(null)

// Ouve o atalho Ctrl+K ou Cmd+K globalmente
const handleGlobalKeydown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        toggle() // <-- Usa a função do composable
    }
}

onMounted(() => document.addEventListener('keydown', handleGlobalKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleGlobalKeydown))

// Filtra as ações com base na busca
const filteredActions = computed(() => {
    if (!searchQuery.value) return props.actions
    const lower = searchQuery.value.toLowerCase()
    return props.actions.filter(
        (a) =>
            a.title.toLowerCase().includes(lower) ||
            (a.description && a.description.toLowerCase().includes(lower)),
    )
})

// Reseta o estado e foca no input ao abrir
watch(isOpen, async (val) => {
    if (val) {
        document.body.style.overflow = 'hidden'
        searchQuery.value = ''
        selectedIndex.value = 0
        await nextTick()
        inputRef.value?.focus()
    } else {
        document.body.style.overflow = ''
    }
})

// Zera a seleção ao digitar
watch(searchQuery, () => {
    selectedIndex.value = 0
})

// Fecha ao clicar fora
useClickOutside(menuRef, () => {
    if (isOpen.value) isOpen.value = false
})

// Navegação por teclado (Setas e Enter)
const handleKeydown = (e) => {
    if (!isOpen.value) return

    if (e.key === 'Escape') {
        isOpen.value = false
        return
    }

    if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (selectedIndex.value < filteredActions.value.length - 1) {
            selectedIndex.value++
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (selectedIndex.value > 0) {
            selectedIndex.value--
        }
    } else if (e.key === 'Enter') {
        e.preventDefault()
        const action = filteredActions.value[selectedIndex.value]
        if (action) executeAction(action)
    }
}

// Executa a função mapeada e fecha o menu
const executeAction = (action) => {
    if (action.onSelect) action.onSelect()
    isOpen.value = false
}
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <!-- Overlay escuro -->
            <div
                v-if="isOpen"
                class="fixed inset-0 z-[100] flex items-start justify-center bg-black/80 p-4 pt-[10vh] backdrop-blur-sm"
            >
                <!-- Container Principal -->
                <Transition
                    enter-active-class="transition-all duration-200 ease-out delay-75"
                    enter-from-class="scale-95 opacity-0 translate-y-4"
                    enter-to-class="scale-100 opacity-100 translate-y-0"
                    leave-active-class="transition-all duration-150 ease-in"
                    leave-from-class="scale-100 opacity-100"
                    leave-to-class="scale-95 opacity-0"
                    appear
                >
                    <div
                        v-if="isOpen"
                        ref="menuRef"
                        @keydown="handleKeydown"
                        class="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
                    >
                        <!-- Input de Busca -->
                        <div class="flex items-center border-b border-border px-4">
                            <Search class="mr-2 h-5 w-5 shrink-0 opacity-50" />
                            <input
                                ref="inputRef"
                                v-model="searchQuery"
                                class="flex h-14 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Digite um comando ou busque..."
                                autocomplete="off"
                            />
                            <kbd
                                class="pointer-events-none ml-2 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex text-muted-foreground"
                            >
                                ESC
                            </kbd>
                        </div>

                        <!-- Lista de Resultados -->
                        <div class="max-h-[60vh] overflow-y-auto p-2">
                            <div
                                v-if="filteredActions.length === 0"
                                class="py-14 text-center text-sm text-muted-foreground"
                            >
                                Nenhum resultado encontrado.
                            </div>

                            <div class="space-y-1">
                                <button
                                    v-for="(action, index) in filteredActions"
                                    :key="action.title"
                                    @click="executeAction(action)"
                                    @mouseenter="selectedIndex = index"
                                    :class="
                                        cn(
                                            'flex w-full cursor-default select-none items-center rounded-md px-3 py-3 text-sm outline-none transition-colors',
                                            selectedIndex === index
                                                ? 'bg-muted text-foreground'
                                                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                                        )
                                    "
                                >
                                    <component
                                        :is="action.icon"
                                        v-if="action.icon"
                                        class="mr-3 h-4 w-4 shrink-0"
                                    />
                                    <div class="flex flex-col items-start">
                                        <span class="font-medium">{{ action.title }}</span>
                                        <span
                                            v-if="action.description"
                                            class="text-xs text-muted-foreground line-clamp-1"
                                        >
                                            {{ action.description }}
                                        </span>
                                    </div>
                                    <kbd
                                        v-if="action.shortcut"
                                        class="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground"
                                    >
                                        {{ action.shortcut }}
                                    </kbd>
                                </button>
                            </div>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>
