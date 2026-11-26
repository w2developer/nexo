<script setup>
import { ref, computed } from 'vue'
import {
    ArrowLeft,
    ArrowRight,
    Check,
    CheckCircle2,
    ChevronRight,
    Mouse,
    Keyboard,
    Award,
    RotateCcw,
} from '@lucide/vue'
import Card from '@/components/ui/Card.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import Modal from '@/components/ui/Modal.vue'
import PrimeiraAulaHeader from '../components/PrimeiraAulaHeader.vue'
import EtapaClique from '../components/mouse/EtapaClique.vue'
import EtapaArrastar from '../components/mouse/EtapaArrastar.vue'
import EtapaDuploClique from '../components/mouse/EtapaDuploClique.vue'
import EtapaScroll from '../components/mouse/EtapaScroll.vue'
import EtapaVelocidade from '../components/mouse/EtapaVelocidade.vue'
import EtapaDigitacao from '../components/teclado/EtapaDigitacao.vue'
import ResumoFinal from '../components/ResumoFinal.vue'
import { usePrimeiraAula } from '../composables/usePrimeiraAula'

const COMPONENTES_MOUSE = {
    clique: EtapaClique,
    arrastar: EtapaArrastar,
    'duplo-clique': EtapaDuploClique,
    scroll: EtapaScroll,
    velocidade: EtapaVelocidade,
}

const {
    estado,
    etapas,
    minimoTentativas,
    etapasMouse,
    etapasTeclado,
    etapaAtual,
    etapasDaSecaoAtual,
    indiceNaSecao,
    estaNoInicio,
    estaNoResumo,
    concluidasMouse,
    concluidasTeclado,
    totalConcluidas,
    proximaEtapaMouse,
    proximaEtapaTeclado,
    etapaEstaConcluida,
    obterTentativas,
    irParaEtapa,
    registrarTentativa,
    avancarEtapa,
    voltarEtapa,
    reiniciarPratica,
} = usePrimeiraAula()

const modalReinicioAberto = ref(false)

const componenteMouseAtual = computed(() => {
    if (!etapaAtual.value) return null
    return COMPONENTES_MOUSE[etapaAtual.value.id] || null
})

const ehUltimaEtapaDaSecao = computed(() => {
    if (!etapaAtual.value) return false
    return indiceNaSecao.value === etapasDaSecaoAtual.value.length - 1
})

const confirmarReinicio = () => {
    reiniciarPratica()
    modalReinicioAberto.value = false
}

const registrarTentativaAtual = (dados = {}) => {
    if (!etapaAtual.value) return
    registrarTentativa(etapaAtual.value.id, dados)
}

const textoBotaoProximo = () => {
    if (!etapaAtual.value) return ''
    if (etapaAtual.value.secao === 'mouse' && ehUltimaEtapaDaSecao.value) {
        return 'Ir para Teclado'
    }
    if (etapaAtual.value.secao === 'teclado' && ehUltimaEtapaDaSecao.value) {
        return 'Ver resumo'
    }
    return 'Próxima etapa'
}
</script>

