<script setup>
import { ref, computed, onUnmounted } from 'vue'
import {
    Zap,
    Timer,
    Trophy,
    Play,
    RotateCcw,
    ArrowRight,
    CheckCircle2,
} from '@lucide/vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'

const props = defineProps({
    concluida: {
        type: Boolean,
        default: false,
    },
    tentativas: {
        type: Number,
        default: 0,
    },
    minimoTentativas: {
        type: Number,
        default: 2,
    },
    recordeAtual: {
        type: Number,
        default: 0,
    },
})

const emit = defineEmits(['registrar-tentativa', 'avancar'])

const DURACAO_SEGUNDOS = 30
const META_ACERTOS = 15

// Estados possíveis: pronto | jogando | finalizado
const status = ref('pronto')
const tempoRestante = ref(DURACAO_SEGUNDOS)
const acertos = ref(0)
const bateuRecorde = ref(false)
const alvo = ref({ x: 50, y: 50, chave: 0 })

let intervalo = null

const metaAlcancada = computed(() => acertos.value >= META_ACERTOS)

const precisaMaisTentativas = computed(
    () => !props.concluida && props.tentativas < props.minimoTentativas
)

const textoTentativa = computed(() => {
    if (props.concluida) {
        return `${props.tentativas} ${props.tentativas === 1 ? 'tentativa' : 'tentativas'}`
    }
    const numeroAtual = Math.min(props.tentativas + 1, props.minimoTentativas)
    return `Tentativa ${numeroAtual}/${props.minimoTentativas}`
})

const progressoTempoPercentual = computed(() =>
    Math.round((tempoRestante.value / DURACAO_SEGUNDOS) * 100)
)

const limparTimer = () => {
    if (intervalo) {
        clearInterval(intervalo)
        intervalo = null
    }
}

const gerarNovaPosicao = () => {
    let novoX = 50
    let novoY = 50

    for (let tentativa = 0; tentativa < 15; tentativa++) {
        const candidatoX = 12 + Math.random() * 76
        const candidatoY = 16 + Math.random() * 68
        const distancia = Math.hypot(candidatoX - alvo.value.x, candidatoY - alvo.value.y)

        if (distancia >= 22) {
            novoX = candidatoX
            novoY = candidatoY
            break
        }
    }

    alvo.value = {
        x: Math.round(novoX),
        y: Math.round(novoY),
        chave: alvo.value.chave + 1,
    }
}

const encerrarRodada = () => {
    limparTimer()
    status.value = 'finalizado'

    if (acertos.value > props.recordeAtual && acertos.value > 0) {
        bateuRecorde.value = true
    }

    if (metaAlcancada.value) {
        emit('registrar-tentativa', { recordeCliques: acertos.value })
    }
}

const iniciarDesafio = () => {
    limparTimer()
    acertos.value = 0
    tempoRestante.value = DURACAO_SEGUNDOS
    bateuRecorde.value = false
    status.value = 'jogando'
    gerarNovaPosicao()

    intervalo = setInterval(() => {
        tempoRestante.value -= 1

        if (tempoRestante.value <= 0) {
            tempoRestante.value = 0
            encerrarRodada()
        }
    }, 1000)
}

const acertarAlvo = () => {
    if (status.value !== 'jogando') return
    acertos.value += 1
    gerarNovaPosicao()
}

onUnmounted(() => {
    limparTimer()
})
</script>

