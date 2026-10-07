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