<script setup>
    import { ref, computed, watch } from 'vue';
    import { supabase } from '@/lib/supabase';
    import { Plus, Pencil, Trash2, Loader2, Check, X } from '@lucide/vue';
    import { toast } from '@/composables/useToast';

    import Modal from '@/components/ui/Modal.vue';
    import Button from '@/components/ui/Button.vue';
    import Input from '@/components/ui/Input.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Switch from '@/components/ui/Switch.vue';
    import Badge from '@/components/ui/Badge.vue';

    const isOpen = defineModel({ type: Boolean, default: false });

    const props = defineProps({
        cursos: {
            type: Array,
            default: () => []
        },
        modulos: {
            type: Array,
            default: () => []
        },
        cursoModulos: {
            type: Array,
            default: () => []
        }
    });

    const emit = defineEmits(['atualizado']);

    const salvando = ref(false);
    const excluindoId = ref(null);
    const confirmandoExclusaoId = ref(null);

    const editandoId = ref(null);
    const nomeModulo = ref('');
    const cursosSelecionados = ref([]);

    // Mapeia os cursos vinculados a cada modulo
    const mapaCursosPorModulo = computed(() => {
        const mapaCursos = new Map(props.cursos.map(c => [c.id, c]));
        const resultado = new Map();

        props.cursoModulos.forEach(rel => {
            const curso = mapaCursos.get(rel.curso_id);
            if (!curso) return;

            if (!resultado.has(rel.modulo_id)) {
                resultado.set(rel.modulo_id, []);
            }
            resultado.get(rel.modulo_id).push(curso);
        });

        resultado.forEach(lista => {
            lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        });

        return resultado;
    });

    const modulosOrdenados = computed(() => {
        return [...props.modulos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    });

    const resetarFormulario = () => {
        editandoId.value = null;
        nomeModulo.value = '';
        cursosSelecionados.value = [];
        confirmandoExclusaoId.value = null;
    };

    watch(isOpen, (aberto) => {
        if (!aberto) {
            resetarFormulario();
        }
    });

    const isCursoSelecionado = (cursoId) => {
        return cursosSelecionados.value.includes(cursoId);
    };

    const toggleCurso = (cursoId, ativo) => {
        if (ativo) {
            if (!cursosSelecionados.value.includes(cursoId)) {
                cursosSelecionados.value = [...cursosSelecionados.value, cursoId];
            }
        } else {
            cursosSelecionados.value = cursosSelecionados.value.filter(id => id !== cursoId);
        }
    };

    const iniciarEdicao = (modulo) => {
        confirmandoExclusaoId.value = null;
        editandoId.value = modulo.id;
        nomeModulo.value = modulo.nome || '';
        const vinculados = mapaCursosPorModulo.value.get(modulo.id) || [];
        cursosSelecionados.value = vinculados.map(c => c.id);
    };

    const salvarModulo = async () => {
        if (salvando.value) return;

        const nomeLimpo = nomeModulo.value.trim();
        if (!nomeLimpo) {
            toast.error('Atenção', 'Informe o nome do módulo.');
            return;
        }

        salvando.value = true;
        try {
            let moduloId = editandoId.value;

            if (moduloId) {
                const { error } = await supabase
                    .from('modulo')
                    .update({ nome: nomeLimpo })
                    .eq('id', moduloId);

                if (error) {
                    if (error.code === '23505') {
                        toast.error('Nome em uso', 'Já existe um módulo cadastrado com este nome.');
                        return;
                    }
                    throw error;
                }

                // Sincroniza apenas as diferencas na tabela curso_modulo
                const atuais = props.cursoModulos
                    .filter(rel => rel.modulo_id === moduloId)
                    .map(rel => rel.curso_id);

                const paraRemover = atuais.filter(id => !cursosSelecionados.value.includes(id));
                const paraAdicionar = cursosSelecionados.value.filter(id => !atuais.includes(id));

                if (paraRemover.length > 0) {
                    const { error: erroDel } = await supabase
                        .from('curso_modulo')
                        .delete()
                        .eq('modulo_id', moduloId)
                        .in('curso_id', paraRemover);

                    if (erroDel) throw erroDel;
                }

                if (paraAdicionar.length > 0) {
                    const { error: erroIns } = await supabase
                        .from('curso_modulo')
                        .insert(
                            paraAdicionar.map(cursoId => ({
                                curso_id: cursoId,
                                modulo_id: moduloId
                            }))
                        );

                    if (erroIns) throw erroIns;
                }

                toast.success('Sucesso', 'Módulo atualizado com sucesso!');
            } else {
                const { data: novoModulo, error } = await supabase
                    .from('modulo')
                    .insert([{ nome: nomeLimpo }])
                    .select('id, nome')
                    .single();

                if (error) {
                    if (error.code === '23505') {
                        toast.error('Nome em uso', 'Já existe um módulo cadastrado com este nome.');
                        return;
                    }
                    throw error;
                }

                moduloId = novoModulo.id;

                if (cursosSelecionados.value.length > 0) {
                    const { error: erroRel } = await supabase
                        .from('curso_modulo')
                        .insert(
                            cursosSelecionados.value.map(cursoId => ({
                                curso_id: cursoId,
                                modulo_id: moduloId
                            }))
                        );

                    if (erroRel) throw erroRel;
                }

                toast.success('Sucesso', 'Módulo cadastrado com sucesso!');
            }

            resetarFormulario();
            emit('atualizado');
        } catch (err) {
            console.error('Erro ao salvar módulo:', err);
            toast.error('Erro', 'Não foi possível salvar o módulo.');
        } finally {
            salvando.value = false;
        }
    };

    const confirmarExclusao = async (modulo) => {
        if (excluindoId.value) return;

        excluindoId.value = modulo.id;
        try {
            const { error } = await supabase
                .from('modulo')
                .delete()
                .eq('id', modulo.id);

            if (error) throw error;

            if (editandoId.value === modulo.id) {
                resetarFormulario();
            }

            confirmandoExclusaoId.value = null;
            toast.success('Excluído', `O módulo "${modulo.nome}" foi removido.`);
            emit('atualizado');
        } catch (err) {
            console.error('Erro ao excluir módulo:', err);
            toast.error('Erro', 'Não foi possível excluir o módulo.');
        } finally {
            excluindoId.value = null;
        }
    };
</script>

<template>
    <Modal
        v-model="isOpen"
        title="Gerenciar Módulos"
        description="Cadastre módulos e defina em quais cursos eles aparecem."
        size="lg"
    >
        <div class="space-y-6 p-1">
            <!-- Formulario de Cadastro / Edicao -->
            <div class="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
                <div class="flex items-center justify-between gap-2">
                    <h3 class="text-sm font-semibold text-foreground">
                        {{ editandoId ? 'Editar Módulo' : 'Novo Módulo' }}
                    </h3>
                    <Button
                        v-if="editandoId"
                        variant="ghost"
                        size="sm"
                        class="h-7 px-2 text-xs"
                        :disabled="salvando"
                        @click="resetarFormulario"
                    >
                        Cancelar edição
                    </Button>
                </div>

                <FormGroup label="Nome do Módulo *" id="mod-nome">
                    <Input
                        v-model="nomeModulo"
                        placeholder="Ex: Excel, Power BI, Segurança Digital..."
                        :disabled="salvando"
                        @keyup.enter="salvarModulo"
                    />
                </FormGroup>

                <div class="space-y-2">
                    <label class="block text-sm font-medium text-foreground">
                        Cursos vinculados ({{ cursosSelecionados.length }})
                    </label>

                    <div
                        v-if="cursos.length === 0"
                        class="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground text-center"
                    >
                        Nenhum curso cadastrado no sistema.
                    </div>

                    <div
                        v-else
                        class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1"
                    >
                        <div
                            v-for="curso in cursos"
                            :key="curso.id"
                            class="flex items-center justify-between gap-2 px-3 py-2 rounded-md border transition-colors"
                            :class="
                                isCursoSelecionado(curso.id)
                                    ? 'bg-indigo-50/60 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/30 text-indigo-950 dark:text-indigo-100'
                                    : 'bg-background border-border text-muted-foreground'
                            "
                        >
                            <label
                                :for="`curso-mod-${curso.id}`"
                                class="text-xs font-medium cursor-pointer select-none truncate flex-1"
                            >
                                {{ curso.nome }}
                            </label>
                            <Switch
                                :id="`curso-mod-${curso.id}`"
                                :model-value="isCursoSelecionado(curso.id)"
                                :disabled="salvando"
                                @update:model-value="toggleCurso(curso.id, $event)"
                            />
                        </div>
                    </div>
                </div>

                <div class="flex justify-end pt-1">
                    <Button
                        size="sm"
                        variant="default"
                        :disabled="salvando"
                        @click="salvarModulo"
                    >
                        <Loader2 v-if="salvando" class="w-4 h-4 mr-1.5 animate-spin" />
                        <Check v-else-if="editandoId" class="w-4 h-4 mr-1.5" />
                        <Plus v-else class="w-4 h-4 mr-1.5" />
                        {{ salvando ? 'Salvando...' : (editandoId ? 'Salvar Alterações' : 'Adicionar Módulo') }}
                    </Button>
                </div>
            </div>

            <!-- Lista de Modulos Cadastrados -->
            <div class="space-y-2">
                <h3 class="text-sm font-semibold text-foreground">
                    Módulos cadastrados ({{ modulosOrdenados.length }})
                </h3>

                <div
                    v-if="modulosOrdenados.length === 0"
                    class="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
                >
                    Nenhum módulo cadastrado ainda.
                </div>

                <div v-else class="rounded-lg border border-border divide-y divide-border overflow-hidden">
                    <div
                        v-for="modulo in modulosOrdenados"
                        :key="modulo.id"
                        class="p-3 bg-background hover:bg-muted/40 transition-colors space-y-2"
                        :class="{ 'bg-muted/40': editandoId === modulo.id }"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0 flex-1 space-y-1.5">
                                <p class="font-semibold text-sm text-foreground truncate">
                                    {{ modulo.nome }}
                                </p>

                                <div class="flex flex-wrap items-center gap-1.5">
                                    <template v-if="(mapaCursosPorModulo.get(modulo.id) || []).length > 0">
                                        <Badge
                                            v-for="curso in mapaCursosPorModulo.get(modulo.id)"
                                            :key="curso.id"
                                            variant="secondary"
                                            class="text-[10px] px-2 py-0"
                                        >
                                            {{ curso.nome }}
                                        </Badge>
                                    </template>
                                    <span v-else class="text-xs text-muted-foreground">
                                        Sem cursos vinculados
                                    </span>
                                </div>
                            </div>

                            <div class="flex items-center gap-1 shrink-0">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    class="h-8 px-2 text-muted-foreground hover:text-foreground"
                                    :disabled="salvando || excluindoId === modulo.id"
                                    title="Editar módulo"
                                    @click="iniciarEdicao(modulo)"
                                >
                                    <Pencil class="w-4 h-4" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    class="h-8 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                    :disabled="salvando || excluindoId === modulo.id"
                                    title="Excluir módulo"
                                    @click="confirmandoExclusaoId = confirmandoExclusaoId === modulo.id ? null : modulo.id"
                                >
                                    <Trash2 class="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        <!-- Confirmacao inline para evitar sobreposicao de modais -->
                        <div
                            v-if="confirmandoExclusaoId === modulo.id"
                            class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2"
                        >
                            <p class="text-xs text-rose-700 dark:text-rose-400">
                                Excluir este módulo? As atividades dele não serão apagadas (ficarão sem módulo).
                            </p>
                            <div class="flex items-center justify-end gap-1.5 shrink-0">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    class="h-7 px-2 text-xs"
                                    :disabled="excluindoId === modulo.id"
                                    @click="confirmandoExclusaoId = null"
                                >
                                    <X class="w-3.5 h-3.5 mr-1" />
                                    Cancelar
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    class="h-7 px-2.5 text-xs"
                                    :disabled="excluindoId === modulo.id"
                                    @click="confirmarExclusao(modulo)"
                                >
                                    <Loader2 v-if="excluindoId === modulo.id" class="w-3.5 h-3.5 mr-1 animate-spin" />
                                    Confirmar
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <Button variant="outline" @click="isOpen = false">
                Fechar
            </Button>
        </template>
    </Modal>
</template>