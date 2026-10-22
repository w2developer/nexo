<script setup>
    import { ref, watch, onMounted } from 'vue';
    import { supabase } from '@/lib/supabase';
    import { toast } from '@/composables/useToast';

    import Modal from '@/components/ui/Modal.vue';
    import Button from '@/components/ui/Button.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Input from '@/components/ui/Input.vue';
    import Select from '@/components/ui/Select.vue';
    import Switch from '@/components/ui/Switch.vue';

    const props = defineProps({
        modelValue: { type: Boolean, required: true },
        matricula: { type: Object, default: null }
    });

    const emit = defineEmits(['update:modelValue', 'salvo']);

    const cursosOpcoes = ref([]);
    const salvandoEdicao = ref(false);

    const formEdicao = ref({
        matricula_id: null,
        aluno_id: null,
        nome: '',
        codigo: '',
        curso_id: null,
        responsavel: '',
        data_inicio: '',
        data_fim: '',
        ead: false // Agora é um booleano puro para o Switch
    });

    // Preenche o formulário quando a matrícula muda
    watch(() => props.matricula, (item) => {
        if (!item) return;

        formEdicao.value = {
            matricula_id: item.id,
            aluno_id: item.aluno_id,
            nome: item.aluno?.nome || '',
            codigo: item.aluno?.codigo || '',
            curso_id: item.curso_id,
            responsavel: item.responsavel || '',
            data_inicio: item.data_inicio ? item.data_inicio.split('T')[0] : '',
            data_fim: item.data_fim ? item.data_fim.split('T')[0] : '',
            ead: Boolean(item.ead)
        };
    }, { immediate: true });

    const fecharModal = () => {
        emit('update:modelValue', false);
    };

    // Carrega lista de cursos
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

    // Salva alterações no banco
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
            // 1. Atualiza tabela aluno
            const { data: alunoAtualizado, error: erroAluno } = await supabase
                .from('aluno')
                .update({
                    nome: formEdicao.value.nome.trim(),
                    codigo: formEdicao.value.codigo.trim()
                })
                .eq('id', formEdicao.value.aluno_id)
                .select();

            if (erroAluno) throw erroAluno;

            // 2. Monta payload da matrícula (não mexe no horário)
            const payloadMatricula = {
                curso_id: Number(formEdicao.value.curso_id),
                responsavel: formEdicao.value.responsavel?.trim() || null,
                data_inicio: formEdicao.value.data_inicio,
                data_fim: formEdicao.value.data_fim || null,
                ead: formEdicao.value.ead
            };

            // 3. Atualiza tabela matricula
            const { data: matriculaAtualizada, error: erroMatricula } = await supabase
                .from('matricula')
                .update(payloadMatricula)
                .eq('id', formEdicao.value.matricula_id)
                .select();

            if (erroMatricula) throw erroMatricula;

            // Verifica se o RLS bloqueou silenciosamente o UPDATE
            if (!alunoAtualizado?.length || !matriculaAtualizada?.length) {
                toast.error("Permissão negada", "O banco recusou a alteração (verifique as políticas RLS de UPDATE).");
                return;
            }

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
        size="lg"
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
                        <div class="flex items-center gap-3 mt-1.5 h-10">
                            <span 
                                class="text-sm transition-colors cursor-pointer select-none" 
                                :class="!formEdicao.ead ? 'font-semibold text-slate-900' : 'text-slate-500'"
                                @click="formEdicao.ead = false"
                            >
                                Presencial
                            </span>
                            
                            <Switch 
                                id="switch-ead"
                                v-model="formEdicao.ead" 
                            />
                            
                            <span 
                                class="text-sm transition-colors cursor-pointer select-none" 
                                :class="formEdicao.ead ? 'font-semibold text-slate-900' : 'text-slate-500'"
                                @click="formEdicao.ead = true"
                            >
                                EAD
                            </span>
                        </div>
                    </FormGroup>

                    <FormGroup label="Data de Início" id="edit-data-inicio">
                        <Input v-model="formEdicao.data_inicio" type="date" />
                    </FormGroup>

                    <FormGroup label="Previsão de Término" id="edit-data-fim">
                        <Input v-model="formEdicao.data_fim" type="date" />
                    </FormGroup>
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