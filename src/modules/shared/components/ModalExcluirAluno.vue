<script setup>
    import { ref, computed, watch } from 'vue';
    import { Trash2, Loader2, ShieldAlert } from '@lucide/vue';
    import { supabase } from '@/lib/supabase';
    import { toast } from '@/composables/useToast';
    import Modal from '@/components/ui/Modal.vue';
    import FormGroup from '@/components/ui/FormGroup.vue';
    import Textarea from '@/components/ui/Textarea.vue';
    import Input from '@/components/ui/Input.vue';
    import Button from '@/components/ui/Button.vue';
    import Badge from '@/components/ui/Badge.vue';

    const aberto = defineModel({ type: Boolean, default: false });

    const props = defineProps({
        aluno: {
            type: Object,
            default: null
            // Esperado: { id: 'uuid', nome: 'Nome do Aluno', codigo: '1234' }
        },
        usuarioLogadoNome: {
            type: String,
            default: ''
        }
    });

    const emit = defineEmits(['excluido']);

    const motivo = ref('');
    const confirmacaoCodigo = ref('');
    const excluindo = ref(false);
    const tentouEnviar = ref(false);

    // Reseta os campos sempre que o modal abre ou fecha
    watch(aberto, (valor) => {
        if (!valor) {
            motivo.value = '';
            confirmacaoCodigo.value = '';
            tentouEnviar.value = false;
            excluindo.value = false;
        }
    });

    // Recupera o nome do responsável pela ação (prop ou sessionStorage)
    const nomeExecutor = computed(() => {
        if (props.usuarioLogadoNome?.trim()) return props.usuarioLogadoNome.trim();
        return sessionStorage.getItem('nome_usuario') || 'Usuário do Sistema';
    });

    // Validações de segurança
    const motivoValido = computed(() => motivo.value.trim().length >= 10);
    const codigoConfirmado = computed(() => {
        if (!props.aluno?.codigo) return false;
        return confirmacaoCodigo.value.trim() === String(props.aluno.codigo).trim();
    });
    const formularioValido = computed(() => motivoValido.value && codigoConfirmado.value);

    // Executa a exclusão auditada via RPC
    const confirmarExclusao = async () => {
        tentouEnviar.value = true;
        if (!formularioValido.value || !props.aluno?.id || excluindo.value) return;

        excluindo.value = true;

        try {
            const { error } = await supabase.rpc('excluir_aluno_com_auditoria', {
                p_aluno_id: props.aluno.id,
                p_usuario_nome: nomeExecutor.value,
                p_motivo: motivo.value.trim()
            });

            if (error) throw error;

            toast.success(
                'Aluno excluído',
                `O cadastro de ${props.aluno.nome} foi removido e registrado na auditoria.`
            );

            emit('excluido', props.aluno.id);
            aberto.value = false;
        } catch (err) {
            console.error('Erro ao excluir aluno:', err);
            toast.error(
                'Falha na exclusão',
                err.message || 'Não foi possível excluir o aluno. Tente novamente.'
            );
        } finally {
            excluindo.value = false;
        }
    };
</script>

<template>
    <Modal
        v-model="aberto"
        title="Exclusão Permanente de Aluno"
        description="Atenção: esta operação é irreversível e removerá matrículas, presenças e históricos vinculados."
        size="md"
    >
        <div v-if="aluno" class="space-y-5">
            <!-- Alerta de Auditoria e Resumo dos Dados -->
            <div class="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 space-y-2.5">
                <div class="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold text-xs uppercase tracking-wider">
                    <ShieldAlert class="w-4 h-4 shrink-0" />
                    <span>Registro de Auditoria Obrigatório</span>
                </div>

                <div class="grid grid-cols-1 gap-1.5 text-xs text-foreground bg-background/80 p-2.5 rounded-lg border border-red-500/15">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-muted-foreground">Aluno a ser excluído:</span>
                        <div class="flex items-center gap-1.5 font-bold text-foreground">
                            <span>{{ aluno.nome }}</span>
                            <Badge variant="destructive">#{{ aluno.codigo }}</Badge>
                        </div>
                    </div>

                    <div class="flex items-center justify-between gap-2">
                        <span class="text-muted-foreground">Responsável pela ação:</span>
                        <span class="font-semibold text-foreground">{{ nomeExecutor }}</span>
                    </div>
                </div>
            </div>

            <!-- Campo Obrigatório: Motivo da Exclusão -->
            <FormGroup
                id="motivo-exclusao"
                label="Motivo da Exclusão *"
                description="Descreva claramente o motivo desta exclusão (mínimo de 10 caracteres)."
            >
                <Textarea
                    id="motivo-exclusao"
                    v-model="motivo"
                    rows="3"
                    placeholder="Ex: Cadastro duplicado por engano na matrícula ou solicitação formal da coordenação..."
                    :error="tentouEnviar && !motivoValido"
                    :disabled="excluindo"
                />
                <p v-if="tentouEnviar && !motivoValido" class="text-xs text-red-500 dark:text-red-400 mt-1">
                    Informe uma justificativa detalhada (mínimo de 10 caracteres).
                </p>
            </FormGroup>

            <!-- Trava de Segurança contra exclusão por engano -->
            <FormGroup
                id="confirmar-codigo"
                :label="`Digite o código do aluno (${aluno.codigo}) para confirmar *`"
                description="Trava de segurança para evitar exclusões acidentais."
            >
                <Input
                    id="confirmar-codigo"
                    v-model="confirmacaoCodigo"
                    :placeholder="`Digite ${aluno.codigo}`"
                    :error="tentouEnviar && !codigoConfirmado"
                    :disabled="excluindo"
                />
            </FormGroup>
        </div>

        <template #footer>
            <Button
                variant="ghost"
                :disabled="excluindo"
                @click="aberto = false"
            >
                Cancelar
            </Button>

            <Button
                variant="destructive"
                :disabled="!formularioValido || excluindo"
                @click="confirmarExclusao"
            >
                <Loader2 v-if="excluindo" class="w-4 h-4 mr-2 animate-spin" />
                <Trash2 v-else class="w-4 h-4 mr-2" />
                Confirmar Exclusão
            </Button>
        </template>
    </Modal>
</template>