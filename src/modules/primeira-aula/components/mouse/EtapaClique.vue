<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { Target, CheckCircle2, RotateCcw, ArrowRight } from '@lucide/vue'
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
})

const emit = defineEmits(['registrar-tentativa', 'avancar'])

const TOTAL_ALVOS = 12

const acertos = ref(0)
const finalizado = ref(false)
const alvo = ref({ x: 50, y: 50, chave: 0 })
const efeitoAcerto = ref(null)

let timerEfeito = null

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

// Reduz o tamanho do alvo gradualmente para treinar precisão
const tamanhoAlvoPx = computed(() => {
    if (acertos.value < 4) return 76
    if (acertos.value < 8) return 60
    return 46
})

const nivelAtual = computed(() => {
    if (acertos.value < 4) return 'Alvo grande'
    if (acertos.value < 8) return 'Alvo médio'
    return 'Alvo preciso'
})

const progressoPercentual = computed(() =>
    Math.round((acertos.value / TOTAL_ALVOS) * 100)
)

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

const acertarAlvo = () => {
    if (finalizado.value) return

    efeitoAcerto.value = {
        x: alvo.value.x,
        y: alvo.value.y,
        chave: alvo.value.chave,
    }

    clearTimeout(timerEfeito)
    timerEfeito = setTimeout(() => {
        efeitoAcerto.value = null
    }, 320)

    acertos.value += 1

    if (acertos.value >= TOTAL_ALVOS) {
        finalizado.value = true
        emit('registrar-tentativa')
        return
    }

    gerarNovaPosicao()
}

const iniciarNovaTentativa = () => {
    acertos.value = 0
    finalizado.value = false
    efeitoAcerto.value = null
    alvo.value = { x: 50, y: 50, chave: alvo.value.chave + 1 }
}

onUnmounted(() => {
    clearTimeout(timerEfeito)
})
</script>

<template>
    <Card class="overflow-hidden">
        <!-- Barra superior de status -->
        <div class="px-5 py-3.5 border-b border-border flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                <span class="px-2 py-0.5 rounded-md bg-muted text-foreground">
                    {{ textoTentativa }}
                </span>
                <span>
                    Acertos:
                    <strong class="text-foreground">{{ acertos }}/{{ TOTAL_ALVOS }}</strong>
                </span>
                <span class="text-border">|</span>
                <span>{{ nivelAtual }}</span>
            </div>

            <Button
                v-if="acertos > 0 && !finalizado"
                variant="ghost"
                size="sm"
                class="gap-1.5 text-xs text-muted-foreground"
                @click="iniciarNovaTentativa"
            >
                <RotateCcw class="w-3.5 h-3.5" />
                <span>Recomeçar</span>
            </Button>
        </div>

        <!-- Barra de progresso fina -->
        <div class="h-1 w-full bg-muted">
            <div
                class="h-full bg-primary transition-all duration-200"
                :style="{ width: `${progressoPercentual}%` }"
            />
        </div>

        <CardContent class="p-4 sm:p-5">
            <!-- Palco de prática -->
            <div
                v-if="!finalizado"
                class="relative h-[380px] sm:h-[420px] w-full rounded-xl border border-dashed border-border bg-muted/25 overflow-hidden select-none"
            >
                <span
                    v-if="efeitoAcerto"
                    :key="efeitoAcerto.chave"
                    class="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 border-emerald-500/60 pointer-events-none animate-ping"
                    :style="{ left: `${efeitoAcerto.x}%`, top: `${efeitoAcerto.y}%` }"
                />

                <button
                    :key="alvo.chave"
                    type="button"
                    aria-label="Clicar no alvo"
                    @click="acertarAlvo"
                    class="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary text-primary-foreground shadow-md hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-primary/30 transition-transform duration-150 flex items-center justify-center cursor-pointer"
                    :style="{
                        left: `${alvo.x}%`,
                        top: `${alvo.y}%`,
                        width: `${tamanhoAlvoPx}px`,
                        height: `${tamanhoAlvoPx}px`,
                    }"
                >
                    <Target class="w-5 h-5" />
                </button>
            </div>

            <!-- Feedback pós-tentativa -->
            <div
                v-else
                class="h-[380px] sm:h-[420px] flex flex-col items-center justify-center text-center px-4 space-y-5"
            >
                <div
                    :class="[
                        'w-12 h-12 rounded-2xl flex items-center justify-center',
                        precisaMaisTentativas
                            ? 'bg-primary/10 text-primary'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                    ]"
                >
                    <CheckCircle2 class="w-6 h-6" />
                </div>

                <div class="space-y-1">
                    <h2 class="text-lg font-semibold text-foreground">
                        {{
                            precisaMaisTentativas
                                ? `Tentativa ${tentativas} de ${minimoTentativas} concluída`
                                : 'Clique simples concluído'
                        }}
                    </h2>
                    <p class="text-sm text-muted-foreground max-w-sm">
                        {{
                            precisaMaisTentativas
                                ? 'Muito bem! Repita mais uma vez para firmar a coordenação do clique.'
                                : 'Você completou as tentativas com boa precisão no clique.'
                        }}
                    </p>
                </div>

                <div class="flex flex-wrap items-center justify-center gap-3 pt-1">
                    <Button
                        v-if="precisaMaisTentativas"
                        class="gap-2"
                        @click="iniciarNovaTentativa"
                    >
                        <RotateCcw class="w-4 h-4" />
                        <span>Iniciar {{ tentativas + 1 }}ª tentativa</span>
                    </Button>

                    <template v-else>
                        <Button variant="outline" class="gap-2" @click="iniciarNovaTentativa">
                            <RotateCcw class="w-4 h-4" />
                            <span>Praticar de novo</span>
                        </Button>
                        <Button variant="sucess" class="gap-2" @click="emit('avancar')">
                            <span>Próxima etapa</span>
                            <ArrowRight class="w-4 h-4" />
                        </Button>
                    </template>
                </div>
            </div>
        </CardContent>
    </Card>
</template>