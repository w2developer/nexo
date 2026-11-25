export default [
    {
        path: '/aluno',
        component: () => import('@/layouts/AlunoLayout.vue'),
        meta: { roles: ['aluno'] },
        children: [
            {
                path: 'painel',
                component: () => import('@/modules/aluno/Painel.vue')
            },
            {
                path: 'ranking',
                component: () => import('@/modules/aluno/views/Ranking.vue')
            },
            {
                path: 'atividades',
                component: () => import('@/modules/aluno/views/Atividades.vue')
            },
            {
                path: 'atividades/:cursoId',
                component: () => import('@/modules/aluno/views/CursoModulos.vue'),
                meta: { breadcrumb: 'Módulos' }
            },
            {
                path: 'atividades/:cursoId/:moduloId',
                component: () => import('@/modules/aluno/views/ModuloAtividades.vue'),
                meta: { breadcrumb: 'Atividades do Módulo' }
            },
            {
                path: 'atividades/:cursoId/:moduloId/:atividadeId',
                component: () => import('@/modules/aluno/views/AtividadeDetalhe.vue'),
                meta: { breadcrumb: 'Atividade' }
            },
            {
                path: 'apostilas',
                component: () => import('@/modules/aluno/views/Apostilas.vue')
            },
            {
                path: 'apostilas/:cursoId',
                component: () => import('@/modules/aluno/views/CursoApostilas.vue'),
                meta: { breadcrumb: 'Apostilas do Curso' }
            },
            {
                path: 'auxiliares',
                component: () => import('@/modules/aluno/views/Auxiliares.vue')
            }
        ]
    }
];