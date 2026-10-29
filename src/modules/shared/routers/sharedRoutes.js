export default [
    {
        path: 'alunos',
        component: () => import('@/modules/shared/views/ControleAlunos.vue'),
    },
    {
        path: 'concluidos',
        component: () => import('@/modules/shared/views/ControleConcluidos.vue'),
    },
    {
        path: 'editar-aluno/:id',
        component: () => import('@/modules/shared/views/EditarAluno.vue'),
    },
    {
        path: 'horarios/:id',
        component: () => import('@/modules/shared/views/GerenciarHorarios.vue')
    },
    {
        path: 'presencas/:id',
        component: () => import('@/modules/shared/views/HistoricoPresencas.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: 'nova-matricula/:id',
        component: () => import('@/modules/shared/views/NovaMatricula.vue')
    },
    {
        path: 'cadastrar-aluno',
        component: () => import('@/modules/shared/views/CadastrarAluno.vue')
    }
]