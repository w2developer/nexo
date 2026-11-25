import sharedRoutes from '@/modules/shared/routers/sharedRoutes';

export default [
    {
        path: '/professor',
        component: () => import('@/layouts/ProfessorLayout.vue'),
        meta: { roles: ['professor'] },
        children: [
            {
                path: 'presenca',
                component: () => import('@/modules/professor/views/Presenca.vue')
            },
            {
                path: 'validacao-atividades',
                component: () => import('@/modules/professor/views/ValidacaoAtividades.vue')
            },
            {
                path: 'dashboard',
                component: () => import('@/modules/shared/views/Dashboard.vue')
            },
            {
                path: 'gestao-de-conteudo',
                component: () => import('@/modules/professor/views/GestaoConteudo.vue')
            },
            ...sharedRoutes
        ]
    }
];