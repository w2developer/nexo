<script setup>
    import { ref } from 'vue';
    import { supabase } from '@/lib/supabase';
    import { getHojeString } from '@/utils/dateHelpers';
    import { toast } from '@/composables/useToast';

    import Modal from '@/components/ui/Modal.vue';
    import Button from '@/components/ui/Button.vue';

    const props = defineProps({
        modelValue: { type: Boolean, required: true },
        matricula: { type: Object, default: null }
    });

    const emit = defineEmits(['update:modelValue', 'concluido']);

    const carregandoConclusao = ref(false);

    const fecharModal = () => {
        emit('update:modelValue', false);
    };

    const confirmarConclusao = async () => {
        if (!props.matricula) return;

        carregandoConclusao.value = true;
        try {
            const { error } = await supabase
                .from('matricula')
                .update({
                    situacao: 'concluido',
                    data_conclusao: getHojeString()
                })
                .eq('id', props.matricula.id);

            if (error) throw error;

            toast.success("Sucesso", "Aluno concluído com sucesso!");
            emit('concluido');
            fecharModal();
        } catch (err) {
            console.error("Erro ao concluir aluno:", err);
            toast.error("Erro", "Não foi possível concluir o aluno.");
        } finally {
            carregandoConclusao.value = false;
        }
    };
</script>

<template>
    <Modal 
        :model-value="modelValue" 
        @update:model-value="emit('update:modelValue', $event)"
        title="Concluir Aluno" 
        size="md"
    >
        <div class="space-y-4">
            <p class="text-sm font-medium text-slate-900">
                Deseja realmente concluir a matrícula de {{ matricula?.aluno?.nome }}?
            </p>
            <p class="text-sm text-muted-foreground">
                A situação do aluno mudará permanentemente para "concluído" e a data de hoje será registrada como a data final de conclusão. Ele deixará de aparecer nesta lista de presenças.
            </p>
        </div>

        <template #footer>
            <Button @click="fecharModal" variant="ghost" :disabled="carregandoConclusao">
                Cancelar
            </Button>
            <Button @click="confirmarConclusao" variant="default" :disabled="carregandoConclusao">
                {{ carregandoConclusao ? 'Concluindo...' : 'Confirmar Conclusão' }}
            </Button>
        </template>
    </Modal>
</template>