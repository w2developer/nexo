<script setup>
    import { ref, computed, onMounted } from 'vue';
    import { useRoute, useRouter } from 'vue-router';
    import { supabase } from '@/lib/supabase';
    import { ArrowLeft, Save, BookOpen, CheckCircle2 } from '@lucide/vue';
    import { toast } from '@/composables/useToast';
    import { formatarNome, capitalizar, getBadgeVariantMatricula } from '@/utils/formatters';
    import { getHojeString } from '@/utils/dateHelpers';

    import Button from '@/components/ui/Button.vue';
    import Card from '@/components/ui/Card.vue';
    import CardHeader from '@/components/ui/CardHeader.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Input from '@/components/ui/Input.vue';
    import Select from '@/components/ui/Select.vue';
    import Switch from '@/components/ui/Switch.vue';
    import Badge from '@/components/ui/Badge.vue';
    import Avatar from '@/components/ui/Avatar.vue';

    const route = useRoute();
    const router = useRouter();
    const alunoId = route.params.id;

    // Estados
    const carregando = ref(true);
    const salvando = ref(false);
    const aluno = ref(null);
    const todosCursos = ref([]);
    const tipoUsuario = ref(null)

    // Estado do formulário
    const form = ref({
        curso_id: '',
        data_inicio: getHojeString(),
        data_fim: '',
        ead: false
    });

    // Filtra cursos ainda não vinculados ao aluno
    const cursosDisponiveis = computed(() => {
        const cursosMatriculadosIds = new Set(
            (aluno.value?.matricula || []).map(m => m.curso_id)
        );

        return todosCursos.value
            .filter(c => !cursosMatriculadosIds.has(c.id))
            .map(c => ({
                label: c.nome,
                value: c.id
            }));
    });

    // Carrega aluno e cursos
    const carregarDados = async () => {
        carregando.value = true;
        try {
            const [resAluno, resCursos] = await Promise.all([
                supabase
                    .from('aluno')
                    .select(`
                        id, nome, codigo, ativo,
                        matricula (
                            id, curso_id, situacao,
                            curso (nome)
                        )
                    `)
                    .eq('id', alunoId)
                    .single(),
                supabase
                    .from('curso')
                    .select('id, nome')
                    .order('nome')
            ]);

            if (resAluno.error) throw resAluno.error;
            if (resCursos.error) throw resCursos.error;

            aluno.value = resAluno.data;
            todosCursos.value = resCursos.data || [];
        } catch (err) {
            console.error("Erro ao carregar dados:", err);
            toast.error("Erro", "Não foi possível carregar os dados para matrícula.");
            router.back();
        } finally {
            carregando.value = false;
        }
    };

    // Cria matrícula e redireciona para definir horários
    const salvarMatricula = async () => {
        if (!form.value.curso_id) {
            toast.error("Atenção", "Selecione um curso para a matrícula.");
            return;
        }

        if (!form.value.data_inicio) {
            toast.error("Atenção", "Informe a data de início.");
            return;
        }

        salvando.value = true;
        try {
            const payload = {
                aluno_id: alunoId,
                curso_id: Number(form.value.curso_id),
                situacao: 'cursando',
                data_inicio: form.value.data_inicio,
                data_fim: form.value.data_fim || null,
                ead: form.value.ead,
                horario: { horario: [] }
            };

            const { data: novaMatricula, error } = await supabase
                .from('matricula')
                .insert([payload])
                .select()
                .single();

            if (error) throw error;

            toast.success("Sucesso", "Matrícula criada! Defina agora os horários.");
            router.replace(`/${tipoUsuario.value}/horarios/${novaMatricula.id}`);
        } catch (err) {
            console.error("Erro ao criar matrícula:", err);
            toast.error("Erro", "Não foi possível criar a matrícula.");
        } finally {
            salvando.value = false;
        }
    };

    // 2. Acesse o sessionStorage ee pega o tipo de user
    onMounted(() => {
        const sessionUsuario = sessionStorage.getItem('tipo_usuario')
        
        if (sessionUsuario !== null) {
            tipoUsuario.value = sessionUsuario
        }
    })

    onMounted(carregarDados);
</script>

