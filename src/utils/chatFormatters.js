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