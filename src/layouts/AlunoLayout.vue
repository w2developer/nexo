<script setup>
    import { LayoutDashboard, ListTodo, FileText, FolderOpen } from '@lucide/vue';

    import AppLayout from '@/components/layout/AppLayout.vue';
    import Sidebar from '@/components/layout/Sidebar.vue';
    import Navbar from '@/components/layout/Navbar.vue';

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
    </AppLayout>
</template>