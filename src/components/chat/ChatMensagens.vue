<!-- src/components/chat/ChatMensagens.vue -->
<script setup>
    import { ref, watch, nextTick, onMounted } from 'vue';
    import { Trash2, ThumbsUp, AtSign } from '@lucide/vue';
    import { useChat } from '@/composables/useChat';
    import { formatarHora, formatarDiaMes, formatarTextoNegrito } from '@/utils/chatFormatters';

    const {
        mensagens,
        colegaAtivo,
        currentUser,
        carregando,
        excluirMensagem,
        confirmarLike
    } = useChat();

    const containerMensagens = ref(null);

    // Move o scroll diretamente para a última mensagem
    const rolarParaFinal = async () => {
        await nextTick();
        if (containerMensagens.value) {
            containerMensagens.value.scrollTop = containerMensagens.value.scrollHeight;
        }
    };

    // Garante o scroll no final ao montar o componente (ex: reabrir o widget)
    onMounted(() => {
        if (!carregando.value) {
            rolarParaFinal();
        }
    });

    // Rola para o final assim que o loading termina e a div entra no DOM
    watch(carregando, (estaCarregando) => {
        if (!estaCarregando) {
            rolarParaFinal();
        }
    });

    // Rola para o final ao receber ou enviar novas mensagens (ignora exclusões)
    watch(() => mensagens.value.length, (novoTamanho, tamanhoAntigo) => {
        if (tamanhoAntigo !== undefined && novoTamanho < tamanhoAntigo) return;
        rolarParaFinal();
    });
</script>

<template>
    <!-- Loading do Histórico -->
    <div v-if="carregando" class="flex-1 flex items-center justify-center bg-[#f8fafc]">
        <div class="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <!-- Lista de Mensagens -->
    <div v-else ref="containerMensagens" class="scroll-fino flex-1 overflow-y-auto overflow-x-hidden p-5 flex flex-col gap-5 bg-[#f8fafc]">
        <div
            v-for="msg in mensagens"
            :key="msg.id"
            class="flex w-full group"
            :class="msg.remetente_id === currentUser.id ? 'justify-end' : 'justify-start'"
        >
            <div class="flex items-center gap-2 max-w-[85%] min-w-0">
                <div class="flex flex-col min-w-0 w-full" :class="msg.remetente_id === currentUser.id ? 'items-end' : 'items-start'">
                    <div class="flex items-center gap-2 max-w-full min-w-0">
                        <!-- Botão Excluir (Apenas remetente) -->
                        <button
                            v-if="msg.remetente_id === currentUser.id"
                            @click="excluirMensagem(msg.id)"
                            class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 transition-opacity shrink-0 cursor-pointer"
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
                                : 'bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-tl-sm'"
                        >
                            <!-- Menção do Aluno -->
                            <div
                                v-if="msg.aluno_mencionado"
                                :title="`${msg.aluno_mencionado.nome} (${msg.aluno_mencionado.codigo})`"
                                class="flex items-center gap-1 text-[11px] font-semibold pb-1.5 mb-1.5 border-b min-w-0 max-w-full"
                                :class="msg.remetente_id === currentUser.id
                                    ? 'border-violet-400/40 text-violet-100'
                                    : 'border-slate-100 text-violet-600'"
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
                            :class="msg.like ? 'text-green-500' : 'text-slate-400'"
                        >
                            <ThumbsUp class="w-4 h-4" />
                        </button>
                    </div>

                    <!-- Rodapé da Mensagem -->
                    <div class="flex items-center gap-1.5 mt-1.5 px-1">
                        <span
                            v-if="msg.remetente_id === currentUser.id && msg.like === true"
                            class="flex gap-1 text-[10px] text-slate-400 font-medium"
                        >
                            <ThumbsUp size="14" />
                            {{ colegaAtivo.nome }} |
                        </span>

                        <span class="text-[10px] text-slate-400 font-medium">
                            {{ formatarDiaMes(msg.criado_em) }} {{ formatarHora(msg.criado_em) }}
                        </span>

                        <template v-if="msg.remetente_id === currentUser.id">
                            <div
                                class="w-1.5 h-1.5 rounded-full transition-colors duration-300"
                                :class="msg.lida ? 'bg-emerald-500' : 'bg-slate-300'"
                                :title="msg.lida ? 'Lida' : 'Enviada'"
                            ></div>
                        </template>
                    </div>
                </div>
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
        background-color: #cbd5e1;
        border-radius: 9999px;
    }
    .scroll-fino::-webkit-scrollbar-thumb:hover {
        background-color: #94a3b8;
    }
</style>