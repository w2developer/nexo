<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import {
    Award,
    Clock,
    CheckCircle2,
    Trophy,
    Target,
    Mouse,
    Keyboard,
    Check,
    RotateCcw,
    LogIn,
    ArrowLeft,
} from '@lucide/vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import { usePrimeiraAula } from '../composables/usePrimeiraAula'

const emit = defineEmits(['solicitar-reinicio'])

const {
    estado,
    etapas,
    minimoTentativas,
    etapasMouse,
    etapasTeclado,
    totalConcluidas,
    precisaoMediaDigitacao,
    tempoTotalSegundos,
    etapaEstaConcluida,
    obterTentativas,
    irParaInicio,
    irParaEtapa,
} = usePrimeiraAula()

const concluiuTudo = computed(() => totalConcluidas.value === etapas.length)

const tempoFormatado = computed(() => {
    const total = tempoTotalSegundos.value
    const minutos = Math.floor(total / 60)
    const segundos = total % 60

    if (minutos === 0) {
        return `${segundos}s`
    }

    return `${minutos}m ${String(segundos).padStart(2, '0')}s`
})
</script>

<template>
    <div class="w-full space-y-6">
        <!-- Cabeçalho de conclusão -->
        <Card>
            <CardContent class="p-6 sm:p-8 text-center space-y-4">
                <div
                    :class="[
                        'w-14 h-14 rounded-2xl flex items-center justify-center mx-auto',
                        concluiuTudo
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-primary/10 text-primary',
                    ]"
                >
                    <Award class="w-7 h-7" />
                </div>

                <div class="space-y-1.5">
                    <h1 class="text-2xl font-bold tracking-tight text-foreground">
                        {{ concluiuTudo ? 'Primeira aula concluída!' : 'Resumo da sua prática' }}
                    </h1>
                    <p class="text-sm text-muted-foreground max-w-md mx-auto">
                        <template v-if="concluiuTudo">
                            Você completou todas as práticas de mouse e teclado e já está pronto para usar o sistema.
                        </template>
                        <template v-else>
                            Você concluiu {{ totalConcluidas }} de {{ etapas.length }} etapas até agora. Pode revisar qualquer prática abaixo ou seguir para o login.
                        </template>
                    </p>
                </div>

                <!-- Ações principais -->
                <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <RouterLink to="/login">
                        <Button class="gap-2">
                            <LogIn class="w-4 h-4" />
                            <span>Ir para o Login</span>
                        </Button>
                    </RouterLink>

                    <Button variant="outline" class="gap-2" @click="emit('solicitar-reinicio')">
                        <RotateCcw class="w-4 h-4" />
                        <span>Refazer prática</span>
                    </Button>
                </div>
            </CardContent>
        </Card>

        <!-- Grade de métricas da sessão -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
                <CardContent class="p-4 space-y-1.5">
                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 class="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Etapas</span>
                    </div>
                    <p class="text-xl font-bold text-foreground tabular-nums">
                        {{ totalConcluidas }}/{{ etapas.length }}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardContent class="p-4 space-y-1.5">
                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock class="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>Tempo total</span>
                    </div>
                    <p class="text-xl font-bold text-foreground tabular-nums">
                        {{ tempoFormatado }}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardContent class="p-4 space-y-1.5">
                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Trophy class="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Recorde (30s)</span>
                    </div>
                    <p class="text-xl font-bold text-foreground tabular-nums">
                        {{ estado.recordeCliques > 0 ? `${estado.recordeCliques} cliques` : '—' }}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardContent class="p-4 space-y-1.5">
                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Target class="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>Precisão média</span>
                    </div>
                    <p class="text-xl font-bold text-foreground tabular-nums">
                        {{ precisaoMediaDigitacao !== null ? `${precisaoMediaDigitacao}%` : '—' }}
                    </p>
                </CardContent>
            </Card>
        </div>

        <!-- Detalhamento por seção -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Mouse -->
            <Card>
                <div class="px-5 py-3.5 border-b border-border flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Mouse class="w-4 h-4 text-primary" />
                    <span>Prática do Mouse</span>
                </div>

                <CardContent class="p-3">
                    <ul class="space-y-1">
                        <li v-for="etapa in etapasMouse" :key="etapa.id">
                            <button
                                type="button"
                                @click="irParaEtapa(etapa.id)"
                                class="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-left hover:bg-muted/70 transition-colors cursor-pointer"
                            >
                                <span class="flex items-center gap-2.5 min-w-0">
                                    <span
                                        :class="[
                                            'w-5 h-5 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0',
                                            etapaEstaConcluida(etapa.id)
                                                ? 'bg-emerald-500 text-white'
                                                : 'bg-muted text-muted-foreground',
                                        ]"
                                    >
                                        <Check v-if="etapaEstaConcluida(etapa.id)" class="w-3 h-3" />
                                        <template v-else>{{ etapa.numeroSecao }}</template>
                                    </span>
                                    <span class="truncate text-foreground/90">
                                        {{ etapa.titulo }}
                                    </span>
                                </span>

                                <span
                                    :class="[
                                        'text-xs font-medium shrink-0 tabular-nums',
                                        etapaEstaConcluida(etapa.id)
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-muted-foreground',
                                    ]"
                                >
                                    {{
                                        etapaEstaConcluida(etapa.id)
                                            ? 'Concluída'
                                            : `${obterTentativas(etapa.id)}/${minimoTentativas}`
                                    }}
                                </span>
                            </button>
                        </li>
                    </ul>
                </CardContent>
            </Card>

            <!-- Teclado -->
            <Card>
                <div class="px-5 py-3.5 border-b border-border flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Keyboard class="w-4 h-4 text-primary" />
                    <span>Prática do Teclado</span>
                </div>

                <CardContent class="p-3">
                    <ul class="space-y-1">
                        <li v-for="etapa in etapasTeclado" :key="etapa.id">
                            <button
                                type="button"
                                @click="irParaEtapa(etapa.id)"
                                class="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-left hover:bg-muted/70 transition-colors cursor-pointer"
                            >
                                <span class="flex items-center gap-2.5 min-w-0">
                                    <span
                                        :class="[
                                            'w-5 h-5 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0',
                                            etapaEstaConcluida(etapa.id)
                                                ? 'bg-emerald-500 text-white'
                                                : 'bg-muted text-muted-foreground',
                                        ]"
                                    >
                                        <Check v-if="etapaEstaConcluida(etapa.id)" class="w-3 h-3" />
                                        <template v-else>{{ etapa.numeroSecao }}</template>
                                    </span>
                                    <span class="truncate text-foreground/90">
                                        {{ etapa.titulo }}
                                    </span>
                                </span>

                                <span
                                    :class="[
                                        'text-xs font-medium shrink-0 tabular-nums',
                                        etapaEstaConcluida(etapa.id)
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-muted-foreground',
                                    ]"
                                >
                                    <template v-if="estado.metricasDigitacao[etapa.id]">
                                        {{ estado.metricasDigitacao[etapa.id].precisao }}%
                                    </template>
                                    <template v-else>
                                        {{ `${obterTentativas(etapa.id)}/${minimoTentativas}` }}
                                    </template>
                                </span>
                            </button>
                        </li>
                    </ul>
                </CardContent>
            </Card>
        </div>

        <!-- Voltar ao início -->
        <div class="flex justify-center pt-1">
            <Button variant="ghost" size="sm" class="gap-1.5 text-muted-foreground" @click="irParaInicio">
                <ArrowLeft class="w-4 h-4" />
                <span>Voltar para a tela inicial</span>
            </Button>
        </div>
    </div>
</template>