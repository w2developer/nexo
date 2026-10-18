import { diaSemana, horas } from './constants';

export const getDiaAtual = () => {
    const diaIndex = new Date().getDay(); 
    const mapDias = ['domingo', 'segunda-feira', 'terca-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sabado'];
    const nomeDiaAtual = mapDias[diaIndex];
    
    const diaExiste = diaSemana.find(d => d.value === nomeDiaAtual);
    return diaExiste ? nomeDiaAtual : null; 
};

export const getHoraETurnoAtual = () => {
    const horaAtualJs = new Date().getHours();
    const horaFormatada = `${horaAtualJs.toString().padStart(2, '0')}:00`;
    const horaEncontrada = horas.find(h => h.value === horaFormatada);

    if (horaEncontrada) {
        return { turno: horaEncontrada.turno, hora: horaEncontrada.value };
    } else {
        return { turno: 'manha', hora: '08:00' };
    }
};

// Retorna a data atual no formato YYYY-MM-DD
export const getHojeString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Converte string ISO para objeto Date local
export const parseData = (dateStr) => {
    if (!dateStr) return null;
    const [ano, mes, dia] = dateStr.split('T')[0].split('-');
    return new Date(ano, mes - 1, dia);
};

// Formata string YYYY-MM-DD para DD/MM/YYYY
export const formatarDataBR = (dateStr) => {
    if (!dateStr) return '---';
    const [ano, mes, dia] = dateStr.split('T')[0].split('-');
    return `${dia}/${mes}/${ano}`;
};

// Verifica se a data informada tem 14 dias ou mais
export const isDuasSemanasAtras = (dateStr) => {
    if (!dateStr) return false;
    const dataPresenca = parseData(dateStr);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return Math.floor((hoje - dataPresenca) / (1000 * 60 * 60 * 24)) >= 14;
};

// Verifica se a data já passou de hoje
export const isDataVencida = (dateStr) => {
    if (!dateStr) return false;
    const dataFim = parseData(dateStr);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return dataFim < hoje;
};

// Formata exibição da previsão de término
export const textoPrevisaoTermino = (dateStr) => {
    if (!dateStr) return 'NÃO DEFINIDO';
    const dataFormatada = formatarDataBR(dateStr);
    return isDataVencida(dateStr) ? `- ${dataFormatada}` : dataFormatada;
};

// Calcula meses, semanas e dias restantes até a data final
export const calcularTempoRestante = (dateStr) => {
    if (!dateStr || isDataVencida(dateStr)) return '0m, 0sem e 0d';

    const fim = parseData(dateStr);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let meses = (fim.getFullYear() - hoje.getFullYear()) * 12 + (fim.getMonth() - hoje.getMonth());
    let tempFim = new Date(hoje.getFullYear(), hoje.getMonth() + meses, hoje.getDate());

    if (tempFim > fim) {
        meses--;
        tempFim = new Date(hoje.getFullYear(), hoje.getMonth() + meses, hoje.getDate());
    }

    const diasRestantes = Math.floor((fim - tempFim) / (1000 * 60 * 60 * 24));
    return `${meses}m, ${Math.floor(diasRestantes / 7)}sem e ${diasRestantes % 7}d`;
};

// Obtém a última data de presença do histórico
export const getUltimaPresenca = (registros) => {
    if (!registros || !Array.isArray(registros) || registros.length === 0) return null;
    const datas = registros.map(r => r.data_presenca).filter(Boolean).sort();
    return datas[datas.length - 1] || null;
};