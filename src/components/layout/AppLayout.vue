<script setup>
import { ref, provide, watch, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import Toaster from '../ui/Toaster.vue'

const props = defineProps({
    navigation: {
        type: Array,
        default: () => [],
    },
})

const route = useRoute()

// Referência da tag <main> que controla o scroll
const mainContent = ref(null)

// Estado do menu mobile
const isMobileOpen = ref(false)

const toggleMobile = () => {
    isMobileOpen.value = !isMobileOpen.value
}

// Volta o scroll para o topo (e fecha o menu mobile) ao mudar de rota
watch(
    () => route.fullPath,
    async () => {
        isMobileOpen.value = false
        await nextTick()
        if (mainContent.value) {
            mainContent.value.scrollTop = 0
        }
    }
)

// Bloqueia scroll quando menu mobile estiver aberto
watch(isMobileOpen, (val) => {
    if (val) {
        document.body.style.overflow = 'hidden'
    } else {
        document.body.style.overflow = ''
    }
})

// Previne travamento de scroll caso o layout seja destruído
onUnmounted(() => {
    document.body.style.overflow = ''
})

// Compartilha os dados com a Navbar e Sidebar filhas
provide('navigation', props.navigation)
provide('isMobileOpen', isMobileOpen)
provide('toggleMobile', toggleMobile)
</script>

<template>
    <div class="flex h-screen overflow-hidden bg-background text-foreground">
        <!-- Slot da Sidebar -->
        <slot name="sidebar"></slot>

        <!-- Coluna Principal (Navbar + Conteúdo) -->
        <div class="flex flex-col flex-1 overflow-hidden w-full">
            <!-- Slot da Navbar -->
            <slot name="navbar"></slot>

            <!-- Área rolável do conteúdo com a ref adicionada -->
            <main ref="mainContent" class="flex-1 overflow-y-auto outline-none" tabindex="-1">
                <slot></slot>
            </main>
        </div>

        <!-- Overlay de fundo para mobile -->
        <div
            v-if="isMobileOpen"
            class="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
            @click="toggleMobile"
        ></div>

        <!-- Componente de notificações global -->
        <Toaster />
    </div>
</template>