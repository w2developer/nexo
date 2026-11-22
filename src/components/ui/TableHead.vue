<!-- TableHead.vue -->
<script setup>
    import { cn } from '../../utils/cn'

    const props = defineProps({
        class: { type: String, default: '' },
        align: { type: String, default: 'left' },
        vAlign: { type: String, default: 'middle' }
    })

    const align = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right'
    }

    const vAlign = {
        top: 'align-top',
        middle: 'align-middle',
        bottom: 'align-bottom'
    }
</script>

<template>
    <th
        :class="
            cn(
                'h-12 px-4 font-medium text-muted-foreground',
                align[props.align],
                vAlign[props.vAlign],
                props.class
            )
        "
    >
        <slot />
    </th>
</template>