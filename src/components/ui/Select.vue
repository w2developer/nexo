<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ChevronDown } from '@lucide/vue'
import { cn } from '../../utils/cn'

const modelValue = defineModel({ type: [String, Number], default: '' })

const props = defineProps({
    // Sistema próprio de options: passamos um array de objetos [{ label: '...', value: '...' }]
    options: { type: Array, required: true, default: () => [] },
    placeholder: { type: String, default: 'Selecione uma opção' },
    class: { type: [String, Array, Object], default: '' },
    disabled: { type: Boolean, default: false },
    error: { type: Boolean, default: false },
})

const isOpen = ref(false)
const selectRef = ref(null)

// Encontra o texto (label) do valor selecionado
const selectedLabel = computed(() => {
    const selected = props.options.find((opt) => opt.value === modelValue.value)
    return selected ? selected.label : props.placeholder
})

const toggleDropdown = () => {
    if (!props.disabled) {
        isOpen.value = !isOpen.value
    }
}

const selectOption = (value) => {
    modelValue.value = value
    isOpen.value = false
}

// Lógica para fechar o dropdown ao clicar fora dele
const handleClickOutside = (event) => {
    if (selectRef.value && !selectRef.value.contains(event.target)) {
        isOpen.value = false
    }
}

onMounted(() => {
    document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
    <!-- Wrapper relativo para o dropdown não quebrar o layout -->
    <div ref="selectRef" class="relative w-full">
        
        <!-- Gatilho (Botão que simula o Select) -->
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
            <!-- Texto Selecionado ou Placeholder -->
            <span 
                class="truncate" 
                :class="{ 'text-muted-foreground': !modelValue && modelValue !== 0 }"
            >
                {{ selectedLabel }}
            </span>

            <!-- Ícone Dinâmico com Rotação Fluida -->
            <ChevronDown
                class="h-4 w-4 opacity-50 transition-transform duration-200 ease-in-out"
                :class="{ 'rotate-180': isOpen }"
            />
        </button>

        <!-- Lista de Opções Customizada com Transição -->
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
                class="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-white p-1 text-popover-foreground shadow-md focus:outline-none"
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
    </div>
</template>