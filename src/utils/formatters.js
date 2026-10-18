// Capitaliza as primeiras letras do nome
export const formatarNome = (nome) => {
    if (!nome) return 'Nome não encontrado';
    return nome
        .toLowerCase()
        .split(' ')
        .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
        .join(' ');
};

// Extrai as iniciais do primeiro e último nome
export const getInitials = (nome) => {
    if (!nome) return '??';
    const partes = nome.trim().split(' ').filter(Boolean);
    if (partes.length === 0) return '??';
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
};

// Gera cor consistente baseada no hash do nome
export const getAvatarColor = (nome) => {
    if (!nome) return 'bg-slate-100 text-slate-600';
    const colors = [
        'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700',
        'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700',
        'bg-pink-100 text-pink-700', 'bg-cyan-100 text-cyan-700',
        'bg-rose-100 text-rose-700', 'bg-indigo-100 text-indigo-700'
    ];
    let hash = 0;
    for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
};

// Capitaliza apenas a primeira letra da string
export const capitalizar = (texto) => {
    if (!texto) return '';
    return texto.charAt(0).toUpperCase() + texto.slice(1);
};

// Retorna a variante do Badge conforme a situação da matrícula
export const getBadgeVariantMatricula = (situacao) => {
    const str = situacao?.toLowerCase();
    if (str === 'concluido') return 'success';
    if (str === 'cancelado') return 'destructive';
    if (str === 'trancado') return 'secondary';
    return 'outline';
};