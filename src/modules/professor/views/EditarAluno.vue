<script setup>
    import { ref, onMounted } from 'vue';
    import { useRoute, useRouter } from 'vue-router'; 
    import { supabase } from '@/lib/supabase';
    import { ArrowLeft, Save, Plus, BookOpen, Clock, Calendar, Hash, User } from '@lucide/vue';
    import { toast } from '@/composables/useToast';

    import Button from '@/components/ui/Button.vue';
    import Card from '@/components/ui/Card.vue';
    import CardHeader from '@/components/ui/CardHeader.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Input from '@/components/ui/Input.vue';
    import Select from '@/components/ui/Select.vue';
    import Badge from '@/components/ui/Badge.vue';
    
    // --- ROTAS ---
    const route = useRoute();
    const router = useRouter();
    const alunoId = route.params.id;

    // --- ESTADOS ---
    const carregando = ref(true);
    const salvando = ref(false);
    const cursosDisponiveis = ref([]);

    // Dados do Aluno
    const aluno = ref({
        nome: '',
        codigo: '',
        ativo: true
    });

    // Lista de Matrículas do Aluno
    const matriculas = ref([]);

    // --- OPÇÕES DOS SELECTS ---
    const opcoesSituacaoMatricula = [
        { label: 'Cursando', value: 'cursando' },
        { label: 'Concluído', value: 'concluido' },
        { label: 'Trancado', value: 'trancado' },
        { label: 'Cancelado', value: 'cancelado' }
    ];

    const opcoesSituacaoCertificado = [
        { label: 'Não Solicitado', value: 'nao_solicitado' },
        { label: 'Pendente', value: 'pendente' },
        { label: 'Emitido', value: 'emitido' },
        { label: 'Entregue', value: 'entregue' }
    ];

    // Formata o JSONB de horário apenas para exibição limpa e segura
    const formatarHorarioExibicao = (horarioObj) => {
        if (!horarioObj || !horarioObj.horario || !Array.isArray(horarioObj.horario) || horarioObj.horario.length === 0) {
            return [];
        }
        return horarioObj.horario.map(h => `${h.dia_semana || ''} - ${h.turno || ''} (${h.hora_inicio || ''})`);
    };

    // --- BUSCA DE DADOS ---
    const buscarDados = async () => {
        carregando.value = true;
        try {
            // 1. Busca os dados do aluno
            const { data: dadosAluno, error: erroAluno } = await supabase
                .from('aluno')
                .select('*')
                .eq('id', alunoId)
                .single();

            if (erroAluno) throw erroAluno;
            aluno.value = { ...dadosAluno };

            // 2. Busca as matrículas atreladas ao aluno
            const { data: dadosMatriculas, error: erroMatriculas } = await supabase
                .from('matricula')
                .select(`
                    id, curso_id, situacao, data_inicio, data_fim, data_conclusao, 
                    situacao_certificado, horario
                `)
                .eq('aluno_id', alunoId)
                .order('data_inicio', { ascending: false });

            if (erroMatriculas) throw erroMatriculas;
            
            // O horário é mantido como objeto, formatado apenas na hora de renderizar
            matriculas.value = dadosMatriculas;

            // 3. Busca lista de cursos para o Dropdown
            const { data: cursosData, error: erroCursos } = await supabase
                .from('curso')
                .select('id, nome')
                .order('nome');
                
            if (erroCursos) throw erroCursos;
            cursosDisponiveis.value = cursosData.map(c => ({ label: c.nome, value: c.id }));

        } catch (err) {
            console.error("Erro ao carregar dados:", err);
            toast.error("Erro", "Não foi possível carregar os dados do aluno.");
            router.back();
        } finally {
            carregando.value = false;
        }
    };

    // --- SALVAR DADOS ---
    const salvarAlteracoes = async () => {
        if (!aluno.value.nome || !aluno.value.codigo) {
            toast.error("Atenção", "Nome e código do aluno são obrigatórios.");
            return;
        }

        salvando.value = true;
        try {
            // 1. Salva Dados do Aluno
            const { error: erroAluno } = await supabase
                .from('aluno')
                .update({
                    nome: aluno.value.nome,
                    codigo: aluno.value.codigo,
                    ativo: aluno.value.ativo
                })
                .eq('id', alunoId);

            if (erroAluno) {
                if (erroAluno.code === '23505') throw new Error("Este código já está em uso por outro aluno.");
                throw erroAluno;
            }

            // 2. Salva Dados das Matrículas
            for (const mat of matriculas.value) {
                const { error: erroMat } = await supabase
                    .from('matricula')
                    .update({
                        curso_id: mat.curso_id,
                        situacao: mat.situacao,
                        data_inicio: mat.data_inicio || null,
                        data_fim: mat.data_fim || null,
                        data_conclusao: mat.data_conclusao || null,
                        situacao_certificado: mat.situacao_certificado,
                        atualizado_em: new Date().toISOString()
                        // Horário não é enviado no update, mantendo-o seguro no banco
                    })
                    .eq('id', mat.id);

                if (erroMat) throw erroMat;
            }

            toast.success("Sucesso", "Dados do aluno atualizados com sucesso!");
            router.back();

        } catch (err) {
            console.error("Erro ao salvar:", err);
            toast.error("Erro ao salvar", err.message || "Verifique os dados e tente novamente.");
        } finally {
            salvando.value = false;
        }
    };

    // --- NOVA MATRÍCULA ---
    const adicionarMatriculaVazia = () => {
        toast.info("Em breve", "A página completa de 'Nova Matrícula' está sendo desenvolvida.");
    };

    onMounted(() => {
        if (!alunoId) {
            toast.error("Erro", "Nenhum aluno selecionado.");
            router.back();
            return;
        }
        buscarDados();
    });
