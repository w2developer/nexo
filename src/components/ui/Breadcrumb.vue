<script setup>
import { ChevronRight, Home } from '@lucide/vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

defineProps({
    items: {
        type: Array,
        required: true,
    },
    class: {
        type: String,
        default: 'mb-6 pb-2',
    },
})

// Intercepta IDs brutos e substitui por nomes amigáveis baseados na URL atual
const formatarLabel = (label) => {
    if (!label) return '';
    
    const texto = String(label);

    // Regex para identificar UUID (ex: 74f32e58-3481-4c15...) ou IDs numéricos (ex: 42)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(texto);
    const isNumero = /^\d+$/.test(texto);

    if (isUUID || isNumero) {
        const path = route.path.toLowerCase();
        
        // Define o nome de acordo com a rota em que o usuário está
        if (path.includes('editar-aluno')) return 'Editar Aluno';
        if (path.includes('nova-matricula')) return 'Nova Matrícula';
        if (path.includes('horarios')) return 'Grade de Horários';
        
        // Fallback genérico caso crie outras rotas com ID no futuro
        return 'Detalhes';
    }

    return texto;
}
</script>

<template>
    <nav
        :class="[
            'flex items-center text-sm text-muted-foreground overflow-x-auto whitespace-nowrap',
            $props.class,
        ]"
        aria-label="Breadcrumb"
    >
        <template v-for="(item, index) in items" :key="index">
            <div class="flex items-center">
                <RouterLink
                    v-if="item.to"
                    :to="item.to"
                    class="hover:text-foreground flex items-center transition-colors font-medium"
                >
                    <Home v-if="item.icon === 'home'" class="w-4 h-4 mr-1.5" />
                    {{ formatarLabel(item.label) }}
                </RouterLink>
                
                <span v-else class="text-foreground font-semibold flex items-center">
                    <Home v-if="item.icon === 'home'" class="w-4 h-4 mr-1.5" />
                    {{ formatarLabel(item.label) }}
                </span>
                
                <ChevronRight
                    v-if="index < items.length - 1"
                    class="w-4 h-4 mx-2 text-muted-foreground/50"
                />
            </div>
        </template>
    </nav>
</template>