<template>
    <div class="min-h-screen flex flex-col bg-muted/30 dark:bg-background text-foreground transition-colors">
        <PrimeiraAulaHeader @solicitar-reinicio="modalReinicioAberto = true" />

        <!-- Tela Inicial: Mouse e Teclado separados em 2 blocos limpos -->
        <main
            v-if="estaNoInicio"
            class="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col justify-center"
        >
            <div class="space-y-8">
                <div class="space-y-1.5 text-center">
                    <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                        Primeira Aula
                    </h1>
                    <p class="text-sm text-muted-foreground">
                        Escolha por onde começar. Cada etapa conta com {{ minimoTentativas }} tentativas para fixar bem.
                    </p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <!-- Card Mouse -->
                    <Card class="flex flex-col h-full">
                        <div class="p-5 pb-4 border-b border-border flex items-center justify-between gap-3">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <Mouse class="w-4 h-4" />
                                </div>
                                <div class="min-w-0">
                                    <h2 class="text-base font-semibold text-foreground leading-tight">
                                        Mouse
                                    </h2>
                                    <p class="text-xs text-muted-foreground mt-0.5">
                                        Coordenação e precisão
                                    </p>
                                </div>
                            </div>

                            <span
                                :class="[
                                    'text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                                    concluidasMouse === etapasMouse.length
                                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                        : 'bg-muted text-muted-foreground',
                                ]"
                            >
                                {{ concluidasMouse }}/{{ etapasMouse.length }}
                            </span>
                        </div>

                        <CardContent class="p-5 flex-1 flex flex-col justify-between gap-5">
                            <ul class="space-y-1">
                                <li v-for="etapa in etapasMouse" :key="etapa.id">
                                    <button
                                        type="button"
                                        @click="irParaEtapa(etapa.id)"
                                        class="group w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-left hover:bg-muted/70 transition-colors cursor-pointer"
                                    >
                                        <span class="flex items-center gap-2.5 min-w-0">
                                            <span
                                                :class="[
                                                    'w-5 h-5 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0',
                                                    etapaEstaConcluida(etapa.id)
                                                        ? 'bg-emerald-500 text-white'
                                                        : obterTentativas(etapa.id) > 0
                                                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                                                            : 'bg-muted text-muted-foreground',
                                                ]"
                                            >
                                                <Check v-if="etapaEstaConcluida(etapa.id)" class="w-3 h-3" />
                                                <template v-else>{{ etapa.numeroSecao }}</template>
                                            </span>
                                            <span class="truncate text-foreground/90 group-hover:text-foreground">
                                                {{ etapa.titulo }}
                                            </span>
                                        </span>

                                        <span class="flex items-center gap-1.5 shrink-0">
                                            <span
                                                v-if="!etapaEstaConcluida(etapa.id) && obterTentativas(etapa.id) > 0"
                                                class="text-[11px] font-medium text-amber-600 dark:text-amber-400"
                                            >
                                                {{ obterTentativas(etapa.id) }}/{{ minimoTentativas }}
                                            </span>
                                            <ChevronRight class="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                                        </span>
                                    </button>
                                </li>
                            </ul>

                            <Button
                                :variant="concluidasMouse === etapasMouse.length ? 'outline' : 'default'"
                                class="w-full gap-2"
                                @click="irParaEtapa(proximaEtapaMouse)"
                            >
                                <span>
                                    {{
                                        concluidasMouse === 0
                                            ? 'Começar prática'
                                            : concluidasMouse === etapasMouse.length
                                                ? 'Refazer prática'
                                                : 'Continuar prática'
                                    }}
                                </span>
                                <ArrowRight class="w-4 h-4" />
                            </Button>
                        </CardContent>
                    </Card>

                    <!-- Card Teclado -->
                    <Card class="flex flex-col h-full">
                        <div class="p-5 pb-4 border-b border-border flex items-center justify-between gap-3">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <Keyboard class="w-4 h-4" />
                                </div>
                                <div class="min-w-0">
                                    <h2 class="text-base font-semibold text-foreground leading-tight">
                                        Teclado
                                    </h2>
                                    <p class="text-xs text-muted-foreground mt-0.5">
                                        Digitação progressiva
                                    </p>
                                </div>
                            </div>

                            <span
                                :class="[
                                    'text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                                    concluidasTeclado === etapasTeclado.length
                                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                        : 'bg-muted text-muted-foreground',
                                ]"
                            >
                                {{ concluidasTeclado }}/{{ etapasTeclado.length }}
                            </span>
                        </div>

                        <CardContent class="p-5 flex-1 flex flex-col justify-between gap-5">
                            <ul class="space-y-1">
                                <li v-for="etapa in etapasTeclado" :key="etapa.id">
                                    <button
                                        type="button"
                                        @click="irParaEtapa(etapa.id)"
                                        class="group w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-left hover:bg-muted/70 transition-colors cursor-pointer"
                                    >
                                        <span class="flex items-center gap-2.5 min-w-0">
                                            <span
                                                :class="[
                                                    'w-5 h-5 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0',
                                                    etapaEstaConcluida(etapa.id)
                                                        ? 'bg-emerald-500 text-white'
                                                        : obterTentativas(etapa.id) > 0
                                                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                                                            : 'bg-muted text-muted-foreground',
                                                ]"
                                            >
                                                <Check v-if="etapaEstaConcluida(etapa.id)" class="w-3 h-3" />
                                                <template v-else>{{ etapa.numeroSecao }}</template>
                                            </span>
                                            <span class="truncate text-foreground/90 group-hover:text-foreground">
                                                {{ etapa.titulo }}
                                            </span>
                                        </span>

                                        <span class="flex items-center gap-1.5 shrink-0">
                                            <span
                                                v-if="!etapaEstaConcluida(etapa.id) && obterTentativas(etapa.id) > 0"
                                                class="text-[11px] font-medium text-amber-600 dark:text-amber-400"
                                            >
                                                {{ obterTentativas(etapa.id) }}/{{ minimoTentativas }}
                                            </span>
                                            <ChevronRight class="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                                        </span>
                                    </button>
                                </li>
                            </ul>

                            <Button
                                :variant="concluidasMouse === etapasMouse.length && concluidasTeclado < etapasTeclado.length ? 'default' : 'outline'"
                                class="w-full gap-2"
                                @click="irParaEtapa(proximaEtapaTeclado)"
                            >
                                <span>
                                    {{
                                        concluidasTeclado === 0
                                            ? 'Começar prática'
                                            : concluidasTeclado === etapasTeclado.length
                                                ? 'Refazer prática'
                                                : 'Continuar prática'
                                    }}
                                </span>
                                <ArrowRight class="w-4 h-4" />
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <!-- Ações discretas quando já houver progresso -->
                <div
                    v-if="totalConcluidas > 0"
                    class="flex items-center justify-center gap-4 pt-1"
                >
                    <button
                        v-if="totalConcluidas === etapas.length"
                        type="button"
                        @click="irParaEtapa('resumo')"
                        class="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline underline-offset-4 cursor-pointer"
                    >
                        <Award class="w-3.5 h-3.5" />
                        <span>Ver resumo final</span>
                    </button>

                    <button
                        type="button"
                        @click="modalReinicioAberto = true"
                        class="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        <RotateCcw class="w-3.5 h-3.5" />
                        <span>Reiniciar progresso</span>
                    </button>
                </div>
            </div>
        </main>

        <!-- Modo Foco: exercício ativo -->
        <main
            v-else-if="etapaAtual"
            class="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-5"
        >
            <div class="flex items-start justify-between gap-4">
                <div class="space-y-1">
                    <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                        {{ etapaAtual.titulo }}
                    </h1>
                    <p class="text-sm text-muted-foreground">
                        {{ etapaAtual.resumo }}
                    </p>
                </div>

                <span
                    v-if="etapaEstaConcluida(etapaAtual.id)"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shrink-0"
                >
                    <CheckCircle2 class="w-3.5 h-3.5" />
                    Concluída
                </span>
            </div>

            <!-- Exercícios da seção Mouse -->
            <component
                :is="componenteMouseAtual"
                v-if="componenteMouseAtual"
                :key="etapaAtual.id"
                :concluida="etapaEstaConcluida(etapaAtual.id)"
                :tentativas="obterTentativas(etapaAtual.id)"
                :minimo-tentativas="minimoTentativas"
                :recorde-atual="estado.recordeCliques"
                @registrar-tentativa="registrarTentativaAtual"
                @avancar="avancarEtapa"
            />

            <!-- Exercícios da seção Teclado -->
            <EtapaDigitacao
                v-else
                :key="etapaAtual.id"
                :etapa-id="etapaAtual.id"
                :concluida="etapaEstaConcluida(etapaAtual.id)"
                :tentativas="obterTentativas(etapaAtual.id)"
                :minimo-tentativas="minimoTentativas"
                :ultima-etapa="ehUltimaEtapaDaSecao"
                @registrar-tentativa="registrarTentativaAtual"
                @avancar="avancarEtapa"
            />

            <!-- Navegação discreta -->
            <div class="flex items-center justify-between pt-1">
                <Button variant="ghost" size="sm" class="gap-1.5 text-muted-foreground" @click="voltarEtapa">
                    <ArrowLeft class="w-4 h-4" />
                    <span>{{ indiceNaSecao === 0 ? 'Início' : 'Anterior' }}</span>
                </Button>

                <Button variant="ghost" size="sm" class="gap-1.5 text-muted-foreground" @click="avancarEtapa">
                    <span>{{ textoBotaoProximo() }}</span>
                    <ArrowRight class="w-4 h-4" />
                </Button>
            </div>
        </main>

        <!-- Resumo Final -->
        <main
            v-else-if="estaNoResumo"
            class="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex items-center"
        >
            <ResumoFinal @solicitar-reinicio="modalReinicioAberto = true" />
        </main>

        <!-- Modal de confirmação para reiniciar -->
        <Modal
            v-model="modalReinicioAberto"
            title="Reiniciar primeira aula?"
            description="O progresso desta sessão será zerado."
            size="sm"
        >
            <p class="text-sm text-muted-foreground">
                Essa ação limpa apenas os dados temporários desta aba do navegador.
            </p>

            <template #footer>
                <Button variant="ghost" @click="modalReinicioAberto = false">
                    Cancelar
                </Button>
                <Button variant="destructive" @click="confirmarReinicio">
                    Sim, reiniciar
                </Button>
            </template>
        </Modal>
    </div>
</template>