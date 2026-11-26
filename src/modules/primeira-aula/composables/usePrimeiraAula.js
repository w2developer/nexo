// src/modules/primeira-aula/composables/usePrimeiraAula.js

import { reactive, computed, watch } from 'vue'

const STORAGE_KEY = 'nexo_primeira_aula_v1'

export const MINIMO_TENTATIVAS = 2

export const ETAPAS_PRIMEIRA_AULA = [
    {
        id: 'clique',
        numero: 1,
        numeroSecao: 1,
        secao: 'mouse',
        titulo: 'Clique simples',
        resumo: 'Clique nos alvos que aparecerem na área de prática.',
    },
    {
        id: 'arrastar',
        numero: 2,
        numeroSecao: 2,
        secao: 'mouse',
        titulo: 'Arrastar e soltar',
        resumo: 'Clique, segure o botão esquerdo e solte cada item no local correto.',
    },
    {
        id: 'duplo-clique',
        numero: 3,
        numeroSecao: 3,
        secao: 'mouse',
        titulo: 'Duplo clique',
        resumo: 'Clique duas vezes rapidamente em cada pasta para abri-la.',
    },
    {
        id: 'scroll',
        numero: 4,
        numeroSecao: 4,
        secao: 'mouse',
        titulo: 'Rolagem (Scroll)',
        resumo: 'Use a rodinha do mouse para navegar até os pontos indicados.',
    },
    {
        id: 'velocidade',
        numero: 5,
        numeroSecao: 5,
        secao: 'mouse',
        titulo: 'Velocidade de clique',
        resumo: 'Acerte o máximo de alvos em 30 segundos.',
    },
    {
        id: 'digitacao-simples',
        numero: 6,
        numeroSecao: 1,
        secao: 'teclado',
        titulo: 'Palavras e frases simples',
        resumo: 'Digite palavras e frases curtas em minúsculas, sem acentos.',
    },
    {
        id: 'digitacao-maiusculas',
        numero: 7,
        numeroSecao: 2,
        secao: 'teclado',
        titulo: 'Letras maiúsculas',
        resumo: 'Segure a tecla Shift junto com a letra para digitar maiúsculas.',
    },
    {
        id: 'digitacao-simbolos',
        numero: 8,
        numeroSecao: 3,
        secao: 'teclado',
        titulo: 'Símbolos e pontuação',
        resumo: 'Pratique pontuação, datas, e-mails e símbolos comuns do teclado.',
    },
    {
        id: 'digitacao-completa',
        numero: 9,
        numeroSecao: 4,
        secao: 'teclado',
        titulo: 'Desafio completo',
        resumo: 'Combine maiúsculas com Shift, acentos, números e pontuação.',
    },
]

const criarEstadoInicial = () => ({
    etapaAtualId: 'inicio',
    concluidas: [],
    tentativasPorEtapa: {},
    iniciadoEm: Date.now(),
    finalizadoEm: null,
    recordeCliques: 0,
    metricasDigitacao: {},
})

