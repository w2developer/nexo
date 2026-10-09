<script setup>
    import { ref, computed, onMounted, onUnmounted } from 'vue';
    import { supabase } from '@/lib/supabase';
    import { Search, ChevronRight, Menu, Edit, UserX, UserCheck, BookOpen } from '@lucide/vue';
    import { toast } from '@/composables/useToast';

    import Button from '@/components/ui/Button.vue';
    import Card from '@/components/ui/Card.vue';
    import CardHeader from '@/components/ui/CardHeader.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Dropdown from '@/components/ui/Dropdown.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Input from '@/components/ui/Input.vue';
    import Badge from '@/components/ui/Badge.vue';
    import Avatar from '@/components/ui/Avatar.vue';
    import Table from '@/components/ui/Table.vue';
    import TableHeader from '@/components/ui/TableHeader.vue';
    import TableHead from '@/components/ui/TableHead.vue';
    import TableCell from '@/components/ui/TableCell.vue';
    import TableBody from '@/components/ui/TableBody.vue';
    import TableRow from '@/components/ui/TableRow.vue';
import router from '@/router';

    // --- ESTADOS ---
    const alunos = ref([]);
    const carregando = ref(true);
    const termoPesquisa = ref('');
    const linhaExpandida = ref(null); 
    
    let realtimeChannel;

    // --- FUNÇÕES UTILITÁRIAS ---
    const getInitials = (nome) => {
        if (!nome) return '??';
        const partes = nome.trim().split(' ').filter(Boolean);
        if (partes.length === 0) return '??';
        if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
        return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
    };

    const formatarNome = (nome) => {
        if (!nome) return '---';
        return nome.toLowerCase().split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    };

    const formatarData = (dateStr) => {
        if (!dateStr) return '---';
        const [ano, mes, dia] = dateStr.split('T')[0].split('-');
        return `${dia}/${mes}/${ano}`;
    };

    const capitalizar = (texto) => {
        if (!texto) return '';
        return texto.charAt(0).toUpperCase() + texto.slice(1);
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

    const getBadgeVariantMatricula = (situacao) => {
        const str = situacao?.toLowerCase();
        if (str === 'concluido') return 'success';
        if (str === 'cancelado') return 'destructive';
        if (str === 'trancado') return 'secondary';
        return 'outline';
    };

    // --- AÇÕES DA INTERFACE ---
    const toggleLinha = (id) => {
        linhaExpandida.value = linhaExpandida.value === id ? null : id;
    };

    const abrirModalEdicaoAluno = (aluno) => {
        // toast.info("Em breve", `Abrir edição do aluno: ${aluno.nome}`);
        router.push('/professor/editar-aluno/' + aluno.id)
    };

    const abrirModalEdicaoMatricula = (matricula) => {
        toast.info("Em breve", `Abrir edição da matrícula ID: ${matricula.id}`);
    };

    // --- BUSCA DE DADOS ---
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

    // --- FILTROS ---
    const alunosFiltrados = computed(() => {
        const termo = termoPesquisa.value.toLowerCase().trim();
        if (!termo) return alunos.value;

        return alunos.value.filter(aluno => 
            aluno.nome.toLowerCase().includes(termo) || 
            aluno.codigo.toLowerCase().includes(termo)
        );
    });

    // --- SETUP INICIAL E REALTIME ---
    onMounted(() => {
        buscarAlunos();

        realtimeChannel = supabase
            .channel('controle_geral_changes')
            // Escuta mudanças na tabela ALUNO (nome, ativo, código)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'aluno' }, () => {
                buscarAlunos(true); 
            })
            // Escuta mudanças na tabela MATRICULA (situação, datas)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matricula' }, () => {
                buscarAlunos(true); 
            })
            .subscribe((status) => {
                console.log("Status Realtime (Controle):", status);
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
        
        <!-- HEADER DE BUSCA -->
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

        <!-- LISTA EXPANSÍVEL -->
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

                <!-- Lista de Alunos -->
                <div 
                    v-for="aluno in alunosFiltrados" 
                    :key="aluno.id" 
                    class="border-b border-border last:border-0 flex flex-col transition-colors"
                    :class="{'bg-slate-50/50': linhaExpandida === aluno.id}"
                >
                    <!-- LINHA PRINCIPAL -->
                    <div 
                        class="flex items-center justify-between gap-2 p-3 md:p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                        @click="toggleLinha(aluno.id)"
                    >
                        
                        <!-- Lado Esquerdo -->
                        <div class="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                            <div class="text-slate-400 transition-transform duration-300 ease-in-out shrink-0" :class="{'rotate-90 text-indigo-500': linhaExpandida === aluno.id}">
                                <ChevronRight class="w-5 h-5" />
                            </div>
                            
                            <div 
                                class="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full font-semibold text-sm shrink-0"
                                :class="getAvatarColor(aluno.nome)"
                            >
                                {{ getInitials(aluno.nome) }}
                            </div>
                            
                            <span class="font-bold text-slate-900 leading-tight truncate">
                                {{ formatarNome(aluno.nome) }}
                            </span>
                        </div>

                        <!-- Lado Direito -->
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
                                        <button @click="abrirModalEdicaoAluno(aluno)" class="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors">
                                            <Edit class="w-4 h-4" /> Editar Aluno
                                        </button>
                                        <button class="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors">
                                            <BookOpen class="w-4 h-4" /> Nova Matrícula
                                        </button>
                                        <hr class="my-1 border-border" />
                                        <button v-if="aluno.ativo" class="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                                            <UserX class="w-4 h-4" /> Desativar Aluno
                                        </button>
                                        <button v-else class="w-full flex items-center gap-2 px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 transition-colors">
                                            <UserCheck class="w-4 h-4" /> Reativar Aluno
                                        </button>
                                    </template>
                                </Dropdown>
                            </div>
                        </div>
                    </div>

                    <!-- SUBLISTA: MATRÍCULAS -->
                    <div 
                        class="grid transition-all duration-300 ease-in-out"
                        :class="linhaExpandida === aluno.id ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
                    >
                        <div class="overflow-hidden">
                            <div class="p-3 pt-0 pl-11 md:p-4 md:pt-0 md:pl-16">
                                
                                <div v-if="!aluno.matricula || aluno.matricula.length === 0" class="mt-2 text-sm text-slate-500 italic">
                                    Nenhum histórico de matrículas.
                                </div>

                                <template v-else>
                                    <!-- VISUALIZAÇÃO DESKTOP -->
                                    <div class="hidden md:block mt-2 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                                        <Table>
                                            <TableHeader class="bg-slate-50">
                                                <TableRow>
                                                    <TableHead class="pl-4 text-xs">Curso</TableHead>
                                                    <TableHead class="text-xs">Situação</TableHead>
                                                    <TableHead class="text-xs">Início</TableHead>
                                                    <TableHead class="text-xs">Término/Conclusão</TableHead>
                                                    <TableHead class="text-xs text-end pr-4">Gerenciar</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                <TableRow v-for="mat in aluno.matricula" :key="mat.id">
                                                    <TableCell class="pl-4 py-2 font-medium text-sm text-slate-700">
                                                        {{ mat.curso?.nome || 'Curso Desconhecido' }}
                                                    </TableCell>
                                                    <TableCell class="py-2">
                                                        <Badge 
                                                            :variant="getBadgeVariantMatricula(mat.situacao)" 
                                                            class="text-[10px] px-2 py-0"
                                                            :class="mat.situacao === 'cursando' ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' : ''"
                                                        >
                                                            {{ capitalizar(mat.situacao) }}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell class="py-2 text-sm text-slate-500">
                                                        {{ formatarData(mat.data_inicio) }}
                                                    </TableCell>
                                                    <TableCell class="py-2 text-sm text-slate-500">
                                                        {{ formatarData(mat.data_conclusao || mat.data_fim) }}
                                                    </TableCell>
                                                    <TableCell class="pr-4 py-2 text-end">
                                                        <Button size="sm" variant="outline" class="h-7 px-2 text-xs" @click="abrirModalEdicaoMatricula(mat)">
                                                            Ver Detalhes
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </div>

                                    <!-- VISUALIZAÇÃO MOBILE -->
                                    <div class="md:hidden mt-2 space-y-2">
                                        <div 
                                            v-for="mat in aluno.matricula" 
                                            :key="'mob-'+mat.id"
                                            class="flex items-center justify-between p-2 rounded-md bg-white border border-slate-100"
                                        >
                                            <div class="flex flex-col min-w-0 pr-2">
                                                <span class="text-sm font-medium text-slate-700 truncate">
                                                    {{ mat.curso?.nome || 'Curso Desconhecido' }}
                                                </span>
                                                <span class="text-xs text-slate-400">
                                                    {{ formatarData(mat.data_inicio) }}
                                                </span>
                                            </div>
                                            <Badge 
                                                :variant="getBadgeVariantMatricula(mat.situacao)" 
                                                class="text-[10px] px-2 py-0 shrink-0"
                                                :class="mat.situacao === 'cursando' ? 'bg-amber-100 text-amber-700 border-amber-200' : ''"
                                            >
                                                {{ capitalizar(mat.situacao) }}
                                            </Badge>
                                        </div>
                                    </div>
                                </template>

                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </Card>
    </div>
</template>