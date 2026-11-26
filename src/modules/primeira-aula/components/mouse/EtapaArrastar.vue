<script setup>
import { ref, computed, onUnmounted } from 'vue'
import {
    Folder,
    FileText,
    Image,
    FileSpreadsheet,
    CheckCircle2,
    RotateCcw,
    ArrowRight,
    GripVertical,
    AlertCircle,
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

const ICONES = {
    texto: FileText,
    imagem: Image,
    planilha: FileSpreadsheet,
}

const RODADAS = [
    {
        numero: 1,
        titulo: 'Rodada 1/2 · Encaixe simples',
        instrucao: 'Arraste todos os arquivos para dentro da pasta.',
        zonas: [
            { id: 'geral', titulo: 'Pasta de destino', descricao: 'Solte qualquer arquivo aqui' },
        ],
        itens: [
            { id: 'r1-1', nome: 'Anotacoes.txt', icone: 'texto', destino: 'geral' },
            { id: 'r1-2', nome: 'Foto_Turma.jpg', icone: 'imagem', destino: 'geral' },
            { id: 'r1-3', nome: 'Planilha.xlsx', icone: 'planilha', destino: 'geral' },
        ],
    },
    {
        numero: 2,
        titulo: 'Rodada 2/2 · Organizar por tipo',
        instrucao: 'Separe cada arquivo na pasta correta: Documentos ou Imagens.',
        zonas: [
            { id: 'documentos', titulo: 'Documentos', descricao: 'Textos e planilhas' },
            { id: 'imagens', titulo: 'Imagens', descricao: 'Fotos e ilustrações' },
        ],
        itens: [
            { id: 'r2-1', nome: 'Curriculo.docx', icone: 'texto', destino: 'documentos' },
            { id: 'r2-2', nome: 'Paisagem.jpg', icone: 'imagem', destino: 'imagens' },
            { id: 'r2-3', nome: 'Notas.xlsx', icone: 'planilha', destino: 'documentos' },
            { id: 'r2-4', nome: 'Logo_Nexo.png', icone: 'imagem', destino: 'imagens' },
        ],
    },
]

const indiceRodada = ref(0)
const concluidosNaRodada = ref([])
const finalizado = ref(false)
const feedback = ref(null)

const arrasto = ref(null)
const zonaSobre = ref(null)
const elementosZonas = new Map()

let timerFeedback = null

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

const rodadaAtual = computed(() => RODADAS[indiceRodada.value])

const itensRestantes = computed(() =>
    rodadaAtual.value.itens.filter((item) => !concluidosNaRodada.value.includes(item.id))
)

const totalItensGeral = computed(() =>
    RODADAS.reduce((acc, rodada) => acc + rodada.itens.length, 0)
)

const totalConcluidosGeral = computed(() => {
    if (finalizado.value) return totalItensGeral.value
    const anteriores = RODADAS.slice(0, indiceRodada.value).reduce(
        (acc, rodada) => acc + rodada.itens.length,
        0
    )
    return anteriores + concluidosNaRodada.value.length
})

const progressoPercentual = computed(() =>
    Math.round((totalConcluidosGeral.value / totalItensGeral.value) * 100)
)

const contarNaZona = (zonaId) =>
    rodadaAtual.value.itens.filter(
        (item) => item.destino === zonaId && concluidosNaRodada.value.includes(item.id)
    ).length

const registrarZona = (zonaId, el) => {
    if (el) {
        elementosZonas.set(zonaId, el)
    } else {
        elementosZonas.delete(zonaId)
    }
}

const exibirFeedback = (tipo, texto) => {
    feedback.value = { tipo, texto }
    clearTimeout(timerFeedback)
    timerFeedback = setTimeout(() => {
        feedback.value = null
    }, 2400)
}

const detectarZonaNoPonto = (clientX, clientY) => {
    for (const [zonaId, el] of elementosZonas.entries()) {
        const rect = el.getBoundingClientRect()
        const dentro =
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom

        if (dentro) return zonaId
    }
    return null
}

const moverArrasto = (event) => {
    if (!arrasto.value) return

    arrasto.value.x = event.clientX - arrasto.value.offsetX
    arrasto.value.y = event.clientY - arrasto.value.offsetY
    zonaSobre.value = detectarZonaNoPonto(event.clientX, event.clientY)
}

const removerListenersJanela = () => {
    window.removeEventListener('pointermove', moverArrasto)
    window.removeEventListener('pointerup', finalizarArrasto)
    window.removeEventListener('pointercancel', finalizarArrasto)
}

const finalizarArrasto = (event) => {
    if (!arrasto.value) return

    const item = arrasto.value.item
    const zonaAlvo = detectarZonaNoPonto(event.clientX, event.clientY)

    removerListenersJanela()
    arrasto.value = null
    zonaSobre.value = null

    if (!zonaAlvo) return

    if (zonaAlvo === item.destino) {
        concluidosNaRodada.value.push(item.id)
        feedback.value = null

        if (concluidosNaRodada.value.length === rodadaAtual.value.itens.length) {
            if (indiceRodada.value < RODADAS.length - 1) {
                indiceRodada.value += 1
                concluidosNaRodada.value = []
                exibirFeedback('sucesso', 'Rodada 1 concluída. Agora separe por tipo de arquivo.')
            } else {
                finalizado.value = true
                emit('registrar-tentativa')
            }
        }
    } else {
        const zonaCorreta = rodadaAtual.value.zonas.find((z) => z.id === item.destino)
        exibirFeedback(
            'erro',
            `Esse arquivo pertence à pasta ${zonaCorreta ? zonaCorreta.titulo : 'correta'}.`
        )
    }
}

const iniciarArrasto = (item, event) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return

    const rect = event.currentTarget.getBoundingClientRect()

    arrasto.value = {
        item,
        width: rect.width,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        x: rect.left,
        y: rect.top,
    }

    zonaSobre.value = detectarZonaNoPonto(event.clientX, event.clientY)

    window.addEventListener('pointermove', moverArrasto)
    window.addEventListener('pointerup', finalizarArrasto)
    window.addEventListener('pointercancel', finalizarArrasto)
}

