<script setup>
import { RouterLink } from 'vue-router'
import {
    Sun,
    Moon,
    ArrowLeft,
    LogIn,
    MoreHorizontal,
    RotateCcw,
    Check,
    Mouse,
    Keyboard,
} from '@lucide/vue'
import Logo from '@/assets/svg/logo.svg'
import Button from '@/components/ui/Button.vue'
import Dropdown from '@/components/ui/Dropdown.vue'
import { useTheme } from '@/composables/useTheme'
import { usePrimeiraAula } from '../composables/usePrimeiraAula'

const emit = defineEmits(['solicitar-reinicio'])

const { isDark } = useTheme()
const {
    minimoTentativas,
    etapaAtual,
    etapasDaSecaoAtual,
    estaNoInicio,
    etapaEstaConcluida,
    obterTentativas,
    irParaInicio,
    irParaEtapa,
} = usePrimeiraAula()

const alternarTema = () => {
    isDark.value = !isDark.value
}
</script>

<template>
    <header class="sticky top-0 z-20 h-14 bg-background/95 backdrop-blur border-b border-border">
        <div class="max-w-4xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-3">
            <!-- Esquerda: Logo na entrada ou botão Início durante exercício -->
            <div class="flex items-center min-w-0">
                <button
                    v-if="!estaNoInicio"
                    type="button"
                    @click="irParaInicio"
                    class="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                    <ArrowLeft class="w-4 h-4" />
                    <span>Início</span>
                </button>

                <div v-else class="flex items-center gap-2.5">
                    <img :src="Logo" alt="Logo Nexo" class="w-6 h-6 shrink-0" />
                    <span class="text-sm font-semibold text-foreground tracking-tight">
                        Primeira Aula
                    </span>
                </div>
            </div>

            <!-- Centro: Progresso minimalista apenas da seção ativa -->
            <div v-if="etapaAtual" class="flex items-center gap-3">
                <span class="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Mouse v-if="etapaAtual.secao === 'mouse'" class="w-3.5 h-3.5" />
                    <Keyboard v-else class="w-3.5 h-3.5" />
                    <span>
                        {{ etapaAtual.secao === 'mouse' ? 'Mouse' : 'Teclado' }}
                        · {{ etapaAtual.numeroSecao }}/{{ etapasDaSecaoAtual.length }}
                    </span>
                </span>

                <div class="flex items-center gap-1.5" role="group" aria-label="Progresso da seção">
                    <button
                        v-for="etapa in etapasDaSecaoAtual"
                        :key="etapa.id"
                        type="button"
                        :title="`${etapa.numeroSecao}. ${etapa.titulo}`"
                        :aria-label="`Ir para ${etapa.titulo}`"
                        @click="irParaEtapa(etapa.id)"
                        :class="[
                            'h-1.5 rounded-full transition-all cursor-pointer',
                            etapa.id === etapaAtual.id
                                ? 'w-8 bg-primary'
                                : etapaEstaConcluida(etapa.id)
                                    ? 'w-5 bg-emerald-500 hover:bg-emerald-600'
                                    : obterTentativas(etapa.id) > 0
                                        ? 'w-5 bg-amber-500/70 hover:bg-amber-500'
                                        : 'w-5 bg-muted-foreground/25 hover:bg-muted-foreground/45',
                        ]"
                    />
                </div>
            </div>

            <!-- Direita: Tema e ações -->
            <div class="flex items-center gap-1.5">
                <Button
                    variant="ghost"
                    size="icon"
                    :title="isDark ? 'Usar tema claro' : 'Usar tema escuro'"
                    :aria-label="isDark ? 'Usar tema claro' : 'Usar tema escuro'"
                    @click="alternarTema"
                >
                    <Sun v-if="isDark" class="w-4 h-4" />
                    <Moon v-else class="w-4 h-4" />
                </Button>

                <!-- Na entrada, botão direto para o Login -->
                <RouterLink v-if="estaNoInicio" to="/login">
                    <Button variant="outline" size="sm" class="gap-1.5">
                        <LogIn class="w-3.5 h-3.5" />
                        <span>Login</span>
                    </Button>
                </RouterLink>

                <!-- Nos exercícios ou resumo, menu discreto de opções -->
                <Dropdown v-else>
                    <template #trigger>
                        <Button variant="ghost" size="icon" aria-label="Opções">
                            <MoreHorizontal class="w-4 h-4" />
                        </Button>
                    </template>

                    <template #content>
                        <div class="w-56 p-1 space-y-1">
                            <template v-if="etapaAtual">
                                <p class="px-2.5 pt-1 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    {{ etapaAtual.secao === 'mouse' ? 'Etapas de Mouse' : 'Etapas de Teclado' }}
                                </p>

                                <button
                                    v-for="etapa in etapasDaSecaoAtual"
                                    :key="etapa.id"
                                    type="button"
                                    @click="irParaEtapa(etapa.id)"
                                    :class="[
                                        'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs text-left transition-colors cursor-pointer',
                                        etapa.id === etapaAtual.id
                                            ? 'bg-primary/10 text-primary font-medium'
                                            : 'text-foreground hover:bg-muted',
                                    ]"
                                >
                                    <span class="truncate">{{ etapa.numeroSecao }}. {{ etapa.titulo }}</span>
                                    <Check
                                        v-if="etapaEstaConcluida(etapa.id)"
                                        class="w-3.5 h-3.5 text-emerald-500 shrink-0"
                                    />
                                    <span
                                        v-else-if="obterTentativas(etapa.id) > 0"
                                        class="text-[10px] font-medium text-amber-600 dark:text-amber-400 shrink-0"
                                    >
                                        {{ obterTentativas(etapa.id) }}/{{ minimoTentativas }}
                                    </span>
                                </button>

                                <div class="my-1 h-px bg-border" />
                            </template>

                            <button
                                type="button"
                                @click="emit('solicitar-reinicio')"
                                class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-foreground hover:bg-muted transition-colors cursor-pointer"
                            >
                                <RotateCcw class="w-3.5 h-3.5 text-muted-foreground" />
                                <span>Reiniciar progresso</span>
                            </button>

                            <RouterLink
                                to="/login"
                                class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-foreground hover:bg-muted transition-colors"
                            >
                                <LogIn class="w-3.5 h-3.5 text-muted-foreground" />
                                <span>Ir para o Login</span>
                            </RouterLink>
                        </div>
                    </template>
                </Dropdown>
            </div>
        </div>
    </header>
</template>