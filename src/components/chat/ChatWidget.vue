<script setup>
    import { MessageCircle, X } from '@lucide/vue';
    import { useChat } from '@/composables/useChat';
    import ChatListaContatos from './ChatListaContatos.vue';
    import ChatCabecalho from './ChatCabecalho.vue';
    import ChatMensagens from './ChatMensagens.vue';
    import ChatBarraEnvio from './ChatBarraEnvio.vue';
    import ChatModalPermissao from './ChatModalPermissao.vue';

    const {
        colegaAtivo,
        widgetAberto,
        temMensagemNaoLida,
        toggleWidget
    } = useChat();
</script>

<template>
    <!-- Modal da W2 UI Kit para permissão de notificações do navegador -->
    <ChatModalPermissao />

    <!-- Overlay de fundo -->
    <Transition name="fade">
        <div
            v-if="widgetAberto"
            @click="toggleWidget"
            class="fixed inset-0 bg-slate-900/20 z-[9998]"
        ></div>
    </Transition>

    <div class="fixed bottom-6 left-6 z-[9999] flex flex-col items-start font-sans">
        <!-- Janela Principal do Widget -->
        <div
            v-if="widgetAberto"
            class="mb-4 w-[360px] h-[550px] bg-slate-50 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 flex flex-col overflow-hidden"
        >
            <ChatListaContatos v-if="!colegaAtivo" />

            <template v-else>
                <ChatCabecalho />
                <ChatMensagens />
                <ChatBarraEnvio />
            </template>
        </div>

        <!-- Botão Flutuante Principal (FAB) -->
        <button
            @click="toggleWidget"
            class="relative w-14 h-14 bg-violet-600 text-white rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center cursor-pointer"
        >
            <!-- Tooltip de Nova Mensagem -->
            <div
                v-if="temMensagemNaoLida && !widgetAberto"
                class="absolute -top-10 left-0 bg-slate-800 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-md whitespace-nowrap flex items-center gap-2 pointer-events-none"
            >
                <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                Nova Mensagem
                <span class="absolute -bottom-1 left-5 w-2 h-2 bg-slate-800 rotate-45"></span>
            </div>

            <X class="w-6 h-6" v-if="widgetAberto" />
            <MessageCircle class="w-6 h-6" v-else />
        </button>
    </div>
</template>

<style scoped>
    .fade-enter-active,
    .fade-leave-active {
        transition: opacity 0.2s ease;
    }
    .fade-enter-from,
    .fade-leave-to {
        opacity: 0;
    }
</style>