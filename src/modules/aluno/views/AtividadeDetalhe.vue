<script setup>
    import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
    import { useRouter, useRoute } from 'vue-router';
    import { supabase, sincronizarRealtimeAuth } from '@/lib/supabase';
    import {
        ArrowLeft,
        CheckCircle2,
        Clock,
        AlertCircle,
        FileText,
        ExternalLink,
        KeyRound,
        Send,
        RotateCcw,
        Loader2,
        Eye,
        EyeOff,
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
    const atividadeBruta = ref(null);
    const historicoAtividade = ref([]);

    // Modal: Validacao presencial (codigo do professor)
    const modalCodigoAberto = ref(false);
    const codigoProfessor = ref('');
    const mostrarCodigo = ref(false);
    const validandoCodigo = ref(false);

    // Modal: Confirmacao de solicitacao remota
    const modalSolicitarAberto = ref(false);
    const enviandoSolicitacao = ref(false);

    let realtimeChannel = null;
    let realtimeTimer = null;

    const cursoIdParam = computed(() => Number(route.params.cursoId));
    const moduloIdParam = computed(() => Number(route.params.moduloId));
    const atividadeIdParam = computed(() => String(route.params.atividadeId || ''));

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

    const estado = computed(() => {
        const registros = historicoAtividade.value;
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

        return {
            vezesConcluida: concluidas.length,
            concluida: concluidas.length > 0,
            solicitacaoAberta,
            recusaRecente
        };
    });

    const ehRevisao = computed(() => estado.value.vezesConcluida > 0);

    const pontosProxima = computed(() => {
        const base = Number(atividadeBruta.value?.dificuldade?.pontos) || 0;
        if (!base) return 0;
        return ehRevisao.value ? Math.ceil(base * 0.5) : base;
    });

    const canais = computed(() => {
        const item = atividadeBruta.value;
        if (!item) return [];

        const lista = [];
        if (item.pdf_url) lista.push({ tipo: 'pdf', label: 'Abrir PDF', url: item.pdf_url });
        if (item.drive_url) lista.push({ tipo: 'drive', label: 'Google Drive', url: item.drive_url });
        if (item.mega_url) lista.push({ tipo: 'mega', label: 'Mega', url: item.mega_url });
        if (item.outro_url) lista.push({ tipo: 'outro', label: 'Link externo', url: item.outro_url });
        return lista;
    });

    const voltarParaLista = () => {
        router.push(`/aluno/atividades/${cursoIdParam.value}/${moduloIdParam.value}`);
    };

    const abrirModalCodigo = () => {
        codigoProfessor.value = '';
        mostrarCodigo.value = false;
        modalCodigoAberto.value = true;
    };

    const abrirModalSolicitar = () => {
        if (estado.value.solicitacaoAberta) return;
        modalSolicitarAberto.value = true;
    };

    watch(modalCodigoAberto, (aberto) => {
        if (!aberto) {
            codigoProfessor.value = '';
            mostrarCodigo.value = false;
        }
    });

    // ========================================================
    // CARREGAMENTO DE DADOS
    // ========================================================

    const carregarHistorico = async () => {
        if (!alunoId.value || !atividadeIdParam.value) return;

        const { data, error } = await supabase
            .from('aluno_atividade')
            .select(
                'id, atividade_id, tentativa, status, metodo_validacao, pontos_ganhos, observacao_professor, solicitada_em, concluida_em, criado_em, atualizado_em'
            )
            .eq('aluno_id', alunoId.value)
            .eq('atividade_id', atividadeIdParam.value);

        if (error) throw error;
        historicoAtividade.value = data || [];
    };

    const carregarAtividade = async () => {
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

            if (!cursoIdParam.value || !moduloIdParam.value || !atividadeIdParam.value) {
                erroCarregamento.value = 'Atividade inválida.';
                return;
            }

            const [resMatriculas, resVinculo, resAtividade, resHistorico] = await Promise.all([
                supabase
                    .from('matricula')
                    .select('id, curso_id, situacao, curso:curso_id ( id, nome )')
                    .eq('aluno_id', alunoId.value)
                    .eq('curso_id', cursoIdParam.value)
                    .in('situacao', ['cursando', 'concluido'])
                    .order('id', { ascending: false }),
                supabase
                    .from('curso_modulo')
                    .select('modulo_id, modulo:modulo_id ( id, nome )')
                    .eq('curso_id', cursoIdParam.value)
                    .eq('modulo_id', moduloIdParam.value)
                    .limit(1),
                supabase
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
                    .eq('id', atividadeIdParam.value)
                    .eq('modulo_id', moduloIdParam.value)
                    .limit(1),
                supabase
                    .from('aluno_atividade')
                    .select(
                        'id, atividade_id, tentativa, status, metodo_validacao, pontos_ganhos, observacao_professor, solicitada_em, concluida_em, criado_em, atualizado_em'
                    )
                    .eq('aluno_id', alunoId.value)
                    .eq('atividade_id', atividadeIdParam.value)
            ]);

            if (resMatriculas.error) throw resMatriculas.error;
            if (resVinculo.error) throw resVinculo.error;
            if (resAtividade.error) throw resAtividade.error;
            if (resHistorico.error) throw resHistorico.error;

            const listaMat = resMatriculas.data || [];
            const matricula = listaMat.find(m => m.situacao === 'cursando') || listaMat[0] || null;
            const vinculo = resVinculo.data?.[0] || null;
            const atividade = resAtividade.data?.[0] || null;

            if (!matricula) {
                erroCarregamento.value = 'Você não possui acesso a este curso.';
                return;
            }

            if (!vinculo?.modulo || !atividade) {
                erroCarregamento.value = 'Atividade não encontrada.';
                return;
            }

            matriculaAtual.value = matricula;
            moduloAtual.value = vinculo.modulo;
            atividadeBruta.value = atividade;
            historicoAtividade.value = resHistorico.data || [];
        } catch (err) {
            console.error('Erro ao carregar atividade:', err);
            erroCarregamento.value = 'Não foi possível carregar esta atividade.';
            toast.error('Erro', 'Não foi possível carregar a atividade.');
        } finally {
            carregando.value = false;
        }
    };

    const agendarAtualizacaoRealtime = (payload) => {
        clearTimeout(realtimeTimer);
        realtimeTimer = setTimeout(async () => {
            try {
                await carregarHistorico();

                if (!validandoCodigo.value && !enviandoSolicitacao.value && payload?.eventType === 'UPDATE') {
                    const novo = payload.new;
                    const antigo = payload.old;

                    if (novo?.atividade_id !== atividadeIdParam.value) return;

                    if (novo?.status === 'concluida' && antigo?.status !== 'concluida') {
                        toast.success(
                            'Atividade confirmada!',
                            `+${novo.pontos_ganhos || 0} pts adicionados.`
                        );
                    } else if (novo?.status === 'recusada' && antigo?.status !== 'recusada') {
                        toast.error(
                            'Ajuste solicitado',
                            'Confira a observação do professor.'
                        );
                    }
                }
            } catch (err) {
                console.error('Erro ao sincronizar atividade em tempo real:', err);
            }
        }, 250);
    };

    // ========================================================
    // ACOES DE VALIDACAO (RPCs SEGURAS)
    // ========================================================

    const confirmarPorCodigo = async () => {
        if (!atividadeBruta.value || validandoCodigo.value) return;

        const codigoLimpo = codigoProfessor.value.trim();
        if (!codigoLimpo) {
            toast.error('Atenção', 'Informe o código do professor.');
            return;
        }

        validandoCodigo.value = true;
        try {
            const { data, error } = await supabase.rpc('concluir_atividade_por_codigo', {
                p_atividade_id: atividadeBruta.value.id,
                p_codigo_professor: codigoLimpo,
                p_matricula_id: matriculaAtual.value?.id || null
            });

            if (error) throw error;

            const pontos = data?.pontos_ganhos ?? pontosProxima.value;
            toast.success('Atividade concluída!', `+${pontos} pts adicionados.`);

            modalCodigoAberto.value = false;
            await carregarHistorico();
        } catch (err) {
            console.error('Erro ao validar por código:', err);
            toast.error('Código não aceito', err?.message || 'Verifique o código e tente novamente.');
        } finally {
            validandoCodigo.value = false;
        }
    };

    const confirmarSolicitacaoRemota = async () => {
        if (!atividadeBruta.value || enviandoSolicitacao.value || estado.value.solicitacaoAberta) return;

        enviandoSolicitacao.value = true;
        try {
            const { error } = await supabase.rpc('solicitar_conclusao_atividade', {
                p_atividade_id: atividadeBruta.value.id,
                p_matricula_id: matriculaAtual.value?.id || null
            });

            if (error) throw error;

            toast.success('Solicitação enviada', 'Aguardando confirmação do professor.');

            modalSolicitarAberto.value = false;
            await carregarHistorico();
        } catch (err) {
            console.error('Erro ao solicitar validação:', err);
            toast.error('Não foi possível enviar', err?.message || 'Tente novamente.');
        } finally {
            enviandoSolicitacao.value = false;
        }
    };

    watch([cursoIdParam, moduloIdParam, atividadeIdParam], () => {
        carregarAtividade();
    });

    onMounted(async () => {
        carregarSessaoAluno();
        await carregarAtividade();

        if (alunoId.value) {
            sincronizarRealtimeAuth();

            realtimeChannel = supabase
                .channel(`aluno_atividade_detalhe_${alunoId.value}`)
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
    <div class="space-y-4 max-w-3xl mx-auto">
        <!-- Voltar -->
        <div>
            <button
                type="button"
                @click="voltarParaLista"
                class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 -ml-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
            >
                <ArrowLeft class="w-4 h-4" />
                <span>{{ moduloAtual?.nome || 'Atividades' }}</span>
            </button>
        </div>

        <!-- Carregando -->
        <Card v-if="carregando">
            <CardContent class="p-10 text-center space-y-2 text-muted-foreground">
                <Loader2 class="w-6 h-6 mx-auto animate-spin text-primary" />
                <p class="text-sm">Carregando atividade...</p>
            </CardContent>
        </Card>

        <!-- Erro -->
        <Card v-else-if="erroCarregamento">
            <CardContent class="p-10 text-center space-y-3">
                <AlertCircle class="w-8 h-8 mx-auto text-rose-500" />
                <p class="text-sm font-medium text-foreground">{{ erroCarregamento }}</p>
                <Button size="sm" variant="outline" @click="voltarParaLista">
                    Voltar
                </Button>
            </CardContent>
        </Card>

        <Card v-else-if="atividadeBruta">
            <CardContent class="p-5 sm:p-6 space-y-6">
                <!-- Cabecalho enxuto -->
                <div class="space-y-2 border-b border-border pb-4">
                    <p class="text-xs text-muted-foreground truncate">
                        {{ matriculaAtual?.curso?.nome }} · {{ moduloAtual?.nome }}
                    </p>

                    <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug">
                        {{ atividadeBruta.nome }}
                    </h1>

                    <div class="flex flex-wrap items-center gap-2 pt-0.5">
                        <span
                            class="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium border leading-none"
                            :class="getEstiloDificuldade(atividadeBruta.dificuldade).classe"
                        >
                            {{ getEstiloDificuldade(atividadeBruta.dificuldade).texto }}
                        </span>

                        <span class="text-xs font-semibold text-foreground tabular-nums">
                            +{{ pontosProxima }} pts
                            <span v-if="ehRevisao" class="font-normal text-muted-foreground">
                                (revisão)
                            </span>
                        </span>

                        <span
                            v-if="estado.concluida"
                            class="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                        >
                            ·
                            <CheckCircle2 class="w-3.5 h-3.5 shrink-0" />
                            Concluída{{ estado.vezesConcluida > 1 ? ` ${estado.vezesConcluida}x` : '' }}
                        </span>
                    </div>
                </div>

                <!-- Status de recusa ou solicitacao pendente -->
                <div
                    v-if="estado.recusaRecente"
                    class="rounded-lg border border-rose-500/25 bg-rose-500/5 px-3.5 py-3 text-xs sm:text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2.5"
                >
                    <MessageSquare class="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                        <p class="font-semibold">Ajuste solicitado pelo professor</p>
                        <p v-if="estado.recusaRecente.observacao_professor" class="mt-0.5 opacity-90">
                            {{ estado.recusaRecente.observacao_professor }}
                        </p>
                    </div>
                </div>

                <div
                    v-else-if="estado.solicitacaoAberta"
                    class="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3.5 py-3 text-xs sm:text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2.5"
                >
                    <Clock class="w-4 h-4 shrink-0" />
                    <span>
                        Aguardando confirmação do professor
                        <template v-if="estado.solicitacaoAberta.solicitada_em">
                            · enviada {{ formatarTempoRelativo(estado.solicitacaoAberta.solicitada_em) }}
                        </template>
                    </span>
                </div>

                <!-- Materiais (Links de acesso) -->
                <section class="space-y-2.5">
                    <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Materiais
                    </h2>

                    <div
                        v-if="canais.length > 0"
                        class="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                    >
                        <a
                            v-for="(canal, index) in canais"
                            :key="canal.tipo"
                            :href="canal.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="flex items-center justify-between gap-3 h-12 px-4 rounded-xl border font-medium text-sm transition-all active:scale-[0.99]"
                            :class="
                                index === 0
                                    ? 'bg-primary text-primary-foreground border-primary hover:opacity-95 shadow-xs'
                                    : 'bg-background text-foreground border-border hover:bg-muted/60'
                            "
                        >
                            <div class="flex items-center gap-2.5 min-w-0">
                                <FileText
                                    v-if="canal.tipo === 'pdf'"
                                    class="w-4 h-4 shrink-0"
                                    :class="index === 0 ? 'text-primary-foreground' : 'text-rose-600 dark:text-rose-400'"
                                />
                                <img
                                    v-else-if="canal.tipo === 'drive'"
                                    :src="googleDriveIcon"
                                    alt="Google Drive"
                                    class="w-4 h-4 object-contain shrink-0"
                                />
                                <img
                                    v-else-if="canal.tipo === 'mega'"
                                    :src="megaLogoIcon"
                                    alt="Mega"
                                    class="w-4 h-4 object-contain shrink-0"
                                />
                                <ExternalLink v-else class="w-4 h-4 shrink-0" />
                                <span class="truncate">{{ canal.label }}</span>
                            </div>

                            <ExternalLink class="w-4 h-4 opacity-70 shrink-0" />
                        </a>
                    </div>

                    <p
                        v-else
                        class="rounded-lg border border-dashed border-border px-4 py-3 text-xs text-muted-foreground"
                    >
                        Nenhum link anexado.
                    </p>
                </section>

                <!-- Validacao / Conclusao -->
                <section class="space-y-2.5 pt-2 border-t border-border">
                    <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {{ ehRevisao ? 'Revisão' : 'Conclusão' }}
                    </h2>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <Button
                            variant="outline"
                            class="h-11 w-full bg-background border-border text-foreground hover:bg-muted"
                            @click="abrirModalCodigo"
                        >
                            <KeyRound class="w-4 h-4 mr-2" />
                            <span>{{ ehRevisao ? 'Refazer com código' : 'Validar com código' }}</span>
                        </Button>

                        <Button
                            variant="outline"
                            class="h-11 w-full bg-background border-border text-foreground hover:bg-muted"
                            :disabled="Boolean(estado.solicitacaoAberta)"
                            @click="abrirModalSolicitar"
                        >
                            <Clock v-if="estado.solicitacaoAberta" class="w-4 h-4 mr-2" />
                            <RotateCcw v-else-if="ehRevisao" class="w-4 h-4 mr-2" />
                            <Send v-else class="w-4 h-4 mr-2" />
                            <span>
                                {{
                                    estado.solicitacaoAberta
                                        ? 'Solicitação enviada'
                                        : ehRevisao
                                            ? 'Solicitar revisão'
                                            : 'Solicitar validação'
                                }}
                            </span>
                        </Button>
                    </div>
                </section>
            </CardContent>
        </Card>

        <!-- Modal: Codigo do Professor -->
        <Modal
            v-model="modalCodigoAberto"
            title="Validar com código"
            size="sm"
        >
            <form class="space-y-4 p-1" @submit.prevent="confirmarPorCodigo">
                <FormGroup label="Código do Professor" id="codigo-professor-atividade">
                    <div class="relative">
                        <KeyRound class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                            id="codigo-professor-atividade"
                            v-model="codigoProfessor"
                            :type="mostrarCodigo ? 'text' : 'password'"
                            autocomplete="new-password"
                            placeholder="Digite o código..."
                            class="pl-9 pr-10 h-11 text-base"
                            :disabled="validandoCodigo"
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

                <div class="flex items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        @click="modalCodigoAberto = false"
                        :disabled="validandoCodigo"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        variant="default"
                        :disabled="validandoCodigo || !codigoProfessor.trim()"
                    >
                        <Loader2 v-if="validandoCodigo" class="w-4 h-4 mr-1.5 animate-spin" />
                        <CheckCircle2 v-else class="w-4 h-4 mr-1.5" />
                        {{ validandoCodigo ? 'Validando...' : 'Confirmar' }}
                    </Button>
                </div>
            </form>
        </Modal>

        <!-- Modal: Confirmar Solicitacao Remota -->
        <Modal
            v-model="modalSolicitarAberto"
            title="Solicitar validação"
            size="sm"
        >
            <div v-if="atividadeBruta" class="space-y-3 p-1 text-sm text-muted-foreground">
                <p>
                    Enviar <strong class="text-foreground">{{ atividadeBruta.nome }}</strong>
                    para confirmação do professor?
                </p>
                <div class="rounded-lg border border-border bg-muted/40 px-3 py-2 flex items-center justify-between text-xs">
                    <span>Pontuação</span>
                    <span class="font-bold text-foreground tabular-nums">
                        +{{ pontosProxima }} pts
                        <template v-if="ehRevisao">(revisão)</template>
                    </span>
                </div>
            </div>

            <template #footer>
                <Button
                    variant="ghost"
                    @click="modalSolicitarAberto = false"
                    :disabled="enviandoSolicitacao"
                >
                    Cancelar
                </Button>
                <Button
                    variant="default"
                    @click="confirmarSolicitacaoRemota"
                    :disabled="enviandoSolicitacao"
                >
                    <Loader2 v-if="enviandoSolicitacao" class="w-4 h-4 mr-1.5 animate-spin" />
                    <Send v-else class="w-4 h-4 mr-1.5" />
                    {{ enviandoSolicitacao ? 'Enviando...' : 'Enviar' }}
                </Button>
            </template>
        </Modal>
    </div>
</template>