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

    const ehMinhaMensagem = (msg) => {
        return String(msg?.remetente_id) === String(currentUser.value.id);
    };

    // Duplo clique no balão recebido confirma ou remove o Like rapidamente
    const aoDarDuploClique = (msg, event) => {
        if (ehMinhaMensagem(msg)) return;
        if (event.target?.closest('button, a')) return;

        if (typeof window !== 'undefined') {
            window.getSelection()?.removeAllRanges();
        }
        confirmarLike(msg.id);
    };

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
        if (ehMinhaMensagem(msgCitada)) {
            return 'Você';
        }
        return formatarNomeExibicao(colegaAtivo.value);
    };

    // Verifica se duas mensagens consecutivas pertencem ao mesmo grupo (remetente, dia e minuto)
    const mesmoGrupo = (msgA, msgB) => {
        if (!msgA || !msgB) return false;
        if (String(msgA.remetente_id) !== String(msgB.remetente_id)) return false;
        if (!msgA.criado_em || !msgB.criado_em) return false;

        return (
            obterChaveDia(msgA.criado_em) === obterChaveDia(msgB.criado_em) &&
            formatarHora(msgA.criado_em) === formatarHora(msgB.criado_em)
        );
    };

    const ehAgrupadaComAnterior = (index) => {
        if (index === 0) return false;
        return mesmoGrupo(mensagens.value[index - 1], mensagens.value[index]);
    };

    const ehAgrupadaComProxima = (index) => {
        if (index >= mensagens.value.length - 1) return false;
        return mesmoGrupo(mensagens.value[index], mensagens.value[index + 1]);
    };

    // Define os cantos arredondados do balão conforme a posição no grupo
    const obterClassesBordasBalao = (msg, index) => {
        const ehMinha = ehMinhaMensagem(msg);
        const comAnterior = ehAgrupadaComAnterior(index);
        const comProxima = ehAgrupadaComProxima(index);

        if (ehMinha) {
            if (comAnterior && comProxima) return 'rounded-2xl rounded-r-md';
            if (!comAnterior && comProxima) return 'rounded-2xl rounded-br-md';
            if (comAnterior && !comProxima) return 'rounded-2xl rounded-tr-md';
            return 'rounded-2xl rounded-tr-sm';
        }

        if (comAnterior && comProxima) return 'rounded-2xl rounded-l-md';
        if (!comAnterior && comProxima) return 'rounded-2xl rounded-bl-md';
        if (comAnterior && !comProxima) return 'rounded-2xl rounded-tl-md';
        return 'rounded-2xl rounded-tl-sm';
    };

    // Exibe o rodapé de horário apenas na última mensagem do grupo
    const exibirRodape = (index) => {
        return !ehAgrupadaComProxima(index);
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
    <div v-else ref="containerMensagens" class="scroll-fino flex-1 overflow-y-auto overflow-x-hidden p-5 flex flex-col bg-[#f8fafc] dark:bg-background">
        <template v-for="(msg, index) in mensagens" :key="msg.id">
            <!-- Divisor de Data -->
            <div
                v-if="exibirDivisorData(index)"
                class="flex items-center justify-center"
                :class="index === 0 ? 'mb-3' : 'mt-5 mb-3'"
            >
                <span class="px-3 py-1 rounded-full bg-white dark:bg-muted border border-slate-200/80 dark:border-border text-slate-500 dark:text-muted-foreground text-[11px] font-medium shadow-2xs">
                    {{ formatarRotuloData(msg.criado_em) }}
                </span>
            </div>

            <div
                :data-msg-id="msg.id"
                class="flex w-full group"
                :class="[
                    ehMinhaMensagem(msg) ? 'justify-end' : 'justify-start',
                    exibirDivisorData(index)
                        ? 'mt-0'
                        : ehAgrupadaComAnterior(index)
                            ? 'mt-1'
                            : 'mt-4'
                ]"
            >
                <!-- Ajuste dinâmico de largura máxima do balão -->
                <div
                    class="flex items-center gap-2 min-w-0"
                    :class="chatExpandido ? 'max-w-[70%] 2xl:max-w-[60%]' : 'max-w-[85%]'"
                >
                    <div class="flex flex-col min-w-0 w-full" :class="ehMinhaMensagem(msg) ? 'items-end' : 'items-start'">
                        <div class="flex items-center gap-2 max-w-full min-w-0">
                            <!-- Barra Flutuante de Ações (Remetente: Responder + Excluir) -->
                            <div
                                v-if="ehMinhaMensagem(msg)"
                                class="flex items-center gap-0.5 p-0.5 rounded-full bg-white/95 dark:bg-muted/95 border border-slate-200/80 dark:border-border shadow-xs opacity-0 group-hover:opacity-100 transition-all duration-150 shrink-0"
                            >
                                <button
                                    type="button"
                                    @click="iniciarResposta(msg)"
                                    class="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 dark:text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors"
                                    title="Responder mensagem"
                                >
                                    <Reply class="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    @click="excluirMensagem(msg.id)"
                                    class="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 dark:text-muted-foreground hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer transition-colors"
                                    title="Apagar mensagem"
                                >
                                    <Trash2 class="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <!-- Balão de Mensagem -->
                            <div
                                @dblclick="aoDarDuploClique(msg, $event)"
                                class="text-[14px] leading-relaxed break-words whitespace-pre-wrap shadow-sm min-w-0 max-w-full overflow-hidden transition-all duration-300"
                                style="word-break: break-word;"
                                :class="[
                                    msg.anexo_url ? 'p-3' : 'px-4 py-2.5',
                                    obterClassesBordasBalao(msg, index),
                                    ehMinhaMensagem(msg)
                                        ? 'bg-violet-600 text-white'
                                        : 'bg-white dark:bg-muted border border-slate-200 dark:border-border text-slate-700 dark:text-foreground',
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
                                    :class="ehMinhaMensagem(msg)
                                        ? 'bg-white/15 hover:bg-white/25 text-white'
                                        : 'bg-slate-100/90 hover:bg-slate-200/70 dark:bg-background/70 dark:hover:bg-background text-slate-700 dark:text-foreground'"
                                    title="Ir para a mensagem original"
                                >
                                    <div
                                        class="flex items-center gap-1 text-[11px] font-semibold truncate"
                                        :class="ehMinhaMensagem(msg)
                                            ? 'text-violet-100'
                                            : 'text-violet-600 dark:text-violet-400'"
                                    >
                                        <Reply class="w-3 h-3 shrink-0 opacity-85" />
                                        <span class="truncate">{{ obterAutorCitacao(obterMensagemCitada(msg.resposta_para_id)) }}</span>
                                    </div>
                                    <div
                                        class="text-xs truncate flex items-center gap-1 mt-0.5"
                                        :class="ehMinhaMensagem(msg)
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
                                        :class="ehMinhaMensagem(msg)
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
                                        :class="ehMinhaMensagem(msg)
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

                            <!-- Barra Flutuante de Ações (Destinatário: Responder + Like) -->
                            <div
                                v-if="!ehMinhaMensagem(msg)"
                                class="flex items-center gap-0.5 p-0.5 rounded-full bg-white/95 dark:bg-muted/95 border border-slate-200/80 dark:border-border shadow-xs opacity-0 group-hover:opacity-100 transition-all duration-150 shrink-0"
                            >
                                <button
                                    type="button"
                                    @click="iniciarResposta(msg)"
                                    class="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 dark:text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors"
                                    title="Responder mensagem"
                                >
                                    <Reply class="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    @click="confirmarLike(msg.id)"
                                    class="w-7 h-7 flex items-center justify-center rounded-full cursor-pointer transition-colors"
                                    :title="msg.like ? 'Remover curtida' : 'Curtir (ou dê duplo clique na mensagem)'"
                                    :class="msg.like
                                        ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15'
                                        : 'text-slate-400 dark:text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'"
                                >
                                    <ThumbsUp class="w-3.5 h-3.5" :class="msg.like ? 'fill-emerald-500/25' : ''" />
                                </button>
                            </div>
                        </div>

                        <!-- Reação Acoplada à Quina do Balão (sem invadir o conteúdo) -->
                        <Transition name="like-pop">
                            <div
                                v-if="msg.like === true"
                                class="relative z-10 -mt-1.5 group/like"
                                :class="[
                                    ehMinhaMensagem(msg) ? 'mr-1.5' : 'ml-1.5',
                                    ehAgrupadaComProxima(index) ? 'mb-1.5' : 'mb-0.5'
                                ]"
                            >
                                <!-- Destinatário: botão clicável para desfazer -->
                                <button
                                    v-if="!ehMinhaMensagem(msg)"
                                    type="button"
                                    @click="confirmarLike(msg.id)"
                                    class="like-badge relative inline-flex items-center justify-center h-[22px] px-1.5 rounded-full bg-white dark:bg-muted border border-emerald-200/90 dark:border-emerald-500/35 ring-2 ring-[#f8fafc] dark:ring-background shadow-xs text-emerald-600 dark:text-emerald-400 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                                    aria-label="Remover curtida"
                                >
                                    <ThumbsUp class="w-3 h-3 fill-emerald-500/25 stroke-[2.2]" />
                                </button>

                                <!-- Remetente: indicador de confirmação do colega -->
                                <div
                                    v-else
                                    class="like-badge relative inline-flex items-center justify-center h-[22px] px-1.5 rounded-full bg-white dark:bg-muted border border-emerald-200/90 dark:border-emerald-500/35 ring-2 ring-[#f8fafc] dark:ring-background shadow-xs text-emerald-600 dark:text-emerald-400 select-none"
                                >
                                    <ThumbsUp class="w-3 h-3 fill-emerald-500/25 stroke-[2.2]" />
                                </div>

                                <!-- Tooltip minimalista no hover da reação -->
                                <span
                                    class="pointer-events-none opacity-0 group-hover/like:opacity-100 transition-opacity duration-150 absolute bottom-full mb-1.5 px-2 py-1 rounded-md bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-medium whitespace-nowrap shadow-md z-20"
                                    :class="ehMinhaMensagem(msg) ? 'right-0' : 'left-0'"
                                >
                                    {{
                                        ehMinhaMensagem(msg)
                                            ? formatarNomeExibicao(colegaAtivo)
                                            : 'Clique para remover'
                                    }}
                                </span>
                            </div>
                        </Transition>

                        <!-- Rodapé da Mensagem (horário único apenas na última do grupo) -->
                        <div
                            v-if="exibirRodape(index)"
                            class="flex items-center gap-1.5 mt-1 px-1"
                        >
                            <span class="text-[10px] text-slate-400 dark:text-muted-foreground font-medium">
                                {{ formatarHora(msg.criado_em) }}
                            </span>

                            <template v-if="ehMinhaMensagem(msg)">
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

    .like-pop-enter-active {
        animation: like-spring 0.34s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .like-pop-leave-active {
        transition: opacity 0.14s ease, transform 0.14s ease;
    }
    .like-pop-leave-to {
        opacity: 0;
        transform: scale(0.6);
    }

    .like-badge::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 9999px;
        border: 2px solid rgb(16 185 129 / 0.55);
        opacity: 0;
        pointer-events: none;
    }

    .like-pop-enter-active .like-badge::after {
        animation: like-ripple 0.45s ease-out;
    }

    @keyframes like-spring {
        0% {
            opacity: 0;
            transform: scale(0.4) rotate(-18deg);
        }
        65% {
            opacity: 1;
            transform: scale(1.16) rotate(6deg);
        }
        100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
        }
    }

    @keyframes like-ripple {
        0% {
            opacity: 0.7;
            transform: scale(0.95);
        }
        100% {
            opacity: 0;
            transform: scale(1.65);
        }
    }
</style>