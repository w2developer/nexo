<script setup>
    import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
    import { ChevronDown } from '@lucide/vue'
    import { cn } from '../../utils/cn'

    const modelValue = defineModel({ type: [String, Number], default: '' })

    const props = defineProps({
        // Lista de opções no formato [{ label: '...', value: '...' }]
        options: { type: Array, required: true, default: () => [] },
        placeholder: { type: String, default: 'Selecione uma opção' },
        class: { type: [String, Array, Object], default: '' },
        disabled: { type: Boolean, default: false },
        error: { type: Boolean, default: false },
    })

    const isOpen = ref(false)
    const selectRef = ref(null)
    const dropdownRef = ref(null)
    const dropdownStyle = ref({})

    // Retorna o label da opção selecionada
    const selectedLabel = computed(() => {
        const selected = props.options.find((opt) => opt.value === modelValue.value)
        return selected ? selected.label : props.placeholder
    })

    // Calcula a posição exata do botão na tela
    const updatePosition = () => {
        if (!selectRef.value || !isOpen.value) return
        const rect = selectRef.value.getBoundingClientRect()
        dropdownStyle.value = {
            position: 'fixed',
            top: `${rect.bottom + 4}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            zIndex: 9999,
        }
    }

    const toggleDropdown = async () => {
        if (props.disabled) return
        isOpen.value = !isOpen.value
        if (isOpen.value) {
            await nextTick()
            updatePosition()
        }
    }

    const selectOption = (value) => {
        modelValue.value = value
        isOpen.value = false
    }

    // Fecha ao clicar fora do botão e do menu teleportado
    const handleClickOutside = (event) => {
        const clicouNoBotao = selectRef.value && selectRef.value.contains(event.target)
        const clicouNoMenu = dropdownRef.value && dropdownRef.value.contains(event.target)

        if (!clicouNoBotao && !clicouNoMenu) {
            isOpen.value = false
        }
    }

    // Atualiza posição ao rolar ou redimensionar a tela somente quando aberto
    watch(isOpen, (aberto) => {
        if (aberto) {
            window.addEventListener('scroll', updatePosition, true)
            window.addEventListener('resize', updatePosition)
        } else {
            window.removeEventListener('scroll', updatePosition, true)
            window.removeEventListener('resize', updatePosition)
        }
    })

    onMounted(() => {
        document.addEventListener('click', handleClickOutside)
    })

    onUnmounted(() => {
        document.removeEventListener('click', handleClickOutside)
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
    })
</script>

<template>
    <!-- Wrapper relativo do gatilho -->
    <div ref="selectRef" class="relative w-full">
        <!-- Botão do Select -->
        <button
            type="button"
            @click="toggleDropdown"
            :disabled="disabled"
            :aria-expanded="isOpen"
            :class="
                cn(
                    'flex h-9 w-full items-center justify-between rounded-md border bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50',
                    error
                        ? 'border-destructive focus-visible:ring-destructive'
                        : 'border-border focus-visible:ring-ring',
                    props.class
                )
            "
        >
            <!-- Texto selecionado ou placeholder -->
            <span 
                class="truncate" 
                :class="{ 'text-muted-foreground': !modelValue && modelValue !== 0 }"
            >
                {{ selectedLabel }}
            </span>

            <!-- Ícone com rotação -->
            <ChevronDown
                class="h-4 w-4 opacity-50 transition-transform duration-200 ease-in-out"
                :class="{ 'rotate-180': isOpen }"
            />
        </button>

        <!-- Menu teleportado para o body para ignorar qualquer overflow-hidden -->
        <Teleport to="body">
            <transition
                enter-active-class="transition ease-out duration-100"
                enter-from-class="transform opacity-0 scale-95 translate-y-[-10px]"
                enter-to-class="transform opacity-100 scale-100 translate-y-0"
                leave-active-class="transition ease-in duration-75"
                leave-from-class="transform opacity-100 scale-100 translate-y-0"
                leave-to-class="transform opacity-0 scale-95 translate-y-[-10px]"
            >
                <ul
                    v-if="isOpen"
                    ref="dropdownRef"
                    :style="dropdownStyle"
                    class="max-h-60 overflow-auto rounded-md border border-border bg-white p-1 text-popover-foreground shadow-md focus:outline-none"
                >
                    <li
                        v-if="options.length === 0"
                        class="px-2 py-1.5 text-sm text-muted-foreground text-center"
                    >
                        Nenhuma opção disponível
                    </li>

                    <li
                        v-for="option in options"
                        :key="option.value"
                        @click="selectOption(option.value)"
                        :class="
                            cn(
                                'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-3 pr-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
                                modelValue === option.value ? 'bg-primary/8 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )
                        "
                    >
                        {{ option.label }}
                    </li>
                </ul>
            </transition>
        </Teleport>
    </div>
</template>