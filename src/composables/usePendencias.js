import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import { parseData, getUltimaPresenca, getHojeString } from '@/utils/dateHelpers';

export const META_CONTATOS_DIA = 5;

const matriculas = ref([]);
const carregando = ref(false);
let dadosJaCarregados = false;
let escutandoEventos = false;
let handlerRecarregarSilencioso = null;

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

            if (!escutandoEventos) {
                escutandoEventos = true;
                handlerRecarregarSilencioso = () => carregarDadosGlobais(true);

                document.addEventListener('db-update-matricula', handlerRecarregarSilencioso);
                document.addEventListener('db-update-presenca', handlerRecarregarSilencioso);
                document.addEventListener('db-update-contato', handlerRecarregarSilencioso);
            }
        } catch (err) {
            console.error('Erro ao carregar pendências globais:', err);
        } finally {
            carregando.value = false;
        }
    };

    const limparDadosGlobais = () => {
        matriculas.value = [];
        dadosJaCarregados = false;

        if (escutandoEventos && handlerRecarregarSilencioso) {
            document.removeEventListener('db-update-matricula', handlerRecarregarSilencioso);
            document.removeEventListener('db-update-presenca', handlerRecarregarSilencioso);
            document.removeEventListener('db-update-contato', handlerRecarregarSilencioso);
            handlerRecarregarSilencioso = null;
            escutandoEventos = false;
        }
    };

    // Funcoes utilitarias de data internas
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

    // Faltantes que precisam de ligacao agora (sem contato ou rechamada)
    const faltantesAcaoImediata = computed(() => {
        return listaFaltantes.value.filter(item => item.statusContato !== 'aguardando');
    });

    // Faltantes criticos (+30 dias sem vir e sem contato recente)
    const faltantesCriticos = computed(() => {
        return faltantesAcaoImediata.value.filter(item => item.diasAusente >= 30);
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

    // 5. Meta diaria de contatos registrados hoje (turno geral da secretaria)
    const contatosHoje = computed(() => {
        const hoje = getHojeString();
        const idsUnicos = new Set();

        matriculas.value.forEach(m => {
            (m.registro_contato || []).forEach(reg => {
                if (reg.data_contato === hoje && reg.id) {
                    idsUnicos.add(reg.id);
                }
            });
        });

        return idsUnicos.size;
    });

    const progressoMetaDiaria = computed(() => {
        if (META_CONTATOS_DIA <= 0) return 100;
        return Math.min(100, Math.round((contatosHoje.value / META_CONTATOS_DIA) * 100));
    });

    const metaDiariaAtingida = computed(() => {
        return contatosHoje.value >= META_CONTATOS_DIA;
    });

    return {
        matriculas,
        carregando,
        carregarDadosGlobais,
        limparDadosGlobais,
        listaFaltantes,
        faltantesAcaoImediata,
        faltantesCriticos,
        listaPrazos,
        listaCertificados,
        totalCursando,
        contatosHoje,
        metaContatosDia: META_CONTATOS_DIA,
        progressoMetaDiaria,
        metaDiariaAtingida
    };
}