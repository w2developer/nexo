<script setup>
    import {
        List,
        ListChecks,
        Settings,
        ListTodo,
        MessageCircle,
        ListPlus,
        RefreshCw,
        LayoutDashboard,
        FolderCog,
        ClipboardCheck
    } from '@lucide/vue';
    import { useRouter } from 'vue-router';
    import { onMounted } from 'vue';

    // 1. Importacoes do Chat e Auth
    import { sincronizarRealtimeAuth } from '@/lib/supabase';
    import { useChat } from '@/composables/useChat';
    import ChatWidget from '@/components/chat/ChatWidget.vue';

    import AppLayout from '@/components/layout/AppLayout.vue';
    import Sidebar from '@/components/layout/Sidebar.vue';
    import Navbar from '@/components/layout/Navbar.vue';

    const router = useRouter();

    // 2. Funcao de inicializacao global do chat
    const { initChat } = useChat();

    const navigation = [
        {
            title: 'Dashboard',
            to: '/professor/dashboard',
            icon: LayoutDashboard
        },
        {
            title: 'Marcar Presença',
            to: '/professor/presenca',
            icon: ListTodo
        },
        {
            title: 'Validação de Atividades',
            to: '/professor/validacao-atividades',
            icon: ClipboardCheck
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
        },
        {
            title: 'Gestão de Conteúdo',
            to: '/professor/gestao-de-conteudo',
            icon: FolderCog
        }
        // {
        //     title: 'Mensagens',
        //     to: '/professor/mensagens',
        //     icon: MessageCircle,
        // },
        // {
        //     title: 'Configurações',
        //     to: '/professor/configuracoes',
        //     icon: Settings,
        // },
    ];

    // Dispara navegacao se o link for clicado
    const handleNav = (href) => {
        router.push(href);
    };

    // 3. Captura o usuario logado dinamicamente lendo o JWT customizado
    onMounted(() => {
        try {
            const token = sessionStorage.getItem('token_acesso');

            if (token) {
                sincronizarRealtimeAuth();

                // Decodifica o payload do JWT gerado pela Edge Function
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

        <!-- 4. Injetar o componente do chat no layout global -->
        <ChatWidget />
    </AppLayout>
</template>