<script setup>
import { ref, computed, nextTick } from 'vue'
import {
    ArrowDown,
    ArrowUp,
    ArrowRight,
    CheckCircle2,
    RotateCcw,
    Flag,
    Crosshair,
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
})

const emit = defineEmits(['registrar-tentativa', 'avancar'])

const PASSOS = [
    {
        id: 'fim',
        direcao: 'baixo',
        instrucao: '1 de 3 · Gire a rodinha do mouse para baixo até o final da página.',
    },
    {
        id: 'topo',
        direcao: 'cima',
        instrucao: '2 de 3 · Agora gire a rodinha para cima até voltar ao topo.',
    },
    {
        id: 'meio',
        direcao: 'meio',
        instrucao: '3 de 3 · Role com cuidado e pare no meio da página.',
    },
]

const areaScrollRef = ref(null)
const indicePasso = ref(0)
const percentualScroll = ref(0)
const finalizado = ref(false)

const passoAtual = computed(() => PASSOS[indicePasso.value] || null)

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

const progressoPercentual = computed(() => {
    if (finalizado.value) return 100
    return Math.round((indicePasso.value / PASSOS.length) * 100)
})

const atualizarScroll = () => {
    const el = areaScrollRef.value
    if (!el) return

    const maximo = el.scrollHeight - el.clientHeight
    if (maximo <= 0) {
        percentualScroll.value = 0
        return
    }

    percentualScroll.value = Math.min(100, Math.max(0, Math.round((el.scrollTop / maximo) * 100)))
}

const confirmarPonto = (pontoId) => {
    if (finalizado.value || !passoAtual.value || passoAtual.value.id !== pontoId) return

    if (indicePasso.value < PASSOS.length - 1) {
        indicePasso.value += 1
        return
    }

    finalizado.value = true
    emit('registrar-tentativa')
}

const iniciarNovaTentativa = async () => {
    indicePasso.value = 0
    percentualScroll.value = 0
    finalizado.value = false

    await nextTick()
    if (areaScrollRef.value) {
        areaScrollRef.value.scrollTop = 0
    }
}
</script>

