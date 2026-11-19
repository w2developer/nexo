<script setup>
    import { ref, watch, nextTick, onUnmounted } from 'vue';
    import { Send, Smile, AtSign, X, ImagePlus, Loader2, Plus, Reply, Image } from '@lucide/vue';
    import { useChat } from '@/composables/useChat';
    import { useTheme } from '@/composables/useTheme';
    import { useClickOutside } from '@/composables/useClickOutside';
    import { formatarNomeExibicao, limparFormatacaoPreview } from '@/utils/chatFormatters';
    import EmojiPicker from 'vue3-emoji-picker';
    import 'vue3-emoji-picker/css';

    const {
        carregando,
        colegaAtivo,
        currentUser,
        quemEstaDigitando,
        mensagemRespondendo,
        enviarMensagem,
        uploadAnexoChat,
        cancelarResposta,
        sinalizarDigitacao,
        buscarAlunos
    } = useChat();

    const { isDark } = useTheme();

    const novaMensagem = ref('');
    const inputMensagem = ref(null);
    const inputArquivo = ref(null);
    const containerBarra = ref(null);
    const enviando = ref(false);

    // Estado dos menus (Ações + Emoji Picker)
    const mostrarMenuAcoes = ref(false);
    const mostrarPicker = ref(false);

    // Estado da menção de alunos (@)
    const alunosSelecionados = ref([]);
    const sugestoesAlunos = ref([]);
    const buscandoAlunos = ref(false);
    const mostrarSugestoes = ref(false);
    const indiceSugestao = ref(0);
    let timeoutBuscaAluno = null;

    // Estado do anexo de imagem
    const imagemSelecionada = ref(null);
    const previewImagemUrl = ref(null);
    const erroAnexo = ref('');

    // Foca automaticamente no campo de texto ao clicar em "Responder"
    watch(mensagemRespondendo, async (novaResposta) => {
        if (novaResposta) {
            await nextTick();
            inputMensagem.value?.focus();
        }
    });

    const autorMensagemRespondendo = () => {
        if (!mensagemRespondendo.value) return '';
        if (String(mensagemRespondendo.value.remetente_id) === String(currentUser.value.id)) {
            return 'Você';
        }
        return formatarNomeExibicao(colegaAtivo.value);
    };

    // Fecha popovers ao clicar fora da barra de envio
    useClickOutside(containerBarra, () => {
        if (mostrarMenuAcoes.value) {
            mostrarMenuAcoes.value = false;
        }
        if (mostrarPicker.value) {
            mostrarPicker.value = false;
        }
        if (mostrarSugestoes.value) {
            fecharSugestoes();
        }
    });

    onUnmounted(() => {
        clearTimeout(timeoutBuscaAluno);
        if (previewImagemUrl.value) {
            URL.revokeObjectURL(previewImagemUrl.value);
        }
    });

    const fecharSugestoes = () => {
        mostrarSugestoes.value = false;
        sugestoesAlunos.value = [];
        indiceSugestao.value = 0;
    };

    const fecharMenus = () => {
        mostrarMenuAcoes.value = false;
        mostrarPicker.value = false;
    };

    const toggleMenuAcoes = () => {
        if (mostrarPicker.value) {
            mostrarPicker.value = false;
            return;
        }
        mostrarMenuAcoes.value = !mostrarMenuAcoes.value;
        if (mostrarMenuAcoes.value) {
            fecharSugestoes();
        }
    };

    const abrirEmojiPicker = () => {
        mostrarMenuAcoes.value = false;
        fecharSugestoes();
        mostrarPicker.value = true;
    };

    const onSelectEmoji = (emoji) => {
        novaMensagem.value += emoji.i;
        mostrarPicker.value = false;

        if (inputMensagem.value) {
            inputMensagem.value.focus();
            setTimeout(() => {
                inputMensagem.value.style.height = 'auto';
                inputMensagem.value.style.height = `${inputMensagem.value.scrollHeight}px`;
            }, 10);
        }
    };

    // Valida e prepara a pré-visualização da imagem selecionada ou colada
    const definirImagem = (arquivo) => {
        erroAnexo.value = '';
        if (!arquivo) return;

        if (!arquivo.type?.startsWith('image/')) {
            erroAnexo.value = 'Selecione apenas arquivos de imagem (PNG, JPG, WEBP ou GIF).';
            return;
        }

        if (arquivo.size > 5 * 1024 * 1024) {
            erroAnexo.value = 'A imagem excede o limite de 5 MB.';
            return;
        }

        if (previewImagemUrl.value) {
            URL.revokeObjectURL(previewImagemUrl.value);
        }

        imagemSelecionada.value = arquivo;
        previewImagemUrl.value = URL.createObjectURL(arquivo);
        fecharMenus();

        if (inputMensagem.value) {
            inputMensagem.value.focus();
        }
    };

    const removerImagem = () => {
        if (previewImagemUrl.value) {
            URL.revokeObjectURL(previewImagemUrl.value);
        }
        imagemSelecionada.value = null;
        previewImagemUrl.value = null;
        erroAnexo.value = '';
    };

    const abrirSeletorArquivo = () => {
        if (carregando.value || enviando.value) return;
        fecharMenus();
        fecharSugestoes();
        inputArquivo.value?.click();
    };

    const aoSelecionarArquivo = (e) => {
        const arquivo = e.target.files?.[0];
        if (arquivo) {
            definirImagem(arquivo);
        }
        e.target.value = '';
    };

    // Intercepta Ctrl+V de prints/imagens na área de digitação
    const aoColar = (e) => {
        const itens = e.clipboardData?.items;
        if (!itens) return;

        for (const item of itens) {
            if (item.type?.startsWith('image/')) {
                e.preventDefault();
                const arquivo = item.getAsFile();
                if (arquivo) {
                    definirImagem(arquivo);
                }
                return;
            }
        }
    };

    // Detecta padrão @termo (aceitando nomes compostos com espaço) e dispara busca com debounce
    const verificarMencao = (el) => {
        const cursor = el.selectionStart ?? novaMensagem.value.length;
        const textoAteCursor = novaMensagem.value.slice(0, cursor);
        const match = textoAteCursor.match(/(?:^|\s)@([^\n@]{2,40})$/);

        clearTimeout(timeoutBuscaAluno);

        const termo = match ? match[1].trim() : '';
        if (!match || termo.length < 2) {
            fecharSugestoes();
            return;
        }

        fecharMenus();
        mostrarSugestoes.value = true;
        buscandoAlunos.value = true;

        timeoutBuscaAluno = setTimeout(async () => {
            const resultados = await buscarAlunos(termo);
            const idsJaSelecionados = new Set(alunosSelecionados.value.map(a => String(a.id)));
            sugestoesAlunos.value = resultados.filter(a => !idsJaSelecionados.has(String(a.id)));
            indiceSugestao.value = 0;
            buscandoAlunos.value = false;
        }, 250);
    };

    // Adiciona aluno à lista sem duplicar e remove todo o @termo (incluindo espaços) do texto
    const selecionarAluno = (aluno) => {
        const jaExiste = alunosSelecionados.value.some(a => String(a.id) === String(aluno.id));
        if (!jaExiste) {
            alunosSelecionados.value.push(aluno);
        }

        if (inputMensagem.value) {
            const cursor = inputMensagem.value.selectionStart ?? novaMensagem.value.length;
            const antes = novaMensagem.value.slice(0, cursor).replace(/(^|\s)@[^\n@]*$/, '$1');
            const depois = novaMensagem.value.slice(cursor);
            novaMensagem.value = `${antes}${depois}`;

            inputMensagem.value.focus();
            setTimeout(() => {
                inputMensagem.value.style.height = 'auto';
                inputMensagem.value.style.height = `${inputMensagem.value.scrollHeight}px`;
            }, 10);
        }

        fecharSugestoes();
    };

    const removerAlunoSelecionado = (alunoId) => {
        alunosSelecionados.value = alunosSelecionados.value.filter(
            a => String(a.id) !== String(alunoId)
        );
        if (inputMensagem.value) {
            inputMensagem.value.focus();
        }
    };

    const aoDigitar = (e) => {
        sinalizarDigitacao();
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
        verificarMencao(el);
    };

    // Navegação por teclado nas sugestões, cancelamento de resposta ou envio com Enter
    const aoPressionarTecla = (e) => {
        if (mostrarSugestoes.value) {
            if (e.key === 'ArrowDown' && sugestoesAlunos.value.length > 0) {
                e.preventDefault();
                indiceSugestao.value = (indiceSugestao.value + 1) % sugestoesAlunos.value.length;
                return;
            }
            if (e.key === 'ArrowUp' && sugestoesAlunos.value.length > 0) {
                e.preventDefault();
                indiceSugestao.value =
                    (indiceSugestao.value - 1 + sugestoesAlunos.value.length) % sugestoesAlunos.value.length;
                return;
            }
            if (e.key === 'Enter' && !e.shiftKey && sugestoesAlunos.value.length > 0) {
                e.preventDefault();
                selecionarAluno(sugestoesAlunos.value[indiceSugestao.value]);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                fecharSugestoes();
                return;
            }
        }

        if (e.key === 'Escape' && mensagemRespondendo.value) {
            e.preventDefault();
            e.stopPropagation();
            cancelarResposta();
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleEnviar();
        }
    };

    const handleEnviar = async () => {
        if ((!novaMensagem.value.trim() && !imagemSelecionada.value) || enviando.value) return;

        enviando.value = true;
        erroAnexo.value = '';

        const texto = novaMensagem.value;
        const alunosAtuais = [...alunosSelecionados.value];
        const respostaAtual = mensagemRespondendo.value;
        let anexoUrl = null;

        if (imagemSelecionada.value) {
            const { url, error } = await uploadAnexoChat(imagemSelecionada.value);
            if (error || !url) {
                erroAnexo.value = error || 'Erro ao enviar imagem.';
                enviando.value = false;
                return;
            }
            anexoUrl = url;
        }

        novaMensagem.value = '';
        alunosSelecionados.value = [];
        cancelarResposta();
        fecharMenus();
        fecharSugestoes();
        removerImagem();

        if (inputMensagem.value) {
            inputMensagem.value.style.height = 'auto';
        }

        const sucesso = await enviarMensagem(
            texto,
            alunosAtuais,
            anexoUrl,
            respostaAtual?.id || null
        );

        if (!sucesso) {
            novaMensagem.value = texto;
            alunosSelecionados.value = alunosAtuais;
            alert("Erro ao enviar mensagem. Verifique a sua conexão.");
        }

        enviando.value = false;
    };
