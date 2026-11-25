<script setup>
    import { ref, computed, inject } from 'vue';
    import { useRoute } from 'vue-router';
    import { ChevronDown } from '@lucide/vue';
    import { cn } from '../../utils/cn';

    const props = defineProps({
        item: {
            type: Object,
            required: true
        }
    });

    const route = useRoute();

    const isOpen = ref(false);
    const hasChildren = computed(() => Boolean(props.item.children?.length));

    const isActive = computed(() => {
        if (!props.item.to) return false;
        if (route.path === props.item.to) return true;
        return props.item.to !== '/' && route.path.startsWith(`${props.item.to}/`);
    });

    const badgeFormatado = computed(() => {
        const valor = props.item.badge;
        if (typeof valor === 'number') {
            if (valor <= 0) return null;
            return valor > 99 ? '99+' : String(valor);
        }
        if (typeof valor === 'string' && valor.trim()) {
            return valor.trim();
        }
        return null;
    });

    const isMobileOpen = inject('isMobileOpen', null);
    const closeMobile = () => {
        if (isMobileOpen && isMobileOpen.value) {
            isMobileOpen.value = false;
        }
    };
</script>

<template>
    <li class="list-none">
        <!-- Renderiza como botao se tiver filhos (Submenu) -->
        <button
            v-if="hasChildren"
            @click="isOpen = !isOpen"
            class="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground text-muted-foreground cursor-pointer"
        >
            <div class="flex items-center gap-3 min-w-0">
                <component :is="item.icon" v-if="item.icon" class="h-4 w-4 shrink-0" />
                <span class="truncate">{{ item.title }}</span>
            </div>
            <ChevronDown
                :class="cn('h-4 w-4 shrink-0 transition-transform duration-200', isOpen && 'rotate-180')"
            />
        </button>

        <!-- Renderiza como link se nao tiver filhos -->
        <router-link
            v-else
            :to="item.to"
            @click="closeMobile"
            :class="
                cn(
                    'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
            "
        >
            <div class="flex items-center gap-3 min-w-0">
                <component :is="item.icon" v-if="item.icon" class="h-4 w-4 shrink-0" />
                <span class="truncate">{{ item.title }}</span>
            </div>

            <!-- Contador e indicador de aviso -->
            <span
                v-if="badgeFormatado"
                class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums leading-none shrink-0"
                :class="
                    item.badgeAlert
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25'
                        : 'bg-muted text-muted-foreground'
                "
                :title="item.badgeTitle || ''"
            >
                <span
                    v-if="item.badgeAlert"
                    class="relative flex h-1.5 w-1.5 shrink-0"
                >
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                </span>
                {{ badgeFormatado }}
            </span>
        </router-link>

        <!-- Conteudo do Submenu animado com CSS Grid -->
        <div
            v-if="hasChildren"
            :class="
                cn(
                    'grid transition-all duration-300 ease-in-out',
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
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
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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