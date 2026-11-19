<script setup>
    import { ChevronLeft, X, Maximize2, Minimize2 } from '@lucide/vue';
    import { useChat } from '@/composables/useChat';
    import { formatarNomeExibicao } from '@/utils/chatFormatters';
    import Avatar from '../ui/Avatar.vue';

    const {
        colegaAtivo,
        usuariosOnline,
        fecharChat,
        toggleWidget,
        chatExpandido,
        toggleExpandirChat
    } = useChat();

    const fecharChateWidget = () => {
        fecharChat();
        toggleWidget();
    };
</script>

<template>
    <div class="bg-white dark:bg-muted px-3 py-3 border-b border-slate-100 dark:border-border flex justify-between items-center gap-3 shrink-0 shadow-sm dark:shadow-none z-10 h-[65px]">
        <div class="flex items-center gap-3 min-w-0">
            <!-- Botão de fechar conversa (Voltar) -->
            <button
                @click="fecharChat"
                class="p-2 text-slate-400 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-foreground hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors shrink-0 cursor-pointer"
                title="Fechar conversa"
            >
                <ChevronLeft class="w-5 h-5" />
            </button>

            <div class="relative shrink-0">
                <Avatar :name="colegaAtivo.nome" />
                <div
                    class="absolute bottom-0 right-0 w-3 h-3 border-2 border-white dark:border-muted rounded-full transition-colors duration-300"
                    :class="usuariosOnline.includes(colegaAtivo.id) ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'"
                ></div>
            </div>

            <div class="flex flex-col min-w-0">
                <h3 class="font-bold text-sm text-slate-800 dark:text-foreground truncate">
                    {{ formatarNomeExibicao(colegaAtivo) }}
                </h3>
                <span
                    class="text-[11px] font-medium transition-colors duration-300 truncate"
                    :class="usuariosOnline.includes(colegaAtivo.id) ? 'text-emerald-500' : 'text-slate-400 dark:text-muted-foreground'"
                >
                    {{ usuariosOnline.includes(colegaAtivo.id) ? 'Online agora' : 'Offline' }}
                </span>
            </div>
        </div>

        <!-- Controles da Janela -->
        <div class="flex items-center gap-1.5 shrink-0">
            <!-- Botão Expandir / Reduzir (Oculto em telas pequenas) -->
            <button
                @click="toggleExpandirChat"
                class="p-2 text-slate-400 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-foreground hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer hidden md:flex"
                :title="chatExpandido ? 'Reduzir chat' : 'Expandir chat'"
            >
                <Minimize2 v-if="chatExpandido" class="w-5 h-5" />
                <Maximize2 v-else class="w-5 h-5" />
            </button>

            <!-- Botão Fechar Janela -->
            <button
                @click="fecharChateWidget"
                class="p-2 text-slate-400 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-foreground hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                title="Fechar janela"
            >
                <X class="w-5 h-5" />
            </button>
        </div>
    </div>
</template>