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
        Search,
        FileText,
        ExternalLink,
        KeyRound,
        Send,
        RotateCcw,
        Loader2,
        Eye,
        EyeOff,
        BookOpen,
        MessageSquare
    } from '@lucide/vue';
    import { toast } from '@/composables/useToast';
    import { useAlunoSessao } from '../composables/useAlunoSessao';

    import googleDriveIcon from '@/assets/png/google-drive-96.png';
    import megaLogoIcon from '@/assets/png/mega-logo-96.png';

    import Card from '@/components/ui/Card.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Button from '@/components/ui/Button.vue';
    import Input from '@/components/ui/Input.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Modal from '@/components/ui/Modal.vue';

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
    const filtroStatus = ref('todas');

    // Modal unificado de validacao (Presencial por Codigo vs Remoto)
    const modalValidacaoAberto = ref(false);
    const atividadeSelecionada = ref(null);
    const modoValidacao = ref('codigo');
    const codigoProfessor = ref('');
    const mostrarCodigo = ref(false);
    const processandoValidacao = ref(false);

    let realtimeChannel = null;
    let realtimeTimer = null;

    const opcoesFiltroStatus = [
        { label: 'Todas', value: 'todas' },
        { label: 'Pendentes', value: 'pendentes' },
        { label: 'Aguardando', value: 'aguardando' },
        { label: 'Concluídas', value: 'concluidas' }
    ];

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

    const formatarTempoRelativo = (iso) => {
        if (!iso) return '';

        const data = new Date(iso);
        if (Number.isNaN(data.getTime())) return '';

        const diffMin = Math.floor((Date.now() - data.getTime()) / 60000);
        if (diffMin < 1) return 'agora mesmo';
        if (diffMin < 60) return `há ${diffMin} min`;

        const diffHoras = Math.floor(diffMin / 60);
        if (diffHoras < 24) return `há ${diffHoras} h`;

        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(data);
    };

    const pontosTotais = computed(() => {
        return historicoAluno.value.reduce((soma, reg) => {
            if (reg.status === 'concluida') {
                return soma + (Number(reg.pontos_ganhos) || 0);
            }
            return soma;
        }, 0);
    });

    const mapaProgressoPorAtividade = computed(() => {
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

            const concluidas = registros.filter(r => r.status === 'concluida');
            const solicitacaoAberta = registros.find(r => r.status === 'solicitada') || null;
            const maisRecente = ordenadosRecente[0] || null;
            const recusaRecente = !solicitacaoAberta && maisRecente?.status === 'recusada'
                ? maisRecente
                : null;

            resumo.set(atividadeId, {
                vezesConcluida: concluidas.length,
                concluida: concluidas.length > 0,
                solicitacaoAberta,
                recusaRecente
            });
        });

        return resumo;
    });

    const atividadesEnriquecidas = computed(() => {
        const ordenadas = [...atividadesBrutas.value].sort((a, b) => {
            const ordemA = Number(a.ordem) > 0 ? Number(a.ordem) : Number.MAX_SAFE_INTEGER;
            const ordemB = Number(b.ordem) > 0 ? Number(b.ordem) : Number.MAX_SAFE_INTEGER;
            if (ordemA !== ordemB) return ordemA - ordemB;
            return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
        });

        return ordenadas.map(item => {
            const estado = mapaProgressoPorAtividade.value.get(item.id) || {
                vezesConcluida: 0,
                concluida: false,
                solicitacaoAberta: null,
                recusaRecente: null
            };

            const pontosBase = Number(item.dificuldade?.pontos) || 0;
            const ehRevisao = estado.vezesConcluida > 0;
            const pontosProxima = ehRevisao ? Math.ceil(pontosBase * 0.5) : pontosBase;

            const canais = [];
            if (item.pdf_url) canais.push({ tipo: 'pdf', label: 'PDF', url: item.pdf_url });
            if (item.drive_url) canais.push({ tipo: 'drive', label: 'Drive', url: item.drive_url });
            if (item.mega_url) canais.push({ tipo: 'mega', label: 'Mega', url: item.mega_url });
            if (item.outro_url) canais.push({ tipo: 'outro', label: 'Outro', url: item.outro_url });

            return {
                ...item,
                estado,
                pontosBase,
                ehRevisao,
                pontosProxima,
                canais
            };
        });
    });

    const resumoModulo = computed(() => {
        const total = atividadesEnriquecidas.value.length;
        const concluidas = atividadesEnriquecidas.value.filter(a => a.estado.concluida).length;
        const aguardando = atividadesEnriquecidas.value.filter(a => Boolean(a.estado.solicitacaoAberta)).length;
        const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;

        return { total, concluidas, aguardando, percentual };
    });

    const atividadesFiltradas = computed(() => {
        const termo = termoPesquisa.value.toLowerCase().trim();
        const status = filtroStatus.value;

        return atividadesEnriquecidas.value.filter(item => {
            if (status === 'pendentes' && (item.estado.concluida || item.estado.solicitacaoAberta)) {
                return false;
            }
            if (status === 'aguardando' && !item.estado.solicitacaoAberta) {
                return false;
            }
            if (status === 'concluidas' && !item.estado.concluida) {
                return false;
            }

            if (!termo) return true;
            return (
                item.nome.toLowerCase().includes(termo) ||
                (item.dificuldade?.nome?.toLowerCase() || '').includes(termo)
            );
        });
    });

    // Mantem os dados do modal sempre sincronizados com o historico em tempo real
    const atividadeModalAtual = computed(() => {
        if (!atividadeSelecionada.value) return null;
        return (
            atividadesEnriquecidas.value.find(a => a.id === atividadeSelecionada.value.id) ||
            atividadeSelecionada.value
        );
    });

    const obterBotaoAcao = (item) => {
        if (item.estado.solicitacaoAberta) {
            return {
                label: 'Validar',
                variant: 'outline',
                icone: KeyRound,
                classe: 'border-amber-500/35 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10'
            };
        }
        if (item.estado.recusaRecente) {
            return {
                label: 'Reenviar',
                variant: 'default',
                icone: CheckCircle2,
                classe: ''
            };
        }
        if (item.ehRevisao) {
            return {
                label: 'Refazer',
                variant: 'outline',
                icone: RotateCcw,
                classe: 'bg-background border-border text-foreground hover:bg-muted'
            };
        }
        return {
            label: 'Finalizar',
            variant: 'default',
            icone: CheckCircle2,
            classe: ''
        };
    };

    const voltarParaModulos = () => {
        const query = cursoIdParam.value ? { curso: String(cursoIdParam.value) } : {};
        router.push({ path: '/aluno/atividades', query });
    };

    const abrirModalValidacao = (item) => {
        atividadeSelecionada.value = item;
        codigoProfessor.value = '';
        mostrarCodigo.value = false;
        modoValidacao.value = 'codigo';
        modalValidacaoAberto.value = true;
    };

    watch(modalValidacaoAberto, (aberto) => {
        if (!aberto) {
            codigoProfessor.value = '';
            mostrarCodigo.value = false;
            atividadeSelecionada.value = null;
        }
    });

    // ========================================================
    // CARREGAMENTO DE DADOS
    // ========================================================

    const carregarHistoricoAluno = async () => {
        if (!alunoId.value) return;

        const { data, error } = await supabase
            .from('aluno_atividade')
            .select(
                'id, atividade_id, matricula_id, tentativa, status, metodo_validacao, pontos_ganhos, observacao_professor, solicitada_em, concluida_em, criado_em, atualizado_em'
            )
            .eq('aluno_id', alunoId.value);

        if (error) throw error;
        historicoAluno.value = data || [];
    };

    const carregarModulo = async () => {
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

            if (!cursoIdParam.value || !moduloIdParam.value) {
                erroCarregamento.value = 'Módulo inválido.';
                return;
            }

            const [resMatricula, resVinculo, resHistorico] = await Promise.all([
                supabase
                    .from('matricula')
                    .select('id, curso_id, situacao, curso:curso_id ( id, nome )')
                    .eq('aluno_id', alunoId.value)
                    .eq('curso_id', cursoIdParam.value)
                    .in('situacao', ['cursando', 'concluido'])
                    .order('id', { ascending: false })
                    .limit(1),
                supabase
                    .from('curso_modulo')
                    .select('curso_id, modulo_id, ordem, modulo:modulo_id ( id, nome )')
                    .eq('curso_id', cursoIdParam.value)
                    .eq('modulo_id', moduloIdParam.value)
                    .limit(1),
                supabase
                    .from('aluno_atividade')
                    .select(
                        'id, atividade_id, matricula_id, tentativa, status, metodo_validacao, pontos_ganhos, observacao_professor, solicitada_em, concluida_em, criado_em, atualizado_em'
                    )
                    .eq('aluno_id', alunoId.value)
            ]);

            if (resMatricula.error) throw resMatricula.error;
            if (resVinculo.error) throw resVinculo.error;
            if (resHistorico.error) throw resHistorico.error;

            historicoAluno.value = resHistorico.data || [];

            const matricula = resMatricula.data?.[0] || null;
            const vinculo = resVinculo.data?.[0] || null;

            if (!matricula) {
                erroCarregamento.value = 'Você não possui matrícula ativa com acesso a este curso.';
                return;
            }

            if (!vinculo || !vinculo.modulo) {
                erroCarregamento.value = 'Módulo não encontrado para este curso.';
                return;
            }

            matriculaAtual.value = matricula;
            moduloAtual.value = {
                id: vinculo.modulo.id,
                nome: vinculo.modulo.nome,
                ordem: vinculo.ordem || 0
            };

            const { data: dadosAtividades, error: erroAti } = await supabase
                .from('atividade')
                .select(`
                    id,
                    modulo_id,
                    dificuldade_id,
                    nome,
                    ordem,
                    pdf_url,
                    drive_url,
                    mega_url,
                    outro_url,
                    dificuldade:dificuldade_id ( id, nome, pontos, ordem )
                `)
                .eq('modulo_id', moduloIdParam.value)
                .order('ordem', { ascending: true })
                .order('nome', { ascending: true });

            if (erroAti) throw erroAti;
            atividadesBrutas.value = dadosAtividades || [];
        } catch (err) {
            console.error('Erro ao carregar módulo de atividades:', err);
            erroCarregamento.value = 'Não foi possível carregar as atividades deste módulo.';
            toast.error('Erro', 'Não foi possível carregar o módulo.');
        } finally {
            carregando.value = false;
        }
    };

    const agendarAtualizacaoRealtime = (payload) => {
        clearTimeout(realtimeTimer);
        realtimeTimer = setTimeout(async () => {
            try {
                await carregarHistoricoAluno();

                if (!processandoValidacao.value && payload?.eventType === 'UPDATE') {
                    const novo = payload.new;
                    const antigo = payload.old;

                    if (novo?.status === 'concluida' && antigo?.status !== 'concluida') {
                        toast.success(
                            'Atividade aprovada!',
                            `O professor confirmou sua atividade (+${novo.pontos_ganhos || 0} pts).`
                        );
                    } else if (novo?.status === 'recusada' && antigo?.status !== 'recusada') {
                        toast.error(
                            'Ajuste solicitado',
                            'O professor devolveu uma atividade para revisão. Confira a observação.'
                        );
                    }
                }
            } catch (err) {
                console.error('Erro ao sincronizar progresso em tempo real:', err);
            }
        }, 250);
    };

    // ========================================================
    // ACOES DO MODAL UNIFICADO (RPCs SEGURAS)
    // ========================================================

    const confirmarPorCodigo = async () => {
        const item = atividadeModalAtual.value;
        if (!item || processandoValidacao.value) return;

        const codigoLimpo = codigoProfessor.value.trim();
        if (!codigoLimpo) {
            toast.error('Atenção', 'Peça ao professor para digitar o código.');
            return;
        }

        processandoValidacao.value = true;
        try {
            const { data, error } = await supabase.rpc('concluir_atividade_por_codigo', {
                p_atividade_id: item.id,
                p_codigo_professor: codigoLimpo,
                p_matricula_id: matriculaAtual.value?.id || null
            });

            if (error) throw error;

            const pontos = data?.pontos_ganhos ?? item.pontosProxima;
            toast.success('Atividade concluída!', `Você ganhou +${pontos} pts nesta atividade.`);

            modalValidacaoAberto.value = false;
            await carregarHistoricoAluno();
        } catch (err) {
            console.error('Erro ao validar por código:', err);
            toast.error('Código não aceito', err?.message || 'Verifique o código digitado e tente novamente.');
        } finally {
            processandoValidacao.value = false;
        }
    };

    const enviarSolicitacaoRemota = async () => {
        const item = atividadeModalAtual.value;
        if (!item || processandoValidacao.value || item.estado.solicitacaoAberta) return;

        processandoValidacao.value = true;
        try {
            const { error } = await supabase.rpc('solicitar_conclusao_atividade', {
                p_atividade_id: item.id,
                p_matricula_id: matriculaAtual.value?.id || null
            });

            if (error) throw error;

            toast.success('Solicitação enviada', 'Aguarde o professor confirmar sua atividade.');

            modalValidacaoAberto.value = false;
            await carregarHistoricoAluno();
        } catch (err) {
            console.error('Erro ao solicitar validação remota:', err);
            toast.error('Não foi possível enviar', err?.message || 'Tente novamente em instantes.');
        } finally {
            processandoValidacao.value = false;
        }
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
                .channel(`aluno_modulo_atividades_${alunoId.value}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'aluno_atividade',
                        filter: `aluno_id=eq.${alunoId.value}`
                    },
                    (payload) => agendarAtualizacaoRealtime(payload)
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
    <div class="space-y-4 sm:space-y-5">
        <!-- Botao Voltar -->
        <div>
            <button
                type="button"
                @click="voltarParaModulos"
                class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 -ml-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
            >
                <ArrowLeft class="w-4 h-4" />
                <span>Voltar para módulos</span>
            </button>
        </div>

        <!-- Estado: Carregando -->
        <Card v-if="carregando">
            <CardContent class="p-10 text-center space-y-2 text-muted-foreground">
                <Loader2 class="w-6 h-6 mx-auto animate-spin text-primary" />
                <p class="text-sm">Carregando atividades do módulo...</p>
            </CardContent>
        </Card>

        <!-- Estado: Erro -->
        <Card v-else-if="erroCarregamento">
            <CardContent class="p-10 text-center space-y-3">
                <AlertCircle class="w-8 h-8 mx-auto text-rose-500" />
                <p class="text-sm font-medium text-foreground">{{ erroCarregamento }}</p>
                <Button size="sm" variant="outline" @click="voltarParaModulos">
                    Voltar para módulos
                </Button>
            </CardContent>
        </Card>

        <template v-else>
            <!-- Cabecalho do Modulo -->
            <Card>
                <CardContent class="p-4 sm:p-5">
                    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div class="flex items-start justify-between gap-3 min-w-0">
                            <div class="min-w-0">
                                <p class="text-xs font-medium text-muted-foreground truncate">
                                    {{ matriculaAtual?.curso?.nome }}
                                </p>
                                <h1 class="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-snug mt-0.5">
                                    {{ moduloAtual?.nome }}
                                </h1>
                            </div>

                            <!-- Pontos no topo no mobile -->
                            <div class="flex lg:hidden items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 shrink-0">
                                <Trophy class="w-4 h-4 text-amber-500 shrink-0" />
                                <span class="text-sm font-bold text-foreground tabular-nums">
                                    {{ pontosTotais }}
                                </span>
                                <span class="text-[11px] font-medium text-muted-foreground">pts</span>
                            </div>
                        </div>

                        <div class="flex flex-col sm:flex-row sm:items-center gap-3 lg:gap-4">
                            <div class="flex-1 lg:w-64 rounded-lg border border-border bg-muted/35 px-3.5 py-2.5 space-y-1.5">
                                <div class="flex items-center justify-between gap-2 text-xs">
                                    <span class="text-muted-foreground">Progresso do módulo</span>
                                    <span class="font-semibold text-foreground tabular-nums">
                                        {{ resumoModulo.concluidas }}/{{ resumoModulo.total }}
                                        <span class="font-normal text-muted-foreground">
                                            ({{ resumoModulo.percentual }}%)
                                        </span>
                                    </span>
                                </div>
                                <div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                    <div
                                        class="h-full rounded-full transition-all duration-300"
                                        :class="resumoModulo.percentual === 100 ? 'bg-emerald-500' : 'bg-primary'"
                                        :style="{ width: `${resumoModulo.percentual}%` }"
                                    ></div>
                                </div>
                            </div>

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
                </CardContent>
            </Card>

            <!-- Busca e Filtros -->
            <div
                v-if="atividadesEnriquecidas.length > 0"
                class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
                <div class="relative flex-1 sm:max-w-xs">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                        v-model="termoPesquisa"
                        placeholder="Buscar atividade..."
                        class="pl-9 h-9 bg-background text-sm"
                    />
                </div>

                <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                    <button
                        v-for="opcao in opcoesFiltroStatus"
                        :key="opcao.value"
                        type="button"
                        @click="filtroStatus = opcao.value"
                        class="rounded-full px-3 py-1.5 text-xs font-medium border whitespace-nowrap transition-colors cursor-pointer shrink-0"
                        :class="
                            filtroStatus === opcao.value
                                ? 'bg-foreground text-background border-foreground'
                                : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                        "
                    >
                        {{ opcao.label }}
                    </button>
                </div>
            </div>

            <!-- Lista de Atividades -->
            <Card class="overflow-hidden">
                <div
                    v-if="atividadesEnriquecidas.length === 0"
                    class="p-10 text-center space-y-2 text-muted-foreground"
                >
                    <BookOpen class="w-9 h-9 mx-auto text-muted-foreground/40" />
                    <p class="text-sm font-medium text-foreground">
                        Este módulo ainda não possui atividades cadastradas.
                    </p>
                </div>

                <div
                    v-else-if="atividadesFiltradas.length === 0"
                    class="p-8 text-center space-y-3 text-muted-foreground"
                >
                    <p class="text-sm font-medium text-foreground">
                        Nenhuma atividade encontrada para o filtro aplicado.
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        @click="termoPesquisa = ''; filtroStatus = 'todas'"
                    >
                        Limpar filtros
                    </Button>
                </div>

                <div v-else class="flex flex-col">
                    <!-- Cabecalho de Colunas (Desktop) -->
                    <div class="hidden lg:flex items-center gap-4 px-5 py-3 border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground">
                        <div class="flex-1">Atividade</div>
                        <div class="w-40">Pontuação</div>
                        <div class="w-52">Material</div>
                        <div class="w-32">Status</div>
                        <div class="w-32 text-right">Ação</div>
                    </div>

                    <div class="divide-y divide-border">
                        <article
                            v-for="(item, index) in atividadesFiltradas"
                            :key="item.id"
                            class="p-4 lg:px-5 lg:py-4 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 hover:bg-muted/30 transition-colors"
                        >
                            <!-- Coluna 1: Titulo e avisos de status -->
                            <div class="flex-1 min-w-0 space-y-1.5">
                                <div class="flex items-start justify-between gap-2">
                                    <div class="flex items-start gap-2 min-w-0">
                                        <span class="text-xs font-semibold text-muted-foreground tabular-nums mt-0.5 shrink-0">
                                            {{ String(item.ordem || index + 1).padStart(2, '0') }}.
                                        </span>
                                        <h2 class="font-semibold text-sm sm:text-[15px] text-foreground leading-snug">
                                            {{ item.nome }}
                                        </h2>
                                    </div>

                                    <!-- Status compacto no mobile -->
                                    <span
                                        v-if="item.estado.solicitacaoAberta"
                                        class="lg:hidden inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 shrink-0"
                                    >
                                        <Clock class="w-3 h-3" />
                                        Aguardando
                                    </span>
                                    <span
                                        v-else-if="item.estado.recusaRecente"
                                        class="lg:hidden inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400 shrink-0"
                                    >
                                        <AlertCircle class="w-3 h-3" />
                                        Ajustar
                                    </span>
                                    <span
                                        v-else-if="item.estado.concluida"
                                        class="lg:hidden inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 shrink-0"
                                    >
                                        <CheckCircle2 class="w-3 h-3" />
                                        Feita {{ item.estado.vezesConcluida > 1 ? `${item.estado.vezesConcluida}x` : '' }}
                                    </span>
                                </div>

                                <!-- Aviso discreto de solicitacao pendente -->
                                <p
                                    v-if="item.estado.solicitacaoAberta"
                                    class="pl-6 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5"
                                >
                                    <Clock class="w-3.5 h-3.5 shrink-0" />
                                    <span>
                                        Enviada
                                        <template v-if="item.estado.solicitacaoAberta.solicitada_em">
                                            {{ formatarTempoRelativo(item.estado.solicitacaoAberta.solicitada_em) }}
                                        </template>
                                        · aguardando confirmação do professor
                                    </span>
                                </p>

                                <!-- Aviso discreto de recusa com observacao -->
                                <div
                                    v-else-if="item.estado.recusaRecente"
                                    class="ml-6 rounded-md border border-rose-500/25 bg-rose-500/5 px-2.5 py-1.5 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-1.5"
                                >
                                    <MessageSquare class="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                    <span>
                                        <strong>Professor:</strong>
                                        {{
                                            item.estado.recusaRecente.observacao_professor ||
                                            'Revise a atividade e envie novamente.'
                                        }}
                                    </span>
                                </div>
                            </div>

                            <!-- Coluna 2: Dificuldade e Pontos -->
                            <div class="lg:w-40 pl-6 lg:pl-0 flex flex-wrap lg:flex-col items-center lg:items-start gap-x-2.5 gap-y-0.5 shrink-0">
                                <div class="flex items-center gap-2">
                                    <span
                                        class="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium border leading-none"
                                        :class="getEstiloDificuldade(item.dificuldade).classe"
                                    >
                                        {{ getEstiloDificuldade(item.dificuldade).texto }}
                                    </span>
                                    <span class="text-xs font-semibold text-foreground tabular-nums">
                                        +{{ item.pontosProxima }} pts
                                    </span>
                                </div>
                                <span
                                    v-if="item.ehRevisao"
                                    class="text-[11px] text-muted-foreground"
                                >
                                    Revisão (50%)
                                </span>
                            </div>

                            <!-- Coluna 3: Materiais (links) -->
                            <div class="lg:w-52 pl-6 lg:pl-0 flex flex-wrap items-center gap-1.5 shrink-0">
                                <template v-if="item.canais.length > 0">
                                    <a
                                        v-for="canal in item.canais"
                                        :key="canal.tipo"
                                        :href="canal.url"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="inline-flex items-center justify-center gap-1.5 h-9 lg:h-8 px-2.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground transition-colors active:scale-[0.98]"
                                    >
                                        <FileText
                                            v-if="canal.tipo === 'pdf'"
                                            class="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0"
                                        />
                                        <img
                                            v-else-if="canal.tipo === 'drive'"
                                            :src="googleDriveIcon"
                                            alt="Google Drive"
                                            class="w-3.5 h-3.5 object-contain shrink-0"
                                        />
                                        <img
                                            v-else-if="canal.tipo === 'mega'"
                                            :src="megaLogoIcon"
                                            alt="Mega"
                                            class="w-3.5 h-3.5 object-contain shrink-0"
                                        />
                                        <ExternalLink
                                            v-else
                                            class="w-3.5 h-3.5 text-muted-foreground shrink-0"
                                        />
                                        <span>{{ canal.label }}</span>
                                    </a>
                                </template>
                                <span v-else class="text-xs text-muted-foreground">
                                    Sem material
                                </span>
                            </div>

                            <!-- Coluna 4: Status (Desktop) -->
                            <div class="hidden lg:flex w-32 items-center shrink-0">
                                <span
                                    v-if="item.estado.solicitacaoAberta"
                                    class="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400"
                                >
                                    <Clock class="w-3.5 h-3.5 shrink-0" />
                                    Aguardando
                                </span>
                                <span
                                    v-else-if="item.estado.recusaRecente"
                                    class="inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400"
                                >
                                    <AlertCircle class="w-3.5 h-3.5 shrink-0" />
                                    Ajustar
                                </span>
                                <span
                                    v-else-if="item.estado.concluida"
                                    class="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                                >
                                    <CheckCircle2 class="w-3.5 h-3.5 shrink-0" />
                                    Concluída{{ item.estado.vezesConcluida > 1 ? ` (${item.estado.vezesConcluida}x)` : '' }}
                                </span>
                                <span v-else class="text-xs text-muted-foreground">
                                    Pendente
                                </span>
                            </div>

                            <!-- Coluna 5: Botao Unico de Acao -->
                            <div class="lg:w-32 pl-6 lg:pl-0 pt-1 lg:pt-0 flex lg:justify-end shrink-0">
                                <Button
                                    size="sm"
                                    :variant="obterBotaoAcao(item).variant"
                                    class="h-10 lg:h-8 w-full lg:w-auto px-3.5 text-xs"
                                    :class="obterBotaoAcao(item).classe"
                                    @click="abrirModalValidacao(item)"
                                >
                                    <component
                                        :is="obterBotaoAcao(item).icone"
                                        class="w-3.5 h-3.5 mr-1.5"
                                    />
                                    {{ obterBotaoAcao(item).label }}
                                </Button>
                            </div>
                        </article>
                    </div>
                </div>
            </Card>
        </template>

        <!-- Modal Unificado: Escolha entre Validacao Presencial (Codigo) ou Remota -->
        <Modal
            v-model="modalValidacaoAberto"
            title="Validar Atividade"
            description="Escolha como deseja confirmar a conclusão desta atividade."
            size="sm"
        >
            <div v-if="atividadeModalAtual" class="space-y-4 p-1">
                <!-- Resumo da atividade -->
                <div class="rounded-lg border border-border bg-muted/40 p-3 flex items-center justify-between gap-3">
                    <div class="min-w-0">
                        <p class="text-sm font-semibold text-foreground leading-snug truncate">
                            {{ atividadeModalAtual.nome }}
                        </p>
                        <p class="text-xs text-muted-foreground mt-0.5">
                            {{
                                atividadeModalAtual.ehRevisao
                                    ? `Revisão #${atividadeModalAtual.estado.vezesConcluida + 1} (50% dos pontos)`
                                    : '1ª conclusão (100% dos pontos)'
                            }}
                        </p>
                    </div>
                    <span class="text-xs font-bold text-foreground tabular-nums shrink-0 rounded-md bg-background border border-border px-2 py-1">
                        +{{ atividadeModalAtual.pontosProxima }} pts
                    </span>
                </div>

                <!-- Seletor dos dois caminhos -->
                <div class="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        @click="modoValidacao = 'codigo'"
                        class="flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors cursor-pointer"
                        :class="
                            modoValidacao === 'codigo'
                                ? 'border-primary bg-primary/8 text-foreground'
                                : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                        "
                    >
                        <KeyRound
                            class="w-4 h-4"
                            :class="modoValidacao === 'codigo' ? 'text-primary' : 'text-muted-foreground'"
                        />
                        <span class="text-xs font-semibold text-foreground leading-tight">
                            Professor está aqui
                        </span>
                        <span class="text-[11px] text-muted-foreground leading-tight">
                            Código na hora
                        </span>
                    </button>

                    <button
                        type="button"
                        @click="modoValidacao = 'remoto'"
                        class="flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors cursor-pointer"
                        :class="
                            modoValidacao === 'remoto'
                                ? 'border-primary bg-primary/8 text-foreground'
                                : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                        "
                    >
                        <Send
                            class="w-4 h-4"
                            :class="modoValidacao === 'remoto' ? 'text-primary' : 'text-muted-foreground'"
                        />
                        <span class="text-xs font-semibold text-foreground leading-tight">
                            Enviar para validar
                        </span>
                        <span class="text-[11px] text-muted-foreground leading-tight">
                            Professor aprova depois
                        </span>
                    </button>
                </div>

                <!-- Painel 1: Codigo presencial -->
                <form
                    v-if="modoValidacao === 'codigo'"
                    class="space-y-3"
                    @submit.prevent="confirmarPorCodigo"
                >
                    <FormGroup label="Código do Professor" id="codigo-professor-modal">
                        <div class="relative">
                            <KeyRound class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <Input
                                id="codigo-professor-modal"
                                v-model="codigoProfessor"
                                :type="mostrarCodigo ? 'text' : 'password'"
                                autocomplete="new-password"
                                placeholder="Peça ao professor para digitar..."
                                class="pl-9 pr-10 h-11 text-base"
                                :disabled="processandoValidacao"
                            />
                            <button
                                type="button"
                                @click="mostrarCodigo = !mostrarCodigo"
                                class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                                :aria-label="mostrarCodigo ? 'Ocultar código' : 'Mostrar código'"
                            >
                                <EyeOff v-if="mostrarCodigo" class="w-4 h-4" />
                                <Eye v-else class="w-4 h-4" />
                            </button>
                        </div>
                    </FormGroup>

                    <div class="flex items-center justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            @click="modalValidacaoAberto = false"
                            :disabled="processandoValidacao"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="default"
                            :disabled="processandoValidacao || !codigoProfessor.trim()"
                        >
                            <Loader2 v-if="processandoValidacao" class="w-4 h-4 mr-1.5 animate-spin" />
                            <CheckCircle2 v-else class="w-4 h-4 mr-1.5" />
                            {{ processandoValidacao ? 'Validando...' : 'Confirmar Conclusão' }}
                        </Button>
                    </div>
                </form>

                <!-- Painel 2: Solicitacao remota -->
                <div v-else class="space-y-3">
                    <div
                        v-if="atividadeModalAtual.estado.solicitacaoAberta"
                        class="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1"
                    >
                        <p class="font-semibold flex items-center gap-1.5">
                            <Clock class="w-3.5 h-3.5 shrink-0" />
                            Solicitação já enviada
                        </p>
                        <p>
                            Aguarde o professor confirmar no painel. Se ele estiver perto de você agora, basta selecionar
                            <strong>Professor está aqui</strong> acima para concluir na hora.
                        </p>
                    </div>

                    <p v-else class="text-xs text-muted-foreground leading-relaxed">
                        Sua solicitação será enviada para a fila do professor. Assim que ele confirmar a atividade,
                        os <strong class="text-foreground">+{{ atividadeModalAtual.pontosProxima }} pts</strong> serão
                        somados automaticamente.
                    </p>

                    <div class="flex items-center justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            @click="modalValidacaoAberto = false"
                            :disabled="processandoValidacao"
                        >
                            Fechar
                        </Button>
                        <Button
                            v-if="!atividadeModalAtual.estado.solicitacaoAberta"
                            type="button"
                            variant="default"
                            :disabled="processandoValidacao"
                            @click="enviarSolicitacaoRemota"
                        >
                            <Loader2 v-if="processandoValidacao" class="w-4 h-4 mr-1.5 animate-spin" />
                            <Send v-else class="w-4 h-4 mr-1.5" />
                            {{ processandoValidacao ? 'Enviando...' : 'Enviar Solicitação' }}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    </div>
</template>