<!-- src/components/chat/ChatMensagens.vue -->
<script setup>
    import { ref, watch, nextTick, onMounted } from 'vue';
    import { Trash2, ThumbsUp, AtSign } from '@lucide/vue';
    import { useChat } from '@/composables/useChat';
    import {
        formatarHora,
        formatarTextoNegrito,
        obterChaveDia,
        formatarRotuloData,
        formatarNomeExibicao
    } from '@/utils/chatFormatters';

    const {
        mensagens,
        colegaAtivo,
        currentUser,
        carregando,
        chatExpandido,
        excluirMensagem,
        confirmarLike
    } = useChat();

    const containerMensagens = ref(null);

    // Exibe divisor quando a mensagem iniciar um novo dia no histórico
    const exibirDivisorData = (index) => {
        const msgAtual = mensagens.value[index];
        if (!msgAtual?.criado_em) return false;
        if (index === 0) return true;

        const msgAnterior = mensagens.value[index - 1];
        return obterChaveDia(msgAtual.criado_em) !== obterChaveDia(msgAnterior?.criado_em);
    };

    // Move o scroll diretamente para a última mensagem
    const rolarParaFinal = async () => {
        await nextTick();
        if (containerMensagens.value) {
            containerMensagens.value.scrollTop = containerMensagens.value.scrollHeight;
        }
    };

    onMounted(() => {
        if (!carregando.value) {
            rolarParaFinal();
        }
    });

    watch(carregando, (estaCarregando) => {
        if (!estaCarregando) {
            rolarParaFinal();
        }
    });

    watch(() => mensagens.value.length, (novoTamanho, tamanhoAntigo) => {
        if (tamanhoAntigo !== undefined && novoTamanho < tamanhoAntigo) return;
        rolarParaFinal();
    });
</script>

<template>
    <!-- Loading do Histórico -->
    <div v-if="carregando" class="flex-1 flex items-center justify-center bg-[#f8fafc] dark:bg-background">
        <div class="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <!-- Lista de Mensagens -->
    <div v-else ref="containerMensagens" class="scroll-fino flex-1 overflow-y-auto overflow-x-hidden p-5 flex flex-col gap-4 bg-[#f8fafc] dark:bg-background">
        <template v-for="(msg, index) in mensagens" :key="msg.id">
            <!-- Divisor de Data -->
            <div v-if="exibirDivisorData(index)" class="flex items-center justify-center my-1">
                <span class="px-3 py-1 rounded-full bg-white dark:bg-muted border border-slate-200/80 dark:border-border text-slate-500 dark:text-muted-foreground text-[11px] font-medium shadow-2xs">
                    {{ formatarRotuloData(msg.criado_em) }}
                </span>
            </div>

            <div
                class="flex w-full group"
                :class="msg.remetente_id === currentUser.id ? 'justify-end' : 'justify-start'"
            >
                <!-- Ajuste dinâmico de largura máxima do balão -->
                <div
                    class="flex items-center gap-2 min-w-0"
                    :class="chatExpandido ? 'max-w-[70%] 2xl:max-w-[60%]' : 'max-w-[85%]'"
                >
                    <div class="flex flex-col min-w-0 w-full" :class="msg.remetente_id === currentUser.id ? 'items-end' : 'items-start'">
                        <div class="flex items-center gap-2 max-w-full min-w-0">
                            <!-- Botão Excluir (Apenas remetente) -->
                            <button
                                v-if="msg.remetente_id === currentUser.id"
                                @click="excluirMensagem(msg.id)"
                                class="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-muted-foreground hover:text-red-500 dark:hover:text-red-400 p-1 transition-opacity shrink-0 cursor-pointer"
                                title="Apagar mensagem"
                            >
                                <Trash2 class="w-4 h-4" />
                            </button>

                            <!-- Balão de Mensagem -->
                            <div
                                class="px-4 py-2.5 text-[14px] leading-relaxed break-words whitespace-pre-wrap shadow-sm min-w-0 max-w-full overflow-hidden"
                                style="word-break: break-word;"
                                :class="msg.remetente_id === currentUser.id
                                    ? 'bg-violet-600 text-white rounded-2xl rounded-tr-sm'
                                    : 'bg-white dark:bg-muted border border-slate-200 dark:border-border text-slate-700 dark:text-foreground rounded-2xl rounded-tl-sm'"
                            >
                                <!-- Menção do Aluno -->
                                <div
                                    v-if="msg.aluno_mencionado"
                                    :title="`${msg.aluno_mencionado.nome} (${msg.aluno_mencionado.codigo})`"
                                    class="flex items-center gap-1 text-[11px] font-semibold pb-1.5 mb-1.5 border-b min-w-0 max-w-full"
                                    :class="msg.remetente_id === currentUser.id
                                        ? 'border-violet-400/40 text-violet-100'
                                        : 'border-slate-100 dark:border-border text-violet-600 dark:text-violet-400'"
                                >
                                    <AtSign class="w-3.5 h-3.5 shrink-0" />
                                    <span class="truncate">{{ msg.aluno_mencionado.nome }}</span>
                                    <span class="shrink-0 opacity-85">({{ msg.aluno_mencionado.codigo }})</span>
                                </div>

                                <!-- Conteúdo de Texto -->
                                <div v-html="formatarTextoNegrito(msg.texto)"></div>
                            </div>

                            <!-- Botão Like (Apenas destinatário) -->
                            <button
                                v-if="msg.remetente_id !== currentUser.id"
                                @click="confirmarLike(msg.id)"
                                class="btn-like opacity-0 group-hover:opacity-100 p-1 transition-opacity shrink-0 cursor-pointer"
                                title="Confirmar Mensagem"
                                :class="msg.like ? 'text-green-500' : 'text-slate-400 dark:text-muted-foreground hover:text-green-500'"
                            >
                                <ThumbsUp class="w-4 h-4" />
                            </button>
                        </div>

                        <!-- Rodapé da Mensagem -->
                        <div class="flex items-center gap-1.5 mt-1 px-1">
                            <span
                                v-if="msg.remetente_id === currentUser.id && msg.like === true"
                                class="flex items-center gap-1 text-[10px] text-slate-400 dark:text-muted-foreground font-medium"
                            >
                                <ThumbsUp class="w-3 h-3" />
                                {{ formatarNomeExibicao(colegaAtivo) }} |
                            </span>

                            <span class="text-[10px] text-slate-400 dark:text-muted-foreground font-medium">
                                {{ formatarHora(msg.criado_em) }}
                            </span>

                            <template v-if="msg.remetente_id === currentUser.id">
                                <div
                                    class="w-1.5 h-1.5 rounded-full transition-colors duration-300"
                                    :class="msg.lida ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'"
                                    :title="msg.lida ? 'Lida' : 'Enviada'"
                                ></div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </template>
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