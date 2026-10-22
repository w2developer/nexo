<script setup>
    import { ref, onMounted } from 'vue';
    import { useRoute, useRouter } from 'vue-router';
    import { supabase } from '@/lib/supabase';
    import { ArrowLeft, Save, Calendar, User, BookOpen, Clock, ChevronRight } from '@lucide/vue';
    import { toast } from '@/composables/useToast';
    import { formatarNome, capitalizar, getBadgeVariantMatricula } from '@/utils/formatters';
    import { formatarDataBR } from '@/utils/dateHelpers';

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
    const cursosOpcoes = ref([]);
    const matriculaExpandida = ref(null);

    // Dados do aluno
    const formAluno = ref({
        id: null,
        nome: '',
        codigo: '',
        ativo: true
    });

    // Matrículas e cópia original para comparar mudanças
    const matriculas = ref([]);
    const matriculasOriginais = ref({});

    const situacaoOpcoes = [
        { label: 'Cursando', value: 'cursando' },
        { label: 'Concluído', value: 'concluido' },
        { label: 'Trancado', value: 'trancado' },
        { label: 'Cancelado', value: 'cancelado' }
    ];

    // Abre ou fecha a matrícula clicada
    const toggleMatricula = (id) => {
        matriculaExpandida.value = matriculaExpandida.value === id ? null : id;
    };

    // Retorna o nome do curso pelo ID selecionado
    const getNomeCurso = (cursoId) => {
        const encontrado = cursosOpcoes.value.find(c => c.value === Number(cursoId));
        return encontrado ? encontrado.label : 'Curso não selecionado';
    };

    // Conta horas definidas no JSONB
    const contarHorasMatricula = (horarioObj) => {
        if (!horarioObj || !Array.isArray(horarioObj.horario)) return 0;
        return horarioObj.horario.length;
    };

    // Busca cursos disponíveis
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

    // Busca dados do aluno e matrículas
    const carregarDados = async () => {
        carregando.value = true;
        try {
            const { data, error } = await supabase
                .from('aluno')
                .select(`
                    id, nome, codigo, ativo,
                    matricula (
                        id, curso_id, situacao, responsavel,
                        data_inicio, data_fim, ead, horario
                    )
                `)
                .eq('id', alunoId)
                .single();

            if (error) throw error;

            formAluno.value = {
                id: data.id,
                nome: data.nome || '',
                codigo: data.codigo || '',
                ativo: Boolean(data.ativo)
            };

            // Ordena deixando 'cursando' no topo
            const listaOrdenada = (data.matricula || []).sort((a, b) => {
                if (a.situacao === 'cursando' && b.situacao !== 'cursando') return -1;
                if (a.situacao !== 'cursando' && b.situacao === 'cursando') return 1;
                return b.id - a.id;
            });

            matriculas.value = listaOrdenada.map(mat => {
                const itemFormatado = {
                    id: mat.id,
                    curso_id: mat.curso_id,
                    situacao: mat.situacao || 'cursando',
                    responsavel: mat.responsavel || '',
                    data_inicio: mat.data_inicio ? mat.data_inicio.split('T')[0] : '',
                    data_fim: mat.data_fim ? mat.data_fim.split('T')[0] : '',
                    ead: Boolean(mat.ead),
                    horario: mat.horario
                };
                // Guarda snapshot para só salvar no banco o que for editado
                matriculasOriginais.value[mat.id] = JSON.stringify(itemFormatado);
                return itemFormatado;
            });

            // Se vier ?matricula=ID na URL abre ela; se tiver só 1, abre automático
            if (route.query.matricula) {
                matriculaExpandida.value = Number(route.query.matricula);
            } else if (matriculas.value.length === 1) {
                matriculaExpandida.value = matriculas.value[0].id;
            }
        } catch (err) {
            console.error("Erro ao carregar aluno:", err);
            toast.error("Erro", "Não foi possível carregar os dados do aluno.");
            router.back();
        } finally {
            carregando.value = false;
        }
    };

    // Salva aluno e apenas matrículas modificadas
    const salvarAlteracoes = async () => {
        if (!formAluno.value.nome.trim() || !formAluno.value.codigo.trim()) {
            toast.error("Atenção", "Nome e código do aluno são obrigatórios.");
            return;
        }

        for (const mat of matriculas.value) {
            if (!mat.curso_id || !mat.data_inicio) {
                toast.error("Atenção", `Preencha o curso e data de início na matrícula #${mat.id}.`);
                matriculaExpandida.value = mat.id;
                return;
            }
        }

        salvando.value = true;
        try {
            // 1. Atualiza tabela aluno
            const { data: alunoAtualizado, error: erroAluno } = await supabase
                .from('aluno')
                .update({
                    nome: formAluno.value.nome.trim(),
                    codigo: formAluno.value.codigo.trim(),
                    ativo: formAluno.value.ativo
                })
                .eq('id', alunoId)
                .select();

            if (erroAluno) throw erroAluno;

            if (!alunoAtualizado?.length) {
                toast.error("Permissão negada", "O banco recusou a alteração (verifique o RLS).");
                return;
            }

            // 2. Filtra e atualiza apenas as matrículas que sofreram alteração
            const alteradas = matriculas.value.filter(
                mat => JSON.stringify(mat) !== matriculasOriginais.value[mat.id]
            );

            for (const mat of alteradas) {
                const { error: erroMat } = await supabase
                    .from('matricula')
                    .update({
                        curso_id: Number(mat.curso_id),
                        situacao: mat.situacao,
                        responsavel: mat.responsavel?.trim() || null,
                        data_inicio: mat.data_inicio,
                        data_fim: mat.data_fim || null,
                        ead: mat.ead
                    })
                    .eq('id', mat.id);

                if (erroMat) throw erroMat;
            }

            toast.success("Sucesso", "Dados atualizados com sucesso!");
            router.back();
        } catch (err) {
            console.error("Erro ao salvar:", err);
            toast.error("Erro", "Não foi possível salvar as alterações.");
        } finally {
            salvando.value = false;
        }
    };

    onMounted(() => {
        buscarCursos();
        carregarDados();
    });
