import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import { parseData, getUltimaPresenca } from '@/utils/dateHelpers';

const matriculas = ref([]);
const carregando = ref(false);
let dadosJaCarregados = false;
let escutandoEventos = false; // Evita criar ouvintes duplicados

export function usePendencias() {

    const carregarDadosGlobais = async (forcarAtualizacao = false) => {
        if (dadosJaCarregados && !forcarAtualizacao) return;

        carregando.value = true;
        try {
            const { data, error } = await supabase
                .from('matricula')
                .select(`
                    *,
                    aluno(*),
                    curso(*),
                    registro_presenca(data_presenca),
                    registro_contato(id, data_contato, observacao, usuario_nome, criado_em)
                `)
                .in('situacao', ['cursando', 'concluido']);

            if (error) throw error;
            
            matriculas.value = data || [];
            dadosJaCarregados = true;

            // ========================================================
            // AQUI ESTÁ A MAGIA: O SINO COMEÇA A OUVIR O MAESTRO
            // ========================================================
            if (!escutandoEventos) {
                escutandoEventos = true;
                
                // Função que manda recarregar os dados em segundo plano
                const recarregarSilencioso = () => carregarDadosGlobais(true);
                
                document.addEventListener('db-update-matricula', recarregarSilencioso);
                document.addEventListener('db-update-presenca', recarregarSilencioso);
                document.addEventListener('db-update-contato', recarregarSilencioso);
            }

        } catch (err) {
            console.error("Erro ao carregar pendências globais:", err);
        } finally {
            carregando.value = false;
        }
    };

    const limparDadosGlobais = () => {
        matriculas.value = [];
        dadosJaCarregados = false;
        
        // Remove os ouvintes ao sair
        if (escutandoEventos) {
            const recarregarSilencioso = () => carregarDadosGlobais(true);
            document.removeEventListener('db-update-matricula', recarregarSilencioso);
            document.removeEventListener('db-update-presenca', recarregarSilencioso);
            document.removeEventListener('db-update-contato', recarregarSilencioso);
            escutandoEventos = false;
        }
    };

    // ... [O RESTO DO SEU FICHEIRO CONTINUA AQUI PARA BAIXO] ...

    // Funções utilitárias de data internas
    const calcularDiferencaDias = (dateStr) => {
        if (!dateStr) return null;
        const data = parseData(dateStr);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        return Math.floor((data - hoje) / (1000 * 60 * 60 * 24));
    };

    const diasPassadosDesde = (dateStr) => {
        const diff = calcularDiferencaDias(dateStr);
        return diff !== null ? Math.abs(diff) : null;
    };

    // 1. Fila de Faltantes (+14 dias)
    const listaFaltantes = computed(() => {
        return matriculas.value
            .filter(m => {
                if (m.situacao !== 'cursando' || m.ead) return false;
                const ultimaPresenca = getUltimaPresenca(m.registro_presenca);
                const dataBase = ultimaPresenca || m.data_inicio;
                const diasAusente = diasPassadosDesde(dataBase);
                return diasAusente !== null && diasAusente >= 14;
            })
            .map(m => {
                const ultimaPresenca = getUltimaPresenca(m.registro_presenca);
                const dataBase = ultimaPresenca || m.data_inicio;
                const diasAusente = diasPassadosDesde(dataBase);

                const historicoContatos = [...(m.registro_contato || [])].sort((a, b) => {
                    const cmpData = (b.data_contato || '').localeCompare(a.data_contato || '');
                    if (cmpData !== 0) return cmpData;
                    return (b.criado_em || '').localeCompare(a.criado_em || '');
                });

                const ultimoRegistro = historicoContatos[0] || null;
                const dataUltimoContato = ultimoRegistro?.data_contato || null;

                const contatoValido = dataUltimoContato && (!ultimaPresenca || dataUltimoContato >= ultimaPresenca);
                const diasDesdeContato = contatoValido ? diasPassadosDesde(dataUltimoContato) : null;

                let statusContato = 'sem_contato';
                if (contatoValido) {
                    statusContato = diasDesdeContato >= 7 ? 'rechamada' : 'aguardando';
                }

                return {
                    ...m,
                    ultimaPresenca,
                    diasAusente,
                    historicoContatos,
                    ultimoContato: contatoValido ? dataUltimoContato : null,
                    ultimaObservacao: contatoValido ? ultimoRegistro?.observacao : null,
                    diasDesdeContato,
                    statusContato
                };
            })
            .sort((a, b) => b.diasAusente - a.diasAusente);
    });

    // 2. Fila de Reta Final (<= 30 dias)
    const listaPrazos = computed(() => {
        return matriculas.value
            .filter(m => {
                if (m.situacao !== 'cursando' || !m.data_fim) return false;
                const diasRestantes = calcularDiferencaDias(m.data_fim);
                return diasRestantes !== null && diasRestantes <= 30;
            })
            .map(m => ({
                ...m,
                diasRestantes: calcularDiferencaDias(m.data_fim)
            }))
            .sort((a, b) => a.diasRestantes - b.diasRestantes);
    });

    // 3. Fila de Certificados
    const listaCertificados = computed(() => {
        return matriculas.value
            .filter(m => m.situacao === 'concluido' && m.situacao_certificado !== 'entregue')
            .sort((a, b) => {
                const prioridade = { nao_solicitado: 1, pendente: 2, emitido: 3 };
                return (prioridade[a.situacao_certificado] || 4) - (prioridade[b.situacao_certificado] || 4);
            });
    });

    // 4. Total de alunos ativos (KPI geral)
    const totalCursando = computed(() => {
        return matriculas.value.filter(m => m.situacao === 'cursando').length;
    });

    return {
        matriculas,
        carregando,
        carregarDadosGlobais,
        limparDadosGlobais,
        listaFaltantes,
        listaPrazos,
        listaCertificados,
        totalCursando
    };
}