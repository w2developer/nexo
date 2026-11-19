<script setup>
    import { Maximize2, Minimize2, MessageSquare, X } from '@lucide/vue';
    import { useChat } from '@/composables/useChat';

    const { chatExpandido, toggleExpandirChat, fecharChat, toggleWidget } = useChat();

    const fecharTudo = () => {
        fecharChat();
        toggleWidget();
    };
</script>

<template>
    <div class="flex-1 flex flex-col h-full bg-[#f8fafc] dark:bg-background">
        <!-- Cabeçalho (apenas com controles da janela) -->
        <div class="bg-white dark:bg-muted px-3 py-3 border-b border-slate-100 dark:border-border flex justify-end items-center gap-1.5 shrink-0 shadow-sm dark:shadow-none z-10 h-[65px]">
            <button
                @click="toggleExpandirChat"
                class="p-2 text-slate-400 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-foreground hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer hidden md:flex"
                :title="chatExpandido ? 'Reduzir chat' : 'Expandir chat'"
            >
                <Minimize2 v-if="chatExpandido" class="w-5 h-5" />
                <Maximize2 v-else class="w-5 h-5" />
            </button>
            <button
                @click="fecharTudo"
                class="p-2 text-slate-400 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-foreground hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                title="Fechar janela"
            >
                <X class="w-5 h-5" />
            </button>
        </div>

        <!-- Mensagem de estado vazio -->
        <div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div class="w-16 h-16 bg-slate-100 dark:bg-muted text-slate-300 dark:text-muted-foreground border border-transparent dark:border-border rounded-full flex items-center justify-center mb-4">
                <MessageSquare class="w-8 h-8" />
            </div>
            <h3 class="text-lg font-semibold text-slate-700 dark:text-foreground mb-1">Suas Mensagens</h3>
            <p class="text-sm text-slate-500 dark:text-muted-foreground max-w-xs">
                Selecione um contato na lista lateral para iniciar ou continuar uma conversa.
            </p>
        </div>
    </div>
</template>