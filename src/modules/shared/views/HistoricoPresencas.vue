<script setup>
    import { ref, onMounted } from 'vue';
    import { useRoute, useRouter } from 'vue-router';
    import { supabase } from '@/lib/supabase';
    import { ArrowLeft, Plus, Trash2, Calendar, Pencil, Check, X, History } from '@lucide/vue';
    import { toast } from '@/composables/useToast';
    import { formatarNome, capitalizar, getBadgeVariantMatricula } from '@/utils/formatters';
    import { formatarDataBR } from '@/utils/dateHelpers';

    import Button from '@/components/ui/Button.vue';
    import Card from '@/components/ui/Card.vue';
    import CardHeader from '@/components/ui/CardHeader.vue';
    import CardContent from '@/components/ui/CardContent.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Input from '@/components/ui/Input.vue';
    import Badge from '@/components/ui/Badge.vue';
    import Avatar from '@/components/ui/Avatar.vue';

    const route = useRoute();
    const router = useRouter();
    const matriculaId = Number(route.params.id);

    // Estados gerais
    const carregando = ref(true);
    const adicionando = ref(false);
    const processandoId = ref(null);

    // Dados da matrícula e presenças
    const dadosMatricula = ref(null);
    const presencas = ref([]);

    // Controle de nova presença e edição
    const novaData = ref('');
    const editandoId = ref(null);
    const dataEdicao = ref('');

    // Retorna a data local no formato YYYY-MM-DD
    const getDataHojeISO = () => {
        const hoje = new Date();
        const offset = hoje.getTimezoneOffset() * 60000;
        return new Date(hoje.getTime() - offset).toISOString().split('T')[0];
    };

    // Formata timestamp para hora (HH:mm)
    const formatarHora = (isoString) => {
        if (!isoString) return '';
        const data = new Date(isoString);
        return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    // Ordena presenças da mais recente para a mais antiga
    const ordenarPresencas = (lista) => {
        return lista.sort((a, b) => new Date(b.data_presenca) - new Date(a.data_presenca));
    };

    // Busca dados da matrícula, aluno, curso e histórico
    const carregarHistorico = async () => {
        carregando.value = true;
        try {
            const { data, error } = await supabase
                .from('matricula')
                .select(`
                    id, situacao, data_inicio, ead,
                    aluno ( id, nome, codigo, ativo ),
                    curso ( id, nome ),
                    registro_presenca ( id, data_presenca, criado_em )
                `)
                .eq('id', matriculaId)
                .single();

            if (error) throw error;

            dadosMatricula.value = data;
            presencas.value = ordenarPresencas(data.registro_presenca || []);
        } catch (err) {
            console.error("Erro ao carregar histórico:", err);
            toast.error("Erro", "Não foi possível carregar o histórico de presenças.");
            router.back();
        } finally {
            carregando.value = false;
        }
    };

    // Registra uma nova presença
    const adicionarPresenca = async () => {
        if (!novaData.value) {
            toast.error("Atenção", "Selecione uma data para registrar a presença.");
            return;
        }

        const jaExiste = presencas.value.some(p => p.data_presenca === novaData.value);
        if (jaExiste) {
            toast.error("Atenção", "Já existe uma presença registrada nesta data.");
            return;
        }

        adicionando.value = true;
        try {
            const { data, error } = await supabase
                .from('registro_presenca')
                .insert({
                    matricula_id: matriculaId,
                    data_presenca: novaData.value
                })
                .select()
                .single();

            if (error) throw error;

            presencas.value = ordenarPresencas([...presencas.value, data]);
            toast.success("Sucesso", "Presença registrada com sucesso!");
        } catch (err) {
            console.error("Erro ao registrar presença:", err);
            toast.error("Erro", "Não foi possível registrar a presença.");
        } finally {
            adicionando.value = false;
        }
    };

    // Inicia edição de uma presença
    const iniciarEdicao = (presenca) => {
        editandoId.value = presenca.id;
        dataEdicao.value = presenca.data_presenca.split('T')[0];
    };

    // Cancela edição ativa
    const cancelarEdicao = () => {
        editandoId.value = null;
        dataEdicao.value = '';
    };

    // Salva a alteração de data da presença
    const salvarEdicao = async (id) => {
        if (!dataEdicao.value) {
            toast.error("Atenção", "A data não pode ficar vazia.");
            return;
        }

        const duplicada = presencas.value.some(
            p => p.id !== id && p.data_presenca === dataEdicao.value
        );
        if (duplicada) {
            toast.error("Atenção", "Já existe outra presença com esta data.");
            return;
        }

        processandoId.value = id;
        try {
            const { error } = await supabase
                .from('registro_presenca')
                .update({ data_presenca: dataEdicao.value })
                .eq('id', id);

            if (error) throw error;

            const index = presencas.value.findIndex(p => p.id === id);
            if (index !== -1) {
                presencas.value[index].data_presenca = dataEdicao.value;
                presencas.value = ordenarPresencas(presencas.value);
            }

            toast.success("Sucesso", "Data da presença atualizada!");
            cancelarEdicao();
        } catch (err) {
            console.error("Erro ao atualizar presença:", err);
            toast.error("Erro", "Não foi possível atualizar a presença.");
        } finally {
            processandoId.value = null;
        }
    };

    // Remove uma presença do banco
    const excluirPresenca = async (id) => {
        processandoId.value = id;
        try {
            const { error } = await supabase
                .from('registro_presenca')
                .delete()
                .eq('id', id);

            if (error) throw error;

            presencas.value = presencas.value.filter(p => p.id !== id);
            toast.success("Sucesso", "Presença removida com sucesso!");
        } catch (err) {
            console.error("Erro ao excluir presença:", err);
            toast.error("Erro", "Não foi possível remover a presença.");
        } finally {
            processandoId.value = null;
        }
    };

    onMounted(() => {
        novaData.value = getDataHojeISO();
        carregarHistorico();
    });
</script>

<template>
    <div class="space-y-6">
        <!-- Cabeçalho -->
        <Card>
            <CardContent class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    <Button variant="outline" size="sm" @click="router.back()" class="px-2.5 shrink-0">
                        <ArrowLeft class="w-4 h-4" />
                    </Button>

                    <template v-if="!carregando && dadosMatricula">
                        <Avatar :name="dadosMatricula.aluno?.nome" class="shrink-0" />
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <h2 class="font-bold text-base sm:text-lg text-slate-900 leading-tight truncate">
                                    {{ formatarNome(dadosMatricula.aluno?.nome) }}
                                </h2>
                                <Badge 
                                    :variant="getBadgeVariantMatricula(dadosMatricula.situacao)"
                                    class="text-[10px] px-2 py-0 shrink-0"
                                >
                                    {{ capitalizar(dadosMatricula.situacao) }}
                                </Badge>
                            </div>
                            <p class="text-xs text-slate-500 truncate">
                                Curso: <span class="font-medium text-slate-700">{{ dadosMatricula.curso?.nome }}</span>
                                • Código: {{ dadosMatricula.aluno?.codigo }}
                            </p>
                        </div>
                    </template>
                    <div v-else class="text-sm text-muted-foreground">Carregando dados...</div>
                </div>

                <div v-if="!carregando" class="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" class="text-xs px-3 py-1">
                        Total: {{ presencas.length }} {{ presencas.length === 1 ? 'presença' : 'presenças' }}
                    </Badge>
                </div>
            </CardContent>
        </Card>

        <div v-if="carregando" class="p-12 text-center text-muted-foreground">
            Carregando histórico de presenças...
        </div>

        <template v-else>
            <!-- Seção 1: Lançar Nova Presença -->
            <Card>
                <CardHeader class="p-4 border-b border-border flex flex-row items-center gap-2">
                    <Calendar class="w-4 h-4 text-slate-500" />
                    <h3 class="font-bold text-base text-slate-900">Registrar Presença</h3>
                </CardHeader>
                <CardContent class="p-4">
                    <div class="flex flex-col sm:flex-row sm:items-end gap-3 max-w-md">
                        <div class="flex-1">
                            <FormGroup label="Data da Presença" id="nova-presenca">
                                <Input v-model="novaData" type="date" />
                            </FormGroup>
                        </div>
                        <Button 
                            variant="default" 
                            class="h-10 shrink-0" 
                            @click="adicionarPresenca" 
                            :disabled="adicionando"
                        >
                            <Plus class="w-4 h-4 mr-1.5" />
                            {{ adicionando ? 'Registrando...' : 'Adicionar' }}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <!-- Seção 2: Listagem do Histórico -->
            <Card class="overflow-hidden">
                <CardHeader class="p-4 border-b border-border flex flex-row items-center justify-between">
                    <div class="flex items-center gap-2">
                        <History class="w-5 h-5 text-slate-500" />
                        <h3 class="font-bold text-base text-slate-900">
                            Histórico de Presenças ({{ presencas.length }})
                        </h3>
                    </div>
                </CardHeader>

                <div v-if="presencas.length === 0" class="p-8 text-center text-muted-foreground">
                    Nenhuma presença registrada para esta matrícula.
                </div>

                <div v-else class="divide-y divide-border">
                    <div 
                        v-for="(item, index) in presencas" 
                        :key="item.id"
                        class="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                    >
                        <!-- Modo Visualização -->
                        <template v-if="editandoId !== item.id">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                                    {{ presencas.length - index }}
                                </div>
                                <div>
                                    <div class="flex items-center gap-2">
                                        <span class="font-semibold text-sm sm:text-base text-slate-900">
                                            {{ formatarDataBR(item.data_presenca) }}
                                        </span>
                                        <Badge v-if="index === 0" variant="success" class="text-[10px] px-2 py-0">
                                            Última
                                        </Badge>
                                    </div>
                                    <p v-if="item.criado_em" class="text-xs text-slate-400">
                                        Lançado em {{ formatarDataBR(item.criado_em.split('T')[0]) }} às {{ formatarHora(item.criado_em) }}
                                    </p>
                                </div>
                            </div>

                            <div class="flex items-center gap-1.5 shrink-0">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    class="h-8 px-2 text-slate-500 hover:text-slate-900"
                                    @click="iniciarEdicao(item)"
                                    :disabled="processandoId === item.id"
                                >
                                    <Pencil class="w-4 h-4" />
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    class="h-8 px-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                    @click="excluirPresenca(item.id)"
                                    :disabled="processandoId === item.id"
                                >
                                    <Trash2 class="w-4 h-4" />
                                </Button>
                            </div>
                        </template>

                        <!-- Modo Edição -->
                        <template v-else>
                            <div class="flex items-center gap-2 flex-1 max-w-xs">
                                <Input v-model="dataEdicao" type="date" class="h-9" />
                            </div>

                            <div class="flex items-center gap-1.5 shrink-0">
                                <Button 
                                    variant="default" 
                                    size="sm" 
                                    class="h-8 px-2.5"
                                    @click="salvarEdicao(item.id)"
                                    :disabled="processandoId === item.id"
                                >
                                    <Check class="w-4 h-4" />
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    class="h-8 px-2.5"
                                    @click="cancelarEdicao"
                                    :disabled="processandoId === item.id"
                                >
                                    <X class="w-4 h-4" />
                                </Button>
                            </div>
                        </template>
                    </div>
                </div>
            </Card>
        </template>
    </div>
</template>