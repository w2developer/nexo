<script setup>
    import { ref, watch, onMounted } from 'vue';
    import { supabase } from '@/lib/supabase';
    import { Plus, Trash2 } from '@lucide/vue';
    import { turnos, diaSemana, horas } from '@/utils/constants';
    import { toast } from '@/composables/useToast';

    import Modal from '@/components/ui/Modal.vue';
    import Button from '@/components/ui/Button.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Input from '@/components/ui/Input.vue';
    import Select from '@/components/ui/Select.vue';

    const props = defineProps({
        modelValue: { type: Boolean, required: true },
        matricula: { type: Object, default: null }
    });

    const emit = defineEmits(['update:modelValue', 'salvo']);

    const cursosOpcoes = ref([]);
    const salvandoEdicao = ref(false);

    const opcoesModalidade = [
        { label: 'Presencial', value: false },
        { label: 'EAD', value: true }
    ];

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

    // Preenche o formulário quando a matrícula selecionada muda
    watch(() => props.matricula, (item) => {
        if (!item) return;

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
    }, { immediate: true });

    const fecharModal = () => {
        emit('update:modelValue', false);
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
            // Atualiza tabela aluno
            const { error: erroAluno } = await supabase
                .from('aluno')
                .update({
                    nome: formEdicao.value.nome.trim(),
                    codigo: formEdicao.value.codigo.trim()
                })
                .eq('id', formEdicao.value.aluno_id);

            if (erroAluno) throw erroAluno;

            // Atualiza tabela matricula
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
            emit('salvo');
            fecharModal();
        } catch (err) {
            console.error("Erro ao editar aluno:", err);
            toast.error("Erro", "Não foi possível salvar as alterações.");
        } finally {
            salvandoEdicao.value = false;
        }
    };

    onMounted(buscarCursos);
</script>

<template>
    <Modal 
        :model-value="modelValue" 
        @update:model-value="emit('update:modelValue', $event)"
        title="Editar Aluno" 
        size="xl"
    >
        <div class="space-y-6">
            <!-- Dados Cadastrais -->
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

            <!-- Dados da Matrícula -->
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

            <!-- Horários de Aula -->
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
            <Button @click="fecharModal" variant="ghost" :disabled="salvandoEdicao">
                Cancelar
            </Button>
            <Button @click="salvarEdicao" variant="default" :disabled="salvandoEdicao">
                {{ salvandoEdicao ? 'Salvando...' : 'Salvar Alterações' }}
            </Button>
        </template>
    </Modal>
</template>