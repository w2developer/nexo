<script setup>
    import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
    import { supabase } from '@/lib/supabase';
    import { Menu, Plus, Trash2 } from '@lucide/vue';
    
    import { turnos, diaSemana, horas } from '@/utils/constants';
    import { getDiaAtual, getHoraETurnoAtual } from '@/utils/dateHelpers';
    import { toast } from '@/composables/useToast';

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
    import Avatar from '@/components/ui/Avatar.vue';
    import Modal from '@/components/ui/Modal.vue';

    // Estados Gerais
    const alunos = ref([]);
    const cursosOpcoes = ref([]);
    const carregandoAlunos = ref(true);
    const erroAlunos = ref(false);
    const termoPesquisa = ref('');

    const presencasConfirmadas = ref([]);
    
    let realtimeChannel;

    // Estados dos Modais
    const modalConcluirAberto = ref(false);
    const modalEditarAberto = ref(false);
    const matriculaSelecionada = ref(null);
    const carregandoConclusao = ref(false);
    const salvandoEdicao = ref(false);

    // Estado do Formulário de Edição
    const formEdicao = ref({
        matricula_id: null,
        aluno_id: null,
        nome: '',
        codigo: '',
        curso_id: null,
        responsavel: '',
        data_inicio: '',
        data_fim: '',
        ead: false,
        horarios: []
    });

    const opcoesModalidade = [
        { label: 'Presencial', value: false },
        { label: 'EAD', value: true }
    ];

    const infoAtual = getHoraETurnoAtual();
    const turnoSelecionado = ref(infoAtual.turno);
    const diaSelecionando = ref(getDiaAtual());
    const horaSelecionada = ref(infoAtual.hora);

    // Retorna a presença mais recente do histórico
    const getUltimaPresenca = (registros) => {
        if (!registros || !Array.isArray(registros) || registros.length === 0) return null;
        
        const datas = registros.map(r => r.data_presenca).filter(Boolean).sort();
        return datas[datas.length - 1] || null;
    };

    // Funções de data
    const getHojeString = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const parseData = (dateStr) => {
        if (!dateStr) return null;
        const [ano, mes, dia] = dateStr.split('T')[0].split('-');
        return new Date(ano, mes - 1, dia);
    };

    const formatarDataBR = (dateStr) => {
        if (!dateStr) return '---';
        const [ano, mes, dia] = dateStr.split('T')[0].split('-');
        return `${dia}/${mes}/${ano}`;
    };

    const isDuasSemanasAtras = (dateStr) => {
        if (!dateStr) return false;
        const dataPresenca = parseData(dateStr);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        return Math.floor((hoje - dataPresenca) / (1000 * 60 * 60 * 24)) >= 14;
    };

    const isDataVencida = (dateStr) => {
        if (!dateStr) return false;
        const dataFim = parseData(dateStr);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        return dataFim < hoje;
    };

    const textoPrevisaoTermino = (dateStr) => {
        if (!dateStr) return 'NÃO DEFINIDO';
        const dataFormatada = formatarDataBR(dateStr);
        return isDataVencida(dateStr) ? `- ${dataFormatada}` : dataFormatada;
    };

    const calcularTempoRestante = (dateStr) => {
        if (!dateStr || isDataVencida(dateStr)) return '0m, 0sem e 0d';

        const fim = parseData(dateStr);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        let meses = (fim.getFullYear() - hoje.getFullYear()) * 12 + (fim.getMonth() - hoje.getMonth());
        
        let tempFim = new Date(hoje.getFullYear(), hoje.getMonth() + meses, hoje.getDate());
        if (tempFim > fim) {
            meses--;
            tempFim = new Date(hoje.getFullYear(), hoje.getMonth() + meses, hoje.getDate());
        }

        const diasRestantes = Math.floor((fim - tempFim) / (1000 * 60 * 60 * 24));
        return `${meses}m, ${Math.floor(diasRestantes / 7)}sem e ${diasRestantes % 7}d`;
    };

    // Funções de texto e cores
    const formatarNome = (nome) => {
        if (!nome) return 'Nome não encontrado';
        return nome
            .toLowerCase()
            .split(' ')
            .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
            .join(' ');
    };

    const getInitials = (nome) => {
        if (!nome) return '??';
        const partes = nome.trim().split(' ').filter(Boolean);
        if (partes.length === 0) return '??';
        if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
        return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
    };

    const getAvatarColor = (nome) => {
        if (!nome) return 'bg-slate-100 text-slate-600';
        const colors = [
            'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700',
            'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700',
            'bg-pink-100 text-pink-700', 'bg-cyan-100 text-cyan-700',
            'bg-rose-100 text-rose-700', 'bg-indigo-100 text-indigo-700'
        ];
        let hash = 0;
        for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    // Ações de Presença
    const togglePresenca = async (item) => {
        const dataHoje = getHojeString();
        const jaConfirmado = presencasConfirmadas.value.includes(item.id);
        const alunoIndex = alunos.value.findIndex(a => a.id === item.id);

        // Atualização otimista
        if (jaConfirmado) {
            presencasConfirmadas.value = presencasConfirmadas.value.filter(pid => pid !== item.id);
            if (alunoIndex !== -1 && alunos.value[alunoIndex].registro_presenca) {
                alunos.value[alunoIndex].registro_presenca = alunos.value[alunoIndex].registro_presenca.filter(p => p.data_presenca !== dataHoje);
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

            // Dispara evento no Realtime
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

    // Ações de Edição
    const abrirModalEditar = (item) => {
        matriculaSelecionada.value = item;
        
        // Clona os horários existentes ou inicia vazio
        const listaHorarios = Array.isArray(item.horario?.horario)
            ? JSON.parse(JSON.stringify(item.horario.horario))
            : [];

        formEdicao.value = {
            matricula_id: item.id,
            aluno_id: item.aluno_id,
            nome: item.aluno?.nome || '',
            codigo: item.aluno?.codigo || '',
            curso_id: item.curso_id,
            responsavel: item.responsavel || '',
            data_inicio: item.data_inicio ? item.data_inicio.split('T')[0] : '',
            data_fim: item.data_fim ? item.data_fim.split('T')[0] : '',
            ead: Boolean(item.ead),
            horarios: listaHorarios
        };

        modalEditarAberto.value = true;
    };

    const adicionarHorario = () => {
        formEdicao.value.horarios.push({
            dia_semana: diaSemana[0]?.value || '',
            turno: turnos[0]?.value || '',
            hora_inicio: ''
        });
    };

    const removerHorario = (index) => {
        formEdicao.value.horarios.splice(index, 1);
    };

    const getHorasPorTurno = (turno) => {
        if (!turno) return horas;
        return horas.filter(h => h.turno === turno);
    };

    const aoMudarTurnoHorario = (horarioItem) => {
        const opcoes = getHorasPorTurno(horarioItem.turno);
        horarioItem.hora_inicio = opcoes.length > 0 ? opcoes[0].value : '';
    };

    const salvarEdicao = async () => {
        if (!formEdicao.value.nome.trim() || !formEdicao.value.codigo.trim()) {
            toast.error("Atenção", "Nome e código do aluno são obrigatórios.");
            return;
        }

        if (!formEdicao.value.curso_id || !formEdicao.value.data_inicio) {
            toast.error("Atenção", "Curso e data de início são obrigatórios.");
            return;
        }

        salvandoEdicao.value = true;
        try {
            // 1. Atualiza dados na tabela aluno
            const { error: erroAluno } = await supabase
                .from('aluno')
                .update({
                    nome: formEdicao.value.nome.trim(),
                    codigo: formEdicao.value.codigo.trim()
                })
                .eq('id', formEdicao.value.aluno_id);

            if (erroAluno) throw erroAluno;

            // 2. Atualiza dados na tabela matricula
            const payloadMatricula = {
                curso_id: formEdicao.value.curso_id,
                responsavel: formEdicao.value.responsavel?.trim() || null,
                data_inicio: formEdicao.value.data_inicio,
                data_fim: formEdicao.value.data_fim || null,
                ead: formEdicao.value.ead,
                horario: formEdicao.value.ead ? null : { horario: formEdicao.value.horarios },
                atualizado_em: new Date().toISOString()
            };

            const { error: erroMatricula } = await supabase
                .from('matricula')
                .update(payloadMatricula)
                .eq('id', formEdicao.value.matricula_id);

            if (erroMatricula) throw erroMatricula;

            toast.success("Sucesso", "Dados do aluno atualizados com sucesso!");
            modalEditarAberto.value = false;
            buscarAlunos(true);

        } catch (err) {
            console.error("Erro ao editar aluno:", err);
            toast.error("Erro", "Não foi possível salvar as alterações.");
        } finally {
            salvandoEdicao.value = false;
        }
    };

    // Ações de Conclusão
    const abrirModalConcluir = (item) => {
        matriculaSelecionada.value = item;
        modalConcluirAberto.value = true;
    };

    const confirmarConclusao = async () => {
        if (!matriculaSelecionada.value) return;

        carregandoConclusao.value = true;
        try {
            const dataHoje = getHojeString();
            
            const { error } = await supabase
                .from('matricula')
                .update({
                    situacao: 'concluido',
                    data_conclusao: dataHoje
                })
                .eq('id', matriculaSelecionada.value.id);

            if (error) throw error;

            toast.success("Sucesso", "Aluno concluído com sucesso!");
            buscarAlunos(true);
            
        } catch (err) {
            console.error("Erro ao concluir aluno:", err);
            toast.error("Erro", "Não foi possível concluir o aluno.");
        } finally {
            carregandoConclusao.value = false;
            modalConcluirAberto.value = false;
            matriculaSelecionada.value = null;
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

            if (aConfirmado !== bConfirmado) {
                return aConfirmado ? 1 : -1;
            }

            const nomeA = a.aluno?.nome?.toLowerCase() || '';
            const nomeB = b.aluno?.nome?.toLowerCase() || '';
            return nomeA.localeCompare(nomeB);
        });
    });

    // Busca de Cursos para o Select
    const buscarCursos = async () => {
        try {
            const { data, error } = await supabase
                .from('curso')
                .select('id, nome')
                .order('nome');

            if (error) throw error;

            cursosOpcoes.value = data.map(c => ({
                label: c.nome,
                value: c.id
            }));
        } catch (err) {
            console.error("Erro ao carregar cursos:", err);
        }
    };

    // Busca de Alunos e Histórico
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
                .filter(item => {
                    if (!item.registro_presenca) return false;
                    return item.registro_presenca.some(p => p.data_presenca === dataHojeString);
                })
                .map(item => item.id);

        } catch (err) {
            erroAlunos.value = err.message;
        } finally {
            if (!silencioso) carregandoAlunos.value = false;
        }
    };

    onMounted(() => {
        buscarAlunos();
        buscarCursos();

        realtimeChannel = supabase
            .channel('matricula_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'matricula' }, () => {
                buscarAlunos(true); 
            })
            .subscribe((status) => {
                console.log("Status Realtime:", status);
            });
    });

    onUnmounted(() => {
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
        }
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
                                            <div 
                                                class="flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm shrink-0"
                                                :class="getAvatarColor(item.aluno?.nome)"
                                            >
                                                {{ getInitials(item.aluno?.nome) }}
                                            </div>
                                            
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
                                        <span v-else>
                                            EAD
                                        </span>
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

                                            <!-- Menu Dropdown -->
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

        <!-- Modal de Edição -->
        <Modal 
            v-model="modalEditarAberto" 
            title="Editar Aluno" 
            size="xl"
        >
            <div class="space-y-6">
                <!-- Seção: Dados do Aluno -->
                <div class="space-y-4">
                    <h3 class="text-sm font-semibold text-slate-900 border-b border-border pb-2">
                        Dados Cadastrais
                    </h3>
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div class="sm:col-span-2">
                            <FormGroup label="Nome do Aluno" id="edit-nome">
                                <Input v-model="formEdicao.nome" placeholder="Nome completo..." />
                            </FormGroup>
                        </div>
                        <div>
                            <FormGroup label="Código" id="edit-codigo">
                                <Input v-model="formEdicao.codigo" placeholder="Ex: 12345" />
                            </FormGroup>
                        </div>
                    </div>
                </div>

                <!-- Seção: Dados da Matrícula -->
                <div class="space-y-4">
                    <h3 class="text-sm font-semibold text-slate-900 border-b border-border pb-2">
                        Dados da Matrícula
                    </h3>
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormGroup label="Curso" id="edit-curso">
                            <Select 
                                v-model="formEdicao.curso_id" 
                                :options="cursosOpcoes" 
                                placeholder="Selecione o curso" 
                            />
                        </FormGroup>

                        <FormGroup label="Modalidade" id="edit-ead">
                            <Select 
                                v-model="formEdicao.ead" 
                                :options="opcoesModalidade" 
                            />
                        </FormGroup>

                        <FormGroup label="Data de Início" id="edit-data-inicio">
                            <Input v-model="formEdicao.data_inicio" type="date" />
                        </FormGroup>

                        <FormGroup label="Previsão de Término" id="edit-data-fim">
                            <Input v-model="formEdicao.data_fim" type="date" />
                        </FormGroup>

                        <div class="sm:col-span-2">
                            <FormGroup label="Responsável (Opcional)" id="edit-responsavel">
                                <Input v-model="formEdicao.responsavel" placeholder="Nome do responsável..." />
                            </FormGroup>
                        </div>
                    </div>
                </div>

                <!-- Seção: Horários de Aula (Apenas Presencial) -->
                <div v-if="!formEdicao.ead" class="space-y-4">
                    <div class="flex items-center justify-between border-b border-border pb-2">
                        <h3 class="text-sm font-semibold text-slate-900">
                            Horários de Aula
                        </h3>
                        <Button size="sm" variant="outline" @click="adicionarHorario">
                            <Plus class="w-4 h-4 mr-1" />
                            Adicionar Horário
                        </Button>
                    </div>

                    <div v-if="formEdicao.horarios.length === 0" class="text-sm text-muted-foreground text-center py-4 bg-slate-50 rounded-md border border-dashed border-slate-200">
                        Nenhum horário definido para este aluno.
                    </div>

                    <div v-else class="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                        <div 
                            v-for="(h, index) in formEdicao.horarios" 
                            :key="index"
                            class="grid grid-cols-1 sm:grid-cols-10 gap-3 items-end bg-slate-50 p-3 rounded-md border border-slate-200"
                        >
                            <div class="sm:col-span-3">
                                <FormGroup label="Dia" :id="`dia-${index}`">
                                    <Select v-model="h.dia_semana" :options="diaSemana" placeholder="Dia" />
                                </FormGroup>
                            </div>

                            <div class="sm:col-span-3">
                                <FormGroup label="Turno" :id="`turno-${index}`">
                                    <Select 
                                        v-model="h.turno" 
                                        :options="turnos" 
                                        placeholder="Turno"
                                        @update:modelValue="aoMudarTurnoHorario(h)"
                                    />
                                </FormGroup>
                            </div>

                            <div class="sm:col-span-3">
                                <FormGroup label="Hora" :id="`hora-${index}`">
                                    <Select 
                                        v-model="h.hora_inicio" 
                                        :options="getHorasPorTurno(h.turno)" 
                                        placeholder="Hora" 
                                    />
                                </FormGroup>
                            </div>

                            <div class="sm:col-span-1 flex justify-end">
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    class="text-red-500 hover:text-red-700 hover:bg-red-50 px-2"
                                    @click="removerHorario(index)"
                                >
                                    <Trash2 class="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <template #footer>
                <Button @click="modalEditarAberto = false" variant="ghost" :disabled="salvandoEdicao">
                    Cancelar
                </Button>
                <Button @click="salvarEdicao" variant="default" :disabled="salvandoEdicao">
                    {{ salvandoEdicao ? 'Salvando...' : 'Salvar Alterações' }}
                </Button>
            </template>
        </Modal>

        <!-- Modal de Confirmação -->
        <Modal 
            v-model="modalConcluirAberto" 
            title="Concluir Aluno" 
            size="md"
        >
            <div class="space-y-4">
                <p class="text-sm font-medium text-slate-900">
                    Deseja realmente concluir a matrícula de {{ matriculaSelecionada?.aluno?.nome }}?
                </p>
                <p class="text-sm text-muted-foreground">
                    A situação do aluno mudará permanentemente para "concluído" e a data de hoje será registrada como a data final de conclusão. Ele deixará de aparecer nesta lista de presenças.
                </p>
            </div>
            
            <template #footer>
                <Button @click="modalConcluirAberto = false" variant="ghost" :disabled="carregandoConclusao">
                    Cancelar
                </Button>
                <Button @click="confirmarConclusao" variant="default" :disabled="carregandoConclusao">
                    {{ carregandoConclusao ? 'Concluindo...' : 'Confirmar Conclusão' }}
                </Button>
            </template>
        </Modal>

    </div>
</template>

<style>
.list-move {
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>