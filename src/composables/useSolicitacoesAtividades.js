import { ref } from 'vue';
import { supabase, sincronizarRealtimeAuth } from '@/lib/supabase';

const totalSolicitacoesPendentes = ref(0);
let realtimeChannel = null;
let realtimeTimer = null;
let consumidoresAtivos = 0;

export function useSolicitacoesAtividades() {
    const carregarTotalSolicitacoes = async () => {
        try {
            const { count, error } = await supabase
                .from('aluno_atividade')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'solicitada');

            if (error) throw error;
            totalSolicitacoesPendentes.value = count || 0;
        } catch (err) {
            console.error('Erro ao contar solicitações de atividades pendentes:', err);
        }
    };

    const agendarAtualizacao = () => {
        clearTimeout(realtimeTimer);
        realtimeTimer = setTimeout(() => {
            carregarTotalSolicitacoes();
        }, 250);
    };

    const iniciarMonitoramentoSolicitacoes = () => {
        consumidoresAtivos += 1;
        sincronizarRealtimeAuth();
        carregarTotalSolicitacoes();

        if (!realtimeChannel) {
            realtimeChannel = supabase
                .channel('sidebar_solicitacoes_atividades')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'aluno_atividade' },
                    () => agendarAtualizacao()
                )
                .subscribe();
        }
    };

    const pararMonitoramentoSolicitacoes = () => {
        consumidoresAtivos = Math.max(0, consumidoresAtivos - 1);

        if (consumidoresAtivos === 0) {
            clearTimeout(realtimeTimer);
            if (realtimeChannel) {
                supabase.removeChannel(realtimeChannel);
                realtimeChannel = null;
            }
            totalSolicitacoesPendentes.value = 0;
        }
    };

    return {
        totalSolicitacoesPendentes,
        carregarTotalSolicitacoes,
        iniciarMonitoramentoSolicitacoes,
        pararMonitoramentoSolicitacoes
    };
}