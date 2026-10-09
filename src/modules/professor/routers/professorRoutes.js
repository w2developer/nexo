export default [
    {
        path: '/professor',
        component: () => import('@/layouts/ProfessorLayout.vue'),
        meta: { roles: ['professor'] },
        children: [
            {
                path: 'presenca',
                component: () => import('@/modules/professor/views/Presenca.vue'),
            },
            {
                path: 'alunos',
                component: () => import('@/modules/professor/views/ControleAlunos.vue'),
            },
            {
                path: 'concluidos',
                component: () => import('@/modules/professor/views/ControleConcluidos.vue'),
            },
            {
                path: 'configuracoes',
                component: () => import('@/modules/professor/views/Configuracoes.vue'),
            },
            {
                path: 'editar-aluno/:id',
                component: () => import('@/modules/professor/views/EditarAluno.vue'),
            },
            {
                path: 'mensagens',
                name: 'professor-mensagens',
                component: () => import('@/modules/chat/MensagensEquipe.vue'),
                meta: { title: 'Mensagens' }
            }
        ],
    },
]
