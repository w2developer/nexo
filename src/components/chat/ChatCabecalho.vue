<script setup>
    import { ChevronLeft, User, X } from '@lucide/vue';
    import { useChat } from '@/composables/useChat';

    const { colegaAtivo, usuariosOnline, fecharChat, toggleWidget } = useChat();

    const fecharChateWidget = () => {
        fecharChat();
        toggleWidget();
    };
</script>

<template>
    <div class="bg-white px-3 py-3 border-b border-slate-100 flex justify-between gap-3 shrink-0 shadow-sm z-10">
        <div class="flex items-center gap-3 shrink-0">
            <button @click="fecharChat" class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors shrink-0 cursor-pointer">
                <ChevronLeft class="w-5 h-5" />
            </button>

            <div class="relative shrink-0">
                <div class="w-10 h-10 bg-violet-50 text-violet-600 rounded-full flex items-center justify-center">
                    <User class="w-5 h-5" />
                </div>
            </div>

            <div class="flex flex-col min-w-0">
                <h3 class="font-bold text-sm text-slate-800 truncate">{{ colegaAtivo.nome }}</h3>
                <span
                    class="text-[11px] font-medium transition-colors duration-300"
                    :class="usuariosOnline.includes(colegaAtivo.id) ? 'text-emerald-500' : 'text-slate-400'"
                >
                    {{ usuariosOnline.includes(colegaAtivo.id) ? 'Online agora' : 'Offline' }}
                </span>
            </div>
        </div>

        <button @click="fecharChateWidget" class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
            <X class="w-5 h-5" />
        </button>
    </div>
</template>