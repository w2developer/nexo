<template>
    <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
            <!-- Cabeçalho -->
            <div class="text-center mb-8">
                <h2 class="text-3xl font-bold text-gray-800">Portal do Aluno</h2>
                <p class="text-gray-500 mt-2">Informe seu código de acesso</p>
            </div>

            <!-- Formulário -->
            <form @submit.prevent="handleLogin" class="space-y-6">
                <div class="relative">
                    <Key class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        v-model="codigo"
                        type="text"
                        placeholder="Seu código"
                        required
                        class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                    />
                </div>

                <!-- Alerta de erro -->
                <div
                    v-if="erro"
                    class="flex items-center gap-2 bg-red-50 text-red-600 p-3 rounded-lg text-sm"
                >
                    <AlertCircle class="w-5 h-5 shrink-0" />
                    <p>{{ erro }}</p>
                </div>

                <!-- Botão de ação -->
                <button
                    type="submit"
                    :disabled="carregando"
                    class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
                >
                    <Loader2 v-if="carregando" class="w-5 h-5 animate-spin" />
                    <LogIn v-else class="w-5 h-5" />
                    <span>{{ carregando ? 'Validando...' : 'Entrar' }}</span>
                </button>
            </form>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Key, LogIn, Loader2, AlertCircle } from '@lucide/vue'
// Importa o cliente já configurado do seu arquivo lib
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

        if (data.nome) {
            sessionStorage.setItem('nome_usuario', data.nome)
        } else if (data.token) {
            // Tenta extrair o nome direto do token JWT retornado
            try {
                const payload = JSON.parse(atob(data.token.split('.')[1]))
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
            secretaria: '/secretaria',
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
