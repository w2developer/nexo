<script setup>
import { inject } from 'vue'
import { X } from '@lucide/vue'
import { cn } from '../../utils/cn'
import Button from '../ui/Button.vue'
import SidebarItem from './SidebarItem.vue'

// Injeta dependências
const isMobileOpen = inject('isMobileOpen')
const toggleMobile = inject('toggleMobile')
const navigation = inject('navigation')
</script>

<template>
    <aside
        :class="
            cn(
                'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-background transition-transform duration-300 lg:static lg:translate-x-0',
                isMobileOpen ? 'translate-x-0' : '-translate-x-full',
            )
        "
    >
        <!-- Header -->
        <div class="flex h-16 items-center justify-between border-b border-border px-4">
            <span class="font-bold text-foreground">NexoZ</span>
            <Button variant="ghost" size="icon" class="md:hidden" @click="toggleMobile">
                <X class="h-5 w-5" />
            </Button>
        </div>

        <!-- Links (usando o novo componente) -->
        <nav class="flex-1 overflow-y-auto p-4">
            <ul class="space-y-1">
                <SidebarItem v-for="item in navigation" :key="item.title" :item="item" />
            </ul>
        </nav>
    </aside>
</template>
