<script setup>
    import { ref, computed, onMounted } from 'vue';
    import { useRoute, useRouter } from 'vue-router';
    import { supabase } from '@/lib/supabase';
    import { ArrowLeft, Save, PlusCircle } from '@lucide/vue';
    import { toast } from '@/composables/useToast';
    import { formatarNome } from '@/utils/formatters';
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
    const tipoUsuario = ref(null);

    // Estado do formulário
    const form = ref({
        curso_id: '',
        data_inicio: getHojeString(),
        data_fim: '',
        ultima_presenca: '', // Novo campo opcional para presença retroativa
        ead: false
    });

    // Verifica se o aluno já possui algum curso ativo ('cursando' ou 'aguardando')
    const possuiCursoEmAndamento = computed(() => {
        return (aluno.value?.matricula || []).some(m => m.situacao === 'cursando' || m.situacao === 'aguardando');
    });

    // Filtra cursos que o aluno ainda não possui
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

    // Carrega aluno e cursos disponíveis
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

    // Função central que executa a gravação no banco de dados
    const executarGravacao = async () => {
        if (!form.value.curso_id) {
            toast.error("Atenção", "Selecione um curso para a matrícula.");
            return null;
        }
        if (!form.value.data_inicio) {
            toast.error("Atenção", "Informe a data de início.");
            return null;
        }

        salvando.value = true;
        try {
            const situacaoInicial = possuiCursoEmAndamento.value ? 'aguardando' : 'cursando';

            const payload = {
                aluno_id: alunoId,
                curso_id: Number(form.value.curso_id),
                situacao: situacaoInicial,
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

            // Se o usuário preencheu a última presença, grava diretamente
            if (form.value.ultima_presenca) {
                const { error: errPresenca } = await supabase
                    .from('registro_presenca')
                    .insert([{
                        matricula_id: novaMatricula.id,
                        data_presenca: form.value.ultima_presenca
                    }]);
                
                if (errPresenca) console.error("Erro ao salvar presença:", errPresenca);
            }

            return { novaMatricula, situacaoInicial };
        } catch (err) {
            console.error("Erro ao criar matrícula:", err);
            toast.error("Erro", "Não foi possível criar a matrícula.");
            return null;
        } finally {
            salvando.value = false;
        }
    };

    // Fluxo 1 (Padrão): Salva a matrícula atual e vai direto para a tela de horários dela
    const salvarMatriculaEDefinirHorario = async () => {
        const resultado = await executarGravacao();
        if (resultado) {
            const msgToast = resultado.situacaoInicial === 'aguardando'
                ? "Matrícula registrada como Aguardando! Defina agora os horários."
                : "Matrícula criada! Defina agora os horários.";

            toast.success("Sucesso", msgToast);
            router.replace(`/${tipoUsuario.value}/horarios/${resultado.novaMatricula.id}`);
        }
    };

    // Fluxo 2 (Opcional): Salva a matrícula atual, limpa o formulário e continua na tela para adicionar outra
    const salvarMatriculaEContinuar = async () => {
        const resultado = await executarGravacao();
        if (resultado) {
            toast.success("Salvo!", `Curso '${cursosDisponiveis.value.find(c => c.value === Number(form.value.curso_id))?.label}' adicionado com sucesso.`);
            
            // Limpa o formulário para o próximo curso
            form.value.curso_id = '';
            form.value.data_fim = '';
            form.value.ultima_presenca = '';
            
            // Recarrega os dados para atualizar a lista de "cursos já vinculados" e o status de "Aguardando"
            await carregarDados();
        }
    };

    onMounted(() => {
        const sessionUsuario = sessionStorage.getItem('tipo_usuario');
        if (sessionUsuario !== null) {
            tipoUsuario.value = sessionUsuario;
        }
        carregarDados();
    });
</script>

<template>
    <div class="space-y-6">
        <!-- Cabeçalho do Aluno e Botões de Ação -->
        <Card>
            <CardContent class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    <Button variant="outline" size="sm" @click="router.back()" class="px-2.5 shrink-0 bg-background text-foreground border-border hover:bg-muted">
                        <ArrowLeft class="w-4 h-4" />
                    </Button>

                    <template v-if="!carregando && aluno">
                        <Avatar :name="aluno.nome" class="shrink-0" />
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <h2 class="font-bold text-base sm:text-lg text-foreground leading-tight truncate">
                                    {{ formatarNome(aluno.nome) }}
                                </h2>
                            </div>
                            <p class="text-xs text-muted-foreground truncate">
                                Nova Matrícula
                            </p>
                        </div>
                    </template>
                    <div v-else class="text-sm text-muted-foreground">Carregando aluno...</div>
                </div>

                <!-- Botões de Ação -->
                <div class="flex flex-wrap items-center justify-end gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-border shrink-0">
                    <Button variant="ghost" size="sm" @click="router.back()" :disabled="salvando">
                        Cancelar
                    </Button>

                    <!-- Botão Secundário: Salvar e Adicionar Outro -->
                    <Button 
                        variant="outline" 
                        size="sm" 
                        class="bg-background text-foreground hover:bg-muted"
                        @click="salvarMatriculaEContinuar" 
                        :disabled="salvando || carregando || cursosDisponiveis.length === 0"
                        title="Salva este curso e permite adicionar outro na mesma hora"
                    >
                        <PlusCircle class="w-4 h-4 sm:mr-1.5" />
                        <span class="hidden sm:inline">Salvar e Adicionar Outro</span>
                    </Button>

                    <!-- Botão Principal: Salvar e Definir Horários -->
                    <Button 
                        variant="default" 
                        size="sm" 
                        @click="salvarMatriculaEDefinirHorario" 
                        :disabled="salvando || carregando || cursosDisponiveis.length === 0"
                    >
                        <Save class="w-4 h-4 mr-1.5" />
                        {{ salvando ? 'Criando...' : 'Salvar e Ir para Horários' }}
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
                    <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mr-2">
                        Cursos já vinculados:
                    </span>

                    <div 
                        v-for="mat in aluno.matricula" 
                        :key="mat.id"
                        class="flex items-center gap-1.5 bg-muted/50 border border-border px-2.5 py-1 rounded-md text-xs"
                    >
                        <span class="font-medium text-foreground">{{ mat.curso?.nome }}</span>
                        <Badge variant="outline" class="text-[9px] px-1 py-0 ml-1 leading-tight h-auto">{{ mat.situacao }}</Badge>
                    </div>
                </CardContent>
            </Card>

            <!-- Formulário -->
            <Card>
                <CardHeader class="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 class="font-bold text-base text-foreground">Dados da Nova Matrícula</h3>

                    <!-- Indicador automático de status inicial -->
                    <Badge
                        v-if="possuiCursoEmAndamento"
                        variant="secondary"
                        class="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                    >
                        Status deste novo curso: Aguardando
                    </Badge>
                </CardHeader>

                <CardContent class="p-4">
                    <div v-if="cursosDisponiveis.length === 0" class="p-6 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-border">
                        Este aluno já possui matrícula registrada em todos os cursos cadastrados no sistema.
                    </div>

                    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormGroup label="Curso *" id="novo-curso" class="sm:col-span-2 lg:col-span-1">
                            <Select 
                                v-model="form.curso_id" 
                                :options="cursosDisponiveis" 
                                placeholder="Selecione o curso..." 
                            />
                        </FormGroup>

                        <FormGroup label="Modalidade de Ensino" id="novo-ead">
                            <div class="flex items-center justify-between h-10 px-3 rounded-md border border-border bg-muted/50">
                                <span 
                                    class="text-sm cursor-pointer select-none transition-colors"
                                    :class="!form.ead ? 'font-semibold text-foreground' : 'text-muted-foreground'"
                                    @click="form.ead = false"
                                >
                                    Presencial
                                </span>
                                <Switch 
                                    id="switch-novo-ead"
                                    v-model="form.ead" 
                                />
                                <span 
                                    class="text-sm cursor-pointer select-none transition-colors"
                                    :class="form.ead ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'"
                                    @click="form.ead = true"
                                >
                                    EAD
                                </span>
                            </div>
                        </FormGroup>

                        <!-- Novo Campo: Última Presença (Opcional) -->
                        <FormGroup label="Última Presença (Opcional)" id="ultima-presenca">
                            <Input v-model="form.ultima_presenca" type="date" />
                            <p class="text-[10px] text-muted-foreground mt-1 leading-tight">Preencha caso o aluno já tenha tido aulas retroativas deste curso.</p>
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