<template>
    <Card class="overflow-hidden">
        <!-- Barra superior com métricas -->
        <div class="px-5 py-3.5 border-b border-border flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                <span class="px-2 py-0.5 rounded-md bg-muted text-foreground">
                    {{ textoTentativa }}
                </span>

                <span class="inline-flex items-center gap-1.5">
                    <Timer class="w-3.5 h-3.5" />
                    <strong
                        :class="[
                            'tabular-nums',
                            status === 'jogando' && tempoRestante <= 5
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-foreground',
                        ]"
                    >
                        {{ tempoRestante }}s
                    </strong>
                </span>

                <span class="text-border">|</span>

                <span>
                    Acertos:
                    <strong class="text-foreground tabular-nums">{{ acertos }}</strong>
                    <span class="text-muted-foreground/70"> (meta {{ META_ACERTOS }})</span>
                </span>
            </div>

            <div
                v-if="recordeAtual > 0"
                class="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            >
                <Trophy class="w-3.5 h-3.5 text-amber-500" />
                <span>Recorde: <strong class="text-foreground tabular-nums">{{ recordeAtual }}</strong></span>
            </div>
        </div>

        <!-- Barra de tempo -->
        <div class="h-1 w-full bg-muted">
            <div
                :class="[
                    'h-full transition-all duration-1000 linear',
                    status === 'jogando' && tempoRestante <= 5 ? 'bg-red-500' : 'bg-primary',
                ]"
                :style="{ width: `${progressoTempoPercentual}%` }"
            />
        </div>

        <CardContent class="p-4 sm:p-5">
            <!-- Tela inicial do desafio -->
            <div
                v-if="status === 'pronto'"
                class="h-[380px] sm:h-[420px] flex flex-col items-center justify-center text-center px-4 space-y-5"
            >
                <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <Zap class="w-6 h-6" />
                </div>

                <div class="space-y-1.5">
                    <h2 class="text-lg font-semibold text-foreground">
                        Desafio de {{ DURACAO_SEGUNDOS }} segundos
                    </h2>
                    <p class="text-sm text-muted-foreground max-w-sm">
                        Acerte pelo menos <strong class="text-foreground">{{ META_ACERTOS }} alvos</strong> em {{ minimoTentativas }} rodadas para concluir o bloco do mouse.
                    </p>
                </div>

                <Button class="gap-2" @click="iniciarDesafio">
                    <Play class="w-4 h-4" />
                    <span>Começar desafio</span>
                </Button>
            </div>

            <!-- Palco ativo -->
            <div
                v-else-if="status === 'jogando'"
                class="relative h-[380px] sm:h-[420px] w-full rounded-xl border border-dashed border-border bg-muted/25 overflow-hidden select-none"
            >
                <button
                    :key="alvo.chave"
                    type="button"
                    aria-label="Clicar no alvo rápido"
                    @click="acertarAlvo"
                    class="absolute -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-md hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-primary/30 transition-transform duration-100 flex items-center justify-center cursor-pointer"
                    :style="{ left: `${alvo.x}%`, top: `${alvo.y}%` }"
                >
                    <Zap class="w-5 h-5" />
                </button>
            </div>

            <!-- Resultado -->
            <div
                v-else
                class="h-[380px] sm:h-[420px] flex flex-col items-center justify-center text-center px-4 space-y-5"
            >
                <div
                    :class="[
                        'w-12 h-12 rounded-2xl flex items-center justify-center',
                        !metaAlcancada
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : precisaMaisTentativas
                                ? 'bg-primary/10 text-primary'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                    ]"
                >
                    <CheckCircle2 v-if="metaAlcancada" class="w-6 h-6" />
                    <Timer v-else class="w-6 h-6" />
                </div>

                <div class="space-y-1.5">
                    <p class="text-3xl font-bold tracking-tight text-foreground tabular-nums">
                        {{ acertos }} {{ acertos === 1 ? 'acerto' : 'acertos' }}
                    </p>
                    <h2 class="text-base font-semibold text-foreground">
                        <template v-if="!metaAlcancada">
                            Quase chegou na meta
                        </template>
                        <template v-else-if="precisaMaisTentativas">
                            Tentativa {{ tentativas }} de {{ minimoTentativas }} concluída
                        </template>
                        <template v-else>
                            Prática do mouse concluída
                        </template>
                    </h2>
                    <p class="text-sm text-muted-foreground max-w-sm">
                        <template v-if="!metaAlcancada">
                            Faltaram {{ META_ACERTOS - acertos }} acertos para atingir a meta de {{ META_ACERTOS }}. Tente mais uma vez!
                        </template>
                        <template v-else-if="precisaMaisTentativas">
                            Faça mais uma rodada e tente superar sua marca de {{ recordeAtual }} acertos.
                        </template>
                        <template v-else>
                            {{
                                bateuRecorde
                                    ? 'Novo recorde registrado nesta sessão!'
                                    : 'Você concluiu todas as tentativas e já pode seguir para o teclado.'
                            }}
                        </template>
                    </p>
                </div>

                <div class="flex flex-wrap items-center justify-center gap-3 pt-1">
                    <Button
                        v-if="!metaAlcancada"
                        class="gap-2"
                        @click="iniciarDesafio"
                    >
                        <RotateCcw class="w-4 h-4" />
                        <span>Tentar novamente</span>
                    </Button>

                    <Button
                        v-else-if="precisaMaisTentativas"
                        class="gap-2"
                        @click="iniciarDesafio"
                    >
                        <RotateCcw class="w-4 h-4" />
                        <span>Iniciar {{ tentativas + 1 }}ª tentativa</span>
                    </Button>

                    <template v-else>
                        <Button variant="outline" class="gap-2" @click="iniciarDesafio">
                            <RotateCcw class="w-4 h-4" />
                            <span>Bater recorde</span>
                        </Button>
                        <Button variant="sucess" class="gap-2" @click="emit('avancar')">
                            <span>Ir para Teclado</span>
                            <ArrowRight class="w-4 h-4" />
                        </Button>
                    </template>
                </div>
            </div>
        </CardContent>
    </Card>
</template>