<script setup>
    import { ref, computed, onMounted, onUnmounted } from 'vue';
    import { useRouter, useRoute } from 'vue-router';
    import { supabase } from '@/lib/supabase';
    import { 
        AlertTriangle, Clock, Award, Users, Search, 
        PhoneCall, CheckCircle2, Edit, ChevronDown, Calendar, MessageSquare 
    } from '@lucide/vue';
    import { toast } from '@/composables/useToast';
    import { formatarDataBR, getHojeString } from '@/utils/dateHelpers';
    import { formatarNome } from '@/utils/formatters';
    import { usePendencias } from '@/composables/usePendencias';

    import Card from '@/components/ui/Card.vue';
    import CardHeader from '@/components/ui/CardHeader.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Button from '@/components/ui/Button.vue';
    import Badge from '@/components/ui/Badge.vue';
    import Avatar from '@/components/ui/Avatar.vue';
    import Input from '@/components/ui/Input.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Dropdown from '@/components/ui/Dropdown.vue';
    import Modal from '@/components/ui/Modal.vue';
    import Table from '@/components/ui/Table.vue';
    import TableHeader from '@/components/ui/TableHeader.vue';
    import TableHead from '@/components/ui/TableHead.vue';
    import TableBody from '@/components/ui/TableBody.vue';
    import TableRow from '@/components/ui/TableRow.vue';
    import TableCell from '@/components/ui/TableCell.vue';
    import Tooltip from '@/components/ui/Tooltip.vue';
    import ModalConcluirAluno from '@/modules/professor/components/ModalConcluirAluno.vue';

    const router = useRouter();
    const route = useRoute();

    const basePath = computed(() => {
        return route.path.startsWith('/secretaria') ? '/secretaria' : '/professor';
    });

    // Nome do usuário logado
    const nomeUsuarioLogado = computed(() => {
        return sessionStorage.getItem('nome_usuario') || 'Colaborador';
    });

    // Store global de pendências
    const { 
        carregando,
        listaFaltantes, 
        listaPrazos, 
        listaCertificados, 
        totalCursando,
        carregarDadosGlobais 
    } = usePendencias();

    // Estados da interface
    const abaAtiva = ref('faltantes');
    const termoPesquisa = ref('');

    const modalConcluirAberto = ref(false);
    const matriculaParaConcluir = ref(null);

    const modalContatoAberto = ref(false);
    const itemContatoSelecionado = ref(null);
    const observacaoContato = ref('');
    const salvandoContato = ref(false);

    // Filtra a fila ativa pela busca
    const itensExibidos = computed(() => {
        const termo = termoPesquisa.value.toLowerCase().trim();
        let base = [];

        if (abaAtiva.value === 'faltantes') base = listaFaltantes.value;
        else if (abaAtiva.value === 'prazos') base = listaPrazos.value;
        else if (abaAtiva.value === 'certificados') base = listaCertificados.value;

        if (!termo) return base;

        return base.filter(item => 
            (item.aluno?.nome?.toLowerCase() || '').includes(termo) ||
            (item.aluno?.codigo?.toLowerCase() || '').includes(termo) ||
            (item.curso?.nome?.toLowerCase() || '').includes(termo)
        );
    });

    const abrirModalContato = (item) => {
        itemContatoSelecionado.value = item;
        observacaoContato.value = '';
        modalContatoAberto.value = true;
    };

    // Salva novo contato com nome do responsável
    const confirmarRegistroContato = async () => {
        if (!itemContatoSelecionado.value) return;

        salvandoContato.value = true;
        try {
            const { error } = await supabase
                .from('registro_contato')
                .insert([{
                    matricula_id: itemContatoSelecionado.value.id,
                    data_contato: getHojeString(),
                    usuario_nome: nomeUsuarioLogado.value,
                    observacao: observacaoContato.value.trim() || null
                }]);

            if (error) throw error;

            toast.success("Sucesso", `Contato com ${formatarNome(itemContatoSelecionado.value.aluno?.nome)} registrado!`);
            modalContatoAberto.value = false;
            
            carregarDadosGlobais(true);
        } catch (err) {
            console.error("Erro ao registrar contato:", err);
            toast.error("Erro", "Não foi possível salvar o contato.");
        } finally {
            salvandoContato.value = false;
        }
    };

    const atualizarCertificado = async (matriculaId, novoStatus) => {
        try {
            const { error } = await supabase
                .from('matricula')
                .update({
                    situacao_certificado: novoStatus,
                    atualizado_em: new Date().toISOString()
                })
                .eq('id', matriculaId);

            if (error) throw error;
            toast.success("Sucesso", "Status do certificado atualizado!");
            
            carregarDadosGlobais(true);
        } catch (err) {
            console.error("Erro ao atualizar certificado:", err);
            toast.error("Erro", "Não foi possível atualizar o certificado.");
        }
    };

    const abrirModalConcluir = (item) => {
        matriculaParaConcluir.value = item;
        modalConcluirAberto.value = true;
    };

    const irParaEditarAluno = (item) => {
        router.push(`${basePath.value}/editar-aluno/${item.aluno_id}?matricula=${item.id}`);
    };

    // Atualização silenciosa via Maestro
    const atualizarSilencioso = () => carregarDadosGlobais(true);

    onMounted(() => {
        carregarDadosGlobais();

        // Listeners do Maestro
        document.addEventListener('db-update-matricula', atualizarSilencioso);
        document.addEventListener('db-update-presenca', atualizarSilencioso);
        document.addEventListener('db-update-contato', atualizarSilencioso);
        document.addEventListener('db-update-aluno', atualizarSilencioso);
    });

    onUnmounted(() => {
        // Limpeza dos listeners
        document.removeEventListener('db-update-matricula', atualizarSilencioso);
        document.removeEventListener('db-update-presenca', atualizarSilencioso);
        document.removeEventListener('db-update-contato', atualizarSilencioso);
        document.removeEventListener('db-update-aluno', atualizarSilencioso);
    });
