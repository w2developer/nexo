<script setup>
    import { ref, watch, nextTick } from 'vue';
    import { MessageCircle, X, Send, ChevronLeft, User, Trash2 } from '@lucide/vue';
    import { useChat } from '@/composables/useChat';

    const { 
        colegas,             
        mensagens,           
        colegaAtivo,         
        widgetAberto,        
        currentUser,         
        carregando,          
        usuariosOnline,      
        quemEstaDigitando,   
        toggleWidget, 
        abrirChatCom, 
        fecharChat, 
        enviarMensagem, 
        excluirMensagem, 
        sinalizarDigitacao
    } = useChat();

    const novaMensagem = ref('');
    const containerMensagens = ref(null);
    const enviando = ref(false);

    // Mantém o scroll no fim da conversa
    watch(mensagens, async () => {
        await nextTick();
        if (containerMensagens.value) {
            containerMensagens.value.scrollTop = containerMensagens.value.scrollHeight;
        }
    }, { deep: true });

    // Trata o envio bloqueando múltiplos cliques
    const handleEnviar = async () => {
        if (!novaMensagem.value.trim() || enviando.value) return;
        
        enviando.value = true;
        const texto = novaMensagem.value;
        novaMensagem.value = ''; 
        
        const sucesso = await enviarMensagem(texto); 
        
        if (!sucesso) {
            novaMensagem.value = texto; 
            alert("Erro ao enviar mensagem. Verifique a sua conexão.");
        }
        
        enviando.value = false;
    };

    const formatarHora = (dataString) => {
        if (!dataString) return '';
        return new Date(dataString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    // Função: Transforma *texto* em negrito (evitando XSS básico escapando tags primeiro)
    const formatarTextoNegrito = (textoOriginal) => {
        if (!textoOriginal) return '';
        
        let textoSeguro = textoOriginal
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        // Aplica o regex para negrito (tudo entre asteriscos simples ou duplos)
        textoSeguro = textoSeguro.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
        
        return textoSeguro;
    };
</script>

<template>
    <div class="fixed bottom-6 right-6 z-[9999] flex flex-col items-end font-sans">
        
        <!-- Janela do Widget -->
        <div 
            v-if="widgetAberto" 
            class="mb-4 w-[360px] h-[550px] bg-slate-50 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 flex flex-col overflow-hidden"
        >
            
            <!-- TELA 1: LISTA DE CONTATOS REAIS -->
            <template v-if="!colegaAtivo">
                <div class="bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div>
                        <h3 class="font-bold text-slate-800 text-lg">Mensagens</h3>
                        <p class="text-xs text-slate-500">Logado como: {{ currentUser.nome }}</p>
                    </div>
                    <button @click="toggleWidget" class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X class="w-5 h-5" />
                    </button>
                </div>

                <div class="flex-1 overflow-y-auto bg-white">
                    <button 
                        v-for="colega in colegas" 
                        :key="colega.id"
                        @click="abrirChatCom(colega)"
                        class="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left border-b border-slate-50/50"
                    >
                        <div class="relative shrink-0">
                            <div class="w-12 h-12 bg-violet-50 text-violet-600 rounded-full flex items-center justify-center">
                                <User class="w-6 h-6" />
                            </div>
                            <!-- Ponto Online Dinâmico conectado ao Presence -->
                            <div 
                                class="absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-white rounded-full transition-colors duration-300"
                                :class="usuariosOnline.includes(colega.id) ? 'bg-emerald-500' : 'bg-slate-300'"
                            ></div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-semibold text-sm text-slate-800 truncate">{{ colega.nome }}</div>
                            <div class="text-xs text-slate-500 mt-0.5 capitalize">{{ colega.tipo || 'Colaborador' }}</div>
                        </div>
                    </button>

                    <div v-if="colegas.length === 0" class="p-8 text-center text-sm text-slate-400">
                        Nenhum colega encontrado.
                    </div>
                </div>
            </template>

            <!-- TELA 2: BATE-PAPO REAL -->
            <template v-else>
                <!-- Cabeçalho do Chat -->
                <div class="bg-white px-3 py-3 border-b border-slate-100 flex items-center gap-3 shrink-0 shadow-sm z-10">
                    <button @click="fecharChat" class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors shrink-0">
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

                <!-- Spinner enquanto carrega as mensagens -->
                <div v-if="carregando" class="flex-1 flex items-center justify-center bg-[#f8fafc]">
                    <div class="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                </div>

                <!-- Histórico de Mensagens Reais -->
                <div v-else ref="containerMensagens" class="flex-1 overflow-y-auto p-5 flex flex-col gap-5 bg-[#f8fafc]">
                    <div 
                        v-for="msg in mensagens" 
                        :key="msg.id"
                        class="flex w-full group"
                        :class="msg.remetente_id === currentUser.id ? 'justify-end' : 'justify-start'"
                    >
                        <div class="flex items-center gap-2 max-w-[85%]">
                            
                            <!-- Ícone de Apagar -->
                            <button 
                                v-if="msg.remetente_id === currentUser.id" 
                                @click="excluirMensagem(msg.id)"
                                class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 transition-opacity shrink-0"
                                title="Apagar mensagem"
                            >
                                <Trash2 class="w-4 h-4" />
                            </button>

                            <div class="flex flex-col" :class="msg.remetente_id === currentUser.id ? 'items-end' : 'items-start'">
                                <!-- AQUI ESTÁ A CORREÇÃO: Div vazia por dentro para o v-html funcionar -->
                                <div 
                                    class="px-4 py-2.5 text-[14px] leading-relaxed break-words whitespace-pre-wrap shadow-sm"
                                    style="word-break: break-word;"
                                    :class="msg.remetente_id === currentUser.id 
                                        ? 'bg-violet-600 text-white rounded-2xl rounded-tr-sm' 
                                        : 'bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-tl-sm'"
                                    v-html="formatarTextoNegrito(msg.texto)"
                                ></div>
                                
                                <div class="flex items-center gap-1.5 mt-1.5 px-1">
                                    <span class="text-[10px] text-slate-400 font-medium">
                                        {{ formatarHora(msg.criado_em) }}
                                    </span>
                                    <!-- Bolinha de Status de Leitura no Banco (Apenas para as suas mensagens) -->
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

                <!-- Input e Digitação -->
                <div class="bg-white border-t border-slate-100 shrink-0">
                    
                    <!-- Feedback visual de digitação do Supabase Broadcast -->
                    <div class="h-6 px-4 flex items-center bg-[#f8fafc]">
                        <span v-if="quemEstaDigitando.length > 0" class="text-[10px] text-slate-400 italic">
                            A escrever...
                        </span>
                    </div>

                    <div class="p-4 pt-0">
                        <form @submit.prevent="handleEnviar" class="flex items-center gap-2 bg-slate-100 p-1 rounded-full border border-slate-200 focus-within:border-violet-300 focus-within:bg-white transition-colors shadow-inner">
                            <input 
                                v-model="novaMensagem" 
                                @input="sinalizarDigitacao"
                                type="text"
                                placeholder="Escreva algo..." 
                                class="flex-1 h-10 px-4 text-sm bg-transparent border-none focus:outline-none focus:ring-0 text-slate-700"
                                :disabled="carregando"
                            />
                            <button 
                                type="submit" 
                                :disabled="!novaMensagem.trim() || enviando || carregando" 
                                class="w-10 h-10 flex items-center justify-center bg-violet-600 text-white rounded-full hover:bg-violet-700 disabled:opacity-50 disabled:scale-95 transition-all shrink-0 shadow-md"
                            >
                                <Send class="w-[18px] h-[18px] ml-0.5" />
                            </button>
                        </form>
                    </div>
                </div>
            </template>
        </div>

        <!-- Botão Principal Flutuante -->
        <button 
            @click="toggleWidget"
            class="w-14 h-14 bg-violet-600 text-white rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center"
        >
            <X class="w-6 h-6" v-if="widgetAberto" />
            <MessageCircle class="w-6 h-6" v-else />
        </button>
    </div>
</template>