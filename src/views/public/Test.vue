<template>
    <div class="flex h-[85vh] min-h-[700px] w-full bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 font-sans">
        
        <!-- Sidebar de Canais -->
        <aside class="w-80 flex flex-col bg-white border-r border-slate-200 z-10">
            <div class="p-4 border-b border-slate-200 flex items-center justify-between">
                <h2 class="text-xl font-bold">Mensagens</h2>
                <button class="p-2 hover:bg-slate-100 rounded-full transition">
                    <Search class="w-5 h-5 text-slate-500" />
                </button>
            </div>
            
            <div class="flex-1 overflow-y-auto p-3 space-y-1">
                <!-- Canal Ativo Simulado -->
                <div class="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3 cursor-pointer">
                    <div class="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
                        <Hash class="w-5 h-5" />
                    </div>
                    <div class="flex-1 overflow-hidden">
                        <h3 class="font-semibold text-slate-900 truncate">equipe-dev</h3>
                        <p class="text-sm text-slate-500 truncate">Maria: Vê esse preview...</p>
                    </div>
                    <div class="flex flex-col items-end gap-1">
                        <span class="text-xs text-indigo-600 font-medium">10:48</span>
                        <span class="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">3</span>
                    </div>
                </div>
            </div>
        </aside>

        <!-- Área Principal de Chat -->
        <main class="flex-1 flex flex-col bg-[#F8FAFC]">
            
            <!-- Header do Canal -->
            <header class="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <Hash class="w-6 h-6" />
                    </div>
                    <div>
                        <h3 class="font-bold text-lg leading-tight">equipe-dev</h3>
                        <p class="text-xs text-slate-500">4 membros, 2 online</p>
                    </div>
                </div>
                <button class="p-2 hover:bg-slate-100 rounded-full transition text-slate-500">
                    <MoreVertical class="w-5 h-5" />
                </button>
            </header>

            <!-- Histórico de Mensagens -->
            <div class="flex-1 overflow-y-auto p-6 space-y-7" ref="chatContainer">
                <div 
                    v-for="msg in messages" 
                    :key="msg.id" 
                    class="flex gap-3 group relative"
                    :class="{ 'flex-row-reverse': msg.user.id === currentUser.id }"
                >
                    <!-- Avatar -->
                    <img 
                        v-if="msg.user.id !== currentUser.id" 
                        :src="msg.user.avatar" 
                        class="w-9 h-9 rounded-full shadow-sm mt-auto"
                        alt="Avatar do usuário"
                    />

                    <!-- Bloco da Mensagem -->
                    <div class="flex flex-col relative max-w-[65%]" :class="{ 'items-end': msg.user.id === currentUser.id }">
                        
                        <span class="text-[11px] font-medium text-slate-400 mb-1 px-1" v-if="msg.user.id !== currentUser.id">
                            {{ msg.user.name }}
                        </span>

                        <!-- Balão com Tailwind 4 -->
                        <div 
                            class="relative px-4 py-2.5 rounded-2xl shadow-sm text-[15px] leading-relaxed"
                            :class="msg.user.id === currentUser.id ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'"
                        >
                            <p>{{ msg.text }}</p>

                            <!-- Preview de Link -->
                            <div v-if="msg.linkPreview" class="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-slate-800">
                                <img :src="msg.linkPreview.image" class="w-full h-36 object-cover" alt="Preview" />
                                <div class="p-3">
                                    <h4 class="font-semibold text-sm truncate">{{ msg.linkPreview.title }}</h4>
                                    <p class="text-xs text-slate-500 mt-1 line-clamp-2">{{ msg.linkPreview.description }}</p>
                                </div>
                            </div>
                        </div>

                        <!-- Rodapé: Hora e Recibo de Leitura -->
                        <div class="flex items-center gap-1 mt-1 px-1">
                            <span class="text-[11px] text-slate-400">{{ msg.time }}</span>
                            <CheckCheck 
                                v-if="msg.user.id === currentUser.id" 
                                class="w-4 h-4" 
                                :class="msg.isRead ? 'text-blue-500' : 'text-slate-300'" 
                            />
                        </div>

                        <!-- Reações Flutuantes -->
                        <div v-if="msg.reactions && msg.reactions.length" class="absolute -bottom-3 flex gap-1 z-10" :class="msg.user.id === currentUser.id ? 'right-4' : 'left-4'">
                            <div v-for="(react, idx) in msg.reactions" :key="idx" class="flex items-center gap-1 bg-white border border-slate-200 shadow-sm rounded-full px-2 py-0.5 text-[11px] cursor-pointer hover:bg-slate-50">
                                <span>{{ react.emoji }}</span>
                                <span class="font-semibold text-slate-600">{{ react.count }}</span>
                            </div>
                        </div>

                        <!-- Threads de Respostas -->
                        <div v-if="msg.thread" class="mt-4 flex items-center gap-2 cursor-pointer text-indigo-600 hover:text-indigo-700 transition">
                            <div class="flex -space-x-2">
                                <img src="https://i.pravatar.cc/150?u=wanderson" class="w-6 h-6 rounded-full border-2 border-[#F8FAFC]" />
                                <img src="https://i.pravatar.cc/150?u=maria" class="w-6 h-6 rounded-full border-2 border-[#F8FAFC]" />
                            </div>
                            <span class="text-xs font-bold">{{ msg.thread.replyCount }} respostas</span>
                        </div>

                        <!-- Menu de Ações (Aparece no Hover) -->
                        <div class="absolute top-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-white border border-slate-200 shadow-sm rounded-lg p-1 z-10" :class="msg.user.id === currentUser.id ? '-left-28' : '-right-28'">
                            <button class="p-1.5 hover:bg-slate-100 rounded text-slate-500 transition" title="Reagir"><SmilePlus class="w-4 h-4" /></button>
                            <button class="p-1.5 hover:bg-slate-100 rounded text-slate-500 transition" title="Responder"><Reply class="w-4 h-4" /></button>
                            <button class="p-1.5 hover:bg-slate-100 rounded text-slate-500 transition" title="Mais"><MoreVertical class="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>

                <!-- Indicador de Digitação -->
                <div v-if="isTyping" class="flex items-end gap-3 text-slate-500 text-sm mt-4">
                    <img src="https://i.pravatar.cc/150?u=maria" class="w-9 h-9 rounded-full shadow-sm" />
                    <div class="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1.5 shadow-sm">
                        <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                        <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
                        <span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
                    </div>
                </div>
            </div>

            <!-- Caixa de Input -->
            <div class="p-4 bg-white border-t border-slate-200 z-10">
                <div class="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all shadow-sm">
                    
                    <button class="p-2.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition">
                        <Paperclip class="w-5 h-5" />
                    </button>
                    
                    <textarea 
                        v-model="newMessage" 
                        @keydown.enter.prevent="handleSend"
                        rows="1" 
                        placeholder="Escreva sua mensagem..." 
                        class="flex-1 bg-transparent border-none outline-none resize-none py-2.5 max-h-32 text-slate-700 placeholder-slate-400"
                    ></textarea>
                    
                    <button class="p-2.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition">
                        <Smile class="w-5 h-5" />
                    </button>
                    <button 
                        @click="handleSend" 
                        :disabled="!newMessage.trim()"
                        class="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md"
                    >
                        <Send class="w-5 h-5" />
                    </button>
                </div>
            </div>
        </main>
    </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';