<template>
    <Card class="overflow-hidden">
        <!-- Barra superior -->
        <div class="px-5 py-3.5 border-b border-border flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                <span class="px-2 py-0.5 rounded-md bg-muted text-foreground">
                    {{ textoTentativa }}
                </span>
                <span>
                    Pontos:
                    <strong class="text-foreground">{{ finalizado ? PASSOS.length : indicePasso }}/{{ PASSOS.length }}</strong>
                </span>
                <span class="text-border">|</span>
                <span class="tabular-nums">
                    Posição: <strong class="text-foreground">{{ percentualScroll }}%</strong>
                </span>
            </div>

            <Button
                v-if="indicePasso > 0 && !finalizado"
                variant="ghost"
                size="sm"
                class="gap-1.5 text-xs text-muted-foreground"
                @click="iniciarNovaTentativa"
            >
                <RotateCcw class="w-3.5 h-3.5" />
                <span>Recomeçar</span>
            </Button>
        </div>

        <!-- Barra de progresso -->
        <div class="h-1 w-full bg-muted">
            <div
                class="h-full bg-primary transition-all duration-200"
                :style="{ width: `${progressoPercentual}%` }"
            />
        </div>

        <CardContent class="p-4 sm:p-5">
            <div v-if="!finalizado" class="space-y-3">
                <!-- Banner fixo com o objetivo atual -->
                <div class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs sm:text-sm font-medium">
                    <ArrowDown v-if="passoAtual.direcao === 'baixo'" class="w-4 h-4 shrink-0" />
                    <ArrowUp v-else-if="passoAtual.direcao === 'cima'" class="w-4 h-4 shrink-0" />
                    <Crosshair v-else class="w-4 h-4 shrink-0" />
                    <span>{{ passoAtual.instrucao }}</span>
                </div>

                <!-- Área rolável -->
                <div
                    ref="areaScrollRef"
                    @scroll="atualizarScroll"
                    class="h-[340px] sm:h-[370px] overflow-y-auto rounded-xl border border-border bg-muted/20 px-4 sm:px-6 py-6 scroll-smooth"
                >
                    <div class="max-w-lg mx-auto space-y-6">
                        <!-- Ponto 2: Topo -->
                        <div
                            :class="[
                                'rounded-xl border p-5 text-center space-y-3 transition-all',
                                passoAtual.id === 'topo'
                                    ? 'border-primary bg-primary/10 shadow-xs'
                                    : indicePasso > 1
                                        ? 'border-emerald-500/30 bg-emerald-500/10'
                                        : 'border-border bg-background',
                            ]"
                        >
                            <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Topo da página (0%)
                            </p>

                            <Button
                                v-if="passoAtual.id === 'topo'"
                                class="gap-2"
                                @click="confirmarPonto('topo')"
                            >
                                <Flag class="w-4 h-4" />
                                <span>Cheguei ao topo</span>
                            </Button>

                            <p
                                v-else-if="indicePasso > 1"
                                class="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                            >
                                <CheckCircle2 class="w-4 h-4" />
                                <span>Topo confirmado</span>
                            </p>

                            <p v-else class="text-xs text-muted-foreground">
                                Comece rolando para baixo até encontrar o final da página.
                            </p>
                        </div>

                        <!-- Trecho intermediário superior -->
                        <div class="h-64 flex flex-col items-center justify-center gap-2 border-l-2 border-dashed border-border/80 mx-auto w-px relative">
                            <span class="absolute whitespace-nowrap px-2.5 py-1 rounded-full bg-background border border-border text-[11px] text-muted-foreground">
                                Continue rolando · 25%
                            </span>
                        </div>

                        <!-- Ponto 3: Meio -->
                        <div
                            :class="[
                                'rounded-xl border p-5 text-center space-y-3 transition-all',
                                passoAtual.id === 'meio'
                                    ? 'border-primary bg-primary/10 shadow-xs'
                                    : 'border-border bg-background',
                            ]"
                        >
                            <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Meio da página (50%)
                            </p>

                            <Button
                                v-if="passoAtual.id === 'meio'"
                                class="gap-2"
                                @click="confirmarPonto('meio')"
                            >
                                <Crosshair class="w-4 h-4" />
                                <span>Parei no meio</span>
                            </Button>

                            <p v-else class="text-xs text-muted-foreground">
                                Você voltará aqui na última etapa desta tentativa.
                            </p>
                        </div>

                        <!-- Trecho intermediário inferior -->
                        <div class="h-64 flex flex-col items-center justify-center gap-2 border-l-2 border-dashed border-border/80 mx-auto w-px relative">
                            <span class="absolute whitespace-nowrap px-2.5 py-1 rounded-full bg-background border border-border text-[11px] text-muted-foreground">
                                Quase no final · 75%
                            </span>
                        </div>

                        <!-- Ponto 1: Final -->
                        <div
                            :class="[
                                'rounded-xl border p-5 text-center space-y-3 transition-all',
                                passoAtual.id === 'fim'
                                    ? 'border-primary bg-primary/10 shadow-xs'
                                    : indicePasso > 0
                                        ? 'border-emerald-500/30 bg-emerald-500/10'
                                        : 'border-border bg-background',
                            ]"
                        >
                            <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Final da página (100%)
                            </p>

                            <Button
                                v-if="passoAtual.id === 'fim'"
                                class="gap-2"
                                @click="confirmarPonto('fim')"
                            >
                                <Flag class="w-4 h-4" />
                                <span>Cheguei ao final</span>
                            </Button>

                            <p
                                v-else
                                class="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                            >
                                <CheckCircle2 class="w-4 h-4" />
                                <span>Final confirmado</span>
                            </p>
                        </div>
                    </div>
                </div>
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
                                : 'Rolagem concluída'
                        }}
                    </h2>
                    <p class="text-sm text-muted-foreground max-w-sm">
                        {{
                            precisaMaisTentativas
                                ? 'Ótimo! Repita mais uma vez para fixar o controle da rodinha do mouse.'
                                : 'Você dominou a rolagem para cima, para baixo e paradas precisas.'
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