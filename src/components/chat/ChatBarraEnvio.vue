<script setup>
    import { ref, onUnmounted } from 'vue';
    import { Send, Smile, AtSign, X } from '@lucide/vue';
    import { useChat } from '@/composables/useChat';
    import { useTheme } from '@/composables/useTheme';
    import { useClickOutside } from '@/composables/useClickOutside';
    import EmojiPicker from 'vue3-emoji-picker';
    import 'vue3-emoji-picker/css';

    const {
        carregando,
        quemEstaDigitando,
        enviarMensagem,
        sinalizarDigitacao,
        buscarAlunos
    } = useChat();

    const { isDark } = useTheme();

    const novaMensagem = ref('');
    const inputMensagem = ref(null);
    const containerBarra = ref(null);
    const enviando = ref(false);

    // Estado do Emoji Picker
    const mostrarPicker = ref(false);

    // Estado da menção de alunos (@)
    const alunosSelecionados = ref([]);
    const sugestoesAlunos = ref([]);
    const buscandoAlunos = ref(false);
    const mostrarSugestoes = ref(false);
    const indiceSugestao = ref(0);
    let timeoutBuscaAluno = null;

    // Fecha popovers ao clicar fora da barra de envio
    useClickOutside(containerBarra, () => {
        if (mostrarPicker.value) {
            mostrarPicker.value = false;
        }
        if (mostrarSugestoes.value) {
            fecharSugestoes();
        }
    });

    onUnmounted(() => {
        clearTimeout(timeoutBuscaAluno);
    });

    const fecharSugestoes = () => {
        mostrarSugestoes.value = false;
        sugestoesAlunos.value = [];
        indiceSugestao.value = 0;
    };

    const togglePicker = () => {
        mostrarPicker.value = !mostrarPicker.value;
        if (mostrarPicker.value) {
            fecharSugestoes();
        }
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

    // Detecta padrão @termo antes do cursor e dispara busca com debounce
    const verificarMencao = (el) => {
        const cursor = el.selectionStart ?? novaMensagem.value.length;
        const textoAteCursor = novaMensagem.value.slice(0, cursor);
        const match = textoAteCursor.match(/(?:^|\s)@([^\s@]{2,})$/);

        clearTimeout(timeoutBuscaAluno);

        if (!match) {
            fecharSugestoes();
            return;
        }

        const termo = match[1];
        mostrarPicker.value = false;
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

    // Adiciona aluno à lista sem duplicar e remove o @termo do texto
    const selecionarAluno = (aluno) => {
        const jaExiste = alunosSelecionados.value.some(a => String(a.id) === String(aluno.id));
        if (!jaExiste) {
            alunosSelecionados.value.push(aluno);
        }

        if (inputMensagem.value) {
            const cursor = inputMensagem.value.selectionStart ?? novaMensagem.value.length;
            const antes = novaMensagem.value.slice(0, cursor).replace(/(^|\s)@[^\s@]*$/, '$1');
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

    // Navegação por teclado nas sugestões ou envio com Enter
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

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleEnviar();
        }
    };

    const handleEnviar = async () => {
        if (!novaMensagem.value.trim() || enviando.value) return;

        enviando.value = true;
        const texto = novaMensagem.value;
        const alunosAtuais = [...alunosSelecionados.value];

        novaMensagem.value = '';
        alunosSelecionados.value = [];
        mostrarPicker.value = false;
        fecharSugestoes();

        if (inputMensagem.value) {
            inputMensagem.value.style.height = 'auto';
        }

        const sucesso = await enviarMensagem(texto, alunosAtuais);

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
                    @click="togglePicker"
                    class="w-9 h-10 flex items-center justify-center rounded-full transition-colors shrink-0 cursor-pointer"
                    :class="mostrarPicker
                        ? 'text-violet-600 dark:text-violet-400 bg-violet-100/70 dark:bg-violet-500/20'
                        : 'text-slate-400 dark:text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-200/50 dark:hover:bg-white/10'"
                    title="Inserir emoji"
                >
                    <Smile class="w-5 h-5" />
                </button>

                <textarea
                    ref="inputMensagem"
                    v-model="novaMensagem"
                    @input="aoDigitar"
                    @focus="mostrarPicker = false"
                    @keydown="aoPressionarTecla"
                    rows="1"
                    placeholder="Escreva algo... (use @ para mencionar aluno)"
                    class="sem-scroll flex-1 max-h-28 py-2.5 pl-1 pr-1 text-sm leading-5 bg-transparent border-none focus:outline-none focus:ring-0 text-slate-700 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground resize-none overflow-y-auto"
                    :disabled="carregando"
                ></textarea>

                <button
                    type="submit"
                    :disabled="!novaMensagem.trim() || enviando || carregando"
                    class="w-10 h-10 flex items-center justify-center bg-violet-600 text-white rounded-full hover:bg-violet-700 disabled:opacity-50 disabled:scale-95 transition-all shrink-0 shadow-md cursor-pointer"
                >
                    <Send class="w-[18px] h-[18px] ml-0.5" />
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