<script setup>
    import { ref, watch } from 'vue';
    import { supabase } from '@/lib/supabase';
    import { Plus, Edit2, Trash2, Save, X, Loader2, BookOpen, AlertTriangle } from '@lucide/vue';
    import { toast } from '@/composables/useToast';

    import Modal from '@/components/ui/Modal.vue';
    import Button from '@/components/ui/Button.vue';
    import Input from '@/components/ui/Input.vue';

    // Recebe o v-model para abrir/fechar o modal principal
    const aberto = defineModel({ type: Boolean, default: false });

    // Declara o evento que avisa o componente pai sobre mudanças
    const emit = defineEmits(['atualizado']);

    // Estados gerais
    const cursos = ref([]);
    const carregando = ref(false);
    const salvandoNovo = ref(false);
    const novoCursoNome = ref('');

    // Estados de edição (para o modo "inline")
    const editandoId = ref(null);
    const nomeEditado = ref('');
    const salvandoEdicao = ref(false);

    // Estados para o Modal de Exclusão
    const modalExcluirAberto = ref(false);
    const cursoParaExcluir = ref(null);
    const excluindo = ref(false);

    // Carrega a lista de cursos do banco
    const carregarCursos = async () => {
        carregando.value = true;
        try {
            const { data, error } = await supabase
                .from('curso')
                .select('id, nome')
                .order('nome');

            if (error) throw error;
            cursos.value = data || [];
        } catch (err) {
            console.error("Erro ao carregar cursos:", err);
            toast.error('Erro', 'Não foi possível carregar a lista de cursos.');
        } finally {
            carregando.value = false;
        }
    };

    // Sempre que o modal abrir, recarrega a lista e limpa os campos
    watch(aberto, (estaAberto) => {
        if (estaAberto) {
            carregarCursos();
            novoCursoNome.value = '';
            cancelarEdicao();
        }
    });

    // ==========================================
    // C.R.U.D DE CURSOS
    // ==========================================

    const adicionarCurso = async () => {
        if (!novoCursoNome.value.trim()) {
            toast.error('Atenção', 'Digite o nome do curso.');
            return;
        }

        salvandoNovo.value = true;
        try {
            const { error } = await supabase
                .from('curso')
                .insert([{ nome: novoCursoNome.value.trim() }]);

            if (error) throw error;

            toast.success('Sucesso', 'Curso adicionado!');
            novoCursoNome.value = '';
            await carregarCursos();
            
            // Avisa a tela pai que a lista mudou
            emit('atualizado'); 
        } catch (err) {
            console.error("Erro ao adicionar curso:", err);
            toast.error('Erro', 'Não foi possível cadastrar o curso.');
        } finally {
            salvandoNovo.value = false;
        }
    };

    const iniciarEdicao = (curso) => {
        editandoId.value = curso.id;
        nomeEditado.value = curso.nome;
    };

    const cancelarEdicao = () => {
        editandoId.value = null;
        nomeEditado.value = '';
    };

    const confirmarEdicao = async (id) => {
        if (!nomeEditado.value.trim()) {
            toast.error('Atenção', 'O nome do curso não pode ficar vazio.');
            return;
        }

        salvandoEdicao.value = true;
        try {
            const { error } = await supabase
                .from('curso')
                .update({ nome: nomeEditado.value.trim() })
                .eq('id', id);

            if (error) throw error;

            toast.success('Sucesso', 'Nome do curso atualizado!');
            cancelarEdicao();
            await carregarCursos();
            
            // Avisa a tela pai que a lista mudou
            emit('atualizado');
        } catch (err) {
            console.error("Erro ao editar curso:", err);
            toast.error('Erro', 'Não foi possível atualizar o curso.');
        } finally {
            salvandoEdicao.value = false;
        }
    };

    // Abre o modal de confirmação de exclusão
    const abrirConfirmacaoExclusao = (curso) => {
        cursoParaExcluir.value = curso;
        modalExcluirAberto.value = true;
    };

    // Efetiva a exclusão no banco de dados
    const efetivarExclusao = async () => {
        if (!cursoParaExcluir.value) return;

        excluindo.value = true;
        try {
            const { error } = await supabase
                .from('curso')
                .delete()
                .eq('id', cursoParaExcluir.value.id);

            if (error) throw error;

            toast.success('Excluído', 'Curso removido com sucesso!');
            modalExcluirAberto.value = false;
            cursoParaExcluir.value = null;
            await carregarCursos();
            
            // Avisa a tela pai que a lista mudou
            emit('atualizado');
        } catch (err) {
            console.error("Erro ao excluir curso:", err);
            toast.error('Falha na Exclusão', 'Não é possível excluir este curso pois ele já possui alunos vinculados a ele.');
            modalExcluirAberto.value = false;
        } finally {
            excluindo.value = false;
        }
    };
</script>

