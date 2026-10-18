<script setup>
    import { ref, computed, onMounted, onUnmounted } from 'vue';
    import { supabase } from '@/lib/supabase';
    import { Search, Menu, ChevronDown, Clock, XCircle, PauseCircle } from '@lucide/vue';
    import { toast } from '@/composables/useToast';
    import { formatarDataBR } from '@/utils/dateHelpers';
    import { formatarNome, capitalizar } from '@/utils/formatters';

    import Button from '@/components/ui/Button.vue';
    import Card from '@/components/ui/Card.vue';
    import CardHeader from '@/components/ui/CardHeader.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Dropdown from '@/components/ui/Dropdown.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Input from '@/components/ui/Input.vue';
    import Badge from '@/components/ui/Badge.vue';
    import Avatar from '@/components/ui/Avatar.vue';

    // Estados
    const alunos = ref([]);
    const carregando = ref(true);
    const termoPesquisa = ref('');
    let realtimeChannel;

    // Configuração visual do status do certificado
    const getConfigCertificado = (situacao) => {
        const str = situacao?.toLowerCase() || 'nao_solicitado';
        const formatado = str.replace('_', ' ');

        const configs = {
            'nao_solicitado': { variant: 'ghost', texto: formatado },
            'pendente': { variant: 'ghost', texto: formatado },
            'emitido': { variant: 'ghost', texto: formatado },
            'entregue': { variant: 'ghost', texto: formatado }
        };
        return configs[str] || configs['nao_solicitado'];
    };

    // Altera situação da matrícula (remove dos concluídos)
    const atualizarSituacao = async (matriculaId, novaSituacao) => {
        try {
            const { error } = await supabase
                .from('matricula')
                .update({ situacao: novaSituacao, atualizado_em: new Date().toISOString() })
                .eq('id', matriculaId);

            if (error) throw error;
            toast.success("Sucesso", `Ação realizada. Matrícula: ${capitalizar(novaSituacao)}!`);
            buscarAlunos(true);
        } catch (err) {
            console.error("Erro ao atualizar situação:", err);
            toast.error("Erro", "Não foi possível alterar a situação.");
        }
    };

    // Altera status do certificado
    const atualizarCertificado = async (matriculaId, novoStatus) => {
        try {
            const { error } = await supabase
                .from('matricula')
                .update({ situacao_certificado: novoStatus, atualizado_em: new Date().toISOString() })
                .eq('id', matriculaId);

            if (error) throw error;
            toast.success("Sucesso", "Status do certificado atualizado!");
            buscarAlunos(true);
        } catch (err) {
            console.error("Erro ao atualizar certificado:", err);
            toast.error("Erro", "Não foi possível atualizar o certificado.");
        }
    };

    // Busca alunos com matrículas concluídas
    const buscarAlunos = async (silencioso = false) => {
        if (!silencioso) carregando.value = true;

        try {
            const { data, error } = await supabase
                .from('aluno')
                .select(`
                    id, nome, codigo,
                    matricula!inner (
                        id, situacao, situacao_certificado, data_conclusao,
                        curso (nome)
                    )
                `)
                .eq('matricula.situacao', 'concluido')
                .order('nome');

            if (error) throw error;
            alunos.value = data;
        } catch (err) {
            console.error("Erro ao buscar alunos concluídos:", err);
            toast.error("Erro", "Não foi possível carregar a lista.");
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
            .channel('controle_concluidos_changes')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'aluno' }, () => buscarAlunos(true))
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matricula' }, () => buscarAlunos(true))
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
                <h2>Controle de Concluídos</h2>
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

        <!-- Lista -->
        <Card class="min-h-[60dvh]">
            <div v-if="carregando" class="p-8 text-center text-muted-foreground">
                Carregando dados dos alunos concluídos...
            </div>

            <div v-else-if="alunosFiltrados.length === 0" class="p-8 text-center text-muted-foreground">
                Nenhum aluno concluído encontrado.
            </div>

            <div v-else class="flex flex-col">
                <!-- Cabeçalho Desktop -->
                <div class="hidden md:flex items-center gap-4 p-4 border-b border-border bg-slate-50/50 text-sm font-semibold text-slate-600">
                    <div class="flex-1">Identificação do Aluno</div>
                    <div class="w-48">Curso</div>
                    <div class="w-32 text-center">Conclusão</div>
                    <div class="w-40 text-center">Certificado</div>
                    <div class="w-16 text-center">Ações</div>
                </div>

                <!-- Linhas -->
                <div 
                    v-for="aluno in alunosFiltrados" 
                    :key="aluno.id" 
                    class="border-b border-border last:border-0 flex flex-col"
                >
                    <div 
                        v-for="mat in aluno.matricula" 
                        :key="mat.id"
                        class="flex items-center justify-between gap-2 p-3 md:p-4 hover:bg-slate-50 transition-colors"
                    >
                        <!-- Identificação (Esquerda) -->
                        <div class="flex items-center gap-2.5 md:gap-3 flex-1 min-w-0">
                            <Avatar :name="aluno.nome" class="w-9 h-9 md:w-10 md:h-10" />

                            <div class="flex flex-col min-w-0">
                                <span class="font-bold text-slate-900 leading-tight truncate">
                                    {{ formatarNome(aluno.nome) }}
                                </span>
                                <!-- Resumo de Curso e Data no Mobile -->
                                <span class="md:hidden text-xs text-slate-500 truncate mt-0.5">
                                    {{ mat.curso?.nome || 'Curso Desconhecido' }} • {{ formatarDataBR(mat.data_conclusao) }}
                                </span>
                            </div>
                        </div>

                        <!-- Dados e Ações (Direita) -->
                        <div class="flex items-center gap-2 md:gap-4 shrink-0">
                            <div class="hidden md:block w-48 text-sm font-medium text-slate-700 truncate">
                                {{ mat.curso?.nome || 'Curso Desconhecido' }}
                            </div>

                            <div class="hidden md:block w-32 text-center text-sm text-slate-500">
                                {{ formatarDataBR(mat.data_conclusao) }}
                            </div>

                            <!-- Dropdown de Certificado (Visível em Desktop e Mobile) -->
                            <div class="hidden md:flex w-40 justify-center">
                                <Dropdown align="center" class="static">
                                    <template #trigger>
                                        <div class="cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-md shadow-sm">
                                            <Badge :variant="getConfigCertificado(mat.situacao_certificado).variant" class="text-[9px] md:text-[10px] px-1.5 md:px-2 py-0 uppercase whitespace-nowrap">
                                                {{ getConfigCertificado(mat.situacao_certificado).texto }}
                                            </Badge>
                                            <ChevronDown class="w-3 h-3 text-slate-400" />
                                        </div>
                                    </template>
                                    <template #content>
                                        <div class="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-border">
                                            Status do Certificado
                                        </div>
                                        <button @click="atualizarCertificado(mat.id, 'nao_solicitado')" class="w-full text-left px-4 py-2 hover:bg-slate-100 text-slate-600 transition-colors text-xs font-medium">Não Solicitado</button>
                                        <button @click="atualizarCertificado(mat.id, 'pendente')" class="w-full text-left px-4 py-2 hover:bg-amber-50 text-amber-600 transition-colors text-xs font-medium">Pendente</button>
                                        <button @click="atualizarCertificado(mat.id, 'emitido')" class="w-full text-left px-4 py-2 hover:bg-blue-50 text-blue-600 transition-colors text-xs font-medium">Emitido</button>
                                        <button @click="atualizarCertificado(mat.id, 'entregue')" class="w-full text-left px-4 py-2 hover:bg-emerald-50 text-emerald-600 transition-colors text-xs font-medium border-t border-slate-100">Entregue</button>
                                    </template>
                                </Dropdown>
                            </div>

                            <!-- Menu de Ações (Visível em Desktop e Mobile) -->
                            <div class="w-auto md:w-16 flex justify-center">
                                <Dropdown align="right">
                                    <template #trigger>
                                        <Button size="sm" variant="outline" class="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-2 rounded-md transition-colors shadow-sm">
                                            <Menu class="w-4 h-4" />
                                        </Button>
                                    </template>
                                    <template #content>
                                        <div class="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-border">
                                            Reverter Conclusão
                                        </div>
                                        <button @click="atualizarSituacao(mat.id, 'cursando')" class="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 transition-colors">
                                            <Clock class="w-4 h-4" /> Voltar para Cursando
                                        </button>
                                        <button @click="atualizarSituacao(mat.id, 'trancado')" class="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors">
                                            <PauseCircle class="w-4 h-4" /> Marcar como Trancado
                                        </button>
                                        <hr class="my-1 border-border" />
                                        <button @click="atualizarSituacao(mat.id, 'cancelado')" class="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                                            <XCircle class="w-4 h-4" /> Cancelar Matrícula
                                        </button>
                                    </template>
                                </Dropdown>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    </div>
</template>