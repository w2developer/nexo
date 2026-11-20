import sharedRoutes from '@/modules/shared/routers/sharedRoutes'

export default [
    {
        path: '/secretaria',
        component: () => import('@/layouts/SecretariaLayout.vue'),
        meta: { roles: ['secretaria'] },
        children: [
            {
                path: 'dashboard',
                component: () => import('@/modules/shared/views/Dashboard.vue'),
            },
            ...sharedRoutes,
        ],
    },
]
