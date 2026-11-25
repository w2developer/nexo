<script setup>
    import { ref, computed, watch, onMounted } from 'vue';
    import { supabase } from '@/lib/supabase';
    import { Trophy, Loader2, AlertCircle } from '@lucide/vue';
    import { formatarNome } from '@/utils/formatters';

    import Card from '@/components/ui/Card.vue';
    import Button from '@/components/ui/Button.vue';

    const props = defineProps({
        atualizacaoKey: {
            type: Number,
            default: 0
        },
        limite: {
            type: Number,
            default: 5
        }
    });

    const periodo = ref('mensal');
    const carregando = ref(true);
    const erro = ref('');
    const dadosRanking = ref({
        periodo: 'mensal',
        total_participantes: 0,
        top: [],
        minha_posicao: null
    });

    const listaTop = computed(() => dadosRanking.value?.top || []);
    const minhaPosicao = computed(() => dadosRanking.value?.minha_posicao || null);
    const exibirRodapeForaDoTop = computed(() => {
        return Boolean(minhaPosicao.value && !minhaPosicao.value.no_top);
    });

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
                p_limite: props.limite
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
            console.error('Erro ao carregar ranking de alunos:', err);
            if (!silencioso) {
                erro.value = 'Não foi possível carregar o ranking.';
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

    watch(
        () => props.atualizacaoKey,
        (novoValor, valorAnterior) => {
            if (novoValor !== valorAnterior) {
                carregarRanking(true);
            }
        }
    );

    onMounted(() => {
        carregarRanking();
    });
</script>

<template>
    <Card class="overflow-hidden">
        <!-- Cabecalho + Seletor de Periodo -->
        <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
            <div class="flex items-center gap-2 min-w-0">
                <Trophy class="w-4 h-4 text-amber-500 shrink-0" />
                <span class="text-sm font-semibold text-foreground truncate">
                    Top {{ limite }}
                </span>
            </div>

            <div class="inline-flex items-center rounded-lg bg-muted p-0.5 shrink-0">
                <button
                    type="button"
                    @click="trocarPeriodo('mensal')"
                    class="rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer"
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
                    class="rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer"
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
        <div v-if="carregando" class="p-8 text-center text-muted-foreground space-y-2">
            <Loader2 class="w-5 h-5 mx-auto animate-spin text-primary" />
            <p class="text-xs">Carregando ranking...</p>
        </div>

        <!-- Erro -->
        <div v-else-if="erro" class="p-6 text-center space-y-2.5">
            <AlertCircle class="w-6 h-6 mx-auto text-rose-500" />
            <p class="text-xs text-muted-foreground">{{ erro }}</p>
            <Button size="sm" variant="outline" @click="carregarRanking()">
                Tentar novamente
            </Button>
        </div>

        <!-- Vazio -->
        <div v-else-if="listaTop.length === 0" class="p-8 text-center space-y-1.5">
            <Trophy class="w-7 h-7 mx-auto text-muted-foreground/35" />
            <p class="text-sm font-medium text-foreground">
                {{ periodo === 'mensal' ? 'Nenhuma pontuação neste mês' : 'Ranking ainda vazio' }}
            </p>
            <p class="text-xs text-muted-foreground">
                Conclua uma atividade para estrear no pódio.
            </p>
        </div>

        <!-- Lista do Ranking -->
        <div v-else>
            <ol class="divide-y divide-border">
                <li
                    v-for="item in listaTop"
                    :key="`${item.posicao}-${item.nome}`"
                    class="flex items-center justify-between gap-3 px-4 py-3 transition-colors"
                    :class="item.eh_voce ? 'bg-primary/6' : ''"
                >
                    <div class="flex items-center gap-3 min-w-0">
                        <span
                            class="flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-bold tabular-nums shrink-0"
                            :class="getEstiloPosicao(item.posicao)"
                        >
                            {{ item.posicao }}º
                        </span>

                        <div class="min-w-0">
                            <div class="flex items-center gap-1.5 min-w-0">
                                <span
                                    class="text-sm truncate"
                                    :class="item.eh_voce ? 'font-bold text-primary' : 'font-medium text-foreground'"
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
                        </div>
                    </div>

                    <span class="text-sm font-bold text-foreground tabular-nums shrink-0">
                        {{ item.pontos }}
                        <span class="text-[11px] font-normal text-muted-foreground">pts</span>
                    </span>
                </li>
            </ol>

            <!-- Rodape: aluno logado fora do Top -->
            <div
                v-if="exibirRodapeForaDoTop"
                class="border-t border-dashed border-border bg-primary/5 px-4 py-3 flex items-center justify-between gap-3"
            >
                <div class="flex items-center gap-3 min-w-0">
                    <span class="flex h-7 min-w-7 px-1.5 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-xs font-bold text-primary tabular-nums shrink-0">
                        #{{ minhaPosicao.posicao }}
                    </span>

                    <div class="min-w-0">
                        <p class="text-sm font-bold text-primary truncate">
                            Você
                        </p>
                        <p
                            v-if="minhaPosicao.pontos_para_subir && minhaPosicao.proxima_posicao"
                            class="text-[11px] text-muted-foreground truncate"
                        >
                            +{{ minhaPosicao.pontos_para_subir }} pts para #{{ minhaPosicao.proxima_posicao }}
                        </p>
                    </div>
                </div>

                <span class="text-sm font-bold text-foreground tabular-nums shrink-0">
                    {{ minhaPosicao.pontos }}
                    <span class="text-[11px] font-normal text-muted-foreground">pts</span>
                </span>
            </div>

            <!-- Rodape: aluno ainda sem pontos no periodo selecionado -->
            <div
                v-else-if="!minhaPosicao"
                class="border-t border-border bg-muted/30 px-4 py-2.5 text-center text-xs text-muted-foreground"
            >
                Conclua uma atividade para entrar no ranking{{ periodo === 'mensal' ? ' deste mês' : '' }}.
            </div>
        </div>
    </Card>
</template>