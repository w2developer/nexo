<script setup>
    import { onMounted, onUnmounted } from 'vue';
    import { MessageCircle, X } from '@lucide/vue';
    import { useChat } from '@/composables/useChat';
    import ChatListaContatos from './ChatListaContatos.vue';
    import ChatCabecalho from './ChatCabecalho.vue';
    import ChatMensagens from './ChatMensagens.vue';
    import ChatBarraEnvio from './ChatBarraEnvio.vue';
    import ChatModalPermissao from './ChatModalPermissao.vue';
    import ChatEstadoVazio from './ChatEstadoVazio.vue';

    const {
        colegaAtivo,
        widgetAberto,
        chatExpandido,
        temMensagemNaoLida,
        toggleWidget,
        fecharChat
    } = useChat();

    const handleKeydown = (e) => {
        if (e.key === 'Escape' && widgetAberto.value) {
            if (colegaAtivo.value) {
                fecharChat();
            } else {
                toggleWidget();
            }
        }
    };

    onMounted(() => {
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', handleKeydown);
        }
    });

    onUnmounted(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', handleKeydown);
        }
    });
</script>

<template>
    <ChatModalPermissao />

    <Transition name="fade">
        <div
            v-if="widgetAberto"
            @click="toggleWidget"
            class="fixed inset-0 bg-slate-900/20 dark:bg-black/50 z-[9998]"
        ></div>
    </Transition>

    <div class="fixed bottom-6 left-6 z-[9999] flex flex-col items-start font-sans pointer-events-none">
        <div
            v-if="widgetAberto"
            class="mb-4 bg-slate-50 dark:bg-background rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgb(0,0,0,0.55)] border border-slate-200 dark:border-border flex overflow-hidden transition-all duration-300 origin-bottom-left pointer-events-auto"
            :class="[
                chatExpandido
                    ? 'w-[calc(100vw-48px)] md:max-w-[1024px] h-[calc(100vh-120px)] max-h-[750px] flex-row'
                    : 'w-[360px] h-[550px] flex-col'
            ]"
        >
            <!-- MODO EXPANDIDO -->
            <template v-if="chatExpandido">
                <!-- Coluna Esquerda: Lista de Contatos -->
                <div
                    class="border-r border-slate-200 dark:border-border shrink-0 h-full w-full md:w-[320px] lg:w-[340px] bg-white dark:bg-muted transition-all"
                    :class="colegaAtivo ? 'hidden md:block' : 'block'"
                >
                    <ChatListaContatos />
                </div>

                <!-- Coluna Direita: Conversa ou Vazio -->
                <div
                    class="flex-1 flex flex-col min-w-0 h-full bg-[#f8fafc] dark:bg-background"
                    :class="colegaAtivo ? 'flex' : 'hidden md:flex'"
                >
                    <ChatEstadoVazio v-if="!colegaAtivo" />

                    <template v-else>
                        <ChatCabecalho />
                        <ChatMensagens />
                        <ChatBarraEnvio />
                    </template>
                </div>
            </template>

            <!-- MODO MINIATURA -->
            <template v-else>
                <ChatListaContatos v-if="!colegaAtivo" />
                <template v-else>
                    <ChatCabecalho />
                    <ChatMensagens />
                    <ChatBarraEnvio />
                </template>
            </template>
        </div>

        <button
            @click="toggleWidget"
            class="relative w-14 h-14 bg-violet-600 text-white rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center cursor-pointer pointer-events-auto"
        >
            <div
                v-if="temMensagemNaoLida && !widgetAberto"
                class="absolute -top-10 left-0 bg-slate-800 dark:bg-muted dark:border dark:border-border text-white dark:text-foreground text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-md whitespace-nowrap flex items-center gap-2 pointer-events-none"
            >
                <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                Nova Mensagem
                <span class="absolute -bottom-1 left-5 w-2 h-2 bg-slate-800 dark:bg-muted rotate-45"></span>
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