<script setup>
    import { ref, computed, onMounted, onUnmounted } from 'vue';
    import { supabase } from '@/lib/supabase';
    import { Search, ChevronRight, Menu, UserPen, UserX, UserCheck, BookOpen } from '@lucide/vue';
    import { toast } from '@/composables/useToast';
    import { formatarNome } from '@/utils/formatters';
    import { useRouter } from 'vue-router';

    const router = useRouter();

    import Button from '@/components/ui/Button.vue';
    import Card from '@/components/ui/Card.vue';
    import CardHeader from '@/components/ui/CardHeader.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Dropdown from '@/components/ui/Dropdown.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Input from '@/components/ui/Input.vue';
    import Badge from '@/components/ui/Badge.vue';
    import Avatar from '@/components/ui/Avatar.vue';

    import SublistaMatriculas from '../components/SublistaMatriculas.vue';

    // Estados
    const alunos = ref([]);
    const carregando = ref(true);
    const termoPesquisa = ref('');
    const linhaExpandida = ref(null);
    let realtimeChannel;

    const irParaNovaMatricula = (aluno) => {
        router.push(`/professor/nova-matricula/${aluno.id}`);
    };


    // Ações da interface
    const toggleLinha = (id) => {
        linhaExpandida.value = linhaExpandida.value === id ? null : id;
    };

    const abrirModalEdicaoAluno = (aluno) => {
        router.push('/professor/editar-aluno/' + aluno.id);
    };

    const abrirModalEdicaoMatricula = (matricula) => {
        toast.info("Em breve", `Abrir edição da matrícula ID: ${matricula.id}`);
    };

    // Busca de dados
    const buscarAlunos = async (silencioso = false) => {
        if (!silencioso) carregando.value = true;

        try {
            const { data, error } = await supabase
                .from('aluno')
                .select(`
                    id, nome, codigo, ativo,
                    matricula (
                        id, situacao, data_inicio, data_fim, data_conclusao,
                        curso (nome)
                    )
                `)
                .order('nome');

            if (error) throw error;
            alunos.value = data;
        } catch (err) {
            console.error("Erro ao buscar alunos:", err);
            toast.error("Erro", "Não foi possível carregar a lista de alunos.");
        } finally {
            if (!silencioso) carregando.value = false;
        }
    };

    // Filtro por nome ou código
    const alunosFiltrados = computed(() => {
        const termo = termoPesquisa.value.toLowerCase().trim();
        if (!termo) return alunos.value;

        return alunos.value.filter(aluno => 
            aluno.nome.toLowerCase().includes(termo) || 
            aluno.codigo.toLowerCase().includes(termo)
        );
    });

    // Ciclo de vida e Realtime
    onMounted(() => {
        buscarAlunos();

        realtimeChannel = supabase
            .channel('controle_geral_changes')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'aluno' }, () => {
                buscarAlunos(true);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matricula' }, () => {
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
        <!-- Busca -->
        <Card>
            <CardHeader class="p-4 font-bold text-xl border-b border-border">
                <h2>Controle Geral de Alunos</h2>
            </CardHeader>
            <CardContent class="p-4">
                <div class="max-w-md">
                    <FormGroup label="Pesquisar Aluno" id="pesquisa">
                        <div class="relative">
                            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input v-model="termoPesquisa" placeholder="Buscar por nome ou código..." class="pl-9" />
                        </div>
                    </FormGroup>
                </div>
            </CardContent>
        </Card>

        <!-- Lista Expansível -->
        <Card class="min-h-[60dvh]">
            <div v-if="carregando" class="p-8 text-center text-muted-foreground">
                Carregando dados dos alunos...
            </div>

            <div v-else-if="alunosFiltrados.length === 0" class="p-8 text-center text-muted-foreground">
                Nenhum aluno encontrado.
            </div>

            <div v-else class="flex flex-col">
                <!-- Cabeçalho Desktop -->
                <div class="hidden md:flex items-center gap-4 p-4 border-b border-border bg-slate-50/50 text-sm font-semibold text-slate-600">
                    <div class="w-6"></div>
                    <div class="flex-1">Identificação do Aluno</div>
                    <div class="w-32 text-center">Código</div>
                    <div class="w-32 text-center">Status</div>
                    <div class="w-16 text-center">Ações</div>
                </div>

                <!-- Linhas de Alunos -->
                <div 
                    v-for="aluno in alunosFiltrados" 
                    :key="aluno.id" 
                    class="border-b border-border last:border-0 flex flex-col transition-colors"
                    :class="{'bg-slate-50/50': linhaExpandida === aluno.id}"
                >
                    <!-- Linha Principal -->
                    <div 
                        class="flex items-center justify-between gap-2 p-3 md:p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                        @click="toggleLinha(aluno.id)"
                    >
                        <div class="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                            <div 
                                class="text-slate-400 transition-transform duration-300 ease-in-out shrink-0" 
                                :class="{'rotate-90 text-indigo-500': linhaExpandida === aluno.id}"
                            >
                                <ChevronRight class="w-5 h-5" />
                            </div>

                            <Avatar :name="aluno.nome" class="w-9 h-9 md:w-10 md:h-10" />

                            <span class="font-bold text-slate-900 leading-tight truncate">
                                {{ formatarNome(aluno.nome) }}
                            </span>
                        </div>

                        <div class="flex items-center gap-4 shrink-0">
                            <div class="hidden md:block w-32 text-center text-sm font-mono text-slate-600">
                                {{ aluno.codigo }}
                            </div>

                            <div class="hidden md:flex w-32 justify-center">
                                <Badge :variant="aluno.ativo ? 'success' : 'secondary'">
                                    {{ aluno.ativo ? 'Ativo' : 'Inativo' }}
                                </Badge>
                            </div>

                            <!-- Menu Dropdown -->
                            <div class="w-auto md:w-16 flex justify-end md:justify-center" @click.stop>
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
                                        <button @click="abrirModalEdicaoAluno(aluno)" class="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors cursor-pointer">
                                            <UserPen size="18"/>
                                            Editar Aluno
                                        </button>
                                        <button
                                            @click="irParaNovaMatricula(aluno)"
                                            class="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors cursor-pointer"
                                        >
                                            <BookOpen class="w-4 h-4" /> Nova Matrícula
                                        </button>
                                        <hr class="my-1 border-border" />
                                        <button v-if="aluno.ativo" class="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
                                            <UserX class="w-4 h-4" /> Desativar Aluno
                                        </button>
                                        <button v-else class="w-full flex items-center gap-2 px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer">
                                            <UserCheck class="w-4 h-4" /> Reativar Aluno
                                        </button>
                                    </template>
                                </Dropdown>
                            </div>
                        </div>
                    </div>

                    <!-- Sublista Expansível -->
                    <div 
                        class="grid transition-all duration-300 ease-in-out"
                        :class="linhaExpandida === aluno.id ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
                    >
                        <div class="overflow-hidden">
                            <SublistaMatriculas 
                                :matriculas="aluno.matricula" 
                                @ver-detalhes="abrirModalEdicaoMatricula" 
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    </div>
</template>