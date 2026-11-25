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
        Search,
        Loader2,
        GraduationCap
    } from '@lucide/vue';
    import { toast } from '@/composables/useToast';
    import { useAlunoSessao } from '../composables/useAlunoSessao';

    import Card from '@/components/ui/Card.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Button from '@/components/ui/Button.vue';
    import Input from '@/components/ui/Input.vue';

    const router = useRouter();
    const { alunoId, carregarSessaoAluno } = useAlunoSessao();

    const carregando = ref(true);
    const erroCarregamento = ref('');
    const cursosMatriculados = ref([]);
    const cursoModulos = ref([]);
    const atividades = ref([]);
    const historicoAluno = ref([]);
    const termoPesquisa = ref('');

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
            let totalModulosComAtividades = 0;

            modulosDoCurso.forEach(cm => {
                const listaIds = atividadesPorModulo.get(cm.modulo_id) || [];
                if (listaIds.length > 0) {
                    totalModulosComAtividades += 1;
                    listaIds.forEach(id => idsAtividades.add(id));
                }
            });

            const totalAtividades = idsAtividades.size;
            let concluidas = 0;
            let aguardando = 0;
            let ajustar = 0;

            idsAtividades.forEach(id => {
                const est = mapaEstadoPorAtividade.value.get(id);
                if (!est) return;
                if (est.concluida) concluidas += 1;
                if (est.aguardando) aguardando += 1;
                if (est.ajustar) ajustar += 1;
            });

            const percentual = totalAtividades > 0
                ? Math.round((concluidas / totalAtividades) * 100)
                : 0;

            return {
                ...curso,
                totalModulos: totalModulosComAtividades,
                totalAtividades,
                concluidas,
                aguardando,
                ajustar,
                percentual
            };
        });
    });

    const cursosFiltrados = computed(() => {
        const termo = termoPesquisa.value.toLowerCase().trim();
        if (!termo) return cursosComProgresso.value;

        return cursosComProgresso.value.filter(c =>
            c.nome.toLowerCase().includes(termo)
        );
    });

    const abrirCurso = (cursoId) => {
        router.push(`/aluno/atividades/${cursoId}`);
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

            // Deduplica cursos priorizando matricula em andamento
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
                    .select('id, modulo_id')
                    .in('modulo_id', idsModulos);

                if (erroAti) throw erroAti;
                atividades.value = dadosAti || [];
            } else {
                atividades.value = [];
            }
        } catch (err) {
            console.error('Erro ao carregar cursos do aluno:', err);
            erroCarregamento.value = 'Não foi possível carregar seus cursos.';
            toast.error('Erro', 'Não foi possível carregar seus cursos.');
        } finally {
            carregando.value = false;
        }
    };

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
                .channel(`aluno_cursos_${alunoId.value}`)
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
        <!-- Topo limpo: Titulo + Pontuacao -->
        <div class="flex items-center justify-between gap-3">
            <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Atividades
            </h1>

            <div class="flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 shrink-0">
                <Trophy class="w-4 h-4 text-amber-500 shrink-0" />
                <span class="text-sm font-bold text-foreground tabular-nums">
                    {{ pontosTotais }}
                </span>
                <span class="text-[11px] font-medium text-muted-foreground">pts</span>
            </div>
        </div>

        <!-- Busca exibida apenas quando houver muitos cursos -->
        <div v-if="!carregando && cursosComProgresso.length > 4" class="relative w-full sm:max-w-xs">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
                v-model="termoPesquisa"
                placeholder="Buscar curso..."
                class="pl-9 h-9 bg-background text-sm"
            />
        </div>

        <!-- Carregando -->
        <Card v-if="carregando">
            <CardContent class="p-10 text-center space-y-2 text-muted-foreground">
                <Loader2 class="w-6 h-6 mx-auto animate-spin text-primary" />
                <p class="text-sm">Carregando cursos...</p>
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

        <!-- Sem cursos -->
        <Card v-else-if="cursosComProgresso.length === 0">
            <CardContent class="p-10 text-center space-y-2 text-muted-foreground">
                <GraduationCap class="w-9 h-9 mx-auto text-muted-foreground/40" />
                <p class="text-sm font-medium text-foreground">Nenhum curso disponível.</p>
            </CardContent>
        </Card>

        <!-- Busca vazia -->
        <Card v-else-if="cursosFiltrados.length === 0">
            <CardContent class="p-8 text-center space-y-3 text-muted-foreground">
                <p class="text-sm font-medium text-foreground">Nenhum curso encontrado.</p>
                <Button size="sm" variant="outline" @click="termoPesquisa = ''">
                    Limpar busca
                </Button>
            </CardContent>
        </Card>

        <!-- Grade de Cursos -->
        <div
            v-else
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
        >
            <button
                v-for="curso in cursosFiltrados"
                :key="curso.curso_id"
                type="button"
                @click="abrirCurso(curso.curso_id)"
                class="group flex flex-col rounded-xl border border-border bg-card p-4 sm:p-5 text-left shadow-xs transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99] cursor-pointer"
            >
                <!-- Cabecalho do card com altura minima consistente -->
                <div class="flex items-start justify-between gap-3 w-full min-h-[52px]">
                    <div class="flex items-start gap-3 min-w-0">
                        <div
                            class="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
                            :class="
                                curso.totalAtividades > 0 && curso.percentual === 100
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-primary/10 text-primary'
                            "
                        >
                            <CheckCircle2
                                v-if="curso.totalAtividades > 0 && curso.percentual === 100"
                                class="w-5 h-5"
                            />
                            <GraduationCap v-else class="w-5 h-5" />
                        </div>

                        <div class="min-w-0">
                            <h2 class="font-bold text-sm sm:text-base text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                {{ curso.nome }}
                            </h2>
                            <div class="flex items-center gap-2 mt-1">
                                <span
                                    class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border leading-none"
                                    :class="
                                        curso.situacao === 'cursando'
                                            ? 'bg-primary/10 text-primary border-primary/20'
                                            : 'bg-muted text-muted-foreground border-border'
                                    "
                                >
                                    {{ curso.situacao === 'cursando' ? 'Cursando' : 'Concluído' }}
                                </span>
                                <span class="text-xs text-muted-foreground">
                                    {{ curso.totalModulos }}
                                    {{ curso.totalModulos === 1 ? 'módulo' : 'módulos' }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <ChevronRight class="w-4 h-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </div>

                <!-- Progresso sempre alinhado na mesma altura -->
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

                    <div
                        v-if="curso.ajustar > 0 || curso.aguardando > 0"
                        class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5"
                    >
                        <span
                            v-if="curso.ajustar > 0"
                            class="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400"
                        >
                            <AlertCircle class="w-3 h-3 shrink-0" />
                            {{ curso.ajustar }} para ajustar
                        </span>
                        <span
                            v-if="curso.aguardando > 0"
                            class="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400"
                        >
                            <Clock class="w-3 h-3 shrink-0" />
                            {{ curso.aguardando }} aguardando
                        </span>
                    </div>
                </div>
            </button>
        </div>
    </div>
</template>