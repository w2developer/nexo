<script setup>
    import { ref, computed, onMounted, onUnmounted } from 'vue';
    import { useRouter } from 'vue-router';
    import { supabase, sincronizarRealtimeAuth } from '@/lib/supabase';
    import {
        Trophy,
        CheckCircle2,
        Clock,
        AlertCircle,
        ChevronRight,
        GraduationCap,
        Award,
        Loader2
    } from '@lucide/vue';
    import { toast } from '@/composables/useToast';
    import { useAlunoSessao } from '@/modules/aluno/composables/useAlunoSessao';

    import Card from '@/components/ui/Card.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Button from '@/components/ui/Button.vue';
    import RankingCard from './components/RankingCard.vue';

    const router = useRouter();
    const { alunoId, primeiroNome, carregarSessaoAluno } = useAlunoSessao();

    const carregando = ref(true);
    const erroCarregamento = ref('');
    const rankingVersao = ref(0);

    const matriculasBrutas = ref([]);
    const cursosMatriculados = ref([]);
    const cursoModulos = ref([]);
    const atividades = ref([]);
    const historicoAluno = ref([]);

    let realtimeChannel = null;
    let realtimeTimer = null;

    const pontosTotais = computed(() => {
        return historicoAluno.value.reduce((soma, reg) => {
            if (reg.status === 'concluida') {
                return soma + (Number(reg.pontos_ganhos) || 0);
            }
            return soma;
        }, 0);
    });

    const mapaAtividades = computed(() => {
        const mapa = new Map();
        atividades.value.forEach(ati => {
            mapa.set(ati.id, ati);
        });
        return mapa;
    });

    const mapaMatriculaCurso = computed(() => {
        const mapa = new Map();
        matriculasBrutas.value.forEach(mat => {
            if (mat.id && mat.curso_id) {
                mapa.set(mat.id, mat.curso_id);
            }
        });
        return mapa;
    });

    const mapaModuloParaCurso = computed(() => {
        const mapa = new Map();
        const ordemCursos = new Map();
        cursosMatriculados.value.forEach((c, idx) => ordemCursos.set(c.curso_id, idx));

        const relacoesOrdenadas = [...cursoModulos.value].sort((a, b) => {
            const posA = ordemCursos.has(a.curso_id) ? ordemCursos.get(a.curso_id) : 9999;
            const posB = ordemCursos.has(b.curso_id) ? ordemCursos.get(b.curso_id) : 9999;
            return posA - posB;
        });

        relacoesOrdenadas.forEach(rel => {
            if (rel.modulo_id && !mapa.has(rel.modulo_id)) {
                mapa.set(rel.modulo_id, rel.curso_id);
            }
        });

        return mapa;
    });

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
            const solicitacaoAberta = registros.find(r => r.status === 'solicitada') || null;
            const maisRecente = ordenadosRecente[0] || null;
            const recusaRecente = !solicitacaoAberta && maisRecente?.status === 'recusada'
                ? maisRecente
                : null;

            resumo.set(atividadeId, {
                concluida,
                aguardando: Boolean(solicitacaoAberta),
                ajustar: Boolean(recusaRecente),
                solicitacaoAberta,
                recusaRecente
            });
        });

        return resumo;
    });

    const totalConcluidasUnicas = computed(() => {
        let total = 0;
        mapaEstadoPorAtividade.value.forEach(est => {
            if (est.concluida) total += 1;
        });
        return total;
    });

    const pendenciasAtividades = computed(() => {
        const itens = [];

        mapaEstadoPorAtividade.value.forEach((est, atividadeId) => {
            if (!est.ajustar && !est.aguardando) return;

            const atividade = mapaAtividades.value.get(atividadeId);
            if (!atividade || !atividade.modulo_id) return;

            const registro = est.recusaRecente || est.solicitacaoAberta;
            const cursoId =
                (registro?.matricula_id && mapaMatriculaCurso.value.get(registro.matricula_id)) ||
                mapaModuloParaCurso.value.get(atividade.modulo_id);

            if (!cursoId) return;

            const cursoObj = cursosMatriculados.value.find(c => c.curso_id === cursoId);

            itens.push({
                id: atividade.id,
                nome: atividade.nome,
                cursoId,
                cursoNome: cursoObj?.nome || '',
                moduloId: atividade.modulo_id,
                tipo: est.ajustar ? 'ajustar' : 'aguardando',
                observacao: est.recusaRecente?.observacao_professor || '',
                referenciaTempo: registro?.atualizado_em || registro?.criado_em || ''
            });
        });

        return itens.sort((a, b) => {
            if (a.tipo !== b.tipo) return a.tipo === 'ajustar' ? -1 : 1;
            return b.referenciaTempo.localeCompare(a.referenciaTempo);
        });
    });

    const certificadosProntos = computed(() => {
        return matriculasBrutas.value.filter(
            m => m.situacao === 'concluido' && m.situacao_certificado === 'emitido' && m.curso?.nome
        );
    });

    const cursosComProgresso = computed(() => {
        const atividadesPorModulo = new Map();
        atividades.value.forEach(ati => {
            if (!ati.modulo_id) return;
            if (!atividadesPorModulo.has(ati.modulo_id)) {
                atividadesPorModulo.set(ati.modulo_id, []);
            }
            atividadesPorModulo.get(ati.modulo_id).push(ati.id);
        });

        return cursosMatriculados.value.map(curso => {
            const modulosDoCurso = cursoModulos.value.filter(cm => cm.curso_id === curso.curso_id);
            const idsAtividades = new Set();

            modulosDoCurso.forEach(cm => {
                (atividadesPorModulo.get(cm.modulo_id) || []).forEach(id => idsAtividades.add(id));
            });

            const totalAtividades = idsAtividades.size;
            let concluidas = 0;

            idsAtividades.forEach(id => {
                const est = mapaEstadoPorAtividade.value.get(id);
                if (est?.concluida) concluidas += 1;
            });

            const percentual = totalAtividades > 0
                ? Math.round((concluidas / totalAtividades) * 100)
                : 0;

            return {
                ...curso,
                totalAtividades,
                concluidas,
                percentual
            };
        });
    });

    const cursosEmAndamento = computed(() => {
        return cursosComProgresso.value.filter(c => c.situacao === 'cursando');
    });

    const cursosExibidosPainel = computed(() => {
        const base = cursosEmAndamento.value.length > 0
            ? cursosEmAndamento.value
            : cursosComProgresso.value;

        return base.slice(0, 4);
    });

    const temMaisCursos = computed(() => {
        return cursosComProgresso.value.length > cursosExibidosPainel.value.length;
    });

    const tituloSecaoCursos = computed(() => {
        return cursosEmAndamento.value.length > 0 ? 'Em andamento' : 'Seus cursos';
    });

    const abrirAtividade = (item) => {
        router.push(`/aluno/atividades/${item.cursoId}/${item.moduloId}/${item.id}`);
    };

    const abrirCurso = (cursoId) => {
        router.push(`/aluno/atividades/${cursoId}`);
    };

    const carregarHistoricoAluno = async () => {
        if (!alunoId.value) return;

        const { data, error } = await supabase
            .from('aluno_atividade')
            .select(
                'id, atividade_id, matricula_id, status, pontos_ganhos, observacao_professor, solicitada_em, criado_em, atualizado_em'
            )
            .eq('aluno_id', alunoId.value);

        if (error) throw error;
        historicoAluno.value = data || [];
    };

    const carregarDados = async () => {
        carregando.value = true;
        erroCarregamento.value = '';

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
                    .select('id, curso_id, situacao, situacao_certificado, curso:curso_id ( id, nome )')
                    .eq('aluno_id', alunoId.value)
                    .in('situacao', ['cursando', 'concluido'])
                    .order('id', { ascending: false }),
                supabase
                    .from('aluno_atividade')
                    .select(
                        'id, atividade_id, matricula_id, status, pontos_ganhos, observacao_professor, solicitada_em, criado_em, atualizado_em'
                    )
                    .eq('aluno_id', alunoId.value)
            ]);

            if (resMatriculas.error) throw resMatriculas.error;
            if (resHistorico.error) throw resHistorico.error;

            matriculasBrutas.value = resMatriculas.data || [];
            historicoAluno.value = resHistorico.data || [];

            const mapaCursos = new Map();
            matriculasBrutas.value.forEach(mat => {
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
                return;
            }

            const { data: dadosCM, error: erroCM } = await supabase
                .from('curso_modulo')
                .select('curso_id, modulo_id')
                .in('curso_id', idsCursos);

            if (erroCM) throw erroCM;
            cursoModulos.value = dadosCM || [];

            const idsModulos = [...new Set(cursoModulos.value.map(cm => cm.modulo_id).filter(Boolean))];

            if (idsModulos.length > 0) {
                const { data: dadosAti, error: erroAti } = await supabase
                    .from('atividade')
                    .select('id, modulo_id, nome')
                    .in('modulo_id', idsModulos);

                if (erroAti) throw erroAti;
                atividades.value = dadosAti || [];
            } else {
                atividades.value = [];
            }
        } catch (err) {
            console.error('Erro ao carregar painel do aluno:', err);
            erroCarregamento.value = 'Não foi possível carregar o seu painel.';
            toast.error('Erro', 'Não foi possível carregar o painel.');
        } finally {
            carregando.value = false;
        }
    };

    const agendarAtualizacaoRealtime = () => {
        clearTimeout(realtimeTimer);
        realtimeTimer = setTimeout(() => {
            carregarHistoricoAluno().catch(err =>
                console.error('Erro ao sincronizar painel em tempo real:', err)
            );
            rankingVersao.value += 1;
        }, 250);
    };

    onMounted(async () => {
        carregarSessaoAluno();
        await carregarDados();

        if (alunoId.value) {
            sincronizarRealtimeAuth();

            realtimeChannel = supabase
                .channel(`aluno_painel_${alunoId.value}`)
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
    <div class="space-y-6">
        <!-- Topo unico e enxuto -->
        <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
                <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                    Olá, {{ primeiroNome }}
                </h1>
                <p v-if="!carregando && !erroCarregamento" class="text-xs sm:text-sm text-muted-foreground mt-0.5 tabular-nums">
                    {{ totalConcluidasUnicas }}
                    {{ totalConcluidasUnicas === 1 ? 'atividade concluída' : 'atividades concluídas' }}
                </p>
            </div>

            <div
                v-if="!carregando && !erroCarregamento"
                class="flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 shrink-0"
            >
                <Trophy class="w-4 h-4 text-amber-500 shrink-0" />
                <span class="text-sm font-bold text-foreground tabular-nums">
                    {{ pontosTotais }}
                </span>
                <span class="text-[11px] font-medium text-muted-foreground">pts</span>
            </div>
        </div>

        <!-- Carregando -->
        <Card v-if="carregando">
            <CardContent class="p-10 text-center space-y-2 text-muted-foreground">
                <Loader2 class="w-6 h-6 mx-auto animate-spin text-primary" />
                <p class="text-sm">Carregando...</p>
            </CardContent>
        </Card>

        <!-- Erro -->
        <Card v-else-if="erroCarregamento">
            <CardContent class="p-10 text-center space-y-3">
                <AlertCircle class="w-8 h-8 mx-auto text-rose-500" />
                <p class="text-sm font-medium text-foreground">{{ erroCarregamento }}</p>
                <Button size="sm" variant="outline" @click="carregarDados()">
                    Tentar novamente
                </Button>
            </CardContent>
        </Card>

        <!-- Corpo principal em 2 colunas no PC / empilhado no celular -->
        <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <!-- Coluna Principal: Certificados, Atencao e Cursos -->
            <div class="lg:col-span-8 space-y-6">
                <!-- Certificado pronto para retirada (se existir) -->
                <div
                    v-if="certificadosProntos.length > 0"
                    class="rounded-xl border border-indigo-500/25 bg-indigo-500/8 p-3.5 sm:p-4 flex items-start gap-3"
                >
                    <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shrink-0">
                        <Award class="w-5 h-5" />
                    </div>
                    <div class="min-w-0">
                        <p class="text-sm font-semibold text-foreground">
                            {{
                                certificadosProntos.length === 1
                                    ? 'Certificado pronto para retirada'
                                    : `${certificadosProntos.length} certificados prontos para retirada`
                            }}
                        </p>
                        <p class="text-xs text-muted-foreground mt-0.5 truncate">
                            {{ certificadosProntos.map(c => c.curso.nome).join(' · ') }}
                        </p>
                    </div>
                </div>

                <!-- Atividades que precisam de ajuste ou aguardam confirmacao -->
                <section v-if="pendenciasAtividades.length > 0" class="space-y-2.5">
                    <h2 class="text-sm font-semibold text-foreground">
                        Atenção
                    </h2>

                    <Card class="overflow-hidden">
                        <div class="divide-y divide-border">
                            <button
                                v-for="item in pendenciasAtividades"
                                :key="item.id"
                                type="button"
                                @click="abrirAtividade(item)"
                                class="group w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-muted/40 transition-colors cursor-pointer"
                            >
                                <div
                                    class="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                                    :class="
                                        item.tipo === 'ajustar'
                                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                    "
                                >
                                    <AlertCircle v-if="item.tipo === 'ajustar'" class="w-4 h-4" />
                                    <Clock v-else class="w-4 h-4" />
                                </div>

                                <div class="min-w-0 flex-1">
                                    <p class="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                        {{ item.nome }}
                                    </p>
                                    <p class="text-xs text-muted-foreground truncate mt-0.5">
                                        <template v-if="item.tipo === 'ajustar' && item.observacao">
                                            {{ item.observacao }}
                                        </template>
                                        <template v-else>
                                            {{ item.cursoNome }}
                                        </template>
                                    </p>
                                </div>

                                <div class="flex items-center gap-2 shrink-0">
                                    <span
                                        class="text-xs font-medium"
                                        :class="
                                            item.tipo === 'ajustar'
                                                ? 'text-rose-600 dark:text-rose-400'
                                                : 'text-amber-700 dark:text-amber-400'
                                        "
                                    >
                                        {{ item.tipo === 'ajustar' ? 'Ajustar' : 'Aguardando' }}
                                    </span>
                                    <ChevronRight class="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                                </div>
                            </button>
                        </div>
                    </Card>
                </section>

                <!-- Cursos em andamento -->
                <section class="space-y-2.5">
                    <div class="flex items-center justify-between gap-2">
                        <h2 class="text-sm font-semibold text-foreground">
                            {{ tituloSecaoCursos }}
                        </h2>

                        <button
                            v-if="temMaisCursos"
                            type="button"
                            @click="router.push('/aluno/atividades')"
                            class="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                        >
                            <span>Ver todos ({{ cursosComProgresso.length }})</span>
                            <ChevronRight class="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <Card v-if="cursosExibidosPainel.length === 0">
                        <CardContent class="p-8 text-center space-y-2 text-muted-foreground">
                            <GraduationCap class="w-8 h-8 mx-auto text-muted-foreground/40" />
                            <p class="text-sm font-medium text-foreground">Nenhum curso disponível.</p>
                        </CardContent>
                    </Card>

                    <div
                        v-else
                        class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"
                    >
                        <button
                            v-for="curso in cursosExibidosPainel"
                            :key="curso.curso_id"
                            type="button"
                            @click="abrirCurso(curso.curso_id)"
                            class="group flex flex-col rounded-xl border border-border bg-card p-4 text-left shadow-xs transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99] cursor-pointer"
                        >
                            <div class="flex items-start justify-between gap-3 w-full min-h-[44px]">
                                <div class="flex items-start gap-3 min-w-0">
                                    <div
                                        class="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                                        :class="
                                            curso.totalAtividades > 0 && curso.percentual === 100
                                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                                : 'bg-primary/10 text-primary'
                                        "
                                    >
                                        <CheckCircle2
                                            v-if="curso.totalAtividades > 0 && curso.percentual === 100"
                                            class="w-4 h-4"
                                        />
                                        <GraduationCap v-else class="w-4 h-4" />
                                    </div>

                                    <div class="min-w-0">
                                        <h3 class="font-bold text-sm sm:text-[15px] text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                            {{ curso.nome }}
                                        </h3>
                                    </div>
                                </div>

                                <ChevronRight class="w-4 h-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                            </div>

                            <div class="mt-4 pt-3 border-t border-border/70 space-y-2 w-full">
                                <div class="flex items-center justify-between text-xs">
                                    <span class="text-muted-foreground tabular-nums">
                                        {{ curso.concluidas }}/{{ curso.totalAtividades }} atividades
                                    </span>
                                    <span class="font-bold text-foreground tabular-nums">
                                        {{ curso.percentual }}%
                                    </span>
                                </div>

                                <div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                    <div
                                        class="h-full rounded-full transition-all duration-300"
                                        :class="
                                            curso.totalAtividades > 0 && curso.percentual === 100
                                                ? 'bg-emerald-500'
                                                : 'bg-primary'
                                        "
                                        :style="{ width: `${curso.percentual}%` }"
                                    ></div>
                                </div>
                            </div>
                        </button>
                    </div>
                </section>
            </div>

            <!-- Coluna Lateral: Ranking (largura compacta no PC / empilhado abaixo no celular) -->
            <section class="lg:col-span-4 space-y-2.5">
                <h2 class="text-sm font-semibold text-foreground">
                    Ranking
                </h2>

                <RankingCard :atualizacao-key="rankingVersao" :limite="5" />
            </section>
        </div>
    </div>
</template>