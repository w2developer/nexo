<script setup>
    import { ref } from 'vue';
    import { Send, Smile } from '@lucide/vue';
    import { useChat } from '@/composables/useChat';
    import EmojiPicker from 'vue3-emoji-picker';
    import 'vue3-emoji-picker/css';

    const {
        carregando,
        quemEstaDigitando,
        enviarMensagem,
        sinalizarDigitacao
    } = useChat();

    const novaMensagem = ref('');
    const inputMensagem = ref(null);
    const enviando = ref(false);

    // Estado do Emoji Picker
    const mostrarPicker = ref(false);

    const togglePicker = () => {
        mostrarPicker.value = !mostrarPicker.value;
    };

    const onSelectEmoji = (emoji) => {
        novaMensagem.value += emoji.i;
        mostrarPicker.value = false;
        
        // Mantém o foco no input e reajusta a altura se necessário
        if (inputMensagem.value) {
            inputMensagem.value.focus();
            setTimeout(() => {
                inputMensagem.value.style.height = 'auto';
                inputMensagem.value.style.height = `${inputMensagem.value.scrollHeight}px`;
            }, 10);
        }
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

        novaMensagem.value = '';
        mostrarPicker.value = false;

        if (inputMensagem.value) {
            inputMensagem.value.style.height = 'auto';
        }

        // Removido o envio do ID do aluno, passando apenas o texto
        const sucesso = await enviarMensagem(texto);

        if (!sucesso) {
            novaMensagem.value = texto;
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
            <!-- Popover: Emoji Picker -->
            <div
                v-if="mostrarPicker"
                class="absolute bottom-full left-4 mb-2 z-20 shadow-xl rounded-xl border border-slate-200 overflow-hidden"
            >
                <EmojiPicker @select="onSelectEmoji" set="native" />
            </div>

            <!-- Barra de Digitação -->
            <form @submit.prevent="handleEnviar" class="flex items-end gap-1.5 bg-slate-100 p-1.5 rounded-3xl border border-slate-200 focus-within:border-violet-300 focus-within:bg-white transition-colors shadow-inner">
                
                <!-- Botão Emoji (Substituiu o AtSign) -->
                <button
                    type="button"
                    @click="togglePicker"
                    class="w-9 h-10 flex items-center justify-center rounded-full transition-colors shrink-0 cursor-pointer"
                    :class="mostrarPicker ? 'text-violet-600 bg-violet-100/70' : 'text-slate-400 hover:text-violet-600 hover:bg-slate-200/50'"
                    title="Inserir emoji"
                >
                    <Smile class="w-5 h-5" />
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
</style>