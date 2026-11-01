import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import { useBrowserNotification } from '@/composables/useBrowserNotification';

// Estado global compartilhado
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
const minhasSalasIds = ref(new Set());
const mensagensProcessadas = new Set();

let canalGlobal = null;
let timeoutDigitacao = null;
let listenerVisibilidadeAtivo = false;

export function useChat() {
    const { verificarPermissaoInicial, dispararNotificacao } = useBrowserNotification();

    // Inicializa sessão, contadores, WebSocket e listener de foco
    const initChat = async (userId, userName, userTipo) => {
        if (!userId) return;
        currentUser.value = { id: String(userId), nome: userName, tipo: userTipo };

        const token = sessionStorage.getItem('token_acesso');
        if (token) supabase.realtime.setAuth(token);

        await carregarColegas();
        await carregarNaoLidas();
        iniciarRealtime();
        configurarRecuperacaoDeFoco();
        verificarPermissaoInicial();
    };

    // Recarrega não lidas automaticamente ao voltar para a aba
    const configurarRecuperacaoDeFoco = () => {
        if (listenerVisibilidadeAtivo || typeof document === 'undefined') return;
        listenerVisibilidadeAtivo = true;

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && currentUser.value.id) {
                carregarNaoLidas();
                if (widgetAberto.value && salaAtivaId.value) {
                    marcarMensagensComoLidas();
                }
            }
        });
    };

    // Atualiza o contador garantindo reatividade no Vue 3
    const definirNaoLida = (remetenteId, valorOuIncremento, incrementar = false) => {
        const chave = String(remetenteId);
        const atual = naoLidasGlobais.value[chave] || 0;
        const novoValor = incrementar ? atual + valorOuIncremento : valorOuIncremento;

        naoLidasGlobais.value = {
            ...naoLidasGlobais.value,
            [chave]: Math.max(0, novoValor)
        };
    };

    // Lista colaboradores exceto o usuário logado
    const carregarColegas = async () => {
        if (!currentUser.value.id) return;

        const { data } = await supabase
            .from('usuario')
            .select('id, nome, tipo')
            .neq('id', currentUser.value.id)
            .order('nome');

        if (data) colegas.value = data;
    };

    // Busca alunos ativos por nome ou código
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
            console.error('Erro ao buscar alunos:', error);
            return [];
        }
        return data || [];
    };

    // Abre ou cria sala direta com o colega
    const abrirChatCom = async (colega) => {
        carregando.value = true;
        colegaAtivo.value = colega;
        mensagens.value = [];
        quemEstaDigitando.value = [];

        definirNaoLida(colega.id, 0);

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
            minhasSalasIds.value.add(salaExistente.id);

            const { data: historico } = await supabase
                .from('chat_mensagem')
                .select('*, aluno_mencionado:aluno(id, nome, codigo)')
                .eq('sala_id', salaAtivaId.value)
                .order('criado_em', { ascending: true });

            if (historico) {
                mensagens.value = historico;
                await marcarMensagensComoLidas();
            }
        } catch (err) {
            console.error('Erro ao abrir chat:', err);
        } finally {
            carregando.value = false;
        }
    };

    // Insere mensagem no banco e emite broadcast imediato para o destinatário
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
            console.error('Erro ao enviar mensagem:', error);
            return false;
        }

        mensagensProcessadas.add(data.id);

        if (!mensagens.value.find(m => m.id === data.id)) {
            mensagens.value.push(data);
        }

        // Envia aviso instantâneo via WebSocket sem depender de SELECT na outra ponta
        if (canalGlobal && colegaAtivo.value) {
            canalGlobal.send({
                type: 'broadcast',
                event: 'nova_mensagem',
                payload: {
                    mensagem: data,
                    destinatario_id: String(colegaAtivo.value.id),
                    remetente_nome: currentUser.value.nome
                }
            });
        }

        await supabase
            .from('chat_sala')
            .update({ atualizado_em: new Date().toISOString() })
            .eq('id', salaAtivaId.value);

        return true;
    };

    // Processa mensagem recebida (seja via Broadcast ou Postgres Changes)
    const processarMensagemRecebida = async (nova, remetenteNomeOpcional = null) => {
        if (!nova || !nova.id) return;

        const ehMinhaMensagem = String(nova.remetente_id) === String(currentUser.value.id);
        if (ehMinhaMensagem) return;

        // Evita duplicidade entre Broadcast e Postgres Changes
        if (mensagensProcessadas.has(nova.id)) return;
        mensagensProcessadas.add(nova.id);
        minhasSalasIds.value.add(nova.sala_id);

        const conversaAbertaComRemetente =
            widgetAberto.value &&
            salaAtivaId.value === nova.sala_id;

        if (salaAtivaId.value === nova.sala_id) {
            if (!nova.aluno_mencionado && nova.aluno_mencionado_id) {
                const { data: aluno } = await supabase
                    .from('aluno')
                    .select('id, nome, codigo')
                    .eq('id', nova.aluno_mencionado_id)
                    .single();
                nova.aluno_mencionado = aluno || null;
            }

            if (!mensagens.value.find(m => m.id === nova.id)) {
                mensagens.value.push(nova);
            }
        }

        if (conversaAbertaComRemetente && !document.hidden) {
            await marcarMensagensComoLidas();
        } else {
            definirNaoLida(nova.remetente_id, 1, true);
        }

        // Busca nome do colega para exibir na notificação do navegador
        const colegaRemetente = colegas.value.find(
            c => String(c.id) === String(nova.remetente_id)
        );
        const nomeExibicao = remetenteNomeOpcional || colegaRemetente?.nome || 'Nova mensagem';

        dispararNotificacao(
            `Mensagem de ${nomeExibicao}`,
            nova.texto,
            () => {
                widgetAberto.value = true;
                if (colegaRemetente) abrirChatCom(colegaRemetente);
            }
        );
    };

    // Remove mensagem permanentemente
    const excluirMensagem = async (msgId) => {
        mensagens.value = mensagens.value.filter(m => m.id !== msgId);
        await supabase.from('chat_mensagem').delete().eq('id', msgId);
    };

    // Alterna confirmação rápida (Like)
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
            console.error('Erro ao atualizar like:', error);
        }
    };

    // Sincroniza todas as mensagens não lidas com o banco
    const carregarNaoLidas = async () => {
        if (!currentUser.value.id) return;

        const { data: salas } = await supabase
            .from('chat_sala')
            .select('id')
            .or(`usuario_a_id.eq.${currentUser.value.id},usuario_b_id.eq.${currentUser.value.id}`);

        if (!salas || salas.length === 0) {
            naoLidasGlobais.value = {};
            return;
        }

        const idsSalas = salas.map(s => s.id);
        minhasSalasIds.value = new Set(idsSalas);

        const { data: pendentes } = await supabase
            .from('chat_mensagem')
            .select('id, remetente_id')
            .in('sala_id', idsSalas)
            .eq('lida', false)
            .neq('remetente_id', currentUser.value.id);

        const novoMapa = {};
        if (pendentes) {
            pendentes.forEach(msg => {
                mensagensProcessadas.add(msg.id);
                const chave = String(msg.remetente_id);
                novoMapa[chave] = (novoMapa[chave] || 0) + 1;
            });
        }
        naoLidasGlobais.value = novoMapa;
    };

    // Marca mensagens da conversa ativa como lidas
    const marcarMensagensComoLidas = async () => {
        if (colegaAtivo.value) {
            definirNaoLida(colegaAtivo.value.id, 0);
        }

        const mensagensNaoLidas = mensagens.value.filter(
            m => String(m.remetente_id) !== String(currentUser.value.id) && !m.lida
        );
        if (mensagensNaoLidas.length === 0 || !salaAtivaId.value) return;

        mensagensNaoLidas.forEach(m => m.lida = true);

        await supabase
            .from('chat_mensagem')
            .update({ lida: true })
            .eq('sala_id', salaAtivaId.value)
            .neq('remetente_id', currentUser.value.id)
            .eq('lida', false);
    };

    // Envia broadcast de digitação
    const sinalizarDigitacao = () => {
        if (!salaAtivaId.value || !canalGlobal) return;

        canalGlobal.send({
            type: 'broadcast',
            event: 'digitando',
            payload: { sala_id: salaAtivaId.value, usuario_id: currentUser.value.id }
        });
    };

    // Configura listeners de Presence, Broadcast e Banco de Dados
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
                if (sala_id === salaAtivaId.value && String(usuario_id) !== String(currentUser.value.id)) {
                    if (!quemEstaDigitando.value.includes(usuario_id)) {
                        quemEstaDigitando.value.push(usuario_id);
                    }

                    clearTimeout(timeoutDigitacao);
                    timeoutDigitacao = setTimeout(() => {
                        quemEstaDigitando.value = quemEstaDigitando.value.filter(id => id !== usuario_id);
                    }, 3000);
                }
            })
            .on('broadcast', { event: 'nova_mensagem' }, async (payload) => {
                const { mensagem, destinatario_id, remetente_nome } = payload.payload;
                if (String(destinatario_id) !== String(currentUser.value.id)) return;

                await processarMensagemRecebida(mensagem, remetente_nome);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_sala' }, (payload) => {
                const sala = payload.new;
                if (
                    String(sala.usuario_a_id) === String(currentUser.value.id) ||
                    String(sala.usuario_b_id) === String(currentUser.value.id)
                ) {
                    minhasSalasIds.value.add(sala.id);
                }
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagem' }, async (payload) => {
                const nova = payload.new;
                if (String(nova.remetente_id) === String(currentUser.value.id)) return;

                // Se a sala já é conhecida, processa direto; senão sincroniza do banco
                if (minhasSalasIds.value.has(nova.sala_id)) {
                    await processarMensagemRecebida(nova);
                } else {
                    await carregarNaoLidas();
                }
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_mensagem' }, async (payload) => {
                mensagens.value = mensagens.value.filter(m => m.id !== payload.old.id);
                await carregarNaoLidas();
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_mensagem' }, (payload) => {
                const index = mensagens.value.findIndex(m => m.id === payload.new.id);
                if (index !== -1) {
                    mensagens.value[index] = {
                        ...mensagens.value[index],
                        ...payload.new
                    };
                }
            });

        canalGlobal.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await canalGlobal.track({ status: 'online' });
            }
        });
    };

    const fecharChat = () => {
        colegaAtivo.value = null;
        salaAtivaId.value = null;
        mensagens.value = [];
        quemEstaDigitando.value = [];
    };

    const toggleWidget = () => {
        widgetAberto.value = !widgetAberto.value;
        if (widgetAberto.value && salaAtivaId.value) {
            marcarMensagensComoLidas();
        }
    };

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