const carregarEstado = () => {
    if (typeof sessionStorage === 'undefined') return criarEstadoInicial()

    try {
        const salvo = sessionStorage.getItem(STORAGE_KEY)
        if (!salvo) return criarEstadoInicial()

        const parsed = JSON.parse(salvo)
        const idsEtapas = new Set(ETAPAS_PRIMEIRA_AULA.map((e) => e.id))
        const idsTelasValidas = new Set(['inicio', 'resumo', ...idsEtapas])

        const concluidas = Array.isArray(parsed.concluidas)
            ? parsed.concluidas.filter((id) => idsEtapas.has(id))
            : []

        const tentativasSanitizadas = {}
        if (parsed.tentativasPorEtapa && typeof parsed.tentativasPorEtapa === 'object') {
            for (const [id, valor] of Object.entries(parsed.tentativasPorEtapa)) {
                if (idsEtapas.has(id) && typeof valor === 'number' && valor > 0) {
                    tentativasSanitizadas[id] = Math.floor(valor)
                }
            }
        }

        // Garante compatibilidade com sessões salvas antes do controle de tentativas
        for (const id of concluidas) {
            if (!tentativasSanitizadas[id] || tentativasSanitizadas[id] < MINIMO_TENTATIVAS) {
                tentativasSanitizadas[id] = MINIMO_TENTATIVAS
            }
        }

        return {
            etapaAtualId: idsTelasValidas.has(parsed.etapaAtualId)
                ? parsed.etapaAtualId
                : 'inicio',
            concluidas,
            tentativasPorEtapa: tentativasSanitizadas,
            iniciadoEm: typeof parsed.iniciadoEm === 'number' ? parsed.iniciadoEm : Date.now(),
            finalizadoEm: typeof parsed.finalizadoEm === 'number' ? parsed.finalizadoEm : null,
            recordeCliques: typeof parsed.recordeCliques === 'number' ? parsed.recordeCliques : 0,
            metricasDigitacao:
                parsed.metricasDigitacao && typeof parsed.metricasDigitacao === 'object'
                    ? parsed.metricasDigitacao
                    : {},
        }
    } catch {
        return criarEstadoInicial()
    }
}

const estado = reactive(carregarEstado())

watch(
    estado,
    (novoEstado) => {
        if (typeof sessionStorage === 'undefined') return
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(novoEstado))
        } catch (erro) {
            console.error('Erro ao salvar progresso da primeira aula:', erro)
        }
    },
    { deep: true }
)

