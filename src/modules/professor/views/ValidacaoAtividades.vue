<script setup>
    import { ref, computed, onMounted, onUnmounted } from 'vue';
    import { supabase, sincronizarRealtimeAuth } from '@/lib/supabase';
    import {
        Search,
        Check,
        X,
        Clock,
        CheckCircle2,
        Loader2,
        RefreshCw,
        KeyRound,
        Globe,
        MessageSquare,
        RotateCcw
    } from '@lucide/vue';
    import { toast } from '@/composables/useToast';

    import Card from '@/components/ui/Card.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Button from '@/components/ui/Button.vue';
    import Input from '@/components/ui/Input.vue';
    import Select from '@/components/ui/Select.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Modal from '@/components/ui/Modal.vue';

    const PREPOSICOES_NOME = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
    const PRAZO_REVERSAO_MS = 7 * 24 * 60 * 60 * 1000;

    const abaAtiva = ref('pendentes');
    const carregando = ref(true);
    const atualizando = ref(false);
    const processandoId = ref(null);

    const termoPesquisa = ref('');
    const filtroCurso = ref('todos');
    const filtroStatusHistorico = ref('todos');

    const pendentes = ref([]);
    const historico = ref([]);
    const cursos = ref([]);

    // Modal de recusa
    const modalRecusaAberto = ref(false);
    const solicitacaoParaRecusar = ref(null);
    const observacaoRecusa = ref('');
    const recusando = ref(false);

    // Modal de reversao
    const modalReversaoAberto = ref(false);
    const registroParaReverter = ref(null);
    const revertendo = ref(false);

    let realtimeChannel = null;
    let realtimeTimer = null;

    const SELECT_REGISTROS = `
        id,
        aluno_id,
        atividade_id,
        matricula_id,
        tentativa,
        status,
        metodo_validacao,
        validado_por_usuario_id,
        pontos_ganhos,
        observacao_professor,
        solicitada_em,
        concluida_em,
        criado_em,
        atualizado_em,
        aluno:aluno_id ( id, nome, codigo ),
        atividade:atividade_id (
            id,
            nome,
            modulo:modulo_id ( id, nome ),
            dificuldade:dificuldade_id ( id, nome, pontos, ordem )
        ),
        matricula:matricula_id (
            id,
            curso:curso_id ( id, nome )
        ),
        validador:validado_por_usuario_id ( id, nome )
    `;

    const opcoesFiltroCurso = computed(() => [
        { label: 'Todos os cursos', value: 'todos' },
        ...cursos.value.map(c => ({ label: c.nome, value: String(c.id) }))
    ]);

    const opcoesStatusHistorico = [
        { label: 'Todos os status', value: 'todos' },
        { label: 'Concluídas', value: 'concluida' },
        { label: 'Recusadas', value: 'recusada' }
    ];

    const formatarNome = (nome) => {
        if (!nome) return '';

        return nome
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .map((palavra, index) => {
                if (index > 0 && PREPOSICOES_NOME.has(palavra)) {
                    return palavra;
                }
                return palavra.charAt(0).toUpperCase() + palavra.slice(1);
            })
            .join(' ');
    };

    const correspondeAosFiltros = (item) => {
        if (filtroCurso.value !== 'todos') {
            const cursoId = item.matricula?.curso?.id;
            if (String(cursoId) !== filtroCurso.value) {
                return false;
            }
        }

        const termo = termoPesquisa.value.toLowerCase().trim();
        if (!termo) return true;

        const campos = [
            item.aluno?.nome,
            item.aluno?.codigo,
            item.atividade?.nome,
            item.atividade?.modulo?.nome,
            item.matricula?.curso?.nome,
            item.validador?.nome
        ];

        return campos.some(valor => valor && valor.toLowerCase().includes(termo));
    };

    const pendentesFiltrados = computed(() => {
        return pendentes.value.filter(correspondeAosFiltros);
    });

    const historicoFiltrado = computed(() => {
        return historico.value.filter(item => {
            if (
                filtroStatusHistorico.value !== 'todos' &&
                item.status !== filtroStatusHistorico.value
            ) {
                return false;
            }
            return correspondeAosFiltros(item);
        });
    });

    const getEstiloDificuldade = (dificuldade) => {
        if (!dificuldade) {
            return {
                texto: '---',
                classe: 'bg-muted text-muted-foreground border-border'
            };
        }

        const estilosPorOrdem = {
            1: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
            2: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
            3: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
            4: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
        };

        return {
            texto: dificuldade.nome,
            classe: estilosPorOrdem[dificuldade.ordem] || 'bg-muted text-muted-foreground border-border'
        };
    };

    const calcularPontosPrevistos = (item) => {
        const base = Number(item.atividade?.dificuldade?.pontos) || 0;
        if (!base) return 0;
        return item.tentativa > 1 ? Math.ceil(base * 0.5) : base;
    };

    const obterContextoCursoModulo = (item) => {
        const partes = [
            item.matricula?.curso?.nome,
            item.atividade?.modulo?.nome
        ].filter(Boolean);

        return partes.join(' · ') || 'Sem vínculo';
    };

    const obterMotivoBloqueioReversao = (item) => {
        const dataDecisaoIso = item.concluida_em || item.atualizado_em;
        const dataDecisaoMs = dataDecisaoIso ? new Date(dataDecisaoIso).getTime() : NaN;

        if (Number.isNaN(dataDecisaoMs) || Date.now() - dataDecisaoMs > PRAZO_REVERSAO_MS) {
            return 'Prazo de 7 dias para reversão expirado';
        }

        const existePendente = pendentes.value.some(
            p => p.aluno_id === item.aluno_id && p.atividade_id === item.atividade_id
        );
        if (existePendente) {
            return 'Já existe uma nova solicitação pendente para esta atividade';
        }

        const criadoMs = item.criado_em ? new Date(item.criado_em).getTime() : 0;
        const existePosterior = historico.value.some(outro => {
            if (
                outro.id === item.id ||
                outro.aluno_id !== item.aluno_id ||
                outro.atividade_id !== item.atividade_id
            ) {
                return false;
            }

            const outroCriadoMs = outro.criado_em ? new Date(outro.criado_em).getTime() : 0;
            const tentativaPosterior =
                item.status === 'concluida' &&
                outro.status === 'concluida' &&
                outro.tentativa > item.tentativa;

            return outroCriadoMs > criadoMs || tentativaPosterior;
        });

        if (existePosterior) {
            return 'Existe uma tentativa mais recente registrada para esta atividade';
        }

        return null;
    };

    const formatarDataHora = (iso) => {
        if (!iso) return '---';

        const data = new Date(iso);
        if (Number.isNaN(data.getTime())) return '---';

        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(data);
    };

    const formatarTempoRelativo = (iso) => {
        if (!iso) return '---';

        const data = new Date(iso);
        if (Number.isNaN(data.getTime())) return '---';

        const diffMin = Math.floor((Date.now() - data.getTime()) / 60000);

        if (diffMin < 1) return 'Agora mesmo';
        if (diffMin < 60) return `Há ${diffMin} min`;

        const diffHoras = Math.floor(diffMin / 60);
        if (diffHoras < 24) return `Há ${diffHoras} h`;

        return formatarDataHora(iso);
    };

    // ========================================================
    // CARREGAMENTO DE DADOS
    // ========================================================

    const carregarCursos = async () => {
        const { data, error } = await supabase
            .from('curso')
            .select('id, nome')
            .order('nome', { ascending: true });

        if (error) throw error;
        cursos.value = data || [];
    };

    const carregarRegistros = async (silencioso = false) => {
        if (!silencioso) {
            carregando.value = true;
        } else {
            atualizando.value = true;
        }

        try {
            const [resPendentes, resHistorico] = await Promise.all([
                supabase
                    .from('aluno_atividade')
                    .select(SELECT_REGISTROS)
                    .eq('status', 'solicitada')
                    .order('solicitada_em', { ascending: true, nullsFirst: false })
                    .order('criado_em', { ascending: true }),
                supabase
                    .from('aluno_atividade')
                    .select(SELECT_REGISTROS)
                    .in('status', ['concluida', 'recusada'])
                    .order('atualizado_em', { ascending: false })
                    .limit(100)
            ]);

            if (resPendentes.error) throw resPendentes.error;
            if (resHistorico.error) throw resHistorico.error;

            pendentes.value = resPendentes.data || [];
            historico.value = resHistorico.data || [];
        } catch (err) {
            console.error('Erro ao carregar validações de atividades:', err);
            toast.error('Erro', 'Não foi possível carregar as solicitações de atividades.');
        } finally {
            carregando.value = false;
            atualizando.value = false;
        }
    };

    const agendarRecarregamentoRealtime = () => {
        clearTimeout(realtimeTimer);
        realtimeTimer = setTimeout(() => {
            carregarRegistros(true);
        }, 250);
    };

    // ========================================================
    // ACOES DO PROFESSOR (VIA RPC SEGURA)
    // ========================================================

    const aprovarSolicitacao = async (item) => {
        if (processandoId.value) return;

        processandoId.value = item.id;
        try {
            const { data, error } = await supabase.rpc('responder_solicitacao_atividade', {
                p_progresso_id: item.id,
                p_aprovar: true,
                p_observacao: null
            });

            if (error) throw error;

            const pontosCreditados = data?.pontos_ganhos ?? calcularPontosPrevistos(item);
            toast.success(
                'Atividade confirmada',
                `${formatarNome(item.aluno?.nome) || 'Aluno'} recebeu +${pontosCreditados} pts.`
            );

            await carregarRegistros(true);
        } catch (err) {
            console.error('Erro ao aprovar solicitação:', err);
            toast.error('Erro', err?.message || 'Não foi possível confirmar a atividade.');
        } finally {
            processandoId.value = null;
        }
    };

    const abrirModalRecusa = (item) => {
        solicitacaoParaRecusar.value = item;
        observacaoRecusa.value = '';
        modalRecusaAberto.value = true;
    };

    const confirmarRecusa = async () => {
        if (!solicitacaoParaRecusar.value || recusando.value) return;

        recusando.value = true;
        processandoId.value = solicitacaoParaRecusar.value.id;

        try {
            const { error } = await supabase.rpc('responder_solicitacao_atividade', {
                p_progresso_id: solicitacaoParaRecusar.value.id,
                p_aprovar: false,
                p_observacao: observacaoRecusa.value.trim() || null
            });

            if (error) throw error;

            toast.success(
                'Solicitação recusada',
                `A atividade de ${formatarNome(solicitacaoParaRecusar.value.aluno?.nome) || 'aluno'} foi marcada para ajuste.`
            );

            modalRecusaAberto.value = false;
            solicitacaoParaRecusar.value = null;
            observacaoRecusa.value = '';

            await carregarRegistros(true);
        } catch (err) {
            console.error('Erro ao recusar solicitação:', err);
            toast.error('Erro', err?.message || 'Não foi possível recusar a solicitação.');
        } finally {
            recusando.value = false;
            processandoId.value = null;
        }
    };

    const abrirModalReversao = (item) => {
        registroParaReverter.value = item;
        modalReversaoAberto.value = true;
    };

    const confirmarReversao = async () => {
        if (!registroParaReverter.value || revertendo.value) return;

        revertendo.value = true;
        processandoId.value = registroParaReverter.value.id;

        try {
            const { data, error } = await supabase.rpc('reverter_validacao_atividade', {
                p_progresso_id: registroParaReverter.value.id
            });

            if (error) throw error;

            const nomeAluno = formatarNome(registroParaReverter.value.aluno?.nome) || 'Aluno';
            const pontosEstornados = Number(data?.pontos_estornados) || 0;

            if (data?.acao === 'retornada_pendente') {
                const detalhePontos = pontosEstornados > 0
                    ? ` e ${pontosEstornados} pts foram estornados`
                    : '';
                toast.success(
                    'Validação revertida',
                    `A solicitação de ${nomeAluno} voltou para Pendentes${detalhePontos}.`
                );
            } else {
                toast.success(
                    'Conclusão estornada',
                    `A conclusão presencial de ${nomeAluno} foi removida (${pontosEstornados} pts estornados).`
                );
            }

            modalReversaoAberto.value = false;
            registroParaReverter.value = null;

            await carregarRegistros(true);
        } catch (err) {
            console.error('Erro ao reverter validação:', err);
            toast.error('Erro', err?.message || 'Não foi possível reverter esta validação.');
        } finally {
            revertendo.value = false;
            processandoId.value = null;
        }
    };

    onMounted(async () => {
        sincronizarRealtimeAuth();

        await Promise.all([
            carregarCursos().catch(err => console.error('Erro ao carregar cursos:', err)),
            carregarRegistros()
        ]);

        realtimeChannel = supabase
            .channel('validacao_atividades_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'aluno_atividade' },
                () => agendarRecarregamentoRealtime()
            )
            .subscribe();
    });

    onUnmounted(() => {
        clearTimeout(realtimeTimer);
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
        }
    });
