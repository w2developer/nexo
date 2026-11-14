<script setup>
    import { ref, watch } from 'vue';
    import { Send, X, AtSign, Search } from '@lucide/vue';
    import { useChat } from '@/composables/useChat';

    const {
        carregando,
        quemEstaDigitando,
        enviarMensagem,
        sinalizarDigitacao,
        buscarAlunos
    } = useChat();

    const novaMensagem = ref('');
    const inputMensagem = ref(null);
    const enviando = ref(false);

    // Estado da menção de aluno
    const mostrarBuscaAluno = ref(false);
    const termoBuscaAluno = ref('');
    const listaAlunos = ref([]);
    const alunoSelecionado = ref(null);
    const buscandoAlunos = ref(false);

    // Busca alunos dinamicamente
    watch(termoBuscaAluno, async (valor) => {
        if (valor.trim().length < 2) {
            listaAlunos.value = [];
            return;
        }
        buscandoAlunos.value = true;
        listaAlunos.value = await buscarAlunos(valor);
        buscandoAlunos.value = false;
    });

    const selecionarAluno = (aluno) => {
        alunoSelecionado.value = aluno;
        mostrarBuscaAluno.value = false;
        termoBuscaAluno.value = '';
        listaAlunos.value = [];
        inputMensagem.value?.focus();
    };

    // Ajusta altura do textarea
    const aoDigitar = (e) => {
        sinalizarDigitacao();
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    };

    const handleEnviar = async () => {
        if (!novaMensagem.value.trim() || enviando.value) return;

        enviando.value = true;
        const texto = novaMensagem.value;
        const alunoBackup = alunoSelecionado.value;

        novaMensagem.value = '';
        alunoSelecionado.value = null;
        mostrarBuscaAluno.value = false;

        if (inputMensagem.value) {
            inputMensagem.value.style.height = 'auto';
        }

        const sucesso = await enviarMensagem(texto, alunoBackup?.id || null);

        if (!sucesso) {
            novaMensagem.value = texto;
            alunoSelecionado.value = alunoBackup;
            alert("Erro ao enviar mensagem. Verifique a sua conexão.");
        }

        enviando.value = false;
    };
</script>

<template>
    <div class="bg-white border-t border-slate-100 shrink-0">
        <div class="h-6 px-4 flex items-center bg-[#f8fafc]">
            <span v-if="quemEstaDigitando.length > 0" class="text-[10px] text-slate-400 italic">
                Digitando...
            </span>
        </div>

        <div class="p-4 pt-0 relative">
            <!-- Popover: Busca de Alunos -->
            <div
                v-if="mostrarBuscaAluno"
                class="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-xl shadow-lg border border-slate-200 p-2.5 z-20"
            >
                <div class="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                    <Search class="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                        v-model="termoBuscaAluno"
                        type="text"
                        placeholder="Mencionar aluno por nome ou código..."
                        class="w-full text-xs bg-transparent border-none focus:outline-none text-slate-700"
                    />
                    <button type="button" @click="mostrarBuscaAluno = false" class="text-slate-400 hover:text-slate-600 cursor-pointer">
                        <X class="w-3.5 h-3.5" />
                    </button>
                </div>

                <div class="max-h-36 overflow-y-auto mt-1.5 divide-y divide-slate-50 scroll-fino">
                    <div v-if="buscandoAlunos" class="p-2 text-center text-xs text-slate-400">
                        Buscando...
                    </div>
                    <div v-else-if="termoBuscaAluno.trim().length >= 2 && listaAlunos.length === 0" class="p-2 text-center text-xs text-slate-400">
                        Nenhum aluno encontrado.
                    </div>
                    <div v-else-if="termoBuscaAluno.trim().length < 2" class="p-2 text-center text-[11px] text-slate-400">
                        Digite pelo menos 2 letras para buscar.
                    </div>
                    <button
                        v-for="aluno in listaAlunos"
                        :key="aluno.id"
                        type="button"
                        @click="selecionarAluno(aluno)"
                        class="w-full text-left px-2.5 py-2 hover:bg-violet-50 rounded-lg transition-colors flex items-center justify-between gap-2 cursor-pointer"
                    >
                        <span class="text-xs font-medium text-slate-700 truncate">{{ aluno.nome }}</span>
                        <span class="text-[10px] font-semibold text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded shrink-0">{{ aluno.codigo }}</span>
                    </button>
                </div>
            </div>

            <!-- Pílula do Aluno Mencionado -->
            <div
                v-if="alunoSelecionado"
                class="flex items-center justify-between gap-2 px-3 py-1.5 mb-2 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-700"
            >
                <div class="flex items-center gap-1.5 min-w-0">
                    <AtSign class="w-3.5 h-3.5 shrink-0 text-violet-600" />
                    <span class="font-semibold truncate">{{ alunoSelecionado.nome }}</span>
                    <span class="text-[10px] font-medium bg-violet-200/60 text-violet-800 px-1.5 py-0.5 rounded shrink-0">
                        {{ alunoSelecionado.codigo }}
                    </span>
                </div>
                <button type="button" @click="alunoSelecionado = null" class="text-violet-400 hover:text-violet-700 cursor-pointer shrink-0">
                    <X class="w-3.5 h-3.5" />
                </button>
            </div>

            <!-- Barra de Digitação -->
            <form @submit.prevent="handleEnviar" class="flex items-end gap-1.5 bg-slate-100 p-1.5 rounded-3xl border border-slate-200 focus-within:border-violet-300 focus-within:bg-white transition-colors shadow-inner">
                <button
                    type="button"
                    @click="mostrarBuscaAluno = !mostrarBuscaAluno"
                    class="w-9 h-10 flex items-center justify-center rounded-full transition-colors shrink-0 cursor-pointer"
                    :class="alunoSelecionado || mostrarBuscaAluno ? 'text-violet-600 bg-violet-100/70' : 'text-slate-400 hover:text-violet-600 hover:bg-slate-200/50'"
                    title="Mencionar aluno"
                >
                    <AtSign class="w-5 h-5" />
                </button>

                <textarea
                    ref="inputMensagem"
                    v-model="novaMensagem"
                    @input="aoDigitar"
                    @keydown.enter.exact.prevent="handleEnviar"
                    rows="1"
                    placeholder="Escreva algo..."
                    class="sem-scroll flex-1 max-h-28 py-2.5 pl-1 pr-1 text-sm leading-5 bg-transparent border-none focus:outline-none focus:ring-0 text-slate-700 resize-none overflow-y-auto"
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