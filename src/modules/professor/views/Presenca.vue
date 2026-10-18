<script setup>
    import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
    import { supabase } from '@/lib/supabase';
    import { Menu } from '@lucide/vue';

    import { turnos, diaSemana, horas } from '@/utils/constants';
    import { 
        getDiaAtual, 
        getHoraETurnoAtual, 
        getHojeString, 
        formatarDataBR, 
        isDuasSemanasAtras, 
        isDataVencida, 
        textoPrevisaoTermino, 
        calcularTempoRestante, 
        getUltimaPresenca 
    } from '@/utils/dateHelpers';
    import { formatarNome, getInitials, getAvatarColor } from '@/utils/formatters';
    import { toast } from '@/composables/useToast';

    import Avatar from '@/components/ui/Avatar.vue';
    import Button from '@/components/ui/Button.vue';
    import Card from '@/components/ui/Card.vue';
    import CardHeader from '@/components/ui/CardHeader.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Dropdown from '@/components/ui/Dropdown.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Input from '@/components/ui/Input.vue';
    import Select from '@/components/ui/Select.vue';
    import Table from '@/components/ui/Table.vue';
    import TableHeader from '@/components/ui/TableHeader.vue';
    import TableHead from '@/components/ui/TableHead.vue';
    import TableCell from '@/components/ui/TableCell.vue';
    import TableBody from '@/components/ui/TableBody.vue';
    import TableRow from '@/components/ui/TableRow.vue';
    import Tooltip from '@/components/ui/Tooltip.vue';

    import ModalEditarAluno from '../components/ModalEditarAluno.vue';
    import ModalConcluirAluno from '../components/ModalConcluirAluno.vue';

    // Estados da listagem
    const alunos = ref([]);
    const carregandoAlunos = ref(true);
    const erroAlunos = ref(false);
    const presencasConfirmadas = ref([]);
    let realtimeChannel;

    // Estados de filtro
    const termoPesquisa = ref('');
    const infoAtual = getHoraETurnoAtual();
    const turnoSelecionado = ref(infoAtual.turno);
    const diaSelecionando = ref(getDiaAtual());
    const horaSelecionada = ref(infoAtual.hora);

    // Controle dos modais
    const modalConcluirAberto = ref(false);
    const modalEditarAberto = ref(false);
    const matriculaSelecionada = ref(null);

    const abrirModalEditar = (item) => {
        matriculaSelecionada.value = item;
        modalEditarAberto.value = true;
    };

    const abrirModalConcluir = (item) => {
        matriculaSelecionada.value = item;
        modalConcluirAberto.value = true;
    };

    // Marca ou desmarca presença com atualização otimista
    const togglePresenca = async (item) => {
        const dataHoje = getHojeString();
        const jaConfirmado = presencasConfirmadas.value.includes(item.id);
        const alunoIndex = alunos.value.findIndex(a => a.id === item.id);

        if (jaConfirmado) {
            presencasConfirmadas.value = presencasConfirmadas.value.filter(pid => pid !== item.id);
            if (alunoIndex !== -1 && alunos.value[alunoIndex].registro_presenca) {
                alunos.value[alunoIndex].registro_presenca = alunos.value[alunoIndex].registro_presenca.filter(
                    p => p.data_presenca !== dataHoje
                );
            }
        } else {
            presencasConfirmadas.value = [...presencasConfirmadas.value, item.id];
            if (alunoIndex !== -1) {
                const presencasAntigas = alunos.value[alunoIndex].registro_presenca || [];
                alunos.value[alunoIndex].registro_presenca = [...presencasAntigas, { data_presenca: dataHoje }];
            }
        }

        try {
            if (jaConfirmado) {
                const { error } = await supabase
                    .from('registro_presenca')
                    .delete()
                    .match({ matricula_id: item.id, data_presenca: dataHoje });
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('registro_presenca')
                    .insert([{ matricula_id: item.id, data_presenca: dataHoje }]);
                if (error) throw error;
            }

            await supabase
                .from('matricula')
                .update({ atualizado_em: new Date().toISOString() })
                .eq('id', item.id);
        } catch (err) {
            console.error("Erro ao salvar presença:", err);
            toast.error("Erro", "Erro de conexão. A marcação foi desfeita.");
            buscarAlunos(true);
        }
    };

    // Filtros e ordenação
    const horasFiltradas = computed(() => {
        if (!turnoSelecionado.value) return horas;
        return horas.filter(hora => hora.turno === turnoSelecionado.value);
    });

    watch(turnoSelecionado, (novoTurno) => {
        if (novoTurno && horasFiltradas.value.length > 0) horaSelecionada.value = horasFiltradas.value[0].value;
        else horaSelecionada.value = null;
    });

    const alunosListagem = computed(() => {
        const termo = termoPesquisa.value.toLowerCase().trim();

        const filtrados = alunos.value.filter(item => {
            const bateTexto = (item.aluno?.nome?.toLowerCase() || '').includes(termo);
            if (termo) return bateTexto;

            let bateHorario = false;
            if (item.horario && Array.isArray(item.horario.horario)) {
                bateHorario = item.horario.horario.some(h => {
                    const matchTurno = !turnoSelecionado.value || h.turno === turnoSelecionado.value;
                    const matchDia = !diaSelecionando.value || (h.dia_semana && h.dia_semana.toLowerCase() === diaSelecionando.value.toLowerCase());
                    const matchHora = !horaSelecionada.value || h.hora_inicio === horaSelecionada.value;
                    return matchTurno && matchDia && matchHora;
                });
            } else if (!turnoSelecionado.value && !diaSelecionando.value && !horaSelecionada.value) {
                bateHorario = true;
            }
            return bateHorario;
        });

        return filtrados.slice().sort((a, b) => {
            const aConfirmado = presencasConfirmadas.value.includes(a.id);
            const bConfirmado = presencasConfirmadas.value.includes(b.id);

            if (aConfirmado !== bConfirmado) return aConfirmado ? 1 : -1;

            const nomeA = a.aluno?.nome?.toLowerCase() || '';
            const nomeB = b.aluno?.nome?.toLowerCase() || '';
            return nomeA.localeCompare(nomeB);
        });
    });

    // Busca matrículas ativas e presenças do dia
    const buscarAlunos = async (silencioso = false) => {
        try {
            if (!silencioso) carregandoAlunos.value = true;

            const { data, error: supabaseError } = await supabase
                .from('matricula')
                .select('*, aluno(*), curso(*), registro_presenca(data_presenca)')
                .eq('situacao', 'cursando');

            if (supabaseError) throw supabaseError;

            alunos.value = data;
            const dataHojeString = getHojeString();

            presencasConfirmadas.value = data
                .filter(item => item.registro_presenca?.some(p => p.data_presenca === dataHojeString))
                .map(item => item.id);
        } catch (err) {
            erroAlunos.value = err.message;
        } finally {
            if (!silencioso) carregandoAlunos.value = false;
        }
    };

    onMounted(() => {
        buscarAlunos();

        realtimeChannel = supabase
            .channel('matricula_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'matricula' }, () => {
                buscarAlunos(true);
            })
            .subscribe();
    });

    onUnmounted(() => {
        if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    });
