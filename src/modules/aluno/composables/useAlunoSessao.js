import { ref, computed } from 'vue';
import { sincronizarRealtimeAuth } from '@/lib/supabase';
import { formatarNome } from '@/utils/formatters';

const alunoId = ref(null);
const nomeAlunoBruto = ref('');

const decodificarPayloadJwt = (token) => {
    if (!token) return null;

    try {
        const partePayload = token.split('.')[1];
        if (!partePayload) return null;

        const base64 = partePayload
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        const padding = '='.repeat((4 - (base64.length % 4)) % 4);
        const binario = atob(base64 + padding);
        const bytes = Uint8Array.from(binario, char => char.charCodeAt(0));
        const jsonString = new TextDecoder('utf-8').decode(bytes);

        return JSON.parse(jsonString);
    } catch (err) {
        console.error('Erro ao decodificar token do aluno:', err);
        return null;
    }
};

export function useAlunoSessao() {
    const carregarSessaoAluno = () => {
        const token = sessionStorage.getItem('token_acesso');

        if (!token) {
            alunoId.value = null;
            nomeAlunoBruto.value = '';
            return null;
        }

        sincronizarRealtimeAuth();

        const payload = decodificarPayloadJwt(token);
        if (!payload?.sub) {
            alunoId.value = null;
            nomeAlunoBruto.value = '';
            return null;
        }

        alunoId.value = payload.sub;
        nomeAlunoBruto.value =
            sessionStorage.getItem('nome_usuario') ||
            payload.nome ||
            'Aluno';

        return {
            id: alunoId.value,
            nome: nomeAlunoBruto.value
        };
    };

    const nomeAluno = computed(() => {
        return formatarNome(nomeAlunoBruto.value) || 'Aluno';
    });

    const primeiroNome = computed(() => {
        const partes = nomeAluno.value.trim().split(/\s+/);
        return partes[0] || 'Aluno';
    });

    return {
        alunoId,
        nomeAluno,
        primeiroNome,
        carregarSessaoAluno
    };
}