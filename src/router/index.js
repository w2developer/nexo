import { createRouter, createWebHistory } from 'vue-router'

// Rotas de Alunos
import alunoRoutes from '@/modules/aluno/routers/alunoRoutes.js'
import professorRoutes from '@/modules/professor/routers/professorRoutes.js'

const routes = [
    // Redireciona a raiz para o painel correto ou login
    {
        path: '/',
        redirect: () => {
            const token = sessionStorage.getItem('token_acesso')
            const tipo = sessionStorage.getItem('tipo_usuario')

            if (!token || !tipo) return '/login'

            const rotasIniciais = {
                aluno: '/aluno/painel',
                professor: '/professor/presenca',
                secretaria: '/secretaria',
                admin: '/admin',
            }

            return rotasIniciais[tipo] || '/login'
        },
    },
    {
        path: '/test',
        component: () => import('@/views/public/Test.vue')
    },

    // Rotas de Autenticação
    { path: '/login', component: () => import('../views/public/Login.vue') },

    // Rota Temporária para Testes
    { path: '/seed', component: () => import('../views/public/SeedData.vue') },

    // Rotas Aluno
    ...alunoRoutes,

    // Rotas Professor
    ...professorRoutes,

    // Rotas Secretaria
    // {
    //     path: '/secretaria',
    //     component: () => import('../views/secretaria/Home.vue'),
    //     meta: { roles: ['secretaria', 'admin'] },
    // },

    // Rotas Admin (Acesso total)
    // {
    //     path: '/admin',
    //     component: () => import('../views/admin/Home.vue'),
    //     meta: { roles: ['admin'] },
    // },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to, from) => {
    const token = sessionStorage.getItem('token_acesso')
    const tipo = sessionStorage.getItem('tipo_usuario')
    const rolesPermitidas = to.meta.roles

    // Se a rota for livre (sem meta.roles), deixa passar
    if (!rolesPermitidas) return true

    // Se a rota for protegida e não houver token, manda pro login
    if (!token) return '/login'

    // Se o usuário tentar acessar uma rota da qual não tem permissão
    if (!rolesPermitidas.includes(tipo)) {
        // Manda de volta para a respectiva tela inicial
        if (tipo === 'aluno') return '/aluno/painel'
        if (tipo === 'professor') return '/professor/presenca'
        if (tipo === 'secretaria') return '/secretaria'
        if (tipo === 'admin') return '/admin'
    }

    return true
})

export default router
