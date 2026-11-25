<script setup>
    import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
    import { useRouter, useRoute } from 'vue-router';
    import { supabase, sincronizarRealtimeAuth } from '@/lib/supabase';
    import {
        ArrowLeft,
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
    const matriculaAtual = ref(null);
    const modulosBrutos = ref([]);
    const atividades = ref([]);
    const historicoAluno = ref([]);
    const termoPesquisa = ref('');

    let realtimeChannel = null;
    let realtimeTimer = null;

    const cursoIdParam = computed(() => Number(route.params.cursoId));

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

    const modulosComProgresso = computed(() => {
        const atividadesPorModulo = new Map();
        atividades.value.forEach(ati => {
            if (!ati.modulo_id) return;
            if (!atividadesPorModulo.has(ati.modulo_id)) {
                atividadesPorModulo.set(ati.modulo_id, []);
            }
            atividadesPorModulo.get(ati.modulo_id).push(ati);
        });

        const ordenados = [...modulosBrutos.value].sort((a, b) => {
            const ordemA = Number(a.ordem) > 0 ? Number(a.ordem) : Number.MAX_SAFE_INTEGER;
            const ordemB = Number(b.ordem) > 0 ? Number(b.ordem) : Number.MAX_SAFE_INTEGER;
            if (ordemA !== ordemB) return ordemA - ordemB;
            return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
        });

        return ordenados
            .map(mod => {
                const lista = atividadesPorModulo.get(mod.id) || [];
                const total = lista.length;
                let concluidas = 0;
                let aguardando = 0;
                let ajustar = 0;

                lista.forEach(ati => {
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

    const resumoCurso = computed(() => {
        const total = modulosComProgresso.value.reduce((acc, m) => acc + m.total, 0);
        const concluidas = modulosComProgresso.value.reduce((acc, m) => acc + m.concluidas, 0);
        const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;

        return { total, concluidas, percentual };
    });

    const modulosFiltrados = computed(() => {
        const termo = termoPesquisa.value.toLowerCase().trim();
        if (!termo) return modulosComProgresso.value;

        return modulosComProgresso.value.filter(mod =>
            mod.nome.toLowerCase().includes(termo)
        );
    });

    const voltarParaCursos = () => {
        router.push('/aluno/atividades');
    };

    const abrirModulo = (moduloId) => {
        router.push(`/aluno/atividades/${cursoIdParam.value}/${moduloId}`);
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
        termoPesquisa.value = '';

        try {
            if (!alunoId.value) {
                carregarSessaoAluno();
            }

            if (!alunoId.value) {
                erroCarregamento.value = 'Sessão do aluno não identificada. Faça login novamente.';
                return;
            }

            if (!cursoIdParam.value) {
                erroCarregamento.value = 'Curso inválido.';
                return;
            }

            const [resMatriculas, resModulos, resHistorico] = await Promise.all([
                supabase
                    .from('matricula')
                    .select('id, curso_id, situacao, curso:curso_id ( id, nome )')
                    .eq('aluno_id', alunoId.value)
                    .eq('curso_id', cursoIdParam.value)
                    .in('situacao', ['cursando', 'concluido'])
                    .order('id', { ascending: false }),
                supabase
                    .from('curso_modulo')
                    .select('modulo_id, ordem, modulo:modulo_id ( id, nome )')
                    .eq('curso_id', cursoIdParam.value)
                    .order('ordem', { ascending: true }),
                supabase
                    .from('aluno_atividade')
                    .select('id, atividade_id, status, pontos_ganhos, criado_em, atualizado_em')
                    .eq('aluno_id', alunoId.value)
            ]);

            if (resMatriculas.error) throw resMatriculas.error;
            if (resModulos.error) throw resModulos.error;
            if (resHistorico.error) throw resHistorico.error;

            historicoAluno.value = resHistorico.data || [];

            const listaMat = resMatriculas.data || [];
            const matricula = listaMat.find(m => m.situacao === 'cursando') || listaMat[0] || null;

            if (!matricula) {
                erroCarregamento.value = 'Você não possui acesso a este curso.';
                return;
            }

            matriculaAtual.value = matricula;

            modulosBrutos.value = (resModulos.data || [])
                .filter(rel => rel.modulo)
                .map(rel => ({
                    id: rel.modulo.id,
                    nome: rel.modulo.nome,
                    ordem: rel.ordem || 0
                }));

            const idsModulos = modulosBrutos.value.map(m => m.id);

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
            console.error('Erro ao carregar módulos do curso:', err);
            erroCarregamento.value = 'Não foi possível carregar os módulos deste curso.';
            toast.error('Erro', 'Não foi possível carregar os módulos.');
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

    watch(cursoIdParam, () => {
        carregarDados();
    });

    onMounted(async () => {
        carregarSessaoAluno();
        await carregarDados();

        if (alunoId.value) {
            sincronizarRealtimeAuth();

            realtimeChannel = supabase
                .channel(`aluno_curso_modulos_${alunoId.value}`)
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
        <!-- Voltar -->
        <div>
            <button
                type="button"
                @click="voltarParaCursos"
                class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 -ml-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
            >
                <ArrowLeft class="w-4 h-4" />
                <span>Cursos</span>
            </button>
        </div>

        <!-- Carregando -->
        <Card v-if="carregando">
            <CardContent class="p-10 text-center space-y-2 text-muted-foreground">
                <Loader2 class="w-6 h-6 mx-auto animate-spin text-primary" />
                <p class="text-sm">Carregando módulos...</p>
            </CardContent>
        </Card>

        <!-- Erro -->
        <Card v-else-if="erroCarregamento">
            <CardContent class="p-10 text-center space-y-3">
                <AlertCircle class="w-8 h-8 mx-auto text-rose-500" />
                <p class="text-sm font-medium text-foreground">{{ erroCarregamento }}</p>
                <Button size="sm" variant="outline" @click="voltarParaCursos">
                    Voltar para cursos
                </Button>
            </CardContent>
        </Card>

        <template v-else>
            <!-- Cabecalho enxuto do curso -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="min-w-0">
                    <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                        {{ matriculaAtual?.curso?.nome }}
                    </h1>
                    <p v-if="resumoCurso.total > 0" class="text-xs sm:text-sm text-muted-foreground mt-0.5 tabular-nums">
                        {{ resumoCurso.concluidas }}/{{ resumoCurso.total }} atividades concluídas ({{ resumoCurso.percentual }}%)
                    </p>
                </div>

                <div class="flex items-center gap-1.5 self-start sm:self-auto rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 shrink-0">
                    <Trophy class="w-4 h-4 text-amber-500 shrink-0" />
                    <span class="text-sm font-bold text-foreground tabular-nums">
                        {{ pontosTotais }}
                    </span>
                    <span class="text-[11px] font-medium text-muted-foreground">pts</span>
                </div>
            </div>

            <!-- Busca exibida apenas quando houver muitos modulos -->
            <div v-if="modulosComProgresso.length > 5" class="relative w-full sm:max-w-xs">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                    v-model="termoPesquisa"
                    placeholder="Buscar módulo..."
                    class="pl-9 h-9 bg-background text-sm"
                />
            </div>

            <!-- Sem modulos -->
            <Card v-if="modulosComProgresso.length === 0">
                <CardContent class="p-10 text-center space-y-2 text-muted-foreground">
                    <BookOpen class="w-9 h-9 mx-auto text-muted-foreground/40" />
                    <p class="text-sm font-medium text-foreground">
                        Nenhuma atividade disponível neste curso.
                    </p>
                </CardContent>
            </Card>

            <!-- Busca vazia -->
            <Card v-else-if="modulosFiltrados.length === 0">
                <CardContent class="p-8 text-center space-y-3 text-muted-foreground">
                    <p class="text-sm font-medium text-foreground">Nenhum módulo encontrado.</p>
                    <Button size="sm" variant="outline" @click="termoPesquisa = ''">
                        Limpar busca
                    </Button>
                </CardContent>
            </Card>

            <!-- Grade de Modulos -->
            <div
                v-else
                class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
            >
                <button
                    v-for="(modulo, index) in modulosFiltrados"
                    :key="modulo.id"
                    type="button"
                    @click="abrirModulo(modulo.id)"
                    class="group flex flex-col rounded-xl border border-border bg-card p-4 text-left shadow-xs transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99] cursor-pointer"
                >
                    <div class="flex items-start justify-between gap-3 w-full min-h-[48px]">
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

                        <ChevronRight class="w-4 h-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                    </div>

                    <div class="mt-4 pt-3 border-t border-border/70 space-y-2 w-full">
                        <div class="flex items-center justify-between text-xs">
                            <span class="text-muted-foreground tabular-nums">
                                {{ modulo.concluidas }}/{{ modulo.total }} concluídas
                            </span>
                            <span class="font-bold text-foreground tabular-nums">
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

                        <div
                            v-if="modulo.ajustar > 0 || modulo.aguardando > 0"
                            class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5"
                        >
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
                        </div>
                    </div>
                </button>
            </div>
        </template>
    </div>
</template>