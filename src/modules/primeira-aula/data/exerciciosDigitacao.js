// src/modules/primeira-aula/data/exerciciosDigitacao.js

export const EXERCICIOS_DIGITACAO = {
    'digitacao-simples': {
        dicaTeclado: 'Use a barra de espaço entre palavras e Backspace se precisar apagar.',
        teclasDestaque: ['Espaço', 'Backspace'],
        conjuntos: [
            [
                'casa',
                'aula',
                'mouse e teclado',
                'meu primeiro dia de aula',
                'estou praticando no computador',
            ],
            [
                'tela',
                'curso',
                'abrir a pasta',
                'digitar com calma ajuda muito',
                'hoje aprendi a usar o mouse',
            ],
        ],
    },
    'digitacao-maiusculas': {
        dicaTeclado: 'Segure Shift junto com a letra para fazer maiúsculas. Não use Caps Lock.',
        teclasDestaque: ['Shift + letra'],
        conjuntos: [
            [
                'Brasil',
                'Ana e Lucas',
                'Hoje temos aula no Nexo',
                'Pedro estuda no turno da tarde',
            ],
            [
                'Nexo',
                'Carla e Bruno',
                'Segunda feira de aula nova',
                'Marcos pratica na sala de aula',
            ],
        ],
    },
    'digitacao-simbolos': {
        dicaTeclado: 'Para símbolos na parte de cima das teclas (?, !, @, (, ), $), segure Shift + tecla.',
        teclasDestaque: ['Shift + símbolo', 'Pontuação'],
        conjuntos: [
            [
                'Tudo bem?',
                'aluno@nexo.com',
                'Data: 26/11/2026',
                'Valor: R$ 50,00 (pago)!',
            ],
            [
                'Vamos estudar!',
                'contato@escola.com.br',
                'Turma: 14:30 - Sala 02',
                'Total: R$ 120,00 (confirmado).',
            ],
        ],
    },
    'digitacao-completa': {
        dicaTeclado: 'Para acentos (´, ~, ^), pressione primeiro o acento e depois a letra. Use Shift para maiúsculas e símbolos.',
        teclasDestaque: ['Shift + letra', 'Acento + vogal', 'ç'],
        conjuntos: [
            [
                'Parabéns! Você chegou à última etapa.',
                'Atenção: salve o arquivo antes de fechar.',
                'Minha aula começa às 15:00 na sala 03.',
                'O relatório custa R$ 45,00 (versão final).',
            ],
            [
                'Ótimo trabalho! A prática traz confiança.',
                'Você já sabe usar mouse, rolagem e teclado?',
                'A matrícula do curso está 100% concluída!',
                'Envie dúvidas para suporte@exemplo.com (segunda a sexta).',
            ],
        ],
    },
}