</script>

<template>
    <div class="space-y-6">
        <!-- Cabeçalho Responsivo -->
        <Card>
            <CardContent class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    <Button variant="outline" size="sm" @click="router.back()" class="px-2.5 shrink-0">
                        <ArrowLeft class="w-4 h-4" />
                    </Button>

                    <template v-if="!carregando">
                        <Avatar :name="formAluno.nome" class="shrink-0" />
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <h2 class="font-bold text-base sm:text-lg text-slate-900 leading-tight truncate">
                                    {{ formatarNome(formAluno.nome) || 'Aluno sem nome' }}
                                </h2>
                                <Badge :variant="formAluno.ativo ? 'success' : 'secondary'" class="text-[10px] px-2 py-0 shrink-0">
                                    {{ formAluno.ativo ? 'Ativo' : 'Inativo' }}
                                </Badge>
                            </div>
                            <p class="text-xs text-slate-500 truncate">
                                Código: {{ formAluno.codigo || '---' }}
                            </p>
                        </div>
                    </template>
                    <div v-else class="text-sm text-muted-foreground">Carregando dados...</div>
                </div>

                <div class="flex items-center justify-end gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-border shrink-0">
                    <Button variant="ghost" size="sm" @click="router.back()" :disabled="salvando">
                        Cancelar
                    </Button>
                    <Button variant="default" size="sm" @click="salvarAlteracoes" :disabled="salvando || carregando">
                        <Save class="w-4 h-4 mr-1.5" />
                        {{ salvando ? 'Salvando...' : 'Salvar Alterações' }}
                    </Button>
                </div>
            </CardContent>
        </Card>

        <div v-if="carregando" class="p-12 text-center text-muted-foreground">
            Carregando informações do aluno...
        </div>

        <template v-else>
            <!-- Seção 1: Dados Cadastrais -->
            <Card>
                <CardHeader class="p-4 border-b border-border flex flex-row items-center gap-2">
                    <User class="w-5 h-5 text-slate-500" />
                    <h3 class="font-bold text-base text-slate-900">Dados Cadastrais</h3>
                </CardHeader>
                <CardContent class="p-4">
                    <div class="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                        <div class="sm:col-span-6">
                            <FormGroup label="Nome Completo" id="aluno-nome">
                                <Input v-model="formAluno.nome" placeholder="Digite o nome do aluno..." />
                            </FormGroup>
                        </div>

                        <div class="sm:col-span-3">
                            <FormGroup label="Código de Acesso" id="aluno-codigo">
                                <Input v-model="formAluno.codigo" placeholder="Ex: AL12345" />
                            </FormGroup>
                        </div>

                        <div class="sm:col-span-3">
                            <FormGroup label="Status do Cadastro" id="aluno-status">
                                <div class="flex items-center gap-3 h-10 px-3 rounded-md border border-slate-200 bg-slate-50/50">
                                    <Switch 
                                        id="switch-ativo"
                                        variant="emerald"
                                        v-model="formAluno.ativo" 
                                    />
                                    <label 
                                        for="switch-ativo" 
                                        class="text-sm font-medium cursor-pointer select-none"
                                        :class="formAluno.ativo ? 'text-emerald-700' : 'text-slate-500'"
                                    >
                                        {{ formAluno.ativo ? 'Aluno Ativo' : 'Aluno Inativo' }}
                                    </label>
                                </div>
                            </FormGroup>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <!-- Seção 2: Lista Retrátil de Matrículas -->
            <Card class="overflow-hidden">
                <CardHeader class="p-4 border-b border-border flex flex-row items-center justify-between">
                    <div class="flex items-center gap-2">
                        <BookOpen class="w-5 h-5 text-slate-500" />
                        <h3 class="font-bold text-base text-slate-900">
                            Matrículas Vinculadas ({{ matriculas.length }})
                        </h3>
                    </div>
                    <span class="text-xs text-slate-500 hidden sm:inline">
                        Clique em um curso para expandir e editar
                    </span>
                </CardHeader>

                <div v-if="matriculas.length === 0" class="p-8 text-center text-muted-foreground">
                    Este aluno não possui matrículas cadastradas.
                </div>

                <div v-else class="flex flex-col">
                    <div 
                        v-for="mat in matriculas" 
                        :key="mat.id"
                        class="border-b border-border last:border-0 flex flex-col transition-colors"
                        :class="{'bg-slate-50/40': matriculaExpandida === mat.id}"
                    >
                        <!-- Cabeçalho Retrátil da Matrícula -->
                        <div 
                            class="flex items-center justify-between gap-3 p-3.5 md:p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                            @click="toggleMatricula(mat.id)"
                        >
                            <!-- Esquerda: Seta + Nome do Curso + Situação -->
                            <div class="flex items-center gap-3 min-w-0 flex-1">
                                <div 
                                    class="text-slate-400 transition-transform duration-300 ease-in-out shrink-0"
                                    :class="{'rotate-90 text-indigo-600': matriculaExpandida === mat.id}"
                                >
                                    <ChevronRight class="w-5 h-5" />
                                </div>

                                <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5 min-w-0">
                                    <span class="font-bold text-slate-900 text-sm sm:text-base truncate">
                                        {{ getNomeCurso(mat.curso_id) }}
                                    </span>

                                    <div class="flex items-center gap-2">
                                        <Badge 
                                            :variant="getBadgeVariantMatricula(mat.situacao)"
                                            class="text-[10px] px-2 py-0"
                                            :class="mat.situacao === 'cursando' ? 'bg-amber-100 text-amber-700 border-amber-200' : ''"
                                        >
                                            {{ capitalizar(mat.situacao) }}
                                        </Badge>

                                        <span class="text-xs text-slate-400 hidden md:inline">
                                            • Início: {{ formatarDataBR(mat.data_inicio) }}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <!-- Direita: Modalidade / Horas + Botão de Horários -->
                            <div class="flex items-center gap-2.5 shrink-0" @click.stop>
                                <Badge v-if="mat.ead" variant="secondary" class="text-xs">
                                    EAD
                                </Badge>
                                <Badge variant="secondary" class="hidden sm:flex items-center gap-1 text-xs">
                                    <Clock class="w-3 h-3" />
                                    {{ contarHorasMatricula(mat.horario) }}h
                                </Badge>

                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    class="bg-white h-8 px-2.5 text-xs"
                                    @click="router.push(`/professor/horarios/${mat.id}`)"
                                >
                                    <Calendar class="w-3.5 h-3.5 sm:mr-1.5" />
                                    <span class="hidden sm:inline">Horários</span>
                                </Button>
                            </div>
                        </div>

                        <!-- Corpo Expansível com os Inputs da Matrícula -->
                        <div 
                            class="grid transition-all duration-300 ease-in-out"
                            :class="matriculaExpandida === mat.id ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
                        >
                            <div class="overflow-hidden">
                                <div class="p-4 pt-2 pl-4 md:pl-12 bg-slate-50/50 border-t border-slate-100">
                                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                        <FormGroup label="Curso" :id="`curso-${mat.id}`">
                                            <Select 
                                                v-model="mat.curso_id" 
                                                :options="cursosOpcoes" 
                                                placeholder="Selecione o curso" 
                                            />
                                        </FormGroup>

                                        <FormGroup label="Situação da Matrícula" :id="`situacao-${mat.id}`">
                                            <Select 
                                                v-model="mat.situacao" 
                                                :options="situacaoOpcoes" 
                                            />
                                        </FormGroup>

                                        <FormGroup label="Modalidade de Ensino" :id="`ead-${mat.id}`">
                                            <div class="flex items-center justify-between h-10 px-3 rounded-md border border-slate-200 bg-slate-50/50">
                                                <span 
                                                    class="text-sm cursor-pointer select-none"
                                                    :class="!mat.ead ? 'font-semibold text-slate-900' : 'text-slate-500'"
                                                    @click="mat.ead = false"
                                                >
                                                    Presencial
                                                </span>

                                                <Switch 
                                                    :id="`switch-ead-${mat.id}`"
                                                    v-model="mat.ead" 
                                                />

                                                <span 
                                                    class="text-sm cursor-pointer select-none"
                                                    :class="mat.ead ? 'font-semibold text-indigo-600' : 'text-slate-500'"
                                                    @click="mat.ead = true"
                                                >
                                                    EAD
                                                </span>
                                            </div>
                                        </FormGroup>

                                        <FormGroup label="Data de Início" :id="`inicio-${mat.id}`">
                                            <Input v-model="mat.data_inicio" type="date" />
                                        </FormGroup>

                                        <FormGroup label="Previsão de Término" :id="`fim-${mat.id}`">
                                            <Input v-model="mat.data_fim" type="date" />
                                        </FormGroup>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </template>
    </div>
</template>