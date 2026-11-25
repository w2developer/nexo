<script setup>
    import { ref, computed, onMounted, onUnmounted } from 'vue';
    import { useRouter } from 'vue-router';
    import { supabase, sincronizarRealtimeAuth } from '@/lib/supabase';
    import {
        Trophy,
        Crown,
        Loader2,
        AlertCircle,
        ChevronRight
    } from '@lucide/vue';
    import { formatarNome } from '@/utils/formatters';
    import { useAlunoSessao } from '../composables/useAlunoSessao';

    import Card from '@/components/ui/Card.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Button from '@/components/ui/Button.vue';

    const router = useRouter();
    const { alunoId, carregarSessaoAluno } = useAlunoSessao();

    const LIMITE_TOP = 20;

    const periodo = ref('mensal');
    const carregando = ref(true);
    const erro = ref('');
    const dadosRanking = ref({
        periodo: 'mensal',
        total_participantes: 0,
        top: [],
        minha_posicao: null
    });

    let realtimeChannel = null;
    let realtimeTimer = null;

    const listaTop = computed(() => dadosRanking.value?.top || []);
    const minhaPosicao = computed(() => dadosRanking.value?.minha_posicao || null);
    const totalParticipantes = computed(() => dadosRanking.value?.total_participantes || 0);

    const getEstiloPosicao = (posicao) => {
        if (posicao === 1) {
            return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
        }
        if (posicao === 2) {
            return 'bg-slate-400/15 text-slate-600 dark:text-slate-300 border-slate-400/30';
        }
        if (posicao === 3) {
            return 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30';
        }
        return 'bg-muted text-muted-foreground border-border';
    };

    const carregarRanking = async (silencioso = false) => {
        if (!silencioso) {
            carregando.value = true;
            erro.value = '';
        }

        try {
            const { data, error } = await supabase.rpc('obter_ranking_alunos', {
                p_periodo: periodo.value,
                p_limite: LIMITE_TOP
            });

            if (error) throw error;

            dadosRanking.value = data || {
                periodo: periodo.value,
                total_participantes: 0,
                top: [],
                minha_posicao: null
            };
            erro.value = '';
        } catch (err) {
            console.error('Erro ao carregar página de ranking:', err);
            if (!silencioso) {
                erro.value = 'Não foi possível carregar o ranking agora.';
            }
        } finally {
            carregando.value = false;
        }
    };

    const trocarPeriodo = (novoPeriodo) => {
        if (periodo.value === novoPeriodo) return;
        periodo.value = novoPeriodo;
        carregarRanking();
    };

    const agendarAtualizacaoRealtime = () => {
        clearTimeout(realtimeTimer);
        realtimeTimer = setTimeout(() => {
            carregarRanking(true);
        }, 250);
    };

    onMounted(async () => {
        carregarSessaoAluno();
        await carregarRanking();

        if (alunoId.value) {
            sincronizarRealtimeAuth();

            realtimeChannel = supabase
                .channel(`aluno_ranking_pagina_${alunoId.value}`)
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
        <!-- Cabecalho + Seletor de Periodo -->
        <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
                <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    Ranking
                </h1>
                <p
                    v-if="!carregando && !erro && totalParticipantes > 0"
                    class="text-xs sm:text-sm text-muted-foreground mt-0.5 tabular-nums"
                >
                    {{ totalParticipantes }}
                    {{ totalParticipantes === 1 ? 'aluno pontuado' : 'alunos pontuados' }}
                </p>
            </div>

            <div class="inline-flex items-center rounded-lg bg-muted p-1 shrink-0">
                <button
                    type="button"
                    @click="trocarPeriodo('mensal')"
                    class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                    :class="
                        periodo === 'mensal'
                            ? 'bg-background text-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                    "
                >
                    Este mês
                </button>
                <button
                    type="button"
                    @click="trocarPeriodo('geral')"
                    class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                    :class="
                        periodo === 'geral'
                            ? 'bg-background text-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                    "
                >
                    Geral
                </button>
            </div>
        </div>

        <!-- Carregando -->
        <Card v-if="carregando">
            <CardContent class="p-10 text-center space-y-2 text-muted-foreground">
                <Loader2 class="w-6 h-6 mx-auto animate-spin text-primary" />
                <p class="text-sm">Carregando ranking...</p>
            </CardContent>
        </Card>

        <!-- Erro -->
        <Card v-else-if="erro">
            <CardContent class="p-10 text-center space-y-3">
                <AlertCircle class="w-8 h-8 mx-auto text-rose-500" />
                <p class="text-sm font-medium text-foreground">{{ erro }}</p>
                <Button size="sm" variant="outline" @click="carregarRanking()">
                    Tentar novamente
                </Button>
            </CardContent>
        </Card>

        <template v-else>
            <!-- Resumo da Posicao do Aluno Logado -->
            <Card v-if="minhaPosicao" class="border-primary/25 bg-primary/5">
                <CardContent class="p-4 sm:p-5 flex items-center justify-between gap-4">
                    <div class="flex items-center gap-3.5 min-w-0">
                        <div
                            class="flex h-11 min-w-11 px-2 items-center justify-center rounded-xl border text-sm font-bold tabular-nums shrink-0"
                            :class="getEstiloPosicao(minhaPosicao.posicao)"
                        >
                            #{{ minhaPosicao.posicao }}
                        </div>

                        <div class="min-w-0">
                            <p class="text-sm sm:text-base font-bold text-foreground truncate">
                                Sua posição
                            </p>
                            <p class="text-xs text-muted-foreground mt-0.5 truncate">
                                <template v-if="minhaPosicao.posicao === 1">
                                    Você está na liderança{{ periodo === 'mensal' ? ' deste mês' : '' }}
                                </template>
                                <template v-else-if="minhaPosicao.pontos_para_subir && minhaPosicao.proxima_posicao">
                                    Faltam +{{ minhaPosicao.pontos_para_subir }} pts para #{{ minhaPosicao.proxima_posicao }}
                                </template>
                                <template v-else>
                                    {{ minhaPosicao.atividades }}
                                    {{ minhaPosicao.atividades === 1 ? 'atividade concluída' : 'atividades concluídas' }}
                                </template>
                            </p>
                        </div>
                    </div>

                    <div class="text-right shrink-0">
                        <p class="text-lg sm:text-xl font-bold text-foreground tabular-nums leading-none">
                            {{ minhaPosicao.pontos }}
                            <span class="text-xs font-medium text-muted-foreground">pts</span>
                        </p>
                        <p class="text-[11px] text-muted-foreground tabular-nums mt-1">
                            {{ minhaPosicao.atividades }}
                            {{ minhaPosicao.atividades === 1 ? 'atividade' : 'atividades' }}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <!-- Aviso quando o aluno ainda nao pontuou no periodo -->
            <button
                v-else-if="listaTop.length > 0"
                type="button"
                @click="router.push('/aluno/atividades')"
                class="group w-full rounded-xl border border-dashed border-border bg-card px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:border-primary/40 transition-colors cursor-pointer"
            >
                <div class="min-w-0">
                    <p class="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        Você ainda não entrou no ranking{{ periodo === 'mensal' ? ' deste mês' : '' }}
                    </p>
                    <p class="text-xs text-muted-foreground mt-0.5">
                        Conclua uma atividade para somar pontos.
                    </p>
                </div>
                <ChevronRight class="w-4 h-4 text-muted-foreground/60 group-hover:text-primary shrink-0" />
            </button>

            <!-- Estado Vazio -->
            <Card v-if="listaTop.length === 0">
                <CardContent class="p-10 text-center space-y-3">
                    <Trophy class="w-9 h-9 mx-auto text-muted-foreground/35" />
                    <div class="space-y-1">
                        <p class="text-sm font-semibold text-foreground">
                            {{ periodo === 'mensal' ? 'Nenhuma pontuação neste mês' : 'Ranking ainda vazio' }}
                        </p>
                        <p class="text-xs text-muted-foreground">
                            Conclua uma atividade para estrear no pódio.
                        </p>
                    </div>
                    <Button size="sm" variant="outline" @click="router.push('/aluno/atividades')">
                        Ir para atividades
                    </Button>
                </CardContent>
            </Card>

            <!-- Lista de Classificacao -->
            <Card v-else class="overflow-hidden">
                <div class="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                    <span>Classificação</span>
                    <span>Pontuação</span>
                </div>

                <ol class="divide-y divide-border">
                    <li
                        v-for="item in listaTop"
                        :key="`${item.posicao}-${item.nome}`"
                        class="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 transition-colors"
                        :class="item.eh_voce ? 'bg-primary/6' : ''"
                    >
                        <div class="flex items-center gap-3.5 min-w-0">
                            <span
                                class="flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold tabular-nums shrink-0"
                                :class="getEstiloPosicao(item.posicao)"
                            >
                                <Crown v-if="item.posicao === 1" class="w-4 h-4" />
                                <span v-else>{{ item.posicao }}º</span>
                            </span>

                            <div class="min-w-0">
                                <div class="flex items-center gap-2 min-w-0">
                                    <span
                                        class="text-sm sm:text-[15px] truncate"
                                        :class="item.eh_voce ? 'font-bold text-primary' : 'font-semibold text-foreground'"
                                    >
                                        {{ formatarNome(item.nome) }}
                                    </span>
                                    <span
                                        v-if="item.eh_voce"
                                        class="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-primary/15 text-primary leading-none shrink-0"
                                    >
                                        Você
                                    </span>
                                </div>
                                <p class="text-xs text-muted-foreground tabular-nums mt-0.5">
                                    {{ item.atividades }}
                                    {{ item.atividades === 1 ? 'atividade' : 'atividades' }}
                                </p>
                            </div>
                        </div>

                        <span class="text-sm sm:text-base font-bold text-foreground tabular-nums shrink-0">
                            {{ item.pontos }}
                            <span class="text-xs font-normal text-muted-foreground">pts</span>
                        </span>
                    </li>
                </ol>
            </Card>
        </template>
    </div>
</template>