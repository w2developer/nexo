<script setup>
    import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
    import { useRouter, useRoute } from 'vue-router';
    import { supabase, sincronizarRealtimeAuth } from '@/lib/supabase';
    import {
        Trophy,
        CheckCircle2,
        Clock,
        AlertCircle,
        ChevronRight,
        Search,
        Loader2,
        BookOpen
    } from '@lucide/vue';
    import { toast } from '@/composables/useToast';
    import { useAlunoSessao } from '../composables/useAlunoSessao';

    import Card from '@/components/ui/Card.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Button from '@/components/ui/Button.vue';
    import Input from '@/components/ui/Input.vue';

    const router = useRouter();
    const route = useRoute();
    const { alunoId, carregarSessaoAluno } = useAlunoSessao();

    const carregando = ref(true);
    const erroCarregamento = ref('');
    const cursosMatriculados = ref([]);
    const cursoModulos = ref([]);
    const atividades = ref([]);
    const historicoAluno = ref([]);

    const cursoSelecionadoId = ref(null);
    const termoPesquisa = ref('');

    let realtimeChannel = null;
    let realtimeTimer = null;

    const ordenarPorOrdemENome = (lista, campoOrdem = 'ordem', campoNome = 'nome') => {
        return [...lista].sort((a, b) => {
            const ordemA = Number(a[campoOrdem]) > 0 ? Number(a[campoOrdem]) : Number.MAX_SAFE_INTEGER;
            const ordemB = Number(b[campoOrdem]) > 0 ? Number(b[campoOrdem]) : Number.MAX_SAFE_INTEGER;
            if (ordemA !== ordemB) return ordemA - ordemB;
            return (a[campoNome] || '').localeCompare(b[campoNome] || '', 'pt-BR');
        });
    };

    const pontosTotais = computed(() => {
        return historicoAluno.value.reduce((soma, reg) => {
            if (reg.status === 'concluida') {
                return soma + (Number(reg.pontos_ganhos) || 0);
            }
            return soma;
        }, 0);
    });

    const cursoAtual = computed(() => {
        return cursosMatriculados.value.find(c => c.curso_id === cursoSelecionadoId.value) || null;
    });

    // Consolida status por atividade_id para calcular progresso real de cada modulo
    const mapaEstadoPorAtividade = computed(() => {
        const agrupado = new Map();

        historicoAluno.value.forEach(reg => {
            if (!agrupado.has(reg.atividade_id)) {
                agrupado.set(reg.atividade_id, []);
            }
            agrupado.get(reg.atividade_id).push(reg);
        });

        const resumo = new Map();

        agrupado.forEach((registros, atividadeId) => {
            const ordenadosRecente = [...registros].sort((a, b) => {
                const dataB = b.atualizado_em || b.criado_em || '';
                const dataA = a.atualizado_em || a.criado_em || '';
                return dataB.localeCompare(dataA);
            });

            const concluida = registros.some(r => r.status === 'concluida');
            const aguardando = registros.some(r => r.status === 'solicitada');
            const maisRecente = ordenadosRecente[0] || null;
            const ajustar = !aguardando && maisRecente?.status === 'recusada';

            resumo.set(atividadeId, { concluida, aguardando, ajustar });
        });

        return resumo;
    });

    const modulosDoCursoAtual = computed(() => {
        if (!cursoSelecionadoId.value) return [];

        const relacoes = cursoModulos.value
            .filter(rel => rel.curso_id === cursoSelecionadoId.value && rel.modulo)
            .map(rel => ({
                id: rel.modulo.id,
                nome: rel.modulo.nome,
                ordem: rel.ordem || 0
            }));

        const modulosOrdenados = ordenarPorOrdemENome(relacoes, 'ordem', 'nome');

        const atividadesPorModulo = new Map();
        atividades.value.forEach(ati => {
            if (!ati.modulo_id) return;
            if (!atividadesPorModulo.has(ati.modulo_id)) {
                atividadesPorModulo.set(ati.modulo_id, []);
            }
            atividadesPorModulo.get(ati.modulo_id).push(ati);
        });

        return modulosOrdenados
            .map(mod => {
                const listaAtividades = atividadesPorModulo.get(mod.id) || [];
                const total = listaAtividades.length;
                let concluidas = 0;
                let aguardando = 0;
                let ajustar = 0;

                listaAtividades.forEach(ati => {
                    const est = mapaEstadoPorAtividade.value.get(ati.id);
                    if (!est) return;
                    if (est.concluida) concluidas += 1;
                    if (est.aguardando) aguardando += 1;
                    if (est.ajustar) ajustar += 1;
                });

                const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;

                return {
                    ...mod,
                    total,
                    concluidas,
                    aguardando,
                    ajustar,
                    percentual
                };
            })
            .filter(mod => mod.total > 0);
    });

    const resumoCursoAtual = computed(() => {
        const total = modulosDoCursoAtual.value.reduce((acc, m) => acc + m.total, 0);
        const concluidas = modulosDoCursoAtual.value.reduce((acc, m) => acc + m.concluidas, 0);
        const aguardando = modulosDoCursoAtual.value.reduce((acc, m) => acc + m.aguardando, 0);
        const ajustar = modulosDoCursoAtual.value.reduce((acc, m) => acc + m.ajustar, 0);
        const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;

        return { total, concluidas, aguardando, ajustar, percentual };
    });

    const modulosFiltrados = computed(() => {
        const termo = termoPesquisa.value.toLowerCase().trim();
        if (!termo) return modulosDoCursoAtual.value;

        return modulosDoCursoAtual.value.filter(mod =>
            mod.nome.toLowerCase().includes(termo)
        );
    });

    const selecionarCurso = (cursoId) => {
        cursoSelecionadoId.value = cursoId;
        termoPesquisa.value = '';
        if (String(route.query.curso || '') !== String(cursoId)) {
            router.replace({ query: { ...route.query, curso: String(cursoId) } });
        }
    };

    const abrirModulo = (moduloId) => {
        if (!cursoSelecionadoId.value) return;
        router.push(`/aluno/atividades/${cursoSelecionadoId.value}/${moduloId}`);
    };

    const carregarHistoricoAluno = async () => {
        if (!alunoId.value) return;

        const { data, error } = await supabase
            .from('aluno_atividade')
            .select('id, atividade_id, status, pontos_ganhos, criado_em, atualizado_em')
            .eq('aluno_id', alunoId.value);

        if (error) throw error;
        historicoAluno.value = data || [];
    };

    const carregarDados = async (silencioso = false) => {
        if (!silencioso) {
            carregando.value = true;
            erroCarregamento.value = '';
        }

        try {
            if (!alunoId.value) {
                carregarSessaoAluno();
            }

            if (!alunoId.value) {
                erroCarregamento.value = 'Sessão do aluno não identificada. Faça login novamente.';
                return;
            }

            const [resMatriculas, resHistorico] = await Promise.all([
                supabase
                    .from('matricula')
                    .select('id, curso_id, situacao, curso:curso_id ( id, nome )')
                    .eq('aluno_id', alunoId.value)
                    .in('situacao', ['cursando', 'concluido'])
                    .order('id', { ascending: false }),
                supabase
                    .from('aluno_atividade')
                    .select('id, atividade_id, status, pontos_ganhos, criado_em, atualizado_em')
                    .eq('aluno_id', alunoId.value)
            ]);

            if (resMatriculas.error) throw resMatriculas.error;
            if (resHistorico.error) throw resHistorico.error;

            historicoAluno.value = resHistorico.data || [];

            const mapaCursos = new Map();
            (resMatriculas.data || []).forEach(mat => {
                if (!mat.curso_id || !mat.curso) return;
                const existente = mapaCursos.get(mat.curso_id);

                if (!existente || (existente.situacao !== 'cursando' && mat.situacao === 'cursando')) {
                    mapaCursos.set(mat.curso_id, {
                        matricula_id: mat.id,
                        curso_id: mat.curso_id,
                        situacao: mat.situacao,
                        nome: mat.curso.nome
                    });
                }
            });

            cursosMatriculados.value = Array.from(mapaCursos.values()).sort((a, b) => {
                if (a.situacao === 'cursando' && b.situacao !== 'cursando') return -1;
                if (a.situacao !== 'cursando' && b.situacao === 'cursando') return 1;
                return a.nome.localeCompare(b.nome, 'pt-BR');
            });

            const idsCursos = cursosMatriculados.value.map(c => c.curso_id);

            if (idsCursos.length === 0) {
                cursoModulos.value = [];
                atividades.value = [];
                cursoSelecionadoId.value = null;
                return;
            }

            const { data: dadosCursoModulos, error: erroCM } = await supabase
                .from('curso_modulo')
                .select('curso_id, modulo_id, ordem, modulo:modulo_id ( id, nome )')
                .in('curso_id', idsCursos)
                .order('ordem', { ascending: true });

            if (erroCM) throw erroCM;
            cursoModulos.value = dadosCursoModulos || [];

            const idsModulos = [...new Set(cursoModulos.value.map(cm => cm.modulo_id).filter(Boolean))];

            if (idsModulos.length > 0) {
                const { data: dadosAtividades, error: erroAti } = await supabase
                    .from('atividade')
                    .select('id, modulo_id')
                    .in('modulo_id', idsModulos);

                if (erroAti) throw erroAti;
                atividades.value = dadosAtividades || [];
            } else {
                atividades.value = [];
            }

            const cursoQuery = Number(route.query.curso);
            const existeQuery = cursosMatriculados.value.some(c => c.curso_id === cursoQuery);

            if (existeQuery) {
                cursoSelecionadoId.value = cursoQuery;
            } else if (!cursosMatriculados.value.some(c => c.curso_id === cursoSelecionadoId.value)) {
                cursoSelecionadoId.value = cursosMatriculados.value[0].curso_id;
            }
        } catch (err) {
            console.error('Erro ao carregar módulos de atividades:', err);
            erroCarregamento.value = 'Não foi possível carregar seus módulos agora.';
            toast.error('Erro', 'Não foi possível carregar suas atividades.');
        } finally {
            carregando.value = false;
        }
    };

    watch(
        () => route.query.curso,
        (novoCurso) => {
            const id = Number(novoCurso);
            if (id && cursosMatriculados.value.some(c => c.curso_id === id)) {
                cursoSelecionadoId.value = id;
            }
        }
    );

    const agendarAtualizacaoRealtime = () => {
        clearTimeout(realtimeTimer);
        realtimeTimer = setTimeout(() => {
            carregarHistoricoAluno().catch(err =>
                console.error('Erro ao sincronizar histórico em tempo real:', err)
            );
        }, 250);
    };

    onMounted(async () => {
        carregarSessaoAluno();
        await carregarDados();

        if (alunoId.value) {
            sincronizarRealtimeAuth();

            realtimeChannel = supabase
                .channel(`aluno_modulos_${alunoId.value}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'aluno_atividade',
                        filter: `aluno_id=eq.${alunoId.value}`
                    },
                    () => agendarAtualizacaoRealtime()
                )
                .subscribe();
        }
    });

    onUnmounted(() => {
        clearTimeout(realtimeTimer);
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
        }
    });
</script>

<template>
    <div class="space-y-5">
        <!-- Cabecalho do Hub (Mobile empilhado / Desktop equilibrado em 2 colunas) -->
        <Card>
            <CardContent class="p-4 sm:p-5 space-y-4">
                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <h1 class="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                                Atividades
                            </h1>
                            <p class="text-xs sm:text-sm text-muted-foreground mt-0.5">
                                Escolha um módulo para acessar e concluir suas atividades.
                            </p>
                        </div>

                        <!-- Pontos no topo apenas no mobile -->
                        <div class="flex lg:hidden items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 shrink-0">
                            <Trophy class="w-4 h-4 text-amber-500 shrink-0" />
                            <span class="text-sm font-bold text-foreground tabular-nums">
                                {{ pontosTotais }}
                            </span>
                            <span class="text-[11px] font-medium text-muted-foreground">pts</span>
                        </div>
                    </div>

                    <!-- Resumo compacto no Desktop (Progresso + Pontos) -->
                    <div
                        v-if="!carregando && cursoAtual"
                        class="flex flex-col sm:flex-row sm:items-center gap-3 lg:gap-4"
                    >
                        <div
                            v-if="resumoCursoAtual.total > 0"
                            class="flex-1 lg:w-64 rounded-lg border border-border bg-muted/35 px-3.5 py-2.5 space-y-1.5"
                        >
                            <div class="flex items-center justify-between gap-2 text-xs">
                                <span class="font-semibold text-foreground truncate">
                                    {{ cursoAtual.nome }}
                                </span>
                                <span class="font-semibold text-foreground tabular-nums shrink-0">
                                    {{ resumoCursoAtual.concluidas }}/{{ resumoCursoAtual.total }}
                                    <span class="font-normal text-muted-foreground">
                                        ({{ resumoCursoAtual.percentual }}%)
                                    </span>
                                </span>
                            </div>

                            <div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                <div
                                    class="h-full rounded-full transition-all duration-300"
                                    :class="resumoCursoAtual.percentual === 100 ? 'bg-emerald-500' : 'bg-primary'"
                                    :style="{ width: `${resumoCursoAtual.percentual}%` }"
                                ></div>
                            </div>
                        </div>

                        <!-- Pontos no Desktop -->
                        <div class="hidden lg:flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 shrink-0">
                            <Trophy class="w-4 h-4 text-amber-500 shrink-0" />
                            <div class="leading-tight">
                                <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Pontuação
                                </p>
                                <p class="text-sm font-bold text-foreground tabular-nums">
                                    {{ pontosTotais }} pts
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Seletor de Cursos quando o aluno possui mais de 1 curso -->
                <div
                    v-if="cursosMatriculados.length > 1"
                    class="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5 border-t border-border"
                >
                    <button
                        v-for="curso in cursosMatriculados"
                        :key="curso.curso_id"
                        type="button"
                        @click="selecionarCurso(curso.curso_id)"
                        class="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap border transition-colors cursor-pointer shrink-0"
                        :class="
                            cursoSelecionadoId === curso.curso_id
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                        "
                    >
                        <span>{{ curso.nome }}</span>
                        <span v-if="curso.situacao === 'concluido'" class="text-[10px] opacity-80">
                            (Concluído)
                        </span>
                    </button>
                </div>
            </CardContent>
        </Card>

        <!-- Barra da secao de modulos + busca -->
        <div
            v-if="!carregando && modulosDoCursoAtual.length > 0"
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
            <div class="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span>Módulos do curso</span>
                <span class="text-xs font-normal text-muted-foreground">
                    ({{ modulosDoCursoAtual.length }})
                </span>
            </div>

            <div v-if="modulosDoCursoAtual.length > 3" class="relative w-full sm:w-64">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                    v-model="termoPesquisa"
                    placeholder="Filtrar módulo..."
                    class="pl-9 h-9 bg-background text-sm"
                />
            </div>
        </div>

        <!-- Estado: Carregando -->
        <Card v-if="carregando">
            <CardContent class="p-10 text-center space-y-2 text-muted-foreground">
                <Loader2 class="w-6 h-6 mx-auto animate-spin text-primary" />
                <p class="text-sm">Carregando módulos...</p>
            </CardContent>
        </Card>

        <!-- Estado: Erro -->
        <Card v-else-if="erroCarregamento">
            <CardContent class="p-10 text-center space-y-3">
                <AlertCircle class="w-8 h-8 mx-auto text-rose-500" />
                <p class="text-sm font-medium text-foreground">{{ erroCarregamento }}</p>
                <Button size="sm" variant="outline" @click="carregarDados()">
                    Tentar novamente
                </Button>
            </CardContent>
        </Card>

        <!-- Estado: Sem modulos com atividades -->
        <Card v-else-if="modulosDoCursoAtual.length === 0">
            <CardContent class="p-10 text-center space-y-2 text-muted-foreground">
                <BookOpen class="w-9 h-9 mx-auto text-muted-foreground/40" />
                <p class="text-sm font-medium text-foreground">
                    Nenhuma atividade disponível neste curso ainda.
                </p>
                <p class="text-xs text-muted-foreground max-w-sm mx-auto">
                    Assim que o professor cadastrar atividades para os módulos, eles aparecerão aqui.
                </p>
            </CardContent>
        </Card>

        <!-- Estado: Busca sem resultado -->
        <Card v-else-if="modulosFiltrados.length === 0">
            <CardContent class="p-8 text-center space-y-3 text-muted-foreground">
                <p class="text-sm font-medium text-foreground">
                    Nenhum módulo encontrado para "{{ termoPesquisa }}".
                </p>
                <Button size="sm" variant="outline" @click="termoPesquisa = ''">
                    Limpar busca
                </Button>
            </CardContent>
        </Card>

        <!-- Grade de Cards de Modulos (1 col mobile / 2 col tablet / 3 col PC) -->
        <div
            v-else
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
        >
            <button
                v-for="(modulo, index) in modulosFiltrados"
                :key="modulo.id"
                type="button"
                @click="abrirModulo(modulo.id)"
                class="group flex flex-col justify-between rounded-xl border border-border bg-card p-4 text-left shadow-xs transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99] cursor-pointer"
            >
                <!-- Topo do card: ordem + nome + seta -->
                <div class="flex items-start justify-between gap-3">
                    <div class="flex items-start gap-3 min-w-0">
                        <div
                            class="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold shrink-0 tabular-nums"
                            :class="
                                modulo.percentual === 100
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-primary/10 text-primary'
                            "
                        >
                            <CheckCircle2 v-if="modulo.percentual === 100" class="w-4 h-4" />
                            <span v-else>{{ String(modulo.ordem || index + 1).padStart(2, '0') }}</span>
                        </div>

                        <div class="min-w-0">
                            <h2 class="font-bold text-sm sm:text-[15px] text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                {{ modulo.nome }}
                            </h2>
                            <p class="text-xs text-muted-foreground mt-0.5">
                                {{ modulo.total }}
                                {{ modulo.total === 1 ? 'atividade' : 'atividades' }}
                            </p>
                        </div>
                    </div>

                    <ChevronRight class="w-4 h-4 text-muted-foreground/70 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </div>

                <!-- Base do card: barra de progresso e status discreto -->
                <div class="mt-4 pt-3 border-t border-border/70 space-y-2">
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-muted-foreground tabular-nums">
                            {{ modulo.concluidas }} de {{ modulo.total }} concluídas
                        </span>
                        <span class="font-semibold text-foreground tabular-nums">
                            {{ modulo.percentual }}%
                        </span>
                    </div>

                    <div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                            class="h-full rounded-full transition-all duration-300"
                            :class="modulo.percentual === 100 ? 'bg-emerald-500' : 'bg-primary'"
                            :style="{ width: `${modulo.percentual}%` }"
                        ></div>
                    </div>

                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 min-h-[18px]">
                        <span
                            v-if="modulo.ajustar > 0"
                            class="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400"
                        >
                            <AlertCircle class="w-3 h-3 shrink-0" />
                            {{ modulo.ajustar }} para ajustar
                        </span>

                        <span
                            v-if="modulo.aguardando > 0"
                            class="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400"
                        >
                            <Clock class="w-3 h-3 shrink-0" />
                            {{ modulo.aguardando }} aguardando
                        </span>

                        <span
                            v-if="modulo.ajustar === 0 && modulo.aguardando === 0 && modulo.percentual === 100"
                            class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                        >
                            <CheckCircle2 class="w-3 h-3 shrink-0" />
                            Módulo concluído
                        </span>

                        <span
                            v-else-if="modulo.ajustar === 0 && modulo.aguardando === 0"
                            class="text-[11px] text-muted-foreground"
                        >
                            Toque para abrir atividades
                        </span>
                    </div>
                </div>
            </button>
        </div>
    </div>
</template>