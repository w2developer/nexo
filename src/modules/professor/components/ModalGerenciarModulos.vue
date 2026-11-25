<script setup>
    import { ref, computed, watch } from 'vue';
    import { supabase } from '@/lib/supabase';
    import { Plus, Pencil, Trash2, Loader2, Check, X } from '@lucide/vue';
    import { toast } from '@/composables/useToast';
    import {
        ordenarPorOrdemENome,
        posicionarItemPorNumero,
        calcularNormalizacaoOrdem
    } from '../utils/ordenacao';

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
    const ordensPorCurso = ref({});

    const mapaNomesModulos = computed(() => {
        return new Map(props.modulos.map(m => [m.id, m.nome]));
    });

    // Mapeia os cursos vinculados a cada modulo com a respectiva ordem
    const mapaCursosPorModulo = computed(() => {
        const mapaCursos = new Map(props.cursos.map(c => [c.id, c]));
        const resultado = new Map();

        props.cursoModulos.forEach(rel => {
            const curso = mapaCursos.get(rel.curso_id);
            if (!curso) return;

            if (!resultado.has(rel.modulo_id)) {
                resultado.set(rel.modulo_id, []);
            }
            resultado.get(rel.modulo_id).push({
                ...curso,
                ordemNoCurso: rel.ordem || 0
            });
        });

        resultado.forEach(lista => {
            lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        });

        return resultado;
    });

    const modulosOrdenados = computed(() => {
        return [...props.modulos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    });

    const obterRelacoesOrdenadasDoCurso = (cursoId, moduloIdIgnorado = null, mapaNomesExtra = null) => {
        const nomes = mapaNomesExtra || mapaNomesModulos.value;
        const itens = props.cursoModulos
            .filter(rel => rel.curso_id === cursoId && rel.modulo_id !== moduloIdIgnorado)
            .map(rel => ({
                modulo_id: rel.modulo_id,
                ordem: rel.ordem || 0,
                nome: nomes.get(rel.modulo_id) || ''
            }));

        return ordenarPorOrdemENome(itens, 'ordem', 'nome');
    };

    const persistirOrdensCursoModulo = async (cursoId, alteracoes) => {
        if (!alteracoes.length) return;

        const resultados = await Promise.all(
            alteracoes.map(({ id: moduloId, ordem }) =>
                supabase
                    .from('curso_modulo')
                    .update({ ordem })
                    .eq('curso_id', cursoId)
                    .eq('modulo_id', moduloId)
            )
        );

        const erro = resultados.find(res => res.error)?.error;
        if (erro) throw erro;
    };

    const resetarFormulario = () => {
        editandoId.value = null;
        nomeModulo.value = '';
        cursosSelecionados.value = [];
        ordensPorCurso.value = {};
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

            if (!ordensPorCurso.value[cursoId]) {
                const existentes = obterRelacoesOrdenadasDoCurso(cursoId, editandoId.value);
                ordensPorCurso.value = {
                    ...ordensPorCurso.value,
                    [cursoId]: String(existentes.length + 1)
                };
            }
        } else {
            cursosSelecionados.value = cursosSelecionados.value.filter(id => id !== cursoId);
            const copiaOrdens = { ...ordensPorCurso.value };
            delete copiaOrdens[cursoId];
            ordensPorCurso.value = copiaOrdens;
        }
    };

    const atualizarOrdemCurso = (cursoId, valor) => {
        ordensPorCurso.value = {
            ...ordensPorCurso.value,
            [cursoId]: valor
        };
    };

    const iniciarEdicao = (modulo) => {
        confirmandoExclusaoId.value = null;
        editandoId.value = modulo.id;
        nomeModulo.value = modulo.nome || '';

        const vinculados = mapaCursosPorModulo.value.get(modulo.id) || [];
        const novasOrdens = {};

        vinculados.forEach(curso => {
            const listaCurso = obterRelacoesOrdenadasDoCurso(curso.id);
            const indice = listaCurso.findIndex(item => item.modulo_id === modulo.id);
            novasOrdens[curso.id] = String(indice !== -1 ? indice + 1 : (curso.ordemNoCurso || 1));
        });

        cursosSelecionados.value = vinculados.map(c => c.id);
        ordensPorCurso.value = novasOrdens;
    };

    const sincronizarVinculosComOrdem = async (moduloId, nomeAtualizado) => {
        const mapaNomesAtualizado = new Map(mapaNomesModulos.value);
        mapaNomesAtualizado.set(moduloId, nomeAtualizado);

        const cursosAtuais = props.cursoModulos
            .filter(rel => rel.modulo_id === moduloId)
            .map(rel => rel.curso_id);

        const paraRemover = cursosAtuais.filter(id => !cursosSelecionados.value.includes(id));

        // 1. Remove vinculos desmarcados e renormaliza a ordem dos cursos afetados
        for (const cursoId of paraRemover) {
            const { error: erroDel } = await supabase
                .from('curso_modulo')
                .delete()
                .eq('curso_id', cursoId)
                .eq('modulo_id', moduloId);

            if (erroDel) throw erroDel;

            const restantes = obterRelacoesOrdenadasDoCurso(cursoId, moduloId, mapaNomesAtualizado);
            const { alteracoes } = calcularNormalizacaoOrdem(restantes, 'modulo_id', 'ordem');
            await persistirOrdensCursoModulo(cursoId, alteracoes);
        }

        // 2. Insere novos vinculos e normaliza a ordem em todos os cursos selecionados
        for (const cursoId of cursosSelecionados.value) {
            const jaExistia = cursosAtuais.includes(cursoId);
            const outros = obterRelacoesOrdenadasDoCurso(cursoId, moduloId, mapaNomesAtualizado);
            const totalMaximo = outros.length + 1;
            const digitada = Number.parseInt(ordensPorCurso.value[cursoId], 10);
            const ordemDesejada = Number.isNaN(digitada)
                ? totalMaximo
                : Math.min(Math.max(1, digitada), totalMaximo);

            const relacaoAtual = props.cursoModulos.find(
                rel => rel.curso_id === cursoId && rel.modulo_id === moduloId
            );

            const itemAtual = {
                modulo_id: moduloId,
                ordem: relacaoAtual?.ordem || 0,
                nome: nomeAtualizado
            };

            const baseComAtual = [...outros, itemAtual];
            const reposicionada = posicionarItemPorNumero(
                baseComAtual,
                moduloId,
                ordemDesejada,
                'modulo_id'
            );
            const { listaNormalizada, alteracoes } = calcularNormalizacaoOrdem(
                reposicionada,
                'modulo_id',
                'ordem'
            );

            if (!jaExistia) {
                const itemNormalizado = listaNormalizada.find(item => item.modulo_id === moduloId);
                const { error: erroIns } = await supabase
                    .from('curso_modulo')
                    .insert([{
                        curso_id: cursoId,
                        modulo_id: moduloId,
                        ordem: itemNormalizado ? itemNormalizado.ordem : ordemDesejada
                    }]);

                if (erroIns) throw erroIns;

                const alteracoesOutros = alteracoes.filter(alt => alt.id !== moduloId);
                await persistirOrdensCursoModulo(cursoId, alteracoesOutros);
            } else {
                await persistirOrdensCursoModulo(cursoId, alteracoes);
            }
        }
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

                await sincronizarVinculosComOrdem(moduloId, nomeLimpo);
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
                await sincronizarVinculosComOrdem(moduloId, nomeLimpo);
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
            const cursosAfetados = props.cursoModulos
                .filter(rel => rel.modulo_id === modulo.id)
                .map(rel => rel.curso_id);

            const { error } = await supabase
                .from('modulo')
                .delete()
                .eq('id', modulo.id);

            if (error) throw error;

            // Renormaliza a ordem dos modulos restantes nos cursos afetados
            for (const cursoId of cursosAfetados) {
                const restantes = obterRelacoesOrdenadasDoCurso(cursoId, modulo.id);
                const { alteracoes } = calcularNormalizacaoOrdem(restantes, 'modulo_id', 'ordem');
                await persistirOrdensCursoModulo(cursoId, alteracoes);
            }

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
        description="Cadastre módulos, defina em quais cursos aparecem e ajuste a ordem em cada curso."
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
                    <div class="flex items-center justify-between gap-2">
                        <label class="block text-sm font-medium text-foreground">
                            Cursos vinculados ({{ cursosSelecionados.length }})
                        </label>
                        <span class="text-[11px] text-muted-foreground">
                            Ative o curso para definir a ordem
                        </span>
                    </div>

                    <div
                        v-if="cursos.length === 0"
                        class="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground text-center"
                    >
                        Nenhum curso cadastrado no sistema.
                    </div>

                    <div
                        v-else
                        class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1"
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

                            <div class="flex items-center gap-2 shrink-0">
                                <div
                                    v-if="isCursoSelecionado(curso.id)"
                                    class="flex items-center gap-1"
                                    title="Ordem deste módulo no curso"
                                >
                                    <span class="text-[10px] font-medium text-muted-foreground">#</span>
                                    <input
                                        type="number"
                                        min="1"
                                        :value="ordensPorCurso[curso.id] ?? ''"
                                        :disabled="salvando"
                                        class="w-12 h-7 rounded border border-border bg-background px-1.5 text-center text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring tabular-nums"
                                        @input="atualizarOrdemCurso(curso.id, $event.target.value)"
                                    />
                                </div>

                                <Switch
                                    :id="`curso-mod-${curso.id}`"
                                    :model-value="isCursoSelecionado(curso.id)"
                                    :disabled="salvando"
                                    @update:model-value="toggleCurso(curso.id, $event)"
                                />
                            </div>
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
                                            {{ curso.nome }}<template v-if="curso.ordemNoCurso > 0"> • #{{ curso.ordemNoCurso }}</template>
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