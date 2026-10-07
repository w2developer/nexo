<script setup>
import { inject, computed } from 'vue'
import { cn } from '../../utils/cn'

const { activeItem } = inject('accordionState')
const itemValue = inject('accordionItemValue')

const isOpen = computed(() => activeItem.value === itemValue)

const props = defineProps({
    class: { type: String, default: '' },
})
</script>

<template>
    <div
        :class="
            cn(
                'grid transition-all duration-300 ease-in-out',
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
            )
        "
    >
        <div class="overflow-hidden">
            <div :class="cn('pb-4 pt-0 text-sm text-muted-foreground', props.class)">
                <slot />
            </div>
        </div>
    </div>
</template>
