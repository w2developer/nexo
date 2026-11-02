<template>
    <div class="min-h-screen flex flex-col items-center justify-center bg-muted/40 dark:bg-background px-4 py-12 transition-colors">
        <div class="w-full max-w-[380px] space-y-6">
            <!-- Cabeçalho Minimalista -->
            <div class="flex flex-col items-center text-center space-y-2">
                <div class="w-12 h-12 rounded-xl bg-foreground text-background flex items-center justify-center shadow-sm mb-1">
                    <Key class="w-6 h-6" />
                </div>
                <h1 class="text-2xl font-bold tracking-tight text-foreground">
                    Portal de Acesso
                </h1>
                <!-- <p class="text-sm text-muted-foreground">
                    Digite seu código de identificação para continuar
                </p> -->
            </div>

            <!-- Card Principal -->
            <div class="bg-background border border-border rounded-xl shadow-sm p-6 sm:p-7">
                <form @submit.prevent="handleLogin" class="space-y-4">
                    <!-- Campo do Código -->
                    <div class="space-y-2">
                        <label for="codigo-input" class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Código de Acesso
                        </label>
                        <div class="relative">
                            <Key class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <input
                                id="codigo-input"
                                v-model="codigo"
                                type="text"
                                placeholder="Ex: 001234"
                                required
                                autocomplete="off"
                                :disabled="carregando"
                                class="w-full h-11 pl-10 pr-4 rounded-lg border border-border bg-muted/30 dark:bg-muted/60 text-foreground text-sm font-medium placeholder:text-muted-foreground/60 focus:bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all disabled:opacity-60"
                            />
                        </div>
                    </div>

                    <!-- Alerta de Erro -->
                    <div
                        v-if="erro"
                        class="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 px-3.5 py-2.5 rounded-lg text-xs font-medium"
                    >
                        <AlertCircle class="w-4 h-4 shrink-0" />
                        <span>{{ erro }}</span>
                    </div>

                    <!-- Botão Entrar -->
                    <button
                        type="submit"
                        :disabled="carregando || !codigo.trim()"
                        class="w-full h-11 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                    >
                        <Loader2 v-if="carregando" class="w-4 h-4 animate-spin" />
                        <LogIn v-else class="w-4 h-4" />
                        <span>{{ carregando ? 'Validando acesso...' : 'Entrar no Sistema' }}</span>
                    </button>
                </form>
            </div>

            <!-- Rodapé Discreto -->
            <!-- <p class="text-center text-xs text-muted-foreground">
                Acesso unificado para Alunos, Professores e Administração
            </p> -->
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Key, LogIn, Loader2, AlertCircle } from '@lucide/vue'
import { supabase } from '@/lib/supabase'

const router = useRouter()
const codigo = ref('')
const erro = ref('')
const carregando = ref(false)

const handleLogin = async () => {
    carregando.value = true
    erro.value = ''

    try {
        const { data, error } = await supabase.functions.invoke('login', {
            body: { codigo: codigo.value },
        })

        if (error || !data?.token) throw error

        // Salva token e tipo
        sessionStorage.setItem('token_acesso', data.token)
        sessionStorage.setItem('tipo_usuario', data.tipo)

        // Busca o nome diretamente do objeto usuario retornado pela API
        if (data.usuario?.nome) {
            sessionStorage.setItem('nome_usuario', data.usuario.nome)
        } else if (data.token) {
            // Fallback seguro para UTF-8 caso precise ler o JWT
            try {
                const base64Url = data.token.split('.')[1]
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
                const jsonString = decodeURIComponent(
                    atob(base64)
                        .split('')
                        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                        .join('')
                )
                const payload = JSON.parse(jsonString)
                
                if (payload?.nome) {
                    sessionStorage.setItem('nome_usuario', payload.nome)
                }
            } catch (e) {
                console.error('Erro ao decodificar token no login:', e)
            }
        }

        // Direciona para a tela inicial correta baseada no tipo
        const rotasIniciais = {
            aluno: '/aluno/painel',
            professor: '/professor/presenca',
            secretaria: '/secretaria/dashboard',
            admin: '/admin',
        }

        router.push(rotasIniciais[data.tipo] || '/login')
    } catch (e) {
        erro.value = 'Código inválido ou inativo.'
    } finally {
        carregando.value = false
    }
}
</script>
