<script setup>
import { ref, computed, onUnmounted } from 'vue'
import {
    Folder,
    FolderOpen,
    CheckCircle2,
    RotateCcw,
    ArrowRight,
    MousePointerClick,
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

const PASTAS = [
    { id: 'documentos', nome: 'Documentos' },
    { id: 'fotos', nome: 'Fotos' },
    { id: 'aulas', nome: 'Aulas' },
    { id: 'projetos', nome: 'Projetos' },
    { id: 'planilhas', nome: 'Planilhas' },
    { id: 'certificados', nome: 'Certificados' },
]

const abertas = ref([])
const selecionadaId = ref(null)
const finalizado = ref(false)
const dica = ref('')

let ultimoClique = { id: null, timestamp: 0 }
let timerDica = null

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

const progressoPercentual = computed(() =>
    Math.round((abertas.value.length / PASTAS.length) * 100)
)

const pastaEstaAberta = (id) => abertas.value.includes(id)

const aoClicarSimples = (pastaId) => {
    if (finalizado.value || pastaEstaAberta(pastaId)) return

    const agora = Date.now()
    const intervalo = agora - ultimoClique.timestamp
    const mesmoItem = ultimoClique.id === pastaId

    selecionadaId.value = pastaId
    clearTimeout(timerDica)

    if (mesmoItem && intervalo >= 450 && intervalo <= 1600) {
        dica.value = 'Quase lá! Tente clicar duas vezes um pouco mais rápido.'
    } else {
        timerDica = setTimeout(() => {
            if (!pastaEstaAberta(pastaId)) {
                dica.value = 'Você deu 1 clique. Clique duas vezes rapidinho para abrir.'
            }
        }, 550)
    }

    ultimoClique = { id: pastaId, timestamp: agora }
}

const aoDuploClique = (pastaId) => {
    if (finalizado.value || pastaEstaAberta(pastaId)) return

    clearTimeout(timerDica)
    dica.value = ''
    selecionadaId.value = null
    abertas.value.push(pastaId)

    if (abertas.value.length === PASTAS.length) {
        finalizado.value = true
        emit('registrar-tentativa')
    }
}

const iniciarNovaTentativa = () => {
    clearTimeout(timerDica)
    abertas.value = []
    selecionadaId.value = null
    finalizado.value = false
    dica.value = ''
    ultimoClique = { id: null, timestamp: 0 }
}

onUnmounted(() => {
    clearTimeout(timerDica)
})
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
                    Pastas abertas:
                    <strong class="text-foreground">{{ abertas.length }}/{{ PASTAS.length }}</strong>
                </span>
            </div>

            <Button
                v-if="abertas.length > 0 && !finalizado"
                variant="ghost"
                size="sm"
                class="gap-1.5 text-xs text-muted-foreground"
                @click="iniciarNovaTentativa"
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
                <div class="min-h-[32px] flex items-center">
                    <div
                        v-if="dica"
                        class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 text-xs font-medium"
                    >
                        <MousePointerClick class="w-3.5 h-3.5 shrink-0" />
                        <span>{{ dica }}</span>
                    </div>
                    <p v-else class="text-xs text-muted-foreground">
                        Dê um clique duplo em cada pasta abaixo para abri-la.
                    </p>
                </div>

                <!-- Grade de pastas -->
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 my-auto">
                    <button
                        v-for="pasta in PASTAS"
                        :key="pasta.id"
                        type="button"
                        @click="aoClicarSimples(pasta.id)"
                        @dblclick.prevent="aoDuploClique(pasta.id)"
                        :disabled="pastaEstaAberta(pasta.id)"
                        :class="[
                            'group flex flex-col items-center justify-center gap-2.5 p-5 rounded-xl border text-center select-none transition-all',
                            pastaEstaAberta(pasta.id)
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 cursor-default'
                                : selecionadaId === pasta.id
                                    ? 'bg-primary/10 border-primary text-foreground ring-2 ring-primary/20 cursor-pointer'
                                    : 'bg-muted/20 border-border text-foreground hover:bg-muted/50 hover:border-foreground/20 cursor-pointer',
                        ]"
                    >
                        <div
                            :class="[
                                'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
                                pastaEstaAberta(pasta.id)
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                    : selecionadaId === pasta.id
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-background border border-border text-primary',
                            ]"
                        >
                            <FolderOpen v-if="pastaEstaAberta(pasta.id)" class="w-6 h-6" />
                            <Folder v-else class="w-6 h-6" />
                        </div>

                        <div class="space-y-0.5">
                            <p class="text-sm font-medium leading-tight">
                                {{ pasta.nome }}
                            </p>
                            <p
                                :class="[
                                    'text-[11px]',
                                    pastaEstaAberta(pasta.id)
                                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                        : 'text-muted-foreground',
                                ]"
                            >
                                {{ pastaEstaAberta(pasta.id) ? 'Aberta' : 'Fechada' }}
                            </p>
                        </div>
                    </button>
                </div>

                <div class="h-2" />
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
                                : 'Duplo clique concluído'
                        }}
                    </h2>
                    <p class="text-sm text-muted-foreground max-w-sm">
                        {{
                            precisaMaisTentativas
                                ? 'Ótimo ritmo! Repita mais uma vez para consolidar o clique duplo.'
                                : 'Todas as pastas foram abertas com sucesso nas duas tentativas.'
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