</script>

<template>
    <div class="space-y-6">
        <!-- Cards de Resumo (KPIs) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Card 1: Faltantes -->
            <Card 
                class="cursor-pointer transition-all hover:shadow-md border-2"
                :class="abaAtiva === 'faltantes' ? 'border-rose-500 bg-rose-500/10' : 'border-transparent'"
                @click="abaAtiva = 'faltantes'"
            >
                <CardContent class="p-4 flex items-center justify-between">
                    <div>
                        <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Faltantes (+14 dias)
                        </p>
                        <p class="text-2xl font-bold text-foreground mt-1">
                            {{ listaFaltantes.length }}
                        </p>
                        <span class="text-xs text-rose-600 dark:text-rose-400 font-medium">
                            Precisam de acompanhamento
                        </span>
                    </div>
                    <div class="p-3 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                        <AlertTriangle class="w-6 h-6" />
                    </div>
                </CardContent>
            </Card>

            <!-- Card 2: Reta Final -->
            <Card 
                class="cursor-pointer transition-all hover:shadow-md border-2"
                :class="abaAtiva === 'prazos' ? 'border-amber-500 bg-amber-500/10' : 'border-transparent'"
                @click="abaAtiva = 'prazos'"
            >
                <CardContent class="p-4 flex items-center justify-between">
                    <div>
                        <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Reta Final (≤ 30 dias)
                        </p>
                        <p class="text-2xl font-bold text-foreground mt-1">
                            {{ listaPrazos.length }}
                        </p>
                        <span class="text-xs text-amber-600 dark:text-amber-400 font-medium">
                            Previsão de término
                        </span>
                    </div>
                    <div class="p-3 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        <Clock class="w-6 h-6" />
                    </div>
                </CardContent>
            </Card>

            <!-- Card 3: Certificados -->
            <Card 
                class="cursor-pointer transition-all hover:shadow-md border-2"
                :class="abaAtiva === 'certificados' ? 'border-indigo-500 bg-indigo-500/10' : 'border-transparent'"
                @click="abaAtiva = 'certificados'"
            >
                <CardContent class="p-4 flex items-center justify-between">
                    <div>
                        <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Certificados Pendentes
                        </p>
                        <p class="text-2xl font-bold text-foreground mt-1">
                            {{ listaCertificados.length }}
                        </p>
                        <span class="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                            Aguardando emissão/entrega
                        </span>
                    </div>
                    <div class="p-3 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                        <Award class="w-6 h-6" />
                    </div>
                </CardContent>
            </Card>

            <!-- Card 4: Total Ativos -->
            <Card class="border-2 border-transparent">
                <CardContent class="p-4 flex items-center justify-between">
                    <div>
                        <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Matrículas Ativas
                        </p>
                        <p class="text-2xl font-bold text-foreground mt-1">
                            {{ totalCursando }}
                        </p>
                        <span class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            Alunos cursando atualmente
                        </span>
                    </div>
                    <div class="p-3 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        <Users class="w-6 h-6" />
                    </div>
                </CardContent>
            </Card>
        </div>

        <!-- Painel da Fila Selecionada -->
        <Card class="min-h-[60dvh] flex flex-col">
            <CardHeader class="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div class="flex flex-wrap items-center gap-2">
                    <Button 
                        size="sm" 
                        :variant="abaAtiva === 'faltantes' ? 'default' : 'outline'"
                        @click="abaAtiva = 'faltantes'"
                    >
                        Faltantes ({{ listaFaltantes.length }})
                    </Button>
                    <Button 
                        size="sm" 
                        :variant="abaAtiva === 'prazos' ? 'default' : 'outline'"
                        @click="abaAtiva = 'prazos'"
                    >
                        Reta Final ({{ listaPrazos.length }})
                    </Button>
                    <Button 
                        size="sm" 
                        :variant="abaAtiva === 'certificados' ? 'default' : 'outline'"
                        @click="abaAtiva = 'certificados'"
                    >
                        Certificados ({{ listaCertificados.length }})
                    </Button>
                </div>

                <div class="relative w-full md:w-72">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                        v-model="termoPesquisa" 
                        placeholder="Filtrar por aluno ou curso..." 
                        class="pl-9 h-9 text-sm" 
                    />
                </div>
            </CardHeader>

            <div v-if="carregando" class="p-12 text-center text-muted-foreground">
                Carregando pendências da secretaria...
            </div>

            <div v-else-if="itensExibidos.length === 0" class="p-12 text-center text-muted-foreground">
                Nenhuma pendência encontrada nesta categoria.
            </div>

            <CardContent v-else class="p-0 flex-1">
                <!-- TABELA 1: FALTANTES (+14 DIAS) -->
                <Table v-if="abaAtiva === 'faltantes'">
                    <TableHeader class="bg-muted/50">
                        <TableRow>
                            <TableHead class="pl-4">Aluno / Curso</TableHead>
                            <TableHead class="text-center hidden sm:table-cell">Última Presença</TableHead>
                            <TableHead class="text-center">Acompanhamento</TableHead>
                            <TableHead class="text-end pr-4">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow v-for="item in itensExibidos" :key="item.id">
                            <TableCell class="pl-4 py-3">
                                <div class="flex items-center gap-3">
                                    <Avatar :name="item.aluno?.nome" />
                                    <div class="flex flex-col min-w-0">
                                        <span class="font-bold text-foreground truncate">
                                            {{ formatarNome(item.aluno?.nome) }}
                                        </span>
                                        <span class="text-xs text-muted-foreground truncate">
                                            {{ item.curso?.nome }}
                                        </span>
                                    </div>
                                </div>
                            </TableCell>

                            <TableCell class="text-center hidden sm:table-cell">
                                <div class="flex flex-col items-center">
                                    <Tooltip :content="`Há ${item.diasAusente} dias sem vir`" position="top">
                                        <span class="text-xs text-muted-foreground cursor-help">
                                            {{ item.ultimaPresenca ? `${formatarDataBR(item.ultimaPresenca)}` : '---' }}
                                        </span>
                                    </Tooltip>
                                </div>
                            </TableCell>

                            <TableCell class="text-center">
                                <div class="flex flex-col items-center gap-1">
                                    <Badge 
                                        v-if="item.statusContato === 'sem_contato'" 
                                        variant="ghost" 
                                        class="text-[10px]"
                                    >
                                        Nenhum Contato
                                    </Badge>

                                    <Badge 
                                        v-else-if="item.statusContato === 'rechamada'" 
                                        variant="default" 
                                        class="bg-violet-600 text-white text-[10px]"
                                    >
                                        Sem retorno! Cobrar de novo
                                    </Badge>

                                    <Badge 
                                        v-else 
                                        variant="secondary" 
                                        class="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px]"
                                    >
                                        Contatado
                                    </Badge>

                                    <!-- Botão para abrir o histórico -->
                                    <button 
                                        v-if="item.ultimoContato" 
                                        type="button"
                                        @click="abrirModalContato(item)"
                                        class="text-[11px] text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer transition-colors mt-0.5"
                                        title="Clique para ver o histórico de observações"
                                    >
                                        <MessageSquare class="w-3 h-3" />
                                        <span>{{ formatarDataBR(item.ultimoContato) }} ({{ item.historicoContatos.length }}x)</span>
                                    </button>
                                </div>
                            </TableCell>

                            <TableCell class="pr-4 py-2 text-end">
                                <div class="flex items-center justify-end gap-2">
                                    <Tooltip :content="item.ultimoContato ? 'Novo Contato' : 'Registrar Contato'" position="top">
                                        <Button 
                                            size="sm" 
                                            :variant="item.statusContato === 'aguardando' ? 'outline' : 'default'"
                                            @click="abrirModalContato(item)"
                                        >
                                            <PhoneCall size="14"/>
                                        </Button>
                                    </Tooltip>

                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        class="px-2.5 bg-background border-border text-foreground hover:bg-muted"
                                        @click="irParaEditarAluno(item)"
                                        title="Editar dados do aluno"
                                    >
                                        <Edit class="w-4 h-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>

                <!-- TABELA 2: RETA FINAL (<= 30 DIAS OU VENCIDOS) -->
                <Table v-else-if="abaAtiva === 'prazos'">
                    <TableHeader class="bg-muted/50">
                        <TableRow>
                            <TableHead class="pl-4">Aluno / Curso</TableHead>
                            <TableHead class="text-center hidden sm:table-cell">Data de Término</TableHead>
                            <TableHead class="text-center">Prazo Restante</TableHead>
                            <TableHead class="text-end pr-4">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow v-for="item in itensExibidos" :key="item.id">
                            <TableCell class="pl-4 py-3">
                                <div class="flex items-center gap-3">
                                    <Avatar :name="item.aluno?.nome" />
                                    <div class="flex flex-col min-w-0">
                                        <span class="font-bold text-foreground truncate">
                                            {{ formatarNome(item.aluno?.nome) }}
                                        </span>
                                        <span class="text-xs text-muted-foreground truncate">
                                            {{ item.curso?.nome }}
                                        </span>
                                    </div>
                                </div>
                            </TableCell>

                            <TableCell class="text-center hidden sm:table-cell text-sm text-muted-foreground">
                                {{ formatarDataBR(item.data_fim) }}
                            </TableCell>

                            <TableCell class="text-center">
                                <Badge 
                                    v-if="item.diasRestantes < 0" 
                                    variant="destructive" 
                                    class="text-[11px]"
                                >
                                    Vencido há {{ Math.abs(item.diasRestantes) }} dias
                                </Badge>
                                <Badge 
                                    v-else-if="item.diasRestantes === 0" 
                                    variant="default" 
                                    class="bg-amber-500 text-white text-[11px]"
                                >
                                    Termina Hoje
                                </Badge>
                                <Badge 
                                    v-else 
                                    variant="secondary" 
                                    class="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[11px]"
                                >
                                    Faltam {{ item.diasRestantes }} dias
                                </Badge>
                            </TableCell>

                            <TableCell class="pr-4 py-2 text-end">
                                <div class="flex items-center justify-end gap-2">
                                    <Button 
                                        size="sm" 
                                        variant="default"
                                        class="bg-emerald-600 hover:bg-emerald-700 text-white"
                                        @click="abrirModalConcluir(item)"
                                    >
                                        <CheckCircle2 class="w-3.5 h-3.5 sm:mr-1.5" />
                                        <span class="hidden sm:inline">Concluir</span>
                                    </Button>

                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        class="px-2.5 bg-background border-border text-foreground hover:bg-muted"
                                        @click="irParaEditarAluno(item)"
                                        title="Prorrogar prazo ou editar matrícula"
                                    >
                                        <Calendar class="w-4 h-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>

                <!-- TABELA 3: CERTIFICADOS PENDENTES -->
                <Table v-else-if="abaAtiva === 'certificados'">
                    <TableHeader class="bg-muted/50">
                        <TableRow>
                            <TableHead class="pl-4">Aluno / Curso</TableHead>
                            <TableHead class="text-center hidden sm:table-cell">Data de Conclusão</TableHead>
                            <TableHead class="text-center">Status do Certificado</TableHead>
                            <TableHead class="text-end pr-4">Gerenciar</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow v-for="item in itensExibidos" :key="item.id">
                            <TableCell class="pl-4 py-3">
                                <div class="flex items-center gap-3">
                                    <Avatar :name="item.aluno?.nome" />
                                    <div class="flex flex-col min-w-0">
                                        <span class="font-bold text-foreground truncate">
                                            {{ formatarNome(item.aluno?.nome) }}
                                        </span>
                                        <span class="text-xs text-muted-foreground truncate">
                                            {{ item.curso?.nome }}
                                        </span>
                                    </div>
                                </div>
                            </TableCell>

                            <TableCell class="text-center hidden sm:table-cell text-sm text-muted-foreground">
                                {{ formatarDataBR(item.data_conclusao) }}
                            </TableCell>

                            <TableCell class="text-center">
                                <Badge 
                                    v-if="item.situacao_certificado === 'nao_solicitado'" 
                                    variant="destructive" 
                                    class="text-[10px] uppercase"
                                >
                                    Não Solicitado
                                </Badge>
                                <Badge 
                                    v-else-if="item.situacao_certificado === 'pendente'" 
                                    variant="secondary" 
                                    class="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] uppercase"
                                >
                                    Pendente
                                </Badge>
                                <Badge 
                                    v-else 
                                    variant="secondary" 
                                    class="bg-blue-500/15 text-blue-700 dark:text-blue-400 text-[10px] uppercase"
                                >
                                    Emitido (Aguardando Entrega)
                                </Badge>
                            </TableCell>

                            <TableCell class="pr-4 py-2 text-end">
                                <div class="flex justify-end">
                                    <Dropdown align="right">
                                        <template #trigger>
                                            <Button size="sm" variant="outline" class="bg-background border-border text-foreground hover:bg-muted text-xs">
                                                Alterar Status
                                                <ChevronDown class="w-3.5 h-3.5 ml-1.5" />
                                            </Button>
                                        </template>
                                        <template #content>
                                            <button @click="atualizarCertificado(item.id, 'nao_solicitado')" class="w-full text-left px-4 py-2 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium cursor-pointer">
                                                Não Solicitado
                                            </button>
                                            <button @click="atualizarCertificado(item.id, 'pendente')" class="w-full text-left px-4 py-2 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium cursor-pointer">
                                                Pendente
                                            </button>
                                            <button @click="atualizarCertificado(item.id, 'emitido')" class="w-full text-left px-4 py-2 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium cursor-pointer">
                                                Emitido
                                            </button>
                                            <button @click="atualizarCertificado(item.id, 'entregue')" class="w-full text-left px-4 py-2 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border-t border-border cursor-pointer">
                                                Marcar como Entregue (Concluir fila)
                                            </button>
                                        </template>
                                    </Dropdown>
                                </div>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <!-- Modal de Registro e Histórico de Contato -->
        <Modal 
            v-model="modalContatoAberto" 
            title="Acompanhamento de Faltas" 
            size="md"
        >
            <div v-if="itemContatoSelecionado" class="space-y-4">
                <!-- Resumo do Aluno -->
                <div class="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
                    <Avatar :name="itemContatoSelecionado.aluno?.nome" />
                    <div class="min-w-0 flex-1">
                        <p class="font-bold text-sm text-foreground truncate">
                            {{ formatarNome(itemContatoSelecionado.aluno?.nome) }}
                        </p>
                        <p class="text-xs text-muted-foreground truncate">
                            {{ itemContatoSelecionado.curso?.nome }} • 
                            <span class="text-rose-600 dark:text-rose-400 font-medium">{{ itemContatoSelecionado.diasAusente }} dias sem presença</span>
                        </p>
                    </div>
                </div>

                <!-- Nova Observação -->
                <FormGroup label="Nova Observação de Contato (Opcional)" id="obs-contato">
                    <textarea 
                        id="obs-contato"
                        v-model="observacaoContato" 
                        rows="3"
                        placeholder="Descreva o motivo da ausência ou resultado da ligação..."
                        class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    ></textarea>
                </FormGroup>

                <!-- Histórico de Contatos Anteriores -->
                <div v-if="itemContatoSelecionado.historicoContatos?.length > 0" class="space-y-2 pt-2 border-t border-border">
                    <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <MessageSquare class="w-3.5 h-3.5" />
                        Histórico de Contatos ({{ itemContatoSelecionado.historicoContatos.length }})
                    </h4>

                    <div class="max-h-52 overflow-y-auto space-y-2.5 pr-1">
                        <div 
                            v-for="reg in itemContatoSelecionado.historicoContatos" 
                            :key="reg.id"
                            class="p-3 rounded-md bg-muted border border-border text-xs space-y-1"
                        >
                            <div class="flex items-center justify-between text-muted-foreground font-semibold border-b border-border pb-1">
                                <div class="">
                                    <span>Contato realizado</span>
                                    <span v-if="reg.usuario_nome" class="text-[11px] text-muted-foreground"> - {{ formatarNome(reg.usuario_nome) }}</span>
                                </div>
                                <span>{{ formatarDataBR(reg.data_contato) }}</span>
                            </div>
                            <div class="pt-0.5 space-y-0.5">
                                <p class="text-foreground whitespace-pre-wrap break-words leading-relaxed">
                                    {{ reg.observacao || 'Sem observações registradas.' }}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button variant="ghost" @click="modalContatoAberto = false" :disabled="salvandoContato">
                    Fechar
                </Button>
                <Button variant="default" @click="confirmarRegistroContato" :disabled="salvandoContato">
                    {{ salvandoContato ? 'Salvando...' : 'Registrar Novo Contato' }}
                </Button>
            </template>
        </Modal>

        <!-- Modal de Conclusão -->
        <ModalConcluirAluno 
            v-model="modalConcluirAberto" 
            :matricula="matriculaParaConcluir" 
            @concluido="carregarDadosGlobais(true)" 
        />
    </div>
</template>