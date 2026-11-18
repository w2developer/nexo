<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { Search, MoreVertical, MessageSquare, Paperclip, Send } from '@lucide/vue'

// Importações de componentes da W2 UI
import Avatar from '@/components/ui/Avatar.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Skeleton from '@/components/ui/Skeleton.vue'

// Estados de carregamento e interface
const isLoading = ref(true)
const searchQuery = ref('')
const selectedContactId = ref(1)
const newMessage = ref('')
const messagesContainerRef = ref(null)

// Estado do usuário atual
const currentUser = ref({
    id: 'me',
    name: 'Wanderson Mateus',
    initials: 'WM'
})

// Dados fictícios (Simulando resposta do banco de dados)
const contacts = ref([])
const allMessages = ref([])

// Simulação de busca de dados no backend
onMounted(() => {
    setTimeout(() => {
        contacts.value = [
            { id: 1, name: 'Setor Comercial', lastMessage: 'Proposta enviada ao cliente.', time: '10:30', unread: 2, online: true },
            { id: 2, name: 'Suporte TI', lastMessage: 'O servidor já foi reiniciado.', time: '09:15', unread: 0, online: true },
            { id: 3, name: 'Alice Silva (RH)', lastMessage: 'Por favor, assine o documento.', time: 'Ontem', unread: 0, online: false },
            { id: 4, name: 'Roberto Carlos (Diretoria)', lastMessage: 'Reunião confirmada para as 14h.', time: 'Segunda', unread: 5, online: false }
        ]

        allMessages.value = [
            { id: 1, contactId: 1, senderId: 1, text: 'Bom dia! Precisamos alinhar a proposta.', time: '10:28' },
            { id: 2, contactId: 1, senderId: 1, text: 'Proposta enviada ao cliente.', time: '10:30' },
            
            { id: 3, contactId: 2, senderId: 'me', text: 'Conseguem verificar a lentidão no sistema ERP?', time: '09:00' },
            { id: 4, contactId: 2, senderId: 2, text: 'O servidor já foi reiniciado. Pode testar novamente?', time: '09:15' }
        ]

        isLoading.value = false
        scrollToBottom()
    }, 1500)
})

