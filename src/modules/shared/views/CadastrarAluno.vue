<script setup>
    import { ref, onMounted } from 'vue';
    import { useRouter } from 'vue-router';
    import { supabase } from '@/lib/supabase';
    import { UserPlus, User, BookOpen, Sparkles, RotateCcw } from '@lucide/vue';
    import { toast } from '@/composables/useToast';
    import { formatarNome } from '@/utils/formatters';

    import Button from '@/components/ui/Button.vue';
    import Card from '@/components/ui/Card.vue';
    import CardHeader from '@/components/ui/CardHeader.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Input from '@/components/ui/Input.vue';
    import Switch from '@/components/ui/Switch.vue';
    import Badge from '@/components/ui/Badge.vue';
    import Avatar from '@/components/ui/Avatar.vue';

    const router = useRouter();

    // Estados
    const salvando = ref(false);
    const irParaMatricula = ref(true);
    const tipoUsuario = ref(null)

    const form = ref({
        nome: '',
        codigo: '',
        ativo: true
    });

    // Gera código aleatório no padrão AL + 5 dígitos
    const gerarCodigoAleatorio = () => {
        const numeros = Math.floor(10000 + Math.random() * 90000);
        form.value.codigo = `AL${numeros}`;
    };

    // Limpa os campos do formulário
    const limparFormulario = () => {
        form.value = {
            nome: '',
            codigo: '',
            ativo: true
        };
    };

    // Salva o aluno no banco
    const cadastrarAluno = async () => {
        const nomeLimpo = form.value.nome.trim();
        const codigoLimpo = form.value.codigo.trim();

        if (!nomeLimpo || !codigoLimpo) {
            toast.error("Atenção", "Nome e código do aluno são obrigatórios.");
            return;
        }

        salvando.value = true;
        try {
            const { data: novoAluno, error } = await supabase
                .from('aluno')
                .insert([{
                    nome: nomeLimpo,
                    codigo: codigoLimpo,
                    ativo: form.value.ativo
                }])
                .select()
                .single();

            if (error) {
                // Erro de constraint UNIQUE no Postgres
                if (error.code === '23505') {
                    toast.error("Código em uso", "Já existe um aluno cadastrado com este código.");
                    return;
                }
                throw error;
            }

            // Redireciona para Nova Matrícula ou limpa para novo cadastro
            if (irParaMatricula.value && novoAluno?.id) {
                toast.success("Sucesso", "Aluno cadastrado! Selecione o curso para matrícula.");
                router.push(`/${tipoUsuario.value}/nova-matricula/${novoAluno.id}`);
            } else {
                toast.success("Sucesso", "Aluno cadastrado com sucesso!");
                limparFormulario();
            }
        } catch (err) {
            console.error("Erro ao cadastrar aluno:", err);
            toast.error("Erro", "Não foi possível cadastrar o aluno.");
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
</script>

<template>
    <div class="space-y-6">
        <!-- Cabeçalho com Pré-visualização do Aluno -->
        <Card>
            <CardContent class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar :name="form.nome || 'Novo Aluno'" class="shrink-0" />
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                            <h2 class="font-bold text-base sm:text-lg text-slate-900 leading-tight truncate">
                                {{ form.nome.trim() ? formatarNome(form.nome) : 'Novo Aluno' }}
                            </h2>
                            <Badge :variant="form.ativo ? 'success' : 'secondary'" class="text-[10px] px-2 py-0 shrink-0">
                                {{ form.ativo ? 'Ativo' : 'Inativo' }}
                            </Badge>
                        </div>
                        <p class="text-xs text-slate-500 truncate">
                            Código: {{ form.codigo.trim() || 'Não definido' }}
                        </p>
                    </div>
                </div>

                <!-- Ações -->
                <div class="flex items-center justify-end gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-border shrink-0">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        @click="limparFormulario" 
                        :disabled="salvando || (!form.nome && !form.codigo)"
                    >
                        <RotateCcw class="w-4 h-4 mr-1" />
                        Limpar
                    </Button>

                    <Button 
                        variant="default" 
                        size="sm" 
                        @click="cadastrarAluno" 
                        :disabled="salvando"
                    >
                        <UserPlus class="w-4 h-4 mr-1.5" />
                        {{ salvando ? 'Cadastrando...' : (irParaMatricula ? 'Cadastrar e Matricular' : 'Cadastrar Aluno') }}
                    </Button>
                </div>
            </CardContent>
        </Card>

        <!-- Dados Cadastrais -->
        <Card>
            <CardHeader class="p-4 border-b border-border flex flex-row items-center gap-2">
                <h3 class="font-bold text-base text-slate-900">Dados Cadastrais</h3>
            </CardHeader>

            <CardContent class="p-4">
                <div class="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                    <div class="sm:col-span-6">
                        <FormGroup label="Nome Completo *" id="cad-nome">
                            <Input 
                                v-model="form.nome" 
                                placeholder="Digite o nome completo do aluno..." 
                                @keyup.enter="cadastrarAluno"
                            />
                        </FormGroup>
                    </div>

                    <div class="sm:col-span-3">
                        <FormGroup label="Código de Acesso *" id="cad-codigo">
                            <div class="flex items-center gap-1.5">
                                <Input 
                                    v-model="form.codigo" 
                                    placeholder="Ex: 001234" 
                                    @keyup.enter="cadastrarAluno"
                                />
                                <!-- <Button 
                                    type="button"
                                    variant="outline" 
                                    size="sm" 
                                    class="h-10 px-2.5 shrink-0 bg-white"
                                    title="Gerar código automático"
                                    @click="gerarCodigoAleatorio"
                                >
                                    <Sparkles class="w-4 h-4 text-indigo-600" />
                                </Button> -->
                            </div>
                        </FormGroup>
                    </div>

                    <div class="sm:col-span-3">
                        <FormGroup label="Status do Cadastro" id="cad-status">
                            <div class="flex items-center gap-3 h-10 px-3 rounded-md border border-slate-200 bg-slate-50/50">
                                <Switch 
                                    id="switch-cad-ativo"
                                    variant="emerald"
                                    v-model="form.ativo" 
                                />
                                <label 
                                    for="switch-cad-ativo" 
                                    class="text-sm font-medium cursor-pointer select-none"
                                    :class="form.ativo ? 'text-emerald-700' : 'text-slate-500'"
                                >
                                    {{ form.ativo ? 'Aluno Ativo' : 'Aluno Inativo' }}
                                </label>
                            </div>
                        </FormGroup>
                    </div>
                </div>
            </CardContent>
        </Card>

        <!-- Opção de Fluxo: Matrícula -->
        <Card>
            <CardContent class="p-4 flex items-center justify-between gap-4">
                <div class="flex items-start sm:items-center gap-3">
                    <div class="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                        <BookOpen class="w-5 h-5" />
                    </div>
                    <div>
                        <label for="switch-ir-matricula" class="text-sm font-bold text-slate-900 cursor-pointer select-none">
                            Vincular matrícula em seguida (Opcional)
                        </label>
                        <p class="text-xs text-slate-500">
                            Se ativado, você será levado direto para a tela de Nova Matrícula após salvar o aluno.
                        </p>
                    </div>
                </div>

                <Switch 
                    id="switch-ir-matricula"
                    v-model="irParaMatricula" 
                />
            </CardContent>
        </Card>
    </div>
</template>