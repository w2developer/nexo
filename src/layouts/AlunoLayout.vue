<script setup>
    import { onMounted } from 'vue';
    import { useRoute } from 'vue-router';
    import { LayoutDashboard, ListTodo, FileText, FolderOpen } from '@lucide/vue';

    import { useAlunoSessao } from '@/modules/aluno/composables/useAlunoSessao';
    import AppLayout from '@/components/layout/AppLayout.vue';
    import Sidebar from '@/components/layout/Sidebar.vue';
    import Navbar from '@/components/layout/Navbar.vue';

    const route = useRoute();
    const { carregarSessaoAluno } = useAlunoSessao();

    const navigation = [
        {
            group: 'Geral',
            items: [
                {
                    title: 'Painel',
                    to: '/aluno/painel',
                    icon: LayoutDashboard
                }
            ]
        },
        {
            group: 'Estudos e Materiais',
            items: [
                {
                    title: 'Atividades',
                    to: '/aluno/atividades',
                    icon: ListTodo
                },
                {
                    title: 'Apostilas',
                    to: '/aluno/apostilas',
                    icon: FileText
                },
                {
                    title: 'Auxiliares',
                    to: '/aluno/auxiliares',
                    icon: FolderOpen
                }
            ]
        }
    ];

    const mobileNavItems = [
        {
            title: 'Painel',
            to: '/aluno/painel',
            icon: LayoutDashboard
        },
        {
            title: 'Atividades',
            to: '/aluno/atividades',
            icon: ListTodo
        },
        {
            title: 'Apostilas',
            to: '/aluno/apostilas',
            icon: FileText
        },
        {
            title: 'Auxiliares',
            to: '/aluno/auxiliares',
            icon: FolderOpen
        }
    ];

    const isRotaAtiva = (path) => {
        return route.path === path || route.path.startsWith(`${path}/`);
    };

    onMounted(() => {
        carregarSessaoAluno();
    });
</script>

<template>
    <AppLayout :navigation="navigation">
        <template #sidebar>
            <Sidebar :navigation="navigation" />
        </template>

        <template #navbar>
            <Navbar />
        </template>

        <div class="mx-auto p-4 pb-24">
            <RouterView />
        </div>

        <!-- Barra de navegacao inferior fixa (Mobile-First) -->
        <nav
            aria-label="Navegação principal do aluno"
            class="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-md lg:hidden pb-[env(safe-area-inset-bottom)]"
        >
            <div class="grid h-16 grid-cols-4 items-center px-1">
                <router-link
                    v-for="item in mobileNavItems"
                    :key="item.to"
                    :to="item.to"
                    class="relative flex h-full flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-colors active:scale-95"
                    :class="
                        isRotaAtiva(item.to)
                            ? 'text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                    "
                >
                    <span
                        v-if="isRotaAtiva(item.to)"
                        class="absolute top-0 h-0.5 w-8 rounded-full bg-primary"
                    ></span>
                    <div
                        class="flex h-7 w-12 items-center justify-center rounded-full transition-colors"
                        :class="isRotaAtiva(item.to) ? 'bg-primary/12' : ''"
                    >
                        <component :is="item.icon" class="h-[18px] w-[18px]" />
                    </div>
                    <span class="leading-none truncate max-w-full">{{ item.title }}</span>
                </router-link>
            </div>
        </nav>
    </AppLayout>
</template>