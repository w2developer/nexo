<script setup>
import { inject, ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Menu, User, Settings, LogOut } from '@lucide/vue'
import Button from '../ui/Button.vue'
import Dropdown from '../ui/Dropdown.vue'
import Breadcrumb from '../ui/Breadcrumb.vue'

const toggleMobile = inject('toggleMobile')
const router = useRouter()
const route = useRoute()
const navigation = inject('navigation', [])

const breadcrumbItems = computed(() => {
    const role = sessionStorage.getItem('tipo_usuario') || 'aluno'
    let basePath = `/${role}`
    if (role === 'aluno') basePath += '/painel'
    else if (role === 'professor') basePath += '/presenca'
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

onMounted(() => {
    const tipo = sessionStorage.getItem('tipo_usuario')
    const nome = sessionStorage.getItem('nome_usuario')

    if (tipo) {
        cargoUsuario.value = tipo.charAt(0).toUpperCase() + tipo.slice(1)
    }

    if (nome) {
        nomeUsuario.value = nome
    } else {
        // Tenta extrair o nome do token_acesso caso não esteja no sessionStorage
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
})

// Limpa a sessão e volta para o login
const handleLogout = () => {
    sessionStorage.removeItem('token_acesso')
    sessionStorage.removeItem('tipo_usuario')
    sessionStorage.removeItem('nome_usuario')
    router.push('/login')
}
</script>

<template>
    <header
        class="flex h-16 items-center justify-between border-b border-border bg-background px-4 shadow-sm"
    >
        <div class="flex items-center">
            <!-- Botão Mobile para Sidebar -->
            <Button variant="ghost" size="icon" class="mr-2 lg:hidden" @click="toggleMobile">
                <Menu class="h-5 w-5" />
            </Button>

            <!-- Breadcrumb para PC -->
            <Breadcrumb :items="breadcrumbItems" class="hidden md:flex ml-2" />
        </div>

        <div class="flex items-center gap-4">
            <Dropdown>
                <template #trigger>
                    <button
                        class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                        <User class="h-5 w-5" />
                    </button>
                </template>

                <template #content>
                    <div class="px-4 py-2 border-b border-border">
                        <p class="text-sm font-medium text-foreground">{{ nomeUsuario }}</p>
                        <p class="text-xs text-muted-foreground">Cargo: {{ cargoUsuario }}</p>
                    </div>
                    <!-- Botão de Sair atualizado -->
                    <button
                        @click="handleLogout"
                        class="w-full flex cursor-pointer items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 hover:text-red-600 text-left"
                    >
                        <LogOut class="h-4 w-4" />
                        Sair
                    </button>
                </template>
            </Dropdown>
        </div>
    </header>
</template>
