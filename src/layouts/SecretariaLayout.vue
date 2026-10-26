<script setup>
import { List, ListChecks, Settings, ListTodo, MessageCircle, ListPlus } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { onMounted } from 'vue'

// 1. Importações do Chat e Auth
import { supabase } from '@/lib/supabase'
import { useChat } from '@/composables/useChat'
import ChatWidget from '@/components/chat/ChatWidget.vue'

import AppLayout from '@/components/layout/AppLayout.vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import Navbar from '@/components/layout/Navbar.vue'

const router = useRouter()

// 2. Função de inicialização global do chat
const { initChat } = useChat()

const navigation = [
    {
        title: 'Dashboard',
        to: '/secretaria/dashboard',
        icon: ListTodo,
    },
    {
        title: 'Cadastrar Aluno',
        to: '/secretaria/cadastrar-aluno',
        icon: ListPlus,
    },
    {
        title: 'Controle de Alunos',
        to: '/secretaria/alunos',
        icon: List,
    },
    {
        title: 'Controle de Concluídos',
        to: '/secretaria/concluidos',
        icon: ListChecks,
    },
    // {
    //     title: 'Mensagens',
    //     to: '/secretaria/mensagens',
    //     icon: MessageCircle,
    // },
    // {
    //     title: 'Configurações',
    //     to: '/secretaria/configuracoes',
    //     icon: Settings,
    // },
]

// Dispara navegação se o link for clicado
const handleNav = (href) => {
    router.push(href)
}

// 3. Captura o usuário logado dinamicamente lendo o seu JWT customizado
onMounted(() => {
    try {
        const token = sessionStorage.getItem('token_acesso');
        
        if (token) {
            // Decodifica o payload do JWT gerado pela sua Edge Function
            const payload = JSON.parse(atob(token.split('.')[1]));
            
            if (payload && payload.sub) {
                // payload.sub contém o ID real do usuário
                const idDoUsuario = payload.sub;
                
                // Se for professor, admin ou secretaria, o chat reconhece como 'usuario' (equipe)
                const tipoChat = payload.tipo === 'aluno' ? 'aluno' : 'usuario';
                
                // Extrai o nome se existir, ou usa um genérico
                const nomeDoUsuario = payload.nome || 'Usuário Logado';
                
                // AGORA SIM PASSAMOS OS 3: ID, NOME e TIPO
                initChat(idDoUsuario, nomeDoUsuario, tipoChat);
            }
        } else {
            console.warn("Nenhum token de acesso encontrado. O chat não foi inicializado.");
        }
    } catch (err) {
        console.error("Erro ao ler sessão para o chat:", err);
    }
})
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