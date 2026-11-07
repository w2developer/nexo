import { ref } from 'vue';
import { toast } from '@/composables/useToast';

const modalPermissaoAberto = ref(false);
const permissaoAtual = ref(
    typeof window !== 'undefined' && 'Notification' in window
        ? Notification.permission
        : 'denied'
);

export function useBrowserNotification() {
    // Verifica se deve exibir o modal pedindo permissão
    const verificarPermissaoInicial = () => {
        if (!('Notification' in window)) return;

        permissaoAtual.value = Notification.permission;
        const jaRecusouLocal = localStorage.getItem('w2_notificacao_recusada');

        if (Notification.permission === 'default' && !jaRecusouLocal) {
            modalPermissaoAberto.value = true;
        }
    };

    // Solicita permissão nativa ao clicar no botão do Modal
    const solicitarPermissao = async () => {
        if (!('Notification' in window)) {
            modalPermissaoAberto.value = false;
            return;
        }

        try {
            const resultado = await Notification.requestPermission();
            permissaoAtual.value = resultado;

            if (resultado === 'granted') {
                toast.success('Notificações ativadas', 'Você será avisado quando receber novas mensagens.');
            } else if (resultado === 'denied') {
                toast.error('Permissão negada', 'Ative nas configurações do navegador se mudar de ideia.');
            }
        } catch (err) {
            console.error('Erro ao solicitar permissão:', err);
        } finally {
            modalPermissaoAberto.value = false;
        }
    };

    // Fecha o modal e salva preferência para não incomodar novamente na sessão
    const recusarPermissao = () => {
        localStorage.setItem('w2_notificacao_recusada', 'true');
        modalPermissaoAberto.value = false;
    };

    // Dispara a notificação nativa do sistema operacional
    const dispararNotificacao = (titulo, corpo, aoClicar = null) => {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        // Notifica se a aba estiver em segundo plano ou sem foco
        const abaOculta = document.hidden || !document.hasFocus();
        if (!abaOculta) return;

        const notificacao = new Notification(titulo, {
            body: corpo,
            icon: '/favicon.ico',
            tag: 'w2-chat-msg',
            requireInteraction: true
        });

        notificacao.onclick = () => {
            window.focus();
            if (aoClicar) aoClicar();
            notificacao.close();
        };
    };

    return {
        modalPermissaoAberto,
        permissaoAtual,
        verificarPermissaoInicial,
        solicitarPermissao,
        recusarPermissao,
        dispararNotificacao
    };
}