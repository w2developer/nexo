<script setup>
import { inject, computed } from 'vue'
import { ChevronDown } from '@lucide/vue'
import { cn } from '../../utils/cn'

const { activeItem, toggle } = inject('accordionState')
const itemValue = inject('accordionItemValue')

const isOpen = computed(() => activeItem.value === itemValue)

const props = defineProps({
    class: { type: String, default: '' },
})
</script>

<template>
    <div class="flex">
        <button
            type="button"
            @click="toggle(itemValue)"
            :class="
                cn(
                    'flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all hover:underline',
                    props.class,
                )
            "
        >
            <slot />
            <ChevronDown
                :class="
                    cn(
                        'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                        isOpen && 'rotate-180',
                    )
                "
            />
        </button>
    </div>
</template>
