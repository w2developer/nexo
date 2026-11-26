<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import {
    Keyboard,
    AlertCircle,
    CheckCircle2,
    RotateCcw,
    ArrowRight,
} from '@lucide/vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import { EXERCICIOS_DIGITACAO } from '../../data/exerciciosDigitacao'

const props = defineProps({
    etapaId: {
        type: String,
        required: true,
    },
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
    ultimaEtapa: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits(['registrar-tentativa', 'avancar'])

const inputRef = ref(null)
const indiceConjunto = ref(props.tentativas % 2)
const indiceFrase = ref(0)
const textoDigitado = ref('')
const ultimoTexto = ref('')
const emComposicao = ref(false)
const transicionando = ref(false)
const finalizado = ref(false)
const capsLockAtivo = ref(false)

const totalTeclasDigitadas = ref(0)
const errosTotais = ref(0)

let timerTransicao = null

const configuracao = computed(
    () => EXERCICIOS_DIGITACAO[props.etapaId] || EXERCICIOS_DIGITACAO['digitacao-simples']
)

const frases = computed(() => {
    const conjuntos = configuracao.value.conjuntos
    return conjuntos[indiceConjunto.value % conjuntos.length]
})

const fraseAtual = computed(() => frases.value[indiceFrase.value] || '')

const caracteresFrase = computed(() => Array.from(fraseAtual.value))

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
    return Math.round((indiceFrase.value / frases.value.length) * 100)
})

const possuiErroAtual = computed(() => {
    for (let i = 0; i < textoDigitado.value.length; i++) {
        if (textoDigitado.value[i] !== fraseAtual.value[i]) {
            return true
        }
    }
    return false
})

const precisaoAtual = computed(() => {
    if (totalTeclasDigitadas.value === 0) return 100
    const acertos = Math.max(0, totalTeclasDigitadas.value - errosTotais.value)
    return Math.round((acertos / totalTeclasDigitadas.value) * 100)
})

const focarCampo = async () => {
    await nextTick()
    if (inputRef.value && !finalizado.value) {
        inputRef.value.focus()
    }
}

const verificarCapsLock = (event) => {
    if (typeof event.getModifierState === 'function') {
        capsLockAtivo.value = event.getModifierState('CapsLock')
    }
}

const estadoCaractere = (indice) => {
    if (indice < textoDigitado.value.length) {
        return textoDigitado.value[indice] === fraseAtual.value[indice]
            ? 'correto'
            : 'erro'
    }
    if (indice === textoDigitado.value.length) {
        return 'atual'
    }
    return 'pendente'
}

const avancarFrase = () => {
    transicionando.value = true

    clearTimeout(timerTransicao)
    timerTransicao = setTimeout(() => {
        transicionando.value = false

        if (indiceFrase.value < frases.value.length - 1) {
            indiceFrase.value += 1
            textoDigitado.value = ''
            ultimoTexto.value = ''
            focarCampo()
            return
        }

        finalizado.value = true
        emit('registrar-tentativa', {
            digitacao: {
                precisao: precisaoAtual.value,
                erros: errosTotais.value,
                totalCaracteres: totalTeclasDigitadas.value,
            },
        })
    }, 280)
}

const processarEntrada = () => {
    if (emComposicao.value || transicionando.value || finalizado.value) return

    const novo = textoDigitado.value
    const anterior = ultimoTexto.value

    // Contabiliza apenas caracteres adicionados (ignora apagamentos com Backspace)
    if (novo.length > anterior.length) {
        for (let i = anterior.length; i < novo.length; i++) {
            totalTeclasDigitadas.value += 1
            if (novo[i] !== fraseAtual.value[i]) {
                errosTotais.value += 1
            }
        }
    }

    ultimoTexto.value = novo

    if (novo === fraseAtual.value) {
        avancarFrase()
    }
}

const aoIniciarComposicao = () => {
    emComposicao.value = true
}

const aoFinalizarComposicao = () => {
    emComposicao.value = false
    processarEntrada()
}

const iniciarNovaTentativa = (trocarConjunto = true) => {
    clearTimeout(timerTransicao)

    if (trocarConjunto) {
        indiceConjunto.value = (indiceConjunto.value + 1) % configuracao.value.conjuntos.length
    }

    indiceFrase.value = 0
    textoDigitado.value = ''
    ultimoTexto.value = ''
    emComposicao.value = false
    transicionando.value = false
    finalizado.value = false
    totalTeclasDigitadas.value = 0
    errosTotais.value = 0

    focarCampo()
}

