<script setup>
import { ChevronRight, Home } from '@lucide/vue'
import { RouterLink } from 'vue-router'

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
                    {{ item.label }}
                </RouterLink>
                <span v-else class="text-foreground font-semibold flex items-center">
                    <Home v-if="item.icon === 'home'" class="w-4 h-4 mr-1.5" />
                    {{ item.label }}
                </span>
                <ChevronRight
                    v-if="index < items.length - 1"
                    class="w-4 h-4 mx-2 text-muted-foreground/50"
                />
            </div>
        </template>
    </nav>
</template>
