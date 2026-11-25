<script setup>
    import {
        List,
        ListChecks,
        ListTodo,
        ListPlus,
        RefreshCw,
        LayoutDashboard,
        FolderCog,
        ClipboardCheck
    } from '@lucide/vue';
    import { computed, onMounted, onUnmounted } from 'vue';

    import { sincronizarRealtimeAuth } from '@/lib/supabase';
    import { useChat } from '@/composables/useChat';
    import { useSolicitacoesAtividades } from '@/composables/useSolicitacoesAtividades';
    import ChatWidget from '@/components/chat/ChatWidget.vue';

    import AppLayout from '@/components/layout/AppLayout.vue';
    import Sidebar from '@/components/layout/Sidebar.vue';
    import Navbar from '@/components/layout/Navbar.vue';

    const { initChat } = useChat();
    const {
        totalSolicitacoesPendentes,
        iniciarMonitoramentoSolicitacoes,
        pararMonitoramentoSolicitacoes
    } = useSolicitacoesAtividades();

    const navigation = computed(() => [
        {
            group: 'Geral',
            items: [
                {
                    title: 'Dashboard',
                    to: '/professor/dashboard',
                    icon: LayoutDashboard
                }
            ]
        },
        {
            group: 'Gestão de Alunos',
            items: [
                {
                    title: 'Marcar Presença',
                    to: '/professor/presenca',
                    icon: ListTodo
                },
                {
                    title: 'Controle de Alunos',
                    to: '/professor/alunos',
                    icon: List
                },
                {
                    title: 'Controle de Concluídos',
                    to: '/professor/concluidos',
                    icon: ListChecks
                },
                {
                    title: 'Controle de Rematrícula',
                    to: '/professor/rematricula',
                    icon: RefreshCw
                },
                {
                    title: 'Cadastrar Aluno',
                    to: '/professor/cadastrar-aluno',
                    icon: ListPlus
                }
            ]
        },
        {
            group: 'Conteúdo e Atividades',
            items: [
                {
                    title: 'Validação de Atividades',
                    to: '/professor/validacao-atividades',
                    icon: ClipboardCheck,
                    badge: totalSolicitacoesPendentes.value,
                    badgeAlert: true,
                    badgeTitle: `${totalSolicitacoesPendentes.value} ${
                        totalSolicitacoesPendentes.value === 1
                            ? 'solicitação aguardando validação'
                            : 'solicitações aguardando validação'
                    }`
                },
                {
                    title: 'Gestão de Conteúdo',
                    to: '/professor/gestao-de-conteudo',
                    icon: FolderCog
                }
            ]
        }
    ]);

    onMounted(() => {
        try {
            const token = sessionStorage.getItem('token_acesso');

            if (token) {
                sincronizarRealtimeAuth();
                iniciarMonitoramentoSolicitacoes();

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

    onUnmounted(() => {
        pararMonitoramentoSolicitacoes();
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