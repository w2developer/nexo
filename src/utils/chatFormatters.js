const formatadorCargos = {
    'professor': 'Professor (a)',
    'secretaria': 'Secretário (a)',
    'admin': 'Administrador (a)',
    'aluno': 'Aluno (a)'
};

// Formata o cargo do usuário
export const formatarCargo = (tipo) => {
    if (!tipo) return 'Colaborador';
    const tipoLimpo = tipo.toLowerCase();
    return formatadorCargos[tipoLimpo] || (tipo.charAt(0).toUpperCase() + tipo.slice(1));
};

// Padroniza o nome de exibição do contato (ex.: canal do admin)
export const formatarNomeExibicao = (usuario) => {
    if (!usuario) return '';
    if (usuario.tipo?.toLowerCase() === 'admin') return 'Relatar Problemas';
    return usuario.nome || '';
};

// Formata hora em HH:MM
export const formatarHora = (dataString) => {
    if (!dataString) return '';
    return new Date(dataString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

// Formata data em DD/MM
export const formatarDiaMes = (dataString) => {
    if (!dataString) return '';
    return new Date(dataString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

// Gera chave única de dia (AAAA-MM-DD) no fuso local para agrupar mensagens
export const obterChaveDia = (dataString) => {
    if (!dataString) return '';
    const data = new Date(dataString);
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
};

// Formata rótulo amigável para divisores de data no histórico
export const formatarRotuloData = (dataString) => {
    if (!dataString) return '';
    const data = new Date(dataString);
    const hoje = new Date();
    const ontem = new Date();
    ontem.setDate(hoje.getDate() - 1);

    const chaveData = obterChaveDia(data);
    if (chaveData === obterChaveDia(hoje)) return 'Hoje';
    if (chaveData === obterChaveDia(ontem)) return 'Ontem';

    const opcoes = { day: '2-digit', month: '2-digit' };
    if (data.getFullYear() !== hoje.getFullYear()) {
        opcoes.year = 'numeric';
    }
    return data.toLocaleDateString('pt-BR', opcoes);
};

// Formata horário compacto para a lista de contatos (HH:MM, Ontem ou DD/MM)
export const formatarHorarioLista = (dataString) => {
    if (!dataString) return '';
    const data = new Date(dataString);
    const hoje = new Date();
    const ontem = new Date();
    ontem.setDate(hoje.getDate() - 1);

    const chaveData = obterChaveDia(data);
    if (chaveData === obterChaveDia(hoje)) return formatarHora(dataString);
    if (chaveData === obterChaveDia(ontem)) return 'Ontem';
    return formatarDiaMes(dataString);
};

// Remove marcações de negrito e quebras de linha para exibir prévia limpa
export const limparFormatacaoPreview = (texto) => {
    if (!texto) return '';
    return texto
        .replace(/\*(.*?)\*/gs, '$1')
        .replace(/\s+/g, ' ')
        .trim();
};

// Escapa HTML contra XSS e aplica negrito entre asteriscos
export const formatarTextoNegrito = (textoOriginal) => {
    if (!textoOriginal) return '';

    const textoSeguro = textoOriginal
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    return textoSeguro.replace(/\*(.*?)\*/gs, '<strong>$1</strong>');
};