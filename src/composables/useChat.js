import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabase';

// Estado global compartilhado entre componentes
const colegas = ref([]);
const mensagens = ref([]);
const colegaAtivo = ref(null);
const salaAtivaId = ref(null);
const widgetAberto = ref(false);
const currentUser = ref({ id: null, nome: null, tipo: null });
const carregando = ref(false);
const usuariosOnline = ref([]);
const quemEstaDigitando = ref([]);
const naoLidasGlobais = ref({}); 

let canalGlobal = null;
let timeoutDigitacao = null;

export function useChat() {
    
    // Inicializa sessão do chat, contadores e conexão WebSocket
    const initChat = async (userId, userName, userTipo) => {
        currentUser.value = { id: userId, nome: userName, tipo: userTipo };
        
        const token = sessionStorage.getItem('token_acesso');
        if (token) supabase.realtime.setAuth(token);
        
        await carregarColegas();
        await carregarNaoLidas();
        iniciarRealtime();
    };

    // Lista todos os colaboradores exceto o usuário logado
    const carregarColegas = async () => {
        if (!currentUser.value.id) return;
        
        const { data } = await supabase
            .from('usuario')
            .select('id, nome, tipo')
            .neq('id', currentUser.value.id)
            .order('nome');
            
        if (data) colegas.value = data;
    };

    // Pesquisa alunos ativos por nome ou matrícula para anexar como assunto
    const buscarAlunos = async (termo) => {
        if (!termo || termo.trim().length < 2) return [];

        const busca = termo.trim();
        const { data, error } = await supabase
            .from('aluno')
            .select('id, nome, codigo')
            .eq('ativo', true)
            .or(`nome.ilike.%${busca}%,codigo.ilike.%${busca}%`)
            .order('nome')
            .limit(5);

        if (error) {
            console.error("Erro ao buscar alunos:", error);
            return [];
        }
        return data || [];
    };

    // Localiza ou cria uma sala direta com o colega e carrega o histórico
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

            // Busca mensagens fazendo join com a tabela aluno quando houver menção
            const { data: historico } = await supabase
                .from('chat_mensagem')
                .select('*, aluno_mencionado:aluno(id, nome, codigo)')
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

    // Insere nova mensagem no banco (com suporte opcional a aluno mencionado)
    const enviarMensagem = async (texto, alunoMencionadoId = null) => {
        if (!salaAtivaId.value || !texto.trim()) return false;

        const novaMsg = {
            sala_id: salaAtivaId.value,
            remetente_id: currentUser.value.id,
            remetente_tipo: currentUser.value.tipo, 
            texto: texto.trim(),
            aluno_mencionado_id: alunoMencionadoId,
            lida: false
        };

        const { data, error } = await supabase
            .from('chat_mensagem')
            .insert(novaMsg)
            .select('*, aluno_mencionado:aluno(id, nome, codigo)')
            .single();

        if (error) {
            console.error("Erro ao enviar mensagem:", error);
            return false;
        }

        if (!mensagens.value.find(m => m.id === data.id)) {
            mensagens.value.push(data);
        }

        await supabase
            .from('chat_sala')
            .update({ atualizado_em: new Date().toISOString() })
            .eq('id', salaAtivaId.value);

        return true;
    };

    // Remove mensagem permanentemente
    const excluirMensagem = async (msgId) => {
        mensagens.value = mensagens.value.filter(m => m.id !== msgId);
        await supabase.from('chat_mensagem').delete().eq('id', msgId);
    };

    // Alterna confirmação de leitura rápida (Like) com atualização otimista
    const confirmarLike = async (msgId) => {
        const msg = mensagens.value.find(m => m.id === msgId);
        if (!msg) return;

        const novoStatus = !msg.like;
        msg.like = novoStatus;

        const { error } = await supabase
            .from('chat_mensagem')
            .update({ like: novoStatus })
            .eq('id', msgId);

        if (error) {
            msg.like = !novoStatus;
            console.error("Erro ao atualizar like:", error);
        }
    };

    // Contabiliza mensagens não lidas de todas as salas do usuário
    const carregarNaoLidas = async () => {
        if (!currentUser.value.id) return;
        
        const { data: salas } = await supabase
            .from('chat_sala')
            .select('id')
            .or(`usuario_a_id.eq.${currentUser.value.id},usuario_b_id.eq.${currentUser.value.id}`);
            
        if (!salas || salas.length === 0) return;
        
        const idsSalas = salas.map(s => s.id);
        
        const { data: pendentes } = await supabase
            .from('chat_mensagem')
            .select('remetente_id')
            .in('sala_id', idsSalas)
            .eq('lida', false)
            .neq('remetente_id', currentUser.value.id);
            
        if (pendentes) {
            pendentes.forEach(msg => {
                const id = msg.remetente_id;
                naoLidasGlobais.value[id] = (naoLidasGlobais.value[id] || 0) + 1;
            });
        }
    };

    // Marca mensagens recebidas na sala ativa como lidas
    const marcarMensagensComoLidas = async () => {
        const mensagensNaoLidas = mensagens.value.filter(
            m => m.remetente_id !== currentUser.value.id && !m.lida
        );
        if (mensagensNaoLidas.length === 0) return;

        mensagensNaoLidas.forEach(m => m.lida = true);

        if (colegaAtivo.value) {
            naoLidasGlobais.value[colegaAtivo.value.id] = 0; 
        }

        await supabase
            .from('chat_mensagem')
            .update({ lida: true })
            .eq('sala_id', salaAtivaId.value)
            .neq('remetente_id', currentUser.value.id)
            .eq('lida', false);
    };

    // Dispara evento broadcast de digitação para a sala atual
    const sinalizarDigitacao = () => {
        if (!salaAtivaId.value || !canalGlobal) return;

        canalGlobal.send({
            type: 'broadcast',
            event: 'digitando',
            payload: { sala_id: salaAtivaId.value, usuario_id: currentUser.value.id }
        });
    };

    // Configura listeners de Presence, Broadcast e alterações no banco via WebSocket
    const iniciarRealtime = () => {
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
                    if (!quemEstaDigitando.value.includes(usuario_id)) {
                        quemEstaDigitando.value.push(usuario_id);
                    }
                    
                    clearTimeout(timeoutDigitacao);
                    timeoutDigitacao = setTimeout(() => {
                        quemEstaDigitando.value = quemEstaDigitando.value.filter(id => id !== usuario_id);
                    }, 3000);
                }
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagem' }, async (payload) => {
                const nova = payload.new;
                if (salaAtivaId.value === nova.sala_id) {
                    if (!mensagens.value.find(m => m.id === nova.id)) {
                        // Se a mensagem recebida via Realtime tiver aluno vinculado, busca os dados dele
                        if (nova.aluno_mencionado_id) {
                            const { data: aluno } = await supabase
                                .from('aluno')
                                .select('id, nome, codigo')
                                .eq('id', nova.aluno_mencionado_id)
                                .single();
                            nova.aluno_mencionado = aluno || null;
                        }
                        mensagens.value.push(nova);
                    }
                    if (nova.remetente_id !== currentUser.value.id) marcarMensagensComoLidas();
                } else if (nova.remetente_id !== currentUser.value.id) {
                    naoLidasGlobais.value[nova.remetente_id] = (naoLidasGlobais.value[nova.remetente_id] || 0) + 1;
                }
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_mensagem' }, (payload) => {
                mensagens.value = mensagens.value.filter(m => m.id !== payload.old.id);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_mensagem' }, (payload) => {
                const index = mensagens.value.findIndex(m => m.id === payload.new.id);
                if (index !== -1) {
                    // Mescla os dados para não perder o objeto 'aluno_mencionado' já carregado
                    mensagens.value[index] = {
                        ...mensagens.value[index],
                        ...payload.new
                    };
                }
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

    const temMensagemNaoLida = computed(() => {
        return Object.values(naoLidasGlobais.value).some(qtd => qtd > 0);
    });

    return {
        colegas, mensagens, colegaAtivo, widgetAberto, currentUser, carregando,
        usuariosOnline, quemEstaDigitando, naoLidasGlobais, salaAtivaId, temMensagemNaoLida,
        initChat, toggleWidget, abrirChatCom, fecharChat, enviarMensagem, excluirMensagem, 
        confirmarLike, sinalizarDigitacao, buscarAlunos
    };
}