</script>

<template>
    <div class="space-y-6 max-w-5xl mx-auto pb-10">
        
        <!-- HEADER PÁGINA -->
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <Button variant="ghost" size="icon" @click="router.back()" class="h-8 w-8 bg-white border border-slate-200">
                    <ArrowLeft class="w-4 h-4 text-slate-600" />
                </Button>
                <div>
                    <h2 class="text-2xl font-bold text-slate-800 leading-tight">Editar Aluno</h2>
                    <p class="text-sm text-slate-500">Ajuste os dados pessoais e as matrículas vinculadas.</p>
                </div>
            </div>
            
            <Button @click="salvarAlteracoes" :disabled="salvando" class="flex items-center gap-2">
                <Save class="w-4 h-4" />
                {{ salvando ? 'Salvando...' : 'Salvar Alterações' }}
            </Button>
        </div>

        <div v-if="carregando" class="flex items-center justify-center p-12 bg-white rounded-xl border border-slate-200">
            <span class="text-slate-500 font-medium animate-pulse">Carregando informações do aluno...</span>
        </div>

        <div v-else class="space-y-6">
            
            <!-- SESSÃO: DADOS DO ALUNO -->
            <Card>
                <CardHeader class="p-4 border-b border-border bg-slate-50/50">
                    <div class="flex items-center gap-2 text-slate-700 font-semibold">
                        <User class="w-4 h-4 text-indigo-500" /> Dados Pessoais
                    </div>
                </CardHeader>
                <CardContent class="p-5">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormGroup label="Nome Completo" id="nome">
                            <Input v-model="aluno.nome" placeholder="Ex: Maria Silva" />
                        </FormGroup>
                        
                        <FormGroup label="Código de Matrícula (Único)" id="codigo">
                            <div class="relative">
                                <Hash class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input v-model="aluno.codigo" class="pl-9 font-mono" placeholder="Ex: AL12345" />
                            </div>
                        </FormGroup>

                        <FormGroup label="Status do Aluno" id="ativo">
                            <Select 
                                v-model="aluno.ativo" 
                                :options="[{label: 'Ativo no Sistema', value: true}, {label: 'Inativo (Bloqueado)', value: false}]" 
                            />
                        </FormGroup>
                    </div>
                </CardContent>
            </Card>

            <!-- SESSÃO: MATRÍCULAS -->
            <div class="flex items-center justify-between mt-8 mb-4">
                <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <BookOpen class="w-5 h-5 text-indigo-500" /> Matrículas Vinculadas
                </h3>
                <Button variant="outline" size="sm" @click="adicionarMatriculaVazia" class="flex items-center gap-1.5 text-xs bg-white">
                    <Plus class="w-3.5 h-3.5" /> Nova Matrícula
                </Button>
            </div>

            <div v-if="matriculas.length === 0" class="p-8 text-center bg-white rounded-xl border border-slate-200 border-dashed text-slate-500">
                Este aluno ainda não possui nenhuma matrícula registrada.
            </div>

            <!-- CARDS DE MATRÍCULA -->
            <div class="space-y-4">
                <Card v-for="(mat, index) in matriculas" :key="mat.id" class="overflow-hidden border-slate-200 shadow-sm transition-all hover:border-indigo-200">
                    
                    <!-- Header do Card da Matrícula -->
                    <div class="bg-slate-50 p-3 px-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <span class="bg-indigo-100 text-indigo-700 font-bold w-6 h-6 rounded-full flex items-center justify-center text-xs">
                                {{ matriculas.length - index }}
                            </span>
                            <div class="w-64">
                                <Select v-model="mat.curso_id" :options="cursosDisponiveis" placeholder="Selecione o Curso" class="h-8 text-sm" />
                            </div>
                        </div>
                        
                        <div class="flex items-center gap-2">
                            <Badge :variant="mat.situacao === 'concluido' ? 'success' : (mat.situacao === 'cancelado' ? 'destructive' : 'outline')" class="uppercase text-[10px]">
                                {{ mat.situacao }}
                            </Badge>
                        </div>
                    </div>

                    <CardContent class="p-5">
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
                            
                            <!-- COLUNA 1 -->
                            <div class="space-y-4">
                                <FormGroup label="Situação" :id="'sit-'+mat.id">
                                    <Select v-model="mat.situacao" :options="opcoesSituacaoMatricula" />
                                </FormGroup>
                                <FormGroup label="Situação do Certificado" :id="'cert-'+mat.id">
                                    <Select v-model="mat.situacao_certificado" :options="opcoesSituacaoCertificado" />
                                </FormGroup>
                            </div>

                            <!-- COLUNA 2 -->
                            <div class="space-y-4">
                                <FormGroup label="Data de Início" :id="'inicio-'+mat.id">
                                    <div class="relative">
                                        <Calendar class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input type="date" v-model="mat.data_inicio" class="pl-9" />
                                    </div>
                                </FormGroup>
                                <FormGroup label="Previsão de Término" :id="'fim-'+mat.id">
                                    <div class="relative">
                                        <Calendar class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input type="date" v-model="mat.data_fim" class="pl-9" />
                                    </div>
                                </FormGroup>
                                <FormGroup label="Data de Conclusão Oficial" :id="'conc-'+mat.id">
                                    <div class="relative">
                                        <CheckCircle class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input type="date" v-model="mat.data_conclusao" class="pl-9" :disabled="mat.situacao !== 'concluido'" />
                                    </div>
                                    <p v-if="mat.situacao !== 'concluido'" class="text-[10px] text-slate-400 mt-1">Apenas para matrículas concluídas.</p>
                                </FormGroup>
                            </div>

                            <!-- COLUNA 3 - HORÁRIOS DA TURMA (Somente leitura protegida) -->
                            <div class="lg:border-l lg:border-slate-100 lg:pl-6">
                                <div class="h-full flex flex-col">
                                    <label class="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                                        <Clock class="w-4 h-4" /> Horários da Turma
                                    </label>
                                    
                                    <div class="flex-1 bg-slate-50 border border-slate-200 rounded-md p-3 overflow-y-auto max-h-[220px]">
                                        
                                        <div v-if="formatarHorarioExibicao(mat.horario).length === 0" class="text-sm text-slate-400 italic mt-2">
                                            Nenhum horário definido.
                                        </div>
                                        
                                        <ul v-else class="space-y-2">
                                            <li v-for="(h, i) in formatarHorarioExibicao(mat.horario)" :key="i" class="text-xs text-slate-600 bg-white border border-slate-200 px-2 py-1.5 rounded flex items-center gap-2 shadow-sm">
                                                <div class="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></div>
                                                <span class="capitalize">{{ h }}</span>
                                            </li>
                                        </ul>

                                    </div>
                                    <p class="text-[10px] text-slate-400 mt-2 leading-tight">
                                        A edição da grade de horários é restrita para garantir a consistência do sistema.
                                    </p>
                                </div>
                            </div>

                        </div>
                    </CardContent>
                </Card>
            </div>

        </div>
    </div>
</template>