<script setup>
    import { X } from '@lucide/vue';
    import { useChat } from '@/composables/useChat';
    import { formatarCargo } from '@/utils/chatFormatters';
    import Avatar from '../ui/Avatar.vue';

    const {
        colegas,
        currentUser,
        usuariosOnline,
        naoLidasGlobais,
        toggleWidget,
        abrirChatCom
    } = useChat();
</script>

<template>
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
                <Avatar :name="colega.nome" />
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