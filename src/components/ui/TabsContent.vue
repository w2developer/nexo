<script setup>
import { inject } from 'vue'
import { cn } from '../../utils/cn'

const props = defineProps({
    value: { type: String, required: true },
    class: { type: String, default: '' },
})

const activeTab = inject('activeTab')
</script>

<template>
    <div
        v-if="activeTab === value"
        :class="
            cn(
                'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                props.class,
            )
        "
    >
        <slot />
    </div>
</template>
