export default [
    {
        path: '/aluno',
        component: () => import('@/layouts/AlunoLayout.vue'),
        meta: { roles: ['aluno'] },
        children: [
            {
                path: 'painel',
                component: () => import('@/modules/aluno/Painel.vue'),
            },
            {
                path: 'atividades',
                component: () => import('@/modules/aluno/views/Atividades.vue'),
            },
            {
                path: 'apostilas',
                component: () => import('@/modules/aluno/views/Apostilas.vue'),
            },
            {
                path: 'auxiliares',
                component: () => import('@/modules/aluno/views/Auxiliares.vue'),
            },
        ],
    },
]
