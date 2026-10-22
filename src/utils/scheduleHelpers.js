// Remove acentos e padroniza para minúsculo
export const normalizarDia = (dia = '') => {
    return dia
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
};

export const DIAS_SEMANA_GRADE = [
    { value: 'segunda-feira', label: 'Segunda-feira' },
    { value: 'terca-feira', label: 'Terça-feira' },
    { value: 'quarta-feira', label: 'Quarta-feira' },
    { value: 'quinta-feira', label: 'Quinta-feira' },
    { value: 'sexta-feira', label: 'Sexta-feira' },
    { value: 'sabado', label: 'Sábado' }
];

export const TURNOS_GRADE = [
    {
        value: 'manha',
        label: 'Manhã',
        slots: [
            { hora_inicio: '08:00', hora_fim: '09:00' },
            { hora_inicio: '09:00', hora_fim: '10:00' },
            { hora_inicio: '10:00', hora_fim: '11:00' },
            { hora_inicio: '11:00', hora_fim: '12:00' },
            { hora_inicio: '12:00', hora_fim: '13:00' }
        ]
    },
    {
        value: 'tarde',
        label: 'Tarde',
        slots: [
            { hora_inicio: '13:00', hora_fim: '14:00' },
            { hora_inicio: '14:00', hora_fim: '15:00' },
            { hora_inicio: '15:00', hora_fim: '16:00' },
            { hora_inicio: '16:00', hora_fim: '17:00' },
            { hora_inicio: '17:00', hora_fim: '18:00' },
            { hora_inicio: '18:00', hora_fim: '19:00' }
        ]
    },
    {
        value: 'noite',
        label: 'Noite',
        slots: [
            { hora_inicio: '19:00', hora_fim: '20:00' },
            { hora_inicio: '20:00', hora_fim: '21:00' },
            { hora_inicio: '21:00', hora_fim: '22:00' },
            { hora_inicio: '22:00', hora_fim: '23:00' },
            { hora_inicio: '23:00', hora_fim: '00:00' }
        ]
    }
];

// Cria identificador único para cada slot (ex: segunda-feira|manha|08:00)
export const criarChaveSlot = (dia, turno, horaInicio) => {
    return `${normalizarDia(dia)}|${turno}|${horaInicio}`;
};