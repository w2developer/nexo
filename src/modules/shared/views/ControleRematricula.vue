<script setup>
    import { ref, computed, onMounted, onUnmounted } from 'vue';
    import { useRouter } from 'vue-router';
    import {
        Search, Clock, Handshake, CheckCircle2, XCircle,
        MessageSquarePlus, BookOpen, MessageSquare
    } from '@lucide/vue';
    import { supabase } from '@/lib/supabase';
    import { toast } from '@/composables/useToast';
    import { formatarNome } from '@/utils/formatters';
    import { formatarDataBR } from '@/utils/dateHelpers';

    import Card from '@/components/ui/Card.vue';
    import CardHeader from '@/components/ui/CardHeader.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Button from '@/components/ui/Button.vue';
    import Input from '@/components/ui/Input.vue';
    import Select from '@/components/ui/Select.vue';
    import Badge from '@/components/ui/Badge.vue';
    import Avatar from '@/components/ui/Avatar.vue';
    import Tooltip from '@/components/ui/Tooltip.vue';
    import Table from '@/components/ui/Table.vue';
    import TableHeader from '@/components/ui/TableHeader.vue';
    import TableBody from '@/components/ui/TableBody.vue';
    import TableRow from '@/components/ui/TableRow.vue';
    import TableHead from '@/components/ui/TableHead.vue';
    import TableCell from '@/components/ui/TableCell.vue';

    import ModalRematricula from '../components/ModalRematricula.vue';

    const router = useRouter();

    const filasBrutas = ref([]);
    const carregando = ref(true);
    const tipoUsuario = ref('secretaria');
    let realtimeChannel = null;

    // Filtros
    const statusFiltro = ref('todos');
    const origemFiltro = ref('todas');
    const termoPesquisa = ref('');

    const opcoesOrigem = [
        { value: 'todas', label: 'Todos os critérios' },
        { value: 'reta_final', label: 'Reta Final (≤ 30 dias)' },
        { value: 'concluido', label: '100% Concluídos' }
    ];

    // Modal
    const modalAberto = ref(false);
    const itemSelecionado = ref(null);

    // Consulta direto da View do PostgreSQL
    const carregarDados = async (silencioso = false) => {
        if (!silencioso) carregando.value = true;

        try {
            const { data, error } = await supabase
                .from('vw_fila_rematricula')
                .select('*');

            if (error) throw error;
            filasBrutas.value = data || [];
        } catch (err) {
            console.error('Erro ao carregar fila de rematrícula:', err);
            toast.error('Erro', 'Não foi possível carregar a fila de rematrículas.');
        } finally {
            if (!silencioso) carregando.value = false;
        }
    };

    // Formata os registros vindos da View para exibição
    const qualificados = computed(() => {
        return filasBrutas.value.map(row => {
            let motivoQualificacao = '100% Concluído';
            let resumoCurso = `Último concluído: ${row.curso_gatilho_nome}`;

            if (row.origem === 'reta_final') {
                const dias = row.dias_restantes;
                motivoQualificacao = dias < 0
                    ? `Vencido há ${Math.abs(dias)}d`
                    : dias === 0
                        ? 'Termina hoje'
                        : `Faltam ${dias} dias`;
                resumoCurso = `Terminando: ${row.curso_gatilho_nome}`;
            }

            return {
                aluno: {
                    id: row.aluno_id,
                    nome: row.aluno_nome,
                    codigo: row.aluno_codigo
                },
                matriculaGatilhoId: row.matricula_gatilho_id,
                cursoGatilhoNome: row.curso_gatilho_nome,
                origem: row.origem,
                motivoQualificacao,
                resumoCurso,
                status: row.status,
                usuario_nome: row.usuario_nome,
                observacao: row.observacao,
                historico: row.historico || [],
                atualizado_em: row.atualizado_em
            };
        });
    });

    // Contadores para os KPIs
    const contadores = computed(() => {
        const base = {
            pendente: 0,
            em_negociacao: 0,
            rematriculado: 0,
            nao_rematriculado: 0
        };
        qualificados.value.forEach(item => {
            if (base[item.status] !== undefined) base[item.status]++;
        });
        return base;
    });

    // Filtros combinados
    const itensFiltrados = computed(() => {
        const termo = termoPesquisa.value.toLowerCase().trim();

        return qualificados.value.filter(item => {
            const bateStatus = statusFiltro.value === 'todos' || item.status === statusFiltro.value;
            const bateOrigem = origemFiltro.value === 'todas' || item.origem === origemFiltro.value;
            const bateTexto = !termo ||
                item.aluno.nome.toLowerCase().includes(termo) ||
                item.aluno.codigo.toLowerCase().includes(termo) ||
                item.resumoCurso.toLowerCase().includes(termo);

            return bateStatus && bateOrigem && bateTexto;
        });
    });

    // Estilo do Badge de status comercial
    const badgeStatus = (status) => {
        const configs = {
            pendente: {
                texto: 'Pendente',
                classe: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
            },
            em_negociacao: {
                texto: 'Em Negociação',
                classe: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30'
            },
            rematriculado: {
                texto: 'Rematriculado',
                classe: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
            },
            nao_rematriculado: {
                texto: 'Não Rematriculado',
                classe: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'
            }
        };
        return configs[status] || configs.pendente;
    };

    const abrirModalAtendimento = (item) => {
        itemSelecionado.value = item;
        modalAberto.value = true;
    };

    const irParaNovaMatricula = (alunoId) => {
        router.push(`/${tipoUsuario.value}/nova-matricula/${alunoId}`);
    };

    onMounted(() => {
        const tipoSalvo = sessionStorage.getItem('tipo_usuario');
        if (tipoSalvo) tipoUsuario.value = tipoSalvo;

        carregarDados();

        // Sincroniza quando houver alteração em matrículas, alunos ou atendimentos
        realtimeChannel = supabase
            .channel('rematricula_view_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'controle_rematricula' }, () => {
                carregarDados(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'matricula' }, () => {
                carregarDados(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'aluno' }, () => {
                carregarDados(true);
            })
            .subscribe();
    });

    onUnmounted(() => {
        if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    });
</script>

<template>
    <div class="space-y-6">
        <!-- Cards de Resumo (2x2 no Mobile, 4 colunas no Desktop) -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card
                class="cursor-pointer transition-all hover:shadow-md border-2"
                :class="statusFiltro === 'pendente' ? 'border-amber-500 bg-amber-500/10' : 'border-transparent'"
                @click="statusFiltro = statusFiltro === 'pendente' ? 'todos' : 'pendente'"
            >
                <CardContent class="p-3 sm:p-4 flex items-center justify-between gap-2">
                    <div class="min-w-0">
                        <p class="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                            Pendentes
                        </p>
                        <p class="text-xl sm:text-2xl font-bold text-foreground mt-0.5">
                            {{ contadores.pendente }}
                        </p>
                        <span class="hidden sm:inline text-xs text-amber-600 dark:text-amber-400 font-medium">
                            Aguardando abordagem
                        </span>
                    </div>
                    <div class="p-2.5 sm:p-3 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                        <Clock class="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                </CardContent>
            </Card>

            <Card
                class="cursor-pointer transition-all hover:shadow-md border-2"
                :class="statusFiltro === 'em_negociacao' ? 'border-violet-500 bg-violet-500/10' : 'border-transparent'"
                @click="statusFiltro = statusFiltro === 'em_negociacao' ? 'todos' : 'em_negociacao'"
            >
                <CardContent class="p-3 sm:p-4 flex items-center justify-between gap-2">
                    <div class="min-w-0">
                        <p class="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                            Em Negociação
                        </p>
                        <p class="text-xl sm:text-2xl font-bold text-foreground mt-0.5">
                            {{ contadores.em_negociacao }}
                        </p>
                        <span class="hidden sm:inline text-xs text-violet-600 dark:text-violet-400 font-medium">
                            Proposta em andamento
                        </span>
                    </div>
                    <div class="p-2.5 sm:p-3 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 shrink-0">
                        <Handshake class="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                </CardContent>
            </Card>

            <Card
                class="cursor-pointer transition-all hover:shadow-md border-2"
                :class="statusFiltro === 'rematriculado' ? 'border-emerald-500 bg-emerald-500/10' : 'border-transparent'"
                @click="statusFiltro = statusFiltro === 'rematriculado' ? 'todos' : 'rematriculado'"
            >
                <CardContent class="p-3 sm:p-4 flex items-center justify-between gap-2">
                    <div class="min-w-0">
                        <p class="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                            Rematriculados
                        </p>
                        <p class="text-xl sm:text-2xl font-bold text-foreground mt-0.5">
                            {{ contadores.rematriculado }}
                        </p>
                        <span class="hidden sm:inline text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            Renovações fechadas
                        </span>
                    </div>
                    <div class="p-2.5 sm:p-3 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <CheckCircle2 class="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                </CardContent>
            </Card>

            <Card
                class="cursor-pointer transition-all hover:shadow-md border-2"
                :class="statusFiltro === 'nao_rematriculado' ? 'border-rose-500 bg-rose-500/10' : 'border-transparent'"
                @click="statusFiltro = statusFiltro === 'nao_rematriculado' ? 'todos' : 'nao_rematriculado'"
            >
                <CardContent class="p-3 sm:p-4 flex items-center justify-between gap-2">
                    <div class="min-w-0">
                        <p class="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                            Não Rematriculados
                        </p>
                        <p class="text-xl sm:text-2xl font-bold text-foreground mt-0.5">
                            {{ contadores.nao_rematriculado }}
                        </p>
                        <span class="hidden sm:inline text-xs text-rose-600 dark:text-rose-400 font-medium">
                            Recusaram no momento
                        </span>
                    </div>
                    <div class="p-2.5 sm:p-3 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
                        <XCircle class="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                </CardContent>
            </Card>
        </div>

        <!-- Painel Principal -->
        <Card class="min-h-[60dvh] flex flex-col">
            <CardHeader class="p-4 border-b border-border flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-3">
                <!-- Abas de Status -->
                <div class="flex items-center gap-1.5 overflow-x-auto pb-1 2xl:pb-0">
                    <Button
                        size="sm"
                        class="h-9 px-3 text-xs whitespace-nowrap shrink-0"
                        :variant="statusFiltro === 'todos' ? 'default' : 'outline'"
                        @click="statusFiltro = 'todos'"
                    >
                        Todos ({{ qualificados.length }})
                    </Button>
                    <Button
                        size="sm"
                        class="h-9 px-3 text-xs whitespace-nowrap shrink-0"
                        :variant="statusFiltro === 'pendente' ? 'default' : 'outline'"
                        @click="statusFiltro = 'pendente'"
                    >
                        Pendentes ({{ contadores.pendente }})
                    </Button>
                    <Button
                        size="sm"
                        class="h-9 px-3 text-xs whitespace-nowrap shrink-0"
                        :variant="statusFiltro === 'em_negociacao' ? 'default' : 'outline'"
                        @click="statusFiltro = 'em_negociacao'"
                    >
                        Em Negociação ({{ contadores.em_negociacao }})
                    </Button>
                    <Button
                        size="sm"
                        class="h-9 px-3 text-xs whitespace-nowrap shrink-0"
                        :variant="statusFiltro === 'rematriculado' ? 'default' : 'outline'"
                        @click="statusFiltro = 'rematriculado'"
                    >
                        Rematriculados ({{ contadores.rematriculado }})
                    </Button>
                    <Button
                        size="sm"
                        class="h-9 px-3 text-xs whitespace-nowrap shrink-0"
                        :variant="statusFiltro === 'nao_rematriculado' ? 'default' : 'outline'"
                        @click="statusFiltro = 'nao_rematriculado'"
                    >
                        Não Rematriculados ({{ contadores.nao_rematriculado }})
                    </Button>
                </div>

                <!-- Busca e Critério alinhados (h-9) -->
                <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    <div class="relative flex-1 sm:w-60">
                        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                            v-model="termoPesquisa"
                            placeholder="Buscar aluno ou curso..."
                            class="pl-9 h-9 text-sm"
                        />
                    </div>

                    <div class="w-full sm:w-44">
                        <Select v-model="origemFiltro" :options="opcoesOrigem" class="h-9 text-sm" />
                    </div>
                </div>
            </CardHeader>

            <div v-if="carregando" class="p-12 text-center text-muted-foreground">
                Calculando alunos qualificados para rematrícula...
            </div>

            <div v-else-if="itensFiltrados.length === 0" class="p-12 text-center text-muted-foreground">
                Nenhum aluno encontrado para os filtros selecionados.
            </div>

            <CardContent v-else class="p-0 flex-1">
                <!-- VISUALIZAÇÃO MOBILE -->
                <div class="md:hidden divide-y divide-border">
                    <div
                        v-for="item in itensFiltrados"
                        :key="'mob-' + item.aluno.id"
                        class="p-3.5 flex flex-col gap-2.5 hover:bg-muted/40 transition-colors cursor-pointer"
                        @click="abrirModalAtendimento(item)"
                    >
                        <div class="flex items-center justify-between gap-2">
                            <div class="flex items-center gap-2.5 min-w-0">
                                <Avatar :name="item.aluno.nome" class="w-9 h-9 shrink-0" />
                                <div class="min-w-0">
                                    <p class="font-bold text-sm text-foreground truncate leading-tight">
                                        {{ formatarNome(item.aluno.nome) }}
                                    </p>
                                    <p class="text-xs text-muted-foreground truncate mt-0.5">
                                        {{ item.resumoCurso }} • Cód: {{ item.aluno.codigo }}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div class="flex flex-wrap items-center justify-between gap-2 pl-11">
                            <div class="flex flex-wrap items-center gap-1.5">
                                <Badge
                                    variant="secondary"
                                    class="text-[10px] px-2 py-0"
                                    :class="item.origem === 'reta_final'
                                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                        : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30'"
                                >
                                    {{ item.motivoQualificacao }}
                                </Badge>

                                <Badge
                                    variant="secondary"
                                    class="text-[10px] px-2 py-0"
                                    :class="badgeStatus(item.status).classe"
                                >
                                    {{ badgeStatus(item.status).texto }}
                                </Badge>
                            </div>

                            <span
                                v-if="item.atualizado_em"
                                class="text-[11px] text-muted-foreground flex items-center gap-1"
                            >
                                <MessageSquare class="w-3 h-3" />
                                {{ formatarDataBR(item.atualizado_em) }} ({{ item.historico.length }}x)
                            </span>
                        </div>
                    </div>
                </div>

                <!-- VISUALIZAÇÃO DESKTOP -->
                <div class="hidden md:block">
                    <Table>
                        <TableHeader class="bg-muted/50">
                            <TableRow>
                                <TableHead class="pl-4">Aluno / Situação Acadêmica</TableHead>
                                <TableHead class="text-center">Critério</TableHead>
                                <TableHead class="text-center">Status Comercial</TableHead>
                                <TableHead class="text-center">Último Atendimento</TableHead>
                                <TableHead class="text-end pr-4">Ações</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            <TableRow v-for="item in itensFiltrados" :key="item.aluno.id">
                                <!-- Aluno e Curso -->
                                <TableCell class="pl-4 py-3">
                                    <div class="flex items-center gap-3">
                                        <Avatar :name="item.aluno.nome" />
                                        <div class="flex flex-col min-w-0">
                                            <span class="font-bold text-foreground truncate">
                                                {{ formatarNome(item.aluno.nome) }}
                                            </span>
                                            <span class="text-xs text-muted-foreground truncate">
                                                {{ item.resumoCurso }} • Cód: {{ item.aluno.codigo }}
                                            </span>
                                        </div>
                                    </div>
                                </TableCell>

                                <!-- Critério -->
                                <TableCell class="text-center">
                                    <Badge
                                        variant="secondary"
                                        class="text-[11px]"
                                        :class="item.origem === 'reta_final'
                                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                            : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30'"
                                    >
                                        {{ item.motivoQualificacao }}
                                    </Badge>
                                </TableCell>

                                <!-- Status Comercial -->
                                <TableCell class="text-center">
                                    <Badge
                                        variant="secondary"
                                        class="text-[11px]"
                                        :class="badgeStatus(item.status).classe"
                                    >
                                        {{ badgeStatus(item.status).texto }}
                                    </Badge>
                                </TableCell>

                                <!-- Último Atendimento -->
                                <TableCell class="text-center">
                                    <button
                                        v-if="item.atualizado_em"
                                        type="button"
                                        @click="abrirModalAtendimento(item)"
                                        class="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary cursor-pointer transition-colors"
                                        title="Ver histórico de observações"
                                    >
                                        <MessageSquare class="w-3.5 h-3.5" />
                                        <span>
                                            {{ formatarDataBR(item.atualizado_em) }}
                                            ({{ item.historico.length }}x)
                                        </span>
                                    </button>
                                    <span v-else class="text-xs text-muted-foreground italic">
                                        Sem atendimento registrado
                                    </span>
                                </TableCell>

                                <!-- Ações -->
                                <TableCell class="pr-4 py-2 text-end">
                                    <div class="flex items-center justify-end gap-2">
                                        <Button
                                            size="sm"
                                            :variant="item.status === 'pendente' ? 'default' : 'outline'"
                                            @click="abrirModalAtendimento(item)"
                                        >
                                            <MessageSquarePlus class="w-4 h-4 mr-1.5" />
                                            <span>Atender</span>
                                        </Button>

                                        <Tooltip content="Criar Nova Matrícula" position="top">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                class="px-2.5 bg-background border-border text-foreground hover:bg-muted"
                                                @click="irParaNovaMatricula(item.aluno.id)"
                                            >
                                                <BookOpen class="w-4 h-4" />
                                            </Button>
                                        </Tooltip>
                                    </div>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>

        <!-- Modal de Atendimento e Histórico -->
        <ModalRematricula
            v-model="modalAberto"
            :item="itemSelecionado"
            :tipo-usuario="tipoUsuario"
            @salvo="carregarDados(true)"
        />
    </div>
</template>