</script>

<template>
    <div class="bg-white dark:bg-muted border-t border-slate-100 dark:border-border shrink-0">
        <div class="h-6 px-4 flex items-center bg-[#f8fafc] dark:bg-background">
            <span v-if="quemEstaDigitando.length > 0" class="text-[10px] text-slate-400 dark:text-muted-foreground italic">
                Digitando...
            </span>
        </div>

        <div ref="containerBarra" class="p-4 pt-0 relative">
            <!-- Input oculto para seleção de imagem no explorador -->
            <input
                ref="inputArquivo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                class="hidden"
                @change="aoSelecionarArquivo"
            />

            <!-- Popover: Sugestões de Alunos (@) -->
            <div
                v-if="mostrarSugestoes"
                class="absolute bottom-full left-4 right-4 mb-2 z-20 bg-white dark:bg-muted rounded-xl shadow-xl border border-slate-200 dark:border-border overflow-hidden"
            >
                <div class="px-3 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-muted-foreground border-b border-slate-100 dark:border-border flex items-center gap-1.5">
                    <AtSign class="w-3.5 h-3.5 text-violet-500" />
                    <span>Mencionar aluno</span>
                </div>

                <div v-if="buscandoAlunos" class="px-3 py-3 text-xs text-slate-400 dark:text-muted-foreground">
                    Buscando alunos...
                </div>

                <div v-else-if="sugestoesAlunos.length === 0" class="px-3 py-3 text-xs text-slate-400 dark:text-muted-foreground">
                    Nenhum aluno ativo encontrado.
                </div>

                <div v-else class="max-h-48 overflow-y-auto">
                    <button
                        v-for="(aluno, index) in sugestoesAlunos"
                        :key="aluno.id"
                        type="button"
                        @click="selecionarAluno(aluno)"
                        class="w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
                        :class="index === indiceSugestao
                            ? 'bg-violet-50 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300'
                            : 'text-slate-700 dark:text-foreground hover:bg-slate-50 dark:hover:bg-white/5'"
                    >
                        <span class="text-xs font-medium truncate">{{ aluno.nome }}</span>
                        <span class="text-[11px] text-slate-400 dark:text-muted-foreground shrink-0">{{ aluno.codigo }}</span>
                    </button>
                </div>
            </div>

            <!-- Popover: Menu de Ações (+) -->
            <div
                v-if="mostrarMenuAcoes"
                class="absolute bottom-full left-4 mb-2 z-20 w-44 p-1.5 bg-white dark:bg-muted rounded-xl shadow-xl border border-slate-200 dark:border-border flex flex-col gap-0.5"
            >
                <button
                    type="button"
                    @click="abrirSeletorArquivo"
                    class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-foreground hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                    <ImagePlus class="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                    <span>Enviar imagem</span>
                </button>

                <button
                    type="button"
                    @click="abrirEmojiPicker"
                    class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-foreground hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                    <Smile class="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Inserir emoji</span>
                </button>
            </div>

            <!-- Popover: Emoji Picker -->
            <div
                v-if="mostrarPicker"
                class="absolute bottom-full left-4 mb-2 z-20 shadow-xl rounded-xl border border-slate-200 dark:border-border overflow-hidden"
            >
                <EmojiPicker
                    @select="onSelectEmoji"
                    set="native"
                    :theme="isDark ? 'dark' : 'light'"
                />
            </div>

            <!-- Mensagem de erro de anexo -->
            <div
                v-if="erroAnexo"
                class="mb-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center justify-between gap-2"
            >
                <span>{{ erroAnexo }}</span>
                <button type="button" @click="erroAnexo = ''" class="cursor-pointer">
                    <X class="w-3.5 h-3.5" />
                </button>
            </div>

            <!-- Banner de Resposta (Reply) -->
            <div
                v-if="mensagemRespondendo"
                class="mb-2.5 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-background border border-slate-200 dark:border-border"
            >
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 dark:text-violet-400">
                        <Reply class="w-3.5 h-3.5 shrink-0" />
                        <span class="truncate">Respondendo a {{ autorMensagemRespondendo() }}</span>
                    </div>
                    <div class="text-xs text-slate-500 dark:text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        <Image v-if="mensagemRespondendo.anexo_url" class="w-3 h-3 shrink-0" />
                        <span class="truncate">
                            {{
                                limparFormatacaoPreview(mensagemRespondendo.texto)
                                || (mensagemRespondendo.anexo_url ? 'Imagem' : '')
                            }}
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    @click="cancelarResposta"
                    class="p-1 rounded-full text-slate-400 dark:text-muted-foreground hover:text-slate-600 dark:hover:text-foreground hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                    title="Cancelar resposta (Esc)"
                >
                    <X class="w-4 h-4" />
                </button>
            </div>

            <!-- Pré-visualização da imagem selecionada / colada -->
            <div
                v-if="previewImagemUrl"
                class="mb-2.5 flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-background border border-slate-200 dark:border-border"
            >
                <div class="relative shrink-0">
                    <img
                        :src="previewImagemUrl"
                        alt="Pré-visualização do anexo"
                        class="w-14 h-14 object-cover rounded-lg border border-slate-200 dark:border-border"
                    />
                    <button
                        type="button"
                        @click="removerImagem"
                        class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-800 text-white hover:bg-red-600 flex items-center justify-center shadow cursor-pointer transition-colors"
                        title="Remover imagem"
                    >
                        <X class="w-3 h-3" />
                    </button>
                </div>
                <div class="min-w-0 flex-1">
                    <p class="text-xs font-medium text-slate-700 dark:text-foreground truncate">
                        {{ imagemSelecionada?.name || 'Captura de tela' }}
                    </p>
                    <p class="text-[11px] text-slate-400 dark:text-muted-foreground">
                        Pronta para envio (opcionalmente adicione uma legenda)
                    </p>
                </div>
            </div>

            <!-- Chips compactos dos Alunos Mencionados -->
            <div
                v-if="alunosSelecionados.length > 0"
                class="mb-2.5 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto"
            >
                <span
                    v-for="aluno in alunosSelecionados"
                    :key="aluno.id"
                    class="inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-500/15 border border-violet-200/80 dark:border-violet-500/30 text-violet-700 dark:text-violet-300 text-xs"
                >
                    <AtSign class="w-3 h-3 shrink-0" />
                    <span class="font-medium truncate max-w-[180px]">{{ aluno.nome }}</span>
                    <span class="text-[10px] opacity-75 shrink-0">({{ aluno.codigo }})</span>
                    <button
                        type="button"
                        @click="removerAlunoSelecionado(aluno.id)"
                        class="p-0.5 rounded-full hover:bg-violet-200/70 dark:hover:bg-violet-500/30 transition-colors shrink-0 cursor-pointer"
                        title="Remover menção"
                    >
                        <X class="w-3 h-3" />
                    </button>
                </span>
            </div>

            <!-- Barra de Digitação -->
            <form @submit.prevent="handleEnviar" class="flex items-end gap-1.5 bg-slate-100 dark:bg-background p-1.5 rounded-3xl border border-slate-200 dark:border-border focus-within:border-violet-300 dark:focus-within:border-violet-500/60 focus-within:bg-white dark:focus-within:bg-background transition-colors shadow-inner dark:shadow-none">
                <button
                    type="button"
                    @click="toggleMenuAcoes"
                    :disabled="carregando || enviando"
                    class="w-9 h-10 flex items-center justify-center rounded-full transition-all shrink-0 cursor-pointer disabled:opacity-50"
                    :class="mostrarMenuAcoes || mostrarPicker
                        ? 'text-violet-600 dark:text-violet-400 bg-violet-100/70 dark:bg-violet-500/20'
                        : 'text-slate-400 dark:text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-200/50 dark:hover:bg-white/10'"
                    title="Mais opções (imagem ou emoji)"
                >
                    <Plus
                        class="w-5 h-5 transition-transform duration-200"
                        :class="mostrarMenuAcoes || mostrarPicker ? 'rotate-45' : ''"
                    />
                </button>

                <textarea
                    ref="inputMensagem"
                    v-model="novaMensagem"
                    @input="aoDigitar"
                    @paste="aoColar"
                    @focus="fecharMenus"
                    @keydown="aoPressionarTecla"
                    rows="1"
                    placeholder="Escreva algo... (@ aluno ou Ctrl+V print)"
                    class="sem-scroll flex-1 max-h-28 py-2.5 pl-1 pr-1 text-sm leading-5 bg-transparent border-none focus:outline-none focus:ring-0 text-slate-700 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground resize-none overflow-y-auto"
                    :disabled="carregando || enviando"
                ></textarea>

                <button
                    type="submit"
                    :disabled="(!novaMensagem.trim() && !imagemSelecionada) || enviando || carregando"
                    class="w-10 h-10 flex items-center justify-center bg-violet-600 text-white rounded-full hover:bg-violet-700 disabled:opacity-50 disabled:scale-95 transition-all shrink-0 shadow-md cursor-pointer"
                >
                    <Loader2 v-if="enviando" class="w-[18px] h-[18px] animate-spin" />
                    <Send v-else class="w-[18px] h-[18px] ml-0.5" />
                </button>
            </form>
        </div>
    </div>
</template>

<style scoped>
    .sem-scroll::-webkit-scrollbar {
        display: none;
    }
    .sem-scroll {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
</style>