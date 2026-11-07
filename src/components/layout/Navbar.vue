<script setup>
import { inject, ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Menu, User, Settings, LogOut, Moon, Sun, Bell } from '@lucide/vue'
import Button from '../ui/Button.vue'
import Dropdown from '../ui/Dropdown.vue'
import Breadcrumb from '../ui/Breadcrumb.vue'
import Switch from '@/components/ui/Switch.vue';
import { useTheme } from '@/composables/useTheme';

import { usePendencias } from '@/composables/usePendencias';
import { useRealtime } from '@/composables/useRealtime';

const { iniciarConexaoGlobal, desconectarGlobal } = useRealtime();

const { isDark } = useTheme();
const { listaFaltantes, listaCertificados, carregarDadosGlobais, limparDadosGlobais } = usePendencias();

const toggleMobile = inject('toggleMobile')
const router = useRouter()
const route = useRoute()
const navigation = inject('navigation', [])

const breadcrumbItems = computed(() => {
    const role = sessionStorage.getItem('tipo_usuario') || 'aluno'
    let basePath = `/${role}`
    if (role === 'aluno') basePath += '/painel'
    else if (role === 'professor') basePath += '/presenca'
    else if (role === 'secretaria') basePath += '/dashboard'
    else if (role === 'admin') basePath = '/admin'

    const items = [{ label: 'Início', to: basePath, icon: 'home' }]
    const currentPath = route.path
    let found = false

    const findInNavigation = (navItems, parents = []) => {
        for (const item of navItems) {
            if (item.to === currentPath) {
                parents.forEach((p) => items.push({ label: p.title }))
                if (item.to !== basePath) {
                    items.push({ label: item.title })
                }
                found = true
                return
            }
            if (item.children) {
                findInNavigation(item.children, [...parents, item])
                if (found) return
            }
        }
    }

    findInNavigation(navigation)

    if (!found && currentPath !== basePath) {
        const parts = currentPath.split('/').filter(Boolean)
        if (parts.length > 1) {
            items.push({ label: parts[parts.length - 1] })
        }
    }

    return items
})

const nomeUsuario = ref('Usuário')
const cargoUsuario = ref('')

// Centraliza todas as notificações em um array padronizado
const todasNotificacoes = computed(() => {
    const notificacoes = [];
    const role = sessionStorage.getItem('tipo_usuario') || 'secretaria';
    const rotaPendencias = `/${role}/dashboard`;

    // 1. Pendência: Faltantes
    if (listaFaltantes.value.length > 0) {
        notificacoes.push({
            id: 'faltantes',
            titulo: 'Alunos Faltantes',
            quantidade: listaFaltantes.value.length,
            // As classes precisam estar completas em strings fixas para o Tailwind detectar na compilação
            estiloBox: 'hover:bg-rose-50 dark:hover:bg-rose-500/10 text-foreground',
            estiloBadge: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
            acao: () => router.push(rotaPendencias)
        });
    }

    // 2. Pendência: Certificados
    if (listaCertificados.value.length > 0) {
        notificacoes.push({
            id: 'certificados',
            titulo: 'Certificados Pendentes',
            quantidade: listaCertificados.value.length,
            estiloBox: 'hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-foreground',
            estiloBadge: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400',
            acao: () => router.push(rotaPendencias)
        });
    }

    return notificacoes;
});

// Calcula o total para a bolinha do sino
const totalNotificacoes = computed(() => {
    return todasNotificacoes.value.reduce((total, notif) => total + notif.quantidade, 0);
})

onMounted(() => {
    // 1. Liga o motor quando o Navbar carregar
    iniciarConexaoGlobal();
});

