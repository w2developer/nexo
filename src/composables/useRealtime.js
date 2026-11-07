import { supabase } from '@/lib/supabase';

let canalMestreAtivo = null;

export function useRealtime() {
    
    const iniciarConexaoGlobal = () => {
        if (canalMestreAtivo) return;

        console.log("Iniciando canal Realtime Mestre...");

        const token = sessionStorage.getItem('token_acesso');
        if (token) {
            supabase.realtime.setAuth(token);
        }

        canalMestreAtivo = supabase
            .channel('conexao_mestre_nexo')
            // OUVINTE UNIFICADO PARA O SCHEMA PUBLIC
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                const tabela = payload.table;

                // Distribui os eventos para as telas do Vue
                if (tabela === 'matricula') {
                    document.dispatchEvent(new CustomEvent('db-update-matricula', { detail: payload }));
                } 
                else if (tabela === 'registro_presenca') {
                    document.dispatchEvent(new CustomEvent('db-update-presenca', { detail: payload }));
                } 
                else if (tabela === 'registro_contato') {
                    document.dispatchEvent(new CustomEvent('db-update-contato', { detail: payload }));
                } 
                else if (tabela === 'controle_rematricula') {
                    document.dispatchEvent(new CustomEvent('db-update-rematricula', { detail: payload }));
                } 
                else if (tabela === 'aluno') {
                    document.dispatchEvent(new CustomEvent('db-update-aluno', { detail: payload }));
                }
            })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log("Conexão Realtime Autenticada e Unificada estabelecida com sucesso!");
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error("Erro no Realtime Mestre:", status, err);
                }
            });
    };

    const desconectarGlobal = () => {
        if (canalMestreAtivo) {
            console.log("Desligando canal Realtime Mestre...");
            supabase.removeChannel(canalMestreAtivo);
            canalMestreAtivo = null;
        }
    };

    return {
        iniciarConexaoGlobal,
        desconectarGlobal
    };
}