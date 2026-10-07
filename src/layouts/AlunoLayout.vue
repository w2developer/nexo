<script setup>
import { LayoutDashboard, ListTodo, FileText, FolderOpen } from '@lucide/vue'
import { useRouter } from 'vue-router'

import AppLayout from '@/components/layout/AppLayout.vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import Navbar from '@/components/layout/Navbar.vue'

const router = useRouter()

const navigation = [
    {
        title: 'Painel',
        to: '/aluno/painel',
        icon: LayoutDashboard,
    },
    {
        title: 'Atividades',
        to: '/aluno/atividades',
        icon: ListTodo,
    },
    {
        title: 'Apostilas',
        to: '/aluno/apostilas',
        icon: FileText,
    },
    {
        title: 'Auxiliares',
        to: '/aluno/auxiliares',
        icon: FolderOpen,
    },
    // {
    //     title: 'Componentes',
    //     icon: Layers,
    //     children: [
    //         { title: 'Button', to: '/button' },
    //         { title: 'Input', to: '/input' },
    //         { title: 'Modal', to: '/modal' },
    //         { title: 'Formulários', to: '/forms' },
    //         { title: 'Dados & Layout', to: '/data' },
    //         { title: 'Feedback & Utils', to: '/feedback' }
    //     ]
    // }
]

// Dispara navegação se o link for clicado
const handleNav = (href) => {
    router.push(href)
}
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