export function usePrimeiraAula() {
    const etapas = ETAPAS_PRIMEIRA_AULA
    const minimoTentativas = MINIMO_TENTATIVAS

    const etapasMouse = computed(() => etapas.filter((e) => e.secao === 'mouse'))
    const etapasTeclado = computed(() => etapas.filter((e) => e.secao === 'teclado'))

    const estaNoInicio = computed(() => estado.etapaAtualId === 'inicio')
    const estaNoResumo = computed(() => estado.etapaAtualId === 'resumo')

    const indiceAtual = computed(() =>
        etapas.findIndex((etapa) => etapa.id === estado.etapaAtualId)
    )

    const etapaAtual = computed(() =>
        indiceAtual.value >= 0 ? etapas[indiceAtual.value] : null
    )

    const etapasDaSecaoAtual = computed(() => {
        if (!etapaAtual.value) return []
        return etapaAtual.value.secao === 'mouse' ? etapasMouse.value : etapasTeclado.value
    })

    const indiceNaSecao = computed(() => {
        if (!etapaAtual.value) return -1
        return etapasDaSecaoAtual.value.findIndex((e) => e.id === etapaAtual.value.id)
    })

    const concluidasMouse = computed(
        () => etapasMouse.value.filter((e) => estado.concluidas.includes(e.id)).length
    )

    const concluidasTeclado = computed(
        () => etapasTeclado.value.filter((e) => estado.concluidas.includes(e.id)).length
    )

    const totalConcluidas = computed(() => estado.concluidas.length)

    const proximaEtapaMouse = computed(() => {
        const pendente = etapasMouse.value.find((e) => !estado.concluidas.includes(e.id))
        return pendente ? pendente.id : etapasMouse.value[0].id
    })

    const proximaEtapaTeclado = computed(() => {
        const pendente = etapasTeclado.value.find((e) => !estado.concluidas.includes(e.id))
        return pendente ? pendente.id : etapasTeclado.value[0].id
    })

    const etapaEstaConcluida = (id) => estado.concluidas.includes(id)

    const obterTentativas = (id) => estado.tentativasPorEtapa[id] || 0

    const irParaInicio = () => {
        estado.etapaAtualId = 'inicio'
    }

    const irParaEtapa = (id) => {
        if (id === 'inicio') {
            estado.etapaAtualId = 'inicio'
            return
        }

        if (id === 'resumo') {
            estado.etapaAtualId = 'resumo'
            if (!estado.finalizadoEm) {
                estado.finalizadoEm = Date.now()
            }
            return
        }

        const existe = etapas.some((e) => e.id === id)
        if (existe) {
            estado.etapaAtualId = id
        }
    }

    const aplicarMetricas = (id, dados = {}) => {
        if (typeof dados.recordeCliques === 'number' && dados.recordeCliques > estado.recordeCliques) {
            estado.recordeCliques = dados.recordeCliques
        }

        if (dados.digitacao && typeof dados.digitacao === 'object') {
            estado.metricasDigitacao[id] = {
                precisao: dados.digitacao.precisao ?? 100,
                erros: dados.digitacao.erros ?? 0,
                totalCaracteres: dados.digitacao.totalCaracteres ?? 0,
            }
        }
    }

    // Registra uma tentativa válida e conclui a etapa ao atingir o mínimo exigido
    const registrarTentativa = (id, dados = {}) => {
        const atual = estado.tentativasPorEtapa[id] || 0
        const novoTotal = atual + 1
        estado.tentativasPorEtapa[id] = novoTotal

        aplicarMetricas(id, dados)

        if (novoTotal >= MINIMO_TENTATIVAS && !estado.concluidas.includes(id)) {
            estado.concluidas.push(id)
        }
    }

    const concluirEtapa = (id, dados = {}) => {
        const atual = estado.tentativasPorEtapa[id] || 0
        if (atual < MINIMO_TENTATIVAS) {
            estado.tentativasPorEtapa[id] = MINIMO_TENTATIVAS
        }

        aplicarMetricas(id, dados)

        if (!estado.concluidas.includes(id)) {
            estado.concluidas.push(id)
        }
    }

    const avancarEtapa = () => {
        if (!etapaAtual.value) return

        const proximoIndice = indiceAtual.value + 1
        if (proximoIndice < etapas.length) {
            estado.etapaAtualId = etapas[proximoIndice].id
        } else {
            estado.etapaAtualId = 'resumo'
            if (!estado.finalizadoEm) {
                estado.finalizadoEm = Date.now()
            }
        }
    }

    const voltarEtapa = () => {
        if (estaNoResumo.value) {
            estado.etapaAtualId = etapas[etapas.length - 1].id
            return
        }

        if (!etapaAtual.value) return

        if (indiceNaSecao.value === 0) {
            estado.etapaAtualId = 'inicio'
            return
        }

        estado.etapaAtualId = etapasDaSecaoAtual.value[indiceNaSecao.value - 1].id
    }

    const reiniciarPratica = () => {
        const novo = criarEstadoInicial()
        estado.etapaAtualId = novo.etapaAtualId
        estado.concluidas = novo.concluidas
        estado.tentativasPorEtapa = novo.tentativasPorEtapa
        estado.iniciadoEm = novo.iniciadoEm
        estado.finalizadoEm = novo.finalizadoEm
        estado.recordeCliques = novo.recordeCliques
        estado.metricasDigitacao = novo.metricasDigitacao

        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(STORAGE_KEY)
        }
    }

    const precisaoMediaDigitacao = computed(() => {
        const valores = Object.values(estado.metricasDigitacao)
        if (valores.length === 0) return null

        const soma = valores.reduce((acc, item) => acc + (item.precisao ?? 0), 0)
        return Math.round(soma / valores.length)
    })

    const tempoTotalSegundos = computed(() => {
        const fim = estado.finalizadoEm || Date.now()
        return Math.max(0, Math.floor((fim - estado.iniciadoEm) / 1000))
    })

    return {
        estado,
        etapas,
        minimoTentativas,
        etapasMouse,
        etapasTeclado,
        etapaAtual,
        etapasDaSecaoAtual,
        indiceAtual,
        indiceNaSecao,
        estaNoInicio,
        estaNoResumo,
        concluidasMouse,
        concluidasTeclado,
        totalConcluidas,
        proximaEtapaMouse,
        proximaEtapaTeclado,
        precisaoMediaDigitacao,
        tempoTotalSegundos,
        etapaEstaConcluida,
        obterTentativas,
        irParaInicio,
        irParaEtapa,
        registrarTentativa,
        concluirEtapa,
        avancarEtapa,
        voltarEtapa,
        reiniciarPratica,
    }
}