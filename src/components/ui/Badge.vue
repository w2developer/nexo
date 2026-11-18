<script setup> 
import { cn } from '../../utils/cn'
import { cva } from 'class-variance-authority'

const badgeVariants = cva(
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    {
        variants: {
            variant: {
                // Ações principais e secundárias
                default: 'border border-transparent bg-blue-100 text-blue-700 hover:bg-blue-200 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20',
                secondary: 'border border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                
                // Semânticas de status (como o seu badge "Pendente")
                success: 'border border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20',
                warning: 'border border-transparent bg-amber-100 text-amber-700 hover:bg-amber-200 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20',
                destructive: 'border border-transparent bg-rose-100 text-rose-700 hover:bg-rose-200 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20',
                info: 'border border-transparent bg-sky-100 text-sky-700 hover:bg-sky-200 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-400 dark:hover:bg-sky-500/20',
                
                // Destaques e estados inativos
                accent: 'border border-transparent bg-violet-100 text-violet-700 hover:bg-violet-200 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-400 dark:hover:bg-violet-500/20',
                muted: 'border border-transparent bg-gray-100 text-gray-500 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
                
                // Estruturais / Sem fundo sólido
                outline: 'border border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/50',
                ghost: 'border border-transparent bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }
        },
        defaultVariants: {
            variant: 'default',
        },
    },
)

const props = defineProps({
    variant: { type: String, default: 'default' },
    class: { type: String, default: '' },
})
</script>

<template>
    <div :class="cn(badgeVariants({ variant }), props.class)">
        <slot />
    </div>
</template>
