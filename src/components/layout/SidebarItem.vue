<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown } from '@lucide/vue'
import { cn } from '../../utils/cn'

const props = defineProps({
    item: {
        type: Object,
        required: true,
    },
})

const route = useRoute()

// Controle de estado do submenu
const isOpen = ref(false)
const hasChildren = computed(() => !!props.item.children?.length)

// Verifica rota ativa dinamicamente pelo Vue Router
const isActive = computed(() => route.path === props.item.to)

// Fechar sidebar no mobile após o clique
import { inject } from 'vue'
const isMobileOpen = inject('isMobileOpen', null)
const closeMobile = () => {
    if (isMobileOpen && isMobileOpen.value) {
        isMobileOpen.value = false
    }
}
</script>

<template>
    <li class="list-none">
        <!-- Renderiza como botão se tiver filhos (Submenu) -->
        <button
            v-if="hasChildren"
            @click="isOpen = !isOpen"
            class="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground text-muted-foreground"
        >
            <div class="flex items-center gap-3">
                <component :is="item.icon" v-if="item.icon" class="h-4 w-4" />
                <span>{{ item.title }}</span>
            </div>
            <ChevronDown
                :class="cn('h-4 w-4 transition-transform duration-200', isOpen && 'rotate-180')"
            />
        </button>

        <!-- Renderiza como link se não tiver filhos -->
        <router-link
            v-else
            :to="item.to"
            @click="closeMobile"
            :class="
                cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
            "
        >
            <component :is="item.icon" v-if="item.icon" class="h-4 w-4" />
            <span>{{ item.title }}</span>
        </router-link>

        <!-- Conteúdo do Submenu animado com CSS Grid -->
        <div
            v-if="hasChildren"
            :class="
                cn(
                    'grid transition-all duration-300 ease-in-out',
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                )
            "
        >
            <ul class="overflow-hidden">
                <div class="mt-1 space-y-1 pl-9 pb-1">
                    <li v-for="child in item.children" :key="child.title">
                        <router-link
                            :to="child.to"
                            @click="closeMobile"
                            :class="
                                cn(
                                    'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                    route.path === child.to
                                        ? 'text-primary font-semibold'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                )
                            "
                        >
                            {{ child.title }}
                        </router-link>
                    </li>
                </div>
            </ul>
        </div>
    </li>
</template>