<template>
    <!-- Modal Principal: Gerenciar Cursos -->
    <Modal 
        v-model="aberto" 
        title="Gerenciar Cursos" 
        size="md"
    >
        <div class="space-y-4">
            
            <!-- Cadastro de Novo Curso -->
            <div class="bg-muted/40 border border-border rounded-lg p-3 sm:p-4 space-y-2.5">
                <label class="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    Cadastrar Novo Curso
                </label>
                <div class="flex gap-2">
                    <Input 
                        v-model="novoCursoNome" 
                        placeholder="Ex: Informática Essencial" 
                        class="flex-1"
                        @keyup.enter="adicionarCurso"
                        :disabled="salvandoNovo"
                    />
                    <Button 
                        @click="adicionarCurso" 
                        :disabled="!novoCursoNome.trim() || salvandoNovo"
                    >
                        <Loader2 v-if="salvandoNovo" class="w-4 h-4 mr-2 animate-spin" />
                        <Plus v-else class="w-4 h-4 sm:mr-1.5" />
                        <span class="hidden sm:inline">Adicionar</span>
                    </Button>
                </div>
            </div>

            <!-- Lista de Cursos -->
            <div class="space-y-2">
                <h3 class="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">
                    Cursos Cadastrados ({{ cursos.length }})
                </h3>

                <div v-if="carregando" class="py-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                    <Loader2 class="w-6 h-6 animate-spin text-primary" />
                    Carregando cursos...
                </div>

                <div v-else-if="cursos.length === 0" class="py-8 text-center text-muted-foreground bg-muted/20 border border-dashed border-border rounded-lg">
                    Nenhum curso cadastrado ainda.
                </div>

                <!-- Painel Rolável da Tabela de Cursos -->
                <div v-else class="max-h-[50vh] overflow-y-auto border border-border rounded-lg bg-background divide-y divide-border">
                    <div 
                        v-for="curso in cursos" 
                        :key="curso.id" 
                        class="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                    >
                        <!-- Modo de Edição -->
                        <div v-if="editandoId === curso.id" class="flex items-center gap-2 w-full">
                            <Input 
                                v-model="nomeEditado" 
                                class="flex-1 h-8 text-sm"
                                @keyup.enter="confirmarEdicao(curso.id)"
                                @keyup.esc="cancelarEdicao"
                                :disabled="salvandoEdicao"
                                autofocus
                            />
                            <div class="flex items-center gap-1 shrink-0">
                                <Button size="sm" variant="ghost" class="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10" @click="cancelarEdicao" :disabled="salvandoEdicao" title="Cancelar">
                                    <X class="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="default" class="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700" @click="confirmarEdicao(curso.id)" :disabled="salvandoEdicao" title="Salvar">
                                    <Loader2 v-if="salvandoEdicao" class="w-4 h-4 animate-spin" />
                                    <Save v-else class="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        <!-- Modo de Visualização -->
                        <template v-else>
                            <span class="font-medium text-sm text-foreground truncate pr-2">
                                {{ curso.nome }}
                            </span>
                            
                            <div class="flex items-center gap-1 shrink-0">
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    class="h-7 w-7 p-0 bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
                                    @click="iniciarEdicao(curso)"
                                    title="Editar Nome"
                                >
                                    <Edit2 class="w-3.5 h-3.5" />
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    class="h-7 w-7 p-0 bg-background hover:bg-red-500/10 border-border text-muted-foreground hover:text-red-500 transition-colors"
                                    @click="abrirConfirmacaoExclusao(curso)"
                                    title="Excluir Curso"
                                >
                                    <Trash2 class="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <Button variant="outline" @click="aberto = false" class="w-full sm:w-auto">
                Fechar
            </Button>
        </template>
    </Modal>

    <!-- Modal Secundário: Confirmação de Exclusão -->
    <Modal 
        v-model="modalExcluirAberto" 
        title="Confirmar Exclusão" 
        size="sm"
    >
        <div class="space-y-4" v-if="cursoParaExcluir">
            <div class="flex items-start gap-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400">
                <AlertTriangle class="w-5 h-5 shrink-0 mt-0.5" />
                <div class="text-sm">
                    <p>Tem certeza que deseja excluir o curso <strong>{{ cursoParaExcluir.nome }}</strong>?</p>
                </div>
            </div>
            <p class="text-xs text-muted-foreground">
                Atenção: A exclusão será bloqueada pelo banco de dados caso já existam alunos matriculados neste curso.
            </p>
        </div>
        
        <template #footer>
            <Button variant="ghost" @click="modalExcluirAberto = false" :disabled="excluindo">
                Cancelar
            </Button>
            <Button variant="destructive" @click="efetivarExclusao" :disabled="excluindo">
                <Loader2 v-if="excluindo" class="w-4 h-4 mr-2 animate-spin" />
                <Trash2 v-else class="w-4 h-4 mr-2" />
                Sim, Excluir
            </Button>
        </template>
    </Modal>
</template>