import { Search, Hash, MoreVertical, Paperclip, Smile, Send, CheckCheck, Reply, SmilePlus } from '@lucide/vue';

// Dados do usuário
const currentUser = { id: 1, name: 'Wanderson', avatar: 'https://i.pravatar.cc/150?u=wanderson' };

const newMessage = ref('');
const isTyping = ref(false);
const chatContainer = ref(null);

// Dados visuais simulados
const messages = ref([
    {
        id: 1,
        user: { id: 2, name: 'Maria', avatar: 'https://i.pravatar.cc/150?u=maria' },
        text: 'E aí Wanderson, conseguiu ver aquela doc do Supabase?',
        time: '10:42',
        reactions: [{ emoji: '👍', count: 1 }],
        isRead: true
    },
    {
        id: 2,
        user: currentUser,
        text: 'Fala Maria! Vi sim, achei bem legal mas preferia fazer uma UI do zero no Tailwind 4. O que acha?',
        time: '10:45',
        reactions: [],
        isRead: true
    },
    {
        id: 3,
        user: { id: 2, name: 'Maria', avatar: 'https://i.pravatar.cc/150?u=maria' },
        text: 'Concordo plenamente! Olha que massa essa thread aqui.',
        time: '10:47',
        reactions: [{ emoji: '🔥', count: 2 }, { emoji: '❤️', count: 1 }],
        thread: { replyCount: 3 },
        isRead: true
    },
    {
        id: 4,
        user: { id: 2, name: 'Maria', avatar: 'https://i.pravatar.cc/150?u=maria' },
        text: 'Vê esse preview do design:',
        time: '10:48',
        reactions: [],
        linkPreview: {
            title: 'Figma - Chat UI Kit Avançado',
            description: 'Componentes modernos para chat construídos para Vue 3 e TailwindCSS 4.',
            image: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=400&auto=format&fit=crop'
        },
        isRead: true
    }
]);

// Rola para o final
const scrollToBottom = async () => {
    await nextTick();
    if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
};

// Dispara fluxo de envio e simula respostas
const handleSend = () => {
    if (!newMessage.value.trim()) return;

    messages.value.push({
        id: Date.now(),
        user: currentUser,
        text: newMessage.value,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        reactions: [],
        isRead: false
    });

    newMessage.value = '';
    scrollToBottom();

    // Ativa digitação
    isTyping.value = true;
    scrollToBottom();

    setTimeout(() => {
        isTyping.value = false;
        messages.value.push({
            id: Date.now(),
            user: { id: 2, name: 'Maria', avatar: 'https://i.pravatar.cc/150?u=maria' },
            text: 'Ficou sensacional! Vamos integrar isso com nosso backend do Supabase.',
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            reactions: []
        });
        
        // Simula recibo de leitura
        messages.value.forEach(msg => {
            if (msg.user.id === currentUser.id) msg.isRead = true;
        });
        
        scrollToBottom();
    }, 2500);
};
</script>