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
    const moduloAtual = ref(null);
    const atividadesBrutas = ref([]);
    const historicoAluno = ref([]);
    const termoPesquisa = ref('');

    let realtimeChannel = null;
    let realtimeTimer = null;

    const cursoIdParam = computed(() => Number(route.params.cursoId));
    const moduloIdParam = computed(() => Number(route.params.moduloId));

    const getEstiloDificuldade = (dificuldade) => {
        if (!dificuldade) {
            return {
                texto: '---',
                classe: 'bg-muted text-muted-foreground border-border'
            };
        }

        const mapa = {
            1: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
            2: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
            3: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
            4: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
        };

        return {
            texto: dificuldade.nome,
            classe: mapa[dificuldade.ordem] || 'bg-muted text-muted-foreground border-border'
        };
    };

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

            const vezesConcluida = registros.filter(r => r.status === 'concluida').length;
            const aguardando = registros.some(r => r.status === 'solicitada');
            const maisRecente = ordenadosRecente[0] || null;
            const ajustar = !aguardando && maisRecente?.status === 'recusada';

            resumo.set(atividadeId, {
                vezesConcluida,
                concluida: vezesConcluida > 0,
                aguardando,
                ajustar
            });
        });

        return resumo;
    });

    const atividadesLista = computed(() => {
        const ordenadas = [...atividadesBrutas.value].sort((a, b) => {
            const ordemA = Number(a.ordem) > 0 ? Number(a.ordem) : Number.MAX_SAFE_INTEGER;
            const ordemB = Number(b.ordem) > 0 ? Number(b.ordem) : Number.MAX_SAFE_INTEGER;
            if (ordemA !== ordemB) return ordemA - ordemB;
            return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
        });

        return ordenadas.map((item, idx) => {
            const estado = mapaEstadoPorAtividade.value.get(item.id) || {
                vezesConcluida: 0,
                concluida: false,
                aguardando: false,
                ajustar: false
            };

            const pontosBase = Number(item.dificuldade?.pontos) || 0;
            const ehRevisao = estado.vezesConcluida > 0;
            const pontosProxima = ehRevisao ? Math.ceil(pontosBase * 0.5) : pontosBase;

            return {
                ...item,
                numeroExibicao: item.ordem || idx + 1,
                estado,
                ehRevisao,
                pontosProxima
            };
        });
    });

    const resumoModulo = computed(() => {
        const total = atividadesLista.value.length;
        const concluidas = atividadesLista.value.filter(a => a.estado.concluida).length;
        const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;

        return { total, concluidas, percentual };
    });

    const atividadesFiltradas = computed(() => {
        const termo = termoPesquisa.value.toLowerCase().trim();
        if (!termo) return atividadesLista.value;

        return atividadesLista.value.filter(item =>
            item.nome.toLowerCase().includes(termo)
        );
    });

    const voltarParaModulos = () => {
        router.push(`/aluno/atividades/${cursoIdParam.value}`);
    };

    const abrirAtividade = (atividadeId) => {
        router.push(`/aluno/atividades/${cursoIdParam.value}/${moduloIdParam.value}/${atividadeId}`);
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

    const carregarModulo = async () => {
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

            if (!cursoIdParam.value || !moduloIdParam.value) {
                erroCarregamento.value = 'Módulo inválido.';
                return;
            }

            const [resMatriculas, resVinculo, resHistorico] = await Promise.all([
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
                    .eq('modulo_id', moduloIdParam.value)
                    .limit(1),
                supabase
                    .from('aluno_atividade')
                    .select('id, atividade_id, status, pontos_ganhos, criado_em, atualizado_em')
                    .eq('aluno_id', alunoId.value)
            ]);

            if (resMatriculas.error) throw resMatriculas.error;
            if (resVinculo.error) throw resVinculo.error;
            if (resHistorico.error) throw resHistorico.error;

            historicoAluno.value = resHistorico.data || [];

            const listaMat = resMatriculas.data || [];
            const matricula = listaMat.find(m => m.situacao === 'cursando') || listaMat[0] || null;
            const vinculo = resVinculo.data?.[0] || null;

            if (!matricula) {
                erroCarregamento.value = 'Você não possui acesso a este curso.';
                return;
            }

            if (!vinculo || !vinculo.modulo) {
                erroCarregamento.value = 'Módulo não encontrado.';
                return;
            }

            matriculaAtual.value = matricula;
            moduloAtual.value = {
                id: vinculo.modulo.id,
                nome: vinculo.modulo.nome,
                ordem: vinculo.ordem || 0
            };

            const { data: dadosAti, error: erroAti } = await supabase
                .from('atividade')
                .select(`
                    id,
                    modulo_id,
                    dificuldade_id,
                    nome,
                    ordem,
                    dificuldade:dificuldade_id ( id, nome, pontos, ordem )
                `)
                .eq('modulo_id', moduloIdParam.value)
                .order('ordem', { ascending: true })
                .order('nome', { ascending: true });

            if (erroAti) throw erroAti;
            atividadesBrutas.value = dadosAti || [];
        } catch (err) {
            console.error('Erro ao carregar lista de atividades:', err);
            erroCarregamento.value = 'Não foi possível carregar as atividades deste módulo.';
            toast.error('Erro', 'Não foi possível carregar as atividades.');
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

    watch([cursoIdParam, moduloIdParam], () => {
        carregarModulo();
    });

    onMounted(async () => {
        carregarSessaoAluno();
        await carregarModulo();

        if (alunoId.value) {
            sincronizarRealtimeAuth();

            realtimeChannel = supabase
                .channel(`aluno_modulo_lista_${alunoId.value}`)
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
    <div class="space-y-5 max-w-4xl mx-auto">
        <!-- Voltar -->
        <div>
            <button
                type="button"
                @click="voltarParaModulos"
                class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 -ml-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
            >
                <ArrowLeft class="w-4 h-4" />
                <span>{{ matriculaAtual?.curso?.nome || 'Módulos' }}</span>
            </button>
        </div>

        <!-- Carregando -->
        <Card v-if="carregando">
            <CardContent class="p-10 text-center space-y-2 text-muted-foreground">
                <Loader2 class="w-6 h-6 mx-auto animate-spin text-primary" />
                <p class="text-sm">Carregando atividades...</p>
            </CardContent>
        </Card>

        <!-- Erro -->
        <Card v-else-if="erroCarregamento">
            <CardContent class="p-10 text-center space-y-3">
                <AlertCircle class="w-8 h-8 mx-auto text-rose-500" />
                <p class="text-sm font-medium text-foreground">{{ erroCarregamento }}</p>
                <Button size="sm" variant="outline" @click="voltarParaModulos">
                    Voltar
                </Button>
            </CardContent>
        </Card>

        <template v-else>
            <!-- Cabecalho enxuto do modulo -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="min-w-0">
                    <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                        {{ moduloAtual?.nome }}
                    </h1>
                    <p v-if="resumoModulo.total > 0" class="text-xs sm:text-sm text-muted-foreground mt-0.5 tabular-nums">
                        {{ resumoModulo.concluidas }}/{{ resumoModulo.total }} concluídas ({{ resumoModulo.percentual }}%)
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

            <!-- Busca exibida apenas quando houver muitas atividades -->
            <div v-if="atividadesLista.length > 6" class="relative w-full sm:max-w-xs">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                    v-model="termoPesquisa"
                    placeholder="Buscar atividade..."
                    class="pl-9 h-9 bg-background text-sm"
                />
            </div>

            <!-- Lista limpa de atividades -->
            <Card class="overflow-hidden">
                <div
                    v-if="atividadesLista.length === 0"
                    class="p-10 text-center space-y-2 text-muted-foreground"
                >
                    <BookOpen class="w-9 h-9 mx-auto text-muted-foreground/40" />
                    <p class="text-sm font-medium text-foreground">
                        Nenhuma atividade cadastrada neste módulo.
                    </p>
                </div>

                <div
                    v-else-if="atividadesFiltradas.length === 0"
                    class="p-8 text-center space-y-3 text-muted-foreground"
                >
                    <p class="text-sm font-medium text-foreground">Nenhuma atividade encontrada.</p>
                    <Button size="sm" variant="outline" @click="termoPesquisa = ''">
                        Limpar busca
                    </Button>
                </div>

                <div v-else class="divide-y divide-border">
                    <button
                        v-for="item in atividadesFiltradas"
                        :key="item.id"
                        type="button"
                        @click="abrirAtividade(item.id)"
                        class="group w-full px-4 py-3.5 sm:px-5 sm:py-4 flex items-center gap-3.5 text-left hover:bg-muted/40 transition-colors active:bg-muted/60 cursor-pointer"
                    >
                        <!-- Indicador de status / ordem -->
                        <div
                            class="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold shrink-0 tabular-nums"
                            :class="
                                item.estado.ajustar
                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                    : item.estado.aguardando
                                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                        : item.estado.concluida
                                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                            : 'bg-muted text-muted-foreground'
                            "
                        >
                            <AlertCircle v-if="item.estado.ajustar" class="w-4 h-4" />
                            <Clock v-else-if="item.estado.aguardando" class="w-4 h-4" />
                            <CheckCircle2 v-else-if="item.estado.concluida" class="w-4 h-4" />
                            <span v-else>{{ String(item.numeroExibicao).padStart(2, '0') }}</span>
                        </div>

                        <!-- Nome, dificuldade e pontos -->
                        <div class="min-w-0 flex-1">
                            <p class="font-semibold text-sm sm:text-[15px] text-foreground leading-snug truncate group-hover:text-primary transition-colors">
                                {{ item.nome }}
                            </p>

                            <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                <span
                                    class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border leading-none"
                                    :class="getEstiloDificuldade(item.dificuldade).classe"
                                >
                                    {{ getEstiloDificuldade(item.dificuldade).texto }}
                                </span>
                                <span class="text-xs font-medium text-muted-foreground tabular-nums">
                                    +{{ item.pontosProxima }} pts
                                    <template v-if="item.ehRevisao">· Revisão</template>
                                </span>
                            </div>
                        </div>

                        <!-- Status discreto a direita + seta -->
                        <div class="flex items-center gap-2.5 shrink-0">
                            <span
                                v-if="item.estado.ajustar"
                                class="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400"
                            >
                                Ajustar
                            </span>
                            <span
                                v-else-if="item.estado.aguardando"
                                class="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400"
                            >
                                Aguardando
                            </span>
                            <span
                                v-else-if="item.estado.concluida"
                                class="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                            >
                                Concluída{{ item.estado.vezesConcluida > 1 ? ` (${item.estado.vezesConcluida}x)` : '' }}
                            </span>

                            <ChevronRight class="w-4 h-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                    </button>
                </div>
            </Card>
        </template>
    </div>
</template>