onMounted(() => {
    const tipo = sessionStorage.getItem('tipo_usuario')
    const nome = sessionStorage.getItem('nome_usuario')

    if (tipo) {
        const formatadorCargos = {
            'professor': 'Professor (a)',
            'secretaria': 'Secretário (a)',
            'admin': 'Administrador (a)',
            'aluno': 'Aluno (a)'
        }
        cargoUsuario.value = formatadorCargos[tipo.toLowerCase()] || (tipo.charAt(0).toUpperCase() + tipo.slice(1))
    }

    if (nome) {
        nomeUsuario.value = nome
    } else {
        const token = sessionStorage.getItem('token_acesso')
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]))
                if (payload && payload.nome) {
                    nomeUsuario.value = payload.nome
                    sessionStorage.setItem('nome_usuario', payload.nome)
                }
            } catch (e) {
                console.error('Erro ao decodificar token:', e)
            }
        }
    }

    if (tipo === 'secretaria' || tipo === 'admin' || tipo === 'professor') {
        carregarDadosGlobais();
    }
})

const handleLogout = () => {
    sessionStorage.removeItem('token_acesso')
    sessionStorage.removeItem('tipo_usuario')
    sessionStorage.removeItem('nome_usuario')

    limparDadosGlobais()
    desconectarGlobal();

    router.push('/login')
}
</script>

<template>
    <header class="flex h-16 items-center justify-between border-b border-border bg-background px-4 shadow-sm">
        <div class="flex items-center">
            <Button variant="ghost" size="icon" class="mr-2 lg:hidden" @click="toggleMobile">
                <Menu class="h-5 w-5" />
            </Button>
            <Breadcrumb :items="breadcrumbItems" class="hidden md:flex ml-2" />
        </div>

        <div class="flex items-center gap-2 sm:gap-4">
            <div class="flex items-center gap-2">
                <Sun class="w-4 h-4 text-muted-foreground" />
                <Switch id="toggle-tema" v-model="isDark" variant="violet" />
                <Moon class="w-4 h-4 text-muted-foreground" />
            </div>

            <!-- Dropdown do Sino de Notificações -->
            <Dropdown class="hidden sm:block">
                <template #trigger>
                    <button class="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors cursor-pointer">
                        <Bell class="w-5 h-5" />
                        <span 
                            v-if="totalNotificacoes > 0" 
                            class="p-2 absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white border-2 border-background"
                        >
                            {{ totalNotificacoes }}
                        </span>
                    </button>
                </template>

                <template #content>
                    <!-- Título fixo no topo do menu -->
                    <div class="px-4 py-2 border-b border-border mb-1">
                        <h4 class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Notificações
                        </h4>
                    </div>
                    
                    <!-- Mensagem vazia -->
                    <div v-if="todasNotificacoes.length === 0" class="px-4 py-4 text-sm text-center text-muted-foreground">
                        Tudo em dia! Nenhuma pendência.
                    </div>
                    
                    <!-- Lista de Notificações com espaço lateral padrão (px-1) -->
                    <div v-else class="space-y-1 px-1">
                        <div 
                            v-for="notif in todasNotificacoes" 
                            :key="notif.id"
                            @click="notif.acao"
                            class="flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors"
                            :class="notif.estiloBox"
                        >
                            <span class="text-sm font-medium">{{ notif.titulo }}</span>
                            <span 
                                class="px-2 py-0.5 rounded text-xs font-bold"
                                :class="notif.estiloBadge"
                            >
                                {{ notif.quantidade }}
                            </span>
                        </div>
                    </div>
                </template>
            </Dropdown>

            <!-- Dropdown de Usuário -->
            <Dropdown>
                <template #trigger>
                    <button class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer">
                        <User class="h-5 w-5" />
                    </button>
                </template>

                <template #content>
                    <!-- O width maior do Dropdown fica por conta do truncate -->
                    <div class="px-4 py-3 border-b border-border mb-1">
                        <p class="text-sm font-medium text-foreground truncate max-w-[180px]">{{ nomeUsuario }}</p>
                        <p class="text-xs text-muted-foreground truncate">Cargo: {{ cargoUsuario }}</p>
                    </div>
                    
                    <div class="px-1">
                        <button
                            @click="handleLogout"
                            class="w-full flex cursor-pointer items-center gap-2 px-3 py-2 text-sm rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-left"
                        >
                            <LogOut class="h-4 w-4" />
                            Sair
                        </button>
                    </div>
                </template>
            </Dropdown>
        </div>
    </header>
</template>