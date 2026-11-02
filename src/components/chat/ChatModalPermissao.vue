<script setup>
    import { Bell } from '@lucide/vue';
    import Modal from '@/components/ui/Modal.vue';
    import Button from '@/components/ui/Button.vue';
    import { useBrowserNotification } from '@/composables/useBrowserNotification';

    const {
        modalPermissaoAberto,
        solicitarPermissao,
        recusarPermissao
    } = useBrowserNotification();
</script>

<template>
    <Modal
        v-model="modalPermissaoAberto"
        title="Ativar notificações do Chat"
        description="Receba alertas de novas mensagens mesmo quando estiver em outra aba ou programa."
        size="sm"
    >
        <div class="flex items-center gap-3 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-700 dark:text-violet-300 text-sm">
            <Bell class="w-5 h-5 shrink-0 text-violet-600 dark:text-violet-400" />
            <span>Não perca avisos importantes da secretaria, professores ou suporte.</span>
        </div>

        <template #footer>
            <Button variant="ghost" @click="recusarPermissao">
                Agora não
            </Button>
            <Button variant="default" @click="solicitarPermissao">
                Permitir notificações
            </Button>
        </template>
    </Modal>
</template>