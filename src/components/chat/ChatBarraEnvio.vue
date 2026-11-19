<script setup>
    import { ref } from 'vue';
    import { Send, Smile } from '@lucide/vue';
    import { useChat } from '@/composables/useChat';
    import { useTheme } from '@/composables/useTheme';
    import { useClickOutside } from '@/composables/useClickOutside';
    import EmojiPicker from 'vue3-emoji-picker';
    import 'vue3-emoji-picker/css';

    const {
        carregando,
        quemEstaDigitando,
        enviarMensagem,
        sinalizarDigitacao
    } = useChat();

    const { isDark } = useTheme();

    const novaMensagem = ref('');
    const inputMensagem = ref(null);
    const containerBarra = ref(null);
    const enviando = ref(false);

    // Estado do Emoji Picker
    const mostrarPicker = ref(false);

    // Fecha o seletor ao clicar fora da barra de envio
    useClickOutside(containerBarra, () => {
        if (mostrarPicker.value) {
            mostrarPicker.value = false;
        }
    });

    const togglePicker = () => {
        mostrarPicker.value = !mostrarPicker.value;
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

        const sucesso = await enviarMensagem(texto);

        if (!sucesso) {
            novaMensagem.value = texto;
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
                    @keydown.enter.exact.prevent="handleEnviar"
                    rows="1"
                    placeholder="Escreva algo..."
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