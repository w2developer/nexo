import { ref } from 'vue';
import { supabase } from '@/lib/supabase';

// ==========================================
// ESTADO GLOBAL (Partilhado por toda a App)
// ==========================================
const colegas = ref([]);
const mensagens = ref([]);
const colegaAtivo = ref(null);
const salaAtivaId = ref(null);
const widgetAberto = ref(false);
// Adicionado o campo 'tipo' ao estado do usuário
const currentUser = ref({ id: null, nome: null, tipo: null });
const carregando = ref(false);
const usuariosOnline = ref([]);
const quemEstaDigitando = ref([]);
const naoLidasGlobais = ref({}); 

let canalGlobal = null;
let timeoutDigitacao = null;

export function useChat() {
    
    // Inicializa o chat e carrega dados base (Agora recebe o tipo)
    const initChat = async (userId, userName, userTipo) => {
        currentUser.value = { id: userId, nome: userName, tipo: userTipo };
        
        const token = sessionStorage.getItem('token_acesso');
        if (token) supabase.realtime.setAuth(token);
        
        await carregarColegas();
        iniciarRealtime();
    };

    // Busca a equipe
    const carregarColegas = async () => {
        if (!currentUser.value.id) return;
        
        const { data } = await supabase
            .from('usuario')
            .select('id, nome, tipo')
            .neq('id', currentUser.value.id)
            .order('nome');
            
        if (data) colegas.value = data;
    };

    // Abre conversa e zera não lidas
    const abrirChatCom = async (colega) => {
        carregando.value = true;
        colegaAtivo.value = colega;
        mensagens.value = [];
        quemEstaDigitando.value = [];
        
        try {
            let { data: salaExistente } = await supabase
                .from('chat_sala')
                .select('id')
                .eq('tipo', 'direto')
                .or(`and(usuario_a_id.eq.${currentUser.value.id},usuario_b_id.eq.${colega.id}),and(usuario_a_id.eq.${colega.id},usuario_b_id.eq.${currentUser.value.id})`)
                .maybeSingle();

            if (!salaExistente) {
                const { data: novaSala } = await supabase
                    .from('chat_sala')
                    .insert({ tipo: 'direto', usuario_a_id: currentUser.value.id, usuario_b_id: colega.id })
                    .select('id')
                    .single();
                salaExistente = novaSala;
            }

            salaAtivaId.value = salaExistente.id;

            const { data: historico } = await supabase
                .from('chat_mensagem')
                .select('*')
                .eq('sala_id', salaAtivaId.value)
                .order('criado_em', { ascending: true });

            if (historico) {
                mensagens.value = historico;
                marcarMensagensComoLidas();
            }
        } catch (err) {
            console.error("Erro ao abrir chat:", err);
        } finally {
            carregando.value = false;
        }
    };

    // Envia mensagem
    const enviarMensagem = async (texto) => {
        if (!salaAtivaId.value || !texto.trim()) return false;

        // O insert agora possui o remetente_tipo obrigatório
        const novaMsg = {
            sala_id: salaAtivaId.value,
            remetente_id: currentUser.value.id,
            remetente_tipo: currentUser.value.tipo, 
            texto: texto.trim(),
            lida: false
        };

        const { data, error } = await supabase
            .from('chat_mensagem')
            .insert(novaMsg)
            .select()
            .single();

        if (error) {
            console.error("ERRO DO SUPABASE NO INSERT:", error);
            return false;
        }

        if (!mensagens.value.find(m => m.id === data.id)) {
            mensagens.value.push(data);
        }

        await supabase.from('chat_sala').update({ atualizado_em: new Date().toISOString() }).eq('id', salaAtivaId.value);
        return true;
    };

    // Exclui mensagem
    const excluirMensagem = async (msgId) => {
        mensagens.value = mensagens.value.filter(m => m.id !== msgId);
        await supabase.from('chat_mensagem').delete().eq('id', msgId);
    };

    // Atualiza status para lida
    const marcarMensagensComoLidas = async () => {
        const mensagensNaoLidas = mensagens.value.filter(m => m.remetente_id !== currentUser.value.id && !m.lida);
        if (mensagensNaoLidas.length === 0) return;

        mensagensNaoLidas.forEach(m => m.lida = true);
        naoLidasGlobais.value[salaAtivaId.value] = 0;

        await supabase
            .from('chat_mensagem')
            .update({ lida: true })
            .eq('sala_id', salaAtivaId.value)
            .neq('remetente_id', currentUser.value.id)
            .eq('lida', false);
    };

    // Emite evento de digitação
    const sinalizarDigitacao = () => {
        if (!salaAtivaId.value || !canalGlobal) return;

        canalGlobal.send({
            type: 'broadcast',
            event: 'digitando',
            payload: { sala_id: salaAtivaId.value, usuario_id: currentUser.value.id }
        });
    };

    // Gerencia WebSocket (Presence, Broadcasts e DB)
    const iniciarRealtime = () => {
        // Limpa canal anterior para evitar o erro "cannot add presence after subscribe"
        if (canalGlobal) {
            supabase.removeChannel(canalGlobal);
            canalGlobal = null;
        }

        canalGlobal = supabase.channel('chat_global', {
            config: { presence: { key: currentUser.value.id } }
        });

        canalGlobal
            .on('presence', { event: 'sync' }, () => {
                const state = canalGlobal.presenceState();
                usuariosOnline.value = Object.keys(state);
            })
            .on('broadcast', { event: 'digitando' }, (payload) => {
                const { sala_id, usuario_id } = payload.payload;
                if (sala_id === salaAtivaId.value && usuario_id !== currentUser.value.id) {
                    if (!quemEstaDigitando.value.includes(usuario_id)) quemEstaDigitando.value.push(usuario_id);
                    
                    clearTimeout(timeoutDigitacao);
                    timeoutDigitacao = setTimeout(() => {
                        quemEstaDigitando.value = quemEstaDigitando.value.filter(id => id !== usuario_id);
                    }, 3000);
                }
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagem' }, (payload) => {
                const nova = payload.new;
                if (salaAtivaId.value === nova.sala_id) {
                    if (!mensagens.value.find(m => m.id === nova.id)) mensagens.value.push(nova);
                    if (nova.remetente_id !== currentUser.value.id) marcarMensagensComoLidas();
                } else if (nova.remetente_id !== currentUser.value.id) {
                    naoLidasGlobais.value[nova.sala_id] = (naoLidasGlobais.value[nova.sala_id] || 0) + 1;
                }
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_mensagem' }, (payload) => {
                mensagens.value = mensagens.value.filter(m => m.id !== payload.old.id);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_mensagem' }, (payload) => {
                const index = mensagens.value.findIndex(m => m.id === payload.new.id);
                if (index !== -1) mensagens.value[index] = payload.new;
            });

        canalGlobal.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') await canalGlobal.track({ status: 'online' });
        });
    };

    const fecharChat = () => {
        colegaAtivo.value = null;
        salaAtivaId.value = null;
        mensagens.value = [];
        quemEstaDigitando.value = [];
    };

    const toggleWidget = () => widgetAberto.value = !widgetAberto.value;

    return {
        colegas, mensagens, colegaAtivo, widgetAberto, currentUser, carregando,
        usuariosOnline, quemEstaDigitando, naoLidasGlobais, salaAtivaId,
        initChat, toggleWidget, abrirChatCom, fecharChat, enviarMensagem, excluirMensagem, sinalizarDigitacao
    };
}