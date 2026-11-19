<!-- src/components/chat/ChatMensagens.vue -->
<script setup>
    import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
    import { Trash2, ThumbsUp, AtSign, Copy, Check, X, ExternalLink, Reply, Image } from '@lucide/vue';
    import { useChat } from '@/composables/useChat';
    import {
        formatarHora,
        formatarTextoNegrito,
        obterChaveDia,
        formatarRotuloData,
        formatarNomeExibicao,
        limparFormatacaoPreview
    } from '@/utils/chatFormatters';

    const {
        mensagens,
        colegaAtivo,
        currentUser,
        carregando,
        chatExpandido,
        iniciarResposta,
        excluirMensagem,
        confirmarLike
    } = useChat();

    const containerMensagens = ref(null);
    const chaveCopiada = ref(null);
    const imagemAmpliada = ref(null);
    const imagensCarregadas = ref({});
    const mensagemDestacadaId = ref(null);
    let timeoutCopia = null;
    let timeoutDestaque = null;

    // Índice rápido por ID para resolver mensagens citadas sem queries extras
    const mapaMensagens = computed(() => {
        const mapa = new Map();
        mensagens.value.forEach((m) => mapa.set(m.id, m));
        return mapa;
    });

    const obterMensagemCitada = (respostaParaId) => {
        if (!respostaParaId) return null;
        return mapaMensagens.value.get(respostaParaId) || null;
    };

    const obterAutorCitacao = (msgCitada) => {
        if (!msgCitada) return '';
        if (String(msgCitada.remetente_id) === String(currentUser.value.id)) {
            return 'Você';
        }
        return formatarNomeExibicao(colegaAtivo.value);
    };

    // Rola até a mensagem original e destaca apenas o balão
    const irParaMensagemOriginal = (msgId) => {
        if (!msgId || !containerMensagens.value) return;
        const elemento = containerMensagens.value.querySelector(`[data-msg-id="${msgId}"]`);
        if (!elemento) return;

        elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
        mensagemDestacadaId.value = msgId;

        clearTimeout(timeoutDestaque);
        timeoutDestaque = setTimeout(() => {
            mensagemDestacadaId.value = null;
        }, 1400);
    };

    // Marca a imagem como carregada para remover o skeleton e ajustar o scroll
    const aoCarregarImagem = (msgId) => {
        imagensCarregadas.value = {
            ...imagensCarregadas.value,
            [msgId]: true
        };
        rolarParaFinal();
    };

    // Fecha o Lightbox com Esc antes do listener do ChatWidget
    const handleEscapeLightbox = (e) => {
        if (e.key === 'Escape' && imagemAmpliada.value) {
            e.preventDefault();
            e.stopImmediatePropagation();
            imagemAmpliada.value = null;
        }
    };

    const abrirLightbox = (url) => {
        imagemAmpliada.value = url;
    };

    const fecharLightbox = () => {
        imagemAmpliada.value = null;
    };

    // Retorna lista unificada de alunos mencionados (novo formato jsonb ou legado)
    const obterAlunosMencionados = (msg) => {
        if (Array.isArray(msg?.alunos_mencionados) && msg.alunos_mencionados.length > 0) {
            return msg.alunos_mencionados;
        }
        if (msg?.aluno_mencionado) {
            return [msg.aluno_mencionado];
        }
        return [];
    };

    // Copia o nome do aluno clicado para a área de transferência
    const copiarAluno = async (msgId, aluno) => {
        if (!aluno?.nome) return;
        try {
            await navigator.clipboard.writeText(aluno.nome);
            chaveCopiada.value = `${msgId}-${aluno.id}`;
            clearTimeout(timeoutCopia);
            timeoutCopia = setTimeout(() => {
                chaveCopiada.value = null;
            }, 1500);
        } catch (err) {
            console.error('Erro ao copiar nome do aluno:', err);
        }
    };

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
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', handleEscapeLightbox, true);
        }
    });

    onUnmounted(() => {
        clearTimeout(timeoutCopia);
        clearTimeout(timeoutDestaque);
        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', handleEscapeLightbox, true);
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
                :data-msg-id="msg.id"
                class="flex w-full group"
                :class="msg.remetente_id === currentUser.id ? 'justify-end' : 'justify-start'"
            >
                <!-- Ajuste dinâmico de largura máxima do balão -->
                <div
                    class="flex items-center gap-2 min-w-0"
                    :class="chatExpandido ? 'max-w-[70%] 2xl:max-w-[60%]' : 'max-w-[85%]'"
                >
                    <div class="flex flex-col min-w-0 w-full" :class="msg.remetente_id === currentUser.id ? 'items-end' : 'items-start'">
                        <div class="flex items-center gap-1.5 max-w-full min-w-0">
                            <!-- Ações do Remetente (Responder + Excluir) -->
                            <div
                                v-if="msg.remetente_id === currentUser.id"
                                class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            >
                                <button
                                    type="button"
                                    @click="iniciarResposta(msg)"
                                    class="text-slate-400 dark:text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400 p-1 cursor-pointer transition-colors"
                                    title="Responder mensagem"
                                >
                                    <Reply class="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    @click="excluirMensagem(msg.id)"
                                    class="text-slate-400 dark:text-muted-foreground hover:text-red-500 dark:hover:text-red-400 p-1 cursor-pointer transition-colors"
                                    title="Apagar mensagem"
                                >
                                    <Trash2 class="w-4 h-4" />
                                </button>
                            </div>

                            <!-- Balão de Mensagem -->
                            <div
                                class="text-[14px] leading-relaxed break-words whitespace-pre-wrap shadow-sm min-w-0 max-w-full overflow-hidden transition-all duration-300"
                                style="word-break: break-word;"
                                :class="[
                                    msg.anexo_url ? 'p-3' : 'px-4 py-2.5',
                                    msg.remetente_id === currentUser.id
                                        ? 'bg-violet-600 text-white rounded-2xl rounded-tr-sm'
                                        : 'bg-white dark:bg-muted border border-slate-200 dark:border-border text-slate-700 dark:text-foreground rounded-2xl rounded-tl-sm',
                                    mensagemDestacadaId === msg.id
                                        ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-[#f8fafc] dark:ring-offset-background scale-[1.02]'
                                        : ''
                                ]"
                            >
                                <!-- Bloco de Mensagem Citada (Reply) -->
                                <button
                                    v-if="msg.resposta_para_id && obterMensagemCitada(msg.resposta_para_id)"
                                    type="button"
                                    @click="irParaMensagemOriginal(msg.resposta_para_id)"
                                    class="w-full text-left mb-2 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer block min-w-0"
                                    :class="msg.remetente_id === currentUser.id
                                        ? 'bg-white/15 hover:bg-white/25 text-white'
                                        : 'bg-slate-100/90 hover:bg-slate-200/70 dark:bg-background/70 dark:hover:bg-background text-slate-700 dark:text-foreground'"
                                    title="Ir para a mensagem original"
                                >
                                    <div
                                        class="flex items-center gap-1 text-[11px] font-semibold truncate"
                                        :class="msg.remetente_id === currentUser.id
                                            ? 'text-violet-100'
                                            : 'text-violet-600 dark:text-violet-400'"
                                    >
                                        <Reply class="w-3 h-3 shrink-0 opacity-85" />
                                        <span class="truncate">{{ obterAutorCitacao(obterMensagemCitada(msg.resposta_para_id)) }}</span>
                                    </div>
                                    <div
                                        class="text-xs truncate flex items-center gap-1 mt-0.5"
                                        :class="msg.remetente_id === currentUser.id
                                            ? 'text-white/80'
                                            : 'text-slate-500 dark:text-muted-foreground'"
                                    >
                                        <Image
                                            v-if="obterMensagemCitada(msg.resposta_para_id)?.anexo_url"
                                            class="w-3 h-3 shrink-0"
                                        />
                                        <span class="truncate">
                                            {{
                                                limparFormatacaoPreview(obterMensagemCitada(msg.resposta_para_id)?.texto)
                                                || (obterMensagemCitada(msg.resposta_para_id)?.anexo_url ? 'Imagem' : '')
                                            }}
                                        </span>
                                    </div>
                                </button>

                                <!-- Cards dos Alunos Mencionados -->
                                <div
                                    v-if="obterAlunosMencionados(msg).length > 0"
                                    class="flex flex-col gap-1.5"
                                    :class="msg.texto || msg.anexo_url ? 'mb-2.5' : ''"
                                >
                                    <button
                                        v-for="aluno in obterAlunosMencionados(msg)"
                                        :key="aluno.id"
                                        type="button"
                                        @click="copiarAluno(msg.id, aluno)"
                                        :title="`Clique para copiar: ${aluno.nome}`"
                                        class="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold min-w-0 max-w-full text-left cursor-pointer transition-colors"
                                        :class="msg.remetente_id === currentUser.id
                                            ? 'bg-white/15 hover:bg-white/25 text-white'
                                            : 'bg-violet-50 hover:bg-violet-100/80 dark:bg-violet-500/15 dark:hover:bg-violet-500/25 text-violet-700 dark:text-violet-300'"
                                    >
                                        <span class="flex items-center gap-1.5 min-w-0">
                                            <AtSign class="w-3.5 h-3.5 shrink-0 opacity-85" />
                                            <span class="truncate">{{ aluno.nome }}</span>
                                            <span class="shrink-0 opacity-75 font-normal">({{ aluno.codigo }})</span>
                                        </span>

                                        <span class="flex items-center shrink-0 opacity-85">
                                            <Check v-if="chaveCopiada === `${msg.id}-${aluno.id}`" class="w-3.5 h-3.5" />
                                            <Copy v-else class="w-3 h-3" />
                                        </span>
                                    </button>
                                </div>

                                <!-- Anexo de Imagem com reserva de espaço (sem salto de layout) -->
                                <button
                                    v-if="msg.anexo_url"
                                    type="button"
                                    @click="abrirLightbox(msg.anexo_url)"
                                    class="relative block overflow-hidden rounded-xl cursor-zoom-in group/img"
                                    :class="[
                                        msg.texto ? 'mb-2' : '',
                                        !imagensCarregadas[msg.id] ? 'w-64 h-48' : ''
                                    ]"
                                    title="Clique para ampliar"
                                >
                                    <!-- Skeleton enquanto baixa -->
                                    <div
                                        v-if="!imagensCarregadas[msg.id]"
                                        class="absolute inset-0 rounded-xl animate-pulse"
                                        :class="msg.remetente_id === currentUser.id
                                            ? 'bg-white/20'
                                            : 'bg-slate-200 dark:bg-white/10'"
                                    ></div>

                                    <img
                                        :src="msg.anexo_url"
                                        alt="Imagem anexada"
                                        class="max-h-64 max-w-full object-cover rounded-xl transition-all duration-200 group-hover/img:scale-[1.02]"
                                        :class="imagensCarregadas[msg.id] ? 'opacity-100' : 'opacity-0'"
                                        @load="aoCarregarImagem(msg.id)"
                                    />
                                </button>

                                <!-- Conteúdo de Texto -->
                                <div v-if="msg.texto" v-html="formatarTextoNegrito(msg.texto)"></div>
                            </div>

                            <!-- Ações do Destinatário (Responder + Like) -->
                            <div
                                v-if="msg.remetente_id !== currentUser.id"
                                class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            >
                                <button
                                    type="button"
                                    @click="iniciarResposta(msg)"
                                    class="text-slate-400 dark:text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400 p-1 cursor-pointer transition-colors"
                                    title="Responder mensagem"
                                >
                                    <Reply class="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    @click="confirmarLike(msg.id)"
                                    class="btn-like p-1 cursor-pointer transition-colors"
                                    title="Confirmar Mensagem"
                                    :class="msg.like ? 'text-green-500' : 'text-slate-400 dark:text-muted-foreground hover:text-green-500'"
                                >
                                    <ThumbsUp class="w-4 h-4" />
                                </button>
                            </div>
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

    <!-- Lightbox de Visualização de Imagem -->
    <Teleport to="body">
        <Transition name="fade-lightbox">
            <div
                v-if="imagemAmpliada"
                @click="fecharLightbox"
                class="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
            >
                <div class="absolute top-4 right-4 flex items-center gap-2">
                    <a
                        :href="imagemAmpliada"
                        target="_blank"
                        rel="noopener noreferrer"
                        @click.stop
                        class="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        title="Abrir em nova aba"
                    >
                        <ExternalLink class="w-5 h-5" />
                    </a>
                    <button
                        type="button"
                        @click="fecharLightbox"
                        class="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                        title="Fechar (Esc)"
                    >
                        <X class="w-5 h-5" />
                    </button>
                </div>

                <img
                    :src="imagemAmpliada"
                    alt="Imagem ampliada"
                    @click.stop
                    class="max-w-[92vw] max-h-[88vh] object-contain rounded-xl shadow-2xl"
                />
            </div>
        </Transition>
    </Teleport>
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

    .fade-lightbox-enter-active,
    .fade-lightbox-leave-active {
        transition: opacity 0.15s ease;
    }
    .fade-lightbox-enter-from,
    .fade-lightbox-leave-to {
        opacity: 0;
    }
</style>