<script setup>
    import { ref, computed, onMounted, onUnmounted } from 'vue';
    import { supabase } from '@/lib/supabase';
    import { Search, ChevronRight, Menu, ChevronDown, Clock, XCircle, PauseCircle } from '@lucide/vue';
    import { toast } from '@/composables/useToast';

    import Button from '@/components/ui/Button.vue';
    import Card from '@/components/ui/Card.vue';
    import CardHeader from '@/components/ui/CardHeader.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import Dropdown from '@/components/ui/Dropdown.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Input from '@/components/ui/Input.vue';
    import Badge from '@/components/ui/Badge.vue';

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

    // Retorna apenas um array simples com os horários formatados
    const formatarHorario = (horarioObj) => {
        if (!horarioObj || !horarioObj.horario || !Array.isArray(horarioObj.horario) || horarioObj.horario.length === 0) {
            return ['Sem horários definidos'];
        }
        return horarioObj.horario.map(h => `${h.dia_semana?.slice(0,3) || ''} ${h.turno || ''} (${h.hora_inicio || ''})`);
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

    // --- AÇÕES DA INTERFACE ---
    const toggleLinha = (id) => {
        linhaExpandida.value = linhaExpandida.value === id ? null : id;
    };

    // Atualiza a SITUAÇÃO da matrícula (Tira da lista de concluídos)
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

    // Atualiza o STATUS DO CERTIFICADO
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

    // --- BUSCA DE DADOS ---
    const buscarAlunos = async (silencioso = false) => {
        if (!silencioso) carregando.value = true;
        
        try {
            const { data, error } = await supabase
                .from('aluno')
                .select(`
                    id, nome, codigo,
                    matricula!inner (
                        id, situacao, situacao_certificado, data_conclusao, horario,
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
            .channel('controle_concluidos_changes')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'aluno' }, () => buscarAlunos(true))
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matricula' }, () => buscarAlunos(true))
            .subscribe((status) => console.log("Status Realtime (Concluídos):", status));
    });

    onUnmounted(() => {
        if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    });
</script>

<template>
    <div class="space-y-6">
        
        <!-- HEADER DE BUSCA -->
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

        <!-- LISTA -->
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
                    <div class="w-6"></div> 
                    <div class="flex-1">Identificação do Aluno</div>
                    <div class="w-48">Curso</div>
                    <div class="w-32 text-center">Conclusão</div>
                    <div class="w-40 text-center">Certificado</div>
                    <div class="w-16 text-center">Ações</div>
                </div>

                <!-- Lista de Alunos -->
                <div 
                    v-for="aluno in alunosFiltrados" 
                    :key="aluno.id" 
                    class="border-b border-border last:border-0 flex flex-col transition-colors"
                    :class="{'bg-slate-50/50': linhaExpandida === aluno.id}"
                >
                    <template v-for="mat in aluno.matricula" :key="mat.id">
                        
                        <!-- LINHA PRINCIPAL -->
                        <div 
                            class="flex items-center justify-between gap-2 p-3 md:p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                            @click="toggleLinha(mat.id)"
                        >
                            
                            <!-- Identificação (Esquerda) -->
                            <div class="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                                <div class="text-slate-400 transition-transform duration-300 ease-in-out shrink-0" :class="{'rotate-90 text-indigo-500': linhaExpandida === mat.id}">
                                    <ChevronRight class="w-5 h-5" />
                                </div>
                                
                                <div 
                                    class="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full font-semibold text-sm shrink-0"
                                    :class="getAvatarColor(aluno.nome)"
                                >
                                    {{ getInitials(aluno.nome) }}
                                </div>
                                
                                <div class="flex flex-col min-w-0">
                                    <span class="font-bold text-slate-900 leading-tight truncate">
                                        {{ formatarNome(aluno.nome) }}
                                    </span>
                                    <!-- Informações no Mobile aparecem abaixo do nome -->
                                    <span class="md:hidden text-xs text-slate-500 truncate mt-0.5">
                                        {{ mat.curso?.nome || 'Curso Desconhecido' }} • {{ formatarData(mat.data_conclusao) }}
                                    </span>
                                </div>
                            </div>

                            <!-- Informações da Matrícula (Direita - Apenas Desktop) -->
                            <div class="hidden md:flex items-center gap-4 shrink-0">
                                
                                <div class="w-48 text-sm font-medium text-slate-700 truncate">
                                    {{ mat.curso?.nome || 'Curso Desconhecido' }}
                                </div>
                                
                                <div class="w-32 text-center text-sm text-slate-500">
                                    {{ formatarData(mat.data_conclusao) }}
                                </div>

                                <div class="w-40 flex justify-center" @click.stop>
                                    <!-- DROPDOWN DE CERTIFICADO -->
                                    <Dropdown align="center" class="static">
                                        <template #trigger>
                                            <div class="cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-md shadow-sm">
                                                <Badge :variant="getConfigCertificado(mat.situacao_certificado).variant" class="text-[10px] px-2 py-0 uppercase whitespace-nowrap">
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

                                <!-- Menu de Ações -->
                                <div class="w-16 flex justify-center" @click.stop>
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

                            <!-- Layout Mobile (Direita) -->
                            <div class="md:hidden flex items-center gap-2 shrink-0" @click.stop>
                                <Dropdown align="right">
                                    <template #trigger>
                                        <Button size="sm" variant="outline" class="h-8 w-8 p-0 rounded-md bg-white border border-slate-200">
                                            <Menu class="w-4 h-4" />
                                        </Button>
                                    </template>
                                    <template #content>
                                        <div class="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-border">
                                            Ações
                                        </div>
                                        <button @click="atualizarSituacao(mat.id, 'cursando')" class="w-full text-left px-4 py-2 text-sm text-amber-700 hover:bg-amber-50">Voltar para Cursando</button>
                                        <button @click="atualizarSituacao(mat.id, 'trancado')" class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Marcar como Trancado</button>
                                        <button @click="atualizarSituacao(mat.id, 'cancelado')" class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Cancelar Matrícula</button>
                                    </template>
                                </Dropdown>
                            </div>
                        </div>

                        <!-- CONTEÚDO ESCONDIDO EXCLUSIVO DOS HORÁRIOS -->
                        <div 
                            class="grid transition-all duration-300 ease-in-out"
                            :class="linhaExpandida === mat.id ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
                        >
                            <div class="overflow-hidden">
                                <div class="p-3 pt-0 pl-11 md:p-4 md:pt-0 md:pl-16">
                                    
                                    <div class="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-2 shadow-sm">
                                        <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <Clock class="w-4 h-4" /> 
                                            Grade de Horários Registrada
                                        </h4>
                                        
                                        <!-- Lista de horários -->
                                        <div class="flex flex-wrap gap-2">
                                            <span 
                                                v-for="(horario, index) in formatarHorario(mat.horario)" 
                                                :key="index"
                                                class="text-xs font-medium text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-md shadow-sm"
                                            >
                                                {{ horario }}
                                            </span>
                                        </div>

                                        <!-- Ações exclusivas para mobile que não couberam na linha principal -->
                                        <div class="md:hidden mt-4 pt-4 border-t border-slate-200">
                                            <div class="flex items-center gap-2">
                                                <span class="text-xs font-medium text-slate-500">Certificado:</span>
                                                <Dropdown align="left">
                                                    <template #trigger>
                                                        <div class="cursor-pointer flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">
                                                            <Badge :variant="getConfigCertificado(mat.situacao_certificado).variant" class="text-[9px] px-1 py-0 uppercase">
                                                                {{ getConfigCertificado(mat.situacao_certificado).texto }}
                                                            </Badge>
                                                            <ChevronDown class="w-3 h-3 text-slate-400" />
                                                        </div>
                                                    </template>
                                                    <template #content>
                                                        <button @click="atualizarCertificado(mat.id, 'nao_solicitado')" class="w-full text-left px-4 py-2 hover:bg-slate-100 text-slate-600 text-xs">Não Solicitado</button>
                                                        <button @click="atualizarCertificado(mat.id, 'pendente')" class="w-full text-left px-4 py-2 hover:bg-amber-50 text-amber-600 text-xs">Pendente</button>
                                                        <button @click="atualizarCertificado(mat.id, 'emitido')" class="w-full text-left px-4 py-2 hover:bg-blue-50 text-blue-600 text-xs">Emitido</button>
                                                        <button @click="atualizarCertificado(mat.id, 'entregue')" class="w-full text-left px-4 py-2 hover:bg-emerald-50 text-emerald-600 text-xs">Entregue</button>
                                                    </template>
                                                </Dropdown>
                                            </div>
                                        </div>

                                    </div>

                                </div>
                            </div>
                        </div>

                    </template>
                </div>
            </div>
        </Card>
    </div>
</template>