<template>
    <div class="space-y-6">
        <!-- Cabeçalho do Aluno -->
        <Card>
            <CardContent class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    <Button variant="outline" size="sm" @click="router.back()" class="px-2.5 shrink-0">
                        <ArrowLeft class="w-4 h-4" />
                    </Button>

                    <template v-if="!carregando && aluno">
                        <Avatar :name="aluno.nome" class="shrink-0" />
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <h2 class="font-bold text-base sm:text-lg text-slate-900 leading-tight truncate">
                                    {{ formatarNome(aluno.nome) }}
                                </h2>
                                <Badge :variant="aluno.ativo ? 'success' : 'secondary'" class="text-[10px] px-2 py-0 shrink-0">
                                    {{ aluno.ativo ? 'Ativo' : 'Inativo' }}
                                </Badge>
                            </div>
                            <p class="text-xs text-slate-500 truncate">
                                Nova Matrícula • Código: {{ aluno.codigo }}
                            </p>
                        </div>
                    </template>
                    <div v-else class="text-sm text-muted-foreground">Carregando aluno...</div>
                </div>

                <!-- Ações -->
                <div class="flex items-center justify-end gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-border shrink-0">
                    <Button variant="ghost" size="sm" @click="router.back()" :disabled="salvando">
                        Cancelar
                    </Button>

                    <Button 
                        variant="default" 
                        size="sm" 
                        @click="salvarMatricula" 
                        :disabled="salvando || carregando || cursosDisponiveis.length === 0"
                    >
                        <Save class="w-4 h-4 mr-1.5" />
                        {{ salvando ? 'Criando...' : 'Criar e Definir Horários' }}
                    </Button>
                </div>
            </CardContent>
        </Card>

        <div v-if="carregando" class="p-12 text-center text-muted-foreground">
            Carregando dados para matrícula...
        </div>

        <template v-else-if="aluno">
            <!-- Cursos já vinculados -->
            <Card v-if="aluno.matricula && aluno.matricula.length > 0">
                <CardContent class="p-4 flex flex-wrap items-center gap-2">
                    <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mr-2">
                        <CheckCircle2 class="w-4 h-4 text-slate-400" />
                        Cursos já vinculados:
                    </span>

                    <div 
                        v-for="mat in aluno.matricula" 
                        :key="mat.id"
                        class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-xs"
                    >
                        <span class="font-medium text-slate-700">{{ mat.curso?.nome }}</span>
                        <Badge 
                            :variant="getBadgeVariantMatricula(mat.situacao)"
                            class="text-[9px] px-1.5 py-0"
                            :class="mat.situacao === 'cursando' ? 'bg-amber-100 text-amber-700 border-amber-200' : ''"
                        >
                            {{ capitalizar(mat.situacao) }}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            <!-- Formulário 2x2 -->
            <Card>
                <CardHeader class="p-4 border-b border-border flex flex-row items-center gap-2">
                    <h3 class="font-bold text-base text-slate-900">Dados da Nova Matrícula</h3>
                </CardHeader>

                <CardContent class="p-4">
                    <div v-if="cursosDisponiveis.length === 0" class="p-6 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        Este aluno já possui matrícula registrada em todos os cursos cadastrados no sistema.
                    </div>

                    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormGroup label="Curso *" id="novo-curso">
                            <Select 
                                v-model="form.curso_id" 
                                :options="cursosDisponiveis" 
                                placeholder="Selecione o curso..." 
                            />
                        </FormGroup>

                        <FormGroup label="Modalidade de Ensino" id="novo-ead">
                            <div class="flex items-center justify-between h-10 px-3 rounded-md border border-slate-200 bg-slate-50/50">
                                <span 
                                    class="text-sm cursor-pointer select-none"
                                    :class="!form.ead ? 'font-semibold text-slate-900' : 'text-slate-500'"
                                    @click="form.ead = false"
                                >
                                    Presencial
                                </span>

                                <Switch 
                                    id="switch-novo-ead"
                                    v-model="form.ead" 
                                />

                                <span 
                                    class="text-sm cursor-pointer select-none"
                                    :class="form.ead ? 'font-semibold text-indigo-600' : 'text-slate-500'"
                                    @click="form.ead = true"
                                >
                                    EAD
                                </span>
                            </div>
                        </FormGroup>

                        <FormGroup label="Data de Início *" id="novo-inicio">
                            <Input v-model="form.data_inicio" type="date" />
                        </FormGroup>

                        <FormGroup label="Previsão de Término" id="novo-fim">
                            <Input v-model="form.data_fim" type="date" />
                        </FormGroup>
                    </div>
                </CardContent>
            </Card>
        </template>
    </div>
</template>