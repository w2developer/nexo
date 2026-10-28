<script setup>
    import { ref, watch, nextTick } from 'vue';
    import { MessageCircle, X, Send, ChevronLeft, User, Trash2, ThumbsUp, AtSign, Search } from '@lucide/vue';
    import { useChat } from '@/composables/useChat';
    import Avatar from '../ui/Avatar.vue';

    const { 
        colegas,             
        mensagens,           
        colegaAtivo,         
        widgetAberto,        
        currentUser,         
        carregando,          
        usuariosOnline,      
        quemEstaDigitando,
        naoLidasGlobais,
        temMensagemNaoLida,   
        toggleWidget, 
        abrirChatCom, 
        fecharChat, 
        enviarMensagem, 
        excluirMensagem,
        confirmarLike, 
        sinalizarDigitacao,
        buscarAlunos
    } = useChat();

    const novaMensagem = ref('');
    const containerMensagens = ref(null);
    const inputMensagem = ref(null);
    const enviando = ref(false);

    // Controle da menção de aluno
    const mostrarBuscaAluno = ref(false);
    const termoBuscaAluno = ref('');
    const listaAlunos = ref([]);
    const alunoSelecionado = ref(null);
    const buscandoAlunos = ref(false);

    // Rola para o final ao receber/enviar novas mensagens (ignora exclusões)
    watch(() => mensagens.value.length, async (novoTamanho, tamanhoAntigo) => {
        if (tamanhoAntigo !== undefined && novoTamanho < tamanhoAntigo) return;

        await nextTick();
        if (containerMensagens.value) {
            containerMensagens.value.scrollTop = containerMensagens.value.scrollHeight;
        }
    });

    // Busca alunos dinamicamente conforme o usuário digita no popover
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

    const limparSelecaoAluno = () => {
        mostrarBuscaAluno.value = false;
        termoBuscaAluno.value = '';
        listaAlunos.value = [];
        alunoSelecionado.value = null;
    };

    // Ajusta altura do textarea conforme quebras de linha
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

    const voltarParaLista = () => {
        limparSelecaoAluno();
        fecharChat();
    };

    const fecharChateWidget = () => {
        limparSelecaoAluno();
        fecharChat();
        toggleWidget();
    };

    const formatarHora = (dataString) => {
        if (!dataString) return '';
        return new Date(dataString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatarDiaMes = (dataString) => {
        if (!dataString) return '';
        return new Date(dataString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    // Escapa HTML contra XSS e converte *texto* em negrito (suporta múltiplas linhas)
    const formatarTextoNegrito = (textoOriginal) => {
        if (!textoOriginal) return '';
        
        let textoSeguro = textoOriginal
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        return textoSeguro.replace(/\*(.*?)\*/gs, '<strong>$1</strong>');
    };

    // Dicionário de cargos
    const formatadorCargos = {
        'professor': 'Professor (a)',
        'secretaria': 'Secretário (a)',
        'admin': 'Administrador (a)',
        'aluno': 'Aluno (a)'
    }

    // Formata o cargo recebido
    const formatarCargo = (tipo) => {
        if (!tipo) return 'Colaborador'
        
        const tipoLimpo = tipo.toLowerCase()
        return formatadorCargos[tipoLimpo] || (tipo.charAt(0).toUpperCase() + tipo.slice(1))
    }
</script>

<template>
    <!-- Overlay de fundo quando o chat está aberto -->
    <Transition name="fade">
        <div 
            v-if="widgetAberto" 
            @click="toggleWidget"
            class="fixed inset-0 bg-slate-900/20 z-[9998]"
        ></div>
    </Transition>

    <div class="fixed bottom-6 left-6 z-[9999] flex flex-col items-start font-sans">
        
        <!-- Janela Principal do Widget -->
        <div 
            v-if="widgetAberto" 
            class="mb-4 w-[360px] h-[550px] bg-slate-50 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 flex flex-col overflow-hidden"
        >
            
            <!-- TELA 1: LISTA DE CONTATOS -->
            <template v-if="!colegaAtivo">
                <div class="bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div>
                        <h3 class="font-bold text-slate-800 text-lg">Mensagens</h3>
                        <p class="text-xs text-slate-500">Logado como: {{ currentUser.nome }}</p>
                    </div>
                    <button @click="toggleWidget" class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                        <X class="w-5 h-5" />
                    </button>
                </div>

                <div class="flex-1 overflow-y-auto bg-white scroll-fino">
                    <button 
                        v-for="colega in colegas" 
                        :key="colega.id"
                        @click="abrirChatCom(colega)"
                        class="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left border-b border-slate-50/50 cursor-pointer"
                    >
                        <div class="relative shrink-0">
                            <Avatar :name="colega.nome"></Avatar>
                            <!-- <div class="w-12 h-12 bg-violet-50 text-violet-600 rounded-full flex items-center justify-center">
                                <User class="w-6 h-6" />
                            </div> -->
                            <div 
                                class="absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-white rounded-full transition-colors duration-300"
                                :class="usuariosOnline.includes(colega.id) ? 'bg-emerald-500' : 'bg-slate-300'"
                            ></div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-semibold text-sm text-slate-800 truncate">
                                {{ colega.tipo?.toLowerCase() === 'admin' ? 'Relatar Problemas' : colega.nome }}
                            </div>
                            <div class="text-xs text-slate-500 mt-0.5">
                                {{ formatarCargo(colega.tipo) }}
                            </div>
                        </div>

                        <!-- Indicador de mensagem não lida por contato -->
                        <span
                            v-if="naoLidasGlobais[colega.id] > 0"
                            class="relative flex w-2.5 h-2.5 shrink-0"
                        >
                            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span class="relative inline-flex rounded-full w-2.5 h-2.5 bg-red-600"></span>
                        </span>
                    </button>

                    <div v-if="colegas.length === 0" class="p-8 text-center text-sm text-slate-400">
                        Nenhum colega encontrado.
                    </div>
                </div>
            </template>

            <!-- TELA 2: CONVERSA ATIVA -->
            <template v-else>
                <!-- Cabeçalho da Conversa -->
                <div class="bg-white px-3 py-3 border-b border-slate-100 flex justify-between gap-3 shrink-0 shadow-sm z-10">
                    <div class="flex items-center gap-3 shrink-0">
                        <button @click="voltarParaLista" class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors shrink-0 cursor-pointer">
                            <ChevronLeft class="w-5 h-5" />
                        </button>
                        
                        <div class="relative shrink-0">
                            <div class="w-10 h-10 bg-violet-50 text-violet-600 rounded-full flex items-center justify-center">
                                <User class="w-5 h-5" />
                            </div>
                        </div>
                        
                        <div class="flex flex-col min-w-0">
                            <h3 class="font-bold text-sm text-slate-800 truncate">{{ colegaAtivo.nome }}</h3>
                            <span class="text-[11px] font-medium transition-colors duration-300" :class="usuariosOnline.includes(colegaAtivo.id) ? 'text-emerald-500' : 'text-slate-400'">
                                {{ usuariosOnline.includes(colegaAtivo.id) ? 'Online agora' : 'Offline' }}
                            </span>
                        </div>
                    </div>

                    <button @click="fecharChateWidget" class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                        <X class="w-5 h-5" />
                    </button>
                </div>

                <!-- Loading do Histórico -->
                <div v-if="carregando" class="flex-1 flex items-center justify-center bg-[#f8fafc]">
                    <div class="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                </div>

                <!-- Lista de Mensagens (com overflow-x-hidden para travar qualquer estouro lateral) -->
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
                                        <!-- Menção do Aluno no Balão (Nome trunca, mas o Código nunca é cortado) -->
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

                <!-- Área Inferior: Indicador de Digitação + Input -->
                <div class="bg-white border-t border-slate-100 shrink-0">
                    
                    <div class="h-6 px-4 flex items-center bg-[#f8fafc]">
                        <span v-if="quemEstaDigitando.length > 0" class="text-[10px] text-slate-400 italic">
                            Digitando...
                        </span>
                    </div>

                    <div class="p-4 pt-0 relative">
                        
                        <!-- Popover Flutuante: Busca de Alunos -->
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

                        <!-- Pílula do Aluno Mencionado (Sem o texto "Assunto:") -->
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
        </div>

        <!-- Botão Flutuante Principal (FAB) -->
        <button 
            @click="toggleWidget"
            class="relative w-14 h-14 bg-violet-600 text-white rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center cursor-pointer"
        >
            <!-- Tooltip de Nova Mensagem -->
            <div 
                v-if="temMensagemNaoLida && !widgetAberto" 
                class="absolute -top-10 left-0 bg-slate-800 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-md whitespace-nowrap flex items-center gap-2 pointer-events-none"
            >
                <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                Nova Mensagem
                <span class="absolute -bottom-1 left-5 w-2 h-2 bg-slate-800 rotate-45"></span>
            </div>

            <X class="w-6 h-6" v-if="widgetAberto" />
            <MessageCircle class="w-6 h-6" v-else />
        </button>
    </div>
</template>

<style scoped>
/* Transição do overlay de fundo */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

/* Oculta scrollbar no textarea mantendo o scroll funcional */
.sem-scroll::-webkit-scrollbar {
    display: none;
}
.sem-scroll {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

/* Scrollbar discreta para listas de mensagens e busca */
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