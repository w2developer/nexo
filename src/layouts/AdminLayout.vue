<script setup>
    import {
        List,
        ListChecks,
        ListPlus,
        LayoutDashboard
    } from '@lucide/vue';
    import { onMounted } from 'vue';

    import { useChat } from '@/composables/useChat';
    import ChatWidget from '@/components/chat/ChatWidget.vue';

    import AppLayout from '@/components/layout/AppLayout.vue';
    import Sidebar from '@/components/layout/Sidebar.vue';
    import Navbar from '@/components/layout/Navbar.vue';

    const { initChat } = useChat();

    const navigation = [
        {
            group: 'Geral',
            items: [
                {
                    title: 'Dashboard',
                    to: '/secretaria/dashboard',
                    icon: LayoutDashboard
                }
            ]
        },
        {
            group: 'Gestão de Alunos',
            items: [
                {
                    title: 'Controle de Alunos',
                    to: '/secretaria/alunos',
                    icon: List
                },
                {
                    title: 'Controle de Concluídos',
                    to: '/secretaria/concluidos',
                    icon: ListChecks
                },
                {
                    title: 'Cadastrar Aluno',
                    to: '/secretaria/cadastrar-aluno',
                    icon: ListPlus
                }
            ]
        }
    ];

    onMounted(() => {
        try {
            const token = sessionStorage.getItem('token_acesso');

            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]));

                if (payload && payload.sub) {
                    const idDoUsuario = payload.sub;
                    const tipoChat = payload.tipo === 'aluno' ? 'aluno' : 'usuario';
                    const nomeDoUsuario = payload.nome || 'Usuário Logado';

                    initChat(idDoUsuario, nomeDoUsuario, tipoChat);
                }
            } else {
                console.warn('Nenhum token de acesso encontrado. O chat não foi inicializado.');
            }
        } catch (err) {
            console.error('Erro ao ler sessão para o chat:', err);
        }
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

        <ChatWidget />
    </AppLayout>
</template>