onMounted(() => {
    window.addEventListener('keydown', verificarCapsLock)
    window.addEventListener('keyup', verificarCapsLock)
    focarCampo()
})

onUnmounted(() => {
    clearTimeout(timerTransicao)
    window.removeEventListener('keydown', verificarCapsLock)
    window.removeEventListener('keyup', verificarCapsLock)
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
                    Frase:
                    <strong class="text-foreground tabular-nums">
                        {{ finalizado ? frases.length : indiceFrase + 1 }}/{{ frases.length }}
                    </strong>
                </span>
                <span class="text-border">|</span>
                <span>
                    Precisão:
                    <strong class="text-foreground tabular-nums">{{ precisaoAtual }}%</strong>
                </span>
            </div>

            <Button
                v-if="(indiceFrase > 0 || textoDigitado.length > 0) && !finalizado"
                variant="ghost"
                size="sm"
                class="gap-1.5 text-xs text-muted-foreground"
                @click="iniciarNovaTentativa(false)"
            >
                <RotateCcw class="w-3.5 h-3.5" />
                <span>Recomeçar</span>
            </Button>
        </div>

        <!-- Progresso -->
        <div class="h-1 w-full bg-muted">
            <div
                class="h-full bg-primary transition-all duration-200"
                :style="{ width: `${progressoPercentual}%` }"
            />
        </div>

        <CardContent class="p-4 sm:p-6">
            <div
                v-if="!finalizado"
                class="min-h-[380px] sm:min-h-[420px] flex flex-col justify-between gap-5"
            >
                <!-- Dica curta da etapa -->
                <div class="flex flex-wrap items-center justify-between gap-2.5 rounded-lg bg-muted/40 border border-border/80 px-3.5 py-2.5">
                    <div class="flex items-center gap-2 text-xs text-muted-foreground">
                        <Keyboard class="w-4 h-4 text-primary shrink-0" />
                        <span>{{ configuracao.dicaTeclado }}</span>
                    </div>

                    <div class="flex flex-wrap items-center gap-1.5">
                        <kbd
                            v-for="tecla in configuracao.teclasDestaque"
                            :key="tecla"
                            class="px-2 py-0.5 rounded border border-border bg-background text-[11px] font-semibold text-foreground shadow-2xs"
                        >
                            {{ tecla }}
                        </kbd>
                    </div>
                </div>

                <!-- Alerta automático caso Caps Lock esteja ligado -->
                <div
                    v-if="capsLockAtivo"
                    role="alert"
                    class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-medium"
                >
                    <AlertCircle class="w-4 h-4 shrink-0" />
                    <span>
                        Caps Lock está ativado. Desative o Caps Lock e segure <strong>Shift + letra</strong> para maiúsculas.
                    </span>
                </div>

                <!-- Área principal da frase e campo de digitação -->
                <div class="my-auto space-y-4">
                    <!-- Frase de referência letra por letra -->
                    <div
                        @click="focarCampo"
                        :class="[
                            'rounded-xl border px-5 py-7 sm:px-7 sm:py-9 text-center transition-colors cursor-text select-none',
                            transicionando
                                ? 'border-emerald-500/50 bg-emerald-500/10'
                                : possuiErroAtual
                                    ? 'border-red-500/40 bg-red-500/5'
                                    : 'border-border bg-muted/20',
                        ]"
                    >
                        <p class="font-mono text-xl sm:text-2xl leading-relaxed tracking-wide break-words">
                            <span
                                v-for="(caractere, idx) in caracteresFrase"
                                :key="idx"
                                :class="[
                                    'transition-colors duration-75',
                                    estadoCaractere(idx) === 'correto' && 'text-emerald-600 dark:text-emerald-400',
                                    estadoCaractere(idx) === 'erro' && 'bg-red-500/20 text-red-600 dark:text-red-400 rounded-xs underline decoration-red-500',
                                    estadoCaractere(idx) === 'atual' && 'bg-primary/15 text-foreground border-b-2 border-primary rounded-xs',
                                    estadoCaractere(idx) === 'pendente' && 'text-muted-foreground/65',
                                ]"
                            >
                                {{ caractere === ' ' && estadoCaractere(idx) === 'erro' ? '·' : caractere }}
                            </span>
                        </p>
                    </div>

                    <!-- Campo de entrada real -->
                    <div class="space-y-2">
                        <input
                            ref="inputRef"
                            v-model="textoDigitado"
                            type="text"
                            :maxlength="fraseAtual.length"
                            :disabled="transicionando"
                            autocomplete="off"
                            autocorrect="off"
                            autocapitalize="off"
                            spellcheck="false"
                            placeholder="Digite a frase acima aqui..."
                            aria-label="Campo de prática de digitação"
                            @input="processarEntrada"
                            @compositionstart="aoIniciarComposicao"
                            @compositionend="aoFinalizarComposicao"
                            @keydown="verificarCapsLock"
                            @keyup="verificarCapsLock"
                            @paste.prevent
                            @drop.prevent
                            :class="[
                                'w-full h-12 px-4 rounded-xl border bg-background font-mono text-base sm:text-lg text-foreground placeholder:font-sans placeholder:text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 transition-all',
                                transicionando
                                    ? 'border-emerald-500 focus:ring-emerald-500/25'
                                    : possuiErroAtual
                                        ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'
                                        : 'border-border focus:border-primary focus:ring-primary/20',
                            ]"
                        />

                        <!-- Feedback curto de erro -->
                        <div class="min-h-[20px] flex items-center justify-between text-xs">
                            <span
                                v-if="possuiErroAtual"
                                class="text-red-600 dark:text-red-400 font-medium"
                            >
                                Há caractere incorreto destacado em vermelho. Use Backspace para corrigir.
                            </span>
                            <span
                                v-else-if="transicionando"
                                class="text-emerald-600 dark:text-emerald-400 font-medium"
                            >
                                Frase concluída!
                            </span>
                            <span v-else class="text-muted-foreground">
                                Digite exatamente como aparece acima.
                            </span>

                            <span class="text-muted-foreground tabular-nums shrink-0 ml-2">
                                {{ textoDigitado.length }}/{{ fraseAtual.length }}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="h-1" />
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

                <div class="space-y-1.5">
                    <h2 class="text-lg font-semibold text-foreground">
                        {{
                            precisaMaisTentativas
                                ? `Tentativa ${tentativas} de ${minimoTentativas} concluída`
                                : 'Etapa de digitação concluída'
                        }}
                    </h2>
                    <p class="text-sm text-muted-foreground max-w-sm">
                        {{
                            precisaMaisTentativas
                                ? 'Muito bem! Faça mais uma tentativa com novas frases para fixar melhor.'
                                : 'Excelente progresso! Você completou as tentativas desta etapa.'
                        }}
                    </p>
                </div>

                <!-- Resumo rápido da tentativa -->
                <div class="inline-flex items-center gap-5 px-5 py-2.5 rounded-xl bg-muted/40 border border-border text-xs">
                    <div>
                        <p class="text-muted-foreground">Precisão</p>
                        <p class="text-base font-bold text-foreground tabular-nums">
                            {{ precisaoAtual }}%
                        </p>
                    </div>
                    <div class="h-7 w-px bg-border" />
                    <div>
                        <p class="text-muted-foreground">Erros</p>
                        <p class="text-base font-bold text-foreground tabular-nums">
                            {{ errosTotais }}
                        </p>
                    </div>
                    <div class="h-7 w-px bg-border" />
                    <div>
                        <p class="text-muted-foreground">Frases</p>
                        <p class="text-base font-bold text-foreground tabular-nums">
                            {{ frases.length }}/{{ frases.length }}
                        </p>
                    </div>
                </div>

                <div class="flex flex-wrap items-center justify-center gap-3 pt-1">
                    <Button
                        v-if="precisaMaisTentativas"
                        class="gap-2"
                        @click="iniciarNovaTentativa(true)"
                    >
                        <RotateCcw class="w-4 h-4" />
                        <span>Iniciar {{ tentativas + 1 }}ª tentativa</span>
                    </Button>

                    <template v-else>
                        <Button variant="outline" class="gap-2" @click="iniciarNovaTentativa(true)">
                            <RotateCcw class="w-4 h-4" />
                            <span>Praticar de novo</span>
                        </Button>
                        <Button variant="sucess" class="gap-2" @click="emit('avancar')">
                            <span>{{ ultimaEtapa ? 'Ver resumo final' : 'Próxima etapa' }}</span>
                            <ArrowRight class="w-4 h-4" />
                        </Button>
                    </template>
                </div>
            </div>
        </CardContent>
    </Card>
</template>