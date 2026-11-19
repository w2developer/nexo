<script setup>
    import { Maximize2, X } from '@lucide/vue';
    import { useChat } from '@/composables/useChat';
    import {
        formatarCargo,
        formatarNomeExibicao,
        formatarHorarioLista,
        limparFormatacaoPreview
    } from '@/utils/chatFormatters';
    import Avatar from '../ui/Avatar.vue';

    const {
        colegasOrdenados,
        currentUser,
        usuariosOnline,
        naoLidasGlobais,
        resumoConversas,
        colegaAtivo,
        chatExpandido,
        toggleWidget,
        toggleExpandirChat,
        abrirChatCom
    } = useChat();

    const ehColegaAtivo = (colega) => {
        return Boolean(
            chatExpandido.value &&
            colegaAtivo.value &&
            String(colegaAtivo.value.id) === String(colega.id)
        );
    };

    const obterResumo = (colegaId) => {
        return resumoConversas.value[String(colegaId)] || null;
    };

    const obterQtdNaoLidas = (colegaId) => {
        return naoLidasGlobais.value[String(colegaId)] || 0;
    };

    const formatarContador = (qtd) => {
        return qtd > 99 ? '99+' : String(qtd);
    };
</script>

<template>
    <div class="flex flex-col h-full bg-white dark:bg-muted">
        <div class="px-5 py-3 border-b border-slate-100 dark:border-border flex items-center justify-between gap-2 shrink-0 h-[65px]">
            <div class="min-w-0">
                <h3 class="font-bold text-slate-800 dark:text-foreground text-lg leading-tight truncate">Mensagens</h3>
                <p class="text-xs text-slate-500 dark:text-muted-foreground truncate">Logado como: {{ currentUser.nome }}</p>
            </div>

            <div class="flex items-center gap-1 shrink-0">
                <!-- Expandir direto pela lista (apenas no modo miniatura em telas md+) -->
                <button
                    v-if="!chatExpandido"
                    @click="toggleExpandirChat"
                    class="p-2 text-slate-400 dark:text-muted-foreground hover:text-slate-600 dark:hover:text-foreground hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer hidden md:flex"
                    title="Expandir chat"
                >
                    <Maximize2 class="w-5 h-5" />
                </button>

                <!-- No modo expandido desktop, o fechamento fica no painel direito -->
                <button
                    @click="toggleWidget"
                    class="p-2 text-slate-400 dark:text-muted-foreground hover:text-slate-600 dark:hover:text-foreground hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                    :class="chatExpandido ? 'md:hidden' : ''"
                    title="Fechar janela"
                >
                    <X class="w-5 h-5" />
                </button>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto bg-white dark:bg-muted scroll-fino">
            <button
                v-for="colega in colegasOrdenados"
                :key="colega.id"
                @click="abrirChatCom(colega)"
                :title="formatarCargo(colega.tipo)"
                class="w-full flex items-center gap-3.5 px-5 py-3.5 transition-colors text-left border-b cursor-pointer relative"
                :class="ehColegaAtivo(colega)
                    ? 'bg-violet-50/70 dark:bg-violet-500/15 border-violet-100 dark:border-violet-500/20'
                    : 'border-slate-50/50 dark:border-border/50 hover:bg-slate-50 dark:hover:bg-white/5'"
            >
                <!-- Indicador lateral do contato ativo no modo expandido -->
                <div
                    v-if="ehColegaAtivo(colega)"
                    class="absolute left-0 top-0 bottom-0 w-1 bg-violet-600 dark:bg-violet-400"
                ></div>

                <div class="relative shrink-0">
                    <Avatar :name="colega.nome" />
                    <div
                        class="absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-white dark:border-muted rounded-full transition-colors duration-300"
                        :class="usuariosOnline.includes(colega.id) ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'"
                    ></div>
                </div>

                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                        <div
                            class="font-semibold text-sm truncate transition-colors"
                            :class="ehColegaAtivo(colega) ? 'text-violet-700 dark:text-violet-300' : 'text-slate-800 dark:text-foreground'"
                        >
                            {{ formatarNomeExibicao(colega) }}
                        </div>

                        <span
                            v-if="obterResumo(colega.id)?.criado_em"
                            class="text-[11px] shrink-0"
                            :class="obterQtdNaoLidas(colega.id) > 0
                                ? 'text-violet-600 dark:text-violet-400 font-semibold'
                                : 'text-slate-400 dark:text-muted-foreground'"
                        >
                            {{ formatarHorarioLista(obterResumo(colega.id).criado_em) }}
                        </span>
                    </div>

                    <div class="flex items-center justify-between gap-2 mt-0.5">
                        <div
                            class="text-xs truncate"
                            :class="obterQtdNaoLidas(colega.id) > 0
                                ? 'text-slate-700 dark:text-foreground font-medium'
                                : 'text-slate-500 dark:text-muted-foreground'"
                        >
                            <template v-if="obterResumo(colega.id)?.texto">
                                <span
                                    v-if="String(obterResumo(colega.id).remetente_id) === String(currentUser.id)"
                                    class="text-slate-400 dark:text-muted-foreground"
                                >Você: </span>
                                {{ limparFormatacaoPreview(obterResumo(colega.id).texto) }}
                            </template>
                            <template v-else>
                                {{ formatarCargo(colega.tipo) }}
                            </template>
                        </div>

                        <!-- Contador numérico de mensagens não lidas -->
                        <span
                            v-if="obterQtdNaoLidas(colega.id) > 0"
                            class="min-w-5 h-5 px-1.5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                        >
                            {{ formatarContador(obterQtdNaoLidas(colega.id)) }}
                        </span>
                    </div>
                </div>
            </button>

            <div v-if="colegasOrdenados.length === 0" class="p-8 text-center text-sm text-slate-400 dark:text-muted-foreground">
                Nenhum colega encontrado.
            </div>
        </div>
    </div>
</template>

<style scoped>
    .scroll-fino::-webkit-scrollbar {
        width: 5px;
    }
    .scroll-fino::-webkit-scrollbar-track {
        background: transparent;
    }
    .scroll-fino::-webkit-scrollbar-thumb {
        background-color: var(--border);
        border-radius: 9999px;
    }
    .scroll-fino::-webkit-scrollbar-thumb:hover {
        background-color: var(--muted-foreground);
    }
</style>