const iniciarNovaTentativa = () => {
    removerListenersJanela()
    arrasto.value = null
    zonaSobre.value = null
    indiceRodada.value = 0
    concluidosNaRodada.value = []
    finalizado.value = false
    feedback.value = null
}

onUnmounted(() => {
    removerListenersJanela()
    clearTimeout(timerFeedback)
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
                <span class="text-foreground">{{ rodadaAtual.titulo }}</span>
                <span class="text-border">|</span>
                <span>{{ totalConcluidosGeral }}/{{ totalItensGeral }} organizados</span>
            </div>

            <Button
                v-if="totalConcluidosGeral > 0 && !finalizado"
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
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-h-[28px]">
                    <p class="text-xs text-muted-foreground">
                        {{ rodadaAtual.instrucao }}
                    </p>

                    <div
                        v-if="feedback"
                        :class="[
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium self-start sm:self-auto',
                            feedback.tipo === 'erro'
                                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                        ]"
                    >
                        <AlertCircle v-if="feedback.tipo === 'erro'" class="w-3.5 h-3.5 shrink-0" />
                        <CheckCircle2 v-else class="w-3.5 h-3.5 shrink-0" />
                        <span>{{ feedback.texto }}</span>
                    </div>
                </div>

                <!-- Área dos itens arrastáveis -->
                <div class="rounded-xl border border-border bg-muted/20 p-4">
                    <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Arquivos disponíveis
                    </p>

                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        <div
                            v-for="item in itensRestantes"
                            :key="item.id"
                            @pointerdown="iniciarArrasto(item, $event)"
                            :class="[
                                'flex items-center justify-between gap-2.5 px-3.5 py-3 rounded-lg border bg-background text-sm font-medium text-foreground select-none touch-none transition-all cursor-grab active:cursor-grabbing',
                                arrasto?.item.id === item.id
                                    ? 'opacity-30 border-dashed border-primary'
                                    : 'border-border hover:border-primary/50 hover:shadow-xs',
                            ]"
                        >
                            <span class="flex items-center gap-2.5 min-w-0">
                                <component
                                    :is="ICONES[item.icone]"
                                    class="w-4 h-4 text-primary shrink-0"
                                />
                                <span class="truncate">{{ item.nome }}</span>
                            </span>
                            <GripVertical class="w-4 h-4 text-muted-foreground/50 shrink-0" />
                        </div>
                    </div>
                </div>

                <!-- Zonas de destino (pastas) -->
                <div
                    :class="[
                        'grid gap-4',
                        rodadaAtual.zonas.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2',
                    ]"
                >
                    <div
                        v-for="zona in rodadaAtual.zonas"
                        :key="zona.id"
                        :ref="(el) => registrarZona(zona.id, el)"
                        :class="[
                            'min-h-[132px] rounded-xl border-2 border-dashed p-5 flex flex-col items-center justify-center text-center gap-2 transition-all select-none',
                            zonaSobre === zona.id
                                ? 'border-primary bg-primary/10 scale-[1.01]'
                                : 'border-border bg-muted/20',
                        ]"
                    >
                        <div
                            :class="[
                                'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                                zonaSobre === zona.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-background border border-border text-primary',
                            ]"
                        >
                            <Folder class="w-5 h-5" />
                        </div>

                        <div>
                            <p class="text-sm font-semibold text-foreground">
                                {{ zona.titulo }}
                            </p>
                            <p class="text-xs text-muted-foreground mt-0.5">
                                {{ zona.descricao }}
                            </p>
                        </div>

                        <span class="text-[11px] font-medium px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground">
                            {{ contarNaZona(zona.id) }} {{ contarNaZona(zona.id) === 1 ? 'arquivo' : 'arquivos' }}
                        </span>
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
                                : 'Arrastar e soltar concluído'
                        }}
                    </h2>
                    <p class="text-sm text-muted-foreground max-w-sm">
                        {{
                            precisaMaisTentativas
                                ? 'Muito bem! Faça mais uma tentativa para fixar o movimento de segurar e soltar.'
                                : 'Todos os arquivos foram organizados nas pastas corretas.'
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

        <!-- Prévia flutuante durante o arrasto -->
        <Teleport to="body">
            <div
                v-if="arrasto"
                class="fixed top-0 left-0 z-50 pointer-events-none select-none flex items-center justify-between gap-2.5 px-3.5 py-3 rounded-lg border-2 border-primary bg-background text-sm font-medium text-foreground shadow-lg"
                :style="{
                    width: `${arrasto.width}px`,
                    transform: `translate3d(${arrasto.x}px, ${arrasto.y}px, 0) scale(1.03)`,
                }"
            >
                <span class="flex items-center gap-2.5 min-w-0">
                    <component
                        :is="ICONES[arrasto.item.icone]"
                        class="w-4 h-4 text-primary shrink-0"
                    />
                    <span class="truncate">{{ arrasto.item.nome }}</span>
                </span>
                <GripVertical class="w-4 h-4 text-primary shrink-0" />
            </div>
        </Teleport>
    </Card>
</template>