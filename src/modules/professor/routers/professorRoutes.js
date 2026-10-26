import sharedRoutes from '@/modules/shared/routers/sharedRoutes'

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
            ...sharedRoutes,
        ],
    },
]