// Computed properties
const filteredContacts = computed(() => {
    if (!searchQuery.value) return contacts.value
    return contacts.value.filter(c => 
        c.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
})

const activeContact = computed(() => {
    return contacts.value.find(c => c.id === selectedContactId.value)
})

const activeMessages = computed(() => {
    return allMessages.value.filter(m => m.contactId === selectedContactId.value)
})

// Funções de ação
const selectContact = (id) => {
    selectedContactId.value = id
    const contact = contacts.value.find(c => c.id === id)
    if (contact) contact.unread = 0
    scrollToBottom()
}

const sendMessage = async () => {
    if (!newMessage.value.trim()) return

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    
    allMessages.value.push({
        id: Date.now(),
        contactId: selectedContactId.value,
        senderId: 'me',
        text: newMessage.value.trim(),
        time: time
    })

    const contact = contacts.value.find(c => c.id === selectedContactId.value)
    if (contact) {
        contact.lastMessage = newMessage.value.trim()
        contact.time = time
    }

    newMessage.value = ''
    await scrollToBottom()
}

const scrollToBottom = async () => {
    await nextTick()
    if (messagesContainerRef.value) {
        messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight
    }
}
</script>

<template>
    <div class="flex h-screen bg-background text-foreground overflow-hidden">
        
        <!-- Sidebar: Lista de Contatos -->
        <aside class="w-full md:w-96 border-r border-border flex flex-col bg-muted/10 flex-shrink-0" :class="{ 'hidden md:flex': activeContact }">
            
            <!-- Cabeçalho do usuário atual -->
            <header class="flex items-center justify-between p-3 border-b border-border bg-muted/20 h-16">
                <div class="flex items-center gap-3">
                    <Avatar :initials="currentUser.initials" size="md" />
                    <span class="font-medium text-sm hidden md:block">{{ currentUser.name }}</span>
                </div>
                <Button variant="ghost" size="icon" class="text-muted-foreground">
                    <MoreVertical class="w-5 h-5" />
                </Button>
            </header>

            <!-- Pesquisa -->
            <div class="p-3 border-b border-border">
                <div class="relative">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                        v-model="searchQuery" 
                        placeholder="Pesquisar colega ou setor..." 
                        class="pl-9 bg-background w-full"
                        :disabled="isLoading"
                    />
                </div>
            </div>

            <!-- Lista de Contatos -->
            <div class="flex-1 overflow-y-auto">
                <!-- Skeleton de Carregamento para Contatos -->
                <div v-if="isLoading" class="p-3 space-y-4">
                    <div v-for="i in 6" :key="i" class="flex items-center gap-3">
                        <Skeleton class="w-12 h-12 rounded-full flex-shrink-0" />
                        <div class="space-y-2 flex-1">
                            <Skeleton class="h-4 w-3/4" />
                            <Skeleton class="h-3 w-1/2" />
                        </div>
                    </div>
                </div>

                <!-- Lista Real -->
                <template v-else>
                    <button 
                        v-for="contact in filteredContacts" 
                        :key="contact.id"
                        @click="selectContact(contact.id)"
                        class="w-full flex items-center gap-3 p-3 text-left border-b border-border/50 hover:bg-muted/30 transition-colors"
                        :class="{ 'bg-muted/40': selectedContactId === contact.id }"
                    >
                        <div class="relative flex-shrink-0">
                            <Avatar :name="contact.name" size="lg" />
                            <span 
                                class="absolute bottom-0 right-0 w-3 h-3 border-2 border-background rounded-full"
                                :class="contact.online ? 'bg-green-500' : 'bg-muted-foreground'"
                            ></span>
                        </div>
                        
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between mb-1">
                                <span class="font-medium truncate text-sm">{{ contact.name }}</span>
                                <span class="text-xs text-muted-foreground whitespace-nowrap ml-2">{{ contact.time }}</span>
                            </div>
                            <div class="flex items-center justify-between gap-2">
                                <p class="text-xs text-muted-foreground truncate">{{ contact.lastMessage }}</p>
                                <Badge v-if="contact.unread > 0" variant="success" class="flex-shrink-0 rounded-full h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                                    {{ contact.unread }}
                                </Badge>
                            </div>
                        </div>
                    </button>
                </template>
            </div>
        </aside>

        <!-- Área Principal: Chat -->
        <main class="flex-1 flex flex-col h-full relative bg-background" :class="{ 'hidden md:flex': !activeContact && !isLoading }">
            
            <template v-if="activeContact || isLoading">
                <!-- Cabeçalho do Chat -->
                <header class="flex items-center justify-between p-3 border-b border-border bg-muted/20 h-16">
                    <div class="flex items-center gap-3 w-full">
                        <button class="md:hidden p-2 -ml-2 text-muted-foreground" @click="selectedContactId = null" :disabled="isLoading">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                        
                        <template v-if="isLoading">
                            <Skeleton class="w-10 h-10 rounded-full flex-shrink-0" />
                            <div class="space-y-2 flex-1 max-w-[200px]">
                                <Skeleton class="h-4 w-full" />
                                <Skeleton class="h-3 w-2/3" />
                            </div>
                        </template>
                        
                        <template v-else>
                            <Avatar :name="activeContact.name" size="md" />
                            <div>
                                <h2 class="font-medium text-sm leading-tight">{{ activeContact.name }}</h2>
                                <p class="text-xs" :class="activeContact.online ? 'text-green-500' : 'text-muted-foreground'">
                                    {{ activeContact.online ? 'Online' : 'Offline' }}
                                </p>
                            </div>
                        </template>
                    </div>

                    <div class="flex items-center gap-1">
                        <Button variant="ghost" size="icon" class="text-muted-foreground" :disabled="isLoading">
                            <Search class="w-5 h-5" />
                        </Button>
                    </div>
                </header>

                <!-- Área de Mensagens -->
                <div 
                    ref="messagesContainerRef"
                    class="flex-1 overflow-y-auto p-4 space-y-4"
                >
                    <!-- Background pattern corporativo leve -->
                    <div class="absolute inset-0 opacity-[0.02] pointer-events-none" style="background-image: radial-gradient(var(--color-foreground) 1px, transparent 1px); background-size: 24px 24px;"></div>

                    <!-- Skeleton de Mensagens -->
                    <template v-if="isLoading">
                        <div class="flex justify-start"><Skeleton class="h-12 w-2/3 md:w-1/3 rounded-lg rounded-tl-none" /></div>
                        <div class="flex justify-start"><Skeleton class="h-10 w-1/2 md:w-1/4 rounded-lg rounded-tl-none" /></div>
                        <div class="flex justify-end"><Skeleton class="h-16 w-3/4 md:w-2/5 rounded-lg rounded-tr-none" /></div>
                        <div class="flex justify-start"><Skeleton class="h-12 w-2/5 md:w-1/3 rounded-lg rounded-tl-none" /></div>
                    </template>

                    <!-- Mensagens Reais -->
                    <template v-else>
                        <div 
                            v-for="msg in activeMessages" 
                            :key="msg.id"
                            class="flex relative z-10"
                            :class="msg.senderId === 'me' ? 'justify-end' : 'justify-start'"
                        >
                            <div 
                                class="max-w-[85%] md:max-w-[65%] rounded-lg p-3 flex flex-col gap-1 shadow-sm"
                                :class="msg.senderId === 'me' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted border border-border rounded-tl-none text-foreground'"
                            >
                                <span class="text-sm">{{ msg.text }}</span>
                                <span 
                                    class="text-[10px] self-end opacity-70 mt-1"
                                    :class="msg.senderId === 'me' ? 'text-primary-foreground' : 'text-muted-foreground'"
                                >
                                    {{ msg.time }}
                                </span>
                            </div>
                        </div>
                    </template>
                </div>

                <!-- Rodapé / Área de Digitação -->
                <footer class="p-3 border-t border-border bg-background flex items-center gap-2">
                    <Button variant="ghost" size="icon" class="text-muted-foreground flex-shrink-0" :disabled="isLoading">
                        <Paperclip class="w-5 h-5" />
                    </Button>
                    
                    <Input 
                        v-model="newMessage" 
                        placeholder="Escreva sua mensagem..." 
                        class="flex-1 bg-muted/50 border-transparent focus:border-border"
                        @keyup.enter="sendMessage"
                        :disabled="isLoading"
                    />

                    <Button 
                        variant="default" 
                        size="icon" 
                        class="flex-shrink-0"
                        @click="sendMessage"
                        :disabled="!newMessage.trim() || isLoading"
                    >
                        <Send class="w-4 h-4" />
                    </Button>
                </footer>
            </template>
            
            <!-- Estado Vazio (Nenhum contato selecionado) -->
            <div v-else class="flex-1 flex flex-col items-center justify-center text-center p-8 bg-muted/5">
                <div class="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <MessageSquare class="w-8 h-8 text-muted-foreground opacity-50" />
                </div>
                <h2 class="text-xl font-medium text-foreground mb-1">Comunicação Interna</h2>
                <p class="text-sm text-muted-foreground max-w-sm">
                    Selecione um colega ou setor na barra lateral para iniciar o atendimento ou alinhamento.
                </p>
            </div>
        </main>
    </div>
</template>