</script>

<template>
    <div class="space-y-6">
        <Card>
            <CardHeader class="p-4 font-bold text-xl border-b border-border">
                <h2>Filtros e Pesquisa</h2>
            </CardHeader>
            <CardContent class="p-4">
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <FormGroup label="Buscar Aluno" id="pesquisa">
                        <Input v-model="termoPesquisa" placeholder="Digite o nome..." />
                    </FormGroup>
                    <FormGroup label="Selecionar Turno" id="turno">
                        <Select v-model="turnoSelecionado" :options="turnos" placeholder="Todos" />
                    </FormGroup>
                    <FormGroup label="Selecionar Dia" id="dia">
                        <Select v-model="diaSelecionando" :options="diaSemana" placeholder="Todos" />
                    </FormGroup>
                    <FormGroup label="Selecionar Hora" id="hora">
                        <Select v-model="horaSelecionada" :options="horasFiltradas" placeholder="Todas" />
                    </FormGroup>
                </div>
            </CardContent>
        </Card>

        <Card class="min-h-[100dvh] flex flex-col">
            <CardHeader class="p-4 font-bold text-xl border-b border-border">
                <h2>Marcar Presença</h2>
            </CardHeader>

            <div v-if="carregandoAlunos" class="p-8 text-center text-muted-foreground">
                Carregando dados...
            </div>

            <div v-else-if="erroAlunos" class="p-8 text-center text-red-500">
                Erro ao buscar dados: {{ erroAlunos }}
            </div>

            <CardContent v-else class="p-0 flex-1">
                <div class="min-h-[300px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead class="pl-4">Aluno</TableHead>
                                <TableHead class="text-center hidden min-[550px]:table-cell">Previsão de Término</TableHead>
                                <TableHead class="text-center hidden min-[550px]:table-cell">Última Presença</TableHead>
                                <TableHead class="text-end pr-4">Ações</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            <TransitionGroup name="list">
                                <TableRow 
                                    v-for="item in alunosListagem" 
                                    :key="item.id" 
                                    class="align-middle transition-opacity duration-300"
                                    :class="{'opacity-60 bg-slate-50': presencasConfirmadas.includes(item.id)}"
                                >
                                    <TableCell class="pl-4 py-3">
                                        <div class="flex items-center gap-3">
                                            <Avatar :name="item.aluno?.nome" />
                                            <div class="flex flex-col">
                                                <span class="font-medium text-slate-900">
                                                    {{ formatarNome(item.aluno?.nome) }}
                                                </span>
                                                <span class="text-xs text-slate-500 truncate max-w-[200px] md:max-w-[300px]">
                                                    {{ item.curso?.nome || 'Curso não informado' }}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>

                                    <TableCell 
                                        class="text-center hidden min-[550px]:table-cell font-medium transition-colors"
                                        :class="isDataVencida(item.data_fim) ? 'text-red-500' : 'text-muted-foreground'"
                                    >
                                        <Tooltip :content="calcularTempoRestante(item.data_fim)" position="top">
                                            <span class="cursor-help underline decoration-dashed underline-offset-4 decoration-slate-300">
                                                {{ textoPrevisaoTermino(item.data_fim) }}
                                            </span>
                                        </Tooltip>
                                    </TableCell>

                                    <TableCell 
                                        class="text-center hidden min-[550px]:table-cell font-medium transition-colors"
                                        :class="isDuasSemanasAtras(getUltimaPresenca(item.registro_presenca)) ? 'text-red-500' : 'text-muted-foreground'"
                                    >
                                        <span v-if="item.ead !== true">
                                            {{ formatarDataBR(getUltimaPresenca(item.registro_presenca)) }}
                                        </span>
                                        <span v-else>EAD</span>
                                    </TableCell>

                                    <TableCell class="pr-4 py-2">
                                        <div class="flex items-center justify-end gap-2">
                                            <Button
                                                v-if="item.ead !== true"
                                                size="sm" 
                                                :variant="presencasConfirmadas.includes(item.id) ? 'outline' : 'default'"
                                                @click="togglePresenca(item)" 
                                            >
                                                {{ presencasConfirmadas.includes(item.id) ? 'Desfazer' : 'Presença' }}
                                            </Button>

                                            <Dropdown>
                                                <template #trigger>
                                                    <Button 
                                                        size="sm"
                                                        variant="outline" 
                                                        class="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-2 rounded-md transition-colors shadow-sm"
                                                    >
                                                        <Menu class="w-4 h-4" />
                                                    </Button>
                                                </template>
                                                <template #content>
                                                    <button
                                                        @click="abrirModalEditar(item)"
                                                        class="w-full text-left px-4 py-2 hover:bg-muted rounded transition-colors text-sm cursor-pointer"
                                                    >
                                                        Editar Aluno
                                                    </button>
                                                    <button 
                                                        @click="abrirModalConcluir(item)" 
                                                        class="w-full text-left px-4 py-2 cursor-pointer hover:bg-emerald-50 text-emerald-600 rounded transition-colors text-sm font-medium"
                                                    >
                                                        Concluir Aluno
                                                    </button>
                                                </template>
                                            </Dropdown>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            </TransitionGroup>
                        </TableBody>
                    </Table>
                </div>

                <div v-if="alunosListagem.length === 0" class="p-8 text-center text-muted-foreground border-t border-border">
                    Nenhum aluno encontrado para os filtros atuais.
                </div>
            </CardContent>
        </Card>

        <!-- Modais Extraídos -->
        <ModalEditarAluno 
            v-model="modalEditarAberto" 
            :matricula="matriculaSelecionada" 
            @salvo="buscarAlunos(true)" 
        />

        <ModalConcluirAluno 
            v-model="modalConcluirAberto" 
            :matricula="matriculaSelecionada" 
            @concluido="buscarAlunos(true)" 
        />
    </div>
</template>

<style>
.list-move {
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>