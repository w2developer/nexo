<template>
    <div class="min-h-screen bg-gray-50 p-8">
        <div class="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border space-y-6">
            <div>
                <h1 class="text-2xl font-bold tracking-tight text-gray-900">
                    Gerador de Dados de Teste
                </h1>
                <p class="text-sm text-gray-500 mt-2">
                    Esta é uma página temporária para injetar alunos fictícios no seu banco de dados
                    e testar a tela de presença.
                </p>
            </div>

            <div class="space-y-4">
                <button
                    @click="seedData"
                    :disabled="loading"
                    class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    <span v-if="loading">Gerando e inserindo dados... aguarde!</span>
                    <span v-else>Inserir 12 Alunos (Turma de Segunda-Feira)</span>
                </button>
            </div>

            <div
                v-if="message"
                :class="
                    error
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-green-50 text-green-700 border-green-200'
                "
                class="p-4 border rounded-lg text-sm font-medium whitespace-pre-wrap"
            >
                {{ message }}
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

const loading = ref(false)
const message = ref('')
const error = ref(false)

const nomes = [
    'Alice Pereira',
    'Bruno Souza',
    'Carlos Silva',
    'Daniela Costa',
    'Eduardo Lima',
    'Fernanda Alves',
    'Gabriel Rocha',
    'Helena Nunes',
    'Igor Mendes',
    'Juliana Castro',
    'Karla Oliveira',
    'Leonardo Martins',
]

const generateHorario = () => {
    // Fixo para a turma solicitada: Segunda, tarde, 14:00 às 15:00
    return {
        horario: [
            {
                turno: 'tarde',
                dia_semana: 'segunda-feira',
                hora_inicio: '14:00',
                hora_fim: '15:00',
            },
        ],
    }
}

const seedData = async () => {
    loading.value = true
    message.value = ''
    error.value = false
    let insertedCount = 0

    try {
        // 1. Garantir que exista um curso para vincular
        let { data: cursos, error: cErr } = await supabase.from('curso').select('id, nome')
        let curso_id = null

        if (cErr) throw new Error('Erro ao buscar cursos: ' + cErr.message)

        if (cursos && cursos.length > 0) {
            curso_id = cursos[0].id
        } else {
            const { data: novoCurso, error: insErr } = await supabase
                .from('curso')
                .insert({ nome: 'Design Gráfico e Vídeo' })
                .select('id')
                .single()

            if (insErr) throw new Error('Erro ao criar curso básico: ' + insErr.message)
            curso_id = novoCurso.id
        }

        // 2. Inserir Alunos
        for (let i = 0; i < nomes.length; i++) {
            const codigoAluno = 'AL' + Math.floor(Math.random() * 90000 + 10000)

            const { data: aluno, error: aErr } = await supabase
                .from('aluno')
                .insert({ nome: nomes[i], codigo: codigoAluno, ativo: true })
                .select('id')
                .single()

            if (aErr) throw new Error(`Erro ao criar aluno ${nomes[i]}: ` + aErr.message)

            // 3. Inserir Matrícula para o aluno
            // Simulando datas
            const hj = new Date().toISOString().split('T')[0]

            // 30% já receberam presença hoje
            const ultimaPresenca = Math.random() > 0.7 ? hj : null

            // Datas de fim variando (alguns em atraso)
            const dFim = new Date()
            dFim.setMonth(dFim.getMonth() + (Math.random() > 0.3 ? 2 : -2))
            const dFimStr = dFim.toISOString().split('T')[0]

            const { error: mErr } = await supabase.from('matricula').insert({
                aluno_id: aluno.id,
                curso_id: curso_id,
                situacao: 'cursando',
                data_inicio: '2025-01-01',
                data_fim: dFimStr,
                ultima_presenca: ultimaPresenca,
                horario: generateHorario(),
            })

            if (mErr) throw new Error(`Erro ao criar matrícula para ${nomes[i]}: ` + mErr.message)

            insertedCount++
        }

        message.value = `Sucesso! \n${insertedCount} alunos fictícios criados e matriculados com sucesso em horários e dias variados.`
    } catch (e) {
        error.value = true
        message.value = e.message
    } finally {
        loading.value = false
    }
}
</script>
