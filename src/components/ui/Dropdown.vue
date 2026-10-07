<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const isOpen = ref(false)
const triggerRef = ref(null)
const dropdownRef = ref(null)
const positionStyle = ref({})

// Fecha o dropdown atual
const close = () => {
    isOpen.value = false
}

// Alterna o dropdown
const toggle = async () => {
    const wasOpen = isOpen.value
    
    // 1. Dispara um evento global avisando: "Fechem todos os outros dropdowns!"
    document.dispatchEvent(new Event('close-all-dropdowns'))
    
    // 2. Se este dropdown estava fechado, nós o abrimos e calculamos a posição
    if (!wasOpen) {
        isOpen.value = true
        await nextTick()
        calculatePosition()
    }
}

// Calcula exatamente onde o botão está na tela para colar o menu embaixo dele
const calculatePosition = () => {
    if (!triggerRef.value) return
    const rect = triggerRef.value.getBoundingClientRect()
    positionStyle.value = {
        top: `${rect.bottom + 4}px`,
        right: `${window.innerWidth - rect.right}px`,
    }
}

// Substitui o useClickOutside para lidar com o Teleport corretamente
const handleClickOutside = (e) => {
    if (isOpen.value) {
        const isClickInsideTrigger = triggerRef.value?.contains(e.target)
        const isClickInsideDropdown = dropdownRef.value?.contains(e.target)
        
        if (!isClickInsideTrigger && !isClickInsideDropdown) {
            close()
        }
    }
}

// REGRA DE OURO: Se o usuário rolar a tela ou a tabela, o menu fecha.
// Isso impede que o menu fique flutuando sozinho pela tela.
const handleScroll = () => {
    if (isOpen.value) close()
}

const handleKeydown = (e) => {
    if (e.key === 'Escape' && isOpen.value) close()
}

onMounted(() => {
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleKeydown)
    
    // Escuta o aviso para fechar quando outro dropdown for aberto
    document.addEventListener('close-all-dropdowns', close)
    
    // O 'true' no final faz com que ele detecte o scroll de qualquer elemento (como a tabela)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', close)
})

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
    document.removeEventListener('keydown', handleKeydown)
    document.removeEventListener('close-all-dropdowns', close)
    window.removeEventListener('scroll', handleScroll, true)
    window.removeEventListener('resize', close)
})
</script>

<template>
    <div ref="triggerRef" class="relative inline-block text-left">
        <!-- Trigger (Botão ou Avatar) -->
        <div @click.stop="toggle" class="cursor-pointer">
            <slot name="trigger" />
        </div>

        <!-- Conteúdo do Menu (Teleportado para evitar corte do overflow da Tabela) -->
        <Teleport to="body">
            <Transition
                enter-active-class="transition ease-out duration-100"
                enter-from-class="transform opacity-0 scale-95"
                enter-to-class="transform opacity-100 scale-100"
                leave-active-class="transition ease-in duration-75"
                leave-from-class="transform opacity-100 scale-100"
                leave-to-class="transform opacity-0 scale-95"
            >
                <div
                    v-if="isOpen"
                    ref="dropdownRef"
                    :style="positionStyle"
                    class="fixed z-[9999] w-56 origin-top-right rounded-md border border-border bg-background shadow-lg focus:outline-none"
                >
                    <div class="py-1" @click="close">
                        <slot name="content" />
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>