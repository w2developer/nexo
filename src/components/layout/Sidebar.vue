<script setup>
    import { computed, inject, unref } from 'vue';
    import { X } from '@lucide/vue';
    import { useRouter } from 'vue-router';
    import { cn } from '../../utils/cn';
    import Button from '../ui/Button.vue';
    import SidebarItem from './SidebarItem.vue';

    const props = defineProps({
        navigation: {
            type: Array,
            default: null
        }
    });

    const router = useRouter();

    const irParaHome = () => {
        router.push('/');
    };

    const isMobileOpen = inject('isMobileOpen');
    const toggleMobile = inject('toggleMobile');
    const injectedNavigation = inject('navigation', []);

    // Normaliza navegacao agrupada ({ group, items }) e itens soltos
    const navigationSections = computed(() => {
        const fonte = props.navigation ?? unref(injectedNavigation) ?? [];
        const secoes = [];
        let itensSoltos = [];

        const descarregarSoltos = () => {
            if (itensSoltos.length > 0) {
                secoes.push({
                    group: null,
                    items: itensSoltos
                });
                itensSoltos = [];
            }
        };

        fonte.forEach(entry => {
            if (Array.isArray(entry?.items)) {
                descarregarSoltos();
                secoes.push({
                    group: entry.group || null,
                    items: entry.items
                });
            } else if (entry) {
                itensSoltos.push(entry);
            }
        });

        descarregarSoltos();
        return secoes;
    });
</script>

<template>
    <aside
        :class="
            cn(
                'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-background transition-transform duration-300 lg:static lg:translate-x-0',
                isMobileOpen ? 'translate-x-0' : '-translate-x-full'
            )
        "
    >
        <!-- Header -->
        <div class="flex h-16 items-center justify-between border-b border-border px-4">
            <img
                src="/logo.svg"
                alt="NexoZ Logo"
                class="h-8 w-auto cursor-pointer hover:opacity-80 transition-opacity"
                @click="irParaHome"
            />
            <Button variant="ghost" size="icon" class="lg:hidden" @click="toggleMobile">
                <X class="h-5 w-5" />
            </Button>
        </div>

        <!-- Links organizados por grupos -->
        <nav class="flex-1 overflow-y-auto p-3 space-y-5">
            <div
                v-for="(section, index) in navigationSections"
                :key="section.group || `section-${index}`"
                :class="index > 0 ? 'pt-3 border-t border-border/60' : ''"
            >
                <p
                    v-if="section.group"
                    class="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 select-none"
                >
                    {{ section.group }}
                </p>

                <ul class="space-y-1">
                    <SidebarItem
                        v-for="item in section.items"
                        :key="item.to || item.title"
                        :item="item"
                    />
                </ul>
            </div>
        </nav>
    </aside>
</template>