</script>

<template>
    <div class="space-y-6">
        <!-- Cabecalho e Abas -->
        <Card>
            <CardContent class="p-4 sm:p-6 space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 class="text-xl font-bold tracking-tight text-foreground">
                            Validação de Atividades
                        </h1>
                        <p class="text-sm text-muted-foreground">
                            Confirme ou recuse solicitações enviadas pelos alunos e acompanhe o histórico de pontuações.
                        </p>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        class="h-9 self-start sm:self-auto bg-background border-border text-foreground hover:bg-muted"
                        :disabled="carregando || atualizando"
                        @click="carregarRegistros(true)"
                    >
                        <RefreshCw class="w-4 h-4 mr-1.5" :class="{ 'animate-spin': atualizando }" />
                        Atualizar
                    </Button>
                </div>

                <div class="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                        :variant="abaAtiva === 'pendentes' ? 'default' : 'outline'"
                        size="sm"
                        class="h-9"
                        @click="abaAtiva = 'pendentes'"
                    >
                        <Clock class="w-4 h-4 mr-1.5" />
                        Pendentes ({{ pendentes.length }})
                    </Button>

                    <Button
                        :variant="abaAtiva === 'historico' ? 'default' : 'outline'"
                        size="sm"
                        class="h-9"
                        @click="abaAtiva = 'historico'"
                    >
                        <CheckCircle2 class="w-4 h-4 mr-1.5" />
                        Histórico ({{ historico.length }})
                    </Button>
                </div>
            </CardContent>
        </Card>

        <!-- Barra de Pesquisa e Filtros -->
        <Card>
            <CardContent class="p-4">
                <div
                    class="grid grid-cols-1 gap-4"
                    :class="abaAtiva === 'historico' ? 'sm:grid-cols-3' : 'sm:grid-cols-2 max-w-2xl'"
                >
                    <FormGroup label="Pesquisar" id="pesquisa-validacao">
                        <div class="relative">
                            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <Input
                                v-model="termoPesquisa"
                                placeholder="Aluno, código, atividade ou módulo..."
                                class="pl-9"
                            />
                        </div>
                    </FormGroup>

                    <FormGroup label="Filtrar por Curso" id="filtro-curso-validacao">
                        <Select
                            v-model="filtroCurso"
                            :options="opcoesFiltroCurso"
                        />
                    </FormGroup>

                    <FormGroup
                        v-if="abaAtiva === 'historico'"
                        label="Status"
                        id="filtro-status-validacao"
                    >
                        <Select
                            v-model="filtroStatusHistorico"
                            :options="opcoesStatusHistorico"
                        />
                    </FormGroup>
                </div>
            </CardContent>
        </Card>

        <!-- Lista Principal -->
        <Card class="min-h-[55dvh] overflow-hidden">
            <div v-if="carregando" class="p-10 text-center text-muted-foreground">
                Carregando solicitações...
            </div>

            <!-- ABA: PENDENTES -->
            <template v-else-if="abaAtiva === 'pendentes'">
                <div
                    v-if="pendentesFiltrados.length === 0"
                    class="p-10 text-center space-y-2 text-muted-foreground"
                >
                    <CheckCircle2 class="w-10 h-10 mx-auto text-muted-foreground/40" />
                    <p class="text-sm font-medium text-foreground">
                        {{
                            termoPesquisa || filtroCurso !== 'todos'
                                ? 'Nenhuma solicitação pendente encontrada para os filtros aplicados.'
                                : 'Nenhuma atividade aguardando validação.'
                        }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                        Novas solicitações dos alunos aparecerão aqui automaticamente.
                    </p>
                </div>

                <div v-else class="flex flex-col">
                    <!-- Cabecalho de Colunas (Desktop) -->
                    <div class="hidden lg:flex items-center gap-4 px-5 py-3 border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground">
                        <div class="w-[26%]">Aluno</div>
                        <div class="flex-1">Atividade</div>
                        <div class="w-40">Pontuação</div>
                        <div class="w-28">Solicitado</div>
                        <div class="w-44 text-right">Ações</div>
                    </div>

                    <div class="divide-y divide-border">
                        <div
                            v-for="item in pendentesFiltrados"
                            :key="item.id"
                            class="px-4 py-3.5 lg:px-5 lg:py-3.5 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 hover:bg-muted/40 transition-colors"
                        >
                            <!-- Coluna 1: Aluno -->
                            <div class="lg:w-[26%] min-w-0">
                                <p class="font-semibold text-sm text-foreground leading-snug truncate">
                                    {{ formatarNome(item.aluno?.nome) || 'Aluno não identificado' }}
                                </p>
                                <div class="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                    <span v-if="item.aluno?.codigo" class="font-mono">
                                        #{{ item.aluno.codigo }}
                                    </span>
                                    <span class="lg:hidden">·</span>
                                    <span
                                        class="lg:hidden"
                                        :title="formatarDataHora(item.solicitada_em || item.criado_em)"
                                    >
                                        {{ formatarTempoRelativo(item.solicitada_em || item.criado_em) }}
                                    </span>
                                </div>
                            </div>

                            <!-- Coluna 2: Atividade e Curso/Modulo -->
                            <div class="flex-1 min-w-0">
                                <p class="font-medium text-sm text-foreground leading-snug truncate">
                                    {{ item.atividade?.nome || 'Atividade removida' }}
                                </p>
                                <p class="text-xs text-muted-foreground mt-0.5 truncate">
                                    {{ obterContextoCursoModulo(item) }}
                                </p>
                            </div>

                            <!-- Coluna 3: Dificuldade (tag nativa unica) + Pontos -->
                            <div class="lg:w-40 flex flex-wrap lg:flex-col items-center lg:items-start gap-x-2.5 gap-y-1 shrink-0">
                                <div class="flex items-center gap-2">
                                    <span
                                        class="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium border leading-none"
                                        :class="getEstiloDificuldade(item.atividade?.dificuldade).classe"
                                    >
                                        {{ getEstiloDificuldade(item.atividade?.dificuldade).texto }}
                                    </span>
                                    <span class="text-xs font-semibold text-foreground tabular-nums">
                                        +{{ calcularPontosPrevistos(item) }} pts
                                    </span>
                                </div>
                                <span
                                    v-if="item.tentativa > 1"
                                    class="text-[11px] text-muted-foreground"
                                >
                                    Revisão #{{ item.tentativa }} (50%)
                                </span>
                            </div>

                            <!-- Coluna 4: Solicitado (Desktop) -->
                            <div
                                class="hidden lg:block w-28 text-xs text-muted-foreground shrink-0"
                                :title="formatarDataHora(item.solicitada_em || item.criado_em)"
                            >
                                {{ formatarTempoRelativo(item.solicitada_em || item.criado_em) }}
                            </div>

                            <!-- Coluna 5: Acoes -->
                            <div class="lg:w-44 flex items-center justify-end gap-2 shrink-0 pt-1 lg:pt-0">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    class="h-8 px-2.5 text-xs border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                                    :disabled="processandoId !== null"
                                    @click="abrirModalRecusa(item)"
                                >
                                    <X class="w-3.5 h-3.5 mr-1" />
                                    Recusar
                                </Button>

                                <Button
                                    size="sm"
                                    variant="default"
                                    class="h-8 px-3 text-xs"
                                    :disabled="processandoId !== null"
                                    @click="aprovarSolicitacao(item)"
                                >
                                    <Loader2
                                        v-if="processandoId === item.id && !recusando"
                                        class="w-3.5 h-3.5 mr-1 animate-spin"
                                    />
                                    <Check v-else class="w-3.5 h-3.5 mr-1" />
                                    {{ processandoId === item.id && !recusando ? 'Salvando...' : 'Confirmar' }}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </template>

            <!-- ABA: HISTORICO -->
            <template v-else>
                <div
                    v-if="historicoFiltrado.length === 0"
                    class="p-10 text-center text-sm text-muted-foreground"
                >
                    {{
                        termoPesquisa || filtroCurso !== 'todos' || filtroStatusHistorico !== 'todos'
                            ? 'Nenhum registro encontrado no histórico para os filtros aplicados.'
                            : 'Nenhuma validação registrada ainda.'
                    }}
                </div>

                <div v-else class="flex flex-col">
                    <!-- Cabecalho de Colunas (Desktop) -->
                    <div class="hidden lg:flex items-center gap-4 px-5 py-3 border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground">
                        <div class="w-[22%]">Aluno</div>
                        <div class="flex-1">Atividade</div>
                        <div class="w-36">Resultado</div>
                        <div class="w-44 text-right">Validação</div>
                        <div class="w-24 text-right">Ações</div>
                    </div>

                    <div class="divide-y divide-border">
                        <div
                            v-for="item in historicoFiltrado"
                            :key="item.id"
                            class="px-4 py-3.5 lg:px-5 lg:py-3.5 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 hover:bg-muted/40 transition-colors"
                        >
                            <!-- Coluna 1: Aluno -->
                            <div class="lg:w-[22%] min-w-0">
                                <p class="font-semibold text-sm text-foreground leading-snug truncate">
                                    {{ formatarNome(item.aluno?.nome) || 'Aluno não identificado' }}
                                </p>
                                <p v-if="item.aluno?.codigo" class="text-xs font-mono text-muted-foreground mt-0.5">
                                    #{{ item.aluno.codigo }}
                                </p>
                            </div>

                            <!-- Coluna 2: Atividade, Curso/Modulo e Observacao -->
                            <div class="flex-1 min-w-0">
                                <p class="font-medium text-sm text-foreground leading-snug truncate">
                                    {{ item.atividade?.nome || 'Atividade removida' }}
                                </p>
                                <p class="text-xs text-muted-foreground mt-0.5 truncate">
                                    {{ obterContextoCursoModulo(item) }}
                                </p>
                                <p
                                    v-if="item.observacao_professor"
                                    class="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground"
                                >
                                    <MessageSquare class="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70" />
                                    <span class="line-clamp-2">{{ item.observacao_professor }}</span>
                                </p>
                            </div>

                            <!-- Coluna 3: Status (tag nativa unica) + Pontos -->
                            <div class="lg:w-36 flex flex-wrap lg:flex-col items-center lg:items-start gap-x-2.5 gap-y-1 shrink-0">
                                <div class="flex items-center gap-2">
                                    <span
                                        class="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium border leading-none"
                                        :class="
                                            item.status === 'concluida'
                                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                                                : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                                        "
                                    >
                                        {{ item.status === 'concluida' ? 'Concluída' : 'Recusada' }}
                                    </span>
                                    <span
                                        v-if="item.status === 'concluida'"
                                        class="text-xs font-semibold text-foreground tabular-nums"
                                    >
                                        +{{ item.pontos_ganhos }} pts
                                    </span>
                                </div>
                                <span
                                    v-if="item.status === 'concluida' && item.tentativa > 1"
                                    class="text-[11px] text-muted-foreground"
                                >
                                    Revisão #{{ item.tentativa }}
                                </span>
                            </div>

                            <!-- Coluna 4: Professor Validador, Metodo e Data -->
                            <div class="lg:w-44 flex flex-row lg:flex-col items-center lg:items-end justify-between gap-1 text-xs text-muted-foreground shrink-0">
                                <span class="font-medium text-foreground truncate max-w-full">
                                    {{ formatarNome(item.validador?.nome) || '---' }}
                                </span>
                                <div class="flex items-center gap-1.5 text-[11px]">
                                    <KeyRound
                                        v-if="item.metodo_validacao === 'codigo_presencial'"
                                        class="w-3 h-3 shrink-0"
                                        title="Validado por código presencial"
                                    />
                                    <Globe
                                        v-else-if="item.metodo_validacao === 'aprovacao_remota'"
                                        class="w-3 h-3 shrink-0"
                                        title="Validado remotamente"
                                    />
                                    <span class="tabular-nums">
                                        {{ formatarDataHora(item.concluida_em || item.atualizado_em) }}
                                    </span>
                                </div>
                            </div>

                            <!-- Coluna 5: Reverter (ate 7 dias) -->
                            <div class="lg:w-24 flex items-center justify-end shrink-0">
                                <Button
                                    v-if="!obterMotivoBloqueioReversao(item)"
                                    size="sm"
                                    variant="outline"
                                    class="h-8 px-2.5 text-xs bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                                    :disabled="processandoId !== null"
                                    title="Reverter validação (disponível por até 7 dias)"
                                    @click="abrirModalReversao(item)"
                                >
                                    <RotateCcw class="w-3.5 h-3.5 mr-1" />
                                    Reverter
                                </Button>
                                <span
                                    v-else
                                    class="text-xs text-muted-foreground/50 select-none px-2"
                                    :title="obterMotivoBloqueioReversao(item)"
                                >
                                    —
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </Card>

        <!-- Modal: Recusar Solicitacao -->
        <Modal
            v-model="modalRecusaAberto"
            title="Recusar Solicitação"
            size="sm"
        >
            <div v-if="solicitacaoParaRecusar" class="space-y-4 p-1">
                <p class="text-sm text-muted-foreground">
                    Recusar a atividade <strong class="text-foreground">{{ solicitacaoParaRecusar.atividade?.nome }}</strong>
                    enviada por <strong class="text-foreground">{{ formatarNome(solicitacaoParaRecusar.aluno?.nome) }}</strong>?
                    O aluno poderá ajustar e solicitar novamente.
                </p>

                <FormGroup label="Observação para o aluno (Opcional)" id="obs-recusa">
                    <textarea
                        id="obs-recusa"
                        v-model="observacaoRecusa"
                        rows="3"
                        placeholder="Ex: Faltou finalizar o gráfico na aba 2..."
                        :disabled="recusando"
                        class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none"
                    ></textarea>
                </FormGroup>
            </div>

            <template #footer>
                <Button variant="ghost" @click="modalRecusaAberto = false" :disabled="recusando">
                    Cancelar
                </Button>
                <Button variant="destructive" @click="confirmarRecusa" :disabled="recusando">
                    <Loader2 v-if="recusando" class="w-4 h-4 mr-1.5 animate-spin" />
                    {{ recusando ? 'Recusando...' : 'Confirmar Recusa' }}
                </Button>
            </template>
        </Modal>

        <!-- Modal: Reverter Validacao -->
        <Modal
            v-model="modalReversaoAberto"
            title="Reverter Validação"
            size="sm"
        >
            <div v-if="registroParaReverter" class="space-y-3 p-1 text-sm text-muted-foreground">
                <template v-if="registroParaReverter.solicitada_em">
                    <p>
                        A solicitação de
                        <strong class="text-foreground">{{ formatarNome(registroParaReverter.aluno?.nome) }}</strong>
                        para
                        <strong class="text-foreground">{{ registroParaReverter.atividade?.nome }}</strong>
                        voltará para a aba <strong class="text-foreground">Pendentes</strong>.
                    </p>
                    <p
                        v-if="registroParaReverter.status === 'concluida' && registroParaReverter.pontos_ganhos > 0"
                        class="text-xs text-rose-600 dark:text-rose-400"
                    >
                        Os +{{ registroParaReverter.pontos_ganhos }} pts creditados nesta atividade serão estornados.
                    </p>
                </template>

                <template v-else>
                    <p>
                        Esta conclusão presencial de
                        <strong class="text-foreground">{{ formatarNome(registroParaReverter.aluno?.nome) }}</strong>
                        em
                        <strong class="text-foreground">{{ registroParaReverter.atividade?.nome }}</strong>
                        será removida do histórico.
                    </p>
                    <p
                        v-if="registroParaReverter.pontos_ganhos > 0"
                        class="text-xs text-rose-600 dark:text-rose-400"
                    >
                        Os +{{ registroParaReverter.pontos_ganhos }} pts creditados nesta atividade serão estornados.
                    </p>
                </template>
            </div>

            <template #footer>
                <Button variant="ghost" @click="modalReversaoAberto = false" :disabled="revertendo">
                    Cancelar
                </Button>
                <Button variant="destructive" @click="confirmarReversao" :disabled="revertendo">
                    <Loader2 v-if="revertendo" class="w-4 h-4 mr-1.5 animate-spin" />
                    {{ revertendo ? 'Revertendo...' : 'Confirmar Reversão' }}
                </Button>
            </template>
        </Modal>
    </div>
</template>